import apiClient, { extractPaginationMeta } from './apiClient'
import { Slot, PaginationParams, PaginatedResponse } from '../types'

// Updated listSlots with pagination support
export const listSlots = async (params?: PaginationParams): Promise<PaginatedResponse<Slot>> => {
    const response = await apiClient.get<Slot[]>('/slots', {
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

export const getSlot = (slotId: string) => apiClient.get<Slot>(`/slots/${slotId}`)

export const createSlot = (data: { name: string; description?: string; storageId?: string; containerId: string }) =>
    apiClient.post<Slot>('/slots', data)

export const updateSlot = (slotId: string, data: { name: string; description?: string }) => apiClient.put<Slot>(`/slots/${slotId}`, data)

export const deleteSlot = (slotId: string) => apiClient.delete<void>(`/slots/${slotId}`)
