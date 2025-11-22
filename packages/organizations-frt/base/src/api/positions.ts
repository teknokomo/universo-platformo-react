import apiClient, { extractPaginationMeta } from './apiClient'
import { Position, PaginationParams, PaginatedResponse } from '../types'

// Updated listPositions with pagination support
export const listPositions = async (params?: PaginationParams): Promise<PaginatedResponse<Position>> => {
    const response = await apiClient.get<Position[]>('/positions', {
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

export const getPosition = (positionId: string) => apiClient.get<Position>(`/positions/${positionId}`)

export const createPosition = (data: { name: string; description?: string; organizationId?: string; departmentId: string }) =>
    apiClient.post<Position>('/positions', data)

export const updatePosition = (positionId: string, data: { name: string; description?: string }) =>
    apiClient.put<Position>(`/positions/${positionId}`, data)

export const deletePosition = (positionId: string) => apiClient.delete<void>(`/positions/${positionId}`)
