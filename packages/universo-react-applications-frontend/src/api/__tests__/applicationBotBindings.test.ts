import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

describe('application bot binding API', () => {
    it('projects only management fields from binding responses', async () => {
        const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312299'
        const bindingId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
        const binding = {
            id: bindingId,
            applicationId,
            platform: 'telegram',
            botUsername: 'supportbot',
            displayName: null,
            shortId: 'aBcdefGhijkLmNopQrStUv',
            status: 'active',
            version: 3,
            createdAt: '2026-10-31T10:00:00.000Z',
            updatedAt: '2026-10-31T10:01:00.000Z',
            updatedBy: 'internal-user-id',
            token: 'must-not-reach-the-ui'
        }
        const get = vi.fn().mockResolvedValue({ data: { items: [binding] } })
        const post = vi.fn()
        const patch = vi.fn()
        const del = vi.fn()
        vi.doMock('../apiClient', () => ({ default: { get, post, patch, delete: del } }))

        const api = await import('../applicationBotBindings')
        const result = await api.listApplicationBotBindings(applicationId)

        expect(get).toHaveBeenCalledWith(`/applications/${applicationId}/bot-bindings`)
        expect(result).toEqual([
            {
                id: bindingId,
                applicationId,
                platform: 'telegram',
                botUsername: 'supportbot',
                displayName: null,
                shortId: 'aBcdefGhijkLmNopQrStUv',
                status: 'active',
                version: 3,
                createdAt: '2026-10-31T10:00:00.000Z',
                updatedAt: '2026-10-31T10:01:00.000Z'
            }
        ])
    })

    it('sends the expected binding version on updates and irreversible release', async () => {
        const item = {
            id: '019ccefc-2f7b-7b36-82f4-85cdb1312268',
            applicationId: '019ccefc-2f7b-7b36-82f4-85cdb1312299',
            platform: 'max',
            botUsername: 'supportbot',
            displayName: null,
            shortId: 'aBcdefGhijkLmNopQrStUv',
            status: 'active',
            version: 4,
            createdAt: '2026-10-31T10:00:00.000Z',
            updatedAt: '2026-10-31T10:01:00.000Z'
        }
        const get = vi.fn()
        const post = vi.fn()
        const patch = vi.fn().mockResolvedValue({ data: item })
        const del = vi.fn().mockResolvedValue({ data: undefined })
        vi.doMock('../apiClient', () => ({ default: { get, post, patch, delete: del } }))

        const api = await import('../applicationBotBindings')
        await api.updateApplicationBotBinding('app-1', 'binding-1', {
            displayName: 'Support',
            expectedVersion: 3
        })
        await api.releaseApplicationBotBinding('app-1', 'binding-1', 4)

        expect(patch).toHaveBeenCalledWith('/applications/app-1/bot-bindings/binding-1', {
            displayName: 'Support',
            expectedVersion: 3
        })
        expect(del).toHaveBeenCalledWith('/applications/app-1/bot-bindings/binding-1', { data: { expectedVersion: 4 } })
    })
})
