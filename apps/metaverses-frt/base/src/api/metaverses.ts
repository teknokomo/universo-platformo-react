import apiClient from './apiClient'
import { Metaverse, Section, Entity } from '../types'

export const listMetaverses = () => apiClient.get<Metaverse[]>('/metaverses')

export const getMetaverse = (id: string) => apiClient.get<Metaverse>(`/metaverses/${id}`)

export const createMetaverse = (data: { name: string; description?: string }) => apiClient.post<Metaverse>('/metaverses', data)

export const updateMetaverse = (id: string, data: { name: string; description?: string }) =>
    apiClient.put<Metaverse>(`/metaverses/${id}`, data)

export const deleteMetaverse = (id: string) => apiClient.delete<void>(`/metaverses/${id}`)

// Metaverse-Entity relationships
export const getMetaverseEntities = (metaverseId: string) => apiClient.get<Entity[]>(`/metaverses/${metaverseId}/entities`)

export const addEntityToMetaverse = (metaverseId: string, entityId: string) =>
    apiClient.post<void>(`/metaverses/${metaverseId}/entities/${entityId}`)

export const removeEntityFromMetaverse = (metaverseId: string, entityId: string) =>
    apiClient.delete<void>(`/metaverses/${metaverseId}/entities/${entityId}`)

export const reorderMetaverseEntities = (metaverseId: string, items: Array<{ entityId: string; sortOrder: number }>) =>
    apiClient.post<void>(`/metaverses/${metaverseId}/entities/reorder`, { items })

// Metaverse-Section relationships
export const getMetaverseSections = (metaverseId: string) => apiClient.get<Section[]>(`/metaverses/${metaverseId}/sections`)

export const addSectionToMetaverse = (metaverseId: string, sectionId: string) =>
    apiClient.post<void>(`/metaverses/${metaverseId}/sections/${sectionId}`)
