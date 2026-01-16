import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { Metahub } from '../../../database/entities/Metahub'
import { Hub } from '../../../database/entities/Hub'
import { Catalog } from '../../../database/entities/Catalog'
import { CatalogHub } from '../../../database/entities/CatalogHub'
import { Attribute } from '../../../database/entities/Attribute'
import { HubRecord } from '../../../database/entities/Record'

/**
 * Public API routes for accessing published Metahubs
 *
 * These routes do NOT require authentication.
 * Only metahubs with isPublic=true are accessible.
 * All operations are read-only.
 *
 * Hierarchy: Metahub → Hub → Catalog → Attributes/Records
 */
export function createPublicMetahubsRoutes(getDataSource: () => DataSource, readLimiter: RateLimitRequestHandler): Router {
    const router = Router({ mergeParams: true })

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const repos = () => {
        const ds = getDataSource()
        return {
            metahubRepo: ds.getRepository(Metahub),
            hubRepo: ds.getRepository(Hub),
            catalogRepo: ds.getRepository(Catalog),
            catalogHubRepo: ds.getRepository(CatalogHub),
            attributeRepo: ds.getRepository(Attribute),
            recordRepo: ds.getRepository(HubRecord)
        }
    }

    /**
     * GET /api/public/metahub/:slug
     * Get public metahub by slug
     */
    router.get(
        '/:slug',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { slug } = req.params
            const { metahubRepo } = repos()

            const metahub = await metahubRepo.findOne({
                where: { slug, isPublic: true }
            })

            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found or not public' })
            }

            res.json(metahub)
        })
    )

    /**
     * GET /api/public/metahub/:slug/hubs
     * List all hubs in a public metahub
     */
    router.get(
        '/:slug/hubs',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { slug } = req.params
            const { metahubRepo, hubRepo } = repos()

            const metahub = await metahubRepo.findOne({
                where: { slug, isPublic: true }
            })

            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found or not public' })
            }

            const hubs = await hubRepo.find({
                where: { metahubId: metahub.id },
                order: { sortOrder: 'ASC', createdAt: 'ASC' }
            })

            res.json({ items: hubs, pagination: { total: hubs.length, limit: 100, offset: 0 } })
        })
    )

    /**
     * GET /api/public/metahub/:slug/hub/:hubCodename
     * Get a hub by codename in a public metahub
     */
    router.get(
        '/:slug/hub/:hubCodename',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { slug, hubCodename } = req.params
            const { metahubRepo, hubRepo } = repos()

            const metahub = await metahubRepo.findOne({
                where: { slug, isPublic: true }
            })

            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found or not public' })
            }

            const hub = await hubRepo.findOne({
                where: { metahubId: metahub.id, codename: hubCodename }
            })

            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            res.json(hub)
        })
    )

    /**
     * GET /api/public/metahub/:slug/hub/:hubCodename/catalogs
     * List all catalogs in a hub of a public metahub
     */
    router.get(
        '/:slug/hub/:hubCodename/catalogs',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { slug, hubCodename } = req.params
            const { metahubRepo, hubRepo, catalogRepo, catalogHubRepo } = repos()

            const metahub = await metahubRepo.findOne({
                where: { slug, isPublic: true }
            })

            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found or not public' })
            }

            const hub = await hubRepo.findOne({
                where: { metahubId: metahub.id, codename: hubCodename }
            })

            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            // Get catalogs associated with this hub via junction table
            const catalogHubs = await catalogHubRepo.find({
                where: { hubId: hub.id },
                order: { sortOrder: 'ASC' }
            })

            if (catalogHubs.length === 0) {
                return res.json({ items: [], pagination: { total: 0, limit: 100, offset: 0 } })
            }

            const catalogIds = catalogHubs.map((ch) => ch.catalogId)
            const catalogs = await catalogRepo
                .createQueryBuilder('c')
                .where('c.id IN (:...catalogIds)', { catalogIds })
                .orderBy('c.sortOrder', 'ASC')
                .addOrderBy('c.createdAt', 'ASC')
                .getMany()

            res.json({ items: catalogs, pagination: { total: catalogs.length, limit: 100, offset: 0 } })
        })
    )

    /**
     * GET /api/public/metahub/:slug/hub/:hubCodename/catalog/:catalogCodename
     * Get a catalog by codename in a public metahub
     */
    router.get(
        '/:slug/hub/:hubCodename/catalog/:catalogCodename',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { slug, hubCodename, catalogCodename } = req.params
            const { metahubRepo, hubRepo, catalogRepo, catalogHubRepo } = repos()

            const metahub = await metahubRepo.findOne({
                where: { slug, isPublic: true }
            })

            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found or not public' })
            }

            const hub = await hubRepo.findOne({
                where: { metahubId: metahub.id, codename: hubCodename }
            })

            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            // Find catalog by codename within this metahub
            const catalog = await catalogRepo.findOne({
                where: { metahubId: metahub.id, codename: catalogCodename }
            })

            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            // Verify catalog is associated with this hub
            const catalogHub = await catalogHubRepo.findOne({
                where: { catalogId: catalog.id, hubId: hub.id }
            })

            if (!catalogHub) {
                return res.status(404).json({ error: 'Catalog not found in this hub' })
            }

            res.json(catalog)
        })
    )

    /**
     * GET /api/public/metahub/:slug/hub/:hubCodename/catalog/:catalogCodename/attributes
     * List all attributes of a catalog in a public metahub
     */
    router.get(
        '/:slug/hub/:hubCodename/catalog/:catalogCodename/attributes',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { slug, hubCodename, catalogCodename } = req.params
            const { metahubRepo, hubRepo, catalogRepo, catalogHubRepo, attributeRepo } = repos()

            const metahub = await metahubRepo.findOne({
                where: { slug, isPublic: true }
            })

            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found or not public' })
            }

            const hub = await hubRepo.findOne({
                where: { metahubId: metahub.id, codename: hubCodename }
            })

            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const catalog = await catalogRepo.findOne({
                where: { metahubId: metahub.id, codename: catalogCodename }
            })

            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            // Verify catalog is associated with this hub
            const catalogHub = await catalogHubRepo.findOne({
                where: { catalogId: catalog.id, hubId: hub.id }
            })

            if (!catalogHub) {
                return res.status(404).json({ error: 'Catalog not found in this hub' })
            }

            const attributes = await attributeRepo.find({
                where: { catalogId: catalog.id },
                order: { sortOrder: 'ASC', createdAt: 'ASC' }
            })

            res.json({ items: attributes, pagination: { total: attributes.length, limit: 100, offset: 0 } })
        })
    )

    /**
     * GET /api/public/metahub/:slug/hub/:hubCodename/catalog/:catalogCodename/records
     * List all records in a catalog (with pagination)
     */
    router.get(
        '/:slug/hub/:hubCodename/catalog/:catalogCodename/records',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { slug, hubCodename, catalogCodename } = req.params
            const { limit = '100', offset = '0' } = req.query
            const { metahubRepo, hubRepo, catalogRepo, catalogHubRepo, recordRepo } = repos()

            const metahub = await metahubRepo.findOne({
                where: { slug, isPublic: true }
            })

            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found or not public' })
            }

            const hub = await hubRepo.findOne({
                where: { metahubId: metahub.id, codename: hubCodename }
            })

            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const catalog = await catalogRepo.findOne({
                where: { metahubId: metahub.id, codename: catalogCodename }
            })

            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            // Verify catalog is associated with this hub
            const catalogHub = await catalogHubRepo.findOne({
                where: { catalogId: catalog.id, hubId: hub.id }
            })

            if (!catalogHub) {
                return res.status(404).json({ error: 'Catalog not found in this hub' })
            }

            const [records, total] = await recordRepo.findAndCount({
                where: { catalogId: catalog.id },
                order: { sortOrder: 'ASC', createdAt: 'DESC' },
                take: Math.min(parseInt(limit as string, 10), 1000),
                skip: parseInt(offset as string, 10)
            })

            res.json({
                items: records,
                pagination: {
                    total,
                    limit: parseInt(limit as string, 10),
                    offset: parseInt(offset as string, 10)
                }
            })
        })
    )

    /**
     * GET /api/public/metahub/:slug/hub/:hubCodename/catalog/:catalogCodename/record/:recordId
     * Get a single record by ID
     */
    router.get(
        '/:slug/hub/:hubCodename/catalog/:catalogCodename/record/:recordId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { slug, hubCodename, catalogCodename, recordId } = req.params
            const { metahubRepo, hubRepo, catalogRepo, catalogHubRepo, recordRepo } = repos()

            const metahub = await metahubRepo.findOne({
                where: { slug, isPublic: true }
            })

            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found or not public' })
            }

            const hub = await hubRepo.findOne({
                where: { metahubId: metahub.id, codename: hubCodename }
            })

            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const catalog = await catalogRepo.findOne({
                where: { metahubId: metahub.id, codename: catalogCodename }
            })

            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            // Verify catalog is associated with this hub
            const catalogHub = await catalogHubRepo.findOne({
                where: { catalogId: catalog.id, hubId: hub.id }
            })

            if (!catalogHub) {
                return res.status(404).json({ error: 'Catalog not found in this hub' })
            }

            const record = await recordRepo.findOne({
                where: { id: recordId, catalogId: catalog.id }
            })

            if (!record) {
                return res.status(404).json({ error: 'Record not found' })
            }

            res.json(record)
        })
    )

    return router
}
