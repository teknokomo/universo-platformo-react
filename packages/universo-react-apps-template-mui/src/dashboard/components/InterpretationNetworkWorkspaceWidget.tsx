import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTheme } from '@mui/material/styles'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { normalizeLocale } from '@universo-react/utils'
import { fetchAppData, fetchAppRow, updateAppRow } from '../../api/api'
import {
    createInterpretationNetworkMaterial,
    deleteInterpretationNetworkStructure,
    ensureInterpretationNetworkSystemStructure
} from '../../api/interpretationNetwork'
import '../../i18n/interpretationNetwork'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { type MatrixDropState } from './interpretation-network/matrixDrag'
import { type StructureViewMode } from './interpretation-network/workspace/StructurePane'
import { RuntimeContextMissing, WorkspaceError, WorkspaceLoading } from './interpretation-network/workspace/WorkspaceStatus'
import { buildMatrixMenuMoves } from './interpretation-network/workspace/matrixMenuMoves'
import {
    InterpretationNetworkWorkspaceView,
    type InterpretationNetworkWorkspaceViewProps
} from './interpretation-network/workspace/InterpretationNetworkWorkspaceView'
import { useCellDialogActions } from './interpretation-network/workspace/useCellDialogActions'
import { useCellMutations } from './interpretation-network/workspace/useCellMutations'
import { useInterpretationNetworkWorkspaceState } from './interpretation-network/workspace/useInterpretationNetworkWorkspaceState'
import { useMatrixRouteSelectionSync } from './interpretation-network/workspace/useMatrixRouteSelectionSync'
import { useMatrixWorkspaceActions } from './interpretation-network/workspace/useMatrixWorkspaceActions'
import { useStructureRoute } from './interpretation-network/workspace/useStructureRoute'
import { useInterpretationNetworkTemplateCommands } from './interpretation-network/workspace/useInterpretationNetworkTemplateCommands'
import { useRuntimeSelectionActions } from './interpretation-network/workspace/useRuntimeSelectionActions'
import { useStructureMutations } from './interpretation-network/workspace/useStructureMutations'
import {
    EMPTY_MATRIX_DROP_STATE,
    type CellDialogMode,
    type MatrixAxisDialogKind,
    type MaterialDialogMode,
    type StructureDialogMode
} from './interpretation-network/workspace/workspaceState'
import {
    fetchAllWorkspaceData,
    fetchSingleWorkspaceRowData,
    readRuntimeRowVersion,
    readSubmittedText
} from './interpretation-network/workspace/workspaceRuntime'
import { hasRouteStructureId } from './interpretation-network/workspace/workspaceRuntime'
import { type MatrixCellPlacement } from './interpretation-network/matrixCellData'
import { getSectionId, toConfig, type MatrixView } from './interpretation-network/model'

export default function InterpretationNetworkWorkspaceWidget({
    config,
    widgetId,
    layoutId
}: {
    config?: Record<string, unknown>
    widgetId?: string | null
    layoutId?: string | null
}) {
    const widgetConfig = useMemo(() => toConfig(config), [config])
    const singleSystemMode = widgetConfig.structureMode === 'singleSystem'
    const fallbackInstanceId = useId()
    const a11yIdPrefix = useMemo(() => {
        const instanceKey = [layoutId, widgetId]
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .join('-')
        const safeInstanceKey = (instanceKey || fallbackInstanceId).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
        return `interpretation-network-${safeInstanceKey || 'workspace'}`
    }, [fallbackInstanceId, layoutId, widgetId])
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
                locale,
                widgetId,
                layoutId
            }
            const [concepts, interpretations, materials] = singleSystemMode
                ? await (async () => {
                      const systemConcepts = await fetchSingleWorkspaceRowData(
                          fetchAppData,
                          { ...base, objectCollectionCodename: widgetConfig.conceptCodename },
                          [{ field: 'SystemKey', operator: 'equals', value: 'primary' }]
                      )
                      const systemStructureId = systemConcepts.rows[0]?.id
                      const [systemInterpretations, systemMaterials] = await Promise.all([
                          fetchSingleWorkspaceRowData(
                              fetchAppData,
                              { ...base, objectCollectionCodename: widgetConfig.interpretationCodename },
                              [
                                  {
                                      field: widgetConfig.interpretationParentField,
                                      operator: 'equals',
                                      value: systemStructureId ?? '00000000-0000-0000-0000-000000000000'
                                  }
                              ]
                          ),
                          fetchAllWorkspaceData(fetchAppData, { ...base, objectCollectionCodename: widgetConfig.materialCodename })
                      ])
                      return [systemConcepts, systemInterpretations, systemMaterials] as const
                  })()
                : await Promise.all([
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
    const [structureListTab, setStructureListTab] = useState<'structures' | 'templates'>('structures')
    const [structureDetailTab, setStructureDetailTab] = useState<'matrix' | 'templates'>('matrix')
    const [structureDeleteError, setStructureDeleteError] = useState<string | null>(null)
    const [materialDialogError, setMaterialDialogError] = useState<string | null>(null)
    const [cellDialogError, setCellDialogError] = useState<string | null>(null)
    const [cellDeleteError, setCellDeleteError] = useState<string | null>(null)
    const [structureReturnFocusId, setStructureReturnFocusId] = useState<string | null>(null)
    const canCreateContent = details?.permissions?.createContent === true
    const canEditContent = details?.permissions?.editContent === true
    const canDeleteContent = details?.permissions?.deleteContent === true
    const closeStructureMenu = useCallback(() => {
        setStructureMenuAnchor(null)
        setStructureMenuId(null)
    }, [])

    useEffect(() => {
        if (!widgetConfig.templatePanel.showInStructureList) {
            setStructureListTab((current) => (current === 'templates' ? 'structures' : current))
        }
        if (!widgetConfig.templatePanel.showInMatrix) {
            setStructureDetailTab((current) => (current === 'templates' ? 'matrix' : current))
        }
    }, [widgetConfig.templatePanel.showInMatrix, widgetConfig.templatePanel.showInStructureList])

    const { routeStructureId, routeCellId, navigateToStructure, navigateToCell } = useStructureRoute({
        applicationId: details?.applicationId,
        conceptSectionId: getSectionId(query.data?.concepts),
        navigate: details?.navigate,
        singleMode: singleSystemMode
    })

    const handleEnsureSystemStructureSuccess = useCallback(
        async (result: { structureId: string; interpretationId: string; rootCellId: string }) => {
            const refreshed = await query.refetch()
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
            setSelectedConceptId(result.structureId)
            setSelectedInterpretationId(result.interpretationId)
            if (routeCellId) {
                setPendingSelectedCellId(routeCellId)
            } else {
                const systemInterpretation =
                    refreshed.data?.interpretations.rows.find((row) => row.id === result.interpretationId) ??
                    query.data?.interpretations.rows.find((row) => row.id === result.interpretationId)
                const rootCellId = result.rootCellId.trim()
                if (systemInterpretation && rootCellId) {
                    setPendingSelectedCellId(rootCellId)
                }
            }
        },
        [query, queryClient, routeCellId]
    )

    const ensureSystemStructureMutation = useMutation({
        mutationFn: () =>
            ensureInterpretationNetworkSystemStructure({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                workspaceId: details?.currentWorkspaceId,
                locale,
                widgetId,
                layoutId
            }),
        onSuccess: handleEnsureSystemStructureSuccess
    })
    const ensureSystemStructureRef = useRef(ensureSystemStructureMutation.mutate)

    useEffect(() => {
        ensureSystemStructureRef.current = ensureSystemStructureMutation.mutate
    }, [ensureSystemStructureMutation.mutate])
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
    const {
        templatesQuery,
        templateDialogMode,
        setTemplateDialogMode,
        structureCreateSource,
        setStructureCreateSource,
        structureCreateTemplateId,
        setStructureCreateTemplateId,
        templateActionId,
        templateDialogError,
        setTemplateDialogError,
        selectedTemplateForDialog,
        saveTemplateMutation,
        updateTemplateMutation,
        deleteTemplateMutation,
        closeTemplateDialog,
        openSaveTemplateDialog,
        openEditTemplateDialog,
        requestDeleteTemplate,
        templateDetailQuery,
        openTemplateDetail,
        closeTemplateDetail
    } = useInterpretationNetworkTemplateCommands({
        apiBaseUrl: details?.apiBaseUrl,
        applicationId: details?.applicationId,
        workspaceId: details?.currentWorkspaceId,
        widgetId,
        layoutId,
        enabled,
        locale,
        canCreateContent,
        canEditContent,
        canDeleteContent,
        selectedConcept,
        structureSummaries,
        closeStructureMenu,
        t
    })
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
            if (options.updateRoute !== false && (singleSystemMode || routeStructureId)) {
                navigateToCell(cellId, options)
            }
        },
        [clearMaterialSelection, navigateToCell, routeStructureId, singleSystemMode]
    )
    const syncRouteCell = useCallback(
        (cellId: string | null, options: { replace?: boolean } = {}) => {
            if (singleSystemMode || routeStructureId) {
                navigateToCell(cellId, options)
            }
        },
        [navigateToCell, routeStructureId, singleSystemMode]
    )

    useMatrixRouteSelectionSync({
        queryLoading: query.isLoading,
        queryFetching: query.isFetching,
        routeStructureId,
        routeCellId,
        singleSystemMode,
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

    const singleSystemStructure =
        singleSystemMode && ensureSystemStructureMutation.data?.structureId
            ? structureSummaries.find((structure) => structure.id === ensureSystemStructureMutation.data?.structureId)
            : singleSystemMode
            ? structureSummaries[0]
            : undefined

    useEffect(() => {
        if (!singleSystemMode || !enabled || query.isLoading || query.isFetching || ensureSystemStructureMutation.isPending) return
        if (!ensureSystemStructureMutation.data && !ensureSystemStructureMutation.error) {
            ensureSystemStructureRef.current()
        }
    }, [
        enabled,
        ensureSystemStructureMutation.data,
        ensureSystemStructureMutation.error,
        ensureSystemStructureMutation.isPending,
        query.isFetching,
        query.isLoading,
        singleSystemMode
    ])

    useEffect(() => {
        if (!singleSystemMode || query.isLoading || query.isFetching || !singleSystemStructure) return
        if (selectedConceptId !== singleSystemStructure.id) {
            setSelectedConceptId(singleSystemStructure.id)
        }
        if (selectedInterpretationId !== singleSystemStructure.interpretationId) {
            setSelectedInterpretationId(singleSystemStructure.interpretationId)
        }
    }, [query.isFetching, query.isLoading, selectedConceptId, selectedInterpretationId, singleSystemMode, singleSystemStructure])

    useEffect(() => {
        if (
            !singleSystemMode ||
            !details?.applicationId ||
            !getSectionId(query.data?.concepts) ||
            !hasRouteStructureId(details.applicationId)
        ) {
            return
        }
        navigateToStructure(null, { replace: true, focusedCellId: routeCellId })
    }, [details?.applicationId, navigateToStructure, query.data?.concepts, routeCellId, singleSystemMode])
    const { createStructureMutation, updateStructureMutation } = useStructureMutations({
        t,
        queryClient,
        canCreateContent,
        canEditContent,
        singleSystemMode,
        apiBaseUrl: details?.apiBaseUrl,
        applicationId: details?.applicationId,
        workspaceId: details?.currentWorkspaceId,
        widgetId,
        layoutId,
        locale,
        concepts: query.data?.concepts,
        structureFields,
        structureCreateSource,
        structureCreateTemplateId,
        templates: templatesQuery.data?.items ?? [],
        editingStructureId,
        editingStructure,
        clearEditingStructure,
        setStructureDialogMode,
        setStructureCreateSource,
        setStructureCreateTemplateId,
        setStructureDialogError,
        setSelectedConceptId,
        setSelectedInterpretationId,
        selectMatrixCell,
        navigateToStructure
    })
    const deleteStructure = structureDeleteId ? structureSummaries.find((structure) => structure.id === structureDeleteId) : undefined
    const deleteStructureMutation = useMutation({
        mutationFn: async () => {
            if (!canDeleteContent || !structureDeleteId) throw new Error('permission-denied')
            if (!details?.apiBaseUrl || !details.applicationId) return null
            await deleteInterpretationNetworkStructure({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                structureId: structureDeleteId,
                expectedVersion: readRuntimeRowVersion(deleteStructure?.row),
                widgetId,
                layoutId
            })
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
        widgetId,
        layoutId,
        selectedInterpretationId: selectedInterpretation?.id,
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
            if (!selectedInterpretation?.id || !matrixColumn?.id || !selectedRawCell?.id || !selectedCell?.id || !interpretationSectionId) {
                throw new Error('cell-not-selected')
            }

            if (materialDialogMode === 'edit') {
                const targetMaterialId = editingMaterialId
                if (!canEditContent || !targetMaterialId) throw new Error('permission-denied')
                const targetMaterial =
                    cellMaterials.find((material) => material.id === targetMaterialId) ??
                    materials.find((material) => material.id === targetMaterialId)
                return updateAppRow({
                    apiBaseUrl: details.apiBaseUrl,
                    applicationId: details.applicationId,
                    workspaceId: details.currentWorkspaceId,
                    objectCollectionId: materialSectionId,
                    rowId: targetMaterialId,
                    data,
                    expectedVersion: readRuntimeRowVersion(targetMaterial)
                })
            }

            if (!canCreateContent || !canEditContent) throw new Error('permission-denied')
            const material = await createInterpretationNetworkMaterial({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                interpretationId: selectedInterpretation.id,
                matrixRowId: selectedRawCell.id,
                cellId: selectedCell.id,
                data,
                expectedVersion: readRuntimeRowVersion(selectedRawCell),
                widgetId,
                layoutId
            })
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
                data,
                expectedVersion: readRuntimeRowVersion(selectedMaterial)
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
    const { saveCellMutation, deleteCellMutation } = useCellMutations({
        t,
        queryClient,
        canCreateContent,
        canEditContent,
        canDeleteContent,
        apiBaseUrl: details?.apiBaseUrl,
        applicationId: details?.applicationId,
        workspaceId: details?.currentWorkspaceId,
        locale,
        interpretationSectionId,
        selectedInterpretationId: selectedInterpretation?.id,
        matrixColumn,
        selectedCellId,
        deleteCell,
        deleteRawCell,
        cellDialogSourceCellId,
        activeCellDialogPlacement: activeCellDialogPlacement ?? undefined,
        widgetMatrixMode: widgetConfig.matrixMode,
        rootCellId,
        matrixRowsSnapshotRef,
        readRuntimeRowVersion,
        readSubmittedText,
        selectMatrixCell,
        setPendingSelectedCellId,
        setCellDialogMode,
        setAxisDialogKind,
        setCellDialogSourceCellId,
        setCellDialogPlacement: (placement) => setCellDialogPlacement(placement ?? null),
        setCellDialogError,
        cellDeleteId,
        setCellDeleteId,
        setCellDeleteError
    })
    const { openStructure, backToStructureList, openCreateStructureDialog } = useRuntimeSelectionActions({
        templates: templatesQuery.data?.items ?? [],
        setStructureDialogError,
        clearEditingStructure,
        setStructureCreateSource,
        setStructureCreateTemplateId,
        setStructureDialogMode,
        setStructureReturnFocusId,
        setSelectedConceptId,
        setSelectedInterpretationId,
        setSelectedMaterialId,
        setOpenedMaterialId,
        setMaterialDialogMode,
        setEditingMaterialId,
        selectMatrixCell,
        navigateToStructure
    })

    if (!enabled) {
        return <RuntimeContextMissing message={t('workspace.missingRuntimeContext', 'Runtime context is not available yet.')} />
    }

    if (query.isLoading || (singleSystemMode && ensureSystemStructureMutation.isPending && !singleSystemStructure)) {
        return <WorkspaceLoading label={t('workspace.loading', 'Loading interpretation network')} />
    }

    if (query.error || (singleSystemMode && ensureSystemStructureMutation.error)) {
        return (
            <WorkspaceError
                error={query.error ?? ensureSystemStructureMutation.error}
                fallback={t('workspace.error', 'Failed to load interpretation workspace')}
                locale={locale}
            />
        )
    }

    if (singleSystemMode && (!singleSystemStructure || !selectedInterpretation)) {
        return <WorkspaceLoading label={t('workspace.loading', 'Loading interpretation network')} />
    }

    const closeCellMenu = () => {
        setCellMenuAnchor(null)
        setCellMenuCellId(null)
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
    const viewProps: InterpretationNetworkWorkspaceViewProps = {
        matrix: selectedInterpretation
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
                  permissions: { canCreateContent, canEditContent, canDeleteContent },
                  menu: { anchor: cellMenuAnchor, cell: menuCell, moves: menuMoves },
                  deletingCell: deleteCellMutation.isPending,
                  sensors,
                  onChangeMatrixView: setMatrixViewOverride,
                  canSaveTemplate: canCreateContent && canEditContent && Boolean(selectedConcept),
                  onOpenSaveTemplate: () => openSaveTemplateDialog(selectedConcept?.id),
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
            : null,
        structure: {
            a11yIdPrefix,
            t,
            selectedConcept,
            conceptColumns: query.data?.concepts.columns,
            conceptNameField: widgetConfig.conceptNameField,
            locale,
            structureFilter,
            structureViewMode,
            filteredStructures,
            templates: templatesQuery.data?.items ?? [],
            structureListTab,
            structureDetailTab,
            showTemplatesInStructureList: widgetConfig.templatePanel.showInStructureList,
            showTemplatesInMatrix: widgetConfig.templatePanel.showInMatrix,
            dataGridLocaleText,
            canCreateStructure: !singleSystemMode && canCreateContent && canEditContent,
            canSaveTemplate: canCreateContent && canEditContent,
            canCreateFromTemplate: !singleSystemMode && canCreateContent && canEditContent && Boolean(templatesQuery.data?.items.length),
            templateLoading: templatesQuery.isLoading || templatesQuery.isFetching,
            templateDetailLoading: templateDetailQuery.isLoading || templateDetailQuery.isFetching,
            templateDetailError: templateDetailQuery.isError,
            templateDetail: templateDetailQuery.data,
            structureFieldsReady: structureFields.length > 0,
            createStructureError: Boolean(createStructureMutation.error),
            normalizedStructureFilter,
            structureMenuAnchor,
            structureMenuId,
            canEditStructure: !singleSystemMode && canEditContent,
            canDeleteStructure: !singleSystemMode && canDeleteContent,
            canEditTemplate: canEditContent,
            canDeleteTemplate: canDeleteContent && !deleteTemplateMutation.isPending,
            onFilterChange: setStructureFilter,
            onViewModeChange: (viewMode) => {
                closeStructureMenu()
                setStructureViewMode(viewMode)
            },
            onStructureListTabChange: setStructureListTab,
            onStructureDetailTabChange: setStructureDetailTab,
            onOpenCreateStructure: openCreateStructureDialog,
            onOpenSaveTemplateForStructure: openSaveTemplateDialog,
            onEditTemplate: openEditTemplateDialog,
            onDeleteTemplate: requestDeleteTemplate,
            onOpenTemplate: openTemplateDetail,
            onCloseTemplate: closeTemplateDetail,
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
        },
        splitPaneEnabled: widgetConfig.splitPane.enabled,
        singleSystemMode,
        structureReturnFocusId,
        onBackToStructureList: backToStructureList,
        details: {
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
        },
        dialogs: {
            a11yIdPrefix,
            t,
            locale,
            structure: {
                mode: structureDialogMode,
                fields: structureFields,
                initialData: structureInitialData,
                createSource: structureCreateSource,
                createTemplateId: structureCreateTemplateId,
                templates: templatesQuery.data?.items ?? [],
                error: structureDialogError,
                deleteId: structureDeleteId,
                deleteStructure,
                deleteError: structureDeleteError
            },
            template: {
                mode: templateDialogMode,
                error: templateDialogError,
                initialData:
                    templateDialogMode === 'edit' && selectedTemplateForDialog
                        ? {
                              templateName: selectedTemplateForDialog.name,
                              description: selectedTemplateForDialog.description ?? undefined,
                              templatePolicy: selectedTemplateForDialog.includesMaterials ? 'withMaterials' : 'structureOnly'
                          }
                        : { templatePolicy: 'structureOnly' },
                deleteId: templateActionId && templateDialogMode === null ? templateActionId : null,
                deleteTemplate: templateActionId && templateDialogMode === null ? selectedTemplateForDialog : undefined
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
                hideAxisLabelFields: widgetConfig.matrixMode === 'hierarchicalCells' && widgetConfig.tableProjection === 'hierarchicalPath',
                error: cellDialogError,
                deleteId: cellDeleteId,
                deleteCell,
                deleteError: cellDeleteError
            },
            mutations: {
                createStructure: createStructureMutation,
                updateStructure: updateStructureMutation,
                deleteStructure: deleteStructureMutation,
                saveTemplate: saveTemplateMutation,
                updateTemplate: updateTemplateMutation,
                deleteTemplate: deleteTemplateMutation,
                saveMaterialMetadata: saveMaterialMetadataMutation,
                saveCell: saveCellMutation,
                deleteCell: deleteCellMutation
            },
            actions: {
                setStructureDialogMode,
                setStructureCreateSource,
                setStructureCreateTemplateId,
                setEditingStructureId: setEditingStructureIdForDialogs,
                setStructureDialogError,
                setStructureDeleteId,
                setStructureDeleteError,
                setTemplateDialogMode,
                setTemplateDialogError,
                closeTemplateDialog,
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
        }
    }
    return <InterpretationNetworkWorkspaceView {...viewProps} />
}
