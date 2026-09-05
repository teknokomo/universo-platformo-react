import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { DragEndEvent } from '@dnd-kit/core'
import type {
    ObjectCollectionRuntimeViewConfig,
    ApplicationLayoutZone,
    ApplicationLayoutWidgetKey,
    ApplicationTemplateKey,
    DashboardLayoutZone,
    ResolvedDashboardLayoutConfig,
    MenuWidgetConfig,
    ColumnsContainerConfig,
    QuizWidgetConfig,
    InterpretationNetworkWorkspaceWidgetConfig,
    DashboardSideMenuConfig
} from '@universo-react/types'
import {
    DASHBOARD_LAYOUT_ZONES,
    LAYOUT_ZONE_DEFINITIONS,
    MARKETING_LAYOUT_ZONES,
    MARKETING_SOURCE_CODENAMES,
    MARKETING_WIDGET_REGISTRY,
    type MarketingWidgetKey
} from '@universo-react/types'
import {
    LayoutAuthoringDetails,
    MarketingWidgetConfigDialog,
    TemplateMainCard as MainCard,
    ViewHeaderMUI as ViewHeader,
    notifyError,
    normalizeSideMenuConfig,
    useConfirm
} from '@universo-react/template-mui'
import { ConfirmDeleteDialog } from '@universo-react/template-mui/components/dialogs'
import {
    extractObjectCollectionLayoutBehaviorConfig,
    getCodenamePrimary,
    normalizeObjectCollectionRuntimeViewConfig,
    setObjectCollectionLayoutBehaviorConfig
} from '@universo-react/utils'

import { metahubsQueryKeys, invalidateLayoutsQueries } from '../../shared'
import { useMetahubDetails } from '../../metahubs/hooks'
import { useEntityInstancesQuery } from '../../entities/hooks'
import * as layoutsApi from '../api'
import type { Metahub, MetahubLayout, MetahubLayoutZoneWidget, DashboardLayoutWidgetItem } from '../../../types'
import { getVLCString, normalizeLocale } from '../../../types'
import MenuWidgetEditorDialog from './MenuWidgetEditorDialog'
import ColumnsContainerEditorDialog from './ColumnsContainerEditorDialog'
import QuizWidgetEditorDialog from './QuizWidgetEditorDialog'
import PlayCanvasCanvasWidgetEditorDialog from './PlayCanvasCanvasWidgetEditorDialog'
import InterpretationNetworkWorkspaceWidgetEditorDialog from './InterpretationNetworkWorkspaceWidgetEditorDialog'
import WidgetBehaviorEditorDialog from './WidgetBehaviorEditorDialog'
import { getSharedBehaviorFromWidgetConfig } from './LayoutWidgetSharedBehaviorFields'
import LayoutRuntimeSettingsPanel from './LayoutRuntimeSettingsPanel'

type MenuEditorState = {
    open: boolean
    zone: DashboardLayoutZone | null
    /** widgetId when editing existing menuWidget, null when creating new */
    widgetId: string | null
    config: MenuWidgetConfig | null
}

type ColumnsEditorState = {
    open: boolean
    zone: DashboardLayoutZone | null
    /** widgetId when editing existing columnsContainer, null when creating new */
    widgetId: string | null
    config: ColumnsContainerConfig | null
}

type QuizEditorState = {
    open: boolean
    zone: DashboardLayoutZone | null
    widgetId: string | null
    config: QuizWidgetConfig | null
}

type PlayCanvasCanvasEditorState = {
    open: boolean
    zone: DashboardLayoutZone | null
    widgetId: string | null
    config: Record<string, unknown> | null
}

type InterpretationNetworkEditorState = {
    open: boolean
    widgetId: string | null
    config: InterpretationNetworkWorkspaceWidgetConfig | null
}

type WidgetBehaviorEditorState = {
    open: boolean
    widgetId: string | null
    widgetLabel: string | null
    config: Record<string, unknown> | null
}

type MarketingWidgetEditorState = {
    open: boolean
    zone: ApplicationLayoutZone | null
    widgetId: string | null
    widgetKey: MarketingWidgetKey | null
    config: Record<string, unknown> | null
}

const LAYOUT_ZONES_BY_TEMPLATE: Readonly<Record<ApplicationTemplateKey, readonly ApplicationLayoutZone[]>> = {
    dashboard: DASHBOARD_LAYOUT_ZONES,
    'marketing-page': MARKETING_LAYOUT_ZONES
}

const isMarketingWidgetKey = (value: ApplicationLayoutWidgetKey): value is MarketingWidgetKey =>
    Object.prototype.hasOwnProperty.call(MARKETING_WIDGET_REGISTRY, value)

const EMPTY_ZONE_WIDGETS: MetahubLayoutZoneWidget[] = []
const EMPTY_WIDGET_OBJECTS: DashboardLayoutWidgetItem[] = []
const LAYOUT_ZONE_ORDER = Object.fromEntries(LAYOUT_ZONE_DEFINITIONS.map(({ key }, index) => [key, index])) as Record<
    ApplicationLayoutZone,
    number
>

const normalizeEditableSideMenuConfig = (value: unknown): DashboardSideMenuConfig => {
    return normalizeSideMenuConfig(
        (value && typeof value === 'object' && !Array.isArray(value) ? value : undefined) as MenuWidgetConfig['sideMenu']
    )
}

export default function LayoutDetails() {
    const { metahubId, layoutId } = useParams<{ metahubId: string; layoutId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const { enqueueSnackbar } = useSnackbar()
    const { confirm } = useConfirm()
    const queryClient = useQueryClient()
    const metahubDetailsQuery = useMetahubDetails(metahubId ?? '', { enabled: Boolean(metahubId) })
    const [menuEditor, setMenuEditor] = useState<MenuEditorState>({ open: false, zone: null, widgetId: null, config: null })
    const [columnsEditor, setColumnsEditor] = useState<ColumnsEditorState>({ open: false, zone: null, widgetId: null, config: null })
    const [quizEditor, setQuizEditor] = useState<QuizEditorState>({ open: false, zone: null, widgetId: null, config: null })
    const [playCanvasCanvasEditor, setPlayCanvasCanvasEditor] = useState<PlayCanvasCanvasEditorState>({
        open: false,
        zone: null,
        widgetId: null,
        config: null
    })
    const [interpretationNetworkEditor, setInterpretationNetworkEditor] = useState<InterpretationNetworkEditorState>({
        open: false,
        widgetId: null,
        config: null
    })
    const [widgetBehaviorEditor, setWidgetBehaviorEditor] = useState<WidgetBehaviorEditorState>({
        open: false,
        widgetId: null,
        widgetLabel: null,
        config: null
    })
    const [marketingWidgetEditor, setMarketingWidgetEditor] = useState<MarketingWidgetEditorState>({
        open: false,
        zone: null,
        widgetId: null,
        widgetKey: null,
        config: null
    })
    const [viewSettingsSaving, setViewSettingsSaving] = useState(false)
    const [removeWidgetId, setRemoveWidgetId] = useState<string | null>(null)
    const [removeWidgetError, setRemoveWidgetError] = useState<string | null>(null)

    const layoutQuery = useQuery({
        queryKey: metahubId && layoutId ? metahubsQueryKeys.layoutDetail(metahubId, layoutId) : ['layout-empty'],
        enabled: Boolean(metahubId && layoutId),
        queryFn: async () => {
            const resp = await layoutsApi.getLayout(String(metahubId), String(layoutId))
            return resp.data
        }
    })

    const zoneWidgetsQuery = useQuery({
        queryKey: metahubId && layoutId ? metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId) : ['layout-zone-widgets-empty'],
        enabled: Boolean(metahubId && layoutId),
        queryFn: async () => layoutsApi.listLayoutZoneWidgets(String(metahubId), String(layoutId))
    })

    const widgetObjectsQuery = useQuery({
        queryKey: metahubId && layoutId ? metahubsQueryKeys.layoutZoneWidgetObjects(metahubId, layoutId) : ['layout-zone-objects-empty'],
        enabled: Boolean(metahubId && layoutId),
        queryFn: async () => layoutsApi.getLayoutZoneWidgetObjects(String(metahubId), String(layoutId))
    })
    const uiLocale = normalizeLocale(i18n.language)
    const marketingContentQuery = useEntityInstancesQuery(
        metahubId,
        layoutQuery.data && (layoutQuery.data as MetahubLayout).templateKey === 'marketing-page'
            ? {
                  kind: 'object',
                  locale: uiLocale,
                  limit: 1000,
                  offset: 0,
                  sortBy: 'codename',
                  sortOrder: 'asc'
              }
            : undefined
    )

    const cachedMetahub = metahubId ? queryClient.getQueryData<Metahub>(metahubsQueryKeys.detail(metahubId)) : undefined
    const canManageLayouts = (metahubDetailsQuery.data?.permissions ?? cachedMetahub?.permissions)?.manageMetahub === true
    const layout = layoutQuery.data as MetahubLayout | undefined
    const zoneWidgets = zoneWidgetsQuery.data ?? EMPTY_ZONE_WIDGETS
    const widgetObjects = widgetObjectsQuery.data ?? EMPTY_WIDGET_OBJECTS
    const isGlobalLayout = layout?.scopeEntityId == null
    const layoutZones = layout ? LAYOUT_ZONES_BY_TEMPLATE[layout.templateKey] : DASHBOARD_LAYOUT_ZONES
    const getExpectedLayoutVersion = useCallback((): number => {
        if (!layout || !Number.isSafeInteger(layout.version) || layout.version <= 0) {
            throw new Error(t('layouts.details.versionUnavailable', 'The latest layout version is unavailable. Refresh and try again.'))
        }
        return layout.version
    }, [layout, t])
    const getExpectedWidgetVersion = (widgetId: string | null): number => {
        const version = widgetId ? zoneWidgets.find((item) => item.id === widgetId)?.version : undefined
        if (!Number.isSafeInteger(version) || version <= 0) {
            throw new Error(t('layouts.details.versionUnavailable', 'The latest widget version is unavailable. Refresh and try again.'))
        }
        return version
    }
    const layoutName = layout
        ? getVLCString(layout.name, uiLocale) ||
          getVLCString(layout.name, 'en') ||
          (layout.templateKey === 'marketing-page'
              ? t('layouts.templates.marketingPage', 'Marketing page')
              : t('layouts.templates.dashboard', 'Dashboard'))
        : ''
    const layoutConfig = (layout?.config ?? {}) as Partial<ResolvedDashboardLayoutConfig>
    const sideMenuConfig = useMemo(() => normalizeEditableSideMenuConfig(layout?.config?.sideMenu), [layout?.config?.sideMenu])
    const objectBehaviorConfig = useMemo(
        () => normalizeObjectCollectionRuntimeViewConfig(extractObjectCollectionLayoutBehaviorConfig(layout?.config)),
        [layout?.config]
    )
    const [reorderPersistenceFieldDraft, setReorderPersistenceFieldDraft] = useState('')

    useEffect(() => {
        setReorderPersistenceFieldDraft(objectBehaviorConfig.reorderPersistenceField ?? '')
    }, [objectBehaviorConfig.reorderPersistenceField])

    const zoneToItems = useMemo(() => {
        const initial = [...DASHBOARD_LAYOUT_ZONES, ...MARKETING_LAYOUT_ZONES].reduce((acc, zone) => {
            acc[zone] = []
            return acc
        }, {} as Record<ApplicationLayoutZone, MetahubLayoutZoneWidget[]>)

        for (const item of zoneWidgets) {
            if (!initial[item.zone]) continue
            initial[item.zone].push(item)
        }
        for (const zone of [...DASHBOARD_LAYOUT_ZONES, ...MARKETING_LAYOUT_ZONES]) {
            initial[zone].sort((a, b) => a.sortOrder - b.sortOrder)
        }
        return initial
    }, [zoneWidgets])

    const widgetLabelByKey = useMemo(() => {
        const labels: Record<string, string> = {}
        for (const item of widgetObjects) {
            labels[item.key] = t(
                item.labelKey ?? `layouts.widgets.${item.key}`,
                item.defaultLabel ?? t('layouts.widgets.unknown', 'Widget')
            )
        }
        return labels
    }, [t, widgetObjects])

    const zoneLabels = useMemo<Record<ApplicationLayoutZone, string>>(
        () =>
            Object.fromEntries(LAYOUT_ZONE_DEFINITIONS.map((zone) => [zone.key, t(zone.labelKey, zone.defaultLabel)])) as Record<
                ApplicationLayoutZone,
                string
            >,
        [t]
    )

    const marketingSourceOptions = useMemo(
        () =>
            (marketingContentQuery.data?.items ?? [])
                .map((entity) => {
                    const codename = getCodenamePrimary(entity.codename)
                    if (!codename || !MARKETING_SOURCE_CODENAMES.includes(codename as (typeof MARKETING_SOURCE_CODENAMES)[number]))
                        return null
                    const name = getVLCString(entity.name, uiLocale) || getVLCString(entity.name, 'en')
                    return {
                        value: codename,
                        label: name || codename,
                        entityKind: 'object' as const
                    }
                })
                .filter((option): option is { value: string; label: string; entityKind: 'object' } => option !== null)
                .sort((left, right) => left.label.localeCompare(right.label)),
        [marketingContentQuery.data?.items, uiLocale]
    )

    const openWidgetEditor = useCallback(
        (zone: ApplicationLayoutZone, item: MetahubLayoutZoneWidget) => {
            if (isMarketingWidgetKey(item.widgetKey)) {
                setMarketingWidgetEditor({
                    open: true,
                    zone,
                    widgetId: item.id,
                    widgetKey: item.widgetKey,
                    config:
                        item.config && typeof item.config === 'object' && !Array.isArray(item.config)
                            ? { ...(item.config as Record<string, unknown>) }
                            : {}
                })
                return
            }
            if (item.isInherited) {
                return
            }
            if (!DASHBOARD_LAYOUT_ZONES.includes(zone as DashboardLayoutZone)) {
                return
            }
            const dashboardZone = zone as DashboardLayoutZone
            if (item.widgetKey === 'menuWidget') {
                setMenuEditor({
                    open: true,
                    zone: dashboardZone,
                    widgetId: item.id,
                    config: (item.config as MenuWidgetConfig) ?? null
                })
                return
            }
            if (item.widgetKey === 'columnsContainer') {
                setColumnsEditor({
                    open: true,
                    zone: dashboardZone,
                    widgetId: item.id,
                    config: (item.config as ColumnsContainerConfig) ?? null
                })
                return
            }
            if (item.widgetKey === 'quizWidget') {
                setQuizEditor({
                    open: true,
                    zone: dashboardZone,
                    widgetId: item.id,
                    config: (item.config as QuizWidgetConfig) ?? null
                })
                return
            }
            if (item.widgetKey === 'playcanvasCanvas') {
                setPlayCanvasCanvasEditor({
                    open: true,
                    zone: dashboardZone,
                    widgetId: item.id,
                    config:
                        item.config && typeof item.config === 'object' && !Array.isArray(item.config)
                            ? { ...(item.config as Record<string, unknown>) }
                            : {}
                })
                return
            }
            if (item.widgetKey === 'interpretationNetworkWorkspace') {
                setInterpretationNetworkEditor({
                    open: true,
                    widgetId: item.id,
                    config: (item.config as InterpretationNetworkWorkspaceWidgetConfig) ?? null
                })
                return
            }
            if (isGlobalLayout) {
                setWidgetBehaviorEditor({
                    open: true,
                    widgetId: item.id,
                    widgetLabel: widgetLabelByKey[item.widgetKey] ?? t('layouts.widgets.unknown', 'Widget'),
                    config:
                        item.config && typeof item.config === 'object' && !Array.isArray(item.config)
                            ? { ...(item.config as Record<string, unknown>) }
                            : {}
                })
            }
        },
        [isGlobalLayout, t, widgetLabelByKey]
    )

    /** Build a chip label: for menuWidget append the resolved menu title, for columnsContainer list inner widgets. */
    const getWidgetChipLabel = useCallback(
        (widget: MetahubLayoutZoneWidget): string => {
            const base = widgetLabelByKey[widget.widgetKey] || t('layouts.widgets.unknown', 'Widget')
            if (isMarketingWidgetKey(widget.widgetKey)) {
                const variant = widget.config?.variant
                if (widget.widgetKey === 'marketing.collection' && typeof variant === 'string') {
                    return `${base}: ${t(`layouts.marketing.widget.variants.${variant}`, 'Collection')}`
                }
                return base
            }
            if (widget.widgetKey === 'menuWidget') {
                const cfg = widget.config as MenuWidgetConfig | undefined
                if (!cfg?.title) return base
                const title = getVLCString(cfg.title, uiLocale) || getVLCString(cfg.title, 'en')
                return title ? `${base}: ${title}` : base
            }
            if (widget.widgetKey === 'columnsContainer') {
                const cfg = widget.config as ColumnsContainerConfig | undefined
                if (!cfg?.columns?.length) return base
                const innerNames = cfg.columns
                    .flatMap((col) =>
                        (col.widgets ?? []).map((w) => widgetLabelByKey[w.widgetKey] || t('layouts.widgets.unknown', 'Widget'))
                    )
                    .join(', ')
                return `${base}: ${innerNames}`
            }
            return base
        },
        [t, uiLocale, widgetLabelByKey]
    )

    const getAvailableWidgetsForZone = useCallback(
        (zone: ApplicationLayoutZone): DashboardLayoutWidgetItem[] => {
            return widgetObjects.filter((widgetItem) => {
                return (
                    (widgetItem.templateKey === undefined || widgetItem.templateKey === layout?.templateKey) &&
                    widgetItem.allowedZones.includes(zone)
                )
            })
        },
        [layout?.templateKey, widgetObjects]
    )

    const persistAndRefresh = useCallback(async () => {
        if (!metahubId || !layoutId) return
        if (layout?.scopeEntityId == null) {
            await invalidateLayoutsQueries.all(queryClient, metahubId)
            return
        }
        await invalidateLayoutsQueries.detail(queryClient, metahubId, layoutId)
        await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId) })
    }, [layout?.scopeEntityId, layoutId, metahubId, queryClient])

    const upsertZoneWidgetInCache = (nextWidget: MetahubLayoutZoneWidget) => {
        if (!metahubId || !layoutId) return
        const zoneWidgetsKey = metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId)
        queryClient.setQueryData<MetahubLayoutZoneWidget[]>(zoneWidgetsKey, (prev) => {
            const current = Array.isArray(prev) ? [...prev] : []
            const existingIndex = current.findIndex((item) => item.id === nextWidget.id)
            if (existingIndex >= 0) {
                current[existingIndex] = nextWidget
            } else {
                current.push(nextWidget)
            }
            current.sort((a, b) => {
                if (a.zone !== b.zone) return LAYOUT_ZONE_ORDER[a.zone] - LAYOUT_ZONE_ORDER[b.zone]
                return a.sortOrder - b.sortOrder
            })
            return current
        })
    }

    const persistLayoutConfig = useCallback(
        async (nextConfig: Record<string, unknown>) => {
            if (!metahubId || !layoutId || !layout) return
            await layoutsApi.updateLayout(metahubId, layoutId, {
                config: nextConfig,
                expectedVersion: getExpectedLayoutVersion()
            })
            if (layout?.scopeEntityId == null) {
                await invalidateLayoutsQueries.all(queryClient, metahubId)
                return
            }
            await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layoutDetail(metahubId, layoutId) })
        },
        [getExpectedLayoutVersion, layout, layoutId, metahubId, queryClient]
    )

    const handleViewSettingChange = useCallback(
        async (key: string, value: unknown) => {
            if (!layout || !canManageLayouts) return
            setViewSettingsSaving(true)
            try {
                await persistLayoutConfig({ ...layout.config, [key]: value })
            } catch (e: unknown) {
                notifyError(t, enqueueSnackbar, e)
            } finally {
                setViewSettingsSaving(false)
            }
        },
        [canManageLayouts, enqueueSnackbar, layout, persistLayoutConfig, t]
    )

    const handleSideMenuConfigChange = useCallback(
        async (patch: Partial<DashboardSideMenuConfig>) => {
            const nextSideMenuConfig = normalizeEditableSideMenuConfig({ ...sideMenuConfig, ...patch })
            await handleViewSettingChange('sideMenu', nextSideMenuConfig)
        },
        [handleViewSettingChange, sideMenuConfig]
    )

    const handleObjectBehaviorChange = useCallback(
        async (patch: Partial<ObjectCollectionRuntimeViewConfig>) => {
            if (!layout || !canManageLayouts) return
            setViewSettingsSaving(true)
            try {
                const currentBehaviorConfig = extractObjectCollectionLayoutBehaviorConfig(layout.config) ?? {}
                await persistLayoutConfig(setObjectCollectionLayoutBehaviorConfig(layout.config, { ...currentBehaviorConfig, ...patch }))
            } catch (e: unknown) {
                notifyError(t, enqueueSnackbar, e)
            } finally {
                setViewSettingsSaving(false)
            }
        },
        [canManageLayouts, enqueueSnackbar, layout, persistLayoutConfig, t]
    )

    const commitReorderPersistenceField = useCallback(async () => {
        if (!layout || !canManageLayouts) return

        const normalizedValue = reorderPersistenceFieldDraft.trim()
        const currentValue = objectBehaviorConfig.reorderPersistenceField ?? ''

        if (normalizedValue === currentValue) {
            return
        }

        await handleObjectBehaviorChange({
            reorderPersistenceField: normalizedValue || null
        })
    }, [canManageLayouts, objectBehaviorConfig.reorderPersistenceField, handleObjectBehaviorChange, layout, reorderPersistenceFieldDraft])

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        if (!metahubId || !layoutId || !canManageLayouts) return
        if (!active.id || !over?.id) return

        const activeWidgetId = String(active.id)
        const overId = String(over.id)
        if (activeWidgetId === overId) return

        const currentItem = zoneWidgets.find((item) => item.id === activeWidgetId)
        if (!currentItem) return
        if (currentItem.isInherited && getSharedBehaviorFromWidgetConfig(currentItem.config).positionLocked) {
            return
        }

        let targetZone = currentItem.zone
        let targetIndex = 0

        if (overId.startsWith('zone:')) {
            const zoneValue = overId.replace('zone:', '') as ApplicationLayoutZone
            if (!layoutZones.includes(zoneValue)) return
            targetZone = zoneValue
            targetIndex = zoneToItems[targetZone].length
        } else {
            const overItem = zoneWidgets.find((item) => item.id === overId)
            if (!overItem) return
            targetZone = overItem.zone
            targetIndex = zoneToItems[targetZone].findIndex((item) => item.id === overItem.id)
            if (targetIndex < 0) {
                targetIndex = zoneToItems[targetZone].length
            }
        }

        const sourceZoneItems = zoneToItems[currentItem.zone]
        const sourceIndex = sourceZoneItems.findIndex((item) => item.id === currentItem.id)
        if (currentItem.zone === targetZone && sourceIndex === targetIndex) {
            return
        }

        // Optimistic update: reorder locally before API call
        const zoneWidgetsKey = metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId)
        const previousData = queryClient.getQueryData<MetahubLayoutZoneWidget[]>(zoneWidgetsKey)

        const optimistic = zoneWidgets.map((widget) => ({ ...widget }))
        const draggedIdx = optimistic.findIndex((w) => w.id === activeWidgetId)
        if (draggedIdx >= 0) {
            const [moved] = optimistic.splice(draggedIdx, 1)
            moved.zone = targetZone
            // Recalculate insertion point in the target zone items
            const targetItems = optimistic.filter((w) => w.zone === targetZone)
            const insertBefore = targetItems[targetIndex]
            const globalInsertIdx = insertBefore ? optimistic.indexOf(insertBefore) : optimistic.length
            optimistic.splice(globalInsertIdx, 0, moved)
            // Reassign sortOrders per zone
            for (const zone of layoutZones) {
                let order = 0
                for (const w of optimistic) {
                    if (w.zone === zone) w.sortOrder = order++
                }
            }
            queryClient.setQueryData(zoneWidgetsKey, optimistic)
        }

        try {
            await layoutsApi.moveLayoutZoneWidget(metahubId, layoutId, {
                widgetId: activeWidgetId,
                targetZone,
                targetIndex,
                expectedVersion: currentItem.version
            })
            await persistAndRefresh()
        } catch (e: unknown) {
            // Rollback optimistic update on error
            if (previousData) queryClient.setQueryData(zoneWidgetsKey, previousData)
            notifyError(t, enqueueSnackbar, e)
        }
    }

    const handleRemoveWidget = useCallback(
        async (widgetId: string) => {
            if (!metahubId || !layoutId || !canManageLayouts) return
            const currentItem = zoneWidgets.find((item) => item.id === widgetId)
            if (!currentItem) return
            if (currentItem.isInherited && !getSharedBehaviorFromWidgetConfig(currentItem.config).canExclude) {
                return
            }
            try {
                await layoutsApi.removeLayoutZoneWidget(metahubId, layoutId, widgetId, currentItem.version)
                await persistAndRefresh()
            } catch (e: unknown) {
                notifyError(t, enqueueSnackbar, e)
                throw e
            }
        },
        [canManageLayouts, enqueueSnackbar, layoutId, metahubId, persistAndRefresh, t, zoneWidgets]
    )

    const requestRemoveWidget = useCallback((widgetId: string) => {
        setRemoveWidgetError(null)
        setRemoveWidgetId(widgetId)
    }, [])

    const confirmRemoveWidget = useCallback(async () => {
        if (!removeWidgetId) return
        try {
            await handleRemoveWidget(removeWidgetId)
            setRemoveWidgetId(null)
        } catch {
            setRemoveWidgetError(t('layouts.details.removeWidgetError', 'The widget could not be removed. Try again.'))
        }
    }, [handleRemoveWidget, removeWidgetId, t])

    const handleAddWidget = useCallback(
        async (zone: ApplicationLayoutZone, widgetKey: ApplicationLayoutWidgetKey, config?: Record<string, unknown>) => {
            if (!metahubId || !layoutId || !layout || !canManageLayouts) return
            try {
                await layoutsApi.assignLayoutZoneWidget(metahubId, layoutId, {
                    zone,
                    widgetKey,
                    ...(config ? { config } : {}),
                    expectedVersion: getExpectedLayoutVersion()
                })
                await persistAndRefresh()
            } catch (e: unknown) {
                notifyError(t, enqueueSnackbar, e)
            }
        },
        [canManageLayouts, enqueueSnackbar, getExpectedLayoutVersion, layout, layoutId, metahubId, persistAndRefresh, t]
    )

    const handleAddWidgetRequest = useCallback(
        (zone: ApplicationLayoutZone, widgetKey: ApplicationLayoutWidgetKey) => {
            if (!canManageLayouts) {
                return
            }
            if (isMarketingWidgetKey(widgetKey)) {
                setMarketingWidgetEditor({ open: true, zone, widgetId: null, widgetKey, config: null })
                return
            }
            if (!DASHBOARD_LAYOUT_ZONES.includes(zone as DashboardLayoutZone)) {
                return
            }
            const dashboardZone = zone as DashboardLayoutZone
            if (widgetKey === 'menuWidget') {
                setMenuEditor({ open: true, zone: dashboardZone, widgetId: null, config: null })
                return
            }
            if (widgetKey === 'columnsContainer') {
                setColumnsEditor({ open: true, zone: dashboardZone, widgetId: null, config: null })
                return
            }
            if (widgetKey === 'quizWidget') {
                setQuizEditor({ open: true, zone: dashboardZone, widgetId: null, config: null })
                return
            }
            if (widgetKey === 'playcanvasCanvas') {
                setPlayCanvasCanvasEditor({ open: true, zone: dashboardZone, widgetId: null, config: null })
                return
            }
            void handleAddWidget(dashboardZone, widgetKey)
        },
        [canManageLayouts, handleAddWidget]
    )

    const handleDuplicateWidget = useCallback(
        async (item: MetahubLayoutZoneWidget) => {
            if (!metahubId || !layoutId || !layout || !canManageLayouts) return

            const config = { ...item.config }
            if (isMarketingWidgetKey(item.widgetKey)) delete config.instanceKey
            try {
                await layoutsApi.assignLayoutZoneWidget(metahubId, layoutId, {
                    zone: item.zone,
                    widgetKey: item.widgetKey,
                    config,
                    expectedVersion: getExpectedLayoutVersion()
                })
                await persistAndRefresh()
            } catch (e: unknown) {
                notifyError(t, enqueueSnackbar, e)
            }
        },
        [canManageLayouts, enqueueSnackbar, getExpectedLayoutVersion, layout, layoutId, metahubId, persistAndRefresh, t]
    )

    const handleResetWidgetOverride = useCallback(
        async (item: MetahubLayoutZoneWidget) => {
            if (!metahubId || !layoutId || !canManageLayouts || isGlobalLayout || !item.isInherited || !item.isOverridden) return
            const confirmed = await confirm({
                title: t('layouts.details.resetWidgetTitle', 'Reset widget override?'),
                description: t(
                    'layouts.details.resetWidgetDescription',
                    'This restores the widget settings and placement inherited from the global layout.'
                ),
                confirmButtonName: t('layouts.details.resetWidgetConfirm', 'Reset override'),
                cancelButtonName: t('common:actions.cancel', 'Cancel')
            })
            if (!confirmed) return
            try {
                await layoutsApi.resetLayoutZoneWidgetOverride(metahubId, layoutId, item.id, item.version)
                await persistAndRefresh()
            } catch (e: unknown) {
                notifyError(t, enqueueSnackbar, e)
            }
        },
        [canManageLayouts, confirm, enqueueSnackbar, isGlobalLayout, layoutId, metahubId, persistAndRefresh, t]
    )

    const handleToggleWidgetActive = useCallback(
        async (widgetId: string, isActive: boolean) => {
            if (!metahubId || !layoutId || !canManageLayouts) return
            const currentItem = zoneWidgets.find((item) => item.id === widgetId)
            if (!currentItem) return
            if (currentItem.isInherited && !getSharedBehaviorFromWidgetConfig(currentItem.config).canDeactivate) {
                return
            }

            const zoneWidgetsKey = metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId)
            const previousData = queryClient.getQueryData<MetahubLayoutZoneWidget[]>(zoneWidgetsKey)

            if (previousData) {
                queryClient.setQueryData(
                    zoneWidgetsKey,
                    previousData.map((item) => (item.id === widgetId ? { ...item, isActive } : item))
                )
            }

            try {
                await layoutsApi.toggleLayoutZoneWidgetActive(metahubId, layoutId, widgetId, isActive, currentItem.version)
                await persistAndRefresh()
            } catch (e: unknown) {
                if (previousData) {
                    queryClient.setQueryData(zoneWidgetsKey, previousData)
                }
                notifyError(t, enqueueSnackbar, e)
            }
        },
        [canManageLayouts, enqueueSnackbar, layoutId, metahubId, persistAndRefresh, queryClient, t, zoneWidgets]
    )

    const authoringZones = useMemo(
        () =>
            layoutZones.map((zone) => ({
                zone,
                title: zoneLabels[zone],
                addDisabled: !canManageLayouts,
                availableWidgets: getAvailableWidgetsForZone(zone).map((widgetItem) => ({
                    key: widgetItem.key,
                    label: widgetLabelByKey[widgetItem.key] || t('layouts.widgets.unknown', 'Widget')
                })),
                items: zoneToItems[zone].map((item) => {
                    const isInheritedWidget = item.isInherited === true
                    const sharedBehavior = getSharedBehaviorFromWidgetConfig(item.config)
                    const canDragWidget = canManageLayouts && (!isInheritedWidget || !sharedBehavior.positionLocked)
                    const canToggleWidget = canManageLayouts && (!isInheritedWidget || sharedBehavior.canDeactivate)
                    const canRemoveWidget = canManageLayouts && (!isInheritedWidget || sharedBehavior.canExclude)
                    const canDuplicateWidget = canManageLayouts
                    const canResetWidget = canManageLayouts && !isGlobalLayout && isInheritedWidget && item.isOverridden === true
                    const canEditWidget =
                        canManageLayouts &&
                        (isMarketingWidgetKey(item.widgetKey) ? true : !isInheritedWidget) &&
                        (isMarketingWidgetKey(item.widgetKey) ||
                            item.widgetKey === 'menuWidget' ||
                            item.widgetKey === 'columnsContainer' ||
                            item.widgetKey === 'quizWidget' ||
                            item.widgetKey === 'playcanvasCanvas' ||
                            item.widgetKey === 'interpretationNetworkWorkspace' ||
                            isGlobalLayout)

                    return {
                        id: item.id,
                        label: getWidgetChipLabel(item),
                        isActive: item.isActive,
                        draggable: canDragWidget,
                        moveActions: canManageLayouts
                            ? layoutZones
                                  .filter((targetZone) => targetZone !== item.zone)
                                  .map((targetZone) => ({
                                      key: `${item.id}-${targetZone}`,
                                      testId: `layout-widget-move-${item.id}-${targetZone}`,
                                      label: t('layouts.moveToZone', 'Move to {{zone}}', { zone: zoneLabels[targetZone] }),
                                      onClick: () =>
                                          void layoutsApi
                                              .moveLayoutZoneWidget(metahubId, layoutId, {
                                                  widgetId: item.id,
                                                  targetZone,
                                                  targetIndex: zoneToItems[targetZone].length,
                                                  expectedVersion: item.version
                                              })
                                              .then(persistAndRefresh)
                                              .catch((e: unknown) => notifyError(t, enqueueSnackbar, e))
                                  }))
                            : undefined,
                        onRemove: canRemoveWidget ? () => requestRemoveWidget(item.id) : undefined,
                        onDuplicate: canDuplicateWidget ? () => void handleDuplicateWidget(item) : undefined,
                        onReset: canResetWidget ? () => void handleResetWidgetOverride(item) : undefined,
                        onClick: canEditWidget ? () => openWidgetEditor(zone, item) : undefined,
                        onEdit: canEditWidget ? () => openWidgetEditor(zone, item) : undefined,
                        onToggleActive: canToggleWidget ? (active: boolean) => void handleToggleWidgetActive(item.id, active) : undefined,
                        inheritedLabel: isInheritedWidget ? t('layouts.details.inheritedBadge', 'Inherited') : undefined,
                        editTooltip: canEditWidget ? t('common:actions.edit') : undefined,
                        duplicateTooltip: canDuplicateWidget ? t('layouts.actions.duplicate', 'Duplicate') : undefined,
                        duplicateAriaLabel: canDuplicateWidget
                            ? t('layouts.actions.duplicateWidgetNamed', 'Duplicate widget: {{label}}', {
                                  label: getWidgetChipLabel(item)
                              })
                            : undefined,
                        resetTooltip: canResetWidget ? t('layouts.actions.resetOverride', 'Reset override') : undefined,
                        resetAriaLabel: canResetWidget
                            ? t('layouts.actions.resetOverrideWidgetNamed', 'Reset override: {{label}}', {
                                  label: getWidgetChipLabel(item)
                              })
                            : undefined,
                        removeTooltip: canRemoveWidget
                            ? isInheritedWidget
                                ? t('layouts.actions.exclude', 'Exclude')
                                : t('common:actions.delete')
                            : undefined,
                        toggleActiveTooltip:
                            canToggleWidget && item.isActive
                                ? t('layouts.actions.deactivate', 'Deactivate')
                                : canToggleWidget
                                ? t('layouts.actions.activate', 'Activate')
                                : undefined
                    }
                })
            })),
        [
            canManageLayouts,
            getAvailableWidgetsForZone,
            getWidgetChipLabel,
            handleDuplicateWidget,
            handleResetWidgetOverride,
            handleToggleWidgetActive,
            isGlobalLayout,
            openWidgetEditor,
            requestRemoveWidget,
            t,
            widgetLabelByKey,
            zoneLabels,
            zoneToItems,
            enqueueSnackbar,
            layoutId,
            metahubId,
            persistAndRefresh,
            layoutZones
        ]
    )

    if (!metahubId || !layoutId) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography variant='body2'>{t('metahubs:errors.pleaseSelectMetahub', 'Please select a metahub')}</Typography>
            </Box>
        )
    }

    const isLoading = layoutQuery.isLoading || zoneWidgetsQuery.isLoading || widgetObjectsQuery.isLoading || marketingContentQuery.isLoading
    const hasError = layoutQuery.error || zoneWidgetsQuery.error || widgetObjectsQuery.error || marketingContentQuery.error

    return (
        <MainCard content={false} sx={{ maxWidth: '100%', width: '100%', p: 0, gap: 0 }} disableHeader border={false} shadow={false}>
            <Stack spacing={2} sx={{ width: '100%' }}>
                <ViewHeader
                    title={layoutName || t('layouts.details.title', 'Layout')}
                    description={
                        layout?.templateKey === 'marketing-page'
                            ? t(
                                  'layouts.marketing.appearanceDescription',
                                  'Configure the published marketing page without editing its content records.'
                              )
                            : t('layouts.details.description', 'Configure dashboard zones and widgets.')
                    }
                    search={false}
                />

                <Box data-testid='metahub-layout-details-content' sx={{ pb: 2, width: '100%' }}>
                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                            <CircularProgress size={28} />
                        </Box>
                    ) : hasError ? (
                        <Alert
                            severity='error'
                            action={
                                <Button
                                    color='inherit'
                                    size='small'
                                    onClick={() => {
                                        void layoutQuery.refetch()
                                        void zoneWidgetsQuery.refetch()
                                        void widgetObjectsQuery.refetch()
                                        void marketingContentQuery.refetch()
                                    }}
                                >
                                    {t('common:actions.retry', 'Retry')}
                                </Button>
                            }
                        >
                            {t('layouts.zoneErrors.load', 'Failed to load layout zones')}
                        </Alert>
                    ) : (
                        <Stack spacing={2}>
                            <LayoutAuthoringDetails
                                dragHint={t('layouts.details.dragHint', 'Drag widgets between zones to change runtime composition.')}
                                dragHandleLabel={t('layouts.details.dragHandleLabel', 'Reorder widget')}
                                emptyZoneLabel={t('layouts.empty', 'No widgets in this zone yet.')}
                                addWidgetLabel={t('layouts.details.addWidget', 'Add widget')}
                                availableWidgetsLabel={t('layouts.details.widgetObjectsTitle', 'Available widgets')}
                                moveWidgetLabel={t('layouts.moveWidget', 'Move widget')}
                                zones={authoringZones}
                                onDragEnd={handleDragEnd}
                                onAddWidgetRequest={handleAddWidgetRequest}
                                beforeZonesContent={
                                    <LayoutRuntimeSettingsPanel
                                        t={t}
                                        templateKey={layout?.templateKey}
                                        isScopedLayout={Boolean(layout?.scopeEntityId)}
                                        layoutConfig={layoutConfig}
                                        objectBehaviorConfig={objectBehaviorConfig}
                                        sideMenuConfig={sideMenuConfig}
                                        reorderPersistenceFieldDraft={reorderPersistenceFieldDraft}
                                        viewSettingsSaving={viewSettingsSaving}
                                        canManageLayouts={canManageLayouts}
                                        onObjectBehaviorChange={(patch) => void handleObjectBehaviorChange(patch)}
                                        onViewSettingChange={(key, value) => void handleViewSettingChange(key, value)}
                                        onSideMenuConfigChange={(patch) => void handleSideMenuConfigChange(patch)}
                                        onReorderPersistenceFieldDraftChange={setReorderPersistenceFieldDraft}
                                        onCommitReorderPersistenceField={() => void commitReorderPersistenceField()}
                                    />
                                }
                            />
                        </Stack>
                    )}
                </Box>
            </Stack>

            {/* Menu widget editor dialog */}
            <MenuWidgetEditorDialog
                open={menuEditor.open}
                metahubId={metahubId}
                config={menuEditor.config ?? undefined}
                layoutId={layoutId}
                widgetId={menuEditor.widgetId}
                showSharedBehavior={isGlobalLayout}
                showScopeVisibility={isGlobalLayout && Boolean(menuEditor.widgetId)}
                onSave={async (config) => {
                    const zone = menuEditor.zone
                    const widgetId = menuEditor.widgetId
                    if (!zone || !metahubId || !layoutId) return
                    try {
                        let savedWidget: MetahubLayoutZoneWidget
                        if (widgetId) {
                            // Editing existing menuWidget config
                            const response = await layoutsApi.updateLayoutZoneWidgetConfig(
                                metahubId,
                                layoutId,
                                widgetId,
                                config as Record<string, unknown>,
                                getExpectedWidgetVersion(widgetId)
                            )
                            savedWidget = response.data.item
                        } else {
                            // Creating new menuWidget
                            const response = await layoutsApi.assignLayoutZoneWidget(metahubId, layoutId, {
                                zone,
                                widgetKey: 'menuWidget',
                                config: config as Record<string, unknown>,
                                expectedVersion: getExpectedLayoutVersion()
                            })
                            savedWidget = response.data
                        }
                        upsertZoneWidgetInCache(savedWidget)
                        await persistAndRefresh()
                        setMenuEditor({ open: false, zone: null, widgetId: null, config: null })
                    } catch (e: unknown) {
                        notifyError(t, enqueueSnackbar, e)
                    }
                }}
                onCancel={() => setMenuEditor({ open: false, zone: null, widgetId: null, config: null })}
            />

            {/* Columns container editor dialog */}
            <ColumnsContainerEditorDialog
                open={columnsEditor.open}
                config={columnsEditor.config ?? undefined}
                metahubId={metahubId}
                layoutId={layoutId}
                widgetId={columnsEditor.widgetId}
                showSharedBehavior={isGlobalLayout}
                showScopeVisibility={isGlobalLayout && Boolean(columnsEditor.widgetId)}
                onSave={async (config) => {
                    const zone = columnsEditor.zone
                    const widgetId = columnsEditor.widgetId
                    if (!zone || !metahubId || !layoutId) return
                    try {
                        let savedWidget: MetahubLayoutZoneWidget
                        if (widgetId) {
                            const response = await layoutsApi.updateLayoutZoneWidgetConfig(
                                metahubId,
                                layoutId,
                                widgetId,
                                config as Record<string, unknown>,
                                getExpectedWidgetVersion(widgetId)
                            )
                            savedWidget = response.data.item
                        } else {
                            const response = await layoutsApi.assignLayoutZoneWidget(metahubId, layoutId, {
                                zone,
                                widgetKey: 'columnsContainer',
                                config: config as Record<string, unknown>,
                                expectedVersion: getExpectedLayoutVersion()
                            })
                            savedWidget = response.data
                        }
                        upsertZoneWidgetInCache(savedWidget)
                        await persistAndRefresh()
                        setColumnsEditor({ open: false, zone: null, widgetId: null, config: null })
                    } catch (e: unknown) {
                        notifyError(t, enqueueSnackbar, e)
                    }
                }}
                onCancel={() => setColumnsEditor({ open: false, zone: null, widgetId: null, config: null })}
            />

            <QuizWidgetEditorDialog
                open={quizEditor.open}
                metahubId={metahubId}
                config={quizEditor.config ?? undefined}
                layoutId={layoutId}
                widgetId={quizEditor.widgetId}
                showSharedBehavior={isGlobalLayout}
                showScopeVisibility={isGlobalLayout && Boolean(quizEditor.widgetId)}
                onSave={async (config) => {
                    const zone = quizEditor.zone
                    const widgetId = quizEditor.widgetId
                    if (!zone || !metahubId || !layoutId) return
                    try {
                        let savedWidget: MetahubLayoutZoneWidget
                        if (widgetId) {
                            const response = await layoutsApi.updateLayoutZoneWidgetConfig(
                                metahubId,
                                layoutId,
                                widgetId,
                                config as Record<string, unknown>,
                                getExpectedWidgetVersion(widgetId)
                            )
                            savedWidget = response.data.item
                        } else {
                            const response = await layoutsApi.assignLayoutZoneWidget(metahubId, layoutId, {
                                zone,
                                widgetKey: 'quizWidget',
                                config: config as Record<string, unknown>,
                                expectedVersion: getExpectedLayoutVersion()
                            })
                            savedWidget = response.data
                        }
                        upsertZoneWidgetInCache(savedWidget)
                        await persistAndRefresh()
                        setQuizEditor({ open: false, zone: null, widgetId: null, config: null })
                    } catch (e: unknown) {
                        notifyError(t, enqueueSnackbar, e)
                    }
                }}
                onCancel={() => setQuizEditor({ open: false, zone: null, widgetId: null, config: null })}
            />

            <PlayCanvasCanvasWidgetEditorDialog
                open={playCanvasCanvasEditor.open}
                metahubId={metahubId}
                config={playCanvasCanvasEditor.config ?? undefined}
                layoutId={layoutId}
                widgetId={playCanvasCanvasEditor.widgetId}
                showSharedBehavior={isGlobalLayout}
                showScopeVisibility={isGlobalLayout && Boolean(playCanvasCanvasEditor.widgetId)}
                onSave={async (config) => {
                    const zone = playCanvasCanvasEditor.zone
                    const widgetId = playCanvasCanvasEditor.widgetId
                    if (!zone || !metahubId || !layoutId) return
                    try {
                        let savedWidget: MetahubLayoutZoneWidget
                        if (widgetId) {
                            const response = await layoutsApi.updateLayoutZoneWidgetConfig(
                                metahubId,
                                layoutId,
                                widgetId,
                                config as Record<string, unknown>,
                                getExpectedWidgetVersion(widgetId)
                            )
                            savedWidget = response.data.item
                        } else {
                            const response = await layoutsApi.assignLayoutZoneWidget(metahubId, layoutId, {
                                zone,
                                widgetKey: 'playcanvasCanvas',
                                config: config as Record<string, unknown>,
                                expectedVersion: getExpectedLayoutVersion()
                            })
                            savedWidget = response.data
                        }
                        upsertZoneWidgetInCache(savedWidget)
                        await persistAndRefresh()
                        setPlayCanvasCanvasEditor({ open: false, zone: null, widgetId: null, config: null })
                    } catch (e: unknown) {
                        notifyError(t, enqueueSnackbar, e)
                    }
                }}
                onCancel={() => setPlayCanvasCanvasEditor({ open: false, zone: null, widgetId: null, config: null })}
            />

            {interpretationNetworkEditor.open ? (
                <InterpretationNetworkWorkspaceWidgetEditorDialog
                    open={interpretationNetworkEditor.open}
                    config={interpretationNetworkEditor.config ?? undefined}
                    metahubId={metahubId}
                    layoutId={layoutId}
                    widgetId={interpretationNetworkEditor.widgetId}
                    showSharedBehavior={isGlobalLayout}
                    showScopeVisibility={isGlobalLayout && Boolean(interpretationNetworkEditor.widgetId)}
                    onSave={async (config) => {
                        const widgetId = interpretationNetworkEditor.widgetId
                        if (!widgetId || !metahubId || !layoutId) return
                        try {
                            const response = await layoutsApi.updateLayoutZoneWidgetConfig(
                                metahubId,
                                layoutId,
                                widgetId,
                                config as Record<string, unknown>,
                                getExpectedWidgetVersion(widgetId)
                            )
                            upsertZoneWidgetInCache(response.data.item)
                            await persistAndRefresh()
                            setInterpretationNetworkEditor({ open: false, widgetId: null, config: null })
                        } catch (e: unknown) {
                            notifyError(t, enqueueSnackbar, e)
                            throw e
                        }
                    }}
                    onCancel={() => setInterpretationNetworkEditor({ open: false, widgetId: null, config: null })}
                />
            ) : null}

            <WidgetBehaviorEditorDialog
                open={widgetBehaviorEditor.open}
                config={widgetBehaviorEditor.config ?? undefined}
                metahubId={metahubId}
                layoutId={layoutId}
                widgetId={widgetBehaviorEditor.widgetId}
                widgetLabel={widgetBehaviorEditor.widgetLabel}
                showScopeVisibility={isGlobalLayout && Boolean(widgetBehaviorEditor.widgetId)}
                onSave={async (config) => {
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
                        setWidgetBehaviorEditor({ open: false, widgetId: null, widgetLabel: null, config: null })
                    } catch (e: unknown) {
                        notifyError(t, enqueueSnackbar, e)
                    }
                }}
                onCancel={() => setWidgetBehaviorEditor({ open: false, widgetId: null, widgetLabel: null, config: null })}
            />

            {marketingWidgetEditor.open && marketingWidgetEditor.widgetKey ? (
                <MarketingWidgetConfigDialog
                    open={marketingWidgetEditor.open}
                    widgetKey={marketingWidgetEditor.widgetKey}
                    initialConfig={marketingWidgetEditor.config}
                    sourceOptions={marketingSourceOptions}
                    title={widgetLabelByKey[marketingWidgetEditor.widgetKey] ?? marketingWidgetEditor.widgetKey}
                    t={t}
                    onSave={async (config) => {
                        const { widgetId, zone, widgetKey } = marketingWidgetEditor
                        if (!metahubId || !layoutId || !zone || !widgetKey) return
                        try {
                            if (widgetId) {
                                const response = await layoutsApi.updateLayoutZoneWidgetConfig(
                                    metahubId,
                                    layoutId,
                                    widgetId,
                                    config,
                                    getExpectedWidgetVersion(widgetId)
                                )
                                upsertZoneWidgetInCache(response.data.item)
                            } else {
                                const response = await layoutsApi.assignLayoutZoneWidget(metahubId, layoutId, {
                                    zone,
                                    widgetKey,
                                    config,
                                    expectedVersion: getExpectedLayoutVersion()
                                })
                                upsertZoneWidgetInCache(response.data)
                            }
                            await persistAndRefresh()
                            setMarketingWidgetEditor({ open: false, zone: null, widgetId: null, widgetKey: null, config: null })
                        } catch (e: unknown) {
                            notifyError(t, enqueueSnackbar, e)
                            throw e
                        }
                    }}
                    onCancel={() => setMarketingWidgetEditor({ open: false, zone: null, widgetId: null, widgetKey: null, config: null })}
                />
            ) : null}

            <ConfirmDeleteDialog
                open={Boolean(removeWidgetId)}
                title={t('layouts.details.removeWidgetTitle', 'Remove widget?')}
                description={t(
                    'layouts.details.removeWidgetDescription',
                    'The widget will be removed from this layout. This does not delete its content records.'
                )}
                confirmButtonText={t('layouts.details.removeWidgetConfirm', 'Remove')}
                deletingButtonText={t('layouts.details.removingWidget', 'Removing...')}
                cancelButtonText={t('common:actions.cancel', 'Cancel')}
                error={removeWidgetError ?? undefined}
                onCancel={() => {
                    setRemoveWidgetId(null)
                    setRemoveWidgetError(null)
                }}
                onConfirm={confirmRemoveWidget}
            />
        </MainCard>
    )
}
