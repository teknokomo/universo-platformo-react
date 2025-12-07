import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@universo/auth-frontend'
import { useHasGlobalAccess } from '@flowise/store'

// Local imports
import { Loader } from '../feedback/loading'

/**
 * Props for AdminGuard component
 */
export interface AdminGuardProps {
    /**
     * Child components to render if user has admin access
     */
    children: React.ReactNode

    /**
     * Redirect path for unauthenticated users
     * @default '/auth'
     */
    authRedirectTo?: string

    /**
     * Redirect path for users without admin access
     * @default '/'
     */
    accessDeniedRedirectTo?: string
}

/**
 * Admin route protection component for Universo Platformo
 *
 * Protects admin routes by checking:
 * 1. Authentication status (redirects to /auth if not authenticated)
 * 2. Admin panel access (redirects to / if user doesn't have canAccessAdminPanel)
 *
 * This guard combines authentication and authorization checks to prevent
 * rendering admin UI to unauthorized users.
 *
 * @example Basic usage
 * ```tsx
 * import { AdminGuard } from '@universo/template-mui'
 *
 * <Route
 *   path="/admin/*"
 *   element={
 *     <AdminGuard>
 *       <AdminLayout />
 *     </AdminGuard>
 *   }
 * />
 * ```
 *
 * @example Custom redirect paths
 * ```tsx
 * <AdminGuard authRedirectTo="/login" accessDeniedRedirectTo="/dashboard">
 *   <AdminPage />
 * </AdminGuard>
 * ```
 */
export const AdminGuard: React.FC<AdminGuardProps> = ({
    children,
    authRedirectTo = '/auth',
    accessDeniedRedirectTo = '/'
}) => {
    const { isAuthenticated, loading: authLoading } = useAuth()
    const { canAccessAdminPanel, loading: accessLoading } = useHasGlobalAccess()
    const location = useLocation()

    // Show loader while checking authentication or access
    if (authLoading || accessLoading) {
        return <Loader />
    }

    // Redirect to auth page if not authenticated
    if (!isAuthenticated) {
        return <Navigate to={authRedirectTo} state={{ from: location.pathname }} replace />
    }

    // Redirect to home if user doesn't have admin panel access
    // This happens when:
    // - ADMIN_PANEL_ENABLED=false (admin panel is disabled globally)
    // - User doesn't have global access role (superadmin/supermoderator)
    if (!canAccessAdminPanel) {
        return <Navigate to={accessDeniedRedirectTo} replace />
    }

    // Render admin content if all checks pass
    return <>{children}</>
}
