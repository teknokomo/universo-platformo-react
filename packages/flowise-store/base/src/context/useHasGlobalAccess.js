/**
 * Hook to check if current user has global access
 *
 * Uses AbilityContext to get hasGlobalAccess flag without additional API calls.
 *
 * @example
 * ```jsx
 * import { useHasGlobalAccess } from '@flowise/store'
 *
 * function MyComponent() {
 *   const { hasGlobalAccess, loading, globalRoles } = useHasGlobalAccess()
 *
 *   if (loading) return <Spinner />
 *
 *   if (hasGlobalAccess) {
 *     return <AdminDashboard roles={globalRoles} />
 *   }
 *
 *   return <UserDashboard />
 * }
 * ```
 */
import { useContext } from 'react'
import AbilityContext from './AbilityContext'

/**
 * Hook to access global access information from AbilityContext
 * @returns {{
 *   hasGlobalAccess: boolean,
 *   globalRoles: Array<{name: string, metadata: Object}>,
 *   rolesMetadata: Object<string, {name: string, displayName: Object, color: string, hasGlobalAccess: boolean}>,
 *   loading: boolean
 * }}
 */
export function useHasGlobalAccess() {
    const context = useContext(AbilityContext)

    if (!context) {
        console.warn('[useHasGlobalAccess] Must be used within AbilityContextProvider')
        return {
            hasGlobalAccess: false,
            globalRoles: [],
            rolesMetadata: {},
            loading: false
        }
    }

    return {
        hasGlobalAccess: context.hasGlobalAccess ?? false,
        globalRoles: context.globalRoles ?? [],
        rolesMetadata: context.rolesMetadata ?? {},
        loading: context.loading ?? false
    }
}

export default useHasGlobalAccess
