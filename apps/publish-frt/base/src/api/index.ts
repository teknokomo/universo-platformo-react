// Universo Platformo | API Module - Core API functions and exports
// Central API module with base functions and all API client exports

// Re-export common API utilities (breaks circular dependency)
export { getCurrentUrlIds, getApiBaseUrl } from './common'

// Shared authenticated client for publish APIs
export { getPublishApiClient, resetPublishApiClient } from './client'

// Re-export all publication API clients
export * from './publication'
