import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import { Resource } from '../database/entities/Resource'
import { Domain } from '../database/entities/Domain'
import { ResourceDomain } from '../database/entities/ResourceDomain'
import { Cluster } from '../database/entities/Cluster'
import { ClusterUser } from '../database/entities/ClusterUser'
import { DomainCluster } from '../database/entities/DomainCluster'
import { ResourceCluster } from '../database/entities/ResourceCluster'
import { ensureClusterAccess, ensureDomainAccess, ensureResourceAccess } from './guards'
import { z } from 'zod'

// Helper to get repositories from the data source
function getRepositories(getDataSource: () => DataSource) {
    const dataSource = getDataSource()
    return {
        resourceRepo: dataSource.getRepository(Resource),
        domainRepo: dataSource.getRepository(Domain),
        resourceDomainRepo: dataSource.getRepository(ResourceDomain),
        clusterRepo: dataSource.getRepository(Cluster),
        clusterUserRepo: dataSource.getRepository(ClusterUser),
        domainClusterRepo: dataSource.getRepository(DomainCluster),
        resourceClusterRepo: dataSource.getRepository(ResourceCluster)
    }
}

// Main function to create the resources router
export function createResourcesRouter(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
    const router = Router({ mergeParams: true })

    // All routes in this router require authentication
    router.use(ensureAuth)

    // Async handler to wrap async functions and catch errors
    const asyncHandler = (fn: (req: Request, res: Response) => Promise<any>): RequestHandler => {
        return (req, res, next) => {
            fn(req, res).catch(next)
        }
    }

    // Helper function to check if user has access to cluster
    const checkClusterAccess = async (clusterId: string, userId: string) => {
        const { clusterUserRepo } = getRepositories(getDataSource)
        const userCluster = await clusterUserRepo.findOne({
            where: { cluster_id: clusterId, user_id: userId }
        })
        return userCluster !== null
    }

    // Helper function to check if user has access to domain (through its cluster)
    const checkDomainAccess = async (domainId: string, userId: string) => {
        const { domainClusterRepo } = getRepositories(getDataSource)
        const domainCluster = await domainClusterRepo.findOne({
            where: { domain: { id: domainId } },
            relations: ['cluster']
        })
        if (!domainCluster) return false
        return await checkClusterAccess(domainCluster.cluster.id, userId)
    }

    // --- Resource CRUD (flat, no categories) ---

    // GET / (List all resources)
    router.get(
        '/',
        asyncHandler(async (req: Request, res: Response) => {
            const userId = (req as any).user?.sub
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { clusterUserRepo, domainClusterRepo, resourceDomainRepo } = getRepositories(getDataSource)
            
            // Get clusters accessible to user
            const userClusters = await clusterUserRepo.find({ 
                where: { user_id: userId } 
            })
            const clusterIds = userClusters.map(uc => uc.cluster_id)
            
            if (clusterIds.length === 0) {
                return res.json([])
            }
            
            // Get domains from user's clusters
            const domainClusters = await domainClusterRepo.find({
                where: clusterIds.map(clusterId => ({ cluster: { id: clusterId } })),
                relations: ['domain']
            })
            const domainIds = domainClusters.map(dc => dc.domain.id)
            
            if (domainIds.length === 0) {
                return res.json([])
            }
            
            // Get resources from user's domains
            const resourceDomains = await resourceDomainRepo.find({
                where: domainIds.map(domainId => ({ domain: { id: domainId } })),
                relations: ['resource']
            })
            
            const resources = resourceDomains.map(rd => rd.resource)
            
            // Remove duplicates
            const uniqueResources = resources.filter((resource, index, self) => 
                index === self.findIndex(r => r.id === resource.id)
            )
            
            res.json(uniqueResources)
        })
    )

    // POST / (Create a new resource)
    router.post(
        '/',
        asyncHandler(async (req: Request, res: Response) => {
            const { resourceRepo, domainRepo, resourceDomainRepo, clusterRepo, resourceClusterRepo } = getRepositories(getDataSource)
            const schema = z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                domainId: z.string().uuid(),
                clusterId: z.string().uuid().optional()
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            const { name, description, clusterId, domainId } = parsed.data
            const userId = (req as any).user?.sub

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Verify access to the domain
            await ensureDomainAccess(getDataSource(), userId, domainId)

            // Validate domain exists
            const domain = await domainRepo.findOne({ where: { id: domainId } })
            if (!domain) return res.status(400).json({ error: 'Invalid domainId' })

            const resource = resourceRepo.create({ name, description })
            await resourceRepo.save(resource)

            // Create mandatory resource-domain link
            const resourceDomainLink = resourceDomainRepo.create({ resource, domain })
            await resourceDomainRepo.save(resourceDomainLink)

            // Optional cluster link for atomic create-in-cluster flow
            if (clusterId) {
                // Verify access to the cluster
                await ensureClusterAccess(getDataSource(), userId, clusterId)
                
                const cluster = await clusterRepo.findOne({ where: { id: clusterId } })
                if (!cluster) return res.status(400).json({ error: 'Invalid clusterId' })
                const exists = await resourceClusterRepo.findOne({ where: { cluster: { id: clusterId }, resource: { id: resource.id } } })
                if (!exists) {
                    const link = resourceClusterRepo.create({ cluster, resource })
                    await resourceClusterRepo.save(link)
                }
            }

            res.status(201).json(resource)
        })
    )

    // GET /:resourceId (Get a single resource)
    router.get(
        '/:resourceId',
        asyncHandler(async (req: Request, res: Response) => {
            const userId = (req as any).user?.sub
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureResourceAccess(getDataSource(), userId, req.params.resourceId)
            const { resourceRepo } = getRepositories(getDataSource)
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
        asyncHandler(async (req: Request, res: Response) => {
            const userId = (req as any).user?.sub
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureResourceAccess(getDataSource(), userId, req.params.resourceId)
            const { resourceRepo } = getRepositories(getDataSource)
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
        asyncHandler(async (req: Request, res: Response) => {
            const userId = (req as any).user?.sub
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureResourceAccess(getDataSource(), userId, req.params.resourceId)
            const { resourceRepo } = getRepositories(getDataSource)
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
        asyncHandler(async (req: Request, res: Response) => {
            const { resourceRepo, domainRepo, resourceDomainRepo } = getRepositories(getDataSource)
            const resourceId = req.params.resourceId
            const { domainId } = req.body || {}
            if (!domainId) return res.status(400).json({ error: 'domainId is required' })
            const userId = (req as any).user?.sub
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureResourceAccess(getDataSource(), userId, resourceId)
            await ensureDomainAccess(getDataSource(), userId, domainId)

            const resource = await resourceRepo.findOneBy({ id: resourceId })
            if (!resource) return res.status(404).json({ error: 'Resource not found' })

            const domain = await domainRepo.findOneBy({ id: domainId })
            if (!domain) return res.status(404).json({ error: 'Domain not found' })

            const exists = await resourceDomainRepo.findOne({ where: { resource: { id: resourceId }, domain: { id: domainId } } })
            if (exists) return res.status(200).json(exists)

            const link = resourceDomainRepo.create({ resource, domain })
            const saved = await resourceDomainRepo.save(link)
            res.status(201).json(saved)
        })
    )

    // DELETE /:resourceId/domain – remove all domain links for the resource (simple semantics)
    router.delete(
        '/:resourceId/domain',
        asyncHandler(async (req: Request, res: Response) => {
            const { resourceRepo, resourceDomainRepo } = getRepositories(getDataSource)
            const resourceId = req.params.resourceId
            const userId = (req as any).user?.sub
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureResourceAccess(getDataSource(), userId, resourceId)
            const resource = await resourceRepo.findOneBy({ id: resourceId })
            if (!resource) return res.status(404).json({ error: 'Resource not found' })

            const links = await resourceDomainRepo.find({ where: { resource: { id: resourceId } } })
            if (links.length === 0) return res.status(404).json({ error: 'No domain links found' })

            await resourceDomainRepo.remove(links)
            res.status(204).send()
        })
    )

    return router
}

export default createResourcesRouter
