import { buildMergedSharedEntityList, planMergedSharedEntityOrder } from '../../domains/shared/mergedSharedEntityList'

describe('mergedSharedEntityList', () => {
    it('keeps locked shared items in the top zone and filters excluded shared items', () => {
        const items = buildMergedSharedEntityList({
            localItems: [
                { id: 'local-1', sortOrder: 1 },
                { id: 'local-2', sortOrder: 2 }
            ],
            sharedItems: [
                { id: 'shared-locked', sortOrder: 2, uiConfig: { sharedBehavior: { positionLocked: true } } },
                { id: 'shared-free', sortOrder: 1, uiConfig: { sharedBehavior: { positionLocked: false } } },
                { id: 'shared-excluded', sortOrder: 3, uiConfig: { sharedBehavior: { positionLocked: false } } }
            ],
            overrides: [
                {
                    id: 'override-1',
                    entityKind: 'component',
                    sharedEntityId: 'shared-excluded',
                    targetObjectId: 'object-1',
                    isExcluded: true,
                    isActive: null,
                    sortOrder: null,
                    version: 1
                }
            ],
            getId: (item) => item.id,
            getSortOrder: (item) => item.sortOrder,
            getSharedBehavior: (item) => item.uiConfig?.sharedBehavior,
            includeInactive: true
        })

        expect(items.map((item) => item.id)).toEqual(['shared-locked', 'shared-free', 'local-1', 'local-2'])
        expect(items.map((item) => item.effectiveSortOrder)).toEqual([1, 2, 3, 4])
        expect(items.find((item) => item.id === 'shared-locked')).toMatchObject({ isShared: true, isActive: true })
        expect(items.some((item) => item.id === 'shared-excluded')).toBe(false)
    })

    it('derives local and shared assignments from the merged movable order', () => {
        const mergedItems = buildMergedSharedEntityList({
            localItems: [
                { id: 'local-a', sortOrder: 1 },
                { id: 'local-b', sortOrder: 2 },
                { id: 'local-c', sortOrder: 3 }
            ],
            sharedItems: [{ id: 'shared-x', sortOrder: 1, uiConfig: { sharedBehavior: { positionLocked: false } } }],
            overrides: [],
            getId: (item) => item.id,
            getSortOrder: (item) => item.sortOrder,
            getSharedBehavior: (item) => item.uiConfig?.sharedBehavior,
            includeInactive: true
        })

        const assignments = planMergedSharedEntityOrder(mergedItems, ['local-c', 'local-a', 'shared-x', 'local-b'])

        expect(assignments.localSortOrders).toEqual([
            { id: 'local-c', sortOrder: 1 },
            { id: 'local-a', sortOrder: 2 },
            { id: 'local-b', sortOrder: 3 }
        ])
        expect(assignments.sharedSortOrders).toEqual([{ id: 'shared-x', sortOrder: 3 }])
    })
})
