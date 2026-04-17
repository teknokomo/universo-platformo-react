import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePaginated, useDebouncedSearch } from '@universo/template-mui'
import { fetchAllPaginatedItems, metahubsQueryKeys } from '../../../shared'
import type { PaginatedResponse } from '../../../../types'
import { TreeEntity } from '../../../../types'
import * as hubsApi from '../api/trees'
import { useEntityPermissions } from '../../../settings/hooks/useEntityPermissions'

export function useTreeEntityListData() {
    const { metahubId, treeEntityId, kindKey } = useParams<{ metahubId: string; treeEntityId?: string; kindKey?: string }>()
    const isHubScoped = Boolean(treeEntityId)

    const {
        allowCopy,
        allowDelete,
        allowAttachExistingEntities,
        allowTreeEntityNesting: allowHubNesting
    } = useEntityPermissions('treeEntity')

    // Paginated treeEntities (child treeEntities in hub-scoped mode, all treeEntities otherwise)
    const paginationResult = usePaginated<TreeEntity, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn: metahubId
            ? (params) =>
                  isHubScoped && treeEntityId
                      ? metahubsQueryKeys.childTreeEntitiesList(metahubId, treeEntityId, { ...params, kindKey })
                      : metahubsQueryKeys.treeEntitiesList(metahubId, { ...params, kindKey })
            : () => ['empty'],
        queryFn: metahubId
            ? (params) =>
                  isHubScoped && treeEntityId
                      ? hubsApi.listChildTreeEntities(metahubId, treeEntityId, { ...params, kindKey })
                      : hubsApi.listTreeEntities(metahubId, { ...params, kindKey })
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: !!metahubId,
        keepPreviousDataOnQueryKeyChange: !isHubScoped
    })

    const { data: treeEntities, isLoading, error } = paginationResult

    // All treeEntities for attach dialog and parent resolution
    const { data: allTreeEntitiesResponse } = useQuery<PaginatedResponse<TreeEntity>>({
        queryKey: metahubId
            ? metahubsQueryKeys.treeEntitiesList(metahubId, { limit: 1000, offset: 0, sortBy: 'sortOrder', sortOrder: 'asc', kindKey })
            : ['treeEntities-all'],
        enabled: Boolean(metahubId),
        queryFn: () =>
            fetchAllPaginatedItems((params) => hubsApi.listTreeEntities(String(metahubId), { ...params, kindKey }), {
                limit: 1000,
                sortBy: 'sortOrder',
                sortOrder: 'asc'
            })
    })
    const allTreeEntities = useMemo(() => allTreeEntitiesResponse?.items ?? [], [allTreeEntitiesResponse?.items])

    // Instant search
    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // Sorted treeEntities
    const sortedTreeEntities = useMemo(
        () =>
            [...treeEntities].sort((a, b) => {
                const sortA = a.sortOrder ?? 0
                const sortB = b.sortOrder ?? 0
                if (sortA !== sortB) return sortA - sortB
                return a.id.localeCompare(b.id)
            }),
        [treeEntities]
    )

    // Images map
    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(sortedTreeEntities)) {
            sortedTreeEntities.forEach((hub) => {
                if (hub?.id) {
                    imagesMap[hub.id] = []
                }
            })
        }
        return imagesMap
    }, [sortedTreeEntities])

    // TreeEntity lookup map
    const treeEntityMap = useMemo(() => {
        if (!Array.isArray(sortedTreeEntities)) return new Map<string, TreeEntity>()
        return new Map(sortedTreeEntities.map((treeEntity) => [treeEntity.id, treeEntity]))
    }, [sortedTreeEntities])

    // All treeEntities by id (for parent resolution and attach dialog)
    const allTreeEntitiesById = useMemo(() => {
        const map = new Map<string, TreeEntity>()
        allTreeEntities.forEach((treeEntity) => map.set(treeEntity.id, treeEntity))
        return map
    }, [allTreeEntities])

    // Ancestor ids for current hub (cycle-safe)
    const currentHubAncestorIds = useMemo(() => {
        const ancestors = new Set<string>()
        if (!isHubScoped || !treeEntityId) return ancestors

        let current: string | null | undefined = treeEntityId
        const visited = new Set<string>()
        while (current && !visited.has(current)) {
            visited.add(current)
            const parentTreeEntityId = allTreeEntitiesById.get(current)?.parentTreeEntityId
            if (!parentTreeEntityId) break
            ancestors.add(parentTreeEntityId)
            current = parentTreeEntityId
        }

        return ancestors
    }, [allTreeEntitiesById, treeEntityId, isHubScoped])

    // Attachable existing treeEntities (exclude current, children, and ancestors)
    const attachableExistingTreeEntities = useMemo(() => {
        if (!isHubScoped || !treeEntityId) return []
        return allTreeEntities.filter((treeEntity) => {
            if (treeEntity.id === treeEntityId) return false
            if (treeEntity.parentTreeEntityId === treeEntityId) return false
            if (currentHubAncestorIds.has(treeEntity.id)) return false
            return true
        })
    }, [allTreeEntities, currentHubAncestorIds, treeEntityId, isHubScoped])

    return {
        metahubId,
        treeEntityId,
        isHubScoped,
        treeEntities,
        isLoading,
        error,
        paginationResult,
        handleSearchChange,
        sortedTreeEntities,
        images,
        treeEntityMap,
        hubMap: treeEntityMap,
        allTreeEntities,
        allTreeEntitiesById,
        attachableExistingTreeEntities,
        allowCopy,
        allowDelete,
        allowAttachExistingEntities,
        allowHubNesting
    }
}
