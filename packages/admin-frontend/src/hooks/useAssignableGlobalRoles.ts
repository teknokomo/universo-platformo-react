import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getAssignableRoles } from '../api/rolesApi'
import { rolesQueryKeys } from '../api/queryKeys'
import type { GlobalAssignableRole, LocaleCode } from '@universo/types'
import { isValidLocaleCode } from '@universo/types'
import { resolveLocalizedContent } from '@universo/utils'

/**
 * Result type for useAssignableGlobalRoles hook
 */
export interface UseAssignableGlobalRolesResult {
    /** Raw list of assignable roles from API */
    roles: GlobalAssignableRole[]
    /** Role names for form values (e.g., ['superadmin', 'metaeditor']) */
    roleOptions: string[]
    /** Localized role labels keyed by role name */
    roleLabels: Record<string, string>
    /** Loading state */
    isLoading: boolean
    /** Error if fetch failed */
    error: Error | null
}

/**
 * Hook to fetch roles assignable to global users (is_superuser = true)
 * Provides role options and localized labels for MemberFormDialog
 *
 * @example
 * const { roleOptions, roleLabels, isLoading, error } = useAssignableGlobalRoles()
 * // roleOptions: ['superadmin', 'supermoderator', 'metaeditor']
 * // roleLabels: { superadmin: 'Суперадмин', supermoderator: 'Супермодератор', metaeditor: 'Метаредактор' }
 */
export function useAssignableGlobalRoles(): UseAssignableGlobalRolesResult {
    const { i18n } = useTranslation()
    const langCode = i18n.language.split('-')[0] // 'ru-RU' -> 'ru'
    const currentLang: LocaleCode = isValidLocaleCode(langCode) ? langCode : 'en'

    const {
        data: roles = [],
        isLoading,
        error
    } = useQuery({
        queryKey: rolesQueryKeys.assignable(),
        queryFn: getAssignableRoles,
        staleTime: 5 * 60 * 1000, // 5 minutes cache
        retry: 2,
        refetchOnWindowFocus: false
    })

    // Extract role names for form values
    const roleOptions = useMemo(() => roles.map((r) => r.codename), [roles])

    // Build localized labels map
    const roleLabels = useMemo(() => {
        const labels: Record<string, string> = {}
        for (const role of roles) {
            // Use safe VLC resolution with fallback to codename
            labels[role.codename] = resolveLocalizedContent(role.name, currentLang, role.codename)
        }
        return labels
    }, [roles, currentLang])

    return {
        roles,
        roleOptions,
        roleLabels,
        isLoading,
        error: error as Error | null
    }
}
