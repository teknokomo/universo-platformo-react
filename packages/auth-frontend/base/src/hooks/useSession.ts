import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AuthClient } from '../api/client'

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

    console.log('[useSession] Current state:', { user, loading, error })

    /**
     * Fetch current user from /auth/me endpoint
     */
    const refresh = useCallback(async (): Promise<AuthUser | null> => {
        console.log('[useSession] refresh() called')
        try {
            setLoading(true)
            setError(null)

            const response = await client.get<AuthUser>('/auth/me')
            console.log('[useSession] /auth/me response:', response.data)
            
            setUser(response.data)
            return response.data
        } catch (err) {
            console.error('[useSession] /auth/me error:', err)
            
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user'
            setError(errorMessage)
            setUser(null)
            return null
        } finally {
            setLoading(false)
        }
    }, [client])

    const logout = useCallback(async () => {
        await client.post('auth/logout', {})
        setUser(null)
    }, [client])

    useEffect(() => {
        if (!fetchOnMount) return
        refresh().catch((err) => {
            console.error('[auth] Failed to fetch session', err)
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
