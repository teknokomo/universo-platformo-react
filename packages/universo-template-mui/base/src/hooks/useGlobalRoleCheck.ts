import { useState, useEffect } from 'react'

// Simple in-memory cache to avoid duplicate API calls
let globalRoleCache: { role: string | null; checked: boolean } = { role: null, checked: false }

/**
 * Hook to check if current user is a super user (superadmin or supermoderator).
 * Uses simple in-memory cache to minimize API calls.
 * 
 * This hook exists in template-mui to avoid cyclic dependency with admin-frontend.
 * 
 * @returns true if user is superadmin or supermoderator, false otherwise
 */
export function useGlobalRoleCheck(): boolean {
    const [isSuperUser, setIsSuperUser] = useState<boolean>(() => {
        if (globalRoleCache.checked) {
            return globalRoleCache.role === 'superadmin' || globalRoleCache.role === 'supermoderator'
        }
        return false
    })

    useEffect(() => {
        // Check cache first
        if (globalRoleCache.checked) {
            setIsSuperUser(globalRoleCache.role === 'superadmin' || globalRoleCache.role === 'supermoderator')
            return
        }

        // Fetch from API - use fetch to avoid package dependencies
        fetch('/api/v1/admin/global-users/me', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        })
            .then((response) => {
                if (!response.ok) {
                    // 403/404 means user has no global role - that's expected
                    globalRoleCache = { role: null, checked: true }
                    setIsSuperUser(false)
                    return null
                }
                return response.json()
            })
            .then((data) => {
                // API returns { success: true, data: { role } }
                const role = data?.data?.role
                if (role) {
                    globalRoleCache = { role, checked: true }
                    setIsSuperUser(role === 'superadmin' || role === 'supermoderator')
                } else {
                    globalRoleCache = { role: null, checked: true }
                    setIsSuperUser(false)
                }
            })
            .catch(() => {
                // On error, assume not a super user
                globalRoleCache = { role: null, checked: true }
                setIsSuperUser(false)
            })
    }, [])

    return isSuperUser
}

/**
 * Reset the global role cache. Useful after login/logout.
 */
export function resetGlobalRoleCache(): void {
    globalRoleCache = { role: null, checked: false }
}
