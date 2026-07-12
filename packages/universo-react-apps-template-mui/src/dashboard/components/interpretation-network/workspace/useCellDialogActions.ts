import { useCallback } from 'react'
import type { MatrixCell, MatrixView } from '../model'
import type { MatrixCellPlacement } from '../matrixCellData'
import type { CellDialogMode, MatrixAxisDialogKind } from './workspaceState'
import type { SelectMatrixCell } from './useMatrixWorkspaceActions'

export function useCellDialogActions({
    matrixMode,
    allowNewAxesInCellDialog,
    effectiveMatrixView,
    matrixCells,
    visibleMatrixCells,
    selectedCellId,
    selectedCell,
    selectMatrixCell,
    setCellDialogSourceCellId,
    setCellDialogPlacement,
    setCellDialogError,
    setCellDialogMode,
    setAxisDialogKind
}: {
    matrixMode: 'hierarchicalCells' | 'independentRows'
    allowNewAxesInCellDialog: boolean
    effectiveMatrixView: MatrixView
    matrixCells: MatrixCell[]
    visibleMatrixCells: MatrixCell[]
    selectedCellId: string | null
    selectedCell: MatrixCell | undefined
    selectMatrixCell: SelectMatrixCell
    setCellDialogSourceCellId: (cellId: string | null) => void
    setCellDialogPlacement: (placement: MatrixCellPlacement | null) => void
    setCellDialogError: (error: string | null) => void
    setCellDialogMode: (mode: CellDialogMode | null) => void
    setAxisDialogKind: (kind: MatrixAxisDialogKind | null) => void
}) {
    const openCellDialog = useCallback(
        (mode: CellDialogMode, cellId?: string, placement?: MatrixCellPlacement) => {
            const sourceCellId = cellId ?? selectedCellId
            const sourceCell = sourceCellId ? matrixCells.find((cell) => cell.id === sourceCellId) : undefined
            if (matrixMode === 'hierarchicalCells' && mode === 'create-child' && !sourceCell) {
                return
            }
            const defaultPlacement: MatrixCellPlacement | null =
                placement ??
                (sourceCell && mode === 'create-cell'
                    ? {
                          row: {
                              kind: 'existing',
                              option: {
                                  key: sourceCell.rowKey,
                                  label: sourceCell.rowLabel,
                                  labelValue: sourceCell.rowLabelValue
                              }
                          }
                      }
                    : sourceCell && mode === 'create-row'
                    ? {
                          column: {
                              kind: 'existing',
                              option: {
                                  key: sourceCell.colKey,
                                  label: sourceCell.colLabel,
                                  labelValue: sourceCell.colLabelValue
                              }
                          }
                      }
                    : matrixMode === 'independentRows' &&
                      effectiveMatrixView !== 'table' &&
                      (allowNewAxesInCellDialog || matrixCells.length === 0) &&
                      mode === 'create-cell'
                    ? {
                          row: { kind: 'new' as const, label: '' },
                          column: { kind: 'new' as const, label: '' }
                      }
                    : mode === 'create-child'
                    ? {
                          row: { kind: 'new' as const, label: '' },
                          column: { kind: 'new' as const, label: '' },
                          parentCellId: matrixMode === 'hierarchicalCells' ? sourceCell!.id : sourceCellId ?? null
                      }
                    : null)
            if (cellId) selectMatrixCell(cellId)
            setCellDialogSourceCellId(sourceCellId)
            setCellDialogPlacement(defaultPlacement)
            setCellDialogError(null)
            setCellDialogMode(mode)
        },
        [
            allowNewAxesInCellDialog,
            effectiveMatrixView,
            matrixCells,
            matrixMode,
            selectMatrixCell,
            selectedCellId,
            setCellDialogError,
            setCellDialogMode,
            setCellDialogPlacement,
            setCellDialogSourceCellId
        ]
    )

    const openTableAxisDialog = useCallback(
        (axis: 'row' | 'column') => {
            const sourceCell = selectedCell ?? visibleMatrixCells[0] ?? matrixCells[0]
            if (!sourceCell) return
            const parentCellId = matrixMode === 'hierarchicalCells' ? sourceCell.id : null
            selectMatrixCell(sourceCell.id)
            setCellDialogSourceCellId(sourceCell.id)
            setCellDialogPlacement({
                parentCellId,
                ...(axis === 'column'
                    ? {
                          row: {
                              kind: 'existing' as const,
                              option: {
                                  key: sourceCell.rowKey,
                                  label: sourceCell.rowLabel,
                                  labelValue: sourceCell.rowLabelValue
                              }
                          }
                      }
                    : {
                          row: {
                              kind: 'new' as const,
                              label: ''
                          }
                      }),
                ...(axis === 'row'
                    ? {
                          column: {
                              kind: 'existing' as const,
                              option: {
                                  key: sourceCell.colKey,
                                  label: sourceCell.colLabel,
                                  labelValue: sourceCell.colLabelValue
                              }
                          }
                      }
                    : {
                          column: {
                              kind: 'new' as const,
                              label: ''
                          }
                      })
            })
            setCellDialogError(null)
            setCellDialogMode(matrixMode === 'hierarchicalCells' ? 'create-child' : axis === 'row' ? 'create-row' : 'create-cell')
            setAxisDialogKind(axis)
        },
        [
            matrixCells,
            matrixMode,
            selectMatrixCell,
            selectedCell,
            setAxisDialogKind,
            setCellDialogError,
            setCellDialogMode,
            setCellDialogPlacement,
            setCellDialogSourceCellId,
            visibleMatrixCells
        ]
    )

    return { openCellDialog, openTableAxisDialog }
}
