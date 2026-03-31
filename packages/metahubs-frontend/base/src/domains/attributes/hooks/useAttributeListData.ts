import { useMemo } from 'react'
import { useParams, useSearchParams, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePaginated, useDebouncedSearch } from '@universo/template-mui'
import { fetchAllPaginatedItems, metahubsQueryKeys } from '../../shared'
import type { Attribute, PaginatedResponse } from '../../../types'
import { DEFAULT_PLATFORM_SYSTEM_ATTRIBUTES_POLICY, type PlatformSystemAttributesPolicy } from '@universo/types'
import * as attributesApi from '../api'
import { getCatalogById } from '../../catalogs'
import { useMetahubHubs } from '../../hubs/hooks'
import { useSettingValue } from '../../settings/hooks/useSettings'
import type { CatalogTab } from './attributeListUtils'

export function useAttributeListData() {
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const { metahubId, hubId: hubIdParam, catalogId } = useParams<{ metahubId: string; hubId?: string; catalogId: string }>()

    const requestedCatalogTab = searchParams.get('tab')
    const isDedicatedSystemRoute = location.pathname.endsWith('/system')
    const activeCatalogTab: Extract<CatalogTab, 'attributes' | 'system'> =
        isDedicatedSystemRoute || requestedCatalogTab === 'system' ? 'system' : 'attributes'
    const isSystemView = activeCatalogTab === 'system'
    const attributeCodenameScope = useSettingValue<string>('catalogs.attributeCodenameScope') ?? 'per-level'

    // Resolve hub from catalog when hubId is not in URL
    const {
        data: catalogForHubResolution,
        isLoading: isCatalogResolutionLoading,
        error: catalogResolutionError
    } = useQuery({
        queryKey:
            metahubId && catalogId ? metahubsQueryKeys.catalogDetail(metahubId, catalogId) : ['metahubs', 'catalogs', 'detail', 'empty'],
        queryFn: async () => {
            if (!metahubId || !catalogId) {
                throw new Error('metahubId and catalogId are required')
            }
            return getCatalogById(metahubId, catalogId)
        },
        enabled: !!metahubId && !!catalogId && !hubIdParam
    })

    const effectiveHubId = hubIdParam || catalogForHubResolution?.hubs?.[0]?.id

    // Fetch hubs for the Settings edit dialog
    const hubs = useMetahubHubs(metahubId)

    const canLoadAttributes = !!metahubId && !!catalogId && (!hubIdParam || !isCatalogResolutionLoading)

    // Paginated attributes
    const paginationResult = usePaginated<Attribute, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn:
            metahubId && catalogId
                ? (params) =>
                      effectiveHubId
                          ? metahubsQueryKeys.attributesList(metahubId, effectiveHubId, catalogId, {
                                ...params,
                                scope: isSystemView ? 'system' : undefined
                            })
                          : metahubsQueryKeys.attributesListDirect(metahubId, catalogId, {
                                ...params,
                                scope: isSystemView ? 'system' : undefined
                            })
                : () => ['empty'],
        queryFn:
            metahubId && catalogId
                ? (params) =>
                      effectiveHubId
                          ? attributesApi.listAttributes(metahubId, effectiveHubId, catalogId, {
                                ...params,
                                scope: isSystemView ? 'system' : undefined
                            })
                          : attributesApi.listAttributesDirect(metahubId, catalogId, {
                                ...params,
                                scope: isSystemView ? 'system' : undefined
                            })
                : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: canLoadAttributes,
        keepPreviousDataOnQueryKeyChange: false
    })

    const { data: attributes, isLoading, error } = paginationResult

    // Global codenames for duplicate checking
    const isGlobalScope = attributeCodenameScope === 'global'
    const { data: globalCodenamesData } = useQuery({
        queryKey: metahubsQueryKeys.allAttributeCodenames(metahubId ?? '', catalogId ?? ''),
        queryFn: () => attributesApi.listAllAttributeCodenames(metahubId ?? '', catalogId ?? ''),
        enabled: !isSystemView && isGlobalScope && !!metahubId && !!catalogId
    })

    const codenameEntities = useMemo(() => {
        if (isSystemView) return []
        if (isGlobalScope && globalCodenamesData?.items) return globalCodenamesData.items
        return attributes ?? []
    }, [attributes, globalCodenamesData?.items, isGlobalScope, isSystemView])

    const attributesMeta = paginationResult.meta as
        | {
              totalAll?: number
              limit?: number
              limitReached?: boolean
              childSearchMatchParentIds?: string[]
              platformSystemAttributesPolicy?: PlatformSystemAttributesPolicy
          }
        | undefined
    const platformSystemAttributesPolicy = attributesMeta?.platformSystemAttributesPolicy ?? DEFAULT_PLATFORM_SYSTEM_ATTRIBUTES_POLICY
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
        if (!Array.isArray(attributes)) return new Map<string, Attribute>()
        return new Map(attributes.map((attr) => [attr.id, attr]))
    }, [attributes])

    return {
        metahubId,
        hubIdParam,
        catalogId,
        effectiveHubId,
        hubs,
        isSystemView,
        activeCatalogTab,
        isDedicatedSystemRoute,
        requestedCatalogTab,
        isCatalogResolutionLoading,
        catalogResolutionError,
        catalogForHubResolution,
        isLoading,
        error,
        attributes,
        paginationResult,
        searchValue,
        handleSearchChange,
        codenameEntities,
        attributeMap,
        platformSystemAttributesPolicy,
        limitValue,
        totalAttributes,
        limitReached,
        childSearchMatchParentIds,
        attributeCodenameScope
    }
}
