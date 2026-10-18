import { describe, expect, it } from 'vitest'
import {
    getDuplicateTabularGroupingTargetIds,
    getInvalidTabularSiblingSourceIds,
    getTabularGroupingFieldIds,
    getUnreferencedTabularGroupingTargetIds,
    planTabularGroupingTransition,
    type TabularGroupingField
} from './tabularGrouping'

const fields: TabularGroupingField[] = [
    { id: 'groups', codename: 'Groups', label: 'Groups', type: 'TABLE', childFields: [{ id: 'key', codename: 'Key' }] },
    {
        id: 'items',
        label: 'Items',
        type: 'TABLE',
        childFields: [
            {
                id: 'group',
                codename: 'Group',
                uiConfig: {
                    siblingRowSelect: {
                        tableCodename: 'Groups',
                        valueFieldCodename: 'Key',
                        labelFieldCodename: 'Title',
                        requiredWithRows: true
                    }
                }
            }
        ]
    }
]
const optionalItemsField: TabularGroupingField = {
    id: 'optional-items',
    codename: 'OptionalItems',
    label: 'Optional items',
    type: 'TABLE',
    childFields: [
        {
            id: 'optionalGroup',
            codename: 'OptionalGroup',
            uiConfig: {
                siblingRowSelect: {
                    tableCodename: 'Groups',
                    valueFieldCodename: 'Key',
                    labelFieldCodename: 'Title'
                }
            }
        }
    ]
}
const fieldsWithOptionalRelation = [...fields, optionalItemsField]

describe('planTabularGroupingTransition', () => {
    it('identifies both TABLEs that must be loaded before grouping edits are allowed', () => {
        expect(getTabularGroupingFieldIds(fields)).toEqual(['groups', 'items'])
        expect(getTabularGroupingFieldIds([fields[1]])).toEqual([])
        expect(getTabularGroupingFieldIds(fieldsWithOptionalRelation)).toEqual(['groups', 'items', 'optional-items'])
    })

    it('reports groups without question references before a form is submitted', () => {
        const strictFields = structuredClone(fields)
        strictFields[1].childFields![0].uiConfig!.siblingRowSelect = {
            tableCodename: 'Groups',
            valueFieldCodename: 'Key',
            labelFieldCodename: 'Title',
            requireEachTargetReferenced: true
        }
        const values = {
            groups: [{ key: 'first' }, { key: 'second' }],
            items: [{ group: 'first', text: 'Question' }]
        }
        expect(getUnreferencedTabularGroupingTargetIds(strictFields, values)).toEqual(['groups'])
        expect(getUnreferencedTabularGroupingTargetIds(strictFields, { ...values, items: [...values.items, { group: 'second' }] })).toEqual(
            []
        )
        expect(getUnreferencedTabularGroupingTargetIds(strictFields, { groups: values.groups })).toEqual(['groups'])
    })

    it('reports duplicate target keys even when unused targets are allowed', () => {
        expect(
            getDuplicateTabularGroupingTargetIds(fields, {
                groups: [{ key: 'same-key' }, { key: 'same-key' }],
                items: []
            })
        ).toEqual(['groups'])
        expect(
            getDuplicateTabularGroupingTargetIds(fields, {
                groups: [{ key: 'first-key' }, { key: 'second-key' }],
                items: []
            })
        ).toEqual([])
    })

    it('normalizes only generated UUIDv7 grouping keys and accepts case variants in source references', () => {
        const uuidFields = structuredClone(fields)
        uuidFields[0].childFields![0].uiConfig = { generateUuidV7: true }
        uuidFields[1].childFields![0].uiConfig!.siblingRowSelect = {
            tableCodename: 'Groups',
            valueFieldCodename: 'Key',
            labelFieldCodename: 'Title',
            requiredWithRows: true,
            requireEachTargetReferenced: true
        }
        const key = '018f8a78-7b8f-7c1d-a111-222233334563'
        const uuidValues = {
            groups: [{ key }, { key: key.toUpperCase() }],
            items: [{ group: key.toUpperCase() }]
        }

        expect(getDuplicateTabularGroupingTargetIds(uuidFields, uuidValues)).toEqual(['groups'])
        expect(getInvalidTabularSiblingSourceIds(uuidFields, { groups: [{ key }], items: [{ group: key.toUpperCase() }] })).toEqual([])
        expect(getUnreferencedTabularGroupingTargetIds(uuidFields, { groups: [{ key }], items: [{ group: key.toUpperCase() }] })).toEqual(
            []
        )
        expect(getDuplicateTabularGroupingTargetIds(fields, { groups: [{ key: 'same' }, { key: 'SAME' }], items: [] })).toEqual([])
    })

    it('reports blank required selectors and keys left behind after deleting their target', () => {
        const strictFields = structuredClone(fields)
        strictFields[1].childFields![0].uiConfig!.siblingRowSelect = {
            tableCodename: 'Groups',
            valueFieldCodename: 'Key',
            labelFieldCodename: 'Title',
            requiredWithRows: true
        }
        expect(
            getInvalidTabularSiblingSourceIds(strictFields, {
                groups: [{ key: 'first' }],
                items: [{ group: null }]
            })
        ).toEqual(['items'])
        expect(
            getInvalidTabularSiblingSourceIds(strictFields, {
                groups: [{ key: 'first' }],
                items: [{ group: 'removed' }]
            })
        ).toEqual(['items'])
        expect(
            getInvalidTabularSiblingSourceIds(strictFields, {
                groups: [{ key: 'first' }],
                items: [{ group: 'first' }]
            })
        ).toEqual([])
    })

    it('plans an atomic first-group assignment without mutating the current form', () => {
        const values = {
            groups: [],
            items: [
                { id: 'one', group: null, text: 'First' },
                { id: 'two', Group: null, text: 'Second' }
            ]
        }
        const before = structuredClone(values)
        const nextRows = [{ key: 'stable-key' }]
        const transition = planTabularGroupingTransition(fields, values, 'groups', nextRows)
        expect(transition).toMatchObject({
            kind: 'group',
            updates: {
                groups: nextRows,
                items: [
                    { id: 'one', group: 'stable-key', text: 'First' },
                    { id: 'two', group: 'stable-key', Group: 'stable-key', text: 'Second' }
                ]
            }
        })
        expect(values).toEqual(before)
    })

    it('reads initial rows by TABLE codename while returning updates keyed by field id', () => {
        const renamedFields = fields.map((field) => ({ ...field, id: `table-${field.id}` }))
        renamedFields[1].codename = 'Items'
        const values = {
            Groups: [],
            Items: [{ id: 'question-1', Group: null, text: 'First' }]
        }
        const transition = planTabularGroupingTransition(renamedFields, values, 'table-groups', [{ key: 'selected-key' }])

        expect(transition).toMatchObject({
            kind: 'group',
            updates: {
                'table-groups': [{ key: 'selected-key' }],
                'table-items': [{ id: 'question-1', group: 'selected-key', Group: 'selected-key', text: 'First' }]
            }
        })
    })

    it('clears required and optional selectors that reference removed keys and keeps required confirmation', () => {
        const values = {
            groups: [{ key: 'stable-key' }],
            items: [{ id: 'one', group: 'stable-key', Group: 'stable-key', answer: 42 }],
            'optional-items': [{ id: 'two', optionalGroup: null, OptionalGroup: 'stable-key', note: 'Keep me' }]
        }
        expect(planTabularGroupingTransition(fieldsWithOptionalRelation, values, 'groups', [])).toMatchObject({
            kind: 'ungroup',
            requiresConfirmation: true,
            updates: {
                groups: [],
                items: [{ id: 'one', group: null, Group: null, answer: 42 }],
                'optional-items': [{ id: 'two', optionalGroup: null, OptionalGroup: null, note: 'Keep me' }]
            }
        })
    })

    it('clears optional-only stale references without requiring confirmation', () => {
        const optionalOnlyFields = [fields[0], optionalItemsField]
        expect(
            planTabularGroupingTransition(
                optionalOnlyFields,
                {
                    groups: [{ key: 'stable-key' }],
                    'optional-items': [{ id: 'two', optionalGroup: null, OptionalGroup: 'stable-key', note: 'Keep me' }]
                },
                'groups',
                []
            )
        ).toMatchObject({
            kind: 'ungroup',
            requiresConfirmation: false,
            updates: {
                groups: [],
                'optional-items': [{ id: 'two', optionalGroup: null, OptionalGroup: null, note: 'Keep me' }]
            }
        })
    })

    it('plans confirmation when removing the final empty group', () => {
        expect(planTabularGroupingTransition(fields, { groups: [{ key: 'empty-group' }], items: [] }, 'groups', [])).toMatchObject({
            kind: 'ungroup',
            requiresConfirmation: true,
            updates: { groups: [] }
        })
    })

    it('does not plan a grouping confirmation when clearing an unrelated table', () => {
        const notesField: TabularGroupingField = {
            id: 'notes',
            codename: 'Notes',
            label: 'Notes',
            type: 'TABLE',
            childFields: []
        }

        expect(
            planTabularGroupingTransition(
                [...fields, notesField],
                { groups: [], items: [], notes: [{ id: 'note-1', text: 'Ordinary row' }] },
                'notes',
                []
            )
        ).toBeNull()
    })

    it('does not convert ordinary edits, first groups without dependent rows, or optional selectors', () => {
        expect(
            planTabularGroupingTransition(fields, { groups: [{ key: 'old' }], items: [{ group: 'old' }] }, 'groups', [{ key: 'new' }])
        ).toBeNull()
        expect(planTabularGroupingTransition(fields, { groups: [], items: [] }, 'groups', [{ key: 'new' }])).toBeNull()
        const optional = structuredClone(fields)
        optional[1].childFields![0].uiConfig = {
            siblingRowSelect: { tableCodename: 'Groups', valueFieldCodename: 'Key', labelFieldCodename: 'Title' }
        }
        expect(planTabularGroupingTransition(optional, { groups: [], items: [{ group: null }] }, 'groups', [{ key: 'new' }])).toBeNull()
    })
})
