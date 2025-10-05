import apiClient from './apiClient'
import { Domain, Resource } from '../types'

export const listDomains = () => apiClient.get<Domain[]>('/domains')

export const getDomain = (id: string) => apiClient.get<Domain>(`/domains/${id}`)

export const createDomain = (data: { name: string; description?: string; clusterId: string }) => apiClient.post<Domain>('/domains', data)

export const updateDomain = (id: string, data: { name: string; description?: string }) => apiClient.put<Domain>(`/domains/${id}`, data)

export const deleteDomain = (id: string) => apiClient.delete<void>(`/domains/${id}`)

// Domain-Resource relationships
export const getDomainResources = (domainId: string) => apiClient.get<Resource[]>(`/domains/${domainId}/resources`)

export const assignResourceToDomain = (resourceId: string, domainId: string) =>
    apiClient.put<void>(`/resources/${resourceId}/domain`, { domainId })

export const removeResourceFromDomain = (resourceId: string) => apiClient.delete<void>(`/resources/${resourceId}/domain`)
