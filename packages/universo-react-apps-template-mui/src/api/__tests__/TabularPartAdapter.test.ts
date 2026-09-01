import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTabularPartAdapter } from '../TabularPartAdapter'

describe('createTabularPartAdapter workspace scope', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('keeps the parent child-row transport scoped to each workspace', async () => {
        const requestedUrls: URL[] = []
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            requestedUrls.push(new URL(String(input)))
            return new Response(JSON.stringify({ items: [{ id: 'row-1' }], total: 1 }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)
        window.sessionStorage.setItem('up.auth.csrf', 'csrf-token')

        const adapter = createTabularPartAdapter({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            objectCollectionId: 'object-1',
            parentRecordId: 'parent-1',
            componentId: 'component-1',
            childFields: []
        })

        await adapter.fetchList({ limit: 20, offset: 0, locale: 'en', workspaceId: 'workspace-a' })
        await adapter.fetchList({ limit: 20, offset: 0, locale: 'en', workspaceId: 'workspace-b' })
        await adapter.fetchRow('row-1', { workspaceId: 'workspace-a' })
        await adapter.copyRow('row/1', { workspaceId: 'workspace-b' })

        expect(requestedUrls.map((url) => url.searchParams.get('workspaceId'))).toEqual([
            'workspace-a',
            'workspace-b',
            'workspace-a',
            'workspace-b'
        ])
        expect(requestedUrls.every((url) => url.searchParams.get('objectCollectionId') === 'object-1')).toBe(true)
        expect(requestedUrls[3]?.pathname).toContain('/tabular/component-1/row%2F1/copy')
    })
})
