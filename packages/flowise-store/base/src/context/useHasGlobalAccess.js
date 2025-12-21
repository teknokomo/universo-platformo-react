/**
 * Hook to check if current user has admin access or is superuser
 *
 * Uses AbilityContext to get access flags without additional API calls.
 * Also provides admin feature flags for checking panel/privilege availability.
 *
 * @example
 * ```jsx
 * import { useHasGlobalAccess } from '@flowise/store'
 *
 * function MyComponent() {
 *   const { isSuperuser, canAccessAdmin, canAccessAdminPanel, canAccessMetahubs, loading, globalRoles } = useHasGlobalAccess()
 *
 *   if (loading) return <Spinner />
 *
 *   // Only show admin link if panel is enabled AND user has access
 *   if (canAccessAdminPanel) {
 *     return <AdminDashboard roles={globalRoles} isSuperuser={isSuperuser} />
 *   }
 *
 *   // Only show metahubs if user has metahubs access
 *   if (canAccessMetahubs) {
 *     return <MetahubsDashboard />
 *   }
 *
 *   return <UserDashboard />
 * }
 * ```
 */
import { useContext, useMemo } from 'react'
import AbilityContext from './AbilityContext'

/**
 * Hook to access admin/superuser information from AbilityContext
 * @returns {{
 *   isSuperuser: boolean,
 *   hasAdminAccess: boolean,
 *   hasAnyGlobalRole: boolean,
 *   globalRoles: Array<{name: string, metadata: Object}>,
 *   rolesMetadata: Object<string, {name: string, displayName: Object, color: string, isSuperuser: boolean}>,
 *   loading: boolean,
 *   adminConfig: {adminPanelEnabled: boolean, globalRolesEnabled: boolean, superuserEnabled: boolean},
 *   canAccessAdminPanel: boolean,
 *   canAccessMetahubs: boolean
 * }}
 */
export function useHasGlobalAccess() {
    const context = useContext(AbilityContext)

    const result = useMemo(() => {
        if (!context) {
            console.warn('[useHasGlobalAccess] Must be used within AbilityContextProvider')
            return {
                isSuperuser: false,
                hasAdminAccess: false,
                hasAnyGlobalRole: false,
                globalRoles: [],
                rolesMetadata: {},
                loading: false,
                adminConfig: { adminPanelEnabled: true, globalRolesEnabled: true, superuserEnabled: true },
                canAccessAdminPanel: false,
                canAccessMetahubs: false
            }
        }

        const isSuperuser = context.isSuperuser ?? false
        const hasAdminAccess = context.hasAdminAccess ?? false
        const hasAnyGlobalRole = context.hasAnyGlobalRole ?? false
        const adminConfig = context.adminConfig ?? { adminPanelEnabled: true, globalRolesEnabled: true, superuserEnabled: true }

        // User can access admin panel only if:
        // 1. Admin panel is enabled (ADMIN_PANEL_ENABLED=true)
        // 2. User has admin-related permissions (roles:read, instances:read, or users:read)
        const canAccessAdminPanel = adminConfig.adminPanelEnabled && hasAdminAccess

        // User can access metahubs if:
        // 1. User is superuser (has full bypass)
        // 2. User has ability to read Metahub (via CASL permissions)
        const ability = context.ability
        const canAccessMetahubs = isSuperuser || (ability && ability.can('read', 'Metahub'))

        console.log('[useHasGlobalAccess] Computed values', {
            isSuperuser,
            hasAdminAccess,
            hasAnyGlobalRole,
            adminConfig,
            canAccessAdminPanel,
            canAccessMetahubs,
            contextLoading: context.loading
        })

        return {
            isSuperuser,
            hasAdminAccess,
            hasAnyGlobalRole,
            globalRoles: context.globalRoles ?? [],
            rolesMetadata: context.rolesMetadata ?? {},
            loading: context.loading ?? false,
            adminConfig,
            canAccessAdminPanel,
            canAccessMetahubs
        }
    }, [context])

    return result
}

export default useHasGlobalAccess
