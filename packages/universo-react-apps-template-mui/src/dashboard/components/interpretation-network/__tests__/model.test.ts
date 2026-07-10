import { describe, expect, it } from 'vitest'
import {
    buildMatrixTree,
    buildMatrixPositionLabels,
    buildMatrixTableModel,
    buildRootUniverseMatrixCellData,
    flattenMatrixTree,
    parseMatrixHierarchyLayout,
    parseMatrixHierarchyRowMode,
    parseMatrixMode,
    parseMatrixPositionNumbering,
    toFocusedMatrixHierarchyRows,
    toConfig,
    toMatrixHierarchyRows,
    toMatrixRows,
    type MatrixCell,
    type RuntimeColumnLike
} from '../model'
import { buildCellCreateData, buildCellDialogInitialData, mergeCellCreateData, resolveCellCreateSystemFields } from '../matrixCellData'

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

const physicalMatrixChildColumns: RuntimeColumnLike[] = [
    { id: 'cell-id', codename: 'CellId', field: 'phys_cell_id' },
    { id: 'parent-cell-id', codename: 'ParentCellId', field: 'phys_parent_cell_id' },
    { id: 'row-key', codename: 'RowKey', field: 'phys_row_key' },
    { id: 'row-label', codename: 'RowLabel', field: 'phys_row_label' },
    { id: 'col-key', codename: 'ColKey', field: 'phys_col_key' },
    { id: 'col-label', codename: 'ColLabel', field: 'phys_col_label' },
    { id: 'value', codename: 'CellValue', field: 'phys_cell_value' }
]

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
                existingCells
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
            existingCells
        })

        expect(createData._tp_sort_order).toBe(4)
        expect(createData.ParentCellId).toBeNull()
    })

    it('preserves localized axis labels when extending an existing row or column', () => {
        const rowLabelValue = { en: 'Existing row', ru: 'Существующая строка' }
        const colLabelValue = { en: 'Existing column', ru: 'Существующий столбец' }
        const source = {
            id: 'source',
            parentCellId: null,
            sortOrder: 0,
            rowKey: 'source-row',
            rowLabel: 'Existing row',
            rowLabelValue,
            colKey: 'source-col',
            colLabel: 'Existing column',
            colLabelValue
        } as MatrixCell

        expect(
            buildCellCreateData({
                mode: 'create-cell',
                childColumns: matrixColumn.childColumns,
                locale: 'en',
                source,
                existingCells: [source]
            }).RowLabel
        ).toBe(rowLabelValue)
        expect(
            buildCellCreateData({
                mode: 'create-row',
                childColumns: matrixColumn.childColumns,
                locale: 'en',
                source,
                existingCells: [source]
            }).ColLabel
        ).toBe(colLabelValue)
    })

    it('writes preserved axis labels to physical row fields when extending a row or column', () => {
        const rowLabelValue = { en: 'Existing row', ru: 'Существующая строка' }
        const colLabelValue = { en: 'Existing column', ru: 'Существующий столбец' }
        const source = {
            id: 'source',
            parentCellId: null,
            sortOrder: 0,
            rowKey: 'source-row',
            rowLabel: 'Existing row',
            rowLabelValue,
            colKey: 'source-col',
            colLabel: 'Existing column',
            colLabelValue
        } as MatrixCell

        const createCellData = buildCellCreateData({
            mode: 'create-cell',
            childColumns: physicalMatrixChildColumns,
            locale: 'en',
            source,
            existingCells: [source]
        })
        const createRowData = buildCellCreateData({
            mode: 'create-row',
            childColumns: physicalMatrixChildColumns,
            locale: 'en',
            source,
            existingCells: [source]
        })

        expect(createCellData.phys_row_label).toBe(rowLabelValue)
        expect(createCellData.RowLabel).toBeUndefined()
        expect(createRowData.phys_col_label).toBe(colLabelValue)
        expect(createRowData.ColLabel).toBeUndefined()
    })

    it('writes hierarchical child placement to physical system fields', () => {
        const source = {
            id: 'parent-cell',
            parentCellId: null,
            sortOrder: 0,
            rowKey: 'parent-row',
            rowLabel: 'Parent row',
            colKey: 'parent-column',
            colLabel: 'Parent column'
        } as MatrixCell

        const createData = buildCellCreateData({
            mode: 'create-child',
            childColumns: physicalMatrixChildColumns,
            locale: 'en',
            source,
            existingCells: [source]
        })

        expect(createData.phys_cell_id).toEqual(expect.any(String))
        expect(createData.phys_parent_cell_id).toBe('parent-cell')
        expect(createData.phys_row_key).toBe(`row-${createData.phys_cell_id}`)
        expect(createData.phys_col_key).toBe(`column-${createData.phys_cell_id}`)
        expect(createData.ParentCellId).toBeUndefined()
        expect(createData.RowKey).toBeUndefined()
        expect(createData.ColKey).toBeUndefined()
    })

    it('uses explicit existing axis placement instead of matching labels by text', () => {
        const source = {
            id: 'parent-cell',
            parentCellId: null,
            sortOrder: 0,
            rowKey: 'parent-row',
            rowLabel: 'Definition',
            colKey: 'parent-column',
            colLabel: 'Meaning'
        } as MatrixCell

        const createData = buildCellCreateData({
            mode: 'create-child',
            childColumns: physicalMatrixChildColumns,
            locale: 'en',
            source,
            existingCells: [source],
            placement: {
                parentCellId: source.id,
                row: {
                    kind: 'existing',
                    option: {
                        key: 'existing-row-definition',
                        label: 'Definition',
                        labelValue: { en: 'Definition', ru: 'Определение' }
                    }
                },
                column: {
                    kind: 'existing',
                    option: {
                        key: 'existing-column-source',
                        label: 'Source',
                        labelValue: { en: 'Source', ru: 'Источник' }
                    }
                }
            }
        })

        expect(createData.phys_parent_cell_id).toBe('parent-cell')
        expect(createData.phys_row_key).toBe('existing-row-definition')
        expect(createData.phys_row_label).toEqual({ en: 'Definition', ru: 'Определение' })
        expect(createData.phys_col_key).toBe('existing-column-source')
        expect(createData.phys_col_label).toEqual({ en: 'Source', ru: 'Источник' })
    })

    it('creates a table cell at explicit existing row and column coordinates', () => {
        const source = {
            id: 'source-cell',
            parentCellId: null,
            sortOrder: 5,
            rowKey: 'source-row',
            rowLabel: 'Definition',
            colKey: 'source-column',
            colLabel: 'Source'
        } as MatrixCell

        const createData = buildCellCreateData({
            mode: 'create-cell',
            childColumns: matrixColumn.childColumns,
            locale: 'en',
            source,
            existingCells: [
                source,
                { id: 'meaning-cell', parentCellId: null, sortOrder: 8, rowKey: 'other-row', colKey: 'meaning' } as MatrixCell
            ],
            placement: {
                row: {
                    kind: 'existing',
                    option: {
                        key: 'example',
                        label: 'Example',
                        labelValue: { en: 'Example', ru: 'Пример' }
                    }
                },
                column: {
                    kind: 'existing',
                    option: {
                        key: 'meaning',
                        label: 'Meaning',
                        labelValue: { en: 'Meaning', ru: 'Смысл' }
                    }
                }
            }
        })

        expect(createData.RowKey).toBe('example')
        expect(createData.RowLabel).toEqual({ en: 'Example', ru: 'Пример' })
        expect(createData.ColKey).toBe('meaning')
        expect(createData.ColLabel).toEqual({ en: 'Meaning', ru: 'Смысл' })
        expect(createData.ParentCellId).toBeNull()
        expect(createData._tp_sort_order).toBe(9)
        expect(createData.CellId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/i)
    })

    it('protects generated sort order during create merges', () => {
        expect(
            mergeCellCreateData(
                {
                    CellValue: 'User title',
                    _tp_sort_order: 99
                },
                {
                    CellId: 'generated-cell',
                    ParentCellId: null,
                    RowKey: 'row-generated-cell',
                    ColKey: 'column-generated-cell',
                    _tp_sort_order: 3,
                    CellValue: 'Default title'
                },
                resolveCellCreateSystemFields(matrixColumn.childColumns)
            )
        ).toEqual({
            CellId: 'generated-cell',
            ParentCellId: null,
            RowKey: 'row-generated-cell',
            ColKey: 'column-generated-cell',
            _tp_sort_order: 3,
            CellValue: 'User title'
        })
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
                    RowLabel: 'User row',
                    ColLabel: 'User column',
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
            RowLabel: 'User row',
            ColKey: 'column-generated-cell',
            ColLabel: 'User column',
            CellValue: 'User title',
            CellDescription: 'User description',
            CellFillColor: 'blue'
        })
    })

    it('protects physical generated matrix placement fields during create merges', () => {
        expect(
            mergeCellCreateData(
                {
                    phys_cell_id: undefined,
                    phys_parent_cell_id: undefined,
                    phys_row_key: undefined,
                    phys_col_key: undefined,
                    phys_cell_value: 'User title'
                },
                {
                    phys_cell_id: 'generated-cell',
                    phys_parent_cell_id: 'parent-cell',
                    phys_row_key: 'row-generated-cell',
                    phys_col_key: 'column-generated-cell',
                    phys_cell_value: 'Default title'
                },
                resolveCellCreateSystemFields(physicalMatrixChildColumns)
            )
        ).toEqual({
            phys_cell_id: 'generated-cell',
            phys_parent_cell_id: 'parent-cell',
            phys_row_key: 'row-generated-cell',
            phys_col_key: 'column-generated-cell',
            phys_cell_value: 'User title'
        })
    })

    it('drops stale system codenames when trusted create data uses physical system fields', () => {
        expect(
            mergeCellCreateData(
                {
                    CellId: 'user-cell-id',
                    ParentCellId: 'user-parent-cell-id',
                    RowKey: 'user-row',
                    ColKey: 'user-column',
                    _tp_sort_order: 99,
                    phys_cell_id: undefined,
                    phys_parent_cell_id: undefined,
                    phys_row_key: undefined,
                    phys_col_key: undefined,
                    phys_cell_value: 'User title'
                },
                {
                    phys_cell_id: 'generated-cell',
                    phys_parent_cell_id: 'parent-cell',
                    phys_row_key: 'row-generated-cell',
                    phys_col_key: 'column-generated-cell',
                    phys_cell_value: 'Default title'
                },
                resolveCellCreateSystemFields(physicalMatrixChildColumns)
            )
        ).toEqual({
            phys_cell_id: 'generated-cell',
            phys_parent_cell_id: 'parent-cell',
            phys_row_key: 'row-generated-cell',
            phys_col_key: 'column-generated-cell',
            phys_cell_value: 'User title'
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
            selectedRawCell: undefined
        })
        const createData = buildCellCreateData({
            mode: 'create-row',
            childColumns: matrixColumn.childColumns,
            locale: 'en',
            source: undefined,
            existingCells: []
        })

        for (const rootCell of [initialData, createData]) {
            expect(rootCell.ParentCellId).toBeNull()
            expect(rootCell.CellValue).toEqual(
                expect.objectContaining({
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: '' })
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

    it('pre-fills create dialog axis labels through physical row fields', () => {
        const rowLabelValue = { en: 'Existing row', ru: 'Существующая строка' }
        const colLabelValue = { en: 'Existing column', ru: 'Существующий столбец' }
        const selectedCell = {
            id: 'source',
            rowLabel: 'Existing row',
            rowLabelValue,
            colLabel: 'Existing column',
            colLabelValue
        } as MatrixCell

        const createCellData = buildCellDialogInitialData({
            mode: 'create-cell',
            cellMetadataFields: [],
            styleFields: [],
            childColumns: physicalMatrixChildColumns,
            locale: 'en',
            selectedCell,
            selectedRawCell: undefined
        })
        const createRowData = buildCellDialogInitialData({
            mode: 'create-row',
            cellMetadataFields: [],
            styleFields: [],
            childColumns: physicalMatrixChildColumns,
            locale: 'en',
            selectedCell,
            selectedRawCell: undefined
        })

        expect(createCellData.phys_row_label).toBe(rowLabelValue)
        expect(createCellData.RowLabel).toBeUndefined()
        expect(createRowData.phys_col_label).toBe(colLabelValue)
        expect(createRowData.ColLabel).toBeUndefined()
    })

    it('pre-fills edit dialog values from physical matrix row fields', () => {
        const rowLabelValue = { locales: { en: { content: 'Existing row' } }, _primary: 'en' }
        const colLabelValue = { locales: { en: { content: 'Existing column' } }, _primary: 'en' }
        const titleValue = { locales: { en: { content: 'Existing title' } }, _primary: 'en' }

        const initialData = buildCellDialogInitialData({
            mode: 'edit',
            cellMetadataFields: [
                { id: 'phys_row_label', codename: 'RowLabel', label: 'Row label', type: 'STRING' },
                { id: 'phys_col_label', codename: 'ColLabel', label: 'Column label', type: 'STRING' },
                { id: 'phys_cell_value', codename: 'CellValue', label: 'Title', type: 'STRING' }
            ],
            styleFields: [],
            childColumns: physicalMatrixChildColumns,
            locale: 'en',
            selectedCell: undefined,
            selectedRawCell: {
                id: 'row-1',
                phys_row_label: rowLabelValue,
                phys_col_label: colLabelValue,
                phys_cell_value: titleValue
            }
        })

        expect(initialData.phys_row_label).toBe(rowLabelValue)
        expect(initialData.phys_col_label).toBe(colLabelValue)
        expect(initialData.phys_cell_value).toBe(titleValue)
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

    it('derives stable fallback axis keys from the cell identity instead of row order', () => {
        const firstOrder = toMatrixRows(
            [
                { id: 'row-a', CellId: 'cell-a', CellValue: 'A' },
                { id: 'row-b', CellId: 'cell-b', CellValue: 'B' }
            ],
            matrixColumn,
            'en'
        )
        const reversedOrder = toMatrixRows(
            [
                { id: 'row-b', CellId: 'cell-b', CellValue: 'B' },
                { id: 'row-a', CellId: 'cell-a', CellValue: 'A' }
            ],
            matrixColumn,
            'en'
        )

        expect(firstOrder.map(({ id, rowKey, colKey }) => ({ id, rowKey, colKey }))).toEqual([
            { id: 'cell-a', rowKey: 'row-cell-a', colKey: 'column-cell-a' },
            { id: 'cell-b', rowKey: 'row-cell-b', colKey: 'column-cell-b' }
        ])
        expect(reversedOrder.map(({ id, rowKey, colKey }) => ({ id, rowKey, colKey }))).toEqual([
            { id: 'cell-b', rowKey: 'row-cell-b', colKey: 'column-cell-b' },
            { id: 'cell-a', rowKey: 'row-cell-a', colKey: 'column-cell-a' }
        ])
    })

    it('builds a rectangular table model from row and column axes without fabricating cells', () => {
        const cells = toMatrixRows(
            [
                {
                    id: 'row-meaning',
                    _tp_sort_order: 0,
                    CellId: 'meaning',
                    RowKey: 'definition',
                    RowLabel: 'Definition',
                    ColKey: 'meaning',
                    ColLabel: 'Meaning',
                    CellValue: 'Meaning'
                },
                {
                    id: 'row-source',
                    _tp_sort_order: 1,
                    CellId: 'source',
                    RowKey: 'definition',
                    RowLabel: 'Definition',
                    ColKey: 'source',
                    ColLabel: 'Source',
                    CellValue: 'Source'
                },
                {
                    id: 'row-example',
                    _tp_sort_order: 2,
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

        const table = buildMatrixTableModel(cells)

        expect(table.rows).toEqual([
            { key: 'definition', sourceKey: 'definition', label: 'Definition', labelValue: 'Definition', acceptsEmptyDrop: true },
            { key: 'example', sourceKey: 'example', label: 'Example', labelValue: 'Example', acceptsEmptyDrop: true }
        ])
        expect(table.columns).toEqual([
            { key: 'meaning', sourceKey: 'meaning', label: 'Meaning', labelValue: 'Meaning', acceptsEmptyDrop: true },
            { key: 'source', sourceKey: 'source', label: 'Source', labelValue: 'Source', acceptsEmptyDrop: true }
        ])
        expect(table.slots.map((row) => row.map((slot) => slot.cell?.id ?? null))).toEqual([
            ['meaning', 'source'],
            ['example', null]
        ])
    })

    it('keeps table axes in the supplied visible hierarchy order when sibling sort orders repeat', () => {
        const cells = toMatrixRows(
            [
                {
                    id: 'row-root',
                    _tp_sort_order: 0,
                    CellId: 'root',
                    RowKey: 'root',
                    RowLabel: 'Root',
                    ColKey: 'root-column',
                    ColLabel: 'Root column',
                    CellValue: 'Root'
                },
                {
                    id: 'row-parent-b',
                    _tp_sort_order: 1,
                    CellId: 'parent-b',
                    ParentCellId: 'root',
                    RowKey: 'parent-b',
                    RowLabel: 'Parent B',
                    ColKey: 'parent-b-column',
                    ColLabel: 'Parent B column',
                    CellValue: 'Parent B'
                },
                {
                    id: 'row-child-b',
                    _tp_sort_order: 0,
                    CellId: 'child-b',
                    ParentCellId: 'parent-b',
                    RowKey: 'child-b',
                    RowLabel: 'Child B',
                    ColKey: 'child-b-column',
                    ColLabel: 'Child B column',
                    CellValue: 'Child B'
                },
                {
                    id: 'row-parent-a',
                    _tp_sort_order: 0,
                    CellId: 'parent-a',
                    ParentCellId: 'root',
                    RowKey: 'parent-a',
                    RowLabel: 'Parent A',
                    ColKey: 'parent-a-column',
                    ColLabel: 'Parent A column',
                    CellValue: 'Parent A'
                }
            ],
            matrixColumn,
            'en'
        )

        const table = buildMatrixTableModel(cells)

        expect(table.rows.map((row) => row.key)).toEqual(['root', 'parent-b', 'child-b', 'parent-a'])
        expect(table.columns.map((column) => column.key)).toEqual(['root-column', 'parent-b-column', 'child-b-column', 'parent-a-column'])
    })

    it('keeps every visible table cell when row and column coordinates collide', () => {
        const cells = toMatrixRows(
            [
                {
                    id: 'row-first',
                    _tp_sort_order: 0,
                    CellId: 'first',
                    RowKey: 'same-row',
                    RowLabel: 'Same row',
                    ColKey: 'same-column',
                    ColLabel: 'Same column',
                    CellValue: 'First'
                },
                {
                    id: 'row-second',
                    _tp_sort_order: 1,
                    CellId: 'second',
                    RowKey: 'same-row',
                    RowLabel: 'Same row',
                    ColKey: 'same-column',
                    ColLabel: 'Same column',
                    CellValue: 'Second'
                }
            ],
            matrixColumn,
            'en'
        )

        const table = buildMatrixTableModel(cells)

        expect(table.rows).toHaveLength(2)
        expect(table.rows.map((row) => row.label)).toEqual(['Same row', 'Same row'])
        expect(table.rows.map((row) => row.sourceKey)).toEqual(['same-row', 'same-row'])
        expect(table.rows.map((row) => row.acceptsEmptyDrop)).toEqual([true, false])
        expect(table.columns).toEqual([
            { key: 'same-column', sourceKey: 'same-column', label: 'Same column', labelValue: 'Same column', acceptsEmptyDrop: true }
        ])
        expect(table.slots.map((row) => row.map((slot) => slot.cell?.id ?? null))).toEqual([['first'], ['second']])
    })

    it('normalizes matrix view settings from widget config without resetting valid table defaults', () => {
        expect(
            toConfig({
                matrixMode: 'hierarchicalCells',
                allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
                defaultMatrixView: 'table',
                allowNewAxesInCellDialog: true
            })
        ).toMatchObject({
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
            defaultMatrixView: 'table',
            allowNewAxesInCellDialog: true
        })
        expect(
            toConfig({
                matrixMode: 'independentRows',
                allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
                defaultMatrixView: 'table'
            })
        ).toMatchObject({
            matrixMode: 'independentRows',
            allowedMatrixViews: ['table', 'horizontalRows'],
            defaultMatrixView: 'table',
            allowNewAxesInCellDialog: false
        })
        expect(
            toConfig({
                matrixMode: 'hierarchicalCells',
                hierarchyLayout: 'verticalTree'
            })
        ).toMatchObject({
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['horizontalRows', 'verticalTree'],
            defaultMatrixView: 'verticalTree'
        })
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
