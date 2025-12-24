import apiClient, { extractPaginationMeta } from './apiClient'
import { MetaEntity, PaginationParams, PaginatedResponse } from '../types'

// Updated listMetaEntities with pagination support
export const listMetaEntities = async (params?: PaginationParams): Promise<PaginatedResponse<MetaEntity>> => {
    const response = await apiClient.get<MetaEntity[]>('/meta-entities', {
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

export const getEntity = (entityId: string) => apiClient.get<MetaEntity>(`/meta-entities/${entityId}`)

export const createEntity = (data: { name: string; description?: string; metahubId?: string; sectionId: string }) =>
    apiClient.post<MetaEntity>('/meta-entities', data)

export const updateEntity = (entityId: string, data: { name: string; description?: string }) =>
    apiClient.put<MetaEntity>(`/meta-entities/${entityId}`, data)

export const deleteEntity = (entityId: string) => apiClient.delete<void>(`/meta-entities/${entityId}`)
