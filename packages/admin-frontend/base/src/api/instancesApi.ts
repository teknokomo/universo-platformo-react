import type { AxiosInstance, AxiosResponse } from 'axios'
import type { Instance, InstanceStats, UpdateInstancePayload, PaginatedResponse } from '../types'
import apiClient from './apiClient'

/**
 * Pagination parameters for instances API
 */
export interface InstancesListParams {
    limit?: number
    offset?: number
    sortBy?: 'codename' | 'created' | 'status'
    sortOrder?: 'asc' | 'desc'
    search?: string
}

const BASE_PATH = '/admin/instances'

/**
 * Extract pagination metadata from response headers
 */
function extractPaginationMeta(response: AxiosResponse): PaginatedResponse<unknown>['pagination'] {
    return {
        limit: parseInt(response.headers['x-pagination-limit'] || '20', 10),
        offset: parseInt(response.headers['x-pagination-offset'] || '0', 10),
        count: parseInt(response.headers['x-pagination-count'] || '0', 10),
        total: parseInt(response.headers['x-total-count'] || '0', 10),
        hasMore: response.headers['x-pagination-has-more'] === 'true'
    }
}

// ============================================
// Direct exports for usePaginated hook
// ============================================

/**
 * List all instances with pagination
 */
export const listInstances = async (params?: InstancesListParams): Promise<PaginatedResponse<Instance>> => {
    const response = await apiClient.get<{ data: Instance[] }>(BASE_PATH, {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            sortBy: params?.sortBy,
            sortOrder: params?.sortOrder,
            search: params?.search
        }
    })

    return {
        items: response.data.data,
        pagination: extractPaginationMeta(response)
    }
}

/**
 * Get instance by ID
 */
export const getInstance = async (id: string): Promise<Instance> => {
    const { data } = await apiClient.get<{ data: Instance }>(`${BASE_PATH}/${id}`)
    return data.data
}

/**
 * Update instance (name, description)
 */
export const updateInstance = async (id: string, payload: UpdateInstancePayload): Promise<Instance> => {
    const { data } = await apiClient.put<{ data: Instance }>(`${BASE_PATH}/${id}`, payload)
    return data.data
}

/**
 * Get instance statistics
 */
export const getInstanceStats = async (id: string): Promise<InstanceStats> => {
    const { data } = await apiClient.get<{ data: InstanceStats }>(`${BASE_PATH}/${id}/stats`)
    return data.data
}

// ============================================
// Factory function (for dependency injection)
// ============================================

/**
 * Create instances API client with custom axios instance
 */
export function createInstancesApi(client: AxiosInstance) {
    return {
        listInstances: async (params?: InstancesListParams): Promise<PaginatedResponse<Instance>> => {
            const response = await client.get<{ data: Instance[] }>(BASE_PATH, {
                params: {
                    limit: params?.limit,
                    offset: params?.offset,
                    sortBy: params?.sortBy,
                    sortOrder: params?.sortOrder,
                    search: params?.search
                }
            })

            return {
                items: response.data.data,
                pagination: extractPaginationMeta(response)
            }
        },

        getInstance: async (id: string): Promise<Instance> => {
            const { data } = await client.get<{ data: Instance }>(`${BASE_PATH}/${id}`)
            return data.data
        },

        updateInstance: async (id: string, payload: UpdateInstancePayload): Promise<Instance> => {
            const { data } = await client.put<{ data: Instance }>(`${BASE_PATH}/${id}`, payload)
            return data.data
        },

        getInstanceStats: async (id: string): Promise<InstanceStats> => {
            const { data } = await client.get<{ data: InstanceStats }>(`${BASE_PATH}/${id}/stats`)
            return data.data
        }
    }
}

export type InstancesApi = ReturnType<typeof createInstancesApi>
