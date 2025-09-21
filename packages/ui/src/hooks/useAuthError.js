import { useAuth } from '@/utils/authProvider'
import { useNavigate, useLocation } from 'react-router-dom'
import { useCallback } from 'react'

/**
 * Universo Platformo | Custom hook for handling authentication errors
 * Provides consistent 401 error handling across components
 */
export const useAuthError = () => {
    const { logout, isAuthenticated } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const handleAuthError = useCallback(
        (error) => {
            if (error?.response?.status === 401) {
                const isAuthPath = location.pathname.startsWith('/auth')
                if (isAuthenticated) {
                    logout()
                } else if (!isAuthPath) {
                    navigate('/auth', {
                        state: { from: location.pathname },
                        replace: true
                    })
                }
                return true // Error was handled
            }
            return false // Error was not handled, let component handle it
        },
        [logout, navigate, location, isAuthenticated]
    )

    return { handleAuthError }
}
