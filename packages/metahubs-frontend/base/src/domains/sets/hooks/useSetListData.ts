import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { usePaginated, useDebouncedSearch } from '@universo/template-mui'
import { fetchAllPaginatedItems, metahubsQueryKeys } from '../../shared'
import { useEntityPermissions } from '../../settings/hooks/useEntityPermissions'
import * as setsApi from '../api'
import type { SetWithHubs } from '../api'
import { useMetahubHubs } from '../../hubs/hooks'
import type { PaginatedResponse } from '../../../types'

export function useSetListData() {
    const { metahubId, hubId } = useParams<{ metahubId: string; hubId?: string }>()
    const { i18n } = useTranslation()
    const isHubScoped = Boolean(hubId)
    const { allowCopy, allowDelete, allowAttachExistingEntities } = useEntityPermissions('sets')

    const hubs = useMetahubHubs(metahubId)

    const { data: allSetsResponse } = useQuery<PaginatedResponse<SetWithHubs>>({
        queryKey: metahubId
            ? metahubsQueryKeys.allSetsList(metahubId, { limit: 1000, offset: 0, sortBy: 'sortOrder', sortOrder: 'asc' })
            : ['metahubs', 'sets', 'all', 'empty'],
        queryFn: async () => {
            if (!metahubId) {
                return { items: [], pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false } }
            }
            return fetchAllPaginatedItems((params) => setsApi.listAllSets(metahubId, params), {
                limit: 1000,
                sortBy: 'sortOrder',
                sortOrder: 'asc'
            })
        },
        enabled: Boolean(metahubId),
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retryOnMount: false,
        staleTime: 5 * 60 * 1000,
        retry: false
    })

    const paginationResult = usePaginated<SetWithHubs, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn: metahubId
            ? isHubScoped
                ? (params) => metahubsQueryKeys.setsList(metahubId, hubId!, params)
                : (params) => metahubsQueryKeys.allSetsList(metahubId, params)
            : () => ['empty'],
        queryFn: metahubId
            ? isHubScoped
                ? (params) => setsApi.listSets(metahubId, hubId!, params)
                : (params) => setsApi.listAllSets(metahubId, params)
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: !!metahubId && (isHubScoped ? !!hubId : true)
    })

    const { data: sets, isLoading, error } = paginationResult
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    const sortedSets = useMemo(
        () =>
            [...sets].sort((a, b) => {
                const sortA = a.sortOrder ?? 0
                const sortB = b.sortOrder ?? 0
                if (sortA !== sortB) return sortA - sortB
                return a.id.localeCompare(b.id)
            }),
        [sets]
    )

    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(sortedSets)) {
            sortedSets.forEach((set) => {
                if (set?.id) {
                    imagesMap[set.id] = []
                }
            })
        }
        return imagesMap
    }, [sortedSets])

    const setMap = useMemo(() => {
        if (!Array.isArray(sortedSets)) return new Map<string, SetWithHubs>()
        return new Map(sortedSets.map((set) => [set.id, set]))
    }, [sortedSets])

    const allSetsById = useMemo(() => {
        const map = new Map<string, SetWithHubs>()
        const items = allSetsResponse?.items ?? []
        items.forEach((set) => map.set(set.id, set))
        return map
    }, [allSetsResponse?.items])

    const existingSetCodenames = useMemo(() => allSetsResponse?.items ?? sets ?? [], [allSetsResponse?.items, sets])

    const attachableExistingSets = useMemo(() => {
        if (!isHubScoped || !hubId) return []
        return (allSetsResponse?.items ?? []).filter((set) => {
            const linkedHubIds = Array.isArray(set.hubs) ? set.hubs.map((hub) => hub.id) : []
            if (linkedHubIds.includes(hubId)) return false
            if (set.isSingleHub && linkedHubIds.length > 0) return false
            return true
        })
    }, [allSetsResponse?.items, hubId, isHubScoped])

    return {
        metahubId,
        hubId,
        isHubScoped,
        hubs,
        allSetsResponse,
        sets,
        isLoading,
        error,
        paginationResult,
        searchValue,
        handleSearchChange,
        sortedSets,
        images,
        setMap,
        allSetsById,
        existingSetCodenames,
        attachableExistingSets,
        allowCopy,
        allowDelete,
        allowAttachExistingEntities
    }
}
