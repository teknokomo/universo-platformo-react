import apiClient from './apiClient'
import {
    Application,
    ApplicationMember,
    ApplicationAssignableRole,
    PaginationParams,
    PaginatedResponse,
    ApplicationLocalizedPayload,
    ApplicationRuntimeResponse
} from '../types'

// Input type for creating/updating applications with localized content
export interface ApplicationInput extends ApplicationLocalizedPayload {
    slug?: string
    isPublic?: boolean
    expectedVersion?: number
}

export interface ApplicationCopyInput extends Partial<ApplicationInput> {
    copyAccess?: boolean
}

// Extended pagination params with showAll for admin users
export interface ApplicationPaginationParams extends PaginationParams {
    showAll?: boolean
}

// ============ APPLICATIONS ============

export const listApplications = async (params?: ApplicationPaginationParams): Promise<PaginatedResponse<Application>> => {
    const response = await apiClient.get<{ items: Application[]; total: number; limit: number; offset: number }>('/applications', {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            sortBy: params?.sortBy,
            sortOrder: params?.sortOrder,
            search: params?.search,
            showAll: params?.showAll
        }
    })

    // Backend returns { items, total, limit, offset } in response body
    const items = response.data.items ?? []
    const total = response.data.total ?? items.length
    const limit = response.data.limit ?? params?.limit ?? 100
    const offset = response.data.offset ?? params?.offset ?? 0
    const count = items.length

    return {
        items,
        pagination: {
            total,
            limit,
            offset,
            count,
            hasMore: offset + count < total
        }
    }
}

export const getApplication = (id: string) => apiClient.get<Application>(`/applications/${id}`)

export const createApplication = (data: ApplicationInput) => apiClient.post<Application>('/applications', data)

/**
 * Update an application
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateApplication = (id: string, data: Partial<ApplicationInput>) => apiClient.patch<Application>(`/applications/${id}`, data)

export const deleteApplication = (id: string) => apiClient.delete<void>(`/applications/${id}`)

export const copyApplication = (id: string, data: ApplicationCopyInput = {}) =>
    apiClient.post<Application>(`/applications/${id}/copy`, data)

export const getApplicationRuntime = async (
    applicationId: string,
    params?: { limit?: number; offset?: number; locale?: string; catalogId?: string }
): Promise<ApplicationRuntimeResponse> => {
    const response = await apiClient.get<ApplicationRuntimeResponse>(`/applications/${applicationId}/runtime`, {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            locale: params?.locale,
            catalogId: params?.catalogId
        }
    })
    return response.data
}

export const updateApplicationRuntimeCell = async (params: {
    applicationId: string
    rowId: string
    field: string
    value: boolean | null
}): Promise<void> => {
    const { applicationId, rowId, field, value } = params
    await apiClient.patch(`/applications/${applicationId}/runtime/${rowId}`, { field, value })
}

// ============ APPLICATION MEMBERS ============

export const listApplicationMembers = async (
    applicationId: string,
    params?: PaginationParams
): Promise<PaginatedResponse<ApplicationMember>> => {
    const response = await apiClient.get<{ items: ApplicationMember[]; total: number; limit?: number; offset?: number }>(
        `/applications/${applicationId}/members`,
        {
            params: {
                limit: params?.limit,
                offset: params?.offset,
                sortBy: params?.sortBy,
                sortOrder: params?.sortOrder,
                search: params?.search
            }
        }
    )

    // Backend returns { members, total } in response body (legacy) or { items, total } (list helpers)
    const items = (response.data.items ?? (response.data as { members?: ApplicationMember[] }).members ?? []) as ApplicationMember[]
    const total = response.data.total ?? items.length
    const limit = params?.limit ?? 100
    const offset = params?.offset ?? 0
    const count = items.length

    return {
        items,
        pagination: {
            total,
            limit,
            offset,
            count,
            hasMore: offset + count < total
        }
    }
}

export const inviteApplicationMember = (
    applicationId: string,
    data: { email: string; role: ApplicationAssignableRole; comment?: string }
) => apiClient.post<ApplicationMember>(`/applications/${applicationId}/members`, data)

export const updateApplicationMemberRole = (
    applicationId: string,
    memberId: string,
    data: { role: ApplicationAssignableRole; comment?: string }
) => apiClient.patch<ApplicationMember>(`/applications/${applicationId}/members/${memberId}`, data)

export const removeApplicationMember = (applicationId: string, memberId: string) =>
    apiClient.delete<void>(`/applications/${applicationId}/members/${memberId}`)
