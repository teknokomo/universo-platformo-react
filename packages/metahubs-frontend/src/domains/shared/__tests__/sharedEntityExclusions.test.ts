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
        expect(readSharedExcludedTargetIdsField({ _sharedExcludedTargetIds: ['object-2', 'object-1', 'object-2', ''] })).toEqual([
            'object-2',
            'object-1'
        ])
        expect(normalizeSharedExcludedTargetIds(['object-1', 'object-1', 123, 'object-2'])).toEqual(['object-1', 'object-2'])
    })

    it('computes only the exclusion state transitions that actually changed', () => {
        expect(
            resolveSharedEntityExclusionChanges(
                [
                    { targetObjectId: 'object-1', isExcluded: true },
                    { targetObjectId: 'object-2', isExcluded: false },
                    { targetObjectId: 'object-3', isExcluded: true }
                ],
                ['object-2', 'object-3']
            )
        ).toEqual([
            { targetObjectId: 'object-1', isExcluded: false },
            { targetObjectId: 'object-2', isExcluded: true }
        ])
    })

    it('syncs only changed exclusion states and preserves non-exclusion override fields through upserts', async () => {
        listSharedEntityOverridesByEntityMock.mockResolvedValue([
            { targetObjectId: 'object-1', isExcluded: true },
            { targetObjectId: 'object-3', isExcluded: false }
        ])
        upsertSharedEntityOverrideMock.mockResolvedValue(null)

        await syncSharedEntityExclusions({
            metahubId: 'metahub-1',
            entityKind: 'component',
            sharedEntityId: 'component-1',
            excludedTargetIds: ['object-2']
        })

        expect(listSharedEntityOverridesByEntityMock).toHaveBeenCalledWith('metahub-1', 'component', 'component-1')
        expect(upsertSharedEntityOverrideMock).toHaveBeenCalledTimes(2)
        expect(upsertSharedEntityOverrideMock).toHaveBeenNthCalledWith(1, 'metahub-1', {
            entityKind: 'component',
            sharedEntityId: 'component-1',
            targetObjectId: 'object-1',
            isExcluded: false
        })
        expect(upsertSharedEntityOverrideMock).toHaveBeenNthCalledWith(2, 'metahub-1', {
            entityKind: 'component',
            sharedEntityId: 'component-1',
            targetObjectId: 'object-2',
            isExcluded: true
        })
    })

    it('skips writes when the desired exclusions already match the stored override state', async () => {
        listSharedEntityOverridesByEntityMock.mockResolvedValue([{ targetObjectId: 'object-2', isExcluded: true }])

        await syncSharedEntityExclusions({
            metahubId: 'metahub-1',
            entityKind: 'component',
            sharedEntityId: 'component-1',
            excludedTargetIds: ['object-2']
        })

        expect(upsertSharedEntityOverrideMock).not.toHaveBeenCalled()
    })
})
