/**
 * Universo Platformo | Pagination Utilities
 *
 * Helper functions for working with paginated API responses.
 */

import type { AxiosResponse } from 'axios'

/**
 * Pagination metadata from API responses.
 * Compatible with @universo/types PaginationMeta.
 */
export interface PaginationMeta {
    total: number
    limit: number
    offset: number
    count: number
    hasMore: boolean
}

/**
 * Extract pagination metadata from response headers.
 * Used by all paginated API endpoints.
 *
 * @param response - Axios response object
 * @returns PaginationMeta extracted from response headers
 *
 * @example
 * ```typescript
 * const response = await apiClient.get('/items')
 * const meta = extractPaginationMeta(response)
 * console.log(`Showing ${meta.count} of ${meta.total} items`)
 * ```
 */
export function extractPaginationMeta(response: AxiosResponse): PaginationMeta {
    const headers = response.headers
    return {
        limit: parseInt(headers['x-pagination-limit'] || '100', 10),
        offset: parseInt(headers['x-pagination-offset'] || '0', 10),
        count: parseInt(headers['x-pagination-count'] || '0', 10),
        total: parseInt(headers['x-total-count'] || '0', 10),
        hasMore: headers['x-pagination-has-more'] === 'true'
    }
}
