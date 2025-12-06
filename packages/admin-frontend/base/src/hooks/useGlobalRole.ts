import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/apiClient'
import { createAdminApi } from '../api/adminApi'
import type { RoleMetadata } from '../types'

export const globalRoleQueryKey = ['global-role', 'me'] as const

// Singleton instance of adminApi
const adminApi = createAdminApi(apiClient)

/**
 * Hook to get current user's global role info
 * Returns role, hasGlobalAccess, and roleMetadata
 */
export function useGlobalRole() {
    return useQuery({
        queryKey: globalRoleQueryKey,
        queryFn: () => adminApi.getMyRole(),
        staleTime: 5 * 60 * 1000, // 5 minutes cache
        retry: 1,
        // Don't refetch on window focus for role data
        refetchOnWindowFocus: false
    })
}

/**
 * Check if current user is superadmin
 */
export function useIsSuperadmin(): boolean {
    const { data } = useGlobalRole()
    return data?.role === 'superadmin'
}

/**
 * Check if current user has any global access
 */
export function useHasGlobalAccess(): boolean {
    const { data } = useGlobalRole()
    return data?.hasGlobalAccess ?? false
}

/**
 * Get the current user's global role name
 */
export function useCurrentGlobalRole(): string | null {
    const { data } = useGlobalRole()
    return data?.role ?? null
}

/**
 * Get the current user's role metadata
 */
export function useGlobalRoleMetadata(): RoleMetadata | null {
    const { data } = useGlobalRole()
    return data?.roleMetadata ?? null
}
