import { publicInterpretationNetworkReadResponseSchema } from '@universo-react/types'
import {
    findPublicInterpretationNetworkRuntimeRecord,
    listPublicInterpretationNetworkMatrixRows
} from '../../persistence/publicInterpretationNetworkRuntimeStore'
import { assertColumn, getChildField, getField } from '../interpretationNetwork/runtimeInterpretationNetworkMetadata'
import { PAGE_SIZE, page, type PublicInterpretationNetworkReadInput, PublicInterpretationNetworkUnavailableError } from './contracts'
import { issueHandle, readHandle } from './handles'
import { localizeFallback, safeDisplayText } from './projection'

const colorFields = [
    ['CellFillColor', 'fillColor'],
    ['TextColor', 'textColor'],
    ['BorderTopColor', 'borderTop'],
    ['BorderRightColor', 'borderRight'],
    ['BorderBottomColor', 'borderBottom'],
    ['BorderLeftColor', 'borderLeft']
] as const

const normalizePublicColor = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined
    const normalized = value.trim().toUpperCase()
    if (!/^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/u.test(normalized)) return undefined
    const expanded =
        normalized.length === 4
            ? `#${normalized
                  .slice(1)
                  .split('')
                  .map((digit) => digit + digit)
                  .join('')}`
            : normalized
    return expanded
}

/** Validate the Interpretation handle and project its bounded Matrix cells. */
export const readMatrix = async (input: PublicInterpretationNetworkReadInput) => {
    const limit = PAGE_SIZE.matrix
    const claims = readHandle(input.parentHandle, input, 'interpretation')
    const interpretationContract = input.surface.contracts.Interpretation
    const titleField = assertColumn(getField(interpretationContract, 'Title'), 'Interpretation.Title')
    const interpretation = await findPublicInterpretationNetworkRuntimeRecord(
        input.executor,
        input.surface,
        interpretationContract,
        claims.recordId,
        [{ field: titleField, alias: 'title' }]
    )
    if (!interpretation) throw new PublicInterpretationNetworkUnavailableError()

    const child = input.surface.contracts.Interpretation
    const cellId = assertColumn(getChildField(child, 'CellId'), 'InterpretationMatrix.CellId')
    const parentCellId = getChildField(child, 'ParentCellId')?.column_name
    const rowKey = assertColumn(getChildField(child, 'RowKey'), 'InterpretationMatrix.RowKey')
    const colKey = assertColumn(getChildField(child, 'ColKey'), 'InterpretationMatrix.ColKey')
    const rowLabel = getChildField(child, 'RowLabel')?.column_name
    const colLabel = getChildField(child, 'ColLabel')?.column_name
    const value = getChildField(child, 'CellValue')?.column_name
    const description = getChildField(child, 'CellDescription')?.column_name
    const colorColumns = colorFields.flatMap(([codename, alias]) => {
        const column = getChildField(child, codename)?.column_name
        return column ? [{ field: column, alias }] : []
    })
    const columns = [
        { field: cellId, alias: 'cellId' },
        ...(parentCellId ? [{ field: parentCellId, alias: 'parentCellId' }] : []),
        { field: rowKey, alias: 'rowKey' },
        { field: colKey, alias: 'colKey' },
        ...(rowLabel ? [{ field: rowLabel, alias: 'rowLabel' }] : []),
        ...(colLabel ? [{ field: colLabel, alias: 'columnLabel' }] : []),
        ...(value ? [{ field: value, alias: 'value' }] : []),
        ...(description ? [{ field: description, alias: 'description' }] : []),
        ...colorColumns
    ]
    const rows = await listPublicInterpretationNetworkMatrixRows({
        executor: input.executor,
        surface: input.surface,
        columns,
        parentId: String(interpretation.id),
        limit,
        offset: input.offset
    })
    const cells = rows.slice(0, limit).map((row) => {
        const cellIdentity = String(row.cellId ?? '')
        const currentColors = Object.fromEntries(
            colorFields.flatMap(([, key]) => {
                const color = normalizePublicColor(row[key])
                return color ? [[key, color]] : []
            })
        )
        const parentIdentity = typeof row.parentCellId === 'string' && row.parentCellId.trim() ? row.parentCellId : null
        const rowIdentity = String(row.rowKey ?? '')
        const columnIdentity = String(row.colKey ?? '')
        if (!cellIdentity || !rowIdentity || !columnIdentity) throw new PublicInterpretationNetworkUnavailableError()
        return {
            handle: issueHandle(input, { kind: 'cell', recordId: claims.recordId, cellId: cellIdentity }),
            parentHandle: parentIdentity ? issueHandle(input, { kind: 'cell', recordId: claims.recordId, cellId: parentIdentity }) : null,
            rowHandle: issueHandle(input, { kind: 'cell', recordId: claims.recordId, cellId: `row:${rowIdentity}` }),
            rowLabel: safeDisplayText(
                rowLabel ? row.rowLabel : undefined,
                input.locale,
                255,
                localizeFallback(input.locale, 'Row', 'Строка')
            ),
            columnHandle: issueHandle(input, { kind: 'cell', recordId: claims.recordId, cellId: `column:${columnIdentity}` }),
            columnLabel: safeDisplayText(
                colLabel ? row.columnLabel : undefined,
                input.locale,
                255,
                localizeFallback(input.locale, 'Column', 'Столбец')
            ),
            value: safeDisplayText(row.value, input.locale, 2000),
            description: safeDisplayText(row.description, input.locale, 2000),
            sortOrder: Number.isInteger(row._tp_sort_order) && Number(row._tp_sort_order) >= 0 ? Number(row._tp_sort_order) : 0,
            style: currentColors
        }
    })
    return publicInterpretationNetworkReadResponseSchema.parse({
        locale: input.locale,
        view: 'matrix',
        interpretation: {
            handle: input.parentHandle,
            title: safeDisplayText(
                interpretation.title,
                input.locale,
                255,
                localizeFallback(input.locale, 'Untitled interpretation', 'Трактовка без названия')
            )
        },
        items: cells,
        page: page(input.offset, limit, rows.length)
    })
}
