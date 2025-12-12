import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { listRoles, getAssignableRoles } from '../api/rolesApi'
import { rolesQueryKeys } from '../api/queryKeys'
import type { RoleListItem } from '../api/rolesApi'
import type { SupportedLocale } from '@universo/types'
import { isSupportedLocale } from '@universo/types'
import { resolveVlcContent } from '@universo/utils'

/**
 * Options for useRoles hook
 */
export interface UseRolesOptions {
    /**
     * Filter mode for roles:
     * - 'all': Return all roles (for filter dropdowns)
     * - 'assignable': Return only roles with is_superuser = true (for invite/edit dialogs)
     * @default 'all'
     */
    filter?: 'all' | 'assignable'

    /**
     * Include system roles in results (only applicable when filter = 'all')
     * @default true
     */
    includeSystem?: boolean
}

/**
 * Result type for useRoles hook
 */
export interface UseRolesResult {
    /** Raw list of roles from API */
    roles: RoleListItem[]
    /** Role IDs for filter values */
    roleIds: string[]
    /** Role names for form values */
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
 * Unified hook to fetch roles with optional filtering
 *
 * Replaces both useAllRoles and useAssignableGlobalRoles with a single configurable hook.
 *
 * @example All roles (for filter dropdown)
 * ```tsx
 * const { roles, roleLabelsById, isLoading } = useRoles()
 * // or explicitly:
 * const { roles } = useRoles({ filter: 'all' })
 * ```
 *
 * @example Assignable roles only (for invite dialog)
 * ```tsx
 * const { roleOptions, roleLabels, isLoading } = useRoles({ filter: 'assignable' })
 * ```
 */
export function useRoles(options: UseRolesOptions = {}): UseRolesResult {
    const { filter = 'all', includeSystem = true } = options

    const { i18n } = useTranslation()
    const langCode = i18n.language.split('-')[0] // 'ru-RU' -> 'ru'
    const currentLang: SupportedLocale = isSupportedLocale(langCode) ? langCode : 'en'

    // Use different query based on filter mode
    const queryKey = filter === 'assignable' ? rolesQueryKeys.assignable() : rolesQueryKeys.list({ limit: 100, includeSystem })

    const queryFn = filter === 'assignable' ? getAssignableRoles : () => listRoles({ limit: 100, includeSystem }).then((res) => res.items)

    const { data, isLoading, error } = useQuery({
        queryKey,
        queryFn,
        staleTime: 5 * 60 * 1000, // 5 minutes cache
        retry: 2,
        refetchOnWindowFocus: false
    })

    // Memoize roles to ensure stable reference
    const roles = useMemo(() => (data as RoleListItem[] | undefined) ?? [], [data])

    // Extract role IDs for filter values
    const roleIds = useMemo(() => roles.map((r) => r.id), [roles])

    // Extract role names for form values
    const roleOptions = useMemo(() => roles.map((r) => r.codename), [roles])

    // Build localized labels map by ID
    const roleLabelsById = useMemo(() => {
        const labels: Record<string, string> = {}
        for (const role of roles) {
            labels[role.id] = resolveVlcContent(role.name, currentLang, role.codename)
        }
        return labels
    }, [roles, currentLang])

    // Build localized labels map by codename
    const roleLabels = useMemo(() => {
        const labels: Record<string, string> = {}
        for (const role of roles) {
            labels[role.codename] = resolveVlcContent(role.name, currentLang, role.codename)
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
