import apiClient, { extractPaginationMeta } from './apiClient'
import { Resource, PaginationParams, PaginatedResponse } from '../types'

// Updated listResources with pagination support
export const listResources = async (params?: PaginationParams): Promise<PaginatedResponse<Resource>> => {
    const response = await apiClient.get<Resource[]>('/resources', {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            sortBy: params?.sortBy,
            sortOrder: params?.sortOrder,
            search: params?.search
        }
    })

    return {
        items: response.data,
        pagination: extractPaginationMeta(response)
    }
}

export const getResource = (resourceId: string) => apiClient.get<Resource>(`/resources/${resourceId}`)

export const createResource = (data: { name: string; description?: string; clusterId?: string; domainId: string }) =>
    apiClient.post<Resource>('/resources', data)

export const updateResource = (resourceId: string, data: { name: string; description?: string }) =>
    apiClient.put<Resource>(`/resources/${resourceId}`, data)

export const deleteResource = (resourceId: string) => apiClient.delete<void>(`/resources/${resourceId}`)
