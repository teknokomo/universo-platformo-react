import { createLocalizedContent } from '@universo-react/utils'
import type { FieldConfig } from '../../../components/dialogs/FormDialog'
import {
    buildDefaultMatrixCellData,
    findColumn,
    readColumnValue,
    type MatrixAxisOption,
    type MatrixCell,
    type RuntimeColumnLike,
    type RuntimeRow
} from './model'

type CellDialogMode = 'create-child' | 'create-cell' | 'create-row' | 'edit'

export type MatrixAxisPlacement =
    | { kind: 'existing'; option: MatrixAxisOption }
    | { kind: 'new'; label?: string; labelValue?: unknown; key?: string }

export type MatrixCellPlacement = {
    row?: MatrixAxisPlacement
    column?: MatrixAxisPlacement
    parentCellId?: string | null
}

export const MATRIX_CELL_PLACEMENT_FIELD = '__matrixCellPlacement'

export const readMatrixCellPlacement = (data: Record<string, unknown>): MatrixCellPlacement | undefined => {
    const value = data[MATRIX_CELL_PLACEMENT_FIELD]
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    return value as MatrixCellPlacement
}

const readInitialFieldValue = (
    rawCell: RuntimeRow | undefined,
    field: FieldConfig,
    childColumns: RuntimeColumnLike[] | undefined
): unknown => {
    if (!rawCell) return undefined
    const physicalField = field.codename ? findColumn(childColumns, field.codename)?.field : undefined
    const keys = [field.id, field.codename, physicalField].filter(
        (key, index, values): key is string => typeof key === 'string' && key.length > 0 && values.indexOf(key) === index
    )
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(rawCell, key)) return rawCell[key]
    }
    return undefined
}

export const buildCellDialogInitialData = ({
    mode,
    cellMetadataFields,
    styleFields,
    childColumns,
    locale,
    selectedCell,
    selectedRawCell,
    placement
}: {
    mode: CellDialogMode | null
    cellMetadataFields: FieldConfig[]
    styleFields: FieldConfig[]
    childColumns: RuntimeColumnLike[] | undefined
    locale: string
    selectedCell: MatrixCell | undefined
    selectedRawCell: RuntimeRow | undefined
    placement?: MatrixCellPlacement
}): Record<string, unknown> => {
    const fields = [...cellMetadataFields, ...styleFields]
    if (mode === 'create-cell' || mode === 'create-row') {
        const initialData = buildDefaultMatrixCellData(childColumns, locale, {
            row:
                placement?.row?.kind === 'existing'
                    ? placement.row.option.label
                    : mode === 'create-cell' && selectedCell
                    ? selectedCell.rowLabel
                    : '',
            column:
                placement?.column?.kind === 'existing'
                    ? placement.column.option.label
                    : mode === 'create-row' && selectedCell
                    ? selectedCell.colLabel
                    : '',
            value: ''
        })
        const rowLabelField = findColumn(childColumns, 'RowLabel')?.field ?? 'RowLabel'
        const colLabelField = findColumn(childColumns, 'ColLabel')?.field ?? 'ColLabel'
        if (placement?.row?.kind === 'existing' && placement.row.option.labelValue !== undefined) {
            initialData[rowLabelField] = placement.row.option.labelValue
        } else if (mode === 'create-cell' && selectedCell?.rowLabelValue !== undefined) {
            initialData[rowLabelField] = selectedCell.rowLabelValue
        }
        if (placement?.column?.kind === 'existing' && placement.column.option.labelValue !== undefined) {
            initialData[colLabelField] = placement.column.option.labelValue
        } else if (mode === 'create-row' && selectedCell?.colLabelValue !== undefined) {
            initialData[colLabelField] = selectedCell.colLabelValue
        }
        return initialData
    }
    if (mode === 'create-child') {
        return buildDefaultMatrixCellData(childColumns, locale, {
            row: '',
            column: '',
            value: '',
            parentCellId: selectedCell?.id ?? null
        })
    }
    return Object.fromEntries(fields.map((field) => [field.id, readInitialFieldValue(selectedRawCell, field, childColumns)]))
}

export const buildCellCreateData = ({
    mode,
    childColumns,
    locale,
    source,
    existingCells,
    placement
}: {
    mode: Exclude<CellDialogMode, 'edit'>
    childColumns: RuntimeColumnLike[] | undefined
    locale: string
    source: MatrixCell | undefined
    existingCells: MatrixCell[]
    placement?: MatrixCellPlacement
}): Record<string, unknown> => {
    const rowPlacement = placement?.row
    const columnPlacement = placement?.column
    const baseData = buildDefaultMatrixCellData(childColumns, locale, {
        row:
            rowPlacement?.kind === 'existing'
                ? rowPlacement.option.label
                : rowPlacement?.kind === 'new'
                ? rowPlacement.label ?? ''
                : mode === 'create-cell' && source
                ? source.rowLabel
                : '',
        column:
            columnPlacement?.kind === 'existing'
                ? columnPlacement.option.label
                : columnPlacement?.kind === 'new'
                ? columnPlacement.label ?? ''
                : mode === 'create-row' && source
                ? source.colLabel
                : '',
        value: '',
        parentCellId: mode === 'create-child' ? placement?.parentCellId ?? source?.id ?? null : null
    })
    const rowLabelField = findColumn(childColumns, 'RowLabel')?.field ?? 'RowLabel'
    const colLabelField = findColumn(childColumns, 'ColLabel')?.field ?? 'ColLabel'
    const parentCellIdField = findColumn(childColumns, 'ParentCellId')?.field ?? 'ParentCellId'
    const rowKeyField = findColumn(childColumns, 'RowKey')?.field ?? 'RowKey'
    const colKeyField = findColumn(childColumns, 'ColKey')?.field ?? 'ColKey'
    const siblingParentCellId = mode === 'create-child' ? source?.id ?? null : null
    const siblingSortOrders = existingCells
        .filter((cell) => {
            if (mode === 'create-child') return (cell.parentCellId ?? null) === siblingParentCellId
            if (mode === 'create-row') return (cell.parentCellId ?? null) === null
            return true
        })
        .map((cell) => cell.sortOrder)
    baseData._tp_sort_order = siblingSortOrders.length > 0 ? Math.max(...siblingSortOrders) + 1 : 0
    const applyExistingRow = (option: MatrixAxisOption) => {
        baseData[rowKeyField] = option.key
        baseData[rowLabelField] = option.labelValue ?? createLocalizedContent(locale, option.label)
    }
    const applyExistingColumn = (option: MatrixAxisOption) => {
        baseData[colKeyField] = option.key
        baseData[colLabelField] = option.labelValue ?? createLocalizedContent(locale, option.label)
    }
    const applyNewRow = (axis: Extract<MatrixAxisPlacement, { kind: 'new' }>) => {
        if (axis.key) baseData[rowKeyField] = axis.key
        if (axis.labelValue !== undefined) baseData[rowLabelField] = axis.labelValue
    }
    const applyNewColumn = (axis: Extract<MatrixAxisPlacement, { kind: 'new' }>) => {
        if (axis.key) baseData[colKeyField] = axis.key
        if (axis.labelValue !== undefined) baseData[colLabelField] = axis.labelValue
    }

    if (source && mode === 'create-child') {
        const generatedCellId = readColumnValue(baseData, childColumns, 'CellId')
        baseData[rowKeyField] = `row-${generatedCellId}`
        baseData[colKeyField] = `column-${generatedCellId}`
        baseData[parentCellIdField] = placement?.parentCellId ?? source.id
    }
    if (source && mode === 'create-cell') {
        baseData[rowKeyField] = source.rowKey
        baseData[rowLabelField] = source.rowLabelValue ?? createLocalizedContent(locale, source.rowLabel)
    }
    if (source && mode === 'create-row') {
        baseData[colKeyField] = source.colKey
        baseData[colLabelField] = source.colLabelValue ?? createLocalizedContent(locale, source.colLabel)
    }
    if (rowPlacement?.kind === 'existing') applyExistingRow(rowPlacement.option)
    if (rowPlacement?.kind === 'new') applyNewRow(rowPlacement)
    if (columnPlacement?.kind === 'existing') applyExistingColumn(columnPlacement.option)
    if (columnPlacement?.kind === 'new') applyNewColumn(columnPlacement)
    return baseData
}

const SYSTEM_CREATE_FIELDS = ['CellId', 'ParentCellId', 'RowKey', 'ColKey', '_tp_sort_order'] as const

export const resolveCellCreateSystemFields = (childColumns: RuntimeColumnLike[] | undefined): string[] => [
    ...SYSTEM_CREATE_FIELDS,
    ...SYSTEM_CREATE_FIELDS.map((field) => findColumn(childColumns, field)?.field).filter(
        (field): field is string => typeof field === 'string' && field.length > 0
    )
]

export const mergeCellCreateData = (
    formData: Record<string, unknown>,
    trustedData: Record<string, unknown>,
    systemFields: readonly string[] = SYSTEM_CREATE_FIELDS
): Record<string, unknown> => {
    const sanitizedFormData = { ...formData }

    for (const field of systemFields) {
        delete sanitizedFormData[field]
    }

    const merged = {
        ...trustedData,
        ...sanitizedFormData
    }

    for (const field of systemFields) {
        if (Object.prototype.hasOwnProperty.call(trustedData, field)) {
            merged[field] = trustedData[field]
        }
    }

    return merged
}
