import { createLocalizedContent } from '@universo-react/utils'
import type { FieldConfig } from '../../../components/dialogs/FormDialog'
import { buildDefaultMatrixCellData, type MatrixCell, type RuntimeColumnLike, type RuntimeRow } from './model'

type CellDialogMode = 'create-child' | 'create-cell' | 'create-row' | 'edit'

export const buildCellDialogInitialData = ({
    mode,
    cellMetadataFields,
    styleFields,
    childColumns,
    locale,
    selectedCell,
    selectedRawCell,
    newRowLabel,
    newCellLabel
}: {
    mode: CellDialogMode | null
    cellMetadataFields: FieldConfig[]
    styleFields: FieldConfig[]
    childColumns: RuntimeColumnLike[] | undefined
    locale: string
    selectedCell: MatrixCell | undefined
    selectedRawCell: RuntimeRow | undefined
    newRowLabel: string
    newCellLabel: string
}): Record<string, unknown> => {
    const fields = [...cellMetadataFields, ...styleFields]
    if (mode === 'create-cell' || mode === 'create-row') {
        return buildDefaultMatrixCellData(childColumns, locale, {
            row: mode === 'create-cell' && selectedCell ? selectedCell.rowLabel : newRowLabel,
            column: mode === 'create-row' && selectedCell ? selectedCell.colLabel : newCellLabel,
            value: newCellLabel
        })
    }
    if (mode === 'create-child') {
        return buildDefaultMatrixCellData(childColumns, locale, {
            row: newCellLabel,
            column: newCellLabel,
            value: newCellLabel,
            parentCellId: selectedCell?.id ?? null
        })
    }
    return Object.fromEntries(fields.map((field) => [field.id, selectedRawCell?.[field.id] ?? selectedRawCell?.[field.codename ?? '']]))
}

export const buildCellCreateData = ({
    mode,
    childColumns,
    locale,
    source,
    existingCells,
    newRowLabel,
    newCellLabel
}: {
    mode: Exclude<CellDialogMode, 'edit'>
    childColumns: RuntimeColumnLike[] | undefined
    locale: string
    source: MatrixCell | undefined
    existingCells: MatrixCell[]
    newRowLabel: string
    newCellLabel: string
}): Record<string, unknown> => {
    const baseData = buildDefaultMatrixCellData(childColumns, locale, {
        row: mode === 'create-cell' && source ? source.rowLabel : newRowLabel,
        column: mode === 'create-row' && source ? source.colLabel : newCellLabel,
        value: newCellLabel,
        parentCellId: mode === 'create-child' ? source?.id ?? null : null
    })
    const siblingParentCellId = mode === 'create-child' ? source?.id ?? null : null
    const siblingSortOrders = existingCells
        .filter((cell) => {
            if (mode === 'create-child') return (cell.parentCellId ?? null) === siblingParentCellId
            if (mode === 'create-row') return (cell.parentCellId ?? null) === null
            return true
        })
        .map((cell) => cell.sortOrder)
    baseData._tp_sort_order = siblingSortOrders.length > 0 ? Math.max(...siblingSortOrders) + 1 : 0
    if (source && mode === 'create-child') {
        baseData.RowKey = `row-${baseData.CellId}`
        baseData.ColKey = `column-${baseData.CellId}`
        baseData.ParentCellId = source.id
    }
    if (source && mode === 'create-cell') {
        baseData.RowKey = source.rowKey
        baseData.RowLabel = createLocalizedContent(locale, source.rowLabel)
    }
    if (source && mode === 'create-row') {
        baseData.ColKey = source.colKey
        baseData.ColLabel = createLocalizedContent(locale, source.colLabel)
    }
    return baseData
}

const SYSTEM_CREATE_FIELDS = ['CellId', 'ParentCellId', 'RowKey', 'RowLabel', 'ColKey', 'ColLabel', '_tp_sort_order'] as const

export const mergeCellCreateData = (formData: Record<string, unknown>, trustedData: Record<string, unknown>): Record<string, unknown> => {
    const merged = {
        ...trustedData,
        ...formData
    }

    for (const field of SYSTEM_CREATE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(trustedData, field)) {
            merged[field] = trustedData[field]
        }
    }

    return merged
}
