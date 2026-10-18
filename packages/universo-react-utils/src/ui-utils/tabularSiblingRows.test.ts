import { describe, expect, it } from 'vitest'
import { buildTabularSiblingRowOptions, normalizeTabularSiblingRowOrder, sortTabularSiblingRows } from './tabularSiblingRows'

describe('tabular sibling row helpers', () => {
    const fields = [
        { id: 'key', codename: 'Key' },
        { id: 'title', codename: 'Title' },
        { id: 'sort', codename: 'SortOrder' }
    ]

    it('keeps stable ordering and normalizes the persisted order field', () => {
        const rows = [
            { key: 'a', title: 'A', sort: 2 },
            { key: 'b', title: 'B', sort: 1 }
        ]
        const config = { orderFieldCodename: 'SortOrder', labelFieldCodename: 'Title' }

        expect(sortTabularSiblingRows(rows, config, fields).map((row) => row.key)).toEqual(['b', 'a'])
        expect(normalizeTabularSiblingRowOrder(rows, config, fields).map((row) => row.sort)).toEqual([1, 2])
    })

    it('disambiguates repeated labels and omits UUID or JSON labels', () => {
        const siblingTables = {
            MuseBlocks: {
                rows: [
                    { key: 'one', title: 'First block', sort: 1 },
                    { key: 'two', title: 'First block', sort: 2 },
                    { key: 'uuid', title: '00000000-0000-7000-8000-000000000001', sort: 3 },
                    { key: 'json', title: '{"id":"hidden"}', sort: 4 }
                ],
                childFields: fields,
                rowOrdering: { orderFieldCodename: 'SortOrder', labelFieldCodename: 'Title' }
            }
        }

        expect(
            buildTabularSiblingRowOptions({
                field: {
                    uiConfig: {
                        siblingRowSelect: {
                            tableCodename: 'MuseBlocks',
                            valueFieldCodename: 'Key',
                            labelFieldCodename: 'Title'
                        }
                    }
                },
                siblingTables,
                formatLabel: (value) => String(value ?? '')
            })
        ).toEqual([
            { id: 'one', label: 'First block (1)' },
            { id: 'two', label: 'First block (2)' }
        ])
    })

    it('treats UUID identities as case-insensitive when filtering duplicate target rows', () => {
        const siblingTables = {
            MuseBlocks: {
                rows: [
                    { key: '0199a9b5-3cde-7abc-8def-0123456789ab', title: 'Opening', sort: 1 },
                    { key: '0199A9B5-3CDE-7ABC-8DEF-0123456789AB', title: 'Duplicate', sort: 2 }
                ],
                childFields: fields
            }
        }

        expect(
            buildTabularSiblingRowOptions({
                field: {
                    uiConfig: {
                        siblingRowSelect: {
                            tableCodename: 'MuseBlocks',
                            valueFieldCodename: 'Key',
                            labelFieldCodename: 'Title'
                        }
                    }
                },
                siblingTables,
                formatLabel: (value) => String(value ?? '')
            })
        ).toEqual([{ id: '0199a9b5-3cde-7abc-8def-0123456789ab', label: 'Opening' }])
    })
})
