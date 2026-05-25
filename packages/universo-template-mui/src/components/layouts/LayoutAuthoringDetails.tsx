import { useState, type MouseEvent, type ReactNode } from 'react'
import { Box, Button, IconButton, Menu, MenuItem, Paper, Stack, Tooltip, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import OpenWithRoundedIcon from '@mui/icons-material/OpenWithRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import { DndContext, PointerSensor, closestCenter, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DashboardLayoutWidgetKey, DashboardLayoutZone } from '@universo/types'

export type LayoutAuthoringWidgetRow = {
    id: string
    label: string
    isActive: boolean
    draggable?: boolean
    inheritedLabel?: string
    editTooltip?: string
    removeTooltip?: string
    toggleActiveTooltip?: string
    moveActions?: Array<{
        key: string
        label: string
        testId?: string
        onClick: () => void
    }>
    onClick?: () => void
    onEdit?: () => void
    onRemove?: () => void
    onToggleActive?: (active: boolean) => void
}

export type LayoutAuthoringAvailableWidgetItem = {
    key: DashboardLayoutWidgetKey
    label: string
}

export type LayoutAuthoringZone = {
    zone: DashboardLayoutZone
    title: string
    items: LayoutAuthoringWidgetRow[]
    availableWidgets: LayoutAuthoringAvailableWidgetItem[]
    addDisabled?: boolean
}

export type LayoutAuthoringDetailsProps = {
    dragHint: string
    emptyZoneLabel: string
    addWidgetLabel: string
    availableWidgetsLabel: string
    moveWidgetLabel?: string
    zones: LayoutAuthoringZone[]
    onDragEnd: (event: DragEndEvent) => void | Promise<void>
    onAddWidgetRequest: (zone: DashboardLayoutZone, widgetKey: DashboardLayoutWidgetKey) => void
    beforeZonesContent?: ReactNode
}

type AddWidgetMenuState = {
    anchorEl: HTMLElement | null
    zone: DashboardLayoutZone | null
}

function SortableLayoutWidgetChip({
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
    inheritedLabel,
    moveActions,
    moveWidgetLabel
}: LayoutAuthoringWidgetRow & { moveWidgetLabel?: string }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        disabled: !draggable
    })
    const [moveMenuAnchorEl, setMoveMenuAnchorEl] = useState<HTMLElement | null>(null)

    return (
        <Paper
            ref={setNodeRef}
            data-testid={`layout-widget-${id}`}
            variant='outlined'
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0.5 : 1
            }}
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
                {...attributes}
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
            {moveActions && moveActions.length > 0 ? (
                <>
                    <Tooltip title={moveWidgetLabel || ''} arrow>
                        <IconButton
                            size='small'
                            data-testid={`layout-widget-move-menu-${id}`}
                            onClick={(event) => setMoveMenuAnchorEl(event.currentTarget)}
                        >
                            <OpenWithRoundedIcon fontSize='small' />
                        </IconButton>
                    </Tooltip>
                    <Menu anchorEl={moveMenuAnchorEl} open={Boolean(moveMenuAnchorEl)} onClose={() => setMoveMenuAnchorEl(null)}>
                        {moveActions.map((action) => (
                            <MenuItem
                                key={action.key}
                                data-testid={action.testId}
                                onClick={() => {
                                    setMoveMenuAnchorEl(null)
                                    action.onClick()
                                }}
                            >
                                {action.label}
                            </MenuItem>
                        ))}
                    </Menu>
                </>
            ) : null}
            {onEdit ? (
                <Tooltip title={editTooltip || ''} arrow>
                    <IconButton size='small' data-testid={`layout-widget-edit-${id}`} onClick={onEdit}>
                        <EditRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
            ) : null}
            {onToggleActive ? (
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
            ) : null}
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

export function LayoutAuthoringDetails({
    dragHint,
    emptyZoneLabel,
    addWidgetLabel,
    availableWidgetsLabel,
    moveWidgetLabel,
    zones,
    onDragEnd,
    onAddWidgetRequest,
    beforeZonesContent
}: LayoutAuthoringDetailsProps) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
    const [addWidgetMenu, setAddWidgetMenu] = useState<AddWidgetMenuState>({ anchorEl: null, zone: null })
    const activeZone = zones.find((zone) => zone.zone === addWidgetMenu.zone) ?? null

    const openAddWidgetMenu = (event: MouseEvent<HTMLElement>, zone: DashboardLayoutZone) => {
        setAddWidgetMenu({ anchorEl: event.currentTarget, zone })
    }

    const closeAddWidgetMenu = () => setAddWidgetMenu({ anchorEl: null, zone: null })

    return (
        <Stack spacing={2}>
            {beforeZonesContent}

            <Typography variant='body2' color='text.secondary'>
                {dragHint}
            </Typography>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <Stack spacing={1.5}>
                    {zones.map((zone) => (
                        <LayoutZoneColumn key={zone.zone} zone={zone.zone} title={zone.title}>
                            <Stack spacing={1.25}>
                                <Stack direction='row' spacing={1} alignItems='center'>
                                    <Button
                                        size='small'
                                        startIcon={<AddRoundedIcon />}
                                        onClick={(event) => openAddWidgetMenu(event, zone.zone)}
                                        disabled={Boolean(zone.addDisabled) || zone.availableWidgets.length === 0}
                                    >
                                        {addWidgetLabel}
                                    </Button>
                                    {zone.availableWidgets.length === 0 ? (
                                        <Typography variant='caption' color='text.secondary'>
                                            {availableWidgetsLabel}: 0
                                        </Typography>
                                    ) : null}
                                </Stack>

                                <SortableContext items={zone.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                                    <Stack spacing={1}>
                                        {zone.items.map((item) => (
                                            <SortableLayoutWidgetChip key={item.id} {...item} moveWidgetLabel={moveWidgetLabel} />
                                        ))}
                                        {zone.items.length === 0 ? (
                                            <Typography variant='caption' color='text.secondary'>
                                                {emptyZoneLabel}
                                            </Typography>
                                        ) : null}
                                    </Stack>
                                </SortableContext>
                            </Stack>
                        </LayoutZoneColumn>
                    ))}
                </Stack>
            </DndContext>

            <Menu
                open={Boolean(addWidgetMenu.anchorEl)}
                anchorEl={addWidgetMenu.anchorEl}
                onClose={closeAddWidgetMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
                {(activeZone?.availableWidgets ?? []).map((widgetItem) => (
                    <MenuItem
                        key={widgetItem.key}
                        onClick={() => {
                            if (!activeZone) {
                                closeAddWidgetMenu()
                                return
                            }
                            onAddWidgetRequest(activeZone.zone, widgetItem.key)
                            closeAddWidgetMenu()
                        }}
                    >
                        {widgetItem.label}
                    </MenuItem>
                ))}
            </Menu>
        </Stack>
    )
}
