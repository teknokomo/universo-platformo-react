/**
 * Universo Platformo | Publish Frontend API Client
 *
 * Pre-configured axios client with authentication, CSRF protection,
 * and automatic 401 redirect handling (except on public routes).
 */

import { createAuthClient } from '@universo/auth-frontend'
import type { AuthClient } from '@universo/auth-frontend'
import { getApiBaseUrl } from './common'

let cachedClient: AuthClient | null = null

const buildClient = (): AuthClient => {
    const baseUrl = getApiBaseUrl()
    const client = createAuthClient({
        baseURL: `${baseUrl}/api/v1`,
        redirectOn401: 'auto'
    })
    client.defaults.headers.common['x-request-from'] = 'internal'
    return client
}

export const getPublishApiClient = (): AuthClient => {
    if (!cachedClient) {
        cachedClient = buildClient()
    }
    return cachedClient
}

export const resetPublishApiClient = (): void => {
    cachedClient = null
}
