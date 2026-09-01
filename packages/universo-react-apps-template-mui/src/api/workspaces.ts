import { z } from 'zod'
import { isUuidV7 } from '@universo-react/utils'
import { fetchWithCsrf } from './api'

const uuidSchema = z.string().uuid()
const workspaceIdSchema = uuidSchema.refine((value) => isUuidV7(value), 'Workspace identifiers must be UUID v7.')

const settingDefinitionSchema = z.object({
    key: z.string(),
    labelKey: z.string(),
    descriptionKey: z.string(),
    tab: z.string(),
    controlType: z.enum(['boolean', 'select', 'number', 'string', 'structured']),
    options: z.array(z.string()).optional()
})

const workspaceSchema = z.object({
    id: workspaceIdSchema,
    name: z.unknown(),
    description: z.unknown(),
    workspaceType: z.string(),
    // Auth users are managed by Supabase and may use a UUID version other than v7.
    personalUserId: uuidSchema.nullable().optional(),
    status: z.string(),
    isDefault: z.boolean(),
    roleCodename: z.string()
})

const workspaceMemberSchema = z.object({
    // Auth user identifiers are external to this feature and are not required to be UUID v7.
    userId: uuidSchema,
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
    currentWorkspaceId: workspaceIdSchema.nullable().optional(),
    permissions: z
        .object({
            canCreateSharedWorkspace: z.boolean().default(false),
            canManageApplication: z.boolean().default(false)
        })
        .default({ canCreateSharedWorkspace: false, canManageApplication: false })
})

const workspaceMembersResponseSchema = z.object({
    items: z.array(workspaceMemberSchema),
    total: z.number().default(0),
    limit: z.number().default(100),
    offset: z.number().default(0)
})

const runtimeWorkspaceMutationResponseSchema = z
    .object({
        id: workspaceIdSchema
    })
    .strict()

const runtimeWorkspaceSettingSchema = z.object({
    key: z.string(),
    value: z.unknown(),
    source: z.enum(['default', 'metahub', 'application', 'workspace']),
    isInherited: z.boolean(),
    allowed: z.boolean(),
    version: z.number().nullable(),
    definition: settingDefinitionSchema
})

const runtimeWorkspaceSettingsResponseSchema = z.object({
    items: z.array(runtimeWorkspaceSettingSchema),
    canManage: z.boolean().default(false)
})

const runtimeWorkspaceResetResponseSchema = z
    .object({
        resetRows: z.number().int().nonnegative(),
        operationId: uuidSchema.refine((value) => isUuidV7(value), 'Workspace operation identifiers must be UUID v7.'),
        canManage: z.boolean().default(false)
    })
    .strict()

export type RuntimeWorkspace = z.infer<typeof workspaceSchema>
export type RuntimeWorkspaceMember = z.infer<typeof workspaceMemberSchema>
export type RuntimeWorkspaceListResponse = z.infer<typeof workspaceListResponseSchema>
export type RuntimeWorkspaceMembersResponse = z.infer<typeof workspaceMembersResponseSchema>
export type RuntimeWorkspaceMutationResponse = z.infer<typeof runtimeWorkspaceMutationResponseSchema>
export type RuntimeWorkspaceSetting = z.infer<typeof runtimeWorkspaceSettingSchema>
export type RuntimeWorkspaceSettingsResponse = z.infer<typeof runtimeWorkspaceSettingsResponseSchema>

export class RuntimeWorkspaceApiError extends Error {
    code?: string

    constructor(message: string, code?: string) {
        super(message)
        this.name = 'RuntimeWorkspaceApiError'
        if (code) {
            this.code = code
        }
    }
}

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

const extractErrorDetails = async (response: Response, fallback: string): Promise<{ message: string; code?: string }> => {
    const text = await response.text().catch(() => '')
    if (!text) return { message: fallback }
    try {
        const parsed = z
            .object({ code: z.string().trim().min(1).optional() })
            .passthrough()
            .safeParse(JSON.parse(text))
        const code = parsed.success ? parsed.data.code : undefined
        return {
            message: fallback,
            ...(code ? { code } : {})
        }
    } catch {
        return { message: fallback }
    }
}

async function parseRuntimeWorkspaceResponse<TSchema extends z.ZodTypeAny>(
    response: Response,
    schema: TSchema,
    fallback: string
): Promise<z.infer<TSchema>> {
    let payload: unknown
    try {
        payload = await response.json()
    } catch {
        throw new RuntimeWorkspaceApiError(fallback)
    }

    const parsed = schema.safeParse(payload)
    if (!parsed.success) {
        throw new RuntimeWorkspaceApiError(fallback)
    }
    return parsed.data
}

const throwRuntimeWorkspaceApiError = async (response: Response, fallback: string): Promise<never> => {
    const { message, code } = await extractErrorDetails(response, fallback)
    throw new RuntimeWorkspaceApiError(message, code)
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
        await throwRuntimeWorkspaceApiError(response, 'Failed to load workspaces')
    }

    return parseRuntimeWorkspaceResponse(response, workspaceListResponseSchema, 'Failed to load workspaces')
}

export async function fetchRuntimeWorkspace(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId: string
}): Promise<RuntimeWorkspace> {
    const url = buildRuntimeUrl(options.apiBaseUrl, options.applicationId, `/workspaces/${options.workspaceId}`)

    const response = await fetch(url.toString(), { credentials: 'include' })
    if (!response.ok) {
        await throwRuntimeWorkspaceApiError(response, 'Failed to load workspace')
    }

    return parseRuntimeWorkspaceResponse(response, workspaceSchema, 'Failed to load workspace')
}

export async function createRuntimeWorkspace(options: {
    apiBaseUrl: string
    applicationId: string
    name: unknown
    description: unknown
}): Promise<RuntimeWorkspaceMutationResponse> {
    const url = buildRuntimeUrl(options.apiBaseUrl, options.applicationId, '/workspaces')
    const response = await fetchWithCsrf(options.apiBaseUrl, url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: options.name, description: options.description })
    })
    if (!response.ok) {
        await throwRuntimeWorkspaceApiError(response, 'Failed to create workspace')
    }
    return parseRuntimeWorkspaceResponse(response, runtimeWorkspaceMutationResponseSchema, 'Failed to create workspace')
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
        await throwRuntimeWorkspaceApiError(response, 'Failed to update workspace')
    }
}

export async function copyRuntimeWorkspace(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId: string
    name: unknown
    description: unknown
}): Promise<RuntimeWorkspaceMutationResponse> {
    const url = buildRuntimeUrl(options.apiBaseUrl, options.applicationId, `/workspaces/${options.workspaceId}/copy`)
    const response = await fetchWithCsrf(options.apiBaseUrl, url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: options.name, description: options.description })
    })
    if (!response.ok) {
        await throwRuntimeWorkspaceApiError(response, 'Failed to copy workspace')
    }
    return parseRuntimeWorkspaceResponse(response, runtimeWorkspaceMutationResponseSchema, 'Failed to copy workspace')
}

export async function deleteRuntimeWorkspace(options: { apiBaseUrl: string; applicationId: string; workspaceId: string }): Promise<void> {
    const url = buildRuntimeUrl(options.apiBaseUrl, options.applicationId, `/workspaces/${options.workspaceId}`)
    const response = await fetchWithCsrf(options.apiBaseUrl, url.toString(), { method: 'DELETE' })
    if (!response.ok) {
        await throwRuntimeWorkspaceApiError(response, 'Failed to delete workspace')
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
        await throwRuntimeWorkspaceApiError(response, 'Failed to switch workspace')
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
        await throwRuntimeWorkspaceApiError(response, 'Failed to load workspace members')
    }

    return parseRuntimeWorkspaceResponse(response, workspaceMembersResponseSchema, 'Failed to load workspace members')
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
        await throwRuntimeWorkspaceApiError(response, 'Failed to add workspace member')
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
        await throwRuntimeWorkspaceApiError(response, 'Failed to remove workspace member')
    }
}

export async function fetchRuntimeWorkspaceSettings(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId: string
}): Promise<RuntimeWorkspaceSettingsResponse> {
    const url = buildRuntimeUrl(options.apiBaseUrl, options.applicationId, `/workspaces/${options.workspaceId}/settings`)

    const response = await fetch(url.toString(), { credentials: 'include' })
    if (!response.ok) {
        await throwRuntimeWorkspaceApiError(response, 'Failed to load workspace settings')
    }

    return parseRuntimeWorkspaceResponse(response, runtimeWorkspaceSettingsResponseSchema, 'Failed to load workspace settings')
}

export async function updateRuntimeWorkspaceSettings(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId: string
    settings?: Array<{ key: string; value: unknown; expectedVersion?: number }>
    resets?: Array<{ key: string; expectedVersion?: number }>
}): Promise<RuntimeWorkspaceSettingsResponse> {
    const url = buildRuntimeUrl(options.apiBaseUrl, options.applicationId, `/workspaces/${options.workspaceId}/settings`)
    const response = await fetchWithCsrf(options.apiBaseUrl, url.toString(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            settings: options.settings ?? [],
            resets: options.resets ?? []
        })
    })
    if (!response.ok) {
        await throwRuntimeWorkspaceApiError(response, 'Failed to update workspace settings')
    }

    return parseRuntimeWorkspaceResponse(response, runtimeWorkspaceSettingsResponseSchema, 'Failed to update workspace settings')
}

export async function resetRuntimeWorkspaceSeededContent(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId: string
}): Promise<{ resetRows: number; operationId: string; canManage: boolean }> {
    const url = buildRuntimeUrl(options.apiBaseUrl, options.applicationId, `/workspaces/${options.workspaceId}/seed/reset`)
    const response = await fetchWithCsrf(options.apiBaseUrl, url.toString(), { method: 'POST' })
    if (!response.ok) {
        await throwRuntimeWorkspaceApiError(response, 'Failed to reset seeded workspace content')
    }

    return parseRuntimeWorkspaceResponse(response, runtimeWorkspaceResetResponseSchema, 'Failed to reset seeded workspace content')
}
