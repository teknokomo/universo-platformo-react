/**
 * Universo API Client Singleton
 * 
 * This file creates a single shared instance of the Universo API client
 * for the entire application. All API calls should use this instance
 * to ensure consistent authentication and configuration.
 * 
 * Usage in components:
 * ```typescript
 * import { api } from '@/api/client'
 * 
 * // Use in async function
 * const canvas = await api.canvases.getCanvas(unikId, spaceId, canvasId)
 * 
 * // Use with TanStack Query
 * const { data } = useQuery({
 *   queryKey: canvasQueryKeys.detail(unikId, spaceId, canvasId),
 *   queryFn: () => api.canvases.getCanvas(unikId, spaceId, canvasId)
 * })
 * ```
 */

import { createUniversoApiClient } from '@universo/api-client'
import { baseURL } from '@flowise/store'

/**
 * Shared API client instance for the entire application.
 * Automatically handles authentication via @universo/auth-frt.
 */
export const api = createUniversoApiClient({
    baseURL: `${baseURL}/api/v1`
})

/**
 * Default export for backward compatibility with existing imports
 */
export default api
