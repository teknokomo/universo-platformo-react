import {
    buildMatrixTree,
    flattenMatrixTree,
    isDescendantCell,
    toFocusedMatrixHierarchyRows,
    toMatrixHierarchyRows,
    type MatrixCell,
    type MatrixHierarchyRowMode,
    type MatrixHierarchyLayout
} from './model'

export type MatrixDropPlacement = 'before' | 'after' | 'child'
export type MatrixMode = 'hierarchicalCells' | 'independentRows'

export type MatrixDropDestination = {
    placement: MatrixDropPlacement
    targetCellId: string
    parentCellId: string | null
    insertionIndex: number
}

export type MatrixDropState = {
    activeCellId: string | null
    overCellId: string | null
    placement: MatrixDropPlacement | null
    isValid: boolean
    destination: MatrixDropDestination | null
}

export type MatrixDragPreview = {
    activeCellId: string
    destination: MatrixDropDestination
    visibleCells: MatrixCell[]
    hierarchyRows: MatrixCell[][]
}

type RectLike = {
    top: number
    left?: number
    height: number
    width?: number
}

const matrixCellParentId = (cell: MatrixCell): string | null => cell.parentCellId ?? null

const getHierarchyDepth = (cells: MatrixCell[], cellId: string): number => {
    const cellsById = new Map(cells.map((cell) => [cell.id, cell]))
    const visited = new Set<string>()
    let current = cellsById.get(cellId)
    let depth = 0

    while (current?.parentCellId) {
        if (visited.has(current.id)) break
        visited.add(current.id)
        const parent = cellsById.get(current.parentCellId)
        if (!parent) break
        depth += 1
        current = parent
    }

    return depth
}

const sortSiblings = (cells: MatrixCell[], parentCellId: string | null, excludedCellId?: string): MatrixCell[] =>
    cells
        .filter((cell) => cell.id !== excludedCellId && matrixCellParentId(cell) === parentCellId)
        .sort((left, right) => left.sortOrder - right.sortOrder)

const calculateAxisOverlap = (translatedRect: RectLike, targetRect: RectLike, axis: 'horizontal' | 'vertical'): number => {
    const translatedStart = axis === 'horizontal' ? translatedRect.left ?? 0 : translatedRect.top
    const translatedSize = axis === 'horizontal' ? translatedRect.width ?? 0 : translatedRect.height
    const targetStart = axis === 'horizontal' ? targetRect.left ?? 0 : targetRect.top
    const targetSize = axis === 'horizontal' ? targetRect.width ?? 0 : targetRect.height
    const denominator = Math.max(translatedSize, targetSize)
    if (denominator <= 0) return 0
    const intersection = Math.max(
        0,
        Math.min(translatedStart + translatedSize, targetStart + targetSize) - Math.max(translatedStart, targetStart)
    )
    return Math.min(1, intersection / denominator)
}

const resolveHorizontalLeadingEdgePlacement = (
    translatedRect: RectLike,
    targetRect: RectLike,
    sourceIndex: number,
    targetIndex: number
): MatrixDropPlacement | null => {
    const translatedLeft = translatedRect.left ?? 0
    const translatedWidth = translatedRect.width ?? 0
    const targetLeft = targetRect.left ?? 0
    const targetWidth = targetRect.width ?? 0
    if (translatedWidth <= 0 || targetWidth <= 0) return 'after'

    const translatedCenter = translatedLeft + translatedWidth / 2
    const targetCenter = targetLeft + targetWidth / 2
    const isMovingRight =
        sourceIndex >= 0 && targetIndex >= 0 && sourceIndex !== targetIndex ? sourceIndex < targetIndex : translatedCenter <= targetCenter
    const leadingEdge = isMovingRight ? translatedLeft + translatedWidth : translatedLeft
    const progress = isMovingRight ? (leadingEdge - targetLeft) / targetWidth : (targetLeft + targetWidth - leadingEdge) / targetWidth

    if (progress < 0.1) return null
    if (progress <= 0.5) return 'child'
    return isMovingRight ? 'after' : 'before'
}

const resolveHigherLevelHorizontalPlacement = (translatedRect: RectLike, targetRect: RectLike): MatrixDropPlacement => {
    const translatedWidth = translatedRect.width ?? 0
    const targetWidth = targetRect.width ?? 0
    if (translatedWidth <= 0 || targetWidth <= 0) return 'child'

    const translatedCenter = (translatedRect.left ?? 0) + translatedWidth / 2
    const targetLeft = targetRect.left ?? 0
    const targetProgress = (translatedCenter - targetLeft) / targetWidth

    if (targetProgress < 0.25) return 'before'
    if (targetProgress <= 0.75) return 'child'
    return 'after'
}

export const resolveHierarchicalDropPlacement = (
    translatedRect: RectLike | null | undefined,
    targetRect: RectLike | null | undefined,
    axis: 'horizontal' | 'vertical' = 'vertical',
    sourceIndex = -1,
    targetIndex = -1,
    targetIsHigherLevel = false
): MatrixDropPlacement | null => {
    if (!translatedRect || !targetRect) return 'after'

    if (axis === 'horizontal') {
        if (targetIsHigherLevel) {
            return resolveHigherLevelHorizontalPlacement(translatedRect, targetRect)
        }
        return resolveHorizontalLeadingEdgePlacement(translatedRect, targetRect, sourceIndex, targetIndex)
    }

    const overlap = calculateAxisOverlap(translatedRect, targetRect, axis)
    if (overlap < 0.1) return null
    if (overlap <= 0.5) return 'child'

    const translatedCenter = translatedRect.top + translatedRect.height / 2
    const targetCenter = targetRect.top + targetRect.height / 2
    if (Math.abs(translatedCenter - targetCenter) > 0.5) {
        return translatedCenter <= targetCenter ? 'before' : 'after'
    }

    if (sourceIndex >= 0 && targetIndex >= 0 && sourceIndex !== targetIndex) {
        return sourceIndex < targetIndex ? 'after' : 'before'
    }

    return translatedCenter <= targetCenter ? 'before' : 'after'
}

export const resolveHierarchicalDestination = (
    cells: MatrixCell[],
    sourceCellId: string,
    targetCellId: string,
    placement: MatrixDropPlacement
): MatrixDropDestination | null => {
    if (sourceCellId === targetCellId || isDescendantCell(cells, targetCellId, sourceCellId)) return null

    const source = cells.find((cell) => cell.id === sourceCellId)
    const target = cells.find((cell) => cell.id === targetCellId)
    if (!source || !target) return null

    const effectivePlacement = target.parentCellId === null ? 'child' : placement
    const parentCellId = effectivePlacement === 'child' ? target.id : matrixCellParentId(target)
    const destinationSiblings = sortSiblings(cells, parentCellId, sourceCellId)
    const targetIndex = destinationSiblings.findIndex((cell) => cell.id === targetCellId)
    if (effectivePlacement !== 'child' && targetIndex < 0) return null

    return {
        placement: effectivePlacement,
        targetCellId,
        parentCellId,
        insertionIndex:
            effectivePlacement === 'child'
                ? destinationSiblings.length
                : Math.max(0, effectivePlacement === 'before' ? targetIndex : targetIndex + 1)
    }
}

export const resolveMatrixDropState = ({
    mode,
    cells,
    cellIds,
    sourceCellId,
    targetCellId,
    translatedRect,
    targetRect,
    hierarchyLayout = 'verticalTree'
}: {
    mode: MatrixMode
    cells: MatrixCell[]
    cellIds: string[]
    sourceCellId: string
    targetCellId: string | null
    translatedRect?: RectLike | null
    targetRect?: RectLike | null
    hierarchyLayout?: MatrixHierarchyLayout
}): MatrixDropState => {
    if (!targetCellId || sourceCellId === targetCellId) {
        return { activeCellId: sourceCellId, overCellId: targetCellId, placement: null, isValid: false, destination: null }
    }

    const sourceIndex = cellIds.indexOf(sourceCellId)
    const targetIndex = cellIds.indexOf(targetCellId)
    const source = cells.find((cell) => cell.id === sourceCellId)
    const target = cells.find((cell) => cell.id === targetCellId)
    const targetIsHigherLevel =
        mode === 'hierarchicalCells' &&
        hierarchyLayout === 'horizontalRows' &&
        Boolean(source && target) &&
        getHierarchyDepth(cells, targetCellId) < getHierarchyDepth(cells, sourceCellId)
    const measuredPlacement =
        mode === 'hierarchicalCells'
            ? resolveHierarchicalDropPlacement(
                  translatedRect,
                  targetRect,
                  hierarchyLayout === 'horizontalRows' ? 'horizontal' : 'vertical',
                  sourceIndex,
                  targetIndex,
                  targetIsHigherLevel
              )
            : sourceIndex >= 0 && targetIndex >= 0 && sourceIndex > targetIndex
            ? 'before'
            : 'after'
    const geometryUnavailable = !translatedRect || !targetRect
    const sameParentHorizontalSiblingFallback =
        mode === 'hierarchicalCells' &&
        hierarchyLayout === 'horizontalRows' &&
        geometryUnavailable &&
        measuredPlacement === null &&
        source &&
        target &&
        matrixCellParentId(source) === matrixCellParentId(target) &&
        sourceIndex >= 0 &&
        targetIndex >= 0 &&
        sourceIndex !== targetIndex
            ? sourceIndex < targetIndex
                ? 'after'
                : 'before'
            : null
    const placement = measuredPlacement ?? sameParentHorizontalSiblingFallback
    const destination =
        mode === 'hierarchicalCells' && placement
            ? resolveHierarchicalDestination(cells, sourceCellId, targetCellId, placement)
            : placement
            ? { placement, targetCellId, parentCellId: null, insertionIndex: targetIndex }
            : null

    return {
        activeCellId: sourceCellId,
        overCellId: targetCellId,
        placement: destination?.placement ?? placement,
        isValid: sourceIndex >= 0 && targetIndex >= 0 && destination !== null,
        destination
    }
}

export const buildMatrixDragPreview = (
    cells: MatrixCell[],
    state: MatrixDropState,
    options: { hierarchyRowMode?: MatrixHierarchyRowMode; selectedCellId?: string | null } = {}
): MatrixDragPreview | null => {
    if (!state.activeCellId || !state.isValid || !state.destination) return null

    const source = cells.find((cell) => cell.id === state.activeCellId)
    if (!source) return null

    const sourceParentCellId = matrixCellParentId(source)
    const destinationParentCellId = state.destination.parentCellId
    const nextSortOrderById = new Map<string, number>()
    const destinationSiblings = sortSiblings(cells, destinationParentCellId, source.id)
    destinationSiblings.splice(state.destination.insertionIndex, 0, source)
    destinationSiblings.forEach((cell, index) => nextSortOrderById.set(cell.id, index))

    if (sourceParentCellId !== destinationParentCellId) {
        sortSiblings(cells, sourceParentCellId, source.id).forEach((cell, index) => nextSortOrderById.set(cell.id, index))
    }

    const previewCells = cells.map((cell) =>
        cell.id === source.id
            ? {
                  ...cell,
                  parentCellId: destinationParentCellId,
                  sortOrder: nextSortOrderById.get(cell.id) ?? cell.sortOrder
              }
            : nextSortOrderById.has(cell.id)
            ? { ...cell, sortOrder: nextSortOrderById.get(cell.id)! }
            : cell
    )
    const previewTree = buildMatrixTree(previewCells)
    const hierarchyRows =
        options.hierarchyRowMode === 'focusedPath'
            ? toFocusedMatrixHierarchyRows(previewTree, source.id)
            : toMatrixHierarchyRows(flattenMatrixTree(previewTree))
    const visibleCells = hierarchyRows.flatMap((row) => row)

    return {
        activeCellId: source.id,
        destination: state.destination,
        visibleCells,
        hierarchyRows
    }
}
