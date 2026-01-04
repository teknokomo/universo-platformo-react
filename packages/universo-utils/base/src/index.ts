// Universo Platformo | Utils package entrypoint
// Namespaced exports for tree-shaking friendly consumption

export * as validation from './validation'
export * as delta from './delta'
export * as serialization from './serialization'
export * as math from './math'
export * as updl from './updl'
export * as publish from './publish'
export * as env from './env'
export * as uuid from './uuid'
export * as localizedContent from './vlc'
export * as routes from './routes'
export * as auth from './auth'

// Rate limiting utilities (server-side only)
// Note: Import from '@universo/utils/rate-limiting' for direct access
export * as rateLimiting from './rate-limiting'

// Export all net utilities including Node.js-only ensurePortAvailable
// Browser builds use index.browser.ts which stubs ensurePortAvailable
import { createTimeSyncEstimator } from './net/timeSync'
import { updateSeqState, reconcileAck } from './net/sequencing'
import { ensurePortAvailable } from './net/ensurePortAvailable'

export const net = {
    createTimeSyncEstimator,
    updateSeqState,
    reconcileAck,
    ensurePortAvailable
}
export { createTimeSyncEstimator, updateSeqState, reconcileAck, ensurePortAvailable }

// Direct exports for commonly used classes
export { UPDLProcessor } from './updl/UPDLProcessor'

// Direct exports for commonly used environment utilities
export { getApiBaseURL, getUIBaseURL, getEnv, isDevelopment, isProduction } from './env'
export {
    isAdminPanelEnabled,
    isGlobalRolesEnabled,
    isSuperuserEnabled,
    isGlobalAdminEnabled,
    getAdminConfig,
    type AdminConfig
} from './env/adminConfig'

// Date formatting utilities (UI-only)
export { formatDate, formatRange } from './ui-utils/formatDate'

// API error handling utilities
export * from './api/error-handlers'
export { extractPaginationMeta, type PaginationMeta as UtilsPaginationMeta } from './api/pagination'

// Public routes utilities
export {
    API_WHITELIST_URLS,
    PUBLIC_UI_ROUTES,
    isPublicRoute,
    isWhitelistedApiPath,
    type ApiWhitelistUrl,
    type PublicUiRoute
} from './routes'

// Localized Content utilities
export {
    createLocalizedContent,
    updateLocalizedContentLocale,
    resolveLocalizedContent,
    getLocalizedContentLocales,
    isLocalizedContent
} from './vlc'

// Auth feature toggles utilities
export {
    getAuthFeatureConfig,
    isRegistrationEnabled,
    isLoginEnabled,
    isEmailConfirmationRequired,
    type AuthFeatureConfig
} from './auth'
