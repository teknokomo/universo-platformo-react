import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Slider, Stack, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ColumnsContainerColumn, ColumnsContainerConfig, DashboardLayoutWidgetKey } from '@universo/types'
import { DASHBOARD_LAYOUT_WIDGETS } from '@universo/types'
import { EntityFormDialog } from '@universo/template-mui'
import { generateUuidV7 } from '@universo/utils'
import { useTranslation } from 'react-i18next'

import ApplicationLayoutSharedBehaviorFields, {
    getSharedBehaviorFromWidgetConfig,
    setSharedBehaviorInWidgetConfig
} from './ApplicationLayoutSharedBehaviorFields'

type Props = {
    open: boolean
    config?: ColumnsContainerConfig | null
    showSharedBehavior?: boolean
    onSave: (config: ColumnsContainerConfig) => void
    onCancel: () => void
}

const CENTER_WIDGET_KEYS: DashboardLayoutWidgetKey[] = DASHBOARD_LAYOUT_WIDGETS.filter(
    (widget) => (widget.allowedZones as readonly string[]).includes('center') && widget.key !== 'columnsContainer'
).map((widget) => widget.key)

const MIN_WIDTH = 1
const MAX_WIDTH = 12
const MAX_COLUMNS = 6
const MAX_WIDGETS_PER_COLUMN = 6

const makeDefaultConfig = (): ColumnsContainerConfig => ({
    columns: [
        { id: generateUuidV7(), width: 6, widgets: [{ widgetKey: 'sessionsChart' }] },
        { id: generateUuidV7(), width: 6, widgets: [{ widgetKey: 'pageViewsChart' }] }
    ]
})

const cloneColumns = (cols: ColumnsContainerColumn[]): ColumnsContainerColumn[] =>
    cols.map((column) => ({
        ...column,
        widgets: column.widgets.map((widget) => ({ ...widget }))
    }))

function SortableColumnRow({
    column,
    onChangeWidth,
    onChangeWidget,
    onAddWidget,
    onRemoveWidget,
    onRemove,
    widgetOptions,
    t
}: {
    column: ColumnsContainerColumn
    onChangeWidth: (width: number) => void
    onChangeWidget: (widgetIndex: number, key: DashboardLayoutWidgetKey) => void
    onAddWidget: () => void
    onRemoveWidget: (widgetIndex: number) => void
    onRemove: () => void
    widgetOptions: Array<{ key: DashboardLayoutWidgetKey; label: string }>
    t: (key: string, fallback: string) => string
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id })
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

    return (
        <Paper ref={setNodeRef} style={style} variant='outlined' sx={{ px: 1.5, py: 1, borderRadius: 1.5 }}>
            <Stack spacing={1}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton size='small' sx={{ cursor: 'grab' }} {...attributes} {...listeners}>
                        <DragIndicatorRoundedIcon fontSize='small' />
                    </IconButton>
                    <Box sx={{ flexGrow: 1, minWidth: 80 }}>
                        <Typography variant='caption' color='text.secondary'>
                            {t('layouts.columnsEditor.width', 'Width')}: {column.width}/12
                        </Typography>
                        <Slider
                            value={column.width}
                            min={MIN_WIDTH}
                            max={MAX_WIDTH}
                            step={1}
                            size='small'
                            onChange={(_event, value) => onChangeWidth(value as number)}
                            valueLabelDisplay='auto'
                        />
                    </Box>
                    <IconButton size='small' onClick={onRemove} color='error'>
                        <DeleteRoundedIcon fontSize='small' />
                    </IconButton>
                </Box>
                {column.widgets.map((widget, index) => (
                    <Box key={`${column.id}-w${index}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 4 }}>
                        <FormControl size='small' sx={{ minWidth: 140, flexGrow: 1 }}>
                            <InputLabel>{t('layouts.columnsEditor.widget', 'Widget')}</InputLabel>
                            <Select
                                value={widget.widgetKey}
                                label={t('layouts.columnsEditor.widget', 'Widget')}
                                onChange={(event) => onChangeWidget(index, event.target.value as DashboardLayoutWidgetKey)}
                            >
                                {widgetOptions.map((option) => (
                                    <MenuItem key={option.key} value={option.key}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {column.widgets.length > 1 ? (
                            <IconButton size='small' onClick={() => onRemoveWidget(index)} color='error'>
                                <DeleteRoundedIcon fontSize='small' />
                            </IconButton>
                        ) : null}
                    </Box>
                ))}
                {column.widgets.length < MAX_WIDGETS_PER_COLUMN ? (
                    <Button size='small' startIcon={<AddRoundedIcon />} onClick={onAddWidget} sx={{ pl: 4, alignSelf: 'flex-start' }}>
                        {t('layouts.columnsEditor.addWidget', 'Add widget')}
                    </Button>
                ) : null}
            </Stack>
        </Paper>
    )
}

export default function ApplicationColumnsContainerEditorDialog({ open, config, showSharedBehavior = false, onSave, onCancel }: Props) {
    const { t } = useTranslation(['applications', 'common'])
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
    const [columns, setColumns] = useState<ColumnsContainerColumn[]>([])
    const [sharedBehaviorValue, setSharedBehaviorValue] = useState(() => getSharedBehaviorFromWidgetConfig(config))
    const initialSnapshotRef = useRef<string>('')

    useEffect(() => {
        if (!open) return
        const initial = config?.columns ? cloneColumns(config.columns) : makeDefaultConfig().columns
        const initialSharedBehavior = getSharedBehaviorFromWidgetConfig(config)
        setColumns(initial)
        setSharedBehaviorValue(initialSharedBehavior)
        initialSnapshotRef.current = JSON.stringify({ columns: initial, sharedBehavior: initialSharedBehavior })
    }, [open, config])

    const widgetOptions = useMemo(
        () =>
            CENTER_WIDGET_KEYS.map((key) => ({
                key,
                label: t(`layouts.widgets.${key}`, key)
            })),
        [t]
    )

    const totalWidth = useMemo(() => columns.reduce((sum, column) => sum + column.width, 0), [columns])
    const isDirty = useMemo(
        () => JSON.stringify({ columns, sharedBehavior: sharedBehaviorValue }) !== initialSnapshotRef.current,
        [columns, sharedBehaviorValue]
    )

    const handleAddColumn = useCallback(() => {
        if (columns.length >= MAX_COLUMNS) return
        const remaining = MAX_WIDTH - totalWidth
        const defaultWidth = remaining > 0 ? Math.min(remaining, 4) : 4
        setColumns((prev) => [...prev, { id: generateUuidV7(), width: defaultWidth, widgets: [{ widgetKey: CENTER_WIDGET_KEYS[0] }] }])
    }, [columns.length, totalWidth])

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        setColumns((prev) => {
            const oldIndex = prev.findIndex((column) => column.id === active.id)
            const newIndex = prev.findIndex((column) => column.id === over.id)
            if (oldIndex < 0 || newIndex < 0) return prev
            return arrayMove(prev, oldIndex, newIndex)
        })
    }, [])

    return (
        <EntityFormDialog
            open={open}
            title={t('layouts.columnsEditor.title', 'Columns container')}
            mode={config ? 'edit' : 'create'}
            nameLabel={t('common:fields.name', 'Name')}
            descriptionLabel={t('common:fields.description', 'Description')}
            hideDefaultFields
            onClose={onCancel}
            onSave={() => onSave(setSharedBehaviorInWidgetConfig({ columns }, sharedBehaviorValue) as unknown as ColumnsContainerConfig)}
            saveButtonText={t('common:save', 'Save')}
            cancelButtonText={t('common:cancel', 'Cancel')}
            extraFields={() => (
                <Stack spacing={2.5}>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'layouts.columnsEditor.description',
                            'Build a multi-column center widget composition and reorder columns with drag and drop.'
                        )}
                    </Typography>
                    <Typography variant='body2' color={totalWidth > 12 ? 'error.main' : 'text.secondary'}>
                        {t('layouts.columnsEditor.totalWidth', 'Total width')}: {totalWidth}/12
                    </Typography>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={columns.map((column) => column.id)} strategy={verticalListSortingStrategy}>
                            <Stack spacing={1.25}>
                                {columns.map((column) => (
                                    <SortableColumnRow
                                        key={column.id}
                                        column={column}
                                        widgetOptions={widgetOptions}
                                        t={(key, fallback) => t(key, fallback)}
                                        onChangeWidth={(width) =>
                                            setColumns((prev) => prev.map((item) => (item.id === column.id ? { ...item, width } : item)))
                                        }
                                        onChangeWidget={(widgetIndex, key) =>
                                            setColumns((prev) =>
                                                prev.map((item) => {
                                                    if (item.id !== column.id) return item
                                                    return {
                                                        ...item,
                                                        widgets: item.widgets.map((widget, index) =>
                                                            index === widgetIndex ? { ...widget, widgetKey: key } : widget
                                                        )
                                                    }
                                                })
                                            )
                                        }
                                        onAddWidget={() =>
                                            setColumns((prev) =>
                                                prev.map((item) =>
                                                    item.id === column.id && item.widgets.length < MAX_WIDGETS_PER_COLUMN
                                                        ? { ...item, widgets: [...item.widgets, { widgetKey: CENTER_WIDGET_KEYS[0] }] }
                                                        : item
                                                )
                                            )
                                        }
                                        onRemoveWidget={(widgetIndex) =>
                                            setColumns((prev) =>
                                                prev.map((item) =>
                                                    item.id === column.id && item.widgets.length > 1
                                                        ? {
                                                              ...item,
                                                              widgets: item.widgets.filter((_, index) => index !== widgetIndex)
                                                          }
                                                        : item
                                                )
                                            )
                                        }
                                        onRemove={() => setColumns((prev) => prev.filter((item) => item.id !== column.id))}
                                    />
                                ))}
                            </Stack>
                        </SortableContext>
                    </DndContext>
                    {columns.length < MAX_COLUMNS ? (
                        <Button startIcon={<AddRoundedIcon />} onClick={handleAddColumn} sx={{ alignSelf: 'flex-start' }}>
                            {t('layouts.columnsEditor.addColumn', 'Add column')}
                        </Button>
                    ) : null}
                    {showSharedBehavior ? (
                        <ApplicationLayoutSharedBehaviorFields
                            value={setSharedBehaviorInWidgetConfig({ columns }, sharedBehaviorValue)}
                            onChange={(nextValue) => setSharedBehaviorValue(getSharedBehaviorFromWidgetConfig(nextValue))}
                        />
                    ) : null}
                    {!isDirty ? (
                        <Typography variant='caption' color='text.secondary'>
                            {t('layouts.columnsEditor.noChanges', 'No changes yet.')}
                        </Typography>
                    ) : null}
                </Stack>
            )}
        />
    )
}
