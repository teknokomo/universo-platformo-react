import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { resolveVlcContent } from '@universo/utils'
import { getRole } from '../api/rolesApi'
import { rolesQueryKeys } from '../api/queryKeys'
import type { SupportedLocale } from '@universo/types'
import type { RoleListItem } from '../api/rolesApi'

interface UseRoleDetailsOptions {
    /** Whether to fetch role details */
    enabled?: boolean
}

interface UseRoleDetailsResult {
    /** Full role data from API */
    role: RoleListItem | undefined
    /** Localized role name for current language */
    name: string | undefined
    /** Localized role description for current language */
    description: string | undefined
    /** Loading state */
    isLoading: boolean
    /** Error if fetch failed */
    error: Error | null
}

/**
 * Hook to fetch role details with localized name/description
 * Uses React Query for caching and deduplication
 *
 * @param roleId - Role UUID or null
 * @param options - Query options
 */
export function useRoleDetails(roleId: string | null, options?: UseRoleDetailsOptions): UseRoleDetailsResult {
    const { i18n } = useTranslation()
    const locale = (i18n.language?.split('-')[0] || 'en') as SupportedLocale

    const query = useQuery({
        queryKey: rolesQueryKeys.detail(roleId ?? ''),
        queryFn: () => getRole(roleId!),
        enabled: Boolean(roleId) && roleId !== 'new' && (options?.enabled ?? true),
        staleTime: 5 * 60 * 1000 // 5 minutes
    })

    const role = query.data

    return {
        role,
        name: role ? resolveVlcContent(role.name, locale, role.codename) : undefined,
        description: role?.description ? resolveVlcContent(role.description, locale) : undefined,
        isLoading: query.isLoading,
        error: query.error
    }
}

/**
 * Lightweight hook for just the role name (breadcrumbs)
 * Re-exports from useRoleDetails for consistency
 */
export function useRoleName(roleId: string | null): string | null {
    const { name, isLoading } = useRoleDetails(roleId)
    return isLoading ? null : name ?? null
}

/**
 * Truncate role name for breadcrumb display
 */
export function truncateRoleName(name: string, maxLength: number = 25): string {
    if (name.length <= maxLength) return name
    return name.substring(0, maxLength - 3) + '...'
}
