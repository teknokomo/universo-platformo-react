import apiClient from './apiClient'
import { Hub, PaginationParams, PaginatedResponse } from '../types'

/**
 * List hubs for a specific metahub
 */
export const listHubs = async (metahubId: string, params?: PaginationParams): Promise<PaginatedResponse<Hub>> => {
    const response = await apiClient.get<{ items: Hub[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahubs/${metahubId}/hubs`,
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
 * Get a single hub
 */
export const getHub = (metahubId: string, hubId: string) => apiClient.get<Hub>(`/metahubs/${metahubId}/hubs/${hubId}`)

/**
 * Create a new hub
 */
export const createHub = (
    metahubId: string,
    data: {
        codename: string
        name?: { en?: string; ru?: string }
        description?: { en?: string; ru?: string }
        sortOrder?: number
    }
) => apiClient.post<Hub>(`/metahubs/${metahubId}/hubs`, data)

/**
 * Update a hub
 */
export const updateHub = (
    metahubId: string,
    hubId: string,
    data: {
        codename?: string
        name?: { en?: string; ru?: string }
        description?: { en?: string; ru?: string }
        sortOrder?: number
    }
) => apiClient.patch<Hub>(`/metahubs/${metahubId}/hubs/${hubId}`, data)

/**
 * Delete a hub
 */
export const deleteHub = (metahubId: string, hubId: string) => apiClient.delete<void>(`/metahubs/${metahubId}/hubs/${hubId}`)
