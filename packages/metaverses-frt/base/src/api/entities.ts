import { AxiosResponse } from 'axios'
import apiClient from './apiClient'
import { Entity, PaginationParams, PaginatedResponse, PaginationMeta } from '../types'

// Helper function to extract pagination metadata from response headers
function extractPaginationMeta(response: AxiosResponse): PaginationMeta {
    const headers = response.headers
    return {
        limit: parseInt(headers['x-pagination-limit'] || '100', 10),
        offset: parseInt(headers['x-pagination-offset'] || '0', 10),
        count: parseInt(headers['x-pagination-count'] || '0', 10),
        total: parseInt(headers['x-total-count'] || '0', 10),
        hasMore: headers['x-pagination-has-more'] === 'true'
    }
}

// Updated listEntities with pagination support
export const listEntities = async (params?: PaginationParams): Promise<PaginatedResponse<Entity>> => {
    const response = await apiClient.get<Entity[]>('/entities', {
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

export const getEntity = (entityId: string) => apiClient.get<Entity>(`/entities/${entityId}`)

export const createEntity = (data: { name: string; description?: string; metaverseId?: string; sectionId: string }) =>
    apiClient.post<Entity>('/entities', data)

export const updateEntity = (entityId: string, data: { name: string; description?: string }) =>
    apiClient.put<Entity>(`/entities/${entityId}`, data)

export const deleteEntity = (entityId: string) => apiClient.delete<void>(`/entities/${entityId}`)
