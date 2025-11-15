import { useState, useEffect } from 'react'

// Simple in-memory cache for unik names to avoid duplicate API calls
const unikCache = new Map<string, string>()

/**
 * Hook to fetch and cache unik name by ID for breadcrumb display.
 * Uses simple in-memory cache to minimize API calls.
 *
 * @param unikId - The unik ID to fetch name for
 * @returns The unik name or null if not loaded
 */
export function useUnikName(unikId: string | null): string | null {
    const [name, setName] = useState<string | null>(() => {
        if (!unikId) return null
        return unikCache.get(unikId) || null
    })

    useEffect(() => {
        if (!unikId) {
            setName(null)
            return
        }

        // Check cache first
        const cached = unikCache.get(unikId)
        if (cached) {
            setName(cached)
            return
        }

        // Fetch from API - use fetch to avoid package dependencies
        fetch(`/api/v1/unik/${unikId}`, {
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
                    unikCache.set(unikId, data.name)
                    setName(data.name)
                }
            })
            .catch((error) => {
                console.error('Failed to load unik name for breadcrumbs:', error)
            })
    }, [unikId])

    return name
}

/**
 * Helper function to truncate long unik names with ellipsis.
 *
 * @param name - The name to truncate
 * @param maxLength - Maximum length before truncation (default: 30)
 * @returns Truncated name with ellipsis if needed
 */
export function truncateUnikName(name: string, maxLength: number = 30): string {
    if (name.length <= maxLength) return name
    return name.slice(0, maxLength - 1) + '…'
}
