import {
    buildDashboardLearnerPlayerBindings,
    makeDashboardSeedPlacement,
    orderDashboardSeedPlacements
} from '../../domains/templates/services/dashboardSeedPlacement'

const columnContainer = (instanceKey: string, slotKey: string, sortOrder: number, parentInstanceKey?: string) =>
    makeDashboardSeedPlacement({
        zone: 'center',
        widgetKey: 'columnsContainer',
        instanceKey,
        sortOrder,
        rendererConfig: { columns: [{ slotKey, width: 12 }] },
        parentInstanceKey: parentInstanceKey ?? null,
        slotKey: parentInstanceKey ? 'column:child' : null
    })

describe('dashboardSeedPlacement', () => {
    it.each([
        ['course', 'Courses', 'CourseItems', 'CourseId'],
        ['track', 'LearningTracks', 'TrackSteps', 'TrackId']
    ] as const)('builds registry-derived learnerPlayer bindings for %s', (variant, parent, items, relationField) => {
        const bindings = buildDashboardLearnerPlayerBindings(variant, parent, items)
        const parentTarget = bindings.slots.find(({ slot }) => slot === 'parent')?.targets[0]
        const itemTarget = bindings.slots.find(({ slot }) => slot === 'items')?.targets[0]

        expect(parentTarget).toMatchObject({ entityCodename: parent, selector: { kind: 'record-set' } })
        expect(itemTarget).toMatchObject({ entityCodename: items, selector: { kind: 'relation-set', parentSlot: 'parent' } })
        expect(itemTarget?.projection).toContainEqual({ field: 'parent', componentCodename: relationField })
    })

    it('orders first-class children after their semantic parent regardless of sort order', () => {
        const parent = columnContainer('parent', 'column:content', 2)
        const child = makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'quizWidget',
            instanceKey: 'child',
            sortOrder: 1,
            parentInstanceKey: 'parent',
            slotKey: 'column:content'
        })

        expect(orderDashboardSeedPlacements([child, parent]).map(({ instanceKey }) => instanceKey)).toEqual(['parent', 'child'])
    })

    it('rejects a missing semantic parent', () => {
        const child = makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'quizWidget',
            instanceKey: 'child',
            sortOrder: 1,
            parentInstanceKey: 'missing-parent',
            slotKey: 'column:content'
        })

        expect(() => orderDashboardSeedPlacements([child])).toThrow('Dashboard seed parent placement is missing: missing-parent')
    })

    it('rejects a cyclic semantic placement graph', () => {
        const first = columnContainer('first', 'column:first', 1, 'second')
        const second = columnContainer('second', 'column:second', 2, 'first')

        expect(() => orderDashboardSeedPlacements([first, second])).toThrow('Dashboard seed placement graph cannot contain cycles.')
    })

    it('rejects a child assigned to a slot not declared by its parent', () => {
        const parent = columnContainer('parent', 'column:content', 1)
        const child = makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'quizWidget',
            instanceKey: 'child',
            sortOrder: 2,
            parentInstanceKey: 'parent',
            slotKey: 'column:missing'
        })

        expect(() => orderDashboardSeedPlacements([parent, child])).toThrow(
            'Dashboard child placement is incompatible with parent slot: parent/column:missing'
        )
    })
})
