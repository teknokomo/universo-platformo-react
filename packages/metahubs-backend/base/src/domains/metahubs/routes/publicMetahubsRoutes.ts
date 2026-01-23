import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { Metahub } from '../../../database/entities/Metahub'
// Hub entity removed - hubs are now in isolated schemas (_mhb_hubs)
import { MetahubSchemaService } from '../services/MetahubSchemaService'
import { MetahubObjectsService } from '../services/MetahubObjectsService'
import { MetahubAttributesService } from '../services/MetahubAttributesService'
import { MetahubRecordsService } from '../services/MetahubRecordsService'
import { MetahubHubsService } from '../services/MetahubHubsService'

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
        const schemaService = new MetahubSchemaService(ds)
        const objectsService = new MetahubObjectsService(schemaService)
        const attributesService = new MetahubAttributesService(schemaService)
        const recordsService = new MetahubRecordsService(schemaService, objectsService, attributesService)
        const hubsService = new MetahubHubsService(schemaService)

        return {
            metahubRepo: ds.getRepository(Metahub),
            hubsService,
            objectsService,
            attributesService,
            recordsService
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
            const { metahubRepo, hubsService } = repos()

            const metahub = await metahubRepo.findOne({
                where: { slug, isPublic: true }
            })

            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found or not public' })
            }

            const { items: hubs } = await hubsService.findAll(metahub.id, {
                sortBy: 'sortOrder',
                sortOrder: 'asc'
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
            const { metahubRepo, hubsService } = repos()

            const metahub = await metahubRepo.findOne({
                where: { slug, isPublic: true }
            })

            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found or not public' })
            }

            const hub = await hubsService.findByCodename(metahub.id, hubCodename)

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
            const { metahubRepo, hubsService, objectsService } = repos()

            const metahub = await metahubRepo.findOne({
                where: { slug, isPublic: true }
            })

            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found or not public' })
            }

            const hub = await hubsService.findByCodename(metahub.id, hubCodename)

            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            // Get catalogs from dynamic schema and filter by hub association
            const allCatalogs = await objectsService.findAll(metahub.id)
            const catalogs = allCatalogs.filter((c: any) => {
                const hubs = c.config?.hubs || []
                return hubs.includes(hub.id)
            })

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
            const { metahubRepo, hubsService, objectsService } = repos()

            const metahub = await metahubRepo.findOne({
                where: { slug, isPublic: true }
            })

            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found or not public' })
            }

            const hub = await hubsService.findByCodename(metahub.id, hubCodename)

            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            // Find catalog by codename within this metahub
            const catalog: any = await objectsService.findByCodename(metahub.id, catalogCodename)

            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            // Verify catalog is associated with this hub
            const hubs = catalog.config?.hubs || []
            if (!hubs.includes(hub.id)) {
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
            const { metahubRepo, hubsService, objectsService, attributesService } = repos()

            const metahub = await metahubRepo.findOne({
                where: { slug, isPublic: true }
            })

            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found or not public' })
            }

            const hub = await hubsService.findByCodename(metahub.id, hubCodename)

            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const catalog: any = await objectsService.findByCodename(metahub.id, catalogCodename)

            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            // Verify catalog is associated with this hub
            const hubs = catalog.config?.hubs || []
            if (!hubs.includes(hub.id)) {
                return res.status(404).json({ error: 'Catalog not found in this hub' })
            }

            const attributes = await attributesService.findAll(metahub.id, catalog.id)

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
            const { metahubRepo, hubsService, objectsService, recordsService } = repos()

            const metahub = await metahubRepo.findOne({
                where: { slug, isPublic: true }
            })

            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found or not public' })
            }

            const hub = await hubsService.findByCodename(metahub.id, hubCodename)

            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const catalog: any = await objectsService.findByCodename(metahub.id, catalogCodename)

            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            // Verify catalog is associated with this hub
            const hubs = catalog.config?.hubs || []
            if (!hubs.includes(hub.id)) {
                return res.status(404).json({ error: 'Catalog not found in this hub' })
            }

            const { items: records, total } = await recordsService.findAllAndCount(metahub.id, catalog.id, {
                limit: Math.min(parseInt(limit as string, 10), 1000),
                offset: parseInt(offset as string, 10),
                sortOrder: 'asc' // Default
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
            const { metahubRepo, hubsService, objectsService, recordsService } = repos()

            const metahub = await metahubRepo.findOne({
                where: { slug, isPublic: true }
            })

            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found or not public' })
            }

            const hub = await hubsService.findByCodename(metahub.id, hubCodename)

            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const catalog: any = await objectsService.findByCodename(metahub.id, catalogCodename)

            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            // Verify catalog is associated with this hub
            const hubs = catalog.config?.hubs || []
            if (!hubs.includes(hub.id)) {
                return res.status(404).json({ error: 'Catalog not found in this hub' })
            }

            const record = await recordsService.findById(metahub.id, catalog.id, recordId)

            if (!record) {
                return res.status(404).json({ error: 'Record not found' })
            }

            res.json(record)
        })
    )

    return router
}
