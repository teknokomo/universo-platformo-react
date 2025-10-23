import apiClient from './apiClient'
import { Section, Entity } from '../types'

export const listSections = () => apiClient.get<Section[]>('/sections')

export const getSection = (id: string) => apiClient.get<Section>(`/sections/${id}`)

export const createSection = (data: { name: string; description?: string; metaverseId: string }) =>
    apiClient.post<Section>('/sections', data)

export const updateSection = (id: string, data: { name: string; description?: string }) => apiClient.put<Section>(`/sections/${id}`, data)

export const deleteSection = (id: string) => apiClient.delete<void>(`/sections/${id}`)

// Section-Entity relationships
export const getSectionEntities = (sectionId: string) => apiClient.get<Entity[]>(`/sections/${sectionId}/entities`)

export const assignEntityToSection = (entityId: string, sectionId: string) =>
    apiClient.put<void>(`/entities/${entityId}/section`, { sectionId })

export const removeEntityFromSection = (entityId: string) => apiClient.delete<void>(`/entities/${entityId}/section`)
