import React, { createContext, useContext, useMemo, useRef, type ReactNode } from 'react'
import { isDevelopment } from '@universo/utils'
import { useSession, type AuthUser } from '../hooks/useSession'
import { clearStoredCsrfToken, type AuthClient } from '../api/client'

declare global {
    interface Window {
        __UNIVERSO_AUTH_FRT_SINGLETON__?: boolean
    }
}

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
    /** Login with email and password (optionally with captcha token) */
    login: (email: string, password: string, captchaToken?: string) => Promise<void>
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

/**
 * Hook to use the authentication context
 * @throws {Error} If used outside of AuthProvider
 */
export const useAuth = (): AuthContextValue => {
    const context = useContext(AuthContext)
    if (!context) {
        if (isDevelopment()) {
            // eslint-disable-next-line no-console
            console.error('[auth] useAuth invoked without provider')
        }
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
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
        const KEY = '__UNIVERSO_AUTH_FRT_SINGLETON__'
        if (window[KEY]) {
            // eslint-disable-next-line no-console
            console.warn('[auth] Multiple copies of @universo/auth-frontend detected')
        }
        window[KEY] = true
    }

    const session = useSession({ client })
    const logoutInProgress = useRef(false)

    const value = useMemo<AuthContextValue>(() => {
        const login = async (email: string, password: string, captchaToken?: string): Promise<void> => {
            const doLogin = async () => {
                await client.post('auth/login', { email, password, captchaToken })
            }

            try {
                await doLogin()
            } catch (err: unknown) {
                const status =
                    typeof err === 'object' && err !== null && 'response' in err
                        ? (err.response as { status?: number } | undefined)?.status
                        : undefined
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
                if (isDevelopment()) {
                    console.error('[auth] logout failed', error)
                }
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
