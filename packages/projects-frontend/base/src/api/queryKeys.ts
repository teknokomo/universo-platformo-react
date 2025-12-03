import { QueryClient } from '@tanstack/react-query'
import { PaginationParams } from '../types'

/**
 * Centralized query key factory for Projects
 * Following TanStack Query v5 best practices
 */
export const ProjectsQueryKeys = {
    all: ['projects'] as const,

    lists: () => [...ProjectsQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...ProjectsQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...ProjectsQueryKeys.all, 'detail', id] as const,

    members: (id: string) => [...ProjectsQueryKeys.detail(id), 'members'] as const,

    membersList: (id: string, params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'created',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...ProjectsQueryKeys.members(id), 'list', normalized] as const
    }
}

/**
 * Centralized query key factory for Milestones
 * Following TanStack Query v5 best practices
 */
export const MilestonesQueryKeys = {
    all: ['milestones'] as const,

    lists: () => [...MilestonesQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...MilestonesQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...MilestonesQueryKeys.all, 'detail', id] as const,

    Tasks: (id: string) => [...MilestonesQueryKeys.detail(id), 'Tasks'] as const
}

/**
 * Centralized query key factory for Tasks
 * Following TanStack Query v5 best practices
 */
export const TasksQueryKeys = {
    all: ['tasks'] as const,

    lists: () => [...TasksQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...TasksQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...TasksQueryKeys.all, 'detail', id] as const
}

/**
 * Helper functions for cache invalidation
 */
export const invalidateProjectsQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: ProjectsQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: ProjectsQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: ProjectsQueryKeys.detail(id) })
}

export const invalidateMilestonesQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: MilestonesQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: MilestonesQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: MilestonesQueryKeys.detail(id) })
}

export const invalidateTasksQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: TasksQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: TasksQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: TasksQueryKeys.detail(id) })
}
