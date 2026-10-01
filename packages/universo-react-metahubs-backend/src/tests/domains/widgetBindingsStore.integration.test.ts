import { randomBytes } from 'node:crypto'
import type { Knex } from 'knex'
import { createKnexExecutor, qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils/database'
import {
    countWidgetBindingObjectRecords,
    findWidgetBindingRecordBySemanticKey,
    listWidgetBindingComponents,
    listWidgetBindingObjectCandidates,
    listWidgetBindingRelationCompatibleObjectIds,
    listWidgetBindingSemanticRecords,
    loadWidgetBindingWidget,
    updateWidgetBindingConfig
} from '../../domains/layouts/widgetBindingsStore'
import { MetahubConflictError } from '../../domains/shared/domainErrors'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip
const baseUuid = '018f8a78-7b8f-7c1d-a111-2222333345'
const uuid = (suffix: number): string => `${baseUuid}${suffix.toString(16).padStart(2, '0')}`
const localizedCodename = (content: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: { en: { content, version: 1, isActive: true } }
})
const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`

describeIntegration('Marketing widget binding SQL store integration (requires PostgreSQL)', () => {
    let knex: Knex
    let executor: DbExecutor
    let schemaName: string

    const insertObject = async (id: string, codename: string, presentation: unknown = {}) =>
        knex
            .withSchema(schemaName)
            .table('_mhb_objects')
            .insert({
                id,
                kind: 'object',
                codename: localizedCodename(codename),
                presentation,
                config: {},
                _upl_deleted: false,
                _mhb_deleted: false
            })

    const insertRecord = async (
        id: string,
        objectId: string,
        data: Record<string, unknown>,
        options: { sortOrder?: number; deleted?: boolean } = {}
    ) =>
        knex
            .withSchema(schemaName)
            .table('_mhb_elements')
            .insert({
                id,
                object_id: objectId,
                data,
                sort_order: options.sortOrder ?? 1,
                _upl_version: 1,
                _upl_deleted: options.deleted ?? false,
                _mhb_deleted: false
            })

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({
            client: 'pg',
            connection: DATABASE_TEST_URL,
            pool: { min: 1, max: 4 }
        })
        executor = createKnexExecutor(knex)
        schemaName = `mhb_${randomBytes(16).toString('hex')}_b1`

        await knex.raw(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`)

        await knex.schema.withSchema(schemaName).createTable('_mhb_entity_type_definitions', (table) => {
            table.text('kind_key').primary()
            table.jsonb('capabilities').notNullable().defaultTo('{}')
            table.boolean('_upl_deleted').notNullable().defaultTo(false)
            table.boolean('_mhb_deleted').notNullable().defaultTo(false)
        })
        await knex.schema.withSchema(schemaName).createTable('_mhb_objects', (table) => {
            table.uuid('id').primary()
            table.text('kind').notNullable()
            table.jsonb('codename').notNullable()
            table.jsonb('presentation').notNullable().defaultTo('{}')
            table.jsonb('config').notNullable().defaultTo('{}')
            table.boolean('_upl_deleted').notNullable().defaultTo(false)
            table.boolean('_mhb_deleted').notNullable().defaultTo(false)
        })
        await knex.schema.withSchema(schemaName).createTable('_mhb_layouts', (table) => {
            table.uuid('id').primary()
            table.text('template_key').notNullable()
            table.uuid('scope_entity_id').nullable()
            table.uuid('base_layout_id').nullable()
            table.boolean('_upl_deleted').notNullable().defaultTo(false)
            table.boolean('_mhb_deleted').notNullable().defaultTo(false)
        })
        await knex.schema.withSchema(schemaName).createTable('_mhb_widgets', (table) => {
            table.uuid('id').primary()
            table.uuid('layout_id').notNullable()
            table.text('widget_key').notNullable()
            table.text('zone').notNullable()
            table.jsonb('config').notNullable().defaultTo('{}')
            table.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
            table.uuid('_upl_updated_by').nullable()
            table.integer('_upl_version').notNullable().defaultTo(1)
            table.boolean('_upl_deleted').notNullable().defaultTo(false)
            table.boolean('_mhb_deleted').notNullable().defaultTo(false)
        })
        await knex.schema.withSchema(schemaName).createTable('_mhb_components', (table) => {
            table.uuid('id').primary()
            table.uuid('object_id').notNullable()
            table.jsonb('codename').notNullable()
            table.text('data_type').notNullable()
            table.boolean('is_required').notNullable().defaultTo(false)
            table.jsonb('validation_rules').notNullable().defaultTo('{}')
            table.uuid('target_object_id').nullable()
            table.text('target_object_kind').nullable()
            table.uuid('parent_component_id').nullable()
            table.boolean('_upl_deleted').notNullable().defaultTo(false)
            table.boolean('_mhb_deleted').notNullable().defaultTo(false)
        })
        await knex.schema.withSchema(schemaName).createTable('_mhb_elements', (table) => {
            table.uuid('id').primary()
            table.uuid('object_id').notNullable()
            table.jsonb('data').notNullable().defaultTo('{}')
            table.integer('sort_order').notNullable()
            table.integer('_upl_version').notNullable().defaultTo(1)
            table.boolean('_upl_deleted').notNullable().defaultTo(false)
            table.boolean('_mhb_deleted').notNullable().defaultTo(false)
        })
    })

    afterAll(async () => {
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
            `TRUNCATE ${['_mhb_widgets', '_mhb_layouts', '_mhb_elements', '_mhb_components', '_mhb_objects', '_mhb_entity_type_definitions']
                .map((name) => qSchemaTable(schemaName, name))
                .join(', ')}`
        )
        await knex
            .withSchema(schemaName)
            .table('_mhb_entity_type_definitions')
            .insert({
                kind_key: 'object',
                capabilities: { dataSchema: true, records: true }
            })
        await knex
            .withSchema(schemaName)
            .table('_mhb_layouts')
            .insert({
                id: uuid(30),
                template_key: 'marketing-page',
                scope_entity_id: null,
                base_layout_id: null
            })
        await knex
            .withSchema(schemaName)
            .table('_mhb_widgets')
            .insert({
                id: uuid(31),
                layout_id: uuid(30),
                widget_key: 'marketing.hero',
                zone: 'marketing-main',
                config: { presentation: { tone: 'light' } }
            })
    })

    it('discovers only active Object candidates and treats search metacharacters literally', async () => {
        const matchingObjectId = uuid(1)
        const wildcardLookalikeId = uuid(2)
        const deletedObjectId = uuid(3)
        await insertObject(matchingObjectId, 'MarketingPageLogo_%')
        await insertObject(wildcardLookalikeId, 'MarketingPageLogoXvalue')
        await insertObject(deletedObjectId, 'MarketingPageLogo_%')
        await knex.withSchema(schemaName).table('_mhb_objects').where({ id: deletedObjectId }).update({ _upl_deleted: true })

        const candidates = await listWidgetBindingObjectCandidates(
            executor,
            schemaName,
            { entityKinds: ['object'], entityCapabilities: [], components: [] },
            0,
            'Logo_%'
        )

        expect(candidates.map(({ id }) => id)).toEqual([matchingObjectId])
        expect(candidates[0]).toMatchObject({ kind: 'object', codename: 'MarketingPageLogo_%' })
    })

    it('loads bounded active semantic records and finds one selected row through PostgreSQL', async () => {
        const heroObjectId = uuid(1)
        const alphaRecordId = uuid(11)
        const betaRecordId = uuid(12)
        await insertObject(heroObjectId, 'MarketingPageHero')
        await insertRecord(alphaRecordId, heroObjectId, { HeroKey: 'alpha', Title: 'Alpha Campaign' }, { sortOrder: 1 })
        await insertRecord(betaRecordId, heroObjectId, { HeroKey: 'beta', Title: 'Beta Campaign' }, { sortOrder: 2 })
        await insertRecord(uuid(13), heroObjectId, { HeroKey: '', Title: 'Missing selector' }, { sortOrder: 3 })
        await insertRecord(uuid(14), heroObjectId, { HeroKey: 'deleted', Title: 'Deleted campaign' }, { sortOrder: 4, deleted: true })

        const firstPage = await listWidgetBindingSemanticRecords(executor, schemaName, heroObjectId, 'HeroKey', 1, 0)
        const secondPage = await listWidgetBindingSemanticRecords(executor, schemaName, heroObjectId, 'HeroKey', 1, 1)
        const searched = await listWidgetBindingSemanticRecords(executor, schemaName, heroObjectId, 'HeroKey', 10, 0, 'Beta', ['Title'])
        const selected = await findWidgetBindingRecordBySemanticKey(executor, schemaName, heroObjectId, 'HeroKey', 'alpha')
        const recordCounts = await countWidgetBindingObjectRecords(executor, schemaName, [heroObjectId])

        expect(firstPage.map(({ id }) => id)).toEqual([alphaRecordId])
        expect(secondPage.map(({ id }) => id)).toEqual([betaRecordId])
        expect(searched.map(({ id }) => id)).toEqual([betaRecordId])
        expect(selected).toHaveLength(1)
        expect(selected[0]).toMatchObject({ id: alphaRecordId, data: { HeroKey: 'alpha' }, version: 1 })
        expect(recordCounts).toEqual([{ object_id: heroObjectId, records_count: 3 }])
    })

    it('reads declared relation metadata and rejects records pointing outside the selected parent Object', async () => {
        const pricingObjectId = uuid(1)
        const benefitObjectId = uuid(2)
        const parentRecordId = uuid(11)
        const validChildRecordId = uuid(12)
        await insertObject(pricingObjectId, 'MarketingPagePricing')
        await insertObject(benefitObjectId, 'MarketingPagePricingBenefit')
        await knex
            .withSchema(schemaName)
            .table('_mhb_components')
            .insert({
                id: uuid(20),
                object_id: benefitObjectId,
                codename: localizedCodename('TierRef'),
                data_type: 'REF',
                is_required: true,
                validation_rules: {},
                target_object_id: pricingObjectId,
                target_object_kind: 'object',
                parent_component_id: null
            })
        await insertRecord(parentRecordId, pricingObjectId, { TierKey: 'standard' })
        await insertRecord(validChildRecordId, benefitObjectId, { BenefitKey: 'support', TierRef: parentRecordId })
        await insertRecord(uuid(13), benefitObjectId, { BenefitKey: 'orphan', TierRef: uuid(99) }, { sortOrder: 2 })

        const components = await listWidgetBindingComponents(executor, schemaName, [benefitObjectId])
        const compatibleIds = await listWidgetBindingRelationCompatibleObjectIds(
            executor,
            schemaName,
            [benefitObjectId],
            pricingObjectId,
            'TierRef',
            true
        )

        expect(components).toMatchObject([
            {
                object_id: benefitObjectId,
                codename: 'TierRef',
                data_type: 'REF',
                is_required: true,
                target_object_id: pricingObjectId,
                target_object_kind: 'object',
                target_object_codename: 'MarketingPagePricing'
            }
        ])
        expect(compatibleIds).toEqual([])
        await knex
            .withSchema(schemaName)
            .table('_mhb_elements')
            .where({ id: uuid(13) })
            .update({ _upl_deleted: true })
        await expect(
            listWidgetBindingRelationCompatibleObjectIds(executor, schemaName, [benefitObjectId], pricingObjectId, 'TierRef', true)
        ).resolves.toEqual([benefitObjectId])
    })

    it('updates binding config atomically with a real optimistic-version check', async () => {
        const userId = uuid(40)
        const config = {
            bindings: [{ slot: 'content', sourceKey: 'MarketingPageHero', selector: { kind: 'semantic-key', value: 'alpha' } }]
        }

        await expect(
            updateWidgetBindingConfig(executor, schemaName, {
                widgetId: uuid(31),
                layoutId: uuid(30),
                expectedVersion: 1,
                config,
                userId
            })
        ).resolves.toBe(2)
        await expect(loadWidgetBindingWidget(executor, schemaName, uuid(31))).resolves.toMatchObject({
            widget_version: 2,
            config
        })
        await expect(
            updateWidgetBindingConfig(executor, schemaName, {
                widgetId: uuid(31),
                layoutId: uuid(30),
                expectedVersion: 1,
                config: {},
                userId
            })
        ).rejects.toBeInstanceOf(MetahubConflictError)
        await expect(loadWidgetBindingWidget(executor, schemaName, uuid(31))).resolves.toMatchObject({
            widget_version: 2,
            config
        })
    })

    it('rejects direct binding writes to scoped overlay widgets at the store boundary', async () => {
        const overlayLayoutId = uuid(32)
        const overlayWidgetId = uuid(33)
        const overlayEntityId = uuid(34)
        const originalConfig = { presentation: { tone: 'overlay' } }
        await knex
            .withSchema(schemaName)
            .table('_mhb_layouts')
            .insert({
                id: overlayLayoutId,
                template_key: 'marketing-page',
                scope_entity_id: overlayEntityId,
                base_layout_id: uuid(30)
            })
        await knex.withSchema(schemaName).table('_mhb_widgets').insert({
            id: overlayWidgetId,
            layout_id: overlayLayoutId,
            widget_key: 'marketing.hero',
            zone: 'marketing-main',
            config: originalConfig
        })

        await expect(
            updateWidgetBindingConfig(executor, schemaName, {
                widgetId: overlayWidgetId,
                layoutId: overlayLayoutId,
                expectedVersion: 1,
                config: { ...originalConfig, bindings: [{ slot: 'content' }] },
                userId: uuid(40)
            })
        ).rejects.toBeInstanceOf(MetahubConflictError)

        const persistedWidget = await knex.withSchema(schemaName).table('_mhb_widgets').where({ id: overlayWidgetId }).first()
        expect(persistedWidget).toMatchObject({ config: originalConfig, _upl_version: 1 })
    })
})
