import React, { createContext, useContext, useMemo, useRef } from 'react'
import { useSession } from '@universo/auth-frt'
import client from '@/api/client'

/**
 * Universo Platformo | Authentication context
 * This provides authentication state and methods throughout the application.
 */
export const AuthContext = createContext()

/**
 * Hook to use the authentication context
 */
export const useAuth = () => useContext(AuthContext)

/**
 * Authentication provider component
 * Manages authentication state, token refresh, and provides auth methods
 */
export const AuthProvider = ({ children }) => {
    const session = useSession({ client })
    const logoutInProgress = useRef(false)

    const value = useMemo(() => {
        const login = async (email, password) => {
            await client.post('auth/login', { email, password })
            const refreshedUser = await session.refresh()
            if (!refreshedUser) {
                throw new Error('Failed to refresh session after login')
            }
        }

        const logout = async () => {
            if (logoutInProgress.current) return
            logoutInProgress.current = true
            try {
                if (session.user) {
                    await session.logout()
                }
            } catch (error) {
                console.error('[auth] logout failed', error)
            } finally {
                try {
                    await session.refresh()
                } finally {
                    window.location.href = '/auth'
                    logoutInProgress.current = false
                }
            }
        }

        return {
            user: session.user,
            loading: session.loading,
            error: session.error,
            login,
            logout,
            refresh: session.refresh,
            client,
            isAuthenticated: !!session.user
        }
    }, [session])

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
