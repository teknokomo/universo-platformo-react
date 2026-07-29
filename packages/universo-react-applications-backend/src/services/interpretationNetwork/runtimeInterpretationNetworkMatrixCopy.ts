import { generateUuidV7 } from '@universo-react/utils'
import { IDENTIFIER_REGEX } from '../../shared/runtimeHelpers'
import {
    InterpretationNetworkCommandError,
    assertColumn,
    getChildField,
    interpretationNetworkCommandErrorCodes,
    type MatrixCopyPlan,
    type ObjectContract
} from './runtimeInterpretationNetworkCore'

const COPY_CODENAMES = [
    'ColLabel',
    'RowLabel',
    'CellValue',
    'CellDescription',
    'CellFillColor',
    'TextColor',
    'BorderTopColor',
    'BorderRightColor',
    'BorderBottomColor',
    'BorderLeftColor',
    'BorderTopWidth',
    'BorderRightWidth',
    'BorderBottomWidth',
    'BorderLeftWidth',
    'BorderTopStyle',
    'BorderRightStyle',
    'BorderBottomStyle',
    'BorderLeftStyle'
] as const

const buildHierarchyMap = (
    sourceRows: Array<Record<string, unknown>>,
    cellIdColumn: string,
    parentColumn: string | undefined,
    cellIdMap: Map<string, string>
): Map<string, string | null> => {
    const parentByCellId = new Map<string, string | null>()
    for (const row of sourceRows) {
        const cellId = String(row[cellIdColumn] ?? '').trim()
        if (!cellId) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.invalidMatrix,
                'Source matrix contains a row without CellId'
            )
        }
        if (parentByCellId.has(cellId)) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.invalidMatrix,
                'Source matrix contains duplicate CellId values',
                { cellId }
            )
        }
        cellIdMap.set(cellId, generateUuidV7())
        const parentId = parentColumn ? String(row[parentColumn] ?? '').trim() : ''
        parentByCellId.set(cellId, parentId || null)
    }
    return parentByCellId
}

const assertValidHierarchy = (parentByCellId: Map<string, string | null>) => {
    for (const [cellId, parentCellId] of parentByCellId) {
        if (parentCellId && !parentByCellId.has(parentCellId)) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.invalidMatrix,
                'Source matrix references a parent cell that does not exist',
                { cellId, parentCellId }
            )
        }
    }
    const roots = [...parentByCellId.values()].filter((parentId) => parentId === null)
    if (roots.length !== 1) {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.invalidMatrix,
            'Source matrix must contain exactly one root cell',
            { rootCount: roots.length }
        )
    }
    const validated = new Set<string>()
    for (const cellId of parentByCellId.keys()) {
        const path = new Set<string>()
        let cursor: string | null = cellId
        while (cursor && !validated.has(cursor)) {
            if (path.has(cursor)) {
                throw new InterpretationNetworkCommandError(
                    409,
                    interpretationNetworkCommandErrorCodes.invalidMatrix,
                    'Source matrix hierarchy contains a cycle',
                    { cellId }
                )
            }
            path.add(cursor)
            cursor = parentByCellId.get(cursor) ?? null
        }
        for (const pathCellId of path) validated.add(pathCellId)
    }
}

/** Builds a safe matrix-copy plan with fresh UUID v7 cell and axis identities. */
export const planMatrixRowsCopy = (
    sourceRows: Array<Record<string, unknown>>,
    sourceContract: ObjectContract,
    destinationContract: ObjectContract,
    materialIdMap: Map<string, string>,
    includeMaterials: boolean,
    cellIdMap: Map<string, string> = new Map()
): MatrixCopyPlan => {
    const sourceCellIdColumn = assertColumn(getChildField(sourceContract, 'CellId'), 'CellId')
    const destinationCellIdColumn = assertColumn(getChildField(destinationContract, 'CellId'), 'CellId')
    const sourceParentColumn = getChildField(sourceContract, 'ParentCellId')?.column_name
    const destinationParentColumn = getChildField(destinationContract, 'ParentCellId')?.column_name
    const sourceRowKeyColumn = getChildField(sourceContract, 'RowKey')?.column_name
    const destinationRowKeyColumn = getChildField(destinationContract, 'RowKey')?.column_name
    const sourceColKeyColumn = getChildField(sourceContract, 'ColKey')?.column_name
    const destinationColKeyColumn = getChildField(destinationContract, 'ColKey')?.column_name
    const sourceMaterialColumn = getChildField(sourceContract, 'MaterialRef')?.column_name
    const destinationMaterialColumn = getChildField(destinationContract, 'MaterialRef')?.column_name
    const parentByCellId = buildHierarchyMap(sourceRows, sourceCellIdColumn, sourceParentColumn, cellIdMap)
    assertValidHierarchy(parentByCellId)

    const sourceMaterialByCellId = new Map<string, string>()
    if (includeMaterials) {
        for (const row of sourceRows) {
            const cellId = String(row[sourceCellIdColumn] ?? '').trim()
            const sourceMaterialId = sourceMaterialColumn ? String(row[sourceMaterialColumn] ?? '').trim() : ''
            const materialId = (sourceMaterialId ? materialIdMap.get(sourceMaterialId) : undefined) ?? materialIdMap.get(cellId)
            if (materialId) sourceMaterialByCellId.set(cellId, materialId)
        }
    }
    const rowAxisKeyMap = new Map<string, string>()
    const columnAxisKeyMap = new Map<string, string>()
    const mapAxisKey = (value: unknown, prefix: 'row' | 'column'): string => {
        const map = prefix === 'row' ? rowAxisKeyMap : columnAxisKeyMap
        const sourceKey = typeof value === 'string' && value.trim() ? value.trim() : `${prefix}-${generateUuidV7()}`
        const existing = map.get(sourceKey)
        if (existing) return existing
        const nextKey = `${prefix}-${generateUuidV7()}`
        map.set(sourceKey, nextKey)
        return nextKey
    }

    const rows = sourceRows.map((sourceRow, index) => {
        const row: Record<string, unknown> = { _tp_sort_order: sourceRow._tp_sort_order ?? index }
        for (const codename of COPY_CODENAMES) {
            const sourceField = getChildField(sourceContract, codename)
            const destinationField = getChildField(destinationContract, codename)
            if (!sourceField || !destinationField || !IDENTIFIER_REGEX.test(destinationField.column_name)) continue
            row[destinationField.column_name] = sourceRow[sourceField.column_name] ?? null
        }
        const sourceCellId = String(sourceRow[sourceCellIdColumn] ?? '').trim()
        row[destinationCellIdColumn] = cellIdMap.get(sourceCellId)
        if (sourceParentColumn && destinationParentColumn) {
            const parentId = String(sourceRow[sourceParentColumn] ?? '').trim()
            row[destinationParentColumn] = parentId ? cellIdMap.get(parentId) : null
        }
        if (sourceRowKeyColumn && destinationRowKeyColumn) {
            row[destinationRowKeyColumn] = mapAxisKey(sourceRow[sourceRowKeyColumn], 'row')
        }
        if (sourceColKeyColumn && destinationColKeyColumn) {
            row[destinationColKeyColumn] = mapAxisKey(sourceRow[sourceColKeyColumn], 'column')
        }
        if (destinationMaterialColumn) {
            const sourceMaterialId = sourceMaterialColumn ? String(sourceRow[sourceMaterialColumn] ?? '').trim() : ''
            if (includeMaterials && sourceMaterialId && !materialIdMap.has(sourceMaterialId)) {
                throw new InterpretationNetworkCommandError(
                    409,
                    interpretationNetworkCommandErrorCodes.invalidMatrix,
                    'Source matrix references a material that cannot be copied'
                )
            }
            row[destinationMaterialColumn] = includeMaterials
                ? materialIdMap.get(sourceMaterialId) ?? sourceMaterialByCellId.get(sourceCellId) ?? null
                : null
        }
        return row
    })
    return { rows, cellIdMap }
}
