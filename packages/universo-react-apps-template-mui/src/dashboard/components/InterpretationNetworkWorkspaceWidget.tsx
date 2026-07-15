import { useCallback, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTheme } from '@mui/material/styles'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { createLocalizedContent, normalizeLocale } from '@universo-react/utils'
import {
    batchUpdateTabularRows,
    compensateCreatedAppRow,
    createAppRow,
    createTabularRow,
    deleteAppRow,
    deleteTabularRow,
    fetchAppData,
    fetchAppRow,
    updateAppRow,
    updateTabularRow
} from '../../api/api'
import '../../i18n/interpretationNetwork'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { formatRuntimeSafeValue } from '../../utils/displayValue'
import { type MatrixDropState } from './interpretation-network/matrixDrag'
import { type StructureSummary, type StructureViewMode } from './interpretation-network/workspace/StructurePane'
import { RuntimeContextMissing, WorkspaceError, WorkspaceLoading } from './interpretation-network/workspace/WorkspaceStatus'
import { buildMatrixMenuMoves } from './interpretation-network/workspace/matrixMenuMoves'
import { InterpretationNetworkWorkspaceContent } from './interpretation-network/workspace/InterpretationNetworkWorkspaceContent'
import { useCellDialogActions } from './interpretation-network/workspace/useCellDialogActions'
import { useInterpretationNetworkWorkspaceState } from './interpretation-network/workspace/useInterpretationNetworkWorkspaceState'
import { useMatrixRouteSelectionSync } from './interpretation-network/workspace/useMatrixRouteSelectionSync'
import { useMatrixWorkspaceActions } from './interpretation-network/workspace/useMatrixWorkspaceActions'
import { useStructureRoute } from './interpretation-network/workspace/useStructureRoute'
import {
    EMPTY_MATRIX_DROP_STATE,
    type CellDialogMode,
    type MatrixAxisDialogKind,
    type MaterialDialogMode,
    type StructureDialogMode
} from './interpretation-network/workspace/workspaceState'
import { fetchAllWorkspaceData, readRuntimeRowVersion, readSubmittedText } from './interpretation-network/workspace/workspaceRuntime'
import {
    buildCellCreateData,
    MATRIX_CELL_PLACEMENT_FIELD,
    mergeCellCreateData,
    readMatrixCellPlacement,
    resolveCellCreateSystemFields,
    type MatrixCellPlacement
} from './interpretation-network/matrixCellData'
import { createStructureWithRootMatrix } from './interpretation-network/structureActions'
import { findColumn, getSectionId, readColumnValue, toConfig, type MatrixView } from './interpretation-network/model'

export default function InterpretationNetworkWorkspaceWidget({ config }: { config?: Record<string, unknown> }) {
    const widgetConfig = useMemo(() => toConfig(config), [config])
    const theme = useTheme()
    const details = useDashboardDetails()
    const { t, i18n } = useTranslation('interpretationNetwork')
    const queryClient = useQueryClient()
    const locale = normalizeLocale(details?.locale ?? i18n.language ?? 'en')
    const enabled = Boolean(details?.apiBaseUrl && details.applicationId)

    const query = useQuery({
        queryKey: ['interpretationNetworkWorkspace', details?.applicationId, details?.currentWorkspaceId, locale, widgetConfig],
        enabled,
        queryFn: async () => {
            const base = {
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                workspaceId: details?.currentWorkspaceId,
                locale
            }
            const [concepts, interpretations, materials] = await Promise.all([
                fetchAllWorkspaceData(fetchAppData, { ...base, objectCollectionCodename: widgetConfig.conceptCodename }),
                fetchAllWorkspaceData(fetchAppData, { ...base, objectCollectionCodename: widgetConfig.interpretationCodename }),
                fetchAllWorkspaceData(fetchAppData, { ...base, objectCollectionCodename: widgetConfig.materialCodename })
            ])
            return { concepts, interpretations, materials }
        }
    })

    const [structureDialogMode, setStructureDialogMode] = useState<StructureDialogMode | null>(null)
    const [selectedInterpretationId, setSelectedInterpretationId] = useState<string | null>(null)
    const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null)
    const [selectedCellId, setSelectedCellId] = useState<string | null>(null)
    const [pendingSelectedCellId, setPendingSelectedCellId] = useState<string | null>(null)
    const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null)
    const [openedMaterialId, setOpenedMaterialId] = useState<string | null>(null)
    const [editingStructureId, setEditingStructureId] = useState<string | null>(null)
    const [editingStructureData, setEditingStructureData] = useState<Record<string, unknown> | undefined>(undefined)
    const clearEditingStructure = useCallback(() => {
        setEditingStructureId(null)
        setEditingStructureData(undefined)
    }, [])
    const setEditingStructureIdForDialogs: Dispatch<SetStateAction<string | null>> = useCallback((next) => {
        setEditingStructureId((current) => {
            const resolved = typeof next === 'function' ? next(current) : next
            if (resolved === null) setEditingStructureData(undefined)
            return resolved
        })
    }, [])
    const [structureDeleteId, setStructureDeleteId] = useState<string | null>(null)
    const [structureMenuAnchor, setStructureMenuAnchor] = useState<HTMLElement | null>(null)
    const [structureMenuId, setStructureMenuId] = useState<string | null>(null)
    const [structureViewMode, setStructureViewMode] = useState<StructureViewMode>('table')
    const [structureFilter, setStructureFilter] = useState('')
    const [materialDialogMode, setMaterialDialogMode] = useState<MaterialDialogMode | null>(null)
    const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null)
    const [cellDialogMode, setCellDialogMode] = useState<CellDialogMode | null>(null)
    const [axisDialogKind, setAxisDialogKind] = useState<MatrixAxisDialogKind | null>(null)
    const [cellDialogSourceCellId, setCellDialogSourceCellId] = useState<string | null>(null)
    const [cellDialogPlacement, setCellDialogPlacement] = useState<MatrixCellPlacement | null>(null)
    const [cellMenuAnchor, setCellMenuAnchor] = useState<HTMLElement | null>(null)
    const [cellMenuCellId, setCellMenuCellId] = useState<string | null>(null)
    const [matrixViewOverride, setMatrixViewOverride] = useState<MatrixView | null>(null)
    const [cellDeleteId, setCellDeleteId] = useState<string | null>(null)
    const [matrixDropState, setMatrixDropState] = useState<MatrixDropState>(EMPTY_MATRIX_DROP_STATE)
    const [structureDialogError, setStructureDialogError] = useState<string | null>(null)
    const [structureDeleteError, setStructureDeleteError] = useState<string | null>(null)
    const [materialDialogError, setMaterialDialogError] = useState<string | null>(null)
    const [cellDialogError, setCellDialogError] = useState<string | null>(null)
    const [cellDeleteError, setCellDeleteError] = useState<string | null>(null)
    const [structureReturnFocusId, setStructureReturnFocusId] = useState<string | null>(null)
    const canCreateContent = details?.permissions?.createContent === true
    const canEditContent = details?.permissions?.editContent === true
    const canDeleteContent = details?.permissions?.deleteContent === true

    const { routeStructureId, routeCellId, navigateToStructure, navigateToCell } = useStructureRoute({
        applicationId: details?.applicationId,
        conceptSectionId: getSectionId(query.data?.concepts),
        navigate: details?.navigate
    })

    const workspaceState = useInterpretationNetworkWorkspaceState({
        data: query.data,
        details,
        locale,
        themeBackground: theme.palette.background.paper,
        widgetConfig,
        selectedInterpretationId,
        selectedConceptId,
        selectedCellId,
        openedMaterialId,
        editingStructureId,
        editingStructureData,
        editingMaterialId,
        cellDialogSourceCellId,
        cellDialogPlacement,
        cellMenuCellId,
        cellDeleteId,
        matrixViewOverride,
        matrixDropState,
        structureFilter,
        dialogs: { structureDialogMode, materialDialogMode, cellDialogMode },
        t,
        onInvalidMatrixViewOverride: () => setMatrixViewOverride(null)
    })
    const {
        concepts,
        interpretations,
        materials,
        interpretationSectionId,
        materialSectionId,
        matrixColumn,
        materialFields,
        materialBodyField,
        structureFields,
        styleFields,
        cellMetadataFields,
        selectedInterpretation,
        selectedConcept,
        editingStructure,
        matrixRowsQuery,
        matrixCells,
        matrixAxisOptions,
        hierarchicalMatrixRows,
        hierarchicalTableModel,
        matrixPositionLabels,
        effectiveMatrixView,
        matrixRowsSnapshotRef,
        selectedCell,
        selectedRawCell,
        menuCell,
        deleteCell,
        deleteRawCell,
        rootCellId,
        cellMaterials,
        materialCountByCellId,
        selectedMaterial,
        materialInitialData,
        structureInitialData,
        materialEditorInitialData,
        cellDialogInitialData,
        cellDialogPlacement: activeCellDialogPlacement,
        dataGridLocaleText,
        structureSummaries,
        normalizedStructureFilter,
        filteredStructures,
        matrixRows,
        visibleMatrixCells,
        matrixCellIds,
        matrixDragPreview
    } = workspaceState
    const clearMaterialSelection = useCallback(() => {
        setSelectedMaterialId(null)
        setOpenedMaterialId(null)
        setEditingMaterialId(null)
        setMaterialDialogMode(null)
    }, [])

    const selectMatrixCell = useCallback(
        (cellId: string | null, options: { replace?: boolean; updateRoute?: boolean } = {}) => {
            setSelectedCellId(cellId)
            clearMaterialSelection()
            if (options.updateRoute !== false && routeStructureId) {
                navigateToCell(cellId, options)
            }
        },
        [clearMaterialSelection, navigateToCell, routeStructureId]
    )
    const syncRouteCell = useCallback(
        (cellId: string | null, options: { replace?: boolean } = {}) => {
            if (routeStructureId) {
                navigateToCell(cellId, options)
            }
        },
        [navigateToCell, routeStructureId]
    )

    useMatrixRouteSelectionSync({
        queryLoading: query.isLoading,
        queryFetching: query.isFetching,
        routeStructureId,
        routeCellId,
        concepts,
        interpretations,
        structureSummaries,
        matrixCells,
        rootState: hierarchicalTableModel.rootState,
        selectedInterpretation,
        selectedCell,
        selectedInterpretationId,
        selectedConceptId,
        selectedCellId,
        pendingSelectedCellId,
        selectedMaterialId,
        cellMaterials,
        matrixRowsSettled: !matrixRowsQuery.isLoading && !matrixRowsQuery.isFetching,
        selectMatrixCell,
        clearMaterialSelection,
        setSelectedInterpretationId,
        setSelectedConceptId,
        setPendingSelectedCellId,
        setSelectedMaterialId,
        setOpenedMaterialId,
        syncRouteCell
    })
    const createStructureMutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) =>
            createStructureWithRootMatrix({
                data,
                canCreateContent,
                canEditContent,
                apiBaseUrl: details?.apiBaseUrl,
                applicationId: details?.applicationId,
                workspaceId: details?.currentWorkspaceId,
                conceptSectionId: getSectionId(query.data?.concepts),
                interpretationSectionId,
                locale,
                widgetConfig,
                structureFields,
                matrixColumn,
                defaultStructureName: t('workspace.structure.newName', 'New structure'),
                matrixTitle: (name) =>
                    t('workspace.structure.newInterpretationTitle', {
                        defaultValue: '{{name}} matrix',
                        name
                    })
            }),
        onSuccess: async (created) => {
            setStructureDialogMode(null)
            clearEditingStructure()
            setStructureDialogError(null)
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspace'] })
            let createdConceptId: string | null = null
            if (created?.concept && typeof created.concept.id === 'string') {
                createdConceptId = created.concept.id
                setSelectedConceptId(createdConceptId)
            }
            if (created?.interpretation && typeof created.interpretation.id === 'string') {
                setSelectedInterpretationId(created.interpretation.id)
                selectMatrixCell(null, { replace: true })
            }
            if (createdConceptId) {
                navigateToStructure(createdConceptId)
            }
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
        },
        onError: () => {
            setStructureDialogError(t('workspace.structure.error', 'Failed to create structure'))
        }
    })
    const updateStructureMutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            if (!canEditContent || !editingStructureId) throw new Error('permission-denied')
            const conceptSectionId = getSectionId(query.data?.concepts)
            if (!details?.apiBaseUrl || !details.applicationId || !conceptSectionId) return null
            return updateAppRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                objectCollectionId: conceptSectionId,
                rowId: editingStructureId,
                data,
                expectedVersion: readRuntimeRowVersion(editingStructure)
            })
        },
        onSuccess: async () => {
            setStructureDialogMode(null)
            clearEditingStructure()
            setStructureDialogError(null)
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspace'] })
        },
        onError: () => {
            setStructureDialogError(t('workspace.structure.updateError', 'Failed to update structure'))
        }
    })
    const deleteStructure = structureDeleteId ? structureSummaries.find((structure) => structure.id === structureDeleteId) : undefined
    const deleteStructureMutation = useMutation({
        mutationFn: async () => {
            if (!canDeleteContent || !structureDeleteId) throw new Error('permission-denied')
            if (!details?.apiBaseUrl || !details.applicationId) return null
            const conceptSectionId = getSectionId(query.data?.concepts)
            if (!conceptSectionId) return null
            await deleteAppRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                objectCollectionId: conceptSectionId,
                rowId: structureDeleteId,
                expectedVersion: readRuntimeRowVersion(deleteStructure?.row)
            })
            if (deleteStructure?.interpretationId && interpretationSectionId) {
                const interpretation = interpretations.find((row) => row.id === deleteStructure.interpretationId)
                await deleteAppRow({
                    apiBaseUrl: details.apiBaseUrl,
                    applicationId: details.applicationId,
                    workspaceId: details.currentWorkspaceId,
                    objectCollectionId: interpretationSectionId,
                    rowId: deleteStructure.interpretationId,
                    expectedVersion: readRuntimeRowVersion(interpretation)
                })
            }
            return null
        },
        onSuccess: async () => {
            const deletedId = structureDeleteId
            setStructureDeleteId(null)
            setStructureDeleteError(null)
            if (deletedId && selectedConceptId === deletedId) {
                setSelectedConceptId(null)
                setSelectedInterpretationId(null)
                selectMatrixCell(null, { replace: true })
                setSelectedMaterialId(null)
                setOpenedMaterialId(null)
                navigateToStructure(null)
            }
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspace'] })
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
        },
        onError: () => {
            setStructureDeleteError(t('workspace.structure.deleteError', 'Failed to delete structure'))
        }
    })
    const saveCellMutation = useMutation({
        mutationFn: async ({ mode, data }: { mode: CellDialogMode; data: Record<string, unknown> }) => {
            if (!canEditContent) throw new Error('permission-denied')
            if (
                !details?.apiBaseUrl ||
                !details.applicationId ||
                !interpretationSectionId ||
                !selectedInterpretation?.id ||
                !matrixColumn?.id
            ) {
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
                const axisValueChanged = (field: string, fallbackField: string): boolean => {
                    if (!Object.prototype.hasOwnProperty.call(submittedData, field)) return false
                    const previousValue = sourceRawCellFromSnapshot[field] ?? sourceRawCellFromSnapshot[fallbackField]
                    return (
                        formatRuntimeSafeValue(submittedData[field], normalizedLocale) !==
                        formatRuntimeSafeValue(previousValue, normalizedLocale)
                    )
                }
                const rowLabelChanged = axisValueChanged(rowLabelField, 'RowLabel')
                const colLabelChanged = axisValueChanged(colLabelField, 'ColLabel')
                const buildAxisRows = (axis: 'row' | 'column') =>
                    sourceCell
                        ? matrixRowsSnapshotRef.current.cells
                              .filter(
                                  (cell) =>
                                      cell.id !== sourceCell.id &&
                                      (axis === 'row' ? cell.rowKey === sourceCell.rowKey : cell.colKey === sourceCell.colKey)
                              )
                              .flatMap((cell) => {
                                  const rawCell = matrixRowsSnapshotRef.current.rawRowsByCellId.get(cell.id)
                                  return rawCell && typeof rawCell.id === 'string'
                                      ? [
                                            {
                                                childRowId: rawCell.id,
                                                expectedVersion: readRuntimeRowVersion(rawCell)
                                            }
                                        ]
                                      : []
                              })
                        : []
                const uniformUpdates = [
                    ...(rowLabelChanged && submittedData[rowLabelField] !== undefined
                        ? [{ rows: buildAxisRows('row'), data: { [rowLabelField]: submittedData[rowLabelField] } }]
                        : []),
                    ...(colLabelChanged && submittedData[colLabelField] !== undefined
                        ? [{ rows: buildAxisRows('column'), data: { [colLabelField]: submittedData[colLabelField] } }]
                        : [])
                ].filter((group) => group.rows.length > 0)
                const saved = await batchUpdateTabularRows({
                    apiBaseUrl: details.apiBaseUrl,
                    applicationId: details.applicationId,
                    workspaceId: details.currentWorkspaceId,
                    parentRecordId: selectedInterpretation.id,
                    componentId: matrixColumn.id,
                    objectCollectionId: interpretationSectionId,
                    updates: [
                        {
                            childRowId: sourceRawCellFromSnapshot.id,
                            data: submittedData,
                            expectedVersion: readRuntimeRowVersion(sourceRawCellFromSnapshot)
                        }
                    ],
                    uniformUpdates
                })
                return { saved, selectedCellIdAfterSave: sourceCellFromSnapshot?.id ?? null }
            }

            const source = sourceCellFromSnapshot
            const placement = readMatrixCellPlacement(data) ?? activeCellDialogPlacement ?? undefined
            if (mode === 'create-child') {
                if (!source) throw new Error('cell-not-selected')
                if (placement?.parentCellId !== undefined && placement.parentCellId !== source.id) {
                    throw new Error('cell-parent-mismatch')
                }
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
                    if (!readSubmittedText(submittedData[rowLabelField], normalizedLocale)) {
                        submittedData[rowLabelField] = titleValue
                    }
                    if (!readSubmittedText(submittedData[colLabelField], normalizedLocale)) {
                        submittedData[colLabelField] = titleValue
                    }
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
            const saved = await createTabularRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                parentRecordId: selectedInterpretation.id,
                componentId: matrixColumn.id,
                objectCollectionId: interpretationSectionId,
                data: mergeCellCreateData(submittedData, baseData, resolveCellCreateSystemFields(matrixColumn.childColumns))
            })
            const createdRow = saved && typeof saved === 'object' && saved.item && typeof saved.item === 'object' ? saved.item : saved
            const rawPersistedCellId = readColumnValue(createdRow as Record<string, unknown>, matrixColumn.childColumns, 'CellId')
            const persistedCellId = typeof rawPersistedCellId === 'string' ? rawPersistedCellId.trim() : ''
            const rawGeneratedCellId = readColumnValue(baseData, matrixColumn.childColumns, 'CellId')
            const generatedCellId = persistedCellId || (typeof rawGeneratedCellId === 'string' ? rawGeneratedCellId.trim() : '')
            return {
                saved,
                generatedCellId,
                selectedCellIdAfterSave: mode === 'create-child' ? source?.id ?? null : null,
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
                if (typeof rawCellId === 'string' && rawCellId.trim()) {
                    selectMatrixCell(rawCellId.trim(), { replace: true })
                }
            }
            if (result && typeof result === 'object' && 'pendingSelectedCellId' in result) {
                const rawCellId = result.pendingSelectedCellId
                setPendingSelectedCellId(typeof rawCellId === 'string' && rawCellId.trim() ? rawCellId.trim() : null)
            }
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
        },
        onError: () => {
            setCellDialogError(t('workspace.cell.error', 'Failed to update matrix cells'))
        }
    })
    const matrixMutationsDisabled =
        !canEditContent || !selectedInterpretation || !matrixColumn?.id || matrixRowsQuery.isError || matrixRowsQuery.isFetching
    const matrixAxisActionsDisabled = !canEditContent || !selectedInterpretation || !matrixColumn?.id || matrixRowsQuery.isError
    const isEmptyIndependentRowsMatrix = widgetConfig.matrixMode === 'independentRows' && matrixCells.length === 0
    const addCellDisabled =
        widgetConfig.matrixMode === 'independentRows' &&
        !widgetConfig.allowNewAxesInCellDialog &&
        !selectedCell &&
        !isEmptyIndependentRowsMatrix
    const { sensors, moveCellMutation, handleMoveCell, moveSelectedToTableSlot, matrixDragHandlers } = useMatrixWorkspaceActions({
        t,
        queryClient,
        canEditContent,
        apiBaseUrl: details?.apiBaseUrl,
        applicationId: details?.applicationId,
        workspaceId: details?.currentWorkspaceId,
        interpretationSectionId,
        selectedInterpretationId: selectedInterpretation?.id,
        matrixColumnId: matrixColumn?.id,
        matrixChildColumns: matrixColumn?.childColumns,
        matrixRowsSnapshotRef,
        setMatrixDropState,
        matrixMutationsDisabled,
        effectiveMatrixView,
        tableProjection: widgetConfig.tableProjection,
        widgetMatrixMode: widgetConfig.matrixMode,
        locale,
        visibleMatrixCells,
        matrixCellIds,
        selectedCell,
        selectMatrixCell,
        readRuntimeRowVersion,
        readSubmittedText,
        setCellDialogError
    })
    const { openCellDialog, openTableAxisDialog } = useCellDialogActions({
        matrixMode: widgetConfig.matrixMode,
        allowNewAxesInCellDialog: widgetConfig.allowNewAxesInCellDialog,
        effectiveMatrixView,
        matrixCells,
        visibleMatrixCells,
        selectedCellId,
        selectedCell,
        selectMatrixCell,
        setCellDialogSourceCellId,
        setCellDialogPlacement,
        setCellDialogError,
        setCellDialogMode,
        setAxisDialogKind
    })
    const saveMaterialMetadataMutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            if (!details?.apiBaseUrl || !details.applicationId || !materialSectionId) return null
            if (!selectedInterpretation?.id || !matrixColumn?.id || !selectedRawCell?.id || !interpretationSectionId) {
                throw new Error('cell-not-selected')
            }

            if (materialDialogMode === 'edit') {
                const targetMaterialId = editingMaterialId
                if (!canEditContent || !targetMaterialId) throw new Error('permission-denied')
                return updateAppRow({
                    apiBaseUrl: details.apiBaseUrl,
                    applicationId: details.applicationId,
                    workspaceId: details.currentWorkspaceId,
                    objectCollectionId: materialSectionId,
                    rowId: targetMaterialId,
                    data
                })
            }

            if (!canCreateContent || !canEditContent) throw new Error('permission-denied')
            const materialCellIdField = findColumn(query.data?.materials.columns, 'CellId')?.field ?? 'CellId'
            const matrixMaterialRefField = findColumn(matrixColumn.childColumns, 'MaterialRef')?.field ?? 'MaterialRef'
            const material = await createAppRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                objectCollectionId: materialSectionId,
                data: { ...data, [materialCellIdField]: selectedCell?.id ?? null }
            })
            if (typeof material.id === 'string') {
                await updateTabularRow({
                    apiBaseUrl: details.apiBaseUrl,
                    applicationId: details.applicationId,
                    workspaceId: details.currentWorkspaceId,
                    parentRecordId: selectedInterpretation.id,
                    componentId: matrixColumn.id,
                    objectCollectionId: interpretationSectionId,
                    childRowId: selectedRawCell.id,
                    data: { [matrixMaterialRefField]: material.id },
                    expectedVersion: readRuntimeRowVersion(selectedRawCell)
                }).catch(async (error) => {
                    await compensateCreatedAppRow({
                        apiBaseUrl: details.apiBaseUrl!,
                        applicationId: details.applicationId!,
                        workspaceId: details.currentWorkspaceId,
                        rowId: material.id as string,
                        objectCollectionId: materialSectionId
                    }).catch(() => undefined)
                    throw error
                })
            }
            return material
        },
        onSuccess: async (saved) => {
            setMaterialDialogMode(null)
            setEditingMaterialId(null)
            setMaterialDialogError(null)
            if (saved && typeof saved.id === 'string') {
                setSelectedMaterialId(saved.id)
            }
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspace'] })
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
        },
        onError: () => {
            setMaterialDialogError(t('workspace.material.error', 'Failed to save material'))
        }
    })

    const saveMaterialBodyMutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            if (!details?.apiBaseUrl || !details.applicationId || !materialSectionId || !openedMaterialId) return null
            if (!canEditContent) throw new Error('permission-denied')
            return updateAppRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                objectCollectionId: materialSectionId,
                rowId: openedMaterialId,
                data
            })
        },
        onSuccess: async () => {
            setMaterialDialogError(null)
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspace'] })
        },
        onError: () => {
            setMaterialDialogError(t('workspace.material.error', 'Failed to save material'))
        }
    })
    const deleteCellMutation = useMutation({
        mutationFn: async () => {
            if (
                !canDeleteContent ||
                !details?.apiBaseUrl ||
                !details.applicationId ||
                !interpretationSectionId ||
                !selectedInterpretation?.id ||
                !matrixColumn?.id ||
                !deleteCell ||
                !deleteRawCell?.id
            ) {
                throw new Error('permission-denied')
            }
            if (matrixRowsSnapshotRef.current.cells.some((cell) => cell.parentCellId === deleteCell.id)) {
                throw new Error('cell-has-children')
            }
            if (widgetConfig.matrixMode === 'hierarchicalCells' && deleteCell.id === rootCellId) {
                throw new Error('cell-is-root')
            }
            return deleteTabularRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                parentRecordId: selectedInterpretation.id,
                componentId: matrixColumn.id,
                objectCollectionId: interpretationSectionId,
                childRowId: deleteRawCell.id,
                expectedVersion: readRuntimeRowVersion(deleteRawCell)
            })
        },
        onSuccess: async () => {
            if (cellDeleteId === selectedCellId) {
                selectMatrixCell(null, { replace: true })
            }
            setCellDeleteId(null)
            setCellDeleteError(null)
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
        },
        onError: (error) => {
            setCellDeleteError(
                error instanceof Error && error.message === 'cell-has-children'
                    ? t('workspace.cell.deleteHasChildren', 'Move or delete child cells before deleting this cell.')
                    : error instanceof Error && error.message === 'cell-is-root'
                    ? t('workspace.cell.deleteRoot', 'The root cell cannot be deleted.')
                    : t('workspace.cell.deleteError', 'Failed to delete cell')
            )
        }
    })

    if (!enabled) {
        return <RuntimeContextMissing message={t('workspace.missingRuntimeContext', 'Runtime context is not available yet.')} />
    }

    if (query.isLoading) {
        return <WorkspaceLoading label={t('workspace.loading', 'Loading interpretation network')} />
    }

    if (query.error) {
        return (
            <WorkspaceError
                error={query.error}
                fallback={t('workspace.error', 'Failed to load interpretation workspace')}
                locale={locale}
            />
        )
    }

    const openStructure = (structure: StructureSummary) => {
        setStructureReturnFocusId(structure.id)
        setSelectedConceptId(structure.id)
        setSelectedInterpretationId(structure.interpretationId)
        selectMatrixCell(null, { replace: true })
        setSelectedMaterialId(null)
        setOpenedMaterialId(null)
        setMaterialDialogMode(null)
        setEditingMaterialId(null)
        navigateToStructure(structure.id)
    }
    const backToStructureList = () => {
        setSelectedConceptId(null)
        setSelectedInterpretationId(null)
        selectMatrixCell(null, { replace: true })
        setSelectedMaterialId(null)
        setOpenedMaterialId(null)
        navigateToStructure(null)
    }
    const openCreateStructureDialog = () => {
        setStructureDialogError(null)
        clearEditingStructure()
        setStructureDialogMode('create')
    }
    const closeCellMenu = () => {
        setCellMenuAnchor(null)
        setCellMenuCellId(null)
    }
    const closeStructureMenu = () => {
        setStructureMenuAnchor(null)
        setStructureMenuId(null)
    }
    const menuMoves = buildMatrixMenuMoves({
        t,
        mode: widgetConfig.matrixMode,
        menuCell,
        matrixRows,
        visibleMatrixCells,
        onMove: (target, placement) => {
            if (!menuCell) return
            closeCellMenu()
            handleMoveCell(menuCell.id, target.id, placement)
        }
    })
    return (
        <InterpretationNetworkWorkspaceContent
            matrix={
                selectedInterpretation
                    ? {
                          t,
                          locale,
                          mode: widgetConfig.matrixMode,
                          matrixView: effectiveMatrixView,
                          allowedMatrixViews: widgetConfig.allowedMatrixViews,
                          tableProjection: widgetConfig.tableProjection,
                          toolbarLayout: widgetConfig.toolbarLayout,
                          showHierarchicalTableHeaders: widgetConfig.showHierarchicalTableHeaders,
                          showHierarchicalTableHeaderCard: widgetConfig.showHierarchicalTableHeaderCard,
                          showMatrixTreeTotalCells: widgetConfig.showMatrixTreeTotalCells,
                          colorBreadcrumbsByCell: widgetConfig.colorBreadcrumbsByCell,
                          hierarchyRows: hierarchicalMatrixRows,
                          hierarchicalTableModel,
                          positionLabels: matrixPositionLabels,
                          cells: matrixCells,
                          visibleCells: visibleMatrixCells,
                          rows: matrixRows,
                          materialCountByCellId,
                          cellIds: matrixCellIds,
                          selectedCell,
                          dropState: matrixDropState,
                          dragPreview: matrixDragPreview,
                          disabled: matrixMutationsDisabled,
                          axisActionsDisabled: matrixAxisActionsDisabled,
                          addCellDisabled,
                          savingCell: saveCellMutation.isPending,
                          movingCell: moveCellMutation.isPending,
                          errors: { rows: matrixRowsQuery.error, saveCell: saveCellMutation.error, moveCell: moveCellMutation.error },
                          permissions: { canEditContent, canDeleteContent },
                          menu: { anchor: cellMenuAnchor, cell: menuCell, moves: menuMoves },
                          deletingCell: deleteCellMutation.isPending,
                          sensors,
                          onChangeMatrixView: setMatrixViewOverride,
                          actions: {
                              openCellDialog,
                              addTableRow: () => openTableAxisDialog('row'),
                              addTableColumn: () => openTableAxisDialog('column'),
                              moveSelectedToSlot: moveSelectedToTableSlot,
                              selectCell: selectMatrixCell,
                              openCellMenu: (anchor, cellId) => {
                                  setCellMenuAnchor(anchor)
                                  setCellMenuCellId(cellId)
                              },
                              closeCellMenu,
                              requestDeleteCell: (cellId) => {
                                  setCellDeleteError(null)
                                  setCellDeleteId(cellId)
                              },
                              dragStart: matrixDragHandlers.dragStart,
                              dragMove: matrixDragHandlers.dragMove,
                              dragOver: matrixDragHandlers.dragOver,
                              dragCancel: matrixDragHandlers.dragCancel,
                              dragEnd: matrixDragHandlers.dragEnd
                          }
                      }
                    : null
            }
            structure={{
                t,
                selectedConcept,
                conceptColumns: query.data?.concepts.columns,
                conceptNameField: widgetConfig.conceptNameField,
                locale,
                structureFilter,
                structureViewMode,
                filteredStructures,
                dataGridLocaleText,
                canCreateStructure: canCreateContent && canEditContent,
                structureFieldsReady: structureFields.length > 0,
                createStructureError: Boolean(createStructureMutation.error),
                normalizedStructureFilter,
                structureMenuAnchor,
                structureMenuId,
                canEditStructure: canEditContent,
                canDeleteStructure: canDeleteContent,
                onFilterChange: setStructureFilter,
                onViewModeChange: setStructureViewMode,
                onOpenCreateStructure: openCreateStructureDialog,
                onOpenStructure: openStructure,
                onOpenStructureMenu: (anchor, structureId) => {
                    setStructureMenuAnchor(anchor)
                    setStructureMenuId(structureId)
                },
                onCloseStructureMenu: closeStructureMenu,
                onEditStructure: async (structureId) => {
                    closeStructureMenu()
                    setStructureDialogError(null)
                    const conceptSectionId = getSectionId(query.data?.concepts)
                    if (!details?.apiBaseUrl || !details.applicationId || !conceptSectionId) {
                        setStructureDialogError(t('workspace.structure.updateError', 'Failed to update structure'))
                        return
                    }
                    try {
                        const rawRecord = await fetchAppRow({
                            apiBaseUrl: details.apiBaseUrl,
                            applicationId: details.applicationId,
                            rowId: structureId,
                            objectCollectionId: conceptSectionId
                        })
                        setEditingStructureData(rawRecord)
                        setEditingStructureId(structureId)
                        setStructureDialogMode('edit')
                    } catch {
                        setStructureDialogError(t('workspace.structure.updateError', 'Failed to update structure'))
                    }
                },
                onDeleteStructure: (structureId) => {
                    closeStructureMenu()
                    setStructureDeleteError(null)
                    setStructureDeleteId(structureId)
                },
                onBackToList: backToStructureList
            }}
            splitPaneEnabled={widgetConfig.splitPane.enabled}
            structureReturnFocusId={structureReturnFocusId}
            onBackToStructureList={backToStructureList}
            details={{
                t,
                locale,
                selectedCell,
                selectedMaterial,
                cellMaterials,
                selectedMaterialId,
                openedMaterialId,
                materialBodyField,
                materialBodyValue: materialEditorInitialData[materialBodyField?.id ?? ''],
                dataGridLocaleText,
                canCreateContent,
                canEditContent,
                materialSectionId,
                isSavingMaterial: saveMaterialMetadataMutation.isPending || saveMaterialBodyMutation.isPending,
                materialEditorError: materialDialogError,
                materials,
                materialColumns: query.data?.materials.columns,
                materialTitleField: widgetConfig.materialTitleField,
                saveMaterialBodyMutation,
                actions: {
                    setMaterialDialogError,
                    setEditingMaterialId,
                    setMaterialDialogMode,
                    setSelectedMaterialId,
                    setOpenedMaterialId
                }
            }}
            dialogs={{
                t,
                locale,
                structure: {
                    mode: structureDialogMode,
                    fields: structureFields,
                    initialData: structureInitialData,
                    error: structureDialogError,
                    deleteId: structureDeleteId,
                    deleteStructure,
                    deleteError: structureDeleteError
                },
                material: {
                    mode: materialDialogMode,
                    fields: materialFields,
                    initialData: materialInitialData,
                    error: materialDialogError
                },
                cell: {
                    mode: cellDialogMode,
                    axisDialogKind,
                    fields: cellMetadataFields,
                    styleFields,
                    initialData: cellDialogInitialData,
                    axisOptions: matrixAxisOptions,
                    placement: activeCellDialogPlacement,
                    allowNewAxesInCellDialog: widgetConfig.allowNewAxesInCellDialog,
                    hideAxisLabelFields:
                        widgetConfig.matrixMode === 'hierarchicalCells' && widgetConfig.tableProjection === 'hierarchicalPath',
                    error: cellDialogError,
                    deleteId: cellDeleteId,
                    deleteCell,
                    deleteError: cellDeleteError
                },
                mutations: {
                    createStructure: createStructureMutation,
                    updateStructure: updateStructureMutation,
                    deleteStructure: deleteStructureMutation,
                    saveMaterialMetadata: saveMaterialMetadataMutation,
                    saveCell: saveCellMutation,
                    deleteCell: deleteCellMutation
                },
                actions: {
                    setStructureDialogMode,
                    setEditingStructureId: setEditingStructureIdForDialogs,
                    setStructureDialogError,
                    setStructureDeleteId,
                    setStructureDeleteError,
                    setMaterialDialogMode,
                    setEditingMaterialId,
                    setMaterialDialogError,
                    setCellDialogMode,
                    setCellDialogSourceCellId,
                    setCellDialogPlacement,
                    setAxisDialogKind,
                    setCellDialogError,
                    setCellDeleteId,
                    setCellDeleteError
                }
            }}
        />
    )
}
