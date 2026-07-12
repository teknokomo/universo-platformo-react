import {
    DndContext,
    DragOverlay,
    MeasuringStrategy,
    type DragEndEvent,
    type DragMoveEvent,
    type DragOverEvent,
    type DragStartEvent
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, verticalListSortingStrategy, type SortingStrategy } from '@dnd-kit/sortable'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import TableRowsRoundedIcon from '@mui/icons-material/TableRowsRounded'
import ViewColumnRoundedIcon from '@mui/icons-material/ViewColumnRounded'
import type { SensorDescriptor, SensorOptions } from '@dnd-kit/core'
import { useMemo, type ReactNode } from 'react'
import type { TFunction } from 'i18next'
import type { InterpretationNetworkTableProjection, InterpretationNetworkToolbarLayout } from '@universo-react/types'
import { extractRuntimeErrorMessage } from '../../../../utils/runtimeErrors'
import { MatrixCellButton } from '../MatrixCellButton'
import {
    buildMatrixTableModel,
    toMatrixTableSlotId,
    type HierarchicalMatrixTableModel,
    type MatrixCell,
    type MatrixTableDropSlot,
    type MatrixView
} from '../model'
import type { MatrixCellPlacement } from '../matrixCellData'
import type { MatrixDragPreview, MatrixDropState, MatrixMode } from '../matrixDrag'
import { createMatrixCollisionDetection } from './matrixCollisionDetection'
import { HierarchicalMatrixTableView } from './HierarchicalMatrixTableView'
import { MatrixTableView } from './MatrixTableView'

const fixedDropTargetsStrategy: SortingStrategy = () => null

const renderTreeTotalLabel = (t: TFunction<'interpretationNetwork'>, count: number): string =>
    t('workspace.hierarchicalTable.totalCells', {
        defaultValue_one: 'Total {{count}} cell in the structure',
        defaultValue_other: 'Total {{count}} cells in the structure',
        count
    })

export interface MatrixMenuMove {
    label: string
    icon: ReactNode
    target: unknown
    action: () => void
}

export interface MatrixWorkspaceProps {
    t: TFunction<'interpretationNetwork'>
    locale: string
    matrixMode: MatrixMode
    matrixView: MatrixView
    allowedMatrixViews: MatrixView[]
    tableProjection: InterpretationNetworkTableProjection
    toolbarLayout: InterpretationNetworkToolbarLayout
    showHierarchicalTableHeaders: boolean
    showHierarchicalTableHeaderCard: boolean
    showMatrixTreeTotalCells?: boolean
    colorBreadcrumbsByCell: boolean
    hierarchyRows: MatrixCell[][]
    hierarchicalTableModel: HierarchicalMatrixTableModel
    positionLabels: Map<string, string>
    matrixCells: MatrixCell[]
    visibleMatrixCells: MatrixCell[]
    matrixRows: Array<{ rowKey: string; cells: MatrixCell[] }>
    materialCountByCellId: Map<string, number>
    matrixCellIds: string[]
    selectedCell: MatrixCell | undefined
    matrixDropState: MatrixDropState
    matrixDragPreview: MatrixDragPreview | null
    matrixMutationsDisabled: boolean
    matrixAxisActionsDisabled?: boolean
    addCellDisabled?: boolean
    isSavingCell: boolean
    isMovingCell: boolean
    matrixRowsError: unknown
    saveCellError: unknown
    moveCellError: unknown
    canEditContent: boolean
    canDeleteContent: boolean
    cellMenuAnchor: HTMLElement | null
    menuCell: MatrixCell | undefined
    menuMoves: MatrixMenuMove[]
    isDeletingCell: boolean
    sensors: SensorDescriptor<SensorOptions>[]
    onChangeMatrixView: (view: MatrixView) => void
    onOpenCellDialog: (
        mode: 'create-child' | 'create-cell' | 'create-row' | 'edit',
        cellId?: string,
        placement?: MatrixCellPlacement
    ) => void
    onAddTableRow: () => void
    onAddTableColumn: () => void
    onMoveSelectedToSlot: (slot: MatrixTableDropSlot) => void
    onSelectCell: (cellId: string) => void
    onOpenCellMenu: (anchor: HTMLElement, cellId: string) => void
    onCloseCellMenu: () => void
    onRequestDeleteCell: (cellId: string) => void
    onDragStart: (event: DragStartEvent) => void
    onDragMove: (event: DragMoveEvent) => void
    onDragOver: (event: DragOverEvent) => void
    onDragCancel: () => void
    onDragEnd: (event: DragEndEvent) => void
}

export function MatrixWorkspace({
    t,
    locale,
    matrixMode,
    matrixView,
    allowedMatrixViews,
    tableProjection,
    toolbarLayout,
    showHierarchicalTableHeaders,
    showHierarchicalTableHeaderCard,
    showMatrixTreeTotalCells = true,
    colorBreadcrumbsByCell,
    hierarchyRows,
    hierarchicalTableModel,
    positionLabels,
    matrixCells,
    visibleMatrixCells,
    matrixRows,
    materialCountByCellId,
    matrixCellIds,
    selectedCell,
    matrixDropState,
    matrixDragPreview,
    matrixMutationsDisabled,
    matrixAxisActionsDisabled = matrixMutationsDisabled,
    addCellDisabled = false,
    isSavingCell,
    isMovingCell,
    matrixRowsError,
    saveCellError,
    moveCellError,
    canEditContent,
    canDeleteContent,
    cellMenuAnchor,
    menuCell,
    menuMoves,
    isDeletingCell,
    sensors,
    onChangeMatrixView,
    onOpenCellDialog,
    onAddTableRow,
    onAddTableColumn,
    onMoveSelectedToSlot,
    onSelectCell,
    onOpenCellMenu,
    onCloseCellMenu,
    onRequestDeleteCell,
    onDragStart,
    onDragMove,
    onDragOver,
    onDragCancel,
    onDragEnd
}: MatrixWorkspaceProps) {
    const hierarchicalMatrixIsEmpty = matrixMode === 'hierarchicalCells' && matrixCells.length === 0
    const hierarchicalAddDisabled = matrixMutationsDisabled || isSavingCell || !selectedCell || hierarchicalMatrixIsEmpty
    const tableAxisAddDisabled = matrixAxisActionsDisabled || isSavingCell || hierarchicalMatrixIsEmpty
    const showIndependentRowAdd = matrixMode === 'independentRows' && matrixView === 'horizontalRows'
    const independentRowAddDisabled = matrixMutationsDisabled || isSavingCell || isMovingCell || !selectedCell

    const isHorizontalHierarchy = matrixMode === 'hierarchicalCells' && matrixView === 'horizontalRows'
    const buildCellAccessibleLabel = (cell: MatrixCell): string =>
        t('workspace.table.cellName', {
            defaultValue: '{{row}}, {{column}}, {{position}}, {{title}}',
            row: cell.rowLabel,
            column: cell.colLabel,
            position: positionLabels.get(cell.id) ?? t('workspace.table.noPosition', 'No position'),
            title: cell.title || t('workspace.emptyCell', 'Empty cell')
        })

    const openCellDialogAfterMenuClose = (mode: Parameters<typeof onOpenCellDialog>[0], cellId: string | undefined) => {
        onCloseCellMenu()
        if (!cellId) return
        window.requestAnimationFrame(() => onOpenCellDialog(mode, cellId))
    }
    const openMenuCellDialogAfterMenuClose = (mode: Parameters<typeof onOpenCellDialog>[0]) => {
        const targetId = menuCell?.id
        openCellDialogAfterMenuClose(mode, targetId)
    }

    const dropTargetCellId = matrixDropState.destination?.targetCellId ?? matrixDropState.overCellId
    const renderMatrixCell = (cell: MatrixCell, options: { overlay?: boolean; placeholder?: boolean } = {}) =>
        options.placeholder ? (
            <Box
                key={`placeholder-${cell.id}`}
                data-testid='interpretation-network-drop-placeholder'
                data-cell-id={cell.id}
                data-drop-placement={matrixDropState.placement ?? undefined}
                sx={{
                    minWidth: 0,
                    minHeight: 64,
                    border: 2,
                    borderStyle: 'dashed',
                    borderColor: 'primary.main',
                    borderRadius: 1,
                    bgcolor: 'action.selected',
                    opacity: 0.58
                }}
            />
        ) : (
            <MatrixCellButton
                key={options.overlay ? `overlay-${cell.id}` : cell.id}
                cell={cell}
                selected={!options.overlay && cell.id === selectedCell?.id}
                onSelect={() => {
                    if (!options.overlay) onSelectCell(cell.id)
                }}
                dragLabel={t('workspace.cell.drag', 'Drag cell')}
                menuLabel={t('workspace.cell.actionsFor', {
                    defaultValue: 'Cell actions: {{title}}',
                    title: cell.title || t('workspace.emptyCell', 'Empty cell')
                })}
                accessibleLabel={buildCellAccessibleLabel(cell)}
                onOpenMenu={(event) => {
                    if (options.overlay) return
                    onOpenCellMenu(event.currentTarget, cell.id)
                }}
                disabled={matrixMutationsDisabled || isMovingCell}
                depth={matrixMode === 'hierarchicalCells' && !isHorizontalHierarchy ? cell.depth : 0}
                positionLabel={positionLabels.get(cell.id)}
                isOriginMuted={!options.overlay && matrixDropState.activeCellId === cell.id}
                dropPlacement={!options.overlay && dropTargetCellId === cell.id ? matrixDropState.placement : null}
                dropIndicatorAxis={matrixMode === 'hierarchicalCells' && !isHorizontalHierarchy ? 'vertical' : 'horizontal'}
                isInvalidDropTarget={!options.overlay && dropTargetCellId === cell.id && !matrixDropState.isValid}
                isOverlay={options.overlay}
                freezeSortableTransform={matrixMode === 'hierarchicalCells'}
            >
                {cell.title || t('workspace.emptyCell', 'Empty cell')}
            </MatrixCellButton>
        )

    const previewHierarchyRows = matrixDragPreview?.hierarchyRows ?? hierarchyRows
    const previewVisibleCells = matrixDragPreview?.visibleCells ?? visibleMatrixCells
    const tableVisibleCells = visibleMatrixCells
    const isHierarchicalPathTable = matrixView === 'table' && matrixMode === 'hierarchicalCells' && tableProjection === 'hierarchicalPath'
    const matrixDisplayCellIds = useMemo(
        () => (matrixView === 'table' ? tableVisibleCells.map((cell) => cell.id) : matrixCellIds),
        [matrixCellIds, matrixView, tableVisibleCells]
    )
    const matrixDropTargetIds = useMemo(() => {
        const targetIds = new Set(matrixDisplayCellIds)
        if (matrixView === 'table' && !isHierarchicalPathTable) {
            const table = buildMatrixTableModel(tableVisibleCells)
            table.slots.flat().forEach((slot) => {
                if (!slot.cell && slot.row.acceptsEmptyDrop !== false) {
                    targetIds.add(
                        toMatrixTableSlotId({
                            rowKey: slot.row.sourceKey,
                            rowLabel: slot.row.label,
                            colKey: slot.column.sourceKey,
                            colLabel: slot.column.label
                        })
                    )
                }
            })
        }
        return targetIds
    }, [isHierarchicalPathTable, matrixDisplayCellIds, matrixView, tableVisibleCells])
    const matrixCellCollisionDetection = useMemo(() => createMatrixCollisionDetection(matrixDropTargetIds), [matrixDropTargetIds])
    const isPreviewPlaceholder = (cell: MatrixCell): boolean => matrixDragPreview?.activeCellId === cell.id

    return (
        <Box data-testid='interpretation-network-matrix-workspace'>
            <Stack
                data-testid='interpretation-network-matrix-toolbar'
                direction={toolbarLayout === 'vertical' ? 'column' : 'row'}
                spacing={1}
                sx={{
                    mb: 1,
                    alignItems: toolbarLayout === 'vertical' ? 'stretch' : 'center',
                    justifyContent: toolbarLayout === 'vertical' ? 'flex-start' : 'space-between'
                }}
                useFlexGap
                flexWrap='wrap'
            >
                <Stack direction='row' spacing={1} sx={{ minWidth: 0 }} useFlexGap flexWrap='wrap'>
                    {allowedMatrixViews.length > 1 ? (
                        <ToggleButtonGroup
                            exclusive
                            size='small'
                            value={matrixView}
                            onChange={(_event, value: MatrixView | null) => {
                                if (value) onChangeMatrixView(value)
                            }}
                            aria-label={t('workspace.display.mode', 'Matrix view')}
                            sx={{
                                height: 40,
                                flexShrink: 0,
                                '& .MuiToggleButton-root': {
                                    width: 40,
                                    minWidth: 40,
                                    height: 40,
                                    p: 0
                                }
                            }}
                        >
                            {allowedMatrixViews.includes('table') ? (
                                <ToggleButton value='table' aria-label={t('workspace.display.table', 'Table view')}>
                                    <Tooltip title={t('workspace.display.table', 'Table view')}>
                                        <TableRowsRoundedIcon fontSize='small' />
                                    </Tooltip>
                                </ToggleButton>
                            ) : null}
                            {allowedMatrixViews.includes('horizontalRows') ? (
                                <ToggleButton value='horizontalRows' aria-label={t('workspace.display.horizontalRows', 'Horizontal rows')}>
                                    <Tooltip title={t('workspace.display.horizontalRows', 'Horizontal rows')}>
                                        <ViewColumnRoundedIcon fontSize='small' />
                                    </Tooltip>
                                </ToggleButton>
                            ) : null}
                            {allowedMatrixViews.includes('verticalTree') ? (
                                <ToggleButton value='verticalTree' aria-label={t('workspace.display.verticalTree', 'Vertical tree')}>
                                    <Tooltip title={t('workspace.display.verticalTree', 'Vertical tree')}>
                                        <AccountTreeRoundedIcon fontSize='small' />
                                    </Tooltip>
                                </ToggleButton>
                            ) : null}
                        </ToggleButtonGroup>
                    ) : null}
                </Stack>
                {matrixMode === 'hierarchicalCells' ? (
                    <Button
                        type='button'
                        variant='contained'
                        startIcon={<AddRoundedIcon />}
                        disabled={hierarchicalAddDisabled}
                        sx={{ height: 40, minHeight: 40, px: 2, flexShrink: 0 }}
                        title={
                            !selectedCell || hierarchicalMatrixIsEmpty
                                ? t('workspace.cell.addChildDisabled', 'Select a cell before adding a child.')
                                : undefined
                        }
                        onClick={() => onOpenCellDialog('create-child', selectedCell?.id)}
                    >
                        {t('workspace.cell.add', 'Add')}
                    </Button>
                ) : (
                    <>
                        {showIndependentRowAdd ? (
                            <Button
                                type='button'
                                variant='outlined'
                                startIcon={<AddRoundedIcon />}
                                disabled={independentRowAddDisabled}
                                sx={{ height: 40, minHeight: 40, px: 2, flexShrink: 0 }}
                                title={
                                    !selectedCell
                                        ? t('workspace.table.selectCellBeforeAddRow', 'Select a cell before adding a row.')
                                        : undefined
                                }
                                onClick={onAddTableRow}
                            >
                                {t('workspace.table.addRow', 'Add row')}
                            </Button>
                        ) : null}
                        <Button
                            type='button'
                            variant='contained'
                            startIcon={<AddRoundedIcon />}
                            disabled={matrixMutationsDisabled || isSavingCell || addCellDisabled}
                            sx={{ height: 40, minHeight: 40, px: 2, flexShrink: 0 }}
                            title={
                                addCellDisabled
                                    ? t('workspace.cell.addDisabledSelectCell', 'Select a cell before adding another cell.')
                                    : undefined
                            }
                            onClick={() => onOpenCellDialog('create-cell')}
                        >
                            {t('workspace.cell.add', 'Add')}
                        </Button>
                    </>
                )}
            </Stack>
            {matrixRowsError ? (
                <Alert severity='error' sx={{ mb: 1 }}>
                    {extractRuntimeErrorMessage(matrixRowsError, t('workspace.matrixError', 'Failed to load matrix cells'), locale)}
                </Alert>
            ) : null}
            {saveCellError || moveCellError ? (
                <Alert severity='error' sx={{ mb: 1 }}>
                    {t('workspace.cell.error', 'Failed to update matrix cells')}
                </Alert>
            ) : null}
            {matrixCells.length === 0 ? (
                <Alert severity='info' sx={{ mb: 1 }}>
                    {t('workspace.matrixEmpty', 'Create a structure again to restore its root matrix cell.')}
                </Alert>
            ) : null}
            <Box
                data-testid='interpretation-network-matrix'
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    p: 0.5
                }}
            >
                <DndContext
                    sensors={sensors}
                    collisionDetection={matrixCellCollisionDetection}
                    measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                    onDragStart={onDragStart}
                    onDragMove={onDragMove}
                    onDragOver={onDragOver}
                    onDragCancel={onDragCancel}
                    onDragEnd={onDragEnd}
                >
                    <SortableContext
                        items={matrixDisplayCellIds}
                        strategy={
                            isHorizontalHierarchy
                                ? verticalListSortingStrategy
                                : matrixMode === 'hierarchicalCells'
                                ? fixedDropTargetsStrategy
                                : rectSortingStrategy
                        }
                    >
                        {isHierarchicalPathTable ? (
                            <HierarchicalMatrixTableView
                                t={t}
                                model={hierarchicalTableModel}
                                selectedCellId={selectedCell?.id}
                                positionLabels={positionLabels}
                                materialCountByCellId={materialCountByCellId}
                                showColumnHeaders={showHierarchicalTableHeaders}
                                showHeaderCard={showHierarchicalTableHeaderCard}
                                colorBreadcrumbsByCell={colorBreadcrumbsByCell}
                                mutationDisabled={matrixMutationsDisabled}
                                isMovingCell={isMovingCell}
                                dropTargetCellId={dropTargetCellId}
                                dropPlacement={matrixDropState.placement}
                                invalidDropTarget={Boolean(dropTargetCellId && !matrixDropState.isValid)}
                                onSelectCell={onSelectCell}
                                onOpenCellMenu={onOpenCellMenu}
                            />
                        ) : matrixView === 'table' ? (
                            <MatrixTableView
                                t={t}
                                cells={tableVisibleCells}
                                selectedCellId={selectedCell?.id}
                                positionLabels={positionLabels}
                                materialCountByCellId={materialCountByCellId}
                                dropState={matrixDropState}
                                mutationDisabled={matrixMutationsDisabled}
                                isMovingCell={isMovingCell}
                                addAxisDisabled={tableAxisAddDisabled}
                                onSelectCell={onSelectCell}
                                onOpenCellMenu={onOpenCellMenu}
                                onAddRow={onAddTableRow}
                                onAddColumn={onAddTableColumn}
                                onMoveSelectedToSlot={onMoveSelectedToSlot}
                            />
                        ) : matrixMode === 'hierarchicalCells' ? (
                            isHorizontalHierarchy ? (
                                previewHierarchyRows.map((row, rowIndex) => (
                                    <Box
                                        key={`level-${rowIndex}`}
                                        data-testid='interpretation-network-matrix-row'
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: `repeat(${Math.max(row.length, 1)}, minmax(0, 1fr))`,
                                            gap: 1,
                                            minWidth: 0,
                                            overflowWrap: 'anywhere'
                                        }}
                                    >
                                        {row.map((cell) => renderMatrixCell(cell, { placeholder: isPreviewPlaceholder(cell) }))}
                                    </Box>
                                ))
                            ) : (
                                previewVisibleCells.map((cell) => (
                                    <Box key={cell.id} data-testid='interpretation-network-matrix-row' sx={{ minWidth: 0 }}>
                                        {renderMatrixCell(cell, { placeholder: isPreviewPlaceholder(cell) })}
                                    </Box>
                                ))
                            )
                        ) : (
                            matrixRows.map((row) => (
                                <Box
                                    key={row.rowKey}
                                    data-testid='interpretation-network-matrix-row'
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: `repeat(${Math.max(row.cells.length, 1)}, minmax(0, 1fr))`,
                                        gap: 1,
                                        minWidth: 0
                                    }}
                                >
                                    {row.cells.map((cell) => renderMatrixCell(cell))}
                                </Box>
                            ))
                        )}
                    </SortableContext>
                    <DragOverlay>
                        {(() => {
                            const activeCell = matrixDropState.activeCellId
                                ? visibleMatrixCells.find((cell) => cell.id === matrixDropState.activeCellId) ??
                                  matrixCells.find((cell) => cell.id === matrixDropState.activeCellId)
                                : undefined
                            return activeCell ? renderMatrixCell(activeCell, { overlay: true }) : null
                        })()}
                    </DragOverlay>
                </DndContext>
                {showMatrixTreeTotalCells ? (
                    <Paper
                        variant='outlined'
                        data-testid='interpretation-network-tree-total-cells'
                        sx={{
                            width: '100%',
                            minWidth: 0,
                            p: 1.25,
                            borderRadius: 1,
                            bgcolor: 'action.hover',
                            boxShadow: 'none'
                        }}
                    >
                        <Typography variant='body2' color='text.secondary' sx={{ fontWeight: 500 }}>
                            {renderTreeTotalLabel(t, matrixCells.length)}
                        </Typography>
                    </Paper>
                ) : null}
            </Box>
            <Menu anchorEl={cellMenuAnchor} open={Boolean(cellMenuAnchor)} onClose={onCloseCellMenu}>
                <MenuItem disabled={!menuCell || !canEditContent} onClick={() => openMenuCellDialogAfterMenuClose('edit')}>
                    <EditRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('workspace.cell.edit', 'Edit')}
                </MenuItem>
                {matrixMode === 'hierarchicalCells' ? (
                    <MenuItem
                        disabled={!menuCell || !canEditContent || matrixMutationsDisabled || isSavingCell}
                        onClick={() => openMenuCellDialogAfterMenuClose('create-child')}
                    >
                        <AddRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                        {t('workspace.cell.add', 'Add')}
                    </MenuItem>
                ) : null}
                {matrixMode !== 'hierarchicalCells' ? (
                    <MenuItem
                        disabled={!menuCell || !canEditContent || matrixMutationsDisabled || isSavingCell}
                        onClick={() => openMenuCellDialogAfterMenuClose('create-cell')}
                    >
                        <AddRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                        {t('workspace.cell.addSibling', 'Add cell in row')}
                    </MenuItem>
                ) : null}
                {menuMoves.length > 0 ? <Divider /> : null}
                {menuMoves.map((move) => (
                    <MenuItem key={move.label} disabled={matrixMutationsDisabled || isMovingCell} onClick={move.action}>
                        {move.icon}
                        <Box component='span' sx={{ ml: 1 }}>
                            {move.label}
                        </Box>
                    </MenuItem>
                ))}
                <Divider />
                <MenuItem
                    disabled={!menuCell || !canDeleteContent || isDeletingCell}
                    onClick={() => {
                        const targetId = menuCell?.id
                        onCloseCellMenu()
                        if (targetId) onRequestDeleteCell(targetId)
                    }}
                    sx={{ color: 'error.main' }}
                >
                    <DeleteRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('workspace.cell.delete', 'Delete')}
                </MenuItem>
            </Menu>
        </Box>
    )
}
