import apiClient from './apiClient'
import { Cluster, Domain, Resource } from '../types'

export const listClusters = () => apiClient.get<Cluster[]>('/clusters')

export const getCluster = (id: string) => apiClient.get<Cluster>(`/clusters/${id}`)

export const createCluster = (data: { name: string; description?: string }) =>
    apiClient.post<Cluster>('/clusters', data)

export const updateCluster = (id: string, data: { name: string; description?: string }) =>
    apiClient.put<Cluster>(`/clusters/${id}`, data)

export const deleteCluster = (id: string) => apiClient.delete<void>(`/clusters/${id}`)

// Cluster-Resource relationships
export const getClusterResources = (clusterId: string) =>
    apiClient.get<Resource[]>(`/clusters/${clusterId}/resources`)

export const addResourceToCluster = (clusterId: string, resourceId: string) =>
    apiClient.post<void>(`/clusters/${clusterId}/resources/${resourceId}`)

export const removeResourceFromCluster = (clusterId: string, resourceId: string) =>
    apiClient.delete<void>(`/clusters/${clusterId}/resources/${resourceId}`)

export const reorderClusterResources = (clusterId: string, items: Array<{ resourceId: string; sortOrder: number }>) =>
    apiClient.post<void>(`/clusters/${clusterId}/resources/reorder`, { items })

// Cluster-Domain relationships
export const getClusterDomains = (clusterId: string) =>
    apiClient.get<Domain[]>(`/clusters/${clusterId}/domains`)

export const addDomainToCluster = (clusterId: string, domainId: string) =>
    apiClient.post<void>(`/clusters/${clusterId}/domains/${domainId}`)
