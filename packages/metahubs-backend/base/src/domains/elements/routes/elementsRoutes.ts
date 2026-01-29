import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { validateListQuery } from '../../shared/queryParams'
import { OptimisticLockError } from '@universo/utils'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubElementsService } from '../../metahubs/services/MetahubElementsService'

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

// Request body schemas
const createElementSchema = z.object({
    data: z.record(z.unknown()),
    sortOrder: z.number().int().optional()
})

const updateElementSchema = z.object({
    data: z.record(z.unknown()).optional(),
    sortOrder: z.number().int().optional(),
    expectedVersion: z.number().int().positive().optional() // For optimistic locking
})

export function createElementsRoutes(
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

    const services = (req: Request) => {
        const schemaService = new MetahubSchemaService(getDataSource())
        const objectsService = new MetahubObjectsService(schemaService)
        const attributesService = new MetahubAttributesService(schemaService)
        const elementsService = new MetahubElementsService(schemaService, objectsService, attributesService)

        return {
            elementsService
        }
    }

    /**
     * GET /metahub/:metahubId/hub/:hubId/catalog/:catalogId/elements
     * GET /metahub/:metahubId/catalog/:catalogId/elements (direct, without hub)
     * List all elements in a catalog with optional filtering
     */
    router.get(
        ['/metahub/:metahubId/hub/:hubId/catalog/:catalogId/elements', '/metahub/:metahubId/catalog/:catalogId/elements'],
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
            const { elementsService } = services(req)
            const userId = resolveUserId(req)

            let validatedQuery
            try {
                validatedQuery = validateListQuery(req.query)
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
                }
                throw error
            }

            const { limit, offset, sortBy, sortOrder, search } = validatedQuery

            const { items, total } = await elementsService.findAllAndCount(metahubId, catalogId, {
                limit,
                offset,
                sortBy,
                sortOrder,
                search
            }, userId)

            res.json({
                items,
                pagination: {
                    total,
                    limit,
                    offset
                }
            })
        })
    )

    /**
     * GET /metahub/:metahubId/hub/:hubId/catalog/:catalogId/element/:elementId
     * GET /metahub/:metahubId/catalog/:catalogId/element/:elementId (direct, without hub)
     * Get a single element
     */
    router.get(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/element/:elementId',
            '/metahub/:metahubId/catalog/:catalogId/element/:elementId'
        ],
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId, elementId } = req.params
            const { elementsService } = services(req)
            const userId = resolveUserId(req)

            const element = await elementsService.findById(metahubId, catalogId, elementId, userId)

            if (!element) {
                return res.status(404).json({ error: 'Element not found' })
            }

            res.json(element)
        })
    )

    /**
     * POST /metahub/:metahubId/hub/:hubId/catalog/:catalogId/elements
     * POST /metahub/:metahubId/catalog/:catalogId/elements (direct, without hub)
     * Create a new element with JSONB data validation
     */
    router.post(
        ['/metahub/:metahubId/hub/:hubId/catalog/:catalogId/elements', '/metahub/:metahubId/catalog/:catalogId/elements'],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
            const { elementsService } = services(req)
            const userId = resolveUserId(req)

            const parsed = createElementSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { data, sortOrder } = parsed.data

            try {
                const element = await elementsService.create(metahubId, catalogId, {
                    data,
                    sortOrder,
                    createdBy: userId
                }, userId)
                res.status(201).json(element)
            } catch (error: any) {
                if (error.message.includes('Catalog not found')) {
                    return res.status(404).json({ error: 'Catalog not found' })
                }
                if (error.message.includes('Validation failed')) {
                    return res.status(400).json({ error: error.message })
                }
                throw error
            }
        })
    )

    /**
     * PATCH /metahub/:metahubId/hub/:hubId/catalog/:catalogId/element/:elementId
     * PATCH /metahub/:metahubId/catalog/:catalogId/element/:elementId (direct, without hub)
     * Update an element
     */
    router.patch(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/element/:elementId',
            '/metahub/:metahubId/catalog/:catalogId/element/:elementId'
        ],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId, elementId } = req.params
            const { elementsService } = services(req)
            const userId = resolveUserId(req)

            const parsed = updateElementSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { data, sortOrder, expectedVersion } = parsed.data

            try {
                const element = await elementsService.update(metahubId, catalogId, elementId, {
                    data,
                    sortOrder,
                    updatedBy: userId,
                    expectedVersion
                }, userId)
                res.json(element)
            } catch (error: any) {
                if (error instanceof OptimisticLockError) {
                    const conflict = error.conflict
                    // Fetch email for the user who last updated
                    let updatedByEmail: string | null = null
                    if (conflict.updatedBy) {
                        try {
                            const ds = getDataSource()
                            const authUserResult = await ds.query(
                                'SELECT email FROM auth.users WHERE id = $1',
                                [conflict.updatedBy]
                            )
                            if (authUserResult?.[0]?.email) {
                                updatedByEmail = authUserResult[0].email
                            }
                        } catch {
                            // Ignore errors fetching email
                        }
                    }
                    return res.status(409).json({
                        error: 'Conflict: entity was modified by another user',
                        code: error.code,
                        conflict: { ...conflict, updatedByEmail }
                    })
                }
                if (error.message.includes('Catalog not found') || error.message.includes('Element not found')) {
                    return res.status(404).json({ error: error.message })
                }
                if (error.message.includes('Validation failed')) {
                    return res.status(400).json({ error: error.message })
                }
                throw error
            }
        })
    )

    /**
     * DELETE /metahub/:metahubId/hub/:hubId/catalog/:catalogId/element/:elementId
     * DELETE /metahub/:metahubId/catalog/:catalogId/element/:elementId (direct, without hub)
     * Delete an element
     */
    router.delete(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/element/:elementId',
            '/metahub/:metahubId/catalog/:catalogId/element/:elementId'
        ],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId, elementId } = req.params
            const { elementsService } = services(req)
            const userId = resolveUserId(req)

            try {
                await elementsService.delete(metahubId, catalogId, elementId, userId)
                res.status(204).send()
            } catch (error: any) {
                if (error.message.includes('Catalog not found') || error.message.includes('Element not found')) {
                    return res.status(404).json({ error: error.message })
                }
                throw error
            }
        })
    )

    return router
}
