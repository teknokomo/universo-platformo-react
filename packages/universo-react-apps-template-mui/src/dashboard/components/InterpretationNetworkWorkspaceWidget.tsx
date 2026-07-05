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
import { normalizeLocale } from '@universo-react/utils'
import {
    batchUpdateTabularRows,
    compensateCreatedAppRow,
    createAppRow,
    createTabularRow,
    deleteAppRow,
    deleteTabularRow,
    fetchAppData,
    fetchTabularRows,
    updateAppRow,
    updateTabularRow
} from '../../api/api'
import '../../i18n/interpretationNetwork'
import { getDataGridLocaleText } from '../../utils/getDataGridLocale'
import { useDashboardDetails } from '../DashboardDetailsContext'
import {
    buildMatrixDragPreview,
    resolveMatrixDropState,
    type MatrixDropDestination,
    type MatrixDropPlacement,
    type MatrixDropState
} from './interpretation-network/matrixDrag'
import { MatrixWorkspaceBridge } from './interpretation-network/workspace/MatrixWorkspaceBridge'
import { type StructureSummary, type StructureViewMode } from './interpretation-network/workspace/StructurePane'
import { RuntimeContextMissing, WorkspaceError, WorkspaceLoading } from './interpretation-network/workspace/WorkspaceStatus'
import { buildMatrixMenuMoves } from './interpretation-network/workspace/matrixMenuMoves'
import { WorkspaceShell } from './interpretation-network/workspace/WorkspaceShell'
import {
    buildStructureRuntimePath,
    fetchAllWorkspaceData,
    readRouteStructureId,
    readRuntimeRowVersion,
    readSubmittedText
} from './interpretation-network/workspace/workspaceRuntime'
import { buildMatrixMoveUpdates } from './interpretation-network/matrixMove'
import { buildCellCreateData, buildCellDialogInitialData, mergeCellCreateData } from './interpretation-network/matrixCellData'
import { buildMaterialEditorInitialData, buildMaterialInitialData } from './interpretation-network/materialData'
import { createStructureWithRootMatrix } from './interpretation-network/structureActions'
import {
    buildMatrixTree,
    buildMatrixPositionLabels,
    findColumn,
    findMaterialsForCell,
    flattenMatrixTree,
    getSectionId,
    isStyleColumn,
    readColumnText,
    readColumnValue,
    resolveMatrixCellId,
    toConfig,
    toFieldConfig,
    toFocusedMatrixHierarchyRows,
    toMatrixHierarchyRows,
    toMatrixRows,
    uniqueByKey,
    type RuntimeRow
} from './interpretation-network/model'

type MaterialDialogMode = 'create' | 'edit'
type CellDialogMode = 'create-child' | 'create-cell' | 'create-row' | 'edit'
type StructureDialogMode = 'create' | 'edit'

const EMPTY_MATRIX_DROP_STATE: MatrixDropState = {
    activeCellId: null,
    overCellId: null,
    placement: null,
    isValid: false,
    destination: null
}

const sortMatrixCellsByOrder = (cells: ReturnType<typeof toMatrixRows>): ReturnType<typeof toMatrixRows> =>
    [...cells].sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))

export function InterpretationNetworkWorkspaceWidget({ config }: { config?: Record<string, unknown> }) {
    const widgetConfig = useMemo(() => toConfig(config), [config])
    const details = useDashboardDetails()
    const { t, i18n } = useTranslation('interpretationNetwork')
    const queryClient = useQueryClient()
    const locale = normalizeLocale(details?.locale ?? i18n.language ?? 'en')
    const enabled = Boolean(details?.apiBaseUrl && details.applicationId)
    const applicationId = details?.applicationId
    const shellNavigate = details?.navigate

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
    const [routeStructureId, setRouteStructureId] = useState<string | null>(() => readRouteStructureId(details?.applicationId))
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
    const [cellDialogSourceCellId, setCellDialogSourceCellId] = useState<string | null>(null)
    const [cellMenuAnchor, setCellMenuAnchor] = useState<HTMLElement | null>(null)
    const [cellMenuCellId, setCellMenuCellId] = useState<string | null>(null)
    const [hierarchyLayoutOverride, setHierarchyLayoutOverride] = useState<typeof widgetConfig.hierarchyLayout | null>(null)
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

    const conceptSectionId = getSectionId(query.data?.concepts)

    const navigateToStructure = useCallback(
        (structureId: string | null, options: { replace?: boolean } = {}) => {
            const nextPath = buildStructureRuntimePath(applicationId, conceptSectionId, structureId)
            if (!nextPath || typeof window === 'undefined') return
            const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
            if (nextPath !== currentPath) {
                if (options.replace) {
                    window.history.replaceState(null, '', nextPath)
                } else if (shellNavigate) {
                    shellNavigate(nextPath)
                } else {
                    window.history.pushState(null, '', nextPath)
                }
            }
            setRouteStructureId(structureId)
        },
        [applicationId, conceptSectionId, shellNavigate]
    )

    const concepts = useMemo(() => (query.data?.concepts.rows ?? []) as RuntimeRow[], [query.data?.concepts.rows])
    const interpretations = useMemo(() => (query.data?.interpretations.rows ?? []) as RuntimeRow[], [query.data?.interpretations.rows])
    const materials = useMemo(() => (query.data?.materials.rows ?? []) as RuntimeRow[], [query.data?.materials.rows])
    const interpretationSectionId = getSectionId(query.data?.interpretations)
    const materialSectionId = getSectionId(query.data?.materials)
    const matrixColumn = findColumn(query.data?.interpretations.columns, widgetConfig.matrixField)
    const materialFields = useMemo(
        () =>
            (query.data?.materials.columns ?? [])
                .filter((column) => [widgetConfig.materialTitleField, 'Description'].includes(column.codename ?? column.field ?? ''))
                .map(toFieldConfig)
                .filter((field) => field.id),
        [query.data?.materials.columns, widgetConfig.materialTitleField]
    )
    const materialBodyField = useMemo(
        () =>
            (query.data?.materials.columns ?? [])
                .filter((column) => (column.codename ?? column.field ?? '') === 'Body')
                .map(toFieldConfig)
                .find((field) => field.id),
        [query.data?.materials.columns]
    )
    const structureFields = useMemo(
        () =>
            (query.data?.concepts.columns ?? [])
                .filter((column) =>
                    [widgetConfig.conceptNameField, widgetConfig.conceptDescriptionField].includes(column.codename ?? column.field ?? '')
                )
                .map(toFieldConfig)
                .filter((field) => field.id),
        [query.data?.concepts.columns, widgetConfig.conceptDescriptionField, widgetConfig.conceptNameField]
    )
    const styleFields = useMemo(
        () =>
            (matrixColumn?.childColumns ?? [])
                .filter(isStyleColumn)
                .map(toFieldConfig)
                .filter((field) => field.id),
        [matrixColumn?.childColumns]
    )
    const cellMetadataFields = useMemo(
        () =>
            (matrixColumn?.childColumns ?? [])
                .filter((column) => ['CellValue', 'CellDescription'].includes(column.codename ?? column.field ?? ''))
                .map(toFieldConfig)
                .filter((field) => field.id),
        [matrixColumn?.childColumns]
    )
    const selectedInterpretation = interpretations.find((row) => row.id === selectedInterpretationId)
    const selectedInterpretationConceptRef = readColumnValue(
        selectedInterpretation,
        query.data?.interpretations.columns,
        widgetConfig.interpretationParentField
    )
    const selectedConcept =
        concepts.find((row) => row.id === selectedConceptId) ??
        concepts.find((row) => typeof selectedInterpretationConceptRef === 'string' && row.id === selectedInterpretationConceptRef)
    const editingStructure = editingStructureId ? concepts.find((row) => row.id === editingStructureId) : undefined
    const matrixRowsQuery = useQuery({
        queryKey: [
            'interpretationNetworkWorkspaceMatrix',
            details?.applicationId,
            details?.currentWorkspaceId,
            selectedInterpretation?.id,
            matrixColumn?.id
        ],
        enabled: Boolean(
            details?.apiBaseUrl && details.applicationId && interpretationSectionId && selectedInterpretation?.id && matrixColumn?.id
        ),
        queryFn: async () =>
            fetchTabularRows({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                workspaceId: details?.currentWorkspaceId,
                parentRecordId: selectedInterpretation!.id,
                componentId: matrixColumn!.id!,
                objectCollectionId: interpretationSectionId!
            })
    })
    const matrixCells = useMemo(
        () => toMatrixRows(matrixRowsQuery.data?.items ?? [], matrixColumn, locale),
        [locale, matrixColumn, matrixRowsQuery.data?.items]
    )
    const matrixTree = useMemo(() => buildMatrixTree(matrixCells), [matrixCells])
    const hierarchicalMatrixCells = useMemo(() => flattenMatrixTree(matrixTree), [matrixTree])
    const effectiveHierarchyLayout = hierarchyLayoutOverride ?? widgetConfig.hierarchyLayout
    const hierarchicalMatrixRows = useMemo(
        () =>
            widgetConfig.hierarchyRowMode === 'focusedPath'
                ? toFocusedMatrixHierarchyRows(matrixTree, selectedCellId)
                : toMatrixHierarchyRows(hierarchicalMatrixCells),
        [hierarchicalMatrixCells, matrixTree, selectedCellId, widgetConfig.hierarchyRowMode]
    )
    const matrixPositionLabels = useMemo(
        () => buildMatrixPositionLabels(matrixTree, widgetConfig.positionNumbering),
        [matrixTree, widgetConfig.positionNumbering]
    )
    const rawMatrixRowsByCellId = useMemo(() => {
        const childColumns = matrixColumn?.childColumns ?? []
        return new Map(
            (matrixRowsQuery.data?.items ?? []).flatMap((row, index) => {
                if (!row || typeof row !== 'object' || Array.isArray(row)) return []
                return [[resolveMatrixCellId(row as Record<string, unknown>, childColumns, index), row] as const]
            })
        )
    }, [matrixColumn?.childColumns, matrixRowsQuery.data?.items])
    const matrixRowsSnapshotRef = useRef<{ cells: typeof matrixCells; rawRowsByCellId: typeof rawMatrixRowsByCellId }>({
        cells: [],
        rawRowsByCellId: new Map()
    })
    useEffect(() => {
        matrixRowsSnapshotRef.current = {
            cells: matrixCells,
            rawRowsByCellId: rawMatrixRowsByCellId
        }
    }, [matrixCells, rawMatrixRowsByCellId])
    const selectedCell = selectedInterpretation ? matrixCells.find((cell) => cell.id === selectedCellId) : undefined
    const selectedRawCell = selectedCell ? rawMatrixRowsByCellId.get(selectedCell.id) : undefined
    const cellDialogSourceCell =
        selectedInterpretation && cellDialogSourceCellId ? matrixCells.find((cell) => cell.id === cellDialogSourceCellId) : selectedCell
    const cellDialogSourceRawCell = cellDialogSourceCell ? rawMatrixRowsByCellId.get(cellDialogSourceCell.id) : selectedRawCell
    const menuCell = selectedInterpretation ? matrixCells.find((cell) => cell.id === cellMenuCellId) : undefined
    const deleteCell = selectedInterpretation ? matrixCells.find((cell) => cell.id === cellDeleteId) : undefined
    const deleteRawCell = deleteCell ? rawMatrixRowsByCellId.get(deleteCell.id) : undefined
    const rootCellId =
        widgetConfig.matrixMode === 'hierarchicalCells'
            ? [...matrixCells]
                  .filter((cell) => cell.parentCellId === null)
                  .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))[0]?.id ?? null
            : null
    const cellMaterials = findMaterialsForCell(
        materials,
        query.data?.materials.columns,
        selectedCell?.id,
        selectedCell?.materialRef ?? null
    )
    const selectedMaterial =
        openedMaterialId && cellMaterials.some((material) => material.id === openedMaterialId)
            ? cellMaterials.find((material) => material.id === openedMaterialId)
            : undefined
    const editingMaterial = editingMaterialId
        ? cellMaterials.find((material) => material.id === editingMaterialId) ??
          materials.find((material) => material.id === editingMaterialId)
        : undefined
    const materialInitialData = useMemo(
        () => buildMaterialInitialData(materialFields, materialDialogMode, editingMaterial),
        [editingMaterial, materialDialogMode, materialFields]
    )
    const structureInitialData = useMemo(
        () =>
            Object.fromEntries(
                structureFields.map((field) => [field.id, structureDialogMode === 'edit' ? editingStructure?.[field.id] : undefined])
            ),
        [editingStructure, structureDialogMode, structureFields]
    )
    const materialEditorInitialData = useMemo(
        () => buildMaterialEditorInitialData(materialBodyField, selectedMaterial),
        [materialBodyField, selectedMaterial]
    )

    const newRowLabel = t('workspace.defaults.newRow', 'New row')
    const newCellLabel = t('workspace.defaults.newCell', 'New cell')
    const cellDialogInitialData = useMemo(
        () =>
            buildCellDialogInitialData({
                mode: cellDialogMode,
                cellMetadataFields,
                styleFields,
                childColumns: matrixColumn?.childColumns,
                locale,
                selectedCell: cellDialogSourceCell,
                selectedRawCell: cellDialogSourceRawCell,
                newRowLabel,
                newCellLabel
            }),
        [
            cellDialogMode,
            cellMetadataFields,
            locale,
            matrixColumn?.childColumns,
            newCellLabel,
            newRowLabel,
            cellDialogSourceCell,
            cellDialogSourceRawCell,
            styleFields
        ]
    )
    const rows = useMemo(() => (selectedInterpretation ? uniqueByKey(matrixCells, 'rowKey') : []), [matrixCells, selectedInterpretation])
    const dataGridLocaleText = useMemo(() => getDataGridLocaleText(locale), [locale])
    const interpretationsByConcept = useMemo(() => {
        const byConcept = new Map<string, RuntimeRow[]>()
        for (const interpretation of interpretations) {
            const parentStructure = readColumnValue(
                interpretation,
                query.data?.interpretations.columns,
                widgetConfig.interpretationParentField
            )
            const conceptId = typeof parentStructure === 'string' ? parentStructure : ''
            byConcept.set(conceptId, [...(byConcept.get(conceptId) ?? []), interpretation])
        }
        return byConcept
    }, [interpretations, query.data?.interpretations.columns, widgetConfig.interpretationParentField])
    const structureSummaries = useMemo<StructureSummary[]>(
        () =>
            concepts.map((concept) => {
                const childInterpretations = interpretationsByConcept.get(concept.id) ?? []
                return {
                    id: concept.id,
                    row: concept,
                    title:
                        readColumnText(concept, query.data?.concepts.columns, widgetConfig.conceptNameField, locale) ||
                        t('workspace.untitledConcept', 'Untitled concept'),
                    description: readColumnText(concept, query.data?.concepts.columns, widgetConfig.conceptDescriptionField, locale),
                    interpretationId: childInterpretations[0]?.id ?? null
                }
            }),
        [
            concepts,
            interpretationsByConcept,
            locale,
            query.data?.concepts.columns,
            t,
            widgetConfig.conceptDescriptionField,
            widgetConfig.conceptNameField
        ]
    )
    const normalizedStructureFilter = structureFilter.trim().toLowerCase()
    const filteredStructures = useMemo(
        () =>
            normalizedStructureFilter
                ? structureSummaries.filter((structure) =>
                      [structure.title, structure.description].some((value) => value.toLowerCase().includes(normalizedStructureFilter))
                  )
                : structureSummaries,
        [normalizedStructureFilter, structureSummaries]
    )
    const matrixRows = useMemo(
        () =>
            rows.map((row) => ({
                ...row,
                cells: sortMatrixCellsByOrder(matrixCells.filter((cell) => cell.rowKey === row.rowKey))
            })),
        [matrixCells, rows]
    )
    const visibleMatrixCells = useMemo(
        () => (widgetConfig.matrixMode === 'hierarchicalCells' ? hierarchicalMatrixRows.flatMap((row) => row) : matrixCells),
        [hierarchicalMatrixRows, matrixCells, widgetConfig.matrixMode]
    )
    const matrixCellIds = useMemo(() => visibleMatrixCells.map((cell) => cell.id), [visibleMatrixCells])
    const matrixDragPreview = useMemo(
        () =>
            widgetConfig.matrixMode === 'hierarchicalCells'
                ? buildMatrixDragPreview(matrixCells, matrixDropState, {
                      hierarchyRowMode: widgetConfig.hierarchyRowMode,
                      selectedCellId
                  })
                : null,
        [matrixCells, matrixDropState, selectedCellId, widgetConfig.hierarchyRowMode, widgetConfig.matrixMode]
    )
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
        const handlePopState = () => {
            setRouteStructureId(readRouteStructureId(details?.applicationId))
        }

        handlePopState()
        if (typeof window === 'undefined') return undefined
        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [details?.applicationId])

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
            if (mode === 'edit') {
                if (!cellDialogSourceRawCell?.id) throw new Error('cell-not-selected')
                const saved = await updateTabularRow({
                    apiBaseUrl: details.apiBaseUrl,
                    applicationId: details.applicationId,
                    workspaceId: details.currentWorkspaceId,
                    parentRecordId: selectedInterpretation.id,
                    componentId: matrixColumn.id,
                    objectCollectionId: interpretationSectionId,
                    childRowId: cellDialogSourceRawCell.id,
                    data,
                    expectedVersion: readRuntimeRowVersion(cellDialogSourceRawCell)
                })
                return { saved, selectedCellIdAfterSave: cellDialogSourceCell?.id ?? null }
            }

            const source = cellDialogSourceCell
            const baseData = buildCellCreateData({
                mode,
                childColumns: matrixColumn.childColumns,
                locale: normalizedLocale,
                source,
                existingCells: matrixRowsSnapshotRef.current.cells,
                newRowLabel,
                newCellLabel
            })
            const saved = await createTabularRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                parentRecordId: selectedInterpretation.id,
                componentId: matrixColumn.id,
                objectCollectionId: interpretationSectionId,
                data: mergeCellCreateData(data, baseData)
            })
            const createdRow = saved && typeof saved === 'object' && saved.item && typeof saved.item === 'object' ? saved.item : saved
            const rawPersistedCellId = readColumnValue(createdRow as Record<string, unknown>, matrixColumn.childColumns, 'CellId')
            const persistedCellId = typeof rawPersistedCellId === 'string' ? rawPersistedCellId.trim() : ''
            const generatedCellId = persistedCellId || (typeof baseData.CellId === 'string' ? baseData.CellId.trim() : '')
            return {
                saved,
                generatedCellId,
                selectedCellIdAfterSave: mode === 'create-child' ? source?.id ?? null : null,
                pendingSelectedCellId: generatedCellId
            }
        },
        onSuccess: async (result) => {
            setCellDialogMode(null)
            setCellDialogSourceCellId(null)
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
                hierarchyLayout: effectiveHierarchyLayout,
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
            return resolveMatrixDropState({
                mode: widgetConfig.matrixMode,
                cells: matrixRowsSnapshotRef.current.cells,
                cellIds: matrixCellIds,
                sourceCellId,
                targetCellId,
                translatedRect: event?.active.rect.current.translated,
                targetRect: event?.over?.rect,
                hierarchyLayout: effectiveHierarchyLayout
            })
        },
        [effectiveHierarchyLayout, matrixCellIds, widgetConfig.matrixMode]
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
            const material = await createAppRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                objectCollectionId: materialSectionId,
                data: { ...data, CellId: selectedCell?.id ?? null }
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
                    data: { MaterialRef: material.id },
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
                childRowId: deleteRawCell.id
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
    const openCellDialog = (mode: CellDialogMode, cellId?: string) => {
        if (cellId) setSelectedCellId(cellId)
        setCellDialogSourceCellId(cellId ?? selectedCellId)
        setCellDialogError(null)
        setCellDialogMode(mode)
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
    const matrixWorkspace = selectedInterpretation ? (
        <MatrixWorkspaceBridge
            t={t}
            locale={locale}
            mode={widgetConfig.matrixMode}
            hierarchyLayout={effectiveHierarchyLayout}
            hierarchyRows={hierarchicalMatrixRows}
            positionLabels={matrixPositionLabels}
            cells={matrixCells}
            visibleCells={visibleMatrixCells}
            rows={matrixRows}
            cellIds={matrixCellIds}
            selectedCell={selectedCell}
            dropState={matrixDropState}
            dragPreview={matrixDragPreview}
            disabled={matrixMutationsDisabled}
            savingCell={saveCellMutation.isPending}
            movingCell={moveCellMutation.isPending}
            errors={{ rows: matrixRowsQuery.error, saveCell: saveCellMutation.error, moveCell: moveCellMutation.error }}
            permissions={{ canEditContent, canDeleteContent }}
            menu={{ anchor: cellMenuAnchor, cell: menuCell, moves: menuMoves }}
            deletingCell={deleteCellMutation.isPending}
            sensors={sensors}
            onChangeHierarchyLayout={setHierarchyLayoutOverride}
            actions={{
                openCellDialog,
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
            }}
        />
    ) : null

    return (
        <WorkspaceShell
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
                matrixWorkspace,
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
                    fields: cellMetadataFields,
                    styleFields,
                    initialData: cellDialogInitialData,
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
                    setCellDialogError,
                    setCellDeleteId,
                    setCellDeleteError
                }
            }}
        />
    )
}

export default InterpretationNetworkWorkspaceWidget
