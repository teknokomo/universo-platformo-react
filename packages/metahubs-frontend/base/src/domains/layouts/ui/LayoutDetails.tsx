import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import {
    Box,
    CircularProgress,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    TextField,
    Typography
} from '@mui/material'
import { DragEndEvent } from '@dnd-kit/core'
import type {
    LinkedCollectionRuntimeViewConfig,
    DashboardLayoutZone,
    DashboardLayoutWidgetKey,
    MenuWidgetConfig,
    ColumnsContainerConfig,
    QuizWidgetConfig
} from '@universo/types'
import { DASHBOARD_LAYOUT_ZONES } from '@universo/types'
import { LayoutAuthoringDetails, TemplateMainCard as MainCard, ViewHeaderMUI as ViewHeader, notifyError } from '@universo/template-mui'
import {
    extractLinkedCollectionLayoutBehaviorConfig,
    normalizeLinkedCollectionRuntimeViewConfig,
    setLinkedCollectionLayoutBehaviorConfig
} from '@universo/utils'

import { metahubsQueryKeys, invalidateLayoutsQueries } from '../../shared'
import { useMetahubDetails } from '../../metahubs/hooks'
import * as layoutsApi from '../api'
import type { Metahub, MetahubLayout, MetahubLayoutZoneWidget, DashboardLayoutWidgetCatalogItem } from '../../../types'
import { getVLCString, normalizeLocale } from '../../../types'
import MenuWidgetEditorDialog from './MenuWidgetEditorDialog'
import ColumnsContainerEditorDialog from './ColumnsContainerEditorDialog'
import QuizWidgetEditorDialog from './QuizWidgetEditorDialog'
import WidgetBehaviorEditorDialog from './WidgetBehaviorEditorDialog'
import { getSharedBehaviorFromWidgetConfig } from './LayoutWidgetSharedBehaviorFields'

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

type WidgetBehaviorEditorState = {
    open: boolean
    widgetId: string | null
    config: Record<string, unknown> | null
}

const EMPTY_ZONE_WIDGETS: MetahubLayoutZoneWidget[] = []
const EMPTY_WIDGET_CATALOG: DashboardLayoutWidgetCatalogItem[] = []

export default function LayoutDetails() {
    const { metahubId, layoutId } = useParams<{ metahubId: string; layoutId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const metahubDetailsQuery = useMetahubDetails(metahubId ?? '', { enabled: Boolean(metahubId) })
    const [menuEditor, setMenuEditor] = useState<MenuEditorState>({ open: false, zone: null, widgetId: null, config: null })
    const [columnsEditor, setColumnsEditor] = useState<ColumnsEditorState>({ open: false, zone: null, widgetId: null, config: null })
    const [quizEditor, setQuizEditor] = useState<QuizEditorState>({ open: false, zone: null, widgetId: null, config: null })
    const [widgetBehaviorEditor, setWidgetBehaviorEditor] = useState<WidgetBehaviorEditorState>({
        open: false,
        widgetId: null,
        config: null
    })
    const [viewSettingsSaving, setViewSettingsSaving] = useState(false)

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

    const widgetCatalogQuery = useQuery({
        queryKey: metahubId && layoutId ? metahubsQueryKeys.layoutZoneWidgetsCatalog(metahubId, layoutId) : ['layout-zone-catalog-empty'],
        enabled: Boolean(metahubId && layoutId),
        queryFn: async () => layoutsApi.getLayoutZoneWidgetsCatalog(String(metahubId), String(layoutId))
    })

    const cachedMetahub = metahubId ? queryClient.getQueryData<Metahub>(metahubsQueryKeys.detail(metahubId)) : undefined
    const canManageLayouts = (metahubDetailsQuery.data?.permissions ?? cachedMetahub?.permissions)?.manageMetahub === true
    const layout = layoutQuery.data as MetahubLayout | undefined
    const zoneWidgets = zoneWidgetsQuery.data ?? EMPTY_ZONE_WIDGETS
    const widgetCatalog = widgetCatalogQuery.data ?? EMPTY_WIDGET_CATALOG
    const isGlobalLayout = layout?.linkedCollectionId == null
    const uiLocale = normalizeLocale(i18n.language)
    const layoutName = layout ? getVLCString(layout.name, uiLocale) || getVLCString(layout.name, 'en') || layout.templateKey : ''
    const catalogBehaviorConfig = useMemo(
        () => normalizeLinkedCollectionRuntimeViewConfig(extractLinkedCollectionLayoutBehaviorConfig(layout?.config)),
        [layout?.config]
    )
    const [reorderPersistenceFieldDraft, setReorderPersistenceFieldDraft] = useState('')

    useEffect(() => {
        setReorderPersistenceFieldDraft(catalogBehaviorConfig.reorderPersistenceField ?? '')
    }, [catalogBehaviorConfig.reorderPersistenceField])

    const zoneToItems = useMemo(() => {
        const initial = DASHBOARD_LAYOUT_ZONES.reduce((acc, zone) => {
            acc[zone] = []
            return acc
        }, {} as Record<DashboardLayoutZone, MetahubLayoutZoneWidget[]>)

        for (const item of zoneWidgets) {
            if (!initial[item.zone]) continue
            initial[item.zone].push(item)
        }
        for (const zone of DASHBOARD_LAYOUT_ZONES) {
            initial[zone].sort((a, b) => a.sortOrder - b.sortOrder)
        }
        return initial
    }, [zoneWidgets])

    const widgetLabelByKey = useMemo(() => {
        const labels: Record<string, string> = {}
        for (const item of widgetCatalog) {
            labels[item.key] = t(`layouts.widgets.${item.key}`, item.key)
        }
        return labels
    }, [widgetCatalog, t])

    const zoneLabels = useMemo<Record<DashboardLayoutZone, string>>(
        () => ({
            left: t('layouts.zones.left', 'Left zone'),
            top: t('layouts.zones.top', 'Top zone'),
            center: t('layouts.zones.center', 'Center zone'),
            right: t('layouts.zones.right', 'Right zone'),
            bottom: t('layouts.zones.bottom', 'Bottom zone')
        }),
        [t]
    )

    const allAssignedWidgetKeys = useMemo(() => new Set(zoneWidgets.map((item) => item.widgetKey)), [zoneWidgets])

    const openWidgetEditor = useCallback(
        (zone: DashboardLayoutZone, item: MetahubLayoutZoneWidget) => {
            if (item.isInherited) {
                return
            }
            if (item.widgetKey === 'menuWidget') {
                setMenuEditor({
                    open: true,
                    zone,
                    widgetId: item.id,
                    config: (item.config as MenuWidgetConfig) ?? null
                })
                return
            }
            if (item.widgetKey === 'columnsContainer') {
                setColumnsEditor({
                    open: true,
                    zone,
                    widgetId: item.id,
                    config: (item.config as ColumnsContainerConfig) ?? null
                })
                return
            }
            if (item.widgetKey === 'quizWidget') {
                setQuizEditor({
                    open: true,
                    zone,
                    widgetId: item.id,
                    config: (item.config as QuizWidgetConfig) ?? null
                })
                return
            }
            if (isGlobalLayout) {
                setWidgetBehaviorEditor({
                    open: true,
                    widgetId: item.id,
                    config:
                        item.config && typeof item.config === 'object' && !Array.isArray(item.config)
                            ? { ...(item.config as Record<string, unknown>) }
                            : {}
                })
            }
        },
        [isGlobalLayout]
    )

    /** Build a chip label: for menuWidget append the resolved menu title, for columnsContainer list inner widgets. */
    const getWidgetChipLabel = useCallback(
        (widget: MetahubLayoutZoneWidget): string => {
            const base = widgetLabelByKey[widget.widgetKey] || widget.widgetKey
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
                    .flatMap((col) => (col.widgets ?? []).map((w) => widgetLabelByKey[w.widgetKey] || w.widgetKey))
                    .join(', ')
                return `${base}: ${innerNames}`
            }
            if (widget.widgetKey === 'quizWidget') {
                const cfg = widget.config as QuizWidgetConfig | undefined
                const configuredScriptCodename = typeof cfg?.scriptCodename === 'string' ? cfg.scriptCodename.trim() : ''
                return configuredScriptCodename ? `${base}: ${configuredScriptCodename}` : base
            }
            return base
        },
        [uiLocale, widgetLabelByKey]
    )

    const getAvailableWidgetsForZone = useCallback(
        (zone: DashboardLayoutZone): DashboardLayoutWidgetCatalogItem[] => {
            return widgetCatalog.filter((widgetItem) => {
                // Multi-instance widgets are always available for adding
                if (!widgetItem.multiInstance && allAssignedWidgetKeys.has(widgetItem.key)) return false
                return widgetItem.allowedZones.includes(zone)
            })
        },
        [allAssignedWidgetKeys, widgetCatalog]
    )

    const persistAndRefresh = useCallback(async () => {
        if (!metahubId || !layoutId) return
        if (layout?.linkedCollectionId == null) {
            await invalidateLayoutsQueries.all(queryClient, metahubId)
            return
        }
        await invalidateLayoutsQueries.detail(queryClient, metahubId, layoutId)
        await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId) })
    }, [layout?.linkedCollectionId, layoutId, metahubId, queryClient])

    const upsertZoneWidgetInCache = (nextWidget: MetahubLayoutZoneWidget) => {
        if (!metahubId || !layoutId) return
        const zoneWidgetsKey = metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId)
        const zoneOrder: Record<DashboardLayoutZone, number> = {
            left: 0,
            top: 1,
            center: 2,
            right: 3,
            bottom: 4
        }

        queryClient.setQueryData<MetahubLayoutZoneWidget[]>(zoneWidgetsKey, (prev) => {
            const current = Array.isArray(prev) ? [...prev] : []
            const existingIndex = current.findIndex((item) => item.id === nextWidget.id)
            if (existingIndex >= 0) {
                current[existingIndex] = nextWidget
            } else {
                current.push(nextWidget)
            }
            current.sort((a, b) => {
                if (a.zone !== b.zone) return zoneOrder[a.zone] - zoneOrder[b.zone]
                return a.sortOrder - b.sortOrder
            })
            return current
        })
    }

    const persistLayoutConfig = useCallback(
        async (nextConfig: Record<string, unknown>) => {
            if (!metahubId || !layoutId) return
            await layoutsApi.updateLayout(metahubId, layoutId, { config: nextConfig })
            if (layout?.linkedCollectionId == null) {
                await invalidateLayoutsQueries.all(queryClient, metahubId)
                return
            }
            await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layoutDetail(metahubId, layoutId) })
        },
        [layout?.linkedCollectionId, layoutId, metahubId, queryClient]
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

    const handleCatalogBehaviorChange = useCallback(
        async (patch: Partial<LinkedCollectionRuntimeViewConfig>) => {
            if (!layout || !canManageLayouts) return
            setViewSettingsSaving(true)
            try {
                const currentBehaviorConfig = extractLinkedCollectionLayoutBehaviorConfig(layout.config) ?? {}
                await persistLayoutConfig(setLinkedCollectionLayoutBehaviorConfig(layout.config, { ...currentBehaviorConfig, ...patch }))
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
        const currentValue = catalogBehaviorConfig.reorderPersistenceField ?? ''

        if (normalizedValue === currentValue) {
            return
        }

        await handleCatalogBehaviorChange({
            reorderPersistenceField: normalizedValue || null
        })
    }, [canManageLayouts, catalogBehaviorConfig.reorderPersistenceField, handleCatalogBehaviorChange, layout, reorderPersistenceFieldDraft])

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
            const zoneValue = overId.replace('zone:', '') as DashboardLayoutZone
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

        const optimistic = [...zoneWidgets]
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
            for (const zone of DASHBOARD_LAYOUT_ZONES) {
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
                targetIndex
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
            if (currentItem?.isInherited && !getSharedBehaviorFromWidgetConfig(currentItem.config).canExclude) {
                return
            }
            try {
                await layoutsApi.removeLayoutZoneWidget(metahubId, layoutId, widgetId)
                await persistAndRefresh()
            } catch (e: unknown) {
                notifyError(t, enqueueSnackbar, e)
            }
        },
        [canManageLayouts, enqueueSnackbar, layoutId, metahubId, persistAndRefresh, t, zoneWidgets]
    )

    const handleAddWidget = useCallback(
        async (zone: DashboardLayoutZone, widgetKey: DashboardLayoutWidgetKey, config?: Record<string, unknown>) => {
            if (!metahubId || !layoutId || !canManageLayouts) return
            try {
                await layoutsApi.assignLayoutZoneWidget(metahubId, layoutId, {
                    zone,
                    widgetKey,
                    ...(config ? { config } : {})
                })
                await persistAndRefresh()
            } catch (e: unknown) {
                notifyError(t, enqueueSnackbar, e)
            }
        },
        [canManageLayouts, enqueueSnackbar, layoutId, metahubId, persistAndRefresh, t]
    )

    const handleAddWidgetRequest = useCallback(
        (zone: DashboardLayoutZone, widgetKey: DashboardLayoutWidgetKey) => {
            if (!canManageLayouts) {
                return
            }
            if (widgetKey === 'menuWidget') {
                setMenuEditor({ open: true, zone, widgetId: null, config: null })
                return
            }
            if (widgetKey === 'columnsContainer') {
                setColumnsEditor({ open: true, zone, widgetId: null, config: null })
                return
            }
            if (widgetKey === 'quizWidget') {
                setQuizEditor({ open: true, zone, widgetId: null, config: null })
                return
            }
            void handleAddWidget(zone, widgetKey)
        },
        [canManageLayouts, handleAddWidget]
    )

    const handleToggleWidgetActive = useCallback(
        async (widgetId: string, isActive: boolean) => {
            if (!metahubId || !layoutId || !canManageLayouts) return
            const currentItem = zoneWidgets.find((item) => item.id === widgetId)
            if (currentItem?.isInherited && !getSharedBehaviorFromWidgetConfig(currentItem.config).canDeactivate) {
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
                await layoutsApi.toggleLayoutZoneWidgetActive(metahubId, layoutId, widgetId, isActive)
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
            DASHBOARD_LAYOUT_ZONES.map((zone) => ({
                zone,
                title: zoneLabels[zone],
                addDisabled: !canManageLayouts,
                availableWidgets: getAvailableWidgetsForZone(zone).map((widgetItem) => ({
                    key: widgetItem.key,
                    label: widgetLabelByKey[widgetItem.key] || widgetItem.key
                })),
                items: zoneToItems[zone].map((item) => {
                    const isInheritedWidget = item.isInherited === true
                    const sharedBehavior = getSharedBehaviorFromWidgetConfig(item.config)
                    const canDragWidget = canManageLayouts && (!isInheritedWidget || !sharedBehavior.positionLocked)
                    const canToggleWidget = canManageLayouts && (!isInheritedWidget || sharedBehavior.canDeactivate)
                    const canRemoveWidget = canManageLayouts && (!isInheritedWidget || sharedBehavior.canExclude)
                    const canEditWidget =
                        canManageLayouts &&
                        !isInheritedWidget &&
                        (item.widgetKey === 'menuWidget' ||
                            item.widgetKey === 'columnsContainer' ||
                            item.widgetKey === 'quizWidget' ||
                            isGlobalLayout)

                    return {
                        id: item.id,
                        label: getWidgetChipLabel(item),
                        isActive: item.isActive,
                        draggable: canDragWidget,
                        moveActions: canManageLayouts
                            ? DASHBOARD_LAYOUT_ZONES.filter((targetZone) => targetZone !== item.zone).map((targetZone) => ({
                                  key: `${item.id}-${targetZone}`,
                                  testId: `layout-widget-move-${item.id}-${targetZone}`,
                                  label: t('layouts.moveToZone', 'Move to {{zone}}', { zone: zoneLabels[targetZone] }),
                                  onClick: () =>
                                      void layoutsApi
                                          .moveLayoutZoneWidget(metahubId, layoutId, {
                                              widgetId: item.id,
                                              targetZone,
                                              targetIndex: zoneToItems[targetZone].length
                                          })
                                          .then(persistAndRefresh)
                                          .catch((e: unknown) => notifyError(t, enqueueSnackbar, e))
                              }))
                            : undefined,
                        onRemove: canRemoveWidget ? () => void handleRemoveWidget(item.id) : undefined,
                        onClick: canEditWidget ? () => openWidgetEditor(zone, item) : undefined,
                        onEdit: canEditWidget ? () => openWidgetEditor(zone, item) : undefined,
                        onToggleActive: canToggleWidget ? (active: boolean) => void handleToggleWidgetActive(item.id, active) : undefined,
                        inheritedLabel: isInheritedWidget ? t('layouts.details.inheritedBadge', 'Inherited') : undefined,
                        editTooltip: canEditWidget ? t('common:actions.edit') : undefined,
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
            handleRemoveWidget,
            handleToggleWidgetActive,
            isGlobalLayout,
            openWidgetEditor,
            t,
            widgetLabelByKey,
            zoneLabels,
            zoneToItems,
            enqueueSnackbar,
            layoutId,
            metahubId,
            persistAndRefresh
        ]
    )

    if (!metahubId || !layoutId) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography variant='body2'>{t('metahubs:errors.pleaseSelectMetahub', 'Please select a metahub')}</Typography>
            </Box>
        )
    }

    const isLoading = layoutQuery.isLoading || zoneWidgetsQuery.isLoading || widgetCatalogQuery.isLoading
    const hasError = layoutQuery.error || zoneWidgetsQuery.error || widgetCatalogQuery.error

    return (
        <MainCard content={false} sx={{ maxWidth: '100%', width: '100%', p: 0, gap: 0 }} disableHeader border={false} shadow={false}>
            <Stack spacing={2} sx={{ width: '100%' }}>
                <ViewHeader
                    title={layoutName || t('layouts.details.title', 'Layout')}
                    description={t('layouts.details.description', 'Configure dashboard zones and widgets.')}
                    search={false}
                />

                <Box data-testid='metahub-layout-details-content' sx={{ pb: 2, width: '100%' }}>
                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                            <CircularProgress size={28} />
                        </Box>
                    ) : hasError ? (
                        <Typography color='error'>{t('layouts.zoneErrors.load', 'Failed to load layout zones')}</Typography>
                    ) : (
                        <Stack spacing={2}>
                            <LayoutAuthoringDetails
                                dragHint={t('layouts.details.dragHint', 'Drag widgets between zones to change runtime composition.')}
                                emptyZoneLabel={t('layouts.empty', 'No layouts yet')}
                                addWidgetLabel={t('layouts.details.addWidget', 'Add widget')}
                                availableWidgetsLabel={t('layouts.details.widgetCatalogTitle', 'Available widgets')}
                                moveWidgetLabel={t('layouts.moveWidget', 'Move widget')}
                                zones={authoringZones}
                                onDragEnd={handleDragEnd}
                                onAddWidgetRequest={handleAddWidgetRequest}
                                beforeZonesContent={
                                    <Fragment>
                                        <Paper variant='outlined' sx={{ p: 2 }}>
                                            <Typography variant='subtitle1' sx={{ mb: 1.5 }}>
                                                {layout?.linkedCollectionId
                                                    ? t(
                                                          'layouts.details.catalogBehaviorTitleCatalog',
                                                          'LinkedCollectionEntity runtime behavior'
                                                      )
                                                    : t('layouts.details.catalogBehaviorTitleGlobal', 'Default catalog runtime behavior')}
                                            </Typography>
                                            <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                                                {layout?.linkedCollectionId
                                                    ? t(
                                                          'layouts.details.catalogBehaviorDescriptionCatalog',
                                                          'This catalog layout overrides the create/search behavior inherited from its global base layout.'
                                                      )
                                                    : t(
                                                          'layouts.details.catalogBehaviorDescriptionGlobal',
                                                          'These settings define the default create/search behavior for linkedCollections that use this global layout until a catalog-specific layout overrides it.'
                                                      )}
                                            </Typography>
                                            <Stack spacing={1.5}>
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={catalogBehaviorConfig.showCreateButton}
                                                            disabled={viewSettingsSaving || !canManageLayouts}
                                                            onChange={(_, checked) =>
                                                                void handleCatalogBehaviorChange({ showCreateButton: checked })
                                                            }
                                                        />
                                                    }
                                                    label={t('catalogs.runtime.showCreateButton', 'Show create button')}
                                                />
                                                <FormControl size='small' sx={{ minWidth: 220 }}>
                                                    <InputLabel>{t('catalogs.runtime.searchMode', 'Search mode')}</InputLabel>
                                                    <Select
                                                        value={catalogBehaviorConfig.searchMode}
                                                        label={t('catalogs.runtime.searchMode', 'Search mode')}
                                                        disabled={viewSettingsSaving || !canManageLayouts}
                                                        onChange={(event) =>
                                                            void handleCatalogBehaviorChange({
                                                                searchMode: event.target
                                                                    .value as LinkedCollectionRuntimeViewConfig['searchMode']
                                                            })
                                                        }
                                                    >
                                                        <MenuItem value='page-local'>
                                                            {t('catalogs.runtime.searchModePageLocal', 'Page-local')}
                                                        </MenuItem>
                                                        <MenuItem value='server'>
                                                            {t('catalogs.runtime.searchModeServer', 'Server')}
                                                        </MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <FormControl size='small' sx={{ minWidth: 220 }}>
                                                    <InputLabel>{t('catalogs.runtime.createSurface', 'Create form type')}</InputLabel>
                                                    <Select
                                                        value={catalogBehaviorConfig.createSurface}
                                                        label={t('catalogs.runtime.createSurface', 'Create form type')}
                                                        disabled={viewSettingsSaving || !canManageLayouts}
                                                        onChange={(event) =>
                                                            void handleCatalogBehaviorChange({
                                                                createSurface: event.target
                                                                    .value as LinkedCollectionRuntimeViewConfig['createSurface']
                                                            })
                                                        }
                                                    >
                                                        <MenuItem value='dialog'>{t('catalogs.runtime.surfaceDialog', 'Dialog')}</MenuItem>
                                                        <MenuItem value='page'>{t('catalogs.runtime.surfacePage', 'Page')}</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <FormControl size='small' sx={{ minWidth: 220 }}>
                                                    <InputLabel>{t('catalogs.runtime.editSurface', 'Edit form type')}</InputLabel>
                                                    <Select
                                                        value={catalogBehaviorConfig.editSurface}
                                                        label={t('catalogs.runtime.editSurface', 'Edit form type')}
                                                        disabled={viewSettingsSaving || !canManageLayouts}
                                                        onChange={(event) =>
                                                            void handleCatalogBehaviorChange({
                                                                editSurface: event.target
                                                                    .value as LinkedCollectionRuntimeViewConfig['editSurface']
                                                            })
                                                        }
                                                    >
                                                        <MenuItem value='dialog'>{t('catalogs.runtime.surfaceDialog', 'Dialog')}</MenuItem>
                                                        <MenuItem value='page'>{t('catalogs.runtime.surfacePage', 'Page')}</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <FormControl size='small' sx={{ minWidth: 220 }}>
                                                    <InputLabel>{t('catalogs.runtime.copySurface', 'Copy form type')}</InputLabel>
                                                    <Select
                                                        value={catalogBehaviorConfig.copySurface}
                                                        label={t('catalogs.runtime.copySurface', 'Copy form type')}
                                                        disabled={viewSettingsSaving || !canManageLayouts}
                                                        onChange={(event) =>
                                                            void handleCatalogBehaviorChange({
                                                                copySurface: event.target
                                                                    .value as LinkedCollectionRuntimeViewConfig['copySurface']
                                                            })
                                                        }
                                                    >
                                                        <MenuItem value='dialog'>{t('catalogs.runtime.surfaceDialog', 'Dialog')}</MenuItem>
                                                        <MenuItem value='page'>{t('catalogs.runtime.surfacePage', 'Page')}</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={catalogBehaviorConfig.enableRowReordering}
                                                            disabled={viewSettingsSaving || !canManageLayouts}
                                                            onChange={(_, checked) =>
                                                                void handleCatalogBehaviorChange({
                                                                    enableRowReordering: checked
                                                                })
                                                            }
                                                        />
                                                    }
                                                    label={t('catalogs.runtime.enableRowReordering', 'Enable row reordering')}
                                                />
                                                <TextField
                                                    size='small'
                                                    label={t('catalogs.runtime.reorderPersistenceField', 'Reorder persistence field')}
                                                    value={reorderPersistenceFieldDraft}
                                                    disabled={
                                                        viewSettingsSaving ||
                                                        !canManageLayouts ||
                                                        !catalogBehaviorConfig.enableRowReordering
                                                    }
                                                    helperText={t(
                                                        'catalogs.runtime.reorderPersistenceFieldHelper',
                                                        'Enter the numeric field codename or column key that stores the persisted row order, for example sort_order.'
                                                    )}
                                                    onChange={(event) => setReorderPersistenceFieldDraft(event.target.value)}
                                                    onBlur={() => void commitReorderPersistenceField()}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter') {
                                                            event.preventDefault()
                                                            void commitReorderPersistenceField()
                                                        }
                                                    }}
                                                />
                                            </Stack>
                                        </Paper>
                                        <Paper variant='outlined' sx={{ p: 2 }}>
                                            <Typography variant='subtitle1' sx={{ mb: 1.5 }}>
                                                {t('layouts.details.viewSettings', 'Application View Settings')}
                                            </Typography>
                                            <Stack spacing={1.5}>
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={Boolean(layout?.config?.showViewToggle)}
                                                            disabled={viewSettingsSaving || !canManageLayouts}
                                                            onChange={(_, checked) =>
                                                                void handleViewSettingChange('showViewToggle', checked)
                                                            }
                                                        />
                                                    }
                                                    label={t('layouts.details.showViewToggle', 'Card/table view toggle')}
                                                />
                                                <FormControl size='small' sx={{ minWidth: 180 }}>
                                                    <InputLabel>{t('layouts.details.defaultViewMode', 'Default view mode')}</InputLabel>
                                                    <Select
                                                        value={(layout?.config?.defaultViewMode as string) || 'table'}
                                                        label={t('layouts.details.defaultViewMode', 'Default view mode')}
                                                        disabled={viewSettingsSaving || !canManageLayouts}
                                                        onChange={(e) => void handleViewSettingChange('defaultViewMode', e.target.value)}
                                                    >
                                                        <MenuItem value='table'>{t('layouts.details.viewModeTable', 'Table')}</MenuItem>
                                                        <MenuItem value='card'>{t('layouts.details.viewModeCard', 'Card')}</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={Boolean(layout?.config?.showFilterBar)}
                                                            disabled={viewSettingsSaving || !canManageLayouts}
                                                            onChange={(_, checked) =>
                                                                void handleViewSettingChange('showFilterBar', checked)
                                                            }
                                                        />
                                                    }
                                                    label={t('layouts.details.showFilterBar', 'Search/filter bar')}
                                                />
                                                <FormControl size='small' sx={{ minWidth: 180 }}>
                                                    <InputLabel>{t('layouts.details.cardColumns', 'Card columns')}</InputLabel>
                                                    <Select
                                                        value={Number(layout?.config?.cardColumns) || 3}
                                                        label={t('layouts.details.cardColumns', 'Card columns')}
                                                        disabled={viewSettingsSaving || !canManageLayouts}
                                                        onChange={(e) =>
                                                            void handleViewSettingChange('cardColumns', Number(e.target.value))
                                                        }
                                                    >
                                                        <MenuItem value={2}>2</MenuItem>
                                                        <MenuItem value={3}>3</MenuItem>
                                                        <MenuItem value={4}>4</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <FormControl size='small' sx={{ minWidth: 180 }}>
                                                    <InputLabel>{t('layouts.details.rowHeight', 'Row height')}</InputLabel>
                                                    <Select
                                                        value={String(layout?.config?.rowHeight ?? 'compact')}
                                                        label={t('layouts.details.rowHeight', 'Row height')}
                                                        disabled={viewSettingsSaving || !canManageLayouts}
                                                        onChange={(e) => {
                                                            const v = e.target.value
                                                            const val = v === 'compact' ? undefined : v === 'auto' ? 'auto' : Number(v)
                                                            void handleViewSettingChange('rowHeight', val)
                                                        }}
                                                    >
                                                        <MenuItem value='compact'>
                                                            {t('layouts.details.rowHeightCompact', 'Compact (default)')}
                                                        </MenuItem>
                                                        <MenuItem value='52'>
                                                            {t('layouts.details.rowHeightNormal', 'Normal (52px)')}
                                                        </MenuItem>
                                                        <MenuItem value='auto'>
                                                            {t('layouts.details.rowHeightAuto', 'Auto (multi-line)')}
                                                        </MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Stack>
                                        </Paper>
                                    </Fragment>
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
                showSharedBehavior={isGlobalLayout}
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
                                config as Record<string, unknown>
                            )
                            savedWidget = response.data.item
                        } else {
                            // Creating new menuWidget
                            const response = await layoutsApi.assignLayoutZoneWidget(metahubId, layoutId, {
                                zone,
                                widgetKey: 'menuWidget',
                                config: config as Record<string, unknown>
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
                showSharedBehavior={isGlobalLayout}
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
                                config as Record<string, unknown>
                            )
                            savedWidget = response.data.item
                        } else {
                            const response = await layoutsApi.assignLayoutZoneWidget(metahubId, layoutId, {
                                zone,
                                widgetKey: 'columnsContainer',
                                config: config as Record<string, unknown>
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
                showSharedBehavior={isGlobalLayout}
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
                                config as Record<string, unknown>
                            )
                            savedWidget = response.data.item
                        } else {
                            const response = await layoutsApi.assignLayoutZoneWidget(metahubId, layoutId, {
                                zone,
                                widgetKey: 'quizWidget',
                                config: config as Record<string, unknown>
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

            <WidgetBehaviorEditorDialog
                open={widgetBehaviorEditor.open}
                config={widgetBehaviorEditor.config ?? undefined}
                onSave={async (config) => {
                    const widgetId = widgetBehaviorEditor.widgetId
                    if (!widgetId || !metahubId || !layoutId) return
                    try {
                        const response = await layoutsApi.updateLayoutZoneWidgetConfig(metahubId, layoutId, widgetId, config)
                        upsertZoneWidgetInCache(response.data.item)
                        await persistAndRefresh()
                        setWidgetBehaviorEditor({ open: false, widgetId: null, config: null })
                    } catch (e: unknown) {
                        notifyError(t, enqueueSnackbar, e)
                    }
                }}
                onCancel={() => setWidgetBehaviorEditor({ open: false, widgetId: null, config: null })}
            />
        </MainCard>
    )
}
