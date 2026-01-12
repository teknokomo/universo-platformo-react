import apiClient from './apiClient'
import { Catalog, CatalogLocalizedPayload, PaginationParams, PaginatedResponse, HubRef } from '../types'

/**
 * Catalog with parent hubs info (for "all catalogs" view)
 * Uses the same hubs array as the Catalog type
 */
export interface CatalogWithHubs extends Catalog {
    hubs: HubRef[]
}

/**
 * List all catalogs in a metahub (owner-level view)
 */
export const listAllCatalogs = async (metahubId: string, params?: PaginationParams): Promise<PaginatedResponse<CatalogWithHubs>> => {
    const response = await apiClient.get<{ items: CatalogWithHubs[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahubs/${metahubId}/catalogs`,
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
 * List catalogs for a specific hub (via junction table)
 */
export const listCatalogs = async (metahubId: string, hubId: string, params?: PaginationParams): Promise<PaginatedResponse<Catalog>> => {
    const response = await apiClient.get<{ items: Catalog[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahubs/${metahubId}/hubs/${hubId}/catalogs`,
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
 * Get a single catalog (with its hub associations)
 */
export const getCatalog = async (metahubId: string, hubId: string, catalogId: string): Promise<Catalog> => {
    const response = await apiClient.get<Catalog>(`/metahubs/${metahubId}/hubs/${hubId}/catalogs/${catalogId}`)
    return response.data
}

/**
 * Get a single catalog by ID (owner-level, no hub required)
 * Returns catalog with all associated hubs
 */
export const getCatalogById = async (metahubId: string, catalogId: string): Promise<CatalogWithHubs> => {
    const response = await apiClient.get<CatalogWithHubs>(`/metahubs/${metahubId}/catalogs/${catalogId}`)
    return response.data
}

/**
 * Create a new catalog at metahub level (can have 0+ hub associations)
 * Used when creating catalogs from the global catalogs list
 */
export const createCatalogAtMetahub = (metahubId: string, data: CatalogLocalizedPayload & { sortOrder?: number }) =>
    apiClient.post<Catalog>(`/metahubs/${metahubId}/catalogs`, data)

/**
 * Create a new catalog and associate with hub(s) - hub-scoped endpoint
 */
export const createCatalog = (metahubId: string, hubId: string, data: CatalogLocalizedPayload & { sortOrder?: number }) =>
    apiClient.post<Catalog>(`/metahubs/${metahubId}/hubs/${hubId}/catalogs`, data)

/**
 * Update a catalog (including hub associations via hubIds array)
 */
export const updateCatalog = (
    metahubId: string,
    hubId: string,
    catalogId: string,
    data: Partial<CatalogLocalizedPayload> & { sortOrder?: number }
) => apiClient.patch<Catalog>(`/metahubs/${metahubId}/hubs/${hubId}/catalogs/${catalogId}`, data)

/**
 * Update a catalog at metahub level (for catalogs without hub or with multiple hubs)
 */
export const updateCatalogAtMetahub = (
    metahubId: string,
    catalogId: string,
    data: Partial<CatalogLocalizedPayload> & { sortOrder?: number }
) => apiClient.patch<Catalog>(`/metahubs/${metahubId}/catalogs/${catalogId}`, data)

/**
 * Delete a catalog or remove from hub
 * If catalog is associated with multiple hubs and force=false, only removes from this hub
 * If force=true or single hub, deletes the entire catalog
 */
export const deleteCatalog = (metahubId: string, hubId: string, catalogId: string, force = false) =>
    apiClient.delete<void | { message: string; remainingHubs: number }>(`/metahubs/${metahubId}/hubs/${hubId}/catalogs/${catalogId}`, {
        params: force ? { force: 'true' } : undefined
    })

/**
 * Delete a catalog directly (without requiring hubId)
 * Use for catalogs without hub associations or force delete
 */
export const deleteCatalogDirect = (metahubId: string, catalogId: string) =>
    apiClient.delete<void>(`/metahubs/${metahubId}/catalogs/${catalogId}`)

