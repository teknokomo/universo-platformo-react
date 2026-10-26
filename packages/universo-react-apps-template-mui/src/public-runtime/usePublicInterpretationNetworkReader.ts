import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { StructureSummary, StructureViewMode } from '../dashboard/components/interpretation-network/workspace/StructurePane'
import type { PublicNetworkReadInput } from './publicInterpretationNetworkApi'
import { publicNetworkReadQueryKey } from './publicInterpretationNetworkApi'
import {
    buildHierarchicalMatrixTableModel,
    buildMatrixPositionLabels,
    buildMatrixTree,
    flattenMatrixTree,
    resolveMatrixRootState,
    toFocusedMatrixHierarchyRows,
    toMatrixHierarchyRows,
    toConfig,
    type MatrixView
} from '../dashboard/components/interpretation-network/model'
import { readAllPublicPages } from './publicInterpretationNetworkReaderData'
import {
    filterPublicStructures,
    groupPublicMatrixRows,
    projectPublicMaterials,
    projectPublicMatrixCells,
    projectPublicStructures
} from './publicInterpretationNetworkReaderModel'
import '../i18n/interpretationNetwork'
import '../i18n/publicInterpretationNetwork'

export type PublicInterpretationNetworkViewerProps = Omit<PublicNetworkReadInput, 'view' | 'parentHandle' | 'offset'> & {
    config?: Record<string, unknown>
    workspaceAvailable?: boolean
}

export function usePublicInterpretationNetworkReader(props: PublicInterpretationNetworkViewerProps) {
    const { t: publicT } = useTranslation('publicInterpretationNetwork', { lng: props.locale })
    const { t } = useTranslation('interpretationNetwork', { lng: props.locale })
    const widgetConfig = useMemo(() => toConfig(props.config), [props.config])
    const handleIds = useRef(new Map<string, string>())
    const nextLocalId = useRef(0)
    const [selectedStructureHandleOverride, setSelectedStructureHandleOverride] = useState<string | null>(null)
    const [selectedCellId, setSelectedCellId] = useState<string | null>(null)
    const [matrixViewOverride, setMatrixViewOverride] = useState<MatrixView | null>(null)
    const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null)
    const [openedMaterialId, setOpenedMaterialId] = useState<string | null>(null)
    const [structureFilter, setStructureFilter] = useState('')
    const [structureViewMode, setStructureViewMode] = useState<StructureViewMode>('table')

    const localIdForHandle = useCallback((kind: string, handle: string): string => {
        const key = `${kind}\u0000${handle}`
        const existing = handleIds.current.get(key)
        if (existing) return existing
        nextLocalId.current += 1
        const localId = `public-${kind}-${nextLocalId.current}`
        handleIds.current.set(key, localId)
        return localId
    }, [])

    const commonInput = {
        applicationRef: props.applicationRef,
        locale: props.locale,
        target: props.target,
        instanceKey: props.instanceKey
    }
    const structuresInput = { ...commonInput, view: 'structures' as const, offset: 0 }
    const structuresQuery = useQuery({
        queryKey: [...publicNetworkReadQueryKey(structuresInput), widgetConfig.structureMode, 'complete'],
        queryFn: ({ signal }) => readAllPublicPages({ ...commonInput, view: 'structures' }, signal),
        staleTime: 0,
        gcTime: 0,
        retry: false,
        refetchOnWindowFocus: false
    })

    const structuresData = structuresQuery.data?.view === 'structures' ? structuresQuery.data : undefined
    const structureProjection = useMemo(
        () => projectPublicStructures(structuresData?.items ?? [], localIdForHandle),
        [localIdForHandle, structuresData]
    )
    const structures = structureProjection.summaries
    const structureHandleById = structureProjection.handleById
    const selectedStructureHandle =
        widgetConfig.structureMode === 'singleSystem' ? structuresData?.items[0]?.handle ?? null : selectedStructureHandleOverride
    const selectedStructure = structures.find((structure) => structureHandleById.get(structure.id) === selectedStructureHandle)
    const selectedConcept = selectedStructure?.row

    const interpretationsInput = {
        ...commonInput,
        view: 'interpretations' as const,
        parentHandle: selectedStructureHandle ?? undefined,
        offset: 0
    }
    const interpretationsQuery = useQuery({
        queryKey: [...publicNetworkReadQueryKey(interpretationsInput), 'complete'],
        queryFn: ({ signal }) =>
            readAllPublicPages({ ...commonInput, view: 'interpretations', parentHandle: selectedStructureHandle! }, signal),
        enabled: Boolean(selectedStructureHandle),
        staleTime: 0,
        gcTime: 0,
        retry: false,
        refetchOnWindowFocus: false
    })
    const interpretationsData = interpretationsQuery.data?.view === 'interpretations' ? interpretationsQuery.data : undefined
    const selectedInterpretation = interpretationsData?.items[0]
    const selectedInterpretationHandle = selectedInterpretation?.handle

    const matrixInput = {
        ...commonInput,
        view: 'matrix' as const,
        parentHandle: selectedInterpretationHandle,
        offset: 0
    }
    const matrixQuery = useQuery({
        queryKey: [...publicNetworkReadQueryKey(matrixInput), 'complete'],
        queryFn: ({ signal }) =>
            readAllPublicPages({ ...commonInput, view: 'matrix', parentHandle: selectedInterpretationHandle! }, signal),
        enabled: Boolean(selectedInterpretationHandle),
        staleTime: 0,
        gcTime: 0,
        retry: false,
        refetchOnWindowFocus: false
    })
    const matrixData = matrixQuery.data?.view === 'matrix' ? matrixQuery.data : undefined

    const cells = useMemo(
        () =>
            projectPublicMatrixCells(
                matrixData?.items ?? [],
                localIdForHandle,
                t('workspace.table.rowHeader', 'Rows'),
                publicT('publicViewer.emptyCell')
            ),
        [localIdForHandle, matrixData, publicT, t]
    )
    const cellHandleById = useMemo(() => {
        const result = new Map<string, string>()
        for (const item of matrixData?.items ?? []) result.set(localIdForHandle('cell', item.handle), item.handle)
        return result
    }, [localIdForHandle, matrixData])
    const matrixTree = useMemo(() => buildMatrixTree(cells), [cells])
    const matrixRoots = useMemo(() => resolveMatrixRootState(cells), [cells])
    const effectiveSelectedCellId =
        selectedCellId && cells.some((cell) => cell.id === selectedCellId)
            ? selectedCellId
            : matrixRoots.kind === 'singleRoot'
            ? matrixRoots.root.id
            : null
    const matrixTableModel = useMemo(
        () =>
            buildHierarchicalMatrixTableModel({
                cells,
                focusedCellId: effectiveSelectedCellId,
                breadcrumbDepth: widgetConfig.breadcrumbDepth
            }),
        [cells, effectiveSelectedCellId, widgetConfig.breadcrumbDepth]
    )
    const matrixCells = useMemo(() => flattenMatrixTree(matrixTree), [matrixTree])
    const matrixHierarchyRows = useMemo(
        () =>
            widgetConfig.hierarchyRowMode === 'allNodes'
                ? toMatrixHierarchyRows(matrixCells)
                : toFocusedMatrixHierarchyRows(matrixTree, effectiveSelectedCellId),
        [effectiveSelectedCellId, matrixCells, matrixTree, widgetConfig.hierarchyRowMode]
    )
    const matrixPositionLabels = useMemo(
        () => buildMatrixPositionLabels(matrixTree, widgetConfig.positionNumbering),
        [matrixTree, widgetConfig.positionNumbering]
    )
    const independentMatrixRows = useMemo(() => groupPublicMatrixRows(matrixCells), [matrixCells])
    const matrixView =
        matrixViewOverride && widgetConfig.allowedMatrixViews.includes(matrixViewOverride)
            ? matrixViewOverride
            : widgetConfig.defaultMatrixView
    const selectedCellHandle = effectiveSelectedCellId ? cellHandleById.get(effectiveSelectedCellId) : undefined
    const materialsInput = {
        ...commonInput,
        view: 'materials' as const,
        parentHandle: selectedCellHandle,
        offset: 0
    }
    const materialsQuery = useQuery({
        queryKey: [...publicNetworkReadQueryKey(materialsInput), 'complete'],
        queryFn: ({ signal }) => readAllPublicPages({ ...commonInput, view: 'materials', parentHandle: selectedCellHandle! }, signal),
        enabled: Boolean(selectedCellHandle),
        staleTime: 0,
        gcTime: 0,
        retry: false,
        refetchOnWindowFocus: false
    })
    const materialsData =
        materialsQuery.data?.view === 'materials' && materialsQuery.data.cellHandle === selectedCellHandle ? materialsQuery.data : undefined
    const materials = useMemo(
        () => projectPublicMaterials(materialsData?.items ?? [], effectiveSelectedCellId, localIdForHandle),
        [effectiveSelectedCellId, localIdForHandle, materialsData]
    )
    const primaryMaterial = materials.find((material, index) => materialsData?.items[index]?.isPrimary)
    const selectedCell = useMemo(() => {
        const cell = cells.find((item) => item.id === effectiveSelectedCellId)
        return cell ? { ...cell, materialRef: primaryMaterial?.id ?? null } : undefined
    }, [cells, effectiveSelectedCellId, primaryMaterial?.id])
    const selectedMaterial = materials.find((material) => material.id === openedMaterialId)

    useEffect(() => {
        setOpenedMaterialId(null)
        setSelectedMaterialId(null)
    }, [effectiveSelectedCellId])

    useEffect(() => {
        if (!primaryMaterial || openedMaterialId || selectedMaterialId) return
        setOpenedMaterialId(primaryMaterial.id)
        setSelectedMaterialId(primaryMaterial.id)
    }, [openedMaterialId, primaryMaterial, selectedMaterialId])

    const normalizedStructureFilter = structureFilter.trim().toLocaleLowerCase(props.locale)
    const filteredStructures = useMemo(
        () => filterPublicStructures(structures, normalizedStructureFilter, props.locale),
        [normalizedStructureFilter, props.locale, structures]
    )
    const onOpenStructure = useCallback(
        (structure: StructureSummary) => {
            const handle = structureHandleById.get(structure.id)
            if (!handle) return
            setSelectedStructureHandleOverride(handle)
            setSelectedCellId(null)
            setOpenedMaterialId(null)
            setSelectedMaterialId(null)
        },
        [structureHandleById]
    )
    const onBackToStructureList = useCallback(() => {
        setSelectedStructureHandleOverride(null)
        setSelectedCellId(null)
        setOpenedMaterialId(null)
        setSelectedMaterialId(null)
    }, [])

    return {
        t,
        publicT,
        widgetConfig,
        structuresQuery,
        structures,
        selectedStructure,
        selectedConcept,
        selectedStructureHandle,
        interpretationsQuery,
        selectedInterpretation,
        matrixQuery,
        cells,
        effectiveSelectedCellId,
        matrixTableModel,
        matrixCells,
        matrixHierarchyRows,
        matrixPositionLabels,
        independentMatrixRows,
        matrixView,
        setMatrixViewOverride,
        selectedCellHandle,
        materialsQuery,
        materials,
        selectedCell,
        selectedMaterial,
        selectedMaterialId,
        openedMaterialId,
        setSelectedMaterialId,
        setOpenedMaterialId,
        structureFilter,
        structureViewMode,
        filteredStructures,
        normalizedStructureFilter,
        setStructureFilter,
        setStructureViewMode,
        onOpenStructure,
        onBackToStructureList,
        selectCell: setSelectedCellId
    }
}
