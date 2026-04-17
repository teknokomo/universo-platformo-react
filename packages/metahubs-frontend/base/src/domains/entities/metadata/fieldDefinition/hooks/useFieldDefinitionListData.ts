import { useMemo } from 'react'
import { useParams, useSearchParams, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePaginated, useDebouncedSearch } from '@universo/template-mui'
import { metahubsQueryKeys } from '../../../../shared'
import type { FieldDefinition } from '../../../../../types'
import { DEFAULT_PLATFORM_SYSTEM_FIELD_DEFINITIONS_POLICY, type PlatformSystemFieldDefinitionsPolicy } from '@universo/types'
import * as fieldDefinitionsApi from '../api'
import { getLinkedCollectionById } from '../../../presets/api/linkedCollections'
import { useTreeEntities } from '../../../presets/hooks/useTreeEntities'
import { useSettingValue } from '../../../../settings/hooks/useSettings'
import type { CatalogTab } from './fieldDefinitionListUtils'
import { resolveEntityChildKindKey } from '../../../../shared/entityMetadataRoutePaths'

type UseFieldDefinitionListDataOptions = {
    metahubId?: string
    treeEntityId?: string | null
    linkedCollectionId?: string
    resolveCatalogDetails?: boolean
    allowSystemView?: boolean
    includeSharedEntities?: boolean
}

export function useFieldDefinitionListData(options: UseFieldDefinitionListDataOptions = {}) {
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const {
        metahubId: routeMetahubId,
        treeEntityId: routeTreeEntityIdParam,
        linkedCollectionId: routeLinkedCollectionId,
        kindKey: routeKindKey
    } = useParams<{ metahubId: string; treeEntityId?: string; linkedCollectionId: string; kindKey?: string }>()
    const metahubId = options.metahubId ?? routeMetahubId
    const hubIdParam = options.treeEntityId ?? routeTreeEntityIdParam
    const linkedCollectionId = options.linkedCollectionId ?? routeLinkedCollectionId
    const entityKindKey = resolveEntityChildKindKey({ routeKindKey, childObjectKind: 'catalog' })
    const resolveCatalogDetails = options.resolveCatalogDetails ?? true
    const allowSystemView = options.allowSystemView ?? true
    const includeSharedEntities = options.includeSharedEntities ?? true

    const requestedCatalogTab = searchParams.get('tab')
    const isDedicatedSystemRoute = location.pathname.endsWith('/system')
    const activeCatalogTab: Extract<CatalogTab, 'fieldDefinitions' | 'system'> =
        allowSystemView && (isDedicatedSystemRoute || requestedCatalogTab === 'system') ? 'system' : 'fieldDefinitions'
    const isSystemView = activeCatalogTab === 'system'
    const includeShared = includeSharedEntities && !isSystemView
    const attributeCodenameScope = useSettingValue<string>('entity.catalog.attributeCodenameScope') ?? 'per-level'

    // Resolve hub from catalog when treeEntityId is not in URL
    const {
        data: catalogForHubResolution,
        isLoading: isCatalogResolutionLoading,
        error: catalogResolutionError
    } = useQuery({
        queryKey:
            metahubId && linkedCollectionId
                ? metahubsQueryKeys.linkedCollectionDetail(metahubId, linkedCollectionId, entityKindKey)
                : ['metahubs', 'linkedCollections', 'detail', 'empty'],
        queryFn: async () => {
            if (!metahubId || !linkedCollectionId) {
                throw new Error('metahubId and linkedCollectionId are required')
            }
            return getLinkedCollectionById(metahubId, linkedCollectionId, entityKindKey)
        },
        enabled: resolveCatalogDetails && !!metahubId && !!linkedCollectionId && !hubIdParam
    })

    const effectiveTreeEntityId = hubIdParam || catalogForHubResolution?.treeEntities?.[0]?.id

    // Fetch treeEntities for the Settings edit dialog
    const treeEntities = useTreeEntities(metahubId)

    const canLoadAttributes = !!metahubId && !!linkedCollectionId && (!hubIdParam || !isCatalogResolutionLoading)

    // Paginated fieldDefinitions
    const paginationResult = usePaginated<FieldDefinition, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn:
            metahubId && linkedCollectionId
                ? (params) =>
                      effectiveTreeEntityId
                          ? metahubsQueryKeys.fieldDefinitionsList(metahubId, effectiveTreeEntityId, linkedCollectionId, {
                                ...params,
                                scope: isSystemView ? 'system' : undefined,
                                includeShared
                            })
                          : metahubsQueryKeys.fieldDefinitionsListDirect(metahubId, linkedCollectionId, {
                                ...params,
                                scope: isSystemView ? 'system' : undefined,
                                includeShared
                            })
                : () => ['empty'],
        queryFn:
            metahubId && linkedCollectionId
                ? (params) =>
                      effectiveTreeEntityId
                          ? fieldDefinitionsApi.listFieldDefinitions(metahubId, effectiveTreeEntityId, linkedCollectionId, {
                                ...params,
                                scope: isSystemView ? 'system' : undefined,
                                includeShared
                            })
                          : fieldDefinitionsApi.listFieldDefinitionsDirect(metahubId, linkedCollectionId, {
                                ...params,
                                scope: isSystemView ? 'system' : undefined,
                                includeShared
                            })
                : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: canLoadAttributes,
        keepPreviousDataOnQueryKeyChange: false
    })

    const { data: fieldDefinitions, isLoading, error } = paginationResult

    // Global codenames for duplicate checking
    const isGlobalScope = attributeCodenameScope === 'global'
    const { data: globalCodenamesData } = useQuery({
        queryKey: metahubsQueryKeys.allFieldDefinitionCodenames(metahubId ?? '', linkedCollectionId ?? ''),
        queryFn: () => fieldDefinitionsApi.listAllFieldDefinitionCodenames(metahubId ?? '', linkedCollectionId ?? ''),
        enabled: !isSystemView && isGlobalScope && !!metahubId && !!linkedCollectionId
    })

    const codenameEntities = useMemo(() => {
        if (isSystemView) return []
        if (isGlobalScope && globalCodenamesData?.items) return globalCodenamesData.items
        return fieldDefinitions ?? []
    }, [fieldDefinitions, globalCodenamesData?.items, isGlobalScope, isSystemView])

    const attributesMeta = paginationResult.meta as
        | {
              totalAll?: number
              limit?: number
              limitReached?: boolean
              childSearchMatchParentIds?: string[]
              platformSystemFieldDefinitionsPolicy?: PlatformSystemFieldDefinitionsPolicy
          }
        | undefined
    const platformSystemFieldDefinitionsPolicy =
        attributesMeta?.platformSystemFieldDefinitionsPolicy ?? DEFAULT_PLATFORM_SYSTEM_FIELD_DEFINITIONS_POLICY
    const limitValue = attributesMeta?.limit ?? 100
    const totalAttributes = attributesMeta?.totalAll ?? paginationResult.pagination.totalItems
    const limitReached = attributesMeta?.limitReached ?? totalAttributes >= limitValue
    const childSearchMatchParentIds = useMemo(
        () => attributesMeta?.childSearchMatchParentIds ?? [],
        [attributesMeta?.childSearchMatchParentIds]
    )

    // Instant search
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // Attribute lookup map
    const attributeMap = useMemo(() => {
        if (!Array.isArray(fieldDefinitions)) return new Map<string, FieldDefinition>()
        return new Map(fieldDefinitions.map((attr) => [attr.id, attr]))
    }, [fieldDefinitions])

    return {
        metahubId,
        hubIdParam,
        linkedCollectionId,
        effectiveTreeEntityId,
        treeEntities,
        isSystemView,
        activeCatalogTab,
        isDedicatedSystemRoute,
        requestedCatalogTab,
        isCatalogResolutionLoading,
        catalogResolutionError,
        catalogForHubResolution,
        isLoading,
        error,
        fieldDefinitions,
        paginationResult,
        searchValue,
        handleSearchChange,
        codenameEntities,
        attributeMap,
        platformSystemFieldDefinitionsPolicy,
        limitValue,
        totalAttributes,
        limitReached,
        childSearchMatchParentIds,
        attributeCodenameScope,
        includeShared
    }
}
