import { act, renderHook } from '@testing-library/react'
import type { TFunction } from 'i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    buildSingleTargetWidgetBinding,
    encodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    RESERVED_LAYOUT_METADATA_KEY,
    type WidgetEntityBindingEnvelope
} from '@universo-react/types'

import type { MetahubLayout, MetahubLayoutZoneWidget } from '../../../../types'
import type { UseLayoutWidgetAuthoringOptions } from '../useLayoutWidgetAuthoring'

const mocks = vi.hoisted(() => ({
    assignLayoutZoneWidget: vi.fn(),
    duplicateLayoutZoneWidgetPlacement: vi.fn(),
    duplicateLayoutZoneWidgetWithRecordCopy: vi.fn(),
    replaceLayoutZoneWidgetBindings: vi.fn(),
    updateLayoutZoneWidgetConfig: vi.fn()
}))

vi.mock('../../api', () => ({
    assignLayoutZoneWidget: mocks.assignLayoutZoneWidget,
    duplicateLayoutZoneWidgetPlacement: mocks.duplicateLayoutZoneWidgetPlacement,
    duplicateLayoutZoneWidgetWithRecordCopy: mocks.duplicateLayoutZoneWidgetWithRecordCopy,
    replaceLayoutZoneWidgetBindings: mocks.replaceLayoutZoneWidgetBindings,
    updateLayoutZoneWidgetConfig: mocks.updateLayoutZoneWidgetConfig
}))

import { hasMarketingWidgetBindings } from '../layoutDetailsWidgetAuthoringModel'
import { useLayoutWidgetAuthoring } from '../useLayoutWidgetAuthoring'

const layout: MetahubLayout = {
    id: 'layout-1',
    templateKey: 'marketing-page',
    name: { _schema: '1', _primary: 'en', locales: {} },
    config: {},
    isActive: true,
    isDefault: false,
    sortOrder: 0,
    version: 3,
    createdAt: '2026-09-29T00:00:00.000Z',
    updatedAt: '2026-09-29T00:00:00.000Z'
}

const widget: MetahubLayoutZoneWidget = {
    id: 'widget-1',
    layoutId: layout.id,
    zone: 'marketing-main',
    widgetKey: 'marketing.hero',
    instanceKey: 'hero-instance',
    parentInstanceKey: null,
    slotKey: null,
    sortOrder: 0,
    config: { showLeadForm: true },
    isActive: true,
    version: 2,
    createdAt: '2026-09-29T00:00:00.000Z',
    updatedAt: '2026-09-29T00:00:00.000Z'
}

const createdWidget: MetahubLayoutZoneWidget = {
    ...widget,
    id: 'widget-2',
    instanceKey: 'new-hero',
    config: { showLeadForm: true }
}

const translate = ((key: string, fallback?: string) => fallback ?? key) as unknown as TFunction

const createOptions = (overrides: Partial<UseLayoutWidgetAuthoringOptions> = {}): UseLayoutWidgetAuthoringOptions => ({
    metahubId: 'metahub-1',
    layoutId: layout.id,
    layout,
    zoneWidgets: [widget],
    widgetObjects: [],
    canManageLayouts: true,
    canEditContent: true,
    isGlobalLayout: false,
    isMarketingOverlay: false,
    locale: 'en',
    t: translate,
    tc: translate,
    notifyError: vi.fn(),
    getExpectedLayoutVersion: () => layout.version,
    getExpectedWidgetVersion: () => widget.version,
    persistAndRefresh: vi.fn(async () => undefined),
    upsertZoneWidgetInCache: vi.fn(),
    onAddWidget: vi.fn(),
    ...overrides
})

describe('useLayoutWidgetAuthoring', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.assignLayoutZoneWidget.mockResolvedValue({ data: createdWidget })
        mocks.duplicateLayoutZoneWidgetPlacement.mockResolvedValue({ data: createdWidget })
        mocks.duplicateLayoutZoneWidgetWithRecordCopy.mockResolvedValue({ data: createdWidget })
        mocks.replaceLayoutZoneWidgetBindings.mockResolvedValue({ data: { widgetKey: 'menuWidget', version: 3 } })
        mocks.updateLayoutZoneWidgetConfig.mockResolvedValue({ data: { item: widget } })
    })

    it('opens the binding editor for an existing entity-backed widget', () => {
        expect(hasMarketingWidgetBindings('marketing.hero')).toBe(true)
        const { result } = renderHook(() => useLayoutWidgetAuthoring(createOptions()))

        act(() => result.current.openWidgetEditor('marketing-main', widget))

        expect(result.current.editors.marketingBinding).toMatchObject({
            open: true,
            widgetId: widget.id,
            sourceWidgetId: widget.id,
            openSelectedRecordOnOpen: false,
            widgetKey: 'marketing.hero'
        })
    })

    it('routes a Dashboard Entity-backed widget through binding authoring before presentation settings', () => {
        const dashboardLayout = { ...layout, templateKey: 'dashboard' as const }
        const dashboardWidget: MetahubLayoutZoneWidget = {
            ...widget,
            layoutId: dashboardLayout.id,
            zone: 'center',
            widgetKey: 'overviewTitle',
            config: { align: 'center', level: 'h2' }
        }
        const { result } = renderHook(() =>
            useLayoutWidgetAuthoring(
                createOptions({
                    layout: dashboardLayout,
                    zoneWidgets: [dashboardWidget],
                    isGlobalLayout: false
                })
            )
        )

        act(() => result.current.openWidgetEditor('center', dashboardWidget))

        expect(result.current.editors.marketingBinding).toMatchObject({
            open: true,
            widgetId: dashboardWidget.id,
            sourceWidgetId: dashboardWidget.id,
            widgetKey: 'overviewTitle',
            config: { align: 'center', level: 'h2' }
        })

        act(() =>
            result.current.dialogs.configureMarketingPresentation({
                bindings: {} as never,
                config: { align: 'center', level: 'h2' }
            })
        )

        expect(result.current.editors.behavior).toMatchObject({
            open: true,
            widgetId: dashboardWidget.id,
            widgetKey: 'overviewTitle',
            config: { align: 'center', level: 'h2' }
        })
    })

    it('opens a selected Dashboard record for content-only users while keeping binding changes permission-gated', () => {
        const dashboardLayout = { ...layout, templateKey: 'dashboard' as const }
        const dashboardWidget: MetahubLayoutZoneWidget = {
            ...widget,
            layoutId: dashboardLayout.id,
            zone: 'center',
            widgetKey: 'overviewTitle',
            config: { align: 'left', level: 'h2' }
        }
        const { result } = renderHook(() =>
            useLayoutWidgetAuthoring(
                createOptions({
                    layout: dashboardLayout,
                    zoneWidgets: [dashboardWidget],
                    canManageLayouts: false,
                    canEditContent: true,
                    isGlobalLayout: false
                })
            )
        )

        act(() => result.current.openWidgetEditor('center', dashboardWidget, { openSelectedRecord: true }))

        expect(result.current.editors.marketingBinding).toMatchObject({
            open: true,
            widgetId: dashboardWidget.id,
            openSelectedRecordOnOpen: true,
            widgetKey: 'overviewTitle'
        })

        const bindingDenied = renderHook(() =>
            useLayoutWidgetAuthoring(
                createOptions({
                    layout: dashboardLayout,
                    zoneWidgets: [dashboardWidget],
                    canManageLayouts: false,
                    canEditContent: true,
                    isGlobalLayout: false
                })
            )
        )
        act(() => bindingDenied.result.current.openWidgetEditor('center', dashboardWidget))
        expect(bindingDenied.result.current.editors.marketingBinding.open).toBe(false)
    })

    it('copies a registered Dashboard single-record binding without a client template key', async () => {
        const dashboardLayout = { ...layout, templateKey: 'dashboard' as const }
        const definition = getLayoutWidgetDefinition('detailsTitle')
        if (!definition) throw new Error('detailsTitle must be registered')

        expect(definition.copyPolicy.binding).toBe('clone-record')
        expect(definition.authoring.metahub).toMatchObject({ duplicate: 'clone-record', contentEditing: 'single-record' })

        const bindings = buildSingleTargetWidgetBinding(definition, 'content', {
            entityKind: 'object',
            entityCodename: 'DashboardContent',
            semanticKey: 'dashboard-title'
        })
        const config = encodeWidgetConfigEnvelope(
            { rendererConfig: { align: 'left', level: 'h2' }, neutral: { bindings } },
            { templateKey: 'dashboard', widgetKey: 'detailsTitle', zone: 'center' }
        )
        const recordCopy = {
            entityId: '0199d5e0-7a10-7000-8000-000000000001',
            recordId: '0199d5e0-7a10-7000-8000-000000000002',
            sourceKey: 'DashboardContent',
            sourceSemanticKey: 'dashboard-title',
            slot: 'content'
        }
        const { result } = renderHook(() => useLayoutWidgetAuthoring(createOptions({ layout: dashboardLayout, zoneWidgets: [] })))

        act(() => result.current.handleAddWidgetRequest('center', 'detailsTitle'))
        expect(result.current.editors.marketingBinding).toMatchObject({ open: true, widgetKey: 'detailsTitle' })

        await act(async () =>
            result.current.dialogs.saveMarketingSelection({
                bindings: {} as never,
                config,
                recordCopy
            })
        )

        expect(mocks.duplicateLayoutZoneWidgetWithRecordCopy).toHaveBeenCalledWith('metahub-1', dashboardLayout.id, {
            zone: 'center',
            widgetKey: 'detailsTitle',
            config,
            expectedVersion: dashboardLayout.version,
            recordCopy
        })
        expect(mocks.duplicateLayoutZoneWidgetWithRecordCopy.mock.calls[0]?.[2]).not.toHaveProperty('templateKey')
        expect(mocks.assignLayoutZoneWidget).not.toHaveBeenCalled()
    })

    it('starts variant-based Dashboard source selection with the registry default', () => {
        const dashboardLayout = { ...layout, templateKey: 'dashboard' as const }
        const { result } = renderHook(() => useLayoutWidgetAuthoring(createOptions({ layout: dashboardLayout, zoneWidgets: [] })))

        act(() => result.current.handleAddWidgetRequest('center', 'detailsTable'))

        expect(result.current.editors.marketingBinding).toMatchObject({
            open: true,
            widgetKey: 'detailsTable',
            config: { variant: 'records' }
        })
    })

    it('keeps the selected parent and slot through Entity binding authoring for a nested add', async () => {
        const dashboardLayout = { ...layout, templateKey: 'dashboard' as const }
        const target = { parentInstanceKey: 'columns-instance', slotKey: 'column:main' }
        const options = createOptions({ layout: dashboardLayout, zoneWidgets: [] })
        const { result } = renderHook(() => useLayoutWidgetAuthoring(options))

        act(() => result.current.handleAddWidgetRequest('center', 'overviewTitle', target))
        expect(result.current.editors.marketingBinding).toMatchObject({ open: true, zone: 'center', widgetKey: 'overviewTitle' })

        await act(async () =>
            result.current.dialogs.saveMarketingSelection({
                bindings: {} as never,
                config: { align: 'left', level: 'h2' }
            })
        )

        expect(mocks.assignLayoutZoneWidget).toHaveBeenCalledWith('metahub-1', dashboardLayout.id, {
            zone: 'center',
            widgetKey: 'overviewTitle',
            config: { align: 'left', level: 'h2' },
            ...target,
            expectedVersion: dashboardLayout.version
        })
    })

    it('duplicates Dashboard placements through registry subtree copy policies', async () => {
        const dashboardLayout = { ...layout, templateKey: 'dashboard' as const }
        const dashboardWidget: MetahubLayoutZoneWidget = {
            ...widget,
            layoutId: dashboardLayout.id,
            zone: 'center',
            widgetKey: 'detailsTable',
            instanceKey: 'details-table-instance',
            parentInstanceKey: 'columns-instance',
            slotKey: 'column:main',
            version: 7,
            config: { variant: 'records' }
        }
        const { result } = renderHook(() =>
            useLayoutWidgetAuthoring(
                createOptions({
                    layout: dashboardLayout,
                    zoneWidgets: [dashboardWidget],
                    getExpectedWidgetVersion: (widgetId) => (widgetId === dashboardWidget.id ? dashboardWidget.version : 0)
                })
            )
        )

        await act(async () => result.current.handleDuplicateWidget(dashboardWidget))

        expect(mocks.duplicateLayoutZoneWidgetPlacement).toHaveBeenCalledWith('metahub-1', dashboardLayout.id, {
            widgetId: dashboardWidget.id,
            expectedVersion: dashboardWidget.version,
            expectedLayoutVersion: dashboardLayout.version
        })
        expect(mocks.duplicateLayoutZoneWidgetWithRecordCopy).not.toHaveBeenCalled()
    })

    it('saves generated Dashboard navigation without Entity bindings', async () => {
        const dashboardLayout = { ...layout, templateKey: 'dashboard' as const }
        const generatedMenu: MetahubLayoutZoneWidget = {
            ...widget,
            layoutId: dashboardLayout.id,
            zone: 'left',
            widgetKey: 'menuWidget',
            config: { variant: 'manual' }
        }
        const options = createOptions({ layout: dashboardLayout, zoneWidgets: [generatedMenu] })
        const { result } = renderHook(() => useLayoutWidgetAuthoring(options))

        act(() => result.current.openWidgetEditor('left', generatedMenu))
        await act(async () => result.current.dialogs.saveMenu({ variant: 'generated' }))

        expect(mocks.replaceLayoutZoneWidgetBindings).toHaveBeenCalledWith('metahub-1', dashboardLayout.id, generatedMenu.id, {
            expectedVersion: widget.version,
            bindings: [],
            rendererConfig: { variant: 'generated' },
            locale: 'en'
        })
        expect(result.current.editors.marketingBinding.open).toBe(false)
        expect(options.persistAndRefresh).toHaveBeenCalledOnce()
    })

    it('continues manual Dashboard navigation from the menu editor into the shared binding dialog', async () => {
        const dashboardLayout = { ...layout, templateKey: 'dashboard' as const }
        const options = createOptions({ layout: dashboardLayout, zoneWidgets: [] })
        const { result } = renderHook(() => useLayoutWidgetAuthoring(options))

        act(() => result.current.handleAddWidgetRequest('left', 'menuWidget'))
        expect(result.current.editors.menu.open).toBe(true)

        await act(async () => result.current.dialogs.saveMenu({ variant: 'manual' }))

        expect(mocks.assignLayoutZoneWidget).not.toHaveBeenCalled()
        expect(result.current.editors.marketingBinding).toMatchObject({
            open: true,
            zone: 'left',
            widgetId: null,
            sourceWidgetId: null,
            widgetKey: 'menuWidget',
            config: { variant: 'manual' }
        })
    })

    it('carries edited existing manual navigation config into the binding save', async () => {
        const dashboardLayout = { ...layout, templateKey: 'dashboard' as const }
        const manualMenu: MetahubLayoutZoneWidget = {
            ...widget,
            layoutId: dashboardLayout.id,
            zone: 'left',
            widgetKey: 'menuWidget',
            config: { variant: 'manual' }
        }
        const { result } = renderHook(() => useLayoutWidgetAuthoring(createOptions({ layout: dashboardLayout, zoneWidgets: [manualMenu] })))

        act(() => result.current.openWidgetEditor('left', manualMenu))
        await act(async () => result.current.dialogs.saveMenu({ variant: 'manual' }))

        expect(result.current.editors.marketingBinding).toMatchObject({
            open: true,
            widgetId: manualMenu.id,
            widgetKey: 'menuWidget',
            rendererConfigPending: true,
            config: { variant: 'manual' }
        })
    })

    it('preserves Dashboard bindings in the flat envelope when presentation settings are saved', async () => {
        const dashboardLayout = { ...layout, templateKey: 'dashboard' as const }
        const bindings: WidgetEntityBindingEnvelope = {
            version: 1,
            slots: [
                {
                    slot: 'content',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'DashboardOverviewTitle',
                            selector: { kind: 'semantic-key', field: 'key', value: 'overview.primary' },
                            projection: [
                                { field: 'key', componentCodename: 'Key' },
                                { field: 'title', componentCodename: 'Title' },
                                { field: 'body', componentCodename: 'Body' }
                            ]
                        }
                    ]
                }
            ]
        }
        const dashboardWidget: MetahubLayoutZoneWidget = {
            ...widget,
            layoutId: dashboardLayout.id,
            zone: 'center',
            widgetKey: 'overviewTitle',
            config: encodeWidgetConfigEnvelope(
                { rendererConfig: { align: 'left', level: 'h2' }, neutral: { bindings } },
                { templateKey: 'dashboard', widgetKey: 'overviewTitle', zone: 'center' }
            )
        }
        const { result } = renderHook(() =>
            useLayoutWidgetAuthoring(createOptions({ layout: dashboardLayout, zoneWidgets: [dashboardWidget] }))
        )

        act(() => result.current.openWidgetEditor('center', dashboardWidget))
        act(() => result.current.dialogs.configureMarketingPresentation({ bindings, config: dashboardWidget.config }))
        await act(async () => result.current.dialogs.saveBehavior({ align: 'right', level: 'h3' }))

        const persistedConfig = mocks.updateLayoutZoneWidgetConfig.mock.calls.at(-1)?.[3]
        expect(persistedConfig).toEqual({
            align: 'right',
            level: 'h3',
            [RESERVED_LAYOUT_METADATA_KEY]: dashboardWidget.config[RESERVED_LAYOUT_METADATA_KEY]
        })
        expect(persistedConfig).not.toHaveProperty('rendererConfig')
    })

    it('does not open an empty editor when a host widget has no presentation fields', () => {
        const dashboardLayout = { ...layout, templateKey: 'dashboard' as const }
        const hostWidget: MetahubLayoutZoneWidget = {
            ...widget,
            layoutId: dashboardLayout.id,
            zone: 'top',
            widgetKey: 'languageSwitcher',
            config: {}
        }
        const { result } = renderHook(() =>
            useLayoutWidgetAuthoring(
                createOptions({
                    layout: dashboardLayout,
                    zoneWidgets: [hostWidget],
                    isGlobalLayout: false
                })
            )
        )

        act(() => result.current.openWidgetEditor('top', hostWidget))

        expect(result.current.editors.behavior.open).toBe(false)
    })

    it('opens the selected Hero Entity record directly while retaining the binding editor state', () => {
        const { result } = renderHook(() => useLayoutWidgetAuthoring(createOptions()))

        act(() => result.current.openWidgetEditor('marketing-main', widget, { openSelectedRecord: true }))

        expect(result.current.editors.marketingBinding).toMatchObject({
            open: true,
            widgetId: widget.id,
            openSelectedRecordOnOpen: true,
            widgetKey: 'marketing.hero'
        })
    })

    it('keeps content authorization and overlay restrictions on Marketing authoring actions', () => {
        const denied = renderHook(() => useLayoutWidgetAuthoring(createOptions({ canEditContent: false })))
        act(() => denied.result.current.openWidgetEditor('marketing-main', widget))
        expect(denied.result.current.editors.marketingBinding.open).toBe(false)

        const definition = getLayoutWidgetDefinition('marketing.hero')
        if (!definition) throw new Error('MARKETING_HERO_WIDGET_DEFINITION_MISSING')
        const overlay = renderHook(() =>
            useLayoutWidgetAuthoring(
                createOptions({
                    isMarketingOverlay: true,
                    widgetObjects: [definition]
                })
            )
        )

        expect(overlay.result.current.getAvailableWidgetsForZone('marketing-main')).toEqual([])
        act(() => overlay.result.current.handleAddWidgetRequest('marketing-main', 'marketing.hero'))
        expect(overlay.result.current.editors.marketing.open).toBe(false)
    })

    it('updates existing Marketing presentation with the expected widget version', async () => {
        const { result } = renderHook(() => useLayoutWidgetAuthoring(createOptions()))
        const rendererConfig = { showLeadForm: false }

        act(() => result.current.openWidgetEditor('marketing-main', widget))
        act(() =>
            result.current.dialogs.configureMarketingPresentation({
                bindings: {} as never,
                config: encodeWidgetConfigEnvelope({ rendererConfig, neutral: {} })
            })
        )
        expect(result.current.editors.marketing).toMatchObject({ open: true, widgetId: widget.id, config: rendererConfig })

        await act(async () => result.current.dialogs.saveMarketingConfig(rendererConfig))

        expect(mocks.updateLayoutZoneWidgetConfig).toHaveBeenCalledWith('metahub-1', layout.id, widget.id, rendererConfig, widget.version)
        expect(result.current.editors.marketing.open).toBe(false)
    })

    it('turns a new marketing widget selection into a persisted placement', async () => {
        const options = createOptions()
        const { result } = renderHook(() => useLayoutWidgetAuthoring(options))

        act(() => result.current.handleAddWidgetRequest('marketing-main', 'marketing.hero'))
        expect(result.current.editors.marketing.open).toBe(true)

        await act(async () => {
            await result.current.dialogs.saveMarketingConfig({})
        })

        expect(result.current.editors.marketingBinding).toMatchObject({
            open: true,
            widgetId: null,
            sourceWidgetId: widget.id,
            duplicateMode: false,
            widgetKey: 'marketing.hero'
        })

        await act(async () => {
            await result.current.dialogs.saveMarketingSelection({ bindings: {} as never, config: createdWidget.config })
        })

        expect(mocks.assignLayoutZoneWidget).toHaveBeenCalledWith('metahub-1', layout.id, {
            zone: 'marketing-main',
            widgetKey: 'marketing.hero',
            config: createdWidget.config,
            expectedVersion: layout.version
        })
        expect(options.upsertZoneWidgetInCache).toHaveBeenCalledWith(createdWidget)
        expect(options.persistAndRefresh).toHaveBeenCalledOnce()
        expect(result.current.editors.marketingBinding.open).toBe(false)
        expect(options.notifyError).not.toHaveBeenCalled()
    })

    it('creates an entity-record copy and its placement through one atomic API request', async () => {
        const options = createOptions()
        const { result } = renderHook(() => useLayoutWidgetAuthoring(options))

        act(() => result.current.handleAddWidgetRequest('marketing-main', 'marketing.hero'))
        await act(async () => {
            await result.current.dialogs.saveMarketingConfig({})
        })

        const recordCopy = {
            entityId: '0199d5e0-7a10-7000-8000-000000000001',
            recordId: '0199d5e0-7a10-7000-8000-000000000002',
            sourceKey: 'marketing-content',
            sourceSemanticKey: 'hero.primary',
            slot: 'hero'
        }
        await act(async () => {
            await result.current.dialogs.saveMarketingSelection({
                bindings: {} as never,
                config: createdWidget.config,
                recordCopy
            })
        })

        expect(mocks.duplicateLayoutZoneWidgetWithRecordCopy).toHaveBeenCalledWith('metahub-1', layout.id, {
            zone: 'marketing-main',
            widgetKey: 'marketing.hero',
            config: createdWidget.config,
            expectedVersion: layout.version,
            recordCopy
        })
        expect(mocks.assignLayoutZoneWidget).not.toHaveBeenCalled()
        expect(options.upsertZoneWidgetInCache).toHaveBeenCalledWith(createdWidget)
        expect(options.persistAndRefresh).toHaveBeenCalledOnce()
        expect(result.current.editors.marketingBinding.open).toBe(false)
        expect(options.notifyError).not.toHaveBeenCalled()
    })

    it('routes Marketing widget duplication through the atomic record-copy placement flow', async () => {
        const options = createOptions()
        const { result } = renderHook(() => useLayoutWidgetAuthoring(options))

        await act(async () => result.current.handleDuplicateWidget(widget))

        expect(result.current.editors.marketingBinding).toMatchObject({
            open: true,
            widgetId: null,
            sourceWidgetId: widget.id,
            duplicateMode: true,
            widgetKey: widget.widgetKey,
            config: { showLeadForm: true }
        })

        const duplicateConfig = { showLeadForm: true }
        const recordCopy = {
            entityId: '0199d5e0-7a10-7000-8000-000000000001',
            recordId: '0199d5e0-7a10-7000-8000-000000000002',
            sourceKey: 'marketing-content',
            sourceSemanticKey: 'hero.primary',
            slot: 'hero'
        }
        await act(async () => {
            await result.current.dialogs.saveMarketingSelection({
                bindings: {} as never,
                config: duplicateConfig,
                recordCopy
            })
        })

        expect(mocks.duplicateLayoutZoneWidgetWithRecordCopy).toHaveBeenCalledWith('metahub-1', layout.id, {
            zone: widget.zone,
            widgetKey: widget.widgetKey,
            config: duplicateConfig,
            expectedVersion: layout.version,
            recordCopy
        })
        expect(mocks.assignLayoutZoneWidget).not.toHaveBeenCalled()
    })

    it('keeps the binding dialog open and propagates placement failures for correction', async () => {
        const options = createOptions()
        const { result } = renderHook(() => useLayoutWidgetAuthoring(options))
        const placementError = new Error('placement failed')
        mocks.assignLayoutZoneWidget.mockRejectedValueOnce(placementError)

        act(() => result.current.handleAddWidgetRequest('marketing-main', 'marketing.hero'))
        await act(async () => result.current.dialogs.saveMarketingConfig({}))

        let caughtError: unknown
        await act(async () => {
            try {
                await result.current.dialogs.saveMarketingSelection({ bindings: {} as never, config: createdWidget.config })
            } catch (error: unknown) {
                caughtError = error
            }
        })

        expect(caughtError).toBe(placementError)
        expect(options.notifyError).toHaveBeenCalledWith(placementError)
        expect(options.upsertZoneWidgetInCache).not.toHaveBeenCalled()
        expect(options.persistAndRefresh).not.toHaveBeenCalled()
        expect(result.current.editors.marketingBinding.open).toBe(true)
    })
})
