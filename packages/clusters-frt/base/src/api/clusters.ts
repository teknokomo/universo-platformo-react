import apiClient, { extractPaginationMeta } from './apiClient'
import { Cluster, Domain, Resource, ClusterMember, ClusterAssignableRole, PaginationParams, PaginatedResponse } from '../types'

// Updated listClusters with pagination support
export const listClusters = async (params?: PaginationParams): Promise<PaginatedResponse<Cluster>> => {
    const response = await apiClient.get<Cluster[]>('/clusters', {
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

export const getCluster = (id: string) => apiClient.get<Cluster>(`/clusters/${id}`)

export const createCluster = (data: { name: string; description?: string }) => apiClient.post<Cluster>('/clusters', data)

export const updateCluster = (id: string, data: { name: string; description?: string }) =>
    apiClient.put<Cluster>(`/clusters/${id}`, data)

export const deleteCluster = (id: string) => apiClient.delete<void>(`/clusters/${id}`)

// Cluster-Resource relationships
export const getClusterResources = (clusterId: string) => apiClient.get<Resource[]>(`/clusters/${clusterId}/resources`)

export const addResourceToCluster = (clusterId: string, resourceId: string) =>
    apiClient.post<void>(`/clusters/${clusterId}/resources/${resourceId}`)

export const removeResourceFromCluster = (clusterId: string, resourceId: string) =>
    apiClient.delete<void>(`/clusters/${clusterId}/resources/${resourceId}`)

export const reorderClusterResources = (clusterId: string, items: Array<{ resourceId: string; sortOrder: number }>) =>
    apiClient.post<void>(`/clusters/${clusterId}/resources/reorder`, { items })

// Cluster-Domain relationships
export const getClusterDomains = (clusterId: string) => apiClient.get<Domain[]>(`/clusters/${clusterId}/domains`)

export const addDomainToCluster = (clusterId: string, domainId: string) =>
    apiClient.post<void>(`/clusters/${clusterId}/domains/${domainId}`)

// Updated listClusterMembers with pagination support (matches backend changes)
export const listClusterMembers = async (clusterId: string, params?: PaginationParams): Promise<PaginatedResponse<ClusterMember>> => {
    const response = await apiClient.get<ClusterMember[]>(`/clusters/${clusterId}/members`, {
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

export const inviteClusterMember = (clusterId: string, data: { email: string; role: ClusterAssignableRole; comment?: string }) =>
    apiClient.post<ClusterMember>(`/clusters/${clusterId}/members`, data)

export const updateClusterMemberRole = (
    clusterId: string,
    memberId: string,
    data: { role: ClusterAssignableRole; comment?: string }
) => apiClient.patch<ClusterMember>(`/clusters/${clusterId}/members/${memberId}`, data)

export const removeClusterMember = (clusterId: string, memberId: string) =>
    apiClient.delete<void>(`/clusters/${clusterId}/members/${memberId}`)
