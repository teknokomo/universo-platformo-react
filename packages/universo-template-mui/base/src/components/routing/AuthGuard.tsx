import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@universo/auth-frt'

// Local imports - use universo version instead of flowise
import { Loader } from '../feedback/loading'

/**
 * Props for AuthGuard component
 */
export interface AuthGuardProps {
    /**
     * Child components to render if authenticated
     */
    children: React.ReactNode

    /**
     * Custom redirect path for unauthenticated users
     * @default '/auth'
     */
    redirectTo?: string
}

/**
 * Route protection component for Universo Platformo
 *
 * Protects routes from unauthorized access by checking authentication status.
 * Displays loading state while checking auth, redirects to auth page if not authenticated,
 * and renders children if authenticated.
 *
 * @example Basic usage (redirect to /auth)
 * ```tsx
 * import { AuthGuard } from '@universo/template-mui'
 *
 * <Route
 *   path="/dashboard"
 *   element={
 *     <AuthGuard>
 *       <DashboardPage />
 *     </AuthGuard>
 *   }
 * />
 * ```
 *
 * @example Custom redirect path
 * ```tsx
 * <AuthGuard redirectTo="/login">
 *   <ProtectedPage />
 * </AuthGuard>
 * ```
 *
 * @example With MainLayout
 * ```tsx
 * <Route
 *   path="/app/*"
 *   element={
 *     <AuthGuard>
 *       <MainLayout />
 *     </AuthGuard>
 *   }
 * />
 * ```
 */
export const AuthGuard: React.FC<AuthGuardProps> = ({ children, redirectTo = '/auth' }) => {
    const { isAuthenticated, loading } = useAuth()
    const location = useLocation()

    // Show loader while checking authentication status
    if (loading) {
        return <Loader />
    }

    // Redirect to auth page (or custom path) if not authenticated
    // Store current location in state for redirect after successful login
    if (!isAuthenticated) {
        return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />
    }

    // Render protected content if authenticated
    return <>{children}</>
}
