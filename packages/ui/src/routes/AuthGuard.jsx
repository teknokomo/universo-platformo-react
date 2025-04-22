import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/utils/authProvider'
import Loader from '@/ui-component/loading/Loader'

/**
 * Universo Platformo | Route protection component
 * Protects routes from unauthorized access and redirects to auth page
 */
const AuthGuard = ({ children }) => {
    const { isAuthenticated, loading } = useAuth()
    const location = useLocation()

    // Show loader while checking authentication
    if (loading) {
        return <Loader />
    }

    // Redirect to auth page if not authenticated
    if (!isAuthenticated) {
        return <Navigate to='/auth' state={{ from: location.pathname }} replace />
    }

    // Render children if authenticated
    return children
}

export default AuthGuard
