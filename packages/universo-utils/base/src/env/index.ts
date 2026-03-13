// Universo Platformo | Environment configuration utilities
// Safe access to environment variables with fallbacks

import { getBrowserOrigin, getProcessEnv, getPublicRuntimeEnv, resolveRuntimeEnvValue } from './shared'

// Re-export admin config utilities
export * from './adminConfig'
export * from './globalMigrationCatalogConfig'
export * from './numberParsing'

const getRuntimeEnvValue = (key: string): string | undefined => {
    return resolveRuntimeEnvValue(key, [getPublicRuntimeEnv(), getProcessEnv()])
}

/**
 * Get API base URL from environment or window.location
 * Works in both browser and Node.js environments
 */
export const getApiBaseURL = (): string => {
    return getRuntimeEnvValue('VITE_API_BASE_URL') || getBrowserOrigin() || 'http://localhost:3000'
}

/**
 * Get UI base URL from environment or window.location
 * Works in both browser and Node.js environments
 */
export const getUIBaseURL = (): string => {
    return getRuntimeEnvValue('VITE_UI_BASE_URL') || getBrowserOrigin() || 'http://localhost:3000'
}

/**
 * Get environment variable with fallback
 * @param key - Environment variable name
 * @param fallback - Fallback value if variable is not set
 */
export const getEnv = (key: string, fallback = ''): string => {
    return getRuntimeEnvValue(key) ?? fallback
}

/**
 * Check if running in development mode
 */
export const isDevelopment = (): boolean => {
    return getEnv('MODE', getEnv('NODE_ENV', 'production')) === 'development'
}

/**
 * Check if running in production mode
 */
export const isProduction = (): boolean => {
    return getEnv('MODE', getEnv('NODE_ENV', 'production')) === 'production'
}
