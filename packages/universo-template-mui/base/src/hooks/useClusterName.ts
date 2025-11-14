import { useState, useEffect } from 'react'

// Simple in-memory cache for cluster names to avoid duplicate API calls
const clusterCache = new Map<string, string>()

/**
 * Hook to fetch and cache cluster name by ID for breadcrumb display.
 * Uses simple in-memory cache to minimize API calls.
 *
 * @param clusterId - The cluster ID to fetch name for
 * @returns The cluster name or null if not loaded
 */
export function useClusterName(clusterId: string | null): string | null {
    const [name, setName] = useState<string | null>(() => {
        if (!clusterId) return null
        return clusterCache.get(clusterId) || null
    })

    useEffect(() => {
        if (!clusterId) {
            setName(null)
            return
        }

        // Check cache first
        const cached = clusterCache.get(clusterId)
        if (cached) {
            setName(cached)
            return
        }

        // Fetch from API - use fetch to avoid package dependencies
        fetch(`/api/v1/clusters/${clusterId}`, {
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
                    clusterCache.set(clusterId, data.name)
                    setName(data.name)
                }
            })
            .catch((error) => {
                console.error('Failed to load cluster name for breadcrumbs:', error)
            })
    }, [clusterId])

    return name
}

/**
 * Helper function to truncate long cluster names with ellipsis.
 *
 * @param name - The name to truncate
 * @param maxLength - Maximum length before truncation (default: 30)
 * @returns Truncated name with ellipsis if needed
 */
export function truncateClusterName(name: string, maxLength: number = 30): string {
    if (name.length <= maxLength) return name
    return name.slice(0, maxLength - 1) + '…'
}
