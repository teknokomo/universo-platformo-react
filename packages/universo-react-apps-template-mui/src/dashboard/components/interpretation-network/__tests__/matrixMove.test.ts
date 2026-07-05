import { describe, expect, it } from 'vitest'
import { buildMatrixMoveUpdates } from '../matrixMove'
import { buildMatrixDragPreview, resolveHierarchicalDropPlacement, resolveMatrixDropState, type MatrixDropState } from '../matrixDrag'
import type { MatrixCell, RuntimeRow } from '../model'

const cell = (id: string, parentCellId: string | null, sortOrder: number): MatrixCell => ({
    id,
    rawRowId: `row-${id}`,
    sortOrder,
    parentCellId,
    depth: parentCellId ? 1 : 0,
    rowKey: id,
    rowLabel: id,
    colKey: id,
    colLabel: id,
    title: id,
    description: '',
    materialRef: null,
    style: {
        fill: null,
        borderTop: '1px solid transparent',
        borderRight: '1px solid transparent',
        borderBottom: '1px solid transparent',
        borderLeft: '1px solid transparent'
    }
})

const rawRows = (cells: MatrixCell[]) =>
    new Map<string, RuntimeRow>(
        cells.map((item) => [
            item.id,
            {
                id: item.rawRowId,
                CellId: item.id,
                ParentCellId: item.parentCellId,
                CellValue: item.title,
                _tp_sort_order: item.sortOrder,
                _upl_version: item.sortOrder + 1
            }
        ])
    )

const buildMove = (
    cells: MatrixCell[],
    sourceCellId: string,
    targetCellId: string,
    placement: 'before' | 'after' | 'child',
    hierarchyLayout: 'horizontalRows' | 'verticalTree' = 'verticalTree'
) =>
    buildMatrixMoveUpdates({
        mode: 'hierarchicalCells',
        sourceCellId,
        targetCellId,
        placement,
        cells,
        rawRowsByCellId: rawRows(cells),
        childColumns: [
            { id: 'cell-id', codename: 'CellId', field: 'CellId' },
            { id: 'parent-id', codename: 'ParentCellId', field: 'ParentCellId' },
            { id: 'cell-value', codename: 'CellValue', field: 'CellValue' }
        ],
        locale: 'en',
        readRuntimeRowVersion: (row) => (typeof row?._upl_version === 'number' ? row._upl_version : undefined),
        readSubmittedText: (value) => String(value ?? ''),
        hierarchyLayout
    })

describe('hierarchical matrix moves', () => {
    it('uses 10-50% overlap for child placement and greater overlap for sibling insertion', () => {
        const target = { top: 100, height: 100 }
        expect(resolveHierarchicalDropPlacement({ top: 91, height: 100 }, target)).toBe('before')
        expect(resolveHierarchicalDropPlacement({ top: 190.1, height: 100 }, target)).toBeNull()
        expect(resolveHierarchicalDropPlacement({ top: 190, height: 100 }, target)).toBe('child')
        expect(resolveHierarchicalDropPlacement({ top: 150, height: 100 }, target)).toBe('child')
        expect(resolveHierarchicalDropPlacement({ top: 149.9, height: 100 }, target)).toBe('after')
        expect(resolveHierarchicalDropPlacement(null, target)).toBe('after')
    })

    it('uses horizontal leading-edge thresholds for child placement, sibling direction, and the dead-zone', () => {
        const target = { top: 100, left: 100, width: 100, height: 64 }
        expect(resolveHierarchicalDropPlacement({ top: 100, left: -1, width: 100, height: 64 }, target, 'horizontal', 0, 1)).toBeNull()
        expect(resolveHierarchicalDropPlacement({ top: 100, left: 10, width: 100, height: 64 }, target, 'horizontal', 0, 1)).toBe('child')
        expect(resolveHierarchicalDropPlacement({ top: 100, left: 50, width: 100, height: 64 }, target, 'horizontal', 0, 1)).toBe('child')
        expect(resolveHierarchicalDropPlacement({ top: 100, left: 50.1, width: 100, height: 64 }, target, 'horizontal', 0, 1)).toBe('after')
        expect(resolveHierarchicalDropPlacement({ top: 100, left: 201, width: 100, height: 64 }, target, 'horizontal', 2, 1)).toBeNull()
        expect(resolveHierarchicalDropPlacement({ top: 100, left: 190, width: 100, height: 64 }, target, 'horizontal', 2, 1)).toBe('child')
        expect(resolveHierarchicalDropPlacement({ top: 100, left: 150, width: 100, height: 64 }, target, 'horizontal', 2, 1)).toBe('child')
        expect(resolveHierarchicalDropPlacement({ top: 100, left: 149.9, width: 100, height: 64 }, target, 'horizontal', 2, 1)).toBe(
            'before'
        )
    })

    it('keeps 10-50% horizontal overlap as child placement when the preview resizes a target card', () => {
        const resizedTarget = { top: 100, left: 100, width: 180, height: 64 }

        expect(resolveHierarchicalDropPlacement({ top: 100, left: 28, width: 90, height: 64 }, resizedTarget, 'horizontal', 0, 1)).toBe(
            'child'
        )
        expect(resolveHierarchicalDropPlacement({ top: 100, left: 100, width: 120, height: 64 }, resizedTarget, 'horizontal', 0, 1)).toBe(
            'after'
        )
    })

    it('keeps same-row horizontal thresholds stable when the dragged card drifts vertically', () => {
        const target = { top: 100, left: 100, width: 180, height: 64 }

        expect(resolveHierarchicalDropPlacement({ top: 125, left: 28, width: 90, height: 64 }, target, 'horizontal', 0, 1)).toBe('child')
        expect(resolveHierarchicalDropPlacement({ top: 125, left: 100, width: 120, height: 64 }, target, 'horizontal', 0, 1)).toBe('after')
    })

    it('uses sibling placement when drag geometry is unavailable', () => {
        const target = { top: 100, left: 100, width: 160, height: 80 }
        expect(resolveHierarchicalDropPlacement(undefined, target)).toBe('after')
        expect(resolveHierarchicalDropPlacement({ top: 120, left: 170, width: 20, height: 20 }, undefined, 'horizontal')).toBe('after')
    })

    it('uses the dragged card center instead of the handle pointer for visible drop placement', () => {
        const target = { top: 100, height: 80 }
        expect(resolveHierarchicalDropPlacement({ top: 122, height: 64 }, target)).toBe('after')
        expect(resolveHierarchicalDropPlacement({ top: 94, height: 64 }, target)).toBe('before')
    })

    it('marks descendant targets invalid while preserving the visible child indicator', () => {
        const cells = [cell('root', null, 0), cell('child', 'root', 0)]
        expect(
            resolveMatrixDropState({
                mode: 'hierarchicalCells',
                cells,
                cellIds: cells.map((item) => item.id),
                sourceCellId: 'root',
                targetCellId: 'child',
                translatedRect: { top: 164, height: 80 },
                targetRect: { top: 100, height: 80 }
            })
        ).toEqual({
            activeCellId: 'root',
            overCellId: 'child',
            placement: 'child',
            isValid: false,
            destination: null
        })
    })

    it('moves a root inside another root and appends it after existing children', () => {
        const cells = [cell('source', null, 0), cell('target', null, 1), cell('existing-child', 'target', 0)]
        const result = buildMove(cells, 'source', 'target', 'child')

        expect(result?.updates[0]).toEqual(
            expect.objectContaining({
                childRowId: 'row-source',
                data: {
                    ParentCellId: 'target',
                    _tp_sort_order: 1
                }
            })
        )
        expect(result?.updates).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    childRowId: 'row-target',
                    data: { _tp_sort_order: 0 }
                })
            ])
        )
    })

    it('omits expected versions from untouched old sibling compaction updates', () => {
        const cells = [cell('root', null, 0), cell('source', 'root', 0), cell('old-next', 'root', 1), cell('target', null, 1)]
        const result = buildMove(cells, 'source', 'target', 'child')

        const oldSiblingUpdate = result?.updates.find((update) => update.childRowId === 'row-old-next')
        expect(oldSiblingUpdate).toEqual({
            childRowId: 'row-old-next',
            data: { _tp_sort_order: 0 }
        })
        expect(result?.updates[0]).toEqual(
            expect.objectContaining({
                childRowId: 'row-source',
                expectedVersion: 1
            })
        )
    })

    it('preserves the target parent for before and after sibling moves', () => {
        const cells = [cell('parent', null, 0), cell('first', 'parent', 0), cell('source', null, 1), cell('last', 'parent', 1)]

        expect(buildMove(cells, 'source', 'first', 'before')?.updates[0].data).toEqual({ ParentCellId: 'parent', _tp_sort_order: 0 })
        expect(buildMove(cells, 'source', 'first', 'after')?.updates[0].data).toEqual({ ParentCellId: 'parent', _tp_sort_order: 1 })
    })

    it('keeps horizontal sibling drops in the same row when source and target share a parent', () => {
        const cells = [cell('parent', null, 0), cell('first', 'parent', 0), cell('source', 'parent', 1), cell('last', 'parent', 2)]

        expect(buildMove(cells, 'source', 'first', 'before', 'horizontalRows')?.updates[0].data).toEqual({ _tp_sort_order: 0 })
        expect(buildMove(cells, 'source', 'last', 'after', 'horizontalRows')?.updates[0].data).toEqual({ _tp_sort_order: 2 })
    })

    it('keeps keyboard-like horizontal drops as sibling moves when source and target share a parent', () => {
        const cells = [cell('parent', null, 0), cell('first', 'parent', 0), cell('source', 'parent', 1), cell('last', 'parent', 2)]
        const dropState = resolveMatrixDropState({
            mode: 'hierarchicalCells',
            cells,
            cellIds: cells.map((item) => item.id),
            sourceCellId: 'first',
            targetCellId: 'last',
            translatedRect: null,
            targetRect: null,
            hierarchyLayout: 'horizontalRows'
        })

        expect(dropState).toEqual({
            activeCellId: 'first',
            overCellId: 'last',
            placement: 'after',
            isValid: true,
            destination: {
                placement: 'after',
                targetCellId: 'last',
                parentCellId: 'parent',
                insertionIndex: 2
            }
        })
        expect(buildMove(cells, 'first', 'last', dropState.placement!, 'horizontalRows')?.updates[0].data).toEqual({ _tp_sort_order: 2 })
    })

    it('keeps horizontal same-row drops inert while the dragged card is inside the dead-zone', () => {
        const cells = [cell('parent', null, 0), cell('first', 'parent', 0), cell('source', 'parent', 1)]
        const dropState = resolveMatrixDropState({
            mode: 'hierarchicalCells',
            cells,
            cellIds: cells.map((item) => item.id),
            sourceCellId: 'source',
            targetCellId: 'first',
            translatedRect: { top: 100, left: 291, width: 100, height: 64 },
            targetRect: { top: 100, left: 100, width: 100, height: 64 },
            hierarchyLayout: 'horizontalRows'
        })

        expect(dropState).toEqual({
            activeCellId: 'source',
            overCellId: 'first',
            placement: null,
            isValid: false,
            destination: null
        })
    })

    it('uses 25-50-25 target zones when dragging a deeply nested cell to a higher horizontal row', () => {
        const cells = [
            cell('root', null, 0),
            cell('target', 'root', 0),
            cell('source-parent', 'root', 1),
            cell('source-grandparent', 'source-parent', 0),
            cell('source', 'source-grandparent', 0)
        ]
        const resolveAtCenter = (centerX: number) =>
            resolveMatrixDropState({
                mode: 'hierarchicalCells',
                cells,
                cellIds: cells.map((item) => item.id),
                sourceCellId: 'source',
                targetCellId: 'target',
                translatedRect: { top: 100, left: centerX - 40, width: 80, height: 64 },
                targetRect: { top: 100, left: 100, width: 100, height: 64 },
                hierarchyLayout: 'horizontalRows'
            })

        expect(resolveAtCenter(124.9).destination).toEqual({
            placement: 'before',
            targetCellId: 'target',
            parentCellId: 'root',
            insertionIndex: 0
        })
        expect(resolveAtCenter(125).destination).toEqual({
            placement: 'child',
            targetCellId: 'target',
            parentCellId: 'target',
            insertionIndex: 0
        })
        expect(resolveAtCenter(175).destination).toEqual({
            placement: 'child',
            targetCellId: 'target',
            parentCellId: 'target',
            insertionIndex: 0
        })
        expect(resolveAtCenter(175.1).destination).toEqual({
            placement: 'after',
            targetCellId: 'target',
            parentCellId: 'root',
            insertionIndex: 1
        })
    })

    it('keeps higher-level center drops invalid when the target is inside the dragged cell subtree', () => {
        const cells = [cell('root', null, 0), cell('source', 'root', 0), cell('child', 'source', 0), cell('grandchild', 'child', 0)]

        expect(
            resolveMatrixDropState({
                mode: 'hierarchicalCells',
                cells,
                cellIds: cells.map((item) => item.id),
                sourceCellId: 'source',
                targetCellId: 'grandchild',
                translatedRect: { top: 100, left: 110, width: 80, height: 64 },
                targetRect: { top: 100, left: 100, width: 100, height: 64 },
                hierarchyLayout: 'horizontalRows'
            })
        ).toEqual({
            activeCellId: 'source',
            overCellId: 'grandchild',
            placement: 'after',
            isValid: false,
            destination: null
        })
    })

    it('keeps horizontal edge drops across hierarchy levels as explicit sibling moves', () => {
        const cells = [
            cell('root', null, 0),
            cell('source-parent', 'root', 0),
            cell('source', 'source-parent', 0),
            cell('target-parent', 'root', 1),
            cell('target', 'target-parent', 0)
        ]

        expect(buildMove(cells, 'source', 'target', 'before', 'horizontalRows')?.updates[0].data).toEqual({
            ParentCellId: 'target-parent',
            _tp_sort_order: 0
        })
    })

    it('coerces root edge drops into child moves to preserve the single root', () => {
        const cells = [cell('root', null, 0), cell('previous-parent', 'root', 0), cell('source', 'previous-parent', 0)]

        expect(
            resolveMatrixDropState({
                mode: 'hierarchicalCells',
                cells,
                cellIds: cells.map((item) => item.id),
                sourceCellId: 'source',
                targetCellId: 'root',
                translatedRect: { top: 70, height: 80 },
                targetRect: { top: 100, height: 80 },
                hierarchyLayout: 'verticalTree'
            }).placement
        ).toBe('child')
        expect(buildMove(cells, 'source', 'root', 'before')?.updates[0].data).toEqual({ ParentCellId: 'root', _tp_sort_order: 1 })
    })

    it('keeps direct root child edge drops as sort-only updates without resubmitting identity fields', () => {
        const cells = [cell('root', null, 0), cell('first', 'root', 0), cell('source', 'root', 1)]

        expect(buildMove(cells, 'first', 'root', 'after')?.updates[0].data).toEqual({ _tp_sort_order: 1 })
    })

    it('rejects moving a cell inside its own descendant', () => {
        const cells = [cell('root', null, 0), cell('child', 'root', 0), cell('grandchild', 'child', 0)]
        expect(buildMove(cells, 'root', 'grandchild', 'child')).toBeNull()
    })

    it('projects a child placeholder after existing children without mutating input cells', () => {
        const cells = [cell('root', null, 0), cell('source', 'root', 0), cell('target', 'root', 1), cell('child', 'target', 0)]
        const before = structuredClone(cells)
        const state: MatrixDropState = {
            activeCellId: 'source',
            overCellId: 'target',
            placement: 'child',
            isValid: true,
            destination: {
                placement: 'child',
                targetCellId: 'target',
                parentCellId: 'target',
                insertionIndex: 1
            }
        }

        const preview = buildMatrixDragPreview(cells, state)

        expect(preview?.hierarchyRows.map((row) => row.map((item) => item.id))).toEqual([['root'], ['target'], ['child', 'source']])
        expect(cells).toEqual(before)
    })

    it('projects cross-level sibling insertion at the exact destination slot', () => {
        const cells = [
            cell('root', null, 0),
            cell('source-parent', 'root', 0),
            cell('target-parent', 'root', 1),
            cell('source', 'source-parent', 0),
            cell('first', 'target-parent', 0),
            cell('target', 'target-parent', 1)
        ]
        const state = resolveMatrixDropState({
            mode: 'hierarchicalCells',
            cells,
            cellIds: cells.map((item) => item.id),
            sourceCellId: 'source',
            targetCellId: 'target',
            translatedRect: { top: 100, left: 100, width: 100, height: 64 },
            targetRect: { top: 100, left: 100, width: 100, height: 64 },
            hierarchyLayout: 'horizontalRows'
        })

        expect(buildMatrixDragPreview(cells, state)?.hierarchyRows.map((row) => row.map((item) => item.id))).toEqual([
            ['root'],
            ['source-parent', 'target-parent'],
            ['first', 'target', 'source']
        ])
    })

    it('focuses the drag preview on the destination branch instead of the stale selected path', () => {
        const cells = [
            cell('root', null, 0),
            cell('old-parent', 'root', 0),
            cell('target-parent', 'root', 1),
            cell('source-parent', 'old-parent', 0),
            cell('source', 'source-parent', 0),
            cell('target', 'target-parent', 0)
        ]
        const state = resolveMatrixDropState({
            mode: 'hierarchicalCells',
            cells,
            cellIds: cells.map((item) => item.id),
            sourceCellId: 'source',
            targetCellId: 'target',
            translatedRect: { top: 100, left: 110, width: 80, height: 64 },
            targetRect: { top: 100, left: 100, width: 100, height: 64 },
            hierarchyLayout: 'horizontalRows'
        })

        expect(
            buildMatrixDragPreview(cells, state, { hierarchyRowMode: 'focusedPath', selectedCellId: 'old-parent' })?.hierarchyRows.map(
                (row) => row.map((item) => item.id)
            )
        ).toEqual([['root'], ['old-parent', 'target-parent'], ['target'], ['source']])
    })
})
