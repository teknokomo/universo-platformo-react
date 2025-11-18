import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-srv'
import type { ClusterRole } from '@universo/types'
import { Domain } from '../database/entities/Domain'
import { Cluster } from '../database/entities/Cluster'
import { ClusterUser } from '../database/entities/ClusterUser'
import { DomainCluster } from '../database/entities/DomainCluster'
import { Resource } from '../database/entities/Resource'
import { ResourceDomain } from '../database/entities/ResourceDomain'
import { ensureDomainAccess, ensureClusterAccess, ensureResourceAccess, ROLE_PERMISSIONS } from './guards'
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

// Comments in English only
export function createDomainsRoutes(
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
            domainRepo: manager.getRepository(Domain),
            clusterRepo: manager.getRepository(Cluster),
            clusterUserRepo: manager.getRepository(ClusterUser),
            domainClusterRepo: manager.getRepository(DomainCluster),
            resourceRepo: manager.getRepository(Resource),
            resourceDomainRepo: manager.getRepository(ResourceDomain)
        }
    }

    // GET /domains - with pagination, search, sorting
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

                // Get domains accessible to user through cluster membership
                const { domainRepo } = repos(req)
                const qb = domainRepo
                    .createQueryBuilder('s')
                    // Join with domain-cluster link
                    .innerJoin(DomainCluster, 'sm', 'sm.domain_id = s.id')
                    // Join with cluster user to filter by user access
                    .innerJoin(ClusterUser, 'mu', 'mu.cluster_id = sm.cluster_id')
                    // Left join with resource-domain to count resources
                    .leftJoin(ResourceDomain, 'es', 'es.domain_id = s.id')
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
                    .addSelect('COUNT(DISTINCT es.id)', 'resourcesCount')
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
                    resourcesCount: string
                    window_total?: string
                }>()

                // Extract total count from window function (same value in all rows)
                // Handle edge case: empty result set
                const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) : 0

                const response = raw.map((row) => {
                    const role = (row.user_role || 'member') as ClusterRole
                    const permissions = ROLE_PERMISSIONS[role]

                    return {
                        id: row.id,
                        name: row.name,
                        description: row.description ?? undefined,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                        resourcesCount: parseInt(row.resourcesCount || '0', 10) || 0,
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
                console.error('[ERROR] GET /domains failed:', error)
                res.status(500).json({
                    error: 'Internal server error',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /domains
    router.post(
        '/',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const schema = z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                clusterId: z.string().uuid()
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            const { name, description, clusterId } = parsed.data
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Validate required fields
            if (!name) return res.status(400).json({ error: 'name is required' })
            if (!clusterId) return res.status(400).json({ error: 'clusterId is required - domains must be associated with a cluster' })

            await ensureClusterAccess(getDataSource(), userId, clusterId, 'createContent')

            const { domainRepo, clusterRepo, domainClusterRepo } = repos(req)

            try {
                // Validate cluster exists
                const cluster = await clusterRepo.findOne({ where: { id: clusterId } })
                if (!cluster) return res.status(400).json({ error: 'Invalid clusterId' })

                const resource = domainRepo.create({ name, description })
                const saved = await domainRepo.save(resource)

                // Create mandatory domain-cluster link
                const domainClusterLink = domainClusterRepo.create({ domain: saved, cluster })
                await domainClusterRepo.save(domainClusterLink)

                res.status(201).json(saved)
            } catch (error) {
                console.error('POST /domains - Error:', error)
                res.status(500).json({
                    error: 'Failed to create domain',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // GET /domains/:domainId
    router.get(
        '/:domainId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { domainId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            await ensureDomainAccess(getDataSource(), userId, domainId)

            const { domainRepo, resourceDomainRepo } = repos(req)

            const domain = await domainRepo.findOne({ where: { id: domainId } })
            if (!domain) return res.status(404).json({ error: 'Domain not found' })

            // Get resources count for this domain
            const resourcesCount = await resourceDomainRepo.count({ where: { domain: { id: domainId } } })

            const response = {
                id: domain.id,
                name: domain.name,
                description: domain.description ?? undefined,
                createdAt: domain.createdAt,
                updatedAt: domain.updatedAt,
                resourcesCount
            }

            res.json(response)
        })
    )

    // PUT /domains/:domainId
    router.put(
        '/:domainId',
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

            const { domainId } = req.params
            const { name, description } = parsed.data
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureDomainAccess(getDataSource(), userId, domainId, 'editContent')
            const { domainRepo } = repos(req)

            const domain = await domainRepo.findOne({ where: { id: domainId } })
            if (!domain) return res.status(404).json({ error: 'Domain not found' })

            if (name !== undefined) domain.name = name
            if (description !== undefined) domain.description = description

            const updated = await domainRepo.save(domain)
            res.json(updated)
        })
    )

    // DELETE /domains/:domainId
    router.delete(
        '/:domainId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { domainId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureDomainAccess(getDataSource(), userId, domainId, 'deleteContent')
            const { domainRepo } = repos(req)

            const domain = await domainRepo.findOne({ where: { id: domainId } })
            if (!domain) return res.status(404).json({ error: 'Domain not found' })

            await domainRepo.remove(domain)
            res.status(204).send()
        })
    )

    // GET /domains/:domainId/resources
    router.get(
        '/:domainId/resources',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { domainId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureDomainAccess(getDataSource(), userId, domainId)
            const { domainRepo, resourceDomainRepo } = repos(req)

            // Validate domain exists
            const domain = await domainRepo.findOne({ where: { id: domainId } })
            if (!domain) return res.status(404).json({ error: 'Domain not found' })

            // Get resources linked to this domain
            const links = await resourceDomainRepo.find({
                where: { domain: { id: domainId } },
                relations: ['resource']
            })
            const resources = links.map((link) => link.resource)
            res.json(resources)
        })
    )

    // POST /domains/:domainId/resources/:resourceId (attach resource to domain)
    router.post(
        '/:domainId/resources/:resourceId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { domainId, resourceId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Ensure user has createContent permission for the domain
            await ensureDomainAccess(getDataSource(), userId, domainId, 'createContent')

            // SECURITY: Ensure user has access to the resource before attaching
            await ensureResourceAccess(getDataSource(), userId, resourceId)

            const { domainRepo, resourceRepo, resourceDomainRepo } = repos(req)

            // Validate domain exists
            const domain = await domainRepo.findOne({ where: { id: domainId } })
            if (!domain) return res.status(404).json({ error: 'Domain not found' })

            // Validate resource exists
            const resource = await resourceRepo.findOne({ where: { id: resourceId } })
            if (!resource) return res.status(404).json({ error: 'Resource not found' })

            // Check if link already exists (idempotent)
            const existing = await resourceDomainRepo.findOne({
                where: { domain: { id: domainId }, resource: { id: resourceId } }
            })
            if (existing) return res.status(200).json(existing)

            // Create new link
            const link = resourceDomainRepo.create({ domain, resource })
            const saved = await resourceDomainRepo.save(link)
            res.status(201).json(saved)
        })
    )

    return router
}

export default createDomainsRoutes
