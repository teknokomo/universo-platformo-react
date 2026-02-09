import { QueryClient } from '@tanstack/react-query'
import { PaginationParams } from '../types'

/**
 * Centralized query key factory for applications
 * Following TanStack Query v5 best practices
 */
export const applicationsQueryKeys = {
    all: ['applications'] as const,

    lists: () => [...applicationsQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...applicationsQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...applicationsQueryKeys.all, 'detail', id] as const,

    members: (id: string) => [...applicationsQueryKeys.detail(id), 'members'] as const,

    membersList: (id: string, params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'created',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...applicationsQueryKeys.members(id), 'list', normalized] as const
    },

    // Connectors scoped to a specific application
    connectors: (applicationId: string) => [...applicationsQueryKeys.detail(applicationId), 'connectors'] as const,

    connectorsList: (applicationId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'sortOrder',
            sortOrder: params?.sortOrder ?? 'asc',
            search: params?.search?.trim() || undefined
        }
        return [...applicationsQueryKeys.connectors(applicationId), 'list', normalized] as const
    },

    connectorDetail: (applicationId: string, connectorId: string) =>
        [...applicationsQueryKeys.connectors(applicationId), 'detail', connectorId] as const,

    // Application schema diff (for sync dialog)
    applicationDiff: (applicationId: string) =>
        [...applicationsQueryKeys.detail(applicationId), 'diff'] as const,

    // @deprecated Use applicationDiff instead
    connectorDiff: (applicationId: string, connectorId: string) =>
        [...applicationsQueryKeys.connectorDetail(applicationId, connectorId), 'diff'] as const,

    // Migrations scoped to a specific application
    migrations: (applicationId: string) => [...applicationsQueryKeys.detail(applicationId), 'migrations'] as const,

    migrationsList: (applicationId: string, params?: { limit?: number; offset?: number }) => {
        const normalized = {
            limit: params?.limit ?? 50,
            offset: params?.offset ?? 0
        }
        return [...applicationsQueryKeys.migrations(applicationId), 'list', normalized] as const
    },

    migrationDetail: (applicationId: string, migrationId: string) =>
        [...applicationsQueryKeys.migrations(applicationId), 'detail', migrationId] as const,

    migrationAnalysis: (applicationId: string, migrationId: string) =>
        [...applicationsQueryKeys.migrations(applicationId), 'analysis', migrationId] as const,

    runtimeTable: (applicationId: string, params?: { limit?: number; offset?: number; locale?: string; catalogId?: string }) => {
        const normalized = {
            limit: params?.limit ?? 50,
            offset: params?.offset ?? 0,
            locale: params?.locale ?? 'en',
            catalogId: params?.catalogId ?? 'default'
        }
        return [...applicationsQueryKeys.detail(applicationId), 'runtime', normalized] as const
    }
}

/**
 * Helper functions for cache invalidation
 */
export const invalidateApplicationsQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.detail(id) })
}

// Backwards-compatible helper used by ApplicationMembers page
export const invalidateApplicationMembers = (queryClient: QueryClient, applicationId: string) =>
    queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.members(applicationId) })

export const invalidateConnectorsQueries = {
    all: (queryClient: QueryClient, applicationId: string) =>
        queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.connectors(applicationId) }),

    lists: (queryClient: QueryClient, applicationId: string) =>
        queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.connectorsList(applicationId) }),

    detail: (queryClient: QueryClient, applicationId: string, connectorId: string) =>
        queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.connectorDetail(applicationId, connectorId) })
}

export const invalidateMigrationsQueries = {
    all: (queryClient: QueryClient, applicationId: string) =>
        queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.migrations(applicationId) }),

    lists: (queryClient: QueryClient, applicationId: string) =>
        queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.migrationsList(applicationId) }),

    detail: (queryClient: QueryClient, applicationId: string, migrationId: string) =>
        queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.migrationDetail(applicationId, migrationId) })
}
