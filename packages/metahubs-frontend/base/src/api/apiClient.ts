import axios from 'axios'
import type { AxiosResponse } from 'axios'
import type { PaginationMeta } from '../types'

const apiClient = axios.create({
    baseURL: '/api/v1',
    withCredentials: true
})

/**
 * Extract pagination metadata from response headers
 */
export function extractPaginationMeta(response: AxiosResponse): PaginationMeta {
    const total = parseInt(response.headers['x-total-count'] || '0', 10)
    const limit = parseInt(response.headers['x-limit'] || '100', 10)
    const offset = parseInt(response.headers['x-offset'] || '0', 10)

    return {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
    }
}

export default apiClient
