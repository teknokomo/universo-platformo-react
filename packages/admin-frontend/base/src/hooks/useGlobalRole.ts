import { useQuery } from '@tanstack/react-query'
import { useHasGlobalAccess as useStoreGlobalAccess } from '@universo/store'
import type { Actions, AppAbility, Subjects } from '@universo/types'
import apiClient from '../api/apiClient'
import { createAdminApi } from '../api/adminApi'
import type { RoleMetadata } from '../types'

export const globalRoleQueryKey = ['global-role', 'me'] as const

// Singleton instance of adminApi
const adminApi = createAdminApi(apiClient)

const canUseAdminAbility = (ability: AppAbility | null | undefined, action: Actions, subject: Subjects): boolean => {
    if (!ability) {
        return false
    }

    return ability.can('manage', subject) || ability.can(action, subject)
}

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
 * Check if current user is superuser (full platform access)
 */
export function useIsSuperadmin(): boolean {
    const { isSuperuser } = useStoreGlobalAccess()
    const { data } = useGlobalRole()

    return isSuperuser || data?.isSuperuser === true || data?.roleMetadata?.isSuperuser === true || data?.role === 'superuser'
}

/**
 * Check if current user has any global access
 */
export function useHasGlobalAccess(): boolean {
    const { hasAdminAccess } = useStoreGlobalAccess()
    const { data } = useGlobalRole()

    return hasAdminAccess || data?.hasGlobalAccess === true
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

export function useAdminPermission(action: Actions, subject: Subjects): boolean {
    const { ability, isSuperuser, loading } = useStoreGlobalAccess()

    if (loading) {
        return false
    }

    if (isSuperuser) {
        return true
    }

    return canUseAdminAbility(ability, action, subject)
}
