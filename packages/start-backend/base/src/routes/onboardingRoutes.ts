import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { AuthUser } from '@universo/auth-backend'
import { Profile } from '@universo/profile-backend'
import { getRequestManager } from '@universo/utils/database'

/**
 * Resolve user ID from request
 */
const resolveUserId = (req: Request): string | undefined => {
    const user = (req as unknown as { user?: AuthUser }).user
    if (!user) return undefined
    return user.id
}

/**
 * Create onboarding routes
 *
 * NOTE: The original onboarding items (Projects, Campaigns, Clusters) have been removed
 * as part of the legacy packages cleanup (2025-07). This stub preserves the API contract
 * so the frontend degrades gracefully — it returns empty item lists and allows
 * marking onboarding as completed.
 */
export function createOnboardingRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })

    // All onboarding routes require authentication
    router.use(ensureAuth)

    /**
     * GET /items - Get onboarding status (items removed, returns empty arrays)
     */
    router.get('/items', readLimiter, async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' })
        }

        const ds = getDataSource()
        const manager = getRequestManager(req, ds)

        try {
            const profile = await manager.findOne(Profile, {
                where: { user_id: userId }
            })
            const onboardingCompleted = profile?.onboarding_completed ?? false

            res.json({
                onboardingCompleted,
                projects: [],
                campaigns: [],
                clusters: []
            })
        } catch (error) {
            console.error('[onboarding] Error fetching items:', error)
            res.status(500).json({ error: 'Failed to fetch onboarding items' })
        }
    })

    /**
     * POST /join - Mark onboarding as completed (items no longer synced)
     */
    router.post('/join', writeLimiter, async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' })
        }

        // Accept same shape as before for backward compatibility
        const schema = z.object({
            projectIds: z.array(z.string().uuid()).optional().default([]),
            campaignIds: z.array(z.string().uuid()).optional().default([]),
            clusterIds: z.array(z.string().uuid()).optional().default([])
        })

        const parsed = schema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Invalid request body',
                details: parsed.error.flatten()
            })
        }

        const ds = getDataSource()
        const manager = getRequestManager(req, ds)

        try {
            // Mark onboarding as completed
            const updateResult = await manager.update(Profile, { user_id: userId }, { onboarding_completed: true })
            if (updateResult.affected === 0) {
                console.warn(`[onboarding] Profile not found for user ${userId}. Onboarding status not updated.`)
                return res.status(404).json({ error: 'Profile not found' })
            }

            res.json({
                success: true,
                added: { projects: 0, campaigns: 0, clusters: 0 },
                removed: { projects: 0, campaigns: 0, clusters: 0 },
                onboardingCompleted: true
            })
        } catch (error) {
            console.error('[onboarding] Error syncing items:', error)
            res.status(500).json({ error: 'Failed to sync selected items' })
        }
    })

    return router
}
