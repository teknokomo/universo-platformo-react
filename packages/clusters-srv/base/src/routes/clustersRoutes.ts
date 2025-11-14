import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-srv'
import { AuthUser } from '@universo/auth-srv'
import { Cluster } from '../database/entities/Cluster'
import { ClusterUser } from '../database/entities/ClusterUser'
import { Resource } from '../database/entities/Resource'
import { ResourceCluster } from '../database/entities/ResourceCluster'
import { Domain } from '../database/entities/Domain'
import { DomainCluster } from '../database/entities/DomainCluster'
import { Profile } from '@universo/profile-srv'
import { ensureClusterAccess, ensureDomainAccess, ROLE_PERMISSIONS, ClusterRole, assertNotOwner } from './guards'
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
export function createClustersRoutes(
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
            clusterRepo: manager.getRepository(Cluster),
            clusterUserRepo: manager.getRepository(ClusterUser),
            resourceRepo: manager.getRepository(Resource),
            linkRepo: manager.getRepository(ResourceCluster),
            domainRepo: manager.getRepository(Domain),
            domainLinkRepo: manager.getRepository(DomainCluster),
            authUserRepo: manager.getRepository(AuthUser)
        }
    }

    const mapMember = (member: ClusterUser, email: string | null, nickname: string | null) => ({
        id: member.id,
        userId: member.user_id,
        email,
        nickname,
        role: (member.role || 'member') as ClusterRole,
        comment: member.comment,
        createdAt: member.created_at
    })

    const loadMembers = async (
        req: Request,
        clusterId: string,
        params?: { limit?: number; offset?: number; sortBy?: string; sortOrder?: string; search?: string }
    ): Promise<{ members: ReturnType<typeof mapMember>[]; total: number }> => {
        const { clusterUserRepo } = repos(req)
        const ds = getDataSource()

        try {
            // Build base query WITHOUT JOINs to avoid TypeORM alias parsing issues for cross-schema tables
            const qb = clusterUserRepo.createQueryBuilder('mu').where('mu.cluster_id = :clusterId', { clusterId })

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
    type RolePermissions = (typeof ROLE_PERMISSIONS)[ClusterRole]

    interface ClusterDetailsResponse {
        id: string
        name: string
        description?: string
        createdAt: Date
        updatedAt: Date
        domainsCount: number
        resourcesCount: number
        membersCount: number
        role: ClusterRole
        permissions: RolePermissions
        members?: MembersList
    }

    const memberRoleSchema = z.enum(['admin', 'editor', 'member'])

    // GET /clusters
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

                // Aggregate counts per cluster in a single query filtered by current user membership
                const { clusterRepo } = repos(req)
                const qb = clusterRepo
                    .createQueryBuilder('m')
                    // Join using resource classes to respect schema mapping and avoid alias parsing issues
                    .innerJoin(ClusterUser, 'mu', 'mu.cluster_id = m.id')
                    .leftJoin(DomainCluster, 'sm', 'sm.cluster_id = m.id')
                    .leftJoin(ResourceCluster, 'em', 'em.cluster_id = m.id')
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
                    // Use resource property names; TypeORM will map to actual column names
                    'm.createdAt as created_at',
                    'm.updatedAt as updated_at'
                ])
                    .addSelect('COUNT(DISTINCT sm.id)', 'domainsCount')
                    .addSelect('COUNT(DISTINCT em.id)', 'resourcesCount')
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
                    domainsCount: string
                    resourcesCount: string
                    role: ClusterRole | null
                    window_total?: string
                }>()

                // Extract total count from window function (same value in all rows)
                // Handle edge case: empty result set
                const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) || 0 : 0

                const response = raw.map((row) => {
                    const role = (row.role ?? undefined) as ClusterRole | undefined
                    return {
                        id: row.id,
                        name: row.name,
                        description: row.description ?? undefined,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                        domainsCount: parseInt(row.domainsCount || '0', 10) || 0,
                        resourcesCount: parseInt(row.resourcesCount || '0', 10) || 0,
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
                console.error('[ERROR] GET /clusters failed:', error)
                res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) })
            }
        })
    )

    // POST /clusters
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

            const { clusterRepo, clusterUserRepo } = repos(req)

            try {
                // Create cluster
                // Creating cluster
                const resource = clusterRepo.create({ name, description })
                const saved = await clusterRepo.save(resource)

                // Create cluster-user relationship (user becomes owner)
                // Creating cluster-user relationship
                const clusterUser = clusterUserRepo.create({
                    cluster_id: saved.id,
                    user_id: userId,
                    role: 'owner'
                })
                const _savedClusterUser = await clusterUserRepo.save(clusterUser)

                res.status(201).json(saved)
            } catch (error) {
                console.error('POST /clusters - Error:', error)
                res.status(500).json({
                    error: 'Failed to create cluster',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    router.get(
        '/:clusterId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { clusterId } = req.params

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { clusterRepo, clusterUserRepo, domainLinkRepo, linkRepo } = repos(req)

            const { membership } = await ensureClusterAccess(getDataSource(), userId, clusterId)

            const cluster = await clusterRepo.findOne({ where: { id: clusterId } })
            if (!cluster) {
                return res.status(404).json({ error: 'Cluster not found' })
            }

            const [domainsCount, resourcesCount, membersCount] = await Promise.all([
                domainLinkRepo.count({ where: { cluster: { id: clusterId } } }),
                linkRepo.count({ where: { cluster: { id: clusterId } } }),
                clusterUserRepo.count({ where: { cluster_id: clusterId } })
            ])

            const role = (membership.role || 'member') as ClusterRole
            const permissions = ROLE_PERMISSIONS[role]

            const membersPayload = permissions.manageMembers ? (await loadMembers(req, clusterId)).members : undefined

            const response: ClusterDetailsResponse = {
                id: cluster.id,
                name: cluster.name,
                description: cluster.description ?? undefined,
                createdAt: cluster.createdAt,
                updatedAt: cluster.updatedAt,
                domainsCount,
                resourcesCount,
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
        '/:clusterId/members',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { clusterId } = req.params

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureClusterAccess(getDataSource(), userId, clusterId, 'manageMembers')

            // Add pagination support
            const { limit = 100, offset = 0, sortBy = 'created', sortOrder = 'desc', search } = validateListQuery(req.query)
            const { members, total } = await loadMembers(req, clusterId, { limit, offset, sortBy, sortOrder, search })

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
        '/:clusterId/members',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { clusterId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureClusterAccess(getDataSource(), userId, clusterId, 'manageMembers')

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
            const { authUserRepo, clusterUserRepo } = repos(req)

            const targetUser = await authUserRepo
                .createQueryBuilder('user')
                // TODO: Add a functional index on LOWER(email) to keep this lookup performant.
                .where('LOWER(user.email) = LOWER(:email)', { email })
                .getOne()

            if (!targetUser) {
                return res.status(404).json({ error: 'User not found' })
            }

            const existing = await clusterUserRepo.findOne({
                where: { cluster_id: clusterId, user_id: targetUser.id }
            })

            if (existing) {
                return res.status(409).json({
                    error: 'User already has access',
                    code: 'CLUSTER_MEMBER_EXISTS'
                })
            }

            const membership = clusterUserRepo.create({
                cluster_id: clusterId,
                user_id: targetUser.id,
                role,
                comment
            })
            const saved = await clusterUserRepo.save(membership)

            // Load nickname from profiles table
            const ds = getDataSource()
            const profile = await ds.manager.findOne(Profile, { where: { user_id: targetUser.id } })

            res.status(201).json(mapMember(saved, targetUser.email ?? null, profile?.nickname ?? null))
        })
    )

    router.patch(
        '/:clusterId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { clusterId, memberId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureClusterAccess(getDataSource(), userId, clusterId, 'manageMembers')

            const schema = z.object({
                role: memberRoleSchema,
                comment: z.string().trim().max(500).optional().or(z.literal(''))
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            }

            const { role, comment } = parsed.data
            const { clusterUserRepo, authUserRepo } = repos(req)

            const membership = await clusterUserRepo.findOne({
                where: { id: memberId, cluster_id: clusterId }
            })

            if (!membership) {
                return res.status(404).json({ error: 'Membership not found' })
            }

            assertNotOwner(membership, 'modify')

            membership.role = role
            if (comment !== undefined) {
                membership.comment = comment
            }
            const saved = await clusterUserRepo.save(membership)
            const authUser = await authUserRepo.findOne({ where: { id: membership.user_id } })

            // Load nickname from profiles table
            const ds = getDataSource()
            const profile = await ds.manager.findOne(Profile, { where: { user_id: membership.user_id } })

            res.json(mapMember(saved, authUser?.email ?? null, profile?.nickname ?? null))
        })
    )

    router.delete(
        '/:clusterId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { clusterId, memberId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureClusterAccess(getDataSource(), userId, clusterId, 'manageMembers')

            const { clusterUserRepo } = repos(req)
            const membership = await clusterUserRepo.findOne({
                where: { id: memberId, cluster_id: clusterId }
            })

            if (!membership) {
                return res.status(404).json({ error: 'Membership not found' })
            }

            assertNotOwner(membership, 'remove')

            await clusterUserRepo.remove(membership)
            res.status(204).send()
        })
    )

    router.put(
        '/:clusterId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { clusterId } = req.params
            const { name, description } = req.body || {}
            if (!name) {
                return res.status(400).json({ error: 'name is required' })
            }

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { clusterRepo } = repos(req)
            await ensureClusterAccess(getDataSource(), userId, clusterId, 'manageCluster')

            const cluster = await clusterRepo.findOne({ where: { id: clusterId } })
            if (!cluster) {
                return res.status(404).json({ error: 'Cluster not found' })
            }

            cluster.name = name
            cluster.description = description

            const saved = await clusterRepo.save(cluster)
            res.json(saved)
        })
    )

    router.delete(
        '/:clusterId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { clusterId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { clusterRepo } = repos(req)
            await ensureClusterAccess(getDataSource(), userId, clusterId, 'manageCluster')

            const cluster = await clusterRepo.findOne({ where: { id: clusterId } })
            if (!cluster) {
                return res.status(404).json({ error: 'Cluster not found' })
            }

            await clusterRepo.remove(cluster)
            res.status(204).send()
        })
    )

    // GET /clusters/:clusterId/resources
    router.get(
        '/:clusterId/resources',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { clusterId } = req.params
            const userId = resolveUserId(req)
            // Debug log removed

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            await ensureClusterAccess(getDataSource(), userId, clusterId)

            const { linkRepo } = repos(req)
            try {
                const links = await linkRepo.find({ where: { cluster: { id: clusterId } }, relations: ['resource', 'cluster'] })
                const resources = links.map((l) => ({ ...l.resource, sortOrder: l.sortOrder }))
                // Debug log removed
                res.json(resources)
            } catch (error) {
                console.error(`GET /clusters/${clusterId}/resources - Error:`, error)
                res.status(500).json({
                    error: 'Failed to get cluster resources',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /clusters/:clusterId/resources/:resourceId (attach)
    router.post(
        '/:clusterId/resources/:resourceId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { clusterId, resourceId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureClusterAccess(getDataSource(), userId, clusterId, 'createContent')
            const { linkRepo, clusterRepo, resourceRepo } = repos(req)
            const cluster = await clusterRepo.findOne({ where: { id: clusterId } })
            const resource = await resourceRepo.findOne({ where: { id: resourceId } })
            if (!cluster || !resource) return res.status(404).json({ error: 'Not found' })
            // Avoid duplicates at API level (no UNIQUE in DB as per requirements)
            const exists = await linkRepo.findOne({ where: { cluster: { id: clusterId }, resource: { id: resourceId } } })
            if (exists) return res.status(200).json(exists)
            const link = linkRepo.create({ cluster, resource })
            const saved = await linkRepo.save(link)
            res.status(201).json(saved)
        })
    )

    // DELETE /clusters/:clusterId/resources/:resourceId (detach)
    router.delete(
        '/:clusterId/resources/:resourceId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { clusterId, resourceId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureClusterAccess(getDataSource(), userId, clusterId, 'deleteContent')
            const { linkRepo } = repos(req)
            const existing = await linkRepo.findOne({ where: { cluster: { id: clusterId }, resource: { id: resourceId } } })
            if (!existing) return res.status(404).json({ error: 'Link not found' })
            await linkRepo.remove(existing)
            res.status(204).send()
        })
    )

    // POST /clusters/:clusterId/resources/reorder { items: [{resourceId, sortOrder}] }
    router.post(
        '/:clusterId/resources/reorder',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { clusterId } = req.params
            const { items } = req.body || {}
            if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' })
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureClusterAccess(getDataSource(), userId, clusterId, 'editContent')
            const { linkRepo } = repos(req)
            for (const it of items) {
                if (!it?.resourceId) continue
                const link = await linkRepo.findOne({ where: { cluster: { id: clusterId }, resource: { id: it.resourceId } } })
                if (link) {
                    link.sortOrder = Number(it.sortOrder) || 1
                    await linkRepo.save(link)
                }
            }
            res.json({ success: true })
        })
    )

    // --- Domains in cluster ---

    // GET /clusters/:clusterId/domains
    router.get(
        '/:clusterId/domains',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { clusterId } = req.params
            const userId = resolveUserId(req)
            // Debug log removed

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            await ensureClusterAccess(getDataSource(), userId, clusterId)

            const { domainLinkRepo } = repos(req)
            try {
                const links = await domainLinkRepo.find({ where: { cluster: { id: clusterId } }, relations: ['domain', 'cluster'] })
                const domains = links.map((l) => l.domain)
                // Debug log removed
                res.json(domains)
            } catch (error) {
                console.error(`GET /clusters/${clusterId}/domains - Error:`, error)
                res.status(500).json({
                    error: 'Failed to get cluster domains',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /clusters/:clusterId/domains/:domainId (attach)
    router.post(
        '/:clusterId/domains/:domainId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { clusterId, domainId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            // Ensure the user can access both the cluster and the domain
            await ensureClusterAccess(getDataSource(), userId, clusterId, 'createContent')
            await ensureDomainAccess(getDataSource(), userId, domainId)
            const { clusterRepo, domainRepo, domainLinkRepo } = repos(req)
            const cluster = await clusterRepo.findOne({ where: { id: clusterId } })
            const domain = await domainRepo.findOne({ where: { id: domainId } })
            if (!cluster || !domain) return res.status(404).json({ error: 'Not found' })

            const exists = await domainLinkRepo.findOne({ where: { cluster: { id: clusterId }, domain: { id: domainId } } })
            if (exists) return res.status(200).json(exists)

            const link = domainLinkRepo.create({ cluster, domain })
            const saved = await domainLinkRepo.save(link)
            res.status(201).json(saved)
        })
    )

    return router
}

export default createClustersRoutes
