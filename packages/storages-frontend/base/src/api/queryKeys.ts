import { QueryClient } from '@tanstack/react-query'
import { PaginationParams } from '../types'

/**
 * Centralized query key factory for storages
 * Following TanStack Query v5 best practices
 */
export const storagesQueryKeys = {
    all: ['storages'] as const,

    lists: () => [...storagesQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...storagesQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...storagesQueryKeys.all, 'detail', id] as const,

    members: (id: string) => [...storagesQueryKeys.detail(id), 'members'] as const,

    membersList: (id: string, params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'created',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...storagesQueryKeys.members(id), 'list', normalized] as const
    }
}

/**
 * Centralized query key factory for containers
 * Following TanStack Query v5 best practices
 */
export const containersQueryKeys = {
    all: ['containers'] as const,

    lists: () => [...containersQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...containersQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...containersQueryKeys.all, 'detail', id] as const,

    slots: (id: string) => [...containersQueryKeys.detail(id), 'slots'] as const
}

/**
 * Centralized query key factory for slots
 * Following TanStack Query v5 best practices
 */
export const slotsQueryKeys = {
    all: ['slots'] as const,

    lists: () => [...slotsQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...slotsQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...slotsQueryKeys.all, 'detail', id] as const
}

/**
 * Helper functions for cache invalidation
 */
export const invalidateStoragesQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: storagesQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: storagesQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: storagesQueryKeys.detail(id) })
}

export const invalidateContainersQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: containersQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: containersQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: containersQueryKeys.detail(id) })
}

export const invalidateSlotsQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: slotsQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: slotsQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: slotsQueryKeys.detail(id) })
}
