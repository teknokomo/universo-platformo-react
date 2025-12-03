import apiClient, { extractPaginationMeta } from './apiClient'
import { Container, Slot, PaginationParams, PaginatedResponse } from '../types'

// Updated listContainers with pagination support
export const listContainers = async (params?: PaginationParams): Promise<PaginatedResponse<Container>> => {
    const response = await apiClient.get<Container[]>('/containers', {
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

export const getContainer = (id: string) => apiClient.get<Container>(`/containers/${id}`)

export const createContainer = (data: { name: string; description?: string; storageId: string }) =>
    apiClient.post<Container>('/containers', data)

export const updateContainer = (id: string, data: { name: string; description?: string }) =>
    apiClient.put<Container>(`/containers/${id}`, data)

export const deleteContainer = (id: string) => apiClient.delete<void>(`/containers/${id}`)

// Container-Slot relationships
export const getContainerSlots = (containerId: string) => apiClient.get<Slot[]>(`/containers/${containerId}/slots`)

export const addSlotToContainer = (containerId: string, slotId: string) =>
    apiClient.post<void>(`/containers/${containerId}/slots/${slotId}`)

export const assignSlotToContainer = (slotId: string, containerId: string) =>
    apiClient.put<void>(`/slots/${slotId}/container`, { containerId })

export const removeSlotFromContainer = (slotId: string) => apiClient.delete<void>(`/slots/${slotId}/container`)
