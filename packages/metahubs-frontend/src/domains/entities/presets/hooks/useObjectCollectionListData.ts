import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePaginated, useDebouncedSearch } from '@universo/template-mui'
import { fetchAllPaginatedItems, metahubsQueryKeys } from '../../../shared'
import type { PaginatedResponse } from '../../../../types'
import * as objectsApi from '../api/objectCollections'
import type { ObjectCollectionWithContainers } from '../api/objectCollections'
import { useTreeEntities } from './useTreeEntities'
import { useEntityPermissions } from '../../../settings/hooks/useEntityPermissions'
import { resolveEntityChildKindKey } from '../../../shared/entityMetadataRoutePaths'

export function useObjectCollectionListData() {
    const { metahubId, treeEntityId, kindKey: routeKindKey } = useParams<{ metahubId: string; treeEntityId?: string; kindKey?: string }>()
    const isHubScoped = Boolean(treeEntityId)
    const entityKindKey = resolveEntityChildKindKey({ routeKindKey, childObjectKind: 'object' })

    const { allowCopy, allowDelete, allowAttachExistingEntities } = useEntityPermissions('objectCollection')

    // Fetch treeEntities for the create dialog (N:M relationship)
    const treeEntities = useTreeEntities(metahubId)

    // All objectCollections for codename validation and attach dialog
    const { data: allObjectCollectionsResponse } = useQuery<PaginatedResponse<ObjectCollectionWithContainers>>({
        queryKey: metahubId
            ? metahubsQueryKeys.allObjectCollectionsList(metahubId, {
                  limit: 1000,
                  offset: 0,
                  sortBy: 'sortOrder',
                  sortOrder: 'asc',
                  kindKey: entityKindKey
              })
            : ['metahubs', 'objectCollections', 'all', 'empty'],
        queryFn: async () => {
            if (!metahubId) {
                return { items: [], pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false } }
            }
            return fetchAllPaginatedItems(
                (params) => objectsApi.listAllObjectCollections(metahubId, { ...params, kindKey: entityKindKey }),
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

    // Paginated objectCollections
    const paginationResult = usePaginated<ObjectCollectionWithContainers, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn: metahubId
            ? isHubScoped
                ? (params) => metahubsQueryKeys.objectCollectionsList(metahubId, treeEntityId!, { ...params, kindKey: entityKindKey })
                : (params) => metahubsQueryKeys.allObjectCollectionsList(metahubId, { ...params, kindKey: entityKindKey })
            : () => ['empty'],
        queryFn: metahubId
            ? isHubScoped
                ? (params) => objectsApi.listObjectCollections(metahubId, treeEntityId!, { ...params, kindKey: entityKindKey })
                : (params) => objectsApi.listAllObjectCollections(metahubId, { ...params, kindKey: entityKindKey })
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: !!metahubId && (isHubScoped ? !!treeEntityId : true)
    })

    const { data: objectCollections, isLoading, error } = paginationResult

    // Instant search
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // Sorted objectCollections
    const sortedObjectCollections = useMemo(
        () =>
            [...objectCollections].sort((a, b) => {
                const sortA = a.sortOrder ?? 0
                const sortB = b.sortOrder ?? 0
                if (sortA !== sortB) return sortA - sortB
                return a.id.localeCompare(b.id)
            }),
        [objectCollections]
    )

    // Images map
    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(sortedObjectCollections)) {
            sortedObjectCollections.forEach((object) => {
                if (object?.id) {
                    imagesMap[object.id] = []
                }
            })
        }
        return imagesMap
    }, [sortedObjectCollections])

    // ObjectCollectionEntity lookup map
    const objectMap = useMemo(() => {
        if (!Array.isArray(sortedObjectCollections)) return new Map<string, ObjectCollectionWithContainers>()
        return new Map(sortedObjectCollections.map((object) => [object.id, object]))
    }, [sortedObjectCollections])

    // All objectCollections by id
    const allObjectCollectionsById = useMemo(() => {
        const map = new Map<string, ObjectCollectionWithContainers>()
        const items = allObjectCollectionsResponse?.items ?? []
        items.forEach((object) => map.set(object.id, object))
        return map
    }, [allObjectCollectionsResponse?.items])

    // Existing object codenames for validation
    const existingObjectCodenames = useMemo(
        () => allObjectCollectionsResponse?.items ?? objectCollections ?? [],
        [allObjectCollectionsResponse?.items, objectCollections]
    )

    // Attachable existing objectCollections (exclude already linked and single-hub saturated)
    const attachableExistingObjectCollections = useMemo(() => {
        if (!isHubScoped || !treeEntityId) return []
        return (allObjectCollectionsResponse?.items ?? []).filter((object) => {
            const linkedTreeEntityIds = Array.isArray(object.treeEntities) ? object.treeEntities.map((hub) => hub.id) : []
            if (linkedTreeEntityIds.includes(treeEntityId)) return false
            if (object.isSingleHub && linkedTreeEntityIds.length > 0) return false
            return true
        })
    }, [allObjectCollectionsResponse?.items, treeEntityId, isHubScoped])

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
        sortedObjectCollections,
        images,
        objectMap,
        allObjectCollectionsById,
        existingObjectCodenames,
        attachableExistingObjectCollections,
        allowCopy,
        allowDelete,
        allowAttachExistingEntities
    }
}
