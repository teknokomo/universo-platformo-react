import { useCallback, useMemo, useState } from 'react'
import type {
    ApplicationLayoutWidgetKey,
    ApplicationLayoutZone,
    ApplicationTemplateKey,
    DashboardWidgetConfig,
    DashboardLayoutZone,
    InterpretationNetworkWorkspaceWidgetConfig
} from '@universo-react/types'
import {
    DASHBOARD_LAYOUT_ZONES,
    dashboardWidgetConfigSchemaByKey,
    decodeWidgetConfigEnvelope,
    getDashboardWidgetDefinition,
    getLayoutWidgetAllowedZones,
    getLayoutWidgetDefinition,
    getMarketingActionSectionTargets,
    replaceWidgetRendererConfig
} from '@universo-react/types'
import type { TFunction } from 'i18next'

import type { DashboardLayoutWidgetItem, MetahubLayout, MetahubLayoutZoneWidget } from '../../../types'
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
type QuizWidgetConfig = DashboardWidgetConfig<'quizWidget'>
type NestedPlacementTarget = { parentInstanceKey: string; slotKey: string }

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
    onAddWidget: (zone: ApplicationLayoutZone, widgetKey: ApplicationLayoutWidgetKey, target?: NestedPlacementTarget) => void
}

export interface LayoutWidgetAuthoringResult {
    templateKey: ApplicationTemplateKey
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
    handleAddWidgetRequest: (zone: ApplicationLayoutZone, widgetKey: ApplicationLayoutWidgetKey, target?: NestedPlacementTarget) => void
    handleDuplicateWidget: (item: MetahubLayoutZoneWidget) => Promise<void>
    dialogs: {
        saveMenu: (config: DashboardWidgetConfig<'menuWidget'>) => Promise<void>
        closeMenu: () => void
        saveColumns: (config: DashboardWidgetConfig<'columnsContainer'>) => Promise<void>
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
const initialWidgetBehaviorEditor: WidgetBehaviorEditorState = {
    open: false,
    widgetId: null,
    widgetKey: null,
    widgetLabel: null,
    config: null
}
const initialDashboardBindingEditor: MarketingWidgetBindingEditorState = {
    open: false,
    zone: null,
    widgetId: null,
    sourceWidgetId: null,
    duplicateMode: false,
    rendererConfigPending: false,
    openSelectedRecordOnOpen: false,
    widgetKey: null,
    config: null
}

const getDefaultWidgetAuthoringConfig = (widgetKey: ApplicationLayoutWidgetKey): Record<string, unknown> => {
    const definition = getDashboardWidgetDefinition(widgetKey)
    const config = Object.fromEntries((definition?.presentationFields ?? []).map(({ key, defaultValue }) => [key, defaultValue]))
    if (definition?.initialBindingVariantKey) config.variant = definition.initialBindingVariantKey
    return config
}

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
    const [dashboardBehaviorBaseConfig, setDashboardBehaviorBaseConfig] = useState<Record<string, unknown> | null>(null)
    const [dashboardBindingEditor, setDashboardBindingEditor] = useState<MarketingWidgetBindingEditorState>(initialDashboardBindingEditor)
    const [nestedPlacementTarget, setNestedPlacementTarget] = useState<NestedPlacementTarget | null>(null)

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

    const templateKey = layout?.templateKey ?? 'dashboard'
    const getDashboardRendererConfig = useCallback((item: MetahubLayoutZoneWidget): Record<string, unknown> => {
        const config = item.config && typeof item.config === 'object' && !Array.isArray(item.config) ? item.config : {}
        return decodeWidgetConfigEnvelope(config, {
            templateKey: 'dashboard',
            widgetKey: item.widgetKey,
            zone: item.zone,
            rendererConfig: config
        }).rendererConfig
    }, [])

    const closeDashboardBinding = useCallback(() => setDashboardBindingEditor(initialDashboardBindingEditor), [])

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
            const config = item.config && typeof item.config === 'object' && !Array.isArray(item.config) ? item.config : {}
            const decodedConfig = decodeWidgetConfigEnvelope(config, {
                templateKey: 'dashboard',
                widgetKey: item.widgetKey,
                zone: item.zone,
                rendererConfig: config
            })
            const rendererConfig = decodedConfig.rendererConfig
            const definition = getLayoutWidgetDefinition(item.widgetKey, rendererConfig)
            const hasBindings = Boolean(definition?.bindingSlots?.length)
            const authoringPolicy = definition?.authoring.metahub
            const openSelectedRecord = options?.openSelectedRecord === true
            if (
                openSelectedRecord &&
                (!canEditContent || authoringPolicy?.contentEditing !== 'single-record' || !authoringPolicy.canRebind)
            ) {
                return
            }
            if (item.widgetKey === 'menuWidget' && options?.openSelectedRecord !== true) {
                const parsedConfig = dashboardWidgetConfigSchemaByKey.menuWidget.safeParse(rendererConfig)
                setMenuEditor({
                    open: true,
                    zone: dashboardZone,
                    widgetId: item.id,
                    config: parsedConfig.success ? parsedConfig.data : null
                })
                return
            }
            if (hasBindings && authoringPolicy?.canRebind) {
                if (!openSelectedRecord && !canManageLayouts) return
                setDashboardBindingEditor({
                    open: true,
                    zone: dashboardZone,
                    widgetId: item.id,
                    sourceWidgetId: item.id,
                    duplicateMode: false,
                    rendererConfigPending: false,
                    openSelectedRecordOnOpen: openSelectedRecord,
                    widgetKey: item.widgetKey,
                    config: rendererConfig
                })
                return
            }
            if (item.widgetKey === 'columnsContainer') {
                const parsedConfig = dashboardWidgetConfigSchemaByKey.columnsContainer.safeParse(rendererConfig)
                setColumnsEditor({
                    open: true,
                    zone: dashboardZone,
                    widgetId: item.id,
                    config: parsedConfig.success ? parsedConfig.data : null
                })
            } else if (item.widgetKey === 'quizWidget') {
                const parsedConfig = dashboardWidgetConfigSchemaByKey.quizWidget.safeParse(rendererConfig)
                setQuizEditor({
                    open: true,
                    zone: dashboardZone,
                    widgetId: item.id,
                    config: parsedConfig.success ? parsedConfig.data : null
                })
            } else if (item.widgetKey === 'playcanvasCanvas') {
                setPlayCanvasEditor({
                    open: true,
                    zone: dashboardZone,
                    widgetId: item.id,
                    config: rendererConfig
                })
            } else if (item.widgetKey === 'interpretationNetworkWorkspace') {
                setInterpretationNetworkEditor({
                    open: true,
                    widgetId: item.id,
                    config: rendererConfig as InterpretationNetworkWorkspaceWidgetConfig
                })
            } else {
                const presentationFields = definition?.presentationFields ?? []
                if (presentationFields.length === 0 && !isGlobalLayout) return
                setDashboardBehaviorBaseConfig(
                    item.config && typeof item.config === 'object' && !Array.isArray(item.config) ? item.config : {}
                )
                setWidgetBehaviorEditor({
                    open: true,
                    widgetId: item.id,
                    widgetKey: item.widgetKey,
                    widgetLabel: widgetLabelByKey[item.widgetKey] ?? tc('layouts.widgets.unknown', 'Widget'),
                    config: rendererConfig
                })
            }
        },
        [canEditContent, canManageLayouts, getDashboardRendererConfig, isGlobalLayout, openMarketingWidgetEditor, tc, widgetLabelByKey]
    )

    const getWidgetChipLabel = useCallback(
        (widget: MetahubLayoutZoneWidget): string => {
            const base = widgetLabelByKey[widget.widgetKey] || tc('layouts.widgets.unknown', 'Widget')
            const marketingLabel = getMarketingWidgetChipLabel(widget, base)
            if (marketingLabel !== undefined) return marketingLabel
            if (widget.widgetKey === 'menuWidget') {
                const parsedConfig = dashboardWidgetConfigSchemaByKey.menuWidget.safeParse(getDashboardRendererConfig(widget))
                if (!parsedConfig.success) return base
                return `${base}: ${tc(
                    `layouts.menuEditor.variants.${parsedConfig.data.variant}`,
                    parsedConfig.data.variant === 'manual' ? 'Manual navigation' : 'Generated navigation'
                )}`
            }
            return base
        },
        [getDashboardRendererConfig, getMarketingWidgetChipLabel, tc, widgetLabelByKey]
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
                    widgetItem.authoring.metahub.add !== 'none' &&
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
                        ...(nestedPlacementTarget ?? {}),
                        expectedVersion: getExpectedLayoutVersion()
                    })
                    savedWidget = response.data
                }
                upsertZoneWidgetInCache(savedWidget)
                await persistAndRefresh()
                setNestedPlacementTarget(null)
                close()
            } catch (error: unknown) {
                notifyError(error)
            }
        },
        [
            getExpectedLayoutVersion,
            getExpectedWidgetVersion,
            layoutId,
            metahubId,
            nestedPlacementTarget,
            notifyError,
            persistAndRefresh,
            upsertZoneWidgetInCache
        ]
    )

    const closeMenu = useCallback(() => setMenuEditor(initialMenuEditor), [])
    const closeColumns = useCallback(() => setColumnsEditor(initialColumnsEditor), [])
    const closeQuiz = useCallback(() => setQuizEditor(initialQuizEditor), [])
    const closePlayCanvas = useCallback(() => setPlayCanvasEditor(initialPlayCanvasEditor), [])
    const closeInterpretationNetwork = useCallback(() => setInterpretationNetworkEditor(initialInterpretationNetworkEditor), [])
    const closeBehavior = useCallback(() => {
        setWidgetBehaviorEditor(initialWidgetBehaviorEditor)
        setDashboardBehaviorBaseConfig(null)
    }, [])

    const saveMenu = useCallback(
        async (config: DashboardWidgetConfig<'menuWidget'>) => {
            const zone = menuEditor.zone
            const widgetId = menuEditor.widgetId
            if (!zone || !metahubId || !layoutId) return
            const rendererConfig = { ...config }
            const definition = getLayoutWidgetDefinition('menuWidget', rendererConfig)
            const hasBindings = Boolean(definition?.bindingSlots?.length)

            if (hasBindings) {
                setDashboardBindingEditor({
                    open: true,
                    zone,
                    widgetId,
                    sourceWidgetId: widgetId,
                    duplicateMode: false,
                    rendererConfigPending: Boolean(widgetId),
                    openSelectedRecordOnOpen: false,
                    widgetKey: 'menuWidget',
                    config: rendererConfig
                })
                closeMenu()
                return
            }

            if (!widgetId) {
                await saveDashboardWidget('menuWidget', zone, null, rendererConfig, closeMenu)
                return
            }

            try {
                await layoutsApi.replaceLayoutZoneWidgetBindings(metahubId, layoutId, widgetId, {
                    expectedVersion: getExpectedWidgetVersion(widgetId),
                    bindings: [],
                    rendererConfig,
                    locale
                })
                await persistAndRefresh()
                closeMenu()
            } catch (error: unknown) {
                notifyError(error)
            }
        },
        [closeMenu, getExpectedWidgetVersion, layoutId, locale, menuEditor, metahubId, notifyError, persistAndRefresh, saveDashboardWidget]
    )

    const saveDashboardSelection: MarketingWidgetBindingDialogProps['onSelection'] = useCallback(
        async ({ config, recordCopy }) => {
            const { zone, widgetKey } = dashboardBindingEditor
            if (!metahubId || !layoutId || !zone || !widgetKey) throw new Error('DASHBOARD_WIDGET_PLACEMENT_CONTEXT_MISSING')
            let placementPersisted = false
            try {
                const input = {
                    zone,
                    widgetKey,
                    config,
                    ...(nestedPlacementTarget ?? {}),
                    expectedVersion: getExpectedLayoutVersion()
                }
                const response = recordCopy
                    ? await layoutsApi.duplicateLayoutZoneWidgetWithRecordCopy(metahubId, layoutId, { ...input, recordCopy })
                    : await layoutsApi.assignLayoutZoneWidget(metahubId, layoutId, input)
                placementPersisted = true
                upsertZoneWidgetInCache(response.data)
                closeDashboardBinding()
                await persistAndRefresh()
                setNestedPlacementTarget(null)
            } catch (error: unknown) {
                notifyError(error)
                if (!placementPersisted) throw error
            }
        },
        [
            closeDashboardBinding,
            dashboardBindingEditor,
            getExpectedLayoutVersion,
            layoutId,
            templateKey,
            metahubId,
            nestedPlacementTarget,
            notifyError,
            persistAndRefresh,
            upsertZoneWidgetInCache
        ]
    )

    const configureDashboardPresentation: NonNullable<MarketingWidgetBindingDialogProps['onConfigurePresentation']> = useCallback(
        ({ config }) => {
            const { zone, widgetId, widgetKey } = dashboardBindingEditor
            if (!zone || !widgetId || !widgetKey) return
            const rendererConfig = decodeWidgetConfigEnvelope(config, {
                templateKey: 'dashboard',
                widgetKey,
                zone
            }).rendererConfig
            setDashboardBehaviorBaseConfig(config)
            closeDashboardBinding()
            setWidgetBehaviorEditor({
                open: true,
                widgetId,
                widgetKey,
                widgetLabel: widgetLabelByKey[widgetKey] ?? tc('layouts.widgets.unknown', 'Widget'),
                config: rendererConfig
            })
        },
        [closeDashboardBinding, dashboardBindingEditor, tc, widgetLabelByKey]
    )

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
                const currentWidget = zoneWidgets.find((item) => item.id === widgetId)
                const widgetKey = widgetBehaviorEditor.widgetKey
                const persistedConfig =
                    currentWidget && widgetKey
                        ? replaceWidgetRendererConfig(dashboardBehaviorBaseConfig ?? currentWidget.config ?? {}, config, {
                              templateKey: 'dashboard',
                              widgetKey,
                              zone: currentWidget.zone
                          })
                        : config
                const response = await layoutsApi.updateLayoutZoneWidgetConfig(
                    metahubId,
                    layoutId,
                    widgetId,
                    persistedConfig,
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
            dashboardBehaviorBaseConfig,
            getExpectedWidgetVersion,
            layoutId,
            metahubId,
            notifyError,
            persistAndRefresh,
            upsertZoneWidgetInCache,
            widgetBehaviorEditor.widgetId,
            widgetBehaviorEditor.widgetKey,
            zoneWidgets
        ]
    )

    const handleAddWidgetRequest = useCallback(
        (zone: ApplicationLayoutZone, widgetKey: ApplicationLayoutWidgetKey, target?: NestedPlacementTarget) => {
            setNestedPlacementTarget(target ?? null)
            if (!canManageLayouts || !layout) return
            const definition = getLayoutWidgetDefinition(widgetKey)
            if (!definition || !definition.supportedTemplates.includes(layout.templateKey)) return
            if (definition.authoring.metahub.add === 'none') return
            if (!getLayoutWidgetAllowedZones(widgetKey, layout.templateKey)?.includes(zone)) return
            if (handleMarketingAddWidgetRequest(zone, widgetKey)) return
            if (definition.shared) {
                onAddWidget(zone, widgetKey, target)
                setNestedPlacementTarget(null)
                return
            }
            if (!DASHBOARD_LAYOUT_ZONES.includes(zone as DashboardLayoutZone)) return
            const dashboardZone = zone as DashboardLayoutZone
            if (widgetKey === 'menuWidget') setMenuEditor({ open: true, zone: dashboardZone, widgetId: null, config: null })
            else if (definition.bindingSlots?.length && definition.authoring.metahub.add !== 'none') {
                setDashboardBindingEditor({
                    open: true,
                    zone: dashboardZone,
                    widgetId: null,
                    sourceWidgetId: null,
                    duplicateMode: false,
                    rendererConfigPending: false,
                    openSelectedRecordOnOpen: false,
                    widgetKey,
                    config: getDefaultWidgetAuthoringConfig(widgetKey)
                })
            } else if (widgetKey === 'columnsContainer') setColumnsEditor({ open: true, zone: dashboardZone, widgetId: null, config: null })
            else if (widgetKey === 'quizWidget') setQuizEditor({ open: true, zone: dashboardZone, widgetId: null, config: null })
            else if (widgetKey === 'playcanvasCanvas')
                setPlayCanvasEditor({ open: true, zone: dashboardZone, widgetId: null, config: null })
            else {
                onAddWidget(dashboardZone, widgetKey, target)
                setNestedPlacementTarget(null)
            }
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
            const subtree = [item]
            const includedInstanceKeys = new Set([item.instanceKey])
            for (let index = 0; index < subtree.length; index += 1) {
                const parent = subtree[index]
                for (const child of zoneWidgets) {
                    if (child.parentInstanceKey === parent.instanceKey && !includedInstanceKeys.has(child.instanceKey)) {
                        includedInstanceKeys.add(child.instanceKey)
                        subtree.push(child)
                    }
                }
            }
            const canDuplicateSubtree = subtree.every((placement) => {
                const rendererConfig = getDashboardRendererConfig(placement)
                const definition = getLayoutWidgetDefinition(placement.widgetKey, rendererConfig)
                return (
                    definition?.authoring.metahub.duplicate !== 'none' &&
                    definition?.copyPolicy.placement === 'copy' &&
                    (definition.copyPolicy.binding !== 'clone-record' || canEditContent) &&
                    !(
                        placement.isInherited &&
                        definition.sourcePolicy.inheritBindings &&
                        definition.sourcePolicy.sourceMode !== 'none' &&
                        definition.sourcePolicy.sourceMode !== 'specialized'
                    )
                )
            })
            if (!canDuplicateSubtree) return
            try {
                await layoutsApi.duplicateLayoutZoneWidgetPlacement(metahubId, layoutId, {
                    widgetId: item.id,
                    expectedVersion: getExpectedWidgetVersion(item.id),
                    expectedLayoutVersion: getExpectedLayoutVersion()
                })
                await persistAndRefresh()
            } catch (error: unknown) {
                notifyError(error)
            }
        },
        [
            canManageLayouts,
            canEditContent,
            getDashboardRendererConfig,
            getExpectedLayoutVersion,
            getExpectedWidgetVersion,
            handleMarketingWidgetDuplicate,
            layout,
            layoutId,
            metahubId,
            notifyError,
            persistAndRefresh,
            zoneWidgets
        ]
    )

    return {
        templateKey,
        editors: {
            menu: menuEditor,
            columns: columnsEditor,
            quiz: quizEditor,
            playCanvas: playCanvasEditor,
            interpretationNetwork: interpretationNetworkEditor,
            behavior: widgetBehaviorEditor,
            marketing: marketingEditors.marketing,
            marketingBinding: dashboardBindingEditor.open ? dashboardBindingEditor : marketingEditors.binding
        },
        widgetLabelByKey,
        sectionTargets,
        openWidgetEditor,
        getWidgetChipLabel,
        getAvailableWidgetsForZone,
        handleAddWidgetRequest,
        handleDuplicateWidget,
        dialogs: {
            saveMenu,
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
            saveQuiz: (config) => saveDashboardWidget('quizWidget', quizEditor.zone, quizEditor.widgetId, { ...config }, closeQuiz),
            closeQuiz,
            savePlayCanvas: (config) =>
                saveDashboardWidget('playcanvasCanvas', playCanvasEditor.zone, playCanvasEditor.widgetId, config, closePlayCanvas),
            closePlayCanvas,
            saveInterpretationNetwork,
            closeInterpretationNetwork,
            saveBehavior,
            closeBehavior,
            closeMarketingBinding: dashboardBindingEditor.open ? closeDashboardBinding : closeMarketingBinding,
            saveMarketingSelection: dashboardBindingEditor.open ? saveDashboardSelection : saveMarketingSelection,
            configureMarketingPresentation: dashboardBindingEditor.open ? configureDashboardPresentation : configureMarketingPresentation,
            saveMarketingConfig,
            closeMarketingConfig,
            onBindingSaved: persistAndRefresh
        }
    }
}

/** Re-export the key guard for consumers that only need to classify a widget. */
export { isMarketingWidgetKey }
