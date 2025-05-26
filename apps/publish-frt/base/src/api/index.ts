// Universo Platformo | API Module - Core API functions and exports
// Central API module with base functions and all API client exports

// Re-export common API utilities (breaks circular dependency)
export { getAuthHeaders, getCurrentUrlIds, getApiBaseUrl } from './common'

// Re-export all publication API clients
export * from './publication'
