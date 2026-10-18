import { useCallback, useMemo } from 'react'
import {
    hasTabularRowOrderingField,
    isSafeTabularSiblingLabel,
    normalizeTabularSiblingRowOrder,
    readTabularRowOrderingConfig,
    resolveTabularSiblingFieldValue,
    sortTabularSiblingRows
} from '@universo-react/utils'
import type { DynamicFieldConfig } from '@universo-react/template-mui'
import { extractInlineTableDisplayString, getInlineTableRowId } from './inlineTableEditorValueUtils'

type InlineTableRow = Record<string, unknown>

type UseInlineTableRowOrderingOptions = {
    value: InlineTableRow[]
    rowOrdering?: unknown
    childFields: DynamicFieldConfig[]
    menuRowId: string | null
    onChange: (rows: InlineTableRow[]) => void
    onCloseRowMenu: () => void
    locale: string
    fallbackRowLabel: (rowNumber: number) => string
    moveUpLabel: string
    moveDownLabel: string
}

/** Own ordering, stable row identities and move controls for the inline TABLE editor. */
export function useInlineTableRowOrdering({
    value,
    rowOrdering,
    childFields,
    menuRowId,
    onChange,
    onCloseRowMenu,
    locale,
    fallbackRowLabel,
    moveUpLabel,
    moveDownLabel
}: UseInlineTableRowOrderingOptions) {
    const orderingConfig = useMemo(() => readTabularRowOrderingConfig(rowOrdering), [rowOrdering])
    const orderedRows = useMemo(() => sortTabularSiblingRows(value, rowOrdering, childFields), [value, rowOrdering, childFields])
    const rowsWithIds = useMemo(
        () => orderedRows.map((row, index) => ({ ...row, __rowId: getInlineTableRowId(row, index) })),
        [orderedRows]
    )
    const canReorderRows = hasTabularRowOrderingField(childFields, orderingConfig)

    const handleMoveRow = useCallback(
        (direction: -1 | 1) => {
            if (!canReorderRows || !menuRowId) return
            const currentIndex = orderedRows.findIndex((row, index) => getInlineTableRowId(row, index) === menuRowId)
            const nextIndex = currentIndex + direction
            if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedRows.length) {
                onCloseRowMenu()
                return
            }
            const nextRows = [...orderedRows]
            ;[nextRows[currentIndex], nextRows[nextIndex]] = [nextRows[nextIndex], nextRows[currentIndex]]
            onChange(normalizeTabularSiblingRowOrder(nextRows, rowOrdering, childFields))
            onCloseRowMenu()
        },
        [canReorderRows, menuRowId, orderedRows, onChange, rowOrdering, childFields, onCloseRowMenu]
    )

    const menuRowIndex = orderedRows.findIndex((row, index) => getInlineTableRowId(row, index) === menuRowId)
    const menuRowValue = orderingConfig
        ? resolveTabularSiblingFieldValue(orderedRows[menuRowIndex] ?? {}, childFields, orderingConfig.labelFieldCodename)
        : undefined
    const rawMenuRowLabel = extractInlineTableDisplayString(menuRowValue, locale).trim()
    const menuRowLabel = (isSafeTabularSiblingLabel(rawMenuRowLabel) ? rawMenuRowLabel : '') || fallbackRowLabel(menuRowIndex + 1)

    return {
        orderedRows,
        rowsWithIds,
        canReorderRows,
        handleMoveRow,
        menuRowIndex,
        menuRowLabel,
        moveUpLabel,
        moveDownLabel
    }
}

export const normalizeInlineTableRowOrdering = (
    rows: InlineTableRow[],
    rowOrdering: unknown,
    childFields: DynamicFieldConfig[]
): InlineTableRow[] => normalizeTabularSiblingRowOrder(rows, rowOrdering, childFields)
