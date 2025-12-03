import apiClient, { extractPaginationMeta } from './apiClient'
import { Storage, Container, Slot, StorageMember, StorageAssignableRole, PaginationParams, PaginatedResponse } from '../types'

// Updated listStorages with pagination support
export const listStorages = async (params?: PaginationParams): Promise<PaginatedResponse<Storage>> => {
    const response = await apiClient.get<Storage[]>('/storages', {
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

export const getStorage = (id: string) => apiClient.get<Storage>(`/storages/${id}`)

export const createStorage = (data: { name: string; description?: string }) => apiClient.post<Storage>('/storages', data)

export const updateStorage = (id: string, data: { name: string; description?: string }) => apiClient.put<Storage>(`/storages/${id}`, data)

export const deleteStorage = (id: string) => apiClient.delete<void>(`/storages/${id}`)

// Storage-Slot relationships
export const getStorageSlots = (storageId: string) => apiClient.get<Slot[]>(`/storages/${storageId}/slots`)

export const addSlotToStorage = (storageId: string, slotId: string) => apiClient.post<void>(`/storages/${storageId}/slots/${slotId}`)

export const removeSlotFromStorage = (storageId: string, slotId: string) => apiClient.delete<void>(`/storages/${storageId}/slots/${slotId}`)

export const reorderStorageSlots = (storageId: string, items: Array<{ slotId: string; sortOrder: number }>) =>
    apiClient.post<void>(`/storages/${storageId}/slots/reorder`, { items })

// Storage-Container relationships
export const getStorageContainers = (storageId: string) => apiClient.get<Container[]>(`/storages/${storageId}/containers`)

export const addContainerToStorage = (storageId: string, containerId: string) =>
    apiClient.post<void>(`/storages/${storageId}/containers/${containerId}`)

// Updated listStorageMembers with pagination support (matches backend changes)
export const listStorageMembers = async (storageId: string, params?: PaginationParams): Promise<PaginatedResponse<StorageMember>> => {
    const response = await apiClient.get<StorageMember[]>(`/storages/${storageId}/members`, {
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

export const inviteStorageMember = (storageId: string, data: { email: string; role: StorageAssignableRole; comment?: string }) =>
    apiClient.post<StorageMember>(`/storages/${storageId}/members`, data)

export const updateStorageMemberRole = (storageId: string, memberId: string, data: { role: StorageAssignableRole; comment?: string }) =>
    apiClient.patch<StorageMember>(`/storages/${storageId}/members/${memberId}`, data)

export const removeStorageMember = (storageId: string, memberId: string) =>
    apiClient.delete<void>(`/storages/${storageId}/members/${memberId}`)
