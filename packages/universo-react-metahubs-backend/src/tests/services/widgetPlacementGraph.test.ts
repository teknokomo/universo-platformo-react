import { validateLayoutWidgetPlacementGraph } from '../../domains/layouts/widgetPlacementGraph'

const root = {
    id: '019a0000-0000-7000-8000-000000000001',
    instance_key: '019a0000-0000-7000-8000-000000000101',
    parent_widget_id: null,
    slot_key: null,
    widget_key: 'columnsContainer',
    zone: 'center',
    config: { columns: [{ slotKey: 'column:primary', width: 12 }] }
}

const child = {
    id: '019a0000-0000-7000-8000-000000000002',
    instance_key: '019a0000-0000-7000-8000-000000000102',
    parent_widget_id: root.id,
    slot_key: 'column:primary',
    widget_key: 'detailsTable',
    zone: 'center',
    config: {}
}

describe('validateLayoutWidgetPlacementGraph', () => {
    it('accepts root and nested placements with a registered container slot', () => {
        expect(() => validateLayoutWidgetPlacementGraph('dashboard', [root, child])).not.toThrow()
    })

    it('rejects a null parent and non-null slot pair', () => {
        expect(() => validateLayoutWidgetPlacementGraph('dashboard', [{ ...child, parent_widget_id: null }])).toThrow(/both|parent|slot/u)
    })

    it('requires each placement to have a distinct semantic instance key', () => {
        expect(() => validateLayoutWidgetPlacementGraph('dashboard', [root, { ...child, instance_key: root.instance_key }])).toThrow(
            /instance keys/u
        )
    })

    it('rejects missing parents and undeclared container slots', () => {
        expect(() => validateLayoutWidgetPlacementGraph('dashboard', [{ ...child, parent_widget_id: 'missing' }])).toThrow(/parent/u)
        expect(() => validateLayoutWidgetPlacementGraph('dashboard', [root, { ...child, slot_key: 'column:unknown' }])).toThrow(
            /incompatible/u
        )
    })

    it('rejects placement cycles', () => {
        const first = { ...root, parent_widget_id: '019a0000-0000-7000-8000-000000000002', slot_key: 'column:primary' }
        const second = { ...child, widget_key: 'columnsContainer', config: { columns: [{ slotKey: 'column:primary', width: 12 }] } }
        expect(() => validateLayoutWidgetPlacementGraph('dashboard', [first, second])).toThrow(/cycles/u)
    })
})
