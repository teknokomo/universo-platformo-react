import { createAuthClient, type AuthClient } from '@universo/auth-frontend'
import { ConfigApi } from './api/config'
import { FeedbackApi } from './api/feedback'
import { AttachmentsApi } from './api/attachments'
import { createValidationApi } from './api/validation'

export interface UniversoApiClientOptions {
    /** Base URL pointing to the API root (e.g. '/api/v1') */
    baseURL: string
    /** Path that returns { csrfToken: string }. Defaults to 'auth/csrf' */
    csrfPath?: string
    /** Storage key for CSRF token. Defaults to 'up.auth.csrf' */
    csrfStorageKey?: string
    /**
     * Configure 401 redirect behavior.
     * - 'auto': Redirect to /auth except on PUBLIC_UI_ROUTES (default)
     * - true: Always redirect to /auth on 401
     * - false: Never redirect on 401
     * - string[]: Redirect except on these custom routes
     */
    redirectOn401?: 'auto' | boolean | readonly string[]
}

/**
 * Universo API Client - centralized TypeScript client for all API calls
 *
 * @example
 * ```typescript
 * import { createUniversoApiClient } from '@universo/api-client'
 *
 * const api = createUniversoApiClient({ baseURL: '/api/v1' })
 *
 * // Usage with async/await
 * const cfg = await api.config.getConfig()
 *
 * // Usage with TanStack Query
 * import { useQuery } from '@tanstack/react-query'
 * import { configQueryKeys } from '@universo/api-client'
 *
 * const { data } = useQuery({
 *   queryKey: configQueryKeys.all,
 *   queryFn: () => api.config.getConfig()
 * })
 * ```
 */
export const createUniversoApiClient = (options: UniversoApiClientOptions) => {
    // Create authenticated axios client with 401 redirect handling built-in
    const client = createAuthClient({
        ...options,
        redirectOn401: options.redirectOn401 ?? 'auto'
    })

    // Add custom header for internal requests
    client.defaults.headers.common['x-request-from'] = 'internal'

    return {
        // API endpoint groups (active)
        attachments: new AttachmentsApi(client),
        config: new ConfigApi(client),
        feedback: new FeedbackApi(client),
        validation: createValidationApi(client),

        // Raw axios instance for special cases
        $client: client
    }
}

/**
 * Type of the Universo API client
 */
export type UniversoApiClient = ReturnType<typeof createUniversoApiClient>

/**
 * Export the AuthClient type for advanced use cases
 */
export type { AuthClient }
