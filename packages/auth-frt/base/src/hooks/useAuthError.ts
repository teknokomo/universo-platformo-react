import { useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../providers/authProvider'

/**
 * Error object structure from API responses
 */
interface ApiError {
    response?: {
        status?: number
    }
}

/**
 * Type guard to check if error is an API error with status
 */
const isApiError = (error: unknown): error is ApiError => {
    return (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as ApiError).response === 'object' &&
        (error as ApiError).response !== null
    )
}

/**
 * Return type for useAuthError hook
 */
export interface UseAuthErrorResult {
    /**
     * Handle authentication errors (primarily 401 Unauthorized)
     * @param error - Error object from API call
     * @returns true if error was handled (401), false otherwise
     */
    handleAuthError: (error: unknown) => boolean
}

/**
 * Universo Platformo | Custom hook for handling authentication errors
 *
 * Provides consistent 401 error handling across components.
 * When a 401 error is detected, it will either logout the user
 * or redirect to the login page depending on authentication state.
 *
 * @example
 * ```tsx
 * const { handleAuthError } = useAuthError()
 *
 * try {
 *   await api.get('/protected-resource')
 * } catch (error) {
 *   if (handleAuthError(error)) {
 *     return // Error was handled
 *   }
 *   // Handle other errors
 * }
 * ```
 */
export const useAuthError = (): UseAuthErrorResult => {
    const authContext = useAuth()
    const { logout, isAuthenticated } = authContext
    const navigate = useNavigate()
    const location = useLocation()

    const handleAuthError = useCallback(
        (error: unknown): boolean => {
            // Check if error is a 401 Unauthorized
            if (!isApiError(error) || error.response?.status !== 401) {
                return false
            }

            // Don't redirect if already on auth page
            const isAuthPath = location.pathname.startsWith('/auth')

            if (isAuthenticated) {
                // User is authenticated but got 401 - logout
                void logout()
            } else if (!isAuthPath) {
                // User is not authenticated - redirect to login
                navigate('/auth', {
                    state: { from: location.pathname },
                    replace: true
                })
            }

            return true // Error was handled
        },
        [logout, navigate, location, isAuthenticated]
    )

    return { handleAuthError }
}
