import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { validateListQuery } from '../../shared/queryParams'
import { getRequestManager } from '../../../utils'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubRecordsService } from '../../metahubs/services/MetahubRecordsService'

// Request body schemas
const createRecordSchema = z.object({
    data: z.record(z.unknown()),
    sortOrder: z.number().int().optional()
})

const updateRecordSchema = z.object({
    data: z.record(z.unknown()).optional(),
    sortOrder: z.number().int().optional()
})

const resolveUserId = (req: Request): string | undefined => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

export function createRecordsRoutes(
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
        const recordsService = new MetahubRecordsService(schemaService, objectsService, attributesService)

        return {
            recordsService
        }
    }

    /**
     * GET /metahub/:metahubId/hub/:hubId/catalog/:catalogId/records
     * GET /metahub/:metahubId/catalog/:catalogId/records (direct, without hub)
     * List all records in a catalog with optional filtering
     */
    router.get(
        ['/metahub/:metahubId/hub/:hubId/catalog/:catalogId/records', '/metahub/:metahubId/catalog/:catalogId/records'],
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
            const { recordsService } = services(req)

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

            const { items, total } = await recordsService.findAllAndCount(metahubId, catalogId, {
                limit,
                offset,
                sortBy,
                sortOrder,
                search
            })

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
     * GET /metahub/:metahubId/hub/:hubId/catalog/:catalogId/record/:recordId
     * GET /metahub/:metahubId/catalog/:catalogId/record/:recordId (direct, without hub)
     * Get a single record
     */
    router.get(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/record/:recordId',
            '/metahub/:metahubId/catalog/:catalogId/record/:recordId'
        ],
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId, recordId } = req.params
            const { recordsService } = services(req)

            const record = await recordsService.findById(metahubId, catalogId, recordId)

            if (!record) {
                return res.status(404).json({ error: 'Record not found' })
            }

            res.json(record)
        })
    )

    /**
     * POST /metahub/:metahubId/hub/:hubId/catalog/:catalogId/records
     * POST /metahub/:metahubId/catalog/:catalogId/records (direct, without hub)
     * Create a new record with JSONB data validation
     */
    router.post(
        ['/metahub/:metahubId/hub/:hubId/catalog/:catalogId/records', '/metahub/:metahubId/catalog/:catalogId/records'],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
            const { recordsService } = services(req)

            const parsed = createRecordSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { data, sortOrder } = parsed.data

            try {
                const record = await recordsService.create(metahubId, catalogId, {
                    data,
                    sortOrder
                })
                res.status(201).json(record)
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
     * PATCH /metahub/:metahubId/hub/:hubId/catalog/:catalogId/record/:recordId
     * PATCH /metahub/:metahubId/catalog/:catalogId/record/:recordId (direct, without hub)
     * Update a record
     */
    router.patch(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/record/:recordId',
            '/metahub/:metahubId/catalog/:catalogId/record/:recordId'
        ],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId, recordId } = req.params
            const { recordsService } = services(req)

            const parsed = updateRecordSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { data, sortOrder } = parsed.data

            try {
                const record = await recordsService.update(metahubId, catalogId, recordId, {
                    data,
                    sortOrder
                })
                res.json(record)
            } catch (error: any) {
                if (error.message.includes('Catalog not found') || error.message.includes('Record not found')) {
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
     * DELETE /metahub/:metahubId/hub/:hubId/catalog/:catalogId/record/:recordId
     * DELETE /metahub/:metahubId/catalog/:catalogId/record/:recordId (direct, without hub)
     * Delete a record
     */
    router.delete(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/record/:recordId',
            '/metahub/:metahubId/catalog/:catalogId/record/:recordId'
        ],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId, recordId } = req.params
            const { recordsService } = services(req)

            try {
                await recordsService.delete(metahubId, catalogId, recordId)
                res.status(204).send()
            } catch (error: any) {
                if (error.message.includes('Catalog not found') || error.message.includes('Record not found')) {
                    return res.status(404).json({ error: error.message })
                }
                throw error
            }
        })
    )

    return router
}
