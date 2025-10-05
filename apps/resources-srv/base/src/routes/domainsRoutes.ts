import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import { Domain } from '../database/entities/Domain'
import { Cluster } from '../database/entities/Cluster'
import { ClusterUser } from '../database/entities/ClusterUser'
import { DomainCluster } from '../database/entities/DomainCluster'
import { Resource } from '../database/entities/Resource'
import { ResourceDomain } from '../database/entities/ResourceDomain'
import { ensureDomainAccess } from './guards'
import { z } from 'zod'

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

// Comments in English only
export function createDomainsRoutes(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
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
            domainRepo: ds.getRepository(Domain),
            clusterRepo: ds.getRepository(Cluster),
            clusterUserRepo: ds.getRepository(ClusterUser),
            domainClusterRepo: ds.getRepository(DomainCluster),
            resourceRepo: ds.getRepository(Resource),
            resourceDomainRepo: ds.getRepository(ResourceDomain)
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

    // Helper function to check if user has access to domain (through its cluster)
    const _checkDomainAccess = async (domainId: string, userId: string) => {
        const { domainClusterRepo } = repos()
        const domainCluster = await domainClusterRepo.findOne({
            where: { domain: { id: domainId } },
            relations: ['cluster']
        })
        if (!domainCluster) return false
        return await checkClusterAccess(domainCluster.cluster.id, userId)
    }

    // GET /domains
    router.get(
        '/',
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { clusterUserRepo, domainClusterRepo } = repos()

            // Get clusters accessible to user
            const userClusters = await clusterUserRepo.find({
                where: { user_id: userId }
            })
            const clusterIds = userClusters.map((uc) => uc.cluster_id)

            if (clusterIds.length === 0) {
                return res.json([])
            }

            // Get domains from user's clusters
            const domainClusters = await domainClusterRepo.find({
                where: clusterIds.map((clusterId) => ({ cluster: { id: clusterId } })),
                relations: ['domain']
            })

            const domains = domainClusters.map((dc) => dc.domain)
            res.json(domains)
        })
    )

    // POST /domains
    router.post(
        '/',
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

            // Check if user has access to the cluster
            const hasAccess = await checkClusterAccess(clusterId, userId)
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied to this cluster' })
            }

            const { domainRepo, clusterRepo, domainClusterRepo } = repos()

            // Validate cluster exists
            const cluster = await clusterRepo.findOne({ where: { id: clusterId } })
            if (!cluster) return res.status(400).json({ error: 'Invalid clusterId' })

            const entity = domainRepo.create({ name, description })
            const saved = await domainRepo.save(entity)

            // Create mandatory domain-cluster link
            const domainClusterLink = domainClusterRepo.create({ domain: saved, cluster })
            await domainClusterRepo.save(domainClusterLink)

            res.status(201).json(saved)
        })
    )

    // GET /domains/:domainId
    router.get(
        '/:domainId',
        asyncHandler(async (req, res) => {
            const { domainId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureDomainAccess(getDataSource(), userId, domainId)
            const { domainRepo } = repos()
            const domain = await domainRepo.findOne({ where: { id: domainId } })
            if (!domain) return res.status(404).json({ error: 'Domain not found' })
            res.json(domain)
        })
    )

    // PUT /domains/:domainId
    router.put(
        '/:domainId',
        asyncHandler(async (req, res) => {
            const { domainId } = req.params
            const { name, description } = req.body || {}
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureDomainAccess(getDataSource(), userId, domainId)
            const { domainRepo } = repos()

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
        asyncHandler(async (req, res) => {
            const { domainId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureDomainAccess(getDataSource(), userId, domainId)
            const { domainRepo } = repos()

            const domain = await domainRepo.findOne({ where: { id: domainId } })
            if (!domain) return res.status(404).json({ error: 'Domain not found' })

            await domainRepo.remove(domain)
            res.status(204).send()
        })
    )

    // GET /domains/:domainId/resources
    router.get(
        '/:domainId/resources',
        asyncHandler(async (req, res) => {
            const { domainId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureDomainAccess(getDataSource(), userId, domainId)
            const { domainRepo, resourceDomainRepo } = repos()

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

    return router
}

export default createDomainsRoutes
