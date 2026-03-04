/**
 * @universo/api-client
 * TypeScript API client for Universo Platformo
 *
 * This package provides a centralized, type-safe client for all backend API calls.
 * Built on top of @universo/auth-frontend for authentication and axios for HTTP requests.
 *
 * @example
 * ```typescript
 * import { createUniversoApiClient } from '@universo/api-client'
 *
 * // Create client instance
 * const api = createUniversoApiClient({ baseURL: '/api/v1' })
 * ```
 */

// Main client factory
export { createUniversoApiClient } from './client'
export type { UniversoApiClient, UniversoApiClientOptions, AuthClient } from './client'

// Default API client instance (uses environment defaults)
import { createUniversoApiClient } from './client'
import { getApiBaseURL } from '@universo/utils'
export const api = createUniversoApiClient({ baseURL: `${getApiBaseURL()}/api/v1` })

// API classes (for advanced use cases)
export { AttachmentsApi, attachmentsQueryKeys } from './api/attachments'
export { ConfigApi, configQueryKeys } from './api/config'
export { FeedbackApi, feedbackQueryKeys } from './api/feedback'
export {
    createValidationApi,
    type ValidationApi,
    type ValidationResult,
    type ValidationResponse
} from './api/validation'

// TypeScript types
export * from './types'

// Query keys for TanStack Query
export * from './queryKeys'
