import type { DragEndEvent, DragMoveEvent, DragOverEvent, DragStartEvent, SensorDescriptor, SensorOptions } from '@dnd-kit/core'
import type { TFunction } from 'i18next'
import type { MatrixCell, MatrixHierarchyLayout } from '../model'
import type { MatrixDragPreview, MatrixDropState, MatrixMode } from '../matrixDrag'
import { MatrixWorkspace, type MatrixMenuMove, type MatrixWorkspaceProps } from './MatrixWorkspace'

export interface MatrixWorkspaceBridgeProps {
    t: TFunction<'interpretationNetwork'>
    locale: string
    mode: MatrixMode
    hierarchyLayout: MatrixHierarchyLayout
    hierarchyRows: MatrixCell[][]
    positionLabels: Map<string, string>
    cells: MatrixCell[]
    visibleCells: MatrixCell[]
    rows: MatrixWorkspaceProps['matrixRows']
    cellIds: string[]
    selectedCell: MatrixCell | undefined
    dropState: MatrixDropState
    dragPreview: MatrixDragPreview | null
    disabled: boolean
    savingCell: boolean
    movingCell: boolean
    errors: { rows: unknown; saveCell: unknown; moveCell: unknown }
    permissions: { canEditContent: boolean; canDeleteContent: boolean }
    menu: { anchor: HTMLElement | null; cell: MatrixCell | undefined; moves: MatrixMenuMove[] }
    deletingCell: boolean
    sensors: SensorDescriptor<SensorOptions>[]
    onChangeHierarchyLayout: (layout: MatrixHierarchyLayout) => void
    actions: {
        openCellDialog: (mode: 'create-child' | 'create-cell' | 'create-row' | 'edit', cellId?: string) => void
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
    hierarchyLayout,
    hierarchyRows,
    positionLabels,
    cells,
    visibleCells,
    rows,
    cellIds,
    selectedCell,
    dropState,
    dragPreview,
    disabled,
    savingCell,
    movingCell,
    errors,
    permissions,
    menu,
    deletingCell,
    sensors,
    onChangeHierarchyLayout,
    actions
}: MatrixWorkspaceBridgeProps) {
    return (
        <MatrixWorkspace
            t={t}
            locale={locale}
            matrixMode={mode}
            hierarchyLayout={hierarchyLayout}
            hierarchyRows={hierarchyRows}
            positionLabels={positionLabels}
            matrixCells={cells}
            visibleMatrixCells={visibleCells}
            matrixRows={rows}
            matrixCellIds={cellIds}
            selectedCell={selectedCell}
            matrixDropState={dropState}
            matrixDragPreview={dragPreview}
            matrixMutationsDisabled={disabled}
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
            onChangeHierarchyLayout={onChangeHierarchyLayout}
            onOpenCellDialog={actions.openCellDialog}
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
