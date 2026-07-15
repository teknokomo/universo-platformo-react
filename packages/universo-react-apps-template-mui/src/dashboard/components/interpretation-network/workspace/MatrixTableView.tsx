import { useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableFooter from '@mui/material/TableFooter'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import type { TFunction } from 'i18next'
import { resolveInterpretationNetworkMaximumContrastForeground } from '@universo-react/types'
import { MatrixCellContent } from '../MatrixCellButton'
import { buildMatrixTableModel, toMatrixTableSlotId, type MatrixCell, type MatrixTableDropSlot, type MatrixTableSlot } from '../model'
import type { MatrixDropPlacement, MatrixDropState } from '../matrixDrag'

export interface MatrixTableViewProps {
    t: TFunction<'interpretationNetwork'>
    cells: MatrixCell[]
    selectedCellId?: string
    positionLabels: Map<string, string>
    materialCountByCellId: Map<string, number>
    dropState: MatrixDropState
    mutationDisabled: boolean
    isMovingCell: boolean
    addAxisDisabled: boolean
    onSelectCell: (cellId: string) => void
    onOpenCellMenu: (anchor: HTMLElement, cellId: string) => void
    onAddRow: () => void
    onAddColumn: () => void
    onMoveSelectedToSlot: (slot: MatrixTableDropSlot) => void
}

const renderDropIndicatorSx = (dropPlacement: MatrixDropPlacement | null, invalid: boolean) =>
    dropPlacement
        ? {
              '&::before': {
                  content: '""',
                  position: 'absolute',
                  zIndex: 3,
                  pointerEvents: 'none',
                  borderColor: invalid ? 'error.main' : 'primary.main',
                  ...(dropPlacement === 'before'
                      ? { top: 0, bottom: 0, left: 0, borderLeft: 3, borderLeftStyle: 'dashed' }
                      : dropPlacement === 'after'
                      ? { top: 0, right: 0, bottom: 0, borderRight: 3, borderRightStyle: 'dashed' }
                      : { inset: 4, border: 2, borderStyle: 'dashed', borderRadius: 1 })
              }
          }
        : {}

const resolveSelectionOutlineColor = (fill: string | null): string =>
    fill ? resolveInterpretationNetworkMaximumContrastForeground(fill) : 'primary.main'

type MatrixTableCellProps = {
    t: TFunction<'interpretationNetwork'>
    slot: MatrixTableSlot
    selected: boolean
    positionLabel?: string
    materialCount: number
    dropPlacement: MatrixDropPlacement | null
    invalidDropTarget: boolean
    mutationDisabled: boolean
    isMovingCell: boolean
    canMoveSelectedToEmptySlot: boolean
    onSelectCell: (cellId: string) => void
    onOpenCellMenu: (anchor: HTMLElement, cellId: string) => void
    onMoveSelectedToSlot: (slot: MatrixTableDropSlot) => void
}

function OccupiedMatrixTableCell({
    t,
    slot,
    selected,
    positionLabel,
    materialCount,
    dropPlacement,
    invalidDropTarget,
    mutationDisabled,
    isMovingCell,
    onSelectCell,
    onOpenCellMenu
}: MatrixTableCellProps & { slot: MatrixTableSlot & { cell: MatrixCell } }) {
    const { cell } = slot
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: cell.id,
        disabled: mutationDisabled
    })
    const title = cell.title || t('workspace.emptyCell', 'Empty cell')
    const selectedOutlineColor = resolveSelectionOutlineColor(cell.style.fill)
    const accessibleName = t('workspace.table.cellName', {
        defaultValue: '{{row}}, {{column}}, {{position}}, {{title}}',
        row: slot.row.label,
        column: slot.column.label,
        position: positionLabel ?? t('workspace.table.noPosition', 'No position'),
        title
    })

    return (
        <TableCell
            ref={setNodeRef}
            data-testid='interpretation-network-table-cell'
            data-cell-id={cell.id}
            data-selected={selected ? 'true' : undefined}
            data-selected-outline={selected ? 'inset' : undefined}
            data-drop-placement={dropPlacement ?? undefined}
            component='td'
            sx={{
                position: 'relative',
                minWidth: 172,
                width: 196,
                p: 0,
                borderTop: invalidDropTarget ? '1px dashed' : cell.style.borderTop,
                borderRight: invalidDropTarget ? '1px dashed' : cell.style.borderRight,
                borderBottom: invalidDropTarget ? '1px dashed' : cell.style.borderBottom,
                borderLeft: invalidDropTarget ? '1px dashed' : cell.style.borderLeft,
                borderColor: invalidDropTarget ? 'error.main' : undefined,
                bgcolor: cell.style.fill ?? 'background.paper',
                color: cell.style.text ?? 'text.primary',
                opacity: isDragging ? 0.48 : 1,
                transform: CSS.Transform.toString(transform),
                transition,
                ...renderDropIndicatorSx(dropPlacement, invalidDropTarget),
                ...(selected
                    ? {
                          '&::after': {
                              content: '""',
                              position: 'absolute',
                              zIndex: 4,
                              inset: 0,
                              border: 2,
                              borderStyle: 'solid',
                              borderColor: selectedOutlineColor,
                              borderRadius: 0.5,
                              pointerEvents: 'none',
                              boxShadow: `inset 0 0 0 1px ${cell.style.text ?? 'rgba(255,255,255,0.72)'}`
                          }
                      }
                    : {})
            }}
        >
            <Stack direction='row' spacing={0} alignItems='stretch' sx={{ minHeight: 54, minWidth: 0 }}>
                <Tooltip title={t('workspace.cell.drag', 'Drag cell')}>
                    <span style={{ display: 'flex', alignSelf: 'stretch' }}>
                        <IconButton
                            type='button'
                            size='small'
                            aria-label={t('workspace.cell.drag', 'Drag cell')}
                            disabled={mutationDisabled || isMovingCell}
                            sx={{
                                width: 28,
                                height: 'auto',
                                minHeight: 54,
                                borderRadius: 0,
                                alignSelf: 'stretch',
                                color: 'text.secondary',
                                bgcolor: 'action.hover',
                                flexShrink: 0,
                                cursor: mutationDisabled || isMovingCell ? 'default' : 'grab',
                                '&:focus-visible': {
                                    outline: '2px solid',
                                    outlineColor: 'primary.main',
                                    outlineOffset: -3
                                }
                            }}
                            {...attributes}
                            {...listeners}
                        >
                            <DragIndicatorRoundedIcon fontSize='small' />
                        </IconButton>
                    </span>
                </Tooltip>
                <ButtonBase
                    aria-label={accessibleName}
                    aria-pressed={selected}
                    disabled={isMovingCell}
                    onClick={() => onSelectCell(cell.id)}
                    sx={{
                        flex: '1 1 auto',
                        minWidth: 0,
                        minHeight: 54,
                        justifyContent: 'flex-start',
                        alignItems: 'stretch',
                        textAlign: 'left',
                        color: cell.style.text ?? 'text.primary',
                        px: 1,
                        py: 0.75,
                        pr: 4.5,
                        '&:focus-visible': {
                            outline: '2px solid',
                            outlineColor: 'primary.main',
                            outlineOffset: -3
                        }
                    }}
                >
                    <Stack spacing={0.25} sx={{ minWidth: 0, width: '100%', justifyContent: 'center' }}>
                        <MatrixCellContent positionLabel={positionLabel} textColor={cell.style.text} compact>
                            {title}
                        </MatrixCellContent>
                        {materialCount > 0 ? (
                            <Typography variant='caption' sx={{ lineHeight: 1.3, color: cell.style.text ?? 'text.secondary' }}>
                                {t('workspace.table.materialCount', {
                                    defaultValue: '{{count}} materials',
                                    count: materialCount
                                })}
                            </Typography>
                        ) : null}
                    </Stack>
                </ButtonBase>
                <IconButton
                    type='button'
                    size='small'
                    aria-label={t('workspace.cell.actionsFor', {
                        defaultValue: 'Cell actions: {{title}}',
                        title
                    })}
                    disabled={isMovingCell}
                    onClick={(event) => {
                        event.stopPropagation()
                        onOpenCellMenu(event.currentTarget, cell.id)
                    }}
                    sx={{ position: 'absolute', top: 4, right: 4, width: 28, height: 28, p: 0.25 }}
                >
                    <MoreVertRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Stack>
        </TableCell>
    )
}

function EmptyMatrixTableCell(props: MatrixTableCellProps & { slot: MatrixTableSlot & { cell: null } }) {
    const tableSlot: MatrixTableDropSlot = {
        rowKey: props.slot.row.sourceKey,
        rowLabel: props.slot.row.label,
        rowLabelValue: props.slot.row.labelValue,
        colKey: props.slot.column.sourceKey,
        colLabel: props.slot.column.label,
        colLabelValue: props.slot.column.labelValue
    }
    const { isOver, setNodeRef } = useDroppable({
        id: toMatrixTableSlotId(tableSlot),
        data: { matrixTableSlot: tableSlot },
        disabled: props.mutationDisabled
    })
    const accessibleName = props.t('workspace.table.emptyIntersection', {
        defaultValue: 'Empty intersection: {{row}}, {{column}}',
        row: props.slot.row.label,
        column: props.slot.column.label
    })
    const moveLabel = props.t('workspace.table.moveSelectedHere', {
        defaultValue: 'Move selected cell here: {{row}}, {{column}}',
        row: props.slot.row.label,
        column: props.slot.column.label
    })

    return (
        <TableCell
            ref={setNodeRef}
            data-testid='interpretation-network-table-empty-cell'
            data-empty-drop-enabled='true'
            data-drop-target={isOver ? 'true' : undefined}
            aria-label={accessibleName}
            component='td'
            sx={{
                minWidth: 172,
                width: 196,
                p: 0,
                position: 'relative',
                bgcolor: isOver ? 'action.selected' : 'background.paper',
                ...renderDropIndicatorSx(isOver ? 'child' : null, false)
            }}
        >
            <Stack sx={{ minHeight: 54, alignItems: 'center', justifyContent: 'center', color: 'text.disabled', px: 1 }}>
                <ButtonBase
                    type='button'
                    aria-label={moveLabel}
                    disabled={props.mutationDisabled || props.isMovingCell || !props.canMoveSelectedToEmptySlot}
                    onClick={() => props.onMoveSelectedToSlot(tableSlot)}
                    sx={{
                        width: '100%',
                        minHeight: 54,
                        px: 1,
                        color: 'text.disabled',
                        textAlign: 'center',
                        '&:focus-visible': {
                            outline: '2px solid',
                            outlineColor: 'primary.main',
                            outlineOffset: -4
                        }
                    }}
                >
                    <Typography variant='caption'>{props.t('workspace.table.emptyCell', 'Empty')}</Typography>
                </ButtonBase>
            </Stack>
        </TableCell>
    )
}

function MatrixTableCell(props: MatrixTableCellProps & { allowEmptyDrop: boolean }) {
    if (props.slot.cell) {
        return <OccupiedMatrixTableCell {...props} slot={props.slot as MatrixTableSlot & { cell: MatrixCell }} />
    }
    if (props.allowEmptyDrop) {
        return <EmptyMatrixTableCell {...props} slot={props.slot as MatrixTableSlot & { cell: null }} />
    }

    const accessibleName = props.t('workspace.table.emptyIntersection', {
        defaultValue: 'Empty intersection: {{row}}, {{column}}',
        row: props.slot.row.label,
        column: props.slot.column.label
    })
    return (
        <TableCell
            data-testid='interpretation-network-table-empty-cell'
            data-empty-drop-enabled='false'
            aria-label={accessibleName}
            component='td'
            sx={{ minWidth: 172, width: 196, p: 0, bgcolor: 'background.paper' }}
        >
            <Stack sx={{ minHeight: 54, alignItems: 'center', justifyContent: 'center', color: 'text.disabled', px: 1 }}>
                <Typography variant='caption'>{props.t('workspace.table.emptyCell', 'Empty')}</Typography>
            </Stack>
        </TableCell>
    )
}

export function MatrixTableView({
    t,
    cells,
    selectedCellId,
    positionLabels,
    materialCountByCellId,
    dropState,
    mutationDisabled,
    isMovingCell,
    addAxisDisabled,
    onSelectCell,
    onOpenCellMenu,
    onAddRow,
    onAddColumn,
    onMoveSelectedToSlot
}: MatrixTableViewProps) {
    const table = useMemo(() => buildMatrixTableModel(cells), [cells])
    const dropTargetCellId = dropState.destination?.targetCellId ?? dropState.overCellId
    const minimumWidth = Math.max(408, 160 + table.columns.length * 196 + 48)
    const axisActionsDisabled = addAxisDisabled || cells.length === 0
    const addColumnTooltip =
        axisActionsDisabled && !isMovingCell
            ? t('workspace.table.selectCellBeforeAddColumn', 'Select a table cell before adding a column')
            : t('workspace.table.addColumn', 'Add column')
    const addRowTooltip =
        axisActionsDisabled && !isMovingCell
            ? t('workspace.table.selectCellBeforeAddRow', 'Select a table cell before adding a row')
            : t('workspace.table.addRow', 'Add row')

    return (
        <TableContainer
            component={Paper}
            variant='outlined'
            data-testid='interpretation-network-matrix-table'
            tabIndex={0}
            aria-label={t('workspace.table.scrollRegion', 'Matrix table')}
            sx={{
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                borderRadius: 1,
                bgcolor: 'background.paper',
                boxShadow: 'none',
                overflowX: 'auto',
                '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: 2
                }
            }}
        >
            <Table size='small' sx={{ minWidth: minimumWidth }} aria-label={t('workspace.table.label', 'Matrix table')}>
                <TableHead>
                    <TableRow>
                        <TableCell
                            component='th'
                            scope='col'
                            sx={{
                                width: 160,
                                minWidth: 160,
                                color: 'text.secondary',
                                fontWeight: 600,
                                bgcolor: 'background.paper'
                            }}
                        >
                            {t('workspace.table.rowHeader', 'Rows')}
                        </TableCell>
                        {table.columns.map((column) => (
                            <TableCell
                                key={column.key}
                                component='th'
                                scope='col'
                                align='center'
                                sx={{ minWidth: 172, width: 196, fontWeight: 600, bgcolor: 'background.paper' }}
                            >
                                {column.label}
                            </TableCell>
                        ))}
                        <TableCell
                            component='th'
                            scope='col'
                            align='center'
                            sx={{ width: 48, minWidth: 48, bgcolor: 'background.paper', p: 0.5 }}
                        >
                            <Tooltip title={addColumnTooltip}>
                                <span>
                                    <IconButton
                                        type='button'
                                        size='small'
                                        aria-label={t('workspace.table.addColumn', 'Add column')}
                                        disabled={axisActionsDisabled || isMovingCell}
                                        onClick={onAddColumn}
                                    >
                                        <AddRoundedIcon fontSize='small' />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {table.rows.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={Math.max(1, table.columns.length + 1)} align='center'>
                                <Typography variant='body2' color='text.secondary'>
                                    {t('workspace.matrixEmpty', 'Create a structure again to restore its root matrix cell.')}
                                </Typography>
                            </TableCell>
                        </TableRow>
                    ) : null}
                    {table.rows.map((row, rowIndex) => (
                        <TableRow key={row.key}>
                            <TableCell
                                component='th'
                                scope='row'
                                sx={{ width: 160, minWidth: 160, fontWeight: 600, bgcolor: 'background.paper' }}
                            >
                                {row.label}
                            </TableCell>
                            {table.slots[rowIndex]?.map((slot) => (
                                <MatrixTableCell
                                    key={`${slot.row.key}:${slot.column.key}`}
                                    t={t}
                                    slot={slot}
                                    allowEmptyDrop={slot.row.acceptsEmptyDrop !== false}
                                    selected={Boolean(slot.cell && slot.cell.id === selectedCellId)}
                                    positionLabel={slot.cell ? positionLabels.get(slot.cell.id) : undefined}
                                    materialCount={slot.cell ? materialCountByCellId.get(slot.cell.id) ?? 0 : 0}
                                    dropPlacement={slot.cell && dropTargetCellId === slot.cell.id ? dropState.placement : null}
                                    invalidDropTarget={Boolean(slot.cell && dropTargetCellId === slot.cell.id && !dropState.isValid)}
                                    mutationDisabled={mutationDisabled}
                                    isMovingCell={isMovingCell}
                                    canMoveSelectedToEmptySlot={Boolean(selectedCellId)}
                                    onSelectCell={onSelectCell}
                                    onOpenCellMenu={onOpenCellMenu}
                                    onMoveSelectedToSlot={onMoveSelectedToSlot}
                                />
                            ))}
                            <TableCell component='td' sx={{ width: 48, minWidth: 48, p: 0, bgcolor: 'background.paper' }} />
                        </TableRow>
                    ))}
                </TableBody>
                {table.rows.length > 0 ? (
                    <TableFooter>
                        <TableRow>
                            <TableCell
                                component='td'
                                align='center'
                                sx={{ width: 160, minWidth: 160, bgcolor: 'background.paper', p: 0.5 }}
                            >
                                <Tooltip title={addRowTooltip}>
                                    <span>
                                        <IconButton
                                            type='button'
                                            size='small'
                                            aria-label={t('workspace.table.addRow', 'Add row')}
                                            disabled={axisActionsDisabled || isMovingCell}
                                            onClick={onAddRow}
                                        >
                                            <AddRoundedIcon fontSize='small' />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </TableCell>
                            <TableCell colSpan={table.columns.length + 1} sx={{ bgcolor: 'background.paper', p: 0 }} />
                        </TableRow>
                    </TableFooter>
                ) : null}
            </Table>
        </TableContainer>
    )
}
