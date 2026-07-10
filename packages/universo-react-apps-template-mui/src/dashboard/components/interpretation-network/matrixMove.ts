import { arrayMove } from '@dnd-kit/sortable'
import { createLocalizedContent, generateUuidV7, normalizeLocale } from '@universo-react/utils'
import { findColumn, readColumnValue, type MatrixCell, type RuntimeColumnLike, type RuntimeRow } from './model'
import { resolveHierarchicalDestination, type MatrixDropDestination, type MatrixDropPlacement, type MatrixMode } from './matrixDrag'

export type MatrixMoveUpdate = {
    childRowId: string
    data: Record<string, unknown>
    expectedVersion?: number
}

export type BuildMatrixMoveUpdatesInput = {
    mode: MatrixMode
    sourceCellId: string
    targetCellId: string
    placement: MatrixDropPlacement
    cells: MatrixCell[]
    rawRowsByCellId: Map<string, RuntimeRow>
    childColumns: RuntimeColumnLike[] | undefined
    locale: string
    readRuntimeRowVersion: (row: RuntimeRow | null | undefined) => number | undefined
    readSubmittedText: (value: unknown, locale: string) => string
    hierarchyLayout?: 'horizontalRows' | 'verticalTree'
    destination?: MatrixDropDestination
}

export type BuildMatrixMoveUpdatesResult = {
    selectedCellIdAfterMove: string
    updates: MatrixMoveUpdate[]
}

const makeAdjacentMatrixColumnLabel = (targetLabel: string, sameRowLabels: Set<string>): string => {
    const baseLabel = targetLabel.trim() || 'Column'
    let index = 2
    let candidate = `${baseLabel} ${index}`
    while (sameRowLabels.has(candidate)) {
        index += 1
        candidate = `${baseLabel} ${index}`
    }
    return candidate
}

const copyRawCellData = (rawCell: RuntimeRow, childColumns: RuntimeColumnLike[] | undefined): Record<string, unknown> => {
    const data: Record<string, unknown> = {}
    for (const column of childColumns ?? []) {
        const field = column.codename ?? column.field ?? column.id
        if (!field) continue
        const value = readColumnValue(rawCell, childColumns, field)
        if (value !== undefined) {
            data[field] = value
        }
    }
    return data
}

const withoutFields = (data: Record<string, unknown>, fields: string[]): Record<string, unknown> => {
    const next = { ...data }
    fields.forEach((field) => {
        delete next[field]
    })
    return next
}

const toOrderUpdates = (
    cells: MatrixCell[],
    sourceCellId: string,
    desiredSortOrderByCellId: Map<string, number>,
    rawRowsByCellId: Map<string, RuntimeRow>,
    readRuntimeRowVersion: (row: RuntimeRow | null | undefined) => number | undefined
): MatrixMoveUpdate[] =>
    cells
        .filter((cell) => cell.id !== sourceCellId && cell.sortOrder !== desiredSortOrderByCellId.get(cell.id))
        .flatMap((cell) => {
            const rawCell = rawRowsByCellId.get(cell.id)
            const nextSortOrder = desiredSortOrderByCellId.get(cell.id)
            if (!rawCell || typeof rawCell.id !== 'string' || nextSortOrder == null) return []
            return [
                {
                    childRowId: rawCell.id,
                    data: { _tp_sort_order: nextSortOrder },
                    expectedVersion: readRuntimeRowVersion(rawCell)
                }
            ]
        })

const buildHierarchicalMoveUpdates = ({
    sourceCellId,
    targetCellId,
    placement,
    cells,
    rawRowsByCellId,
    childColumns,
    readRuntimeRowVersion,
    destination
}: BuildMatrixMoveUpdatesInput): BuildMatrixMoveUpdatesResult | null => {
    const source = cells.find((cell) => cell.id === sourceCellId)
    const sourceRaw = rawRowsByCellId.get(sourceCellId)
    const resolvedDestination = destination ?? resolveHierarchicalDestination(cells, sourceCellId, targetCellId, placement)
    if (!source || !resolvedDestination || !sourceRaw || typeof sourceRaw.id !== 'string') return null

    const siblingParentCellId = resolvedDestination.parentCellId
    const sourceParentCellId = readColumnValue(sourceRaw, childColumns, 'ParentCellId')
    const normalizedSourceParentCellId = typeof sourceParentCellId === 'string' ? sourceParentCellId : null
    const normalizedDestinationParentCellId = siblingParentCellId ?? null
    const destinationSiblings = cells
        .filter((cell) => cell.id !== sourceCellId && (cell.parentCellId ?? null) === (siblingParentCellId ?? null))
        .sort((left, right) => left.sortOrder - right.sortOrder)
    destinationSiblings.splice(resolvedDestination.insertionIndex, 0, { ...source, parentCellId: normalizedDestinationParentCellId })
    const desiredSortOrderByCellId = new Map(destinationSiblings.map((cell, index) => [cell.id, index]))
    const affectedCells = [...destinationSiblings]

    if (normalizedSourceParentCellId !== normalizedDestinationParentCellId) {
        const previousSiblings = cells
            .filter((cell) => cell.id !== sourceCellId && (cell.parentCellId ?? null) === normalizedSourceParentCellId)
            .sort((left, right) => left.sortOrder - right.sortOrder)
        previousSiblings.forEach((cell, index) => desiredSortOrderByCellId.set(cell.id, index))
        affectedCells.push(...previousSiblings)
    }

    const orderUpdates = toOrderUpdates(affectedCells, sourceCellId, desiredSortOrderByCellId, rawRowsByCellId, readRuntimeRowVersion)
    const nextSourceSortOrder = desiredSortOrderByCellId.get(sourceCellId) ?? source.sortOrder
    const nextSourceParentCellId = normalizedDestinationParentCellId
    const parentChanged = normalizedSourceParentCellId !== nextSourceParentCellId

    if (!parentChanged && nextSourceSortOrder === source.sortOrder && orderUpdates.length === 0) return null

    return {
        selectedCellIdAfterMove: sourceCellId,
        updates: [
            {
                childRowId: sourceRaw.id,
                data: {
                    ...(parentChanged ? { ParentCellId: nextSourceParentCellId } : {}),
                    _tp_sort_order: nextSourceSortOrder
                },
                expectedVersion: readRuntimeRowVersion(sourceRaw)
            },
            ...orderUpdates
        ]
    }
}

const buildIndependentMoveUpdates = ({
    sourceCellId,
    targetCellId,
    placement,
    cells,
    rawRowsByCellId,
    childColumns,
    locale,
    readRuntimeRowVersion,
    readSubmittedText,
    destination
}: BuildMatrixMoveUpdatesInput): BuildMatrixMoveUpdatesResult | null => {
    const source = cells.find((cell) => cell.id === sourceCellId)
    const target = cells.find((cell) => cell.id === targetCellId)
    const sourceRaw = rawRowsByCellId.get(sourceCellId)
    const targetRaw = rawRowsByCellId.get(targetCellId)
    const tableSlot = destination?.tableSlot
    if (!source || !sourceRaw || typeof sourceRaw.id !== 'string' || (!tableSlot && (!target || !targetRaw))) return null

    const normalizedLocale = normalizeLocale(locale)
    const rowLabelField = findColumn(childColumns, 'RowLabel')?.field ?? 'RowLabel'
    const colLabelField = findColumn(childColumns, 'ColLabel')?.field ?? 'ColLabel'
    if (
        tableSlot &&
        cells.some((cell) => cell.id !== sourceCellId && cell.rowKey === tableSlot.rowKey && cell.colKey === tableSlot.colKey)
    ) {
        return null
    }
    const targetSlot = tableSlot
        ? {
              RowKey: tableSlot.rowKey,
              [rowLabelField]: tableSlot.rowLabelValue ?? createLocalizedContent(normalizedLocale, tableSlot.rowLabel),
              ColKey: tableSlot.colKey,
              [colLabelField]: tableSlot.colLabelValue ?? createLocalizedContent(normalizedLocale, tableSlot.colLabel)
          }
        : {
              RowKey: target!.rowKey,
              [rowLabelField]: readColumnValue(targetRaw!, childColumns, 'RowLabel'),
              ColKey: source.rowKey === target!.rowKey ? source.colKey : `column-${generateUuidV7()}`,
              [colLabelField]:
                  source.rowKey === target!.rowKey
                      ? readColumnValue(sourceRaw, childColumns, 'ColLabel')
                      : createLocalizedContent(
                            normalizedLocale,
                            makeAdjacentMatrixColumnLabel(
                                target!.colLabel,
                                new Set(
                                    cells
                                        .filter((cell) => cell.rowKey === target!.rowKey && cell.id !== source.id)
                                        .map((cell) => cell.colLabel)
                                )
                            )
                        )
          }
    const rowOrder = Array.from(new Set(cells.map((cell) => cell.rowKey)))
    const cellsByRow = new Map(rowOrder.map((rowKey) => [rowKey, cells.filter((cell) => cell.rowKey === rowKey)]))
    const targetRowKey = tableSlot?.rowKey ?? target!.rowKey
    if (!cellsByRow.has(targetRowKey)) {
        rowOrder.push(targetRowKey)
        cellsByRow.set(targetRowKey, [])
    }
    if (tableSlot) {
        const sourceRowCells = (cellsByRow.get(source.rowKey) ?? []).filter((cell) => cell.id !== sourceCellId)
        const targetRowCells =
            source.rowKey === targetRowKey
                ? sourceRowCells
                : (cellsByRow.get(targetRowKey) ?? []).filter((cell) => cell.id !== sourceCellId)
        targetRowCells.push({
            ...source,
            rowKey: tableSlot.rowKey,
            rowLabel: tableSlot.rowLabel,
            colKey: tableSlot.colKey,
            colLabel: tableSlot.colLabel
        })
        cellsByRow.set(source.rowKey, sourceRowCells)
        cellsByRow.set(targetRowKey, targetRowCells)
    } else if (source.rowKey === target!.rowKey) {
        const rowCells = cellsByRow.get(source.rowKey) ?? []
        const sourceIndex = rowCells.findIndex((cell) => cell.id === sourceCellId)
        const targetIndex = rowCells.findIndex((cell) => cell.id === targetCellId)
        const insertionIndex = placement === 'before' ? targetIndex : targetIndex + 1
        cellsByRow.set(source.rowKey, arrayMove(rowCells, sourceIndex, sourceIndex < insertionIndex ? insertionIndex - 1 : insertionIndex))
    } else {
        const sourceRowCells = (cellsByRow.get(source.rowKey) ?? []).filter((cell) => cell.id !== sourceCellId)
        const targetRowCells = (cellsByRow.get(target!.rowKey) ?? []).filter((cell) => cell.id !== sourceCellId)
        const targetIndex = targetRowCells.findIndex((cell) => cell.id === targetCellId)
        const insertionIndex = Math.max(0, placement === 'before' ? targetIndex : targetIndex + 1)
        targetRowCells.splice(insertionIndex, 0, {
            ...source,
            rowKey: targetSlot.RowKey,
            rowLabel: target!.rowLabel,
            colKey: targetSlot.ColKey,
            colLabel: readSubmittedText(targetSlot.ColLabel, normalizedLocale) || source.colLabel
        })
        cellsByRow.set(source.rowKey, sourceRowCells)
        cellsByRow.set(target!.rowKey, targetRowCells)
    }
    const desiredSortOrderByCellId = new Map<string, number>()
    for (const rowKey of rowOrder) {
        const rowCells = cellsByRow.get(rowKey) ?? []
        rowCells.forEach((cell, index) => desiredSortOrderByCellId.set(cell.id, index))
    }
    const reordered = rowOrder.flatMap((rowKey) => cellsByRow.get(rowKey) ?? [])
    const orderUpdates = toOrderUpdates(reordered, sourceCellId, desiredSortOrderByCellId, rawRowsByCellId, readRuntimeRowVersion)
    const sourceSortOrder = desiredSortOrderByCellId.get(sourceCellId) ?? source.sortOrder

    return {
        selectedCellIdAfterMove: sourceCellId,
        updates: [
            {
                childRowId: sourceRaw.id,
                data: {
                    ...copyRawCellData(sourceRaw, childColumns),
                    ...targetSlot,
                    _tp_sort_order: sourceSortOrder
                },
                expectedVersion: readRuntimeRowVersion(sourceRaw)
            },
            ...orderUpdates
        ]
    }
}

const buildTableSlotMoveUpdates = ({
    sourceCellId,
    cells,
    rawRowsByCellId,
    childColumns,
    locale,
    readRuntimeRowVersion,
    destination,
    mode
}: BuildMatrixMoveUpdatesInput): BuildMatrixMoveUpdatesResult | null => {
    const tableSlot = destination?.tableSlot
    if (!tableSlot) return null

    const source = cells.find((cell) => cell.id === sourceCellId)
    const sourceRaw = rawRowsByCellId.get(sourceCellId)
    if (!source || !sourceRaw || typeof sourceRaw.id !== 'string') return null
    if (cells.some((cell) => cell.id !== sourceCellId && cell.rowKey === tableSlot.rowKey && cell.colKey === tableSlot.colKey)) {
        return null
    }

    const normalizedLocale = normalizeLocale(locale)
    const rowLabelField = findColumn(childColumns, 'RowLabel')?.field ?? 'RowLabel'
    const colLabelField = findColumn(childColumns, 'ColLabel')?.field ?? 'ColLabel'
    const parentCellIdField = findColumn(childColumns, 'ParentCellId')?.field ?? 'ParentCellId'
    const targetSlot = {
        RowKey: tableSlot.rowKey,
        [rowLabelField]: tableSlot.rowLabelValue ?? createLocalizedContent(normalizedLocale, tableSlot.rowLabel),
        ColKey: tableSlot.colKey,
        [colLabelField]: tableSlot.colLabelValue ?? createLocalizedContent(normalizedLocale, tableSlot.colLabel)
    }

    if (mode === 'hierarchicalCells') {
        return {
            selectedCellIdAfterMove: sourceCellId,
            updates: [
                {
                    childRowId: sourceRaw.id,
                    data: {
                        ...withoutFields(copyRawCellData(sourceRaw, childColumns), [parentCellIdField, 'ParentCellId']),
                        ...targetSlot
                    },
                    expectedVersion: readRuntimeRowVersion(sourceRaw)
                }
            ]
        }
    }

    const rowOrder = Array.from(new Set(cells.map((cell) => cell.rowKey)))
    const cellsByRow = new Map(rowOrder.map((rowKey) => [rowKey, cells.filter((cell) => cell.rowKey === rowKey)]))
    const targetRowKey = tableSlot.rowKey
    if (!cellsByRow.has(targetRowKey)) {
        rowOrder.push(targetRowKey)
        cellsByRow.set(targetRowKey, [])
    }

    const sourceRowCells = (cellsByRow.get(source.rowKey) ?? []).filter((cell) => cell.id !== sourceCellId)
    const targetRowCells =
        source.rowKey === targetRowKey ? sourceRowCells : (cellsByRow.get(targetRowKey) ?? []).filter((cell) => cell.id !== sourceCellId)
    targetRowCells.push({
        ...source,
        rowKey: tableSlot.rowKey,
        rowLabel: tableSlot.rowLabel,
        rowLabelValue: tableSlot.rowLabelValue ?? source.rowLabelValue,
        colKey: tableSlot.colKey,
        colLabel: tableSlot.colLabel,
        colLabelValue: tableSlot.colLabelValue ?? source.colLabelValue
    })
    cellsByRow.set(source.rowKey, sourceRowCells)
    cellsByRow.set(targetRowKey, targetRowCells)

    const desiredSortOrderByCellId = new Map<string, number>()
    for (const rowKey of rowOrder) {
        const rowCells = cellsByRow.get(rowKey) ?? []
        rowCells.forEach((cell, index) => desiredSortOrderByCellId.set(cell.id, index))
    }
    const reordered = rowOrder.flatMap((rowKey) => cellsByRow.get(rowKey) ?? [])
    const orderUpdates = toOrderUpdates(reordered, sourceCellId, desiredSortOrderByCellId, rawRowsByCellId, readRuntimeRowVersion)
    const sourceSortOrder = desiredSortOrderByCellId.get(sourceCellId) ?? source.sortOrder

    return {
        selectedCellIdAfterMove: sourceCellId,
        updates: [
            {
                childRowId: sourceRaw.id,
                data: {
                    ...withoutFields(copyRawCellData(sourceRaw, childColumns), [parentCellIdField, 'ParentCellId']),
                    ...targetSlot,
                    _tp_sort_order: sourceSortOrder
                },
                expectedVersion: readRuntimeRowVersion(sourceRaw)
            },
            ...orderUpdates
        ]
    }
}

export const buildMatrixMoveUpdates = (input: BuildMatrixMoveUpdatesInput): BuildMatrixMoveUpdatesResult | null =>
    input.destination?.tableSlot
        ? buildTableSlotMoveUpdates(input)
        : input.mode === 'hierarchicalCells'
        ? buildHierarchicalMoveUpdates(input)
        : buildIndependentMoveUpdates(input)
