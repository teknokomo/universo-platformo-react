import { useState, useEffect } from 'react'

// Simple in-memory cache for campaign names to avoid duplicate API calls
const campaignCache = new Map<string, string>()

/**
 * Hook to fetch and cache campaign name by ID for breadcrumb display.
 * Uses simple in-memory cache to minimize API calls.
 *
 * @param campaignId - The campaign ID to fetch name for
 * @returns The campaign name or null if not loaded
 */
export function useCampaignName(campaignId: string | null): string | null {
    const [name, setName] = useState<string | null>(() => {
        if (!campaignId) return null
        return campaignCache.get(campaignId) || null
    })

    useEffect(() => {
        if (!campaignId) {
            setName(null)
            return
        }

        // Check cache first
        const cached = campaignCache.get(campaignId)
        if (cached) {
            setName(cached)
            return
        }

        // Fetch from API - use fetch to avoid package dependencies
        fetch(`/api/v1/campaigns/${campaignId}`, {
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
                    campaignCache.set(campaignId, data.name)
                    setName(data.name)
                }
            })
            .catch((error) => {
                console.error('Failed to load campaign name for breadcrumbs:', error)
            })
    }, [campaignId])

    return name
}

/**
 * Helper function to truncate long campaign names with ellipsis.
 *
 * @param name - The name to truncate
 * @param maxLength - Maximum length before truncation (default: 30)
 * @returns Truncated name with ellipsis if needed
 */
export function truncateCampaignName(name: string, maxLength: number = 30): string {
    if (name.length <= maxLength) return name
    return name.slice(0, maxLength - 1) + '…'
}
