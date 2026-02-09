import { type ReactNode, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import { Box, Button, CircularProgress, IconButton, Menu, MenuItem, Paper, Stack, Tooltip, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DashboardLayoutZone, DashboardLayoutWidgetKey, MenuWidgetConfig } from '@universo/types'
import { DASHBOARD_LAYOUT_ZONES } from '@universo/types'
import { TemplateMainCard as MainCard, ViewHeaderMUI as ViewHeader, notifyError } from '@universo/template-mui'

import { metahubsQueryKeys, invalidateLayoutsQueries } from '../../shared'
import * as layoutsApi from '../api'
import type { MetahubLayout, MetahubLayoutZoneWidget, DashboardLayoutWidgetCatalogItem } from '../../../types'
import { getVLCString, normalizeLocale } from '../../../types'
import MenuWidgetEditorDialog from './MenuWidgetEditorDialog'

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

const EMPTY_ZONE_WIDGETS: MetahubLayoutZoneWidget[] = []
const EMPTY_WIDGET_CATALOG: DashboardLayoutWidgetCatalogItem[] = []

function SortableWidgetChip({
    id,
    label,
    onRemove,
    onClick,
    onEdit,
    editTooltip,
    removeTooltip
}: {
    id: string
    label: string
    onRemove: () => void
    onClick?: () => void
    onEdit?: () => void
    editTooltip?: string
    removeTooltip?: string
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    }

    return (
        <Paper
            ref={setNodeRef}
            style={style}
            variant='outlined'
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1,
                py: 0.5,
                borderRadius: 1.5,
                bgcolor: 'background.paper'
            }}
        >
            <IconButton size='small' sx={{ cursor: 'grab' }} {...attributes} {...listeners}>
                <DragIndicatorRoundedIcon fontSize='small' />
            </IconButton>
            <Typography
                variant='body2'
                sx={{ flexGrow: 1, ...(onClick ? { cursor: 'pointer', '&:hover': { textDecoration: 'underline' } } : {}) }}
                onClick={onClick}
            >
                {label}
            </Typography>
            {onEdit && (
                <Tooltip title={editTooltip || ''} arrow>
                    <IconButton size='small' onClick={onEdit}>
                        <EditRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
            )}
            <Tooltip title={removeTooltip || ''} arrow>
                <IconButton size='small' onClick={onRemove}>
                    <CloseRoundedIcon fontSize='small' />
                </IconButton>
            </Tooltip>
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
    const navigate = useNavigate()
    const { metahubId, layoutId } = useParams<{ metahubId: string; layoutId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [addWidgetMenu, setAddWidgetMenu] = useState<AddWidgetMenuState>({ anchorEl: null, zone: null })
    const [menuEditor, setMenuEditor] = useState<MenuEditorState>({ open: false, zone: null, widgetId: null, config: null })

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

    const layout = layoutQuery.data as MetahubLayout | undefined
    const zoneWidgets = zoneWidgetsQuery.data ?? EMPTY_ZONE_WIDGETS
    const widgetCatalog = widgetCatalogQuery.data ?? EMPTY_WIDGET_CATALOG
    const uiLocale = normalizeLocale(i18n.language)
    const layoutName = layout ? getVLCString(layout.name, uiLocale) || getVLCString(layout.name, 'en') || layout.templateKey : ''

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

    /** Build a chip label: for menuWidget append the resolved menu title. */
    const getWidgetChipLabel = (widget: MetahubLayoutZoneWidget): string => {
        const base = widgetLabelByKey[widget.widgetKey] || widget.widgetKey
        if (widget.widgetKey !== 'menuWidget') return base
        const cfg = widget.config as MenuWidgetConfig | undefined
        if (!cfg?.title) return base
        const title = getVLCString(cfg.title, uiLocale) || getVLCString(cfg.title, 'en')
        return title ? `${base}: ${title}` : base
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
        await invalidateLayoutsQueries.detail(queryClient, metahubId, layoutId)
        await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId) })
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        if (!metahubId || !layoutId) return
        if (!active.id || !over?.id) return

        const activeWidgetId = String(active.id)
        const overId = String(over.id)
        if (activeWidgetId === overId) return

        const currentItem = zoneWidgets.find((item) => item.id === activeWidgetId)
        if (!currentItem) return

        let targetZone = currentItem.zone
        let targetIndex = zoneToItems[targetZone].length

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
        if (!metahubId || !layoutId) return
        try {
            await layoutsApi.removeLayoutZoneWidget(metahubId, layoutId, widgetId)
            await persistAndRefresh()
        } catch (e: unknown) {
            notifyError(t, enqueueSnackbar, e)
        }
    }

    const handleAddWidget = async (zone: DashboardLayoutZone, widgetKey: DashboardLayoutWidgetKey, config?: Record<string, unknown>) => {
        if (!metahubId || !layoutId) return
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
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
            <Stack spacing={2}>
                <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                    <ViewHeader
                        title={layoutName || t('layouts.details.title', 'Layout')}
                        description={t('layouts.details.description', 'Configure dashboard zones and widgets.')}
                        search={false}
                        isBackButton
                        onBack={() => navigate(`/metahub/${metahubId}/layouts`)}
                    />
                </Box>

                <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                            <CircularProgress size={28} />
                        </Box>
                    ) : hasError ? (
                        <Typography color='error'>{t('layouts.zoneErrors.load', 'Failed to load layout zones')}</Typography>
                    ) : (
                        <Stack spacing={2}>
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
                                                            disabled={availableWidgets.length === 0}
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
                                                                const openEditor = isMenuWidget
                                                                    ? () =>
                                                                          setMenuEditor({
                                                                              open: true,
                                                                              zone,
                                                                              widgetId: item.id,
                                                                              config: (item.config as MenuWidgetConfig) ?? null
                                                                          })
                                                                    : undefined
                                                                return (
                                                                    <SortableWidgetChip
                                                                        key={item.id}
                                                                        id={item.id}
                                                                        label={getWidgetChipLabel(item)}
                                                                        onRemove={() => void handleRemoveWidget(item.id)}
                                                                        onClick={openEditor}
                                                                        onEdit={openEditor}
                                                                        editTooltip={isMenuWidget ? t('common:actions.edit') : undefined}
                                                                        removeTooltip={t('common:actions.delete')}
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
                onSave={async (config) => {
                    const zone = menuEditor.zone
                    const widgetId = menuEditor.widgetId
                    setMenuEditor({ open: false, zone: null, widgetId: null, config: null })
                    if (!zone || !metahubId || !layoutId) return
                    try {
                        if (widgetId) {
                            // Editing existing menuWidget config
                            await layoutsApi.updateLayoutZoneWidgetConfig(metahubId, layoutId, widgetId, config as Record<string, unknown>)
                        } else {
                            // Creating new menuWidget
                            await layoutsApi.assignLayoutZoneWidget(metahubId, layoutId, {
                                zone,
                                widgetKey: 'menuWidget',
                                config: config as Record<string, unknown>
                            })
                        }
                        await persistAndRefresh()
                    } catch (e: unknown) {
                        notifyError(t, enqueueSnackbar, e)
                    }
                }}
                onCancel={() => setMenuEditor({ open: false, zone: null, widgetId: null, config: null })}
            />
        </MainCard>
    )
}
