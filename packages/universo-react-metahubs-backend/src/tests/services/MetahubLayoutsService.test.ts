jest.mock('../../domains/layouts/widgetBindingSourceProvisioner', () => ({
    createWidgetBindingSourceProvisioner: jest.fn(() => jest.fn())
}))

import {
    MetahubLayoutsService,
    assignLayoutZoneWidgetSchema,
    createLayoutSchema,
    duplicateLayoutZoneWidgetSchema,
    moveLayoutZoneWidgetSchema,
    updateLayoutZoneWidgetConfigSchema
} from '../../domains/layouts/services/MetahubLayoutsService'
import { updateLayoutZoneWidgetBindingSchema } from '../../domains/layouts/widgetBindingSchemas'
import {
    buildSingleTargetWidgetBinding,
    encodeLayoutConfigEnvelope,
    encodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    validateWidgetBindings
} from '@universo-react/types'

const globalLayoutIdV7 = '0190a9b5-3cde-7abc-8def-0123456789a1'

describe('MetahubLayoutsService', () => {
    it('accepts only UUID v7 layout, scope, base, and widget identities at the layout ingress schemas', () => {
        const uuidV7 = '0190a9b5-3cde-7abc-8def-0123456789a1'
        const uuidV4 = '550e8400-e29b-41d4-a716-446655440000'
        const layoutInput = {
            scopeEntityId: uuidV7,
            baseLayoutId: uuidV7,
            name: { en: 'Scoped layout' }
        }

        expect(createLayoutSchema.safeParse(layoutInput).success).toBe(true)
        expect(createLayoutSchema.safeParse({ ...layoutInput, scopeEntityId: uuidV4 }).success).toBe(false)
        expect(createLayoutSchema.safeParse({ ...layoutInput, scopeEntityId: 'scope-1' }).success).toBe(false)
        expect(createLayoutSchema.safeParse({ ...layoutInput, baseLayoutId: uuidV4 }).success).toBe(false)
        expect(createLayoutSchema.safeParse({ ...layoutInput, baseLayoutId: 'base-layout-1' }).success).toBe(false)
        expect(moveLayoutZoneWidgetSchema.safeParse({ widgetId: uuidV7, expectedVersion: 1 }).success).toBe(true)
        expect(
            moveLayoutZoneWidgetSchema.safeParse({
                widgetId: uuidV7,
                targetParentInstanceKey: 'parent-instance',
                expectedVersion: 1
            }).success
        ).toBe(false)
        expect(
            moveLayoutZoneWidgetSchema.safeParse({
                widgetId: uuidV7,
                targetParentInstanceKey: 'parent-instance',
                targetSlotKey: 'content',
                expectedVersion: 1
            }).success
        ).toBe(true)
        expect(moveLayoutZoneWidgetSchema.safeParse({ widgetId: uuidV4, expectedVersion: 1 }).success).toBe(false)
        expect(moveLayoutZoneWidgetSchema.safeParse({ widgetId: 'widget-1', expectedVersion: 1 }).success).toBe(false)
        expect(duplicateLayoutZoneWidgetSchema.safeParse({ widgetId: uuidV7, expectedVersion: 1 }).success).toBe(false)
        expect(duplicateLayoutZoneWidgetSchema.safeParse({ widgetId: uuidV7, expectedVersion: 1, expectedLayoutVersion: 1 }).success).toBe(
            true
        )
        expect(duplicateLayoutZoneWidgetSchema.safeParse({ widgetId: uuidV4, expectedVersion: 1 }).success).toBe(false)
        expect(
            duplicateLayoutZoneWidgetSchema.safeParse({
                widgetId: uuidV7,
                expectedVersion: 1,
                templateKey: 'dashboard',
                widgetKey: 'infoCard',
                sourceRecordId: uuidV7
            }).success
        ).toBe(false)
        expect(
            assignLayoutZoneWidgetSchema.safeParse({
                zone: 'marketing-main',
                widgetKey: 'marketing.hero',
                expectedVersion: 1
            }).success
        ).toBe(false)
        const heroDefinition = getLayoutWidgetDefinition('marketing.hero')
        const heroContentSlot = heroDefinition?.bindingSlots?.find(({ key }) => key === 'content')
        if (!heroDefinition || !heroContentSlot) throw new Error('Hero binding contract is missing')
        const heroBindings = validateWidgetBindings(heroDefinition, {
            version: 1,
            slots: [
                {
                    slot: 'content',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'MarketingPageHero',
                            selector: { kind: 'semantic-key', field: 'key', value: 'hero-featured' },
                            projection: heroContentSlot.requirements.components.map(({ field, componentCodename }) => ({
                                field,
                                componentCodename
                            }))
                        }
                    ]
                }
            ]
        })
        const heroConfig = encodeWidgetConfigEnvelope(
            { rendererConfig: { showLeadForm: true }, neutral: { bindings: heroBindings } },
            { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
        )
        expect(
            assignLayoutZoneWidgetSchema.safeParse({
                zone: 'marketing-main',
                widgetKey: 'marketing.hero',
                config: heroConfig,
                expectedVersion: 1
            }).success
        ).toBe(true)
        expect(
            assignLayoutZoneWidgetSchema.safeParse({
                zone: 'marketing-main',
                widgetKey: 'marketing.hero',
                bindingRecordId: uuidV7,
                expectedVersion: 1
            }).success
        ).toBe(false)
        expect(
            assignLayoutZoneWidgetSchema.safeParse({
                zone: 'marketing-header',
                widgetKey: 'marketing.brand',
                heroContent: { mode: 'auto', sourceWidgetId: uuidV7 },
                expectedVersion: 1
            }).success
        ).toBe(false)
        const selection = { slot: 'content', sourceKey: 'MarketingPageHero', selector: { kind: 'semantic-key', value: 'hero-featured' } }
        expect(updateLayoutZoneWidgetBindingSchema.safeParse({ bindings: [selection], expectedVersion: 1 }).success).toBe(true)
        expect(updateLayoutZoneWidgetBindingSchema.safeParse({ bindings: [selection], expectedVersion: 0 }).success).toBe(false)
        expect(
            updateLayoutZoneWidgetBindingSchema.safeParse({ bindings: [{ ...selection, sourceKey: uuidV4 }], expectedVersion: 1 }).success
        ).toBe(false)
    })

    it('accepts shared languageSwitcher widgets on marketing layouts', async () => {
        const layoutId = 'marketing-layout-1'
        const layoutRow = {
            id: layoutId,
            scope_entity_id: null,
            base_layout_id: null,
            template_key: 'marketing-page',
            config: {}
        }
        const widgetRow = {
            id: 'language-switcher-1',
            layout_id: layoutId,
            zone: 'marketing-header',
            instance_key: '0190a9b5-3cde-7abc-8def-000000000001',
            parent_widget_id: null,
            slot_key: null,
            widget_key: 'languageSwitcher',
            sort_order: 1,
            config: {},
            is_active: true,
            _upl_version: 1,
            _upl_created_at: '2026-04-01T00:00:00.000Z',
            _upl_updated_at: '2026-04-01T00:00:00.000Z'
        }
        const query = jest.fn(async (sql: string) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) return []
            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts')) return [layoutRow]
            if (sql.includes('SELECT id, widget_key, zone, is_active') && sql.includes('_mhb_widgets')) return [widgetRow]
            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets')) return [widgetRow]
            throw new Error(`Unexpected SQL in shared marketing widget test: ${sql}`)
        })
        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }

        const service = new MetahubLayoutsService(exec as never, schemaService as never)
        const result = await service.listLayoutZoneWidgets('metahub-1', layoutId, 'user-1')

        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({
            widgetKey: 'languageSwitcher',
            zone: 'marketing-header',
            instanceKey: '0190a9b5-3cde-7abc-8def-000000000001',
            parentInstanceKey: null,
            slotKey: null,
            config: {}
        })
    })

    it('returns semantic parent identity and slot for nested Dashboard placements', async () => {
        const layoutId = '0190a9b5-3cde-7abc-8def-000000000031'
        const rootId = '0190a9b5-3cde-7abc-8def-000000000032'
        const childId = '0190a9b5-3cde-7abc-8def-000000000033'
        const root = {
            id: rootId,
            layout_id: layoutId,
            zone: 'center',
            instance_key: 'columns-root',
            parent_widget_id: null,
            slot_key: null,
            widget_key: 'columnsContainer',
            sort_order: 1,
            config: { columns: [{ slotKey: 'column:main', width: 12 }] },
            is_active: true,
            _upl_version: 1,
            _upl_created_at: '2026-04-01T00:00:00.000Z',
            _upl_updated_at: '2026-04-01T00:00:00.000Z'
        }
        const child = {
            id: childId,
            layout_id: layoutId,
            zone: 'center',
            instance_key: 'canvas-child',
            parent_widget_id: rootId,
            slot_key: 'column:main',
            widget_key: 'playcanvasCanvas',
            sort_order: 2,
            config: {},
            is_active: true,
            _upl_version: 1,
            _upl_created_at: '2026-04-01T00:00:01.000Z',
            _upl_updated_at: '2026-04-01T00:00:01.000Z'
        }
        const layoutRow = {
            id: layoutId,
            scope_entity_id: null,
            base_layout_id: null,
            template_key: 'dashboard',
            config: {}
        }
        const query = jest.fn(async (sql: string) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) return []
            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts')) return [layoutRow]
            if (sql.includes('SELECT id, widget_key, zone, is_active') && sql.includes('_mhb_widgets')) return [root, child]
            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets')) return [root, child]
            throw new Error(`Unexpected SQL in nested widget DTO test: ${sql}`)
        })
        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = { ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1') }
        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        const rows = await service.listLayoutZoneWidgets('metahub-1', layoutId, 'user-1')

        expect(rows).toEqual([
            expect.objectContaining({ instanceKey: 'columns-root', parentInstanceKey: null, slotKey: null }),
            expect.objectContaining({ instanceKey: 'canvas-child', parentInstanceKey: 'columns-root', slotKey: 'column:main' })
        ])
    })

    it.each([
        {
            name: 'Marketing',
            templateKey: 'marketing-page',
            widgetKey: 'marketing.image',
            zone: 'marketing-main',
            entityCodename: 'MarketingPageImage',
            semanticKey: 'hero-image',
            rendererConfig: {},
            overrideConfig: {}
        },
        {
            name: 'Dashboard',
            templateKey: 'dashboard',
            widgetKey: 'infoCard',
            zone: 'left',
            entityCodename: 'DashboardContent',
            semanticKey: 'overview',
            rendererConfig: {},
            overrideConfig: { severity: 'warning' }
        }
    ] as const)('keeps inherited Entity bindings out of the scoped $name override row', async (scenario) => {
        const layoutId = '0190a9b5-3cde-7abc-8def-0123456789a2'
        const baseLayoutId = '0190a9b5-3cde-7abc-8def-0123456789a3'
        const scopeEntityId = '0190a9b5-3cde-7abc-8def-0123456789a4'
        const widgetId = '0190a9b5-3cde-7abc-8def-0123456789a5'
        const placementInstanceKey = '0190a9b5-3cde-7abc-8def-0123456789a7'
        const definition = getLayoutWidgetDefinition(scenario.widgetKey)
        if (!definition) throw new Error(`Expected ${scenario.widgetKey} to be registered`)
        const bindings = buildSingleTargetWidgetBinding(definition, 'content', {
            entityKind: 'object',
            entityCodename: scenario.entityCodename,
            semanticKey: scenario.semanticKey
        })
        const widgetContext = { templateKey: scenario.templateKey, widgetKey: scenario.widgetKey, zone: scenario.zone }
        const baseConfig = encodeWidgetConfigEnvelope({ rendererConfig: scenario.rendererConfig, neutral: { bindings } }, widgetContext)
        expect(baseConfig).toMatchObject({ __layout: { bindings } })
        const baseWidget = {
            id: widgetId,
            instance_key: placementInstanceKey,
            layout_id: baseLayoutId,
            zone: scenario.zone,
            parent_widget_id: null,
            slot_key: null,
            widget_key: scenario.widgetKey,
            sort_order: 1,
            config: baseConfig,
            is_active: true,
            _upl_version: 1,
            _upl_created_at: '2026-04-01T00:00:00.000Z',
            _upl_updated_at: '2026-04-01T00:00:00.000Z'
        }
        let storedOverride: Record<string, unknown> | null = null
        let storedOverrideConfig: Record<string, unknown> | null = null
        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) return []
            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts')) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: scopeEntityId,
                        base_layout_id: baseLayoutId,
                        template_key: scenario.templateKey,
                        config: { variant: 'generated' }
                    }
                ]
            }
            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('layout_id = $1')) {
                return params?.[0] === baseLayoutId ? [baseWidget] : []
            }
            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('base_widget_id = $2')) {
                return storedOverride ? [storedOverride] : []
            }
            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('layout_id = $1')) {
                return storedOverride ? [storedOverride] : []
            }
            if (sql.includes('SELECT id, _upl_version') && sql.includes('_mhb_widgets')) {
                return [{ id: widgetId, _upl_version: 1 }]
            }
            if (sql.includes('INSERT INTO') && sql.includes('_mhb_layout_widget_overrides')) {
                storedOverrideConfig = JSON.parse(String(params?.[4] ?? 'null')) as Record<string, unknown>
                storedOverride = {
                    id: '0190a9b5-3cde-7abc-8def-0123456789a6',
                    layout_id: layoutId,
                    base_widget_id: widgetId,
                    zone: params?.[2] ?? null,
                    sort_order: params?.[3] ?? null,
                    config: storedOverrideConfig,
                    is_active: params?.[5] ?? null,
                    is_deleted_override: params?.[6] ?? false,
                    _upl_version: 1,
                    _upl_updated_at: '2026-04-01T00:00:01.000Z'
                }
                return [{ id: storedOverride.id }]
            }
            throw new Error(`Unexpected SQL in ${scenario.name} overlay binding test: ${sql}`)
        })
        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }
        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        expect(
            updateLayoutZoneWidgetConfigSchema.safeParse({
                config: { __layout: { bindings } },
                expectedVersion: 1
            }).success
        ).toBe(false)

        const result = await service.updateLayoutZoneWidgetConfig('metahub-1', layoutId, widgetId, scenario.overrideConfig, 'user-1', 1)

        expect(storedOverrideConfig).toBeTruthy()
        expect(storedOverrideConfig).not.toHaveProperty('__layout.bindings')
        const [resolvedPlacement] = await service.listLayoutZoneWidgets('metahub-1', layoutId, 'user-1')
        expect(resolvedPlacement).toMatchObject({ isInherited: true, widgetKey: scenario.widgetKey })
        if (scenario.widgetKey === 'infoCard') {
            expect(storedOverrideConfig).toHaveProperty('severity', 'warning')
            expect(resolvedPlacement?.config).toHaveProperty('severity', 'warning')
        }
        expect(storedOverrideConfig).not.toHaveProperty('instanceKey')
        expect(result.instanceKey).toBe(placementInstanceKey)
        expect(result.config).not.toHaveProperty('instanceKey')

        const insertCount = query.mock.calls.filter(
            ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_layout_widget_overrides')
        ).length
        await expect(
            service.updateLayoutZoneWidgetConfig('metahub-1', layoutId, widgetId, { __layout: { bindings } }, 'user-1', 1)
        ).rejects.toThrow()
        expect(
            query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_layout_widget_overrides'))
        ).toHaveLength(insertCount)
    })

    it('rejects assigning an Entity-backed Marketing widget directly into a scoped overlay', async () => {
        const layoutId = '0190a9b5-3cde-7abc-8def-0123456789a2'
        const baseLayoutId = '0190a9b5-3cde-7abc-8def-0123456789a3'
        const scopeEntityId = '0190a9b5-3cde-7abc-8def-0123456789a4'
        const definition = getLayoutWidgetDefinition('marketing.image')
        if (!definition) throw new Error('Expected marketing.image to be registered')
        const bindings = buildSingleTargetWidgetBinding(definition, 'content', {
            entityKind: 'object',
            entityCodename: 'MarketingPageImage',
            semanticKey: 'overlay-image'
        })
        const config = encodeWidgetConfigEnvelope(
            { rendererConfig: {}, neutral: { bindings } },
            { templateKey: 'marketing-page', widgetKey: 'marketing.image', zone: 'marketing-main' }
        )
        const query = jest.fn(async (sql: string) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) return []
            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts')) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: scopeEntityId,
                        base_layout_id: baseLayoutId,
                        template_key: 'marketing-page',
                        config: {},
                        version: 1
                    }
                ]
            }
            throw new Error(`Unexpected SQL in Marketing overlay assignment test: ${sql}`)
        })
        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }
        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        await expect(
            service.assignLayoutZoneWidget(
                'metahub-1',
                layoutId,
                {
                    zone: 'marketing-main',
                    widgetKey: 'marketing.image',
                    config,
                    expectedVersion: 1
                },
                'user-1'
            )
        ).rejects.toThrow('This layout inherits Entity bindings from its source placement')
        expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })

    it('fails closed when a stored metahub layout contains application-only source zone settings', async () => {
        const layoutId = '0190a9b5-3cde-7abc-8def-0123456789a2'
        const query = jest.fn(async (sql: string) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layouts')) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: null,
                        base_layout_id: null,
                        template_key: 'marketing-page',
                        name: { en: 'Marketing' },
                        description: null,
                        config: {
                            __layout: {
                                composition: { mode: 'independent', baseLayoutId: null },
                                sourceZoneSettings: { 'marketing-header': { position: 'flow' } }
                            }
                        },
                        is_active: true,
                        is_default: true,
                        sort_order: 0,
                        _upl_version: 1,
                        _upl_created_at: '2026-04-01T00:00:00.000Z',
                        _upl_updated_at: '2026-04-01T00:00:00.000Z'
                    }
                ]
            }
            throw new Error(`Unexpected SQL in source zone settings reader test: ${sql}`)
        })
        const exec = { query, transaction: jest.fn(), isReleased: () => false }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }
        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        await expect(service.getLayoutById('metahub-1', layoutId, 'user-1')).rejects.toThrow(/sourceZoneSettings/)
    })

    it.each(['appNavbar', 'header'])('rejects reactivating duplicate singleton %s widgets', async (widgetKey) => {
        const layoutId = 'dashboard-layout-1'
        const currentWidget = {
            id: 'inactive-widget',
            layout_id: layoutId,
            zone: 'top',
            instance_key: '0190a9b5-3cde-7abc-8def-000000000003',
            parent_widget_id: null,
            slot_key: null,
            widget_key: widgetKey,
            sort_order: 2,
            config: {},
            is_active: false,
            _upl_version: 1,
            _upl_created_at: '2026-04-01T00:00:00.000Z',
            _upl_updated_at: '2026-04-01T00:00:00.000Z'
        }
        const query = jest.fn(async (sql: string) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) return []
            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts')) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: null,
                        base_layout_id: null,
                        template_key: 'dashboard',
                        config: {}
                    }
                ]
            }
            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('WHERE id = $1')) {
                return [currentWidget]
            }
            if (sql.includes('SELECT id, widget_key, is_active') && sql.includes('_mhb_widgets')) {
                return [
                    { id: 'active-widget', widget_key: widgetKey, is_active: true },
                    { id: currentWidget.id, widget_key: widgetKey, is_active: false }
                ]
            }
            throw new Error(`Unexpected SQL in singleton reactivation test: ${sql}`)
        })
        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }
        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        await expect(
            service.toggleLayoutZoneWidgetActive('metahub-1', layoutId, currentWidget.id, true, 'user-1', 1)
        ).rejects.toMatchObject({
            statusCode: 409
        })
        expect(query.mock.calls.some(([sql]) => String(sql).trimStart().startsWith('UPDATE') && String(sql).includes('_mhb_widgets'))).toBe(
            false
        )
    })

    it('reuses the active transaction runner for optimistic-lock layout updates', async () => {
        const tx = {
            query: jest.fn(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) return []
                if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layouts') && sql.includes('FOR UPDATE')) {
                    return [
                        {
                            id: 'layout-1',
                            scope_entity_id: null,
                            template_key: 'dashboard',
                            name: { en: 'Current layout' },
                            description: null,
                            config: {},
                            sort_order: 1,
                            is_active: true,
                            is_default: false,
                            _upl_version: 3,
                            _upl_created_at: '2026-04-04T00:00:00.000Z',
                            _upl_updated_at: '2026-04-04T00:00:00.000Z'
                        }
                    ]
                }

                if (sql.includes('UPDATE') && sql.includes('_mhb_layouts') && sql.includes('RETURNING *')) {
                    return [
                        {
                            id: 'layout-1',
                            scope_entity_id: null,
                            template_key: 'dashboard',
                            name: { en: 'Updated layout' },
                            description: null,
                            config: {},
                            sort_order: 1,
                            is_active: true,
                            is_default: false,
                            _upl_version: 4,
                            _upl_created_at: '2026-04-04T00:00:00.000Z',
                            _upl_updated_at: '2026-04-04T01:00:00.000Z'
                        }
                    ]
                }

                throw new Error(`Unexpected SQL in updateLayout regression test: ${sql}`)
            }),
            transaction: jest.fn(async () => {
                throw new Error('Nested transactions should not be opened from updateLayout optimistic locking')
            }),
            isReleased: () => false
        }

        const exec = {
            query: jest.fn(),
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_1234567890abcdef1234567890abcdef_b1')
        } as unknown as ConstructorParameters<typeof MetahubLayoutsService>[1]
        const service = new MetahubLayoutsService(exec as any, schemaService)

        const result = await service.updateLayout(
            'metahub-1',
            'layout-1',
            {
                name: { en: 'Updated layout' },
                expectedVersion: 3
            },
            'user-1'
        )

        expect(result.id).toBe('layout-1')
        expect(tx.transaction).not.toHaveBeenCalled()
        expect(exec.transaction).toHaveBeenCalledTimes(1)
    })

    it('persists the requested marketing widget order instead of restoring a creation-time tie', async () => {
        const layoutId = '0190a9b5-3cde-7abc-8def-0123456789a8'
        const layoutRow = {
            id: layoutId,
            scope_entity_id: null,
            base_layout_id: null,
            template_key: 'marketing-page',
            config: {}
        }
        const makeConfig = (
            widgetKey: string,
            rendererConfig: Record<string, unknown>,
            sourceBySlot: Readonly<Record<string, string>>,
            semanticKeyBySlot: Readonly<Record<string, string>> = {}
        ) => {
            const definition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
            if (!definition) throw new Error(`Marketing widget definition is missing: ${widgetKey}`)
            const slots = (definition.bindingSlots ?? []).map((slot) => {
                const sourceKey = sourceBySlot[slot.key]
                if (!sourceKey) throw new Error(`Missing test source for ${widgetKey}/${slot.key}`)
                const semanticKey = semanticKeyBySlot[slot.key]
                const selector = slot.selectorKinds.includes('semantic-key')
                    ? {
                          kind: 'semantic-key' as const,
                          field: slot.requirements.components.find(({ semanticKey: isKey }) => isKey)?.field ?? 'key',
                          value: semanticKey ?? 'default'
                      }
                    : slot.selectorKinds.includes('relation-set')
                    ? { kind: 'relation-set' as const, parentSlot: slot.relation?.parentSlot ?? 'parent' }
                    : { kind: 'record-set' as const }
                return {
                    slot: slot.key,
                    targets: [
                        {
                            entityKind: 'object' as const,
                            entityCodename: sourceKey,
                            selector,
                            projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                        }
                    ]
                }
            })
            const bindings = validateWidgetBindings(definition, { version: 1, slots })
            const zone = definition.allowedZonesByTemplate['marketing-page']?.[0] ?? 'marketing-main'
            return encodeWidgetConfigEnvelope(
                { rendererConfig, neutral: { bindings } },
                { templateKey: 'marketing-page', widgetKey, zone, rendererConfig }
            )
        }
        const heroBindingConfig = makeConfig(
            'marketing.hero',
            { showLeadForm: true },
            { content: 'MarketingPageHero' },
            {
                content: 'default'
            }
        )
        const collectionConfig = (variant: string, entityCodename: string) => ({
            ...makeConfig(
                'marketing.collection',
                { variant, maxItems: 24, showTitle: true, showDescription: true },
                { section: 'MarketingPageSection', items: entityCodename },
                { section: variant }
            )
        })
        const initialRows = [
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789b1',
                layout_id: layoutId,
                zone: 'marketing-main',
                instance_key: '0190a9b5-3cde-7abc-8def-000000000006',
                parent_widget_id: null,
                slot_key: null,
                widget_key: 'marketing.hero',
                sort_order: 1,
                config: heroBindingConfig,
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-04-01T00:00:00.000Z',
                _upl_updated_at: '2026-04-01T00:00:00.000Z'
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789b2',
                layout_id: layoutId,
                zone: 'marketing-main',
                instance_key: '0190a9b5-3cde-7abc-8def-000000000007',
                parent_widget_id: null,
                slot_key: null,
                widget_key: 'marketing.collection',
                sort_order: 2,
                config: collectionConfig('logos', 'MarketingPageLogo'),
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-04-01T00:00:01.000Z',
                _upl_updated_at: '2026-04-01T00:00:01.000Z'
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789b3',
                layout_id: layoutId,
                zone: 'marketing-main',
                instance_key: '0190a9b5-3cde-7abc-8def-000000000008',
                parent_widget_id: null,
                slot_key: null,
                widget_key: 'marketing.collection',
                sort_order: 3,
                config: collectionConfig('features', 'MarketingPageFeature'),
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-04-01T00:00:02.000Z',
                _upl_updated_at: '2026-04-01T00:00:02.000Z'
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789b4',
                layout_id: layoutId,
                zone: 'marketing-main',
                instance_key: '0190a9b5-3cde-7abc-8def-000000000009',
                parent_widget_id: null,
                slot_key: null,
                widget_key: 'marketing.collection',
                sort_order: 4,
                config: collectionConfig('testimonials', 'MarketingPageTestimonial'),
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-04-01T00:00:03.000Z',
                _upl_updated_at: '2026-04-01T00:00:03.000Z'
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789b5',
                layout_id: layoutId,
                zone: 'marketing-main',
                instance_key: '0190a9b5-3cde-7abc-8def-00000000000a',
                parent_widget_id: null,
                slot_key: null,
                widget_key: 'marketing.collection',
                sort_order: 5,
                config: collectionConfig('highlights', 'MarketingPageHighlight'),
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-04-01T00:00:04.000Z',
                _upl_updated_at: '2026-04-01T00:00:04.000Z'
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789b6',
                layout_id: layoutId,
                zone: 'marketing-main',
                instance_key: '0190a9b5-3cde-7abc-8def-00000000000b',
                parent_widget_id: null,
                slot_key: null,
                widget_key: 'marketing.pricing',
                sort_order: 6,
                config: makeConfig(
                    'marketing.pricing',
                    { maxItems: 24, showBenefits: true },
                    {
                        section: 'MarketingPageSection',
                        tiers: 'MarketingPagePricing',
                        benefits: 'MarketingPagePricingBenefit'
                    },
                    { section: 'pricing' }
                ),
                is_active: true,
                _upl_version: 3,
                _upl_created_at: '2026-04-01T00:00:05.000Z',
                _upl_updated_at: '2026-04-01T00:00:05.000Z'
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789b7',
                layout_id: layoutId,
                zone: 'marketing-main',
                instance_key: '0190a9b5-3cde-7abc-8def-00000000000c',
                parent_widget_id: null,
                slot_key: null,
                widget_key: 'marketing.collection',
                sort_order: 7,
                config: collectionConfig('faq', 'MarketingPageFaq'),
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-04-01T00:00:06.000Z',
                _upl_updated_at: '2026-04-01T00:00:06.000Z'
            }
        ]
        let persistedRows = initialRows.map((row) => ({ ...row }))
        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (
                sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))') &&
                String(params?.[0] ?? '').startsWith('mhb-layout-graph:')
            )
                return []
            if (sql.includes('_mhb_layouts')) return [layoutRow]

            if (sql.includes('sort_order = sort_order +')) {
                const layoutParam = params?.[1]
                const zones = Array.isArray(params?.[2]) ? params?.[2] : []
                expect(layoutParam).toBe(layoutId)
                persistedRows = persistedRows.map((row) =>
                    row.layout_id === layoutId && zones.includes(row.zone)
                        ? { ...row, sort_order: row.sort_order + Number(params?.[0] ?? 0) }
                        : row
                )
                return []
            }

            if (sql.includes('WITH incoming') && sql.includes('RETURNING widget.id')) {
                const ids = Array.isArray(params?.[1]) ? params?.[1].map(String) : []
                const zones = Array.isArray(params?.[2]) ? params?.[2].map(String) : []
                const sortOrders = Array.isArray(params?.[3]) ? params?.[3].map(Number) : []
                persistedRows = persistedRows.map((row) => {
                    const index = ids.indexOf(row.id)
                    return index >= 0
                        ? { ...row, zone: zones[index], sort_order: sortOrders[index], _upl_version: (row._upl_version ?? 1) + 1 }
                        : row
                })
                return ids.map((id) => ({ id }))
            }

            if (sql.includes('SET parent_widget_id = $1') && sql.includes('RETURNING id'))
                return [{ id: '0190a9b5-3cde-7abc-8def-0123456789b6' }]

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('ORDER BY zone ASC')) {
                return persistedRows.map((row) => ({ ...row }))
            }

            throw new Error(`Unexpected SQL in marketing reorder test: ${sql}`)
        })
        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }

        const service = new MetahubLayoutsService(exec as never, schemaService as never)
        const result = await service.moveLayoutZoneWidget(
            'metahub-1',
            layoutId,
            { widgetId: '0190a9b5-3cde-7abc-8def-0123456789b6', targetZone: 'marketing-main', targetIndex: 4, expectedVersion: 3 },
            'user-1'
        )

        expect(
            result
                .filter((widget) => widget.zone === 'marketing-main')
                .sort((left, right) => left.sortOrder - right.sortOrder)
                .map((widget) => widget.instanceKey)
        ).toEqual([
            '0190a9b5-3cde-7abc-8def-000000000006',
            '0190a9b5-3cde-7abc-8def-000000000007',
            '0190a9b5-3cde-7abc-8def-000000000008',
            '0190a9b5-3cde-7abc-8def-000000000009',
            '0190a9b5-3cde-7abc-8def-00000000000b',
            '0190a9b5-3cde-7abc-8def-00000000000a',
            '0190a9b5-3cde-7abc-8def-00000000000c'
        ])
        const finalUpdate = query.mock.calls.find(([sql]) => String(sql).includes('WITH incoming'))
        expect(finalUpdate?.[1]?.[3]).toEqual([1, 2, 3, 4, 5, 6, 7])
    })

    it('does not reintroduce Dashboard visibility flags when syncing placement data', async () => {
        const layoutId = 'layout-1'
        const widgetId = 'widget-1'
        let persistedLayoutConfig: Record<string, unknown> | null = null

        const baseLayoutScopeRow = {
            id: layoutId,
            scope_entity_id: null,
            base_layout_id: null,
            template_key: 'dashboard',
            config: { __layout: { skipDefaultZoneWidgetSeed: true } }
        }

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (
                sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))') &&
                String(params?.[0] ?? '').startsWith('mhb-layout-graph:')
            )
                return []
            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts')) {
                return [baseLayoutScopeRow]
            }

            if (sql.includes('SELECT COUNT(*)::int AS count FROM') && sql.includes('_mhb_widgets')) {
                return [{ count: 1 }]
            }

            if (sql.includes('SELECT id FROM') && sql.includes('_mhb_widgets') && sql.includes('zone = $2')) {
                return []
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('widget_key = $2')) {
                return [
                    {
                        id: widgetId,
                        layout_id: layoutId,
                        zone: 'left',
                        instance_key: '0190a9b5-3cde-7abc-8def-00000000000d',
                        parent_widget_id: null,
                        slot_key: null,
                        widget_key: 'menuWidget',
                        sort_order: 1,
                        config: {},
                        is_active: true,
                        _upl_created_at: '2026-04-04T00:00:00.000Z',
                        _upl_updated_at: '2026-04-04T00:00:00.000Z'
                    }
                ]
            }

            if (sql.includes('SELECT id, sort_order FROM') && sql.includes('_mhb_widgets')) {
                return [{ id: widgetId, sort_order: 1 }]
            }

            if (sql.includes('SELECT widget_key, zone, is_active FROM') && sql.includes('_mhb_widgets')) {
                return [
                    { widget_key: 'menuWidget', zone: 'left', is_active: true },
                    { widget_key: 'header', zone: 'top', is_active: true },
                    { widget_key: 'detailsTitle', zone: 'center', is_active: true },
                    { widget_key: 'detailsTable', zone: 'center', is_active: true }
                ]
            }

            if (sql.includes('UPDATE') && sql.includes('_mhb_widgets')) {
                return []
            }

            if (sql.includes('INSERT INTO') && sql.includes('_mhb_widgets') && sql.includes('RETURNING id')) {
                return [{ id: params?.[0], instance_key: params?.[2] }]
            }

            if (sql.includes('INSERT INTO') && sql.includes('_mhb_widgets') && sql.includes('RETURNING *')) {
                return [
                    {
                        id: widgetId,
                        layout_id: layoutId,
                        zone: 'left',
                        instance_key: '0190a9b5-3cde-7abc-8def-000000000012',
                        parent_widget_id: null,
                        slot_key: null,
                        widget_key: 'menuWidget',
                        sort_order: 1,
                        config: { variant: 'generated' },
                        is_active: true,
                        _upl_created_at: '2026-04-04T00:00:00.000Z',
                        _upl_updated_at: '2026-04-04T00:00:00.000Z'
                    }
                ]
            }

            if (sql.includes('UPDATE') && sql.includes('_mhb_layouts') && sql.includes('config = $1')) {
                persistedLayoutConfig = JSON.parse(String(params?.[0] ?? '{}'))
                return [{ id: layoutId }]
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('WHERE id = $1')) {
                return [
                    {
                        id: widgetId,
                        layout_id: layoutId,
                        zone: 'left',
                        instance_key: '0190a9b5-3cde-7abc-8def-000000000013',
                        parent_widget_id: null,
                        slot_key: null,
                        widget_key: 'menuWidget',
                        sort_order: 1,
                        config: { variant: 'generated' },
                        is_active: true,
                        _upl_created_at: '2026-04-04T00:00:00.000Z',
                        _upl_updated_at: '2026-04-04T00:00:00.000Z'
                    }
                ]
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('ORDER BY zone ASC')) return []

            throw new Error(`Unexpected SQL in MetahubLayoutsService test: ${sql}`)
        })

        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }

        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        await service.assignLayoutZoneWidget(
            'metahub-1',
            layoutId,
            {
                zone: 'left',
                widgetKey: 'menuWidget',
                sortOrder: 1,
                config: { variant: 'generated' },
                expectedVersion: 1
            },
            'user-1'
        )

        expect(persistedLayoutConfig).toEqual({ __layout: { skipDefaultZoneWidgetSeed: true } })
    })

    it('creates entity-scoped layouts against the active global base layout without seeding default widgets', async () => {
        const layoutId = 'object-layout-1'
        const scopeEntityId = 'object-1'
        const baseLayoutConfig = {
            sideMenu: { availableModes: ['wide', 'compact', 'overlay'], primaryMode: 'wide', rememberUserChoice: true },
            objectBehavior: {
                showCreateButton: false
            }
        }
        const createdRow = {
            id: layoutId,
            scope_entity_id: scopeEntityId,
            base_layout_id: globalLayoutIdV7,
            template_key: 'dashboard',
            name: {
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: { content: 'Object layout', version: 1, isActive: true }
                }
            },
            description: null,
            config: {
                __layout: {
                    composition: {
                        mode: 'overlay',
                        baseLayoutId: globalLayoutIdV7
                    }
                },
                sideMenu: baseLayoutConfig.sideMenu,
                objectBehavior: {
                    showCreateButton: true,
                    createSurface: 'page'
                }
            },
            is_active: true,
            is_default: false,
            sort_order: 0,
            _upl_version: 1,
            _upl_created_at: '2026-04-06T00:00:00.000Z',
            _upl_updated_at: '2026-04-06T00:00:00.000Z'
        }

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) return []
            if (sql.includes('_mhb_objects') && sql.includes('_mhb_entity_type_definitions')) {
                expect(params).toEqual([scopeEntityId])
                expect(sql).not.toContain('t.is_active')
                return [{ id: scopeEntityId, kind: 'object', capabilities: { layoutConfig: { enabled: true } } }]
            }

            if (sql.includes('scope_entity_id IS NULL') && sql.includes('is_active = true') && sql.includes('_mhb_layouts')) {
                return [
                    {
                        id: globalLayoutIdV7,
                        scope_entity_id: null,
                        base_layout_id: null,
                        template_key: 'dashboard',
                        config: baseLayoutConfig
                    }
                ]
            }

            if (sql.includes('INSERT INTO') && sql.includes('_mhb_layouts') && sql.includes('RETURNING *')) {
                expect(params?.[0]).toBe(scopeEntityId)
                expect(params?.[1]).toBe(globalLayoutIdV7)
                expect(JSON.parse(String(params?.[5] ?? '{}'))).toEqual({
                    __layout: {
                        composition: {
                            mode: 'overlay',
                            baseLayoutId: globalLayoutIdV7
                        }
                    },
                    sideMenu: baseLayoutConfig.sideMenu,
                    objectBehavior: {
                        showCreateButton: true,
                        createSurface: 'page'
                    }
                })
                return [createdRow]
            }

            if (sql.includes('UPDATE') && sql.includes('_mhb_layouts') && sql.includes('is_default = false')) {
                return []
            }

            throw new Error(`Unexpected SQL in create scoped layout test: ${sql}`)
        })

        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }

        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        const created = await service.createLayout(
            'metahub-1',
            {
                scopeEntityId,
                templateKey: 'dashboard',
                name: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Object layout', version: 1, isActive: true }
                    }
                },
                description: null,
                config: { objectBehavior: { showCreateButton: true, createSurface: 'page' } },
                isActive: true,
                isDefault: false,
                sortOrder: 0
            },
            'user-1'
        )

        expect(created.scopeEntityId).toBe(scopeEntityId)
        expect(created.baseLayoutId).toBe(globalLayoutIdV7)
        expect(created.config).toEqual({
            sideMenu: baseLayoutConfig.sideMenu,
            objectBehavior: {
                showCreateButton: true,
                createSurface: 'page'
            }
        })
        expect(created.neutral).toEqual({
            composition: {
                mode: 'overlay',
                baseLayoutId: globalLayoutIdV7
            }
        })
        expect(query).toHaveBeenCalledTimes(4)
        expect(query.mock.calls.some(([sql]) => String(sql).includes('_mhb_widgets'))).toBe(false)
    })

    it('creates an independent Dashboard scope without decoding a different-template global base', async () => {
        const layoutId = '0190a9b5-3cde-7abc-8def-0123456789a4'
        const scopeEntityId = '0190a9b5-3cde-7abc-8def-0123456789a5'
        const marketingBaseId = '0190a9b5-3cde-7abc-8def-0123456789a6'
        const marketingBaseConfig = encodeLayoutConfigEnvelope(
            { rendererConfig: {}, neutral: { zoneSettings: { 'marketing-header': { position: 'fixed' } } } },
            { templateKey: 'marketing-page' }
        )
        const createdRow = {
            id: layoutId,
            scope_entity_id: scopeEntityId,
            base_layout_id: null,
            template_key: 'dashboard',
            name: {
                _schema: '1',
                _primary: 'en',
                locales: { en: { content: 'Independent Dashboard', version: 1, isActive: true } }
            },
            description: null,
            config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } },
            is_active: true,
            is_default: false,
            sort_order: 0,
            _upl_version: 1,
            _upl_created_at: '2026-04-06T00:00:00.000Z',
            _upl_updated_at: '2026-04-06T00:00:00.000Z'
        }

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) return []
            if (sql.includes('_mhb_objects') && sql.includes('_mhb_entity_type_definitions')) {
                expect(params).toEqual([scopeEntityId])
                return [{ id: scopeEntityId, kind: 'object', capabilities: { layoutConfig: { enabled: true } } }]
            }
            if (sql.includes('scope_entity_id IS NULL') && sql.includes('is_active = true') && sql.includes('_mhb_layouts')) {
                return [
                    {
                        id: marketingBaseId,
                        scope_entity_id: null,
                        base_layout_id: null,
                        template_key: 'marketing-page',
                        config: marketingBaseConfig
                    }
                ]
            }
            if (sql.includes('INSERT INTO') && sql.includes('_mhb_layouts') && sql.includes('RETURNING *')) {
                expect(params?.[0]).toBe(scopeEntityId)
                expect(params?.[1]).toBeNull()
                expect(JSON.parse(String(params?.[5] ?? '{}'))).toEqual(createdRow.config)
                return [createdRow]
            }
            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts')) return [createdRow]
            if (sql.includes('SELECT *') && sql.includes('_mhb_widgets')) return []

            throw new Error(`Unexpected SQL in independent cross-template layout test: ${sql}`)
        })

        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = { ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1') }
        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        const created = await service.createLayout(
            'metahub-1',
            {
                scopeEntityId,
                templateKey: 'dashboard',
                name: {
                    _schema: '1',
                    _primary: 'en',
                    locales: { en: { content: 'Independent Dashboard', version: 1, isActive: true } }
                },
                config: {},
                isActive: true,
                isDefault: false,
                sortOrder: 0
            },
            'user-1'
        )

        expect(created.templateKey).toBe('dashboard')
        expect(created.scopeEntityId).toBe(scopeEntityId)
        expect(created.baseLayoutId).toBeNull()
        expect(created.neutral).toEqual({ composition: { mode: 'independent', baseLayoutId: null } })
        expect(query).toHaveBeenCalledTimes(4)
        expect(query.mock.calls.some(([sql]) => String(sql).includes('_mhb_widgets'))).toBe(false)

        const placements = await service.listLayoutZoneWidgets('metahub-1', layoutId, 'user-1')

        expect(placements).toEqual([])
        expect(
            query.mock.calls.some(
                ([sql]) =>
                    (String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_widgets')) ||
                    (String(sql).includes('UPDATE') && String(sql).includes('_mhb_layouts') && String(sql).includes('SET config'))
            )
        ).toBe(false)
    })

    it('creates global layouts empty by default without seeding default widgets', async () => {
        const layoutId = globalLayoutIdV7
        const createdRow = {
            id: layoutId,
            scope_entity_id: null,
            base_layout_id: null,
            template_key: 'dashboard',
            name: {
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: { content: 'Blank layout', version: 1, isActive: true }
                }
            },
            description: null,
            config: {
                __layout: {
                    composition: { mode: 'independent', baseLayoutId: null },
                    skipDefaultZoneWidgetSeed: true
                }
            },
            is_active: true,
            is_default: false,
            sort_order: 0,
            _upl_version: 1,
            _upl_created_at: '2026-04-06T00:00:00.000Z',
            _upl_updated_at: '2026-04-06T00:00:00.000Z'
        }

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) return []
            if (sql.includes('INSERT INTO') && sql.includes('_mhb_layouts') && sql.includes('RETURNING *')) {
                const config = JSON.parse(String(params?.[5] ?? '{}'))
                expect(params?.[0]).toBeNull()
                expect(params?.[1]).toBeNull()
                expect(config).toEqual({
                    __layout: {
                        composition: { mode: 'independent', baseLayoutId: null },
                        skipDefaultZoneWidgetSeed: true
                    }
                })
                return [createdRow]
            }

            throw new Error(`Unexpected SQL in create global layout test: ${sql}`)
        })

        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }

        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        const created = await service.createLayout(
            'metahub-1',
            {
                templateKey: 'dashboard',
                name: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Blank layout', version: 1, isActive: true }
                    }
                },
                description: null,
                isActive: true,
                isDefault: false,
                sortOrder: 0
            },
            'user-1'
        )

        expect(created.scopeEntityId).toBeNull()
        expect(created.baseLayoutId).toBeNull()
        expect(created.config).toEqual({})
        expect(created.neutral).toEqual({
            composition: { mode: 'independent', baseLayoutId: null },
            skipDefaultZoneWidgetSeed: true
        })
        expect(query).toHaveBeenCalledTimes(2)
        expect(query.mock.calls.some(([sql]) => String(sql).includes('_mhb_widgets'))).toBe(false)
    })

    it('rejects scoped layout creation when scopeEntityId points to an entity without layoutConfig support', async () => {
        const query = jest.fn(async (sql: string) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) return []
            if (sql.includes('_mhb_objects') && sql.includes('_mhb_entity_type_definitions')) {
                return [{ id: 'object-1', kind: 'set', capabilities: { layoutConfig: false } }]
            }

            throw new Error(`Unexpected SQL in scoped layout validation test: ${sql}`)
        })

        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }

        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        await expect(
            service.createLayout(
                'metahub-1',
                {
                    scopeEntityId: 'object-1',
                    templateKey: 'dashboard',
                    name: {
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'Object layout', version: 1, isActive: true }
                        }
                    },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: false,
                    sortOrder: 0
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            message: 'Entity "set" does not support custom layouts',
            statusCode: 400
        })
    })

    it('applies inherited override policy from the widget registry', async () => {
        const layoutId = 'object-layout-1'
        const baseLayoutId = globalLayoutIdV7
        const baseWidgetId = 'base-widget-1'

        const baseWidgetRow = {
            id: baseWidgetId,
            layout_id: baseLayoutId,
            zone: 'left',
            instance_key: '0190a9b5-3cde-7abc-8def-000000000014',
            parent_widget_id: null,
            slot_key: null,
            widget_key: 'menuWidget',
            sort_order: 1,
            config: { variant: 'generated' },
            is_active: true,
            _upl_created_at: '2026-04-06T00:00:00.000Z',
            _upl_updated_at: '2026-04-06T00:00:00.000Z'
        }

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (
                sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))') &&
                String(params?.[0] ?? '').startsWith('mhb-layout-graph:')
            )
                return []
            if (
                sql.includes('_mhb_layouts') &&
                (sql.includes('SELECT id, scope_entity_id, base_layout_id') || sql.includes('SELECT * FROM'))
            ) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: 'object-1',
                        base_layout_id: baseLayoutId,
                        template_key: 'dashboard',
                        config: {}
                    }
                ]
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('layout_id = $1')) {
                if (params?.[0] === baseLayoutId) {
                    return [baseWidgetRow]
                }

                if (params?.[0] === layoutId) {
                    return []
                }
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('layout_id = $1')) {
                return [
                    {
                        id: 'override-1',
                        layout_id: layoutId,
                        base_widget_id: baseWidgetId,
                        zone: 'right',
                        sort_order: 9,
                        is_active: false,
                        is_deleted_override: false,
                        _upl_updated_at: '2026-04-06T01:00:00.000Z'
                    }
                ]
            }

            if (sql.includes('UPDATE') && sql.includes('_mhb_layouts') && sql.includes('config = $1')) {
                return [{ id: layoutId }]
            }

            throw new Error(`Unexpected SQL in inherited widget metadata test: ${sql}`)
        })

        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }

        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        const widgets = await service.listLayoutZoneWidgets('metahub-1', layoutId, 'user-1')

        expect(widgets).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: baseWidgetId,
                    widgetKey: 'menuWidget',
                    isInherited: true,
                    zone: 'left',
                    sortOrder: 9,
                    isActive: false,
                    config: expect.objectContaining({ variant: 'generated' })
                })
            ])
        )
    })

    it('rejects undeclared config fields on inherited placements before writing an override', async () => {
        const layoutId = 'object-layout-1'
        const baseLayoutId = globalLayoutIdV7
        const baseWidgetId = 'base-widget-1'

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (
                sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))') &&
                String(params?.[0] ?? '').startsWith('mhb-layout-graph:')
            )
                return []
            if (
                sql.includes('_mhb_layouts') &&
                (sql.includes('SELECT id, scope_entity_id, base_layout_id') || sql.includes('SELECT * FROM'))
            ) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: 'object-1',
                        base_layout_id: baseLayoutId,
                        template_key: 'dashboard',
                        config: {}
                    }
                ]
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('layout_id = $1')) {
                if (params?.[0] === baseLayoutId) {
                    return [
                        {
                            id: baseWidgetId,
                            layout_id: baseLayoutId,
                            zone: 'left',
                            instance_key: '0190a9b5-3cde-7abc-8def-000000000015',
                            parent_widget_id: null,
                            slot_key: null,
                            widget_key: 'menuWidget',
                            sort_order: 1,
                            config: { variant: 'generated' },
                            is_active: true,
                            _upl_created_at: '2026-04-06T00:00:00.000Z',
                            _upl_updated_at: '2026-04-06T00:00:00.000Z'
                        }
                    ]
                }

                if (params?.[0] === layoutId) {
                    return []
                }
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('layout_id = $1')) {
                return []
            }

            throw new Error(`Unexpected SQL in inherited config rejection test: ${sql}`)
        })

        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }

        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        await expect(
            service.updateLayoutZoneWidgetConfig('metahub-1', layoutId, baseWidgetId, { title: 'Custom menu' }, 'user-1')
        ).rejects.toThrow()
        expect(
            query.mock.calls.some(([sql]) => String(sql).includes('UPDATE') && String(sql).includes('_mhb_layout_widget_overrides'))
        ).toBe(false)
    })

    it('rejects inherited widget exclusion when the base layout disables it', async () => {
        const layoutId = 'object-layout-1'
        const baseLayoutId = globalLayoutIdV7
        const baseWidgetId = 'base-widget-1'

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (
                sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))') &&
                String(params?.[0] ?? '').startsWith('mhb-layout-graph:')
            )
                return []
            if (
                sql.includes('_mhb_layouts') &&
                (sql.includes('SELECT id, scope_entity_id, base_layout_id') || sql.includes('SELECT * FROM'))
            ) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: 'object-1',
                        base_layout_id: baseLayoutId,
                        template_key: 'dashboard',
                        config: {}
                    }
                ]
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('layout_id = $1')) {
                if (params?.[0] === baseLayoutId) {
                    return [
                        {
                            id: baseWidgetId,
                            layout_id: baseLayoutId,
                            zone: 'top',
                            instance_key: '0190a9b5-3cde-7abc-8def-000000000016',
                            parent_widget_id: null,
                            slot_key: null,
                            widget_key: 'appNavbar',
                            sort_order: 1,
                            config: {},
                            is_active: true,
                            _upl_created_at: '2026-04-06T00:00:00.000Z',
                            _upl_updated_at: '2026-04-06T00:00:00.000Z'
                        }
                    ]
                }

                if (params?.[0] === layoutId) {
                    return []
                }
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('layout_id = $1')) {
                return []
            }

            throw new Error(`Unexpected SQL in inherited removal rejection test: ${sql}`)
        })

        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }

        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        await expect(service.removeLayoutZoneWidget('metahub-1', layoutId, baseWidgetId, 'user-1')).rejects.toMatchObject({
            message: 'An inherited subtree placement cannot be excluded by this layout.',
            statusCode: 400
        })
        expect(
            query.mock.calls.some(
                ([sql]) =>
                    String(sql).includes('UPDATE') && String(sql).includes('_mhb_widgets') && String(sql).includes('_mhb_deleted = true')
            )
        ).toBe(false)
    })

    it('stores inherited widget exclusion through object override rows when allowed', async () => {
        const layoutId = 'object-layout-1'
        const baseLayoutId = globalLayoutIdV7
        const baseWidgetId = 'base-widget-1'
        const overrideRows: Array<Record<string, unknown>> = []

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (
                sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))') &&
                String(params?.[0] ?? '').startsWith('mhb-layout-graph:')
            )
                return []
            if (
                sql.includes('_mhb_layouts') &&
                (sql.includes('SELECT id, scope_entity_id, base_layout_id') || sql.includes('SELECT * FROM'))
            ) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: 'object-1',
                        base_layout_id: baseLayoutId,
                        template_key: 'dashboard',
                        config: {}
                    }
                ]
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('layout_id = $1')) {
                if (params?.[0] === baseLayoutId) {
                    return [
                        {
                            id: baseWidgetId,
                            layout_id: baseLayoutId,
                            zone: 'left',
                            instance_key: '0190a9b5-3cde-7abc-8def-000000000017',
                            parent_widget_id: null,
                            slot_key: null,
                            widget_key: 'menuWidget',
                            sort_order: 1,
                            config: { variant: 'generated' },
                            is_active: true,
                            _upl_created_at: '2026-04-06T00:00:00.000Z',
                            _upl_updated_at: '2026-04-06T00:00:00.000Z'
                        }
                    ]
                }

                if (params?.[0] === layoutId) {
                    return []
                }
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('layout_id = $1')) {
                return overrideRows
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('base_widget_id = $2')) {
                return overrideRows.filter((row) => row.base_widget_id === params?.[1])
            }

            if (sql.includes('INSERT INTO') && sql.includes('_mhb_layout_widget_overrides')) {
                overrideRows.push({
                    id: 'override-1',
                    layout_id: params?.[0],
                    base_widget_id: params?.[1],
                    zone: params?.[2],
                    sort_order: params?.[3],
                    is_active: params?.[5],
                    is_deleted_override: params?.[6],
                    _upl_updated_at: params?.[7]
                })
                return []
            }

            if (sql.includes('UPDATE') && sql.includes('_mhb_layouts') && sql.includes('config = $1')) {
                return [{ id: 'page-layout-1' }]
            }

            throw new Error(`Unexpected SQL in inherited exclusion override test: ${sql}`)
        })

        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }

        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        await service.removeLayoutZoneWidget('metahub-1', layoutId, baseWidgetId, 'user-1')

        expect(overrideRows).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    base_widget_id: baseWidgetId,
                    is_deleted_override: true
                })
            ])
        )
        expect(
            query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_layout_widget_overrides'))
        ).toBe(true)
    })

    it('rejects inherited widget moves when the base layout locks position', async () => {
        const layoutId = 'object-layout-1'
        const baseLayoutId = globalLayoutIdV7
        const baseWidgetId = 'base-widget-1'

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (
                sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))') &&
                String(params?.[0] ?? '').startsWith('mhb-layout-graph:')
            )
                return []
            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts')) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: 'object-1',
                        base_layout_id: baseLayoutId,
                        template_key: 'dashboard',
                        config: {}
                    }
                ]
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('layout_id = $1')) {
                if (params?.[0] === baseLayoutId) {
                    return [
                        {
                            id: baseWidgetId,
                            layout_id: baseLayoutId,
                            zone: 'top',
                            instance_key: '0190a9b5-3cde-7abc-8def-000000000018',
                            parent_widget_id: null,
                            slot_key: null,
                            widget_key: 'appNavbar',
                            sort_order: 1,
                            config: {},
                            is_active: true,
                            _upl_created_at: '2026-04-06T00:00:00.000Z',
                            _upl_updated_at: '2026-04-06T00:00:00.000Z'
                        }
                    ]
                }

                if (params?.[0] === layoutId) {
                    return []
                }
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('layout_id = $1')) {
                return []
            }

            throw new Error(`Unexpected SQL in inherited move rejection test: ${sql}`)
        })

        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }

        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        await expect(
            service.moveLayoutZoneWidget('metahub-1', layoutId, { widgetId: baseWidgetId, targetZone: 'right', targetIndex: 0 }, 'user-1')
        ).rejects.toMatchObject({
            message: 'Inherited widget position is locked by the base layout and cannot be moved.',
            statusCode: 400
        })
    })

    it('rejects inherited widget activation changes when the base layout disables deactivation', async () => {
        const layoutId = 'object-layout-1'
        const baseLayoutId = globalLayoutIdV7
        const baseWidgetId = 'base-widget-1'

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (
                sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))') &&
                String(params?.[0] ?? '').startsWith('mhb-layout-graph:')
            )
                return []
            if (
                sql.includes('_mhb_layouts') &&
                (sql.includes('SELECT id, scope_entity_id, base_layout_id') || sql.includes('SELECT * FROM'))
            ) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: 'object-1',
                        base_layout_id: baseLayoutId,
                        template_key: 'dashboard',
                        config: {}
                    }
                ]
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('layout_id = $1')) {
                if (params?.[0] === baseLayoutId) {
                    return [
                        {
                            id: baseWidgetId,
                            layout_id: baseLayoutId,
                            zone: 'top',
                            instance_key: '0190a9b5-3cde-7abc-8def-000000000019',
                            parent_widget_id: null,
                            slot_key: null,
                            widget_key: 'appNavbar',
                            sort_order: 1,
                            config: {},
                            is_active: true,
                            _upl_created_at: '2026-04-06T00:00:00.000Z',
                            _upl_updated_at: '2026-04-06T00:00:00.000Z'
                        }
                    ]
                }

                if (params?.[0] === layoutId) {
                    return []
                }
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('layout_id = $1')) {
                return []
            }

            throw new Error(`Unexpected SQL in inherited toggle rejection test: ${sql}`)
        })

        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }

        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        await expect(service.toggleLayoutZoneWidgetActive('metahub-1', layoutId, baseWidgetId, false, 'user-1')).rejects.toMatchObject({
            message: 'Inherited widget activation is locked by the base layout and cannot be changed.',
            statusCode: 400
        })
    })

    it('blocks deletion of a global layout that is still referenced by scoped layouts', async () => {
        const layoutId = globalLayoutIdV7

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) return []
            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layouts') && sql.includes('FOR UPDATE')) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: null,
                        base_layout_id: null,
                        template_key: 'dashboard',
                        is_default: false,
                        is_active: true
                    }
                ]
            }

            if (sql.includes('SELECT id FROM') && sql.includes('base_layout_id = $1')) {
                expect(params).toEqual([layoutId])
                return [{ id: 'object-layout-1' }]
            }

            throw new Error(`Unexpected SQL in delete guard test: ${sql}`)
        })

        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }

        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        await expect(service.deleteLayout('metahub-1', layoutId, 1, 'user-1')).rejects.toMatchObject({
            message: 'Cannot delete a global layout that is used by scoped layouts',
            statusCode: 409
        })
    })

    it('lists global widget visibility for every layout-capable entity scope', async () => {
        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (
                sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))') &&
                String(params?.[0] ?? '').startsWith('mhb-layout-graph:')
            )
                return []
            if (
                sql.includes('FROM') &&
                sql.includes('_mhb_layouts') &&
                sql.includes('_mhb_widgets') &&
                sql.includes('l.scope_entity_id IS NULL')
            ) {
                expect(params).toEqual([globalLayoutIdV7, 'base-widget-1'])
                return [{ layout_id: globalLayoutIdV7, widget_id: 'base-widget-1', widget_is_active: true }]
            }

            if (sql.includes('_mhb_objects') && sql.includes('_mhb_entity_type_definitions')) {
                return [
                    {
                        id: 'object-1',
                        kind: 'object',
                        codename: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Courses' }, ru: { content: 'Курсы' } }
                        },
                        presentation: {
                            name: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Courses' }, ru: { content: 'Курсы' } }
                            }
                        },
                        capabilities: { layoutConfig: { enabled: true } }
                    },
                    {
                        id: 'set-1',
                        kind: 'set',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Settings' } } },
                        presentation: {},
                        capabilities: { layoutConfig: false }
                    },
                    {
                        id: 'page-1',
                        kind: 'page',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Home' } } },
                        presentation: {
                            name: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Home' } }
                            }
                        },
                        capabilities: { layoutConfig: { enabled: true } }
                    }
                ]
            }

            if (sql.includes('FROM') && sql.includes('_mhb_layouts') && sql.includes('base_layout_id = $1')) {
                expect(params).toEqual([globalLayoutIdV7, ['object-1', 'page-1']])
                return [
                    {
                        id: 'object-layout-1',
                        scope_entity_id: 'object-1',
                        name: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Courses layout' } }
                        },
                        is_default: true,
                        is_active: true,
                        sort_order: 0
                    }
                ]
            }

            if (sql.includes('FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('base_widget_id = $1')) {
                expect(params).toEqual(['base-widget-1', ['object-layout-1']])
                return [{ layout_id: 'object-layout-1', is_active: false, is_deleted_override: false }]
            }

            throw new Error(`Unexpected SQL in scope visibility list test: ${sql}`)
        })

        const exec = { query, transaction: jest.fn(), isReleased: () => false }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }

        const service = new MetahubLayoutsService(exec as never, schemaService as never)
        const result = await service.listLayoutWidgetScopeVisibility('metahub-1', globalLayoutIdV7, 'base-widget-1', 'user-1')

        expect(result).toEqual([
            expect.objectContaining({
                scopeEntityId: 'object-1',
                kind: 'object',
                layoutId: 'object-layout-1',
                isVisible: false,
                isOverridden: true
            }),
            expect.objectContaining({
                scopeEntityId: 'page-1',
                kind: 'page',
                layoutId: null,
                isVisible: true,
                isOverridden: false
            })
        ])
    })

    it('resets a scoped widget override only when the override version is current', async () => {
        const layoutScope = {
            id: 'scoped-layout',
            scope_entity_id: 'object-1',
            base_layout_id: 'global-layout',
            template_key: 'dashboard',
            config: {},
            version: 2
        }
        const baseWidget = {
            id: 'base-widget',
            layout_id: 'global-layout',
            zone: 'left',
            instance_key: '0190a9b5-3cde-7abc-8def-00000000001a',
            parent_widget_id: null,
            slot_key: null,
            widget_key: 'menuWidget',
            sort_order: 1,
            config: { variant: 'generated' },
            is_active: true,
            _upl_version: 3,
            _upl_created_at: '2026-04-04T00:00:00.000Z',
            _upl_updated_at: '2026-04-04T00:00:00.000Z'
        }
        const override = {
            id: 'override-1',
            layout_id: 'scoped-layout',
            base_widget_id: 'base-widget',
            zone: 'right',
            sort_order: 1,
            config: {},
            is_active: true,
            is_deleted_override: false,
            _upl_version: 4,
            _upl_created_at: '2026-04-04T00:00:00.000Z',
            _upl_updated_at: '2026-04-04T00:00:00.000Z'
        }
        let overrideActive = true
        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (
                sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))') &&
                String(params?.[0] ?? '').startsWith('mhb-layout-graph:')
            )
                return []
            if (sql.includes('_mhb_layouts') && sql.includes('FOR UPDATE')) return [layoutScope]
            if (sql.includes('_mhb_widgets') && sql.includes('WHERE id = $1')) return [baseWidget]
            if (sql.includes('_mhb_layout_widget_overrides') && sql.includes('base_widget_id = $2')) return overrideActive ? [override] : []
            if (sql.includes('UPDATE') && sql.includes('_mhb_layout_widget_overrides')) {
                overrideActive = false
                return [{ id: 'override-1' }]
            }
            if (sql.includes('_mhb_widgets') && sql.includes('WHERE layout_id = $1')) {
                return params?.[0] === 'global-layout' ? [baseWidget] : []
            }
            if (sql.includes('_mhb_layout_widget_overrides') && sql.includes('WHERE layout_id = $1')) return []
            if (sql.includes('_mhb_layouts')) return [layoutScope]
            throw new Error(`Unexpected SQL in scoped override reset test: ${sql}`)
        })
        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }
        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        await expect(service.resetLayoutZoneWidgetOverride('metahub-1', 'scoped-layout', 'base-widget', 'user-1', 3)).rejects.toThrow(
            'Layout widget was modified by another request'
        )

        await service.resetLayoutZoneWidgetOverride('metahub-1', 'scoped-layout', 'base-widget', 'user-1', 4)

        const resetMutation = query.mock.calls.find(
            ([sql]) => String(sql).includes('_mhb_layout_widget_overrides') && String(sql).includes('RETURNING id')
        )
        expect(resetMutation?.[0]).toContain('COALESCE(_upl_version, 1) = $4')
        expect(resetMutation?.[1]).toEqual([expect.any(Date), 'user-1', 'override-1', 4])

        expect(
            query.mock.calls.filter(([sql]) => String(sql).includes('UPDATE') && String(sql).includes('_mhb_layout_widget_overrides'))
        ).toHaveLength(1)
    })

    it('auto-creates a scoped layout when saving global widget visibility for a layout-capable scope', async () => {
        let insertedScopedLayout = false
        let insertedOverride = false

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (
                sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))') &&
                String(params?.[0] ?? '').startsWith('mhb-layout-graph:')
            )
                return []
            if (sql.includes('_mhb_objects') && sql.includes('_mhb_entity_type_definitions') && sql.includes('WHERE o.id = $1')) {
                expect(params).toEqual(['page-1'])
                return [{ id: 'page-1', kind: 'page', capabilities: { layoutConfig: { enabled: true } } }]
            }

            if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) {
                expect(params).toEqual([`mhb-layout-scope:mhb_a1b2c3d4e5f67890abcdef1234567890_b1:${globalLayoutIdV7}:page-1`])
                return []
            }

            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts') && sql.includes('FOR UPDATE')) {
                if (sql.includes('scope_entity_id IS NULL')) {
                    return [
                        {
                            id: globalLayoutIdV7,
                            scope_entity_id: null,
                            base_layout_id: null,
                            template_key: 'dashboard',
                            config: {}
                        }
                    ]
                }
                if (sql.includes('scope_entity_id = $1') && sql.includes('base_layout_id = $2')) {
                    return []
                }
            }

            if (sql.includes('SELECT *') && sql.includes('_mhb_widgets') && sql.includes('FOR UPDATE')) {
                expect(params).toEqual(['base-widget-1', globalLayoutIdV7])
                return [
                    {
                        id: 'base-widget-1',
                        layout_id: globalLayoutIdV7,
                        zone: 'left',
                        instance_key: '0190a9b5-3cde-7abc-8def-00000000001b',
                        parent_widget_id: null,
                        slot_key: null,
                        widget_key: 'menuWidget',
                        is_active: true,
                        config: { variant: 'generated' }
                    }
                ]
            }

            if (sql.includes('SELECT presentation, codename') && sql.includes('_mhb_objects')) {
                expect(params).toEqual(['page-1'])
                return [
                    {
                        presentation: {
                            name: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Home' }, ru: { content: 'Главная' } }
                            }
                        },
                        codename: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Home' }, ru: { content: 'Главная' } }
                        }
                    }
                ]
            }

            if (sql.includes('INSERT INTO') && sql.includes('_mhb_layouts')) {
                insertedScopedLayout = true
                expect(params?.[0]).toBe('page-1')
                expect(params?.[1]).toBe(globalLayoutIdV7)
                return [
                    {
                        id: 'page-layout-1',
                        scope_entity_id: 'page-1',
                        base_layout_id: globalLayoutIdV7,
                        template_key: 'dashboard',
                        config: {}
                    }
                ]
            }

            if (sql.includes('SELECT *') && sql.includes('_mhb_layout_widget_overrides')) {
                return []
            }

            if (sql.includes('INSERT INTO') && sql.includes('_mhb_layout_widget_overrides')) {
                insertedOverride = true
                expect(params?.[0]).toBe('page-layout-1')
                expect(params?.[1]).toBe('base-widget-1')
                expect(params?.[5]).toBe(false)
                return []
            }

            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts')) {
                return [
                    {
                        id: 'page-layout-1',
                        scope_entity_id: 'page-1',
                        base_layout_id: globalLayoutIdV7,
                        template_key: 'dashboard',
                        config: {}
                    }
                ]
            }

            if (sql.includes('UPDATE') && sql.includes('_mhb_layouts') && sql.includes('config = $1')) {
                return [{ id: 'page-layout-1' }]
            }

            if (sql.includes('_mhb_layouts') && sql.includes('_mhb_widgets') && sql.includes('l.scope_entity_id IS NULL')) {
                return [{ layout_id: globalLayoutIdV7, widget_id: 'base-widget-1', widget_is_active: true }]
            }

            if (sql.includes('_mhb_objects') && sql.includes('_mhb_entity_type_definitions')) {
                return [
                    {
                        id: 'page-1',
                        kind: 'page',
                        codename: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Home' } }
                        },
                        presentation: {
                            name: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Home' } }
                            }
                        },
                        capabilities: { layoutConfig: { enabled: true } }
                    }
                ]
            }

            if (sql.includes('FROM') && sql.includes('_mhb_layouts') && sql.includes('base_layout_id = $1')) {
                return [{ id: 'page-layout-1', scope_entity_id: 'page-1', name: {}, is_default: true, is_active: true, sort_order: 0 }]
            }

            if (sql.includes('FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('base_widget_id = $1')) {
                return [{ layout_id: 'page-layout-1', is_active: false, is_deleted_override: false }]
            }

            throw new Error(`Unexpected SQL in scope visibility update test: ${sql}`)
        })

        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }

        const service = new MetahubLayoutsService(exec as never, schemaService as never)
        const result = await service.setLayoutWidgetScopeVisibility(
            'metahub-1',
            globalLayoutIdV7,
            'base-widget-1',
            'page-1',
            false,
            'user-1'
        )

        expect(insertedScopedLayout).toBe(true)
        expect(insertedOverride).toBe(true)
        expect(result).toEqual([
            expect.objectContaining({
                scopeEntityId: 'page-1',
                layoutId: 'page-layout-1',
                isVisible: false,
                isOverridden: true
            })
        ])
    })

    it('reuses the same scoped layout on repeated resolution', async () => {
        const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
        const baseLayoutId = globalLayoutIdV7
        const scopeEntityId = 'page-1'
        let persistedLayout: {
            id: string
            scope_entity_id: string
            base_layout_id: string
            template_key: string
            config: Record<string, unknown>
        } | null = null
        let insertCount = 0

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) {
                expect(params).toEqual([`mhb-layout-scope:${schemaName}:${baseLayoutId}:${scopeEntityId}`])
                return []
            }

            if (sql.includes('scope_entity_id = $1') && sql.includes('base_layout_id = $2')) {
                expect(params).toEqual([scopeEntityId, baseLayoutId])
                return persistedLayout ? [persistedLayout] : []
            }

            if (sql.includes('SELECT presentation, codename')) {
                return [{ presentation: {}, codename: 'Home' }]
            }

            if (sql.includes('INSERT INTO') && sql.includes('_mhb_layouts')) {
                insertCount += 1
                persistedLayout = {
                    id: 'page-layout-1',
                    scope_entity_id: scopeEntityId,
                    base_layout_id: baseLayoutId,
                    template_key: 'dashboard',
                    config: {}
                }
                return [persistedLayout]
            }

            throw new Error(`Unexpected SQL in repeated scoped layout resolution test: ${sql}`)
        })

        const service = new MetahubLayoutsService({ query } as never, {} as never)
        const resolveScopedLayout = (
            service as unknown as {
                findOrCreateScopedLayout: (tx: unknown, schema: string, params: unknown) => Promise<{ id: string }>
            }
        ).findOrCreateScopedLayout.bind(service)
        const params = {
            baseLayout: {
                id: baseLayoutId,
                scope_entity_id: null,
                base_layout_id: null,
                template_key: 'dashboard',
                config: {}
            },
            baseLayoutId,
            scopeEntityId,
            userId: 'user-1'
        }

        const first = await resolveScopedLayout({ query }, schemaName, params)
        const second = await resolveScopedLayout({ query }, schemaName, params)

        expect(first.id).toBe('page-layout-1')
        expect(second.id).toBe(first.id)
        expect(insertCount).toBe(1)
        expect(query.mock.calls.filter(([sql]) => sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))'))).toHaveLength(2)
    })

    it('serializes concurrent scoped resolution and creates no duplicate logical layout', async () => {
        const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
        const baseLayoutId = globalLayoutIdV7
        const scopeEntityId = 'page-1'
        const lockTails = new Map<string, Promise<void>>()
        const queryCalls: Array<[string, unknown[] | undefined]> = []
        const persistedLayouts: Array<{
            id: string
            scope_entity_id: string
            base_layout_id: string
            template_key: string
            config: Record<string, unknown>
        }> = []
        let insertCount = 0

        const createTransaction = () => {
            const releases: Array<() => void> = []
            const query = jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
                queryCalls.push([sql, params])

                if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) {
                    const lockKey = String(params?.[0])
                    const previous = lockTails.get(lockKey) ?? Promise.resolve()
                    let releaseCurrent = () => undefined
                    const current = new Promise<void>((resolve) => {
                        releaseCurrent = resolve
                    })
                    const tail = previous.then(() => current)
                    lockTails.set(lockKey, tail)
                    await previous
                    releases.push(() => {
                        releaseCurrent()
                        if (lockTails.get(lockKey) === tail) {
                            lockTails.delete(lockKey)
                        }
                    })
                    return []
                }

                if (sql.includes('scope_entity_id = $1') && sql.includes('base_layout_id = $2')) {
                    return persistedLayouts.slice(0, 1)
                }

                if (sql.includes('SELECT presentation, codename')) {
                    return [{ presentation: {}, codename: 'Home' }]
                }

                if (sql.includes('INSERT INTO') && sql.includes('_mhb_layouts')) {
                    insertCount += 1
                    const created = {
                        id: 'page-layout-1',
                        scope_entity_id: scopeEntityId,
                        base_layout_id: baseLayoutId,
                        template_key: 'dashboard',
                        config: {}
                    }
                    persistedLayouts.push(created)
                    return [created]
                }

                throw new Error(`Unexpected SQL in concurrent scoped layout resolution test: ${sql}`)
            })

            return {
                query,
                release: () => releases.forEach((release) => release())
            }
        }

        const exec = {
            query: jest.fn(),
            transaction: jest.fn(async (callback: (tx: { query: typeof query }) => Promise<unknown>) => {
                const transaction = createTransaction()
                try {
                    return await callback(transaction)
                } finally {
                    transaction.release()
                }
            }),
            isReleased: () => false
        }
        const service = new MetahubLayoutsService(exec as never, {} as never)
        const resolveScopedLayout = (
            service as unknown as {
                findOrCreateScopedLayout: (tx: unknown, schema: string, params: unknown) => Promise<{ id: string }>
            }
        ).findOrCreateScopedLayout.bind(service)
        const params = {
            baseLayout: {
                id: baseLayoutId,
                scope_entity_id: null,
                base_layout_id: null,
                template_key: 'dashboard',
                config: {}
            },
            baseLayoutId,
            scopeEntityId,
            userId: 'user-1'
        }

        const [first, second] = await Promise.all([
            exec.transaction((tx) => resolveScopedLayout(tx, schemaName, params)),
            exec.transaction((tx) => resolveScopedLayout(tx, schemaName, params))
        ])

        expect(first.id).toBe('page-layout-1')
        expect(second.id).toBe(first.id)
        expect(insertCount).toBe(1)
        expect(persistedLayouts).toHaveLength(1)
        expect(queryCalls.filter(([sql]) => sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))'))).toHaveLength(2)
        expect(queryCalls[0]?.[0]).toContain('pg_advisory_xact_lock(hashtextextended($1::text, 0))')
        expect(queryCalls[0]?.[1]).toEqual([`mhb-layout-scope:${schemaName}:${baseLayoutId}:${scopeEntityId}`])
    })
})
