import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { CampaignRole } from '@universo/types'
import { Event } from '../database/entities/Event'
import { Campaign } from '../database/entities/Campaign'
import { CampaignMember } from '../database/entities/CampaignMember'
import { EventCampaign } from '../database/entities/EventCampaign'
import { Activity } from '../database/entities/Activity'
import { ActivityEvent } from '../database/entities/ActivityEvent'
import { ensureEventAccess, ensureCampaignAccess, ensureActivityAccess, ROLE_PERMISSIONS } from './guards'
import { z } from 'zod'
import { validateListQuery } from '../schemas/queryParams'
import { escapeLikeWildcards, getRequestManager } from '../utils'

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

// Comments in English only
export function createEventsRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<any>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const repos = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return {
            eventRepo: manager.getRepository(Event),
            campaignRepo: manager.getRepository(Campaign),
            campaignUserRepo: manager.getRepository(CampaignMember),
            eventCampaignRepo: manager.getRepository(EventCampaign),
            activityRepo: manager.getRepository(Activity),
            activityEventRepo: manager.getRepository(ActivityEvent)
        }
    }

    // GET /events - with pagination, search, sorting
    router.get(
        '/',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            try {
                // Validate and parse query parameters with Zod
                const { limit = 100, offset = 0, sortBy = 'updated', sortOrder = 'desc', search } = validateListQuery(req.query)

                // Parse search parameter
                const escapedSearch = search ? escapeLikeWildcards(search) : ''

                // Safe sorting with whitelist
                const ALLOWED_SORT_FIELDS = {
                    name: 's.name',
                    created: 's.createdAt',
                    updated: 's.updatedAt'
                } as const

                const sortByField = ALLOWED_SORT_FIELDS[sortBy]
                const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'

                // Get events accessible to user through campaign membership
                const { eventRepo } = repos(req)
                const qb = eventRepo
                    .createQueryBuilder('s')
                    // Join with event-campaign link
                    .innerJoin(EventCampaign, 'sm', 'sm.event_id = s.id')
                    // Join with campaign user to filter by user access
                    .innerJoin(CampaignMember, 'mu', 'mu.campaign_id = sm.campaign_id')
                    // Left join with activity-event to count activities
                    .leftJoin(ActivityEvent, 'es', 'es.event_id = s.id')
                    .where('mu.user_id = :userId', { userId })

                // Add search filter if provided
                if (escapedSearch) {
                    qb.andWhere("(LOWER(s.name) LIKE :search OR LOWER(COALESCE(s.description, '')) LIKE :search)", {
                        search: `%${escapedSearch.toLowerCase()}%`
                    })
                }

                qb.select([
                    's.id as id',
                    's.name as name',
                    's.description as description',
                    's.createdAt as created_at',
                    's.updatedAt as updated_at',
                    'mu.role as user_role'
                ])
                    .addSelect('COUNT(DISTINCT es.id)', 'activitiesCount')
                    // Use window function to get total count in single query (performance optimization)
                    .addSelect('COUNT(*) OVER()', 'window_total')
                    .groupBy('s.id')
                    .addGroupBy('s.name')
                    .addGroupBy('s.description')
                    .addGroupBy('s.createdAt')
                    .addGroupBy('s.updatedAt')
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
                    activitiesCount: string
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
                        activitiesCount: parseInt(row.activitiesCount || '0', 10) || 0,
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
                console.error('[ERROR] GET /events failed:', error)
                res.status(500).json({
                    error: 'Internal server error',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /events
    router.post(
        '/',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const schema = z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                campaignId: z.string().uuid()
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            const { name, description, campaignId } = parsed.data
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Validate required fields
            if (!name) return res.status(400).json({ error: 'name is required' })
            if (!campaignId) return res.status(400).json({ error: 'campaignId is required - events must be associated with a campaign' })

            await ensureCampaignAccess(getDataSource(), userId, campaignId, 'createContent')

            const { eventRepo, campaignRepo, eventCampaignRepo } = repos(req)

            try {
                // Validate campaign exists
                const campaign = await campaignRepo.findOne({ where: { id: campaignId } })
                if (!campaign) return res.status(400).json({ error: 'Invalid campaignId' })

                const activity = eventRepo.create({ name, description })
                const saved = await eventRepo.save(activity)

                // Create mandatory event-campaign link
                const eventCampaignLink = eventCampaignRepo.create({ event: saved, campaign })
                await eventCampaignRepo.save(eventCampaignLink)

                res.status(201).json(saved)
            } catch (error) {
                console.error('POST /events - Error:', error)
                res.status(500).json({
                    error: 'Failed to create event',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // GET /events/:eventId
    router.get(
        '/:eventId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { eventId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            await ensureEventAccess(getDataSource(), userId, eventId)

            const { eventRepo, activityEventRepo } = repos(req)

            const event = await eventRepo.findOne({ where: { id: eventId } })
            if (!event) return res.status(404).json({ error: 'Event not found' })

            // Get activities count for this event
            const activitiesCount = await activityEventRepo.count({ where: { event: { id: eventId } } })

            const response = {
                id: event.id,
                name: event.name,
                description: event.description ?? undefined,
                createdAt: event.createdAt,
                updatedAt: event.updatedAt,
                activitiesCount
            }

            res.json(response)
        })
    )

    // PUT /events/:eventId
    router.put(
        '/:eventId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const schema = z
                .object({
                    name: z.string().min(1).optional(),
                    description: z.string().optional()
                })
                .refine((data) => data.name !== undefined || data.description !== undefined, {
                    message: 'At least one field (name or description) must be provided'
                })

            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            }

            const { eventId } = req.params
            const { name, description } = parsed.data
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureEventAccess(getDataSource(), userId, eventId, 'editContent')
            const { eventRepo } = repos(req)

            const event = await eventRepo.findOne({ where: { id: eventId } })
            if (!event) return res.status(404).json({ error: 'Event not found' })

            if (name !== undefined) event.name = name
            if (description !== undefined) event.description = description

            const updated = await eventRepo.save(event)
            res.json(updated)
        })
    )

    // DELETE /events/:eventId
    router.delete(
        '/:eventId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { eventId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureEventAccess(getDataSource(), userId, eventId, 'deleteContent')
            const { eventRepo } = repos(req)

            const event = await eventRepo.findOne({ where: { id: eventId } })
            if (!event) return res.status(404).json({ error: 'Event not found' })

            await eventRepo.remove(event)
            res.status(204).send()
        })
    )

    // GET /events/:eventId/activities
    router.get(
        '/:eventId/activities',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { eventId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureEventAccess(getDataSource(), userId, eventId)
            const { eventRepo, activityEventRepo } = repos(req)

            // Validate event exists
            const event = await eventRepo.findOne({ where: { id: eventId } })
            if (!event) return res.status(404).json({ error: 'Event not found' })

            // Get activities linked to this event
            const links = await activityEventRepo.find({
                where: { event: { id: eventId } },
                relations: ['activity']
            })
            const activities = links.map((link) => link.activity)
            res.json(activities)
        })
    )

    // POST /events/:eventId/activities/:activityId (attach activity to event)
    router.post(
        '/:eventId/activities/:activityId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { eventId, activityId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Ensure user has createContent permission for the event
            await ensureEventAccess(getDataSource(), userId, eventId, 'createContent')

            // SECURITY: Ensure user has access to the activity before attaching
            await ensureActivityAccess(getDataSource(), userId, activityId)

            const { eventRepo, activityRepo, activityEventRepo } = repos(req)

            // Validate event exists
            const event = await eventRepo.findOne({ where: { id: eventId } })
            if (!event) return res.status(404).json({ error: 'Event not found' })

            // Validate activity exists
            const activity = await activityRepo.findOne({ where: { id: activityId } })
            if (!activity) return res.status(404).json({ error: 'Activity not found' })

            // Check if link already exists (idempotent)
            const existing = await activityEventRepo.findOne({
                where: { event: { id: eventId }, activity: { id: activityId } }
            })
            if (existing) return res.status(200).json(existing)

            // Create new link
            const link = activityEventRepo.create({ event, activity })
            const saved = await activityEventRepo.save(link)
            res.status(201).json(saved)
        })
    )

    return router
}

export default createEventsRoutes
