import { act, renderHook } from '@testing-library/react'
import type { TFunction } from 'i18next'
import { describe, expect, it, vi } from 'vitest'

import type { MetahubLayout, MetahubLayoutZoneWidget } from '../../../../types'
import type { LayoutWidgetAuthoringResult } from '../useLayoutWidgetAuthoring'
import { useLayoutAuthoringZones } from '../useLayoutAuthoringZones'

const translate = ((key: string, fallback?: string) => fallback ?? key) as unknown as TFunction

const layout: MetahubLayout = {
    id: 'layout-dashboard',
    templateKey: 'dashboard',
    name: { _schema: '1', _primary: 'en', locales: {} },
    config: {},
    isActive: true,
    isDefault: true,
    sortOrder: 0,
    version: 1,
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z'
}

const makeWidget = (overrides: Partial<MetahubLayoutZoneWidget> = {}): MetahubLayoutZoneWidget => ({
    id: 'widget-1',
    layoutId: layout.id,
    zone: 'center',
    widgetKey: 'overviewTitle',
    instanceKey: 'overview-title-1',
    parentInstanceKey: null,
    slotKey: null,
    sortOrder: 0,
    config: { align: 'left', level: 'h2' },
    isActive: true,
    version: 1,
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    ...overrides
})

const makeBoundWidget = (): MetahubLayoutZoneWidget => makeWidget({ config: { align: 'left', level: 'h2' } })

const makeAuthoring = (openWidgetEditor = vi.fn()): LayoutWidgetAuthoringResult =>
    ({
        templateKey: 'dashboard',
        getAvailableWidgetsForZone: vi.fn(() => []),
        getWidgetChipLabel: vi.fn(() => 'Overview title'),
        handleDuplicateWidget: vi.fn(async () => undefined),
        openWidgetEditor,
        widgetLabelByKey: { overviewTitle: 'Overview title', languageSwitcher: 'Language switcher' }
    } as unknown as LayoutWidgetAuthoringResult)

const renderZones = (
    widget: MetahubLayoutZoneWidget,
    canEditContent: boolean,
    authoring = makeAuthoring(),
    isGlobalLayout = false,
    canManageLayouts = true,
    dashboardContentBindingIds: ReadonlySet<string> = new Set()
) =>
    renderHook(() =>
        useLayoutAuthoringZones({
            metahubId: 'metahub-1',
            layoutId: layout.id,
            layout,
            layoutZones: [widget.zone],
            zoneToItems: { [widget.zone]: [widget] } as never,
            zoneWidgets: [widget],
            authoring,
            canManageLayouts,
            canEditContent,
            dashboardContentBindingIds,
            isGlobalLayout,
            t: translate,
            tc: translate,
            persistAndRefresh: vi.fn(async () => undefined),
            notifyError: vi.fn(),
            requestRemoveWidget: vi.fn(),
            handleResetWidgetOverride: vi.fn(async () => undefined),
            handleToggleWidgetActive: vi.fn(async () => undefined),
            marketingHeaderSetting: { available: false, inherited: false },
            onOpenMarketingHeaderSettings: vi.fn()
        })
    )

describe('useLayoutAuthoringZones Dashboard registry authoring', () => {
    it('keeps nested placements out of the flat zone list and exposes their row metadata separately', () => {
        const container = makeWidget({
            id: 'container-id',
            widgetKey: 'columnsContainer',
            instanceKey: 'columns-instance',
            config: { columns: [{ slotKey: 'column:main', width: 12 }] }
        })
        const child = makeWidget({
            id: 'child-id',
            widgetKey: 'overviewTitle',
            instanceKey: 'overview-instance',
            parentInstanceKey: container.instanceKey,
            slotKey: 'column:main'
        })
        const { result } = renderHook(() =>
            useLayoutAuthoringZones({
                metahubId: 'metahub-1',
                layoutId: layout.id,
                layout,
                layoutZones: ['center'],
                zoneToItems: { center: [container, child] } as never,
                zoneWidgets: [container, child],
                authoring: makeAuthoring(),
                canManageLayouts: true,
                canEditContent: true,
                dashboardContentBindingIds: new Set(),
                isGlobalLayout: false,
                t: translate,
                tc: translate,
                persistAndRefresh: vi.fn(async () => undefined),
                notifyError: vi.fn(),
                requestRemoveWidget: vi.fn(),
                handleResetWidgetOverride: vi.fn(async () => undefined),
                handleToggleWidgetActive: vi.fn(async () => undefined),
                marketingHeaderSetting: { available: false, inherited: false },
                onOpenMarketingHeaderSettings: vi.fn()
            })
        )

        expect(result.current.zones[0]?.items.map(({ id }) => id)).toEqual([container.id])
        expect(result.current.nestedPlacements).toHaveLength(1)
        expect(result.current.nestedPlacements[0]).toMatchObject({ placement: child, row: { id: child.id, label: 'Overview title' } })
    })

    it('exposes rebind, content, and clone-record actions from the registry policy', () => {
        const openWidgetEditor = vi.fn()
        const authoring = makeAuthoring(openWidgetEditor)
        const { result } = renderZones(makeBoundWidget(), true, authoring, false, true, new Set(['widget-1']))
        const item = result.current.zones[0]?.items[0]

        expect(item?.onEdit).toBeTypeOf('function')
        expect(item?.onEditContent).toBeTypeOf('function')
        expect(item?.onDuplicate).toBeTypeOf('function')

        act(() => item?.onEditContent?.())
        expect(openWidgetEditor).toHaveBeenCalledWith('center', expect.objectContaining({ widgetKey: 'overviewTitle' }), {
            openSelectedRecord: true
        })
    })

    it('shows the content action only for a persisted single-record binding and opens it without layout-management permission', () => {
        const openWidgetEditor = vi.fn()
        const authoring = makeAuthoring(openWidgetEditor)
        const unbound = renderZones(makeWidget(), true, authoring, false, false)
        expect(unbound.result.current.zones[0]?.items[0]?.onEditContent).toBeUndefined()

        const contentOnly = renderZones(makeBoundWidget(), true, authoring, false, false, new Set(['widget-1']))
        const item = contentOnly.result.current.zones[0]?.items[0]

        expect(item?.onEdit).toBeUndefined()
        expect(item?.onEditContent).toBeTypeOf('function')
        act(() => item?.onEditContent?.())
        expect(openWidgetEditor).toHaveBeenCalledWith('center', expect.objectContaining({ widgetKey: 'overviewTitle' }), {
            openSelectedRecord: true
        })
    })

    it('keeps rebind available while hiding content mutation and clone-record duplication without content permission', () => {
        const { result } = renderZones(makeWidget(), false)
        const item = result.current.zones[0]?.items[0]

        expect(item?.onEdit).toBeTypeOf('function')
        expect(item?.onEditContent).toBeUndefined()
        expect(item?.onDuplicate).toBeUndefined()
    })

    it('does not expose duplicate/content actions for a host Dashboard widget whose registry policy forbids them', () => {
        const hostWidget = makeWidget({
            widgetKey: 'languageSwitcher',
            zone: 'top',
            config: {},
            instanceKey: 'language-switcher-1'
        })
        const { result } = renderZones(hostWidget, true)
        const item = result.current.zones[0]?.items[0]

        expect(item?.onDuplicate).toBeUndefined()
        expect(item?.onEditContent).toBeUndefined()
    })

    it('does not open presentation settings for a global widget without registered fields', () => {
        const hostWidget = makeWidget({
            widgetKey: 'languageSwitcher',
            zone: 'top',
            config: {},
            instanceKey: 'language-switcher-1'
        })
        const { result } = renderZones(hostWidget, true, makeAuthoring(), true)

        expect(result.current.zones[0]?.items[0]?.onClick).toBeUndefined()
    })

    it('uses registry placement overrides for inherited actions and ignores renderer sharedBehavior', () => {
        const lockedWidget = makeWidget({
            widgetKey: 'header',
            zone: 'top',
            isInherited: true,
            config: { sharedBehavior: { canDeactivate: true, canExclude: true, positionLocked: false } }
        })
        const { result: lockedResult } = renderZones(lockedWidget, true)
        const lockedItem = lockedResult.current.zones[0]?.items[0]

        expect(lockedItem?.draggable).toBe(false)
        expect(lockedItem?.onToggleActive).toBeUndefined()
        expect(lockedItem?.onRemove).toBeUndefined()
        expect(lockedItem?.moveActions).toEqual([])

        const structuralWidget = makeWidget({
            widgetKey: 'divider',
            zone: 'right',
            isInherited: true,
            config: { orientation: 'horizontal', sharedBehavior: { canDeactivate: false, canExclude: true, positionLocked: true } }
        })
        const { result: structuralResult } = renderZones(structuralWidget, true)
        const structuralItem = structuralResult.current.zones[0]?.items[0]

        expect(structuralItem?.draggable).toBe(true)
        expect(structuralItem?.onToggleActive).toBeTypeOf('function')
        expect(structuralItem?.onRemove).toBeUndefined()
        expect(structuralItem?.moveActions).toEqual([])

        const flexibleWidget = makeWidget({
            widgetKey: 'menuWidget',
            zone: 'left',
            isInherited: true,
            config: { sharedBehavior: { canDeactivate: false, canExclude: false, positionLocked: true } }
        })
        const { result: flexibleResult } = renderZones(flexibleWidget, true)
        const flexibleItem = flexibleResult.current.zones[0]?.items[0]

        expect(flexibleItem?.draggable).toBe(true)
        expect(flexibleItem?.onToggleActive).toBeTypeOf('function')
        expect(flexibleItem?.onRemove).toBeTypeOf('function')
    })
})
