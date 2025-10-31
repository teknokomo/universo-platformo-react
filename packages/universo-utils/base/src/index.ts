// Universo Platformo | Utils package entrypoint
// Namespaced exports for tree-shaking friendly consumption

export * as validation from './validation'
export * as delta from './delta'
export * as serialization from './serialization'
export * as math from './math'
export * as updl from './updl'
export * as publish from './publish'
export * as env from './env'

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

// Date formatting utilities (UI-only)
export { formatDate, formatRange } from './ui-utils/formatDate'
