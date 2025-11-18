import apiClient, { extractPaginationMeta } from './apiClient'
import { Domain, Resource, PaginationParams, PaginatedResponse } from '../types'

// Updated listDomains with pagination support
export const listDomains = async (params?: PaginationParams): Promise<PaginatedResponse<Domain>> => {
    const response = await apiClient.get<Domain[]>('/domains', {
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

export const getDomain = (id: string) => apiClient.get<Domain>(`/domains/${id}`)

export const createDomain = (data: { name: string; description?: string; clusterId: string }) => apiClient.post<Domain>('/domains', data)

export const updateDomain = (id: string, data: { name: string; description?: string }) => apiClient.put<Domain>(`/domains/${id}`, data)

export const deleteDomain = (id: string) => apiClient.delete<void>(`/domains/${id}`)

// Domain-Resource relationships
export const getDomainResources = (domainId: string) => apiClient.get<Resource[]>(`/domains/${domainId}/resources`)

export const addResourceToDomain = (domainId: string, resourceId: string) =>
    apiClient.post<void>(`/domains/${domainId}/resources/${resourceId}`)

export const assignResourceToDomain = (resourceId: string, domainId: string) =>
    apiClient.put<void>(`/resources/${resourceId}/domain`, { domainId })

export const removeResourceFromDomain = (resourceId: string) => apiClient.delete<void>(`/resources/${resourceId}/domain`)
