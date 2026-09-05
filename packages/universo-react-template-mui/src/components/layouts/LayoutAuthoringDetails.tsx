import { useState, type MouseEvent, type ReactNode } from 'react'
import { Box, Button, ButtonBase, IconButton, Menu, MenuItem, Paper, Stack, Tooltip, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import OpenWithRoundedIcon from '@mui/icons-material/OpenWithRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useDroppable,
    useSensor,
    useSensors,
    type Announcements,
    type DragEndEvent,
    type UniqueIdentifier
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ApplicationLayoutWidgetKey, ApplicationLayoutZone } from '@universo-react/types'

export type LayoutAuthoringWidgetKey = ApplicationLayoutWidgetKey
export type LayoutAuthoringZoneKey = ApplicationLayoutZone

export type LayoutAuthoringWidgetRow = {
    id: string
    label: string
    isActive: boolean
    draggable?: boolean
    inheritedLabel?: string
    editTooltip?: string
    editAriaLabel?: string
    duplicateTooltip?: string
    duplicateAriaLabel?: string
    resetTooltip?: string
    resetAriaLabel?: string
    removeTooltip?: string
    removeAriaLabel?: string
    toggleActiveTooltip?: string
    toggleActiveAriaLabel?: string
    dragHandleLabel?: string
    moveActions?: Array<{
        key: string
        label: string
        testId?: string
        onClick: () => void
    }>
    onClick?: () => void
    onEdit?: () => void
    onDuplicate?: () => void
    onReset?: () => void
    onRemove?: () => void
    onToggleActive?: (active: boolean) => void
}

export type LayoutAuthoringAvailableWidgetItem = {
    key: LayoutAuthoringWidgetKey
    label: string
}

export type LayoutAuthoringZone = {
    zone: LayoutAuthoringZoneKey
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
    dragHandleLabel: string
    moveWidgetLabel?: string
    zones: LayoutAuthoringZone[]
    onDragEnd: (event: DragEndEvent) => void | Promise<void>
    onAddWidgetRequest: (zone: LayoutAuthoringZoneKey, widgetKey: LayoutAuthoringWidgetKey) => void
    beforeZonesContent?: ReactNode
}

type AddWidgetMenuState = {
    anchorEl: HTMLElement | null
    zone: LayoutAuthoringZoneKey | null
}

function SortableLayoutWidgetChip({
    id,
    label,
    isActive,
    draggable = true,
    onRemove,
    onClick,
    onEdit,
    onDuplicate,
    onReset,
    onToggleActive,
    editTooltip,
    editAriaLabel,
    duplicateTooltip,
    duplicateAriaLabel,
    resetTooltip,
    resetAriaLabel,
    removeTooltip,
    removeAriaLabel,
    toggleActiveTooltip,
    toggleActiveAriaLabel,
    dragHandleLabel,
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
                aria-label={dragHandleLabel}
                sx={{ cursor: draggable ? 'grab' : 'default' }}
                {...attributes}
                {...listeners}
            >
                <DragIndicatorRoundedIcon fontSize='small' />
            </IconButton>
            {onClick ? (
                <ButtonBase
                    type='button'
                    onClick={onClick}
                    sx={{
                        flexGrow: 1,
                        minWidth: 0,
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        borderRadius: 1,
                        '&:hover .layout-widget-label': { textDecoration: 'underline' },
                        ...(!isActive && { opacity: 0.45 })
                    }}
                >
                    <Typography component='span' className='layout-widget-label' variant='body2' sx={{ overflowWrap: 'anywhere' }}>
                        {label}
                    </Typography>
                </ButtonBase>
            ) : (
                <Typography
                    component='span'
                    variant='body2'
                    sx={{
                        flexGrow: 1,
                        overflowWrap: 'anywhere',
                        ...(!isActive && { opacity: 0.45 })
                    }}
                >
                    {label}
                </Typography>
            )}
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
                            aria-label={moveWidgetLabel}
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
                    <IconButton
                        size='small'
                        data-testid={`layout-widget-edit-${id}`}
                        aria-label={editAriaLabel || editTooltip}
                        onClick={onEdit}
                    >
                        <EditRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
            ) : null}
            {onDuplicate ? (
                <Tooltip title={duplicateTooltip || ''} arrow>
                    <IconButton
                        size='small'
                        data-testid={`layout-widget-duplicate-${id}`}
                        aria-label={duplicateAriaLabel || duplicateTooltip}
                        onClick={onDuplicate}
                    >
                        <ContentCopyRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
            ) : null}
            {onReset ? (
                <Tooltip title={resetTooltip || ''} arrow>
                    <IconButton
                        size='small'
                        data-testid={`layout-widget-reset-${id}`}
                        aria-label={resetAriaLabel || resetTooltip}
                        onClick={onReset}
                    >
                        <RestartAltRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
            ) : null}
            {onToggleActive ? (
                <Tooltip title={toggleActiveTooltip || ''} arrow>
                    <IconButton
                        size='small'
                        data-testid={`layout-widget-toggle-${id}`}
                        aria-label={toggleActiveAriaLabel || toggleActiveTooltip}
                        onClick={() => onToggleActive(!isActive)}
                        sx={!isActive ? { color: 'text.disabled' } : undefined}
                    >
                        {isActive ? <VisibilityRoundedIcon fontSize='small' /> : <VisibilityOffRoundedIcon fontSize='small' />}
                    </IconButton>
                </Tooltip>
            ) : null}
            {onRemove ? (
                <Tooltip title={removeTooltip || ''} arrow>
                    <IconButton
                        size='small'
                        data-testid={`layout-widget-remove-${id}`}
                        aria-label={removeAriaLabel || removeTooltip}
                        onClick={onRemove}
                    >
                        <CloseRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
            ) : null}
        </Paper>
    )
}

function LayoutZoneColumn({ zone, title, children }: { zone: LayoutAuthoringZoneKey; title: string; children: ReactNode }) {
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
    dragHandleLabel,
    moveWidgetLabel,
    zones,
    onDragEnd,
    onAddWidgetRequest,
    beforeZonesContent
}: LayoutAuthoringDetailsProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )
    const [addWidgetMenu, setAddWidgetMenu] = useState<AddWidgetMenuState>({ anchorEl: null, zone: null })
    const activeZone = zones.find((zone) => zone.zone === addWidgetMenu.zone) ?? null
    const labelTotals = new Map<string, number>()
    zones.forEach((zone) => {
        zone.items.forEach((item) => {
            const label = item.label.trim() || dragHint
            labelTotals.set(label, (labelTotals.get(label) ?? 0) + 1)
        })
    })
    const labelIndexes = new Map<string, number>()
    const accessibleLabels = new Map<string, string>()
    zones.forEach((zone) => {
        zone.items.forEach((item) => {
            const label = item.label.trim() || dragHint
            const index = (labelIndexes.get(label) ?? 0) + 1
            labelIndexes.set(label, index)
            accessibleLabels.set(String(item.id), labelTotals.get(label)! > 1 ? `${label} (${index})` : label)
        })
    })

    const getWidgetLabel = (id: UniqueIdentifier) => accessibleLabels.get(String(id)) ?? dragHint
    const getDropTargetLabel = (id: UniqueIdentifier | null) => {
        if (id === null) return dragHint
        const normalizedId = String(id)
        if (normalizedId.startsWith('zone:')) {
            return zones.find((zone) => `zone:${zone.zone}` === normalizedId)?.title ?? dragHint
        }
        return getWidgetLabel(id)
    }
    const getDragHandleLabel = (id: UniqueIdentifier) => {
        const label = getWidgetLabel(id)
        return dragHandleLabel.trim() ? `${dragHandleLabel}: ${label}` : label
    }
    const getAnnouncement = (id: UniqueIdentifier, targetId?: UniqueIdentifier | null) => {
        const target = targetId === undefined ? null : getDropTargetLabel(targetId)
        return target ? `${getDragHandleLabel(id)}. ${target}. ${dragHint}` : `${getDragHandleLabel(id)}. ${dragHint}`
    }
    const announcements: Announcements = {
        onDragStart: ({ active }) => getAnnouncement(active.id),
        onDragOver: ({ active, over }) => getAnnouncement(active.id, over?.id),
        onDragEnd: ({ active, over }) => getAnnouncement(active.id, over?.id),
        onDragCancel: ({ active }) => getAnnouncement(active.id)
    }

    const openAddWidgetMenu = (event: MouseEvent<HTMLElement>, zone: LayoutAuthoringZoneKey) => {
        setAddWidgetMenu({ anchorEl: event.currentTarget, zone })
    }

    const closeAddWidgetMenu = () => setAddWidgetMenu({ anchorEl: null, zone: null })

    return (
        <Stack spacing={2}>
            {beforeZonesContent}

            <Typography
                variant='body2'
                sx={{
                    color: 'text.secondary'
                }}
            >
                {dragHint}
            </Typography>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ announcements }}>
                <Stack spacing={1.5}>
                    {zones.map((zone) => (
                        <LayoutZoneColumn key={zone.zone} zone={zone.zone} title={zone.title}>
                            <Stack spacing={1.25}>
                                <Stack direction='row' spacing={1} sx={{ alignItems: 'center' }}>
                                    <Button
                                        size='small'
                                        startIcon={<AddRoundedIcon />}
                                        onClick={(event) => openAddWidgetMenu(event, zone.zone)}
                                        disabled={Boolean(zone.addDisabled) || zone.availableWidgets.length === 0}
                                    >
                                        {addWidgetLabel}
                                    </Button>
                                    {zone.availableWidgets.length === 0 ? (
                                        <Typography
                                            variant='caption'
                                            sx={{
                                                color: 'text.secondary'
                                            }}
                                        >
                                            {availableWidgetsLabel}: 0
                                        </Typography>
                                    ) : null}
                                </Stack>

                                <SortableContext items={zone.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                                    <Stack spacing={1}>
                                        {zone.items.map((item) => (
                                            <SortableLayoutWidgetChip
                                                key={item.id}
                                                {...item}
                                                dragHandleLabel={getDragHandleLabel(item.id)}
                                                moveWidgetLabel={moveWidgetLabel}
                                            />
                                        ))}
                                        {zone.items.length === 0 ? (
                                            <Typography
                                                variant='caption'
                                                sx={{
                                                    color: 'text.secondary'
                                                }}
                                            >
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
