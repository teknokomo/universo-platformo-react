import { apiClient } from '../../shared'
import { Catalog, CatalogLocalizedPayload, PaginationParams, PaginatedResponse, HubRef } from '../../../types'
import type { VersionedLocalizedContent } from '@universo/types'

/**
 * Catalog with parent hubs info (for "all catalogs" view)
 * Uses the same hubs array as the Catalog type
 */
export interface CatalogWithHubs extends Catalog {
    hubs: HubRef[]
}

export interface BlockingCatalogReference {
    sourceCatalogId: string
    sourceCatalogCodename: string
    sourceCatalogName: VersionedLocalizedContent<string> | null
    attributeId: string
    attributeCodename: string
    attributeName: VersionedLocalizedContent<string> | null
}

export interface BlockingCatalogReferencesResponse {
    catalogId: string
    blockingReferences: BlockingCatalogReference[]
    canDelete: boolean
}

/**
 * List all catalogs in a metahub (owner-level view)
 */
export const listAllCatalogs = async (metahubId: string, params?: PaginationParams): Promise<PaginatedResponse<CatalogWithHubs>> => {
    const response = await apiClient.get<{ items: CatalogWithHubs[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/catalogs`,
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
        `/metahub/${metahubId}/hub/${hubId}/catalogs`,
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
    const response = await apiClient.get<Catalog>(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}`)
    return response.data
}

/**
 * Get a single catalog by ID (owner-level, no hub required)
 * Returns catalog with all associated hubs
 */
export const getCatalogById = async (metahubId: string, catalogId: string): Promise<CatalogWithHubs> => {
    const response = await apiClient.get<CatalogWithHubs>(`/metahub/${metahubId}/catalog/${catalogId}`)
    return response.data
}

/**
 * Create a new catalog at metahub level (can have 0+ hub associations)
 * Used when creating catalogs from the global catalogs list
 */
export const createCatalogAtMetahub = (metahubId: string, data: CatalogLocalizedPayload & { sortOrder?: number }) =>
    apiClient.post<Catalog>(`/metahub/${metahubId}/catalogs`, data)

/**
 * Create a new catalog and associate with hub(s) - hub-scoped endpoint
 */
export const createCatalog = (metahubId: string, hubId: string, data: CatalogLocalizedPayload & { sortOrder?: number }) =>
    apiClient.post<Catalog>(`/metahub/${metahubId}/hub/${hubId}/catalogs`, data)

/**
 * Update a catalog (including hub associations via hubIds array)
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateCatalog = (
    metahubId: string,
    hubId: string,
    catalogId: string,
    data: Partial<CatalogLocalizedPayload> & { sortOrder?: number; expectedVersion?: number }
) => apiClient.patch<Catalog>(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}`, data)

/**
 * Update a catalog at metahub level (for catalogs without hub or with multiple hubs)
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateCatalogAtMetahub = (
    metahubId: string,
    catalogId: string,
    data: Partial<CatalogLocalizedPayload> & { sortOrder?: number; expectedVersion?: number }
) => apiClient.patch<Catalog>(`/metahub/${metahubId}/catalog/${catalogId}`, data)

/**
 * Delete a catalog or remove from hub
 * If catalog is associated with multiple hubs and force=false, only removes from this hub
 * If force=true or single hub, deletes the entire catalog
 */
export const deleteCatalog = (metahubId: string, hubId: string, catalogId: string, force = false) =>
    apiClient.delete<void | { message: string; remainingHubs: number }>(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}`, {
        params: force ? { force: 'true' } : undefined
    })

/**
 * Delete a catalog directly (without requiring hubId)
 * Use for catalogs without hub associations or force delete
 */
export const deleteCatalogDirect = (metahubId: string, catalogId: string) =>
    apiClient.delete<void>(`/metahub/${metahubId}/catalog/${catalogId}`)

/**
 * Get cross-catalog REF attributes that block deleting this catalog.
 */
export const getBlockingCatalogReferences = async (metahubId: string, catalogId: string): Promise<BlockingCatalogReferencesResponse> => {
    try {
        const response = await apiClient.get<BlockingCatalogReferencesResponse>(
            `/metahub/${metahubId}/catalog/${catalogId}/blocking-references`
        )
        return response.data
    } catch (error: unknown) {
        const status =
            error &&
            typeof error === 'object' &&
            'response' in error &&
            typeof (error as { response?: { status?: unknown } }).response?.status === 'number'
                ? (error as { response?: { status?: number } }).response?.status ?? undefined
                : undefined
        if (status !== 404) throw error

        const fallbackResponse = await apiClient.get<BlockingCatalogReferencesResponse>(
            `/metahub/${metahubId}/catalogs/${catalogId}/blocking-references`
        )
        return fallbackResponse.data
    }
}
