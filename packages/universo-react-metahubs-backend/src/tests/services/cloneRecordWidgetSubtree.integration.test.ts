import { randomBytes } from 'node:crypto'
import type { Knex } from 'knex'
import { createKnexExecutor, qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils/database'
import { isUuidV7 } from '@universo-react/utils'
import {
    buildSingleTargetWidgetBinding,
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition
} from '@universo-react/types'
import { MetahubSchemaService } from '../../domains/metahubs/services/MetahubSchemaService'
import { SystemTableDDLGenerator } from '../../domains/metahubs/services/SystemTableDDLGenerator'
import { SYSTEM_TABLES } from '../../domains/metahubs/services/systemTableDefinitions'
import { cloneRecordWidgetBindingsInSubtree } from '../../domains/layouts/services/cloneRecordWidgetSubtree'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip
const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`
const localizedCodename = (content: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: { en: { content, version: 1, isActive: true } }
})

const metahubId = '0190a9b5-3cde-7abc-8def-0123456789a1'
const objectId = '0190a9b5-3cde-7abc-8def-000000000001'
const sourceRecordId = '0190a9b5-3cde-7abc-8def-000000000011'
const userId = '0190a9b5-3cde-7abc-8def-0123456789a2'

const createPlacement = (id: string, widgetKey: 'infoCard' | 'overviewTitle', zone: 'left' | 'center') => {
    const definition = getLayoutWidgetDefinition(widgetKey)
    if (!definition) throw new Error(`Missing widget definition: ${widgetKey}`)
    const bindings = buildSingleTargetWidgetBinding(definition, 'content', {
        entityKind: 'object',
        entityCodename: 'Announcements',
        semanticKey: 'feature-1'
    })
    return {
        id,
        widgetKey,
        zone,
        config: encodeWidgetConfigEnvelope({ rendererConfig: {}, neutral: { bindings } }, { templateKey: 'dashboard', widgetKey, zone })
    }
}

describeIntegration('Dashboard clone-record subtree transaction integration (requires PostgreSQL)', () => {
    let knex: Knex
    let executor: DbExecutor
    let schemaName: string

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({ client: 'pg', connection: DATABASE_TEST_URL, pool: { min: 1, max: 4 } })
        executor = createKnexExecutor(knex)
        schemaName = `mhb_${randomBytes(16).toString('hex')}_b1`
        await knex.raw('CREATE SCHEMA ??', [schemaName])

        const generator = new SystemTableDDLGenerator(knex, schemaName)
        for (const tableName of ['_mhb_objects', '_mhb_constants', '_mhb_components', '_mhb_elements']) {
            const definition = SYSTEM_TABLES.find(({ name }) => name === tableName)
            if (!definition) throw new Error(`Missing system table definition: ${tableName}`)
            await generator.createTable(definition)
        }
        await knex.schema.withSchema(schemaName).createTable('_mhb_widgets', (table) => {
            table.uuid('id').primary()
            table.jsonb('config').notNullable()
        })

        jest.spyOn(MetahubSchemaService.prototype, 'ensureSchema').mockResolvedValue(schemaName)
    })

    afterAll(async () => {
        jest.restoreAllMocks()
        if (knex) {
            try {
                if (schemaName) await knex.raw(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`)
            } finally {
                await knex.destroy()
            }
        }
    })

    beforeEach(async () => {
        await knex.raw(
            `TRUNCATE ${['_mhb_widgets', '_mhb_elements', '_mhb_components', '_mhb_constants', '_mhb_objects']
                .map((tableName) => qSchemaTable(schemaName, tableName))
                .join(', ')}`
        )
        await knex
            .withSchema(schemaName)
            .table('_mhb_objects')
            .insert({
                id: objectId,
                kind: 'object',
                codename: localizedCodename('Announcements'),
                config: {},
                presentation: {},
                _upl_deleted: false,
                _mhb_deleted: false
            })
        await knex
            .withSchema(schemaName)
            .table('_mhb_components')
            .insert([
                {
                    id: '0190a9b5-3cde-7abc-8def-000000000101',
                    object_id: objectId,
                    codename: localizedCodename('Key'),
                    data_type: 'STRING',
                    is_required: true,
                    validation_rules: { unique: true, maxLength: 128, pattern: '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$' },
                    sort_order: 1,
                    is_system: false,
                    _upl_deleted: false,
                    _mhb_deleted: false
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-000000000102',
                    object_id: objectId,
                    codename: localizedCodename('Title'),
                    data_type: 'STRING',
                    is_required: true,
                    validation_rules: { localized: true, maxLength: 255 },
                    sort_order: 2,
                    is_system: false,
                    _upl_deleted: false,
                    _mhb_deleted: false
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-000000000103',
                    object_id: objectId,
                    codename: localizedCodename('Body'),
                    data_type: 'STRING',
                    is_required: false,
                    validation_rules: { localized: true, maxLength: 4096 },
                    sort_order: 3,
                    is_system: false,
                    _upl_deleted: false,
                    _mhb_deleted: false
                }
            ])
        await knex
            .withSchema(schemaName)
            .table('_mhb_elements')
            .insert({
                id: sourceRecordId,
                object_id: objectId,
                data: {
                    Key: 'feature-1',
                    Title: localizedCodename('Feature'),
                    Body: localizedCodename('A short description')
                },
                sort_order: 1,
                _upl_version: 1,
                _upl_deleted: false,
                _mhb_deleted: false
            })
    })

    it('copies each registered bound Object row and persists distinct semantic bindings for all subtree widgets', async () => {
        const placements = [
            createPlacement('0190a9b5-3cde-7abc-8def-000000000201', 'infoCard', 'left'),
            createPlacement('0190a9b5-3cde-7abc-8def-000000000202', 'overviewTitle', 'center')
        ]

        const configs = await executor.transaction((tx) =>
            cloneRecordWidgetBindingsInSubtree({
                executor: tx,
                metahubId,
                schemaName,
                templateKey: 'dashboard',
                placements,
                userId
            })
        )

        expect(configs.size).toBe(2)
        const records = await knex.withSchema(schemaName).table('_mhb_elements').select('id', 'data').orderBy('sort_order')
        expect(records).toHaveLength(3)
        expect(records.slice(1).every(({ id }) => isUuidV7(id))).toBe(true)
        expect(records.slice(1).map(({ data }) => data.Key)).toEqual(['feature-1-copy', 'feature-1-copy-2'])

        for (const placement of placements) {
            const copiedConfig = configs.get(placement.id)
            const decoded = decodeWidgetConfigEnvelope(copiedConfig, {
                templateKey: 'dashboard',
                widgetKey: placement.widgetKey,
                zone: placement.zone,
                requireBindings: true
            })
            const selector = decoded.neutral.bindings?.slots[0].targets[0].selector
            expect(selector).toMatchObject({ kind: 'semantic-key' })
            if (selector?.kind !== 'semantic-key') throw new Error('Copied binding lost its semantic-key selector')
            expect(records.slice(1).some(({ data }) => data.Key === selector.value)).toBe(true)
        }
    })

    it('rolls back copied Object records and a placement when subtree insertion fails in the same transaction', async () => {
        const placement = createPlacement('0190a9b5-3cde-7abc-8def-000000000203', 'infoCard', 'left')

        await expect(
            executor.transaction(async (tx) => {
                const configs = await cloneRecordWidgetBindingsInSubtree({
                    executor: tx,
                    metahubId,
                    schemaName,
                    templateKey: 'dashboard',
                    placements: [placement],
                    userId
                })
                await tx.query(`INSERT INTO ${qSchemaTable(schemaName, '_mhb_widgets')} (id, config) VALUES ($1, $2::jsonb)`, [
                    placement.id,
                    JSON.stringify(configs.get(placement.id))
                ])
                throw new Error('Simulated placement insert failure')
            })
        ).rejects.toThrow('Simulated placement insert failure')

        const records = await knex.withSchema(schemaName).table('_mhb_elements').select('id')
        const widgets = await knex.withSchema(schemaName).table('_mhb_widgets').select('id')
        expect(records).toEqual([{ id: sourceRecordId }])
        expect(widgets).toEqual([])
    })
})
