import apiClient from './apiClient'
import { Hub, HubLocalizedPayload, PaginationParams, PaginatedResponse } from '../types'
import type { VersionedLocalizedContent } from '@universo/types'

/**
 * Blocking catalog info returned by blocking-catalogs endpoint
 */
export interface BlockingCatalog {
    id: string
    name: VersionedLocalizedContent<string>
    codename: string
}

/**
 * Response from blocking-catalogs endpoint
 */
export interface BlockingCatalogsResponse {
    hubId: string
    blockingCatalogs: BlockingCatalog[]
    canDelete: boolean
}

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
export const createHub = (metahubId: string, data: HubLocalizedPayload & { sortOrder?: number }) =>
    apiClient.post<Hub>(`/metahubs/${metahubId}/hubs`, data)

/**
 * Update a hub
 */
export const updateHub = (metahubId: string, hubId: string, data: HubLocalizedPayload & { sortOrder?: number }) =>
    apiClient.patch<Hub>(`/metahubs/${metahubId}/hubs/${hubId}`, data)

/**
 * Delete a hub
 */
export const deleteHub = (metahubId: string, hubId: string) => apiClient.delete<void>(`/metahubs/${metahubId}/hubs/${hubId}`)

/**
 * Get catalogs that would block hub deletion
 * Returns catalogs with isRequiredHub=true that have this hub as their only association
 */
export const getBlockingCatalogs = async (metahubId: string, hubId: string): Promise<BlockingCatalogsResponse> => {
    const response = await apiClient.get<BlockingCatalogsResponse>(`/metahubs/${metahubId}/hubs/${hubId}/blocking-catalogs`)
    return response.data
}
