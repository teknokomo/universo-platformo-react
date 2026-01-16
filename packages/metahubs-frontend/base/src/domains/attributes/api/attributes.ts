import { apiClient } from '../../shared'
import { Attribute, AttributeLocalizedPayload, PaginationParams, PaginatedResponse } from '../../../types'

/**
 * List attributes for a specific catalog
 */
export const listAttributes = async (
    metahubId: string,
    hubId: string,
    catalogId: string,
    params?: PaginationParams
): Promise<PaginatedResponse<Attribute>> => {
    const response = await apiClient.get<{ items: Attribute[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}/attributes`,
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
 * Get a single attribute
 */
export const getAttribute = (metahubId: string, hubId: string, catalogId: string, attributeId: string) =>
    apiClient.get<Attribute>(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}/attribute/${attributeId}`)

/**
 * Create a new attribute
 */
export const createAttribute = (
    metahubId: string,
    hubId: string,
    catalogId: string,
    data: AttributeLocalizedPayload & {
        targetCatalogId?: string
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
    }
) => apiClient.post<Attribute>(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}/attributes`, data)

/**
 * Update an attribute
 */
export const updateAttribute = (
    metahubId: string,
    hubId: string,
    catalogId: string,
    attributeId: string,
    data: AttributeLocalizedPayload & {
        targetCatalogId?: string | null
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
    }
) => apiClient.patch<Attribute>(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}/attribute/${attributeId}`, data)

/**
 * Delete an attribute
 */
export const deleteAttribute = (metahubId: string, hubId: string, catalogId: string, attributeId: string) =>
    apiClient.delete<void>(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}/attribute/${attributeId}`)

/**
 * Move attribute within a catalog (reorder)
 */
export const moveAttribute = (metahubId: string, hubId: string, catalogId: string, attributeId: string, direction: 'up' | 'down') =>
    apiClient.patch<Attribute>(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}/attribute/${attributeId}/move`, { direction })

// ============ Hub-less API functions (for catalogs without hub association) ============

/**
 * List attributes for a catalog (without hubId)
 */
export const listAttributesDirect = async (
    metahubId: string,
    catalogId: string,
    params?: PaginationParams
): Promise<PaginatedResponse<Attribute>> => {
    const response = await apiClient.get<{ items: Attribute[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/catalog/${catalogId}/attributes`,
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
 * Create an attribute (without hubId)
 */
export const createAttributeDirect = (
    metahubId: string,
    catalogId: string,
    data: AttributeLocalizedPayload & {
        targetCatalogId?: string
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
    }
) => apiClient.post<Attribute>(`/metahub/${metahubId}/catalog/${catalogId}/attributes`, data)

/**
 * Update an attribute (without hubId)
 */
export const updateAttributeDirect = (
    metahubId: string,
    catalogId: string,
    attributeId: string,
    data: AttributeLocalizedPayload & {
        targetCatalogId?: string | null
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
    }
) => apiClient.patch<Attribute>(`/metahub/${metahubId}/catalog/${catalogId}/attribute/${attributeId}`, data)

/**
 * Delete an attribute (without hubId)
 */
export const deleteAttributeDirect = (metahubId: string, catalogId: string, attributeId: string) =>
    apiClient.delete<void>(`/metahub/${metahubId}/catalog/${catalogId}/attribute/${attributeId}`)

/**
 * Move attribute within a catalog (without hubId)
 */
export const moveAttributeDirect = (metahubId: string, catalogId: string, attributeId: string, direction: 'up' | 'down') =>
    apiClient.patch<Attribute>(`/metahub/${metahubId}/catalog/${catalogId}/attribute/${attributeId}/move`, { direction })
