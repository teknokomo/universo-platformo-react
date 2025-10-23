import { createClient } from '@supabase/supabase-js'
import type { Request, Response, NextFunction } from 'express'

export interface SessionTokens {
        access: string
        refresh: string
        exp: number
}

export interface SessionWithTokens {
        tokens?: SessionTokens
        destroy?: (callback: (err?: Error | null) => void) => void
        regenerate?: (callback: (err?: Error | null) => void) => void
}

export type AuthenticatedRequest = Request & {
        session: SessionWithTokens
        user?: { id: string }
        logIn: Request['logIn']
        login: Request['login']
        logout: Request['logout']
        logOut: Request['logOut']
        isAuthenticated: Request['isAuthenticated']
        isUnauthenticated: Request['isUnauthenticated']
        csrfToken?: () => string
}

type Middleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void> | Response

const getSessionTokens = (req: AuthenticatedRequest): SessionTokens | undefined => req.session?.tokens

const locks = new Map<string, Promise<void>>()

const secondsUntilExp = (exp: number) => exp - Math.floor(Date.now() / 1000)

export const ensureAuthenticated: Middleware = (req, res, next) => {
        const request = req as AuthenticatedRequest
        if (request.isAuthenticated?.() && getSessionTokens(request)?.access) return next()
        return res.status(401).json({ error: 'Unauthorized' })
}

export const getSupabaseForReq = (req: Request) => {
        const tokens = (req as AuthenticatedRequest).session?.tokens as SessionTokens | undefined
        return createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string, {
                global: { headers: { Authorization: tokens?.access ? `Bearer ${tokens.access}` : '' } },
                auth: { persistSession: false },
        })
}

export const ensureAndRefresh: Middleware = async (req, res, next) => {
        const request = req as AuthenticatedRequest
        await refreshSession(request, res)
        if (!res.headersSent) next()
}

const refreshSession = async (req: AuthenticatedRequest, res: Response) => {
        const tokens = getSessionTokens(req)
        if (!tokens?.access || !tokens?.refresh) {
                res.status(401).json({ error: 'Unauthorized' })
                return
        }

        // Refresh if less than 2 minutes to expire
        if (secondsUntilExp(tokens.exp) > 120) return

        const key = req.user?.id
        if (!key) {
                res.status(401).json({ error: 'Unauthorized' })
                return
        }
        if (!locks.has(key)) {
                locks.set(
                        key,
                        (async () => {
                                const supa = getSupabaseForReq(req)
                                await supa.auth.setSession({ access_token: tokens.access, refresh_token: tokens.refresh })
                                const { data, error } = await supa.auth.refreshSession({ refresh_token: tokens.refresh })
                                if (error || !data?.session) {
                                        return new Promise<void>((resolve) => req.logout(() => req.session?.destroy?.(() => resolve())))
                                }
                                const access = data.session.access_token
                                const refresh = data.session.refresh_token
                                const payload = JSON.parse(Buffer.from(access.split('.')[1], 'base64').toString())
                                req.session.tokens = { access, refresh, exp: payload?.exp ?? tokens.exp }
                        })().finally(() => {
                                locks.delete(key)
                        })
                )
        }
        await locks.get(key)
        if (!req.session?.tokens?.access) {
                res.status(401).json({ error: 'Unauthorized' })
        }
}

export { refreshSession }
export type { AuthenticatedRequest as RequestWithSessionTokens }
