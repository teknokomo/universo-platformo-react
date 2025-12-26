import React, { createContext, useContext, useMemo, useRef, type ReactNode } from 'react'
import { useSession, type AuthUser } from '../hooks/useSession'
import { clearStoredCsrfToken, type AuthClient } from '../api/client'

/**
 * Universo Platformo | Authentication context value
 */
export interface AuthContextValue {
    /** Current authenticated user or null if not authenticated */
    user: AuthUser | null
    /** True while fetching/refreshing session */
    loading: boolean
    /** Last error message from auth operations */
    error: string | null
    /** True if user is authenticated */
    isAuthenticated: boolean
    /** Login with email and password */
    login: (email: string, password: string) => Promise<void>
    /** Logout current user and redirect to /auth */
    logout: () => Promise<void>
    /** Refresh current session */
    refresh: () => Promise<AuthUser | null>
    /** Axios client instance with auth interceptors */
    client: AuthClient
}

/**
 * Authentication context
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

AuthContext.displayName = 'AuthContext'

// Debug identifier to verify module instance identity across provider/consumer.
// If multiple copies of this module are bundled, the ID will differ.
const AUTH_DEBUG_ID = (() => {
    try {
        // Prefer a stable hash based on module URL when available
        const src = typeof import.meta?.url === 'string' ? import.meta.url : Math.random().toString(36)
        let hash = 0
        for (let i = 0; i < src.length; i++) hash = (hash * 31 + src.charCodeAt(i)) | 0
        return `auth-frontend:${(hash >>> 0).toString(16)}`
    } catch {
        return `auth-frontend:${Math.random().toString(36).slice(2)}`
    }
})()

/**
 * Hook to use the authentication context
 * @throws {Error} If used outside of AuthProvider
 */
export const useAuth = (): AuthContextValue => {
    const context = useContext(AuthContext)
    if (!context) {
        // Log even in production: this is a fatal usage error helpful for diagnostics
        // eslint-disable-next-line no-console
        console.error('[auth] useAuth invoked without provider', {
            moduleId: import.meta.url,
            debugId: AUTH_DEBUG_ID,
            contextValue: context
        })
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}

/**
 * Authentication provider props
 */
export interface AuthProviderProps {
    /** Axios client instance with auth interceptors */
    client: AuthClient
    /** Children components */
    children: ReactNode
}

/**
 * Authentication provider component
 * Manages authentication state, token refresh, and provides auth methods
 *
 * @example
 * ```tsx
 * import { createAuthClient, AuthProvider } from '@universo/auth-frontend'
 *
 * const client = createAuthClient({ baseURL: '/api/v1' })
 *
 * <AuthProvider client={client}>
 *   <App />
 * </AuthProvider>
 * ```
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ client, children }) => {
    // Development-only duplicate module warning. Helps catch multiple copies of this package.
    // Do not change runtime behavior; logs only in dev.
    if (import.meta.env?.MODE !== 'production' && typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any
        const KEY = '__UNIVERSO_AUTH_FRT_SINGLETON__'
        if (w[KEY]) {
            // eslint-disable-next-line no-console
            console.warn('[auth] Multiple copies of @universo/auth-frontend detected', { moduleId: import.meta.url })
        }
        w[KEY] = true
    }

    const session = useSession({ client })
    const logoutInProgress = useRef(false)

    // DEBUG: Log session state and module identity (kept even in production; low volume)
    // eslint-disable-next-line no-console
    console.log('[AuthProvider] Session state:', {
        moduleId: import.meta.url,
        debugId: AUTH_DEBUG_ID,
        user: session.user,
        loading: session.loading,
        error: session.error
    })

    const value = useMemo<AuthContextValue>(() => {
        const login = async (email: string, password: string): Promise<void> => {
            const doLogin = async () => {
                await client.post('auth/login', { email, password })
            }

            try {
                await doLogin()
            } catch (err: any) {
                const status = err?.response?.status
                if (status === 419) {
                    // CSRF token expired (e.g., after server restart with MemoryStore)
                    // Clear stale token and retry once
                    clearStoredCsrfToken(client)
                    await doLogin()
                } else {
                    throw err
                }
            }

            clearStoredCsrfToken(client)
            const refreshedUser = await session.refresh()
            if (!refreshedUser) {
                throw new Error('Failed to refresh session after login')
            }
        }

        const logout = async (): Promise<void> => {
            if (logoutInProgress.current) {
                return
            }

            logoutInProgress.current = true

            try {
                if (session.user) {
                    await session.logout()
                }
            } catch (error) {
                console.error('[auth] logout failed', error)
            } finally {
                logoutInProgress.current = false
                // No redirect - let React re-render with guest content based on isAuthenticated state
            }
        }

        return {
            user: session.user,
            loading: session.loading,
            error: session.error,
            isAuthenticated: !!session.user,
            login,
            logout,
            refresh: session.refresh,
            client
        }
    }, [session, client])

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

AuthProvider.displayName = 'AuthProvider'
