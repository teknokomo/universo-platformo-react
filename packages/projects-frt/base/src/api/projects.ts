import apiClient, { extractPaginationMeta } from './apiClient'
import { Project, Milestone, Task, ProjectMember, ProjectAssignableRole, PaginationParams, PaginatedResponse } from '../types'

// Updated listProjects with pagination support
export const listProjects = async (params?: PaginationParams): Promise<PaginatedResponse<Project>> => {
    const response = await apiClient.get<Project[]>('/projects', {
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

export const getProject = (id: string) => apiClient.get<Project>(`/projects/${id}`)

export const createProject = (data: { name: string; description?: string }) => apiClient.post<Project>('/projects', data)

export const updateProject = (id: string, data: { name: string; description?: string }) => apiClient.put<Project>(`/projects/${id}`, data)

export const deleteProject = (id: string) => apiClient.delete<void>(`/projects/${id}`)

// Project-Task relationships
export const getProjectTasks = (projectId: string) => apiClient.get<Task[]>(`/projects/${projectId}/tasks`)

export const addTaskToProject = (projectId: string, taskId: string) => apiClient.post<void>(`/projects/${projectId}/tasks/${taskId}`)

export const removeTaskFromProject = (projectId: string, taskId: string) => apiClient.delete<void>(`/projects/${projectId}/tasks/${taskId}`)

export const reorderProjectTasks = (projectId: string, items: Array<{ taskId: string; sortOrder: number }>) =>
    apiClient.post<void>(`/projects/${projectId}/tasks/reorder`, { items })

// Project-Milestone relationships
export const getProjectMilestones = (projectId: string) => apiClient.get<Milestone[]>(`/projects/${projectId}/milestones`)

export const addMilestoneToProject = (projectId: string, milestoneId: string) =>
    apiClient.post<void>(`/projects/${projectId}/milestones/${milestoneId}`)

// Updated listProjectMembers with pagination support (matches backend changes)
export const listProjectMembers = async (projectId: string, params?: PaginationParams): Promise<PaginatedResponse<ProjectMember>> => {
    const response = await apiClient.get<ProjectMember[]>(`/projects/${projectId}/members`, {
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

export const inviteProjectMember = (projectId: string, data: { email: string; role: ProjectAssignableRole; comment?: string }) =>
    apiClient.post<ProjectMember>(`/projects/${projectId}/members`, data)

export const updateProjectMemberRole = (projectId: string, memberId: string, data: { role: ProjectAssignableRole; comment?: string }) =>
    apiClient.patch<ProjectMember>(`/projects/${projectId}/members/${memberId}`, data)

export const removeProjectMember = (projectId: string, memberId: string) =>
    apiClient.delete<void>(`/projects/${projectId}/members/${memberId}`)
