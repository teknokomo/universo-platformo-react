import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { useCommonTranslations } from '@universo-react/i18n'
import { DragEndEvent } from '@dnd-kit/core'
import type {
    ObjectCollectionRuntimeViewConfig,
    ApplicationLayoutZone,
    ApplicationLayoutWidgetKey,
    ResolvedDashboardLayoutConfig,
    DashboardSideMenuConfig,
    LayoutPosition,
    LayoutLogicalPlacement
} from '@universo-react/types'
import { DASHBOARD_LAYOUT_ZONES, getLayoutWidgetAllowedZones, MARKETING_LAYOUT_ZONES } from '@universo-react/types'
import {
    LayoutAuthoringDetails,
    LayoutZoneSettingsDialog,
    TemplateMainCard as MainCard,
    ViewHeaderMUI as ViewHeader,
    notifyError,
    useConfirm
} from '@universo-react/template-mui'
import { ConfirmDeleteDialog } from '@universo-react/template-mui/components/dialogs'
import {
    extractObjectCollectionLayoutBehaviorConfig,
    normalizeObjectCollectionRuntimeViewConfig,
    setObjectCollectionLayoutBehaviorConfig
} from '@universo-react/utils'

import { metahubsQueryKeys, invalidateLayoutsQueries } from '../../shared'
import { useMetahubDetails } from '../../metahubs/hooks'
import * as layoutsApi from '../api'
import type { Metahub, MetahubLayout, MetahubLayoutZoneWidget } from '../../../types'
import { getVLCString } from '../../../types'
import { getSharedBehaviorFromWidgetConfig } from './LayoutWidgetSharedBehaviorFields'
import LayoutRuntimeSettingsPanel from './LayoutRuntimeSettingsPanel'
import LayoutWidgetEditorDialogs from './LayoutWidgetEditorDialogs'
import {
    buildMarketingHeaderDialogSettings,
    EMPTY_WIDGET_OBJECTS,
    EMPTY_ZONE_WIDGETS,
    getMarketingRendererConfig,
    getWidgetDropIndex,
    isMarketingWidgetKey,
    LAYOUT_ZONES_BY_TEMPLATE,
    LAYOUT_ZONE_ORDER,
    marketingHeaderSettingDefinition,
    normalizeEditableSideMenuConfig,
    readMarketingHeaderPosition,
    readWidgetPlacement
} from './layoutDetailsWidgetAuthoringModel'
import { useLayoutWidgetAuthoring } from './useLayoutWidgetAuthoring'
import { useLayoutAuthoringZones } from './useLayoutAuthoringZones'

export default function LayoutDetails() {
    const { metahubId, layoutId } = useParams<{ metahubId: string; layoutId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const uiLocale = i18n.resolvedLanguage ?? i18n.language
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()
    const { confirm } = useConfirm()
    const notifyLayoutError = useCallback(
        (error: unknown) => notifyError((key, fallback) => String(t(key, { defaultValue: fallback })), enqueueSnackbar, error),
        [enqueueSnackbar, t]
    )
    const queryClient = useQueryClient()
    const metahubDetailsQuery = useMetahubDetails(metahubId ?? '', { enabled: Boolean(metahubId) })
    const [viewSettingsSaving, setViewSettingsSaving] = useState(false)
    const [removeWidgetId, setRemoveWidgetId] = useState<string | null>(null)
    const [removeWidgetError, setRemoveWidgetError] = useState<string | null>(null)
    const [zoneSettingsOpen, setZoneSettingsOpen] = useState(false)
    const [zoneSettingsError, setZoneSettingsError] = useState<string | null>(null)
    const [zoneSettingsSaving, setZoneSettingsSaving] = useState(false)

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
        queryFn: async () => {
            const widgets = await layoutsApi.listLayoutZoneWidgets(String(metahubId), String(layoutId))
            return widgets.map((widget) =>
                isMarketingWidgetKey(widget.widgetKey) ? { ...widget, config: getMarketingRendererConfig(widget) } : widget
            )
        }
    })

    const widgetObjectsQuery = useQuery({
        queryKey: metahubId && layoutId ? metahubsQueryKeys.layoutZoneWidgetObjects(metahubId, layoutId) : ['layout-zone-objects-empty'],
        enabled: Boolean(metahubId && layoutId),
        queryFn: async () => layoutsApi.getLayoutZoneWidgetObjects(String(metahubId), String(layoutId))
    })
    const cachedMetahub = metahubId ? queryClient.getQueryData<Metahub>(metahubsQueryKeys.detail(metahubId)) : undefined
    const metahubPermissions = metahubDetailsQuery.data?.permissions ?? cachedMetahub?.permissions
    const canManageLayouts = metahubPermissions?.manageMetahub === true
    const canEditContent = metahubPermissions?.editContent === true
    const layout = layoutQuery.data as MetahubLayout | undefined
    const zoneWidgets = zoneWidgetsQuery.data ?? EMPTY_ZONE_WIDGETS
    const baseLayoutQuery = useQuery({
        queryKey:
            metahubId && layout?.baseLayoutId ? metahubsQueryKeys.layoutDetail(metahubId, layout.baseLayoutId) : ['layout-base-empty'],
        enabled: Boolean(metahubId && layout?.templateKey === 'marketing-page' && layout.scopeEntityId != null && layout.baseLayoutId),
        queryFn: async () => {
            const response = await layoutsApi.getLayout(String(metahubId), String(layout?.baseLayoutId))
            return response.data
        }
    })
    const baseLayout = baseLayoutQuery.data as MetahubLayout | undefined
    const widgetObjects = widgetObjectsQuery.data ?? EMPTY_WIDGET_OBJECTS
    const isGlobalLayout = layout?.scopeEntityId == null
    const isMarketingOverlay = layout?.scopeEntityId != null && layout.baseLayoutId != null
    const layoutZones = layout ? LAYOUT_ZONES_BY_TEMPLATE[layout.templateKey] : DASHBOARD_LAYOUT_ZONES
    const getExpectedLayoutVersion = useCallback((): number => {
        if (!layout || !Number.isSafeInteger(layout.version) || layout.version <= 0) {
            throw new Error(t('layouts.details.versionUnavailable', 'The latest layout version is unavailable. Refresh and try again.'))
        }
        return layout.version
    }, [layout, t])
    const getExpectedWidgetVersion = (widgetId: string | null): number => {
        const version = widgetId ? zoneWidgets.find((item) => item.id === widgetId)?.version : undefined
        if (typeof version !== 'number' || !Number.isSafeInteger(version) || version <= 0) {
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

    const updateMarketingHeaderPosition = useCallback(
        async (value: string) => {
            if (!metahubId || !layoutId || !layout || !canManageLayouts) return
            const settingKey = marketingHeaderSettingDefinition?.key
            if (!settingKey) return
            setZoneSettingsSaving(true)
            setZoneSettingsError(null)
            const layoutKey = metahubsQueryKeys.layoutDetail(metahubId, layoutId)
            const previous = queryClient.getQueryData<MetahubLayout>(layoutKey)
            try {
                if (previous) {
                    const zoneSettings = { ...(previous.neutral?.zoneSettings ?? {}) }
                    queryClient.setQueryData<MetahubLayout>(layoutKey, {
                        ...previous,
                        neutral: {
                            ...(previous.neutral ?? {}),
                            zoneSettings: {
                                ...zoneSettings,
                                'marketing-header': { ...(zoneSettings['marketing-header'] ?? {}), [settingKey]: value }
                            }
                        }
                    })
                }
                await layoutsApi.updateLayoutZoneSetting(metahubId, layoutId, 'marketing-header', settingKey, value, layout.version)
                setZoneSettingsOpen(false)
                await persistAndRefresh()
            } catch (error: unknown) {
                if (previous) queryClient.setQueryData(layoutKey, previous)
                const apiError = error as { response?: { data?: { code?: string } }; code?: string }
                const code = apiError.response?.data?.code ?? apiError.code
                const message =
                    code === 'METAHUB_LAYOUT_ZONE_SETTING_VERSION_CONFLICT' || code === 'METAHUB_LAYOUT_VERSION_CONFLICT'
                        ? t('layouts.zoneSettingVersionConflict', 'This layout changed in another session. Reload it and try again.')
                        : code === 'METAHUB_LAYOUT_ZONE_SETTING_CONFLICT'
                        ? t('layouts.zoneSettingUnresolved', 'Resolve the layout source conflict before changing this setting.')
                        : t('layouts.zoneSettingUpdateError', 'Failed to save zone settings.')
                setZoneSettingsError(message)
                notifyLayoutError(error)
            } finally {
                setZoneSettingsSaving(false)
            }
        },
        [canManageLayouts, layout, layoutId, metahubId, notifyLayoutError, persistAndRefresh, queryClient, t]
    )

    const resetMarketingHeaderPosition = useCallback(async () => {
        if (!metahubId || !layoutId || !layout || !canManageLayouts) return
        const settingKey = marketingHeaderSettingDefinition?.key
        if (!settingKey) return
        setZoneSettingsSaving(true)
        setZoneSettingsError(null)
        try {
            await layoutsApi.resetLayoutZoneSetting(metahubId, layoutId, 'marketing-header', settingKey, layout.version)
            setZoneSettingsOpen(false)
            await persistAndRefresh()
        } catch (error: unknown) {
            const apiError = error as { response?: { data?: { code?: string } }; code?: string }
            const code = apiError.response?.data?.code ?? apiError.code
            const message =
                code === 'METAHUB_LAYOUT_ZONE_SETTING_VERSION_CONFLICT' || code === 'METAHUB_LAYOUT_VERSION_CONFLICT'
                    ? t('layouts.zoneSettingVersionConflict', 'This layout changed in another session. Reload it and try again.')
                    : t('layouts.zoneSettingResetError', 'Failed to reset zone settings.')
            setZoneSettingsError(message)
            notifyLayoutError(error)
        } finally {
            setZoneSettingsSaving(false)
        }
    }, [canManageLayouts, layout, layoutId, metahubId, notifyLayoutError, persistAndRefresh, t])

    const handleViewSettingChange = useCallback(
        async (key: string, value: unknown) => {
            if (!layout || !canManageLayouts) return
            setViewSettingsSaving(true)
            try {
                await persistLayoutConfig({ ...layout.config, [key]: value })
            } catch (e: unknown) {
                notifyLayoutError(e)
            } finally {
                setViewSettingsSaving(false)
            }
        },
        [canManageLayouts, layout, notifyLayoutError, persistLayoutConfig]
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
                notifyLayoutError(e)
            } finally {
                setViewSettingsSaving(false)
            }
        },
        [canManageLayouts, layout, notifyLayoutError, persistLayoutConfig]
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
        if (!metahubId || !layoutId || !layout || !canManageLayouts) return
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
        let targetPlacement: LayoutLogicalPlacement | undefined

        if (overId.startsWith('zone:')) {
            const groupMatch = overId.match(/^zone:([^:]+):group:(start|end)$/)
            const zoneValue = (groupMatch?.[1] ?? overId.replace('zone:', '')) as ApplicationLayoutZone
            if (!layoutZones.includes(zoneValue)) return
            targetZone = zoneValue
            targetPlacement = groupMatch?.[2] as LayoutLogicalPlacement | undefined
            targetIndex = getWidgetDropIndex(zoneToItems[targetZone], activeWidgetId, targetPlacement)
        } else {
            const overItem = zoneWidgets.find((item) => item.id === overId)
            if (!overItem) return
            targetZone = overItem.zone
            targetIndex = getWidgetDropIndex(zoneToItems[targetZone], activeWidgetId, undefined, overItem.id)
            if (targetZone === 'marketing-header') targetPlacement = readWidgetPlacement(overItem)
        }

        if (!getLayoutWidgetAllowedZones(currentItem.widgetKey, layout.templateKey)?.includes(targetZone)) return

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
            if (targetPlacement) {
                moved.placement = targetPlacement
            }
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
                targetPlacement,
                expectedVersion: currentItem.version
            })
            await persistAndRefresh()
        } catch (e: unknown) {
            // Rollback optimistic update on error
            if (previousData) queryClient.setQueryData(zoneWidgetsKey, previousData)
            notifyLayoutError(e)
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
                notifyLayoutError(e)
                throw e
            }
        },
        [canManageLayouts, layoutId, metahubId, notifyLayoutError, persistAndRefresh, zoneWidgets]
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
                notifyLayoutError(e)
            }
        },
        [canManageLayouts, getExpectedLayoutVersion, layout, layoutId, metahubId, notifyLayoutError, persistAndRefresh]
    )

    const widgetAuthoring = useLayoutWidgetAuthoring({
        metahubId,
        layoutId,
        layout,
        zoneWidgets,
        widgetObjects,
        canManageLayouts,
        canEditContent,
        isGlobalLayout,
        isMarketingOverlay,
        locale: uiLocale,
        t,
        tc,
        notifyError: notifyLayoutError,
        getExpectedLayoutVersion,
        getExpectedWidgetVersion,
        persistAndRefresh,
        upsertZoneWidgetInCache,
        onAddWidget: (zone, widgetKey) => void handleAddWidget(zone, widgetKey)
    })

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
                notifyLayoutError(e)
            }
        },
        [canManageLayouts, confirm, isGlobalLayout, layoutId, metahubId, notifyLayoutError, persistAndRefresh, t]
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
                notifyLayoutError(e)
            }
        },
        [canManageLayouts, layoutId, metahubId, notifyLayoutError, persistAndRefresh, queryClient, zoneWidgets]
    )

    const marketingHeaderSetting = layout
        ? readMarketingHeaderPosition(layout, baseLayout)
        : { value: 'fixed' as LayoutPosition, inherited: true, available: true }
    const openMarketingHeaderSettings = useCallback(() => {
        setZoneSettingsError(null)
        setZoneSettingsOpen(true)
    }, [])
    const { zoneLabels, zones: authoringZonesWithSettings } = useLayoutAuthoringZones({
        metahubId,
        layoutId,
        layout,
        layoutZones,
        zoneToItems,
        zoneWidgets,
        authoring: widgetAuthoring,
        canManageLayouts,
        canEditContent,
        isGlobalLayout,
        t,
        tc,
        persistAndRefresh,
        notifyError: notifyLayoutError,
        requestRemoveWidget,
        handleResetWidgetOverride,
        handleToggleWidgetActive,
        marketingHeaderSetting,
        onOpenMarketingHeaderSettings: openMarketingHeaderSettings
    })

    if (!metahubId || !layoutId) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography variant='body2'>{t('metahubs:errors.pleaseSelectMetahub', 'Please select a metahub')}</Typography>
            </Box>
        )
    }

    const isLoading = layoutQuery.isLoading || zoneWidgetsQuery.isLoading || widgetObjectsQuery.isLoading
    const hasError = layoutQuery.error || zoneWidgetsQuery.error || widgetObjectsQuery.error

    return (
        <MainCard content={false} sx={{ maxWidth: '100%', width: '100%', p: 0, gap: 0 }} disableHeader border={false} shadow={false}>
            <Stack spacing={2} sx={{ width: '100%' }}>
                <ViewHeader
                    title={layoutName || t('layouts.details.title', 'Layout')}
                    description={
                        layout?.templateKey === 'marketing-page'
                            ? tc(
                                  'layouts.widgetBindings.pageDescription',
                                  'Configure widget content from Entity records, then adjust its presentation separately.'
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
                                zones={authoringZonesWithSettings}
                                onDragEnd={handleDragEnd}
                                onAddWidgetRequest={widgetAuthoring.handleAddWidgetRequest}
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

            <LayoutWidgetEditorDialogs
                authoring={widgetAuthoring}
                metahubId={metahubId}
                layoutId={layoutId}
                locale={uiLocale}
                isGlobalLayout={isGlobalLayout}
                canManageLayouts={canManageLayouts}
                canEditContent={canEditContent}
                t={t}
            />

            {layout?.templateKey === 'marketing-page' && marketingHeaderSetting.available ? (
                <LayoutZoneSettingsDialog
                    open={zoneSettingsOpen}
                    title={`${tc('layouts.zoneSettings.settings', { defaultValue: 'Settings' })}: ${zoneLabels['marketing-header']}`}
                    settings={buildMarketingHeaderDialogSettings((key, fallback) => tc(key, { defaultValue: fallback }))}
                    values={
                        marketingHeaderSettingDefinition ? { [marketingHeaderSettingDefinition.key]: marketingHeaderSetting.value } : {}
                    }
                    inherited={marketingHeaderSetting.inherited}
                    readOnly={!canManageLayouts}
                    isBusy={zoneSettingsSaving}
                    error={zoneSettingsError}
                    labels={{
                        inherited: tc('layouts.zoneSettings.inherited', { defaultValue: 'Inherited from the current layout source' }),
                        customized: tc('layouts.zoneSettings.customized', { defaultValue: 'Customized for this layout' }),
                        cancel: tc('layouts.zoneSettings.cancel', { defaultValue: 'Cancel' }),
                        save: tc('layouts.zoneSettings.save', { defaultValue: 'Save' }),
                        reset: tc('layouts.zoneSettings.reset', { defaultValue: 'Reset override' }),
                        saving: tc('layouts.zoneSettings.saving', { defaultValue: 'Saving…' })
                    }}
                    onClose={() => {
                        setZoneSettingsError(null)
                        setZoneSettingsOpen(false)
                    }}
                    onSave={(values) => {
                        const settingKey = marketingHeaderSettingDefinition?.key
                        const value = settingKey ? values[settingKey] : undefined
                        if (value !== undefined) return updateMarketingHeaderPosition(value)
                        return undefined
                    }}
                    onReset={resetMarketingHeaderPosition}
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
