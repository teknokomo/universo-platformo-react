import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import { Cluster } from '../database/entities/Cluster'
import { ClusterUser } from '../database/entities/ClusterUser'
import { Resource } from '../database/entities/Resource'
import { ResourceCluster } from '../database/entities/ResourceCluster'
import { Domain } from '../database/entities/Domain'
import { DomainCluster } from '../database/entities/DomainCluster'
import { ensureClusterAccess, ensureDomainAccess } from './guards'

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

// Parse pagination parameters with validation
const parseIntSafe = (value: any, defaultValue: number, min: number, max: number): number => {
    const parsed = parseInt(String(value || ''), 10)
    if (!Number.isFinite(parsed)) return defaultValue
    return Math.max(min, Math.min(max, parsed))
}

// Comments in English only
export function createClustersRoutes(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<any>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const repos = () => {
        const ds = getDataSource()
        return {
            clusterRepo: ds.getRepository(Cluster),
            clusterUserRepo: ds.getRepository(ClusterUser),
            resourceRepo: ds.getRepository(Resource),
            linkRepo: ds.getRepository(ResourceCluster),
            domainRepo: ds.getRepository(Domain),
            domainLinkRepo: ds.getRepository(DomainCluster)
        }
    }

    // Helper function to check if user has access to cluster
    const checkClusterAccess = async (clusterId: string, userId: string) => {
        const { clusterUserRepo } = repos()
        const userCluster = await clusterUserRepo.findOne({
            where: { cluster_id: clusterId, user_id: userId }
        })
        return userCluster !== null
    }

    // GET /clusters
    router.get(
        '/',
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            try {
                const limit = parseIntSafe(req.query.limit, 100, 1, 1000)
                const offset = parseIntSafe(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER)

                // Safe sorting with whitelist
                const ALLOWED_SORT_FIELDS = {
                    name: 'c.name',
                    created: 'c.createdAt',
                    updated: 'c.updatedAt'
                } as const

                const sortBy =
                    typeof req.query.sortBy === 'string' && req.query.sortBy in ALLOWED_SORT_FIELDS
                        ? ALLOWED_SORT_FIELDS[req.query.sortBy as keyof typeof ALLOWED_SORT_FIELDS]
                        : 'c.updatedAt'

                const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC'

                // Aggregate counts per cluster in a single query filtered by current user membership
                const { clusterRepo } = repos()
                const qb = clusterRepo
                    .createQueryBuilder('c')
                    // Join using entity classes to respect schema mapping and avoid alias parsing issues
                    .innerJoin(ClusterUser, 'cu', 'cu.cluster_id = c.id')
                    .leftJoin(DomainCluster, 'dc', 'dc.cluster_id = c.id')
                    .leftJoin(ResourceCluster, 'rc', 'rc.cluster_id = c.id')
                    .where('cu.user_id = :userId', { userId })
                    .select([
                        'c.id as id',
                        'c.name as name',
                        'c.description as description',
                        // Use entity property names; TypeORM will map to actual column names
                        'c.createdAt as created_at',
                        'c.updatedAt as updated_at'
                    ])
                    .addSelect('COUNT(DISTINCT dc.id)', 'domainsCount')
                    .addSelect('COUNT(DISTINCT rc.id)', 'resourcesCount')
                    .groupBy('c.id')
                    .addGroupBy('c.name')
                    .addGroupBy('c.description')
                    .addGroupBy('c.createdAt')
                    .addGroupBy('c.updatedAt')
                    .orderBy(sortBy, sortOrder)
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
                }>()

                const response = raw.map((row) => ({
                    id: row.id,
                    name: row.name,
                    description: row.description ?? undefined,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                    domainsCount: parseInt(row.domainsCount || '0', 10) || 0,
                    resourcesCount: parseInt(row.resourcesCount || '0', 10) || 0
                }))

                // Add pagination metadata headers for client awareness
                const hasMore = raw.length === limit
                res.setHeader('X-Pagination-Limit', limit.toString())
                res.setHeader('X-Pagination-Offset', offset.toString())
                res.setHeader('X-Pagination-Count', raw.length.toString())
                res.setHeader('X-Pagination-Has-More', hasMore.toString())

                res.json(response)
            } catch (error) {
                console.error('[ERROR] GET /clusters failed:', error)
                res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) })
            }
        })
    )

    // POST /clusters
    router.post(
        '/',
        asyncHandler(async (req, res) => {
            // Debug logs removed to keep production logs clean

            const { name, description } = req.body || {}
            if (!name) return res.status(400).json({ error: 'name is required' })

            // Get user ID from middleware (req.user should be set by ensureAuth)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { clusterRepo, clusterUserRepo } = repos()

            try {
                // Create cluster
                // Creating cluster
                const entity = clusterRepo.create({ name, description })
                const saved = await clusterRepo.save(entity)

                // Create cluster-user relationship (user becomes owner)
                // Creating cluster-user relationship
                const clusterUser = clusterUserRepo.create({
                    cluster_id: saved.id,
                    user_id: userId,
                    role: 'owner'
                })
                await clusterUserRepo.save(clusterUser)

                res.status(201).json(saved)
            } catch (error) {
                console.error('POST /clusters - Error:', error)
                res.status(500).json({ error: 'Failed to create cluster', details: error instanceof Error ? error.message : String(error) })
            }
        })
    )

    router.put(
        '/:clusterId',
        asyncHandler(async (req, res) => {
            const { clusterId } = req.params
            const { name, description } = req.body || {}
            if (!name) return res.status(400).json({ error: 'name is required' })

            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { clusterRepo, clusterUserRepo } = repos()
            const membership = await clusterUserRepo.findOne({ where: { cluster_id: clusterId, user_id: userId } })
            if (!membership || membership.role !== 'owner') {
                return res.status(403).json({ error: 'Not authorized to update this cluster' })
            }

            const cluster = await clusterRepo.findOne({ where: { id: clusterId } })
            if (!cluster) return res.status(404).json({ error: 'Cluster not found' })

            cluster.name = name
            cluster.description = description

            const saved = await clusterRepo.save(cluster)
            res.json(saved)
        })
    )

    router.delete(
        '/:clusterId',
        asyncHandler(async (req, res) => {
            const { clusterId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { clusterRepo, clusterUserRepo } = repos()
            const membership = await clusterUserRepo.findOne({ where: { cluster_id: clusterId, user_id: userId } })
            if (!membership || membership.role !== 'owner') {
                return res.status(403).json({ error: 'Not authorized to delete this cluster' })
            }

            const cluster = await clusterRepo.findOne({ where: { id: clusterId } })
            if (!cluster) return res.status(404).json({ error: 'Cluster not found' })

            await clusterRepo.remove(cluster)
            res.status(204).send()
        })
    )

    // GET /clusters/:clusterId/resources
    router.get(
        '/:clusterId/resources',
        asyncHandler(async (req, res) => {
            const { clusterId } = req.params
            const userId = resolveUserId(req)
            // Debug log removed

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Check if user has access to this cluster
            const hasAccess = await checkClusterAccess(clusterId, userId)
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied to this cluster' })
            }

            const { linkRepo } = repos()
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
        asyncHandler(async (req, res) => {
            const { clusterId, resourceId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureClusterAccess(getDataSource(), userId, clusterId)
            const { linkRepo, clusterRepo, resourceRepo } = repos()
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
        asyncHandler(async (req, res) => {
            const { clusterId, resourceId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureClusterAccess(getDataSource(), userId, clusterId)
            const { linkRepo } = repos()
            const existing = await linkRepo.findOne({ where: { cluster: { id: clusterId }, resource: { id: resourceId } } })
            if (!existing) return res.status(404).json({ error: 'Link not found' })
            await linkRepo.remove(existing)
            res.status(204).send()
        })
    )

    // POST /clusters/:clusterId/resources/reorder { items: [{resourceId, sortOrder}] }
    router.post(
        '/:clusterId/resources/reorder',
        asyncHandler(async (req, res) => {
            const { clusterId } = req.params
            const { items } = req.body || {}
            if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' })
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureClusterAccess(getDataSource(), userId, clusterId)
            const { linkRepo } = repos()
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
        asyncHandler(async (req, res) => {
            const { clusterId } = req.params
            const userId = resolveUserId(req)
            // Debug log removed

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Check if user has access to this cluster
            const hasAccess = await checkClusterAccess(clusterId, userId)
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied to this cluster' })
            }

            const { domainLinkRepo } = repos()
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
        asyncHandler(async (req, res) => {
            const { clusterId, domainId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            // Ensure the user can access both the cluster and the domain
            await ensureClusterAccess(getDataSource(), userId, clusterId)
            await ensureDomainAccess(getDataSource(), userId, domainId)
            const { clusterRepo, domainRepo, domainLinkRepo } = repos()
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
