import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-srv'
import type { ClusterRole } from '@universo/types'
import { Resource } from '../database/entities/Resource'
import { Domain } from '../database/entities/Domain'
import { ResourceDomain } from '../database/entities/ResourceDomain'
import { Cluster } from '../database/entities/Cluster'
import { ClusterUser } from '../database/entities/ClusterUser'
import { DomainCluster } from '../database/entities/DomainCluster'
import { ResourceCluster } from '../database/entities/ResourceCluster'
import { ensureClusterAccess, ensureDomainAccess, ensureResourceAccess, ROLE_PERMISSIONS } from './guards'
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
        resourceRepo: manager.getRepository(Resource),
        domainRepo: manager.getRepository(Domain),
        resourceDomainRepo: manager.getRepository(ResourceDomain),
        clusterRepo: manager.getRepository(Cluster),
        clusterUserRepo: manager.getRepository(ClusterUser),
        domainClusterRepo: manager.getRepository(DomainCluster),
        resourceClusterRepo: manager.getRepository(ResourceCluster)
    }
}

/**
 * Auto-sync resource-cluster links based on domain-cluster relationships
 * Ensures resources_clusters table always reflects which clusters contain this resource
 * through its domains
 */
async function syncResourceClusterLinks(resourceId: string, repos: ReturnType<typeof getRepositories>) {
    const { resourceDomainRepo, domainClusterRepo, resourceClusterRepo, resourceRepo } = repos

    // Find all domains this resource belongs to
    const resourceDomains = await resourceDomainRepo.find({
        where: { resource: { id: resourceId } },
        relations: ['domain']
    })

    const domainIds = resourceDomains.map((es) => es.domain.id)

    if (domainIds.length === 0) {
        // Resource has no domains - remove all cluster links
        await resourceClusterRepo.delete({ resource: { id: resourceId } })
        return
    }

    // Find all clusters these domains belong to
    const domainClusters = await domainClusterRepo.find({
        where: { domain: { id: In(domainIds) } },
        relations: ['cluster']
    })

    // Get unique cluster IDs
    const clusterIds = [...new Set(domainClusters.map((sm) => sm.cluster.id))]

    // Get current resource-cluster links
    const currentLinks = await resourceClusterRepo.find({
        where: { resource: { id: resourceId } },
        relations: ['cluster']
    })

    const currentClusterIds = new Set(currentLinks.map((link) => link.cluster.id))

    // Add missing links
    const resource = await resourceRepo.findOne({ where: { id: resourceId } })
    if (!resource) return

    for (const clusterId of clusterIds) {
        if (!currentClusterIds.has(clusterId)) {
            const link = resourceClusterRepo.create({
                resource: { id: resourceId },
                cluster: { id: clusterId }
            })
            await resourceClusterRepo.save(link)
        }
    }

    // Remove obsolete links
    const obsoleteLinks = currentLinks.filter((link) => !clusterIds.includes(link.cluster.id))
    if (obsoleteLinks.length > 0) {
        await resourceClusterRepo.remove(obsoleteLinks)
    }
}

// Comments in English only
export function createResourcesRouter(
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

    // GET / - List all resources with pagination, search, sorting
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

                // Get resources accessible to user through domain membership
                const { resourceRepo } = getRepositories(req, getDataSource)
                const qb = resourceRepo
                    .createQueryBuilder('e')
                    // Join with resource-domain link
                    .innerJoin(ResourceDomain, 'es', 'es.resource_id = e.id')
                    // Join with domain
                    .innerJoin(Domain, 's', 's.id = es.domain_id')
                    // Join with domain-cluster link
                    .innerJoin(DomainCluster, 'sm', 'sm.domain_id = s.id')
                    // Join with cluster user to filter by user access
                    .innerJoin(ClusterUser, 'mu', 'mu.cluster_id = sm.cluster_id')
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
                console.error('[ERROR] GET /resources failed:', error)
                res.status(500).json({
                    error: 'Internal server error',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST / (Create a new resource)
    router.post(
        '/',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { resourceRepo, domainRepo, resourceDomainRepo, clusterRepo, resourceClusterRepo } = getRepositories(req, getDataSource)
            const schema = z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                domainId: z.string().uuid(),
                clusterId: z.string().uuid().optional()
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            const { name, description, clusterId, domainId } = parsed.data
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Verify access to the domain
            await ensureDomainAccess(getDataSource(), userId, domainId, 'createContent')

            try {
                // Validate domain exists
                const domain = await domainRepo.findOne({ where: { id: domainId } })
                if (!domain) return res.status(400).json({ error: 'Invalid domainId' })

                const resource = resourceRepo.create({ name, description })
                await resourceRepo.save(resource)

                // Create mandatory resource-domain link
                const resourceDomainLink = resourceDomainRepo.create({ resource, domain })
                await resourceDomainRepo.save(resourceDomainLink)

                // CRITICAL: Auto-sync resource-cluster links based on domain-cluster links
                // This ensures resourcesCount is always accurate in cluster dashboard
                await syncResourceClusterLinks(resource.id, getRepositories(req, getDataSource))

                // Optional explicit cluster link (kept for backwards compatibility)
                if (clusterId) {
                    // Verify access to the cluster
                    await ensureClusterAccess(getDataSource(), userId, clusterId, 'createContent')

                    const cluster = await clusterRepo.findOne({ where: { id: clusterId } })
                    if (!cluster) return res.status(400).json({ error: 'Invalid clusterId' })
                    const exists = await resourceClusterRepo.findOne({
                        where: { cluster: { id: clusterId }, resource: { id: resource.id } }
                    })
                    if (!exists) {
                        const link = resourceClusterRepo.create({ cluster, resource })
                        await resourceClusterRepo.save(link)
                    }
                }

                res.status(201).json(resource)
            } catch (error) {
                console.error('POST /resources - Error:', error)
                res.status(500).json({
                    error: 'Failed to create resource',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // GET /:resourceId (Get a single resource)
    router.get(
        '/:resourceId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureResourceAccess(getDataSource(), userId, req.params.resourceId)
            const { resourceRepo } = getRepositories(req, getDataSource)
            const resource = await resourceRepo.findOneBy({ id: req.params.resourceId })
            if (!resource) {
                return res.status(404).json({ error: 'Resource not found' })
            }
            res.json(resource)
        })
    )

    // PUT /:resourceId (Update a resource)
    router.put(
        '/:resourceId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureResourceAccess(getDataSource(), userId, req.params.resourceId, 'editContent')
            const { resourceRepo } = getRepositories(req, getDataSource)
            const resource = await resourceRepo.findOneBy({ id: req.params.resourceId })
            if (!resource) {
                return res.status(404).json({ error: 'Resource not found' })
            }
            const { name, description } = req.body
            resourceRepo.merge(resource, { name, description })
            await resourceRepo.save(resource)
            res.json(resource)
        })
    )

    // DELETE /:resourceId (Delete a resource)
    router.delete(
        '/:resourceId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureResourceAccess(getDataSource(), userId, req.params.resourceId, 'deleteContent')
            const { resourceRepo } = getRepositories(req, getDataSource)
            const result = await resourceRepo.delete({ id: req.params.resourceId })
            if (result.affected === 0) {
                return res.status(404).json({ error: 'Resource not found' })
            }
            res.status(204).send()
        })
    )

    // PUT /:resourceId/domain { domainId }
    router.put(
        '/:resourceId/domain',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { resourceRepo, domainRepo, resourceDomainRepo } = getRepositories(req, getDataSource)
            const resourceId = req.params.resourceId
            const { domainId } = req.body || {}
            if (!domainId) return res.status(400).json({ error: 'domainId is required' })
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureResourceAccess(getDataSource(), userId, resourceId, 'editContent')
            await ensureDomainAccess(getDataSource(), userId, domainId, 'editContent')

            const resource = await resourceRepo.findOneBy({ id: resourceId })
            if (!resource) return res.status(404).json({ error: 'Resource not found' })

            const domain = await domainRepo.findOneBy({ id: domainId })
            if (!domain) return res.status(404).json({ error: 'Domain not found' })

            const exists = await resourceDomainRepo.findOne({ where: { resource: { id: resourceId }, domain: { id: domainId } } })
            if (exists) return res.status(200).json(exists)

            const link = resourceDomainRepo.create({ resource, domain })
            const saved = await resourceDomainRepo.save(link)

            // Auto-sync resource-cluster links after adding domain
            await syncResourceClusterLinks(resourceId, getRepositories(req, getDataSource))

            res.status(201).json(saved)
        })
    )

    // DELETE /:resourceId/domain – remove all domain links for the resource (simple semantics)
    router.delete(
        '/:resourceId/domain',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { resourceRepo, resourceDomainRepo } = getRepositories(req, getDataSource)
            const resourceId = req.params.resourceId
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureResourceAccess(getDataSource(), userId, resourceId, 'deleteContent')
            const resource = await resourceRepo.findOneBy({ id: resourceId })
            if (!resource) return res.status(404).json({ error: 'Resource not found' })

            const links = await resourceDomainRepo.find({ where: { resource: { id: resourceId } } })
            if (links.length === 0) return res.status(404).json({ error: 'No domain links found' })

            await resourceDomainRepo.remove(links)

            // Auto-sync resource-cluster links after removing domains
            await syncResourceClusterLinks(resourceId, getRepositories(req, getDataSource))

            res.status(204).send()
        })
    )

    return router
}

export default createResourcesRouter
