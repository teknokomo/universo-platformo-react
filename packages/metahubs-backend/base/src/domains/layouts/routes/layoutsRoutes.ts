import { Router, Request, Response, RequestHandler } from 'express'
import type { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { Metahub } from '../../../database/entities/Metahub'
import { ensureMetahubAccess } from '../../shared/guards'
import { getRequestManager } from '../../../utils'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubLayoutsService, createLayoutSchema, updateLayoutSchema } from '../services/MetahubLayoutsService'
import { OptimisticLockError } from '@universo/utils'

const getRequestQueryRunner = (req: Request) => {
    return (req as any).dbContext?.queryRunner
}

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

export function createLayoutsRoutes(
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

    const listQuerySchema = z.object({
        limit: z.coerce.number().int().positive().max(100).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        sortBy: z.enum(['name', 'created', 'updated']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        search: z.string().optional()
    })

    router.get(
        '/metahub/:metahubId/layouts',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, undefined, rlsRunner)

            const parsed = listQuerySchema.safeParse(req.query)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
            }

            const schemaService = new MetahubSchemaService(ds)
            const layoutsService = new MetahubLayoutsService(schemaService)
            const result = await layoutsService.listLayouts(
                metahubId,
                {
                    limit: parsed.data.limit,
                    offset: parsed.data.offset,
                    sortBy: parsed.data.sortBy,
                    sortOrder: parsed.data.sortOrder,
                    search: parsed.data.search
                },
                userId
            )

            return res.json(result)
        })
    )

    router.post(
        '/metahub/:metahubId/layouts',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, 'manageMetahub', rlsRunner)

            const parsed = createLayoutSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const schemaService = new MetahubSchemaService(ds)
            const layoutsService = new MetahubLayoutsService(schemaService)
            const created = await layoutsService.createLayout(metahubId, parsed.data, userId)
            return res.status(201).json(created)
        })
    )

    router.get(
        '/metahub/:metahubId/layout/:layoutId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, layoutId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, undefined, rlsRunner)

            const schemaService = new MetahubSchemaService(ds)
            const layoutsService = new MetahubLayoutsService(schemaService)
            const layout = await layoutsService.getLayoutById(metahubId, layoutId, userId)
            if (!layout) return res.status(404).json({ error: 'Layout not found' })
            return res.json(layout)
        })
    )

    router.patch(
        '/metahub/:metahubId/layout/:layoutId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, layoutId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, 'manageMetahub', rlsRunner)

            const parsed = updateLayoutSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const schemaService = new MetahubSchemaService(ds)
            const layoutsService = new MetahubLayoutsService(schemaService)
            try {
                const updated = await layoutsService.updateLayout(metahubId, layoutId, parsed.data, userId)
                return res.json(updated)
            } catch (error: unknown) {
                if (error instanceof OptimisticLockError) {
                    return res.status(409).json({ error: error.message, code: error.code, conflict: error.conflict })
                }
                throw error
            }
        })
    )

    router.delete(
        '/metahub/:metahubId/layout/:layoutId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, layoutId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, 'manageMetahub', rlsRunner)

            const schemaService = new MetahubSchemaService(ds)
            const layoutsService = new MetahubLayoutsService(schemaService)
            await layoutsService.deleteLayout(metahubId, layoutId, userId)
            return res.status(204).send()
        })
    )

    return router
}

