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
    password: z.string().min(6).max(1024),
    termsAccepted: z.literal(true, {
        errorMap: () => ({ message: 'Terms of Service must be accepted' })
    }),
    privacyAccepted: z.literal(true, {
        errorMap: () => ({ message: 'Privacy Policy must be accepted' })
    })
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
        if (!parsed.success) {
            const firstError = parsed.error.errors[0]?.message || 'Invalid payload'
            return res.status(400).json({ error: firstError })
        }

        try {
            const supa = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string, {
                auth: { persistSession: false }
            })
            
            const now = new Date()
            const consentVersion = '1.0.0' // Current version of legal documents
            const { data, error } = await supa.auth.signUp({
                email: parsed.data.email,
                password: parsed.data.password,
                options: {
                    data: {
                        terms_accepted: parsed.data.termsAccepted,
                        terms_accepted_at: now.toISOString(),
                        privacy_accepted: parsed.data.privacyAccepted,
                        privacy_accepted_at: now.toISOString(),
                        consent_version: consentVersion
                    }
                }
            })
            if (error || !data?.user) {
                return res.status(400).json({ error: error?.message ?? 'Registration failed' })
            }

            // Save consent data to profile (profile is auto-created by Supabase trigger)
            // Using retry pattern with RETURNING clause for reliable affected row check
            if (getDataSource) {
                const userId = data.user.id
                const maxAttempts = 5
                let consentSaved = false

                console.info('[auth:profile] Starting profile consent save', { userId, email: data.user.email })

                // Retry up to 5 times with increasing delays to wait for trigger to create profile
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    try {
                        const dataSource = getDataSource()
                        console.info('[auth:profile] DataSource obtained', { userId, attempt, isInitialized: dataSource?.isInitialized })

                        // First, check if profile exists
                        const existingProfile = await dataSource.query(
                            `SELECT user_id, nickname, terms_accepted FROM profiles WHERE user_id = $1`,
                            [userId]
                        )
                        console.info('[auth:profile] Profile check result', { 
                            userId, 
                            attempt, 
                            exists: existingProfile?.length > 0,
                            profile: existingProfile?.[0] || null
                        })

                        // Use RETURNING to reliably check if UPDATE affected any rows
                        const updateResult = await dataSource.query(
                            `UPDATE profiles 
                             SET terms_accepted = $1, 
                                 terms_accepted_at = $2, 
                                 privacy_accepted = $3, 
                                 privacy_accepted_at = $4,
                                 consent_version = $5
                             WHERE user_id = $6
                             RETURNING user_id`,
                            [true, now, true, now, consentVersion, userId]
                        )
                        // PostgreSQL with TypeORM returns [rows[], rowCount] for queries with RETURNING
                        // updateResult[0] is the array of returned rows, updateResult[1] is affected count
                        const returnedRows = Array.isArray(updateResult) ? updateResult[0] : updateResult
                        const hasRows = Array.isArray(returnedRows) && returnedRows.length > 0
                        console.info('[auth:profile] UPDATE result', { 
                            userId, 
                            attempt, 
                            rawResult: updateResult,
                            returnedRows,
                            hasRows
                        })

                        if (hasRows) {
                            console.info('[auth] consent saved via UPDATE', { userId, attempt })
                            consentSaved = true
                            break
                        }
                        // Profile not yet created by trigger, wait and retry
                        console.info('[auth:profile] Profile not found, waiting before retry', { userId, attempt, waitMs: 200 * attempt })
                        if (attempt < maxAttempts) {
                            await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
                        }
                    } catch (dbError) {
                        console.warn('[auth] consent save attempt failed', { userId, attempt, error: String(dbError), stack: (dbError as Error)?.stack })
                        if (attempt < maxAttempts) {
                            await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
                        }
                    }
                }

                // Fallback: if UPDATE never succeeded, INSERT profile with consent using UPSERT
                if (!consentSaved) {
                    console.info('[auth:profile] UPDATE failed after all attempts, trying UPSERT fallback', { userId })
                    try {
                        const dataSource = getDataSource()
                        const nickname = `user_${userId.substring(0, 8)}`
                        const upsertResult = await dataSource.query(
                            `INSERT INTO profiles (user_id, nickname, settings, terms_accepted, terms_accepted_at, privacy_accepted, privacy_accepted_at, consent_version)
                             VALUES ($1, $2, '{}', $3, $4, $5, $6, $7)
                             ON CONFLICT (user_id) DO UPDATE
                             SET terms_accepted = EXCLUDED.terms_accepted,
                                 terms_accepted_at = EXCLUDED.terms_accepted_at,
                                 privacy_accepted = EXCLUDED.privacy_accepted,
                                 privacy_accepted_at = EXCLUDED.privacy_accepted_at,
                                 consent_version = EXCLUDED.consent_version
                             RETURNING user_id, nickname`,
                            [userId, nickname, true, now, true, now, consentVersion]
                        )
                        console.info('[auth] consent saved via UPSERT fallback', { userId, result: upsertResult })
                        
                        // Verify profile was created
                        const verifyProfile = await dataSource.query(
                            `SELECT user_id, nickname, terms_accepted, created_at FROM profiles WHERE user_id = $1`,
                            [userId]
                        )
                        console.info('[auth:profile] Verification after UPSERT', { userId, profile: verifyProfile?.[0] || null })
                    } catch (insertError) {
                        console.error('[auth] consent save fallback failed', { userId, error: String(insertError), stack: (insertError as Error)?.stack })
                    }
                }
            } else {
                console.warn('[auth:profile] getDataSource not available, skipping profile consent save')
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

    router.post('/logout', csrfProtection, async (req, res) => {
        const request = req as AuthenticatedRequest

        const cookieName = process.env.SESSION_COOKIE_NAME ?? 'up.session'
        const cookiePath = ((request as any).session?.cookie?.path as string | undefined) ?? '/'

        try {
            const tokens = (request.session as any).tokens
            if (tokens?.access && tokens?.refresh) {
                const supa = getSupabaseForReq(request)
                await supa.auth.setSession({ access_token: tokens.access, refresh_token: tokens.refresh })
                await supa.auth.signOut()
            }
        } catch (e) {
            // Log the error for debugging, but don't block the user logout.
            console.error('[auth] Supabase signOut failed, proceeding with local logout', e)
        }

        await new Promise<void>((resolve) => {
            if (typeof request.logout !== 'function') return resolve()
            request.logout((err?: any) => {
                if (err) console.error('[auth] passport logout failed, proceeding with session destroy', err)
                resolve()
            })
        })

        await new Promise<void>((resolve) => {
            if (typeof request.session?.destroy !== 'function') return resolve()
            request.session.destroy((err?: Error | null) => {
                if (err) console.error('[auth] session destroy failed', err)
                resolve()
            })
        })

        res.clearCookie(cookieName, { path: cookiePath })
        return res.json({ success: true })
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
