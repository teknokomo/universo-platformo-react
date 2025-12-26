/**
 * Universo Platformo | Space Builder Frontend API Client
 *
 * Pre-configured axios client with authentication, CSRF protection,
 * and automatic 401 redirect handling (except on public routes).
 */

import { createAuthClient } from '@universo/auth-frontend'
import type { AuthClient } from '@universo/auth-frontend'

const client: AuthClient = createAuthClient({
    baseURL: '/api/v1',
    redirectOn401: 'auto'
})

client.defaults.headers.common['x-request-from'] = 'internal'

export default client
