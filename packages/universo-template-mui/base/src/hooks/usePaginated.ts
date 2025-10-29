import { useQuery, UseQueryResult, QueryKey, keepPreviousData } from '@tanstack/react-query'
import { useMemo, useState, useCallback } from 'react'
import type { PaginationParams, PaginatedResponse, PaginationState, PaginationActions } from '../types/pagination'

export interface UsePaginatedParams<TSortBy extends string = string> {
    /**
     * Query key factory function that generates cache keys with params
     */
    queryKeyFn: (params: PaginationParams) => QueryKey

    /**
     * API function that fetches paginated data
     */
    queryFn: (params: PaginationParams) => Promise<PaginatedResponse<any>>

    /**
     * Initial items per page (defaults to 20)
     * @deprecated Use initialLimit instead for clarity
     */
    limit?: number

    /**
     * Initial items per page (defaults to 20)
     */
    initialLimit?: number

    /**
     * Initial page number (1-based)
     */
    initialPage?: number

    /**
     * Initial sort field
     */
    sortBy?: TSortBy

    /**
     * Initial sort direction
     */
    sortOrder?: 'asc' | 'desc'

    /**
     * Initial search query
     */
    search?: string

    /**
     * Whether to enable the query immediately
     */
    enabled?: boolean

    /**
     * Cache time in milliseconds
     */
    staleTime?: number
}

export interface UsePaginatedReturn<TData> {
    // Data
    data: TData[]
    pagination: PaginationState

    // State
    isLoading: boolean
    isError: boolean
    error: Error | null

    // Actions
    actions: PaginationActions
}

/**
 * Universal pagination hook for TanStack Query v5
 *
 * @example
 * ```typescript
 * const { data, pagination, isLoading, actions } = usePaginated({
 *   queryKeyFn: (params) => ['metaverses', 'list', params],
 *   queryFn: (params) => metaversesApi.listMetaverses(params),
 *   limit: 20,
 *   sortBy: 'updated',
 *   sortOrder: 'desc'
 * })
 * ```
 */
export function usePaginated<TData = any, TSortBy extends string = string>(params: UsePaginatedParams<TSortBy>): UsePaginatedReturn<TData> {
    const {
        queryKeyFn,
        queryFn,
        limit, // deprecated, kept for backward compatibility
        initialLimit,
        initialPage = 1,
        sortBy = 'updated' as TSortBy,
        sortOrder = 'desc',
        search: initialSearch = '',
        enabled = true,
        staleTime = 5 * 60 * 1000 // 5 minutes default
    } = params

    // Determine initial page size (prefer initialLimit, fallback to limit, default to 20)
    const initialPageSize = initialLimit ?? limit ?? 20

    // Local state for pagination
    const [currentPage, setCurrentPage] = useState(initialPage)
    const [pageSize, setPageSizeState] = useState(initialPageSize)
    const [searchQuery, setSearchQuery] = useState(initialSearch)
    const [currentSort, setCurrentSort] = useState({ sortBy: sortBy as string, sortOrder })

    // Calculate offset from page number
    const offset = useMemo(() => (currentPage - 1) * pageSize, [currentPage, pageSize])

    // Build query params
    const queryParams: PaginationParams = useMemo(
        () => ({
            limit: pageSize,
            offset,
            sortBy: currentSort.sortBy,
            sortOrder: currentSort.sortOrder,
            search: searchQuery || undefined
        }),
        [pageSize, offset, currentSort, searchQuery]
    )

    // Main query
    const query: UseQueryResult<PaginatedResponse<TData>, Error> = useQuery({
        queryKey: queryKeyFn(queryParams),
        queryFn: () => queryFn(queryParams),
        enabled,
        staleTime,
        placeholderData: keepPreviousData,
        retry: (failureCount: number, error: any) => {
            const status = error?.response?.status
            if ([401, 403, 404].includes(status)) return false
            return failureCount < 2
        }
    })

    // Pagination calculations
    const totalPages = useMemo(() => {
        if (!query.data) return 0
        return Math.ceil(query.data.pagination.total / pageSize)
    }, [query.data, pageSize])

    const hasNextPage = useMemo(() => currentPage < totalPages, [currentPage, totalPages])
    const hasPreviousPage = useMemo(() => currentPage > 1, [currentPage])

    // Actions
    const goToPage = useCallback(
        (page: number) => {
            const clampedPage = Math.max(1, Math.min(page, totalPages || 1))
            setCurrentPage(clampedPage)
        },
        [totalPages]
    )

    const nextPage = useCallback(() => {
        if (hasNextPage) {
            setCurrentPage((prev) => prev + 1)
        }
    }, [hasNextPage])

    const previousPage = useCallback(() => {
        if (hasPreviousPage) {
            setCurrentPage((prev) => prev - 1)
        }
    }, [hasPreviousPage])

    const setSearch = useCallback((search: string) => {
        setSearchQuery(search)
        setCurrentPage(1) // Reset to first page on search
    }, [])

    const setSort = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
        setCurrentSort({ sortBy, sortOrder })
        setCurrentPage(1) // Reset to first page on sort change
    }, [])

    const setPageSize = useCallback((newPageSize: number) => {
        setPageSizeState(newPageSize)
        setCurrentPage(1) // Reset to first page when changing page size
    }, [])

    return {
        data: query.data?.items ?? [],
        pagination: {
            currentPage,
            pageSize,
            totalItems: query.data?.pagination.total ?? 0,
            totalPages,
            hasNextPage,
            hasPreviousPage
        },
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        actions: {
            goToPage,
            nextPage,
            previousPage,
            setSearch,
            setSort,
            setPageSize
        }
    }
}
