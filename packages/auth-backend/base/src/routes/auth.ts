import { Router } from 'express'
import passport from 'passport'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { ensureAuthenticated, getSupabaseForReq, ensureAndRefresh, type AuthenticatedRequest } from '../services/supabaseSession'
import { createPermissionService } from '../services/permissionService'
import type { DataSource } from 'typeorm'

const LoginSchema = z.object({
    email: z.string().email().max(320),
    password: z.string().min(6).max(1024)
})

const RegisterSchema = z.object({
    email: z.string().email().max(320),
    password: z.string().min(6).max(1024)
})

type MiddlewareFn = (...args: any[]) => unknown

type RouterFactoryOptions = {
    csrfProtection: MiddlewareFn
    loginLimiter: MiddlewareFn
    getDataSource?: () => DataSource
}

type RouterFactory = (csrfProtection: MiddlewareFn, loginLimiter: MiddlewareFn, getDataSource?: () => DataSource) => Router

export const createAuthRouter: RouterFactory = (csrfProtection, loginLimiter, getDataSource) => {
    const router = Router()

    router.get('/csrf', csrfProtection, (req, res) => {
        const request = req as AuthenticatedRequest
        return res.json({ csrfToken: request.csrfToken?.() ?? '' })
    })

    router.post('/register', loginLimiter, csrfProtection, async (req, res) => {
        const parsed = RegisterSchema.safeParse(req.body)
        if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

        try {
            const supa = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string, {
                auth: { persistSession: false }
            })
            const { data, error } = await supa.auth.signUp({
                email: parsed.data.email,
                password: parsed.data.password
            })
            if (error || !data?.user) {
                return res.status(400).json({ error: error?.message ?? 'Registration failed' })
            }
            console.info('[auth] register success', { email: data.user.email })
            return res.status(201).json({ user: { id: data.user.id, email: data.user.email } })
        } catch (error) {
            console.error('[auth] Registration failed', error)
            return res.status(500).json({ error: 'Server error' })
        }
    })

    router.post('/login', loginLimiter, csrfProtection, (req, res, next) => {
        const parsed = LoginSchema.safeParse(req.body)
        if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
        const request = req as AuthenticatedRequest
        request.session.regenerate?.((regenErr) => {
            if (regenErr) return res.status(500).json({ error: 'Server error' })
            passport.authenticate('local', (err: any, user: any, info: any) => {
                if (err) return res.status(500).json({ error: 'Server error' })
                if (!user) return res.status(401).json({ error: 'Invalid credentials' })
                request.logIn?.(user, (loginErr?: Error | null) => {
                    if (loginErr) return res.status(500).json({ error: 'Server error' })
                    if (info?.tokens) (request.session as any).tokens = info.tokens
                    console.info('[auth] login success', {
                        hasTokens: Boolean((request.session as any).tokens),
                        user: (user as any)?.email
                    })
                    return res.json({ user: { id: (user as any).id, email: (user as any).email } })
                })
            })(req, res, next)
        })
    })

    router.get('/me', ensureAuthenticated, async (req, res) => {
        const request = req as AuthenticatedRequest
        const supa = getSupabaseForReq(request)
        const tokens = (request.session as any).tokens
        const { data, error } = await supa.auth.getUser(tokens?.access)
        if (error || !data?.user) return res.status(401).json({ error: 'Unauthorized' })
        console.info('[auth] /me success', {
            email: data.user.email
        })
        return res.json({ id: data.user.id, email: data.user.email })
    })

    router.post('/refresh', ensureAuthenticated, csrfProtection, ensureAndRefresh, (_req, res) => res.json({ ok: true }))

    router.post('/logout', ensureAuthenticated, csrfProtection, async (req, res) => {
        const request = req as AuthenticatedRequest
        try {
            const tokens = (request.session as any).tokens
            const supa = getSupabaseForReq(request)
            await supa.auth.setSession({ access_token: tokens.access, refresh_token: tokens.refresh })
            await supa.auth.signOut()
        } catch (e) {
            // Log the error for debugging, but don't block the user logout.
            console.error('[auth] Supabase signOut failed, proceeding with local logout', e)
        }
        request.logout(() => request.session?.destroy?.(() => res.json({ success: true })))
    })

    // CASL permissions endpoint - returns user's permissions with metadata for frontend
    router.get('/permissions', ensureAuthenticated, async (req, res) => {
        const request = req as AuthenticatedRequest
        const userId = request.user?.id

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        if (!getDataSource) {
            console.warn('[auth] /permissions called but getDataSource not provided')
            return res.status(501).json({ error: 'Permissions endpoint not configured' })
        }

        try {
            const permissionService = createPermissionService({ getDataSource })
            const fullPermissions = await permissionService.getFullPermissions(userId)

            console.info('[auth] /permissions success', {
                userId,
                permissionsCount: fullPermissions.permissions.length,
                globalRolesCount: fullPermissions.globalRoles.length,
                hasAdminAccess: fullPermissions.hasAdminAccess
            })

            return res.json(fullPermissions)
        } catch (error) {
            console.error('[auth] Failed to load permissions', error)
            return res.status(500).json({ error: 'Failed to load permissions' })
        }
    })

    return router
}

export default createAuthRouter
