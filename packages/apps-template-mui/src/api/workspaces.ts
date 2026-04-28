import { z } from 'zod'
import { fetchWithCsrf } from './api'

const workspaceSchema = z.object({
    id: z.string(),
    name: z.unknown(),
    description: z.unknown(),
    workspaceType: z.string(),
    personalUserId: z.string().nullable().optional(),
    status: z.string(),
    isDefault: z.boolean(),
    roleCodename: z.string()
})

const workspaceMemberSchema = z.object({
    userId: z.string(),
    roleCodename: z.string(),
    email: z.string().nullable().optional(),
    nickname: z.string().nullable().optional(),
    canRemove: z.boolean().default(false)
})

const workspaceListResponseSchema = z.object({
    items: z.array(workspaceSchema),
    total: z.number().default(0),
    limit: z.number().default(100),
    offset: z.number().default(0),
    currentWorkspaceId: z.string().nullable().optional()
})

const workspaceMembersResponseSchema = z.object({
    items: z.array(workspaceMemberSchema),
    total: z.number().default(0),
    limit: z.number().default(100),
    offset: z.number().default(0)
})

export type RuntimeWorkspace = z.infer<typeof workspaceSchema>
export type RuntimeWorkspaceMember = z.infer<typeof workspaceMemberSchema>
export type RuntimeWorkspaceListResponse = z.infer<typeof workspaceListResponseSchema>
export type RuntimeWorkspaceMembersResponse = z.infer<typeof workspaceMembersResponseSchema>

export interface RuntimeWorkspaceListParams {
    limit?: number
    offset?: number
    search?: string
}

export interface RuntimeWorkspaceMemberListParams extends RuntimeWorkspaceListParams {}

const buildRuntimeUrl = (apiBaseUrl: string, applicationId: string, path: string): URL => {
    const normalizedBase = apiBaseUrl.replace(/\/$/, '')
    const runtimePath = `${normalizedBase}/applications/${applicationId}/runtime${path}`
    return /^https?:\/\//i.test(normalizedBase) ? new URL(runtimePath) : new URL(runtimePath, window.location.origin)
}

const applyListParams = (url: URL, params?: RuntimeWorkspaceListParams): void => {
    url.searchParams.set('limit', String(params?.limit ?? 100))
    url.searchParams.set('offset', String(params?.offset ?? 0))
    if (params?.search?.trim()) {
        url.searchParams.set('search', params.search.trim())
    }
}

const extractErrorMessage = async (response: Response, fallback: string): Promise<string> => {
    const text = await response.text().catch(() => '')
    if (!text) return `${fallback} (${response.status})`
    try {
        const parsed = JSON.parse(text)
        const message = parsed?.error ?? parsed?.message
        return typeof message === 'string' && message.trim() ? message : `${fallback} (${response.status})`
    } catch {
        return text
    }
}

export async function fetchRuntimeWorkspaces(options: {
    apiBaseUrl: string
    applicationId: string
    params?: RuntimeWorkspaceListParams
}): Promise<RuntimeWorkspaceListResponse> {
    const url = buildRuntimeUrl(options.apiBaseUrl, options.applicationId, '/workspaces')
    applyListParams(url, options.params)

    const response = await fetch(url.toString(), { credentials: 'include' })
    if (!response.ok) {
        throw new Error(await extractErrorMessage(response, 'Failed to load workspaces'))
    }

    const parsed = workspaceListResponseSchema.safeParse(await response.json())
    if (!parsed.success) {
        throw new Error('Workspace list response validation failed')
    }
    return parsed.data
}

export async function fetchRuntimeWorkspace(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId: string
}): Promise<RuntimeWorkspace> {
    const url = buildRuntimeUrl(options.apiBaseUrl, options.applicationId, `/workspaces/${options.workspaceId}`)

    const response = await fetch(url.toString(), { credentials: 'include' })
    if (!response.ok) {
        throw new Error(await extractErrorMessage(response, 'Failed to load workspace'))
    }

    const parsed = workspaceSchema.safeParse(await response.json())
    if (!parsed.success) {
        throw new Error('Workspace response validation failed')
    }
    return parsed.data
}

export async function createRuntimeWorkspace(options: {
    apiBaseUrl: string
    applicationId: string
    name: unknown
    description: unknown
}): Promise<{ id: string }> {
    const url = buildRuntimeUrl(options.apiBaseUrl, options.applicationId, '/workspaces')
    const response = await fetchWithCsrf(options.apiBaseUrl, url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: options.name, description: options.description })
    })
    if (!response.ok) {
        throw new Error(await extractErrorMessage(response, 'Failed to create workspace'))
    }
    return response.json()
}

export async function updateRuntimeWorkspace(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId: string
    name?: unknown
    description?: unknown
}): Promise<void> {
    const url = buildRuntimeUrl(options.apiBaseUrl, options.applicationId, `/workspaces/${options.workspaceId}`)
    const body: Record<string, unknown> = {}
    if (options.name !== undefined) body.name = options.name
    if (options.description !== undefined) body.description = options.description
    const response = await fetchWithCsrf(options.apiBaseUrl, url.toString(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!response.ok) {
        throw new Error(await extractErrorMessage(response, 'Failed to update workspace'))
    }
}

export async function copyRuntimeWorkspace(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId: string
    name: unknown
    description: unknown
}): Promise<{ id: string }> {
    const url = buildRuntimeUrl(options.apiBaseUrl, options.applicationId, `/workspaces/${options.workspaceId}/copy`)
    const response = await fetchWithCsrf(options.apiBaseUrl, url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: options.name, description: options.description })
    })
    if (!response.ok) {
        throw new Error(await extractErrorMessage(response, 'Failed to copy workspace'))
    }
    return response.json()
}

export async function deleteRuntimeWorkspace(options: { apiBaseUrl: string; applicationId: string; workspaceId: string }): Promise<void> {
    const url = buildRuntimeUrl(options.apiBaseUrl, options.applicationId, `/workspaces/${options.workspaceId}`)
    const response = await fetchWithCsrf(options.apiBaseUrl, url.toString(), { method: 'DELETE' })
    if (!response.ok) {
        throw new Error(await extractErrorMessage(response, 'Failed to delete workspace'))
    }
}

export async function updateDefaultRuntimeWorkspace(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId: string
}): Promise<void> {
    const url = buildRuntimeUrl(options.apiBaseUrl, options.applicationId, `/workspaces/${options.workspaceId}/default`)
    const response = await fetchWithCsrf(options.apiBaseUrl, url.toString(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
    })
    if (!response.ok) {
        throw new Error(await extractErrorMessage(response, 'Failed to switch workspace'))
    }
}

export async function fetchRuntimeWorkspaceMembers(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId: string
    params?: RuntimeWorkspaceMemberListParams
}): Promise<RuntimeWorkspaceMembersResponse> {
    const url = buildRuntimeUrl(options.apiBaseUrl, options.applicationId, `/workspaces/${options.workspaceId}/members`)
    applyListParams(url, options.params)

    const response = await fetch(url.toString(), { credentials: 'include' })
    if (!response.ok) {
        throw new Error(await extractErrorMessage(response, 'Failed to load workspace members'))
    }

    const parsed = workspaceMembersResponseSchema.safeParse(await response.json())
    if (!parsed.success) {
        throw new Error('Workspace members response validation failed')
    }
    return parsed.data
}

export async function inviteRuntimeWorkspaceMember(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId: string
    email: string
    roleCodename: 'owner' | 'member'
}): Promise<void> {
    const url = buildRuntimeUrl(options.apiBaseUrl, options.applicationId, `/workspaces/${options.workspaceId}/members`)
    const response = await fetchWithCsrf(options.apiBaseUrl, url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: options.email, roleCodename: options.roleCodename })
    })
    if (!response.ok) {
        throw new Error(await extractErrorMessage(response, 'Failed to add workspace member'))
    }
}

export async function removeRuntimeWorkspaceMember(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId: string
    userId: string
}): Promise<void> {
    const url = buildRuntimeUrl(options.apiBaseUrl, options.applicationId, `/workspaces/${options.workspaceId}/members/${options.userId}`)
    const response = await fetchWithCsrf(options.apiBaseUrl, url.toString(), { method: 'DELETE' })
    if (!response.ok) {
        throw new Error(await extractErrorMessage(response, 'Failed to remove workspace member'))
    }
}
