import { apiClient } from '../../../../shared'
import { RecordItem, PaginationParams, PaginatedResponse } from '../../../../../types'
import type { RecordCopyOptions } from '@universo/types'

const resolveCollectionKindKey = (kindKey?: string) => kindKey?.trim() || 'object'

const buildCollectionInstancePath = (metahubId: string, collectionId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveCollectionKindKey(kindKey))}/instance/${collectionId}`

const buildContainerScopedCollectionPath = (metahubId: string, containerId: string, collectionId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(
        resolveCollectionKindKey(kindKey)
    )}/instance/${containerId}/instance/${collectionId}`

/**
 * List records for a specific object within a hub scope.
 */
export const listRecords = async (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    params?: PaginationParams & { kindKey?: string }
): Promise<PaginatedResponse<RecordItem>> => {
    const response = await apiClient.get<{ items: RecordItem[]; pagination: { total: number; limit: number; offset: number } }>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, objectCollectionId, params?.kindKey)}/records`,
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

    // Backend returns { items, pagination } object
    const backendPagination = response.data.pagination
    return {
        items: response.data.items || [],
        pagination: {
            limit: backendPagination?.limit ?? 100,
            offset: backendPagination?.offset ?? 0,
            count: response.data.items?.length ?? 0,
            total: backendPagination?.total ?? 0,
            hasMore: (backendPagination?.offset ?? 0) + (response.data.items?.length ?? 0) < (backendPagination?.total ?? 0)
        }
    }
}

/**
 * Get a single record from a hub-scoped object.
 */
export const getRecord = (metahubId: string, treeEntityId: string, objectCollectionId: string, recordId: string, kindKey?: string) =>
    apiClient.get<RecordItem>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, objectCollectionId, kindKey)}/record/${recordId}`
    )

/**
 * Create a new record
 */
export const createRecord = (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    data: {
        data: Record<string, unknown>
        sortOrder?: number
        kindKey?: string
    }
) =>
    apiClient.post<RecordItem>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, objectCollectionId, data.kindKey)}/records`,
        data
    )

/**
 * Update a record
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateRecord = (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    recordId: string,
    data: {
        data?: Record<string, unknown>
        sortOrder?: number
        expectedVersion?: number
        kindKey?: string
    }
) =>
    apiClient.patch<RecordItem>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, objectCollectionId, data.kindKey)}/record/${recordId}`,
        data
    )

/**
 * Delete a record
 */
export const deleteRecord = (metahubId: string, treeEntityId: string, objectCollectionId: string, recordId: string, kindKey?: string) =>
    apiClient.delete<void>(`${buildContainerScopedCollectionPath(metahubId, treeEntityId, objectCollectionId, kindKey)}/record/${recordId}`)

export const copyRecord = (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    recordId: string,
    data?: Partial<RecordCopyOptions> & { kindKey?: string }
) =>
    apiClient.post<RecordItem>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, objectCollectionId, data?.kindKey)}/record/${recordId}/copy`,
        data ?? {}
    )

export const moveRecord = (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    recordId: string,
    direction: 'up' | 'down',
    kindKey?: string
) =>
    apiClient.patch<RecordItem>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, objectCollectionId, kindKey)}/record/${recordId}/move`,
        {
            direction
        }
    )

export const reorderRecord = (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    recordId: string,
    newSortOrder: number,
    kindKey?: string
) =>
    apiClient.patch<RecordItem>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, objectCollectionId, kindKey)}/records/reorder`,
        {
            recordId,
            newSortOrder
        }
    )

// ============================================================================
// Direct API - for objects without a hub association
// ============================================================================

/**
 * List records for a object without a hub association.
 */
export const listRecordsDirect = async (
    metahubId: string,
    objectCollectionId: string,
    params?: PaginationParams & { kindKey?: string }
): Promise<PaginatedResponse<RecordItem>> => {
    const response = await apiClient.get<{ items: RecordItem[]; pagination: { total: number; limit: number; offset: number } }>(
        `${buildCollectionInstancePath(metahubId, objectCollectionId, params?.kindKey)}/records`,
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

    const backendPagination = response.data.pagination
    return {
        items: response.data.items || [],
        pagination: {
            limit: backendPagination?.limit ?? 100,
            offset: backendPagination?.offset ?? 0,
            count: response.data.items?.length ?? 0,
            total: backendPagination?.total ?? 0,
            hasMore: (backendPagination?.offset ?? 0) + (response.data.items?.length ?? 0) < (backendPagination?.total ?? 0)
        }
    }
}

/**
 * Get a single record from a direct object-collection context.
 */
export const getRecordDirect = (metahubId: string, objectCollectionId: string, recordId: string, kindKey?: string) =>
    apiClient.get<RecordItem>(`${buildCollectionInstancePath(metahubId, objectCollectionId, kindKey)}/record/${recordId}`)

/**
 * Create a new record in a direct object-collection context.
 */
export const createRecordDirect = (
    metahubId: string,
    objectCollectionId: string,
    data: {
        data: Record<string, unknown>
        sortOrder?: number
        kindKey?: string
    }
) => apiClient.post<RecordItem>(`${buildCollectionInstancePath(metahubId, objectCollectionId, data.kindKey)}/records`, data)

/**
 * Update a record in a direct object-collection context.
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateRecordDirect = (
    metahubId: string,
    objectCollectionId: string,
    recordId: string,
    data: {
        data?: Record<string, unknown>
        sortOrder?: number
        expectedVersion?: number
        kindKey?: string
    }
) => apiClient.patch<RecordItem>(`${buildCollectionInstancePath(metahubId, objectCollectionId, data.kindKey)}/record/${recordId}`, data)

/**
 * Delete a record from a direct object-collection context.
 */
export const deleteRecordDirect = (metahubId: string, objectCollectionId: string, recordId: string, kindKey?: string) =>
    apiClient.delete<void>(`${buildCollectionInstancePath(metahubId, objectCollectionId, kindKey)}/record/${recordId}`)

export const copyRecordDirect = (
    metahubId: string,
    objectCollectionId: string,
    recordId: string,
    data?: Partial<RecordCopyOptions> & { kindKey?: string }
) =>
    apiClient.post<RecordItem>(
        `${buildCollectionInstancePath(metahubId, objectCollectionId, data?.kindKey)}/record/${recordId}/copy`,
        data ?? {}
    )

export const moveRecordDirect = (
    metahubId: string,
    objectCollectionId: string,
    recordId: string,
    direction: 'up' | 'down',
    kindKey?: string
) =>
    apiClient.patch<RecordItem>(`${buildCollectionInstancePath(metahubId, objectCollectionId, kindKey)}/record/${recordId}/move`, {
        direction
    })

export const reorderRecordDirect = (
    metahubId: string,
    objectCollectionId: string,
    recordId: string,
    newSortOrder: number,
    kindKey?: string
) =>
    apiClient.patch<RecordItem>(`${buildCollectionInstancePath(metahubId, objectCollectionId, kindKey)}/records/reorder`, {
        recordId,
        newSortOrder
    })
