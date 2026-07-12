import Breadcrumbs from '@mui/material/Breadcrumbs'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TFunction } from 'i18next'
import { useState } from 'react'
import { MatrixCellContent } from '../MatrixCellButton'
import { buildBreadcrumbDisplayItems, type HierarchicalMatrixTableModel, type MatrixCell } from '../model'
import type { MatrixDropPlacement } from '../matrixDrag'

export interface HierarchicalMatrixTableViewProps {
    t: TFunction<'interpretationNetwork'>
    model: HierarchicalMatrixTableModel
    selectedCellId?: string
    positionLabels: Map<string, string>
    materialCountByCellId: Map<string, number>
    showColumnHeaders: boolean
    showHeaderCard: boolean
    colorBreadcrumbsByCell: boolean
    mutationDisabled: boolean
    isMovingCell: boolean
    dropTargetCellId?: string | null
    dropPlacement: MatrixDropPlacement | null
    invalidDropTarget: boolean
    onSelectCell: (cellId: string) => void
    onOpenCellMenu: (anchor: HTMLElement, cellId: string) => void
}

const getCellTitle = (t: TFunction<'interpretationNetwork'>, cell: MatrixCell): string =>
    cell.title || t('workspace.emptyCell', 'Empty cell')

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
                      ? { top: 0, right: 0, left: 0, borderTop: 3, borderTopStyle: 'dashed' }
                      : dropPlacement === 'after'
                      ? { right: 0, bottom: 0, left: 0, borderBottom: 3, borderBottomStyle: 'dashed' }
                      : { inset: 4, border: 2, borderStyle: 'dashed', borderRadius: 1 })
              }
          }
        : {}

const getBreadcrumbSx = (cell: MatrixCell, colorBreadcrumbsByCell: boolean, current: boolean) =>
    colorBreadcrumbsByCell
        ? {
              minWidth: 0,
              maxWidth: 240,
              px: 1,
              py: 0.35,
              borderRadius: 1,
              border: '1px solid',
              borderColor: current ? 'primary.main' : 'divider',
              backgroundColor: cell.style.fill ?? 'action.hover',
              color: 'text.primary',
              textTransform: 'none',
              fontWeight: current ? 600 : 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              boxShadow: current ? 1 : 0,
              transition: 'box-shadow 120ms ease, filter 120ms ease, outline-color 120ms ease',
              '&:hover': {
                  boxShadow: 2,
                  filter: 'brightness(1.04)'
              },
              '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: 2,
                  boxShadow: 2
              }
          }
        : {
              minWidth: 0,
              maxWidth: 240,
              px: 0.5,
              textTransform: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: 2
              }
          }

type HierarchicalMatrixTableCellProps = {
    t: TFunction<'interpretationNetwork'>
    cell: MatrixCell
    selected: boolean
    positionLabel?: string
    materialCount: number
    dropPlacement: MatrixDropPlacement | null
    invalidDropTarget: boolean
    mutationDisabled: boolean
    isMovingCell: boolean
    colSpan?: number
    component?: 'td' | 'th'
    scope?: 'row'
    island?: boolean
    leadingGap?: boolean
    showDragHandle?: boolean
    onSelectCell: (cellId: string) => void
    onOpenCellMenu: (anchor: HTMLElement, cellId: string) => void
}

function HierarchicalMatrixTableCell({
    t,
    cell,
    selected,
    positionLabel,
    materialCount,
    dropPlacement,
    invalidDropTarget,
    mutationDisabled,
    isMovingCell,
    colSpan,
    component,
    scope,
    island = false,
    leadingGap = false,
    showDragHandle = true,
    onSelectCell,
    onOpenCellMenu
}: HierarchicalMatrixTableCellProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: cell.id,
        disabled: mutationDisabled
    })
    const title = getCellTitle(t, cell)
    const contentTransform = island ? undefined : CSS.Transform.toString(transform)

    const cellContent = (
        <Stack
            direction='row'
            spacing={0}
            alignItems='stretch'
            sx={{
                minHeight: 54,
                minWidth: 0,
                position: 'relative',
                bgcolor: cell.style.fill ?? 'background.paper',
                borderTop: invalidDropTarget ? '1px dashed' : cell.style.borderTop,
                borderRight: invalidDropTarget ? '1px dashed' : cell.style.borderRight,
                borderBottom: invalidDropTarget ? '1px dashed' : cell.style.borderBottom,
                borderLeft: invalidDropTarget ? '1px dashed' : cell.style.borderLeft,
                borderColor: invalidDropTarget ? 'error.main' : undefined,
                opacity: isDragging ? 0.48 : 1,
                transform: contentTransform,
                transition: island ? undefined : transition,
                outline: 0,
                borderRadius: 1,
                overflow: 'hidden',
                ...renderDropIndicatorSx(dropPlacement, invalidDropTarget),
                ...(selected
                    ? {
                          '&::after': {
                              content: '""',
                              position: 'absolute',
                              zIndex: 4,
                              inset: 3,
                              border: 2,
                              borderStyle: 'solid',
                              borderColor: 'primary.main',
                              borderRadius: 0.75,
                              pointerEvents: 'none'
                          }
                      }
                    : {})
            }}
        >
            {showDragHandle ? (
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
            ) : null}
            <ButtonBase
                aria-label={t('workspace.hierarchicalTable.cellName', {
                    defaultValue: '{{position}}, {{title}}',
                    position: positionLabel ?? t('workspace.table.noPosition', 'No position'),
                    title
                })}
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
                    color: 'text.primary',
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
                    <MatrixCellContent positionLabel={positionLabel} compact>
                        {title}
                    </MatrixCellContent>
                    {materialCount > 0 ? (
                        <Typography variant='caption' color='text.secondary' sx={{ lineHeight: 1.3 }}>
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
                disabled={mutationDisabled || isMovingCell}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                    event.stopPropagation()
                    onOpenCellMenu(event.currentTarget, cell.id)
                }}
                sx={{ position: 'absolute', top: 4, right: 4, width: 28, height: 28, p: 0.25 }}
            >
                <MoreVertRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
        </Stack>
    )

    if (island) {
        return (
            <Paper
                ref={setNodeRef}
                variant='outlined'
                data-testid='interpretation-network-table-header-card'
                data-cell-id={cell.id}
                data-selected={selected ? 'true' : undefined}
                data-selected-outline={selected ? 'inset' : undefined}
                data-drop-placement={dropPlacement ?? undefined}
                data-invalid-drop-target={invalidDropTarget ? 'true' : undefined}
                sx={{
                    width: '100%',
                    minWidth: 0,
                    opacity: isDragging ? 0.48 : 1,
                    transform: CSS.Transform.toString(transform),
                    transition,
                    borderRadius: 1,
                    boxShadow: 'none',
                    overflow: 'hidden'
                }}
            >
                {cellContent}
            </Paper>
        )
    }

    return (
        <TableCell
            ref={setNodeRef}
            component={component}
            scope={scope}
            colSpan={colSpan}
            data-testid='interpretation-network-table-cell'
            data-cell-id={cell.id}
            data-selected={selected ? 'true' : undefined}
            data-selected-outline={selected ? 'inset' : undefined}
            data-leading-gap={leadingGap ? 'true' : undefined}
            data-drop-placement={dropPlacement ?? undefined}
            data-invalid-drop-target={invalidDropTarget ? 'true' : undefined}
            sx={{
                minWidth: 220,
                pt: 0.25,
                pr: 0.25,
                pb: 0.25,
                pl: leadingGap ? 1 : 0.25,
                border: 0,
                bgcolor: 'background.paper'
            }}
        >
            {cellContent}
        </TableCell>
    )
}

export function HierarchicalMatrixTableView({
    t,
    model,
    selectedCellId,
    positionLabels,
    materialCountByCellId,
    showColumnHeaders,
    showHeaderCard,
    colorBreadcrumbsByCell,
    mutationDisabled,
    isMovingCell,
    dropTargetCellId,
    dropPlacement,
    invalidDropTarget,
    onSelectCell,
    onOpenCellMenu
}: HierarchicalMatrixTableViewProps) {
    const [hiddenMenuAnchor, setHiddenMenuAnchor] = useState<HTMLElement | null>(null)
    const headerCell = model.headerCell
    const headerTitle = headerCell ? getCellTitle(t, headerCell) : ''
    const maxChildCount = Math.max(1, ...model.tableRows.map((row) => row.cells.length))
    const onlyHeaderRow =
        headerCell &&
        model.tableRows.length === 1 &&
        model.tableRows[0]?.rowCell.id === headerCell.id &&
        model.tableRows[0]?.cells.length === 0
    const showIntermediateHeaderCell = headerCell && (onlyHeaderRow || showHeaderCard) ? headerCell : null
    const breadcrumbPath =
        !showHeaderCard && headerCell && !onlyHeaderRow ? [...model.hiddenBreadcrumbs, ...model.visibleBreadcrumbs, headerCell] : null
    const breadcrumbDisplay = breadcrumbPath
        ? buildBreadcrumbDisplayItems(breadcrumbPath, model.breadcrumbDepth)
        : { hiddenPrefix: model.hiddenBreadcrumbs, visibleTail: model.visibleBreadcrumbs }
    const hiddenBreadcrumbs = breadcrumbDisplay.hiddenPrefix
    const visibleBreadcrumbs = breadcrumbDisplay.visibleTail
    const showTableBody = !onlyHeaderRow && model.tableRows.length > 0
    const rootOnlyHeaderCell =
        showIntermediateHeaderCell && model.rootState.kind === 'singleRoot' && (onlyHeaderRow || model.tableRows.length === 0)
    const tableLabel = headerTitle
        ? t('workspace.hierarchicalTable.labelFor', {
              defaultValue: 'Matrix table for {{title}}',
              title: headerTitle
          })
        : t('workspace.hierarchicalTable.label', 'Hierarchical matrix table')

    return (
        <Stack spacing={1.25} data-testid='interpretation-network-hierarchical-table'>
            {hiddenBreadcrumbs.length > 0 || visibleBreadcrumbs.length > 0 ? (
                <Breadcrumbs
                    aria-label={t('workspace.breadcrumbs.label', 'Matrix path')}
                    separator='/'
                    sx={{ minWidth: 0, '& .MuiBreadcrumbs-ol': { flexWrap: 'wrap', rowGap: 0.5 } }}
                >
                    {hiddenBreadcrumbs.length > 0 ? (
                        <Tooltip title={t('workspace.breadcrumbs.showHidden', 'Show hidden path')}>
                            <IconButton
                                type='button'
                                size='small'
                                aria-label={t('workspace.breadcrumbs.showHidden', 'Show hidden path')}
                                onClick={(event) => setHiddenMenuAnchor(event.currentTarget)}
                            >
                                <MoreHorizRoundedIcon fontSize='small' />
                            </IconButton>
                        </Tooltip>
                    ) : null}
                    {visibleBreadcrumbs.map((cell) => {
                        const title = getCellTitle(t, cell)
                        const current = cell.id === model.focusedCell?.id
                        return current ? (
                            <Typography
                                key={cell.id}
                                color='text.primary'
                                aria-current='page'
                                data-testid='interpretation-network-breadcrumb-item'
                                data-cell-id={cell.id}
                                data-cell-colored={colorBreadcrumbsByCell ? 'true' : undefined}
                                sx={getBreadcrumbSx(cell, colorBreadcrumbsByCell, true)}
                            >
                                {title}
                            </Typography>
                        ) : (
                            <Button
                                key={cell.id}
                                type='button'
                                variant='text'
                                size='small'
                                onClick={() => onSelectCell(cell.id)}
                                data-testid='interpretation-network-breadcrumb-item'
                                data-cell-id={cell.id}
                                data-cell-colored={colorBreadcrumbsByCell ? 'true' : undefined}
                                sx={getBreadcrumbSx(cell, colorBreadcrumbsByCell, false)}
                            >
                                {title}
                            </Button>
                        )
                    })}
                </Breadcrumbs>
            ) : null}

            <Menu anchorEl={hiddenMenuAnchor} open={Boolean(hiddenMenuAnchor)} onClose={() => setHiddenMenuAnchor(null)}>
                {hiddenBreadcrumbs.map((cell) => (
                    <MenuItem
                        key={cell.id}
                        onClick={() => {
                            setHiddenMenuAnchor(null)
                            onSelectCell(cell.id)
                        }}
                    >
                        {getCellTitle(t, cell)}
                    </MenuItem>
                ))}
            </Menu>

            {model.rootState.kind === 'empty' ? (
                <Paper variant='outlined' sx={{ p: 2, borderRadius: 1 }}>
                    <Typography variant='body2' color='text.secondary'>
                        {t('workspace.hierarchicalTable.noRoot', 'Create a root cell to start the hierarchy.')}
                    </Typography>
                </Paper>
            ) : headerCell || model.tableRows.length > 0 ? (
                <>
                    {showIntermediateHeaderCell ? (
                        <HierarchicalMatrixTableCell
                            t={t}
                            cell={showIntermediateHeaderCell}
                            selected={showIntermediateHeaderCell.id === selectedCellId}
                            positionLabel={positionLabels.get(showIntermediateHeaderCell.id)}
                            materialCount={materialCountByCellId.get(showIntermediateHeaderCell.id) ?? 0}
                            dropPlacement={dropTargetCellId === showIntermediateHeaderCell.id ? dropPlacement : null}
                            invalidDropTarget={Boolean(dropTargetCellId === showIntermediateHeaderCell.id && invalidDropTarget)}
                            mutationDisabled={mutationDisabled}
                            isMovingCell={isMovingCell}
                            island
                            showDragHandle={!rootOnlyHeaderCell}
                            onSelectCell={onSelectCell}
                            onOpenCellMenu={onOpenCellMenu}
                        />
                    ) : null}
                    {model.rootState.kind === 'multipleRoots' ? (
                        <Paper
                            variant='outlined'
                            sx={{
                                p: 2,
                                borderRadius: 1,
                                borderColor: 'warning.light',
                                backgroundColor: 'background.paper'
                            }}
                        >
                            <Typography variant='subtitle2' color='warning.dark'>
                                {t('workspace.hierarchicalTable.multipleRoots', 'Multiple root cells')}
                            </Typography>
                            <Typography variant='body2' color='text.secondary'>
                                {t('workspace.hierarchicalTable.multipleRootsHelp', 'Choose a root cell to continue navigation.')}
                            </Typography>
                        </Paper>
                    ) : null}
                    {showTableBody ? (
                        <TableContainer
                            component={Paper}
                            variant='outlined'
                            data-testid='interpretation-network-matrix-table'
                            tabIndex={0}
                            aria-label={tableLabel}
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
                            <Table
                                size='small'
                                sx={{ minWidth: 408, borderCollapse: 'separate', borderSpacing: 0.5 }}
                                aria-label={tableLabel}
                            >
                                {!showColumnHeaders ? null : (
                                    <TableHead>
                                        <TableRow>
                                            <TableCell component='th' scope='col' sx={{ minWidth: 220, fontWeight: 600 }}>
                                                {t('workspace.hierarchicalTable.rowHeader', 'Current level')}
                                            </TableCell>
                                            <TableCell
                                                component='th'
                                                scope='col'
                                                colSpan={maxChildCount}
                                                sx={{ minWidth: 220, fontWeight: 600 }}
                                            >
                                                {t('workspace.hierarchicalTable.cellHeader', 'Cell')}
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                )}
                                <TableBody>
                                    {model.tableRows.map((row) => (
                                        <TableRow key={row.rowCell.id} data-testid='interpretation-network-table-row'>
                                            <HierarchicalMatrixTableCell
                                                t={t}
                                                cell={row.rowCell}
                                                selected={row.rowCell.id === selectedCellId}
                                                positionLabel={positionLabels.get(row.rowCell.id)}
                                                materialCount={materialCountByCellId.get(row.rowCell.id) ?? 0}
                                                dropPlacement={dropTargetCellId === row.rowCell.id ? dropPlacement : null}
                                                invalidDropTarget={Boolean(dropTargetCellId === row.rowCell.id && invalidDropTarget)}
                                                mutationDisabled={mutationDisabled}
                                                isMovingCell={isMovingCell}
                                                component='th'
                                                scope='row'
                                                onSelectCell={onSelectCell}
                                                onOpenCellMenu={onOpenCellMenu}
                                            />
                                            {row.cells.length > 0 ? (
                                                row.cells.map((cell, cellIndex) => (
                                                    <HierarchicalMatrixTableCell
                                                        key={cell.id}
                                                        t={t}
                                                        cell={cell}
                                                        selected={cell.id === selectedCellId}
                                                        positionLabel={positionLabels.get(cell.id)}
                                                        materialCount={materialCountByCellId.get(cell.id) ?? 0}
                                                        dropPlacement={dropTargetCellId === cell.id ? dropPlacement : null}
                                                        invalidDropTarget={Boolean(dropTargetCellId === cell.id && invalidDropTarget)}
                                                        mutationDisabled={mutationDisabled}
                                                        isMovingCell={isMovingCell}
                                                        leadingGap={cellIndex === 0}
                                                        onSelectCell={onSelectCell}
                                                        onOpenCellMenu={onOpenCellMenu}
                                                    />
                                                ))
                                            ) : (
                                                <TableCell colSpan={maxChildCount} sx={{ border: 0 }}>
                                                    <Typography variant='body2' color='text.secondary'>
                                                        {t('workspace.hierarchicalTable.noChildren', 'This cell has no child cells yet.')}
                                                    </Typography>
                                                </TableCell>
                                            )}
                                            {row.cells.length > 0 && row.cells.length < maxChildCount
                                                ? Array.from({ length: maxChildCount - row.cells.length }).map((_, index) => (
                                                      <TableCell
                                                          key={`${row.rowCell.id}-empty-${index}`}
                                                          aria-hidden='true'
                                                          sx={{ border: 0, bgcolor: 'background.paper' }}
                                                      />
                                                  ))
                                                : null}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : null}
                </>
            ) : (
                <Paper variant='outlined' sx={{ p: 2, borderRadius: 1 }}>
                    <Typography variant='body2' color='text.secondary'>
                        {t('workspace.hierarchicalTable.noRoot', 'Create a root cell to start the hierarchy.')}
                    </Typography>
                </Paper>
            )}
        </Stack>
    )
}
