/**
 * Universal pagination types for TanStack Query v5 integration
 *
 * Used across all applications requiring server-side pagination.
 */

export interface PaginationParams {
    limit?: number
    offset?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    search?: string
}

export interface PaginationMeta {
    limit: number
    offset: number
    count: number
    total: number
    hasMore: boolean
}

export interface PaginatedResponse<T> {
    items: T[]
    pagination: PaginationMeta
}

/**
 * Generic pagination state returned by usePaginated hook
 */
export interface PaginationState {
    currentPage: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
}

/**
 * Generic pagination actions returned by usePaginated hook
 */
export interface PaginationActions {
    goToPage: (page: number) => void
    nextPage: () => void
    previousPage: () => void
    setSearch: (search: string) => void
    setSort: (sortBy: string, sortOrder: 'asc' | 'desc') => void
    setPageSize: (pageSize: number) => void
}
