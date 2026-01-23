import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

describe('metahubs-frontend api wrappers', () => {
    it('metahubs api: list + CRUD wrappers call correct endpoints', async () => {
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
            if (url === '/metahubs') {
                return Promise.resolve({
                    data: {
                        items: [{ id: 'm1' }, { id: 'm2' }],
                        total: 2,
                        limit: 10,
                        offset: 0
                    }
                })
            }

            if (url === '/metahub/m1/members') {
                return Promise.resolve({
                    data: { members: [{ id: 'u1' }], total: 1 }
                })
            }

            return Promise.resolve({ data: {}, headers: {} })
        })

        vi.doMock('../../../shared', () => ({
            apiClient: { get, post, put, patch, delete: del },
            extractPaginationMeta
        }))

        const api = await import('../metahubs')

        const list = await api.listMetahubs({ limit: 10, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'q', showAll: true })
        expect(get).toHaveBeenCalledWith('/metahubs', {
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

        api.getMetahub('m1')
        expect(get).toHaveBeenCalledWith('/metahub/m1')

        api.createMetahub({ codename: 'test-metahub', name: { en: 'Name' }, description: { en: 'Desc' } })
        expect(post).toHaveBeenCalledWith('/metahubs', { codename: 'test-metahub', name: { en: 'Name' }, description: { en: 'Desc' } })

        api.updateMetahub('m1', { name: { en: 'N2' } })
        expect(put).toHaveBeenCalledWith('/metahub/m1', { name: { en: 'N2' } })

        api.deleteMetahub('m1')
        expect(del).toHaveBeenCalledWith('/metahub/m1')

        const members = await api.listMetahubMembers('m1', { limit: 10, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'a' })
        expect(get).toHaveBeenCalledWith('/metahub/m1/members', {
            params: { limit: 10, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'a' }
        })
        expect(members).toEqual({
            items: [{ id: 'u1' }],
            pagination: { total: 1, limit: 10, offset: 0, count: 1, hasMore: false }
        })

        api.inviteMetahubMember('m1', { email: 't@example.com', role: 'admin' as any })
        expect(post).toHaveBeenCalledWith('/metahub/m1/members', { email: 't@example.com', role: 'admin' })

        api.updateMetahubMemberRole('m1', 'u1', { role: 'viewer' as any })
        expect(patch).toHaveBeenCalledWith('/metahub/m1/member/u1', { role: 'viewer' })

        api.removeMetahubMember('m1', 'u1')
        expect(del).toHaveBeenCalledWith('/metahub/m1/member/u1')
    })
})
