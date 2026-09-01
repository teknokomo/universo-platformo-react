import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    copyRuntimeWorkspace,
    createRuntimeWorkspace,
    fetchRuntimeWorkspace,
    fetchRuntimeWorkspaceMembers,
    fetchRuntimeWorkspaces,
    resetRuntimeWorkspaceSeededContent,
    RuntimeWorkspaceApiError
} from '../workspaces'

const workspaceId = '019f7f10-0000-7000-8000-000000000002'
const workspaceCopyId = '019f7f10-0000-7000-8000-000000000001'
const authUserId = '550e8400-e29b-41d4-a716-446655440000'
const workspaceOptions = {
    apiBaseUrl: '/api/v1',
    applicationId: 'app-1',
    workspaceId
}
const workspaceRecord = {
    id: workspaceId,
    name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Workspace' } } },
    description: { _schema: '1', _primary: 'en', locales: { en: { content: 'Workspace description' } } },
    workspaceType: 'shared',
    personalUserId: null,
    status: 'active',
    isDefault: true,
    roleCodename: 'owner'
}
const workspaceListRecord = {
    items: [workspaceRecord],
    total: 1,
    limit: 100,
    offset: 0,
    currentWorkspaceId: workspaceId,
    permissions: { canCreateSharedWorkspace: true, canManageApplication: true }
}
const workspaceMembersRecord = {
    items: [{ userId: authUserId, roleCodename: 'member', email: 'member@example.com', nickname: 'Member', canRemove: true }],
    total: 1,
    limit: 100,
    offset: 0
}

const jsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    })

const copyOptions = {
    apiBaseUrl: '/api/v1',
    applicationId: 'app-1',
    workspaceId,
    name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Workspace copy' } } },
    description: { _schema: '1', _primary: 'en', locales: { en: { content: 'Copied workspace' } } }
}

const resetOptions = {
    apiBaseUrl: '/api/v1',
    applicationId: 'app-1',
    workspaceId
}

const stubWorkspaceResponse = (workspaceResponse: Response): ReturnType<typeof vi.fn> => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith('/auth/csrf')) {
            return jsonResponse({ csrfToken: 'csrf-token' })
        }
        return workspaceResponse
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

describe('runtime workspace read and create API helpers', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        window.sessionStorage.clear()
    })

    it('parses a workspace list and preserves the query contract', async () => {
        const fetchMock = stubWorkspaceResponse(jsonResponse(workspaceListRecord))

        await expect(
            fetchRuntimeWorkspaces({ ...workspaceOptions, params: { limit: 25, offset: 5, search: '  sales  ' } })
        ).resolves.toEqual(workspaceListRecord)

        const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]))
        expect(requestUrl.pathname).toBe('/api/v1/applications/app-1/runtime/workspaces')
        expect(requestUrl.searchParams.get('limit')).toBe('25')
        expect(requestUrl.searchParams.get('offset')).toBe('5')
        expect(requestUrl.searchParams.get('search')).toBe('sales')
        expect(fetchMock.mock.calls[0]?.[1]).toEqual({ credentials: 'include' })
    })

    it('rejects a workspace list containing a non-UUID-v7 workspace id', async () => {
        stubWorkspaceResponse(jsonResponse({ ...workspaceListRecord, items: [{ ...workspaceRecord, id: authUserId }] }))

        await expect(fetchRuntimeWorkspaces(workspaceOptions)).rejects.toMatchObject({
            name: 'RuntimeWorkspaceApiError',
            message: 'Failed to load workspaces'
        })
    })

    it('rejects a workspace list containing a malformed current workspace id', async () => {
        stubWorkspaceResponse(jsonResponse({ ...workspaceListRecord, currentWorkspaceId: 'not-a-uuid' }))

        await expect(fetchRuntimeWorkspaces(workspaceOptions)).rejects.toMatchObject({
            name: 'RuntimeWorkspaceApiError',
            message: 'Failed to load workspaces'
        })
    })

    it('parses a workspace detail response while accepting a Supabase auth UUID for personalUserId', async () => {
        const personalWorkspace = { ...workspaceRecord, workspaceType: 'personal', personalUserId: authUserId }
        stubWorkspaceResponse(jsonResponse(personalWorkspace))

        await expect(fetchRuntimeWorkspace(workspaceOptions)).resolves.toEqual(personalWorkspace)
    })

    it('rejects a workspace detail response with a non-UUID-v7 id', async () => {
        stubWorkspaceResponse(jsonResponse({ ...workspaceRecord, id: authUserId }))

        await expect(fetchRuntimeWorkspace(workspaceOptions)).rejects.toMatchObject({
            name: 'RuntimeWorkspaceApiError',
            message: 'Failed to load workspace'
        })
    })

    it('parses a created workspace response and validates its UUID-v7 id', async () => {
        const fetchMock = stubWorkspaceResponse(jsonResponse({ id: workspaceId }, 201))

        await expect(
            createRuntimeWorkspace({
                apiBaseUrl: '/api/v1',
                applicationId: 'app-1',
                name: workspaceRecord.name,
                description: workspaceRecord.description
            })
        ).resolves.toEqual({ id: workspaceId })

        const createRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(createRequest.method).toBe('POST')
        expect(createRequest.body).toBe(JSON.stringify({ name: workspaceRecord.name, description: workspaceRecord.description }))
    })

    it('rejects a created workspace response with a non-UUID-v7 id', async () => {
        stubWorkspaceResponse(jsonResponse({ id: authUserId }, 201))

        await expect(
            createRuntimeWorkspace({
                apiBaseUrl: '/api/v1',
                applicationId: 'app-1',
                name: workspaceRecord.name,
                description: workspaceRecord.description
            })
        ).rejects.toMatchObject({
            name: 'RuntimeWorkspaceApiError',
            message: 'Failed to create workspace'
        })
    })

    it('rejects malformed JSON from a successful workspace response without exposing parser details', async () => {
        const rawBackendDetails = 'Unexpected token from SQL relation app_runtime.workspace'
        stubWorkspaceResponse(new Response(rawBackendDetails, { status: 200 }))

        const error = await fetchRuntimeWorkspace(workspaceOptions).catch((value: unknown) => value)

        expect(error).toMatchObject({
            name: 'RuntimeWorkspaceApiError',
            message: 'Failed to load workspace'
        })
        expect((error as Error).message).not.toContain(rawBackendDetails)
    })
})

describe('runtime workspace member API helper', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        window.sessionStorage.clear()
    })

    it('parses member responses and keeps externally managed auth UUIDs intact', async () => {
        const fetchMock = stubWorkspaceResponse(jsonResponse(workspaceMembersRecord))

        await expect(fetchRuntimeWorkspaceMembers({ ...workspaceOptions, params: { limit: 25, offset: 5 } })).resolves.toEqual(
            workspaceMembersRecord
        )

        const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]))
        expect(requestUrl.pathname).toBe(`/api/v1/applications/app-1/runtime/workspaces/${workspaceId}/members`)
        expect(requestUrl.searchParams.get('limit')).toBe('25')
        expect(requestUrl.searchParams.get('offset')).toBe('5')
        expect(fetchMock.mock.calls[0]?.[1]).toEqual({ credentials: 'include' })
    })

    it('rejects malformed member user identifiers before the UI consumes them', async () => {
        stubWorkspaceResponse(
            jsonResponse({
                ...workspaceMembersRecord,
                items: [{ ...workspaceMembersRecord.items[0], userId: 'not-a-uuid' }]
            })
        )

        await expect(fetchRuntimeWorkspaceMembers(workspaceOptions)).rejects.toMatchObject({
            name: 'RuntimeWorkspaceApiError',
            message: 'Failed to load workspace members'
        })
    })
})

describe('runtime workspace copy API helper', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        window.sessionStorage.clear()
    })

    it('validates the copied workspace id before returning it to the navigation caller', async () => {
        const fetchMock = stubWorkspaceResponse(jsonResponse({ id: workspaceCopyId }))

        await expect(copyRuntimeWorkspace(copyOptions)).resolves.toEqual({ id: workspaceCopyId })

        const copyRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(copyRequest.method).toBe('POST')
        expect(copyRequest.body).toBe(JSON.stringify({ name: copyOptions.name, description: copyOptions.description }))
    })

    it('rejects malformed JSON from a successful response without exposing parser details', async () => {
        const rawBackendDetails = 'Unexpected token from SQL relation app_runtime.workspace_copy'
        stubWorkspaceResponse(new Response(rawBackendDetails, { status: 200 }))

        const error = await copyRuntimeWorkspace(copyOptions).catch((value: unknown) => value)

        expect(error).toMatchObject({
            name: 'RuntimeWorkspaceApiError',
            message: 'Failed to copy workspace'
        })
        expect((error as Error).message).not.toContain(rawBackendDetails)
    })

    it('rejects a successful response without an id before the caller can navigate', async () => {
        stubWorkspaceResponse(jsonResponse({ status: 'created' }))

        await expect(copyRuntimeWorkspace(copyOptions)).rejects.toMatchObject({
            name: 'RuntimeWorkspaceApiError',
            message: 'Failed to copy workspace'
        })
    })

    it('rejects a successful response with a non-UUID-v7 id', async () => {
        stubWorkspaceResponse(jsonResponse({ id: authUserId }))

        await expect(copyRuntimeWorkspace(copyOptions)).rejects.toMatchObject({
            name: 'RuntimeWorkspaceApiError',
            message: 'Failed to copy workspace'
        })
    })

    it('keeps the backend error code for localization while hiding raw error details', async () => {
        const rawBackendDetails = 'SQL relation app_runtime.workspace_copy failed for secret-row-id'
        stubWorkspaceResponse(
            jsonResponse(
                {
                    error: rawBackendDetails,
                    code: 'WORKSPACE_COPY_REFERENCE_UNRESOLVED',
                    details: { table: 'app_runtime.workspace_copy', rowId: 'secret-row-id' }
                },
                409
            )
        )

        const error = await copyRuntimeWorkspace(copyOptions).catch((value: unknown) => value)

        expect(error).toBeInstanceOf(RuntimeWorkspaceApiError)
        expect(error).toMatchObject({
            code: 'WORKSPACE_COPY_REFERENCE_UNRESOLVED',
            message: 'Failed to copy workspace'
        })
        expect((error as Error).message).not.toContain(rawBackendDetails)
        expect(JSON.stringify(error)).not.toContain('secret-row-id')
    })

    it('validates the durable reset operation id before returning the result', async () => {
        const operationId = '019f7f10-0000-7000-8000-000000000003'
        const fetchMock = stubWorkspaceResponse(jsonResponse({ resetRows: 4, operationId, canManage: true }))

        await expect(resetRuntimeWorkspaceSeededContent(resetOptions)).resolves.toEqual({
            resetRows: 4,
            operationId,
            canManage: true
        })

        const resetRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(resetRequest.method).toBe('POST')
    })

    it('rejects a reset response without a UUID-v7 audit operation id', async () => {
        stubWorkspaceResponse(jsonResponse({ resetRows: 4, canManage: true }))

        await expect(resetRuntimeWorkspaceSeededContent(resetOptions)).rejects.toMatchObject({
            name: 'RuntimeWorkspaceApiError',
            message: 'Failed to reset seeded workspace content'
        })
    })
})
