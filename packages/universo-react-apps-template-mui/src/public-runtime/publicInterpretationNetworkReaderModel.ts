import type { PublicInterpretationNetworkReadResponse } from '@universo-react/types'
import type { StructureSummary } from '../dashboard/components/interpretation-network/workspace/StructurePane'
import type { MatrixCell, RuntimeRow } from '../dashboard/components/interpretation-network/model'
import { toReadOnlyEditorContent } from './publicInterpretationNetworkReaderData'

type PublicStructures = Extract<PublicInterpretationNetworkReadResponse, { view: 'structures' }>
type PublicMatrix = Extract<PublicInterpretationNetworkReadResponse, { view: 'matrix' }>
type PublicMaterials = Extract<PublicInterpretationNetworkReadResponse, { view: 'materials' }>
type LocalIdForHandle = (kind: string, handle: string) => string

export function projectPublicStructures(items: PublicStructures['items'], localIdForHandle: LocalIdForHandle) {
    const handleById = new Map<string, string>()
    const summaries: StructureSummary[] = items.map((item) => {
        const id = localIdForHandle('structure', item.handle)
        handleById.set(id, item.handle)
        const row: RuntimeRow = { id, Name: item.name, Description: item.description ?? '' }
        return { id, row, title: item.name, description: item.description ?? '', interpretationId: null }
    })
    return { summaries, handleById }
}

export function projectPublicMatrixCells(
    items: PublicMatrix['items'],
    localIdForHandle: LocalIdForHandle,
    rowHeader: string,
    emptyCellTitle: string
): MatrixCell[] {
    return items.map((item) => {
        const id = localIdForHandle('cell', item.handle)
        const fill = item.style.fillColor ?? null
        return {
            id,
            rawRowId: localIdForHandle('row', item.rowHandle),
            sortOrder: item.sortOrder,
            parentCellId: item.parentHandle ? localIdForHandle('cell', item.parentHandle) : null,
            depth: 0,
            rowKey: localIdForHandle('row', item.rowHandle),
            rowLabel: item.rowLabel || rowHeader,
            colKey: localIdForHandle('column', item.columnHandle),
            colLabel: item.columnLabel,
            title: item.value || emptyCellTitle,
            description: item.description,
            materialRef: null,
            style: {
                fill,
                text: item.style.textColor ?? null,
                borderTop: readBorder(item.style.borderTop),
                borderRight: readBorder(item.style.borderRight),
                borderBottom: readBorder(item.style.borderBottom),
                borderLeft: readBorder(item.style.borderLeft)
            }
        }
    })
}

export function projectPublicMaterials(
    items: PublicMaterials['items'],
    selectedCellId: string | null,
    localIdForHandle: LocalIdForHandle
): RuntimeRow[] {
    return items.map((item, index) => ({
        id: localIdForHandle('material', `${selectedCellId ?? 'cell'}:${index}`),
        Title: item.title,
        Description: item.description ?? '',
        Body: toReadOnlyEditorContent(item.bodyText)
    }))
}

export function groupPublicMatrixRows(cells: MatrixCell[]) {
    const rows = new Map<string, MatrixCell[]>()
    for (const cell of cells) {
        const row = rows.get(cell.rowKey)
        if (row) row.push(cell)
        else rows.set(cell.rowKey, [cell])
    }
    return Array.from(rows, ([rowKey, rowCells]) => ({ rowKey, cells: rowCells }))
}

export function filterPublicStructures(structures: StructureSummary[], normalizedFilter: string, locale: string) {
    return normalizedFilter
        ? structures.filter((structure) =>
              [structure.title, structure.description].some((value) => value.toLocaleLowerCase(locale).includes(normalizedFilter))
          )
        : structures
}

const readBorder = (color: string | undefined): string => (color ? `1px solid ${color}` : '1px solid rgba(0, 0, 0, 0.12)')
