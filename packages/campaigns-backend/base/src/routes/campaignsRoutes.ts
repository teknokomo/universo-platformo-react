import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-backend'
import { AuthUser } from '@universo/auth-backend'
import { Campaign } from '../database/entities/Campaign'
import { CampaignMember } from '../database/entities/CampaignMember'
import { Activity } from '../database/entities/Activity'
import { ActivityCampaign } from '../database/entities/ActivityCampaign'
import { Event } from '../database/entities/Event'
import { EventCampaign } from '../database/entities/EventCampaign'
import { Profile } from '@universo/profile-backend'
import { ensureCampaignAccess, ensureEventAccess, ROLE_PERMISSIONS, CampaignRole, assertNotOwner } from './guards'
import { z } from 'zod'
import { validateListQuery } from '../schemas/queryParams'
import { escapeLikeWildcards, getRequestManager } from '../utils'

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

// Comments in English only
export function createCampaignsRoutes(
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
            campaignRepo: manager.getRepository(Campaign),
            campaignUserRepo: manager.getRepository(CampaignMember),
            activityRepo: manager.getRepository(Activity),
            linkRepo: manager.getRepository(ActivityCampaign),
            eventRepo: manager.getRepository(Event),
            eventLinkRepo: manager.getRepository(EventCampaign),
            authUserRepo: manager.getRepository(AuthUser)
        }
    }

    const mapMember = (member: CampaignMember, email: string | null, nickname: string | null) => ({
        id: member.id,
        userId: member.user_id,
        email,
        nickname,
        role: (member.role || 'member') as CampaignRole,
        comment: member.comment,
        createdAt: member.created_at
    })

    const loadMembers = async (
        req: Request,
        campaignId: string,
        params?: { limit?: number; offset?: number; sortBy?: string; sortOrder?: string; search?: string }
    ): Promise<{ members: ReturnType<typeof mapMember>[]; total: number }> => {
        const { campaignUserRepo } = repos(req)
        const ds = getDataSource()

        try {
            // Build base query WITHOUT JOINs to avoid TypeORM alias parsing issues for cross-schema tables
            const qb = campaignUserRepo.createQueryBuilder('mu').where('mu.campaign_id = :campaignId', { campaignId })

            if (params) {
                const { limit = 100, offset = 0, sortBy = 'created', sortOrder = 'desc', search } = params

                // Search by email OR nickname via EXISTS subqueries (no joins)
                if (search) {
                    const escapedSearch = escapeLikeWildcards(search.toLowerCase())
                    qb.andWhere(
                        `(
                            EXISTS (SELECT 1 FROM auth.users u WHERE u.id = mu.user_id AND LOWER(u.email) LIKE :search)
                         OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = mu.user_id AND LOWER(p.nickname) LIKE :search)
                        )`,
                        { search: `%${escapedSearch}%` }
                    )
                }

                // Sorting (support created, role, email, nickname). Email/nickname via subselect expressions
                const ALLOWED_SORT_FIELDS: Record<string, string> = {
                    created: 'mu.created_at',
                    role: 'mu.role',
                    email: '(SELECT u.email FROM auth.users u WHERE u.id = mu.user_id)',
                    nickname: '(SELECT p.nickname FROM public.profiles p WHERE p.user_id = mu.user_id)'
                }
                const sortExpr = ALLOWED_SORT_FIELDS[sortBy] || 'mu.created_at'
                const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'

                qb.orderBy(sortExpr, sortDirection).skip(offset).take(limit)
            } else {
                // Default order when no params
                qb.orderBy('mu.created_at', 'ASC')
            }

            // Get members and total count
            const [members, total] = await qb.getManyAndCount()

            // Extract email and nickname from joined data
            const userIds = members.map((member) => member.user_id)

            // Load users and profiles data using request-scoped manager
            const manager = getRequestManager(req, ds)
            const users = userIds.length ? await manager.find(AuthUser, { where: { id: In(userIds) } }) : []
            const profiles = userIds.length ? await manager.find(Profile, { where: { user_id: In(userIds) } }) : []

            const usersMap = new Map(users.map((user) => [user.id, user.email ?? null]))
            const profilesMap = new Map(profiles.map((profile) => [profile.user_id, profile.nickname]))

            const result = {
                members: members.map((member) =>
                    mapMember(member, usersMap.get(member.user_id) ?? null, profilesMap.get(member.user_id) ?? null)
                ),
                total
            }
            return result
        } catch (error) {
            console.error('[loadMembers] ERROR', error)
            throw error
        }
    }

    type MembersList = Awaited<ReturnType<typeof loadMembers>>['members']
    type RolePermissions = (typeof ROLE_PERMISSIONS)[CampaignRole]

    interface CampaignDetailsResponse {
        id: string
        name: string
        description?: string
        createdAt: Date
        updatedAt: Date
        eventsCount: number
        activitiesCount: number
        membersCount: number
        role: CampaignRole
        permissions: RolePermissions
        members?: MembersList
    }

    const memberRoleSchema = z.enum(['admin', 'editor', 'member'])

    // GET /campaigns
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
                const normalizedSearch = search ? search.toLowerCase() : ''

                // Safe sorting with whitelist
                const ALLOWED_SORT_FIELDS = {
                    name: 'm.name',
                    created: 'm.createdAt',
                    updated: 'm.updatedAt'
                } as const

                const sortByField = ALLOWED_SORT_FIELDS[sortBy]
                const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'

                // Aggregate counts per campaign in a single query filtered by current user membership
                const { campaignRepo } = repos(req)
                const qb = campaignRepo
                    .createQueryBuilder('m')
                    // Join using activity classes to respect schema mapping and avoid alias parsing issues
                    .innerJoin(CampaignMember, 'mu', 'mu.campaign_id = m.id')
                    .leftJoin(EventCampaign, 'sm', 'sm.campaign_id = m.id')
                    .leftJoin(ActivityCampaign, 'em', 'em.campaign_id = m.id')
                    .where('mu.user_id = :userId', { userId })

                // Add search filter if provided
                if (normalizedSearch) {
                    qb.andWhere('(LOWER(m.name) LIKE :search OR LOWER(m.description) LIKE :search)', {
                        search: `%${normalizedSearch}%`
                    })
                }

                qb.select([
                    'm.id as id',
                    'm.name as name',
                    'm.description as description',
                    // Use activity property names; TypeORM will map to actual column names
                    'm.createdAt as created_at',
                    'm.updatedAt as updated_at'
                ])
                    .addSelect('COUNT(DISTINCT sm.id)', 'eventsCount')
                    .addSelect('COUNT(DISTINCT em.id)', 'activitiesCount')
                    .addSelect('mu.role', 'role')
                    // Use window function to get total count in single query (performance optimization)
                    .addSelect('COUNT(*) OVER()', 'window_total')
                    .groupBy('m.id')
                    .addGroupBy('m.name')
                    .addGroupBy('m.description')
                    .addGroupBy('m.createdAt')
                    .addGroupBy('m.updatedAt')
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
                    eventsCount: string
                    activitiesCount: string
                    role: CampaignRole | null
                    window_total?: string
                }>()

                // Extract total count from window function (same value in all rows)
                // Handle edge case: empty result set
                const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) || 0 : 0

                const response = raw.map((row) => {
                    const role = (row.role ?? undefined) as CampaignRole | undefined
                    return {
                        id: row.id,
                        name: row.name,
                        description: row.description ?? undefined,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                        eventsCount: parseInt(row.eventsCount || '0', 10) || 0,
                        activitiesCount: parseInt(row.activitiesCount || '0', 10) || 0,
                        role,
                        permissions: role ? ROLE_PERMISSIONS[role] : undefined
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
                console.error('[ERROR] GET /campaigns failed:', error)
                res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) })
            }
        })
    )

    // POST /campaigns
    router.post(
        '/',
        writeLimiter,
        asyncHandler(async (req, res) => {
            // Debug logs removed to keep production logs clean

            const { name, description } = req.body || {}
            if (!name) return res.status(400).json({ error: 'name is required' })

            // Get user ID from middleware (req.user should be set by ensureAuth)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { campaignRepo, campaignUserRepo } = repos(req)

            try {
                // Create campaign
                // Creating campaign
                const activity = campaignRepo.create({ name, description })
                const saved = await campaignRepo.save(activity)

                // Create campaign-user relationship (user becomes owner)
                // Creating campaign-user relationship
                const CampaignMember = campaignUserRepo.create({
                    campaign_id: saved.id,
                    user_id: userId,
                    role: 'owner'
                })
                const _savedCampaignUser = await campaignUserRepo.save(CampaignMember)

                res.status(201).json(saved)
            } catch (error) {
                console.error('POST /campaigns - Error:', error)
                res.status(500).json({
                    error: 'Failed to create campaign',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    router.get(
        '/:campaignId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { campaignId } = req.params

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { campaignRepo, campaignUserRepo, eventLinkRepo, linkRepo } = repos(req)

            const { membership } = await ensureCampaignAccess(getDataSource(), userId, campaignId)

            const campaign = await campaignRepo.findOne({ where: { id: campaignId } })
            if (!campaign) {
                return res.status(404).json({ error: 'Campaign not found' })
            }

            const [eventsCount, activitiesCount, membersCount] = await Promise.all([
                eventLinkRepo.count({ where: { campaign: { id: campaignId } } }),
                linkRepo.count({ where: { campaign: { id: campaignId } } }),
                campaignUserRepo.count({ where: { campaign_id: campaignId } })
            ])

            const role = (membership.role || 'member') as CampaignRole
            const permissions = ROLE_PERMISSIONS[role]

            const membersPayload = permissions.manageMembers ? (await loadMembers(req, campaignId)).members : undefined

            const response: CampaignDetailsResponse = {
                id: campaign.id,
                name: campaign.name,
                description: campaign.description ?? undefined,
                createdAt: campaign.createdAt,
                updatedAt: campaign.updatedAt,
                eventsCount,
                activitiesCount,
                membersCount,
                role,
                permissions
            }

            if (membersPayload) {
                response.members = membersPayload
            }

            res.json(response)
        })
    )

    router.get(
        '/:campaignId/members',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { campaignId } = req.params

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureCampaignAccess(getDataSource(), userId, campaignId, 'manageMembers')

            // Add pagination support
            const { limit = 100, offset = 0, sortBy = 'created', sortOrder = 'desc', search } = validateListQuery(req.query)
            const { members, total } = await loadMembers(req, campaignId, { limit, offset, sortBy, sortOrder, search })

            // Return paginated response structure
            const hasMore = offset + members.length < total
            res.setHeader('X-Pagination-Limit', limit.toString())
            res.setHeader('X-Pagination-Offset', offset.toString())
            res.setHeader('X-Pagination-Count', members.length.toString())
            res.setHeader('X-Total-Count', total.toString())
            res.setHeader('X-Pagination-Has-More', hasMore.toString())

            res.json(members)
        })
    )

    router.post(
        '/:campaignId/members',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { campaignId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureCampaignAccess(getDataSource(), userId, campaignId, 'manageMembers')

            const schema = z.object({
                email: z.string().email(),
                role: memberRoleSchema,
                comment: z.string().trim().max(500).optional().or(z.literal(''))
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            }

            const { email, role, comment } = parsed.data
            const { authUserRepo, campaignUserRepo } = repos(req)

            const targetUser = await authUserRepo
                .createQueryBuilder('user')
                // TODO: Add a functional index on LOWER(email) to keep this lookup performant.
                .where('LOWER(user.email) = LOWER(:email)', { email })
                .getOne()

            if (!targetUser) {
                return res.status(404).json({ error: 'User not found' })
            }

            const existing = await campaignUserRepo.findOne({
                where: { campaign_id: campaignId, user_id: targetUser.id }
            })

            if (existing) {
                return res.status(409).json({
                    error: 'User already has access',
                    code: 'CAMPAIGN_MEMBER_EXISTS'
                })
            }

            const membership = campaignUserRepo.create({
                campaign_id: campaignId,
                user_id: targetUser.id,
                role,
                comment
            })
            const saved = await campaignUserRepo.save(membership)

            // Load nickname from profiles table using request-scoped manager
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const profile = await manager.findOne(Profile, { where: { user_id: targetUser.id } })

            res.status(201).json(mapMember(saved, targetUser.email ?? null, profile?.nickname ?? null))
        })
    )

    router.patch(
        '/:campaignId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { campaignId, memberId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureCampaignAccess(getDataSource(), userId, campaignId, 'manageMembers')

            const schema = z.object({
                role: memberRoleSchema,
                comment: z.string().trim().max(500).optional().or(z.literal(''))
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            }

            const { role, comment } = parsed.data
            const { campaignUserRepo, authUserRepo } = repos(req)

            const membership = await campaignUserRepo.findOne({
                where: { id: memberId, campaign_id: campaignId }
            })

            if (!membership) {
                return res.status(404).json({ error: 'Membership not found' })
            }

            assertNotOwner(membership, 'modify')

            membership.role = role
            if (comment !== undefined) {
                membership.comment = comment
            }
            const saved = await campaignUserRepo.save(membership)
            const authUser = await authUserRepo.findOne({ where: { id: membership.user_id } })

            // Load nickname from profiles table using request-scoped manager
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const profile = await manager.findOne(Profile, { where: { user_id: membership.user_id } })

            res.json(mapMember(saved, authUser?.email ?? null, profile?.nickname ?? null))
        })
    )

    router.delete(
        '/:campaignId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { campaignId, memberId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureCampaignAccess(getDataSource(), userId, campaignId, 'manageMembers')

            const { campaignUserRepo } = repos(req)
            const membership = await campaignUserRepo.findOne({
                where: { id: memberId, campaign_id: campaignId }
            })

            if (!membership) {
                return res.status(404).json({ error: 'Membership not found' })
            }

            assertNotOwner(membership, 'remove')

            await campaignUserRepo.remove(membership)
            res.status(204).send()
        })
    )

    router.put(
        '/:campaignId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { campaignId } = req.params
            const { name, description } = req.body || {}
            if (!name) {
                return res.status(400).json({ error: 'name is required' })
            }

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { campaignRepo } = repos(req)
            await ensureCampaignAccess(getDataSource(), userId, campaignId, 'manageCampaign')

            const campaign = await campaignRepo.findOne({ where: { id: campaignId } })
            if (!campaign) {
                return res.status(404).json({ error: 'Campaign not found' })
            }

            campaign.name = name
            campaign.description = description

            const saved = await campaignRepo.save(campaign)
            res.json(saved)
        })
    )

    router.delete(
        '/:campaignId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { campaignId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { campaignRepo } = repos(req)
            await ensureCampaignAccess(getDataSource(), userId, campaignId, 'manageCampaign')

            const campaign = await campaignRepo.findOne({ where: { id: campaignId } })
            if (!campaign) {
                return res.status(404).json({ error: 'Campaign not found' })
            }

            await campaignRepo.remove(campaign)
            res.status(204).send()
        })
    )

    // GET /campaigns/:campaignId/activities
    router.get(
        '/:campaignId/activities',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { campaignId } = req.params
            const userId = resolveUserId(req)
            // Debug log removed

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            await ensureCampaignAccess(getDataSource(), userId, campaignId)

            const { linkRepo } = repos(req)
            try {
                const links = await linkRepo.find({ where: { campaign: { id: campaignId } }, relations: ['activity', 'campaign'] })
                const activities = links.map((l) => ({ ...l.activity, sortOrder: l.sortOrder }))
                // Debug log removed
                res.json(activities)
            } catch (error) {
                console.error(`GET /campaigns/${campaignId}/activities - Error:`, error)
                res.status(500).json({
                    error: 'Failed to get campaign activities',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /campaigns/:campaignId/activities/:activityId (attach)
    router.post(
        '/:campaignId/activities/:activityId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { campaignId, activityId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureCampaignAccess(getDataSource(), userId, campaignId, 'createContent')
            const { linkRepo, campaignRepo, activityRepo } = repos(req)
            const campaign = await campaignRepo.findOne({ where: { id: campaignId } })
            const activity = await activityRepo.findOne({ where: { id: activityId } })
            if (!campaign || !activity) return res.status(404).json({ error: 'Not found' })
            // Avoid duplicates at API level (no UNIQUE in DB as per requirements)
            const exists = await linkRepo.findOne({ where: { campaign: { id: campaignId }, activity: { id: activityId } } })
            if (exists) return res.status(200).json(exists)
            const link = linkRepo.create({ campaign, activity })
            const saved = await linkRepo.save(link)
            res.status(201).json(saved)
        })
    )

    // DELETE /campaigns/:campaignId/activities/:activityId (detach)
    router.delete(
        '/:campaignId/activities/:activityId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { campaignId, activityId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureCampaignAccess(getDataSource(), userId, campaignId, 'deleteContent')
            const { linkRepo } = repos(req)
            const existing = await linkRepo.findOne({ where: { campaign: { id: campaignId }, activity: { id: activityId } } })
            if (!existing) return res.status(404).json({ error: 'Link not found' })
            await linkRepo.remove(existing)
            res.status(204).send()
        })
    )

    // POST /campaigns/:campaignId/activities/reorder { items: [{activityId, sortOrder}] }
    router.post(
        '/:campaignId/activities/reorder',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { campaignId } = req.params
            const { items } = req.body || {}
            if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' })
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureCampaignAccess(getDataSource(), userId, campaignId, 'editContent')
            const { linkRepo } = repos(req)
            for (const it of items) {
                if (!it?.activityId) continue
                const link = await linkRepo.findOne({ where: { campaign: { id: campaignId }, activity: { id: it.activityId } } })
                if (link) {
                    link.sortOrder = Number(it.sortOrder) || 1
                    await linkRepo.save(link)
                }
            }
            res.json({ success: true })
        })
    )

    // --- Events in campaign ---

    // GET /campaigns/:campaignId/events
    router.get(
        '/:campaignId/events',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { campaignId } = req.params
            const userId = resolveUserId(req)
            // Debug log removed

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            await ensureCampaignAccess(getDataSource(), userId, campaignId)

            const { eventLinkRepo } = repos(req)
            try {
                const links = await eventLinkRepo.find({ where: { campaign: { id: campaignId } }, relations: ['event', 'campaign'] })
                const events = links.map((l) => l.event)
                // Debug log removed
                res.json(events)
            } catch (error) {
                console.error(`GET /campaigns/${campaignId}/events - Error:`, error)
                res.status(500).json({
                    error: 'Failed to get campaign events',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /campaigns/:campaignId/events/:eventId (attach)
    router.post(
        '/:campaignId/events/:eventId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { campaignId, eventId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            // Ensure the user can access both the campaign and the event
            await ensureCampaignAccess(getDataSource(), userId, campaignId, 'createContent')
            await ensureEventAccess(getDataSource(), userId, eventId)
            const { campaignRepo, eventRepo, eventLinkRepo } = repos(req)
            const campaign = await campaignRepo.findOne({ where: { id: campaignId } })
            const event = await eventRepo.findOne({ where: { id: eventId } })
            if (!campaign || !event) return res.status(404).json({ error: 'Not found' })

            const exists = await eventLinkRepo.findOne({ where: { campaign: { id: campaignId }, event: { id: eventId } } })
            if (exists) return res.status(200).json(exists)

            const link = eventLinkRepo.create({ campaign, event })
            const saved = await eventLinkRepo.save(link)
            res.status(201).json(saved)
        })
    )

    return router
}

export default createCampaignsRoutes
