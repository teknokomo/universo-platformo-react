import { QueryClient } from '@tanstack/react-query'
import { PaginationParams } from '../types'

/**
 * Centralized query key factory for organizations
 * Following TanStack Query v5 best practices
 */
export const organizationsQueryKeys = {
    all: ['organizations'] as const,

    lists: () => [...organizationsQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...organizationsQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...organizationsQueryKeys.all, 'detail', id] as const,

    members: (id: string) => [...organizationsQueryKeys.detail(id), 'members'] as const,

    membersList: (id: string, params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'created',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...organizationsQueryKeys.members(id), 'list', normalized] as const
    }
}

/**
 * Centralized query key factory for departments
 * Following TanStack Query v5 best practices
 */
export const departmentsQueryKeys = {
    all: ['departments'] as const,

    lists: () => [...departmentsQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...departmentsQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...departmentsQueryKeys.all, 'detail', id] as const,

    positions: (id: string) => [...departmentsQueryKeys.detail(id), 'positions'] as const
}

/**
 * Centralized query key factory for positions
 * Following TanStack Query v5 best practices
 */
export const positionsQueryKeys = {
    all: ['positions'] as const,

    lists: () => [...positionsQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...positionsQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...positionsQueryKeys.all, 'detail', id] as const
}

/**
 * Helper functions for cache invalidation
 */
export const invalidateOrganizationsQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: organizationsQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: organizationsQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: organizationsQueryKeys.detail(id) })
}

export const invalidateDepartmentsQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: departmentsQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: departmentsQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: departmentsQueryKeys.detail(id) })
}

export const invalidatePositionsQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: positionsQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: positionsQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: positionsQueryKeys.detail(id) })
}
