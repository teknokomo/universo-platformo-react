import { QueryClient } from '@tanstack/react-query'
import type { TemplateDefinitionType } from '@universo/types'
import type { SharedEntityKind } from '@universo/types'
import { PaginationParams } from '../../types'

type AttributeListScope = 'business' | 'system' | 'all'

const normalizeLayoutScopeCatalogId = (catalogId?: string | null): string | null => {
    if (typeof catalogId !== 'string') return null
    const trimmed = catalogId.trim()
    return trimmed.length > 0 ? trimmed : null
}

const normalizeLayoutScope = (catalogId?: string | null) => ({
    catalogId: normalizeLayoutScopeCatalogId(catalogId)
})

const normalizeLegacyCompatibleKindKey = (kindKey?: string | null): string | undefined => {
    if (typeof kindKey !== 'string') return undefined
    const trimmed = kindKey.trim()
    return trimmed.length > 0 ? trimmed : undefined
}

const normalizeLegacyCompatibleScope = (kindKey?: string | null): { kindKey: string } | null => {
    const normalizedKindKey = normalizeLegacyCompatibleKindKey(kindKey)
    return normalizedKindKey ? { kindKey: normalizedKindKey } : null
}

/**
 * Centralized query key factory for metahubs
 * Following TanStack Query v5 best practices
 */
export const metahubsQueryKeys = {
    all: ['metahubs'] as const,

    // ============ TEMPLATES ============
    templates: () => [...metahubsQueryKeys.all, 'templates'] as const,
    templatesList: (params?: { definitionType?: TemplateDefinitionType }) => {
        const normalized = {
            definitionType: params?.definitionType ?? 'metahub_template'
        }
        return [...metahubsQueryKeys.templates(), 'list', normalized] as const
    },
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

    // Entity types scoped to a specific metahub
    entityTypes: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'entityTypes'] as const,

    entityTypesList: (metahubId: string, params?: PaginationParams & { includeBuiltins?: boolean }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            includeBuiltins: params?.includeBuiltins ?? true
        }
        return [...metahubsQueryKeys.entityTypes(metahubId), 'list', normalized] as const
    },

    entityTypeDetail: (metahubId: string, entityTypeId: string) =>
        [...metahubsQueryKeys.entityTypes(metahubId), 'detail', entityTypeId] as const,

    // Generic custom entities scoped to a specific metahub
    entities: (metahubId: string, kind: string) => [...metahubsQueryKeys.detail(metahubId), 'entities', kind] as const,

    entitiesList: (
        metahubId: string,
        params: PaginationParams & { kind: string; locale?: string; includeDeleted?: boolean; onlyDeleted?: boolean }
    ) => {
        const normalized = {
            kind: params.kind,
            limit: params.limit ?? 100,
            offset: params.offset ?? 0,
            sortBy: params.sortBy ?? 'updated',
            sortOrder: params.sortOrder ?? 'desc',
            search: params.search?.trim() || undefined,
            locale: params.locale,
            includeDeleted: params.includeDeleted ?? false,
            onlyDeleted: params.onlyDeleted ?? false
        }
        return [...metahubsQueryKeys.entities(metahubId, normalized.kind), 'list', normalized] as const
    },

    entityDetail: (metahubId: string, entityId: string) => [...metahubsQueryKeys.detail(metahubId), 'entity', entityId] as const,

    // Hubs scoped to a specific metahub
    hubs: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'hubs'] as const,

    hubsScope: (metahubId: string, kindKey?: string | null) => {
        const scope = normalizeLegacyCompatibleScope(kindKey)
        return scope ? ([...metahubsQueryKeys.hubs(metahubId), scope] as const) : metahubsQueryKeys.hubs(metahubId)
    },

    hubsList: (metahubId: string, params?: PaginationParams & { kindKey?: string }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            kindKey: normalizeLegacyCompatibleKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.hubsScope(metahubId, normalized.kindKey), 'list', normalized] as const
    },

    hubDetail: (metahubId: string, hubId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.hubsScope(metahubId, kindKey), 'detail', hubId] as const,

    // Child hubs for a specific parent hub
    childHubs: (metahubId: string, hubId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.hubDetail(metahubId, hubId, kindKey), 'hubs'] as const,

    childHubsList: (metahubId: string, hubId: string, params?: PaginationParams & { kindKey?: string }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            kindKey: normalizeLegacyCompatibleKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.childHubs(metahubId, hubId, normalized.kindKey), 'list', normalized] as const
    },

    // Layouts scoped to a specific metahub
    layoutsRoot: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'layouts'] as const,

    sharedContainers: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'sharedContainers'] as const,

    sharedEntityOverrides: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'sharedEntityOverrides'] as const,
    sharedEntityOverridesByEntity: (metahubId: string, entityKind: SharedEntityKind, sharedEntityId: string) =>
        [...metahubsQueryKeys.sharedEntityOverrides(metahubId), entityKind, 'entity', sharedEntityId] as const,
    sharedEntityTargets: (metahubId: string, entityKind: SharedEntityKind, locale?: string) =>
        [...metahubsQueryKeys.detail(metahubId), 'sharedEntityTargets', entityKind, locale ?? 'default'] as const,

    layouts: (metahubId: string, catalogId?: string | null) =>
        [...metahubsQueryKeys.layoutsRoot(metahubId), normalizeLayoutScope(catalogId)] as const,

    layoutsListBase: (metahubId: string, catalogId?: string | null) =>
        [...metahubsQueryKeys.layouts(metahubId, catalogId), 'list'] as const,

    layoutsList: (metahubId: string, params?: PaginationParams & { catalogId?: string | null }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            catalogId: normalizeLayoutScopeCatalogId(params?.catalogId)
        }
        return [...metahubsQueryKeys.layoutsListBase(metahubId, normalized.catalogId), normalized] as const
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
    blockingCatalogs: (metahubId: string, hubId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.hubDetail(metahubId, hubId, kindKey), 'blockingCatalogs'] as const,

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

    // Blocking references for set deletion (REF attributes in catalogs)
    blockingSetReferences: (metahubId: string, setId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.setDetail(metahubId, setId, kindKey), 'blockingReferences'] as const,

    // Sets scoped to a specific hub
    sets: (metahubId: string, hubId: string) => [...metahubsQueryKeys.hubDetail(metahubId, hubId), 'sets'] as const,

    setsScope: (metahubId: string, hubId: string, kindKey?: string | null) => {
        const scope = normalizeLegacyCompatibleScope(kindKey)
        return scope ? ([...metahubsQueryKeys.sets(metahubId, hubId), scope] as const) : metahubsQueryKeys.sets(metahubId, hubId)
    },

    setsList: (metahubId: string, hubId: string, params?: PaginationParams & { kindKey?: string }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            kindKey: normalizeLegacyCompatibleKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.setsScope(metahubId, hubId, normalized.kindKey), 'list', normalized] as const
    },

    // All sets across all hubs in a metahub
    allSets: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'allSets'] as const,

    allSetsScope: (metahubId: string, kindKey?: string | null) => {
        const scope = normalizeLegacyCompatibleScope(kindKey)
        return scope ? ([...metahubsQueryKeys.allSets(metahubId), scope] as const) : metahubsQueryKeys.allSets(metahubId)
    },

    allSetsList: (metahubId: string, params?: PaginationParams & { kindKey?: string }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            kindKey: normalizeLegacyCompatibleKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.allSetsScope(metahubId, normalized.kindKey), 'list', normalized] as const
    },

    // Set detail without hub context
    setDetail: (metahubId: string, setId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.allSetsScope(metahubId, kindKey), 'detail', setId] as const,

    // Set detail scoped to a specific hub
    setDetailInHub: (metahubId: string, hubId: string, setId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.setsScope(metahubId, hubId, kindKey), 'detail', setId] as const,

    // Constants scoped to a specific set in hub context
    constants: (metahubId: string, hubId: string, setId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.setDetailInHub(metahubId, hubId, setId, kindKey), 'constants'] as const,

    constantsList: (
        metahubId: string,
        hubId: string,
        setId: string,
        params?: PaginationParams & { locale?: string; includeShared?: boolean; kindKey?: string }
    ) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            locale: params?.locale,
            includeShared: params?.includeShared ?? false,
            kindKey: normalizeLegacyCompatibleKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.constants(metahubId, hubId, setId, normalized.kindKey), 'list', normalized] as const
    },

    // Constants scoped directly to set (without hub context)
    constantsDirect: (metahubId: string, setId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.setDetail(metahubId, setId, kindKey), 'constants'] as const,

    constantsListDirect: (
        metahubId: string,
        setId: string,
        params?: PaginationParams & { locale?: string; includeShared?: boolean; kindKey?: string }
    ) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            locale: params?.locale,
            includeShared: params?.includeShared ?? false,
            kindKey: normalizeLegacyCompatibleKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.constantsDirect(metahubId, setId, normalized.kindKey), 'list', normalized] as const
    },

    // All constant codenames for a set (for global duplicate check)
    allConstantCodenames: (metahubId: string, setId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.setDetail(metahubId, setId, kindKey), 'constantCodenames'] as const,

    // Enumerations scoped to a specific hub
    enumerations: (metahubId: string, hubId: string) => [...metahubsQueryKeys.hubDetail(metahubId, hubId), 'enumerations'] as const,

    enumerationsScope: (metahubId: string, hubId: string, kindKey?: string | null) => {
        const scope = normalizeLegacyCompatibleScope(kindKey)
        return scope
            ? ([...metahubsQueryKeys.enumerations(metahubId, hubId), scope] as const)
            : metahubsQueryKeys.enumerations(metahubId, hubId)
    },

    enumerationsList: (metahubId: string, hubId: string, params?: PaginationParams & { kindKey?: string }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            kindKey: normalizeLegacyCompatibleKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.enumerationsScope(metahubId, hubId, normalized.kindKey), 'list', normalized] as const
    },

    // All enumerations across all hubs in a metahub
    allEnumerations: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'allEnumerations'] as const,

    allEnumerationsScope: (metahubId: string, kindKey?: string | null) => {
        const scope = normalizeLegacyCompatibleScope(kindKey)
        return scope
            ? ([...metahubsQueryKeys.allEnumerations(metahubId), scope] as const)
            : metahubsQueryKeys.allEnumerations(metahubId)
    },

    allEnumerationsList: (metahubId: string, params?: PaginationParams & { kindKey?: string }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            kindKey: normalizeLegacyCompatibleKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.allEnumerationsScope(metahubId, normalized.kindKey), 'list', normalized] as const
    },

    // Enumeration detail without hub context
    enumerationDetail: (metahubId: string, enumerationId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.allEnumerationsScope(metahubId, kindKey), 'detail', enumerationId] as const,

    // Enumeration detail scoped to a specific hub
    enumerationDetailInHub: (metahubId: string, hubId: string, enumerationId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.enumerationsScope(metahubId, hubId, kindKey), 'detail', enumerationId] as const,

    // Blocking references for enumeration deletion (REF attributes in other catalogs)
    blockingEnumerationReferences: (metahubId: string, enumerationId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.enumerationDetail(metahubId, enumerationId, kindKey), 'blockingReferences'] as const,

    // Enumeration values
    enumerationValues: (metahubId: string, enumerationId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.enumerationDetail(metahubId, enumerationId, kindKey), 'values'] as const,

    enumerationValuesList: (metahubId: string, enumerationId: string, params?: { includeShared?: boolean; kindKey?: string }) => {
        const normalized = {
            includeShared: params?.includeShared ?? false,
            kindKey: normalizeLegacyCompatibleKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.enumerationValues(metahubId, enumerationId, normalized.kindKey), 'list', normalized] as const
    },

    // Attributes scoped to a specific catalog
    attributes: (metahubId: string, hubId: string, catalogId: string) =>
        [...metahubsQueryKeys.catalogDetailInHub(metahubId, hubId, catalogId), 'attributes'] as const,

    attributesList: (
        metahubId: string,
        hubId: string,
        catalogId: string,
        params?: PaginationParams & { locale?: string; scope?: AttributeListScope; includeShared?: boolean }
    ) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            locale: params?.locale,
            scope: params?.scope,
            includeShared: params?.includeShared ?? false
        }
        return [...metahubsQueryKeys.attributes(metahubId, hubId, catalogId), 'list', normalized] as const
    },

    // Attributes scoped directly to catalog (without hub context)
    attributesDirect: (metahubId: string, catalogId: string) =>
        [...metahubsQueryKeys.catalogDetail(metahubId, catalogId), 'attributes'] as const,

    attributesListDirect: (
        metahubId: string,
        catalogId: string,
        params?: PaginationParams & { locale?: string; scope?: AttributeListScope; includeShared?: boolean }
    ) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            locale: params?.locale,
            scope: params?.scope,
            includeShared: params?.includeShared ?? false
        }
        return [...metahubsQueryKeys.attributesDirect(metahubId, catalogId), 'list', normalized] as const
    },

    // All attribute codenames for a catalog (root + children, for global scope duplicate checking)
    allAttributeCodenames: (metahubId: string, catalogId: string) =>
        [...metahubsQueryKeys.catalogDetail(metahubId, catalogId), 'attributeCodenames'] as const,

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
        [...metahubsQueryKeys.publicationDetail(metahubId, publicationId), 'applications', 'list'] as const,

    // ============ SETTINGS ============
    settings: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'settings'] as const,

    settingsList: (metahubId: string) => [...metahubsQueryKeys.settings(metahubId), 'list'] as const,

    settingDetail: (metahubId: string, key: string) => [...metahubsQueryKeys.settings(metahubId), 'detail', key] as const
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

    childLists: (queryClient: QueryClient, metahubId: string, hubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.childHubsList(metahubId, hubId) }),

    detail: (queryClient: QueryClient, metahubId: string, hubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubDetail(metahubId, hubId) })
}

export const invalidateLayoutsQueries = {
    all: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layoutsRoot(metahubId) }),

    lists: (queryClient: QueryClient, metahubId: string, catalogId?: string | null) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layoutsListBase(metahubId, catalogId) }),

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

export const invalidateEntityTypesQueries = {
    all: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.entityTypes(metahubId) }),

    lists: (queryClient: QueryClient, metahubId: string, includeBuiltins?: boolean) =>
        queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.entityTypesList(metahubId, includeBuiltins === undefined ? undefined : { includeBuiltins })
        }),

    detail: (queryClient: QueryClient, metahubId: string, entityTypeId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.entityTypeDetail(metahubId, entityTypeId) })
}

export const invalidateEntitiesQueries = {
    all: (queryClient: QueryClient, metahubId: string, kind: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.entities(metahubId, kind) }),

    lists: (queryClient: QueryClient, metahubId: string, kind: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.entitiesList(metahubId, { kind }) }),

    detail: (queryClient: QueryClient, metahubId: string, entityId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.entityDetail(metahubId, entityId) })
}

export const invalidateCatalogsQueries = {
    all: (queryClient: QueryClient, metahubId: string, hubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(metahubId, hubId) }),

    lists: (queryClient: QueryClient, metahubId: string, hubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogsList(metahubId, hubId) }),

    detail: (queryClient: QueryClient, metahubId: string, hubId: string, catalogId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetailInHub(metahubId, hubId, catalogId) })
}

export const invalidateSetsQueries = {
    all: (queryClient: QueryClient, metahubId: string, hubId?: string) =>
        queryClient.invalidateQueries({
            queryKey: hubId ? metahubsQueryKeys.sets(metahubId, hubId) : metahubsQueryKeys.allSets(metahubId)
        }),

    lists: (queryClient: QueryClient, metahubId: string, hubId?: string) =>
        queryClient.invalidateQueries({
            queryKey: hubId ? metahubsQueryKeys.setsList(metahubId, hubId) : metahubsQueryKeys.allSetsList(metahubId)
        }),

    detail: (queryClient: QueryClient, metahubId: string, setId: string, hubId?: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({
            queryKey: hubId
                ? metahubsQueryKeys.setDetailInHub(metahubId, hubId, setId, kindKey)
                : metahubsQueryKeys.setDetail(metahubId, setId, kindKey)
        }),

    blockingReferences: (queryClient: QueryClient, metahubId: string, setId: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.blockingSetReferences(metahubId, setId, kindKey) })
}

export const invalidateConstantsQueries = {
    all: (queryClient: QueryClient, metahubId: string, setId: string, hubId?: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({
            queryKey: hubId
                ? metahubsQueryKeys.constants(metahubId, hubId, setId, kindKey)
                : metahubsQueryKeys.constantsDirect(metahubId, setId, kindKey)
        }),

    lists: (queryClient: QueryClient, metahubId: string, setId: string, hubId?: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({
            queryKey: hubId
                ? metahubsQueryKeys.constantsList(metahubId, hubId, setId, { kindKey })
                : metahubsQueryKeys.constantsListDirect(metahubId, setId, { kindKey })
        }),

    allCodenames: (queryClient: QueryClient, metahubId: string, setId: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allConstantCodenames(metahubId, setId, kindKey) })
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

    detail: (queryClient: QueryClient, metahubId: string, enumerationId: string, hubId?: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({
            queryKey: hubId
                ? metahubsQueryKeys.enumerationDetailInHub(metahubId, hubId, enumerationId, kindKey)
                : metahubsQueryKeys.enumerationDetail(metahubId, enumerationId, kindKey)
        })
}

export const invalidateEnumerationValuesQueries = {
    all: (queryClient: QueryClient, metahubId: string, enumerationId: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.enumerationValues(metahubId, enumerationId, kindKey) }),

    lists: (queryClient: QueryClient, metahubId: string, enumerationId: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.enumerationValuesList(metahubId, enumerationId, { kindKey }) })
}

export const invalidateAttributesQueries = {
    all: (queryClient: QueryClient, metahubId: string, hubId: string, catalogId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributes(metahubId, hubId, catalogId) }),

    lists: (queryClient: QueryClient, metahubId: string, hubId: string, catalogId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesList(metahubId, hubId, catalogId) }),

    allCodenames: (queryClient: QueryClient, metahubId: string, catalogId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allAttributeCodenames(metahubId, catalogId) })
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

export const invalidateSettingsQueries = {
    all: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.settings(metahubId) }),

    lists: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.settingsList(metahubId) }),

    detail: (queryClient: QueryClient, metahubId: string, key: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.settingDetail(metahubId, key) })
}
