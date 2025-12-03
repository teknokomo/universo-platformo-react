import apiClient, { extractPaginationMeta } from './apiClient'
import { Section, Entity, PaginationParams, PaginatedResponse } from '../types'

// Updated listSections with pagination support
export const listSections = async (params?: PaginationParams): Promise<PaginatedResponse<Section>> => {
    const response = await apiClient.get<Section[]>('/sections', {
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

export const getSection = (id: string) => apiClient.get<Section>(`/sections/${id}`)

export const createSection = (data: { name: string; description?: string; metaverseId: string }) =>
    apiClient.post<Section>('/sections', data)

export const updateSection = (id: string, data: { name: string; description?: string }) => apiClient.put<Section>(`/sections/${id}`, data)

export const deleteSection = (id: string) => apiClient.delete<void>(`/sections/${id}`)

// Section-Entity relationships
export const getSectionEntities = (sectionId: string) => apiClient.get<Entity[]>(`/sections/${sectionId}/entities`)

export const addEntityToSection = (sectionId: string, entityId: string) =>
    apiClient.post<void>(`/sections/${sectionId}/entities/${entityId}`)

export const assignEntityToSection = (entityId: string, sectionId: string) =>
    apiClient.put<void>(`/entities/${entityId}/section`, { sectionId })

export const removeEntityFromSection = (entityId: string) => apiClient.delete<void>(`/entities/${entityId}/section`)
