/**
 * Universo API Client Singleton
 *
 * Creates a single shared instance of the Universo API client
 * for the entire application. All API calls should use this instance
 * to ensure consistent authentication and configuration.
 */

import { createUniversoApiClient } from '@universo/api-client'
import { baseURL } from '@universo/store'

/** Shared API client instance for the entire application. */
export const api = createUniversoApiClient({
    baseURL: `${baseURL}/api/v1`
})

export default api
