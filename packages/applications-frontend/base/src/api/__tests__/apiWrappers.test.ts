import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

describe('applications-frontend api wrappers', () => {
    it('applications api: list + CRUD wrappers call correct endpoints', async () => {
        const get = vi.fn()
        const post = vi.fn()
        const put = vi.fn()
        const patch = vi.fn()
        const del = vi.fn()

        const extractPaginationMeta = vi.fn().mockReturnValue({
            limit: 10,
            offset: 0,
            count: 2,
            total: 2,
            hasMore: false
        })

        get.mockImplementation((url: string) => {
            if (url === '/applications') {
                return Promise.resolve({
                    data: {
                        items: [{ id: 'm1' }, { id: 'm2' }],
                        total: 2,
                        limit: 10,
                        offset: 0
                    }
                })
            }

            if (url === '/applications/app-1/connectors') {
                return Promise.resolve({
                    data: {
                        items: [{ id: 's1' }, { id: 's2' }],
                        pagination: { total: 2, limit: 10, offset: 0 }
                    }
                })
            }

            if (url === '/applications/m1/members') {
                return Promise.resolve({
                    data: { members: [{ id: 'u1' }], total: 1 }
                })
            }

            return Promise.resolve({ data: {}, headers: {} })
        })

        vi.doMock('../apiClient', () => ({
            default: { get, post, put, patch, delete: del },
            extractPaginationMeta
        }))

        const api = await import('../applications')
        const connectorsApi = await import('../connectors')

        const list = await api.listApplications({ limit: 10, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'q', showAll: true })
        expect(get).toHaveBeenCalledWith('/applications', {
            params: {
                limit: 10,
                offset: 0,
                sortBy: 'updated',
                sortOrder: 'desc',
                search: 'q',
                showAll: true
            }
        })
        expect(list).toEqual({
            items: [{ id: 'm1' }, { id: 'm2' }],
            pagination: { limit: 10, offset: 0, count: 2, total: 2, hasMore: false }
        })

        api.getApplication('m1')
        expect(get).toHaveBeenCalledWith('/applications/m1')

        api.createApplication({ name: { en: 'Name' }, description: { en: 'Desc' } })
        expect(post).toHaveBeenCalledWith('/applications', { name: { en: 'Name' }, description: { en: 'Desc' } })

        api.updateApplication('m1', { name: { en: 'N2' } })
        expect(patch).toHaveBeenCalledWith('/applications/m1', { name: { en: 'N2' } })

        api.deleteApplication('m1')
        expect(del).toHaveBeenCalledWith('/applications/m1')

        api.copyApplication('m1', { name: { en: 'Copy Name' }, copyAccess: true })
        expect(post).toHaveBeenCalledWith('/applications/m1/copy', { name: { en: 'Copy Name' }, copyAccess: true })

        const members = await api.listApplicationMembers('m1', { limit: 10, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'a' })
        expect(get).toHaveBeenCalledWith('/applications/m1/members', {
            params: { limit: 10, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'a' }
        })
        expect(members).toEqual({
            items: [{ id: 'u1' }],
            pagination: { total: 1, limit: 10, offset: 0, count: 1, hasMore: false }
        })

        api.inviteApplicationMember('m1', { email: 't@example.com', role: 'admin' as any })
        expect(post).toHaveBeenCalledWith('/applications/m1/members', { email: 't@example.com', role: 'admin' })

        api.updateApplicationMemberRole('m1', 'u1', { role: 'viewer' as any })
        expect(patch).toHaveBeenCalledWith('/applications/m1/members/u1', { role: 'viewer' })

        api.removeApplicationMember('m1', 'u1')
        expect(del).toHaveBeenCalledWith('/applications/m1/members/u1')

        const connectors = await connectorsApi.listConnectors('app-1', {
            limit: 10,
            offset: 0,
            sortBy: 'updated',
            sortOrder: 'desc',
            search: 'q'
        })
        expect(get).toHaveBeenCalledWith('/applications/app-1/connectors', {
            params: { limit: 10, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'q' }
        })
        expect(connectors).toEqual({
            items: [{ id: 's1' }, { id: 's2' }],
            pagination: { total: 2, limit: 10, offset: 0, count: 2, hasMore: false }
        })

        connectorsApi.getConnector('app-1', 's1')
        expect(get).toHaveBeenCalledWith('/applications/app-1/connectors/s1')

        connectorsApi.createConnector('app-1', {
            codename: 's',
            name: { en: 'Name' },
            description: { en: 'Desc' }
        })
        expect(post).toHaveBeenCalledWith('/applications/app-1/connectors', {
            codename: 's',
            name: { en: 'Name' },
            description: { en: 'Desc' }
        })

        connectorsApi.updateConnector('app-1', 's1', { codename: 's2' })
        expect(patch).toHaveBeenCalledWith('/applications/app-1/connectors/s1', { codename: 's2' })

        connectorsApi.deleteConnector('app-1', 's1')
        expect(del).toHaveBeenCalledWith('/applications/app-1/connectors/s1')
    })
})
