import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePaginated, useDebouncedSearch } from '@universo/template-mui'
import { fetchAllPaginatedItems, metahubsQueryKeys } from '../../shared'
import type { PaginatedResponse } from '../../../types'
import * as enumerationsApi from '../api'
import type { EnumerationWithHubs } from '../api'
import { useMetahubHubs } from '../../hubs/hooks'
import { useEntityPermissions } from '../../settings/hooks/useEntityPermissions'

export function useEnumerationListData() {
    const { metahubId, hubId } = useParams<{ metahubId: string; hubId?: string }>()
    const isHubScoped = Boolean(hubId)

    const { allowCopy, allowDelete, allowAttachExistingEntities } = useEntityPermissions('enumerations')

    // Fetch hubs for the create dialog (N:M relationship)
    const hubs = useMetahubHubs(metahubId)

    // All enumerations for codename validation and attach dialog
    const { data: allEnumerationsResponse } = useQuery<PaginatedResponse<EnumerationWithHubs>>({
        queryKey: metahubId
            ? metahubsQueryKeys.allEnumerationsList(metahubId, { limit: 1000, offset: 0, sortBy: 'sortOrder', sortOrder: 'asc' })
            : ['metahubs', 'enumerations', 'all', 'empty'],
        queryFn: async () => {
            if (!metahubId) {
                return { items: [], pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false } }
            }
            return fetchAllPaginatedItems((params) => enumerationsApi.listAllEnumerations(metahubId, params), {
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

    // Paginated enumerations
    const paginationResult = usePaginated<EnumerationWithHubs, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn: metahubId
            ? isHubScoped
                ? (params) => metahubsQueryKeys.enumerationsList(metahubId, hubId!, params)
                : (params) => metahubsQueryKeys.allEnumerationsList(metahubId, params)
            : () => ['empty'],
        queryFn: metahubId
            ? isHubScoped
                ? (params) => enumerationsApi.listEnumerations(metahubId, hubId!, params)
                : (params) => enumerationsApi.listAllEnumerations(metahubId, params)
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: !!metahubId && (isHubScoped ? !!hubId : true)
    })

    const { data: enumerations, isLoading, error } = paginationResult

    // Instant search
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // Sorted enumerations
    const sortedEnumerations = useMemo(
        () =>
            [...enumerations].sort((a, b) => {
                const sortA = a.sortOrder ?? 0
                const sortB = b.sortOrder ?? 0
                if (sortA !== sortB) return sortA - sortB
                return a.id.localeCompare(b.id)
            }),
        [enumerations]
    )

    // Images map
    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(sortedEnumerations)) {
            sortedEnumerations.forEach((enumeration) => {
                if (enumeration?.id) {
                    imagesMap[enumeration.id] = []
                }
            })
        }
        return imagesMap
    }, [sortedEnumerations])

    // Enumeration lookup map
    const enumerationMap = useMemo(() => {
        if (!Array.isArray(sortedEnumerations)) return new Map<string, EnumerationWithHubs>()
        return new Map(sortedEnumerations.map((enumeration) => [enumeration.id, enumeration]))
    }, [sortedEnumerations])

    // All enumerations by id
    const allEnumerationsById = useMemo(() => {
        const map = new Map<string, EnumerationWithHubs>()
        const items = allEnumerationsResponse?.items ?? []
        items.forEach((enumeration) => map.set(enumeration.id, enumeration))
        return map
    }, [allEnumerationsResponse?.items])

    // Existing enumeration codenames for validation
    const existingEnumerationCodenames = useMemo(
        () => allEnumerationsResponse?.items ?? enumerations ?? [],
        [allEnumerationsResponse?.items, enumerations]
    )

    // Attachable existing enumerations (exclude already linked and single-hub saturated)
    const attachableExistingEnumerations = useMemo(() => {
        if (!isHubScoped || !hubId) return []
        return (allEnumerationsResponse?.items ?? []).filter((enumeration) => {
            const linkedHubIds = Array.isArray(enumeration.hubs) ? enumeration.hubs.map((hub) => hub.id) : []
            if (linkedHubIds.includes(hubId)) return false
            if (enumeration.isSingleHub && linkedHubIds.length > 0) return false
            return true
        })
    }, [allEnumerationsResponse?.items, hubId, isHubScoped])

    return {
        metahubId,
        hubId,
        isHubScoped,
        hubs,
        isLoading,
        error,
        paginationResult,
        searchValue,
        handleSearchChange,
        sortedEnumerations,
        images,
        enumerationMap,
        allEnumerationsById,
        existingEnumerationCodenames,
        attachableExistingEnumerations,
        allowCopy,
        allowDelete,
        allowAttachExistingEntities
    }
}
