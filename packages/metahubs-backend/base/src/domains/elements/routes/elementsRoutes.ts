import { Router, Request, Response, RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { validateListQuery } from '../../shared/queryParams'
import { OptimisticLockError } from '@universo/utils'
import { getRequestDbExecutor, getRequestDbSession, type DbExecutor } from '../../../utils'
import { ensureMetahubAccess, createEnsureMetahubRouteAccess } from '../../shared/guards'
import { resolveUserId } from '../../shared/routeAuth'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubElementsService } from '../../metahubs/services/MetahubElementsService'
import { validation } from '@universo/utils'
import { AttributeDataType } from '@universo/types'

const { normalizeElementCopyOptions } = validation

const extractErrorCode = (error: unknown): string | undefined => {
    if (!error || typeof error !== 'object' || !('code' in error)) return undefined
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? code : undefined
}

// Request body schemas
const createElementSchema = z
    .object({
        data: z.record(z.unknown()),
        sortOrder: z.number().int().optional()
    })
    .strict()

const updateElementSchema = z
    .object({
        data: z.record(z.unknown()).optional(),
        sortOrder: z.number().int().optional(),
        expectedVersion: z.number().int().positive().optional() // For optimistic locking
    })
    .strict()

const copyElementSchema = z
    .object({
        copyChildTables: z.boolean().optional()
    })
    .strict()

const moveElementSchema = z
    .object({
        direction: z.enum(['up', 'down'])
    })
    .strict()

const reorderElementSchema = z
    .object({
        elementId: z.string().uuid(),
        newSortOrder: z.number().int().min(1)
    })
    .strict()

export function createElementsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
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
        const exec = getRequestDbExecutor(req, getDbExecutor())
        const schemaService = new MetahubSchemaService(exec)
        const objectsService = new MetahubObjectsService(exec, schemaService)
        const attributesService = new MetahubAttributesService(exec, schemaService)
        const elementsService = new MetahubElementsService(exec, schemaService, objectsService, attributesService)

        return {
            exec,
            elementsService,
            attributesService
        }
    }

    const ensureMetahubRouteAccess = createEnsureMetahubRouteAccess(getDbExecutor)

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
            const userId = await ensureMetahubRouteAccess(req, res, metahubId)
            if (!userId) return

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

            const { items, total } = await elementsService.findAllAndCount(
                metahubId,
                catalogId,
                {
                    limit,
                    offset,
                    sortBy,
                    sortOrder,
                    search
                },
                userId
            )

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
            const userId = await ensureMetahubRouteAccess(req, res, metahubId)
            if (!userId) return

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
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
            if (!userId) return

            const parsed = createElementSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { data, sortOrder } = parsed.data

            try {
                const element = await elementsService.create(
                    metahubId,
                    catalogId,
                    {
                        data,
                        sortOrder,
                        createdBy: userId
                    },
                    userId
                )
                res.status(201).json(element)
            } catch (error: any) {
                const code = extractErrorCode(error)
                if (code === 'CATALOG_NOT_FOUND') {
                    return res.status(404).json({ error: 'Catalog not found' })
                }
                if (code === 'ELEMENT_VALIDATION_FAILED') {
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
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
            if (!userId) return

            const parsed = updateElementSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { data, sortOrder, expectedVersion } = parsed.data

            try {
                const element = await elementsService.update(
                    metahubId,
                    catalogId,
                    elementId,
                    {
                        data,
                        sortOrder,
                        updatedBy: userId,
                        expectedVersion
                    },
                    userId
                )
                res.json(element)
            } catch (error: any) {
                if (error instanceof OptimisticLockError) {
                    throw error // Let middleware handle it
                }
                const code = extractErrorCode(error)
                if (code === 'CATALOG_NOT_FOUND' || code === 'ELEMENT_NOT_FOUND') {
                    return res.status(404).json({ error: error.message })
                }
                if (code === 'ELEMENT_VALIDATION_FAILED') {
                    return res.status(400).json({ error: error.message })
                }
                throw error
            }
        })
    )

    /**
     * PATCH /metahub/:metahubId/hub/:hubId/catalog/:catalogId/element/:elementId/move
     * PATCH /metahub/:metahubId/catalog/:catalogId/element/:elementId/move
     * Move element one step up/down in sort order.
     */
    router.patch(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/element/:elementId/move',
            '/metahub/:metahubId/catalog/:catalogId/element/:elementId/move'
        ],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId, elementId } = req.params
            const { exec, elementsService } = services(req)
            const userId = resolveUserId(req)
            const dbSession = getRequestDbSession(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(exec, userId, metahubId, 'editContent', dbSession)

            const parsed = moveElementSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            try {
                const updated = await elementsService.moveElement(metahubId, catalogId, elementId, parsed.data.direction, userId)
                return res.json(updated)
            } catch (error: any) {
                const code = extractErrorCode(error)
                if (code === 'CATALOG_NOT_FOUND' || code === 'ELEMENT_NOT_FOUND') {
                    return res.status(404).json({ error: error.message })
                }
                throw error
            }
        })
    )

    /**
     * PATCH /metahub/:metahubId/hub/:hubId/catalog/:catalogId/elements/reorder
     * PATCH /metahub/:metahubId/catalog/:catalogId/elements/reorder
     * Reorder a single element to a new sort_order position.
     */
    router.patch(
        ['/metahub/:metahubId/hub/:hubId/catalog/:catalogId/elements/reorder', '/metahub/:metahubId/catalog/:catalogId/elements/reorder'],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
            const { exec, elementsService } = services(req)
            const userId = resolveUserId(req)
            const dbSession = getRequestDbSession(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(exec, userId, metahubId, 'editContent', dbSession)

            const parsed = reorderElementSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { elementId, newSortOrder } = parsed.data

            try {
                const updated = await elementsService.reorderElement(metahubId, catalogId, elementId, newSortOrder, userId)
                return res.json(updated)
            } catch (error: any) {
                const code = extractErrorCode(error)
                if (code === 'CATALOG_NOT_FOUND' || code === 'ELEMENT_NOT_FOUND') {
                    return res.status(404).json({ error: error.message })
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
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'deleteContent')
            if (!userId) return

            try {
                await elementsService.delete(metahubId, catalogId, elementId, userId)
                res.status(204).send()
            } catch (error: any) {
                const code = extractErrorCode(error)
                if (code === 'CATALOG_NOT_FOUND' || code === 'ELEMENT_NOT_FOUND') {
                    return res.status(404).json({ error: error.message })
                }
                throw error
            }
        })
    )

    /**
     * POST /metahub/:metahubId/hub/:hubId/catalog/:catalogId/element/:elementId/copy
     * POST /metahub/:metahubId/catalog/:catalogId/element/:elementId/copy (direct, without hub)
     * Copy an element with optional child TABLE rows.
     */
    router.post(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/element/:elementId/copy',
            '/metahub/:metahubId/catalog/:catalogId/element/:elementId/copy'
        ],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId, elementId } = req.params
            const { elementsService, attributesService } = services(req)
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
            if (!userId) return

            const source = await elementsService.findById(metahubId, catalogId, elementId, userId)
            if (!source) {
                return res.status(404).json({ error: 'Element not found' })
            }

            const parsed = copyElementSchema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const attrs = await attributesService.findAllFlat(metahubId, catalogId, userId)
            const rootTableAttrs = attrs.filter((attr) => !attr.parentAttributeId && attr.dataType === AttributeDataType.TABLE)
            const hasRequiredChildTables = rootTableAttrs.some((attr) => {
                const minRows = typeof attr.validationRules?.minRows === 'number' ? attr.validationRules.minRows : 0
                return Boolean(attr.isRequired) || minRows > 0
            })

            const requestedOptions = normalizeElementCopyOptions({
                copyChildTables: parsed.data.copyChildTables
            })
            const copyOptions = hasRequiredChildTables
                ? {
                      ...requestedOptions,
                      copyChildTables: true
                  }
                : requestedOptions

            const sourceData = source.data && typeof source.data === 'object' ? source.data : {}
            const copiedData: Record<string, unknown> = { ...(sourceData as Record<string, unknown>) }
            if (!copyOptions.copyChildTables) {
                for (const attr of rootTableAttrs) {
                    delete copiedData[attr.codename]
                }
            }

            const copied = await elementsService.create(
                metahubId,
                catalogId,
                {
                    data: copiedData,
                    createdBy: userId
                },
                userId
            )

            return res.status(201).json({
                ...copied,
                copyOptions,
                hasRequiredChildTables
            })
        })
    )

    return router
}
