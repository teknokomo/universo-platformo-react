import apiClient from './apiClient'
import { HubRecord, PaginationParams, PaginatedResponse } from '../types'

/**
 * List records for a specific hub
 */
export const listRecords = async (metahubId: string, hubId: string, params?: PaginationParams): Promise<PaginatedResponse<HubRecord>> => {
    const response = await apiClient.get<{ items: HubRecord[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahubs/${metahubId}/hubs/${hubId}/records`,
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
export const getRecord = (metahubId: string, hubId: string, recordId: string) =>
    apiClient.get<HubRecord>(`/metahubs/${metahubId}/hubs/${hubId}/records/${recordId}`)

/**
 * Create a new record
 */
export const createRecord = (
    metahubId: string,
    hubId: string,
    data: {
        data: Record<string, unknown>
        sortOrder?: number
    }
) => apiClient.post<HubRecord>(`/metahubs/${metahubId}/hubs/${hubId}/records`, data)

/**
 * Update a record
 */
export const updateRecord = (
    metahubId: string,
    hubId: string,
    recordId: string,
    data: {
        data?: Record<string, unknown>
        sortOrder?: number
    }
) => apiClient.patch<HubRecord>(`/metahubs/${metahubId}/hubs/${hubId}/records/${recordId}`, data)

/**
 * Delete a record
 */
export const deleteRecord = (metahubId: string, hubId: string, recordId: string) =>
    apiClient.delete<void>(`/metahubs/${metahubId}/hubs/${hubId}/records/${recordId}`)
