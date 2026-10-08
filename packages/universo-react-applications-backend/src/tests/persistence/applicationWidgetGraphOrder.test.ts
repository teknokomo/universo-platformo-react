import { orderApplicationWidgetGraph } from '../../persistence/applicationWidgetGraphOrder'

const node = (id: string, parentWidgetId: string | null = null, layoutId = 'layout') => ({ id, parentWidgetId, layoutId })

describe('application widget graph persistence order', () => {
    it('writes ancestors first without mutating display order or input', () => {
        const child = { ...node('child', 'parent'), sortOrder: 0 }
        const parent = { ...node('parent'), sortOrder: 9 }
        const grandchild = { ...node('grandchild', 'child'), sortOrder: 2 }
        const sibling = { ...node('sibling', 'parent'), sortOrder: 1 }
        const input = [grandchild, child, sibling, parent]
        expect(orderApplicationWidgetGraph(input, (item) => item)).toEqual([parent, child, grandchild, sibling])
        expect(input).toEqual([grandchild, child, sibling, parent])
        expect(parent.sortOrder).toBe(9)
    })

    it.each([
        [node('child', 'missing')],
        [node('child', 'parent'), node('parent', null, 'other')],
        [node('a', 'b'), node('b', 'a')],
        [node('a', 'a')],
        [node('a'), node('a')]
    ])('fails closed on an invalid graph %#', (...items) => {
        expect(() => orderApplicationWidgetGraph(items, (item) => item)).toThrow('[SchemaSync] Widget graph')
    })
})
