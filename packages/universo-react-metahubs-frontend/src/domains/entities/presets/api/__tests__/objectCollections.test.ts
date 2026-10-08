import { beforeEach, describe, expect, it, vi } from 'vitest'

const { patch, post } = vi.hoisted(() => ({ patch: vi.fn(), post: vi.fn() }))

vi.mock('../../../../shared', () => ({
    apiClient: { patch, post }
}))

import {
    createObjectCollection,
    createObjectCollectionAtMetahub,
    updateObjectCollection,
    updateObjectCollectionAtMetahub
} from '../objectCollections'

describe('ObjectCollection API config serialization', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('keeps per-Object runtime navigation settings when creating without a Hub', async () => {
        const data = {
            codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Space' } } },
            name: { en: 'Space' },
            config: { runtime: { menuVisibility: 'primary', icon: 'apps', customRuntimeFlag: true } },
            treeEntityIds: [],
            isSingleHub: false,
            isRequiredHub: false
        }

        await createObjectCollectionAtMetahub('metahub-1', data as never)

        expect(post).toHaveBeenCalledWith(
            '/metahub/metahub-1/entities/object/instances',
            expect.objectContaining({
                config: expect.objectContaining({
                    runtime: { menuVisibility: 'primary', icon: 'apps', customRuntimeFlag: true },
                    hubs: [],
                    isSingleHub: false,
                    isRequiredHub: false
                })
            })
        )
    })

    it('sends only allowlisted navigation fields to the strict Hub-scoped create route', async () => {
        const data = {
            codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Space' } } },
            name: { en: 'Space' },
            config: { runtime: { menuVisibility: 'primary', icon: 'analytics', customRuntimeFlag: true } }
        }

        await createObjectCollection('metahub-1', 'hub-1', data as never)

        expect(post).toHaveBeenCalledWith(
            '/metahub/metahub-1/entities/object/instance/hub-1/instances',
            expect.objectContaining({ runtimeMenuVisible: true, runtimeMenuIcon: 'analytics' })
        )
        expect(post.mock.calls[0][1]).not.toHaveProperty('config')
        expect(post.mock.calls[0][1]).not.toHaveProperty('runtime')
    })

    it('preserves custom runtime fields while updating per-Object menu visibility', async () => {
        const data = {
            config: { runtime: { menuVisibility: 'primary', icon: 'analytics', customRuntimeFlag: true } },
            treeEntityIds: ['hub-1'],
            expectedVersion: 4
        }

        await updateObjectCollectionAtMetahub('metahub-1', 'object-1', data as never)

        expect(patch).toHaveBeenCalledWith(
            '/metahub/metahub-1/entities/object/instance/object-1',
            expect.objectContaining({
                config: expect.objectContaining({
                    runtime: { menuVisibility: 'primary', icon: 'analytics', customRuntimeFlag: true },
                    hubs: ['hub-1']
                }),
                expectedVersion: 4
            })
        )
    })

    it('sends visibility only when disabling navigation through the strict Hub-scoped update route', async () => {
        const data = {
            config: { runtime: { theme: 'dark' } },
            expectedVersion: 4
        }

        await updateObjectCollection('metahub-1', 'hub-1', 'object-1', data as never)

        expect(patch).toHaveBeenCalledWith(
            '/metahub/metahub-1/entities/object/instance/hub-1/instance/object-1',
            expect.objectContaining({ runtimeMenuVisible: false, expectedVersion: 4 })
        )
        expect(patch.mock.calls[0][1]).not.toHaveProperty('runtimeMenuIcon')
        expect(patch.mock.calls[0][1]).not.toHaveProperty('config')
    })
})
