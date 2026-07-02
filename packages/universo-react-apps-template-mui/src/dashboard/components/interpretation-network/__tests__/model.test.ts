import { describe, expect, it } from 'vitest'
import { toMatrixRows, type RuntimeColumnLike } from '../model'

const matrixColumn: RuntimeColumnLike = {
    id: 'matrix-component',
    codename: 'InterpretationMatrix',
    field: 'InterpretationMatrix',
    dataType: 'TABLE',
    childColumns: [
        { id: 'cell-id', codename: 'CellId', field: 'CellId' },
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
})
