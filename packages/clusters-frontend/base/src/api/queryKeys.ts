import { QueryClient } from '@tanstack/react-query'
import { PaginationParams } from '../types'

/**
 * Centralized query key factory for clusters
 * Following TanStack Query v5 best practices
 */
export const clustersQueryKeys = {
    all: ['clusters'] as const,

    lists: () => [...clustersQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...clustersQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...clustersQueryKeys.all, 'detail', id] as const,

    members: (id: string) => [...clustersQueryKeys.detail(id), 'members'] as const,

    membersList: (id: string, params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'created',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...clustersQueryKeys.members(id), 'list', normalized] as const
    }
}

/**
 * Centralized query key factory for domains
 * Following TanStack Query v5 best practices
 */
export const domainsQueryKeys = {
    all: ['domains'] as const,

    lists: () => [...domainsQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...domainsQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...domainsQueryKeys.all, 'detail', id] as const,

    resources: (id: string) => [...domainsQueryKeys.detail(id), 'resources'] as const
}

/**
 * Centralized query key factory for resources
 * Following TanStack Query v5 best practices
 */
export const resourcesQueryKeys = {
    all: ['resources'] as const,

    lists: () => [...resourcesQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...resourcesQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...resourcesQueryKeys.all, 'detail', id] as const
}

/**
 * Helper functions for cache invalidation
 */
export const invalidateClustersQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: clustersQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: clustersQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: clustersQueryKeys.detail(id) })
}

export const invalidateDomainsQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: domainsQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: domainsQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: domainsQueryKeys.detail(id) })
}

export const invalidateResourcesQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.detail(id) })
}
