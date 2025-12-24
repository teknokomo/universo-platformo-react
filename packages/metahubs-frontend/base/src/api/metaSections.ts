import apiClient, { extractPaginationMeta } from './apiClient'
import { MetaSection, MetaEntity, PaginationParams, PaginatedResponse } from '../types'

// Updated listMetaSections with pagination support
export const listMetaSections = async (params?: PaginationParams): Promise<PaginatedResponse<MetaSection>> => {
    const response = await apiClient.get<MetaSection[]>('/meta-sections', {
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

export const getSection = (id: string) => apiClient.get<MetaSection>(`/meta-sections/${id}`)

export const createSection = (data: { name: string; description?: string; metahubId: string }) =>
    apiClient.post<MetaSection>('/meta-sections', data)

export const updateSection = (id: string, data: { name: string; description?: string }) =>
    apiClient.put<MetaSection>(`/meta-sections/${id}`, data)

export const deleteSection = (id: string) => apiClient.delete<void>(`/meta-sections/${id}`)

// MetaSection-MetaEntity relationships
export const getSectionMetaEntities = (sectionId: string) => apiClient.get<MetaEntity[]>(`/meta-sections/${sectionId}/meta-entities`)

export const addEntityToSection = (sectionId: string, entityId: string) =>
    apiClient.post<void>(`/meta-sections/${sectionId}/meta-entities/${entityId}`)

export const assignEntityToSection = (entityId: string, sectionId: string) =>
    apiClient.put<void>(`/meta-entities/${entityId}/section`, { sectionId })

export const removeEntityFromSection = (entityId: string) => apiClient.delete<void>(`/meta-entities/${entityId}/section`)
