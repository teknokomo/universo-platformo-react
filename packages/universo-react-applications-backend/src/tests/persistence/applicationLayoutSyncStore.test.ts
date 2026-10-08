import { describe, expect, it, jest } from '@jest/globals'
import {
    buildSingleTargetWidgetBinding,
    decodeLayoutWidgetConfigEnvelope,
    encodeLayoutWidgetConfigEnvelope,
    LAYOUT_WIDGET_DEFINITIONS
} from '@universo-react/types'
import {
    createApplicationLayoutWidgetSourceState,
    resolveSyncedApplicationLayoutWidgetState
} from '../../services/applicationLayoutWidgetSourceState'
import type { DbExecutor } from '@universo-react/utils'

import {
    getPersistedDashboardLayoutConfig,
    getPersistedPublishedLayouts,
    getPersistedPublishedWidgets,
    type SyncWidgetInput
} from '../../persistence/applicationLayoutSyncStore'
import { getPersistedPublishedWidgets as getPublishedWidgetsThroughSyncBoundary } from '../../routes/sync/syncLayoutPersistence'

const createExecutor = (query: DbExecutor['query']): DbExecutor => ({ query })
const schemaName = 'app_018f8a787b8f7c1da111222233334444'
const heroDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
if (!heroDefinition) throw new Error('The marketing hero widget must be registered')

const heroBinding = (semanticKey: string) =>
    buildSingleTargetWidgetBinding(heroDefinition, 'content', {
        entityKind: 'object',
        entityCodename: 'MarketingPageHero',
        semanticKey
    })

const heroConfig = (semanticKey: string) =>
    encodeLayoutWidgetConfigEnvelope(
        { rendererConfig: { showLeadForm: true }, neutral: { bindings: heroBinding(semanticKey) } },
        { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
    )

const syncWidget = (widgetKey: string, zone: string, config: Record<string, unknown>): SyncWidgetInput => ({
    id: '0190a9b5-3cde-7000-8000-000000000031',
    layoutId: '0190a9b5-3cde-7000-8000-000000000032',
    sourceWidgetId: '0190a9b5-3cde-7000-8000-000000000031',
    zone,
    widgetKey,
    instanceKey: 'hero',
    parentWidgetId: null,
    slotKey: null,
    sortOrder: 0,
    config,
    isActive: true,
    sourceContentHash: 'source-hash'
})

describe('applicationLayoutSyncStore canonical layout boundaries', () => {
    it('syncs binding-only source changes while retaining a presentation-only baseline', () => {
        const previousConfig = heroConfig('default')
        const sourceState = createApplicationLayoutWidgetSourceState('marketing-page', 'marketing.hero', {
            zone: 'marketing-main',
            sortOrder: 0,
            isActive: true,
            config: previousConfig,
            instanceKey: 'hero',
            parentWidgetId: null,
            slotKey: null
        })
        const nextInput = {
            id: '0190a9b5-3cde-7000-8000-000000000011',
            layoutId: '0190a9b5-3cde-7000-8000-000000000012',
            zone: 'marketing-main',
            widgetKey: 'marketing.hero',
            instanceKey: 'hero',
            parentWidgetId: null,
            slotKey: null,
            sourceWidgetId: '0190a9b5-3cde-7000-8000-000000000011',
            sortOrder: 0,
            config: heroConfig('campaign'),
            isActive: true,
            sourceContentHash: 'source-binding-update'
        } satisfies SyncWidgetInput
        const current = {
            id: nextInput.id,
            layout_id: nextInput.layoutId,
            zone: nextInput.zone,
            widget_key: nextInput.widgetKey,
            instance_key: nextInput.instanceKey,
            parent_widget_id: null,
            slot_key: null,
            sort_order: nextInput.sortOrder,
            config: previousConfig,
            source_config: previousConfig,
            source_state: sourceState,
            is_active: true,
            source_widget_id: nextInput.id,
            source_base_widget_id: null,
            source_content_hash: 'source-binding-old',
            local_content_hash: 'source-binding-old',
            _upl_deleted: false,
            _app_deleted: false,
            _upl_created_at: null,
            version: 1
        } satisfies ApplicationLayoutSyncWidgetRow

        const resolved = resolveSyncedApplicationLayoutWidgetState('marketing-page', nextInput, current)
        const decoded = decodeLayoutWidgetConfigEnvelope(resolved.config, {
            templateKey: 'marketing-page',
            widgetKey: 'marketing.hero',
            zone: 'marketing-main'
        })

        expect(decoded.rendererConfig).toEqual({ showLeadForm: true })
        expect(decoded.neutral.bindings).toEqual(heroBinding('campaign'))
        expect(resolved.sourceState).toEqual(sourceState)
        expect(resolved.sourceState).not.toHaveProperty('bindings')
    })

    it('syncs from source_config when the current Application renderer config omits Entity bindings', () => {
        const previousConfig = heroConfig('default')
        const sourceState = createApplicationLayoutWidgetSourceState('marketing-page', 'marketing.hero', {
            zone: 'marketing-main',
            sortOrder: 0,
            isActive: true,
            config: previousConfig,
            instanceKey: 'hero',
            parentWidgetId: null,
            slotKey: null
        })
        const nextInput = {
            ...syncWidget('marketing.hero', 'marketing-main', heroConfig('campaign')),
            sortOrder: 0
        } satisfies SyncWidgetInput
        const current = {
            id: nextInput.id,
            layout_id: nextInput.layoutId,
            zone: nextInput.zone,
            widget_key: nextInput.widgetKey,
            instance_key: nextInput.instanceKey,
            parent_widget_id: null,
            slot_key: null,
            sort_order: nextInput.sortOrder,
            config: { showLeadForm: false },
            source_config: previousConfig,
            source_state: sourceState,
            is_active: true,
            source_widget_id: nextInput.id,
            source_base_widget_id: null,
            source_content_hash: 'source-binding-old',
            local_content_hash: 'source-binding-old',
            _upl_deleted: false,
            _app_deleted: false,
            _upl_created_at: null,
            version: 2
        } satisfies ApplicationLayoutSyncWidgetRow

        const resolved = resolveSyncedApplicationLayoutWidgetState('marketing-page', nextInput, current)
        const decoded = decodeLayoutWidgetConfigEnvelope(resolved.config, {
            templateKey: 'marketing-page',
            widgetKey: 'marketing.hero',
            zone: 'marketing-main'
        })

        expect(decoded.rendererConfig).toEqual({ showLeadForm: false })
        expect(decoded.neutral.bindings).toEqual(heroBinding('campaign'))
        expect(resolved.sourceState).toEqual(sourceState)
    })

    it('persists inherited Marketing overlay presentation without base bindings', () => {
        const baseWidgetId = '0190a9b5-3cde-7000-8000-000000000041'
        const overlayConfig = encodeLayoutWidgetConfigEnvelope(
            { rendererConfig: { showLeadForm: false } },
            { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
        )
        const input: SyncWidgetInput = {
            ...syncWidget('marketing.hero', 'marketing-main', overlayConfig),
            sourceBaseWidgetId: baseWidgetId
        }

        const resolved = resolveSyncedApplicationLayoutWidgetState('marketing-page', input)
        const decoded = decodeLayoutWidgetConfigEnvelope(resolved.config, {
            templateKey: 'marketing-page',
            widgetKey: 'marketing.hero',
            zone: 'marketing-main'
        })

        expect(decoded.rendererConfig).toEqual({ showLeadForm: false })
        expect(decoded.neutral.placement).toBeUndefined()
        expect(decoded.neutral.bindings).toBeUndefined()
        expect(resolved.sourceState).not.toHaveProperty('bindings')
        expect(() =>
            resolveSyncedApplicationLayoutWidgetState('marketing-page', {
                ...input,
                config: heroConfig('attempted-overlay-binding')
            })
        ).toThrow('Inherited widget config cannot contain bindings')
    })

    it('restores source activation after a sync tombstone without interpreting it as a local override', () => {
        const config = heroConfig('default')
        const sourceState = createApplicationLayoutWidgetSourceState('marketing-page', 'marketing.hero', {
            zone: 'marketing-main',
            sortOrder: 0,
            isActive: true,
            config,
            instanceKey: 'hero',
            parentWidgetId: null,
            slotKey: null
        })
        const current = {
            id: '0190a9b5-3cde-7000-8000-000000000021',
            layout_id: '0190a9b5-3cde-7000-8000-000000000022',
            zone: 'marketing-main',
            widget_key: 'marketing.hero',
            instance_key: 'hero',
            parent_widget_id: null,
            slot_key: null,
            sort_order: 0,
            config,
            source_config: config,
            source_state: sourceState,
            is_active: false,
            source_widget_id: '0190a9b5-3cde-7000-8000-000000000021',
            source_base_widget_id: null,
            source_content_hash: 'old-source',
            local_content_hash: 'old-source',
            _upl_deleted: true,
            _app_deleted: false,
            _upl_created_at: null,
            version: 2
        } satisfies ApplicationLayoutSyncWidgetRow

        const resolved = resolveSyncedApplicationLayoutWidgetState(
            'marketing-page',
            {
                id: current.id,
                layoutId: current.layout_id,
                zone: current.zone,
                widgetKey: current.widget_key,
                instanceKey: 'hero',
                parentWidgetId: null,
                slotKey: null,
                sourceWidgetId: current.id,
                sortOrder: current.sort_order,
                config,
                isActive: true,
                sourceContentHash: 'new-source'
            },
            current
        )

        expect(resolved.isActive).toBe(true)
    })

    it('fails closed when an inherited widget has lost its source-state baseline', () => {
        const config = heroConfig('default')
        expect(() =>
            resolveSyncedApplicationLayoutWidgetState(
                'marketing-page',
                {
                    id: '0190a9b5-3cde-7000-8000-000000000031',
                    layoutId: '0190a9b5-3cde-7000-8000-000000000032',
                    zone: 'marketing-main',
                    widgetKey: 'marketing.hero',
                    instanceKey: 'hero',
                    parentWidgetId: null,
                    slotKey: null,
                    sourceWidgetId: '0190a9b5-3cde-7000-8000-000000000031',
                    sortOrder: 0,
                    config,
                    isActive: true,
                    sourceContentHash: 'source'
                },
                {
                    id: '0190a9b5-3cde-7000-8000-000000000031',
                    layout_id: '0190a9b5-3cde-7000-8000-000000000032',
                    zone: 'marketing-main',
                    widget_key: 'marketing.hero',
                    instance_key: 'hero',
                    parent_widget_id: null,
                    slot_key: null,
                    sort_order: 0,
                    config,
                    source_config: config,
                    source_state: null,
                    is_active: true,
                    source_widget_id: '0190a9b5-3cde-7000-8000-000000000031',
                    source_base_widget_id: null,
                    source_content_hash: 'source',
                    local_content_hash: 'source',
                    _upl_deleted: false,
                    _app_deleted: false,
                    _upl_created_at: null,
                    version: 1
                }
            )
        ).toThrow('missing its source-state baseline')
    })

    it('returns an empty dashboard config only when no persisted dashboard layout exists', async () => {
        const executor = createExecutor(jest.fn(async () => []))

        await expect(getPersistedDashboardLayoutConfig(executor, schemaName)).resolves.toEqual({})
    })

    it('fails closed when a persisted dashboard config is not an object', async () => {
        const executor = createExecutor(jest.fn(async () => [{ config: 'invalid' }] as never))

        await expect(getPersistedDashboardLayoutConfig(executor, schemaName)).rejects.toThrow(
            '[SchemaSync] Persisted dashboard layout config is invalid'
        )
    })

    it('exports published layouts through the canonical snapshot envelope', async () => {
        const layoutId = '0190a9b5-3cde-7000-8000-000000000001'
        const executor = createExecutor(
            jest.fn(
                async () =>
                    [
                        {
                            id: layoutId,
                            scope_entity_id: null,
                            template_key: 'marketing-page',
                            name: { en: 'Marketing' },
                            description: null,
                            config: {
                                themeMode: 'light',
                                __layout: {
                                    composition: { mode: 'independent', baseLayoutId: null },
                                    zoneSettings: { 'marketing-header': { position: 'flow' } },
                                    sourceZoneSettings: { 'marketing-header': { position: 'fixed' } }
                                }
                            },
                            is_active: true,
                            is_default: true,
                            sort_order: 0
                        }
                    ] as never
            )
        )

        const result = await getPersistedPublishedLayouts(executor, schemaName)

        expect(result.defaultLayoutId).toBe(layoutId)
        expect(result.layouts).toHaveLength(1)
        expect(result.layouts[0]).toEqual(
            expect.objectContaining({
                id: layoutId,
                sourceComposition: { mode: 'independent', baseLayoutId: null }
            })
        )
        expect(result.layouts[0]?.config).toEqual(
            expect.objectContaining({
                themeMode: 'light',
                __layout: { zoneSettings: { 'marketing-header': { position: 'flow' } } }
            })
        )
        expect(result.layouts[0]?.config.__layout).not.toHaveProperty('composition')
        expect(result.layouts[0]?.config.__layout).not.toHaveProperty('sourceZoneSettings')
    })

    it('fails closed when a published layout carries malformed neutral metadata', async () => {
        const executor = createExecutor(
            jest.fn(
                async () =>
                    [
                        {
                            id: '0190a9b5-3cde-7000-8000-000000000002',
                            scope_entity_id: null,
                            template_key: 'dashboard',
                            name: { en: 'Dashboard' },
                            description: null,
                            config: { __layout: { unsupported: true } },
                            is_active: true,
                            is_default: true,
                            sort_order: 0
                        }
                    ] as never
            )
        )

        await expect(getPersistedPublishedLayouts(executor, schemaName)).rejects.toThrow()
    })

    it('uses the joined layout template to validate shared marketing widgets', async () => {
        const executor = createExecutor(
            jest.fn(
                async () =>
                    [
                        {
                            id: '0190a9b5-3cde-7000-8000-000000000003',
                            layout_id: '0190a9b5-3cde-7000-8000-000000000001',
                            source_base_widget_id: null,
                            source_widget_id: null,
                            instance_key: 'languageSwitcher',
                            parent_widget_id: null,
                            slot_key: null,
                            zone: 'marketing-header',
                            widget_key: 'languageSwitcher',
                            sort_order: 2,
                            config: { __layout: { placement: 'end' } },
                            is_active: true,
                            template_key: 'marketing-page'
                        }
                    ] as never
            )
        )

        await expect(getPublishedWidgetsThroughSyncBoundary({ schemaName, executor })).resolves.toEqual([
            expect.objectContaining({
                zone: 'marketing-header',
                widgetKey: 'languageSwitcher',
                config: { __layout: { placement: 'end' } }
            })
        ])
    })

    it('reads inherited Marketing overlay config deltas without accepting scoped bindings', async () => {
        const overlayConfig = encodeLayoutWidgetConfigEnvelope(
            { rendererConfig: { showLeadForm: false } },
            { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
        )
        const validExecutor = createExecutor(
            jest.fn(
                async () =>
                    [
                        {
                            id: '0190a9b5-3cde-7000-8000-000000000051',
                            layout_id: '0190a9b5-3cde-7000-8000-000000000052',
                            source_base_widget_id: '0190a9b5-3cde-7000-8000-000000000053',
                            source_widget_id: null,
                            instance_key: 'hero',
                            parent_widget_id: null,
                            slot_key: null,
                            zone: 'marketing-main',
                            widget_key: 'marketing.hero',
                            sort_order: 1,
                            config: overlayConfig,
                            source_config: overlayConfig,
                            is_active: true,
                            template_key: 'marketing-page'
                        }
                    ] as never
            )
        )

        const [widget] = await getPersistedPublishedWidgets(validExecutor, schemaName)
        const decoded = decodeLayoutWidgetConfigEnvelope(widget?.config, {
            templateKey: 'marketing-page',
            widgetKey: 'marketing.hero',
            zone: 'marketing-main'
        })
        expect(decoded.neutral.placement).toBeUndefined()
        expect(decoded.neutral.bindings).toBeUndefined()

        const invalidExecutor = createExecutor(
            jest.fn(
                async () =>
                    [
                        {
                            id: '0190a9b5-3cde-7000-8000-000000000054',
                            layout_id: '0190a9b5-3cde-7000-8000-000000000052',
                            source_base_widget_id: '0190a9b5-3cde-7000-8000-000000000053',
                            source_widget_id: null,
                            instance_key: 'hero',
                            parent_widget_id: null,
                            slot_key: null,
                            zone: 'marketing-main',
                            widget_key: 'marketing.hero',
                            sort_order: 1,
                            config: heroConfig('scoped-forgery'),
                            source_config: heroConfig('scoped-forgery'),
                            is_active: true,
                            template_key: 'marketing-page'
                        }
                    ] as never
            )
        )
        await expect(getPersistedPublishedWidgets(invalidExecutor, schemaName)).rejects.toThrow(
            'cannot contain bindings for its registry policy'
        )
    })

    it('reconstructs published bindings from source_config after local renderer edits', async () => {
        const row = {
            id: '0190a9b5-3cde-7000-8000-000000000061',
            layout_id: '0190a9b5-3cde-7000-8000-000000000062',
            source_base_widget_id: null,
            source_widget_id: '0190a9b5-3cde-7000-8000-000000000063',
            instance_key: 'hero',
            parent_widget_id: null,
            slot_key: null,
            zone: 'marketing-main',
            widget_key: 'marketing.hero',
            sort_order: 1,
            config: { showLeadForm: false },
            source_config: heroConfig('campaign'),
            is_active: true,
            template_key: 'marketing-page'
        }
        const executor = createExecutor(jest.fn(async () => [row] as never))

        const [published] = await getPersistedPublishedWidgets(executor, schemaName)
        const decoded = decodeLayoutWidgetConfigEnvelope(published?.config, {
            templateKey: 'marketing-page',
            widgetKey: 'marketing.hero',
            zone: 'marketing-main'
        })

        expect(decoded.rendererConfig).toEqual({ showLeadForm: false })
        expect(decoded.neutral.bindings).toEqual(heroBinding('campaign'))

        const forgedExecutor = createExecutor(jest.fn(async () => [{ ...row, config: heroConfig('forged') }] as never))
        await expect(getPersistedPublishedWidgets(forgedExecutor, schemaName)).rejects.toThrow('do not match its source config')
    })

    it('fails closed when a published widget does not match its layout template', async () => {
        const executor = createExecutor(
            jest.fn(
                async () =>
                    [
                        {
                            id: '0190a9b5-3cde-7000-8000-000000000004',
                            layout_id: '0190a9b5-3cde-7000-8000-000000000001',
                            source_base_widget_id: null,
                            source_widget_id: null,
                            instance_key: 'languageSwitcher',
                            parent_widget_id: null,
                            slot_key: null,
                            zone: 'marketing-header',
                            widget_key: 'languageSwitcher',
                            sort_order: 2,
                            config: {},
                            is_active: true,
                            template_key: 'dashboard'
                        }
                    ] as never
            )
        )

        await expect(getPersistedPublishedWidgets(executor, schemaName)).rejects.toThrow()
    })
})
