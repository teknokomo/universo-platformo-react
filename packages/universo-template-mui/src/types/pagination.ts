/**
 * Pagination types for TanStack Query v5 integration
 *
 * Core types (PaginationParams, PaginationMeta, PaginatedResponse) are
 * re-exported from @universo/types for consistency across the monorepo.
 *
 * MUI-specific types (PaginationState, PaginationActions) are defined here.
 */

// Re-export core pagination types from canonical source
export type { PaginationParams, PaginationMeta, PaginatedResponse } from '@universo/types'

/**
 * Generic pagination state returned by usePaginated hook
 * MUI-specific: used with TanStack Query integration
 */
export interface PaginationState {
    currentPage: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
    search?: string
}

/**
 * Generic pagination actions returned by usePaginated hook
 * MUI-specific: used with TanStack Query integration
 */
export interface PaginationActions {
    goToPage: (page: number) => void
    nextPage: () => void
    previousPage: () => void
    setSearch: (search: string) => void
    setSort: (sortBy: string, sortOrder: 'asc' | 'desc') => void
    setPageSize: (pageSize: number) => void
}
