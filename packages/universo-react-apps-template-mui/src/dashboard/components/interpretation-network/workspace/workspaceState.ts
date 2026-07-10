import type { MatrixDropState } from '../matrixDrag'

export type MaterialDialogMode = 'create' | 'edit'
export type CellDialogMode = 'create-child' | 'create-cell' | 'create-row' | 'edit'
export type MatrixAxisDialogKind = 'row' | 'column'
export type StructureDialogMode = 'create' | 'edit'

export const EMPTY_MATRIX_DROP_STATE: MatrixDropState = {
    activeCellId: null,
    overCellId: null,
    placement: null,
    isValid: false,
    destination: null
}
