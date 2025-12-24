import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { Metahub } from '../database/entities/Metahub'
import { Hub } from '../database/entities/Hub'
import { Attribute } from '../database/entities/Attribute'
import { HubRecord } from '../database/entities/Record'

/**
 * Public API routes for accessing published Metahubs
 *
 * These routes do NOT require authentication.
 * Only metahubs with isPublic=true are accessible.
 * All operations are read-only.
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
            attributeRepo: ds.getRepository(Attribute),
            recordRepo: ds.getRepository(HubRecord)
        }
    }

    /**
     * GET /api/public/metahubs/:slug
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
     * GET /api/public/metahubs/:slug/hubs
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
     * GET /api/public/metahubs/:slug/hubs/:hubCodename
     * Get a hub by codename in a public metahub
     */
    router.get(
        '/:slug/hubs/:hubCodename',
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
     * GET /api/public/metahubs/:slug/hubs/:hubCodename/attributes
     * List all attributes of a hub in a public metahub
     */
    router.get(
        '/:slug/hubs/:hubCodename/attributes',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { slug, hubCodename } = req.params
            const { metahubRepo, hubRepo, attributeRepo } = repos()

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

            const attributes = await attributeRepo.find({
                where: { hubId: hub.id },
                order: { sortOrder: 'ASC', createdAt: 'ASC' }
            })

            res.json({ items: attributes, pagination: { total: attributes.length, limit: 100, offset: 0 } })
        })
    )

    /**
     * GET /api/public/metahubs/:slug/hubs/:hubCodename/records
     * List all records in a hub (with pagination)
     */
    router.get(
        '/:slug/hubs/:hubCodename/records',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { slug, hubCodename } = req.params
            const { limit = '100', offset = '0' } = req.query
            const { metahubRepo, hubRepo, recordRepo } = repos()

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

            const [records, total] = await recordRepo.findAndCount({
                where: { hubId: hub.id },
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
     * GET /api/public/metahubs/:slug/hubs/:hubCodename/records/:recordId
     * Get a single record by ID
     */
    router.get(
        '/:slug/hubs/:hubCodename/records/:recordId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { slug, hubCodename, recordId } = req.params
            const { metahubRepo, hubRepo, recordRepo } = repos()

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

            const record = await recordRepo.findOne({
                where: { id: recordId, hubId: hub.id }
            })

            if (!record) {
                return res.status(404).json({ error: 'Record not found' })
            }

            res.json(record)
        })
    )

    return router
}
