/**
 * Universo Platformo | Flowise Core Frontend API Client
 *
 * Pre-configured axios client with authentication, CSRF protection,
 * and automatic 401 redirect handling (except on public routes).
 */

import { createAuthClient } from '@universo/auth-frontend'
import { baseURL } from '@flowise/template-mui'

const apiClient = createAuthClient({
    baseURL: `${baseURL}/api/v1`,
    redirectOn401: 'auto'
})

apiClient.defaults.headers.common['x-request-from'] = 'internal'

export default apiClient
