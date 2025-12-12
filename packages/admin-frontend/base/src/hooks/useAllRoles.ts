import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { listRoles } from '../api/rolesApi'
import { rolesQueryKeys } from '../api/queryKeys'
import type { RoleListItem } from '../api/rolesApi'
import type { SupportedLocale } from '@universo/types'
import { resolveVlcContent } from '@universo/utils'

/**
 * Result type for useAllRoles hook
 */
export interface UseAllRolesResult {
    /** Raw list of all roles from API */
    roles: RoleListItem[]
    /** Role IDs for filter values */
    roleIds: string[]
    /** Role names for display */
    roleOptions: string[]
    /** Localized role labels keyed by role ID */
    roleLabelsById: Record<string, string>
    /** Localized role labels keyed by role name */
    roleLabels: Record<string, string>
    /** Loading state */
    isLoading: boolean
    /** Error if fetch failed */
    error: Error | null
}

/**
 * Hook to fetch all roles for filter dropdown
 * Unlike useAssignableGlobalRoles, this returns ALL roles (not just global access ones)
 *
 * @example
 * const { roles, roleLabelsById, isLoading, error } = useAllRoles()
 */
export function useAllRoles(): UseAllRolesResult {
    const { i18n } = useTranslation()
    const currentLang = i18n.language.split('-')[0] // 'ru-RU' -> 'ru'

    const { data, isLoading, error } = useQuery({
        queryKey: rolesQueryKeys.list({ limit: 100, includeSystem: true }),
        queryFn: () => listRoles({ limit: 100, includeSystem: true }),
        staleTime: 5 * 60 * 1000, // 5 minutes cache
        retry: 2,
        refetchOnWindowFocus: false
    })

    // Memoize roles to ensure stable reference
    const roles = useMemo(() => data?.items ?? [], [data?.items])

    // Extract role IDs for filter values
    const roleIds = useMemo(() => roles.map((r) => r.id), [roles])

    // Extract role codenames for display
    const roleOptions = useMemo(() => roles.map((r) => r.codename), [roles])

    // Build localized labels map by ID
    const roleLabelsById = useMemo(() => {
        const labels: Record<string, string> = {}
        for (const role of roles) {
            labels[role.id] = resolveVlcContent(role.name, currentLang as SupportedLocale, role.codename)
        }
        return labels
    }, [roles, currentLang])

    // Build localized labels map by codename
    const roleLabels = useMemo(() => {
        const labels: Record<string, string> = {}
        for (const role of roles) {
            labels[role.codename] = resolveVlcContent(role.name, currentLang as SupportedLocale, role.codename)
        }
        return labels
    }, [roles, currentLang])

    return {
        roles,
        roleIds,
        roleOptions,
        roleLabelsById,
        roleLabels,
        isLoading,
        error: error as Error | null
    }
}
