import apiClient, { extractPaginationMeta } from './apiClient'
import { Task, PaginationParams, PaginatedResponse } from '../types'

// Updated listTasks with pagination support
export const listTasks = async (params?: PaginationParams): Promise<PaginatedResponse<Task>> => {
    const response = await apiClient.get<Task[]>('/tasks', {
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

export const getTask = (taskId: string) => apiClient.get<Task>(`/tasks/${taskId}`)

export const createTask = (data: { name: string; description?: string; projectId?: string; milestoneId: string }) =>
    apiClient.post<Task>('/tasks', data)

export const updateTask = (taskId: string, data: { name: string; description?: string }) => apiClient.put<Task>(`/tasks/${taskId}`, data)

export const deleteTask = (taskId: string) => apiClient.delete<void>(`/tasks/${taskId}`)
