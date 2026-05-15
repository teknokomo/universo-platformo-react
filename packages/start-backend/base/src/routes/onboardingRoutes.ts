import { Router, Request, Response, RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { ProfileService } from '@universo/profile-backend'
import type { AssignSystemRole } from '@universo/types'
import type { DbExecutor } from '@universo/utils/database'
import { activeAppRowCondition } from '@universo/utils'
import {
    fetchObjectItems,
    fetchAllUserSelections,
    syncUserSelections,
    validateItemExists,
    type ObjectKind,
    type OnboardingObjectRow
} from '../persistence/onboardingStore'

const resolveAuthUser = (req: Request): { id?: string; email?: string } => {
    const user = (req as unknown as { user?: { id?: string; email?: string } }).user
    return {
        id: user?.id,
        email: user?.email
    }
}

const OBJECT_KINDS: ObjectKind[] = ['goals', 'topics', 'features']

const selectionsSchema = z.object({
    goals: z.array(z.string().uuid()),
    topics: z.array(z.string().uuid()),
    features: z.array(z.string().uuid())
})

const dedupeSelectionIds = (itemIds: string[]): string[] => [...new Set(itemIds)]

export function createOnboardingRoutes(
    ensureAuth: RequestHandler,
    getRequestDbExecutor: (req: unknown) => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler,
    assignSystemRole?: AssignSystemRole
): Router {
    const router = Router({ mergeParams: true })

    router.use(ensureAuth)

    router.get('/items', readLimiter, async (req: Request, res: Response) => {
        const { id: userId } = resolveAuthUser(req)
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' })
        }

        const exec = getRequestDbExecutor(req)
        const profileService = new ProfileService(exec)

        try {
            const [goals, topics, features, selections, profile] = await Promise.all([
                fetchObjectItems(exec, 'goals'),
                fetchObjectItems(exec, 'topics'),
                fetchObjectItems(exec, 'features'),
                fetchAllUserSelections(exec, userId),
                profileService.getUserProfile(userId)
            ])

            const selectionSet = new Set(selections.map((s) => s.item_id))
            const mapItems = (rows: OnboardingObjectRow[]) =>
                rows.map((r) => ({
                    id: r.id,
                    codename: r.codename,
                    name: r.name,
                    description: r.description,
                    sortOrder: r.sort_order,
                    isSelected: selectionSet.has(r.id)
                }))

            res.json({
                onboardingCompleted: profile?.onboarding_completed ?? false,
                goals: mapItems(goals),
                topics: mapItems(topics),
                features: mapItems(features)
            })
        } catch (error) {
            console.error('[onboarding] Error fetching items:', error)
            res.status(500).json({ error: 'Failed to fetch onboarding items' })
        }
    })

    router.post('/selections', writeLimiter, async (req: Request, res: Response) => {
        const { id: userId } = resolveAuthUser(req)
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' })
        }

        const parsed = selectionsSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Invalid request body',
                details: parsed.error.flatten()
            })
        }

        const exec = getRequestDbExecutor(req)
        const data = {
            goals: dedupeSelectionIds(parsed.data.goals),
            topics: dedupeSelectionIds(parsed.data.topics),
            features: dedupeSelectionIds(parsed.data.features)
        }

        try {
            const results = await exec.transaction(async (trx) => {
                for (const kind of OBJECT_KINDS) {
                    for (const itemId of data[kind]) {
                        const exists = await validateItemExists(trx, kind, itemId)
                        if (!exists) {
                            return {
                                error: `Item ${itemId} not found in ${kind} object`
                            }
                        }
                    }
                }

                return {
                    goals: await syncUserSelections(trx, userId, 'goals', data.goals),
                    topics: await syncUserSelections(trx, userId, 'topics', data.topics),
                    features: await syncUserSelections(trx, userId, 'features', data.features)
                }
            })

            if ('error' in results) {
                return res.status(400).json({ error: results.error })
            }

            res.json({
                success: true,
                added: {
                    goals: results.goals.added,
                    topics: results.topics.added,
                    features: results.features.added
                },
                removed: {
                    goals: results.goals.removed,
                    topics: results.topics.removed,
                    features: results.features.removed
                }
            })
        } catch (error) {
            console.error('[onboarding] Error syncing selections:', error)
            res.status(500).json({ error: 'Failed to sync selections' })
        }
    })

    router.post('/complete', writeLimiter, async (req: Request, res: Response) => {
        const { id: userId, email } = resolveAuthUser(req)
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' })
        }

        const exec = getRequestDbExecutor(req)
        const profileService = new ProfileService(exec)

        try {
            const previousProfile = await profileService.getUserProfile(userId)
            const profile = await profileService.markOnboardingCompleted(userId, email)

            if (process.env.AUTO_ROLE_AFTER_ONBOARDING !== 'false' && assignSystemRole) {
                try {
                    await assignSystemRole({
                        userId,
                        roleCodename: 'User',
                        reason: 'auto-assigned on onboarding completion'
                    })
                } catch (roleAssignmentError) {
                    if (!previousProfile?.onboarding_completed) {
                        try {
                            await exec.query(
                                `UPDATE profiles.obj_profiles
                                 SET onboarding_completed = $1, _upl_updated_at = NOW()
                                 WHERE user_id = $2 AND ${activeAppRowCondition()}`,
                                [false, userId]
                            )
                        } catch (rollbackError) {
                            console.error(
                                '[onboarding] Failed to roll back onboarding completion after role assignment error:',
                                rollbackError
                            )
                        }
                    }

                    throw roleAssignmentError
                }
            }

            res.json({ success: true, onboardingCompleted: profile.onboarding_completed })
        } catch (error) {
            console.error('[onboarding] Error completing onboarding:', error)
            res.status(500).json({ error: 'Failed to complete onboarding' })
        }
    })

    return router
}
