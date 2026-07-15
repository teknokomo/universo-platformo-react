import { describe, expect, it } from 'vitest'
import { buildVLC, createLocalizedContent } from '@universo-react/utils'
import {
    buildMatrixTree,
    buildBreadcrumbDisplayItems,
    buildHierarchicalMatrixTableModel,
    buildMatrixPositionLabels,
    buildMatrixTableModel,
    buildRootUniverseMatrixCellData,
    flattenMatrixTree,
    parseMatrixHierarchyLayout,
    parseMatrixHierarchyRowMode,
    parseMatrixMode,
    parseMatrixPositionNumbering,
    readColumnValue,
    resolveMatrixPath,
    resolveMatrixRootState,
    resolveRouteFocus,
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

    it('uses the normalized create-child parent for both persistence and sibling ordering', () => {
        const source = {
            id: 'parent-cell',
            parentCellId: null,
            sortOrder: 0,
            rowKey: 'parent-row',
            rowLabel: 'Parent row',
            colKey: 'parent-column',
            colLabel: 'Parent column'
        } as MatrixCell
        const existingCells = [
            source,
            { id: 'child-a', parentCellId: source.id, sortOrder: 2 } as MatrixCell,
            { id: 'other-child', parentCellId: 'other-parent', sortOrder: 9 } as MatrixCell
        ]

        const createData = buildCellCreateData({
            mode: 'create-child',
            childColumns: physicalMatrixChildColumns,
            locale: 'en',
            source,
            existingCells,
            placement: { parentCellId: source.id }
        })

        expect(createData.phys_parent_cell_id).toBe(source.id)
        expect(createData._tp_sort_order).toBe(3)
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

    it('rejects hierarchical child creation without a current source parent', () => {
        expect(() =>
            buildCellCreateData({
                mode: 'create-child',
                childColumns: matrixColumn.childColumns,
                locale: 'en',
                source: undefined,
                existingCells: []
            })
        ).toThrow('cell-not-selected')
    })

    it('rejects hierarchical child creation when placement targets a different parent', () => {
        const source = {
            id: 'parent-cell',
            parentCellId: null,
            sortOrder: 0,
            rowKey: 'parent-row',
            rowLabel: 'Parent row',
            colKey: 'parent-column',
            colLabel: 'Parent column'
        } as MatrixCell

        expect(() =>
            buildCellCreateData({
                mode: 'create-child',
                childColumns: matrixColumn.childColumns,
                locale: 'en',
                source,
                existingCells: [source],
                placement: { parentCellId: 'stale-parent-cell' }
            })
        ).toThrow('cell-parent-mismatch')
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
                    CellFillColor: '#1E88E5',
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
                    CellFillColor: null
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
            CellFillColor: '#1E88E5'
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

    it('uses explicit create-child placement as the initial parent instead of stale selection', () => {
        const selectedCell = {
            id: 'previous-selected-cell',
            parentCellId: null,
            sortOrder: 0
        } as MatrixCell

        const initialData = buildCellDialogInitialData({
            mode: 'create-child',
            cellMetadataFields: [],
            styleFields: [],
            childColumns: physicalMatrixChildColumns,
            locale: 'en',
            selectedCell,
            selectedRawCell: undefined,
            placement: {
                parentCellId: 'menu-target-cell'
            }
        })

        expect(initialData.phys_parent_cell_id).toBe('menu-target-cell')
        expect(initialData.ParentCellId).toBeUndefined()
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

    it('reads a versioned value from its component id before its codename when the physical field is absent', () => {
        const titleValue = buildVLC('English structure', 'Русская структура')

        expect(
            readColumnValue(
                { data: { 'structure-name-component': titleValue, Name: createLocalizedContent('en', 'Wrong fallback') } },
                [{ id: 'structure-name-component', codename: 'Name', field: 'physical_name' }],
                'Name'
            )
        ).toBe(titleValue)
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
        expect(toConfig({})).toMatchObject({
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
            defaultMatrixView: 'table',
            tableProjection: 'hierarchicalPath',
            breadcrumbDepth: { mode: 'full' },
            toolbarLayout: 'horizontal',
            showHierarchicalTableHeaderCard: true,
            splitPane: { enabled: true }
        })
        expect(
            toConfig({
                matrixMode: 'hierarchicalCells',
                allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
                defaultMatrixView: 'table',
                tableProjection: 'independentAxes',
                breadcrumbDepth: { mode: 'last', count: 4 },
                toolbarLayout: 'vertical',
                showHierarchicalTableHeaders: true,
                showHierarchicalTableHeaderCard: false,
                colorBreadcrumbsByCell: false,
                splitPane: { enabled: true },
                allowNewAxesInCellDialog: true
            })
        ).toMatchObject({
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
            defaultMatrixView: 'table',
            tableProjection: 'independentAxes',
            breadcrumbDepth: { mode: 'last', count: 4 },
            toolbarLayout: 'vertical',
            showHierarchicalTableHeaders: true,
            showHierarchicalTableHeaderCard: false,
            colorBreadcrumbsByCell: false,
            splitPane: { enabled: true },
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
            tableProjection: 'independentAxes',
            showHierarchicalTableHeaders: false,
            showHierarchicalTableHeaderCard: true,
            colorBreadcrumbsByCell: true,
            allowNewAxesInCellDialog: false
        })
        expect(toConfig({ matrixMode: 'hierarchicalCells', hierarchyLayout: 'verticalTree' })).toMatchObject({
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
            defaultMatrixView: 'table',
            splitPane: { enabled: true }
        })
    })

    it('reads canonical scalar colours, retains text colour, and falls back safely for malformed display data', () => {
        const cells = toMatrixRows(
            [
                {
                    id: 'cell-row',
                    CellId: 'cell',
                    RowKey: 'row',
                    RowLabel: 'Row',
                    ColKey: 'column',
                    ColLabel: 'Column',
                    CellValue: 'Title',
                    CellFillColor: '#1e88e5',
                    TextColor: '#1E88E5',
                    BorderTopColor: '#abc',
                    BorderTopWidth: '2px',
                    BorderTopStyle: 'dashed'
                },
                {
                    id: 'malformed-row',
                    CellId: 'malformed',
                    RowKey: 'row-2',
                    RowLabel: 'Row 2',
                    ColKey: 'column-2',
                    ColLabel: 'Column 2',
                    CellValue: 'Malformed',
                    CellFillColor: 'url(javascript:alert(1))',
                    TextColor: 'red'
                },
                {
                    id: 'text-only-low-contrast-row',
                    CellId: 'text-only-low-contrast',
                    RowKey: 'row-3',
                    RowLabel: 'Row 3',
                    ColKey: 'column-3',
                    ColLabel: 'Column 3',
                    CellValue: 'Text only',
                    CellFillColor: null,
                    TextColor: '#FFFFFF'
                }
            ],
            {
                ...matrixColumn,
                childColumns: [
                    ...(matrixColumn.childColumns ?? []),
                    { id: 'text', codename: 'TextColor', field: 'TextColor' },
                    { id: 'top-color', codename: 'BorderTopColor', field: 'BorderTopColor' },
                    { id: 'top-width', codename: 'BorderTopWidth', field: 'BorderTopWidth' },
                    { id: 'top-style', codename: 'BorderTopStyle', field: 'BorderTopStyle' }
                ]
            },
            'en'
        )

        expect(cells[0]?.style).toMatchObject({
            fill: '#1E88E5',
            text: '#1E88E5',
            borderTop: '2px dashed #AABBCC'
        })
        expect(cells[1]?.style).toMatchObject({ fill: null, text: null })
        expect(cells[2]?.style).toMatchObject({ fill: null, text: '#FFFFFF' })

        const darkThemeCells = toMatrixRows(
            [
                {
                    id: 'text-only-low-contrast-row',
                    CellId: 'text-only-low-contrast',
                    RowKey: 'row-3',
                    RowLabel: 'Row 3',
                    ColKey: 'column-3',
                    ColLabel: 'Column 3',
                    CellValue: 'Text only',
                    CellFillColor: null,
                    TextColor: '#000000'
                }
            ],
            {
                ...matrixColumn,
                childColumns: [...(matrixColumn.childColumns ?? []), { id: 'text', codename: 'TextColor', field: 'TextColor' }]
            },
            'en',
            '#121212'
        )

        expect(darkThemeCells[0]?.style).toMatchObject({ fill: null, text: '#000000' })

        const authoredColourCells = toMatrixRows(
            [
                {
                    id: 'orange-white',
                    CellId: 'orange-white',
                    RowKey: 'row-4',
                    RowLabel: 'Row 4',
                    ColKey: 'column-4',
                    ColLabel: 'Column 4',
                    CellValue: 'Orange with white text',
                    CellFillColor: '#FB8C00',
                    TextColor: '#FFFFFF'
                },
                {
                    id: 'blue-red',
                    CellId: 'blue-red',
                    RowKey: 'row-5',
                    RowLabel: 'Row 5',
                    ColKey: 'column-5',
                    ColLabel: 'Column 5',
                    CellValue: 'Blue with red text',
                    CellFillColor: '#0D47A1',
                    TextColor: '#E53935'
                }
            ],
            {
                ...matrixColumn,
                childColumns: [...(matrixColumn.childColumns ?? []), { id: 'text', codename: 'TextColor', field: 'TextColor' }]
            },
            'en'
        )

        expect(authoredColourCells.map((cell) => cell.style.text)).toEqual(['#FFFFFF', '#E53935'])
    })

    it('builds hierarchical table levels with header cell, row cells, and ancestor breadcrumbs', () => {
        const cells = [
            { id: 'root', parentCellId: null, sortOrder: 0, title: 'Root', depth: 0 } as MatrixCell,
            { id: 'parent', parentCellId: 'root', sortOrder: 0, title: 'Parent', depth: 1 } as MatrixCell,
            { id: 'sibling', parentCellId: 'root', sortOrder: 1, title: 'Sibling', depth: 1 } as MatrixCell,
            { id: 'child-b', parentCellId: 'parent', sortOrder: 2, title: 'Child B', depth: 2 } as MatrixCell,
            { id: 'child-a', parentCellId: 'parent', sortOrder: 1, title: 'Child A', depth: 2 } as MatrixCell,
            { id: 'grandchild', parentCellId: 'child-a', sortOrder: 0, title: 'Grandchild', depth: 3 } as MatrixCell
        ]

        expect(resolveMatrixRootState(cells)).toMatchObject({ kind: 'singleRoot', root: cells[0] })
        expect(resolveMatrixPath(cells, 'child-a').map((cell) => cell.id)).toEqual(['root', 'parent', 'child-a'])
        expect(
            buildBreadcrumbDisplayItems(resolveMatrixPath(cells, 'child-a'), { mode: 'last', count: 2 }).hiddenPrefix.map((cell) => cell.id)
        ).toEqual(['root'])
        expect(
            buildBreadcrumbDisplayItems(resolveMatrixPath(cells, 'child-a'), { mode: 'last', count: 0 }).hiddenPrefix.map((cell) => cell.id)
        ).toEqual(['root', 'parent', 'child-a'])
        expect(resolveRouteFocus('missing', cells, resolveMatrixRootState(cells))).toBe('root')

        const rootModel = buildHierarchicalMatrixTableModel({
            cells,
            focusedCellId: 'root',
            breadcrumbDepth: { mode: 'full' }
        })

        expect(rootModel.headerCell?.id).toBe('root')
        expect(rootModel.hiddenBreadcrumbs).toEqual([])
        expect(rootModel.visibleBreadcrumbs).toEqual([])
        expect(rootModel.tableRows.map((row) => [row.rowCell.id, row.cells.map((cell) => cell.id)])).toEqual([
            ['parent', ['child-a', 'child-b']],
            ['sibling', []]
        ])

        const childFocusModel = buildHierarchicalMatrixTableModel({
            cells,
            focusedCellId: 'parent',
            breadcrumbDepth: { mode: 'last', count: 1 }
        })

        expect(childFocusModel.focusedCell?.id).toBe('parent')
        expect(childFocusModel.headerCell?.id).toBe('root')
        expect(childFocusModel.hiddenBreadcrumbs).toEqual([])
        expect(childFocusModel.visibleBreadcrumbs).toEqual([])
        expect(childFocusModel.tableRows.map((row) => [row.rowCell.id, row.cells.map((cell) => cell.id)])).toEqual([
            ['parent', ['child-a', 'child-b']],
            ['sibling', []]
        ])
        expect(childFocusModel.visibleCells.map((cell) => cell.id)).toEqual(['root', 'parent', 'child-a', 'child-b', 'sibling'])

        const deepModel = buildHierarchicalMatrixTableModel({
            cells,
            focusedCellId: 'child-a',
            breadcrumbDepth: { mode: 'last', count: 1 }
        })

        expect(deepModel.headerCell?.id).toBe('parent')
        expect(deepModel.hiddenBreadcrumbs).toEqual([])
        expect(deepModel.visibleBreadcrumbs.map((cell) => cell.id)).toEqual(['root'])
        expect(deepModel.tableRows.map((row) => [row.rowCell.id, row.cells.map((cell) => cell.id)])).toEqual([
            ['child-a', ['grandchild']],
            ['child-b', []]
        ])
    })

    it('keeps the root as table header while first-level cells become row labels', () => {
        const cells = [
            { id: 'root', parentCellId: null, sortOrder: 0, title: 'Universe', depth: 0 } as MatrixCell,
            { id: 'cell-1', parentCellId: 'root', sortOrder: 0, title: 'Cell 1', depth: 1 } as MatrixCell,
            { id: 'cell-2', parentCellId: 'root', sortOrder: 1, title: 'Cell 2', depth: 1 } as MatrixCell,
            { id: 'cell-3', parentCellId: 'root', sortOrder: 2, title: 'Cell 3', depth: 1 } as MatrixCell,
            { id: 'cell-4', parentCellId: 'root', sortOrder: 3, title: 'Cell 4', depth: 1 } as MatrixCell,
            { id: 'cell-1-a', parentCellId: 'cell-1', sortOrder: 0, title: 'Cell 1 A', depth: 2 } as MatrixCell,
            { id: 'cell-2-a', parentCellId: 'cell-2', sortOrder: 0, title: 'Cell 2 A', depth: 2 } as MatrixCell,
            { id: 'cell-2-b', parentCellId: 'cell-2', sortOrder: 1, title: 'Cell 2 B', depth: 2 } as MatrixCell,
            { id: 'cell-2-a-i', parentCellId: 'cell-2-a', sortOrder: 0, title: 'Cell 2 A I', depth: 3 } as MatrixCell
        ]

        const rootOnlyModel = buildHierarchicalMatrixTableModel({
            cells: [cells[0]],
            focusedCellId: 'root',
            breadcrumbDepth: { mode: 'full' }
        })
        expect(rootOnlyModel.headerCell?.id).toBe('root')
        expect(rootOnlyModel.tableRows.map((row) => [row.rowCell.id, row.cells.map((cell) => cell.id)])).toEqual([['root', []]])

        const firstLevelModel = buildHierarchicalMatrixTableModel({
            cells,
            focusedCellId: 'cell-2',
            breadcrumbDepth: { mode: 'full' }
        })
        expect(firstLevelModel.headerCell?.id).toBe('root')
        expect(firstLevelModel.visibleBreadcrumbs).toEqual([])
        expect(firstLevelModel.tableRows.map((row) => [row.rowCell.id, row.cells.map((cell) => cell.id)])).toEqual([
            ['cell-1', ['cell-1-a']],
            ['cell-2', ['cell-2-a', 'cell-2-b']],
            ['cell-3', []],
            ['cell-4', []]
        ])

        const secondLevelModel = buildHierarchicalMatrixTableModel({
            cells,
            focusedCellId: 'cell-2-a',
            breadcrumbDepth: { mode: 'full' }
        })
        expect(secondLevelModel.headerCell?.id).toBe('cell-2')
        expect(secondLevelModel.visibleBreadcrumbs.map((cell) => cell.id)).toEqual(['root'])
        expect(secondLevelModel.tableRows.map((row) => [row.rowCell.id, row.cells.map((cell) => cell.id)])).toEqual([
            ['cell-2-a', ['cell-2-a-i']],
            ['cell-2-b', []]
        ])
    })

    it('does not silently choose a root when a hierarchical table has multiple roots', () => {
        const cells = [
            { id: 'root-b', parentCellId: null, sortOrder: 1, title: 'Root B', depth: 0 } as MatrixCell,
            { id: 'root-a', parentCellId: null, sortOrder: 0, title: 'Root A', depth: 0 } as MatrixCell
        ]
        const rootState = resolveMatrixRootState(cells)

        expect(rootState).toMatchObject({ kind: 'multipleRoots' })
        expect(resolveRouteFocus(null, cells, rootState)).toBeNull()
        expect(
            buildHierarchicalMatrixTableModel({
                cells,
                focusedCellId: null,
                breadcrumbDepth: { mode: 'full' }
            }).tableRows.map((row) => row.rowCell.id)
        ).toEqual(['root-a', 'root-b'])
    })

    it('keeps orphan hierarchical cells visible as root candidates', () => {
        const cells = [
            { id: 'root', parentCellId: null, sortOrder: 0, title: 'Root', depth: 0 } as MatrixCell,
            { id: 'orphan', parentCellId: 'missing-parent', sortOrder: 1, title: 'Orphan', depth: 1 } as MatrixCell
        ]

        const rootState = resolveMatrixRootState(cells)

        expect(rootState).toMatchObject({ kind: 'multipleRoots' })
        expect(
            buildHierarchicalMatrixTableModel({
                cells,
                focusedCellId: null,
                breadcrumbDepth: { mode: 'full' }
            }).tableRows.map((row) => row.rowCell.id)
        ).toEqual(['root', 'orphan'])
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
