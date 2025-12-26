/**
 * Universo Platformo | Metaverses Frontend API Client
 *
 * Pre-configured axios client with authentication, CSRF protection,
 * and automatic 401 redirect handling (except on public routes).
 */

import { createAuthClient } from '@universo/auth-frontend'
export { extractPaginationMeta, type PaginationMeta } from '@universo/utils'

const apiClient = createAuthClient({
    baseURL: '/api/v1',
    redirectOn401: 'auto'
})

apiClient.defaults.headers.common['Content-Type'] = 'application/json'
apiClient.defaults.headers.common['x-request-from'] = 'internal'

export default apiClient
