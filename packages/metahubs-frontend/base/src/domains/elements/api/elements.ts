import { apiClient } from '../../shared'
import { HubElement, PaginationParams, PaginatedResponse } from '../../../types'

/**
 * List elements for a specific catalog
 */
export const listElements = async (
    metahubId: string,
    hubId: string,
    catalogId: string,
    params?: PaginationParams
): Promise<PaginatedResponse<HubElement>> => {
    const response = await apiClient.get<{ items: HubElement[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}/elements`,
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
 * Get a single element
 */
export const getElement = (metahubId: string, hubId: string, catalogId: string, elementId: string) =>
    apiClient.get<HubElement>(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}/element/${elementId}`)

/**
 * Create a new element
 */
export const createElement = (
    metahubId: string,
    hubId: string,
    catalogId: string,
    data: {
        data: Record<string, unknown>
        sortOrder?: number
    }
) => apiClient.post<HubElement>(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}/elements`, data)

/**
 * Update an element
 */
export const updateElement = (
    metahubId: string,
    hubId: string,
    catalogId: string,
    elementId: string,
    data: {
        data?: Record<string, unknown>
        sortOrder?: number
    }
) => apiClient.patch<HubElement>(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}/element/${elementId}`, data)

/**
 * Delete an element
 */
export const deleteElement = (metahubId: string, hubId: string, catalogId: string, elementId: string) =>
    apiClient.delete<void>(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}/element/${elementId}`)

// ============================================================================
// Direct API (without hub) - for catalogs without hub association
// ============================================================================

/**
 * List elements for a catalog (direct, without hub)
 */
export const listElementsDirect = async (
    metahubId: string,
    catalogId: string,
    params?: PaginationParams
): Promise<PaginatedResponse<HubElement>> => {
    const response = await apiClient.get<{ items: HubElement[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/catalog/${catalogId}/elements`,
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
 * Get a single element (direct, without hub)
 */
export const getElementDirect = (metahubId: string, catalogId: string, elementId: string) =>
    apiClient.get<HubElement>(`/metahub/${metahubId}/catalog/${catalogId}/element/${elementId}`)

/**
 * Create a new element (direct, without hub)
 */
export const createElementDirect = (
    metahubId: string,
    catalogId: string,
    data: {
        data: Record<string, unknown>
        sortOrder?: number
    }
) => apiClient.post<HubElement>(`/metahub/${metahubId}/catalog/${catalogId}/elements`, data)

/**
 * Update an element (direct, without hub)
 */
export const updateElementDirect = (
    metahubId: string,
    catalogId: string,
    elementId: string,
    data: {
        data?: Record<string, unknown>
        sortOrder?: number
    }
) => apiClient.patch<HubElement>(`/metahub/${metahubId}/catalog/${catalogId}/element/${elementId}`, data)

/**
 * Delete an element (direct, without hub)
 */
export const deleteElementDirect = (metahubId: string, catalogId: string, elementId: string) =>
    apiClient.delete<void>(`/metahub/${metahubId}/catalog/${catalogId}/element/${elementId}`)
