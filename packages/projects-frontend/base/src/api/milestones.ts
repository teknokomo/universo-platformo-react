import apiClient, { extractPaginationMeta } from './apiClient'
import { Milestone, Task, PaginationParams, PaginatedResponse } from '../types'

// Updated listMilestones with pagination support
export const listMilestones = async (params?: PaginationParams): Promise<PaginatedResponse<Milestone>> => {
    const response = await apiClient.get<Milestone[]>('/milestones', {
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

export const getMilestone = (id: string) => apiClient.get<Milestone>(`/milestones/${id}`)

export const createMilestone = (data: { name: string; description?: string; projectId: string }) =>
    apiClient.post<Milestone>('/milestones', data)

export const updateMilestone = (id: string, data: { name: string; description?: string }) =>
    apiClient.put<Milestone>(`/milestones/${id}`, data)

export const deleteMilestone = (id: string) => apiClient.delete<void>(`/milestones/${id}`)

// Milestone-Task relationships
export const getMilestoneTasks = (milestoneId: string) => apiClient.get<Task[]>(`/milestones/${milestoneId}/tasks`)

export const addTaskToMilestone = (milestoneId: string, taskId: string) =>
    apiClient.post<void>(`/milestones/${milestoneId}/tasks/${taskId}`)

export const assignTaskToMilestone = (taskId: string, milestoneId: string) =>
    apiClient.put<void>(`/tasks/${taskId}/milestone`, { milestoneId })

export const removeTaskFromMilestone = (taskId: string) => apiClient.delete<void>(`/tasks/${taskId}/milestone`)
