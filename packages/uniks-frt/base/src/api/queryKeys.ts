import { QueryClient } from '@tanstack/react-query'
import { PaginationParams } from '../types'

/**
 * Centralized query key factory for uniks
 * Following TanStack Query v5 best practices
 */
export const uniksQueryKeys = {
    all: ['uniks'] as const,

    lists: () => [...uniksQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...uniksQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...uniksQueryKeys.all, 'detail', id] as const,

    members: (id: string) => [...uniksQueryKeys.detail(id), 'members'] as const,

    membersList: (id: string, params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'created',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...uniksQueryKeys.members(id), 'list', normalized] as const
    }
}

/**
 * Centralized query key factory for sections
 * Following TanStack Query v5 best practices
 */
export const sectionsQueryKeys = {
    all: ['sections'] as const,

    lists: () => [...sectionsQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...sectionsQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...sectionsQueryKeys.all, 'detail', id] as const,

    entities: (id: string) => [...sectionsQueryKeys.detail(id), 'entities'] as const
}

/**
 * Centralized query key factory for entities
 * Following TanStack Query v5 best practices
 */
export const entitiesQueryKeys = {
    all: ['entities'] as const,

    lists: () => [...entitiesQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...entitiesQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...entitiesQueryKeys.all, 'detail', id] as const
}

/**
 * Helper functions for cache invalidation
 */
export const invalidateUniksQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: uniksQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: uniksQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: uniksQueryKeys.detail(id) })
}

export const invalidateSectionsQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: sectionsQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: sectionsQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: sectionsQueryKeys.detail(id) })
}

export const invalidateEntitiesQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: entitiesQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: entitiesQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: entitiesQueryKeys.detail(id) })
}
