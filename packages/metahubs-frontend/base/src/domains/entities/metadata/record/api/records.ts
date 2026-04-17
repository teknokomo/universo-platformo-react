import { apiClient } from '../../../../shared'
import { RecordItem, PaginationParams, PaginatedResponse } from '../../../../../types'
import type { RecordCopyOptions } from '@universo/types'

const resolveCollectionKindKey = (kindKey?: string) => kindKey?.trim() || 'catalog'

const buildCollectionInstancePath = (metahubId: string, collectionId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveCollectionKindKey(kindKey))}/instance/${collectionId}`

const buildContainerScopedCollectionPath = (metahubId: string, containerId: string, collectionId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(
        resolveCollectionKindKey(kindKey)
    )}/instance/${containerId}/instance/${collectionId}`

/**
 * List records for a specific linked collection within a tree-entity scope.
 */
export const listRecords = async (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    params?: PaginationParams & { kindKey?: string }
): Promise<PaginatedResponse<RecordItem>> => {
    const response = await apiClient.get<{ items: RecordItem[]; pagination: { total: number; limit: number; offset: number } }>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, linkedCollectionId, params?.kindKey)}/records`,
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
 * Get a single record from a tree-entity-scoped linked collection.
 */
export const getRecord = (metahubId: string, treeEntityId: string, linkedCollectionId: string, recordId: string, kindKey?: string) =>
    apiClient.get<RecordItem>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, linkedCollectionId, kindKey)}/record/${recordId}`
    )

/**
 * Create a new record
 */
export const createRecord = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    data: {
        data: Record<string, unknown>
        sortOrder?: number
        kindKey?: string
    }
) =>
    apiClient.post<RecordItem>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, linkedCollectionId, data.kindKey)}/records`,
        data
    )

/**
 * Update a record
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateRecord = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    recordId: string,
    data: {
        data?: Record<string, unknown>
        sortOrder?: number
        expectedVersion?: number
        kindKey?: string
    }
) =>
    apiClient.patch<RecordItem>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, linkedCollectionId, data.kindKey)}/record/${recordId}`,
        data
    )

/**
 * Delete a record
 */
export const deleteRecord = (metahubId: string, treeEntityId: string, linkedCollectionId: string, recordId: string, kindKey?: string) =>
    apiClient.delete<void>(`${buildContainerScopedCollectionPath(metahubId, treeEntityId, linkedCollectionId, kindKey)}/record/${recordId}`)

export const copyRecord = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    recordId: string,
    data?: Partial<RecordCopyOptions> & { kindKey?: string }
) =>
    apiClient.post<RecordItem>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, linkedCollectionId, data?.kindKey)}/record/${recordId}/copy`,
        data ?? {}
    )

export const moveRecord = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    recordId: string,
    direction: 'up' | 'down',
    kindKey?: string
) =>
    apiClient.patch<RecordItem>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, linkedCollectionId, kindKey)}/record/${recordId}/move`,
        {
            direction
        }
    )

export const reorderRecord = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    recordId: string,
    newSortOrder: number,
    kindKey?: string
) =>
    apiClient.patch<RecordItem>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, linkedCollectionId, kindKey)}/records/reorder`,
        {
            recordId,
            newSortOrder
        }
    )

// ============================================================================
// Direct API - for linked collections without a tree-entity association
// ============================================================================

/**
 * List records for a linked collection without a tree-entity association.
 */
export const listRecordsDirect = async (
    metahubId: string,
    linkedCollectionId: string,
    params?: PaginationParams & { kindKey?: string }
): Promise<PaginatedResponse<RecordItem>> => {
    const response = await apiClient.get<{ items: RecordItem[]; pagination: { total: number; limit: number; offset: number } }>(
        `${buildCollectionInstancePath(metahubId, linkedCollectionId, params?.kindKey)}/records`,
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
 * Get a single record from a direct linked-collection context.
 */
export const getRecordDirect = (metahubId: string, linkedCollectionId: string, recordId: string, kindKey?: string) =>
    apiClient.get<RecordItem>(`${buildCollectionInstancePath(metahubId, linkedCollectionId, kindKey)}/record/${recordId}`)

/**
 * Create a new record in a direct linked-collection context.
 */
export const createRecordDirect = (
    metahubId: string,
    linkedCollectionId: string,
    data: {
        data: Record<string, unknown>
        sortOrder?: number
        kindKey?: string
    }
) => apiClient.post<RecordItem>(`${buildCollectionInstancePath(metahubId, linkedCollectionId, data.kindKey)}/records`, data)

/**
 * Update a record in a direct linked-collection context.
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateRecordDirect = (
    metahubId: string,
    linkedCollectionId: string,
    recordId: string,
    data: {
        data?: Record<string, unknown>
        sortOrder?: number
        expectedVersion?: number
        kindKey?: string
    }
) => apiClient.patch<RecordItem>(`${buildCollectionInstancePath(metahubId, linkedCollectionId, data.kindKey)}/record/${recordId}`, data)

/**
 * Delete a record from a direct linked-collection context.
 */
export const deleteRecordDirect = (metahubId: string, linkedCollectionId: string, recordId: string, kindKey?: string) =>
    apiClient.delete<void>(`${buildCollectionInstancePath(metahubId, linkedCollectionId, kindKey)}/record/${recordId}`)

export const copyRecordDirect = (
    metahubId: string,
    linkedCollectionId: string,
    recordId: string,
    data?: Partial<RecordCopyOptions> & { kindKey?: string }
) =>
    apiClient.post<RecordItem>(
        `${buildCollectionInstancePath(metahubId, linkedCollectionId, data?.kindKey)}/record/${recordId}/copy`,
        data ?? {}
    )

export const moveRecordDirect = (
    metahubId: string,
    linkedCollectionId: string,
    recordId: string,
    direction: 'up' | 'down',
    kindKey?: string
) =>
    apiClient.patch<RecordItem>(`${buildCollectionInstancePath(metahubId, linkedCollectionId, kindKey)}/record/${recordId}/move`, {
        direction
    })

export const reorderRecordDirect = (
    metahubId: string,
    linkedCollectionId: string,
    recordId: string,
    newSortOrder: number,
    kindKey?: string
) =>
    apiClient.patch<RecordItem>(`${buildCollectionInstancePath(metahubId, linkedCollectionId, kindKey)}/records/reorder`, {
        recordId,
        newSortOrder
    })
