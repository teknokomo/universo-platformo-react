import { describe, expect, it } from 'vitest'
import {
    buildMatrixTree,
    buildMatrixPositionLabels,
    buildRootUniverseMatrixCellData,
    flattenMatrixTree,
    parseMatrixHierarchyLayout,
    parseMatrixHierarchyRowMode,
    parseMatrixMode,
    parseMatrixPositionNumbering,
    toFocusedMatrixHierarchyRows,
    toMatrixHierarchyRows,
    toMatrixRows,
    type MatrixCell,
    type RuntimeColumnLike
} from '../model'
import { buildCellCreateData, buildCellDialogInitialData, mergeCellCreateData } from '../matrixCellData'

const matrixColumn: RuntimeColumnLike = {
    id: 'matrix-component',
    codename: 'InterpretationMatrix',
    field: 'InterpretationMatrix',
    dataType: 'TABLE',
    childColumns: [
        { id: 'cell-id', codename: 'CellId', field: 'CellId' },
        { id: 'parent-cell-id', codename: 'ParentCellId', field: 'ParentCellId' },
        { id: 'row-key', codename: 'RowKey', field: 'RowKey' },
        { id: 'row-label', codename: 'RowLabel', field: 'RowLabel' },
        { id: 'col-key', codename: 'ColKey', field: 'ColKey' },
        { id: 'col-label', codename: 'ColLabel', field: 'ColLabel' },
        { id: 'value', codename: 'CellValue', field: 'CellValue' },
        {
            id: 'fill',
            codename: 'CellFillColor',
            field: 'CellFillColor',
            dataType: 'REF',
            refOptions: [{ id: 'none', codename: 'none', label: 'None' }]
        }
    ]
}

describe('interpretation network model', () => {
    it('appends a new hierarchical child after its existing siblings', () => {
        const parent = { id: 'parent', parentCellId: null, sortOrder: 0 } as MatrixCell
        const existingCells = [
            parent,
            { id: 'child-1', parentCellId: 'parent', sortOrder: 0 } as MatrixCell,
            { id: 'child-2', parentCellId: 'parent', sortOrder: 3 } as MatrixCell,
            { id: 'other-child', parentCellId: 'other-parent', sortOrder: 9 } as MatrixCell
        ]

        expect(
            buildCellCreateData({
                mode: 'create-child',
                childColumns: matrixColumn.childColumns,
                locale: 'en',
                source: parent,
                existingCells,
                newRowLabel: 'New row',
                newCellLabel: 'New child'
            })._tp_sort_order
        ).toBe(4)
    })

    it('appends an independent row after existing root cells only', () => {
        const source = { id: 'source', parentCellId: null, sortOrder: 0, colKey: 'source-col', colLabel: 'Source column' } as MatrixCell
        const existingCells = [
            source,
            { id: 'root-2', parentCellId: null, sortOrder: 3 } as MatrixCell,
            { id: 'child-1', parentCellId: 'source', sortOrder: 9 } as MatrixCell
        ]

        const createData = buildCellCreateData({
            mode: 'create-row',
            childColumns: matrixColumn.childColumns,
            locale: 'en',
            source,
            existingCells,
            newRowLabel: 'New row',
            newCellLabel: 'New cell'
        })

        expect(createData._tp_sort_order).toBe(4)
        expect(createData.ParentCellId).toBeNull()
    })

    it('keeps trusted generated cell ids when create form data contains hidden undefined fields', () => {
        expect(
            mergeCellCreateData(
                {
                    CellId: undefined,
                    ParentCellId: undefined,
                    RowKey: undefined,
                    ColKey: undefined,
                    CellValue: 'Visible title'
                },
                {
                    CellId: 'generated-cell',
                    ParentCellId: 'parent-cell',
                    RowKey: 'row-generated-cell',
                    ColKey: 'column-generated-cell',
                    CellValue: 'Default title'
                }
            )
        ).toEqual({
            CellId: 'generated-cell',
            ParentCellId: 'parent-cell',
            RowKey: 'row-generated-cell',
            ColKey: 'column-generated-cell',
            CellValue: 'Visible title'
        })
    })

    it('keeps user-entered create fields while protecting generated matrix placement fields', () => {
        expect(
            mergeCellCreateData(
                {
                    CellValue: 'User title',
                    CellDescription: 'User description',
                    CellFillColor: 'blue',
                    RowKey: undefined
                },
                {
                    CellId: 'generated-cell',
                    ParentCellId: null,
                    RowKey: 'row-generated-cell',
                    RowLabel: 'Generated row',
                    ColKey: 'column-generated-cell',
                    ColLabel: 'Generated column',
                    CellValue: 'Default title',
                    CellDescription: '',
                    CellFillColor: 'none'
                }
            )
        ).toEqual({
            CellId: 'generated-cell',
            ParentCellId: null,
            RowKey: 'row-generated-cell',
            RowLabel: 'Generated row',
            ColKey: 'column-generated-cell',
            ColLabel: 'Generated column',
            CellValue: 'User title',
            CellDescription: 'User description',
            CellFillColor: 'blue'
        })
    })

    it('defaults unknown matrix modes to hierarchical cells', () => {
        expect(parseMatrixMode('independentRows')).toBe('independentRows')
        expect(parseMatrixMode('hierarchicalCells')).toBe('hierarchicalCells')
        expect(parseMatrixMode('legacy')).toBe('hierarchicalCells')
        expect(parseMatrixMode(undefined)).toBe('hierarchicalCells')
    })

    it('parses hierarchy layout and position numbering defaults', () => {
        expect(parseMatrixHierarchyLayout('verticalTree')).toBe('verticalTree')
        expect(parseMatrixHierarchyLayout('horizontalRows')).toBe('horizontalRows')
        expect(parseMatrixHierarchyLayout('legacy')).toBe('horizontalRows')
        expect(parseMatrixHierarchyRowMode('allNodes')).toBe('allNodes')
        expect(parseMatrixHierarchyRowMode('focusedPath')).toBe('focusedPath')
        expect(parseMatrixHierarchyRowMode('legacy')).toBe('focusedPath')
        expect(parseMatrixPositionNumbering(undefined)).toEqual({ enabled: true, includeRoot: true, startIndex: 1 })
        expect(parseMatrixPositionNumbering({ enabled: false, includeRoot: false, startIndex: 0 })).toEqual({
            enabled: false,
            includeRoot: false,
            startIndex: 0
        })
        expect(parseMatrixPositionNumbering({ startIndex: -1 })).toEqual({ enabled: true, includeRoot: true, startIndex: 1 })
    })

    it('builds a bilingual Universe root cell without locale-only fallback', () => {
        const cell = buildRootUniverseMatrixCellData(matrixColumn.childColumns, 'ru')

        expect(cell.CellId).toEqual(expect.any(String))
        expect(cell.ParentCellId).toBeNull()
        for (const field of ['RowLabel', 'ColLabel', 'CellValue']) {
            expect(cell[field]).toEqual(
                expect.objectContaining({
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: 'Universe' }),
                        ru: expect.objectContaining({ content: 'Вселенная' })
                    })
                })
            )
        }
    })

    it('keeps manual empty create-row paths on regular user-entered cell defaults', () => {
        const initialData = buildCellDialogInitialData({
            mode: 'create-row',
            cellMetadataFields: [],
            styleFields: [],
            childColumns: matrixColumn.childColumns,
            locale: 'en',
            selectedCell: undefined,
            selectedRawCell: undefined,
            newRowLabel: 'New row',
            newCellLabel: 'New cell'
        })
        const createData = buildCellCreateData({
            mode: 'create-row',
            childColumns: matrixColumn.childColumns,
            locale: 'en',
            source: undefined,
            existingCells: [],
            newRowLabel: 'New row',
            newCellLabel: 'New cell'
        })

        for (const rootCell of [initialData, createData]) {
            expect(rootCell.ParentCellId).toBeNull()
            expect(rootCell.CellValue).toEqual(
                expect.objectContaining({
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: 'New cell' })
                    })
                })
            )
            expect(rootCell.CellValue).not.toEqual(
                expect.objectContaining({
                    locales: expect.objectContaining({
                        ru: expect.objectContaining({ content: 'Вселенная' })
                    })
                })
            )
        }
        expect(createData._tp_sort_order).toBe(0)
    })

    it('preserves backend matrix cell order instead of sorting by labels', () => {
        const cells = toMatrixRows(
            [
                {
                    id: 'row-source-2',
                    _tp_sort_order: 0,
                    CellId: 'source-2',
                    RowKey: 'definition',
                    RowLabel: 'Definition',
                    ColKey: 'column-019f1518-5d18-7000-8000-000000000002',
                    ColLabel: 'Source 2',
                    CellValue: 'Moved source'
                },
                {
                    id: 'row-meaning',
                    _tp_sort_order: 1,
                    CellId: 'meaning',
                    RowKey: 'definition',
                    RowLabel: 'Definition',
                    ColKey: 'meaning',
                    ColLabel: 'Meaning',
                    CellValue: 'Meaning'
                },
                {
                    id: 'row-source',
                    _tp_sort_order: 2,
                    CellId: 'source',
                    RowKey: 'definition',
                    RowLabel: 'Definition',
                    ColKey: 'source',
                    ColLabel: 'Source',
                    CellValue: 'Source'
                },
                {
                    id: 'row-example',
                    _tp_sort_order: 3,
                    CellId: 'example',
                    RowKey: 'example',
                    RowLabel: 'Example',
                    ColKey: 'meaning',
                    ColLabel: 'Meaning',
                    CellValue: 'Example'
                }
            ],
            matrixColumn,
            'en'
        )

        expect(cells.map((cell) => `${cell.rowLabel}:${cell.colLabel}`)).toEqual([
            'Definition:Source 2',
            'Definition:Meaning',
            'Definition:Source',
            'Example:Meaning'
        ])
        expect(cells.map((cell) => [cell.rawRowId, cell.sortOrder])).toEqual([
            ['row-source-2', 0],
            ['row-meaning', 1],
            ['row-source', 2],
            ['row-example', 3]
        ])
    })

    it('parses parent cell ids and flattens hierarchy in sibling order', () => {
        const cells = toMatrixRows(
            [
                {
                    id: 'row-root',
                    _tp_sort_order: 0,
                    CellId: 'root',
                    RowKey: 'root',
                    RowLabel: 'Root',
                    ColKey: 'root',
                    ColLabel: 'Root',
                    CellValue: 'Root'
                },
                {
                    id: 'row-child-b',
                    _tp_sort_order: 1,
                    CellId: 'child-b',
                    ParentCellId: 'root',
                    RowKey: 'child-b',
                    RowLabel: 'Child B',
                    ColKey: 'child-b',
                    ColLabel: 'Child B',
                    CellValue: 'Child B'
                },
                {
                    id: 'row-child-a',
                    _tp_sort_order: 0,
                    CellId: 'child-a',
                    ParentCellId: 'root',
                    RowKey: 'child-a',
                    RowLabel: 'Child A',
                    ColKey: 'child-a',
                    ColLabel: 'Child A',
                    CellValue: 'Child A'
                }
            ],
            matrixColumn,
            'en'
        )

        expect(flattenMatrixTree(buildMatrixTree(cells)).map((cell) => [cell.id, cell.parentCellId, cell.depth])).toEqual([
            ['root', null, 0],
            ['child-a', 'root', 1],
            ['child-b', 'root', 1]
        ])
        expect(toMatrixHierarchyRows(flattenMatrixTree(buildMatrixTree(cells))).map((row) => row.map((cell) => cell.id))).toEqual([
            ['root'],
            ['child-a', 'child-b']
        ])
        expect(
            Object.fromEntries(
                buildMatrixPositionLabels(buildMatrixTree(cells), {
                    enabled: true,
                    includeRoot: true,
                    startIndex: 1
                })
            )
        ).toEqual({
            root: '1',
            'child-a': '1/1',
            'child-b': '1/2'
        })
        expect(
            Object.fromEntries(
                buildMatrixPositionLabels(buildMatrixTree(cells), {
                    enabled: true,
                    includeRoot: false,
                    startIndex: 0
                })
            )
        ).toEqual({
            'child-a': '0',
            'child-b': '1'
        })
    })

    it('renders cyclic parent links as roots instead of recursing or hiding cells', () => {
        const cells = toMatrixRows(
            [
                {
                    id: 'row-a',
                    _tp_sort_order: 0,
                    CellId: 'cell-a',
                    ParentCellId: 'cell-b',
                    RowKey: 'cell-a',
                    RowLabel: 'Cell A',
                    ColKey: 'cell-a',
                    ColLabel: 'Cell A',
                    CellValue: 'Cell A'
                },
                {
                    id: 'row-b',
                    _tp_sort_order: 1,
                    CellId: 'cell-b',
                    ParentCellId: 'cell-a',
                    RowKey: 'cell-b',
                    RowLabel: 'Cell B',
                    ColKey: 'cell-b',
                    ColLabel: 'Cell B',
                    CellValue: 'Cell B'
                }
            ],
            matrixColumn,
            'en'
        )

        expect(flattenMatrixTree(buildMatrixTree(cells)).map((cell) => [cell.id, cell.depth])).toEqual([
            ['cell-a', 0],
            ['cell-b', 0]
        ])
    })

    it('builds focused hierarchy rows along the selected cell path only', () => {
        const cells = toMatrixRows(
            [
                {
                    id: 'row-root',
                    _tp_sort_order: 0,
                    CellId: 'root',
                    RowKey: 'root',
                    RowLabel: 'Root',
                    ColKey: 'root',
                    ColLabel: 'Root',
                    CellValue: 'Root'
                },
                {
                    id: 'row-a',
                    _tp_sort_order: 0,
                    CellId: 'a',
                    ParentCellId: 'root',
                    RowKey: 'a',
                    RowLabel: 'A',
                    ColKey: 'a',
                    ColLabel: 'A',
                    CellValue: 'A'
                },
                {
                    id: 'row-b',
                    _tp_sort_order: 1,
                    CellId: 'b',
                    ParentCellId: 'root',
                    RowKey: 'b',
                    RowLabel: 'B',
                    ColKey: 'b',
                    ColLabel: 'B',
                    CellValue: 'B'
                },
                {
                    id: 'row-a1',
                    _tp_sort_order: 0,
                    CellId: 'a1',
                    ParentCellId: 'a',
                    RowKey: 'a1',
                    RowLabel: 'A1',
                    ColKey: 'a1',
                    ColLabel: 'A1',
                    CellValue: 'A1'
                },
                {
                    id: 'row-b1',
                    _tp_sort_order: 0,
                    CellId: 'b1',
                    ParentCellId: 'b',
                    RowKey: 'b1',
                    RowLabel: 'B1',
                    ColKey: 'b1',
                    ColLabel: 'B1',
                    CellValue: 'B1'
                }
            ],
            matrixColumn,
            'en'
        )
        const tree = buildMatrixTree(cells)

        expect(toFocusedMatrixHierarchyRows(tree, null).map((row) => row.map((cell) => cell.id))).toEqual([['root']])
        expect(toFocusedMatrixHierarchyRows(tree, 'root').map((row) => row.map((cell) => cell.id))).toEqual([['root'], ['a', 'b']])
        expect(toFocusedMatrixHierarchyRows(tree, 'a').map((row) => row.map((cell) => cell.id))).toEqual([['root'], ['a', 'b'], ['a1']])
        expect(toFocusedMatrixHierarchyRows(tree, 'b').map((row) => row.map((cell) => cell.id))).toEqual([['root'], ['a', 'b'], ['b1']])
    })
})
