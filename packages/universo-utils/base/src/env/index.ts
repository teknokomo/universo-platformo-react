// Universo Platformo | Environment configuration utilities
// Safe access to environment variables with fallbacks

/**
 * Get API base URL from environment or window.location
 * Works in both browser and Node.js environments
 */
export const getApiBaseURL = (): string => {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
        return import.meta.env.VITE_API_BASE_URL || window.location.origin
    }
    // Node.js fallback
    return import.meta.env.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:3000'
}

/**
 * Get UI base URL from environment or window.location
 * Works in both browser and Node.js environments
 */
export const getUIBaseURL = (): string => {
    if (typeof window !== 'undefined') {
        return import.meta.env.VITE_UI_BASE_URL || window.location.origin
    }
    return import.meta.env.VITE_UI_BASE_URL || process.env.VITE_UI_BASE_URL || 'http://localhost:3000'
}

/**
 * Get environment variable with fallback
 * @param key - Environment variable name
 * @param fallback - Fallback value if variable is not set
 */
export const getEnv = (key: string, fallback: string = ''): string => {
    if (typeof import.meta.env !== 'undefined' && import.meta.env[key]) {
        return import.meta.env[key] as string
    }
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key] as string
    }
    return fallback
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
