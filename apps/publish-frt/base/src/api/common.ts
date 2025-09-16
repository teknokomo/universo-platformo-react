// Universo Platformo | Common API utilities
// Core API functions used across all API clients

/**
 * Get the authentication token from localStorage
 * @returns an object with headers for requests containing the token
 */
export const getAuthHeaders = (): Record<string, string> => {
    try {
        // Try to get the token from localStorage
        // Universo Platformo | Changed localStorage key to 'token' to align with main app
        const tokenString = localStorage.getItem('token')
        if (!tokenString) {
            console.warn("[getAuthHeaders] No auth token found in localStorage using key 'token'")
            return {}
        }

        // Universo Platformo | Assuming the token stored under 'token' is the direct access token string
        if (tokenString) {
            console.log("[getAuthHeaders] Auth token string found with key 'token', adding to headers.")
            return {
                Authorization: `Bearer ${tokenString}`
            }
        }

        // Fallback or further checks can be added here if needed
        console.warn('[getAuthHeaders] Token string was present but evaluated to false, returning empty headers.')
        return {}
    } catch (error) {
        console.error('[getAuthHeaders] Error accessing localStorage:', error)
        return {}
    }
}

/**
 * Extract IDs from the current URL
 * @returns an object with the extracted identifiers
 */
export const getCurrentUrlIds = (): { unikId?: string; canvasId?: string; chatflowId?: string; spaceId?: string } => {
    if (typeof window === 'undefined') {
        return {}
    }

    try {
        const pathname = window.location.pathname
        const result: { unikId?: string; canvasId?: string; chatflowId?: string; spaceId?: string } = {}

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

        // Extract the chatflowId (legacy structure)
        const chatflowMatch = pathname.match(/\/chatflows\/([^\/]+)/)
        if (chatflowMatch && chatflowMatch[1]) {
            result.chatflowId = chatflowMatch[1]
        }

        // For backward compatibility, if we have spaceId but no canvasId, 
        // we can assume the first canvas has the same ID as the space
        if (result.spaceId && !result.canvasId) {
            result.canvasId = result.spaceId
        }

        // For backward compatibility, if we have chatflowId but no canvasId,
        // we can assume the canvas has the same ID as the chatflow
        if (result.chatflowId && !result.canvasId) {
            result.canvasId = result.chatflowId
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
    try {
        // @ts-ignore - ignore error for import.meta.env
        if (import.meta.env && import.meta.env.DEV) {
            return window.location.origin
        }

        // @ts-ignore
        const configuredHost = import.meta.env && import.meta.env.VITE_API_HOST
        if (configuredHost) {
            return configuredHost
        }

        return window.location.origin
    } catch (error) {
        console.warn('Error determining API base URL, falling back to origin:', error)
        return window.location.origin
    }
}
