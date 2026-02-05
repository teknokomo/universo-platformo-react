import { apiClient } from '../../shared'
import { MetahubLayout, MetahubLayoutLocalizedPayload, PaginationParams, PaginatedResponse } from '../../../types'

/**
 * List layouts for a specific metahub
 */
export const listLayouts = async (metahubId: string, params?: PaginationParams): Promise<PaginatedResponse<MetahubLayout>> => {
    const response = await apiClient.get<{ items: MetahubLayout[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/layouts`,
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
 * Get a single layout
 */
export const getLayout = (metahubId: string, layoutId: string) => apiClient.get<MetahubLayout>(`/metahub/${metahubId}/layout/${layoutId}`)

/**
 * Create a new layout
 */
export const createLayout = (metahubId: string, data: MetahubLayoutLocalizedPayload) =>
    apiClient.post<MetahubLayout>(`/metahub/${metahubId}/layouts`, data)

/**
 * Update a layout
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateLayout = (metahubId: string, layoutId: string, data: Partial<MetahubLayoutLocalizedPayload>) =>
    apiClient.patch<MetahubLayout>(`/metahub/${metahubId}/layout/${layoutId}`, data)

/**
 * Delete a layout
 */
export const deleteLayout = (metahubId: string, layoutId: string) => apiClient.delete<void>(`/metahub/${metahubId}/layout/${layoutId}`)
