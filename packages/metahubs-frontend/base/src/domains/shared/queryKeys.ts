import { QueryClient } from '@tanstack/react-query'
import type { TemplateDefinitionType } from '@universo/types'
import type { SharedEntityKind } from '@universo/types'
import { PaginationParams } from '../../types'

type FieldDefinitionListScope = 'business' | 'system' | 'all'

const normalizeLayoutScopeLinkedCollectionId = (linkedCollectionId?: string | null): string | null => {
    if (typeof linkedCollectionId !== 'string') return null
    const trimmed = linkedCollectionId.trim()
    return trimmed.length > 0 ? trimmed : null
}

const normalizeLayoutScope = (linkedCollectionId?: string | null) => ({
    linkedCollectionId: normalizeLayoutScopeLinkedCollectionId(linkedCollectionId)
})

const normalizeEntityRouteKindKey = (kindKey?: string | null): string | undefined => {
    if (typeof kindKey !== 'string') return undefined
    const trimmed = kindKey.trim()
    return trimmed.length > 0 ? trimmed : undefined
}

const normalizeEntityRouteScope = (kindKey?: string | null): { kindKey: string } | null => {
    const normalizedKindKey = normalizeEntityRouteKindKey(kindKey)
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

    entityTypesList: (metahubId: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
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
    treeEntities: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'treeEntities'] as const,

    treeEntitiesScope: (metahubId: string, kindKey?: string | null) => {
        const scope = normalizeEntityRouteScope(kindKey)
        return scope ? ([...metahubsQueryKeys.treeEntities(metahubId), scope] as const) : metahubsQueryKeys.treeEntities(metahubId)
    },

    treeEntitiesList: (metahubId: string, params?: PaginationParams & { kindKey?: string }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            kindKey: normalizeEntityRouteKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.treeEntitiesScope(metahubId, normalized.kindKey), 'list', normalized] as const
    },

    treeEntityDetail: (metahubId: string, treeEntityId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.treeEntitiesScope(metahubId, kindKey), 'detail', treeEntityId] as const,

    // Child treeEntities for a specific parent hub
    childTreeEntities: (metahubId: string, treeEntityId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.treeEntityDetail(metahubId, treeEntityId, kindKey), 'treeEntities'] as const,

    childTreeEntitiesList: (metahubId: string, treeEntityId: string, params?: PaginationParams & { kindKey?: string }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            kindKey: normalizeEntityRouteKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.childTreeEntities(metahubId, treeEntityId, normalized.kindKey), 'list', normalized] as const
    },

    // Layouts scoped to a specific metahub
    layoutsRoot: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'layouts'] as const,

    sharedContainers: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'sharedContainers'] as const,

    sharedEntityOverrides: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'sharedEntityOverrides'] as const,
    sharedEntityOverridesByEntity: (metahubId: string, entityKind: SharedEntityKind, sharedEntityId: string) =>
        [...metahubsQueryKeys.sharedEntityOverrides(metahubId), entityKind, 'entity', sharedEntityId] as const,
    sharedEntityTargets: (metahubId: string, entityKind: SharedEntityKind, locale?: string) =>
        [...metahubsQueryKeys.detail(metahubId), 'sharedEntityTargets', entityKind, locale ?? 'default'] as const,

    layouts: (metahubId: string, linkedCollectionId?: string | null) =>
        [...metahubsQueryKeys.layoutsRoot(metahubId), normalizeLayoutScope(linkedCollectionId)] as const,

    layoutsListBase: (metahubId: string, linkedCollectionId?: string | null) =>
        [...metahubsQueryKeys.layouts(metahubId, linkedCollectionId), 'list'] as const,

    layoutsList: (metahubId: string, params?: PaginationParams & { linkedCollectionId?: string | null }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            linkedCollectionId: normalizeLayoutScopeLinkedCollectionId(params?.linkedCollectionId)
        }
        return [...metahubsQueryKeys.layoutsListBase(metahubId, normalized.linkedCollectionId), normalized] as const
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

    // Blocking linkedCollections for hub deletion (linkedCollections with isRequiredHub=true that would become orphaned)
    blockingLinkedCollections: (metahubId: string, treeEntityId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.treeEntityDetail(metahubId, treeEntityId, kindKey), 'blockingLinkedCollections'] as const,

    // Blocking references for catalog deletion (REF fieldDefinitions in other linkedCollections)
    blockingLinkedCollectionReferences: (metahubId: string, linkedCollectionId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.linkedCollectionDetail(metahubId, linkedCollectionId, kindKey), 'blockingReferences'] as const,

    // Catalogs scoped to a specific hub
    linkedCollections: (metahubId: string, treeEntityId: string) =>
        [...metahubsQueryKeys.treeEntityDetail(metahubId, treeEntityId), 'linkedCollections'] as const,

    linkedCollectionsScope: (metahubId: string, treeEntityId: string, kindKey?: string | null) => {
        const scope = normalizeEntityRouteScope(kindKey)
        return scope
            ? ([...metahubsQueryKeys.linkedCollections(metahubId, treeEntityId), scope] as const)
            : metahubsQueryKeys.linkedCollections(metahubId, treeEntityId)
    },

    linkedCollectionsList: (metahubId: string, treeEntityId: string, params?: PaginationParams & { kindKey?: string }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            kindKey: normalizeEntityRouteKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.linkedCollectionsScope(metahubId, treeEntityId, normalized.kindKey), 'list', normalized] as const
    },

    // All linkedCollections across all treeEntities in a metahub
    allLinkedCollections: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'allLinkedCollections'] as const,

    allLinkedCollectionsScope: (metahubId: string, kindKey?: string | null) => {
        const scope = normalizeEntityRouteScope(kindKey)
        return scope
            ? ([...metahubsQueryKeys.allLinkedCollections(metahubId), scope] as const)
            : metahubsQueryKeys.allLinkedCollections(metahubId)
    },

    allLinkedCollectionsList: (metahubId: string, params?: PaginationParams & { kindKey?: string }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            kindKey: normalizeEntityRouteKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.allLinkedCollectionsScope(metahubId, normalized.kindKey), 'list', normalized] as const
    },

    // LinkedCollectionEntity detail without hub context (catalog-centric navigation)
    linkedCollectionDetail: (metahubId: string, linkedCollectionId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.allLinkedCollectionsScope(metahubId, kindKey), 'detail', linkedCollectionId] as const,

    // LinkedCollectionEntity detail scoped to a specific hub
    linkedCollectionDetailInTreeEntity: (metahubId: string, treeEntityId: string, linkedCollectionId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.linkedCollectionsScope(metahubId, treeEntityId, kindKey), 'detail', linkedCollectionId] as const,

    // Blocking references for set deletion (REF fieldDefinitions in linkedCollections)
    blockingValueGroupReferences: (metahubId: string, valueGroupId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.valueGroupDetail(metahubId, valueGroupId, kindKey), 'blockingReferences'] as const,

    // Sets scoped to a specific hub
    valueGroups: (metahubId: string, treeEntityId: string) =>
        [...metahubsQueryKeys.treeEntityDetail(metahubId, treeEntityId), 'valueGroups'] as const,

    valueGroupsScope: (metahubId: string, treeEntityId: string, kindKey?: string | null) => {
        const scope = normalizeEntityRouteScope(kindKey)
        return scope
            ? ([...metahubsQueryKeys.valueGroups(metahubId, treeEntityId), scope] as const)
            : metahubsQueryKeys.valueGroups(metahubId, treeEntityId)
    },

    valueGroupsList: (metahubId: string, treeEntityId: string, params?: PaginationParams & { kindKey?: string }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            kindKey: normalizeEntityRouteKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.valueGroupsScope(metahubId, treeEntityId, normalized.kindKey), 'list', normalized] as const
    },

    // All valueGroups across all treeEntities in a metahub
    allValueGroups: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'allValueGroups'] as const,

    allValueGroupsScope: (metahubId: string, kindKey?: string | null) => {
        const scope = normalizeEntityRouteScope(kindKey)
        return scope ? ([...metahubsQueryKeys.allValueGroups(metahubId), scope] as const) : metahubsQueryKeys.allValueGroups(metahubId)
    },

    allValueGroupsList: (metahubId: string, params?: PaginationParams & { kindKey?: string }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            kindKey: normalizeEntityRouteKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.allValueGroupsScope(metahubId, normalized.kindKey), 'list', normalized] as const
    },

    // Set detail without hub context
    valueGroupDetail: (metahubId: string, valueGroupId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.allValueGroupsScope(metahubId, kindKey), 'detail', valueGroupId] as const,

    // Set detail scoped to a specific hub
    valueGroupDetailInTreeEntity: (metahubId: string, treeEntityId: string, valueGroupId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.valueGroupsScope(metahubId, treeEntityId, kindKey), 'detail', valueGroupId] as const,

    // Constants scoped to a specific set in hub context
    fixedValues: (metahubId: string, treeEntityId: string, valueGroupId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.valueGroupDetailInTreeEntity(metahubId, treeEntityId, valueGroupId, kindKey), 'fixedValues'] as const,

    fixedValuesList: (
        metahubId: string,
        treeEntityId: string,
        valueGroupId: string,
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
            kindKey: normalizeEntityRouteKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.fixedValues(metahubId, treeEntityId, valueGroupId, normalized.kindKey), 'list', normalized] as const
    },

    // Constants scoped directly to set (without hub context)
    fixedValuesDirect: (metahubId: string, valueGroupId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.valueGroupDetail(metahubId, valueGroupId, kindKey), 'fixedValues'] as const,

    fixedValuesListDirect: (
        metahubId: string,
        valueGroupId: string,
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
            kindKey: normalizeEntityRouteKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.fixedValuesDirect(metahubId, valueGroupId, normalized.kindKey), 'list', normalized] as const
    },

    // All constant codenames for a set (for global duplicate check)
    allFixedValueCodenames: (metahubId: string, valueGroupId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.valueGroupDetail(metahubId, valueGroupId, kindKey), 'fixedValueCodenames'] as const,

    // Enumerations scoped to a specific hub
    optionLists: (metahubId: string, treeEntityId: string) =>
        [...metahubsQueryKeys.treeEntityDetail(metahubId, treeEntityId), 'optionLists'] as const,

    optionListsScope: (metahubId: string, treeEntityId: string, kindKey?: string | null) => {
        const scope = normalizeEntityRouteScope(kindKey)
        return scope
            ? ([...metahubsQueryKeys.optionLists(metahubId, treeEntityId), scope] as const)
            : metahubsQueryKeys.optionLists(metahubId, treeEntityId)
    },

    optionListsList: (metahubId: string, treeEntityId: string, params?: PaginationParams & { kindKey?: string }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            kindKey: normalizeEntityRouteKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.optionListsScope(metahubId, treeEntityId, normalized.kindKey), 'list', normalized] as const
    },

    // All optionLists across all treeEntities in a metahub
    allOptionLists: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'allOptionLists'] as const,

    allOptionListsScope: (metahubId: string, kindKey?: string | null) => {
        const scope = normalizeEntityRouteScope(kindKey)
        return scope ? ([...metahubsQueryKeys.allOptionLists(metahubId), scope] as const) : metahubsQueryKeys.allOptionLists(metahubId)
    },

    allOptionListsList: (metahubId: string, params?: PaginationParams & { kindKey?: string }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            kindKey: normalizeEntityRouteKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.allOptionListsScope(metahubId, normalized.kindKey), 'list', normalized] as const
    },

    // OptionListEntity detail without hub context
    optionListDetail: (metahubId: string, optionListId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.allOptionListsScope(metahubId, kindKey), 'detail', optionListId] as const,

    // OptionListEntity detail scoped to a specific hub
    optionListDetailInTreeEntity: (metahubId: string, treeEntityId: string, optionListId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.optionListsScope(metahubId, treeEntityId, kindKey), 'detail', optionListId] as const,

    // Blocking references for enumeration deletion (REF fieldDefinitions in other linkedCollections)
    blockingOptionListReferences: (metahubId: string, optionListId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.optionListDetail(metahubId, optionListId, kindKey), 'blockingReferences'] as const,

    // OptionListEntity values
    optionValues: (metahubId: string, optionListId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.optionListDetail(metahubId, optionListId, kindKey), 'optionValues'] as const,

    optionValuesList: (metahubId: string, optionListId: string, params?: { includeShared?: boolean; kindKey?: string }) => {
        const normalized = {
            includeShared: params?.includeShared ?? false,
            kindKey: normalizeEntityRouteKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.optionValues(metahubId, optionListId, normalized.kindKey), 'list', normalized] as const
    },

    // Attributes scoped to a specific catalog
    fieldDefinitions: (metahubId: string, treeEntityId: string, linkedCollectionId: string, kindKey?: string | null) =>
        [
            ...metahubsQueryKeys.linkedCollectionDetailInTreeEntity(metahubId, treeEntityId, linkedCollectionId, kindKey),
            'fieldDefinitions'
        ] as const,

    fieldDefinitionsList: (
        metahubId: string,
        treeEntityId: string,
        linkedCollectionId: string,
        params?: PaginationParams & { locale?: string; scope?: FieldDefinitionListScope; includeShared?: boolean; kindKey?: string }
    ) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            locale: params?.locale,
            scope: params?.scope,
            includeShared: params?.includeShared ?? false,
            kindKey: normalizeEntityRouteKindKey(params?.kindKey)
        }
        return [
            ...metahubsQueryKeys.fieldDefinitions(metahubId, treeEntityId, linkedCollectionId, normalized.kindKey),
            'list',
            normalized
        ] as const
    },

    // Attributes scoped directly to catalog (without hub context)
    fieldDefinitionsDirect: (metahubId: string, linkedCollectionId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.linkedCollectionDetail(metahubId, linkedCollectionId, kindKey), 'fieldDefinitions'] as const,

    fieldDefinitionsListDirect: (
        metahubId: string,
        linkedCollectionId: string,
        params?: PaginationParams & { locale?: string; scope?: FieldDefinitionListScope; includeShared?: boolean; kindKey?: string }
    ) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            locale: params?.locale,
            scope: params?.scope,
            includeShared: params?.includeShared ?? false,
            kindKey: normalizeEntityRouteKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.fieldDefinitionsDirect(metahubId, linkedCollectionId, normalized.kindKey), 'list', normalized] as const
    },

    // All attribute codenames for a catalog (root + children, for global scope duplicate checking)
    allFieldDefinitionCodenames: (metahubId: string, linkedCollectionId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.linkedCollectionDetail(metahubId, linkedCollectionId, kindKey), 'fieldDefinitionCodenames'] as const,

    // Elements scoped to a specific catalog
    records: (metahubId: string, treeEntityId: string, linkedCollectionId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.linkedCollectionDetailInTreeEntity(metahubId, treeEntityId, linkedCollectionId, kindKey), 'records'] as const,

    recordsList: (
        metahubId: string,
        treeEntityId: string,
        linkedCollectionId: string,
        params?: PaginationParams & { kindKey?: string }
    ) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            kindKey: normalizeEntityRouteKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.records(metahubId, treeEntityId, linkedCollectionId, normalized.kindKey), 'list', normalized] as const
    },

    // Elements scoped directly to catalog (without hub context)
    recordsDirect: (metahubId: string, linkedCollectionId: string, kindKey?: string | null) =>
        [...metahubsQueryKeys.linkedCollectionDetail(metahubId, linkedCollectionId, kindKey), 'records'] as const,

    recordsListDirect: (metahubId: string, linkedCollectionId: string, params?: PaginationParams & { kindKey?: string }) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            kindKey: normalizeEntityRouteKindKey(params?.kindKey)
        }
        return [...metahubsQueryKeys.recordsDirect(metahubId, linkedCollectionId, normalized.kindKey), 'list', normalized] as const
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

export const invalidateTreeEntitiesQueries = {
    all: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.treeEntities(metahubId) }),

    lists: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.treeEntitiesList(metahubId) }),

    childLists: (queryClient: QueryClient, metahubId: string, treeEntityId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.childTreeEntitiesList(metahubId, treeEntityId) }),

    detail: (queryClient: QueryClient, metahubId: string, treeEntityId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.treeEntityDetail(metahubId, treeEntityId) })
}

export const invalidateLayoutsQueries = {
    all: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layoutsRoot(metahubId) }),

    lists: (queryClient: QueryClient, metahubId: string, linkedCollectionId?: string | null) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layoutsListBase(metahubId, linkedCollectionId) }),

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

    lists: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.entityTypesList(metahubId)
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

export const invalidateLinkedCollectionsQueries = {
    all: (queryClient: QueryClient, metahubId: string, treeEntityId?: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({
            queryKey: treeEntityId
                ? metahubsQueryKeys.linkedCollectionsScope(metahubId, treeEntityId, kindKey)
                : metahubsQueryKeys.allLinkedCollectionsScope(metahubId, kindKey)
        }),

    lists: (queryClient: QueryClient, metahubId: string, treeEntityId?: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({
            queryKey: treeEntityId
                ? metahubsQueryKeys.linkedCollectionsList(metahubId, treeEntityId, { kindKey: kindKey ?? undefined })
                : metahubsQueryKeys.allLinkedCollectionsList(metahubId, { kindKey: kindKey ?? undefined })
        }),

    detail: (queryClient: QueryClient, metahubId: string, linkedCollectionId: string, treeEntityId?: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({
            queryKey: treeEntityId
                ? metahubsQueryKeys.linkedCollectionDetailInTreeEntity(metahubId, treeEntityId, linkedCollectionId, kindKey)
                : metahubsQueryKeys.linkedCollectionDetail(metahubId, linkedCollectionId, kindKey)
        })
}

export const invalidateValueGroupsQueries = {
    all: (queryClient: QueryClient, metahubId: string, treeEntityId?: string) =>
        queryClient.invalidateQueries({
            queryKey: treeEntityId ? metahubsQueryKeys.valueGroups(metahubId, treeEntityId) : metahubsQueryKeys.allValueGroups(metahubId)
        }),

    lists: (queryClient: QueryClient, metahubId: string, treeEntityId?: string) =>
        queryClient.invalidateQueries({
            queryKey: treeEntityId
                ? metahubsQueryKeys.valueGroupsList(metahubId, treeEntityId)
                : metahubsQueryKeys.allValueGroupsList(metahubId)
        }),

    detail: (queryClient: QueryClient, metahubId: string, valueGroupId: string, treeEntityId?: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({
            queryKey: treeEntityId
                ? metahubsQueryKeys.valueGroupDetailInTreeEntity(metahubId, treeEntityId, valueGroupId, kindKey)
                : metahubsQueryKeys.valueGroupDetail(metahubId, valueGroupId, kindKey)
        }),

    blockingReferences: (queryClient: QueryClient, metahubId: string, valueGroupId: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.blockingValueGroupReferences(metahubId, valueGroupId, kindKey) })
}

export const invalidateFixedValuesQueries = {
    all: (queryClient: QueryClient, metahubId: string, valueGroupId: string, treeEntityId?: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({
            queryKey: treeEntityId
                ? metahubsQueryKeys.fixedValues(metahubId, treeEntityId, valueGroupId, kindKey)
                : metahubsQueryKeys.fixedValuesDirect(metahubId, valueGroupId, kindKey)
        }),

    lists: (queryClient: QueryClient, metahubId: string, valueGroupId: string, treeEntityId?: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({
            queryKey: treeEntityId
                ? metahubsQueryKeys.fixedValuesList(metahubId, treeEntityId, valueGroupId, { kindKey })
                : metahubsQueryKeys.fixedValuesListDirect(metahubId, valueGroupId, { kindKey })
        }),

    allCodenames: (queryClient: QueryClient, metahubId: string, valueGroupId: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allFixedValueCodenames(metahubId, valueGroupId, kindKey) })
}

export const invalidateOptionListsQueries = {
    all: (queryClient: QueryClient, metahubId: string, treeEntityId?: string) =>
        queryClient.invalidateQueries({
            queryKey: treeEntityId ? metahubsQueryKeys.optionLists(metahubId, treeEntityId) : metahubsQueryKeys.allOptionLists(metahubId)
        }),

    lists: (queryClient: QueryClient, metahubId: string, treeEntityId?: string) =>
        queryClient.invalidateQueries({
            queryKey: treeEntityId
                ? metahubsQueryKeys.optionListsList(metahubId, treeEntityId)
                : metahubsQueryKeys.allOptionListsList(metahubId)
        }),

    detail: (queryClient: QueryClient, metahubId: string, optionListId: string, treeEntityId?: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({
            queryKey: treeEntityId
                ? metahubsQueryKeys.optionListDetailInTreeEntity(metahubId, treeEntityId, optionListId, kindKey)
                : metahubsQueryKeys.optionListDetail(metahubId, optionListId, kindKey)
        })
}

export const invalidateOptionValuesQueries = {
    all: (queryClient: QueryClient, metahubId: string, optionListId: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.optionValues(metahubId, optionListId, kindKey) }),

    lists: (queryClient: QueryClient, metahubId: string, optionListId: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.optionValuesList(metahubId, optionListId, { kindKey }) })
}

export const invalidateFieldDefinitionsQueries = {
    all: (queryClient: QueryClient, metahubId: string, treeEntityId: string, linkedCollectionId: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.fieldDefinitions(metahubId, treeEntityId, linkedCollectionId, kindKey)
        }),

    lists: (queryClient: QueryClient, metahubId: string, treeEntityId: string, linkedCollectionId: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.fieldDefinitionsList(metahubId, treeEntityId, linkedCollectionId, { kindKey: kindKey ?? undefined })
        }),

    allCodenames: (queryClient: QueryClient, metahubId: string, linkedCollectionId: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allFieldDefinitionCodenames(metahubId, linkedCollectionId, kindKey) })
}

export const invalidateRecordsQueries = {
    all: (queryClient: QueryClient, metahubId: string, treeEntityId: string, linkedCollectionId: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.records(metahubId, treeEntityId, linkedCollectionId, kindKey) }),

    lists: (queryClient: QueryClient, metahubId: string, treeEntityId: string, linkedCollectionId: string, kindKey?: string | null) =>
        queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.recordsList(metahubId, treeEntityId, linkedCollectionId, { kindKey: kindKey ?? undefined })
        })
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
