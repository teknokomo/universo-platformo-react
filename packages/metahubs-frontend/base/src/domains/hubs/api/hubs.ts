import { apiClient } from '../../shared'
import { Hub, HubLocalizedPayload, PaginationParams, PaginatedResponse } from '../../../types'
import type { HubCopyOptions, VersionedLocalizedContent } from '@universo/types'

type LegacyCompatiblePaginationParams = PaginationParams & { kindKey?: string }

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
    blockingSets: BlockingHubObject[]
    blockingEnumerations: BlockingHubObject[]
    blockingChildHubs: BlockingHubObject[]
    totalBlocking: number
    canDelete: boolean
}

/**
 * List hubs for a specific metahub
 */
export const listHubs = async (metahubId: string, params?: LegacyCompatiblePaginationParams): Promise<PaginatedResponse<Hub>> => {
    const response = await apiClient.get<{ items: Hub[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/hubs`,
        {
            params: {
                limit: params?.limit,
                offset: params?.offset,
                sortBy: params?.sortBy,
                sortOrder: params?.sortOrder,
                search: params?.search,
                kindKey: params?.kindKey
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
 * List direct child hubs of a parent hub.
 */
export const listChildHubs = async (
    metahubId: string,
    hubId: string,
    params?: LegacyCompatiblePaginationParams
): Promise<PaginatedResponse<Hub>> => {
    const response = await apiClient.get<{ items: Hub[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/hub/${hubId}/hubs`,
        {
            params: {
                limit: params?.limit,
                offset: params?.offset,
                sortBy: params?.sortBy,
                sortOrder: params?.sortOrder,
                search: params?.search,
                kindKey: params?.kindKey
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
 * Get a single hub
 */
export const getHub = (metahubId: string, hubId: string) => apiClient.get<Hub>(`/metahub/${metahubId}/hub/${hubId}`)

/**
 * Create a new hub
 */
export const createHub = (metahubId: string, data: HubLocalizedPayload & { sortOrder?: number; kindKey?: string }) =>
    apiClient.post<Hub>(`/metahub/${metahubId}/hubs`, data)

export type HubCopyInput = HubLocalizedPayload & {
    copyAllRelations?: HubCopyOptions['copyAllRelations']
    copyCatalogRelations?: HubCopyOptions['copyCatalogRelations']
    copySetRelations?: HubCopyOptions['copySetRelations']
    copyEnumerationRelations?: HubCopyOptions['copyEnumerationRelations']
}

export const copyHub = (metahubId: string, hubId: string, data: HubCopyInput) =>
    apiClient.post<Hub>(`/metahub/${metahubId}/hub/${hubId}/copy`, data)

export const reorderHub = (metahubId: string, hubId: string, newSortOrder: number) =>
    apiClient.patch<Hub>(`/metahub/${metahubId}/hubs/reorder`, { hubId, newSortOrder })

/**
 * Update a hub
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateHub = (
    metahubId: string,
    hubId: string,
    data: Partial<HubLocalizedPayload> & { sortOrder?: number; expectedVersion?: number }
) => apiClient.patch<Hub>(`/metahub/${metahubId}/hub/${hubId}`, data)

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
