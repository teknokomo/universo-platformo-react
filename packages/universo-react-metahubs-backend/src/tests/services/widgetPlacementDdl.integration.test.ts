import { randomBytes } from 'node:crypto'
import type { Knex } from 'knex'
import { SystemTableDDLGenerator } from '../../domains/metahubs/services/SystemTableDDLGenerator'
import { SYSTEM_TABLES } from '../../domains/metahubs/services/systemTableDefinitions'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip

describeIntegration('fresh metahub widget placement DDL (requires PostgreSQL)', () => {
    let knex: Knex
    let schemaName: string

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({ client: 'pg', connection: DATABASE_TEST_URL })
        schemaName = `mhb_widget_placement_${randomBytes(10).toString('hex')}`

        await knex.raw('CREATE SCHEMA ??', [schemaName])
        await knex.schema.withSchema(schemaName).createTable('_mhb_layouts', (table) => {
            table.uuid('id').primary()
            table.uuid('base_layout_id').nullable()
        })

        const widgetsTable = SYSTEM_TABLES.find((table) => table.name === '_mhb_widgets')!
        await new SystemTableDDLGenerator(knex, schemaName).createTable(widgetsTable)
    })

    afterAll(async () => {
        if (knex) {
            try {
                if (schemaName) await knex.raw('DROP SCHEMA IF EXISTS ?? CASCADE', [schemaName])
            } finally {
                await knex.destroy()
            }
        }
    })

    it('restores overlay children under declared base parents and rejects unrelated layouts', async () => {
        const layoutId = '019a0000-0000-7000-8000-000000000001'
        const overlayLayoutId = '019a0000-0000-7000-8000-000000000002'
        const unrelatedLayoutId = '019a0000-0000-7000-8000-000000000003'
        const rootId = '019a0000-0000-7000-8000-000000000011'
        const sameLayoutChildId = '019a0000-0000-7000-8000-000000000012'
        const overlayRootId = '019a0000-0000-7000-8000-000000000013'
        const overlayChildId = '019a0000-0000-7000-8000-000000000014'
        const overlayNestedChildId = '019a0000-0000-7000-8000-000000000015'
        const crossLayoutChildId = '019a0000-0000-7000-8000-000000000019'

        await knex
            .withSchema(schemaName)
            .table('_mhb_layouts')
            .insert([
                { id: layoutId, base_layout_id: null },
                { id: overlayLayoutId, base_layout_id: layoutId },
                { id: unrelatedLayoutId, base_layout_id: null }
            ])

        const insertWidget = (row: Record<string, unknown>) =>
            knex
                .withSchema(schemaName)
                .table('_mhb_widgets')
                .insert({
                    zone: 'main',
                    widget_key: 'testWidget',
                    config: {},
                    is_active: true,
                    ...row
                })
        const insertWidgets = (rows: Array<Record<string, unknown>>) =>
            knex
                .withSchema(schemaName)
                .table('_mhb_widgets')
                .insert(
                    rows.map((row) => ({
                        zone: 'main',
                        widget_key: 'testWidget',
                        config: {},
                        is_active: true,
                        ...row
                    }))
                )

        await insertWidget({ id: rootId, layout_id: layoutId, instance_key: 'root' })
        await insertWidget({
            id: sameLayoutChildId,
            layout_id: layoutId,
            instance_key: 'same-layout-child',
            parent_widget_id: rootId,
            slot_key: 'content'
        })
        await insertWidget({ id: overlayRootId, layout_id: overlayLayoutId, instance_key: 'overlay-root' })
        await insertWidget({ id: overlayChildId, layout_id: overlayLayoutId, instance_key: 'restored-overlay-child' })
        await knex
            .withSchema(schemaName)
            .table('_mhb_widgets')
            .where({ id: overlayChildId })
            .update({ parent_widget_id: rootId, slot_key: 'column:main' })
        await insertWidget({
            id: overlayNestedChildId,
            layout_id: overlayLayoutId,
            instance_key: 'overlay-nested-child',
            parent_widget_id: overlayRootId,
            slot_key: 'content'
        })

        const restoredChild = await knex
            .withSchema(schemaName)
            .table('_mhb_widgets')
            .select('layout_id', 'parent_widget_id', 'slot_key')
            .where({ id: overlayChildId })
            .first()
        expect(restoredChild).toEqual({ layout_id: overlayLayoutId, parent_widget_id: rootId, slot_key: 'column:main' })

        await expect(
            insertWidget({
                id: crossLayoutChildId,
                layout_id: unrelatedLayoutId,
                instance_key: 'unrelated-layout-parent',
                parent_widget_id: rootId,
                slot_key: 'content'
            })
        ).rejects.toMatchObject({ code: '23514' })

        const sameStatementChildId = '019a0000-0000-7000-8000-000000000022'
        const sameStatementParentId = '019a0000-0000-7000-8000-000000000023'
        await expect(
            insertWidgets([
                {
                    id: sameStatementChildId,
                    layout_id: unrelatedLayoutId,
                    instance_key: 'same-statement-child',
                    parent_widget_id: sameStatementParentId,
                    slot_key: 'content'
                },
                { id: sameStatementParentId, layout_id: layoutId, instance_key: 'same-statement-parent' }
            ])
        ).rejects.toMatchObject({ code: '23514' })
        const sameStatementRows = await knex
            .withSchema(schemaName)
            .table('_mhb_widgets')
            .whereIn('id', [sameStatementChildId, sameStatementParentId])
        expect(sameStatementRows).toEqual([])

        await expect(
            knex.withSchema(schemaName).table('_mhb_layouts').where({ id: overlayLayoutId }).update({ base_layout_id: unrelatedLayoutId })
        ).rejects.toMatchObject({ code: '23514' })
        await expect(
            knex.withSchema(schemaName).table('_mhb_widgets').where({ id: rootId }).update({ layout_id: unrelatedLayoutId })
        ).rejects.toMatchObject({ code: '23514' })

        const rollbackParentId = '019a0000-0000-7000-8000-000000000020'
        const rollbackChildId = '019a0000-0000-7000-8000-000000000021'
        await expect(
            knex.transaction(async (transaction) => {
                await transaction.withSchema(schemaName).table('_mhb_widgets').insert({
                    id: rollbackParentId,
                    layout_id: layoutId,
                    instance_key: 'rollback-parent',
                    zone: 'main',
                    widget_key: 'testWidget',
                    config: {},
                    is_active: true
                })
                await transaction.withSchema(schemaName).table('_mhb_widgets').insert({
                    id: rollbackChildId,
                    layout_id: unrelatedLayoutId,
                    instance_key: 'rollback-child',
                    zone: 'main',
                    widget_key: 'testWidget',
                    config: {},
                    is_active: true
                })
                await transaction
                    .withSchema(schemaName)
                    .table('_mhb_widgets')
                    .where({ id: rollbackChildId })
                    .update({ parent_widget_id: rollbackParentId, slot_key: 'content' })
            })
        ).rejects.toMatchObject({ code: '23514' })
        const rolledBackRows = await knex.withSchema(schemaName).table('_mhb_widgets').whereIn('id', [rollbackParentId, rollbackChildId])
        expect(rolledBackRows).toEqual([])

        await expect(
            insertWidget({
                id: '019a0000-0000-7000-8000-000000000013',
                layout_id: layoutId,
                instance_key: 'bad-null-pair',
                slot_key: 'content'
            })
        ).rejects.toMatchObject({ code: '23514' })
        await expect(
            insertWidget({
                id: '019a0000-0000-7000-8000-000000000014',
                layout_id: layoutId,
                instance_key: 'self-parent',
                parent_widget_id: '019a0000-0000-7000-8000-000000000014',
                slot_key: 'content'
            })
        ).rejects.toMatchObject({ code: '23514' })
        await expect(
            insertWidget({
                id: '019a0000-0000-7000-8000-000000000016',
                layout_id: unrelatedLayoutId,
                instance_key: 'missing-parent',
                parent_widget_id: '019a0000-0000-7000-8000-000000000099',
                slot_key: 'content'
            })
        ).rejects.toMatchObject({ code: '23503' })
        await expect(
            insertWidget({ id: '019a0000-0000-7000-8000-000000000017', layout_id: layoutId, instance_key: 'root' })
        ).rejects.toMatchObject({ code: '23505' })
        await expect(
            insertWidget({ id: '019a0000-0000-7000-8000-000000000018', layout_id: layoutId, instance_key: null })
        ).rejects.toMatchObject({ code: '23502' })

        await knex.withSchema(schemaName).table('_mhb_widgets').where({ id: rootId }).delete()
        const remainingSubtreeRows = await knex
            .withSchema(schemaName)
            .table('_mhb_widgets')
            .whereIn('id', [rootId, sameLayoutChildId, overlayChildId])
        expect(remainingSubtreeRows).toEqual([])
    })
})
