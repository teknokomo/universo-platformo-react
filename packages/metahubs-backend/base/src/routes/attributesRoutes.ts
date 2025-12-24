import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-backend'
import { Attribute, AttributeDataType } from '../database/entities/Attribute'
import { Hub } from '../database/entities/Hub'
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
const validationRulesSchema = z
    .object({
        required: z.boolean().optional(),
        minLength: z.number().int().optional(),
        maxLength: z.number().int().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        pattern: z.string().optional(),
        options: z.array(z.string()).optional()
    })
    .optional()

const uiConfigSchema = z
    .object({
        widget: z.enum(['text', 'textarea', 'number', 'select', 'checkbox', 'date', 'datetime', 'reference']).optional(),
        placeholder: z.record(z.string()).optional(),
        helpText: z.record(z.string()).optional(),
        hidden: z.boolean().optional(),
        width: z.number().optional()
    })
    .optional()

const createAttributeSchema = z.object({
    codename: z.string().min(1).max(100),
    dataType: z.nativeEnum(AttributeDataType),
    name: z
        .object({
            en: z.string().optional(),
            ru: z.string().optional()
        })
        .optional(),
    targetHubId: z.string().uuid().optional(),
    validationRules: validationRulesSchema,
    uiConfig: uiConfigSchema,
    isRequired: z.boolean().optional(),
    sortOrder: z.number().int().optional()
})

const updateAttributeSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    dataType: z.nativeEnum(AttributeDataType).optional(),
    name: z
        .object({
            en: z.string().optional(),
            ru: z.string().optional()
        })
        .optional(),
    targetHubId: z.string().uuid().nullable().optional(),
    validationRules: validationRulesSchema,
    uiConfig: uiConfigSchema,
    isRequired: z.boolean().optional(),
    sortOrder: z.number().int().optional()
})

export function createAttributesRoutes(
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
            attributeRepo: manager.getRepository(Attribute),
            hubRepo: manager.getRepository(Hub)
        }
    }

    /**
     * GET /metahubs/:metahubId/hubs/:hubId/attributes
     * List all attributes in a hub
     */
    router.get(
        '/metahubs/:metahubId/hubs/:hubId/attributes',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { hubId } = req.params
            const { attributeRepo } = repos(req)

            const attributes = await attributeRepo.find({
                where: { hubId },
                order: { sortOrder: 'ASC', createdAt: 'ASC' }
            })

            res.json({ items: attributes, pagination: { total: attributes.length, limit: 100, offset: 0 } })
        })
    )

    /**
     * GET /metahubs/:metahubId/hubs/:hubId/attributes/:attributeId
     * Get a single attribute
     */
    router.get(
        '/metahubs/:metahubId/hubs/:hubId/attributes/:attributeId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { hubId, attributeId } = req.params
            const { attributeRepo } = repos(req)

            const attribute = await attributeRepo.findOne({
                where: { id: attributeId, hubId }
            })

            if (!attribute) {
                return res.status(404).json({ error: 'Attribute not found' })
            }

            res.json(attribute)
        })
    )

    /**
     * POST /metahubs/:metahubId/hubs/:hubId/attributes
     * Create a new attribute
     */
    router.post(
        '/metahubs/:metahubId/hubs/:hubId/attributes',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { hubId } = req.params
            const { attributeRepo, hubRepo } = repos(req)

            // Verify hub exists
            const hub = await hubRepo.findOne({ where: { id: hubId } })
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const parsed = createAttributeSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, dataType, name, targetHubId, validationRules, uiConfig, isRequired, sortOrder } = parsed.data

            // Check for duplicate codename
            const existing = await attributeRepo.findOne({ where: { hubId, codename } })
            if (existing) {
                return res.status(409).json({ error: 'Attribute with this codename already exists' })
            }

            // For REF type, verify target hub exists
            if (dataType === AttributeDataType.REF && targetHubId) {
                const targetHub = await hubRepo.findOne({ where: { id: targetHubId } })
                if (!targetHub) {
                    return res.status(400).json({ error: 'Target hub not found' })
                }
            }

            const attribute = attributeRepo.create({
                hubId,
                codename,
                dataType,
                name: name?.en ? createLocalizedContent('en', name.en) : createLocalizedContent('en', codename),
                targetHubId: dataType === AttributeDataType.REF ? targetHubId : undefined,
                validationRules: validationRules ?? {},
                uiConfig: uiConfig ?? {},
                isRequired: isRequired ?? false,
                sortOrder: sortOrder ?? 0
            })

            // Add Russian locale if provided
            if (name?.ru) {
                attribute.name = updateLocalizedContentLocale(attribute.name, 'ru', name.ru)
            }

            const saved = await attributeRepo.save(attribute)
            res.status(201).json(saved)
        })
    )

    /**
     * PATCH /metahubs/:metahubId/hubs/:hubId/attributes/:attributeId
     * Update an attribute
     */
    router.patch(
        '/metahubs/:metahubId/hubs/:hubId/attributes/:attributeId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { hubId, attributeId } = req.params
            const { attributeRepo, hubRepo } = repos(req)

            const attribute = await attributeRepo.findOne({ where: { id: attributeId, hubId } })
            if (!attribute) {
                return res.status(404).json({ error: 'Attribute not found' })
            }

            const parsed = updateAttributeSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, dataType, name, targetHubId, validationRules, uiConfig, isRequired, sortOrder } = parsed.data

            if (codename && codename !== attribute.codename) {
                const existing = await attributeRepo.findOne({ where: { hubId, codename } })
                if (existing) {
                    return res.status(409).json({ error: 'Attribute with this codename already exists' })
                }
                attribute.codename = codename
            }

            if (dataType) {
                attribute.dataType = dataType
            }

            if (name) {
                attribute.name = createLocalizedContent('en', name.en || attribute.codename)
                if (name.ru) {
                    attribute.name = updateLocalizedContentLocale(attribute.name, 'ru', name.ru)
                }
            }

            if (targetHubId !== undefined) {
                if (targetHubId === null) {
                    attribute.targetHubId = undefined
                } else if (attribute.dataType === AttributeDataType.REF) {
                    const targetHub = await hubRepo.findOne({ where: { id: targetHubId } })
                    if (!targetHub) {
                        return res.status(400).json({ error: 'Target hub not found' })
                    }
                    attribute.targetHubId = targetHubId
                }
            }

            if (validationRules) {
                attribute.validationRules = validationRules
            }

            if (uiConfig) {
                attribute.uiConfig = uiConfig
            }

            if (isRequired !== undefined) {
                attribute.isRequired = isRequired
            }

            if (sortOrder !== undefined) {
                attribute.sortOrder = sortOrder
            }

            const saved = await attributeRepo.save(attribute)
            res.json(saved)
        })
    )

    /**
     * DELETE /metahubs/:metahubId/hubs/:hubId/attributes/:attributeId
     * Delete an attribute
     */
    router.delete(
        '/metahubs/:metahubId/hubs/:hubId/attributes/:attributeId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { hubId, attributeId } = req.params
            const { attributeRepo } = repos(req)

            const attribute = await attributeRepo.findOne({ where: { id: attributeId, hubId } })
            if (!attribute) {
                return res.status(404).json({ error: 'Attribute not found' })
            }

            await attributeRepo.remove(attribute)
            res.status(204).send()
        })
    )

    return router
}
