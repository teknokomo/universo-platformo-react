import { act, renderHook } from '@testing-library/react'
import type { TFunction } from 'i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeWidgetConfigEnvelope, getLayoutWidgetDefinition } from '@universo-react/types'

import type { MetahubLayout, MetahubLayoutZoneWidget } from '../../../../types'
import type { UseLayoutWidgetAuthoringOptions } from '../useLayoutWidgetAuthoring'

const mocks = vi.hoisted(() => ({
    assignLayoutZoneWidget: vi.fn(),
    duplicateLayoutZoneWidgetWithRecordCopy: vi.fn(),
    updateLayoutZoneWidgetConfig: vi.fn()
}))

vi.mock('../../api', () => ({
    assignLayoutZoneWidget: mocks.assignLayoutZoneWidget,
    duplicateLayoutZoneWidgetWithRecordCopy: mocks.duplicateLayoutZoneWidgetWithRecordCopy,
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
    sortOrder: 0,
    config: { instanceKey: 'hero-instance', title: 'Existing title' },
    isActive: true,
    version: 2,
    createdAt: '2026-09-29T00:00:00.000Z',
    updatedAt: '2026-09-29T00:00:00.000Z'
}

const createdWidget: MetahubLayoutZoneWidget = {
    ...widget,
    id: 'widget-2',
    config: { instanceKey: 'new-hero', title: 'New title' }
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
        mocks.duplicateLayoutZoneWidgetWithRecordCopy.mockResolvedValue({ data: createdWidget })
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
        const rendererConfig = { instanceKey: 'hero-instance', showLeadForm: false }

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
            config: { title: 'Existing title' }
        })

        const duplicateConfig = { instanceKey: 'hero-copy', title: 'Existing title' }
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
