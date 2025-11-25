import { QueryClient } from '@tanstack/react-query'
import { PaginationParams } from '../types'

/**
 * Centralized query key factory for campaigns
 * Following TanStack Query v5 best practices
 */
export const campaignsQueryKeys = {
    all: ['campaigns'] as const,

    lists: () => [...campaignsQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...campaignsQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...campaignsQueryKeys.all, 'detail', id] as const,

    members: (id: string) => [...campaignsQueryKeys.detail(id), 'members'] as const,

    membersList: (id: string, params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'created',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...campaignsQueryKeys.members(id), 'list', normalized] as const
    }
}

/**
 * Centralized query key factory for events
 * Following TanStack Query v5 best practices
 */
export const eventsQueryKeys = {
    all: ['events'] as const,

    lists: () => [...eventsQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...eventsQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...eventsQueryKeys.all, 'detail', id] as const,

    activities: (id: string) => [...eventsQueryKeys.detail(id), 'activities'] as const
}

/**
 * Centralized query key factory for activities
 * Following TanStack Query v5 best practices
 */
export const activitiesQueryKeys = {
    all: ['activities'] as const,

    lists: () => [...activitiesQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...activitiesQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...activitiesQueryKeys.all, 'detail', id] as const
}

/**
 * Helper functions for cache invalidation
 */
export const invalidateCampaignsQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: campaignsQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: campaignsQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: campaignsQueryKeys.detail(id) })
}

export const invalidateEventsQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: eventsQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: eventsQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: eventsQueryKeys.detail(id) })
}

export const invalidateActivitiesQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: activitiesQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: activitiesQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: activitiesQueryKeys.detail(id) })
}
