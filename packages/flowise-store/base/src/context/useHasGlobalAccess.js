/**
 * Hook to check if current user has global access
 *
 * Uses AbilityContext to get hasGlobalAccess flag without additional API calls.
 * Also provides admin feature flags for checking panel/privilege availability.
 *
 * @example
 * ```jsx
 * import { useHasGlobalAccess } from '@flowise/store'
 *
 * function MyComponent() {
 *   const { hasGlobalAccess, canAccessAdminPanel, loading, globalRoles } = useHasGlobalAccess()
 *
 *   if (loading) return <Spinner />
 *
 *   // Only show admin link if panel is enabled AND user has access
 *   if (canAccessAdminPanel) {
 *     return <AdminDashboard roles={globalRoles} />
 *   }
 *
 *   return <UserDashboard />
 * }
 * ```
 */
import { useContext, useMemo } from 'react'
import AbilityContext from './AbilityContext'

/**
 * Hook to access global access information from AbilityContext
 * @returns {{
 *   hasGlobalAccess: boolean,
 *   globalRoles: Array<{name: string, metadata: Object}>,
 *   rolesMetadata: Object<string, {name: string, displayName: Object, color: string, hasGlobalAccess: boolean}>,
 *   loading: boolean,
 *   adminConfig: {adminPanelEnabled: boolean, globalAdminEnabled: boolean},
 *   canAccessAdminPanel: boolean
 * }}
 */
export function useHasGlobalAccess() {
    const context = useContext(AbilityContext)

    const result = useMemo(() => {
        if (!context) {
            console.warn('[useHasGlobalAccess] Must be used within AbilityContextProvider')
            return {
                hasGlobalAccess: false,
                globalRoles: [],
                rolesMetadata: {},
                loading: false,
                adminConfig: { adminPanelEnabled: true, globalAdminEnabled: true },
                canAccessAdminPanel: false
            }
        }

        const hasGlobalAccess = context.hasGlobalAccess ?? false
        const adminConfig = context.adminConfig ?? { adminPanelEnabled: true, globalAdminEnabled: true }

        // User can access admin panel only if:
        // 1. Admin panel is enabled (ADMIN_PANEL_ENABLED=true)
        // 2. User has global access role
        const canAccessAdminPanel = adminConfig.adminPanelEnabled && hasGlobalAccess

        return {
            hasGlobalAccess,
            globalRoles: context.globalRoles ?? [],
            rolesMetadata: context.rolesMetadata ?? {},
            loading: context.loading ?? false,
            adminConfig,
            canAccessAdminPanel
        }
    }, [context])

    return result
}

export default useHasGlobalAccess
