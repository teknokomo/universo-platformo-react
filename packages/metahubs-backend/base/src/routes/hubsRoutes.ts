import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-backend'
import { Hub } from '../database/entities/Hub'
import { Metahub } from '../database/entities/Metahub'
import { z } from 'zod'
import { createLocalizedContent, updateLocalizedContentLocale } from '@universo/utils'

/**
 * Get the appropriate manager for the request (RLS-enabled if available)
 */
const getRequestManager = (req: Request, dataSource: DataSource) => {
    const rlsContext = (req as RequestWithDbContext).dbContext
    return rlsContext?.manager ?? dataSource.manager
}

// Validation schemas
const createHubSchema = z.object({
    codename: z.string().min(1).max(100),
    name: z
        .object({
            en: z.string().optional(),
            ru: z.string().optional()
        })
        .optional(),
    description: z
        .object({
            en: z.string().optional(),
            ru: z.string().optional()
        })
        .optional(),
    sortOrder: z.number().int().optional()
})

const updateHubSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    name: z
        .object({
            en: z.string().optional(),
            ru: z.string().optional()
        })
        .optional(),
    description: z
        .object({
            en: z.string().optional(),
            ru: z.string().optional()
        })
        .optional(),
    sortOrder: z.number().int().optional()
})

export function createHubsRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const repos = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return {
            hubRepo: manager.getRepository(Hub),
            metahubRepo: manager.getRepository(Metahub)
        }
    }

    /**
     * GET /metahubs/:metahubId/hubs
     * List all hubs in a metahub
     */
    router.get(
        '/metahubs/:metahubId/hubs',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const { hubRepo } = repos(req)

            const hubs = await hubRepo.find({
                where: { metahubId },
                order: { sortOrder: 'ASC', createdAt: 'ASC' }
            })

            res.json({ items: hubs, pagination: { total: hubs.length, limit: 100, offset: 0 } })
        })
    )

    /**
     * GET /metahubs/:metahubId/hubs/:hubId
     * Get a single hub
     */
    router.get(
        '/metahubs/:metahubId/hubs/:hubId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { hubRepo } = repos(req)

            const hub = await hubRepo.findOne({
                where: { id: hubId, metahubId }
            })

            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            res.json(hub)
        })
    )

    /**
     * POST /metahubs/:metahubId/hubs
     * Create a new hub
     */
    router.post(
        '/metahubs/:metahubId/hubs',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const { hubRepo, metahubRepo } = repos(req)

            // Verify metahub exists
            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const parsed = createHubSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, sortOrder } = parsed.data

            // Check for duplicate codename
            const existing = await hubRepo.findOne({ where: { metahubId, codename } })
            if (existing) {
                return res.status(409).json({ error: 'Hub with this codename already exists' })
            }

            const hub = hubRepo.create({
                metahubId,
                codename,
                name: name?.en ? createLocalizedContent('en', name.en) : createLocalizedContent('en', codename),
                description: description?.en ? createLocalizedContent('en', description.en) : undefined,
                sortOrder: sortOrder ?? 0
            })

            // Add Russian locale if provided
            if (name?.ru && hub.name) {
                hub.name = updateLocalizedContentLocale(hub.name, 'ru', name.ru)
            }
            if (description?.ru && hub.description) {
                hub.description = updateLocalizedContentLocale(hub.description, 'ru', description.ru)
            }

            const saved = await hubRepo.save(hub)
            res.status(201).json(saved)
        })
    )

    /**
     * PATCH /metahubs/:metahubId/hubs/:hubId
     * Update a hub
     */
    router.patch(
        '/metahubs/:metahubId/hubs/:hubId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { hubRepo } = repos(req)

            const hub = await hubRepo.findOne({ where: { id: hubId, metahubId } })
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const parsed = updateHubSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, sortOrder } = parsed.data

            if (codename && codename !== hub.codename) {
                const existing = await hubRepo.findOne({ where: { metahubId, codename } })
                if (existing) {
                    return res.status(409).json({ error: 'Hub with this codename already exists' })
                }
                hub.codename = codename
            }

            if (name) {
                hub.name = createLocalizedContent('en', name.en || hub.codename)
                if (name.ru) {
                    hub.name = updateLocalizedContentLocale(hub.name, 'ru', name.ru)
                }
            }

            if (description) {
                hub.description = createLocalizedContent('en', description.en || '')
                if (description.ru) {
                    hub.description = updateLocalizedContentLocale(hub.description, 'ru', description.ru)
                }
            }

            if (sortOrder !== undefined) {
                hub.sortOrder = sortOrder
            }

            const saved = await hubRepo.save(hub)
            res.json(saved)
        })
    )

    /**
     * DELETE /metahubs/:metahubId/hubs/:hubId
     * Delete a hub
     */
    router.delete(
        '/metahubs/:metahubId/hubs/:hubId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { hubRepo } = repos(req)

            const hub = await hubRepo.findOne({ where: { id: hubId, metahubId } })
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            await hubRepo.remove(hub)
            res.status(204).send()
        })
    )

    return router
}
