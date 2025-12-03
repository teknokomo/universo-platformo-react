import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-backend'
import type { CampaignRole } from '@universo/types'
import { Activity } from '../database/entities/Activity'
import { Event } from '../database/entities/Event'
import { ActivityEvent } from '../database/entities/ActivityEvent'
import { Campaign } from '../database/entities/Campaign'
import { CampaignMember } from '../database/entities/CampaignMember'
import { EventCampaign } from '../database/entities/EventCampaign'
import { ActivityCampaign } from '../database/entities/ActivityCampaign'
import { ensureCampaignAccess, ensureEventAccess, ensureActivityAccess, ROLE_PERMISSIONS } from './guards'
import { z } from 'zod'
import { validateListQuery } from '../schemas/queryParams'
import { escapeLikeWildcards } from '../utils'

/**
 * Get the appropriate manager for the request (RLS-enabled if available)
 */
const getRequestManager = (req: Request, dataSource: DataSource) => {
    const rlsContext = (req as RequestWithDbContext).dbContext
    return rlsContext?.manager ?? dataSource.manager
}

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

// Helper to get repositories from the data source
function getRepositories(req: Request, getDataSource: () => DataSource) {
    const dataSource = getDataSource()
    const manager = getRequestManager(req, dataSource)
    return {
        activityRepo: manager.getRepository(Activity),
        eventRepo: manager.getRepository(Event),
        activityEventRepo: manager.getRepository(ActivityEvent),
        campaignRepo: manager.getRepository(Campaign),
        campaignUserRepo: manager.getRepository(CampaignMember),
        eventCampaignRepo: manager.getRepository(EventCampaign),
        activityCampaignRepo: manager.getRepository(ActivityCampaign)
    }
}

/**
 * Auto-sync activity-campaign links based on event-campaign relationships
 * Ensures activities_campaigns table always reflects which campaigns contain this activity
 * through its events
 */
async function syncActivityCampaignLinks(activityId: string, repos: ReturnType<typeof getRepositories>) {
    const { activityEventRepo, eventCampaignRepo, activityCampaignRepo, activityRepo } = repos

    // Find all events this activity belongs to
    const activityEvents = await activityEventRepo.find({
        where: { activity: { id: activityId } },
        relations: ['event']
    })

    const eventIds = activityEvents.map((es) => es.event.id)

    if (eventIds.length === 0) {
        // Activity has no events - remove all campaign links
        await activityCampaignRepo.delete({ activity: { id: activityId } })
        return
    }

    // Find all campaigns these events belong to
    const eventCampaigns = await eventCampaignRepo.find({
        where: { event: { id: In(eventIds) } },
        relations: ['campaign']
    })

    // Get unique campaign IDs
    const campaignIds = [...new Set(eventCampaigns.map((sm) => sm.campaign.id))]

    // Get current activity-campaign links
    const currentLinks = await activityCampaignRepo.find({
        where: { activity: { id: activityId } },
        relations: ['campaign']
    })

    const currentCampaignIds = new Set(currentLinks.map((link) => link.campaign.id))

    // Add missing links
    const activity = await activityRepo.findOne({ where: { id: activityId } })
    if (!activity) return

    for (const campaignId of campaignIds) {
        if (!currentCampaignIds.has(campaignId)) {
            const link = activityCampaignRepo.create({
                activity: { id: activityId },
                campaign: { id: campaignId }
            })
            await activityCampaignRepo.save(link)
        }
    }

    // Remove obsolete links
    const obsoleteLinks = currentLinks.filter((link) => !campaignIds.includes(link.campaign.id))
    if (obsoleteLinks.length > 0) {
        await activityCampaignRepo.remove(obsoleteLinks)
    }
}

// Comments in English only
export function createActivitiesRouter(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })

    // All routes in this router require authentication
    router.use(ensureAuth)

    // Async handler to wrap async functions and catch errors
    const asyncHandler = (fn: (req: Request, res: Response) => Promise<any>): RequestHandler => {
        return (req, res, next) => {
            fn(req, res).catch(next)
        }
    }

    // GET / - List all activities with pagination, search, sorting
    router.get(
        '/',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            try {
                // Validate and parse query parameters with Zod
                const { limit = 100, offset = 0, sortBy = 'updated', sortOrder = 'desc', search } = validateListQuery(req.query)

                // Parse search parameter
                const escapedSearch = search ? escapeLikeWildcards(search) : ''

                // Safe sorting with whitelist
                const ALLOWED_SORT_FIELDS = {
                    name: 'e.name',
                    created: 'e.createdAt',
                    updated: 'e.updatedAt'
                } as const

                const sortByField = ALLOWED_SORT_FIELDS[sortBy]
                const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'

                // Get activities accessible to user through event membership
                const { activityRepo } = getRepositories(req, getDataSource)
                const qb = activityRepo
                    .createQueryBuilder('e')
                    // Join with activity-event link
                    .innerJoin(ActivityEvent, 'es', 'es.activity_id = e.id')
                    // Join with event
                    .innerJoin(Event, 's', 's.id = es.event_id')
                    // Join with event-campaign link
                    .innerJoin(EventCampaign, 'sm', 'sm.event_id = s.id')
                    // Join with campaign user to filter by user access
                    .innerJoin(CampaignMember, 'mu', 'mu.campaign_id = sm.campaign_id')
                    .where('mu.user_id = :userId', { userId })

                // Add search filter if provided
                if (escapedSearch) {
                    qb.andWhere("(LOWER(e.name) LIKE :search OR LOWER(COALESCE(e.description, '')) LIKE :search)", {
                        search: `%${escapedSearch.toLowerCase()}%`
                    })
                }

                qb.select([
                    'e.id as id',
                    'e.name as name',
                    'e.description as description',
                    'e.createdAt as created_at',
                    'e.updatedAt as updated_at',
                    'mu.role as user_role'
                ])
                    // Use window function to get total count in single query (performance optimization)
                    .addSelect('COUNT(*) OVER()', 'window_total')
                    .groupBy('e.id')
                    .addGroupBy('e.name')
                    .addGroupBy('e.description')
                    .addGroupBy('e.createdAt')
                    .addGroupBy('e.updatedAt')
                    .addGroupBy('mu.role')
                    .orderBy(sortByField, sortDirection)
                    .limit(limit)
                    .offset(offset)

                const raw = await qb.getRawMany<{
                    id: string
                    name: string
                    description: string | null
                    created_at: Date
                    updated_at: Date
                    user_role: string | null
                    window_total?: string
                }>()

                // Extract total count from window function (same value in all rows)
                // Handle edge case: empty result set
                const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) : 0

                const response = raw.map((row) => {
                    const role = (row.user_role || 'member') as CampaignRole
                    const permissions = ROLE_PERMISSIONS[role]

                    return {
                        id: row.id,
                        name: row.name,
                        description: row.description ?? undefined,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                        role,
                        permissions
                    }
                })

                // Add pagination metadata headers for client awareness
                const hasMore = offset + raw.length < total
                res.setHeader('X-Pagination-Limit', limit.toString())
                res.setHeader('X-Pagination-Offset', offset.toString())
                res.setHeader('X-Pagination-Count', raw.length.toString())
                res.setHeader('X-Total-Count', total.toString())
                res.setHeader('X-Pagination-Has-More', hasMore.toString())

                res.json(response)
            } catch (error) {
                // Handle Zod validation errors
                if (error instanceof z.ZodError) {
                    return res.status(400).json({
                        error: 'Invalid query parameters',
                        details: error.errors.map((e) => ({
                            field: e.path.join('.'),
                            message: e.message
                        }))
                    })
                }
                console.error('[ERROR] GET /activities failed:', error)
                res.status(500).json({
                    error: 'Internal server error',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST / (Create a new activity)
    router.post(
        '/',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { activityRepo, eventRepo, activityEventRepo, campaignRepo, activityCampaignRepo } = getRepositories(req, getDataSource)
            const schema = z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                eventId: z.string().uuid(),
                campaignId: z.string().uuid().optional()
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            const { name, description, campaignId, eventId } = parsed.data
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Verify access to the event
            await ensureEventAccess(getDataSource(), userId, eventId, 'createContent')

            try {
                // Validate event exists
                const event = await eventRepo.findOne({ where: { id: eventId } })
                if (!event) return res.status(400).json({ error: 'Invalid eventId' })

                const activity = activityRepo.create({ name, description })
                await activityRepo.save(activity)

                // Create mandatory activity-event link
                const activityEventLink = activityEventRepo.create({ activity, event })
                await activityEventRepo.save(activityEventLink)

                // CRITICAL: Auto-sync activity-campaign links based on event-campaign links
                // This ensures activitiesCount is always accurate in campaign dashboard
                await syncActivityCampaignLinks(activity.id, getRepositories(req, getDataSource))

                // Optional explicit campaign link (kept for backwards compatibility)
                if (campaignId) {
                    // Verify access to the campaign
                    await ensureCampaignAccess(getDataSource(), userId, campaignId, 'createContent')

                    const campaign = await campaignRepo.findOne({ where: { id: campaignId } })
                    if (!campaign) return res.status(400).json({ error: 'Invalid campaignId' })
                    const exists = await activityCampaignRepo.findOne({
                        where: { campaign: { id: campaignId }, activity: { id: activity.id } }
                    })
                    if (!exists) {
                        const link = activityCampaignRepo.create({ campaign, activity })
                        await activityCampaignRepo.save(link)
                    }
                }

                res.status(201).json(activity)
            } catch (error) {
                console.error('POST /activities - Error:', error)
                res.status(500).json({
                    error: 'Failed to create activity',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // GET /:activityId (Get a single activity)
    router.get(
        '/:activityId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureActivityAccess(getDataSource(), userId, req.params.activityId)
            const { activityRepo } = getRepositories(req, getDataSource)
            const activity = await activityRepo.findOneBy({ id: req.params.activityId })
            if (!activity) {
                return res.status(404).json({ error: 'Activity not found' })
            }
            res.json(activity)
        })
    )

    // PUT /:activityId (Update a activity)
    router.put(
        '/:activityId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureActivityAccess(getDataSource(), userId, req.params.activityId, 'editContent')
            const { activityRepo } = getRepositories(req, getDataSource)
            const activity = await activityRepo.findOneBy({ id: req.params.activityId })
            if (!activity) {
                return res.status(404).json({ error: 'Activity not found' })
            }
            const { name, description } = req.body
            activityRepo.merge(activity, { name, description })
            await activityRepo.save(activity)
            res.json(activity)
        })
    )

    // DELETE /:activityId (Delete a activity)
    router.delete(
        '/:activityId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureActivityAccess(getDataSource(), userId, req.params.activityId, 'deleteContent')
            const { activityRepo } = getRepositories(req, getDataSource)
            const result = await activityRepo.delete({ id: req.params.activityId })
            if (result.affected === 0) {
                return res.status(404).json({ error: 'Activity not found' })
            }
            res.status(204).send()
        })
    )

    // PUT /:activityId/event { eventId }
    router.put(
        '/:activityId/event',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { activityRepo, eventRepo, activityEventRepo } = getRepositories(req, getDataSource)
            const activityId = req.params.activityId
            const { eventId } = req.body || {}
            if (!eventId) return res.status(400).json({ error: 'eventId is required' })
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureActivityAccess(getDataSource(), userId, activityId, 'editContent')
            await ensureEventAccess(getDataSource(), userId, eventId, 'editContent')

            const activity = await activityRepo.findOneBy({ id: activityId })
            if (!activity) return res.status(404).json({ error: 'Activity not found' })

            const event = await eventRepo.findOneBy({ id: eventId })
            if (!event) return res.status(404).json({ error: 'Event not found' })

            const exists = await activityEventRepo.findOne({ where: { activity: { id: activityId }, event: { id: eventId } } })
            if (exists) return res.status(200).json(exists)

            const link = activityEventRepo.create({ activity, event })
            const saved = await activityEventRepo.save(link)

            // Auto-sync activity-campaign links after adding event
            await syncActivityCampaignLinks(activityId, getRepositories(req, getDataSource))

            res.status(201).json(saved)
        })
    )

    // DELETE /:activityId/event � remove all event links for the activity (simple semantics)
    router.delete(
        '/:activityId/event',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { activityRepo, activityEventRepo } = getRepositories(req, getDataSource)
            const activityId = req.params.activityId
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureActivityAccess(getDataSource(), userId, activityId, 'deleteContent')
            const activity = await activityRepo.findOneBy({ id: activityId })
            if (!activity) return res.status(404).json({ error: 'Activity not found' })

            const links = await activityEventRepo.find({ where: { activity: { id: activityId } } })
            if (links.length === 0) return res.status(404).json({ error: 'No event links found' })

            await activityEventRepo.remove(links)

            // Auto-sync activity-campaign links after removing events
            await syncActivityCampaignLinks(activityId, getRepositories(req, getDataSource))

            res.status(204).send()
        })
    )

    return router
}

export default createActivitiesRouter
