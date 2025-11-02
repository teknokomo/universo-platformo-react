import apiClient, { extractPaginationMeta } from './apiClient'
import { Entity, PaginationParams, PaginatedResponse } from '../types'

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
