/**
 * Shared hook for fetching all treeEntities within a metahub.
 *
 * Multiple List components (LinkedCollections, ValueGroups, OptionLists, FieldDefinitions, Records, etc.)
 * need the full hub list for create/edit dialogs and hub association UI.
 * This hook centralizes the query with consistent caching and deduplication.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAllPaginatedItems, metahubsQueryKeys } from '../../../shared'
import type { PaginatedResponse, TreeEntity } from '../../../../types'
import * as hubsApi from '../api/trees'

const hubsListParams = { limit: 1000, offset: 0, sortBy: 'sortOrder' as const, sortOrder: 'asc' as const }

export function useTreeEntities(metahubId: string | undefined) {
    const { data: hubsData } = useQuery<PaginatedResponse<TreeEntity>>({
        queryKey: metahubId ? metahubsQueryKeys.treeEntitiesList(metahubId, hubsListParams) : ['metahubs', 'treeEntities', 'list', 'empty'],
        queryFn: async () => {
            if (!metahubId) {
                return { items: [], pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false } }
            }
            return fetchAllPaginatedItems((params) => hubsApi.listTreeEntities(metahubId, params), {
                limit: hubsListParams.limit,
                sortBy: hubsListParams.sortBy,
                sortOrder: hubsListParams.sortOrder
            })
        },
        enabled: !!metahubId,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retryOnMount: false,
        staleTime: 5 * 60 * 1000,
        retry: false
    })

    const treeEntities = useMemo(() => hubsData?.items ?? [], [hubsData?.items])

    return treeEntities
}
