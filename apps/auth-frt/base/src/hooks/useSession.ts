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
        const [loading, setLoading] = useState(fetchOnMount)
        const [error, setError] = useState<string | null>(null)

        const refresh = useCallback(async (): Promise<AuthUser | null> => {
                setLoading(true)
                setError(null)
                try {
                        const { data } = await client.get<AuthUser>('auth/me')
                        setUser(data)
                        return data
                } catch (err: any) {
                        setUser(null)
                        const message = err?.response?.data?.error ?? err?.message ?? 'Unauthorized'
                        setError(message)
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
                        logout,
                }),
                [user, loading, error, refresh, logout],
        )
}
