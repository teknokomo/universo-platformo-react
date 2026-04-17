import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePaginated, useDebouncedSearch } from '@universo/template-mui'
import { fetchAllPaginatedItems, metahubsQueryKeys } from '../../../shared'
import type { PaginatedResponse } from '../../../../types'
import * as catalogsApi from '../api/linkedCollections'
import type { LinkedCollectionWithContainers } from '../api/linkedCollections'
import { useTreeEntities } from './useTreeEntities'
import { useEntityPermissions } from '../../../settings/hooks/useEntityPermissions'
import { resolveEntityChildKindKey } from '../../../shared/entityMetadataRoutePaths'

export function useLinkedCollectionListData() {
    const { metahubId, treeEntityId, kindKey: routeKindKey } = useParams<{ metahubId: string; treeEntityId?: string; kindKey?: string }>()
    const isHubScoped = Boolean(treeEntityId)
    const entityKindKey = resolveEntityChildKindKey({ routeKindKey, childObjectKind: 'catalog' })

    const { allowCopy, allowDelete, allowAttachExistingEntities } = useEntityPermissions('linkedCollection')

    // Fetch treeEntities for the create dialog (N:M relationship)
    const treeEntities = useTreeEntities(metahubId)

    // All linkedCollections for codename validation and attach dialog
    const { data: allLinkedCollectionsResponse } = useQuery<PaginatedResponse<LinkedCollectionWithContainers>>({
        queryKey: metahubId
            ? metahubsQueryKeys.allLinkedCollectionsList(metahubId, {
                  limit: 1000,
                  offset: 0,
                  sortBy: 'sortOrder',
                  sortOrder: 'asc',
                  kindKey: entityKindKey
              })
            : ['metahubs', 'linkedCollections', 'all', 'empty'],
        queryFn: async () => {
            if (!metahubId) {
                return { items: [], pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false } }
            }
            return fetchAllPaginatedItems(
                (params) => catalogsApi.listAllLinkedCollections(metahubId, { ...params, kindKey: entityKindKey }),
                {
                    limit: 1000,
                    sortBy: 'sortOrder',
                    sortOrder: 'asc'
                }
            )
        },
        enabled: Boolean(metahubId),
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retryOnMount: false,
        staleTime: 5 * 60 * 1000,
        retry: false
    })

    // Paginated linkedCollections
    const paginationResult = usePaginated<LinkedCollectionWithContainers, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn: metahubId
            ? isHubScoped
                ? (params) => metahubsQueryKeys.linkedCollectionsList(metahubId, treeEntityId!, { ...params, kindKey: entityKindKey })
                : (params) => metahubsQueryKeys.allLinkedCollectionsList(metahubId, { ...params, kindKey: entityKindKey })
            : () => ['empty'],
        queryFn: metahubId
            ? isHubScoped
                ? (params) => catalogsApi.listLinkedCollections(metahubId, treeEntityId!, { ...params, kindKey: entityKindKey })
                : (params) => catalogsApi.listAllLinkedCollections(metahubId, { ...params, kindKey: entityKindKey })
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: !!metahubId && (isHubScoped ? !!treeEntityId : true)
    })

    const { data: linkedCollections, isLoading, error } = paginationResult

    // Instant search
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // Sorted linkedCollections
    const sortedLinkedCollections = useMemo(
        () =>
            [...linkedCollections].sort((a, b) => {
                const sortA = a.sortOrder ?? 0
                const sortB = b.sortOrder ?? 0
                if (sortA !== sortB) return sortA - sortB
                return a.id.localeCompare(b.id)
            }),
        [linkedCollections]
    )

    // Images map
    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(sortedLinkedCollections)) {
            sortedLinkedCollections.forEach((catalog) => {
                if (catalog?.id) {
                    imagesMap[catalog.id] = []
                }
            })
        }
        return imagesMap
    }, [sortedLinkedCollections])

    // LinkedCollectionEntity lookup map
    const catalogMap = useMemo(() => {
        if (!Array.isArray(sortedLinkedCollections)) return new Map<string, LinkedCollectionWithContainers>()
        return new Map(sortedLinkedCollections.map((catalog) => [catalog.id, catalog]))
    }, [sortedLinkedCollections])

    // All linkedCollections by id
    const allLinkedCollectionsById = useMemo(() => {
        const map = new Map<string, LinkedCollectionWithContainers>()
        const items = allLinkedCollectionsResponse?.items ?? []
        items.forEach((catalog) => map.set(catalog.id, catalog))
        return map
    }, [allLinkedCollectionsResponse?.items])

    // Existing catalog codenames for validation
    const existingCatalogCodenames = useMemo(
        () => allLinkedCollectionsResponse?.items ?? linkedCollections ?? [],
        [allLinkedCollectionsResponse?.items, linkedCollections]
    )

    // Attachable existing linkedCollections (exclude already linked and single-hub saturated)
    const attachableExistingLinkedCollections = useMemo(() => {
        if (!isHubScoped || !treeEntityId) return []
        return (allLinkedCollectionsResponse?.items ?? []).filter((catalog) => {
            const linkedTreeEntityIds = Array.isArray(catalog.treeEntities) ? catalog.treeEntities.map((hub) => hub.id) : []
            if (linkedTreeEntityIds.includes(treeEntityId)) return false
            if (catalog.isSingleHub && linkedTreeEntityIds.length > 0) return false
            return true
        })
    }, [allLinkedCollectionsResponse?.items, treeEntityId, isHubScoped])

    return {
        metahubId,
        treeEntityId,
        entityKindKey,
        isHubScoped,
        treeEntities,
        isLoading,
        error,
        paginationResult,
        searchValue,
        handleSearchChange,
        sortedLinkedCollections,
        images,
        catalogMap,
        allLinkedCollectionsById,
        existingCatalogCodenames,
        attachableExistingLinkedCollections,
        allowCopy,
        allowDelete,
        allowAttachExistingEntities
    }
}
