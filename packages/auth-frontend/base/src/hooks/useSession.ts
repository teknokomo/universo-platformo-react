import { useCallback, useEffect, useMemo, useState } from 'react'
import { isDevelopment } from '@universo/utils'
import { clearStoredCsrfToken, type AuthClient } from '../api/client'

export interface AuthUser {
    id: string
    email: string
}

export interface UseSessionResult {
    user: AuthUser | null
    loading: boolean
    error: string | null
    refresh: () => Promise<AuthUser | null>
    logout: () => Promise<void>
}

export interface UseSessionOptions {
    client: AuthClient
    fetchOnMount?: boolean
}

export const useSession = ({ client, fetchOnMount = true }: UseSessionOptions): UseSessionResult => {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)

    /**
     * Fetch current user from /auth/me endpoint
     */
    const refresh = useCallback(async (): Promise<AuthUser | null> => {
        try {
            setLoading(true)
            setError(null)

            const response = await client.get<AuthUser>('/auth/me')

            setUser(response.data)
            return response.data
        } catch (err) {
            if (isDevelopment()) {
                console.error('[useSession] /auth/me error:', err)
            }

            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user'
            setError(errorMessage)
            setUser(null)
            return null
        } finally {
            setLoading(false)
        }
    }, [client])

    const logout = useCallback(async () => {
        try {
            await client.post('auth/logout', {})
        } catch (err: any) {
            const status = err?.response?.status
            if (status === 419) {
                clearStoredCsrfToken(client)
                await client.post('auth/logout', {})
            } else {
                throw err
            }
        } finally {
            setUser(null)
        }
    }, [client])

    useEffect(() => {
        if (!fetchOnMount) return
        refresh().catch((err) => {
            if (isDevelopment()) {
                console.error('[auth] Failed to fetch session', err)
            }
        })
    }, [fetchOnMount, refresh])

    return useMemo(
        () => ({
            user,
            loading,
            error,
            refresh,
            logout
        }),
        [user, loading, error, refresh, logout]
    )
}
