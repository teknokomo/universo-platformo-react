import apiClient from './apiClient'
import type { ApplicationCopyOptions } from '@universo/types'
import {
    Application,
    ApplicationMember,
    ApplicationAssignableRole,
    PaginationParams,
    PaginatedResponse,
    ApplicationLocalizedPayload,
    ApplicationRuntimeResponse
} from '../types'
import type { SimpleLocalizedInput } from '../types'

// Input type for creating/updating applications with localized content
export interface ApplicationInput extends ApplicationLocalizedPayload {
    slug?: string
    isPublic?: boolean
    expectedVersion?: number
}

export interface ApplicationCopyInput extends Partial<ApplicationInput>, Partial<ApplicationCopyOptions> {}

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

export const copyApplication = (id: string, data: ApplicationCopyInput = {}) => {
    const { createSchema: _createSchema, ...backendPayload } = data
    return apiClient.post<Application>(`/applications/${id}/copy`, backendPayload)
}

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
    catalogId?: string
}): Promise<void> => {
    const { applicationId, rowId, field, value, catalogId } = params
    await apiClient.patch(`/applications/${applicationId}/runtime/${rowId}`, { field, value, catalogId })
}

/** Fetch a single runtime row (raw data, VLC not resolved — for edit forms). */
export const getApplicationRuntimeRow = async (params: {
    applicationId: string
    rowId: string
    catalogId?: string
}): Promise<Record<string, unknown>> => {
    const { applicationId, rowId, catalogId } = params
    const response = await apiClient.get<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows/${rowId}`, {
        params: catalogId ? { catalogId } : undefined
    })
    return response.data
}

/** Fetch TABLE child rows for a runtime row. */
export const listApplicationRuntimeTabularRows = async (params: {
    applicationId: string
    rowId: string
    attributeId: string
    catalogId: string
}): Promise<Array<Record<string, unknown>>> => {
    const { applicationId, rowId, attributeId, catalogId } = params
    const response = await apiClient.get<{ items?: Array<Record<string, unknown>> }>(
        `/applications/${applicationId}/runtime/rows/${rowId}/tabular/${attributeId}`,
        {
            params: { catalogId }
        }
    )
    return Array.isArray(response.data?.items) ? response.data.items : []
}

/** Create a new runtime row. Backend expects { data: {...}, catalogId? }. */
export const createApplicationRuntimeRow = async (params: {
    applicationId: string
    data: Record<string, unknown>
    catalogId?: string
}): Promise<Record<string, unknown>> => {
    const { applicationId, data, catalogId } = params
    const body: Record<string, unknown> = { data }
    if (catalogId) body.catalogId = catalogId
    const response = await apiClient.post<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows`, body)
    return response.data
}

/** Bulk-update a runtime row. Backend expects { data: {...}, catalogId? }. */
export const updateApplicationRuntimeRow = async (params: {
    applicationId: string
    rowId: string
    data: Record<string, unknown>
    catalogId?: string
}): Promise<Record<string, unknown>> => {
    const { applicationId, rowId, data, catalogId } = params
    const body: Record<string, unknown> = { data }
    if (catalogId) body.catalogId = catalogId
    const response = await apiClient.patch<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows/${rowId}`, body)
    return response.data
}

/** Soft-delete a runtime row. */
export const deleteApplicationRuntimeRow = async (params: { applicationId: string; rowId: string; catalogId?: string }): Promise<void> => {
    const { applicationId, rowId, catalogId } = params
    await apiClient.delete(`/applications/${applicationId}/runtime/rows/${rowId}`, {
        params: catalogId ? { catalogId } : undefined
    })
}

/** Copy a runtime row. */
export const copyApplicationRuntimeRow = async (params: {
    applicationId: string
    rowId: string
    catalogId?: string
    copyChildTables?: boolean
}): Promise<Record<string, unknown>> => {
    const { applicationId, rowId, catalogId, copyChildTables = true } = params
    const body: Record<string, unknown> = { copyChildTables }
    if (catalogId) body.catalogId = catalogId
    const response = await apiClient.post<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows/${rowId}/copy`, body)
    return response.data
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
    data: { email: string; role: ApplicationAssignableRole; comment?: SimpleLocalizedInput | null; commentPrimaryLocale?: string }
) => apiClient.post<ApplicationMember>(`/applications/${applicationId}/members`, data)

export const updateApplicationMemberRole = (
    applicationId: string,
    memberId: string,
    data: { role: ApplicationAssignableRole; comment?: SimpleLocalizedInput | null; commentPrimaryLocale?: string }
) => apiClient.patch<ApplicationMember>(`/applications/${applicationId}/members/${memberId}`, data)

export const removeApplicationMember = (applicationId: string, memberId: string) =>
    apiClient.delete<void>(`/applications/${applicationId}/members/${memberId}`)
