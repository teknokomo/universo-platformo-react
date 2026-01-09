import apiClient from './apiClient'
import { Attribute, AttributeLocalizedPayload, PaginationParams, PaginatedResponse } from '../types'

/**
 * List attributes for a specific hub
 */
export const listAttributes = async (
    metahubId: string,
    hubId: string,
    params?: PaginationParams
): Promise<PaginatedResponse<Attribute>> => {
    const response = await apiClient.get<{ items: Attribute[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahubs/${metahubId}/hubs/${hubId}/attributes`,
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
export const getAttribute = (metahubId: string, hubId: string, attributeId: string) =>
    apiClient.get<Attribute>(`/metahubs/${metahubId}/hubs/${hubId}/attributes/${attributeId}`)

/**
 * Create a new attribute
 */
export const createAttribute = (
    metahubId: string,
    hubId: string,
    data: AttributeLocalizedPayload & {
        targetHubId?: string
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
    }
) => apiClient.post<Attribute>(`/metahubs/${metahubId}/hubs/${hubId}/attributes`, data)

/**
 * Update an attribute
 */
export const updateAttribute = (
    metahubId: string,
    hubId: string,
    attributeId: string,
    data: AttributeLocalizedPayload & {
        targetHubId?: string | null
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
    }
) => apiClient.patch<Attribute>(`/metahubs/${metahubId}/hubs/${hubId}/attributes/${attributeId}`, data)

/**
 * Delete an attribute
 */
export const deleteAttribute = (metahubId: string, hubId: string, attributeId: string) =>
    apiClient.delete<void>(`/metahubs/${metahubId}/hubs/${hubId}/attributes/${attributeId}`)

/**
 * Move attribute within a hub (reorder)
 */
export const moveAttribute = (metahubId: string, hubId: string, attributeId: string, direction: 'up' | 'down') =>
    apiClient.patch<Attribute>(`/metahubs/${metahubId}/hubs/${hubId}/attributes/${attributeId}/move`, { direction })
