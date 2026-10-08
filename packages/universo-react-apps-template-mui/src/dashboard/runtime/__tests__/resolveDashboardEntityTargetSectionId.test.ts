import { describe, expect, it } from 'vitest'
import { resolveDashboardEntityTargetSectionId, type DashboardEntityIndex } from '../resolveDashboardEntityTargetSectionId'

const entities = (sections: Array<{ id: string; codename: string }>, objectCollections: Array<{ id: string; codename: string }>) =>
    ({ sections, objectCollections } satisfies DashboardEntityIndex)

describe('resolveDashboardEntityTargetSectionId', () => {
    it('prefers an explicit target ID', () => {
        expect(resolveDashboardEntityTargetSectionId({ rowId: 'row-1', sectionId: 'explicit-id' }, undefined)).toBe('explicit-id')
    })

    it('resolves a codename when all matching entity records share one ID', () => {
        expect(
            resolveDashboardEntityTargetSectionId(
                { rowId: 'row-1', objectCollectionCodename: 'orders' },
                entities([{ id: 'entity-1', codename: 'orders' }], [{ id: 'entity-1', codename: 'orders' }])
            )
        ).toBe('entity-1')
    })

    it('fails closed when a codename matches multiple entity IDs', () => {
        expect(
            resolveDashboardEntityTargetSectionId(
                { rowId: 'row-1', objectCollectionCodename: 'orders' },
                entities([{ id: 'entity-1', codename: 'orders' }], [{ id: 'entity-2', codename: 'orders' }])
            )
        ).toBeNull()
    })

    it('returns null when the target has no ID or codename', () => {
        expect(resolveDashboardEntityTargetSectionId({ rowId: 'row-1' }, entities([], []))).toBeNull()
    })

    it('resolves shared create-target fields with the same ambiguity policy', () => {
        expect(
            resolveDashboardEntityTargetSectionId({ sectionCodename: 'orders' }, entities([{ id: 'entity-1', codename: 'orders' }], []))
        ).toBe('entity-1')
        expect(
            resolveDashboardEntityTargetSectionId(
                { objectCollectionCodename: 'orders' },
                entities([{ id: 'entity-1', codename: 'orders' }], [{ id: 'entity-2', codename: 'orders' }])
            )
        ).toBeNull()
    })
})
