import { randomBytes } from 'node:crypto'
import type { Knex } from 'knex'
import { createKnexExecutor, qSchemaTable } from '@universo-react/database'
import { buildSingleTargetWidgetBinding, encodeWidgetConfigEnvelope, getLayoutWidgetDefinition } from '@universo-react/types'
import { isEntityBoundByCodename, isEntityRecordBoundBySemanticKey } from '../../domains/layouts/widgetBindingPolicyStore'
import { listPersistedWidgetBindingReferences } from '../../persistence/widgetBindingReferencesStore'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`

describeIntegration('persisted widget binding reference store (requires PostgreSQL)', () => {
    let knex: Knex
    let schemaName: string

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({
            client: 'pg',
            connection: DATABASE_TEST_URL,
            pool: { min: 1, max: 4 }
        })
        schemaName = `mhb_${randomBytes(16).toString('hex')}_b1`

        await knex.raw(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, '_mhb_layouts')} (
                id uuid PRIMARY KEY,
                scope_entity_id uuid NULL,
                base_layout_id uuid NULL,
                template_key text NOT NULL,
                name jsonb NOT NULL DEFAULT '{}',
                description jsonb NULL,
                config jsonb NOT NULL DEFAULT '{}',
                is_active boolean NOT NULL DEFAULT true,
                is_default boolean NOT NULL DEFAULT false,
                sort_order integer NOT NULL DEFAULT 0,
                _upl_deleted boolean NOT NULL DEFAULT false,
                _mhb_deleted boolean NOT NULL DEFAULT false,
                _upl_created_at timestamptz NOT NULL DEFAULT now()
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, '_mhb_widgets')} (
                id uuid PRIMARY KEY,
                layout_id uuid NOT NULL,
                zone text NOT NULL,
                widget_key text NOT NULL,
                sort_order integer NOT NULL DEFAULT 0,
                config jsonb NOT NULL DEFAULT '{}',
                is_active boolean NOT NULL DEFAULT true,
                _upl_deleted boolean NOT NULL DEFAULT false,
                _mhb_deleted boolean NOT NULL DEFAULT false,
                _upl_created_at timestamptz NOT NULL DEFAULT now()
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, '_mhb_layout_widget_overrides')} (
                id uuid PRIMARY KEY,
                layout_id uuid NOT NULL,
                base_widget_id uuid NOT NULL,
                zone text NULL,
                sort_order integer NULL,
                config jsonb NULL,
                is_active boolean NULL,
                is_deleted_override boolean NOT NULL DEFAULT false,
                _upl_deleted boolean NOT NULL DEFAULT false,
                _mhb_deleted boolean NOT NULL DEFAULT false,
                _upl_created_at timestamptz NOT NULL DEFAULT now()
            )
        `)
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

    it('counts inherited base bindings, includes direct overlay rows for delete protection, and ignores forged override bindings', async () => {
        const ids = {
            baseLayout: '019e8afa-0000-7000-8000-000000000101',
            overlayLayout: '019e8afa-0000-7000-8000-000000000102',
            deletedOverlayLayout: '019e8afa-0000-7000-8000-000000000103',
            baseWidget: '019e8afa-0000-7000-8000-000000000104',
            directOverlayWidget: '019e8afa-0000-7000-8000-000000000109',
            liveOverride: '019e8afa-0000-7000-8000-000000000105',
            deletedOverride: '019e8afa-0000-7000-8000-000000000106',
            overlayEntity: '019e8afa-0000-7000-8000-000000000107',
            deletedOverlayEntity: '019e8afa-0000-7000-8000-000000000108'
        }
        const widgetDefinition = getLayoutWidgetDefinition('marketing.hero')
        if (!widgetDefinition) throw new Error('Marketing Hero widget definition is missing')

        const baseBinding = buildSingleTargetWidgetBinding(widgetDefinition, 'content', {
            entityKind: 'object',
            entityCodename: 'MarketingPageHero',
            semanticKey: 'hero-default'
        })
        const baseConfig = encodeWidgetConfigEnvelope(
            { rendererConfig: {}, neutral: { bindings: baseBinding } },
            { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
        )
        const forgedOverrideBinding = buildSingleTargetWidgetBinding(widgetDefinition, 'content', {
            entityKind: 'object',
            entityCodename: 'MarketingPageSiteSettings',
            semanticKey: 'site-settings'
        })
        const forgedOverrideConfig = encodeWidgetConfigEnvelope(
            { rendererConfig: {}, neutral: { bindings: forgedOverrideBinding } },
            { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
        )
        const directOverlayConfig = encodeWidgetConfigEnvelope(
            { rendererConfig: {}, neutral: { bindings: forgedOverrideBinding } },
            { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
        )

        await knex
            .withSchema(schemaName)
            .table('_mhb_layouts')
            .insert([
                {
                    id: ids.baseLayout,
                    template_key: 'marketing-page',
                    scope_entity_id: null,
                    base_layout_id: null,
                    is_default: true
                },
                {
                    id: ids.overlayLayout,
                    template_key: 'marketing-page',
                    scope_entity_id: ids.overlayEntity,
                    base_layout_id: ids.baseLayout
                },
                {
                    id: ids.deletedOverlayLayout,
                    template_key: 'marketing-page',
                    scope_entity_id: ids.deletedOverlayEntity,
                    base_layout_id: ids.baseLayout
                }
            ])
        await knex
            .withSchema(schemaName)
            .table('_mhb_widgets')
            .insert([
                {
                    id: ids.baseWidget,
                    layout_id: ids.baseLayout,
                    zone: 'marketing-main',
                    widget_key: 'marketing.hero',
                    config: baseConfig
                },
                {
                    id: ids.directOverlayWidget,
                    layout_id: ids.overlayLayout,
                    zone: 'marketing-main',
                    widget_key: 'marketing.hero',
                    config: directOverlayConfig
                }
            ])
        await knex
            .withSchema(schemaName)
            .table('_mhb_layout_widget_overrides')
            .insert([
                {
                    id: ids.liveOverride,
                    layout_id: ids.overlayLayout,
                    base_widget_id: ids.baseWidget,
                    config: forgedOverrideConfig,
                    is_deleted_override: false
                },
                {
                    id: ids.deletedOverride,
                    layout_id: ids.deletedOverlayLayout,
                    base_widget_id: ids.baseWidget,
                    config: forgedOverrideConfig,
                    is_deleted_override: true
                }
            ])

        const executor = createKnexExecutor(knex)
        const references = await listPersistedWidgetBindingReferences(executor, schemaName, {
            entityKind: 'object',
            entityCodename: 'MarketingPageHero',
            semanticKey: 'hero-default',
            limit: 10
        })

        expect(references).toHaveLength(2)
        expect(references.map(({ widget_id }) => widget_id)).toEqual(expect.arrayContaining([ids.baseWidget, ids.liveOverride]))
        expect(references.map(({ entity_codename }) => entity_codename)).toEqual(['MarketingPageHero', 'MarketingPageHero'])
        expect(references.find(({ widget_id }) => widget_id === ids.liveOverride)?.config).toEqual(baseConfig)

        const directOverlayReferences = await listPersistedWidgetBindingReferences(executor, schemaName, {
            entityKind: 'object',
            entityCodename: 'MarketingPageSiteSettings',
            semanticKey: 'site-settings',
            limit: 10
        })
        expect(directOverlayReferences).toEqual([
            expect.objectContaining({ widget_id: ids.directOverlayWidget, config: directOverlayConfig })
        ])
        await expect(isEntityBoundByCodename(executor, schemaName, 'object', 'MarketingPageSiteSettings')).resolves.toBe(true)
        await expect(isEntityRecordBoundBySemanticKey(executor, schemaName, 'MarketingPageSiteSettings', 'site-settings')).resolves.toBe(
            true
        )

        const referencesExcludingBaseWidget = await listPersistedWidgetBindingReferences(executor, schemaName, {
            entityKind: 'object',
            entityCodename: 'MarketingPageHero',
            semanticKey: 'hero-default',
            excludeWidgetId: ids.baseWidget,
            limit: 10
        })
        expect(referencesExcludingBaseWidget).toHaveLength(1)
        expect(referencesExcludingBaseWidget[0]?.widget_id).toBe(ids.liveOverride)

        await expect(
            listPersistedWidgetBindingReferences(executor, schemaName, {
                entityKind: 'object',
                entityCodename: 'MarketingPageHero',
                semanticKey: 'missing-key',
                limit: 10
            })
        ).resolves.toEqual([])
    })

    it('counts inherited Dashboard bindings for scoped overlays', async () => {
        const ids = {
            baseLayout: '019e8afa-0000-7000-8000-000000000201',
            overlayLayout: '019e8afa-0000-7000-8000-000000000202',
            baseWidget: '019e8afa-0000-7000-8000-000000000203',
            liveOverride: '019e8afa-0000-7000-8000-000000000204',
            overlayEntity: '019e8afa-0000-7000-8000-000000000205'
        }
        const widgetDefinition = getLayoutWidgetDefinition('infoCard')
        if (!widgetDefinition) throw new Error('Dashboard infoCard widget definition is missing')

        const baseBinding = buildSingleTargetWidgetBinding(widgetDefinition, 'content', {
            entityKind: 'object',
            entityCodename: 'DashboardInfoCard',
            semanticKey: 'notice'
        })
        const baseConfig = encodeWidgetConfigEnvelope(
            { rendererConfig: { severity: 'info' }, neutral: { bindings: baseBinding } },
            { templateKey: 'dashboard', widgetKey: 'infoCard', zone: 'left' }
        )

        await knex
            .withSchema(schemaName)
            .table('_mhb_layouts')
            .insert([
                {
                    id: ids.baseLayout,
                    template_key: 'dashboard',
                    scope_entity_id: null,
                    base_layout_id: null,
                    is_default: true
                },
                {
                    id: ids.overlayLayout,
                    template_key: 'dashboard',
                    scope_entity_id: ids.overlayEntity,
                    base_layout_id: ids.baseLayout
                }
            ])
        await knex.withSchema(schemaName).table('_mhb_widgets').insert({
            id: ids.baseWidget,
            layout_id: ids.baseLayout,
            zone: 'left',
            widget_key: 'infoCard',
            config: baseConfig
        })
        await knex.withSchema(schemaName).table('_mhb_layout_widget_overrides').insert({
            id: ids.liveOverride,
            layout_id: ids.overlayLayout,
            base_widget_id: ids.baseWidget,
            config: null,
            is_deleted_override: false
        })

        const references = await listPersistedWidgetBindingReferences(createKnexExecutor(knex), schemaName, {
            entityKind: 'object',
            entityCodename: 'DashboardInfoCard',
            semanticKey: 'notice',
            limit: 10
        })

        expect(references.map(({ widget_id }) => widget_id)).toEqual(expect.arrayContaining([ids.baseWidget, ids.liveOverride]))
        expect(references).toHaveLength(2)
        expect(references.find(({ widget_id }) => widget_id === ids.liveOverride)?.config).toEqual(baseConfig)
    })
})
