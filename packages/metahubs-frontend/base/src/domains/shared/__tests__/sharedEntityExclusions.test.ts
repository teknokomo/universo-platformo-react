import { beforeEach, describe, expect, it, vi } from 'vitest'

const listSharedEntityOverridesByEntityMock = vi.fn()
const upsertSharedEntityOverrideMock = vi.fn()

vi.mock('../api/sharedEntityOverrides', () => ({
    listSharedEntityOverridesByEntity: (...args: unknown[]) => listSharedEntityOverridesByEntityMock(...args),
    upsertSharedEntityOverride: (...args: unknown[]) => upsertSharedEntityOverrideMock(...args)
}))

import {
    normalizeSharedExcludedTargetIds,
    readSharedExcludedTargetIdsField,
    resolveSharedEntityExclusionChanges,
    syncSharedEntityExclusions
} from '../sharedEntityExclusions'

describe('sharedEntityExclusions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('normalizes the hidden exclusion field into a unique ordered array', () => {
        expect(readSharedExcludedTargetIdsField({ _sharedExcludedTargetIds: ['catalog-2', 'catalog-1', 'catalog-2', ''] })).toEqual([
            'catalog-2',
            'catalog-1'
        ])
        expect(normalizeSharedExcludedTargetIds(['catalog-1', 'catalog-1', 123, 'catalog-2'])).toEqual(['catalog-1', 'catalog-2'])
    })

    it('computes only the exclusion state transitions that actually changed', () => {
        expect(
            resolveSharedEntityExclusionChanges(
                [
                    { targetObjectId: 'catalog-1', isExcluded: true },
                    { targetObjectId: 'catalog-2', isExcluded: false },
                    { targetObjectId: 'catalog-3', isExcluded: true }
                ],
                ['catalog-2', 'catalog-3']
            )
        ).toEqual([
            { targetObjectId: 'catalog-1', isExcluded: false },
            { targetObjectId: 'catalog-2', isExcluded: true }
        ])
    })

    it('syncs only changed exclusion states and preserves non-exclusion override fields through upserts', async () => {
        listSharedEntityOverridesByEntityMock.mockResolvedValue([
            { targetObjectId: 'catalog-1', isExcluded: true },
            { targetObjectId: 'catalog-3', isExcluded: false }
        ])
        upsertSharedEntityOverrideMock.mockResolvedValue(null)

        await syncSharedEntityExclusions({
            metahubId: 'metahub-1',
            entityKind: 'attribute',
            sharedEntityId: 'attribute-1',
            excludedTargetIds: ['catalog-2']
        })

        expect(listSharedEntityOverridesByEntityMock).toHaveBeenCalledWith('metahub-1', 'attribute', 'attribute-1')
        expect(upsertSharedEntityOverrideMock).toHaveBeenCalledTimes(2)
        expect(upsertSharedEntityOverrideMock).toHaveBeenNthCalledWith(1, 'metahub-1', {
            entityKind: 'attribute',
            sharedEntityId: 'attribute-1',
            targetObjectId: 'catalog-1',
            isExcluded: false
        })
        expect(upsertSharedEntityOverrideMock).toHaveBeenNthCalledWith(2, 'metahub-1', {
            entityKind: 'attribute',
            sharedEntityId: 'attribute-1',
            targetObjectId: 'catalog-2',
            isExcluded: true
        })
    })

    it('skips writes when the desired exclusions already match the stored override state', async () => {
        listSharedEntityOverridesByEntityMock.mockResolvedValue([{ targetObjectId: 'catalog-2', isExcluded: true }])

        await syncSharedEntityExclusions({
            metahubId: 'metahub-1',
            entityKind: 'attribute',
            sharedEntityId: 'attribute-1',
            excludedTargetIds: ['catalog-2']
        })

        expect(upsertSharedEntityOverrideMock).not.toHaveBeenCalled()
    })
})
