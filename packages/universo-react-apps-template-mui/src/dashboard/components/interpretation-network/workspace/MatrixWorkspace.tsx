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
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import ViewColumnRoundedIcon from '@mui/icons-material/ViewColumnRounded'
import type { SensorDescriptor, SensorOptions } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { extractRuntimeErrorMessage } from '../../../../utils/runtimeErrors'
import { MatrixCellButton } from '../MatrixCellButton'
import type { MatrixCell, MatrixHierarchyLayout } from '../model'
import type { MatrixDragPreview, MatrixDropState, MatrixMode } from '../matrixDrag'
import { matrixCollisionDetection } from './matrixCollisionDetection'

const fixedDropTargetsStrategy: SortingStrategy = () => null

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
    hierarchyLayout: MatrixHierarchyLayout
    hierarchyRows: MatrixCell[][]
    positionLabels: Map<string, string>
    matrixCells: MatrixCell[]
    visibleMatrixCells: MatrixCell[]
    matrixRows: Array<{ rowKey: string; cells: MatrixCell[] }>
    matrixCellIds: string[]
    selectedCell: MatrixCell | undefined
    matrixDropState: MatrixDropState
    matrixDragPreview: MatrixDragPreview | null
    matrixMutationsDisabled: boolean
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
    onChangeHierarchyLayout: (layout: MatrixHierarchyLayout) => void
    onOpenCellDialog: (mode: 'create-child' | 'create-cell' | 'create-row' | 'edit', cellId?: string) => void
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
    hierarchyLayout,
    hierarchyRows,
    positionLabels,
    matrixCells,
    visibleMatrixCells,
    matrixRows,
    matrixCellIds,
    selectedCell,
    matrixDropState,
    matrixDragPreview,
    matrixMutationsDisabled,
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
    onChangeHierarchyLayout,
    onOpenCellDialog,
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

    const isHorizontalHierarchy = matrixMode === 'hierarchicalCells' && hierarchyLayout === 'horizontalRows'

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
    const isPreviewPlaceholder = (cell: MatrixCell): boolean => matrixDragPreview?.activeCellId === cell.id

    return (
        <Box data-testid='interpretation-network-matrix-workspace'>
            <Stack
                data-testid='interpretation-network-matrix-toolbar'
                direction='row'
                spacing={1}
                sx={{ mb: 1, alignItems: 'center', justifyContent: 'space-between' }}
                useFlexGap
                flexWrap='wrap'
            >
                {matrixMode === 'hierarchicalCells' ? (
                    <ToggleButtonGroup
                        exclusive
                        size='small'
                        value={hierarchyLayout}
                        onChange={(_event, value: MatrixHierarchyLayout | null) => {
                            if (value) onChangeHierarchyLayout(value)
                        }}
                        aria-label={t('workspace.cell.hierarchyLayout', 'Matrix view')}
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
                        <ToggleButton value='horizontalRows' aria-label={t('workspace.cell.horizontalRows', 'Horizontal rows')}>
                            <Tooltip title={t('workspace.cell.horizontalRows', 'Horizontal rows')}>
                                <ViewColumnRoundedIcon fontSize='small' />
                            </Tooltip>
                        </ToggleButton>
                        <ToggleButton value='verticalTree' aria-label={t('workspace.cell.verticalTree', 'Vertical tree')}>
                            <Tooltip title={t('workspace.cell.verticalTree', 'Vertical tree')}>
                                <AccountTreeRoundedIcon fontSize='small' />
                            </Tooltip>
                        </ToggleButton>
                    </ToggleButtonGroup>
                ) : (
                    <Box />
                )}
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
                        onClick={() => onOpenCellDialog('create-child')}
                    >
                        {t('workspace.cell.add', 'Add')}
                    </Button>
                ) : (
                    <>
                        <Button
                            type='button'
                            size='small'
                            variant='contained'
                            startIcon={<AddRoundedIcon />}
                            disabled={matrixMutationsDisabled || isSavingCell}
                            onClick={() => onOpenCellDialog('create-row')}
                        >
                            {t('workspace.cell.addRow', 'Add row')}
                        </Button>
                        <Button
                            type='button'
                            size='small'
                            variant='contained'
                            startIcon={<AddRoundedIcon />}
                            disabled={matrixMutationsDisabled || isSavingCell || !selectedCell}
                            title={
                                !selectedCell
                                    ? t('workspace.cell.addSiblingDisabled', 'Select a row cell before adding another cell.')
                                    : undefined
                            }
                            onClick={() => onOpenCellDialog('create-cell')}
                        >
                            {t('workspace.cell.addSibling', 'Add cell in row')}
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
                    collisionDetection={matrixCollisionDetection}
                    measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                    onDragStart={onDragStart}
                    onDragMove={onDragMove}
                    onDragOver={onDragOver}
                    onDragCancel={onDragCancel}
                    onDragEnd={onDragEnd}
                >
                    <SortableContext
                        items={matrixCellIds}
                        strategy={
                            matrixMode === 'hierarchicalCells'
                                ? fixedDropTargetsStrategy
                                : isHorizontalHierarchy
                                ? verticalListSortingStrategy
                                : rectSortingStrategy
                        }
                    >
                        {matrixMode === 'hierarchicalCells'
                            ? isHorizontalHierarchy
                                ? previewHierarchyRows.map((row, rowIndex) => (
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
                                : previewVisibleCells.map((cell) => (
                                      <Box key={cell.id} data-testid='interpretation-network-matrix-row' sx={{ minWidth: 0 }}>
                                          {renderMatrixCell(cell, { placeholder: isPreviewPlaceholder(cell) })}
                                      </Box>
                                  ))
                            : matrixRows.map((row) => (
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
                              ))}
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
            </Box>
            <Menu anchorEl={cellMenuAnchor} open={Boolean(cellMenuAnchor)} onClose={onCloseCellMenu}>
                <MenuItem
                    disabled={!menuCell || !canEditContent}
                    onClick={() => {
                        const targetId = menuCell?.id
                        onCloseCellMenu()
                        if (targetId) onOpenCellDialog('edit', targetId)
                    }}
                >
                    <EditRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('workspace.cell.edit', 'Edit')}
                </MenuItem>
                {matrixMode === 'hierarchicalCells' ? (
                    <MenuItem
                        disabled={!menuCell || !canEditContent || matrixMutationsDisabled || isSavingCell}
                        onClick={() => {
                            const targetId = menuCell?.id
                            onCloseCellMenu()
                            if (targetId) onOpenCellDialog('create-child', targetId)
                        }}
                    >
                        <AddRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                        {t('workspace.cell.add', 'Add')}
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
