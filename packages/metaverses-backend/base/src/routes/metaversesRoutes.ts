import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-backend'
import { AuthUser } from '@universo/auth-backend'
import { hasGlobalAccessByDataSource, getGlobalRoleNameByDataSource } from '@universo/admin-backend'
import { Metaverse } from '../database/entities/Metaverse'
import { MetaverseUser } from '../database/entities/MetaverseUser'
import { Entity } from '../database/entities/Entity'
import { EntityMetaverse } from '../database/entities/EntityMetaverse'
import { Section } from '../database/entities/Section'
import { SectionMetaverse } from '../database/entities/SectionMetaverse'
import { Profile } from '@universo/profile-backend'
import { ensureMetaverseAccess, ensureSectionAccess, ROLE_PERMISSIONS, MetaverseRole, assertNotOwner } from './guards'
import { z } from 'zod'
import { validateListQuery } from '../schemas/queryParams'

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

// Comments in English only
export function createMetaversesRoutes(
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
            metaverseRepo: manager.getRepository(Metaverse),
            metaverseUserRepo: manager.getRepository(MetaverseUser),
            entityRepo: manager.getRepository(Entity),
            linkRepo: manager.getRepository(EntityMetaverse),
            sectionRepo: manager.getRepository(Section),
            sectionLinkRepo: manager.getRepository(SectionMetaverse),
            authUserRepo: manager.getRepository(AuthUser)
        }
    }

    const mapMember = (member: MetaverseUser, email: string | null, nickname: string | null) => ({
        id: member.id,
        userId: member.user_id,
        email,
        nickname,
        role: (member.role || 'member') as MetaverseRole,
        comment: member.comment,
        createdAt: member.created_at
    })

    const loadMembers = async (
        req: Request,
        metaverseId: string,
        params?: { limit?: number; offset?: number; sortBy?: string; sortOrder?: string; search?: string }
    ): Promise<{ members: ReturnType<typeof mapMember>[]; total: number }> => {
        const { metaverseUserRepo } = repos(req)
        const ds = getDataSource()

        try {
            // Build base query WITHOUT JOINs to avoid TypeORM alias parsing issues for cross-schema tables
            const qb = metaverseUserRepo.createQueryBuilder('mu').where('mu.metaverse_id = :metaverseId', { metaverseId })

            if (params) {
                const { limit = 100, offset = 0, sortBy = 'created', sortOrder = 'desc', search } = params

                // Search by email OR nickname via EXISTS subqueries (no joins)
                if (search) {
                    const escapedSearch = search.toLowerCase()
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

            // Load users and profiles data
            const users = userIds.length ? await ds.manager.find(AuthUser, { where: { id: In(userIds) } }) : []
            const profiles = userIds.length ? await ds.manager.find(Profile, { where: { user_id: In(userIds) } }) : []

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
    type RolePermissions = (typeof ROLE_PERMISSIONS)[MetaverseRole]

    interface MetaverseDetailsResponse {
        id: string
        name: string
        description?: string
        createdAt: Date
        updatedAt: Date
        sectionsCount: number
        entitiesCount: number
        membersCount: number
        role: MetaverseRole
        permissions: RolePermissions
        members?: MembersList
    }

    const memberRoleSchema = z.enum(['admin', 'editor', 'member'])

    // GET /metaverses
    router.get(
        '/',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            try {
                // Check if user has global access
                const ds = getDataSource()
                const isGlobalAdmin = await hasGlobalAccessByDataSource(ds, userId)
                // Get global role name for accessType if user is global admin
                const globalRoleName = isGlobalAdmin ? await getGlobalRoleNameByDataSource(ds, userId) : null

                // Check showAll query parameter (only applicable for global admins)
                // If showAll=false (or not set), global admin sees only their own items
                const showAllParam = req.query.showAll
                const showAll = isGlobalAdmin && showAllParam === 'true'

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

                // Aggregate counts per metaverse
                // Global admins can see all metaverses
                const { metaverseRepo } = repos(req)
                const qb = metaverseRepo
                    .createQueryBuilder('m')
                    .leftJoin(SectionMetaverse, 'sm', 'sm.metaverse_id = m.id')
                    .leftJoin(EntityMetaverse, 'em', 'em.metaverse_id = m.id')

                // For regular users, filter by membership
                // For global admins with showAll=true, show all metaverses
                // For global admins with showAll=false, filter by membership (like regular users)
                if (showAll) {
                    // Global admin with showAll: left join to get role if they are a member, otherwise null
                    qb.leftJoin(MetaverseUser, 'mu', 'mu.metaverse_id = m.id AND mu.user_id = :userId', { userId })
                } else {
                    // Regular user or global admin with showAll=false: inner join to filter by membership
                    qb.innerJoin(MetaverseUser, 'mu', 'mu.metaverse_id = m.id')
                        .where('mu.user_id = :userId', { userId })
                }

                // Add search filter if provided
                if (normalizedSearch) {
                    qb.andWhere('(LOWER(m.name) LIKE :search OR LOWER(m.description) LIKE :search)', {
                        search: `%${normalizedSearch}%`
                    })
                }

                // For global admins with showAll without membership, show 'owner' role (full access)
                // accessType indicates how access was obtained: 'member' for direct membership, or the global role
                qb.select([
                    'm.id as id',
                    'm.name as name',
                    'm.description as description',
                    // Use entity property names; TypeORM will map to actual column names
                    'm.createdAt as created_at',
                    'm.updatedAt as updated_at'
                ])
                    .addSelect('COUNT(DISTINCT sm.id)', 'sectionsCount')
                    .addSelect('COUNT(DISTINCT em.id)', 'entitiesCount')
                    .addSelect(showAll ? "COALESCE(mu.role, 'owner')" : 'mu.role', 'role')
                    // accessType: 'member' if has direct membership, otherwise global role name
                    .addSelect(
                        showAll
                            ? `CASE WHEN mu.user_id IS NOT NULL THEN 'member' ELSE '${globalRoleName || 'global_admin'}' END`
                            : "'member'",
                        'accessType'
                    )
                    // Use window function to get total count in single query (performance optimization)
                    .addSelect('COUNT(*) OVER()', 'window_total')
                    .groupBy('m.id')
                    .addGroupBy('m.name')
                    .addGroupBy('m.description')
                    .addGroupBy('m.createdAt')
                    .addGroupBy('m.updatedAt')
                    .addGroupBy('mu.role')
                    .addGroupBy('mu.user_id')
                    .orderBy(sortByField, sortDirection)
                    .limit(limit)
                    .offset(offset)

                const raw = await qb.getRawMany<{
                    id: string
                    name: string
                    description: string | null
                    created_at: Date
                    updated_at: Date
                    sectionsCount: string
                    entitiesCount: string
                    role: MetaverseRole | null
                    accessType: string
                    window_total?: string
                }>()

                // Extract total count from window function (same value in all rows)
                // Handle edge case: empty result set
                const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) || 0 : 0

                const response = raw.map((row) => {
                    const role = (row.role ?? undefined) as MetaverseRole | undefined
                    // accessType indicates how user obtained access:
                    // 'member' - direct membership, 'superadmin'/'supermoderator' - global admin access
                    const accessType = row.accessType as 'member' | 'superadmin' | 'supermoderator'
                    return {
                        id: row.id,
                        name: row.name,
                        description: row.description ?? undefined,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                        sectionsCount: parseInt(row.sectionsCount || '0', 10) || 0,
                        entitiesCount: parseInt(row.entitiesCount || '0', 10) || 0,
                        role,
                        accessType,
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
                console.error('[ERROR] GET /metaverses failed:', error)
                res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) })
            }
        })
    )

    // POST /metaverses
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

            const { metaverseRepo, metaverseUserRepo } = repos(req)

            try {
                // Create metaverse
                // Creating metaverse
                const entity = metaverseRepo.create({ name, description })
                const saved = await metaverseRepo.save(entity)

                // Create metaverse-user relationship (user becomes owner)
                // Creating metaverse-user relationship
                const metaverseUser = metaverseUserRepo.create({
                    metaverse_id: saved.id,
                    user_id: userId,
                    role: 'owner'
                })
                const _savedMetaverseUser = await metaverseUserRepo.save(metaverseUser)

                res.status(201).json(saved)
            } catch (error) {
                console.error('POST /metaverses - Error:', error)
                res.status(500).json({
                    error: 'Failed to create metaverse',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    router.get(
        '/:metaverseId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metaverseId } = req.params

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { metaverseRepo, metaverseUserRepo, sectionLinkRepo, linkRepo } = repos(req)

            const { membership } = await ensureMetaverseAccess(getDataSource(), userId, metaverseId)

            const metaverse = await metaverseRepo.findOne({ where: { id: metaverseId } })
            if (!metaverse) {
                return res.status(404).json({ error: 'Metaverse not found' })
            }

            const [sectionsCount, entitiesCount, membersCount] = await Promise.all([
                sectionLinkRepo.count({ where: { metaverse: { id: metaverseId } } }),
                linkRepo.count({ where: { metaverse: { id: metaverseId } } }),
                metaverseUserRepo.count({ where: { metaverse_id: metaverseId } })
            ])

            const role = (membership.role || 'member') as MetaverseRole
            const permissions = ROLE_PERMISSIONS[role]

            const membersPayload = permissions.manageMembers ? (await loadMembers(req, metaverseId)).members : undefined

            const response: MetaverseDetailsResponse = {
                id: metaverse.id,
                name: metaverse.name,
                description: metaverse.description ?? undefined,
                createdAt: metaverse.createdAt,
                updatedAt: metaverse.updatedAt,
                sectionsCount,
                entitiesCount,
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
        '/:metaverseId/members',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metaverseId } = req.params

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureMetaverseAccess(getDataSource(), userId, metaverseId, 'manageMembers')

            // Add pagination support
            const { limit = 100, offset = 0, sortBy = 'created', sortOrder = 'desc', search } = validateListQuery(req.query)
            const { members, total } = await loadMembers(req, metaverseId, { limit, offset, sortBy, sortOrder, search })

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
        '/:metaverseId/members',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metaverseId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureMetaverseAccess(getDataSource(), userId, metaverseId, 'manageMembers')

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
            const { authUserRepo, metaverseUserRepo } = repos(req)

            const targetUser = await authUserRepo
                .createQueryBuilder('user')
                // TODO: Add a functional index on LOWER(email) to keep this lookup performant.
                .where('LOWER(user.email) = LOWER(:email)', { email })
                .getOne()

            if (!targetUser) {
                return res.status(404).json({ error: 'User not found' })
            }

            const existing = await metaverseUserRepo.findOne({
                where: { metaverse_id: metaverseId, user_id: targetUser.id }
            })

            if (existing) {
                return res.status(409).json({
                    error: 'User already has access',
                    code: 'METAVERSE_MEMBER_EXISTS'
                })
            }

            const membership = metaverseUserRepo.create({
                metaverse_id: metaverseId,
                user_id: targetUser.id,
                role,
                comment
            })
            const saved = await metaverseUserRepo.save(membership)

            // Load nickname from profiles table
            const ds = getDataSource()
            const profile = await ds.manager.findOne(Profile, { where: { user_id: targetUser.id } })

            res.status(201).json(mapMember(saved, targetUser.email ?? null, profile?.nickname ?? null))
        })
    )

    router.patch(
        '/:metaverseId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metaverseId, memberId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureMetaverseAccess(getDataSource(), userId, metaverseId, 'manageMembers')

            const schema = z.object({
                role: memberRoleSchema,
                comment: z.string().trim().max(500).optional().or(z.literal(''))
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            }

            const { role, comment } = parsed.data
            const { metaverseUserRepo, authUserRepo } = repos(req)

            const membership = await metaverseUserRepo.findOne({
                where: { id: memberId, metaverse_id: metaverseId }
            })

            if (!membership) {
                return res.status(404).json({ error: 'Membership not found' })
            }

            assertNotOwner(membership, 'modify')

            membership.role = role
            if (comment !== undefined) {
                membership.comment = comment
            }
            const saved = await metaverseUserRepo.save(membership)
            const authUser = await authUserRepo.findOne({ where: { id: membership.user_id } })

            // Load nickname from profiles table
            const ds = getDataSource()
            const profile = await ds.manager.findOne(Profile, { where: { user_id: membership.user_id } })

            res.json(mapMember(saved, authUser?.email ?? null, profile?.nickname ?? null))
        })
    )

    router.delete(
        '/:metaverseId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metaverseId, memberId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureMetaverseAccess(getDataSource(), userId, metaverseId, 'manageMembers')

            const { metaverseUserRepo } = repos(req)
            const membership = await metaverseUserRepo.findOne({
                where: { id: memberId, metaverse_id: metaverseId }
            })

            if (!membership) {
                return res.status(404).json({ error: 'Membership not found' })
            }

            assertNotOwner(membership, 'remove')

            await metaverseUserRepo.remove(membership)
            res.status(204).send()
        })
    )

    router.put(
        '/:metaverseId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metaverseId } = req.params
            const { name, description } = req.body || {}
            if (!name) {
                return res.status(400).json({ error: 'name is required' })
            }

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { metaverseRepo } = repos(req)
            await ensureMetaverseAccess(getDataSource(), userId, metaverseId, 'manageMetaverse')

            const metaverse = await metaverseRepo.findOne({ where: { id: metaverseId } })
            if (!metaverse) {
                return res.status(404).json({ error: 'Metaverse not found' })
            }

            metaverse.name = name
            metaverse.description = description

            const saved = await metaverseRepo.save(metaverse)
            res.json(saved)
        })
    )

    router.delete(
        '/:metaverseId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metaverseId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { metaverseRepo } = repos(req)
            await ensureMetaverseAccess(getDataSource(), userId, metaverseId, 'manageMetaverse')

            const metaverse = await metaverseRepo.findOne({ where: { id: metaverseId } })
            if (!metaverse) {
                return res.status(404).json({ error: 'Metaverse not found' })
            }

            await metaverseRepo.remove(metaverse)
            res.status(204).send()
        })
    )

    // GET /metaverses/:metaverseId/entities
    router.get(
        '/:metaverseId/entities',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metaverseId } = req.params
            const userId = resolveUserId(req)

            console.log(`[DEBUG] GET /metaverses/${metaverseId}/entities - userId: ${userId}`)

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Check global access
            const ds = getDataSource()
            const isGlobalAdmin = await hasGlobalAccessByDataSource(ds, userId)
            console.log(`[DEBUG] isGlobalAdmin: ${isGlobalAdmin}`)

            await ensureMetaverseAccess(ds, userId, metaverseId)
            console.log(`[DEBUG] ensureMetaverseAccess passed`)

            const { linkRepo } = repos(req)
            try {
                // Debug: check what RLS context returns
                const manager = linkRepo.manager
                const rlsCheck = await manager.query(`
                    SELECT 
                        auth.uid() as current_uid,
                        admin.has_global_access(auth.uid()) as has_global_access,
                        (SELECT COUNT(*) FROM metaverses.entities_metaverses WHERE metaverse_id = $1) as total_links
                `, [metaverseId])
                console.log(`[DEBUG] RLS context check:`, rlsCheck)

                const links = await linkRepo.find({ where: { metaverse: { id: metaverseId } }, relations: ['entity', 'metaverse'] })
                console.log(`[DEBUG] Found ${links.length} entity links`)
                
                const entities = links.map((l) => ({ ...l.entity, sortOrder: l.sortOrder }))
                res.json(entities)
            } catch (error) {
                console.error(`GET /metaverses/${metaverseId}/entities - Error:`, error)
                res.status(500).json({
                    error: 'Failed to get metaverse entities',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /metaverses/:metaverseId/entities/:entityId (attach)
    router.post(
        '/:metaverseId/entities/:entityId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metaverseId, entityId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureMetaverseAccess(getDataSource(), userId, metaverseId, 'createContent')
            const { linkRepo, metaverseRepo, entityRepo } = repos(req)
            const metaverse = await metaverseRepo.findOne({ where: { id: metaverseId } })
            const entity = await entityRepo.findOne({ where: { id: entityId } })
            if (!metaverse || !entity) return res.status(404).json({ error: 'Not found' })
            // Avoid duplicates at API level (no UNIQUE in DB as per requirements)
            const exists = await linkRepo.findOne({ where: { metaverse: { id: metaverseId }, entity: { id: entityId } } })
            if (exists) return res.status(200).json(exists)
            const link = linkRepo.create({ metaverse, entity })
            const saved = await linkRepo.save(link)
            res.status(201).json(saved)
        })
    )

    // DELETE /metaverses/:metaverseId/entities/:entityId (detach)
    router.delete(
        '/:metaverseId/entities/:entityId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metaverseId, entityId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureMetaverseAccess(getDataSource(), userId, metaverseId, 'deleteContent')
            const { linkRepo } = repos(req)
            const existing = await linkRepo.findOne({ where: { metaverse: { id: metaverseId }, entity: { id: entityId } } })
            if (!existing) return res.status(404).json({ error: 'Link not found' })
            await linkRepo.remove(existing)
            res.status(204).send()
        })
    )

    // POST /metaverses/:metaverseId/entities/reorder { items: [{entityId, sortOrder}] }
    router.post(
        '/:metaverseId/entities/reorder',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metaverseId } = req.params
            const { items } = req.body || {}
            if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' })
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureMetaverseAccess(getDataSource(), userId, metaverseId, 'editContent')
            const { linkRepo } = repos(req)
            for (const it of items) {
                if (!it?.entityId) continue
                const link = await linkRepo.findOne({ where: { metaverse: { id: metaverseId }, entity: { id: it.entityId } } })
                if (link) {
                    link.sortOrder = Number(it.sortOrder) || 1
                    await linkRepo.save(link)
                }
            }
            res.json({ success: true })
        })
    )

    // --- Sections in metaverse ---

    // GET /metaverses/:metaverseId/sections
    router.get(
        '/:metaverseId/sections',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metaverseId } = req.params
            const userId = resolveUserId(req)
            // Debug log removed

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            await ensureMetaverseAccess(getDataSource(), userId, metaverseId)

            const { sectionLinkRepo } = repos(req)
            try {
                const links = await sectionLinkRepo.find({ where: { metaverse: { id: metaverseId } }, relations: ['section', 'metaverse'] })
                const sections = links.map((l) => l.section)
                // Debug log removed
                res.json(sections)
            } catch (error) {
                console.error(`GET /metaverses/${metaverseId}/sections - Error:`, error)
                res.status(500).json({
                    error: 'Failed to get metaverse sections',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /metaverses/:metaverseId/sections/:sectionId (attach)
    router.post(
        '/:metaverseId/sections/:sectionId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metaverseId, sectionId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            // Ensure the user can access both the metaverse and the section
            await ensureMetaverseAccess(getDataSource(), userId, metaverseId, 'createContent')
            await ensureSectionAccess(getDataSource(), userId, sectionId)
            const { metaverseRepo, sectionRepo, sectionLinkRepo } = repos(req)
            const metaverse = await metaverseRepo.findOne({ where: { id: metaverseId } })
            const section = await sectionRepo.findOne({ where: { id: sectionId } })
            if (!metaverse || !section) return res.status(404).json({ error: 'Not found' })

            const exists = await sectionLinkRepo.findOne({ where: { metaverse: { id: metaverseId }, section: { id: sectionId } } })
            if (exists) return res.status(200).json(exists)

            const link = sectionLinkRepo.create({ metaverse, section })
            const saved = await sectionLinkRepo.save(link)
            res.status(201).json(saved)
        })
    )

    return router
}

export default createMetaversesRoutes
