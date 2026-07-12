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
    it('uses vertical edge zones for sibling insertion and the center zone for child placement', () => {
        const target = { top: 100, height: 100 }
        expect(resolveHierarchicalDropPlacement({ top: 0, height: 100 }, target)).toBeNull()
        expect(resolveHierarchicalDropPlacement({ top: 50, height: 100 }, target)).toBe('before')
        expect(resolveHierarchicalDropPlacement({ top: 75, height: 100 }, target)).toBe('child')
        expect(resolveHierarchicalDropPlacement({ top: 125, height: 100 }, target)).toBe('child')
        expect(resolveHierarchicalDropPlacement({ top: 125.1, height: 100 }, target)).toBe('after')
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
        expect(resolveHierarchicalDropPlacement({ top: 87.9, height: 64 }, target)).toBe('before')
        expect(resolveHierarchicalDropPlacement({ top: 88.1, height: 64 }, target)).toBe('child')
        expect(resolveHierarchicalDropPlacement({ top: 122, height: 64 }, target)).toBe('child')
        expect(resolveHierarchicalDropPlacement({ top: 128.1, height: 64 }, target)).toBe('after')
    })

    it('resolves vertical table-style center drops as child destinations and edge drops as sibling destinations', () => {
        const cells = [cell('root', null, 0), cell('target', 'root', 0), cell('source', 'root', 1)]
        const resolveAtCenter = (centerY: number) =>
            resolveMatrixDropState({
                mode: 'hierarchicalCells',
                cells,
                cellIds: cells.map((item) => item.id),
                sourceCellId: 'source',
                targetCellId: 'target',
                translatedRect: { top: centerY - 32, height: 64 },
                targetRect: { top: 100, height: 80 }
            })

        expect(resolveAtCenter(119.9).destination).toEqual({
            placement: 'before',
            targetCellId: 'target',
            parentCellId: 'root',
            insertionIndex: 0
        })
        expect(resolveAtCenter(120).destination).toEqual({
            placement: 'child',
            targetCellId: 'target',
            parentCellId: 'target',
            insertionIndex: 0
        })
        expect(resolveAtCenter(160).destination).toEqual({
            placement: 'child',
            targetCellId: 'target',
            parentCellId: 'target',
            insertionIndex: 0
        })
        expect(resolveAtCenter(160.1).destination).toEqual({
            placement: 'after',
            targetCellId: 'target',
            parentCellId: 'root',
            insertionIndex: 1
        })
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
                translatedRect: { top: 110, height: 80 },
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

    it('rejects drop targets that are present in the full snapshot but hidden from the active view', () => {
        const cells = [cell('root', null, 0), cell('visible', 'root', 0), cell('hidden', 'visible', 0)]

        expect(
            resolveMatrixDropState({
                mode: 'hierarchicalCells',
                cells,
                cellIds: ['root', 'visible'],
                sourceCellId: 'visible',
                targetCellId: 'hidden',
                translatedRect: { top: 164, height: 80 },
                targetRect: { top: 100, height: 80 },
                hierarchyLayout: 'horizontalRows'
            })
        ).toEqual({
            activeCellId: 'visible',
            overCellId: 'hidden',
            placement: null,
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

    it('adds expected versions to sibling compaction updates', () => {
        const cells = [cell('root', null, 0), cell('source', 'root', 0), cell('old-next', 'root', 1), cell('target', null, 1)]
        const result = buildMove(cells, 'source', 'target', 'child')

        const oldSiblingUpdate = result?.updates.find((update) => update.childRowId === 'row-old-next')
        expect(oldSiblingUpdate).toEqual({
            childRowId: 'row-old-next',
            data: { _tp_sort_order: 0 },
            expectedVersion: 2
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

    it('uses horizontal geometry for table-style hierarchy drops instead of vertical tree semantics', () => {
        const cells = [cell('parent', null, 0), cell('first', 'parent', 0), cell('source', 'parent', 1)]
        const geometry = {
            translatedRect: { top: 10, left: 160, width: 100, height: 64 },
            targetRect: { top: 100, left: 100, width: 100, height: 64 }
        }

        expect(
            resolveMatrixDropState({
                mode: 'hierarchicalCells',
                cells,
                cellIds: cells.map((item) => item.id),
                sourceCellId: 'source',
                targetCellId: 'first',
                ...geometry,
                hierarchyLayout: 'verticalTree'
            }).placement
        ).toBeNull()
        expect(
            resolveMatrixDropState({
                mode: 'hierarchicalCells',
                cells,
                cellIds: cells.map((item) => item.id),
                sourceCellId: 'source',
                targetCellId: 'first',
                ...geometry,
                hierarchyLayout: 'horizontalRows'
            }).placement
        ).toBe('child')
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

describe('independent matrix table moves', () => {
    const independentCells: MatrixCell[] = [
        {
            ...cell('meaning', null, 0),
            rowKey: 'definition',
            rowLabel: 'Definition',
            colKey: 'meaning',
            colLabel: 'Meaning'
        },
        {
            ...cell('source', null, 1),
            rowKey: 'definition',
            rowLabel: 'Definition',
            colKey: 'source',
            colLabel: 'Source'
        },
        {
            ...cell('example', null, 2),
            rowKey: 'example',
            rowLabel: 'Example',
            colKey: 'meaning',
            colLabel: 'Meaning'
        }
    ]

    const independentRawRows = new Map<string, RuntimeRow>(
        independentCells.map((item) => [
            item.id,
            {
                id: item.rawRowId,
                CellId: item.id,
                RowKey: item.rowKey,
                RowLabel: item.rowLabel,
                ColKey: item.colKey,
                ColLabel: item.colLabel,
                CellValue: item.title,
                CellDescription: `${item.title} description`,
                _tp_sort_order: item.sortOrder,
                _upl_version: item.sortOrder + 1
            }
        ])
    )
    const childColumns = [
        { id: 'cell-id', codename: 'CellId', field: 'CellId' },
        { id: 'row-key', codename: 'RowKey', field: 'RowKey' },
        { id: 'row-label', codename: 'RowLabel', field: 'RowLabel' },
        { id: 'col-key', codename: 'ColKey', field: 'ColKey' },
        { id: 'col-label', codename: 'ColLabel', field: 'ColLabel' },
        { id: 'cell-value', codename: 'CellValue', field: 'CellValue' },
        { id: 'cell-description', codename: 'CellDescription', field: 'CellDescription' }
    ]

    it('resolves an empty table intersection as an explicit coordinate destination', () => {
        expect(
            resolveMatrixDropState({
                mode: 'independentRows',
                cells: independentCells,
                cellIds: independentCells.map((item) => item.id),
                sourceCellId: 'source',
                targetCellId: 'matrix-table-slot:example:source',
                tableSlot: {
                    rowKey: 'example',
                    rowLabel: 'Example',
                    colKey: 'source',
                    colLabel: 'Source'
                }
            })
        ).toEqual({
            activeCellId: 'source',
            overCellId: 'matrix-table-slot:example:source',
            placement: 'child',
            isValid: true,
            destination: {
                placement: 'child',
                targetCellId: 'matrix-table-slot:example:source',
                parentCellId: null,
                insertionIndex: 1,
                tableSlot: {
                    rowKey: 'example',
                    rowLabel: 'Example',
                    colKey: 'source',
                    colLabel: 'Source'
                }
            }
        })
    })

    it('moves a cell into an empty table intersection without generating new axis keys or replacing user content', () => {
        const result = buildMatrixMoveUpdates({
            mode: 'independentRows',
            sourceCellId: 'source',
            targetCellId: 'matrix-table-slot:example:source',
            placement: 'child',
            destination: {
                placement: 'child',
                targetCellId: 'matrix-table-slot:example:source',
                parentCellId: null,
                insertionIndex: 1,
                tableSlot: {
                    rowKey: 'example',
                    rowLabel: 'Example',
                    colKey: 'source',
                    colLabel: 'Source'
                }
            },
            cells: independentCells,
            rawRowsByCellId: independentRawRows,
            childColumns,
            locale: 'en',
            readRuntimeRowVersion: (row) => (typeof row?._upl_version === 'number' ? row._upl_version : undefined),
            readSubmittedText: (value) => String(value ?? '')
        })

        expect(result?.updates[0]).toEqual({
            childRowId: 'row-source',
            expectedVersion: 2,
            data: expect.objectContaining({
                CellId: 'source',
                RowKey: 'example',
                RowLabel: expect.objectContaining({
                    locales: expect.objectContaining({ en: expect.objectContaining({ content: 'Example' }) })
                }),
                ColKey: 'source',
                ColLabel: expect.objectContaining({
                    locales: expect.objectContaining({ en: expect.objectContaining({ content: 'Source' }) })
                }),
                CellValue: 'source',
                CellDescription: 'source description',
                _tp_sort_order: 1
            })
        })
        expect(result?.updates).toEqual(
            expect.arrayContaining([
                {
                    childRowId: 'row-example',
                    data: { _tp_sort_order: 0 },
                    expectedVersion: 3
                }
            ])
        )
        const sortOrderUpdates = result?.updates.map((update) => [update.childRowId, update.data._tp_sort_order])
        expect(sortOrderUpdates).toEqual([
            ['row-source', 1],
            ['row-example', 0]
        ])
        expect(JSON.stringify(result)).not.toMatch(/column-[0-9a-f]{8}/i)
    })

    it('preserves localized axis label values when moving into an empty table intersection', () => {
        const localizedRowLabel = {
            locales: {
                en: { content: 'Example' },
                ru: { content: 'Пример' }
            }
        }
        const localizedColumnLabel = {
            locales: {
                en: { content: 'Source' },
                ru: { content: 'Источник' }
            }
        }
        const result = buildMatrixMoveUpdates({
            mode: 'independentRows',
            sourceCellId: 'source',
            targetCellId: 'matrix-table-slot:example:source',
            placement: 'child',
            destination: {
                placement: 'child',
                targetCellId: 'matrix-table-slot:example:source',
                parentCellId: null,
                insertionIndex: 1,
                tableSlot: {
                    rowKey: 'example',
                    rowLabel: 'Example',
                    rowLabelValue: localizedRowLabel,
                    colKey: 'source',
                    colLabel: 'Source',
                    colLabelValue: localizedColumnLabel
                }
            },
            cells: independentCells,
            rawRowsByCellId: independentRawRows,
            childColumns,
            locale: 'en',
            readRuntimeRowVersion: (row) => (typeof row?._upl_version === 'number' ? row._upl_version : undefined),
            readSubmittedText: (value) => String(value ?? '')
        })

        expect(result?.updates[0].data).toEqual(
            expect.objectContaining({
                RowLabel: localizedRowLabel,
                ColLabel: localizedColumnLabel
            })
        )
    })

    it('renumbers both affected rows when moving into an empty later-row table intersection', () => {
        const result = buildMatrixMoveUpdates({
            mode: 'independentRows',
            sourceCellId: 'meaning',
            targetCellId: 'matrix-table-slot:example:source',
            placement: 'child',
            destination: {
                placement: 'child',
                targetCellId: 'matrix-table-slot:example:source',
                parentCellId: null,
                insertionIndex: 1,
                tableSlot: {
                    rowKey: 'example',
                    rowLabel: 'Example',
                    colKey: 'source',
                    colLabel: 'Source'
                }
            },
            cells: independentCells,
            rawRowsByCellId: independentRawRows,
            childColumns,
            locale: 'en',
            readRuntimeRowVersion: (row) => (typeof row?._upl_version === 'number' ? row._upl_version : undefined),
            readSubmittedText: (value) => String(value ?? '')
        })

        expect(result?.updates).toEqual([
            expect.objectContaining({
                childRowId: 'row-meaning',
                data: expect.objectContaining({
                    RowKey: 'example',
                    ColKey: 'source',
                    _tp_sort_order: 1
                })
            }),
            {
                childRowId: 'row-source',
                data: { _tp_sort_order: 0 },
                expectedVersion: 2
            },
            {
                childRowId: 'row-example',
                data: { _tp_sort_order: 0 },
                expectedVersion: 3
            }
        ])
    })

    it('rejects a stale empty table intersection that is already occupied in the current snapshot', () => {
        expect(
            buildMatrixMoveUpdates({
                mode: 'independentRows',
                sourceCellId: 'source',
                targetCellId: 'matrix-table-slot:example:meaning',
                placement: 'child',
                destination: {
                    placement: 'child',
                    targetCellId: 'matrix-table-slot:example:meaning',
                    parentCellId: null,
                    insertionIndex: 1,
                    tableSlot: {
                        rowKey: 'example',
                        rowLabel: 'Example',
                        colKey: 'meaning',
                        colLabel: 'Meaning'
                    }
                },
                cells: independentCells,
                rawRowsByCellId: independentRawRows,
                childColumns,
                locale: 'en',
                readRuntimeRowVersion: (row) => (typeof row?._upl_version === 'number' ? row._upl_version : undefined),
                readSubmittedText: (value) => String(value ?? '')
            })
        ).toBeNull()
    })
})

describe('matrix table coordinate moves', () => {
    const cells: MatrixCell[] = [
        {
            ...cell('root', null, 0),
            rowKey: 'root',
            rowLabel: 'Root',
            colKey: 'root-column',
            colLabel: 'Root column'
        },
        {
            ...cell('parent', 'root', 0),
            rowKey: 'parent',
            rowLabel: 'Parent',
            colKey: 'parent-column',
            colLabel: 'Parent column'
        },
        {
            ...cell('source', 'parent', 0),
            rowKey: 'source',
            rowLabel: 'Source',
            colKey: 'source-column',
            colLabel: 'Source column'
        },
        {
            ...cell('target-row', 'root', 1),
            rowKey: 'target-row',
            rowLabel: 'Target row',
            colKey: 'target-column',
            colLabel: 'Target column'
        }
    ]
    const rawRowsWithCoordinates = new Map<string, RuntimeRow>(
        cells.map((item) => [
            item.id,
            {
                id: item.rawRowId,
                CellId: item.id,
                ParentCellId: item.parentCellId,
                RowKey: item.rowKey,
                RowLabel: item.rowLabel,
                ColKey: item.colKey,
                ColLabel: item.colLabel,
                CellValue: item.title,
                _tp_sort_order: item.sortOrder,
                _upl_version: item.sortOrder + 1
            }
        ])
    )
    const childColumns = [
        { id: 'cell-id', codename: 'CellId', field: 'CellId' },
        { id: 'parent-id', codename: 'ParentCellId', field: 'ParentCellId' },
        { id: 'row-key', codename: 'RowKey', field: 'RowKey' },
        { id: 'row-label', codename: 'RowLabel', field: 'RowLabel' },
        { id: 'col-key', codename: 'ColKey', field: 'ColKey' },
        { id: 'col-label', codename: 'ColLabel', field: 'ColLabel' },
        { id: 'cell-value', codename: 'CellValue', field: 'CellValue' }
    ]

    it('resolves an empty table intersection in hierarchical mode while preserving the source parent', () => {
        expect(
            resolveMatrixDropState({
                mode: 'hierarchicalCells',
                cells,
                cellIds: cells.map((item) => item.id),
                sourceCellId: 'source',
                targetCellId: 'matrix-table-slot:target-row:root-column',
                tableSlot: {
                    rowKey: 'target-row',
                    rowLabel: 'Target row',
                    colKey: 'root-column',
                    colLabel: 'Root column'
                }
            })
        ).toEqual({
            activeCellId: 'source',
            overCellId: 'matrix-table-slot:target-row:root-column',
            placement: 'child',
            isValid: true,
            destination: {
                placement: 'child',
                targetCellId: 'matrix-table-slot:target-row:root-column',
                parentCellId: 'parent',
                insertionIndex: 1,
                tableSlot: {
                    rowKey: 'target-row',
                    rowLabel: 'Target row',
                    colKey: 'root-column',
                    colLabel: 'Root column'
                }
            }
        })
    })

    it('moves a hierarchical cell into a free table intersection without changing tree parent or sibling order', () => {
        const result = buildMatrixMoveUpdates({
            mode: 'hierarchicalCells',
            sourceCellId: 'source',
            targetCellId: 'matrix-table-slot:target-row:root-column',
            placement: 'child',
            destination: {
                placement: 'child',
                targetCellId: 'matrix-table-slot:target-row:root-column',
                parentCellId: 'parent',
                insertionIndex: 1,
                tableSlot: {
                    rowKey: 'target-row',
                    rowLabel: 'Target row',
                    colKey: 'root-column',
                    colLabel: 'Root column'
                }
            },
            cells,
            rawRowsByCellId: rawRowsWithCoordinates,
            childColumns,
            locale: 'en',
            readRuntimeRowVersion: (row) => (typeof row?._upl_version === 'number' ? row._upl_version : undefined),
            readSubmittedText: (value) => String(value ?? '')
        })

        expect(result?.updates[0]).toEqual({
            childRowId: 'row-source',
            expectedVersion: 1,
            data: expect.objectContaining({
                CellId: 'source',
                RowKey: 'target-row',
                RowLabel: expect.objectContaining({
                    locales: expect.objectContaining({ en: expect.objectContaining({ content: 'Target row' }) })
                }),
                ColKey: 'root-column',
                ColLabel: expect.objectContaining({
                    locales: expect.objectContaining({ en: expect.objectContaining({ content: 'Root column' }) })
                })
            })
        })
        expect(result?.updates[0].data).not.toHaveProperty('ParentCellId')
        expect(result?.updates[0].data).not.toHaveProperty('_tp_sort_order')
        expect(result?.updates).toHaveLength(1)
    })

    it('rejects an occupied table intersection in hierarchical mode', () => {
        expect(
            buildMatrixMoveUpdates({
                mode: 'hierarchicalCells',
                sourceCellId: 'source',
                targetCellId: 'matrix-table-slot:target-row:target-column',
                placement: 'child',
                destination: {
                    placement: 'child',
                    targetCellId: 'matrix-table-slot:target-row:target-column',
                    parentCellId: 'parent',
                    insertionIndex: 1,
                    tableSlot: {
                        rowKey: 'target-row',
                        rowLabel: 'Target row',
                        colKey: 'target-column',
                        colLabel: 'Target column'
                    }
                },
                cells,
                rawRowsByCellId: rawRowsWithCoordinates,
                childColumns,
                locale: 'en',
                readRuntimeRowVersion: (row) => (typeof row?._upl_version === 'number' ? row._upl_version : undefined),
                readSubmittedText: (value) => String(value ?? '')
            })
        ).toBeNull()
    })
})
