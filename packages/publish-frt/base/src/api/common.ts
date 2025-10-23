// Universo Platformo | Common API utilities
// Core API functions used across all API clients

/**
 * Extract IDs from the current URL
 * @returns an object with the extracted identifiers
 */
export const getCurrentUrlIds = (): { unikId?: string; canvasId?: string; spaceId?: string } => {
    if (typeof window === 'undefined') {
        return {}
    }

    try {
        const pathname = window.location.pathname
        const result: { unikId?: string; canvasId?: string; spaceId?: string } = {}

        // Extract the unikId - support both new singular '/unik/' and legacy '/uniks/' patterns
        const unikSingularMatch = pathname.match(/\/unik\/([^\/]+)/)
        const unikLegacyMatch = pathname.match(/\/uniks\/([^\/]+)/)
        if (unikSingularMatch && unikSingularMatch[1]) {
            result.unikId = unikSingularMatch[1]
        } else if (unikLegacyMatch && unikLegacyMatch[1]) {
            result.unikId = unikLegacyMatch[1]
        }

        // Extract the canvasId (new structure)
        const canvasMatch = pathname.match(/\/canvas\/([^\/]+)/)
        if (canvasMatch && canvasMatch[1]) {
            result.canvasId = canvasMatch[1]
        }

        // Extract the spaceId (new structure)
        const spaceMatch = pathname.match(/\/space\/([^\/]+)/)
        if (spaceMatch && spaceMatch[1]) {
            result.spaceId = spaceMatch[1]
        }

        // For backward compatibility, if we have spaceId but no canvasId,
        // we can assume the first canvas has the same ID as the space
        if (result.spaceId && !result.canvasId) {
            result.canvasId = result.spaceId
        }

        return result
    } catch (error) {
        console.error('[getCurrentUrlIds] Error extracting IDs from URL:', error)
        return {}
    }
}

/**
 * Universal definition of API base URL
 * In development mode, we use a relative path, since UI and API are on the same domain (via Vite proxy).
 * For production or explicit specification, use the VITE_API_HOST environment variable.
 */
export const getApiBaseUrl = (): string => {
    const isBrowser = typeof window !== 'undefined'

    try {
        // @ts-ignore - ignore error for import.meta.env in CJS build
        if (import.meta.env && import.meta.env.DEV && isBrowser) {
            return window.location.origin
        }

        // @ts-ignore - ignore error for import.meta.env in CJS build
        const configuredHost = import.meta.env && import.meta.env.VITE_API_HOST
        if (configuredHost) {
            return configuredHost
        }

        if (isBrowser) {
            return window.location.origin
        }

        return ''
    } catch (error) {
        console.warn('Error determining API base URL, falling back to origin:', error)
        return isBrowser ? window.location.origin : ''
    }
}
