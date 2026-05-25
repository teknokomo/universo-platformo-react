import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePaginated, useDebouncedSearch } from '@universo/template-mui'
import { fetchAllPaginatedItems, metahubsQueryKeys } from '../../../shared'
import { resolveEntityChildKindKey } from '../../../shared/entityMetadataRoutePaths'
import type { PaginatedResponse } from '../../../../types'
import * as enumerationsApi from '../api/optionLists'
import type { OptionListWithContainers } from '../api/optionLists'
import { useTreeEntities } from './useTreeEntities'
import { useEntityPermissions } from '../../../settings/hooks/useEntityPermissions'

export function useOptionListData() {
    const { metahubId, treeEntityId, kindKey: routeKindKey } = useParams<{ metahubId: string; treeEntityId?: string; kindKey?: string }>()
    const isHubScoped = Boolean(treeEntityId)
    const entityKindKey = resolveEntityChildKindKey({ routeKindKey, childObjectKind: 'enumeration' })

    const { allowCopy, allowDelete, allowAttachExistingEntities } = useEntityPermissions('optionList')

    // Fetch treeEntities for the create dialog (N:M relationship)
    const treeEntities = useTreeEntities(metahubId)

    // All optionLists for codename validation and attach dialog
    const { data: allOptionListsResponse } = useQuery<PaginatedResponse<OptionListWithContainers>>({
        queryKey: metahubId
            ? metahubsQueryKeys.allOptionListsList(metahubId, {
                  limit: 1000,
                  offset: 0,
                  sortBy: 'sortOrder',
                  sortOrder: 'asc',
                  kindKey: entityKindKey
              })
            : ['metahubs', 'optionLists', 'all', 'empty'],
        queryFn: async () => {
            if (!metahubId) {
                return { items: [], pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false } }
            }
            return fetchAllPaginatedItems(
                (params) => enumerationsApi.listAllOptionLists(metahubId, { ...params, kindKey: entityKindKey }),
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

    // Paginated optionLists
    const paginationResult = usePaginated<OptionListWithContainers, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn: metahubId
            ? isHubScoped
                ? (params) => metahubsQueryKeys.optionListsList(metahubId, treeEntityId!, { ...params, kindKey: entityKindKey })
                : (params) => metahubsQueryKeys.allOptionListsList(metahubId, { ...params, kindKey: entityKindKey })
            : () => ['empty'],
        queryFn: metahubId
            ? isHubScoped
                ? (params) => enumerationsApi.listOptionLists(metahubId, treeEntityId!, { ...params, kindKey: entityKindKey })
                : (params) => enumerationsApi.listAllOptionLists(metahubId, { ...params, kindKey: entityKindKey })
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: !!metahubId && (isHubScoped ? !!treeEntityId : true)
    })

    const { data: optionLists, isLoading, error } = paginationResult

    // Instant search
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // Sorted optionLists
    const sortedOptionLists = useMemo(
        () =>
            [...optionLists].sort((a, b) => {
                const sortA = a.sortOrder ?? 0
                const sortB = b.sortOrder ?? 0
                if (sortA !== sortB) return sortA - sortB
                return a.id.localeCompare(b.id)
            }),
        [optionLists]
    )

    // Images map
    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(sortedOptionLists)) {
            sortedOptionLists.forEach((enumeration) => {
                if (enumeration?.id) {
                    imagesMap[enumeration.id] = []
                }
            })
        }
        return imagesMap
    }, [sortedOptionLists])

    // OptionListEntity lookup map
    const enumerationMap = useMemo(() => {
        if (!Array.isArray(sortedOptionLists)) return new Map<string, OptionListWithContainers>()
        return new Map(sortedOptionLists.map((enumeration) => [enumeration.id, enumeration]))
    }, [sortedOptionLists])

    // All optionLists by id
    const allOptionListsById = useMemo(() => {
        const map = new Map<string, OptionListWithContainers>()
        const items = allOptionListsResponse?.items ?? []
        items.forEach((enumeration) => map.set(enumeration.id, enumeration))
        return map
    }, [allOptionListsResponse?.items])

    // Existing enumeration codenames for validation
    const existingEnumerationCodenames = useMemo(
        () => allOptionListsResponse?.items ?? optionLists ?? [],
        [allOptionListsResponse?.items, optionLists]
    )

    // Attachable existing optionLists (exclude already linked and single-hub saturated)
    const attachableExistingOptionLists = useMemo(() => {
        if (!isHubScoped || !treeEntityId) return []
        return (allOptionListsResponse?.items ?? []).filter((enumeration) => {
            const linkedTreeEntityIds = Array.isArray(enumeration.treeEntities) ? enumeration.treeEntities.map((hub) => hub.id) : []
            if (linkedTreeEntityIds.includes(treeEntityId)) return false
            if (enumeration.isSingleHub && linkedTreeEntityIds.length > 0) return false
            return true
        })
    }, [allOptionListsResponse?.items, treeEntityId, isHubScoped])

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
        sortedOptionLists,
        images,
        enumerationMap,
        allOptionListsById,
        existingEnumerationCodenames,
        attachableExistingOptionLists,
        allowCopy,
        allowDelete,
        allowAttachExistingEntities
    }
}
