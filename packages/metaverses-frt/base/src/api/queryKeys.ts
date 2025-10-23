import { QueryClient } from '@tanstack/react-query'
import { PaginationParams } from '../types'

/**
 * Centralized query key factory for metaverses
 * Following TanStack Query v5 best practices
 */
export const metaversesQueryKeys = {
    all: ['metaverses'] as const,

    lists: () => [...metaversesQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metaversesQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...metaversesQueryKeys.all, 'detail', id] as const,

    members: (id: string) => [...metaversesQueryKeys.detail(id), 'members'] as const
}

/**
 * Helper functions for cache invalidation
 */
export const invalidateMetaversesQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: metaversesQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: metaversesQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: metaversesQueryKeys.detail(id) })
}
