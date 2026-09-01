import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

describe('applications-frontend api wrappers', () => {
    it('propagates explicit workspace scope to runtime list and row mutations', async () => {
        const get = vi.fn().mockResolvedValue({ data: {} })
        const patch = vi.fn().mockResolvedValue({ data: { id: 'row-1' } })
        const post = vi.fn().mockResolvedValue({ data: { id: 'row-1' } })
        const del = vi.fn().mockResolvedValue({ data: undefined })

        vi.doMock('../apiClient', () => ({
            default: { get, post, patch, delete: del }
        }))

        const api = await import('../applications')

        await api.getApplicationRuntime('app-1', {
            limit: 20,
            offset: 0,
            locale: 'en',
            workspaceId: 'workspace-a'
        })
        await api.updateApplicationRuntimeRow({
            applicationId: 'app-1',
            rowId: 'row-1',
            objectCollectionId: 'object-1',
            workspaceId: 'workspace-b',
            data: { title: 'Updated' }
        })

        expect(get).toHaveBeenCalledWith('/applications/app-1/runtime', {
            params: {
                limit: 20,
                offset: 0,
                locale: 'en',
                objectCollectionId: undefined,
                search: undefined,
                sort: undefined,
                filters: undefined,
                workspaceId: 'workspace-a'
            }
        })
        expect(patch).toHaveBeenCalledWith(
            '/applications/app-1/runtime/rows/row-1',
            { data: { title: 'Updated' }, objectCollectionId: 'object-1' },
            { params: { workspaceId: 'workspace-b' } }
        )
    })

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

        post.mockResolvedValueOnce({ data: { items: [{ id: 'widget-1', isCustomized: false }] } })
        const resetWidgets = await api.resetApplicationLayoutWidgetConfigsBatch('app-1', {
            updates: [
                {
                    layoutId: '018f8a78-7b8f-7c1d-a111-2222333345a1',
                    widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                    expectedVersion: 2
                }
            ]
        })
        expect(post).toHaveBeenCalledWith('/applications/app-1/layouts/zone-widgets/config/reset', {
            updates: [
                {
                    layoutId: '018f8a78-7b8f-7c1d-a111-2222333345a1',
                    widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                    expectedVersion: 2
                }
            ]
        })
        expect(resetWidgets).toEqual([{ id: 'widget-1', isCustomized: false }])

        post.mockResolvedValueOnce({ data: { item: { id: 'layout-1', templateKey: 'marketing-page', version: 8 } } })
        const resetLayout = await api.resetApplicationLayoutConfig('app-1', 'layout-1', { expectedVersion: 7 })
        expect(post).toHaveBeenCalledWith('/applications/app-1/layouts/layout-1/config/reset', { expectedVersion: 7 })
        expect(resetLayout).toEqual({ id: 'layout-1', templateKey: 'marketing-page', version: 8 })

        await api.getApplicationRuntime('app-1', {
            limit: 25,
            offset: 50,
            locale: 'ru',
            sectionId: 'section-1',
            search: 'course',
            sort: [{ field: 'name', direction: 'asc' }],
            filters: [{ field: 'status', operator: 'equals', value: 'active' }]
        })
        expect(get).toHaveBeenCalledWith('/applications/app-1/runtime', {
            params: {
                limit: 25,
                offset: 50,
                locale: 'ru',
                objectCollectionId: 'section-1',
                search: 'course',
                sort: JSON.stringify([{ field: 'name', direction: 'asc' }]),
                filters: JSON.stringify([{ field: 'status', operator: 'equals', value: 'active' }])
            }
        })

        patch.mockResolvedValueOnce({ data: { id: 'row-1', title: 'Updated' } })
        await api.updateApplicationRuntimeRow({
            applicationId: 'app-1',
            rowId: 'row-1',
            objectCollectionId: 'object-1',
            data: { title: 'Updated' },
            expectedVersion: 3
        })
        expect(patch).toHaveBeenCalledWith('/applications/app-1/runtime/rows/row-1', {
            data: { title: 'Updated' },
            objectCollectionId: 'object-1',
            expectedVersion: 3
        })

        await api.deleteApplicationRuntimeRow({
            applicationId: 'app-1',
            rowId: 'row-1',
            objectCollectionId: 'object-1',
            expectedVersion: 4
        })
        expect(del).toHaveBeenCalledWith('/applications/app-1/runtime/rows/row-1', {
            params: { objectCollectionId: 'object-1', expectedVersion: 4 }
        })

        await api.restoreApplicationRuntimeRow({
            applicationId: 'app-1',
            rowId: 'row-1',
            objectCollectionId: 'object-1',
            expectedVersion: 5,
            restoreTarget: {
                mode: 'target',
                targetObjectCollectionId: 'project-object',
                targetRecordId: 'project-row',
                parentFieldCodename: 'ProjectId'
            }
        })
        expect(post).toHaveBeenCalledWith('/applications/app-1/runtime/rows/row-1/restore', {
            objectCollectionId: 'object-1',
            expectedVersion: 5,
            restoreTarget: {
                mode: 'target',
                targetObjectCollectionId: 'project-object',
                targetRecordId: 'project-row',
                parentFieldCodename: 'ProjectId'
            }
        })

        post.mockResolvedValueOnce({ data: { id: 'row-copy' } })
        await api.copyApplicationRuntimeRow({
            applicationId: 'app-1',
            rowId: 'row-1',
            objectCollectionId: 'object-1',
            copyChildTables: false,
            data: { title: 'Copy' },
            expectedVersion: 6
        })
        expect(post).toHaveBeenCalledWith('/applications/app-1/runtime/rows/row-1/copy', {
            copyChildTables: false,
            objectCollectionId: 'object-1',
            data: { title: 'Copy' },
            expectedVersion: 6
        })

        await api.reorderApplicationRuntimeRows({
            applicationId: 'app-1',
            objectCollectionId: 'object-1',
            orderedRowIds: ['row-a', 'row-b'],
            expectedVersionsByRowId: { 'row-a': 1, 'row-b': 2 }
        })
        expect(post).toHaveBeenCalledWith('/applications/app-1/runtime/rows/reorder', {
            objectCollectionId: 'object-1',
            orderedRowIds: ['row-a', 'row-b'],
            expectedVersionsByRowId: { 'row-a': 1, 'row-b': 2 }
        })

        api.copyApplication('m1', { name: { en: 'Copy Name' }, copyConnector: true, createSchema: false, copyAccess: true })
        expect(post).toHaveBeenCalledWith('/applications/m1/copy', {
            name: { en: 'Copy Name' },
            copyConnector: true,
            copyAccess: true
        })

        post.mockResolvedValueOnce({ data: { id: 'row-1', _app_record_state: 'posted' } })
        const postedRow = await api.runApplicationRuntimeRecordCommand({
            applicationId: 'app-1',
            rowId: 'row-1',
            command: 'post',
            objectCollectionId: 'object-1',
            expectedVersion: 7
        })
        expect(post).toHaveBeenCalledWith('/applications/app-1/runtime/rows/row-1/post', {
            objectCollectionId: 'object-1',
            expectedVersion: 7
        })
        expect(postedRow).toEqual({ id: 'row-1', _app_record_state: 'posted' })

        post.mockResolvedValueOnce({ data: { id: 'row-1', Status: 'PendingReview' } })
        const workflowRow = await api.runApplicationRuntimeWorkflowAction({
            applicationId: 'app-1',
            rowId: 'row-1',
            actionCodename: 'StartSubmissionReview',
            objectCollectionId: 'object-1',
            expectedVersion: 8
        })
        expect(post).toHaveBeenCalledWith('/applications/app-1/runtime/rows/row-1/workflow/StartSubmissionReview', {
            objectCollectionId: 'object-1',
            expectedVersion: 8
        })
        expect(workflowRow).toEqual({ id: 'row-1', Status: 'PendingReview' })

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
