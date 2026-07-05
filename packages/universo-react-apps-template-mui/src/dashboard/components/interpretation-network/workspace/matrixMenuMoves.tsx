import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import KeyboardArrowLeftRoundedIcon from '@mui/icons-material/KeyboardArrowLeftRounded'
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded'
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded'
import type { TFunction } from 'i18next'
import type { MatrixCell } from '../model'
import type { MatrixDropPlacement, MatrixMode } from '../matrixDrag'
import type { MatrixMenuMove } from './MatrixWorkspace'

type MatrixRow = MatrixCell & { cells: MatrixCell[] }

export const findMatrixMoveTarget = ({
    mode,
    cell,
    deltaRow,
    deltaColumn,
    matrixRows,
    visibleMatrixCells
}: {
    mode: MatrixMode
    cell: MatrixCell | undefined
    deltaRow: number
    deltaColumn: number
    matrixRows: MatrixRow[]
    visibleMatrixCells: MatrixCell[]
}): MatrixCell | undefined => {
    if (mode === 'hierarchicalCells') {
        const siblings = visibleMatrixCells.filter((candidate) => (candidate.parentCellId ?? null) === (cell?.parentCellId ?? null))
        const position = siblings.findIndex((candidate) => candidate.id === cell?.id)
        if (!cell || position < 0) return undefined
        if (deltaRow < 0) return siblings[position - 1]
        if (deltaRow > 0) return siblings[position + 1]
        return undefined
    }

    if (!cell) return undefined
    const rowIndex = matrixRows.findIndex((row) => row.rowKey === cell.rowKey)
    const columnIndex = matrixRows[rowIndex]?.cells.findIndex((candidate) => candidate.id === cell.id) ?? -1
    if (rowIndex < 0 || columnIndex < 0) return undefined
    if (deltaColumn !== 0) {
        return matrixRows[rowIndex]?.cells[columnIndex + deltaColumn]
    }
    const targetRow = matrixRows[rowIndex + deltaRow]
    if (!targetRow) return undefined
    return targetRow.cells[Math.min(columnIndex, targetRow.cells.length - 1)]
}

export const buildMatrixMenuMoves = ({
    t,
    mode,
    menuCell,
    matrixRows,
    visibleMatrixCells,
    onMove
}: {
    t: TFunction<'interpretationNetwork'>
    mode: MatrixMode
    menuCell: MatrixCell | undefined
    matrixRows: MatrixRow[]
    visibleMatrixCells: MatrixCell[]
    onMove: (target: MatrixCell, placement: MatrixDropPlacement) => void
}): MatrixMenuMove[] => {
    const move = (deltaRow: number, deltaColumn: number): MatrixMenuMove => {
        const target = findMatrixMoveTarget({ mode, cell: menuCell, deltaRow, deltaColumn, matrixRows, visibleMatrixCells })
        const placement = deltaColumn < 0 || deltaRow < 0 ? 'before' : 'after'
        return {
            label:
                deltaColumn < 0
                    ? t('workspace.cell.moveLeftShort', 'Left')
                    : deltaColumn > 0
                    ? t('workspace.cell.moveRightShort', 'Right')
                    : deltaRow < 0
                    ? t('workspace.cell.moveUpShort', 'Up')
                    : t('workspace.cell.moveDownShort', 'Down'),
            icon:
                deltaColumn < 0 ? (
                    <KeyboardArrowLeftRoundedIcon fontSize='small' />
                ) : deltaColumn > 0 ? (
                    <KeyboardArrowRightRoundedIcon fontSize='small' />
                ) : deltaRow < 0 ? (
                    <KeyboardArrowUpRoundedIcon fontSize='small' />
                ) : (
                    <KeyboardArrowDownRoundedIcon fontSize='small' />
                ),
            target,
            action: () => {
                if (target) onMove(target, placement)
            }
        }
    }

    return [move(0, -1), move(0, 1), move(-1, 0), move(1, 0)].filter((item) => item.target)
}
