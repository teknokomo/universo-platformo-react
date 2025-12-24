import { QueryClient } from '@tanstack/react-query'
import { PaginationParams } from '../types'

/**
 * Centralized query key factory for metahubs
 * Following TanStack Query v5 best practices
 */
export const metahubsQueryKeys = {
    all: ['metahubs'] as const,

    lists: () => [...metahubsQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...metahubsQueryKeys.all, 'detail', id] as const,

    members: (id: string) => [...metahubsQueryKeys.detail(id), 'members'] as const,

    membersList: (id: string, params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'created',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.members(id), 'list', normalized] as const
    },

    // MetaEntities scoped to a specific metahub
    meta_entities: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'meta_entities'] as const,

    meta_entitiesList: (metahubId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.meta_entities(metahubId), 'list', normalized] as const
    },

    // MetaSections scoped to a specific metahub
    meta_sections: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'meta_sections'] as const,

    meta_sectionsList: (metahubId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.meta_sections(metahubId), 'list', normalized] as const
    },

    // ============ NEW ARCHITECTURE QUERY KEYS ============

    // Hubs scoped to a specific metahub
    hubs: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'hubs'] as const,

    hubsList: (metahubId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.hubs(metahubId), 'list', normalized] as const
    },

    hubDetail: (metahubId: string, hubId: string) => [...metahubsQueryKeys.hubs(metahubId), 'detail', hubId] as const,

    // Attributes scoped to a specific hub
    attributes: (metahubId: string, hubId: string) => [...metahubsQueryKeys.hubDetail(metahubId, hubId), 'attributes'] as const,

    attributesList: (metahubId: string, hubId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.attributes(metahubId, hubId), 'list', normalized] as const
    },

    // Records scoped to a specific hub
    records: (metahubId: string, hubId: string) => [...metahubsQueryKeys.hubDetail(metahubId, hubId), 'records'] as const,

    recordsList: (metahubId: string, hubId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.records(metahubId, hubId), 'list', normalized] as const
    }
}

/**
 * Centralized query key factory for sections
 * Following TanStack Query v5 best practices
 */
export const meta_sectionsQueryKeys = {
    all: ['meta_sections'] as const,

    lists: () => [...meta_sectionsQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...meta_sectionsQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...meta_sectionsQueryKeys.all, 'detail', id] as const,

    meta_entities: (id: string) => [...meta_sectionsQueryKeys.detail(id), 'meta_entities'] as const
}

/**
 * Centralized query key factory for entities
 * Following TanStack Query v5 best practices
 */
export const meta_entitiesQueryKeys = {
    all: ['meta_entities'] as const,

    lists: () => [...meta_entitiesQueryKeys.all, 'list'] as const,

    list: (params?: PaginationParams) => {
        // Normalize params to ensure consistent cache keys
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...meta_entitiesQueryKeys.lists(), normalized] as const
    },

    detail: (id: string) => [...meta_entitiesQueryKeys.all, 'detail', id] as const
}

/**
 * Helper functions for cache invalidation
 */
export const invalidateMetahubsQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(id) })
}

export const invalidateMetaSectionsQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: meta_sectionsQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: meta_sectionsQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: meta_sectionsQueryKeys.detail(id) })
}

export const invalidateMetaEntitiesQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: meta_entitiesQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: meta_entitiesQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: meta_entitiesQueryKeys.detail(id) })
}

// Backwards-compatible helper used by MetahubMembers page
export const invalidateMetahubMembers = (queryClient: QueryClient, metahubId: string) =>
    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.members(metahubId) })

// ============ NEW ARCHITECTURE CACHE INVALIDATION HELPERS ============

export const invalidateHubsQueries = {
    all: (queryClient: QueryClient, metahubId: string) => queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(metahubId) }),

    lists: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubsList(metahubId, {}) }),

    detail: (queryClient: QueryClient, metahubId: string, hubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubDetail(metahubId, hubId) })
}

export const invalidateAttributesQueries = {
    all: (queryClient: QueryClient, metahubId: string, hubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributes(metahubId, hubId) }),

    lists: (queryClient: QueryClient, metahubId: string, hubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesList(metahubId, hubId, {}) })
}

export const invalidateRecordsQueries = {
    all: (queryClient: QueryClient, metahubId: string, hubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.records(metahubId, hubId) }),

    lists: (queryClient: QueryClient, metahubId: string, hubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.recordsList(metahubId, hubId, {}) })
}
