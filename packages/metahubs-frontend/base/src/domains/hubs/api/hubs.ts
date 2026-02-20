import { apiClient } from '../../shared'
import { Hub, HubLocalizedPayload, PaginationParams, PaginatedResponse } from '../../../types'
import type { VersionedLocalizedContent } from '@universo/types'

/**
 * Blocking hub object info returned by blocking-catalogs endpoint
 */
export interface BlockingHubObject {
    id: string
    name: VersionedLocalizedContent<string>
    codename: string
}

/**
 * Response from blocking-catalogs endpoint.
 * Contains both blocking catalogs and enumerations.
 */
export interface BlockingCatalogsResponse {
    hubId: string
    blockingCatalogs: BlockingHubObject[]
    blockingEnumerations: BlockingHubObject[]
    totalBlocking: number
    canDelete: boolean
}

/**
 * List hubs for a specific metahub
 */
export const listHubs = async (metahubId: string, params?: PaginationParams): Promise<PaginatedResponse<Hub>> => {
    const response = await apiClient.get<{ items: Hub[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/hubs`,
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
export const getHub = (metahubId: string, hubId: string) => apiClient.get<Hub>(`/metahub/${metahubId}/hub/${hubId}`)

/**
 * Create a new hub
 */
export const createHub = (metahubId: string, data: HubLocalizedPayload & { sortOrder?: number }) =>
    apiClient.post<Hub>(`/metahub/${metahubId}/hubs`, data)

/**
 * Update a hub
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateHub = (metahubId: string, hubId: string, data: HubLocalizedPayload & { sortOrder?: number; expectedVersion?: number }) =>
    apiClient.patch<Hub>(`/metahub/${metahubId}/hub/${hubId}`, data)

/**
 * Delete a hub
 */
export const deleteHub = (metahubId: string, hubId: string) => apiClient.delete<void>(`/metahub/${metahubId}/hub/${hubId}`)

/**
 * Get objects that would block hub deletion.
 * Returns:
 * - catalogs with isRequiredHub=true and only this hub
 * - enumerations with isRequiredHub=true and only this hub
 */
export const getBlockingCatalogs = async (metahubId: string, hubId: string): Promise<BlockingCatalogsResponse> => {
    const response = await apiClient.get<BlockingCatalogsResponse>(`/metahub/${metahubId}/hub/${hubId}/blocking-catalogs`)
    return response.data
}
