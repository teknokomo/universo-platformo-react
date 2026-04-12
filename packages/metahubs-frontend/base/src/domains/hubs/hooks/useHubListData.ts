import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePaginated, useDebouncedSearch } from '@universo/template-mui'
import { fetchAllPaginatedItems, metahubsQueryKeys } from '../../shared'
import type { PaginatedResponse } from '../../../types'
import { Hub } from '../../../types'
import * as hubsApi from '../api'
import { useEntityPermissions } from '../../settings/hooks/useEntityPermissions'

export function useHubListData() {
    const { metahubId, hubId, kindKey } = useParams<{ metahubId: string; hubId?: string; kindKey?: string }>()
    const isHubScoped = Boolean(hubId)

    const { allowCopy, allowDelete, allowAttachExistingEntities, allowHubNesting } = useEntityPermissions('hubs')

    // Paginated hubs (child hubs in hub-scoped mode, all hubs otherwise)
    const paginationResult = usePaginated<Hub, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn: metahubId
            ? (params) =>
                  isHubScoped && hubId
                      ? metahubsQueryKeys.childHubsList(metahubId, hubId, { ...params, kindKey })
                      : metahubsQueryKeys.hubsList(metahubId, { ...params, kindKey })
            : () => ['empty'],
        queryFn: metahubId
            ? (params) =>
                  isHubScoped && hubId
                      ? hubsApi.listChildHubs(metahubId, hubId, { ...params, kindKey })
                      : hubsApi.listHubs(metahubId, { ...params, kindKey })
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: !!metahubId,
        keepPreviousDataOnQueryKeyChange: !isHubScoped
    })

    const { data: hubs, isLoading, error } = paginationResult

    // All hubs for attach dialog and parent resolution
    const { data: allHubsResponse } = useQuery<PaginatedResponse<Hub>>({
        queryKey: metahubId
            ? metahubsQueryKeys.hubsList(metahubId, { limit: 1000, offset: 0, sortBy: 'sortOrder', sortOrder: 'asc', kindKey })
            : ['hubs-all'],
        enabled: Boolean(metahubId),
        queryFn: () =>
            fetchAllPaginatedItems((params) => hubsApi.listHubs(String(metahubId), { ...params, kindKey }), {
                limit: 1000,
                sortBy: 'sortOrder',
                sortOrder: 'asc'
            })
    })
    const allHubs = useMemo(() => allHubsResponse?.items ?? [], [allHubsResponse?.items])

    // Instant search
    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // Sorted hubs
    const sortedHubs = useMemo(
        () =>
            [...hubs].sort((a, b) => {
                const sortA = a.sortOrder ?? 0
                const sortB = b.sortOrder ?? 0
                if (sortA !== sortB) return sortA - sortB
                return a.id.localeCompare(b.id)
            }),
        [hubs]
    )

    // Images map
    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(sortedHubs)) {
            sortedHubs.forEach((hub) => {
                if (hub?.id) {
                    imagesMap[hub.id] = []
                }
            })
        }
        return imagesMap
    }, [sortedHubs])

    // Hub lookup map
    const hubMap = useMemo(() => {
        if (!Array.isArray(sortedHubs)) return new Map<string, Hub>()
        return new Map(sortedHubs.map((hub) => [hub.id, hub]))
    }, [sortedHubs])

    // All hubs by id (for parent resolution and attach dialog)
    const allHubsById = useMemo(() => {
        const map = new Map<string, Hub>()
        allHubs.forEach((hub) => map.set(hub.id, hub))
        return map
    }, [allHubs])

    // Ancestor ids for current hub (cycle-safe)
    const currentHubAncestorIds = useMemo(() => {
        const ancestors = new Set<string>()
        if (!isHubScoped || !hubId) return ancestors

        let current: string | null | undefined = hubId
        const visited = new Set<string>()
        while (current && !visited.has(current)) {
            visited.add(current)
            const parentHubId = allHubsById.get(current)?.parentHubId
            if (!parentHubId) break
            ancestors.add(parentHubId)
            current = parentHubId
        }

        return ancestors
    }, [allHubsById, hubId, isHubScoped])

    // Attachable existing hubs (exclude current, children, and ancestors)
    const attachableExistingHubs = useMemo(() => {
        if (!isHubScoped || !hubId) return []
        return allHubs.filter((hub) => {
            if (hub.id === hubId) return false
            if (hub.parentHubId === hubId) return false
            if (currentHubAncestorIds.has(hub.id)) return false
            return true
        })
    }, [allHubs, currentHubAncestorIds, hubId, isHubScoped])

    return {
        metahubId,
        hubId,
        isHubScoped,
        hubs,
        isLoading,
        error,
        paginationResult,
        handleSearchChange,
        sortedHubs,
        images,
        hubMap,
        allHubs,
        allHubsById,
        attachableExistingHubs,
        allowCopy,
        allowDelete,
        allowAttachExistingEntities,
        allowHubNesting
    }
}
