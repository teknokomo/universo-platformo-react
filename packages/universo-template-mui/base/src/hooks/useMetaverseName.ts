import { useState, useEffect } from 'react'

// Simple in-memory cache for metaverse names to avoid duplicate API calls
const metaverseCache = new Map<string, string>()

/**
 * Hook to fetch and cache metaverse name by ID for breadcrumb display.
 * Uses simple in-memory cache to minimize API calls.
 *
 * @param metaverseId - The metaverse ID to fetch name for
 * @returns The metaverse name or null if not loaded
 */
export function useMetaverseName(metaverseId: string | null): string | null {
    const [name, setName] = useState<string | null>(() => {
        if (!metaverseId) return null
        return metaverseCache.get(metaverseId) || null
    })

    useEffect(() => {
        if (!metaverseId) {
            setName(null)
            return
        }

        // Check cache first
        const cached = metaverseCache.get(metaverseId)
        if (cached) {
            setName(cached)
            return
        }

        // Fetch from API - use fetch to avoid package dependencies
        fetch(`/api/v1/metaverses/${metaverseId}`, {
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
            .then((data) => {
                if (data?.name) {
                    metaverseCache.set(metaverseId, data.name)
                    setName(data.name)
                }
            })
            .catch((error) => {
                console.error('Failed to load metaverse name for breadcrumbs:', error)
            })
    }, [metaverseId])

    return name
}

/**
 * Helper function to truncate long metaverse names with ellipsis.
 *
 * @param name - The name to truncate
 * @param maxLength - Maximum length before truncation (default: 30)
 * @returns Truncated name with ellipsis if needed
 */
export function truncateMetaverseName(name: string, maxLength: number = 30): string {
    if (name.length <= maxLength) return name
    return name.slice(0, maxLength - 1) + '…'
}
