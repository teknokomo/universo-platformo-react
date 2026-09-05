import apiClient from './apiClient'
import type {
    ApplicationCopyOptions,
    ApplicationLayout,
    ApplicationLayoutConfigResetMutation,
    ApplicationLayoutCreate,
    ApplicationLayoutDetailResponse,
    ApplicationLayoutUpdate,
    ApplicationLayoutScope,
    ApplicationLayoutWidget,
    ApplicationLayoutWidgetConfigBatchMutation,
    ApplicationLayoutWidgetConfigMutation,
    ApplicationLayoutWidgetMoveMutation,
    ApplicationLayoutWidgetMutation,
    ApplicationLayoutWidgetResetBatchMutation,
    ApplicationLayoutWidgetToggleMutation,
    LayoutWidgetDefinition,
    RuntimeDatasourceFilter,
    RuntimeDatasourceSort
} from '@universo-react/types'
import type { RuntimeRecordCommand } from '@universo-react/apps-template-mui'
import type { RuntimeRestoreTarget } from '@universo-react/apps-template-mui'
import {
    Application,
    ApplicationDialogSettings,
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
    settings?: ApplicationDialogSettings
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

export type ApplicationLayoutWidgetDefinition = LayoutWidgetDefinition

const normalizeRuntimeWorkspaceId = (workspaceId?: string | null): string | undefined => {
    const normalized = workspaceId?.trim()
    return normalized || undefined
}

const withRuntimeWorkspaceParam = <T extends Record<string, unknown>>(
    params: T,
    workspaceId?: string | null
): T & {
    workspaceId?: string
} => {
    const normalizedWorkspaceId = normalizeRuntimeWorkspaceId(workspaceId)
    return normalizedWorkspaceId ? { ...params, workspaceId: normalizedWorkspaceId } : params
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
        objectCollectionId?: string
        sectionId?: string
        search?: string
        sort?: RuntimeDatasourceSort[]
        filters?: RuntimeDatasourceFilter[]
        workspaceId?: string | null
    }
): Promise<ApplicationRuntimeResponse> => {
    const resolvedSectionId = params?.sectionId ?? params?.objectCollectionId
    const response = await apiClient.get<ApplicationRuntimeResponse>(`/applications/${applicationId}/runtime`, {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            locale: params?.locale,
            objectCollectionId: resolvedSectionId,
            search: params?.search,
            sort: params?.sort ? JSON.stringify(params.sort) : undefined,
            filters: params?.filters ? JSON.stringify(params.filters) : undefined,
            ...withRuntimeWorkspaceParam({}, params?.workspaceId)
        }
    })
    return response.data
}

export const updateApplicationRuntimeCell = async (params: {
    applicationId: string
    rowId: string
    field: string
    value: boolean | null
    objectCollectionId?: string
    sectionId?: string
    workspaceId?: string | null
}): Promise<void> => {
    const { applicationId, rowId, field, value, objectCollectionId, sectionId, workspaceId } = params
    const normalizedWorkspaceId = normalizeRuntimeWorkspaceId(workspaceId)
    const url = `/applications/${applicationId}/runtime/${rowId}`
    const body = {
        field,
        value,
        objectCollectionId: sectionId ?? objectCollectionId
    }
    if (normalizedWorkspaceId) {
        await apiClient.patch(url, body, { params: { workspaceId: normalizedWorkspaceId } })
    } else {
        await apiClient.patch(url, body)
    }
}

/** Fetch a single runtime row (raw data, VLC not resolved — for edit forms). */
export const getApplicationRuntimeRow = async (params: {
    applicationId: string
    rowId: string
    objectCollectionId?: string
    sectionId?: string
    workspaceId?: string | null
}): Promise<Record<string, unknown>> => {
    const { applicationId, rowId, objectCollectionId, sectionId, workspaceId } = params
    const resolvedSectionId = sectionId ?? objectCollectionId
    const response = await apiClient.get<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows/${rowId}`, {
        params: withRuntimeWorkspaceParam(resolvedSectionId ? { objectCollectionId: resolvedSectionId } : {}, workspaceId)
    })
    return response.data
}

/** Fetch TABLE child rows for a runtime row. */
export const listApplicationRuntimeTabularRows = async (params: {
    applicationId: string
    rowId: string
    componentId: string
    objectCollectionId: string
    sectionId?: string
    workspaceId?: string | null
}): Promise<Array<Record<string, unknown>>> => {
    const { applicationId, rowId, componentId, objectCollectionId, sectionId, workspaceId } = params
    const resolvedSectionId = sectionId ?? objectCollectionId
    const response = await apiClient.get<{ items?: Array<Record<string, unknown>> }>(
        `/applications/${applicationId}/runtime/rows/${rowId}/tabular/${componentId}`,
        {
            params: withRuntimeWorkspaceParam({ objectCollectionId: resolvedSectionId }, workspaceId)
        }
    )
    return Array.isArray(response.data?.items) ? response.data.items : []
}

/** Create a new runtime row. Backend expects { data: {...}, objectCollectionId? }. */
export const createApplicationRuntimeRow = async (params: {
    applicationId: string
    data: Record<string, unknown>
    objectCollectionId?: string
    sectionId?: string
    workspaceId?: string | null
}): Promise<Record<string, unknown>> => {
    const { applicationId, data, objectCollectionId, sectionId, workspaceId } = params
    const resolvedSectionId = sectionId ?? objectCollectionId
    const body: Record<string, unknown> = { data }
    if (resolvedSectionId) body.objectCollectionId = resolvedSectionId
    const normalizedWorkspaceId = normalizeRuntimeWorkspaceId(workspaceId)
    const response = normalizedWorkspaceId
        ? await apiClient.post<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows`, body, {
              params: { workspaceId: normalizedWorkspaceId }
          })
        : await apiClient.post<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows`, body)
    return response.data
}

/** Bulk-update a runtime row. Backend expects { data: {...}, objectCollectionId? }. */
export const updateApplicationRuntimeRow = async (params: {
    applicationId: string
    rowId: string
    data: Record<string, unknown>
    objectCollectionId?: string
    sectionId?: string
    workspaceId?: string | null
    expectedVersion?: number
}): Promise<Record<string, unknown>> => {
    const { applicationId, rowId, data, objectCollectionId, sectionId, workspaceId, expectedVersion } = params
    const resolvedSectionId = sectionId ?? objectCollectionId
    const body: Record<string, unknown> = { data }
    if (resolvedSectionId) body.objectCollectionId = resolvedSectionId
    if (typeof expectedVersion === 'number') body.expectedVersion = expectedVersion
    const normalizedWorkspaceId = normalizeRuntimeWorkspaceId(workspaceId)
    const response = normalizedWorkspaceId
        ? await apiClient.patch<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows/${rowId}`, body, {
              params: { workspaceId: normalizedWorkspaceId }
          })
        : await apiClient.patch<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows/${rowId}`, body)
    return response.data
}

/** Soft-delete a runtime row. */
export const deleteApplicationRuntimeRow = async (params: {
    applicationId: string
    rowId: string
    objectCollectionId?: string
    sectionId?: string
    workspaceId?: string | null
    expectedVersion?: number
}): Promise<void> => {
    const { applicationId, rowId, objectCollectionId, sectionId, workspaceId, expectedVersion } = params
    const resolvedSectionId = sectionId ?? objectCollectionId
    const requestParams: Record<string, unknown> = {}
    if (resolvedSectionId) requestParams.objectCollectionId = resolvedSectionId
    if (typeof expectedVersion === 'number') requestParams.expectedVersion = expectedVersion
    const normalizedWorkspaceId = normalizeRuntimeWorkspaceId(workspaceId)
    if (normalizedWorkspaceId) requestParams.workspaceId = normalizedWorkspaceId
    await apiClient.delete(`/applications/${applicationId}/runtime/rows/${rowId}`, {
        params: Object.keys(requestParams).length > 0 ? requestParams : undefined
    })
}

/** Restore a soft-deleted runtime row. */
export const restoreApplicationRuntimeRow = async (params: {
    applicationId: string
    rowId: string
    objectCollectionId?: string
    sectionId?: string
    workspaceId?: string | null
    expectedVersion?: number
    restoreTarget?: RuntimeRestoreTarget
}): Promise<void> => {
    const { applicationId, rowId, objectCollectionId, sectionId, workspaceId, expectedVersion, restoreTarget } = params
    const resolvedSectionId = sectionId ?? objectCollectionId
    const body: Record<string, unknown> = {}
    if (resolvedSectionId) body.objectCollectionId = resolvedSectionId
    if (typeof expectedVersion === 'number') body.expectedVersion = expectedVersion
    if (restoreTarget) body.restoreTarget = restoreTarget
    const normalizedWorkspaceId = normalizeRuntimeWorkspaceId(workspaceId)
    if (normalizedWorkspaceId) {
        await apiClient.post(`/applications/${applicationId}/runtime/rows/${rowId}/restore`, body, {
            params: { workspaceId: normalizedWorkspaceId }
        })
    } else {
        await apiClient.post(`/applications/${applicationId}/runtime/rows/${rowId}/restore`, body)
    }
}

/** Copy a runtime row. */
export const copyApplicationRuntimeRow = async (params: {
    applicationId: string
    rowId: string
    objectCollectionId?: string
    sectionId?: string
    workspaceId?: string | null
    copyChildTables?: boolean
    data?: Record<string, unknown>
    expectedVersion?: number
}): Promise<Record<string, unknown>> => {
    const { applicationId, rowId, objectCollectionId, sectionId, workspaceId, copyChildTables = true, data, expectedVersion } = params
    const resolvedSectionId = sectionId ?? objectCollectionId
    const body: Record<string, unknown> = { copyChildTables }
    if (resolvedSectionId) body.objectCollectionId = resolvedSectionId
    if (data && Object.keys(data).length > 0) body.data = data
    if (typeof expectedVersion === 'number') body.expectedVersion = expectedVersion
    const normalizedWorkspaceId = normalizeRuntimeWorkspaceId(workspaceId)
    const response = normalizedWorkspaceId
        ? await apiClient.post<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows/${rowId}/copy`, body, {
              params: { workspaceId: normalizedWorkspaceId }
          })
        : await apiClient.post<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows/${rowId}/copy`, body)
    return response.data
}

export const runApplicationRuntimeRecordCommand = async (params: {
    applicationId: string
    rowId: string
    command: RuntimeRecordCommand
    objectCollectionId?: string
    sectionId?: string
    workspaceId?: string | null
    expectedVersion?: number
}): Promise<Record<string, unknown>> => {
    const { applicationId, rowId, command, objectCollectionId, sectionId, workspaceId, expectedVersion } = params
    const resolvedSectionId = sectionId ?? objectCollectionId
    const body: Record<string, unknown> = {}
    if (resolvedSectionId) body.objectCollectionId = resolvedSectionId
    if (typeof expectedVersion === 'number') body.expectedVersion = expectedVersion
    const normalizedWorkspaceId = normalizeRuntimeWorkspaceId(workspaceId)
    const response = normalizedWorkspaceId
        ? await apiClient.post<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows/${rowId}/${command}`, body, {
              params: { workspaceId: normalizedWorkspaceId }
          })
        : await apiClient.post<Record<string, unknown>>(`/applications/${applicationId}/runtime/rows/${rowId}/${command}`, body)
    return response.data
}

export const runApplicationRuntimeWorkflowAction = async (params: {
    applicationId: string
    rowId: string
    actionCodename: string
    objectCollectionId?: string
    sectionId?: string
    workspaceId?: string | null
    expectedVersion: number
}): Promise<Record<string, unknown>> => {
    const { applicationId, rowId, actionCodename, objectCollectionId, sectionId, workspaceId, expectedVersion } = params
    const resolvedSectionId = sectionId ?? objectCollectionId
    const body: Record<string, unknown> = { expectedVersion }
    if (resolvedSectionId) body.objectCollectionId = resolvedSectionId
    const normalizedWorkspaceId = normalizeRuntimeWorkspaceId(workspaceId)
    const response = normalizedWorkspaceId
        ? await apiClient.post<Record<string, unknown>>(
              `/applications/${applicationId}/runtime/rows/${rowId}/workflow/${encodeURIComponent(actionCodename)}`,
              body,
              { params: { workspaceId: normalizedWorkspaceId } }
          )
        : await apiClient.post<Record<string, unknown>>(
              `/applications/${applicationId}/runtime/rows/${rowId}/workflow/${encodeURIComponent(actionCodename)}`,
              body
          )
    return response.data
}

export const reorderApplicationRuntimeRows = async (params: {
    applicationId: string
    orderedRowIds: string[]
    objectCollectionId?: string
    sectionId?: string
    workspaceId?: string | null
    expectedVersionsByRowId?: Record<string, number>
}): Promise<void> => {
    const { applicationId, orderedRowIds, objectCollectionId, sectionId, workspaceId, expectedVersionsByRowId } = params
    const resolvedSectionId = sectionId ?? objectCollectionId
    const body: Record<string, unknown> = { orderedRowIds }
    if (resolvedSectionId) body.objectCollectionId = resolvedSectionId
    if (expectedVersionsByRowId && Object.keys(expectedVersionsByRowId).length > 0) {
        body.expectedVersionsByRowId = expectedVersionsByRowId
    }
    const normalizedWorkspaceId = normalizeRuntimeWorkspaceId(workspaceId)
    if (normalizedWorkspaceId) {
        await apiClient.post(`/applications/${applicationId}/runtime/rows/reorder`, body, {
            params: { workspaceId: normalizedWorkspaceId }
        })
    } else {
        await apiClient.post(`/applications/${applicationId}/runtime/rows/reorder`, body)
    }
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
    params?: PaginationParams & { scopeEntityId?: string | null }
): Promise<PaginatedResponse<ApplicationLayout>> => {
    const response = await apiClient.get<{ items: ApplicationLayout[]; total: number }>(`/applications/${applicationId}/layouts`, {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            scopeEntityId: params?.scopeEntityId ?? undefined,
            scope: params?.scopeEntityId === null ? 'global' : undefined
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
    data: ApplicationLayoutUpdate
): Promise<ApplicationLayout> => {
    const response = await apiClient.patch<{ item: ApplicationLayout }>(`/applications/${applicationId}/layouts/${layoutId}`, data)
    return response.data.item
}

export const resetApplicationLayoutConfig = async (
    applicationId: string,
    layoutId: string,
    data: ApplicationLayoutConfigResetMutation
): Promise<ApplicationLayout> => {
    const response = await apiClient.post<{ item: ApplicationLayout }>(
        `/applications/${applicationId}/layouts/${layoutId}/config/reset`,
        data
    )
    return response.data.item
}

export const deleteApplicationLayout = async (applicationId: string, layoutId: string, expectedVersion: number): Promise<void> => {
    await apiClient.delete(`/applications/${applicationId}/layouts/${layoutId}`, {
        params: { expectedVersion }
    })
}

export const copyApplicationLayout = async (
    applicationId: string,
    layoutId: string,
    expectedVersion: number
): Promise<ApplicationLayout> => {
    const response = await apiClient.post<{ item: ApplicationLayout }>(`/applications/${applicationId}/layouts/${layoutId}/copy`, {
        expectedVersion
    })
    return response.data.item
}

export const listApplicationLayoutWidgets = async (applicationId: string, layoutId: string): Promise<ApplicationLayoutWidget[]> => {
    const response = await apiClient.get<{ items: ApplicationLayoutWidget[] }>(
        `/applications/${applicationId}/layouts/${layoutId}/zone-widgets`
    )
    return response.data.items ?? []
}

export const listApplicationLayoutWidgetObject = async (
    applicationId: string,
    layoutId: string
): Promise<ApplicationLayoutWidgetDefinition[]> => {
    const response = await apiClient.get<{ items: ApplicationLayoutWidgetDefinition[] }>(
        `/applications/${applicationId}/layouts/${layoutId}/zone-widgets/object`
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

export const updateApplicationLayoutWidgetConfigsBatch = async (
    applicationId: string,
    data: ApplicationLayoutWidgetConfigBatchMutation
): Promise<ApplicationLayoutWidget[]> => {
    const response = await apiClient.patch<{ items: ApplicationLayoutWidget[] }>(
        `/applications/${applicationId}/layouts/zone-widgets/config/batch`,
        data
    )
    return response.data.items
}

export const resetApplicationLayoutWidgetConfigsBatch = async (
    applicationId: string,
    data: ApplicationLayoutWidgetResetBatchMutation
): Promise<ApplicationLayoutWidget[]> => {
    const response = await apiClient.post<{ items: ApplicationLayoutWidget[] }>(
        `/applications/${applicationId}/layouts/zone-widgets/config/reset`,
        data
    )
    return response.data.items
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

export const deleteApplicationLayoutWidget = async (
    applicationId: string,
    layoutId: string,
    widgetId: string,
    expectedVersion: number
): Promise<void> => {
    await apiClient.delete(`/applications/${applicationId}/layouts/${layoutId}/zone-widget/${widgetId}`, {
        params: { expectedVersion }
    })
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
