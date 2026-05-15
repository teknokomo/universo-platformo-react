import { useMemo } from 'react'
import { useParams, useSearchParams, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePaginated, useDebouncedSearch } from '@universo/template-mui'
import { metahubsQueryKeys } from '../../../../shared'
import type { Component } from '../../../../../types'
import { DEFAULT_PLATFORM_SYSTEM_COMPONENTS_POLICY, type PlatformSystemComponentsPolicy } from '@universo/types'
import * as componentsApi from '../api'
import { getObjectCollectionById } from '../../../presets/api/objectCollections'
import { useTreeEntities } from '../../../presets/hooks/useTreeEntities'
import { useSettingValue } from '../../../../settings/hooks/useSettings'
import type { ObjectTab } from './componentListUtils'
import { resolveEntityChildKindKey } from '../../../../shared/entityMetadataRoutePaths'

type UseComponentListDataOptions = {
    metahubId?: string
    treeEntityId?: string | null
    objectCollectionId?: string
    resolveObjectDetails?: boolean
    allowSystemView?: boolean
    includeSharedEntities?: boolean
}

export function useComponentListData(options: UseComponentListDataOptions = {}) {
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const {
        metahubId: routeMetahubId,
        treeEntityId: routeTreeEntityIdParam,
        objectCollectionId: routeObjectCollectionId,
        kindKey: routeKindKey
    } = useParams<{ metahubId: string; treeEntityId?: string; objectCollectionId: string; kindKey?: string }>()
    const metahubId = options.metahubId ?? routeMetahubId
    const hubIdParam = options.treeEntityId ?? routeTreeEntityIdParam
    const objectCollectionId = options.objectCollectionId ?? routeObjectCollectionId
    const entityKindKey = resolveEntityChildKindKey({ routeKindKey, childObjectKind: 'object' })
    const resolveObjectDetails = options.resolveObjectDetails ?? true
    const allowSystemView = options.allowSystemView ?? true
    const includeSharedEntities = options.includeSharedEntities ?? true

    const requestedObjectTab = searchParams.get('tab')
    const isDedicatedSystemRoute = location.pathname.endsWith('/system')
    const activeObjectTab: Extract<ObjectTab, 'components' | 'system'> =
        allowSystemView && (isDedicatedSystemRoute || requestedObjectTab === 'system') ? 'system' : 'components'
    const isSystemView = activeObjectTab === 'system'
    const includeShared = includeSharedEntities && !isSystemView
    const componentCodenameScope = useSettingValue<string>('entity.object.componentCodenameScope') ?? 'per-level'

    // Resolve hub from object when treeEntityId is not in URL
    const {
        data: objectForHubResolution,
        isLoading: isObjectResolutionLoading,
        error: objectResolutionError
    } = useQuery({
        queryKey:
            metahubId && objectCollectionId
                ? metahubsQueryKeys.objectCollectionDetail(metahubId, objectCollectionId, entityKindKey)
                : ['metahubs', 'objectCollections', 'detail', 'empty'],
        queryFn: async () => {
            if (!metahubId || !objectCollectionId) {
                throw new Error('metahubId and objectCollectionId are required')
            }
            return getObjectCollectionById(metahubId, objectCollectionId, entityKindKey)
        },
        enabled: resolveObjectDetails && !!metahubId && !!objectCollectionId && !hubIdParam
    })

    const effectiveTreeEntityId = hubIdParam || objectForHubResolution?.treeEntities?.[0]?.id

    // Fetch treeEntities for the Settings edit dialog
    const treeEntities = useTreeEntities(metahubId)

    const canLoadComponents = !!metahubId && !!objectCollectionId && (!hubIdParam || !isObjectResolutionLoading)

    // Paginated components
    const paginationResult = usePaginated<Component, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn:
            metahubId && objectCollectionId
                ? (params) =>
                      effectiveTreeEntityId
                          ? metahubsQueryKeys.componentsList(metahubId, effectiveTreeEntityId, objectCollectionId, {
                                ...params,
                                scope: isSystemView ? 'system' : undefined,
                                includeShared
                            })
                          : metahubsQueryKeys.componentsListDirect(metahubId, objectCollectionId, {
                                ...params,
                                scope: isSystemView ? 'system' : undefined,
                                includeShared
                            })
                : () => ['empty'],
        queryFn:
            metahubId && objectCollectionId
                ? (params) =>
                      effectiveTreeEntityId
                          ? componentsApi.listComponents(metahubId, effectiveTreeEntityId, objectCollectionId, {
                                ...params,
                                scope: isSystemView ? 'system' : undefined,
                                includeShared
                            })
                          : componentsApi.listComponentsDirect(metahubId, objectCollectionId, {
                                ...params,
                                scope: isSystemView ? 'system' : undefined,
                                includeShared
                            })
                : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: canLoadComponents,
        keepPreviousDataOnQueryKeyChange: false
    })

    const { data: components, isLoading, error } = paginationResult

    // Global codenames for duplicate checking
    const isGlobalScope = componentCodenameScope === 'global'
    const { data: globalCodenamesData } = useQuery({
        queryKey: metahubsQueryKeys.allComponentCodenames(metahubId ?? '', objectCollectionId ?? ''),
        queryFn: () => componentsApi.listAllComponentCodenames(metahubId ?? '', objectCollectionId ?? ''),
        enabled: !isSystemView && isGlobalScope && !!metahubId && !!objectCollectionId
    })

    const codenameEntities = useMemo(() => {
        if (isSystemView) return []
        if (isGlobalScope && globalCodenamesData?.items) return globalCodenamesData.items
        return components ?? []
    }, [components, globalCodenamesData?.items, isGlobalScope, isSystemView])

    const componentsMeta = paginationResult.meta as
        | {
              totalAll?: number
              limit?: number
              limitReached?: boolean
              childSearchMatchParentIds?: string[]
              platformSystemComponentsPolicy?: PlatformSystemComponentsPolicy
          }
        | undefined
    const platformSystemComponentsPolicy = componentsMeta?.platformSystemComponentsPolicy ?? DEFAULT_PLATFORM_SYSTEM_COMPONENTS_POLICY
    const limitValue = componentsMeta?.limit ?? 100
    const totalComponents = componentsMeta?.totalAll ?? paginationResult.pagination.totalItems
    const limitReached = componentsMeta?.limitReached ?? totalComponents >= limitValue
    const childSearchMatchParentIds = useMemo(
        () => componentsMeta?.childSearchMatchParentIds ?? [],
        [componentsMeta?.childSearchMatchParentIds]
    )

    // Instant search
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // Component lookup map
    const componentMap = useMemo(() => {
        if (!Array.isArray(components)) return new Map<string, Component>()
        return new Map(components.map((cmp) => [cmp.id, cmp]))
    }, [components])

    return {
        metahubId,
        hubIdParam,
        objectCollectionId,
        effectiveTreeEntityId,
        treeEntities,
        isSystemView,
        activeObjectTab,
        isDedicatedSystemRoute,
        requestedObjectTab,
        isObjectResolutionLoading,
        objectResolutionError,
        objectForHubResolution,
        isLoading,
        error,
        components,
        paginationResult,
        searchValue,
        handleSearchChange,
        codenameEntities,
        componentMap,
        platformSystemComponentsPolicy,
        limitValue,
        totalComponents,
        limitReached,
        childSearchMatchParentIds,
        componentCodenameScope,
        includeShared
    }
}
