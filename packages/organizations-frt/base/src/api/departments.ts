import apiClient, { extractPaginationMeta } from './apiClient'
import { Department, Position, PaginationParams, PaginatedResponse } from '../types'

// Updated listDepartments with pagination support
export const listDepartments = async (params?: PaginationParams): Promise<PaginatedResponse<Department>> => {
    const response = await apiClient.get<Department[]>('/departments', {
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

export const getDepartment = (id: string) => apiClient.get<Department>(`/departments/${id}`)

export const createDepartment = (data: { name: string; description?: string; organizationId: string }) =>
    apiClient.post<Department>('/departments', data)

export const updateDepartment = (id: string, data: { name: string; description?: string }) =>
    apiClient.put<Department>(`/departments/${id}`, data)

export const deleteDepartment = (id: string) => apiClient.delete<void>(`/departments/${id}`)

// Department-Position relationships
export const getDepartmentPositions = (departmentId: string) => apiClient.get<Position[]>(`/departments/${departmentId}/positions`)

export const addPositionToDepartment = (departmentId: string, positionId: string) =>
    apiClient.post<void>(`/departments/${departmentId}/positions/${positionId}`)

export const assignPositionToDepartment = (positionId: string, departmentId: string) =>
    apiClient.put<void>(`/positions/${positionId}/department`, { departmentId })

export const removePositionFromDepartment = (positionId: string) => apiClient.delete<void>(`/positions/${positionId}/department`)
