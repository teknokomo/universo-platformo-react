import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Slider, Stack, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ColumnsContainerConfig, ColumnsContainerColumn, DashboardLayoutWidgetKey } from '@universo/types'
import { DASHBOARD_LAYOUT_WIDGETS } from '@universo/types'
import { EntityFormDialog } from '@universo/template-mui'
import { generateUuidV7 } from '@universo/utils'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ColumnsContainerEditorDialogProps {
    open: boolean
    /** Current widget config (null when creating a new columnsContainer). */
    config?: ColumnsContainerConfig | null
    onSave: (config: ColumnsContainerConfig) => void
    onCancel: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Widget keys that can be placed inside a column. */
const CENTER_WIDGET_KEYS: DashboardLayoutWidgetKey[] = DASHBOARD_LAYOUT_WIDGETS.filter(
    (w) => (w.allowedZones as readonly string[]).includes('center') && w.key !== 'columnsContainer'
).map((w) => w.key)

const MIN_WIDTH = 1
const MAX_WIDTH = 12
const MAX_COLUMNS = 6
const MAX_WIDGETS_PER_COLUMN = 6

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultConfig(): ColumnsContainerConfig {
    return {
        columns: [
            { id: generateUuidV7(), width: 6, widgets: [{ widgetKey: 'sessionsChart' }] },
            { id: generateUuidV7(), width: 6, widgets: [{ widgetKey: 'pageViewsChart' }] }
        ]
    }
}

function cloneColumns(cols: ColumnsContainerColumn[]): ColumnsContainerColumn[] {
    return cols.map((c) => ({
        ...c,
        widgets: c.widgets.map((w) => ({ ...w }))
    }))
}

// ---------------------------------------------------------------------------
// SortableColumnRow
// ---------------------------------------------------------------------------

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
    t: (key: string, options?: Record<string, unknown>) => string
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id })
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

    return (
        <Paper ref={setNodeRef} style={style} variant='outlined' sx={{ px: 1.5, py: 1, borderRadius: 1.5 }}>
            <Stack spacing={1}>
                {/* Column header: drag handle, width slider, delete */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton size='small' sx={{ cursor: 'grab' }} {...attributes} {...listeners}>
                        <DragIndicatorRoundedIcon fontSize='small' />
                    </IconButton>
                    <Box sx={{ flexGrow: 1, minWidth: 80 }}>
                        <Typography variant='caption' color='text.secondary'>
                            {t('layouts.columnsEditor.width', { defaultValue: 'Width' })}: {column.width}/12
                        </Typography>
                        <Slider
                            value={column.width}
                            min={MIN_WIDTH}
                            max={MAX_WIDTH}
                            step={1}
                            size='small'
                            onChange={(_e, val) => onChangeWidth(val as number)}
                            valueLabelDisplay='auto'
                        />
                    </Box>
                    <IconButton size='small' onClick={onRemove} color='error'>
                        <DeleteRoundedIcon fontSize='small' />
                    </IconButton>
                </Box>
                {/* Widget list within the column */}
                {column.widgets.map((w, idx) => (
                    <Box key={`${column.id}-w${idx}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 4 }}>
                        <FormControl size='small' sx={{ minWidth: 140, flexGrow: 1 }}>
                            <InputLabel>{t('layouts.columnsEditor.widget', { defaultValue: 'Widget' })}</InputLabel>
                            <Select
                                value={w.widgetKey}
                                label={t('layouts.columnsEditor.widget', { defaultValue: 'Widget' })}
                                onChange={(e) => onChangeWidget(idx, e.target.value as DashboardLayoutWidgetKey)}
                            >
                                {widgetOptions.map((opt) => (
                                    <MenuItem key={opt.key} value={opt.key}>
                                        {opt.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {column.widgets.length > 1 && (
                            <IconButton size='small' onClick={() => onRemoveWidget(idx)} color='error'>
                                <DeleteRoundedIcon fontSize='small' />
                            </IconButton>
                        )}
                    </Box>
                ))}
                {/* Add widget within column */}
                {column.widgets.length < MAX_WIDGETS_PER_COLUMN && (
                    <Button size='small' startIcon={<AddRoundedIcon />} onClick={onAddWidget} sx={{ pl: 4, alignSelf: 'flex-start' }}>
                        {t('layouts.columnsEditor.addWidget', 'Add widget')}
                    </Button>
                )}
            </Stack>
        </Paper>
    )
}

// ---------------------------------------------------------------------------
// Main Dialog
// ---------------------------------------------------------------------------

export default function ColumnsContainerEditorDialog({ open, config, onSave, onCancel }: ColumnsContainerEditorDialogProps) {
    const { t } = useTranslation(['metahubs', 'common'])
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

    const [columns, setColumns] = useState<ColumnsContainerColumn[]>([])

    // Snapshot of columns at dialog open for dirty tracking
    const initialSnapshotRef = useRef<string>('')

    // Re-initialize columns every time the dialog opens (or config changes while open)
    useEffect(() => {
        if (open) {
            const initial = config?.columns ? cloneColumns(config.columns) : makeDefaultConfig().columns
            setColumns(initial)
            initialSnapshotRef.current = JSON.stringify(initial)
        }
    }, [open, config])

    const widgetOptions = useMemo(
        () =>
            CENTER_WIDGET_KEYS.map((key) => ({
                key,
                label: t(`layouts.widgets.${key}`, key)
            })),
        [t]
    )

    const totalWidth = useMemo(() => columns.reduce((sum, c) => sum + c.width, 0), [columns])

    const isDirty = useMemo(() => JSON.stringify(columns) !== initialSnapshotRef.current, [columns])

    const handleAddColumn = useCallback(() => {
        if (columns.length >= MAX_COLUMNS) return
        const remaining = MAX_WIDTH - totalWidth
        const defaultWidth = remaining > 0 ? Math.min(remaining, 4) : 4
        setColumns((prev) => [
            ...prev,
            {
                id: generateUuidV7(),
                width: defaultWidth,
                widgets: [{ widgetKey: CENTER_WIDGET_KEYS[0] }]
            }
        ])
    }, [totalWidth, columns.length])

    const handleRemoveColumn = useCallback((id: string) => {
        setColumns((prev) => prev.filter((c) => c.id !== id))
    }, [])

    const handleChangeWidth = useCallback((id: string, width: number) => {
        setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, width } : c)))
    }, [])

    const handleChangeWidget = useCallback((colId: string, widgetIndex: number, widgetKey: DashboardLayoutWidgetKey) => {
        setColumns((prev) =>
            prev.map((c) => {
                if (c.id !== colId) return c
                const widgets = c.widgets.map((w, i) => (i === widgetIndex ? { ...w, widgetKey } : w))
                return { ...c, widgets }
            })
        )
    }, [])

    const handleAddWidgetToColumn = useCallback((colId: string) => {
        setColumns((prev) =>
            prev.map((c) => {
                if (c.id !== colId || c.widgets.length >= MAX_WIDGETS_PER_COLUMN) return c
                return { ...c, widgets: [...c.widgets, { widgetKey: CENTER_WIDGET_KEYS[0] }] }
            })
        )
    }, [])

    const handleRemoveWidgetFromColumn = useCallback((colId: string, widgetIndex: number) => {
        setColumns((prev) =>
            prev.map((c) => {
                if (c.id !== colId || c.widgets.length <= 1) return c
                return { ...c, widgets: c.widgets.filter((_, i) => i !== widgetIndex) }
            })
        )
    }, [])

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        setColumns((prev) => {
            const oldIndex = prev.findIndex((c) => c.id === active.id)
            const newIndex = prev.findIndex((c) => c.id === over.id)
            if (oldIndex < 0 || newIndex < 0) return prev
            return arrayMove(prev, oldIndex, newIndex)
        })
    }, [])

    const handleSave = useCallback(() => {
        if (columns.length === 0 || totalWidth > MAX_WIDTH) return
        // Defense-in-depth: strip any accidental columnsContainer nesting
        const sanitized = columns.map((c) => ({
            ...c,
            widgets: c.widgets.filter((w) => w.widgetKey !== 'columnsContainer')
        }))
        onSave({ columns: sanitized })
    }, [columns, totalWidth, onSave])

    return (
        <EntityFormDialog
            open={open}
            title={t('layouts.columnsEditor.title', 'Columns Container')}
            mode={config ? 'edit' : 'create'}
            nameLabel={t('common:fields.name', 'Name')}
            descriptionLabel={t('common:fields.description', 'Description')}
            hideDefaultFields
            onClose={onCancel}
            onSave={handleSave}
            canSave={() => isDirty && columns.length > 0 && totalWidth <= MAX_WIDTH}
            saveButtonText={t('common:save', 'Save')}
            cancelButtonText={t('common:cancel', 'Cancel')}
            extraFields={() => (
                <Stack spacing={2}>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'layouts.columnsEditor.description',
                            'Configure columns for this container. Each column can render one or more widgets stacked vertically. Widths use a 12-column grid.'
                        )}
                    </Typography>

                    {totalWidth !== 12 && (
                        <Typography variant='caption' color={totalWidth > 12 ? 'error.main' : 'warning.main'}>
                            {totalWidth > 12
                                ? t(
                                      'layouts.columnsEditor.widthError',
                                      'Total width {{total}}/12 exceeds the grid. Reduce column widths to save.',
                                      {
                                          total: totalWidth
                                      }
                                  )
                                : t('layouts.columnsEditor.widthWarning', 'Total width is {{total}}/12. Recommended: 12.', {
                                      total: totalWidth
                                  })}
                        </Typography>
                    )}

                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                            <Stack spacing={1}>
                                {columns.map((col) => (
                                    <SortableColumnRow
                                        key={col.id}
                                        column={col}
                                        onChangeWidth={(w) => handleChangeWidth(col.id, w)}
                                        onChangeWidget={(idx, k) => handleChangeWidget(col.id, idx, k)}
                                        onAddWidget={() => handleAddWidgetToColumn(col.id)}
                                        onRemoveWidget={(idx) => handleRemoveWidgetFromColumn(col.id, idx)}
                                        onRemove={() => handleRemoveColumn(col.id)}
                                        widgetOptions={widgetOptions}
                                        t={(key, opts) => t(key, opts as Record<string, string>) as string}
                                    />
                                ))}
                            </Stack>
                        </SortableContext>
                    </DndContext>

                    <Button size='small' startIcon={<AddRoundedIcon />} onClick={handleAddColumn} disabled={columns.length >= MAX_COLUMNS}>
                        {t('layouts.columnsEditor.addColumn', 'Add column')}
                    </Button>
                </Stack>
            )}
        />
    )
}
