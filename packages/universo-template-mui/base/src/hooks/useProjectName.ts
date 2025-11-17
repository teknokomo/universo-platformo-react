import { useState, useEffect } from 'react'

// Simple in-memory cache for project names to avoid duplicate API calls
const projectCache = new Map<string, string>()

/**
 * Hook to fetch and cache project name by ID for breadcrumb display.
 * Uses simple in-memory cache to minimize API calls.
 *
 * @param projectId - The project ID to fetch name for
 * @returns The project name or null if not loaded
 */
export function useProjectName(projectId: string | null): string | null {
    const [name, setName] = useState<string | null>(() => {
        if (!projectId) return null
        return projectCache.get(projectId) || null
    })

    useEffect(() => {
        if (!projectId) {
            setName(null)
            return
        }

        // Check cache first
        const cached = projectCache.get(projectId)
        if (cached) {
            setName(cached)
            return
        }

        // Fetch from API - use fetch to avoid package dependencies
        fetch(`/api/v1/projects/${projectId}`, {
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
                    projectCache.set(projectId, data.name)
                    setName(data.name)
                }
            })
            .catch((error) => {
                console.error('Failed to load project name for breadcrumbs:', error)
            })
    }, [projectId])

    return name
}

/**
 * Helper function to truncate long project names with ellipsis.
 *
 * @param name - The name to truncate
 * @param maxLength - Maximum length before truncation (default: 30)
 * @returns Truncated name with ellipsis if needed
 */
export function truncateProjectName(name: string, maxLength: number = 30): string {
    if (name.length <= maxLength) return name
    return name.slice(0, maxLength - 1) + '…'
}
