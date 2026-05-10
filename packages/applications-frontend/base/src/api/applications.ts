import apiClient from './apiClient'
import type {
    ApplicationCopyOptions,
    ApplicationLayout,
    ApplicationLayoutCreate,
    ApplicationLayoutDetailResponse,
    ApplicationLayoutMutation,
    ApplicationLayoutScope,
    ApplicationLayoutWidget,
    ApplicationLayoutWidgetConfigMutation,
    ApplicationLayoutWidgetMoveMutation,
    ApplicationLayoutWidgetMutation,
    ApplicationLayoutWidgetToggleMutation,
    RuntimeDatasourceFilter,
    RuntimeDatasourceSort
} from '@universo/types'
import type { RuntimeRecordCommand } from '@universo/apps-template-mui'
import {
    Application,
    ApplicationMember,
    ApplicationAssignableRole,
    PaginationParams,
    PaginatedResponse,
    ApplicationLocalizedPayload,
    ApplicationRuntimeResponse,
    ApplicationWorkspaceLimitItem
} from '../types'
import type { SimpleLocalizedInput } from '../types'

// Input type for updating applications with localized content
export interface ApplicationInput extends ApplicationLocalizedPayload {
    slug?: string
    isPublic?: boolean
    expectedVersion?: number
}

// Input type for creating applications. Keep this aligned with the strict backend create schema.
export interface ApplicationCreateInput {
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    slug?: string
    isPublic?: boolean
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

export const createApplication = (data: ApplicationCreateInput) => apiClient.post<Application>('/applications', data)

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

export const joinApplication = (id: string) => apiClient.post<{ status: 'joined'; member: ApplicationMember }>(`/applications/${id}/join`)

export const leaveApplication = (id: string) => apiClient.post<{ status: 'left' }>(`/applications/${id}/leave`)

export const getApplicationRuntime = async (
    applicationId: string,
    params?: {
        limit?: number
        offset?: number
        locale?: string
        linkedCollectionId?: string
        sectionId?: string
        search?: string
        sort?: RuntimeDatasourceSort[]
        filters?: RuntimeDatasourceFilter[]
    }
): Promise<ApplicationRuntimeResponse> => {
    const resolvedSectionId = params?.sectionId ?? params?.linkedCollectionId
    const response = await apiClient.get<ApplicationRuntimeResponse>(`/applications/${applicationId}/runtime`, {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            locale: params?.locale,
            linkedCollectionId: resolvedSectionId,
            search: params?.search,
            sort: params?.sort ? JSON.stringify(params.sort) : undefined,
            filters: params?.filters ? JSON.stringify(params.filters) : undefined
        }
    })
    return response.data
}

export const updateApplicationRuntimeCell = async (params: {
    applicationId: string
    rowId: string
    field: string
    value: boolean | null
    linkedCollectionId?: string
    sectionId?: string
}): Promise<void> => {
    const { applicationId, rowId, field, value, linkedCollectionId, sectionId } = params
    await apiClient.patch(`/applications/${applicationId}/runtime/${rowId}`, {
        field,
        value,
        linkedCollectionId: sectionId ?? linkedCollectionId
    })
}

/** Fetch a single runtime row (raw data, VLC not resolved — for edit forms). */
export const getApplicationRuntimeRow = async (params: {
    applicationId: string
    rowId: string
    linkedCollectionId?: string
    sectionId?: string
}): Promise<Record<string, unknown>> => {
    const { applicationId, rowId, linkedCollectionId, sectionId } = params
    const resolvedSectionId = sectionId ?? linkedCollectionId
    const response = await apiClient.get<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows/${rowId}`, {
        params: resolvedSectionId ? { linkedCollectionId: resolvedSectionId } : undefined
    })
    return response.data
}

/** Fetch TABLE child rows for a runtime row. */
export const listApplicationRuntimeTabularRows = async (params: {
    applicationId: string
    rowId: string
    attributeId: string
    linkedCollectionId: string
    sectionId?: string
}): Promise<Array<Record<string, unknown>>> => {
    const { applicationId, rowId, attributeId, linkedCollectionId, sectionId } = params
    const resolvedSectionId = sectionId ?? linkedCollectionId
    const response = await apiClient.get<{ items?: Array<Record<string, unknown>> }>(
        `/applications/${applicationId}/runtime/rows/${rowId}/tabular/${attributeId}`,
        {
            params: { linkedCollectionId: resolvedSectionId }
        }
    )
    return Array.isArray(response.data?.items) ? response.data.items : []
}

/** Create a new runtime row. Backend expects { data: {...}, linkedCollectionId? }. */
export const createApplicationRuntimeRow = async (params: {
    applicationId: string
    data: Record<string, unknown>
    linkedCollectionId?: string
    sectionId?: string
}): Promise<Record<string, unknown>> => {
    const { applicationId, data, linkedCollectionId, sectionId } = params
    const resolvedSectionId = sectionId ?? linkedCollectionId
    const body: Record<string, unknown> = { data }
    if (resolvedSectionId) body.linkedCollectionId = resolvedSectionId
    const response = await apiClient.post<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows`, body)
    return response.data
}

/** Bulk-update a runtime row. Backend expects { data: {...}, linkedCollectionId? }. */
export const updateApplicationRuntimeRow = async (params: {
    applicationId: string
    rowId: string
    data: Record<string, unknown>
    linkedCollectionId?: string
    sectionId?: string
}): Promise<Record<string, unknown>> => {
    const { applicationId, rowId, data, linkedCollectionId, sectionId } = params
    const resolvedSectionId = sectionId ?? linkedCollectionId
    const body: Record<string, unknown> = { data }
    if (resolvedSectionId) body.linkedCollectionId = resolvedSectionId
    const response = await apiClient.patch<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows/${rowId}`, body)
    return response.data
}

/** Soft-delete a runtime row. */
export const deleteApplicationRuntimeRow = async (params: {
    applicationId: string
    rowId: string
    linkedCollectionId?: string
    sectionId?: string
}): Promise<void> => {
    const { applicationId, rowId, linkedCollectionId, sectionId } = params
    const resolvedSectionId = sectionId ?? linkedCollectionId
    await apiClient.delete(`/applications/${applicationId}/runtime/rows/${rowId}`, {
        params: resolvedSectionId ? { linkedCollectionId: resolvedSectionId } : undefined
    })
}

/** Copy a runtime row. */
export const copyApplicationRuntimeRow = async (params: {
    applicationId: string
    rowId: string
    linkedCollectionId?: string
    sectionId?: string
    copyChildTables?: boolean
}): Promise<Record<string, unknown>> => {
    const { applicationId, rowId, linkedCollectionId, sectionId, copyChildTables = true } = params
    const resolvedSectionId = sectionId ?? linkedCollectionId
    const body: Record<string, unknown> = { copyChildTables }
    if (resolvedSectionId) body.linkedCollectionId = resolvedSectionId
    const response = await apiClient.post<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows/${rowId}/copy`, body)
    return response.data
}

export const runApplicationRuntimeRecordCommand = async (params: {
    applicationId: string
    rowId: string
    command: RuntimeRecordCommand
    linkedCollectionId?: string
    sectionId?: string
    expectedVersion?: number
}): Promise<Record<string, unknown>> => {
    const { applicationId, rowId, command, linkedCollectionId, sectionId, expectedVersion } = params
    const resolvedSectionId = sectionId ?? linkedCollectionId
    const body: Record<string, unknown> = {}
    if (resolvedSectionId) body.linkedCollectionId = resolvedSectionId
    if (typeof expectedVersion === 'number') body.expectedVersion = expectedVersion
    const response = await apiClient.post<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows/${rowId}/${command}`, body)
    return response.data
}

export const reorderApplicationRuntimeRows = async (params: {
    applicationId: string
    orderedRowIds: string[]
    linkedCollectionId?: string
    sectionId?: string
}): Promise<void> => {
    const { applicationId, orderedRowIds, linkedCollectionId, sectionId } = params
    const resolvedSectionId = sectionId ?? linkedCollectionId
    const body: Record<string, unknown> = { orderedRowIds }
    if (resolvedSectionId) body.linkedCollectionId = resolvedSectionId
    await apiClient.post(`/applications/${applicationId}/runtime/rows/reorder`, body)
}

// ============ APPLICATION LAYOUTS ============

export const listApplicationLayoutScopes = async (applicationId: string, locale?: string): Promise<ApplicationLayoutScope[]> => {
    const response = await apiClient.get<{ items: ApplicationLayoutScope[] }>(`/applications/${applicationId}/layout-scopes`, {
        params: { locale }
    })
    return response.data.items ?? []
}

export const listApplicationLayouts = async (
    applicationId: string,
    params?: PaginationParams & { linkedCollectionId?: string | null }
): Promise<PaginatedResponse<ApplicationLayout>> => {
    const response = await apiClient.get<{ items: ApplicationLayout[]; total: number }>(`/applications/${applicationId}/layouts`, {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            linkedCollectionId: params?.linkedCollectionId ?? undefined,
            scope: params?.linkedCollectionId === null ? 'global' : undefined
        }
    })
    const items = response.data.items ?? []
    const total = response.data.total ?? items.length
    const limit = params?.limit ?? 50
    const offset = params?.offset ?? 0
    return {
        items,
        pagination: {
            total,
            limit,
            offset,
            count: items.length,
            hasMore: offset + items.length < total
        }
    }
}

export const getApplicationLayout = async (applicationId: string, layoutId: string): Promise<ApplicationLayoutDetailResponse> => {
    const response = await apiClient.get<ApplicationLayoutDetailResponse>(`/applications/${applicationId}/layouts/${layoutId}`)
    return response.data
}

export const createApplicationLayout = async (applicationId: string, data: ApplicationLayoutCreate): Promise<ApplicationLayout> => {
    const response = await apiClient.post<{ item: ApplicationLayout }>(`/applications/${applicationId}/layouts`, data)
    return response.data.item
}

export const updateApplicationLayout = async (
    applicationId: string,
    layoutId: string,
    data: ApplicationLayoutMutation
): Promise<ApplicationLayout> => {
    const response = await apiClient.patch<{ item: ApplicationLayout }>(`/applications/${applicationId}/layouts/${layoutId}`, data)
    return response.data.item
}

export const deleteApplicationLayout = async (applicationId: string, layoutId: string, expectedVersion?: number): Promise<void> => {
    await apiClient.delete(`/applications/${applicationId}/layouts/${layoutId}`, {
        params: expectedVersion ? { expectedVersion } : undefined
    })
}

export const copyApplicationLayout = async (applicationId: string, layoutId: string): Promise<ApplicationLayout> => {
    const response = await apiClient.post<{ item: ApplicationLayout }>(`/applications/${applicationId}/layouts/${layoutId}/copy`)
    return response.data.item
}

export const listApplicationLayoutWidgets = async (applicationId: string, layoutId: string): Promise<ApplicationLayoutWidget[]> => {
    const response = await apiClient.get<{ items: ApplicationLayoutWidget[] }>(
        `/applications/${applicationId}/layouts/${layoutId}/zone-widgets`
    )
    return response.data.items ?? []
}

export const listApplicationLayoutWidgetCatalog = async (
    applicationId: string,
    layoutId: string
): Promise<Array<{ key: string; allowedZones: readonly string[]; multiInstance: boolean }>> => {
    const response = await apiClient.get<{ items: Array<{ key: string; allowedZones: readonly string[]; multiInstance: boolean }> }>(
        `/applications/${applicationId}/layouts/${layoutId}/zone-widgets/catalog`
    )
    return response.data.items ?? []
}

export const upsertApplicationLayoutWidget = async (
    applicationId: string,
    layoutId: string,
    data: ApplicationLayoutWidgetMutation
): Promise<ApplicationLayoutWidget> => {
    const response = await apiClient.put<{ item: ApplicationLayoutWidget }>(
        `/applications/${applicationId}/layouts/${layoutId}/zone-widget`,
        data
    )
    return response.data.item
}

export const updateApplicationLayoutWidgetConfig = async (
    applicationId: string,
    layoutId: string,
    widgetId: string,
    data: ApplicationLayoutWidgetConfigMutation
): Promise<ApplicationLayoutWidget> => {
    const response = await apiClient.patch<{ item: ApplicationLayoutWidget }>(
        `/applications/${applicationId}/layouts/${layoutId}/zone-widget/${widgetId}/config`,
        data
    )
    return response.data.item
}

export const moveApplicationLayoutWidget = async (
    applicationId: string,
    layoutId: string,
    data: ApplicationLayoutWidgetMoveMutation
): Promise<ApplicationLayoutWidget> => {
    const response = await apiClient.patch<{ item: ApplicationLayoutWidget }>(
        `/applications/${applicationId}/layouts/${layoutId}/zone-widgets/move`,
        data
    )
    return response.data.item
}

export const toggleApplicationLayoutWidget = async (
    applicationId: string,
    layoutId: string,
    widgetId: string,
    data: ApplicationLayoutWidgetToggleMutation
): Promise<ApplicationLayoutWidget> => {
    const response = await apiClient.patch<{ item: ApplicationLayoutWidget }>(
        `/applications/${applicationId}/layouts/${layoutId}/zone-widget/${widgetId}/toggle-active`,
        data
    )
    return response.data.item
}

export const deleteApplicationLayoutWidget = async (applicationId: string, layoutId: string, widgetId: string): Promise<void> => {
    await apiClient.delete(`/applications/${applicationId}/layouts/${layoutId}/zone-widget/${widgetId}`)
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

export const getApplicationWorkspaceLimits = async (applicationId: string, locale?: string): Promise<ApplicationWorkspaceLimitItem[]> => {
    const response = await apiClient.get<{ items: ApplicationWorkspaceLimitItem[] }>(`/applications/${applicationId}/settings/limits`, {
        params: locale ? { locale } : undefined
    })
    return response.data.items ?? []
}

export const updateApplicationWorkspaceLimits = async (
    applicationId: string,
    limits: Array<{ objectId: string; maxRows: number | null }>
): Promise<ApplicationWorkspaceLimitItem[]> => {
    const response = await apiClient.put<{ items: ApplicationWorkspaceLimitItem[] }>(`/applications/${applicationId}/settings/limits`, {
        limits
    })
    return response.data.items ?? []
}
