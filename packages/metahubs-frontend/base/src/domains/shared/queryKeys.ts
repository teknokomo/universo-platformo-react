import { QueryClient } from '@tanstack/react-query'
import { PaginationParams } from '../../types'

/**
 * Centralized query key factory for metahubs
 * Following TanStack Query v5 best practices
 */
export const metahubsQueryKeys = {
    all: ['metahubs'] as const,

    // ============ TEMPLATES ============
    templates: () => [...metahubsQueryKeys.all, 'templates'] as const,
    templatesList: () => [...metahubsQueryKeys.templates(), 'list'] as const,
    templateDetail: (templateId: string) => [...metahubsQueryKeys.templates(), 'detail', templateId] as const,

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

    // Branches scoped to a specific metahub
    branches: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'branches'] as const,

    branchesList: (metahubId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.branches(metahubId), 'list', normalized] as const
    },

    branchDetail: (metahubId: string, branchId: string) => [...metahubsQueryKeys.branches(metahubId), 'detail', branchId] as const,

    blockingBranchUsers: (metahubId: string, branchId: string) =>
        [...metahubsQueryKeys.branchDetail(metahubId, branchId), 'blockingUsers'] as const,

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

    // Layouts scoped to a specific metahub
    layouts: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'layouts'] as const,

    layoutsList: (metahubId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.layouts(metahubId), 'list', normalized] as const
    },

    layoutDetail: (metahubId: string, layoutId: string) => [...metahubsQueryKeys.layouts(metahubId), 'detail', layoutId] as const,
    layoutZoneWidgets: (metahubId: string, layoutId: string) =>
        [...metahubsQueryKeys.layoutDetail(metahubId, layoutId), 'zoneWidgets'] as const,
    layoutZoneWidgetsCatalog: (metahubId: string, layoutId: string) =>
        [...metahubsQueryKeys.layoutDetail(metahubId, layoutId), 'zoneWidgetsCatalog'] as const,

    // Migrations scoped to a specific metahub
    migrations: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'migrations'] as const,

    migrationsList: (metahubId: string, params?: PaginationParams & { branchId?: string }) => {
        const normalized = {
            limit: params?.limit ?? 50,
            offset: params?.offset ?? 0,
            branchId: params?.branchId ?? undefined
        }
        return [...metahubsQueryKeys.migrations(metahubId), 'list', normalized] as const
    },

    migrationsPlan: (metahubId: string, branchId?: string, cleanupMode: 'keep' | 'dry_run' | 'confirm' = 'keep') =>
        [...metahubsQueryKeys.migrations(metahubId), 'plan', branchId ?? 'default', cleanupMode] as const,

    migrationsStatus: (metahubId: string, branchId?: string, cleanupMode: 'keep' | 'dry_run' | 'confirm' = 'keep') =>
        [...metahubsQueryKeys.migrations(metahubId), 'status', branchId ?? 'default', cleanupMode] as const,

    // Blocking catalogs for hub deletion (catalogs with isRequiredHub=true that would become orphaned)
    blockingCatalogs: (metahubId: string, hubId: string) => [...metahubsQueryKeys.hubDetail(metahubId, hubId), 'blockingCatalogs'] as const,

    // Blocking references for catalog deletion (REF attributes in other catalogs)
    blockingCatalogReferences: (metahubId: string, catalogId: string) =>
        [...metahubsQueryKeys.catalogDetail(metahubId, catalogId), 'blockingReferences'] as const,

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

    // Enumerations scoped to a specific hub
    enumerations: (metahubId: string, hubId: string) => [...metahubsQueryKeys.hubDetail(metahubId, hubId), 'enumerations'] as const,

    enumerationsList: (metahubId: string, hubId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.enumerations(metahubId, hubId), 'list', normalized] as const
    },

    // All enumerations across all hubs in a metahub
    allEnumerations: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'allEnumerations'] as const,

    allEnumerationsList: (metahubId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.allEnumerations(metahubId), 'list', normalized] as const
    },

    // Enumeration detail without hub context
    enumerationDetail: (metahubId: string, enumerationId: string) =>
        [...metahubsQueryKeys.allEnumerations(metahubId), 'detail', enumerationId] as const,

    // Enumeration detail scoped to a specific hub
    enumerationDetailInHub: (metahubId: string, hubId: string, enumerationId: string) =>
        [...metahubsQueryKeys.enumerations(metahubId, hubId), 'detail', enumerationId] as const,

    // Blocking references for enumeration deletion (REF attributes in other catalogs)
    blockingEnumerationReferences: (metahubId: string, enumerationId: string) =>
        [...metahubsQueryKeys.enumerationDetail(metahubId, enumerationId), 'blockingReferences'] as const,

    // Enumeration values
    enumerationValues: (metahubId: string, enumerationId: string) =>
        [...metahubsQueryKeys.enumerationDetail(metahubId, enumerationId), 'values'] as const,

    enumerationValuesList: (metahubId: string, enumerationId: string) =>
        [...metahubsQueryKeys.enumerationValues(metahubId, enumerationId), 'list'] as const,

    // Attributes scoped to a specific catalog
    attributes: (metahubId: string, hubId: string, catalogId: string) =>
        [...metahubsQueryKeys.catalogDetailInHub(metahubId, hubId, catalogId), 'attributes'] as const,

    attributesList: (metahubId: string, hubId: string, catalogId: string, params?: PaginationParams & { locale?: string }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            locale: params?.locale
        }
        return [...metahubsQueryKeys.attributes(metahubId, hubId, catalogId), 'list', normalized] as const
    },

    // Attributes scoped directly to catalog (without hub context)
    attributesDirect: (metahubId: string, catalogId: string) =>
        [...metahubsQueryKeys.catalogDetail(metahubId, catalogId), 'attributes'] as const,

    attributesListDirect: (metahubId: string, catalogId: string, params?: PaginationParams & { locale?: string }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            locale: params?.locale
        }
        return [...metahubsQueryKeys.attributesDirect(metahubId, catalogId), 'list', normalized] as const
    },

    // Elements scoped to a specific catalog
    elements: (metahubId: string, hubId: string, catalogId: string) =>
        [...metahubsQueryKeys.catalogDetailInHub(metahubId, hubId, catalogId), 'elements'] as const,

    elementsList: (metahubId: string, hubId: string, catalogId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.elements(metahubId, hubId, catalogId), 'list', normalized] as const
    },

    // Elements scoped directly to catalog (without hub context)
    elementsDirect: (metahubId: string, catalogId: string) =>
        [...metahubsQueryKeys.catalogDetail(metahubId, catalogId), 'elements'] as const,

    elementsListDirect: (metahubId: string, catalogId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...metahubsQueryKeys.elementsDirect(metahubId, catalogId), 'list', normalized] as const
    },

    // ============ PUBLICATIONS (INFORMATION BASES) QUERY KEYS ============

    // Publications scoped to a specific metahub
    publications: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'publications'] as const,

    publicationsList: (metahubId: string) => [...metahubsQueryKeys.publications(metahubId), 'list'] as const,

    publicationDetail: (metahubId: string, publicationId: string) =>
        [...metahubsQueryKeys.publications(metahubId), 'detail', publicationId] as const,

    publicationDiff: (metahubId: string, publicationId: string) =>
        [...metahubsQueryKeys.publicationDetail(metahubId, publicationId), 'diff'] as const,

    publicationVersionsList: (metahubId: string, publicationId: string) =>
        [...metahubsQueryKeys.publicationDetail(metahubId, publicationId), 'versions', 'list'] as const,

    publicationApplicationsList: (metahubId: string, publicationId: string) =>
        [...metahubsQueryKeys.publicationDetail(metahubId, publicationId), 'applications', 'list'] as const
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

export const invalidateLayoutsQueries = {
    all: (queryClient: QueryClient, metahubId: string) => queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layouts(metahubId) }),

    lists: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layoutsList(metahubId) }),

    detail: (queryClient: QueryClient, metahubId: string, layoutId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layoutDetail(metahubId, layoutId) })
}

export const invalidateBranchesQueries = {
    all: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.branches(metahubId) }),

    lists: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.branchesList(metahubId) }),

    detail: (queryClient: QueryClient, metahubId: string, branchId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.branchDetail(metahubId, branchId) })
}

export const invalidateCatalogsQueries = {
    all: (queryClient: QueryClient, metahubId: string, hubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(metahubId, hubId) }),

    lists: (queryClient: QueryClient, metahubId: string, hubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogsList(metahubId, hubId) }),

    detail: (queryClient: QueryClient, metahubId: string, hubId: string, catalogId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetailInHub(metahubId, hubId, catalogId) })
}

export const invalidateEnumerationsQueries = {
    all: (queryClient: QueryClient, metahubId: string, hubId?: string) =>
        queryClient.invalidateQueries({
            queryKey: hubId ? metahubsQueryKeys.enumerations(metahubId, hubId) : metahubsQueryKeys.allEnumerations(metahubId)
        }),

    lists: (queryClient: QueryClient, metahubId: string, hubId?: string) =>
        queryClient.invalidateQueries({
            queryKey: hubId ? metahubsQueryKeys.enumerationsList(metahubId, hubId) : metahubsQueryKeys.allEnumerationsList(metahubId)
        }),

    detail: (queryClient: QueryClient, metahubId: string, enumerationId: string, hubId?: string) =>
        queryClient.invalidateQueries({
            queryKey: hubId
                ? metahubsQueryKeys.enumerationDetailInHub(metahubId, hubId, enumerationId)
                : metahubsQueryKeys.enumerationDetail(metahubId, enumerationId)
        })
}

export const invalidateEnumerationValuesQueries = {
    all: (queryClient: QueryClient, metahubId: string, enumerationId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.enumerationValues(metahubId, enumerationId) }),

    lists: (queryClient: QueryClient, metahubId: string, enumerationId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.enumerationValuesList(metahubId, enumerationId) })
}

export const invalidateAttributesQueries = {
    all: (queryClient: QueryClient, metahubId: string, hubId: string, catalogId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributes(metahubId, hubId, catalogId) }),

    lists: (queryClient: QueryClient, metahubId: string, hubId: string, catalogId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesList(metahubId, hubId, catalogId) })
}

export const invalidateElementsQueries = {
    all: (queryClient: QueryClient, metahubId: string, hubId: string, catalogId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.elements(metahubId, hubId, catalogId) }),

    lists: (queryClient: QueryClient, metahubId: string, hubId: string, catalogId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.elementsList(metahubId, hubId, catalogId) })
}

export const invalidatePublicationsQueries = {
    all: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.publications(metahubId) }),

    lists: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.publicationsList(metahubId) }),

    detail: (queryClient: QueryClient, metahubId: string, publicationId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.publicationDetail(metahubId, publicationId) })
}
