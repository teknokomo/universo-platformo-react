import type { PaginatedResponse, PaginationParams } from '../../types'

const DEFAULT_FETCH_LIMIT = 1000
const MAX_PAGES_GUARD = 1000

export type FetchPageFn<TItem> = (params: PaginationParams) => Promise<PaginatedResponse<TItem>>

export interface FetchAllPaginatedOptions {
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    search?: string
}

/**
 * Fetches all pages from paginated API endpoint with deterministic order.
 * Uses backend max limit (1000) by default and protects from infinite loops.
 */
export async function fetchAllPaginatedItems<TItem>(
    fetchPage: FetchPageFn<TItem>,
    options?: FetchAllPaginatedOptions
): Promise<PaginatedResponse<TItem>> {
    const limit = options?.limit ?? DEFAULT_FETCH_LIMIT
    const sortBy = options?.sortBy
    const sortOrder = options?.sortOrder
    const search = options?.search

    const allItems: TItem[] = []
    let offset = 0
    let iterations = 0
    let hasMore = true
    let total = 0

    while (hasMore && iterations < MAX_PAGES_GUARD) {
        const page = await fetchPage({
            limit,
            offset,
            sortBy,
            sortOrder,
            search
        })

        const pageItems = Array.isArray(page.items) ? page.items : []
        const pageCount = typeof page.pagination?.count === 'number' ? page.pagination.count : pageItems.length
        const pageTotal = typeof page.pagination?.total === 'number' ? page.pagination.total : allItems.length + pageItems.length
        const pageHasMore = Boolean(page.pagination?.hasMore)

        allItems.push(...pageItems)
        total = pageTotal

        if (!pageHasMore || pageCount <= 0 || allItems.length >= pageTotal) {
            hasMore = false
            break
        }

        offset += pageCount
        iterations += 1
    }

    if (total < allItems.length) {
        total = allItems.length
    }

    return {
        items: allItems,
        pagination: {
            limit,
            offset: 0,
            count: allItems.length,
            total,
            hasMore
        }
    }
}
