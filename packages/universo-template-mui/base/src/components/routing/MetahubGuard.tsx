import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@universo/auth-frontend'
import { useHasGlobalAccess } from '@flowise/store'

// Local imports
import { Loader } from '../feedback/loading'

/**
 * Props for MetahubGuard component
 */
export interface MetahubGuardProps {
    /**
     * Child components to render if user has metahubs access
     */
    children: React.ReactNode

    /**
     * Redirect path for unauthenticated users
     * @default '/auth'
     */
    authRedirectTo?: string

    /**
     * Redirect path for users without metahubs access
     * @default '/'
     */
    accessDeniedRedirectTo?: string
}

/**
 * MetaHubs route protection component for Universo Platformo
 *
 * Protects metahubs routes by checking:
 * 1. Authentication status (redirects to /auth if not authenticated)
 * 2. MetaHubs access (redirects to / if user doesn't have canAccessMetahubs)
 *
 * MetaHubs access is granted to:
 * - Superusers (full platform access)
 * - Users with explicit metahubs:read permission
 *
 * @example Basic usage
 * ```tsx
 * import { MetahubGuard } from '@universo/template-mui'
 *
 * <Route
 *   path="/metahubs"
 *   element={
 *     <MetahubGuard>
 *       <MetahubList />
 *     </MetahubGuard>
 *   }
 * />
 * ```
 *
 * @example Custom redirect paths
 * ```tsx
 * <MetahubGuard authRedirectTo="/login" accessDeniedRedirectTo="/dashboard">
 *   <MetahubBoard />
 * </MetahubGuard>
 * ```
 */
export const MetahubGuard: React.FC<MetahubGuardProps> = ({ children, authRedirectTo = '/auth', accessDeniedRedirectTo = '/' }) => {
    const { isAuthenticated, loading: authLoading } = useAuth()
    const { canAccessMetahubs, loading: accessLoading } = useHasGlobalAccess()
    const location = useLocation()

    // Show loader while checking authentication or access
    if (authLoading || accessLoading) {
        return <Loader />
    }

    // Redirect to auth page if not authenticated
    if (!isAuthenticated) {
        return <Navigate to={authRedirectTo} state={{ from: location.pathname }} replace />
    }

    // Redirect to home if user doesn't have metahubs access
    // This happens when user doesn't have:
    // - Superuser role
    // - Explicit metahubs:read permission
    if (!canAccessMetahubs) {
        return <Navigate to={accessDeniedRedirectTo} replace />
    }

    // Render metahubs content if all checks pass
    return <>{children}</>
}
