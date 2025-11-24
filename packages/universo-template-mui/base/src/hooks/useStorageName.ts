import { useState, useEffect } from 'react'

// Simple in-memory cache for storage names to avoid duplicate API calls
const storageCache = new Map<string, string>()

/**
 * Hook to fetch and cache storage name by ID for breadcrumb display.
 * Uses simple in-memory cache to minimize API calls.
 *
 * @param storageId - The storage ID to fetch name for
 * @returns The storage name or null if not loaded
 */
export function useStorageName(storageId: string | null): string | null {
    const [name, setName] = useState<string | null>(() => {
        if (!storageId) return null
        return storageCache.get(storageId) || null
    })

    useEffect(() => {
        if (!storageId) {
            setName(null)
            return
        }

        // Check cache first
        const cached = storageCache.get(storageId)
        if (cached) {
            setName(cached)
            return
        }

        // Fetch from API - use fetch to avoid package dependencies
        fetch(`/api/v1/storages/${storageId}`, {
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
                    storageCache.set(storageId, data.name)
                    setName(data.name)
                }
            })
            .catch((error) => {
                console.error('Failed to load storage name for breadcrumbs:', error)
            })
    }, [storageId])

    return name
}

/**
 * Helper function to truncate long storage names with ellipsis.
 *
 * @param name - The name to truncate
 * @param maxLength - Maximum length before truncation (default: 30)
 * @returns Truncated name with ellipsis if needed
 */
export function truncateStorageName(name: string, maxLength: number = 30): string {
    if (name.length <= maxLength) return name
    return name.slice(0, maxLength - 1) + '…'
}
