import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import {
    Box,
    Button,
    CircularProgress,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    Menu,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type {
    LinkedCollectionRuntimeViewConfig,
    DashboardLayoutZone,
    DashboardLayoutWidgetKey,
    MenuWidgetConfig,
    ColumnsContainerConfig,
    QuizWidgetConfig
} from '@universo/types'
import { DASHBOARD_LAYOUT_ZONES } from '@universo/types'
import { TemplateMainCard as MainCard, ViewHeaderMUI as ViewHeader, notifyError } from '@universo/template-mui'
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

type AddWidgetMenuState = {
    anchorEl: HTMLElement | null
    zone: DashboardLayoutZone | null
}

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
function SortableWidgetChip({
    id,
    label,
    isActive,
    draggable = true,
    onRemove,
    onClick,
    onEdit,
    onToggleActive,
    editTooltip,
    removeTooltip,
    toggleActiveTooltip,
    inheritedLabel
}: {
    id: string
    label: string
    isActive: boolean
    draggable?: boolean
    onRemove?: () => void
    onClick?: () => void
    onEdit?: () => void
    onToggleActive?: (active: boolean) => void
    editTooltip?: string
    removeTooltip?: string
    toggleActiveTooltip?: string
    inheritedLabel?: string
}) {
    const { fieldDefinitions, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        disabled: !draggable
    })
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    }

    return (
        <Paper
            ref={setNodeRef}
            data-testid={`layout-widget-${id}`}
            style={style}
            variant='outlined'
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1,
                py: 0.5,
                borderRadius: 1.5,
                bgcolor: 'background.paper',
                ...(!isActive && { borderStyle: 'dashed' })
            }}
        >
            <IconButton
                size='small'
                data-testid={`layout-widget-drag-${id}`}
                disabled={!draggable}
                sx={{ cursor: draggable ? 'grab' : 'default' }}
                {...fieldDefinitions}
                {...listeners}
            >
                <DragIndicatorRoundedIcon fontSize='small' />
            </IconButton>
            <Typography
                variant='body2'
                sx={{
                    flexGrow: 1,
                    ...(!isActive && { opacity: 0.45 }),
                    ...(onClick ? { cursor: 'pointer', '&:hover': { textDecoration: 'underline' } } : {})
                }}
                onClick={onClick}
            >
                {label}
            </Typography>
            {inheritedLabel ? (
                <Box
                    component='span'
                    data-testid={`layout-widget-inherited-${id}`}
                    sx={{
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 999,
                        bgcolor: 'action.hover',
                        color: 'text.secondary',
                        fontSize: 11,
                        lineHeight: 1.4,
                        whiteSpace: 'nowrap'
                    }}
                >
                    {inheritedLabel}
                </Box>
            ) : null}
            {onEdit && (
                <Tooltip title={editTooltip || ''} arrow>
                    <IconButton size='small' data-testid={`layout-widget-edit-${id}`} onClick={onEdit}>
                        <EditRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
            )}
            {onToggleActive && (
                <Tooltip title={toggleActiveTooltip || ''} arrow>
                    <IconButton
                        size='small'
                        data-testid={`layout-widget-toggle-${id}`}
                        onClick={() => onToggleActive(!isActive)}
                        sx={!isActive ? { color: 'text.disabled' } : undefined}
                    >
                        {isActive ? <VisibilityRoundedIcon fontSize='small' /> : <VisibilityOffRoundedIcon fontSize='small' />}
                    </IconButton>
                </Tooltip>
            )}
            {onRemove ? (
                <Tooltip title={removeTooltip || ''} arrow>
                    <IconButton size='small' data-testid={`layout-widget-remove-${id}`} onClick={onRemove}>
                        <CloseRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
            ) : null}
        </Paper>
    )
}

function LayoutZoneColumn({ zone, title, children }: { zone: DashboardLayoutZone; title: string; children: ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({
        id: `zone:${zone}`
    })

    return (
        <Paper
            ref={setNodeRef}
            data-testid={`layout-zone-${zone}`}
            variant='outlined'
            sx={{
                p: 1.5,
                minHeight: 140,
                borderStyle: isOver ? 'solid' : 'dashed',
                borderColor: isOver ? 'primary.main' : 'divider',
                transition: 'border-color 120ms ease'
            }}
        >
            <Typography variant='subtitle2' sx={{ mb: 1.25 }}>
                {title}
            </Typography>
            {children}
        </Paper>
    )
}

export default function LayoutDetails() {
    const { metahubId, layoutId } = useParams<{ metahubId: string; layoutId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const metahubDetailsQuery = useMetahubDetails(metahubId ?? '', { enabled: Boolean(metahubId) })
    const [addWidgetMenu, setAddWidgetMenu] = useState<AddWidgetMenuState>({ anchorEl: null, zone: null })
    const [menuEditor, setMenuEditor] = useState<MenuEditorState>({ open: false, zone: null, widgetId: null, config: null })
    const [columnsEditor, setColumnsEditor] = useState<ColumnsEditorState>({ open: false, zone: null, widgetId: null, config: null })
    const [quizEditor, setQuizEditor] = useState<QuizEditorState>({ open: false, zone: null, widgetId: null, config: null })
    const [widgetBehaviorEditor, setWidgetBehaviorEditor] = useState<WidgetBehaviorEditorState>({
        open: false,
        widgetId: null,
        config: null
    })
    const [viewSettingsSaving, setViewSettingsSaving] = useState(false)

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

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

    /** Build a chip label: for menuWidget append the resolved menu title, for columnsContainer list inner widgets. */
    const getWidgetChipLabel = (widget: MetahubLayoutZoneWidget): string => {
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
    }

    const getAvailableWidgetsForZone = (zone: DashboardLayoutZone): DashboardLayoutWidgetCatalogItem[] => {
        return widgetCatalog.filter((widgetItem) => {
            // Multi-instance widgets are always available for adding
            if (!widgetItem.multiInstance && allAssignedWidgetKeys.has(widgetItem.key)) return false
            return widgetItem.allowedZones.includes(zone)
        })
    }

    const persistAndRefresh = async () => {
        if (!metahubId || !layoutId) return
        if (layout?.linkedCollectionId == null) {
            await invalidateLayoutsQueries.all(queryClient, metahubId)
            return
        }
        await invalidateLayoutsQueries.detail(queryClient, metahubId, layoutId)
        await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId) })
    }

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

    const handleRemoveWidget = async (widgetId: string) => {
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
    }

    const handleAddWidget = async (zone: DashboardLayoutZone, widgetKey: DashboardLayoutWidgetKey, config?: Record<string, unknown>) => {
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
    }

    const handleToggleWidgetActive = async (widgetId: string, isActive: boolean) => {
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
    }

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
                            <Paper variant='outlined' sx={{ p: 2 }}>
                                <Typography variant='subtitle1' sx={{ mb: 1.5 }}>
                                    {layout?.linkedCollectionId
                                        ? t('layouts.details.catalogBehaviorTitleCatalog', 'LinkedCollectionEntity runtime behavior')
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
                                                onChange={(_, checked) => void handleCatalogBehaviorChange({ showCreateButton: checked })}
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
                                                    searchMode: event.target.value as LinkedCollectionRuntimeViewConfig['searchMode']
                                                })
                                            }
                                        >
                                            <MenuItem value='page-local'>
                                                {t('catalogs.runtime.searchModePageLocal', 'Page-local')}
                                            </MenuItem>
                                            <MenuItem value='server'>{t('catalogs.runtime.searchModeServer', 'Server')}</MenuItem>
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
                                                    createSurface: event.target.value as LinkedCollectionRuntimeViewConfig['createSurface']
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
                                                    editSurface: event.target.value as LinkedCollectionRuntimeViewConfig['editSurface']
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
                                                    copySurface: event.target.value as LinkedCollectionRuntimeViewConfig['copySurface']
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
                                        disabled={viewSettingsSaving || !canManageLayouts || !catalogBehaviorConfig.enableRowReordering}
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
                                                onChange={(_, checked) => void handleViewSettingChange('showViewToggle', checked)}
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
                                                onChange={(_, checked) => void handleViewSettingChange('showFilterBar', checked)}
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
                                            onChange={(e) => void handleViewSettingChange('cardColumns', Number(e.target.value))}
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
                                            <MenuItem value='52'>{t('layouts.details.rowHeightNormal', 'Normal (52px)')}</MenuItem>
                                            <MenuItem value='auto'>{t('layouts.details.rowHeightAuto', 'Auto (multi-line)')}</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Stack>
                            </Paper>

                            <Typography variant='body2' color='text.secondary'>
                                {t('layouts.details.dragHint', 'Drag widgets between zones to change runtime composition.')}
                            </Typography>

                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <Stack spacing={1.5}>
                                    {DASHBOARD_LAYOUT_ZONES.map((zone) => {
                                        const zoneItems = zoneToItems[zone]
                                        const availableWidgets = getAvailableWidgetsForZone(zone)
                                        return (
                                            <LayoutZoneColumn key={zone} zone={zone} title={zoneLabels[zone]}>
                                                <Stack spacing={1.25}>
                                                    <Stack direction='row' spacing={1} alignItems='center'>
                                                        <Button
                                                            size='small'
                                                            startIcon={<AddRoundedIcon />}
                                                            onClick={(event) => setAddWidgetMenu({ anchorEl: event.currentTarget, zone })}
                                                            disabled={!canManageLayouts || availableWidgets.length === 0}
                                                        >
                                                            {t('layouts.details.addWidget', 'Add widget')}
                                                        </Button>
                                                        {availableWidgets.length === 0 ? (
                                                            <Typography variant='caption' color='text.secondary'>
                                                                {t('layouts.details.widgetCatalogTitle', 'Available widgets')}: 0
                                                            </Typography>
                                                        ) : null}
                                                    </Stack>

                                                    <SortableContext
                                                        items={zoneItems.map((item) => item.id)}
                                                        strategy={verticalListSortingStrategy}
                                                    >
                                                        <Stack spacing={1}>
                                                            {zoneItems.map((item) => {
                                                                const isMenuWidget = item.widgetKey === 'menuWidget'
                                                                const isColumnsContainer = item.widgetKey === 'columnsContainer'
                                                                const isQuizWidget = item.widgetKey === 'quizWidget'
                                                                const isInheritedWidget = item.isInherited === true
                                                                const sharedBehavior = getSharedBehaviorFromWidgetConfig(item.config)
                                                                const canDragWidget =
                                                                    canManageLayouts &&
                                                                    (!isInheritedWidget || !sharedBehavior.positionLocked)
                                                                const canToggleWidget =
                                                                    canManageLayouts && (!isInheritedWidget || sharedBehavior.canDeactivate)
                                                                const canRemoveWidget =
                                                                    canManageLayouts && (!isInheritedWidget || sharedBehavior.canExclude)
                                                                const openEditor =
                                                                    !isInheritedWidget && isMenuWidget
                                                                        ? () =>
                                                                              setMenuEditor({
                                                                                  open: true,
                                                                                  zone,
                                                                                  widgetId: item.id,
                                                                                  config: (item.config as MenuWidgetConfig) ?? null
                                                                              })
                                                                        : !isInheritedWidget && isColumnsContainer
                                                                        ? () =>
                                                                              setColumnsEditor({
                                                                                  open: true,
                                                                                  zone,
                                                                                  widgetId: item.id,
                                                                                  config: (item.config as ColumnsContainerConfig) ?? null
                                                                              })
                                                                        : !isInheritedWidget && isQuizWidget
                                                                        ? () =>
                                                                              setQuizEditor({
                                                                                  open: true,
                                                                                  zone,
                                                                                  widgetId: item.id,
                                                                                  config: (item.config as QuizWidgetConfig) ?? null
                                                                              })
                                                                        : !isInheritedWidget && isGlobalLayout
                                                                        ? () =>
                                                                              setWidgetBehaviorEditor({
                                                                                  open: true,
                                                                                  widgetId: item.id,
                                                                                  config:
                                                                                      item.config &&
                                                                                      typeof item.config === 'object' &&
                                                                                      !Array.isArray(item.config)
                                                                                          ? { ...(item.config as Record<string, unknown>) }
                                                                                          : {}
                                                                              })
                                                                        : undefined
                                                                const canEditWidget = canManageLayouts && Boolean(openEditor)
                                                                return (
                                                                    <SortableWidgetChip
                                                                        key={item.id}
                                                                        id={item.id}
                                                                        label={getWidgetChipLabel(item)}
                                                                        isActive={item.isActive}
                                                                        draggable={canDragWidget}
                                                                        onRemove={
                                                                            canRemoveWidget
                                                                                ? () => void handleRemoveWidget(item.id)
                                                                                : undefined
                                                                        }
                                                                        onClick={canEditWidget ? openEditor : undefined}
                                                                        onEdit={canEditWidget ? openEditor : undefined}
                                                                        onToggleActive={
                                                                            canToggleWidget
                                                                                ? (active) => void handleToggleWidgetActive(item.id, active)
                                                                                : undefined
                                                                        }
                                                                        inheritedLabel={
                                                                            isInheritedWidget
                                                                                ? t('layouts.details.inheritedBadge', 'Inherited')
                                                                                : undefined
                                                                        }
                                                                        editTooltip={canEditWidget ? t('common:actions.edit') : undefined}
                                                                        removeTooltip={
                                                                            canRemoveWidget
                                                                                ? isInheritedWidget
                                                                                    ? t('layouts.actions.exclude', 'Exclude')
                                                                                    : t('common:actions.delete')
                                                                                : undefined
                                                                        }
                                                                        toggleActiveTooltip={
                                                                            canToggleWidget && item.isActive
                                                                                ? t('layouts.actions.deactivate', 'Deactivate')
                                                                                : canToggleWidget
                                                                                ? t('layouts.actions.activate', 'Activate')
                                                                                : undefined
                                                                        }
                                                                    />
                                                                )
                                                            })}
                                                            {zoneItems.length === 0 ? (
                                                                <Typography variant='caption' color='text.secondary'>
                                                                    {t('layouts.empty', 'No layouts yet')}
                                                                </Typography>
                                                            ) : null}
                                                        </Stack>
                                                    </SortableContext>
                                                </Stack>
                                            </LayoutZoneColumn>
                                        )
                                    })}
                                </Stack>
                            </DndContext>
                        </Stack>
                    )}
                </Box>
            </Stack>

            <Menu
                open={Boolean(addWidgetMenu.anchorEl)}
                anchorEl={addWidgetMenu.anchorEl}
                onClose={() => setAddWidgetMenu({ anchorEl: null, zone: null })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
                {(addWidgetMenu.zone ? getAvailableWidgetsForZone(addWidgetMenu.zone) : []).map((widgetItem) => (
                    <MenuItem
                        key={widgetItem.key}
                        onClick={() => {
                            const zone = addWidgetMenu.zone
                            setAddWidgetMenu({ anchorEl: null, zone: null })
                            if (!zone) return
                            // For menuWidget, open editor dialog instead of adding directly
                            if (widgetItem.key === 'menuWidget') {
                                setMenuEditor({ open: true, zone, widgetId: null, config: null })
                                return
                            }
                            // For columnsContainer, open editor dialog instead of adding directly
                            if (widgetItem.key === 'columnsContainer') {
                                setColumnsEditor({ open: true, zone, widgetId: null, config: null })
                                return
                            }
                            if (widgetItem.key === 'quizWidget') {
                                setQuizEditor({ open: true, zone, widgetId: null, config: null })
                                return
                            }
                            void handleAddWidget(zone, widgetItem.key)
                        }}
                    >
                        {widgetLabelByKey[widgetItem.key] || widgetItem.key}
                    </MenuItem>
                ))}
            </Menu>

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
