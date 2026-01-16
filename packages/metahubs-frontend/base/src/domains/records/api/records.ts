import { apiClient } from '../../shared'
import { HubRecord, PaginationParams, PaginatedResponse } from '../../../types'

/**
 * List records for a specific catalog
 */
export const listRecords = async (
    metahubId: string,
    hubId: string,
    catalogId: string,
    params?: PaginationParams
): Promise<PaginatedResponse<HubRecord>> => {
    const response = await apiClient.get<{ items: HubRecord[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}/records`,
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
 * Get a single record
 */
export const getRecord = (metahubId: string, hubId: string, catalogId: string, recordId: string) =>
    apiClient.get<HubRecord>(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}/record/${recordId}`)

/**
 * Create a new record
 */
export const createRecord = (
    metahubId: string,
    hubId: string,
    catalogId: string,
    data: {
        data: Record<string, unknown>
        sortOrder?: number
    }
) => apiClient.post<HubRecord>(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}/records`, data)

/**
 * Update a record
 */
export const updateRecord = (
    metahubId: string,
    hubId: string,
    catalogId: string,
    recordId: string,
    data: {
        data?: Record<string, unknown>
        sortOrder?: number
    }
) => apiClient.patch<HubRecord>(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}/record/${recordId}`, data)

/**
 * Delete a record
 */
export const deleteRecord = (metahubId: string, hubId: string, catalogId: string, recordId: string) =>
    apiClient.delete<void>(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}/record/${recordId}`)

// ============================================================================
// Direct API (without hub) - for catalogs without hub association
// ============================================================================

/**
 * List records for a catalog (direct, without hub)
 */
export const listRecordsDirect = async (
    metahubId: string,
    catalogId: string,
    params?: PaginationParams
): Promise<PaginatedResponse<HubRecord>> => {
    const response = await apiClient.get<{ items: HubRecord[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/catalog/${catalogId}/records`,
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
 * Get a single record (direct, without hub)
 */
export const getRecordDirect = (metahubId: string, catalogId: string, recordId: string) =>
    apiClient.get<HubRecord>(`/metahub/${metahubId}/catalog/${catalogId}/record/${recordId}`)

/**
 * Create a new record (direct, without hub)
 */
export const createRecordDirect = (
    metahubId: string,
    catalogId: string,
    data: {
        data: Record<string, unknown>
        sortOrder?: number
    }
) => apiClient.post<HubRecord>(`/metahub/${metahubId}/catalog/${catalogId}/records`, data)

/**
 * Update a record (direct, without hub)
 */
export const updateRecordDirect = (
    metahubId: string,
    catalogId: string,
    recordId: string,
    data: {
        data?: Record<string, unknown>
        sortOrder?: number
    }
) => apiClient.patch<HubRecord>(`/metahub/${metahubId}/catalog/${catalogId}/record/${recordId}`, data)

/**
 * Delete a record (direct, without hub)
 */
export const deleteRecordDirect = (metahubId: string, catalogId: string, recordId: string) =>
    apiClient.delete<void>(`/metahub/${metahubId}/catalog/${catalogId}/record/${recordId}`)
