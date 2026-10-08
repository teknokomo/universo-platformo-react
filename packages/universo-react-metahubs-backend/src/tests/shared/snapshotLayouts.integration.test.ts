import { randomBytes } from 'node:crypto'
import type { Knex } from 'knex'
import { createKnexExecutor, qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils/database'
import { acquireMetahubLayoutGraphLock } from '../../domains/layouts/layoutGraphLocks'
import { attachLayoutsToSnapshot } from '../../domains/shared/snapshotLayouts'
import type { MetahubSnapshot } from '../../domains/publications/services/SnapshotSerializer'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`

describeIntegration('layout snapshot transaction integration (requires PostgreSQL)', () => {
    let knex: Knex
    let schemaName: string

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({
            client: 'pg',
            connection: DATABASE_TEST_URL,
            pool: { min: 1, max: 10 }
        })
        schemaName = `mhb_${randomBytes(16).toString('hex')}_b1`

        const schema = quoteIdentifier(schemaName)
        const layoutsTable = qSchemaTable(schemaName, '_mhb_layouts')
        const widgetsTable = qSchemaTable(schemaName, '_mhb_widgets')
        const overridesTable = qSchemaTable(schemaName, '_mhb_layout_widget_overrides')

        await knex.raw(`CREATE SCHEMA ${schema}`)
        await knex.raw(`
            CREATE TABLE ${layoutsTable} (
                id uuid PRIMARY KEY,
                scope_entity_id uuid NULL,
                base_layout_id uuid NULL,
                template_key text NOT NULL,
                name jsonb NOT NULL,
                description jsonb NULL,
                config jsonb NOT NULL,
                is_active boolean NOT NULL,
                is_default boolean NOT NULL,
                sort_order integer NOT NULL,
                _upl_deleted boolean NOT NULL DEFAULT false,
                _mhb_deleted boolean NOT NULL DEFAULT false,
                _upl_created_at timestamptz NOT NULL DEFAULT now()
            )
        `)
        await knex.raw(`
            CREATE TABLE ${widgetsTable} (
                id uuid PRIMARY KEY,
                layout_id uuid NOT NULL,
                instance_key text NOT NULL,
                parent_widget_id uuid NULL,
                slot_key text NULL,
                zone text NOT NULL,
                widget_key text NOT NULL,
                sort_order integer NOT NULL,
                config jsonb NOT NULL,
                is_active boolean NOT NULL,
                _upl_deleted boolean NOT NULL DEFAULT false,
                _mhb_deleted boolean NOT NULL DEFAULT false,
                _upl_created_at timestamptz NOT NULL DEFAULT now(),
                UNIQUE (layout_id, instance_key),
                FOREIGN KEY (layout_id) REFERENCES ${layoutsTable}(id),
                FOREIGN KEY (parent_widget_id) REFERENCES ${widgetsTable}(id),
                CHECK ((parent_widget_id IS NULL AND slot_key IS NULL) OR (parent_widget_id IS NOT NULL AND slot_key IS NOT NULL)),
                CHECK (parent_widget_id IS NULL OR parent_widget_id <> id)
            )
        `)
        await knex.raw(`
            CREATE TABLE ${overridesTable} (
                id uuid PRIMARY KEY,
                layout_id uuid NOT NULL,
                base_widget_id uuid NOT NULL,
                zone text NULL,
                sort_order integer NULL,
                config jsonb NULL,
                is_active boolean NULL,
                is_deleted_override boolean NOT NULL,
                _upl_deleted boolean NOT NULL DEFAULT false,
                _mhb_deleted boolean NOT NULL DEFAULT false,
                _upl_created_at timestamptz NOT NULL DEFAULT now()
            )
        `)

        await knex.raw(
            `INSERT INTO ${layoutsTable}
                (id, template_key, name, config, is_active, is_default, sort_order)
             VALUES (?, ?, ?::jsonb, ?::jsonb, ?, ?, ?)`,
            [
                '019e8afa-0000-7000-8000-000000000001',
                'dashboard',
                JSON.stringify({ en: 'Dashboard' }),
                JSON.stringify({ __layout: { composition: { mode: 'independent', baseLayoutId: null } } }),
                true,
                true,
                0
            ]
        )
        await knex.raw(
            `INSERT INTO ${widgetsTable}
                (id, layout_id, instance_key, parent_widget_id, slot_key, zone, widget_key, sort_order, config, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)`,
            [
                '019e8afa-0000-7000-8000-000000000002',
                '019e8afa-0000-7000-8000-000000000001',
                'dashboard-columns',
                null,
                null,
                'center',
                'columnsContainer',
                0,
                JSON.stringify({ columns: [{ slotKey: 'column:primary', width: 12 }] }),
                true
            ]
        )
        await knex.raw(
            `INSERT INTO ${widgetsTable}
                (id, layout_id, instance_key, parent_widget_id, slot_key, zone, widget_key, sort_order, config, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)`,
            [
                '019e8afa-0000-7000-8000-000000000003',
                '019e8afa-0000-7000-8000-000000000001',
                'dashboard-canvas',
                '019e8afa-0000-7000-8000-000000000002',
                'column:primary',
                'center',
                'playcanvasCanvas',
                1,
                JSON.stringify({}),
                true
            ]
        )
    })

    afterAll(async () => {
        if (knex) {
            await knex.raw(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`)
            await knex.destroy()
        }
    })

    it('keeps layout and widget rows from one graph state while a concurrent mutation waits for the snapshot lock', async () => {
        const layoutsTable = qSchemaTable(schemaName, '_mhb_layouts')
        const widgetsTable = qSchemaTable(schemaName, '_mhb_widgets')
        const snapshotExecutor = createKnexExecutor(knex)
        const mutationExecutor = createKnexExecutor(knex)

        let releaseLayoutRead!: () => void
        let signalLayoutRead!: () => void
        const layoutRead = new Promise<void>((resolve) => {
            signalLayoutRead = resolve
        })
        const layoutReadRelease = new Promise<void>((resolve) => {
            releaseLayoutRead = resolve
        })

        const snapshotTransactionExecutor = createGatedExecutor(snapshotExecutor, layoutsTable, async () => {
            signalLayoutRead()
            await layoutReadRelease
        })

        let signalMutationAttempted!: () => void
        const mutationAttempted = new Promise<void>((resolve) => {
            signalMutationAttempted = resolve
        })
        let mutationLockAcquired = false

        const snapshot = {} as MetahubSnapshot
        const snapshotPromise = attachLayoutsToSnapshot({
            executor: snapshotTransactionExecutor,
            schemaService: { ensureSchema: async () => schemaName } as any,
            snapshot,
            metahubId: '019e8afa-0000-7000-8000-000000000010',
            userId: '019e8afa-0000-7000-8000-000000000011'
        })

        await layoutRead
        const mutationPromise = mutationExecutor.transaction(async (tx) => {
            signalMutationAttempted()
            await acquireMetahubLayoutGraphLock(tx, schemaName)
            mutationLockAcquired = true
            await tx.query(
                `UPDATE ${widgetsTable}
                 SET widget_key = $1, config = $2::jsonb
                 WHERE id = $3`,
                ['detailsTable', JSON.stringify({}), '019e8afa-0000-7000-8000-000000000002']
            )
        })
        await mutationAttempted
        expect(mutationLockAcquired).toBe(false)

        releaseLayoutRead()
        await snapshotPromise
        expect(snapshot.layouts).toEqual([expect.objectContaining({ id: '019e8afa-0000-7000-8000-000000000001' })])
        expect(snapshot.layoutZoneWidgets).toEqual([
            expect.objectContaining({
                id: '019e8afa-0000-7000-8000-000000000002',
                instanceKey: 'dashboard-columns',
                parentWidgetId: null,
                slotKey: null,
                widgetKey: 'columnsContainer'
            }),
            expect.objectContaining({
                id: '019e8afa-0000-7000-8000-000000000003',
                instanceKey: 'dashboard-canvas',
                parentWidgetId: '019e8afa-0000-7000-8000-000000000002',
                slotKey: 'column:primary',
                widgetKey: 'playcanvasCanvas'
            })
        ])

        await mutationPromise
        expect(mutationLockAcquired).toBe(true)
        await expect(
            knex.raw(`SELECT widget_key FROM ${widgetsTable} WHERE id = ?`, ['019e8afa-0000-7000-8000-000000000002'])
        ).resolves.toMatchObject({
            rows: [{ widget_key: 'detailsTable' }]
        })
    })
})

const createGatedExecutor = (executor: DbExecutor, layoutsTable: string, onLayoutRead: () => Promise<void>): DbExecutor => {
    const wrap = (current: DbExecutor): DbExecutor => ({
        query: async <T = unknown>(sql: string, parameters?: unknown[]) => {
            const rows = await current.query<T>(sql, parameters)
            if (sql.includes(`FROM ${layoutsTable}`)) {
                await onLayoutRead()
            }
            return rows
        },
        transaction: async <T>(work: (tx: DbExecutor) => Promise<T>) => current.transaction((tx) => work(wrap(tx))),
        isReleased: () => current.isReleased()
    })

    return wrap(executor)
}
