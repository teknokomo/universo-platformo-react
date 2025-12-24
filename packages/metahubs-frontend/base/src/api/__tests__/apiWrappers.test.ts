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

            if (url === '/metahubs/m1/entities') {
                return Promise.resolve({ data: [{ id: 'e1' }], headers: {} })
            }

            if (url === '/metahubs/m1/sections') {
                return Promise.resolve({ data: [{ id: 's1' }], headers: {} })
            }

            if (url === '/metahubs/m1/members') {
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
        expect(get).toHaveBeenCalledWith('/metahubs/m1')

        api.createMetahub({ name: { en: 'Name' }, description: { en: 'Desc' } })
        expect(post).toHaveBeenCalledWith('/metahubs', { name: { en: 'Name' }, description: { en: 'Desc' } })

        api.updateMetahub('m1', { name: { en: 'N2' } })
        expect(put).toHaveBeenCalledWith('/metahubs/m1', { name: { en: 'N2' } })

        api.deleteMetahub('m1')
        expect(del).toHaveBeenCalledWith('/metahubs/m1')

        await api.listMetahubMetaEntities('m1', { limit: 20, offset: 40, sortBy: 'updated', sortOrder: 'asc', search: 'e' })
        expect(get).toHaveBeenCalledWith('/metahubs/m1/entities', {
            params: { limit: 20, offset: 40, sortBy: 'updated', sortOrder: 'asc', search: 'e' }
        })

        await api.listMetahubMetaSections('m1', { limit: 5, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 's' })
        expect(get).toHaveBeenCalledWith('/metahubs/m1/sections', {
            params: { limit: 5, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 's' }
        })

        const members = await api.listMetahubMembers('m1', { limit: 10, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'a' })
        expect(get).toHaveBeenCalledWith('/metahubs/m1/members', {
            params: { limit: 10, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'a' }
        })
        expect(members).toEqual({
            items: [{ id: 'u1' }],
            pagination: { total: 1, limit: 10, offset: 0, count: 1, hasMore: false }
        })

        api.inviteMetahubMember('m1', { email: 't@example.com', role: 'admin' as any })
        expect(post).toHaveBeenCalledWith('/metahubs/m1/members', { email: 't@example.com', role: 'admin' })

        api.updateMetahubMemberRole('m1', 'u1', { role: 'viewer' as any })
        expect(patch).toHaveBeenCalledWith('/metahubs/m1/members/u1', { role: 'viewer' })

        api.removeMetahubMember('m1', 'u1')
        expect(del).toHaveBeenCalledWith('/metahubs/m1/members/u1')
    })

    it('meta entities + meta sections api wrappers: list + CRUD wrappers call correct endpoints', async () => {
        const get = vi.fn()
        const post = vi.fn()
        const put = vi.fn()
        const del = vi.fn()

        const extractPaginationMeta = vi.fn().mockReturnValue({
            limit: 20,
            offset: 0,
            count: 1,
            total: 1,
            hasMore: false
        })

        get.mockResolvedValue({ data: [{ id: 'x1' }], headers: {} })

        vi.doMock('../apiClient', () => ({
            default: { get, post, put, delete: del },
            extractPaginationMeta
        }))

        const entitiesApi = await import('../metaEntities')
        const sectionsApi = await import('../metaSections')

        await entitiesApi.listMetaEntities({ limit: 20, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'q' })
        expect(get).toHaveBeenCalledWith('/meta-entities', {
            params: { limit: 20, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'q' }
        })

        entitiesApi.getEntity('e1')
        expect(get).toHaveBeenCalledWith('/meta-entities/e1')

        entitiesApi.createEntity({ name: 'E', sectionId: 's1' })
        expect(post).toHaveBeenCalledWith('/meta-entities', { name: 'E', sectionId: 's1' })

        entitiesApi.updateEntity('e1', { name: 'E2' })
        expect(put).toHaveBeenCalledWith('/meta-entities/e1', { name: 'E2' })

        entitiesApi.deleteEntity('e1')
        expect(del).toHaveBeenCalledWith('/meta-entities/e1')

        await sectionsApi.listMetaSections({ limit: 20, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'q' })
        expect(get).toHaveBeenCalledWith('/meta-sections', {
            params: { limit: 20, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'q' }
        })

        sectionsApi.getSection('s1')
        expect(get).toHaveBeenCalledWith('/meta-sections/s1')

        sectionsApi.createSection({ name: 'S', metahubId: 'm1' })
        expect(post).toHaveBeenCalledWith('/meta-sections', { name: 'S', metahubId: 'm1' })

        sectionsApi.updateSection('s1', { name: 'S2' })
        expect(put).toHaveBeenCalledWith('/meta-sections/s1', { name: 'S2' })

        sectionsApi.deleteSection('s1')
        expect(del).toHaveBeenCalledWith('/meta-sections/s1')

        sectionsApi.getSectionMetaEntities('s1')
        expect(get).toHaveBeenCalledWith('/meta-sections/s1/meta-entities')

        sectionsApi.addEntityToSection('s1', 'e1')
        expect(post).toHaveBeenCalledWith('/meta-sections/s1/meta-entities/e1')

        sectionsApi.assignEntityToSection('e1', 's1')
        expect(put).toHaveBeenCalledWith('/meta-entities/e1/section', { sectionId: 's1' })

        sectionsApi.removeEntityFromSection('e1')
        expect(del).toHaveBeenCalledWith('/meta-entities/e1/section')
    })
})
