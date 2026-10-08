import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, IconButton, Paper, Slider, Stack, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DashboardWidgetConfig } from '@universo-react/types'
import { dashboardWidgetConfigSchemaByKey, getDashboardWidgetDefinition } from '@universo-react/types'
import { EntityFormDialog } from '@universo-react/template-mui'
import WidgetScopeVisibilityPanel from './WidgetScopeVisibilityPanel'

type ColumnsContainerConfig = DashboardWidgetConfig<'columnsContainer'>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ColumnsContainerEditorDialogProps {
    open: boolean
    /** Current widget config (null when creating a new columnsContainer). */
    config?: ColumnsContainerConfig | null
    metahubId?: string | null
    layoutId?: string | null
    widgetId?: string | null
    showScopeVisibility?: boolean
    onSave: (config: ColumnsContainerConfig) => void
    onCancel: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_WIDTH = 1
const MAX_WIDTH = 12
const COLUMN_SLOT_DEFINITION = getDashboardWidgetDefinition('columnsContainer')?.composition?.container?.slots[0]
const MIN_COLUMNS = COLUMN_SLOT_DEFINITION?.minSlots ?? 1
const MAX_COLUMNS = COLUMN_SLOT_DEFINITION?.maxSlots ?? 12
const DEFAULT_SLOT_SUFFIXES = ['primary', 'secondary']

interface ColumnSlotDescriptor {
    slotKey: string
    width: number
}

type ColumnsContainerPresentationConfig = DashboardWidgetConfig<'columnsContainer'>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeRegisteredSlotKey(value: unknown): string | undefined {
    if (typeof value !== 'string' || !COLUMN_SLOT_DEFINITION) return undefined
    if (!value.startsWith(COLUMN_SLOT_DEFINITION.slotPrefix)) return undefined
    const suffix = value.slice(COLUMN_SLOT_DEFINITION.slotPrefix.length)
    if (!new RegExp(COLUMN_SLOT_DEFINITION.slotKeyPattern, 'u').test(suffix)) return undefined

    const parsed = dashboardWidgetConfigSchemaByKey.columnsContainer.safeParse({ columns: [{ slotKey: value, width: MIN_WIDTH }] })
    if (!parsed.success) return undefined
    return parsed.data.columns[0]?.slotKey
}

function createColumnSlotKey(columns: readonly ColumnSlotDescriptor[], preferredSuffix?: string): string | undefined {
    if (!COLUMN_SLOT_DEFINITION) return undefined
    const taken = new Set(columns.map(({ slotKey }) => slotKey))
    const suffixes = [
        ...(preferredSuffix ? [preferredSuffix] : []),
        ...Array.from({ length: columns.length + 1 }, (_, index) => `column-${index + 1}`)
    ]

    for (const suffix of suffixes) {
        const slotKey = normalizeRegisteredSlotKey(`${COLUMN_SLOT_DEFINITION.slotPrefix}${suffix}`)
        if (slotKey && !taken.has(slotKey)) return slotKey
    }
    return undefined
}

function makeDefaultColumns(): ColumnSlotDescriptor[] {
    const count = Math.max(MIN_COLUMNS, Math.min(2, MAX_COLUMNS))
    const baseWidth = Math.floor(MAX_WIDTH / count)
    const columns: ColumnSlotDescriptor[] = []

    for (let index = 0; index < count; index += 1) {
        const slotKey = createColumnSlotKey(columns, DEFAULT_SLOT_SUFFIXES[index])
        if (!slotKey) return []
        columns.push({
            slotKey,
            width: index === count - 1 ? MAX_WIDTH - baseWidth * (count - 1) : baseWidth
        })
    }
    return columns
}

function readColumnDescriptors(config: ColumnsContainerConfig | null | undefined): ColumnSlotDescriptor[] {
    const rawColumns = isRecord(config) ? config.columns : undefined
    if (!Array.isArray(rawColumns)) return makeDefaultColumns()

    const columns: ColumnSlotDescriptor[] = []
    const fallbackWidth = Math.max(MIN_WIDTH, Math.floor(MAX_WIDTH / Math.max(1, Math.min(rawColumns.length, MAX_COLUMNS))))

    for (const rawColumn of rawColumns.slice(0, MAX_COLUMNS)) {
        if (!isRecord(rawColumn)) continue
        const existingSlotKey = normalizeRegisteredSlotKey(rawColumn.slotKey)
        const slotKey =
            existingSlotKey && !columns.some((column) => column.slotKey === existingSlotKey)
                ? existingSlotKey
                : createColumnSlotKey(columns)
        if (!slotKey) continue

        const width = rawColumn.width
        columns.push({
            slotKey,
            width: typeof width === 'number' && Number.isInteger(width) && width >= MIN_WIDTH && width <= MAX_WIDTH ? width : fallbackWidth
        })
    }

    return columns
}

function toPresentationConfig(columns: readonly ColumnSlotDescriptor[]): ColumnsContainerPresentationConfig {
    return { columns: columns.map(({ slotKey, width }) => ({ slotKey, width })) }
}

// ---------------------------------------------------------------------------
// SortableColumnRow
// ---------------------------------------------------------------------------

function SortableColumnRow({
    column,
    position,
    onChangeWidth,
    onRemove,
    t
}: {
    column: ColumnSlotDescriptor
    position: number
    onChangeWidth: (width: number) => void
    onRemove: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.slotKey })
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
                        <Typography
                            variant='caption'
                            sx={{
                                color: 'text.secondary'
                            }}
                        >
                            {t('layouts.columnsEditor.width', { defaultValue: 'Width' })} {position + 1}: {column.width}/12
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
                    <IconButton size='small' onClick={onRemove} color='error' aria-label={t('common:delete', { defaultValue: 'Delete' })}>
                        <DeleteRoundedIcon fontSize='small' />
                    </IconButton>
                </Box>
            </Stack>
        </Paper>
    )
}

// ---------------------------------------------------------------------------
// Main Dialog
// ---------------------------------------------------------------------------

export default function ColumnsContainerEditorDialog({
    open,
    config,
    metahubId,
    layoutId,
    widgetId,
    showScopeVisibility = false,
    onSave,
    onCancel
}: ColumnsContainerEditorDialogProps) {
    const { t } = useTranslation(['metahubs', 'common'])
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

    const [columns, setColumns] = useState<ColumnSlotDescriptor[]>([])

    // Snapshot of registered slot descriptors at dialog open for dirty tracking.
    const initialSnapshotRef = useRef<string>('')

    useEffect(() => {
        if (open) {
            const initial = readColumnDescriptors(config)
            setColumns(initial)
            initialSnapshotRef.current = JSON.stringify(initial)
        }
    }, [open, config])

    const totalWidth = useMemo(() => columns.reduce((sum, c) => sum + c.width, 0), [columns])
    const presentationConfig = useMemo(() => toPresentationConfig(columns), [columns])
    const isValidConfig = useMemo(
        () => dashboardWidgetConfigSchemaByKey.columnsContainer.safeParse(presentationConfig).success,
        [presentationConfig]
    )

    const isDirty = useMemo(() => JSON.stringify(columns) !== initialSnapshotRef.current, [columns])

    const handleAddColumn = useCallback(() => {
        if (columns.length >= MAX_COLUMNS) return
        const slotKey = createColumnSlotKey(columns)
        if (!slotKey) return
        const remaining = MAX_WIDTH - totalWidth
        const defaultWidth = remaining > 0 ? Math.min(remaining, 4) : 4
        setColumns((previous) => [...previous, { slotKey, width: defaultWidth }])
    }, [columns, totalWidth])

    const handleRemoveColumn = useCallback((slotKey: string) => {
        setColumns((previous) => previous.filter((column) => column.slotKey !== slotKey))
    }, [])

    const handleChangeWidth = useCallback((slotKey: string, width: number) => {
        setColumns((previous) => previous.map((column) => (column.slotKey === slotKey ? { ...column, width } : column)))
    }, [])

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        setColumns((previous) => {
            const oldIndex = previous.findIndex((column) => column.slotKey === active.id)
            const newIndex = previous.findIndex((column) => column.slotKey === over.id)
            if (oldIndex < 0 || newIndex < 0) return previous
            return arrayMove(previous, oldIndex, newIndex)
        })
    }, [])

    const handleSave = useCallback(() => {
        if (columns.length < MIN_COLUMNS || columns.length > MAX_COLUMNS || totalWidth > MAX_WIDTH) return
        const parsed = dashboardWidgetConfigSchemaByKey.columnsContainer.safeParse(presentationConfig)
        if (!parsed.success) return
        onSave(parsed.data)
    }, [columns.length, onSave, presentationConfig, totalWidth])

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
            canSave={() => isDirty && isValidConfig && columns.length >= MIN_COLUMNS && totalWidth <= MAX_WIDTH}
            saveButtonText={t('common:save', 'Save')}
            cancelButtonText={t('common:cancel', 'Cancel')}
            extraFields={() => (
                <Stack spacing={2}>
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
                        <SortableContext items={columns.map((column) => column.slotKey)} strategy={verticalListSortingStrategy}>
                            <Stack spacing={1}>
                                {columns.map((column, index) => (
                                    <SortableColumnRow
                                        key={column.slotKey}
                                        column={column}
                                        position={index}
                                        onChangeWidth={(width) => handleChangeWidth(column.slotKey, width)}
                                        onRemove={() => handleRemoveColumn(column.slotKey)}
                                        t={(key, opts) => t(key, opts as Record<string, string>) as string}
                                    />
                                ))}
                            </Stack>
                        </SortableContext>
                    </DndContext>

                    <Button
                        size='small'
                        startIcon={<AddRoundedIcon />}
                        onClick={handleAddColumn}
                        disabled={columns.length >= MAX_COLUMNS || !createColumnSlotKey(columns)}
                    >
                        {t('layouts.columnsEditor.addColumn', 'Add column')}
                    </Button>

                    {showScopeVisibility && metahubId && layoutId && widgetId ? (
                        <WidgetScopeVisibilityPanel metahubId={metahubId} layoutId={layoutId} widgetId={widgetId} />
                    ) : null}
                </Stack>
            )}
        />
    )
}
