import { useState, useEffect } from 'react'

// Simple in-memory cache for organization names to avoid duplicate API calls
const organizationCache = new Map<string, string>()

/**
 * Hook to fetch and cache organization name by ID for breadcrumb display.
 * Uses simple in-memory cache to minimize API calls.
 *
 * @param organizationId - The organization ID to fetch name for
 * @returns The organization name or null if not loaded
 */
export function useOrganizationName(organizationId: string | null): string | null {
    const [name, setName] = useState<string | null>(() => {
        if (!organizationId) return null
        return organizationCache.get(organizationId) || null
    })

    useEffect(() => {
        if (!organizationId) {
            setName(null)
            return
        }

        // Check cache first
        const cached = organizationCache.get(organizationId)
        if (cached) {
            setName(cached)
            return
        }

        // Fetch from API - use fetch to avoid package dependencies
        fetch(`/api/v1/organizations/${organizationId}`, {
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
                    organizationCache.set(organizationId, data.name)
                    setName(data.name)
                }
            })
            .catch((error) => {
                console.error('Failed to load organization name for breadcrumbs:', error)
            })
    }, [organizationId])

    return name
}

/**
 * Helper function to truncate long organization names with ellipsis.
 *
 * @param name - The name to truncate
 * @param maxLength - Maximum length before truncation (default: 30)
 * @returns Truncated name with ellipsis if needed
 */
export function truncateOrganizationName(name: string, maxLength: number = 30): string {
    if (name.length <= maxLength) return name
    return name.slice(0, maxLength - 1) + '…'
}
