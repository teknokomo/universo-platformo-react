import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MatrixCell } from '../../model'
import { useCellDialogActions } from '../useCellDialogActions'
import { useMatrixRouteSelectionSync } from '../useMatrixRouteSelectionSync'
import { resolveMoveHierarchyLayout } from '../useMatrixWorkspaceActions'
import { useStructureRoute } from '../useStructureRoute'
import { buildStructureRuntimePath, readRouteMatrixCellId, readRouteStructureId } from '../workspaceRuntime'

const setLocation = (path: string) => {
    window.history.pushState({}, '', path)
}

const matrixCell = (input: Partial<MatrixCell> & Pick<MatrixCell, 'id' | 'parentCellId' | 'sortOrder'>): MatrixCell => ({
    rawRowId: `row-${input.id}`,
    depth: input.parentCellId ? 1 : 0,
    rowKey: `${input.id}-row`,
    rowLabel: `${input.id} row`,
    rowLabelValue: `${input.id} row`,
    colKey: `${input.id}-column`,
    colLabel: `${input.id} column`,
    colLabelValue: `${input.id} column`,
    title: input.id,
    description: '',
    materialRef: null,
    style: {
        fill: null,
        text: null,
        borderTop: null,
        borderRight: null,
        borderBottom: null,
        borderLeft: null
    },
    ...input
})

describe('workspace runtime route helpers', () => {
    afterEach(() => {
        setLocation('/a/app-1')
    })

    it('reads structure and focused matrix cell from runtime route state', () => {
        setLocation('/a/app-1/structure-section/structure-1?matrixCell=cell-2')

        expect(readRouteStructureId('app-1')).toBe('structure-1')
        expect(readRouteMatrixCellId()).toBe('cell-2')
    })

    it('builds a focused-cell route while preserving existing search params and hash', () => {
        setLocation('/a/app-1/structure-section/structure-1?tab=matrix#details')

        expect(buildStructureRuntimePath('app-1', 'structure-section', 'structure-2', 'cell-7')).toBe(
            '/a/app-1/structure-section/structure-2?tab=matrix&matrixCell=cell-7#details'
        )
    })

    it('removes stale focused-cell query when focus is cleared', () => {
        setLocation('/a/app-1/structure-section/structure-1?tab=matrix&matrixCell=cell-7')

        expect(buildStructureRuntimePath('app-1', 'structure-section', 'structure-1', null)).toBe(
            '/a/app-1/structure-section/structure-1?tab=matrix'
        )
    })

    it('does not treat reserved runtime segments as structure routes', () => {
        setLocation('/a/app-1/admin?matrixCell=cell-7')

        expect(readRouteStructureId('app-1')).toBeNull()
        expect(buildStructureRuntimePath('app-1', 'structure-section', null, null)).toBe('/a/app-1/structure-section')
    })

    it('adopts a structure route without clearing the route before root focus is resolved', () => {
        const selectMatrixCell = vi.fn()

        renderHook(() =>
            useMatrixRouteSelectionSync({
                queryLoading: false,
                queryFetching: false,
                routeStructureId: 'structure-1',
                routeCellId: null,
                concepts: [{ id: 'structure-1' }],
                interpretations: [{ id: 'interpretation-1' }],
                structureSummaries: [
                    {
                        id: 'structure-1',
                        row: { id: 'structure-1' },
                        title: 'Structure',
                        description: '',
                        interpretationId: 'interpretation-1'
                    }
                ],
                matrixCells: [],
                rootState: { kind: 'empty' },
                selectedInterpretation: undefined,
                selectedCell: undefined,
                selectedInterpretationId: null,
                selectedConceptId: null,
                selectedCellId: null,
                pendingSelectedCellId: null,
                selectedMaterialId: null,
                cellMaterials: [],
                matrixRowsSettled: false,
                selectMatrixCell,
                clearMaterialSelection: vi.fn(),
                setSelectedInterpretationId: vi.fn(),
                setSelectedConceptId: vi.fn(),
                setPendingSelectedCellId: vi.fn(),
                setSelectedMaterialId: vi.fn(),
                setOpenedMaterialId: vi.fn()
            })
        )

        expect(selectMatrixCell).toHaveBeenCalledWith(null, { replace: true, updateRoute: false })
    })

    it('adopts a structure route without clearing a focused-cell deep link', () => {
        const selectMatrixCell = vi.fn()

        renderHook(() =>
            useMatrixRouteSelectionSync({
                queryLoading: false,
                queryFetching: false,
                routeStructureId: 'structure-1',
                routeCellId: 'child',
                concepts: [{ id: 'structure-1' }],
                interpretations: [{ id: 'interpretation-1' }],
                structureSummaries: [
                    {
                        id: 'structure-1',
                        row: { id: 'structure-1' },
                        title: 'Structure',
                        description: '',
                        interpretationId: 'interpretation-1'
                    }
                ],
                matrixCells: [],
                rootState: { kind: 'empty' },
                selectedInterpretation: undefined,
                selectedCell: undefined,
                selectedInterpretationId: null,
                selectedConceptId: null,
                selectedCellId: null,
                pendingSelectedCellId: null,
                selectedMaterialId: null,
                cellMaterials: [],
                matrixRowsSettled: false,
                selectMatrixCell,
                clearMaterialSelection: vi.fn(),
                setSelectedInterpretationId: vi.fn(),
                setSelectedConceptId: vi.fn(),
                setPendingSelectedCellId: vi.fn(),
                setSelectedMaterialId: vi.fn(),
                setOpenedMaterialId: vi.fn()
            })
        )

        expect(selectMatrixCell).not.toHaveBeenCalled()
    })

    it('clears stale focused cell selection when the route no longer has a matrix cell query', () => {
        const selectMatrixCell = vi.fn()

        renderHook(() =>
            useMatrixRouteSelectionSync({
                queryLoading: false,
                queryFetching: false,
                routeStructureId: 'structure-1',
                routeCellId: null,
                concepts: [{ id: 'structure-1' }],
                interpretations: [{ id: 'interpretation-1' }],
                structureSummaries: [
                    {
                        id: 'structure-1',
                        row: { id: 'structure-1' },
                        title: 'Structure',
                        description: '',
                        interpretationId: 'interpretation-1'
                    }
                ],
                matrixCells: [
                    {
                        id: 'root',
                        rawRowId: 'row-root',
                        parentCellId: null,
                        depth: 0,
                        sortOrder: 0,
                        rowKey: 'root-row',
                        rowLabel: 'Root',
                        rowLabelValue: 'Root',
                        colKey: 'root-column',
                        colLabel: 'Root',
                        colLabelValue: 'Root',
                        title: 'Root',
                        description: '',
                        materialRef: null,
                        style: {
                            fill: null,
                            text: null,
                            borderTop: null,
                            borderRight: null,
                            borderBottom: null,
                            borderLeft: null
                        }
                    },
                    {
                        id: 'child',
                        rawRowId: 'row-child',
                        parentCellId: 'root',
                        depth: 1,
                        sortOrder: 0,
                        rowKey: 'child-row',
                        rowLabel: 'Child',
                        rowLabelValue: 'Child',
                        colKey: 'child-column',
                        colLabel: 'Child',
                        colLabelValue: 'Child',
                        title: 'Child',
                        description: '',
                        materialRef: null,
                        style: {
                            fill: null,
                            text: null,
                            borderTop: null,
                            borderRight: null,
                            borderBottom: null,
                            borderLeft: null
                        }
                    }
                ],
                rootState: {
                    kind: 'singleRoot',
                    root: {
                        id: 'root',
                        rawRowId: 'row-root',
                        parentCellId: null,
                        depth: 0,
                        sortOrder: 0,
                        rowKey: 'root-row',
                        rowLabel: 'Root',
                        rowLabelValue: 'Root',
                        colKey: 'root-column',
                        colLabel: 'Root',
                        colLabelValue: 'Root',
                        title: 'Root',
                        description: '',
                        materialRef: null,
                        style: {
                            fill: null,
                            text: null,
                            borderTop: null,
                            borderRight: null,
                            borderBottom: null,
                            borderLeft: null
                        }
                    }
                },
                selectedInterpretation: { id: 'interpretation-1' },
                selectedCell: undefined,
                selectedInterpretationId: 'interpretation-1',
                selectedConceptId: 'structure-1',
                selectedCellId: 'child',
                pendingSelectedCellId: null,
                selectedMaterialId: null,
                cellMaterials: [],
                matrixRowsSettled: true,
                selectMatrixCell,
                clearMaterialSelection: vi.fn(),
                setSelectedInterpretationId: vi.fn(),
                setSelectedConceptId: vi.fn(),
                setPendingSelectedCellId: vi.fn(),
                setSelectedMaterialId: vi.fn(),
                setOpenedMaterialId: vi.fn()
            })
        )

        expect(selectMatrixCell).toHaveBeenCalledWith('root', { replace: true })
    })

    it('clears the active focused cell but preserves the pending route focus when switching structures', () => {
        const selectMatrixCell = vi.fn()
        const setPendingSelectedCellId = vi.fn()

        renderHook(() =>
            useMatrixRouteSelectionSync({
                queryLoading: false,
                queryFetching: false,
                routeStructureId: 'structure-2',
                routeCellId: 'new-child',
                concepts: [{ id: 'structure-2' }],
                interpretations: [{ id: 'interpretation-2' }],
                structureSummaries: [
                    {
                        id: 'structure-2',
                        row: { id: 'structure-2' },
                        title: 'Structure 2',
                        description: '',
                        interpretationId: 'interpretation-2'
                    }
                ],
                matrixCells: [],
                rootState: { kind: 'empty' },
                selectedInterpretation: undefined,
                selectedCell: undefined,
                selectedInterpretationId: 'interpretation-1',
                selectedConceptId: 'structure-1',
                selectedCellId: 'old-child',
                pendingSelectedCellId: null,
                selectedMaterialId: null,
                cellMaterials: [],
                matrixRowsSettled: false,
                selectMatrixCell,
                clearMaterialSelection: vi.fn(),
                setSelectedInterpretationId: vi.fn(),
                setSelectedConceptId: vi.fn(),
                setPendingSelectedCellId,
                setSelectedMaterialId: vi.fn(),
                setOpenedMaterialId: vi.fn()
            })
        )

        expect(setPendingSelectedCellId).toHaveBeenCalledWith('new-child')
        expect(selectMatrixCell).toHaveBeenCalledWith(null, { replace: true, updateRoute: false })
    })

    it('repairs a missing focused-cell query without reselecting an already selected root', () => {
        const selectMatrixCell = vi.fn()
        const syncRouteCell = vi.fn()

        renderHook(() =>
            useMatrixRouteSelectionSync({
                queryLoading: false,
                queryFetching: false,
                routeStructureId: 'structure-1',
                routeCellId: null,
                concepts: [{ id: 'structure-1' }],
                interpretations: [{ id: 'interpretation-1' }],
                structureSummaries: [
                    {
                        id: 'structure-1',
                        row: { id: 'structure-1' },
                        title: 'Structure',
                        description: '',
                        interpretationId: 'interpretation-1'
                    }
                ],
                matrixCells: [
                    {
                        id: 'root',
                        rawRowId: 'row-root',
                        parentCellId: null,
                        depth: 0,
                        sortOrder: 0,
                        rowKey: 'root-row',
                        rowLabel: 'Root',
                        rowLabelValue: 'Root',
                        colKey: 'root-column',
                        colLabel: 'Root',
                        colLabelValue: 'Root',
                        title: 'Root',
                        description: '',
                        materialRef: null,
                        style: {
                            fill: null,
                            text: null,
                            borderTop: null,
                            borderRight: null,
                            borderBottom: null,
                            borderLeft: null
                        }
                    }
                ],
                rootState: {
                    kind: 'singleRoot',
                    root: {
                        id: 'root',
                        rawRowId: 'row-root',
                        parentCellId: null,
                        depth: 0,
                        sortOrder: 0,
                        rowKey: 'root-row',
                        rowLabel: 'Root',
                        rowLabelValue: 'Root',
                        colKey: 'root-column',
                        colLabel: 'Root',
                        colLabelValue: 'Root',
                        title: 'Root',
                        description: '',
                        materialRef: null,
                        style: {
                            fill: null,
                            text: null,
                            borderTop: null,
                            borderRight: null,
                            borderBottom: null,
                            borderLeft: null
                        }
                    }
                },
                selectedInterpretation: { id: 'interpretation-1' },
                selectedCell: undefined,
                selectedInterpretationId: 'interpretation-1',
                selectedConceptId: 'structure-1',
                selectedCellId: 'root',
                pendingSelectedCellId: null,
                selectedMaterialId: null,
                cellMaterials: [],
                matrixRowsSettled: true,
                selectMatrixCell,
                clearMaterialSelection: vi.fn(),
                setSelectedInterpretationId: vi.fn(),
                setSelectedConceptId: vi.fn(),
                setPendingSelectedCellId: vi.fn(),
                setSelectedMaterialId: vi.fn(),
                setOpenedMaterialId: vi.fn(),
                syncRouteCell
            })
        )

        expect(selectMatrixCell).not.toHaveBeenCalled()
        expect(syncRouteCell).toHaveBeenCalledWith('root', { replace: true })
    })

    it('settles route state after repairing a missing focused-cell query without clearing material selection again', () => {
        setLocation('/a/app-1/structure-section/structure-1')
        const clearMaterialSelection = vi.fn()
        const repairCalls = vi.fn()
        const syncRouteCalls = vi.fn()
        let selectedCellId: string | null = 'root'
        const rootCell = {
            id: 'root',
            rawRowId: 'row-root',
            parentCellId: null,
            depth: 0,
            sortOrder: 0,
            rowKey: 'root-row',
            rowLabel: 'Root',
            rowLabelValue: 'Root',
            colKey: 'root-column',
            colLabel: 'Root',
            colLabelValue: 'Root',
            title: 'Root',
            description: '',
            materialRef: null,
            style: {
                fill: null,
                text: null,
                borderTop: null,
                borderRight: null,
                borderBottom: null,
                borderLeft: null
            }
        }

        const { result, rerender } = renderHook(() => {
            const route = useStructureRoute({ applicationId: 'app-1', conceptSectionId: 'structure-section' })
            const selectMatrixCell = (cellId: string | null, options: { replace?: boolean; updateRoute?: boolean } = {}) => {
                repairCalls(cellId, options)
                selectedCellId = cellId
                clearMaterialSelection()
                if (options.updateRoute !== false && route.routeStructureId) {
                    route.navigateToCell(cellId, options)
                }
            }
            const syncRouteCell = (cellId: string | null, options: { replace?: boolean } = {}) => {
                syncRouteCalls(cellId, options)
                route.navigateToCell(cellId, options)
            }

            useMatrixRouteSelectionSync({
                queryLoading: false,
                queryFetching: false,
                routeStructureId: route.routeStructureId,
                routeCellId: route.routeCellId,
                concepts: [{ id: 'structure-1' }],
                interpretations: [{ id: 'interpretation-1' }],
                structureSummaries: [
                    {
                        id: 'structure-1',
                        row: { id: 'structure-1' },
                        title: 'Structure',
                        description: '',
                        interpretationId: 'interpretation-1'
                    }
                ],
                matrixCells: [rootCell],
                rootState: {
                    kind: 'singleRoot',
                    root: rootCell
                },
                selectedInterpretation: { id: 'interpretation-1' },
                selectedCell: rootCell,
                selectedInterpretationId: 'interpretation-1',
                selectedConceptId: 'structure-1',
                selectedCellId,
                pendingSelectedCellId: null,
                selectedMaterialId: 'material-1',
                cellMaterials: [{ id: 'material-1' }],
                matrixRowsSettled: true,
                selectMatrixCell,
                clearMaterialSelection,
                setSelectedInterpretationId: vi.fn(),
                setSelectedConceptId: vi.fn(),
                setPendingSelectedCellId: vi.fn(),
                setSelectedMaterialId: vi.fn(),
                setOpenedMaterialId: vi.fn(),
                syncRouteCell
            })

            return { route, selectMatrixCell }
        })

        expect(repairCalls).not.toHaveBeenCalled()
        expect(syncRouteCalls).toHaveBeenCalledTimes(1)
        expect(clearMaterialSelection).not.toHaveBeenCalled()
        expect(result.current.route.routeCellId).toBe('root')
        expect(window.location.search).toBe('?matrixCell=root')

        rerender()

        expect(repairCalls).not.toHaveBeenCalled()
        expect(syncRouteCalls).toHaveBeenCalledTimes(1)
        expect(clearMaterialSelection).not.toHaveBeenCalled()
    })

    it('preserves focused-cell deep links until matrix rows are loaded', () => {
        const selectMatrixCell = vi.fn()

        renderHook(() =>
            useMatrixRouteSelectionSync({
                queryLoading: false,
                queryFetching: false,
                routeStructureId: 'structure-1',
                routeCellId: 'child',
                concepts: [{ id: 'structure-1' }],
                interpretations: [{ id: 'interpretation-1' }],
                structureSummaries: [
                    {
                        id: 'structure-1',
                        row: { id: 'structure-1' },
                        title: 'Structure',
                        description: '',
                        interpretationId: 'interpretation-1'
                    }
                ],
                matrixCells: [],
                rootState: { kind: 'empty' },
                selectedInterpretation: { id: 'interpretation-1' },
                selectedCell: undefined,
                selectedInterpretationId: 'interpretation-1',
                selectedConceptId: 'structure-1',
                selectedCellId: null,
                pendingSelectedCellId: null,
                selectedMaterialId: null,
                cellMaterials: [],
                matrixRowsSettled: false,
                selectMatrixCell,
                clearMaterialSelection: vi.fn(),
                setSelectedInterpretationId: vi.fn(),
                setSelectedConceptId: vi.fn(),
                setPendingSelectedCellId: vi.fn(),
                setSelectedMaterialId: vi.fn(),
                setOpenedMaterialId: vi.fn()
            })
        )

        expect(selectMatrixCell).not.toHaveBeenCalled()
    })

    it('repairs stale pending focused-cell deep links after matrix rows settle', () => {
        const selectMatrixCell = vi.fn()
        const syncRouteCell = vi.fn()
        let pendingSelectedCellId: string | null = 'deleted-cell'
        const rootCell = {
            id: 'root',
            rawRowId: 'row-root',
            parentCellId: null,
            depth: 0,
            sortOrder: 0,
            rowKey: 'root-row',
            rowLabel: 'Root',
            rowLabelValue: 'Root',
            colKey: 'root-column',
            colLabel: 'Root',
            colLabelValue: 'Root',
            title: 'Root',
            description: '',
            materialRef: null,
            style: {
                fill: null,
                text: null,
                borderTop: null,
                borderRight: null,
                borderBottom: null,
                borderLeft: null
            }
        }

        const { rerender } = renderHook(() =>
            useMatrixRouteSelectionSync({
                queryLoading: false,
                queryFetching: false,
                routeStructureId: 'structure-1',
                routeCellId: 'deleted-cell',
                concepts: [{ id: 'structure-1' }],
                interpretations: [{ id: 'interpretation-1' }],
                structureSummaries: [
                    {
                        id: 'structure-1',
                        row: { id: 'structure-1' },
                        title: 'Structure',
                        description: '',
                        interpretationId: 'interpretation-1'
                    }
                ],
                matrixCells: [rootCell],
                rootState: { kind: 'singleRoot', root: rootCell },
                selectedInterpretation: { id: 'interpretation-1' },
                selectedCell: undefined,
                selectedInterpretationId: 'interpretation-1',
                selectedConceptId: 'structure-1',
                selectedCellId: null,
                pendingSelectedCellId,
                selectedMaterialId: null,
                cellMaterials: [],
                matrixRowsSettled: true,
                selectMatrixCell,
                clearMaterialSelection: vi.fn(),
                setSelectedInterpretationId: vi.fn(),
                setSelectedConceptId: vi.fn(),
                setPendingSelectedCellId: (cellId) => {
                    pendingSelectedCellId = cellId
                },
                setSelectedMaterialId: vi.fn(),
                setOpenedMaterialId: vi.fn(),
                syncRouteCell
            })
        )

        expect(selectMatrixCell).not.toHaveBeenCalled()
        expect(pendingSelectedCellId).toBeNull()

        rerender()

        expect(selectMatrixCell).toHaveBeenCalledWith('root', { replace: true })
        expect(syncRouteCell).not.toHaveBeenCalled()
    })

    it('uses vertical drag geometry for hierarchical path tables', () => {
        expect(resolveMoveHierarchyLayout('table', 'hierarchicalCells', 'hierarchicalPath')).toBe('verticalTree')
        expect(resolveMoveHierarchyLayout('table', 'hierarchicalCells', 'independentAxes')).toBe('horizontalRows')
        expect(resolveMoveHierarchyLayout('table', 'independentRows', 'independentAxes')).toBe('horizontalRows')
        expect(resolveMoveHierarchyLayout('verticalTree', 'hierarchicalCells', 'hierarchicalPath')).toBe('verticalTree')
    })

    it('anchors hierarchical child creation to the selected root when no explicit cell id is passed', () => {
        const root = matrixCell({ id: 'root', parentCellId: null, sortOrder: 0 })
        const setCellDialogSourceCellId = vi.fn()
        const setCellDialogPlacement = vi.fn()
        const setCellDialogMode = vi.fn()

        const { result } = renderHook(() =>
            useCellDialogActions({
                matrixMode: 'hierarchicalCells',
                allowNewAxesInCellDialog: false,
                effectiveMatrixView: 'table',
                matrixCells: [root],
                visibleMatrixCells: [root],
                selectedCellId: 'root',
                selectedCell: root,
                selectMatrixCell: vi.fn(),
                setCellDialogSourceCellId,
                setCellDialogPlacement,
                setCellDialogError: vi.fn(),
                setCellDialogMode,
                setAxisDialogKind: vi.fn()
            })
        )

        result.current.openCellDialog('create-child')

        expect(setCellDialogSourceCellId).toHaveBeenCalledWith('root')
        expect(setCellDialogPlacement).toHaveBeenCalledWith(
            expect.objectContaining({
                parentCellId: 'root'
            })
        )
        expect(setCellDialogMode).toHaveBeenCalledWith('create-child')
    })

    it('does not open hierarchical child creation without a selected parent cell', () => {
        const setCellDialogPlacement = vi.fn()
        const setCellDialogMode = vi.fn()

        const { result } = renderHook(() =>
            useCellDialogActions({
                matrixMode: 'hierarchicalCells',
                allowNewAxesInCellDialog: false,
                effectiveMatrixView: 'table',
                matrixCells: [],
                visibleMatrixCells: [],
                selectedCellId: null,
                selectedCell: undefined,
                selectMatrixCell: vi.fn(),
                setCellDialogSourceCellId: vi.fn(),
                setCellDialogPlacement,
                setCellDialogError: vi.fn(),
                setCellDialogMode,
                setAxisDialogKind: vi.fn()
            })
        )

        result.current.openCellDialog('create-child')

        expect(setCellDialogPlacement).not.toHaveBeenCalled()
        expect(setCellDialogMode).not.toHaveBeenCalled()
    })
})
