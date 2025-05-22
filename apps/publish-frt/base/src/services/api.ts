// Universo Platformo | Publication API Service
// Упрощенный сервис для взаимодействия с API публикации AR.js

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
export const getCurrentUrlIds = (): { unikId?: string; chatflowId?: string } => {
    if (typeof window === 'undefined') {
        return {}
    }

    try {
        const pathname = window.location.pathname
        const result: { unikId?: string; chatflowId?: string } = {}

        // Extract the unikId
        const unikMatch = pathname.match(/\/uniks\/([^\/]+)/)
        if (unikMatch && unikMatch[1]) {
            result.unikId = unikMatch[1]
        }

        // Extract the chatflowId
        const chatflowMatch = pathname.match(/\/chatflows\/([^\/]+)/)
        if (chatflowMatch && chatflowMatch[1]) {
            result.chatflowId = chatflowMatch[1]
        }

        return result
    } catch (error) {
        console.error('[getCurrentUrlIds] Error extracting IDs from URL:', error)
        return {}
    }
}

// Файл содержит только необходимые функции для AR.js
