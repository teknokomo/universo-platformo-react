import { useState, useEffect } from 'react'
import i18n from '@universo/i18n'

// Language-aware cache for role names to avoid duplicate API calls
// Cache key format: `${roleId}:${lang}` to support multilingual display
const roleCache = new Map<string, string>()

/**
 * Hook to fetch and cache role name by ID for breadcrumb display.
 * Uses language-aware in-memory cache to minimize API calls.
 * Automatically updates when application language changes.
 *
 * @param roleId - The role ID to fetch name for
 * @returns The role display name or null if not loaded
 */
export function useRoleName(roleId: string | null): string | null {
    // Get current language from i18n (not browser language)
    const currentLang = i18n.language.split('-')[0] || 'en'

    const [name, setName] = useState<string | null>(() => {
        if (!roleId) return null
        const cacheKey = `${roleId}:${currentLang}`
        return roleCache.get(cacheKey) || null
    })

    useEffect(() => {
        if (!roleId) {
            setName(null)
            return
        }

        // Skip fetch for 'new' - this is used for create mode, not a real role ID
        if (roleId === 'new') {
            setName(null)
            return
        }

        // Check cache first with language-specific key
        const cacheKey = `${roleId}:${currentLang}`
        const cached = roleCache.get(cacheKey)
        if (cached) {
            setName(cached)
            return
        }

        // Fetch from API - use fetch to avoid package dependencies
        fetch(`/api/v1/admin/roles/${roleId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }
                return response.json()
            })
            .then((response) => {
                // API returns { success: true, data: role }
                const data = response?.data || response
                // Role has display_name (snake_case from backend) object with locale keys, or fallback to name
                let displayName = data?.name
                // Check both camelCase and snake_case variants
                const displayNameObj = data?.displayName || data?.display_name
                if (displayNameObj && typeof displayNameObj === 'object') {
                    // Use current application language from i18n
                    displayName = displayNameObj[currentLang] || displayNameObj['en'] || displayNameObj['ru'] || data?.name
                }
                if (displayName) {
                    roleCache.set(cacheKey, displayName)
                    setName(displayName)
                }
            })
            .catch((error) => {
                console.error('Failed to fetch role name:', error)
            })
    }, [roleId, currentLang])

    return name
}

/**
 * Truncate role name for breadcrumb display
 */
export function truncateRoleName(name: string, maxLength: number = 25): string {
    if (name.length <= maxLength) return name
    return name.substring(0, maxLength - 3) + '...'
}
