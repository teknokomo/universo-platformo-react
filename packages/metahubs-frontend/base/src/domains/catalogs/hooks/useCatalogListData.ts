import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePaginated, useDebouncedSearch } from '@universo/template-mui'
import { fetchAllPaginatedItems, metahubsQueryKeys } from '../../shared'
import type { PaginatedResponse } from '../../../types'
import * as catalogsApi from '../api'
import type { CatalogWithHubs } from '../api'
import { useMetahubHubs } from '../../hubs/hooks'
import { useEntityPermissions } from '../../settings/hooks/useEntityPermissions'

export function useCatalogListData() {
    const { metahubId, hubId } = useParams<{ metahubId: string; hubId?: string }>()
    const isHubScoped = Boolean(hubId)

    const { allowCopy, allowDelete, allowAttachExistingEntities } = useEntityPermissions('catalogs')

    // Fetch hubs for the create dialog (N:M relationship)
    const hubs = useMetahubHubs(metahubId)

    // All catalogs for codename validation and attach dialog
    const { data: allCatalogsResponse } = useQuery<PaginatedResponse<CatalogWithHubs>>({
        queryKey: metahubId
            ? metahubsQueryKeys.allCatalogsList(metahubId, { limit: 1000, offset: 0, sortBy: 'sortOrder', sortOrder: 'asc' })
            : ['metahubs', 'catalogs', 'all', 'empty'],
        queryFn: async () => {
            if (!metahubId) {
                return { items: [], pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false } }
            }
            return fetchAllPaginatedItems((params) => catalogsApi.listAllCatalogs(metahubId, params), {
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

    // Paginated catalogs
    const paginationResult = usePaginated<CatalogWithHubs, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn: metahubId
            ? isHubScoped
                ? (params) => metahubsQueryKeys.catalogsList(metahubId, hubId!, params)
                : (params) => metahubsQueryKeys.allCatalogsList(metahubId, params)
            : () => ['empty'],
        queryFn: metahubId
            ? isHubScoped
                ? (params) => catalogsApi.listCatalogs(metahubId, hubId!, params)
                : (params) => catalogsApi.listAllCatalogs(metahubId, params)
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: !!metahubId && (isHubScoped ? !!hubId : true)
    })

    const { data: catalogs, isLoading, error } = paginationResult

    // Instant search
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // Sorted catalogs
    const sortedCatalogs = useMemo(
        () =>
            [...catalogs].sort((a, b) => {
                const sortA = a.sortOrder ?? 0
                const sortB = b.sortOrder ?? 0
                if (sortA !== sortB) return sortA - sortB
                return a.id.localeCompare(b.id)
            }),
        [catalogs]
    )

    // Images map
    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(sortedCatalogs)) {
            sortedCatalogs.forEach((catalog) => {
                if (catalog?.id) {
                    imagesMap[catalog.id] = []
                }
            })
        }
        return imagesMap
    }, [sortedCatalogs])

    // Catalog lookup map
    const catalogMap = useMemo(() => {
        if (!Array.isArray(sortedCatalogs)) return new Map<string, CatalogWithHubs>()
        return new Map(sortedCatalogs.map((catalog) => [catalog.id, catalog]))
    }, [sortedCatalogs])

    // All catalogs by id
    const allCatalogsById = useMemo(() => {
        const map = new Map<string, CatalogWithHubs>()
        const items = allCatalogsResponse?.items ?? []
        items.forEach((catalog) => map.set(catalog.id, catalog))
        return map
    }, [allCatalogsResponse?.items])

    // Existing catalog codenames for validation
    const existingCatalogCodenames = useMemo(() => allCatalogsResponse?.items ?? catalogs ?? [], [allCatalogsResponse?.items, catalogs])

    // Attachable existing catalogs (exclude already linked and single-hub saturated)
    const attachableExistingCatalogs = useMemo(() => {
        if (!isHubScoped || !hubId) return []
        return (allCatalogsResponse?.items ?? []).filter((catalog) => {
            const linkedHubIds = Array.isArray(catalog.hubs) ? catalog.hubs.map((hub) => hub.id) : []
            if (linkedHubIds.includes(hubId)) return false
            if (catalog.isSingleHub && linkedHubIds.length > 0) return false
            return true
        })
    }, [allCatalogsResponse?.items, hubId, isHubScoped])

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
        sortedCatalogs,
        images,
        catalogMap,
        allCatalogsById,
        existingCatalogCodenames,
        attachableExistingCatalogs,
        allowCopy,
        allowDelete,
        allowAttachExistingEntities
    }
}
