/**
 * Utility functions for admin-backend
 */

// Re-export centralized database utilities from @universo/utils
export { escapeLikeWildcards, getRequestManager } from '@universo/utils/database'

// Re-export parser utilities
export { parseIntSafe } from './parserUtils'
