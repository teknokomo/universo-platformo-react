import type { DragEndEvent, DragMoveEvent, DragOverEvent, DragStartEvent, SensorDescriptor, SensorOptions } from '@dnd-kit/core'
import type { TFunction } from 'i18next'
import type { HierarchicalMatrixTableModel, MatrixCell, MatrixTableDropSlot, MatrixView } from '../model'
import type { MatrixCellPlacement } from '../matrixCellData'
import type { MatrixDragPreview, MatrixDropState, MatrixMode } from '../matrixDrag'
import { MatrixWorkspace, type MatrixMenuMove, type MatrixWorkspaceProps } from './MatrixWorkspace'
import type { InterpretationNetworkTableProjection, InterpretationNetworkToolbarLayout } from '@universo-react/types'

export interface MatrixWorkspaceBridgeProps {
    t: TFunction<'interpretationNetwork'>
    locale: string
    mode: MatrixMode
    matrixView: MatrixView
    allowedMatrixViews: MatrixView[]
    tableProjection: InterpretationNetworkTableProjection
    toolbarLayout: InterpretationNetworkToolbarLayout
    showHierarchicalTableHeaders: boolean
    showHierarchicalTableHeaderCard: boolean
    showMatrixTreeTotalCells: boolean
    colorBreadcrumbsByCell: boolean
    hierarchyRows: MatrixCell[][]
    hierarchicalTableModel: HierarchicalMatrixTableModel
    positionLabels: Map<string, string>
    cells: MatrixCell[]
    visibleCells: MatrixCell[]
    rows: MatrixWorkspaceProps['matrixRows']
    materialCountByCellId: Map<string, number>
    cellIds: string[]
    selectedCell: MatrixCell | undefined
    dropState: MatrixDropState
    dragPreview: MatrixDragPreview | null
    disabled: boolean
    axisActionsDisabled?: boolean
    addCellDisabled?: boolean
    savingCell: boolean
    movingCell: boolean
    errors: { rows: unknown; saveCell: unknown; moveCell: unknown }
    permissions: { canEditContent: boolean; canDeleteContent: boolean }
    menu: { anchor: HTMLElement | null; cell: MatrixCell | undefined; moves: MatrixMenuMove[] }
    deletingCell: boolean
    sensors: SensorDescriptor<SensorOptions>[]
    onChangeMatrixView: (view: MatrixView) => void
    actions: {
        openCellDialog: (
            mode: 'create-child' | 'create-cell' | 'create-row' | 'edit',
            cellId?: string,
            placement?: MatrixCellPlacement
        ) => void
        addTableRow: () => void
        addTableColumn: () => void
        moveSelectedToSlot: (slot: MatrixTableDropSlot) => void
        selectCell: (cellId: string) => void
        openCellMenu: (anchor: HTMLElement, cellId: string) => void
        closeCellMenu: () => void
        requestDeleteCell: (cellId: string) => void
        dragStart: (event: DragStartEvent) => void
        dragMove: (event: DragMoveEvent) => void
        dragOver: (event: DragOverEvent) => void
        dragCancel: () => void
        dragEnd: (event: DragEndEvent) => void
    }
}

export function MatrixWorkspaceBridge({
    t,
    locale,
    mode,
    matrixView,
    allowedMatrixViews,
    tableProjection,
    toolbarLayout,
    showHierarchicalTableHeaders,
    showHierarchicalTableHeaderCard,
    showMatrixTreeTotalCells,
    colorBreadcrumbsByCell,
    hierarchyRows,
    hierarchicalTableModel,
    positionLabels,
    cells,
    visibleCells,
    rows,
    materialCountByCellId,
    cellIds,
    selectedCell,
    dropState,
    dragPreview,
    disabled,
    axisActionsDisabled,
    addCellDisabled,
    savingCell,
    movingCell,
    errors,
    permissions,
    menu,
    deletingCell,
    sensors,
    onChangeMatrixView,
    actions
}: MatrixWorkspaceBridgeProps) {
    return (
        <MatrixWorkspace
            t={t}
            locale={locale}
            matrixMode={mode}
            matrixView={matrixView}
            allowedMatrixViews={allowedMatrixViews}
            tableProjection={tableProjection}
            toolbarLayout={toolbarLayout}
            showHierarchicalTableHeaders={showHierarchicalTableHeaders}
            showHierarchicalTableHeaderCard={showHierarchicalTableHeaderCard}
            showMatrixTreeTotalCells={showMatrixTreeTotalCells}
            colorBreadcrumbsByCell={colorBreadcrumbsByCell}
            hierarchyRows={hierarchyRows}
            hierarchicalTableModel={hierarchicalTableModel}
            positionLabels={positionLabels}
            matrixCells={cells}
            visibleMatrixCells={visibleCells}
            matrixRows={rows}
            materialCountByCellId={materialCountByCellId}
            matrixCellIds={cellIds}
            selectedCell={selectedCell}
            matrixDropState={dropState}
            matrixDragPreview={dragPreview}
            matrixMutationsDisabled={disabled}
            matrixAxisActionsDisabled={axisActionsDisabled}
            addCellDisabled={addCellDisabled}
            isSavingCell={savingCell}
            isMovingCell={movingCell}
            matrixRowsError={errors.rows}
            saveCellError={errors.saveCell}
            moveCellError={errors.moveCell}
            canEditContent={permissions.canEditContent}
            canDeleteContent={permissions.canDeleteContent}
            cellMenuAnchor={menu.anchor}
            menuCell={menu.cell}
            menuMoves={menu.moves}
            isDeletingCell={deletingCell}
            sensors={sensors}
            onChangeMatrixView={onChangeMatrixView}
            onOpenCellDialog={actions.openCellDialog}
            onAddTableRow={actions.addTableRow}
            onAddTableColumn={actions.addTableColumn}
            onMoveSelectedToSlot={actions.moveSelectedToSlot}
            onSelectCell={actions.selectCell}
            onOpenCellMenu={actions.openCellMenu}
            onCloseCellMenu={actions.closeCellMenu}
            onRequestDeleteCell={actions.requestDeleteCell}
            onDragStart={actions.dragStart}
            onDragMove={actions.dragMove}
            onDragOver={actions.dragOver}
            onDragCancel={actions.dragCancel}
            onDragEnd={actions.dragEnd}
        />
    )
}
