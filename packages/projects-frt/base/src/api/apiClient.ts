import { createAuthClient } from '@universo/auth-frt'
import type { AxiosError, AxiosResponse } from 'axios'
import type { PaginationMeta } from '../types'

const apiClient = createAuthClient({ baseURL: '/api/v1' })

apiClient.defaults.headers.common['Content-Type'] = 'application/json'
apiClient.defaults.headers.common['x-request-from'] = 'internal'

apiClient.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
        if (error?.response?.status === 401 && typeof window !== 'undefined') {
            const isAuthRoute = window.location.pathname.startsWith('/auth')
            if (!isAuthRoute) {
                window.location.href = '/auth'
            }
        }
        return Promise.reject(error)
    }
)

/**
 * Extract pagination metadata from response headers
 * Used by all paginated API endpoints
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

export default apiClient
