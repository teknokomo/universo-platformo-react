import { Router, Request, Response, RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { ProfileService } from '@universo/profile-backend'
import type { DbExecutor } from '@universo/utils/database'

/**
 * Resolve authenticated user fields from request.
 */
const resolveAuthUser = (req: Request): { id?: string; email?: string } => {
    const user = (req as unknown as { user?: { id?: string; email?: string } }).user
    return {
        id: user?.id,
        email: user?.email
    }
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
    getRequestDbExecutor: (req: unknown) => DbExecutor,
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
        const { id: userId } = resolveAuthUser(req)
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' })
        }

        const exec = getRequestDbExecutor(req)

        try {
            const rows = await exec.query<{ onboarding_completed: boolean }>(
                'SELECT onboarding_completed FROM public.profiles WHERE user_id = $1 LIMIT 1',
                [userId]
            )
            const onboardingCompleted = rows[0]?.onboarding_completed ?? false

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
        const { id: userId, email } = resolveAuthUser(req)
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

        const exec = getRequestDbExecutor(req)
        const profileService = new ProfileService(exec)

        try {
            await profileService.markOnboardingCompleted(userId, email)

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
