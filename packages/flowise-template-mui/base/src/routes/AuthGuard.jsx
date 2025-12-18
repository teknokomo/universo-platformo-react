import { Navigate, useLocation } from 'react-router-dom'
import PropTypes from 'prop-types'
import { useAuth } from '@universo/auth-frontend'
import { Loader } from '@flowise/template-mui'

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

AuthGuard.propTypes = {
    children: PropTypes.node
}

export default AuthGuard
