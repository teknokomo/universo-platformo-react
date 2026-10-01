import { useCallback, useMemo, useState } from 'react'
import type {
    ApplicationLayoutWidgetKey,
    ApplicationLayoutZone,
    ColumnsContainerConfig,
    DashboardLayoutZone,
    InterpretationNetworkWorkspaceWidgetConfig,
    MenuWidgetConfig,
    QuizWidgetConfig
} from '@universo-react/types'
import {
    DASHBOARD_LAYOUT_ZONES,
    getLayoutWidgetAllowedZones,
    getLayoutWidgetDefinition,
    getMarketingActionSectionTargets
} from '@universo-react/types'
import type { TFunction } from 'i18next'

import type { DashboardLayoutWidgetItem, MetahubLayout, MetahubLayoutZoneWidget } from '../../../types'
import { getVLCString } from '../../../types'
import * as layoutsApi from '../api'
import type { MarketingWidgetBindingDialogProps } from './marketingWidgetBindingDialogModel'
import {
    isMarketingWidgetKey,
    type ColumnsEditorState,
    type InterpretationNetworkEditorState,
    type MarketingWidgetBindingEditorState,
    type MarketingWidgetEditorState,
    type MenuEditorState,
    type PlayCanvasCanvasEditorState,
    type QuizEditorState,
    type WidgetBehaviorEditorState
} from './layoutDetailsWidgetAuthoringModel'
import { useMarketingLayoutWidgetAuthoring } from './useMarketingLayoutWidgetAuthoring'

type NotifyAuthoringError = (error: unknown) => void

export interface UseLayoutWidgetAuthoringOptions {
    metahubId?: string
    layoutId?: string
    layout?: MetahubLayout
    zoneWidgets: MetahubLayoutZoneWidget[]
    widgetObjects: DashboardLayoutWidgetItem[]
    canManageLayouts: boolean
    canEditContent: boolean
    isGlobalLayout: boolean
    isMarketingOverlay: boolean
    locale: string
    t: TFunction
    tc: TFunction
    notifyError: NotifyAuthoringError
    getExpectedLayoutVersion: () => number
    getExpectedWidgetVersion: (widgetId: string | null) => number
    persistAndRefresh: () => Promise<void>
    upsertZoneWidgetInCache: (widget: MetahubLayoutZoneWidget) => void
    onAddWidget: (zone: ApplicationLayoutZone, widgetKey: ApplicationLayoutWidgetKey) => void
}

export interface LayoutWidgetAuthoringResult {
    editors: {
        menu: MenuEditorState
        columns: ColumnsEditorState
        quiz: QuizEditorState
        playCanvas: PlayCanvasCanvasEditorState
        interpretationNetwork: InterpretationNetworkEditorState
        behavior: WidgetBehaviorEditorState
        marketing: MarketingWidgetEditorState
        marketingBinding: MarketingWidgetBindingEditorState
    }
    widgetLabelByKey: Record<string, string>
    sectionTargets: ReturnType<typeof getMarketingActionSectionTargets>
    openWidgetEditor: (zone: ApplicationLayoutZone, item: MetahubLayoutZoneWidget, options?: { openSelectedRecord?: boolean }) => void
    getWidgetChipLabel: (widget: MetahubLayoutZoneWidget) => string
    getAvailableWidgetsForZone: (zone: ApplicationLayoutZone) => DashboardLayoutWidgetItem[]
    handleAddWidgetRequest: (zone: ApplicationLayoutZone, widgetKey: ApplicationLayoutWidgetKey) => void
    handleDuplicateWidget: (item: MetahubLayoutZoneWidget) => Promise<void>
    dialogs: {
        saveMenu: (config: MenuWidgetConfig) => Promise<void>
        closeMenu: () => void
        saveColumns: (config: ColumnsContainerConfig) => Promise<void>
        closeColumns: () => void
        saveQuiz: (config: QuizWidgetConfig) => Promise<void>
        closeQuiz: () => void
        savePlayCanvas: (config: Record<string, unknown>) => Promise<void>
        closePlayCanvas: () => void
        saveInterpretationNetwork: (config: InterpretationNetworkWorkspaceWidgetConfig) => Promise<void>
        closeInterpretationNetwork: () => void
        saveBehavior: (config: Record<string, unknown>) => Promise<void>
        closeBehavior: () => void
        closeMarketingBinding: () => void
        saveMarketingSelection: MarketingWidgetBindingDialogProps['onSelection']
        configureMarketingPresentation: NonNullable<MarketingWidgetBindingDialogProps['onConfigurePresentation']>
        saveMarketingConfig: (config: Record<string, unknown>) => Promise<void>
        closeMarketingConfig: () => void
        onBindingSaved: () => Promise<void>
    }
}

const initialMenuEditor: MenuEditorState = { open: false, zone: null, widgetId: null, config: null }
const initialColumnsEditor: ColumnsEditorState = { open: false, zone: null, widgetId: null, config: null }
const initialQuizEditor: QuizEditorState = { open: false, zone: null, widgetId: null, config: null }
const initialPlayCanvasEditor: PlayCanvasCanvasEditorState = { open: false, zone: null, widgetId: null, config: null }
const initialInterpretationNetworkEditor: InterpretationNetworkEditorState = { open: false, widgetId: null, config: null }
const initialWidgetBehaviorEditor: WidgetBehaviorEditorState = { open: false, widgetId: null, widgetLabel: null, config: null }

/** Owns widget-editor state, authoring actions, and widget mutations for LayoutDetails. */
export function useLayoutWidgetAuthoring({
    metahubId,
    layoutId,
    layout,
    zoneWidgets,
    widgetObjects,
    canManageLayouts,
    canEditContent,
    isGlobalLayout,
    isMarketingOverlay,
    locale,
    t,
    tc,
    notifyError,
    getExpectedLayoutVersion,
    getExpectedWidgetVersion,
    persistAndRefresh,
    upsertZoneWidgetInCache,
    onAddWidget
}: UseLayoutWidgetAuthoringOptions): LayoutWidgetAuthoringResult {
    const [menuEditor, setMenuEditor] = useState<MenuEditorState>(initialMenuEditor)
    const [columnsEditor, setColumnsEditor] = useState<ColumnsEditorState>(initialColumnsEditor)
    const [quizEditor, setQuizEditor] = useState<QuizEditorState>(initialQuizEditor)
    const [playCanvasEditor, setPlayCanvasEditor] = useState<PlayCanvasCanvasEditorState>(initialPlayCanvasEditor)
    const [interpretationNetworkEditor, setInterpretationNetworkEditor] =
        useState<InterpretationNetworkEditorState>(initialInterpretationNetworkEditor)
    const [widgetBehaviorEditor, setWidgetBehaviorEditor] = useState<WidgetBehaviorEditorState>(initialWidgetBehaviorEditor)

    const marketingAuthoring = useMarketingLayoutWidgetAuthoring({
        metahubId,
        layoutId,
        zoneWidgets,
        canEditContent,
        isMarketingOverlay,
        t,
        notifyError,
        getExpectedLayoutVersion,
        getExpectedWidgetVersion,
        persistAndRefresh,
        upsertZoneWidgetInCache
    })
    const {
        editors: marketingEditors,
        sectionTargets,
        canShowWidget: canShowMarketingWidget,
        getWidgetChipLabel: getMarketingWidgetChipLabel,
        openWidgetEditor: openMarketingWidgetEditor,
        handleAddWidgetRequest: handleMarketingAddWidgetRequest,
        handleDuplicateWidget: handleMarketingWidgetDuplicate,
        closeBinding: closeMarketingBinding,
        saveSelection: saveMarketingSelection,
        configurePresentation: configureMarketingPresentation,
        saveConfig: saveMarketingConfig,
        closeConfig: closeMarketingConfig
    } = marketingAuthoring

    const widgetLabelByKey = useMemo(() => {
        const labels: Record<string, string> = {}
        for (const item of widgetObjects) {
            labels[item.key] = tc(
                item.labelKey ?? `layouts.widgets.${item.key}`,
                item.defaultLabel ?? tc('layouts.widgets.unknown', 'Widget')
            )
        }
        return labels
    }, [tc, widgetObjects])

    const openWidgetEditor = useCallback(
        (zone: ApplicationLayoutZone, item: MetahubLayoutZoneWidget, options?: { openSelectedRecord?: boolean }) => {
            if (openMarketingWidgetEditor(zone, item, options)) return
            if (item.isInherited || !DASHBOARD_LAYOUT_ZONES.includes(zone as DashboardLayoutZone)) return
            const dashboardZone = zone as DashboardLayoutZone
            if (item.widgetKey === 'menuWidget') {
                setMenuEditor({
                    open: true,
                    zone: dashboardZone,
                    widgetId: item.id,
                    config: item.config as unknown as MenuWidgetConfig
                })
            } else if (item.widgetKey === 'columnsContainer') {
                setColumnsEditor({
                    open: true,
                    zone: dashboardZone,
                    widgetId: item.id,
                    config: item.config as unknown as ColumnsContainerConfig
                })
            } else if (item.widgetKey === 'quizWidget') {
                setQuizEditor({ open: true, zone: dashboardZone, widgetId: item.id, config: item.config as QuizWidgetConfig })
            } else if (item.widgetKey === 'playcanvasCanvas') {
                setPlayCanvasEditor({
                    open: true,
                    zone: dashboardZone,
                    widgetId: item.id,
                    config: item.config && typeof item.config === 'object' && !Array.isArray(item.config) ? { ...item.config } : {}
                })
            } else if (item.widgetKey === 'interpretationNetworkWorkspace') {
                setInterpretationNetworkEditor({
                    open: true,
                    widgetId: item.id,
                    config: item.config as InterpretationNetworkWorkspaceWidgetConfig
                })
            } else if (isGlobalLayout) {
                setWidgetBehaviorEditor({
                    open: true,
                    widgetId: item.id,
                    widgetLabel: widgetLabelByKey[item.widgetKey] ?? tc('layouts.widgets.unknown', 'Widget'),
                    config: item.config && typeof item.config === 'object' && !Array.isArray(item.config) ? { ...item.config } : {}
                })
            }
        },
        [isGlobalLayout, openMarketingWidgetEditor, tc, widgetLabelByKey]
    )

    const getWidgetChipLabel = useCallback(
        (widget: MetahubLayoutZoneWidget): string => {
            const base = widgetLabelByKey[widget.widgetKey] || tc('layouts.widgets.unknown', 'Widget')
            const marketingLabel = getMarketingWidgetChipLabel(widget, base)
            if (marketingLabel !== undefined) return marketingLabel
            if (widget.widgetKey === 'menuWidget') {
                const config = widget.config as unknown as MenuWidgetConfig | undefined
                const title = config?.title ? getVLCString(config.title, locale) || getVLCString(config.title, 'en') : ''
                return title ? `${base}: ${title}` : base
            }
            if (widget.widgetKey === 'columnsContainer') {
                const config = widget.config as unknown as ColumnsContainerConfig | undefined
                if (!config?.columns?.length) return base
                const innerNames = config.columns
                    .flatMap((column) =>
                        (column.widgets ?? []).map((item) => widgetLabelByKey[item.widgetKey] || tc('layouts.widgets.unknown', 'Widget'))
                    )
                    .join(', ')
                return `${base}: ${innerNames}`
            }
            return base
        },
        [getMarketingWidgetChipLabel, locale, tc, widgetLabelByKey]
    )

    const getAvailableWidgetsForZone = useCallback(
        (zone: ApplicationLayoutZone): DashboardLayoutWidgetItem[] => {
            return widgetObjects.filter((widgetItem) => {
                const templateKey = layout?.templateKey
                if (!templateKey) return false
                const supportedTemplates = Array.isArray(widgetItem.supportedTemplates) ? widgetItem.supportedTemplates : []
                const allowedZones =
                    widgetItem.allowedZonesByTemplate && typeof widgetItem.allowedZonesByTemplate === 'object'
                        ? widgetItem.allowedZonesByTemplate[templateKey]
                        : undefined
                return (
                    supportedTemplates.includes(templateKey) &&
                    Array.isArray(allowedZones) &&
                    allowedZones.includes(zone) &&
                    canShowMarketingWidget(widgetItem.key)
                )
            })
        },
        [canShowMarketingWidget, layout?.templateKey, widgetObjects]
    )

    const saveDashboardWidget = useCallback(
        async (
            widgetKey: ApplicationLayoutWidgetKey,
            zone: DashboardLayoutZone | null,
            widgetId: string | null,
            config: Record<string, unknown>,
            close: () => void
        ) => {
            if (!zone || !metahubId || !layoutId) return
            try {
                let savedWidget: MetahubLayoutZoneWidget
                if (widgetId) {
                    const response = await layoutsApi.updateLayoutZoneWidgetConfig(
                        metahubId,
                        layoutId,
                        widgetId,
                        config,
                        getExpectedWidgetVersion(widgetId)
                    )
                    savedWidget = response.data.item
                } else {
                    const response = await layoutsApi.assignLayoutZoneWidget(metahubId, layoutId, {
                        zone,
                        widgetKey,
                        config,
                        expectedVersion: getExpectedLayoutVersion()
                    })
                    savedWidget = response.data
                }
                upsertZoneWidgetInCache(savedWidget)
                await persistAndRefresh()
                close()
            } catch (error: unknown) {
                notifyError(error)
            }
        },
        [getExpectedLayoutVersion, getExpectedWidgetVersion, layoutId, metahubId, notifyError, persistAndRefresh, upsertZoneWidgetInCache]
    )

    const closeMenu = useCallback(() => setMenuEditor(initialMenuEditor), [])
    const closeColumns = useCallback(() => setColumnsEditor(initialColumnsEditor), [])
    const closeQuiz = useCallback(() => setQuizEditor(initialQuizEditor), [])
    const closePlayCanvas = useCallback(() => setPlayCanvasEditor(initialPlayCanvasEditor), [])
    const closeInterpretationNetwork = useCallback(() => setInterpretationNetworkEditor(initialInterpretationNetworkEditor), [])
    const closeBehavior = useCallback(() => setWidgetBehaviorEditor(initialWidgetBehaviorEditor), [])

    const saveInterpretationNetwork = useCallback(
        async (config: InterpretationNetworkWorkspaceWidgetConfig) => {
            const widgetId = interpretationNetworkEditor.widgetId
            if (!widgetId || !metahubId || !layoutId) return
            try {
                const response = await layoutsApi.updateLayoutZoneWidgetConfig(
                    metahubId,
                    layoutId,
                    widgetId,
                    config,
                    getExpectedWidgetVersion(widgetId)
                )
                upsertZoneWidgetInCache(response.data.item)
                await persistAndRefresh()
                closeInterpretationNetwork()
            } catch (error: unknown) {
                notifyError(error)
                throw error
            }
        },
        [
            closeInterpretationNetwork,
            getExpectedWidgetVersion,
            interpretationNetworkEditor.widgetId,
            layoutId,
            metahubId,
            notifyError,
            persistAndRefresh,
            upsertZoneWidgetInCache
        ]
    )

    const saveBehavior = useCallback(
        async (config: Record<string, unknown>) => {
            const widgetId = widgetBehaviorEditor.widgetId
            if (!widgetId || !metahubId || !layoutId) return
            try {
                const response = await layoutsApi.updateLayoutZoneWidgetConfig(
                    metahubId,
                    layoutId,
                    widgetId,
                    config,
                    getExpectedWidgetVersion(widgetId)
                )
                upsertZoneWidgetInCache(response.data.item)
                await persistAndRefresh()
                closeBehavior()
            } catch (error: unknown) {
                notifyError(error)
            }
        },
        [
            closeBehavior,
            getExpectedWidgetVersion,
            layoutId,
            metahubId,
            notifyError,
            persistAndRefresh,
            upsertZoneWidgetInCache,
            widgetBehaviorEditor.widgetId
        ]
    )

    const handleAddWidgetRequest = useCallback(
        (zone: ApplicationLayoutZone, widgetKey: ApplicationLayoutWidgetKey) => {
            if (!canManageLayouts || !layout) return
            const definition = getLayoutWidgetDefinition(widgetKey)
            if (!definition || !definition.supportedTemplates.includes(layout.templateKey)) return
            if (!getLayoutWidgetAllowedZones(widgetKey, layout.templateKey)?.includes(zone)) return
            if (handleMarketingAddWidgetRequest(zone, widgetKey)) return
            if (definition.shared) {
                onAddWidget(zone, widgetKey)
                return
            }
            if (!DASHBOARD_LAYOUT_ZONES.includes(zone as DashboardLayoutZone)) return
            const dashboardZone = zone as DashboardLayoutZone
            if (widgetKey === 'menuWidget') setMenuEditor({ open: true, zone: dashboardZone, widgetId: null, config: null })
            else if (widgetKey === 'columnsContainer') setColumnsEditor({ open: true, zone: dashboardZone, widgetId: null, config: null })
            else if (widgetKey === 'quizWidget') setQuizEditor({ open: true, zone: dashboardZone, widgetId: null, config: null })
            else if (widgetKey === 'playcanvasCanvas')
                setPlayCanvasEditor({ open: true, zone: dashboardZone, widgetId: null, config: null })
            else onAddWidget(dashboardZone, widgetKey)
        },
        [canManageLayouts, handleMarketingAddWidgetRequest, layout, onAddWidget]
    )

    const handleDuplicateWidget = useCallback(
        async (item: MetahubLayoutZoneWidget) => {
            if (!metahubId || !layoutId || !layout || !canManageLayouts) return
            if (isMarketingWidgetKey(item.widgetKey)) {
                await handleMarketingWidgetDuplicate(item, {
                    metahubId,
                    layoutId,
                    getExpectedVersion: getExpectedLayoutVersion
                })
                return
            }
            try {
                await layoutsApi.assignLayoutZoneWidget(metahubId, layoutId, {
                    zone: item.zone,
                    widgetKey: item.widgetKey,
                    config: { ...item.config },
                    expectedVersion: getExpectedLayoutVersion()
                })
                await persistAndRefresh()
            } catch (error: unknown) {
                notifyError(error)
            }
        },
        [
            canManageLayouts,
            getExpectedLayoutVersion,
            handleMarketingWidgetDuplicate,
            layout,
            layoutId,
            metahubId,
            notifyError,
            persistAndRefresh
        ]
    )

    return {
        editors: {
            menu: menuEditor,
            columns: columnsEditor,
            quiz: quizEditor,
            playCanvas: playCanvasEditor,
            interpretationNetwork: interpretationNetworkEditor,
            behavior: widgetBehaviorEditor,
            marketing: marketingEditors.marketing,
            marketingBinding: marketingEditors.binding
        },
        widgetLabelByKey,
        sectionTargets,
        openWidgetEditor,
        getWidgetChipLabel,
        getAvailableWidgetsForZone,
        handleAddWidgetRequest,
        handleDuplicateWidget,
        dialogs: {
            saveMenu: (config) =>
                saveDashboardWidget(
                    'menuWidget',
                    menuEditor.zone,
                    menuEditor.widgetId,
                    config as unknown as Record<string, unknown>,
                    closeMenu
                ),
            closeMenu,
            saveColumns: (config) =>
                saveDashboardWidget(
                    'columnsContainer',
                    columnsEditor.zone,
                    columnsEditor.widgetId,
                    config as unknown as Record<string, unknown>,
                    closeColumns
                ),
            closeColumns,
            saveQuiz: (config) =>
                saveDashboardWidget(
                    'quizWidget',
                    quizEditor.zone,
                    quizEditor.widgetId,
                    config as unknown as Record<string, unknown>,
                    closeQuiz
                ),
            closeQuiz,
            savePlayCanvas: (config) =>
                saveDashboardWidget('playcanvasCanvas', playCanvasEditor.zone, playCanvasEditor.widgetId, config, closePlayCanvas),
            closePlayCanvas,
            saveInterpretationNetwork,
            closeInterpretationNetwork,
            saveBehavior,
            closeBehavior,
            closeMarketingBinding,
            saveMarketingSelection,
            configureMarketingPresentation,
            saveMarketingConfig,
            closeMarketingConfig,
            onBindingSaved: persistAndRefresh
        }
    }
}

/** Re-export the key guard for consumers that only need to classify a widget. */
export { isMarketingWidgetKey }
