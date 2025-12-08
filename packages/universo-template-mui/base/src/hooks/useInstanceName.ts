import { useState, useEffect } from 'react'

// Simple in-memory cache for instance names to avoid duplicate API calls
const instanceCache = new Map<string, string>()

/**
 * Hook to fetch and cache instance name by ID for breadcrumb display.
 * Uses simple in-memory cache to minimize API calls.
 *
 * @param instanceId - The instance ID to fetch name for
 * @returns The instance name or null if not loaded
 */
export function useInstanceName(instanceId: string | null): string | null {
    const [name, setName] = useState<string | null>(() => {
        if (!instanceId) return null
        return instanceCache.get(instanceId) || null
    })

    useEffect(() => {
        if (!instanceId) {
            setName(null)
            return
        }

        // Check cache first
        const cached = instanceCache.get(instanceId)
        if (cached) {
            setName(cached)
            return
        }

        // Fetch from API - use fetch to avoid package dependencies
        fetch(`/api/v1/admin/instances/${instanceId}`, {
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
            .then((apiResponse) => {
                // API returns { success: true, data: instance }
                const data = apiResponse?.data || apiResponse
                if (data?.name) {
                    instanceCache.set(instanceId, data.name)
                    setName(data.name)
                }
            })
            .catch((error) => {
                console.error('Failed to fetch instance name:', error)
            })
    }, [instanceId])

    return name
}

/**
 * Truncate instance name for breadcrumb display
 */
export function truncateInstanceName(name: string, maxLength: number = 25): string {
    if (name.length <= maxLength) return name
    return name.substring(0, maxLength - 3) + '...'
}
