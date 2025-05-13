// Universo Platformo | Common API utilities
// Shared utilities for API calls across different modules

/**
 * Get the authentication token from localStorage
 * @returns an object with headers for requests containing the token
 */
export const getAuthHeaders = (): Record<string, string> => {
    try {
        // Try to get the token from localStorage
        const token = localStorage.getItem('supabase.auth.token')
        if (!token) {
            console.log('[getAuthHeaders] No auth token found in localStorage')
            return {}
        }

        try {
            const authData = JSON.parse(token)
            const accessToken = authData?.currentSession?.access_token

            if (accessToken) {
                console.log('[getAuthHeaders] Auth token found, adding to headers')
                return {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        } catch (parseError) {
            console.error('[getAuthHeaders] Failed to parse auth token:', parseError)
        }

        return {}
    } catch (error) {
        console.error('[getAuthHeaders] Error accessing localStorage:', error)
        return {}
    }
}

/**
 * Universal function for safe API requests
 * Handles different types of errors and response variants
 */
export const safeRequest = async (url: string, options?: RequestInit) => {
    console.log(`[safeRequest] Making request to ${url}`)

    try {
        // Get the authentication token from localStorage
        const authHeaders = getAuthHeaders()

        // Make the request using the fetch API
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...authHeaders,
                ...(options?.headers || {})
            }
        })

        console.log(`[safeRequest] Response status:`, response.status)

        // Check the type of the response content
        const contentType = response.headers.get('content-type') || ''
        console.log(`[safeRequest] Content-Type:`, contentType)

        // If the status is not successful, throw an error with details
        if (!response.ok) {
            const errorText = await response.text()
            console.error(`[safeRequest] Error response (${response.status}):`, errorText?.substring(0, 300))

            // Try to extract the error message from the JSON response
            let errorMessage = `Request failed with status ${response.status}`
            try {
                if (errorText && (errorText.startsWith('{') || errorText.startsWith('['))) {
                    const errorJson = JSON.parse(errorText)
                    errorMessage = errorJson.error || errorJson.message || errorText
                } else {
                    errorMessage = errorText || errorMessage
                }
            } catch (parseError) {
                console.warn(`[safeRequest] Failed to parse error response as JSON:`, parseError)
            }

            throw new Error(errorMessage)
        }

        // If this is JSON, parse it
        if (contentType.includes('application/json')) {
            try {
                const jsonData = await response.json()
                return jsonData
            } catch (jsonError) {
                console.error(`[safeRequest] Failed to parse JSON response:`, jsonError)
                throw new Error('Invalid JSON response')
            }
        } else {
            // For other content types, return the text
            return await response.text()
        }
    } catch (error) {
        console.error(`[safeRequest] Request failed:`, error)
        throw error
    }
}

/**
 * Get the identifiers from the URL
 * @param url - URL to analyze
 * @returns an object with the extracted identifiers
 */
export const extractIdsFromUrl = (url: string) => {
    const result: { unikId?: string; chatflowId?: string; nodeId?: string } = {}

    try {
        const pathname = new URL(url).pathname

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

        // Extract the nodeId
        const nodeMatch = pathname.match(/\/nodes\/([^\/]+)/)
        if (nodeMatch && nodeMatch[1]) {
            result.nodeId = nodeMatch[1]
        }
    } catch (error) {
        console.error(`[extractIdsFromUrl] Failed to parse URL:`, error)
    }

    return result
}

/**
 * Get the identifiers from the current URL of the browser
 * @returns an object with the extracted identifiers
 */
export const getCurrentUrlIds = () => {
    if (typeof window === 'undefined') {
        return {}
    }

    return extractIdsFromUrl(window.location.href)
}
