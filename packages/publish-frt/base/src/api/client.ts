import { createAuthClient } from '@universo/auth-frt'
import type { AuthClient } from '@universo/auth-frt'
import { getApiBaseUrl } from './common'

let cachedClient: AuthClient | null = null

const buildClient = (): AuthClient => {
    const baseUrl = getApiBaseUrl()
    const client = createAuthClient({ baseURL: `${baseUrl}/api/v1` })
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
