import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragMoveEvent,
    type DragOverEvent,
    type DragStartEvent
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { createLocalizedContent, normalizeLocale } from '@universo-react/utils'
import {
    batchUpdateTabularRows,
    compensateCreatedAppRow,
    createAppRow,
    createTabularRow,
    deleteAppRow,
    deleteTabularRow,
    fetchAppData,
    updateAppRow,
    updateTabularRow
} from '../../api/api'
import '../../i18n/interpretationNetwork'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { formatRuntimeSafeValue } from '../../utils/displayValue'
import {
    resolveMatrixDropState,
    type MatrixDropDestination,
    type MatrixDropPlacement,
    type MatrixDropState
} from './interpretation-network/matrixDrag'
import { type StructureSummary, type StructureViewMode } from './interpretation-network/workspace/StructurePane'
import { RuntimeContextMissing, WorkspaceError, WorkspaceLoading } from './interpretation-network/workspace/WorkspaceStatus'
import { buildMatrixMenuMoves } from './interpretation-network/workspace/matrixMenuMoves'
import { InterpretationNetworkWorkspaceContent } from './interpretation-network/workspace/InterpretationNetworkWorkspaceContent'
import { useInterpretationNetworkWorkspaceState } from './interpretation-network/workspace/useInterpretationNetworkWorkspaceState'
import { useStructureRoute } from './interpretation-network/workspace/useStructureRoute'
import {
    EMPTY_MATRIX_DROP_STATE,
    type CellDialogMode,
    type MatrixAxisDialogKind,
    type MaterialDialogMode,
    type StructureDialogMode
} from './interpretation-network/workspace/workspaceState'
import { fetchAllWorkspaceData, readRuntimeRowVersion, readSubmittedText } from './interpretation-network/workspace/workspaceRuntime'
import { buildMatrixMoveUpdates } from './interpretation-network/matrixMove'
import {
    buildCellCreateData,
    MATRIX_CELL_PLACEMENT_FIELD,
    mergeCellCreateData,
    readMatrixCellPlacement,
    resolveCellCreateSystemFields,
    type MatrixCellPlacement
} from './interpretation-network/matrixCellData'
import { createStructureWithRootMatrix } from './interpretation-network/structureActions'
import {
    findColumn,
    getSectionId,
    readColumnValue,
    toMatrixTableSlotId,
    toConfig,
    type MatrixView,
    type MatrixTableDropSlot
} from './interpretation-network/model'

export default function InterpretationNetworkWorkspaceWidget({ config }: { config?: Record<string, unknown> }) {
    const widgetConfig = useMemo(() => toConfig(config), [config])
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

    const [selectedInterpretationId, setSelectedInterpretationId] = useState<string | null>(null)
    const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null)
    const [selectedCellId, setSelectedCellId] = useState<string | null>(null)
    const [pendingSelectedCellId, setPendingSelectedCellId] = useState<string | null>(null)
    const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null)
    const [openedMaterialId, setOpenedMaterialId] = useState<string | null>(null)
    const [structureDialogMode, setStructureDialogMode] = useState<StructureDialogMode | null>(null)
    const [editingStructureId, setEditingStructureId] = useState<string | null>(null)
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
    const canCreateContent = details?.permissions?.createContent === true
    const canEditContent = details?.permissions?.editContent === true
    const canDeleteContent = details?.permissions?.deleteContent === true

    const { routeStructureId, navigateToStructure } = useStructureRoute({
        applicationId: details?.applicationId,
        conceptSectionId: getSectionId(query.data?.concepts),
        navigate: details?.navigate
    })

    const workspaceState = useInterpretationNetworkWorkspaceState({
        data: query.data,
        details,
        locale,
        widgetConfig,
        selectedInterpretationId,
        selectedConceptId,
        selectedCellId,
        openedMaterialId,
        editingStructureId,
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
        matrixPositionLabels,
        effectiveMatrixView,
        matrixRowsSnapshotRef,
        selectedCell,
        selectedRawCell,
        cellDialogSourceCell,
        cellDialogSourceRawCell,
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
    const pendingMoveKeyRef = useRef<string | null>(null)
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    useEffect(() => {
        if (selectedInterpretationId && !interpretations.some((row) => row.id === selectedInterpretationId)) {
            setSelectedInterpretationId(null)
            setSelectedCellId(null)
        }
    }, [interpretations, selectedInterpretationId])

    useEffect(() => {
        if (selectedConceptId && !concepts.some((row) => row.id === selectedConceptId)) {
            setSelectedConceptId(null)
            setSelectedInterpretationId(null)
            setSelectedCellId(null)
        }
    }, [concepts, selectedConceptId])

    useEffect(() => {
        if (query.isLoading || query.isFetching) return
        if (!routeStructureId) {
            if (selectedConceptId) {
                setSelectedConceptId(null)
                setSelectedInterpretationId(null)
                setSelectedCellId(null)
                setSelectedMaterialId(null)
                setOpenedMaterialId(null)
            }
            return
        }

        const routeStructure = structureSummaries.find((structure) => structure.id === routeStructureId)
        if (!routeStructure) {
            setSelectedConceptId(null)
            setSelectedInterpretationId(null)
            setSelectedCellId(null)
            setSelectedMaterialId(null)
            setOpenedMaterialId(null)
            return
        }
        if (selectedConceptId === routeStructure.id && selectedInterpretationId === routeStructure.interpretationId) return

        setSelectedConceptId(routeStructure.id)
        setSelectedInterpretationId(routeStructure.interpretationId)
        setSelectedCellId(null)
        setSelectedMaterialId(null)
        setOpenedMaterialId(null)
        setMaterialDialogMode(null)
        setEditingMaterialId(null)
    }, [query.isFetching, query.isLoading, routeStructureId, selectedConceptId, selectedInterpretationId, structureSummaries])

    useEffect(() => {
        if (pendingSelectedCellId && matrixCells.some((cell) => cell.id === pendingSelectedCellId)) {
            setSelectedCellId(pendingSelectedCellId)
            setPendingSelectedCellId(null)
        }
    }, [matrixCells, pendingSelectedCellId])

    useEffect(() => {
        if (selectedCellId && !matrixCells.some((cell) => cell.id === selectedCellId)) {
            setSelectedCellId(null)
        }
    }, [matrixCells, selectedCellId])

    useEffect(() => {
        if (!selectedCell) {
            setSelectedMaterialId(null)
            setOpenedMaterialId(null)
            setEditingMaterialId(null)
            setMaterialDialogMode(null)
            return
        }
        if (selectedMaterialId && cellMaterials.some((material) => material.id === selectedMaterialId)) return
        setSelectedMaterialId(cellMaterials[0]?.id ?? null)
    }, [cellMaterials, selectedCell, selectedMaterialId])
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
            setEditingStructureId(null)
            setStructureDialogError(null)
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspace'] })
            let createdConceptId: string | null = null
            if (created?.concept && typeof created.concept.id === 'string') {
                createdConceptId = created.concept.id
                setSelectedConceptId(createdConceptId)
            }
            if (created?.interpretation && typeof created.interpretation.id === 'string') {
                setSelectedInterpretationId(created.interpretation.id)
                setSelectedCellId(null)
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
            setEditingStructureId(null)
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
                setSelectedCellId(null)
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
            if (mode === 'edit') {
                if (!cellDialogSourceRawCell?.id) throw new Error('cell-not-selected')
                const sourceCell = cellDialogSourceCell
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
                    const previousValue = cellDialogSourceRawCell[field] ?? cellDialogSourceRawCell[fallbackField]
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
                            childRowId: cellDialogSourceRawCell.id,
                            data: submittedData,
                            expectedVersion: readRuntimeRowVersion(cellDialogSourceRawCell)
                        }
                    ],
                    uniformUpdates
                })
                return { saved, selectedCellIdAfterSave: cellDialogSourceCell?.id ?? null }
            }

            const source = cellDialogSourceCell
            const placement = readMatrixCellPlacement(data) ?? activeCellDialogPlacement ?? undefined
            if (typeof axisName === 'string' && axisName.trim()) {
                const titleField = findColumn(matrixColumn.childColumns, 'CellValue')?.field ?? 'CellValue'
                submittedData[titleField] = createLocalizedContent(normalizedLocale, axisName.trim())
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
                    setSelectedCellId(rawCellId.trim())
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
    const effectiveMoveHierarchyLayout = effectiveMatrixView === 'verticalTree' ? 'verticalTree' : 'horizontalRows'
    const moveCellMutation = useMutation({
        mutationFn: async ({
            sourceCellId,
            targetCellId,
            placement = 'after',
            destination
        }: {
            sourceCellId: string
            targetCellId: string
            placement?: MatrixDropPlacement
            destination?: MatrixDropDestination
        }) => {
            if (!canEditContent) throw new Error('permission-denied')
            if (
                !details?.apiBaseUrl ||
                !details.applicationId ||
                !interpretationSectionId ||
                !selectedInterpretation?.id ||
                !matrixColumn?.id ||
                sourceCellId === targetCellId
            ) {
                return null
            }
            const { cells: currentMatrixCells, rawRowsByCellId: currentRawMatrixRowsByCellId } = matrixRowsSnapshotRef.current
            const movePlan = buildMatrixMoveUpdates({
                mode: widgetConfig.matrixMode,
                sourceCellId,
                targetCellId,
                placement,
                cells: currentMatrixCells,
                rawRowsByCellId: currentRawMatrixRowsByCellId,
                childColumns: matrixColumn.childColumns,
                locale,
                readRuntimeRowVersion,
                readSubmittedText,
                hierarchyLayout: effectiveMoveHierarchyLayout,
                destination
            })
            if (!movePlan) return null

            await batchUpdateTabularRows({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                parentRecordId: selectedInterpretation.id,
                componentId: matrixColumn.id,
                objectCollectionId: interpretationSectionId,
                updates: movePlan.updates
            })
            return { selectedCellIdAfterMove: movePlan.selectedCellIdAfterMove }
        },
        onSuccess: async (result) => {
            if (result?.selectedCellIdAfterMove) {
                setSelectedCellId(result.selectedCellIdAfterMove)
            }
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
        },
        onSettled: async () => {
            pendingMoveKeyRef.current = null
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
        }
    })

    const handleMoveCell = useCallback(
        (sourceCellId: string, targetCellId: string, placement: MatrixDropPlacement = 'after', destination?: MatrixDropDestination) => {
            if (!sourceCellId || !targetCellId || sourceCellId === targetCellId) return
            if (matrixMutationsDisabled || moveCellMutation.isPending) return
            const moveKey = `${sourceCellId}:${targetCellId}:${placement}`
            if (pendingMoveKeyRef.current === moveKey) return
            pendingMoveKeyRef.current = moveKey
            moveCellMutation.mutate({ sourceCellId, targetCellId, placement, destination })
        },
        [matrixMutationsDisabled, moveCellMutation]
    )
    const calculateDropState = useCallback(
        (sourceCellId: string, targetCellId: string | null, event?: Pick<DragOverEvent, 'active' | 'over'>): MatrixDropState => {
            const activeCellIds = effectiveMatrixView === 'table' ? visibleMatrixCells.map((cell) => cell.id) : matrixCellIds
            return resolveMatrixDropState({
                mode: widgetConfig.matrixMode,
                cells: matrixRowsSnapshotRef.current.cells,
                cellIds: activeCellIds,
                sourceCellId,
                targetCellId,
                translatedRect: event?.active.rect.current.translated,
                targetRect: event?.over?.rect,
                hierarchyLayout: effectiveMoveHierarchyLayout,
                tableSlot: event?.over?.data.current?.matrixTableSlot as MatrixTableDropSlot | undefined
            })
        },
        [
            effectiveMoveHierarchyLayout,
            effectiveMatrixView,
            matrixCellIds,
            matrixRowsSnapshotRef,
            visibleMatrixCells,
            widgetConfig.matrixMode
        ]
    )
    const handleMatrixDragStart = useCallback((event: DragStartEvent) => {
        const sourceCellId = typeof event.active.id === 'string' ? event.active.id : String(event.active.id)
        setMatrixDropState({ activeCellId: sourceCellId, overCellId: null, placement: null, isValid: false, destination: null })
    }, [])
    const handleMatrixDragMove = useCallback(
        (event: DragMoveEvent) => {
            const sourceCellId = typeof event.active.id === 'string' ? event.active.id : String(event.active.id)
            const targetCellId = event.over ? (typeof event.over.id === 'string' ? event.over.id : String(event.over.id)) : null
            setMatrixDropState(calculateDropState(sourceCellId, targetCellId, event))
        },
        [calculateDropState]
    )
    const handleMatrixDragOver = useCallback(
        (event: DragOverEvent) => {
            const sourceCellId = typeof event.active.id === 'string' ? event.active.id : String(event.active.id)
            const targetCellId = event.over ? (typeof event.over.id === 'string' ? event.over.id : String(event.over.id)) : null
            setMatrixDropState(calculateDropState(sourceCellId, targetCellId, event))
        },
        [calculateDropState]
    )
    const handleMatrixDragCancel = useCallback(() => {
        setMatrixDropState(EMPTY_MATRIX_DROP_STATE)
    }, [])
    const handleMatrixDragEnd = useCallback(
        (event: DragEndEvent) => {
            const sourceCellId = typeof event.active.id === 'string' ? event.active.id : String(event.active.id)
            const targetCellId = event.over ? (typeof event.over.id === 'string' ? event.over.id : String(event.over.id)) : null
            const dropState = calculateDropState(sourceCellId, targetCellId, event)
            setMatrixDropState(EMPTY_MATRIX_DROP_STATE)
            if (!dropState.overCellId || !dropState.placement || !dropState.isValid) return
            handleMoveCell(sourceCellId, dropState.overCellId, dropState.placement, dropState.destination ?? undefined)
        },
        [calculateDropState, handleMoveCell]
    )
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
                setSelectedCellId(null)
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
        setSelectedConceptId(structure.id)
        setSelectedInterpretationId(structure.interpretationId)
        setSelectedCellId(null)
        setSelectedMaterialId(null)
        setOpenedMaterialId(null)
        setMaterialDialogMode(null)
        setEditingMaterialId(null)
        navigateToStructure(structure.id)
    }
    const backToStructureList = () => {
        setSelectedConceptId(null)
        setSelectedInterpretationId(null)
        setSelectedCellId(null)
        setSelectedMaterialId(null)
        setOpenedMaterialId(null)
        navigateToStructure(null)
    }
    const openCreateStructureDialog = () => {
        setStructureDialogError(null)
        setEditingStructureId(null)
        setStructureDialogMode('create')
    }
    const openCellDialog = (mode: CellDialogMode, cellId?: string, placement?: MatrixCellPlacement) => {
        const sourceCellId = cellId ?? selectedCellId
        const sourceCell = sourceCellId ? matrixCells.find((cell) => cell.id === sourceCellId) : undefined
        const defaultPlacement: MatrixCellPlacement | null =
            placement ??
            (sourceCell && mode === 'create-cell'
                ? {
                      row: {
                          kind: 'existing',
                          option: {
                              key: sourceCell.rowKey,
                              label: sourceCell.rowLabel,
                              labelValue: sourceCell.rowLabelValue
                          }
                      }
                  }
                : sourceCell && mode === 'create-row'
                ? {
                      column: {
                          kind: 'existing',
                          option: {
                              key: sourceCell.colKey,
                              label: sourceCell.colLabel,
                              labelValue: sourceCell.colLabelValue
                          }
                      }
                  }
                : widgetConfig.matrixMode === 'independentRows' &&
                  effectiveMatrixView !== 'table' &&
                  (widgetConfig.allowNewAxesInCellDialog || matrixCells.length === 0) &&
                  mode === 'create-cell'
                ? {
                      row: { kind: 'new' as const, label: '' },
                      column: { kind: 'new' as const, label: '' }
                  }
                : mode === 'create-child'
                ? {
                      row: { kind: 'new' as const, label: '' },
                      column: { kind: 'new' as const, label: '' },
                      parentCellId: sourceCellId ?? null
                  }
                : null)
        if (cellId) setSelectedCellId(cellId)
        setCellDialogSourceCellId(sourceCellId)
        setCellDialogPlacement(defaultPlacement)
        setCellDialogError(null)
        setCellDialogMode(mode)
    }
    const openTableAxisDialog = (axis: 'row' | 'column') => {
        const sourceCell = selectedCell ?? visibleMatrixCells[0] ?? matrixCells[0]
        if (!sourceCell) return
        const parentCellId = widgetConfig.matrixMode === 'hierarchicalCells' ? sourceCell.id : null
        setSelectedCellId(sourceCell.id)
        setCellDialogSourceCellId(sourceCell.id)
        setCellDialogPlacement({
            parentCellId,
            ...(axis === 'column'
                ? {
                      row: {
                          kind: 'existing' as const,
                          option: {
                              key: sourceCell.rowKey,
                              label: sourceCell.rowLabel,
                              labelValue: sourceCell.rowLabelValue
                          }
                      }
                  }
                : {
                      row: {
                          kind: 'new' as const,
                          label: ''
                      }
                  }),
            ...(axis === 'row'
                ? {
                      column: {
                          kind: 'existing' as const,
                          option: {
                              key: sourceCell.colKey,
                              label: sourceCell.colLabel,
                              labelValue: sourceCell.colLabelValue
                          }
                      }
                  }
                : {
                      column: {
                          kind: 'new' as const,
                          label: ''
                      }
                  })
        })
        setCellDialogError(null)
        setCellDialogMode(widgetConfig.matrixMode === 'hierarchicalCells' ? 'create-child' : axis === 'row' ? 'create-row' : 'create-cell')
        setAxisDialogKind(axis)
    }
    const moveSelectedToTableSlot = (slot: MatrixTableDropSlot) => {
        if (!selectedCell) {
            setCellDialogError(t('workspace.table.selectCellBeforeMove', 'Select a cell before moving it into an empty table position.'))
            return
        }
        setCellDialogError(null)
        const targetCellId = toMatrixTableSlotId(slot)
        handleMoveCell(selectedCell.id, targetCellId, 'child', {
            placement: 'child',
            targetCellId,
            parentCellId: widgetConfig.matrixMode === 'hierarchicalCells' ? selectedCell.parentCellId ?? null : null,
            insertionIndex: 0,
            tableSlot: slot
        })
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
                          hierarchyRows: hierarchicalMatrixRows,
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
                              selectCell: setSelectedCellId,
                              openCellMenu: (anchor, cellId) => {
                                  setCellMenuAnchor(anchor)
                                  setCellMenuCellId(cellId)
                              },
                              closeCellMenu,
                              requestDeleteCell: (cellId) => {
                                  setCellDeleteError(null)
                                  setCellDeleteId(cellId)
                              },
                              dragStart: handleMatrixDragStart,
                              dragMove: handleMatrixDragMove,
                              dragOver: handleMatrixDragOver,
                              dragCancel: handleMatrixDragCancel,
                              dragEnd: handleMatrixDragEnd
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
                onEditStructure: (structureId) => {
                    closeStructureMenu()
                    setStructureDialogError(null)
                    setEditingStructureId(structureId)
                    setStructureDialogMode('edit')
                },
                onDeleteStructure: (structureId) => {
                    closeStructureMenu()
                    setStructureDeleteError(null)
                    setStructureDeleteId(structureId)
                },
                onBackToList: backToStructureList
            }}
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
                    setEditingStructureId,
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
