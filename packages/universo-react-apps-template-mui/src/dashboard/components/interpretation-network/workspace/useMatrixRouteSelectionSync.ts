import { useEffect } from 'react'
import { resolveRouteFocus, type MatrixCell, type MatrixRootState, type RuntimeRow } from '../model'
import type { StructureSummary } from './StructurePane'

type SelectMatrixCell = (cellId: string | null, options?: { replace?: boolean; updateRoute?: boolean }) => void
type SyncRouteCell = (cellId: string | null, options?: { replace?: boolean }) => void

export function useMatrixRouteSelectionSync({
    queryLoading,
    queryFetching,
    routeStructureId,
    routeCellId,
    concepts,
    interpretations,
    structureSummaries,
    matrixCells,
    rootState,
    selectedInterpretation,
    selectedCell,
    selectedInterpretationId,
    selectedConceptId,
    selectedCellId,
    pendingSelectedCellId,
    selectedMaterialId,
    cellMaterials,
    matrixRowsSettled,
    selectMatrixCell,
    clearMaterialSelection,
    setSelectedInterpretationId,
    setSelectedConceptId,
    setPendingSelectedCellId,
    setSelectedMaterialId,
    setOpenedMaterialId,
    syncRouteCell
}: {
    queryLoading: boolean
    queryFetching: boolean
    routeStructureId: string | null
    routeCellId: string | null
    concepts: RuntimeRow[]
    interpretations: RuntimeRow[]
    structureSummaries: StructureSummary[]
    matrixCells: MatrixCell[]
    rootState: MatrixRootState
    selectedInterpretation: RuntimeRow | undefined
    selectedCell: MatrixCell | undefined
    selectedInterpretationId: string | null
    selectedConceptId: string | null
    selectedCellId: string | null
    pendingSelectedCellId: string | null
    selectedMaterialId: string | null
    cellMaterials: RuntimeRow[]
    matrixRowsSettled: boolean
    selectMatrixCell: SelectMatrixCell
    clearMaterialSelection: () => void
    setSelectedInterpretationId: (interpretationId: string | null) => void
    setSelectedConceptId: (conceptId: string | null) => void
    setPendingSelectedCellId: (cellId: string | null) => void
    setSelectedMaterialId: (materialId: string | null) => void
    setOpenedMaterialId: (materialId: string | null) => void
    syncRouteCell?: SyncRouteCell
}) {
    useEffect(() => {
        if (selectedInterpretationId && !interpretations.some((row) => row.id === selectedInterpretationId)) {
            setSelectedInterpretationId(null)
            selectMatrixCell(null, { replace: true })
        }
    }, [interpretations, selectMatrixCell, selectedInterpretationId, setSelectedInterpretationId])

    useEffect(() => {
        if (selectedConceptId && !concepts.some((row) => row.id === selectedConceptId)) {
            setSelectedConceptId(null)
            setSelectedInterpretationId(null)
            selectMatrixCell(null, { replace: true })
        }
    }, [concepts, selectMatrixCell, selectedConceptId, setSelectedConceptId, setSelectedInterpretationId])

    useEffect(() => {
        if (queryLoading || queryFetching) return
        if (!routeStructureId) {
            if (selectedConceptId) {
                setSelectedConceptId(null)
                setSelectedInterpretationId(null)
                selectMatrixCell(null, { replace: true })
                setSelectedMaterialId(null)
                setOpenedMaterialId(null)
            }
            return
        }

        const routeStructure = structureSummaries.find((structure) => structure.id === routeStructureId)
        if (!routeStructure) {
            setSelectedConceptId(null)
            setSelectedInterpretationId(null)
            selectMatrixCell(null, { replace: true })
            setSelectedMaterialId(null)
            setOpenedMaterialId(null)
            return
        }
        if (selectedConceptId === routeStructure.id && selectedInterpretationId === routeStructure.interpretationId) return

        setSelectedConceptId(routeStructure.id)
        setSelectedInterpretationId(routeStructure.interpretationId)
        if (routeCellId) {
            setPendingSelectedCellId(routeCellId)
            if (selectedCellId) {
                selectMatrixCell(null, { replace: true, updateRoute: false })
            }
        } else {
            selectMatrixCell(null, { replace: true, updateRoute: false })
        }
        clearMaterialSelection()
    }, [
        clearMaterialSelection,
        queryFetching,
        queryLoading,
        routeCellId,
        routeStructureId,
        selectMatrixCell,
        selectedCellId,
        selectedConceptId,
        selectedInterpretationId,
        setOpenedMaterialId,
        setPendingSelectedCellId,
        setSelectedConceptId,
        setSelectedInterpretationId,
        setSelectedMaterialId,
        structureSummaries
    ])

    useEffect(() => {
        if (!matrixRowsSettled) return
        if (!pendingSelectedCellId) return
        if (!matrixCells.some((cell) => cell.id === pendingSelectedCellId)) {
            setPendingSelectedCellId(null)
            return
        }
        selectMatrixCell(pendingSelectedCellId, { replace: true })
        setPendingSelectedCellId(null)
    }, [matrixCells, matrixRowsSettled, pendingSelectedCellId, selectMatrixCell, setPendingSelectedCellId])

    useEffect(() => {
        if (!selectedInterpretation) return
        if (!matrixRowsSettled) return
        if (pendingSelectedCellId) return
        const repairedCellId = resolveRouteFocus(routeCellId, matrixCells, rootState)
        if (repairedCellId === selectedCellId && repairedCellId !== routeCellId) {
            syncRouteCell?.(repairedCellId, { replace: true })
            return
        }
        if (repairedCellId !== selectedCellId) {
            selectMatrixCell(repairedCellId, { replace: true })
        }
    }, [
        matrixCells,
        matrixRowsSettled,
        pendingSelectedCellId,
        rootState,
        routeCellId,
        selectMatrixCell,
        selectedCellId,
        selectedInterpretation,
        syncRouteCell
    ])

    useEffect(() => {
        if (!selectedCell) {
            clearMaterialSelection()
            return
        }
        if (selectedMaterialId && cellMaterials.some((material) => material.id === selectedMaterialId)) return
        setSelectedMaterialId(cellMaterials[0]?.id ?? null)
    }, [cellMaterials, clearMaterialSelection, selectedCell, selectedMaterialId, setSelectedMaterialId])
}
