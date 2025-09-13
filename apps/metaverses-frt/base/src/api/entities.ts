import apiClient from './apiClient'
import { Entity } from '../types'

export const listEntities = () => apiClient.get<Entity[]>('/entities')

export const getEntity = (entityId: string) => apiClient.get<Entity>(`/entities/${entityId}`)

export const createEntity = (data: { name: string; description?: string; metaverseId?: string; sectionId: string }) =>
    apiClient.post<Entity>('/entities', data)

export const updateEntity = (entityId: string, data: { name: string; description?: string }) =>
    apiClient.put<Entity>(`/entities/${entityId}`, data)

export const deleteEntity = (entityId: string) => apiClient.delete<void>(`/entities/${entityId}`)
