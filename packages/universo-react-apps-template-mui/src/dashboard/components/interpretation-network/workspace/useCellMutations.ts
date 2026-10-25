import { useMutation, type QueryClient } from '@tanstack/react-query'
import type { MutableRefObject } from 'react'
import { createLocalizedContent, normalizeLocale } from '@universo-react/utils'
import type { TFunction } from 'i18next'
import { AppsApiError } from '../../../../api/client'
import {
    createInterpretationNetworkMatrixCell,
    deleteInterpretationNetworkMatrixCell,
    updateInterpretationNetworkMatrixCell
} from '../../../../api/interpretationNetwork'
import {
    buildCellCreateData,
    MATRIX_CELL_PLACEMENT_FIELD,
    mergeCellCreateData,
    readMatrixCellPlacement,
    resolveCellCreateSystemFields
} from '../matrixCellData'
import { findColumn, readColumnValue, type MatrixCell, type RuntimeColumnLike, type RuntimeRow } from '../model'
import type { SelectMatrixCell } from './useMatrixWorkspaceActions'
import type { CellDialogMode } from './workspaceState'

type MatrixRowsSnapshotRef = MutableRefObject<{
    cells: MatrixCell[]
    rawRowsByCellId: Map<string, RuntimeRow>
}>

export function useCellMutations({
    t,
    queryClient,
    canCreateContent,
    canEditContent,
    canDeleteContent,
    apiBaseUrl,
    applicationId,
    workspaceId,
    widgetId,
    layoutId,
    instanceKey,
    runtimeLayoutTarget,
    locale,
    interpretationSectionId,
    selectedInterpretationId,
    matrixColumn,
    selectedCellId,
    deleteCell,
    deleteRawCell,
    cellDialogSourceCellId,
    activeCellDialogPlacement,
    widgetMatrixMode,
    rootCellId,
    matrixRowsSnapshotRef,
    readRuntimeRowVersion,
    readSubmittedText,
    selectMatrixCell,
    setPendingSelectedCellId,
    setCellDialogMode,
    setAxisDialogKind,
    setCellDialogSourceCellId,
    setCellDialogPlacement,
    setCellDialogError,
    cellDeleteId,
    setCellDeleteId,
    setCellDeleteError
}: {
    t: TFunction<'interpretationNetwork'>
    queryClient: QueryClient
    canCreateContent: boolean
    canEditContent: boolean
    canDeleteContent: boolean
    apiBaseUrl?: string | null
    applicationId?: string | null
    workspaceId?: string | null
    widgetId?: string | null
    layoutId?: string | null
    instanceKey?: string
    runtimeLayoutTarget?: { targetKind: 'page' | 'object'; entityTypeId: string }
    locale: string
    interpretationSectionId?: string | null
    selectedInterpretationId?: string | null
    matrixColumn?: RuntimeColumnLike
    selectedCellId: string | null
    deleteCell?: MatrixCell
    deleteRawCell?: RuntimeRow
    cellDialogSourceCellId: string | null
    activeCellDialogPlacement: ReturnType<typeof readMatrixCellPlacement> | undefined
    widgetMatrixMode: 'hierarchicalCells' | 'independentRows'
    rootCellId?: string | null
    matrixRowsSnapshotRef: MatrixRowsSnapshotRef
    readRuntimeRowVersion: (row: RuntimeRow | null | undefined) => number | undefined
    readSubmittedText: (value: unknown, locale: string) => string
    selectMatrixCell: SelectMatrixCell
    setPendingSelectedCellId: (cellId: string | null) => void
    setCellDialogMode: (mode: CellDialogMode | null) => void
    setAxisDialogKind: (kind: 'row' | 'column' | null) => void
    setCellDialogSourceCellId: (cellId: string | null) => void
    setCellDialogPlacement: (placement: ReturnType<typeof readMatrixCellPlacement> | null) => void
    setCellDialogError: (error: string | null) => void
    cellDeleteId: string | null
    setCellDeleteId: (cellId: string | null) => void
    setCellDeleteError: (error: string | null) => void
}) {
    const saveCellMutation = useMutation({
        mutationFn: async ({ mode, data }: { mode: CellDialogMode; data: Record<string, unknown> }) => {
            if (!canEditContent) throw new Error('permission-denied')
            if (mode !== 'edit' && !canCreateContent) throw new Error('permission-denied')
            if (!apiBaseUrl || !applicationId || !interpretationSectionId || !selectedInterpretationId || !matrixColumn?.id) {
                return null
            }
            const normalizedLocale = normalizeLocale(locale)
            const { [MATRIX_CELL_PLACEMENT_FIELD]: _placementField, __axisName: axisName, ...submittedData } = data
            const sourceCellIdForSubmit = cellDialogSourceCellId ?? selectedCellId
            const sourceCellFromSnapshot = sourceCellIdForSubmit
                ? matrixRowsSnapshotRef.current.cells.find((cell) => cell.id === sourceCellIdForSubmit)
                : undefined
            const sourceRawCellFromSnapshot = sourceCellFromSnapshot
                ? matrixRowsSnapshotRef.current.rawRowsByCellId.get(sourceCellFromSnapshot.id)
                : undefined
            if (mode === 'edit') {
                if (!sourceRawCellFromSnapshot?.id) throw new Error('cell-not-selected')
                const sourceCell = sourceCellFromSnapshot
                const rowLabelField = findColumn(matrixColumn.childColumns, 'RowLabel')?.field ?? 'RowLabel'
                const colLabelField = findColumn(matrixColumn.childColumns, 'ColLabel')?.field ?? 'ColLabel'
                if (sourceCell && !readSubmittedText(submittedData[rowLabelField], normalizedLocale)) {
                    submittedData[rowLabelField] = sourceCell.rowLabelValue ?? createLocalizedContent(normalizedLocale, sourceCell.rowLabel)
                }
                if (sourceCell && !readSubmittedText(submittedData[colLabelField], normalizedLocale)) {
                    submittedData[colLabelField] = sourceCell.colLabelValue ?? createLocalizedContent(normalizedLocale, sourceCell.colLabel)
                }
                const protectedFieldNames = new Set(['CellId', 'ParentCellId', 'RowKey', 'ColKey', 'MaterialRef', '_tp_sort_order'])
                for (const column of matrixColumn.childColumns ?? []) {
                    if (column.uiConfig?.serverOwned !== true) continue
                    if (typeof column.codename === 'string') protectedFieldNames.add(column.codename)
                    if (typeof column.field === 'string') protectedFieldNames.add(column.field)
                }
                const editableData = Object.fromEntries(
                    Object.entries(submittedData).filter(
                        ([field]) =>
                            !protectedFieldNames.has(field) &&
                            !field.startsWith('_tp_') &&
                            !field.startsWith('_upl_') &&
                            !field.startsWith('_app_')
                    )
                )
                if (!sourceCellFromSnapshot) throw new Error('cell-not-selected')
                const expectedCellVersion = readRuntimeRowVersion(sourceRawCellFromSnapshot)
                if (expectedCellVersion === undefined) throw new Error('version-unavailable')
                const saved = await updateInterpretationNetworkMatrixCell({
                    apiBaseUrl,
                    applicationId,
                    workspaceId,
                    interpretationId: selectedInterpretationId,
                    cellId: sourceCellFromSnapshot.id,
                    expectedCellVersion,
                    data: editableData,
                    widgetId,
                    layoutId,
                    instanceKey,
                    targetKind: runtimeLayoutTarget?.targetKind,
                    entityTypeId: runtimeLayoutTarget?.entityTypeId,
                    locale
                })
                return { saved, selectedCellIdAfterSave: sourceCellFromSnapshot?.id ?? null }
            }

            const source = sourceCellFromSnapshot
            const placement = readMatrixCellPlacement(data) ?? activeCellDialogPlacement ?? undefined
            if (mode === 'create-child') {
                if (!source) throw new Error('cell-not-selected')
                if (placement?.parentCellId !== undefined && placement.parentCellId !== source.id) throw new Error('cell-parent-mismatch')
            }
            if (typeof axisName === 'string' && axisName.trim()) {
                const titleField = findColumn(matrixColumn.childColumns, 'CellValue')?.field ?? 'CellValue'
                submittedData[titleField] = createLocalizedContent(normalizedLocale, axisName.trim())
            }
            if (mode === 'create-child') {
                const titleField = findColumn(matrixColumn.childColumns, 'CellValue')?.field ?? 'CellValue'
                const rowLabelField = findColumn(matrixColumn.childColumns, 'RowLabel')?.field ?? 'RowLabel'
                const colLabelField = findColumn(matrixColumn.childColumns, 'ColLabel')?.field ?? 'ColLabel'
                const titleValue = submittedData[titleField]
                if (readSubmittedText(titleValue, normalizedLocale)) {
                    if (!readSubmittedText(submittedData[rowLabelField], normalizedLocale)) submittedData[rowLabelField] = titleValue
                    if (!readSubmittedText(submittedData[colLabelField], normalizedLocale)) submittedData[colLabelField] = titleValue
                }
            }
            const baseData = buildCellCreateData({
                mode,
                childColumns: matrixColumn.childColumns,
                locale: normalizedLocale,
                source,
                existingCells: matrixRowsSnapshotRef.current.cells,
                placement
            })
            const trustedCreateData = mergeCellCreateData(submittedData, baseData, resolveCellCreateSystemFields(matrixColumn.childColumns))
            const readPlacementValue = (codename: string): unknown =>
                readColumnValue(trustedCreateData, matrixColumn.childColumns, codename)
            const parentCellId = readPlacementValue('ParentCellId')
            const rowKey = readPlacementValue('RowKey')
            const colKey = readPlacementValue('ColKey')
            const sortOrder = trustedCreateData._tp_sort_order
            const systemFields = resolveCellCreateSystemFields(matrixColumn.childColumns)
            const commandData = { ...trustedCreateData }
            systemFields.forEach((field) => delete commandData[field])
            const saved = await createInterpretationNetworkMatrixCell({
                apiBaseUrl,
                applicationId,
                workspaceId,
                interpretationId: selectedInterpretationId,
                data: commandData,
                placement: {
                    ...(parentCellId === null || typeof parentCellId === 'string' ? { parentCellId } : {}),
                    ...(typeof rowKey === 'string' && rowKey.trim() ? { rowKey: rowKey.trim() } : {}),
                    ...(typeof colKey === 'string' && colKey.trim() ? { colKey: colKey.trim() } : {}),
                    ...(typeof sortOrder === 'number' && Number.isInteger(sortOrder) && sortOrder >= 0 ? { sortOrder } : {})
                },
                widgetId,
                layoutId,
                instanceKey,
                targetKind: runtimeLayoutTarget?.targetKind,
                entityTypeId: runtimeLayoutTarget?.entityTypeId,
                locale
            })
            const createdRow = saved.item
            const rawPersistedCellId = readColumnValue(createdRow as Record<string, unknown>, matrixColumn.childColumns, 'CellId')
            const persistedCellId = typeof rawPersistedCellId === 'string' ? rawPersistedCellId.trim() : ''
            const rawGeneratedCellId = readColumnValue(baseData, matrixColumn.childColumns, 'CellId')
            const generatedCellId = persistedCellId || (typeof rawGeneratedCellId === 'string' ? rawGeneratedCellId.trim() : '')
            return {
                saved,
                generatedCellId,
                selectedCellIdAfterSave: null,
                pendingSelectedCellId: generatedCellId
            }
        },
        onSuccess: async (result) => {
            setCellDialogMode(null)
            setAxisDialogKind(null)
            setCellDialogSourceCellId(null)
            setCellDialogPlacement(null)
            setCellDialogError(null)
            if (result && typeof result === 'object' && 'selectedCellIdAfterSave' in result) {
                const rawCellId = result.selectedCellIdAfterSave
                if (typeof rawCellId === 'string' && rawCellId.trim()) selectMatrixCell(rawCellId.trim(), { replace: true })
            }
            if (result && typeof result === 'object' && 'pendingSelectedCellId' in result) {
                const rawCellId = result.pendingSelectedCellId
                setPendingSelectedCellId(typeof rawCellId === 'string' && rawCellId.trim() ? rawCellId.trim() : null)
            }
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
        },
        onError: (error) => {
            const errorKeyByCode: Record<string, string> = {
                INTERPRETATION_NETWORK_INVALID_CELL: 'workspace.cell.invalid',
                INTERPRETATION_NETWORK_INVALID_MATRIX: 'workspace.cell.invalidMatrix',
                INTERPRETATION_NETWORK_VERSION_CONFLICT: 'workspace.cell.conflict',
                INTERPRETATION_NETWORK_PERMISSION_DENIED: 'workspace.cell.permissionDenied',
                INTERPRETATION_NETWORK_MISSING_METADATA: 'workspace.cell.metadataUnavailable'
            }
            const localizedKey =
                error instanceof Error && error.message === 'permission-denied'
                    ? 'workspace.cell.permissionDenied'
                    : error instanceof AppsApiError && error.code
                    ? errorKeyByCode[error.code]
                    : undefined
            const fallback =
                localizedKey === 'workspace.cell.permissionDenied'
                    ? 'You do not have permission to change matrix cells.'
                    : 'Failed to update matrix cells'
            setCellDialogError(localizedKey ? t(localizedKey, fallback) : t('workspace.cell.error', 'Failed to update matrix cells'))
        }
    })

    const deleteCellMutation = useMutation({
        mutationFn: async () => {
            if (!canDeleteContent || !apiBaseUrl || !applicationId || !selectedInterpretationId || !deleteCell || !deleteRawCell) {
                throw new Error('permission-denied')
            }
            if (matrixRowsSnapshotRef.current.cells.some((cell) => cell.parentCellId === deleteCell.id))
                throw new Error('cell-has-children')
            if (widgetMatrixMode === 'hierarchicalCells' && deleteCell.id === rootCellId) throw new Error('cell-is-root')
            const expectedCellVersion = readRuntimeRowVersion(deleteRawCell)
            if (expectedCellVersion === undefined) throw new Error('version-unavailable')
            return deleteInterpretationNetworkMatrixCell({
                apiBaseUrl,
                applicationId,
                workspaceId,
                interpretationId: selectedInterpretationId,
                cellId: deleteCell.id,
                expectedCellVersion,
                widgetId,
                layoutId,
                instanceKey,
                targetKind: runtimeLayoutTarget?.targetKind,
                entityTypeId: runtimeLayoutTarget?.entityTypeId,
                locale
            })
        },
        onSuccess: async () => {
            if (cellDeleteId === selectedCellId) selectMatrixCell(null, { replace: true })
            setCellDeleteId(null)
            setCellDeleteError(null)
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkMaterialAssociations'] })
        },
        onError: (error) =>
            setCellDeleteError(
                error instanceof Error && error.message === 'cell-has-children'
                    ? t('workspace.cell.deleteHasChildren', 'Move or delete child cells before deleting this cell.')
                    : error instanceof Error && error.message === 'cell-is-root'
                    ? t('workspace.cell.deleteRoot', 'The root cell cannot be deleted.')
                    : t('workspace.cell.deleteError', 'Failed to delete cell')
            )
    })

    return { saveCellMutation, deleteCellMutation }
}
