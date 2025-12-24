import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

describe('metaverses-frontend api wrappers', () => {
    it('metaverses api: list + CRUD wrappers call correct endpoints', async () => {
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

        get.mockResolvedValue({ data: [{ id: 'm1' }, { id: 'm2' }], headers: {} })

        vi.doMock('../apiClient', () => ({
            default: { get, post, put, patch, delete: del },
            extractPaginationMeta
        }))

        const api = await import('../metaverses')

        const list = await api.listMetaverses({ limit: 10, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'q', showAll: true })
        expect(get).toHaveBeenCalledWith('/metaverses', {
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

        api.getMetaverse('m1')
        expect(get).toHaveBeenCalledWith('/metaverses/m1')

        api.createMetaverse({ name: 'Name', description: 'Desc' })
        expect(post).toHaveBeenCalledWith('/metaverses', { name: 'Name', description: 'Desc' })

        api.updateMetaverse('m1', { name: 'N2' })
        expect(put).toHaveBeenCalledWith('/metaverses/m1', { name: 'N2' })

        api.deleteMetaverse('m1')
        expect(del).toHaveBeenCalledWith('/metaverses/m1')

        await api.listMetaverseEntities('m1', { limit: 20, offset: 40, sortBy: 'updated', sortOrder: 'asc', search: 'e' })
        expect(get).toHaveBeenCalledWith('/metaverses/m1/entities', {
            params: { limit: 20, offset: 40, sortBy: 'updated', sortOrder: 'asc', search: 'e' }
        })

        api.addEntityToMetaverse('m1', 'e1')
        expect(post).toHaveBeenCalledWith('/metaverses/m1/entities/e1')

        api.removeEntityFromMetaverse('m1', 'e1')
        expect(del).toHaveBeenCalledWith('/metaverses/m1/entities/e1')

        api.reorderMetaverseEntities('m1', [{ entityId: 'e1', sortOrder: 1 }])
        expect(post).toHaveBeenCalledWith('/metaverses/m1/entities/reorder', { items: [{ entityId: 'e1', sortOrder: 1 }] })

        await api.listMetaverseSections('m1', { limit: 5, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 's' })
        expect(get).toHaveBeenCalledWith('/metaverses/m1/sections', {
            params: { limit: 5, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 's' }
        })

        api.addSectionToMetaverse('m1', 's1')
        expect(post).toHaveBeenCalledWith('/metaverses/m1/sections/s1')

        await api.listMetaverseMembers('m1', { limit: 10, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'a' })
        expect(get).toHaveBeenCalledWith('/metaverses/m1/members', {
            params: { limit: 10, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'a' }
        })

        api.inviteMetaverseMember('m1', { email: 't@example.com', role: 'admin' as any })
        expect(post).toHaveBeenCalledWith('/metaverses/m1/members', { email: 't@example.com', role: 'admin' })

        api.updateMetaverseMemberRole('m1', 'u1', { role: 'viewer' as any })
        expect(patch).toHaveBeenCalledWith('/metaverses/m1/members/u1', { role: 'viewer' })

        api.removeMetaverseMember('m1', 'u1')
        expect(del).toHaveBeenCalledWith('/metaverses/m1/members/u1')
    })

    it('entities + sections api wrappers: list + CRUD wrappers call correct endpoints', async () => {
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

        const entitiesApi = await import('../entities')
        const sectionsApi = await import('../sections')

        await entitiesApi.listEntities({ limit: 20, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'q' })
        expect(get).toHaveBeenCalledWith('/entities', {
            params: { limit: 20, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'q' }
        })

        entitiesApi.getEntity('e1')
        expect(get).toHaveBeenCalledWith('/entities/e1')

        entitiesApi.createEntity({ name: 'E', sectionId: 's1' })
        expect(post).toHaveBeenCalledWith('/entities', { name: 'E', sectionId: 's1' })

        entitiesApi.updateEntity('e1', { name: 'E2' })
        expect(put).toHaveBeenCalledWith('/entities/e1', { name: 'E2' })

        entitiesApi.deleteEntity('e1')
        expect(del).toHaveBeenCalledWith('/entities/e1')

        await sectionsApi.listSections({ limit: 20, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'q' })
        expect(get).toHaveBeenCalledWith('/sections', {
            params: { limit: 20, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'q' }
        })

        sectionsApi.getSection('s1')
        expect(get).toHaveBeenCalledWith('/sections/s1')

        sectionsApi.createSection({ name: 'S', metaverseId: 'm1' })
        expect(post).toHaveBeenCalledWith('/sections', { name: 'S', metaverseId: 'm1' })

        sectionsApi.updateSection('s1', { name: 'S2' })
        expect(put).toHaveBeenCalledWith('/sections/s1', { name: 'S2' })

        sectionsApi.deleteSection('s1')
        expect(del).toHaveBeenCalledWith('/sections/s1')

        sectionsApi.getSectionEntities('s1')
        expect(get).toHaveBeenCalledWith('/sections/s1/entities')

        sectionsApi.addEntityToSection('s1', 'e1')
        expect(post).toHaveBeenCalledWith('/sections/s1/entities/e1')

        sectionsApi.assignEntityToSection('e1', 's1')
        expect(put).toHaveBeenCalledWith('/entities/e1/section', { sectionId: 's1' })

        sectionsApi.removeEntityFromSection('e1')
        expect(del).toHaveBeenCalledWith('/entities/e1/section')
    })
})
