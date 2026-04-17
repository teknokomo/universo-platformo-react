import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { usePaginated, useDebouncedSearch } from '@universo/template-mui'
import { fetchAllPaginatedItems, metahubsQueryKeys } from '../../../shared'
import { resolveEntityChildKindKey } from '../../../shared/entityMetadataRoutePaths'
import { useEntityPermissions } from '../../../settings/hooks/useEntityPermissions'
import * as setsApi from '../api/valueGroups'
import type { ValueGroupWithContainers } from '../api/valueGroups'
import { useTreeEntities } from './useTreeEntities'
import type { PaginatedResponse } from '../../../../types'

export function useValueGroupListData() {
    const { metahubId, treeEntityId, kindKey: routeKindKey } = useParams<{ metahubId: string; treeEntityId?: string; kindKey?: string }>()
    const { i18n } = useTranslation()
    const isHubScoped = Boolean(treeEntityId)
    const { allowCopy, allowDelete, allowAttachExistingEntities } = useEntityPermissions('valueGroup')
    const entityKindKey = resolveEntityChildKindKey({ routeKindKey, childObjectKind: 'set' })

    const treeEntities = useTreeEntities(metahubId)

    const { data: allValueGroupsResponse } = useQuery<PaginatedResponse<ValueGroupWithContainers>>({
        queryKey: metahubId
            ? metahubsQueryKeys.allValueGroupsList(metahubId, {
                  limit: 1000,
                  offset: 0,
                  sortBy: 'sortOrder',
                  sortOrder: 'asc',
                  kindKey: entityKindKey
              })
            : ['metahubs', 'valueGroups', 'all', 'empty'],
        queryFn: async () => {
            if (!metahubId) {
                return { items: [], pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false } }
            }
            return fetchAllPaginatedItems((params) => setsApi.listAllValueGroups(metahubId, { ...params, kindKey: entityKindKey }), {
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

    const paginationResult = usePaginated<ValueGroupWithContainers, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn: metahubId
            ? isHubScoped
                ? (params) => metahubsQueryKeys.valueGroupsList(metahubId, treeEntityId!, { ...params, kindKey: entityKindKey })
                : (params) => metahubsQueryKeys.allValueGroupsList(metahubId, { ...params, kindKey: entityKindKey })
            : () => ['empty'],
        queryFn: metahubId
            ? isHubScoped
                ? (params) => setsApi.listValueGroups(metahubId, treeEntityId!, { ...params, kindKey: entityKindKey })
                : (params) => setsApi.listAllValueGroups(metahubId, { ...params, kindKey: entityKindKey })
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: !!metahubId && (isHubScoped ? !!treeEntityId : true)
    })

    const { data: valueGroups, isLoading, error } = paginationResult
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    const sortedValueGroups = useMemo(
        () =>
            [...valueGroups].sort((a, b) => {
                const sortA = a.sortOrder ?? 0
                const sortB = b.sortOrder ?? 0
                if (sortA !== sortB) return sortA - sortB
                return a.id.localeCompare(b.id)
            }),
        [valueGroups]
    )

    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(sortedValueGroups)) {
            sortedValueGroups.forEach((valueGroup) => {
                if (valueGroup?.id) {
                    imagesMap[valueGroup.id] = []
                }
            })
        }
        return imagesMap
    }, [sortedValueGroups])

    const valueGroupMap = useMemo(() => {
        if (!Array.isArray(sortedValueGroups)) return new Map<string, ValueGroupWithContainers>()
        return new Map(sortedValueGroups.map((valueGroup) => [valueGroup.id, valueGroup]))
    }, [sortedValueGroups])

    const allValueGroupsById = useMemo(() => {
        const map = new Map<string, ValueGroupWithContainers>()
        const items = allValueGroupsResponse?.items ?? []
        items.forEach((valueGroup) => map.set(valueGroup.id, valueGroup))
        return map
    }, [allValueGroupsResponse?.items])

    const existingSetCodenames = useMemo(
        () => allValueGroupsResponse?.items ?? valueGroups ?? [],
        [allValueGroupsResponse?.items, valueGroups]
    )

    const attachableExistingValueGroups = useMemo(() => {
        if (!isHubScoped || !treeEntityId) return []
        return (allValueGroupsResponse?.items ?? []).filter((valueGroup) => {
            const linkedTreeEntityIds = Array.isArray(valueGroup.treeEntities)
                ? valueGroup.treeEntities.map((treeEntity) => treeEntity.id)
                : []
            if (linkedTreeEntityIds.includes(treeEntityId)) return false
            if (valueGroup.isSingleHub && linkedTreeEntityIds.length > 0) return false
            return true
        })
    }, [allValueGroupsResponse?.items, treeEntityId, isHubScoped])

    return {
        metahubId,
        treeEntityId,
        entityKindKey,
        isHubScoped,
        treeEntities,
        allValueGroupsResponse,
        valueGroups,
        isLoading,
        error,
        paginationResult,
        searchValue,
        handleSearchChange,
        sortedValueGroups,
        images,
        valueGroupMap,
        setMap: valueGroupMap,
        allValueGroupsById,
        existingSetCodenames,
        attachableExistingValueGroups,
        allowCopy,
        allowDelete,
        allowAttachExistingEntities
    }
}
