import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FieldConfig } from '../components/dialogs/FormDialog'
import type { TabularRowsResponse } from '../api/api'
import {
    normalizeTabularCellValue,
    normalizeTabularRowOrdering,
    readTabularRowOrderingConfig,
    sortTabularRowsByOrder
} from '../utils/tabularCellValues'

type TabularRow = Record<string, unknown>

type UseDeferredTabularRowsOptions = {
    rowsData: TabularRowsResponse | undefined
    rows: TabularRow[]
    deferPersistence: boolean
    parentRecordId: string
    componentId: string
    childFields: FieldConfig[]
    rowOrdering: unknown
    resolvedLocale: string
    onRowsLoaded?: (rows: TabularRow[]) => void
    value?: TabularRow[]
    onChange?: (rows: TabularRow[]) => void
    onValueReconciled?: () => void
}

/** Keeps deferred TABLE rows, server-loaded rows, and controlled parent edits in sync. */
export function useDeferredTabularRows({
    rowsData,
    rows,
    deferPersistence,
    parentRecordId,
    componentId,
    childFields,
    rowOrdering,
    resolvedLocale,
    onRowsLoaded,
    value,
    onChange,
    onValueReconciled
}: UseDeferredTabularRowsOptions) {
    const [draftRows, setDraftRows] = useState<TabularRow[]>([])
    const [hasLocalChanges, setHasLocalChanges] = useState(false)
    const onRowsLoadedRef = useRef(onRowsLoaded)
    const onValueReconciledRef = useRef(onValueReconciled)
    const lastEmittedRowsRef = useRef<{ payload: TabularRow[]; gridRows: TabularRow[] } | null>(null)
    const lastLoadedRowsRef = useRef<TabularRow[] | null>(null)
    const loadedDataRef = useRef<TabularRowsResponse | undefined>(undefined)
    const acceptedGridRowsRef = useRef<TabularRow[]>([])
    const lastControlledValueRef = useRef(value)
    const currentValueRef = useRef(value)
    currentValueRef.current = value
    const draftRowsRef = useRef(draftRows)
    draftRowsRef.current = draftRows
    const orderingConfig = useMemo(() => readTabularRowOrderingConfig(rowOrdering), [rowOrdering])
    const canReorderRows = Boolean(deferPersistence && orderingConfig)

    useEffect(() => {
        onRowsLoadedRef.current = onRowsLoaded
    }, [onRowsLoaded])

    useEffect(() => {
        onValueReconciledRef.current = onValueReconciled
    }, [onValueReconciled])

    const toGridRows = useCallback(
        (inputRows: TabularRow[]) =>
            sortTabularRowsByOrder(inputRows, rowOrdering, childFields).map((row, index) => ({
                ...row,
                id: row.id ?? `__row_${index}`,
                _tp_sort_order: row._tp_sort_order ?? index
            })),
        [childFields, rowOrdering]
    )

    const toPayloadRows = useCallback(
        (inputRows: TabularRow[]) =>
            normalizeTabularRowOrdering(inputRows, rowOrdering, childFields).map((row) => {
                const mapped: TabularRow = {}
                for (const field of childFields) {
                    const cellValue = row[field.id] === undefined ? null : row[field.id]
                    mapped[field.id] = normalizeTabularCellValue(field, cellValue, resolvedLocale)
                }
                return mapped
            }),
        [childFields, resolvedLocale, rowOrdering]
    )

    const emitRowsChange = useCallback(
        (nextGridRows: TabularRow[]) => {
            if (!deferPersistence || !onChange) return
            const payload = toPayloadRows(nextGridRows)
            lastEmittedRowsRef.current = { payload, gridRows: nextGridRows }
            onChange(payload)
        },
        [deferPersistence, onChange, toPayloadRows]
    )

    useEffect(() => {
        if (!deferPersistence) return
        setDraftRows([])
        setHasLocalChanges(false)
        lastEmittedRowsRef.current = null
        lastLoadedRowsRef.current = null
        loadedDataRef.current = undefined
        acceptedGridRowsRef.current = []
        lastControlledValueRef.current = currentValueRef.current
    }, [deferPersistence, parentRecordId, componentId])

    useEffect(() => {
        if (!deferPersistence || !rowsData || rowsData === loadedDataRef.current || hasLocalChanges) return
        loadedDataRef.current = rowsData
        const loadedRows = toGridRows(rowsData.items ?? [])
        setDraftRows(loadedRows)
        acceptedGridRowsRef.current = loadedRows
        const payload = toPayloadRows(loadedRows)
        lastLoadedRowsRef.current = payload
        onRowsLoadedRef.current?.(payload)
    }, [deferPersistence, rowsData, hasLocalChanges, toGridRows, toPayloadRows])

    useEffect(() => {
        if (!deferPersistence || value === undefined || value === lastControlledValueRef.current) return
        lastControlledValueRef.current = value
        const emitted = lastEmittedRowsRef.current
        if (value === emitted?.payload) {
            // Keep DataGrid row objects and edit state on an ordinary parent echo.
            acceptedGridRowsRef.current = emitted.gridRows
            return
        }
        if (value === lastLoadedRowsRef.current) return

        // Coupled TABLE conversions patch cells in place. Keep accepted row identities
        // when a rejected add or delete restores the previous number of rows.
        const current = draftRowsRef.current
        const identityRows = current.length === value.length ? current : acceptedGridRowsRef.current
        const nextRows = value.map((row, index) => ({
            ...row,
            id: row.id ?? identityRows[index]?.id ?? `__row_${index}`,
            _tp_sort_order: identityRows[index]?._tp_sort_order ?? index
        }))
        lastEmittedRowsRef.current = null
        acceptedGridRowsRef.current = nextRows
        setDraftRows(nextRows)
        setHasLocalChanges(true)
        onValueReconciledRef.current?.()
    }, [deferPersistence, value])

    const effectiveRows = useMemo(() => {
        if (deferPersistence) return draftRows
        return toGridRows(rows)
    }, [deferPersistence, draftRows, rows, toGridRows])

    return {
        draftRows,
        setDraftRows,
        hasLocalChanges,
        setHasLocalChanges,
        effectiveRows,
        emitRowsChange,
        orderingConfig,
        canReorderRows
    }
}
