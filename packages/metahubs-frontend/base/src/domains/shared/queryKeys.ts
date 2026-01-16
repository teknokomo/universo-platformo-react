import { QueryClient } from '@tanstack/react-query'
import { PaginationParams } from '../../types'

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

    // Blocking catalogs for hub deletion (catalogs with isRequiredHub=true that would become orphaned)
    blockingCatalogs: (metahubId: string, hubId: string) => [...metahubsQueryKeys.hubDetail(metahubId, hubId), 'blockingCatalogs'] as const,

    // Catalogs scoped to a specific hub
    catalogs: (metahubId: string, hubId: string) => [...metahubsQueryKeys.hubDetail(metahubId, hubId), 'catalogs'] as const,

    catalogsList: (metahubId: string, hubId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.catalogs(metahubId, hubId), 'list', normalized] as const
    },

    // All catalogs across all hubs in a metahub
    allCatalogs: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'allCatalogs'] as const,

    allCatalogsList: (metahubId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.allCatalogs(metahubId), 'list', normalized] as const
    },

    // Catalog detail without hub context (catalog-centric navigation)
    catalogDetail: (metahubId: string, catalogId: string) => [...metahubsQueryKeys.allCatalogs(metahubId), 'detail', catalogId] as const,

    // Catalog detail scoped to a specific hub
    catalogDetailInHub: (metahubId: string, hubId: string, catalogId: string) =>
        [...metahubsQueryKeys.catalogs(metahubId, hubId), 'detail', catalogId] as const,

    // Attributes scoped to a specific catalog
    attributes: (metahubId: string, hubId: string, catalogId: string) =>
        [...metahubsQueryKeys.catalogDetailInHub(metahubId, hubId, catalogId), 'attributes'] as const,

    attributesList: (metahubId: string, hubId: string, catalogId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.attributes(metahubId, hubId, catalogId), 'list', normalized] as const
    },

    // Attributes scoped directly to catalog (without hub context)
    attributesDirect: (metahubId: string, catalogId: string) =>
        [...metahubsQueryKeys.catalogDetail(metahubId, catalogId), 'attributes'] as const,

    attributesListDirect: (metahubId: string, catalogId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.attributesDirect(metahubId, catalogId), 'list', normalized] as const
    },

    // Records scoped to a specific catalog
    records: (metahubId: string, hubId: string, catalogId: string) =>
        [...metahubsQueryKeys.catalogDetailInHub(metahubId, hubId, catalogId), 'records'] as const,

    recordsList: (metahubId: string, hubId: string, catalogId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.records(metahubId, hubId, catalogId), 'list', normalized] as const
    },

    // Records scoped directly to catalog (without hub context)
    recordsDirect: (metahubId: string, catalogId: string) =>
        [...metahubsQueryKeys.catalogDetail(metahubId, catalogId), 'records'] as const,

    recordsListDirect: (metahubId: string, catalogId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.recordsDirect(metahubId, catalogId), 'list', normalized] as const
    },

    // ============ PUBLICATIONS (INFORMATION BASES) QUERY KEYS ============

    // Publications scoped to a specific metahub
    publications: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'publications'] as const,

    publicationsList: (metahubId: string) => [...metahubsQueryKeys.publications(metahubId), 'list'] as const,

    publicationDetail: (metahubId: string, publicationId: string) =>
        [...metahubsQueryKeys.publications(metahubId), 'detail', publicationId] as const,

    publicationDiff: (metahubId: string, publicationId: string) =>
        [...metahubsQueryKeys.publicationDetail(metahubId, publicationId), 'diff'] as const
}

/**
 * Helper functions for cache invalidation
 */
export const invalidateMetahubsQueries = {
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.all }),

    lists: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.lists() }),

    detail: (queryClient: QueryClient, id: string) => queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(id) })
}

// Backwards-compatible helper used by MetahubMembers page
export const invalidateMetahubMembers = (queryClient: QueryClient, metahubId: string) =>
    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.members(metahubId) })

// ============ NEW ARCHITECTURE CACHE INVALIDATION HELPERS ============

export const invalidateHubsQueries = {
    all: (queryClient: QueryClient, metahubId: string) => queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(metahubId) }),

    lists: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubsList(metahubId) }),

    detail: (queryClient: QueryClient, metahubId: string, hubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubDetail(metahubId, hubId) })
}

export const invalidateCatalogsQueries = {
    all: (queryClient: QueryClient, metahubId: string, hubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(metahubId, hubId) }),

    lists: (queryClient: QueryClient, metahubId: string, hubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogsList(metahubId, hubId) }),

    detail: (queryClient: QueryClient, metahubId: string, hubId: string, catalogId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetailInHub(metahubId, hubId, catalogId) })
}

export const invalidateAttributesQueries = {
    all: (queryClient: QueryClient, metahubId: string, hubId: string, catalogId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributes(metahubId, hubId, catalogId) }),

    lists: (queryClient: QueryClient, metahubId: string, hubId: string, catalogId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesList(metahubId, hubId, catalogId) })
}

export const invalidateRecordsQueries = {
    all: (queryClient: QueryClient, metahubId: string, hubId: string, catalogId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.records(metahubId, hubId, catalogId) }),

    lists: (queryClient: QueryClient, metahubId: string, hubId: string, catalogId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.recordsList(metahubId, hubId, catalogId) })
}

export const invalidatePublicationsQueries = {
    all: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.publications(metahubId) }),

    lists: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.publicationsList(metahubId) }),

    detail: (queryClient: QueryClient, metahubId: string, publicationId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.publicationDetail(metahubId, publicationId) })
}
