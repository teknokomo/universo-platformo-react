import apiClient from './apiClient'
import { Resource } from '../types'

export const listResources = () => apiClient.get<Resource[]>('/resources')

export const getResource = (resourceId: string) => apiClient.get<Resource>(`/resources/${resourceId}`)

export const createResource = (data: { name: string; description?: string; clusterId?: string; domainId: string }) =>
    apiClient.post<Resource>('/resources', data)

export const updateResource = (resourceId: string, data: { name: string; description?: string }) =>
    apiClient.put<Resource>(`/resources/${resourceId}`, data)

export const deleteResource = (resourceId: string) => apiClient.delete<void>(`/resources/${resourceId}`)
