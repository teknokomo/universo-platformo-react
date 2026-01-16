import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { Attribute } from '../../../database/entities/Attribute'
import { Catalog } from '../../../database/entities/Catalog'
import { z } from 'zod'
import { ListQuerySchema } from '../../shared/queryParams'
import { escapeLikeWildcards, getRequestManager } from '../../../utils'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo/utils/vlc'
import { normalizeCodename, isValidCodename } from '@universo/utils/validation/codename'
import { AttributeDataType, ATTRIBUTE_DATA_TYPES } from '@universo/types'

const AttributesListQuerySchema = ListQuerySchema.extend({
    sortBy: z.enum(['name', 'created', 'updated', 'codename', 'sortOrder']).default('sortOrder'),
    sortOrder: z.enum(['asc', 'desc']).default('asc')
})

const validateAttributesListQuery = (query: unknown) => AttributesListQuerySchema.parse(query)

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

const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))

const createAttributeSchema = z.object({
    codename: z.string().min(1).max(100),
    dataType: z.enum(ATTRIBUTE_DATA_TYPES),
    name: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    targetCatalogId: z.string().uuid().optional(),
    validationRules: validationRulesSchema,
    uiConfig: uiConfigSchema,
    isRequired: z.boolean().optional(),
    sortOrder: z.number().int().optional()
})

const updateAttributeSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    dataType: z.enum(ATTRIBUTE_DATA_TYPES).optional(),
    name: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    targetCatalogId: z.string().uuid().nullable().optional(),
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
            catalogRepo: manager.getRepository(Catalog)
        }
    }

    /**
     * Checks if sortOrder is sequential (1..N) without modifying data.
     * Use this in GET requests to maintain idempotency.
     * @returns true if sortOrder is inconsistent and needs normalization
     */
    const checkSortOrderInconsistency = (attributes: Attribute[]): boolean => {
        return attributes.some((attribute, index) => (attribute.sortOrder ?? 0) !== index + 1)
    }

    /**
     * Ensures sortOrder is a contiguous 1..N sequence (no gaps/duplicates).
     * Only call this in write operations (POST, PATCH, DELETE) to maintain REST idempotency.
     */
    const ensureSequentialSortOrder = async (catalogId: string, attributeRepo: ReturnType<typeof repos>['attributeRepo']) => {
        const attributes = await attributeRepo.find({
            where: { catalogId },
            order: { sortOrder: 'ASC', createdAt: 'ASC' }
        })

        // sortOrder must always be a contiguous 1..N sequence (no gaps/duplicates)
        const requiresReset = checkSortOrderInconsistency(attributes)
        if (!requiresReset) return attributes

        attributes.forEach((attribute, index) => {
            attribute.sortOrder = index + 1
        })
        await attributeRepo.save(attributes)
        return attributes
    }

    /**
     * GET /metahub/:metahubId/hub/:hubId/catalog/:catalogId/attributes
     * GET /metahub/:metahubId/catalog/:catalogId/attributes
     * List all attributes in a catalog
     * Note: hubId is optional - attributes belong to catalog directly
     */
    router.get(
        ['/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attributes', '/metahub/:metahubId/catalog/:catalogId/attributes'],
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { catalogId } = req.params
            const { attributeRepo } = repos(req)

            let validatedQuery
            try {
                validatedQuery = validateAttributesListQuery(req.query)
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
                }
                throw error
            }

            // Check for sortOrder inconsistency (read-only, no side-effects per REST principles).
            // Normalization is performed on write operations (POST, PATCH, DELETE).
            const allAttributes = await attributeRepo.find({
                where: { catalogId },
                order: { sortOrder: 'ASC', createdAt: 'ASC' }
            })
            if (checkSortOrderInconsistency(allAttributes)) {
                console.warn(
                    `[attributesRoutes] Sort order inconsistency detected for catalog ${catalogId}. Will normalize on next write operation.`
                )
            }

            const { limit, offset, sortBy, sortOrder, search } = validatedQuery

            let qb = attributeRepo.createQueryBuilder('a').where('a.catalogId = :catalogId', { catalogId })

            if (search) {
                const escapedSearch = escapeLikeWildcards(search)
                qb = qb.andWhere('(a.name::text ILIKE :search OR a.codename ILIKE :search)', { search: `%${escapedSearch}%` })
            }

            const orderColumn =
                sortBy === 'sortOrder'
                    ? 'a.sortOrder'
                    : sortBy === 'codename'
                    ? 'a.codename'
                    : sortBy === 'name'
                    ? "COALESCE(a.name->>(a.name->>'_primary'), a.name->>'en', '')"
                    : sortBy === 'created'
                    ? 'a.created_at'
                    : 'a.updated_at'
            qb = qb
                .orderBy(orderColumn, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')
                .skip(offset)
                .take(limit)

            const [attributes, total] = await qb.getManyAndCount()

            res.json({ items: attributes, pagination: { total, limit, offset } })
        })
    )

    /**
     * GET /metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId
     * GET /metahub/:metahubId/catalog/:catalogId/attribute/:attributeId
     * Get a single attribute
     */
    router.get(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId'
        ],
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { catalogId, attributeId } = req.params
            const { attributeRepo } = repos(req)

            const attribute = await attributeRepo.findOne({
                where: { id: attributeId, catalogId }
            })

            if (!attribute) {
                return res.status(404).json({ error: 'Attribute not found' })
            }

            res.json(attribute)
        })
    )

    /**
     * POST /metahub/:metahubId/hub/:hubId/catalog/:catalogId/attributes
     * POST /metahub/:metahubId/catalog/:catalogId/attributes
     * Create a new attribute
     */
    router.post(
        ['/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attributes', '/metahub/:metahubId/catalog/:catalogId/attributes'],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { catalogId } = req.params
            const { attributeRepo, catalogRepo } = repos(req)

            // Verify catalog exists
            const catalog = await catalogRepo.findOne({ where: { id: catalogId } })
            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            const parsed = createAttributeSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, dataType, name, namePrimaryLocale, targetCatalogId, validationRules, uiConfig, isRequired, sortOrder } =
                parsed.data

            const normalizedCodename = normalizeCodename(codename)
            if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            // Check for duplicate codename
            const existing = await attributeRepo.findOne({ where: { catalogId, codename: normalizedCodename } })
            if (existing) {
                return res.status(409).json({ error: 'Attribute with this codename already exists' })
            }

            // For REF type, verify target catalog exists
            if (dataType === AttributeDataType.REF && targetCatalogId) {
                const targetCatalog = await catalogRepo.findOne({ where: { id: targetCatalogId } })
                if (!targetCatalog) {
                    return res.status(400).json({ error: 'Target catalog not found' })
                }
            }

            const sanitizedName = sanitizeLocalizedInput(name ?? {})
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, namePrimaryLocale ?? 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const existingAttributes = await ensureSequentialSortOrder(catalogId, attributeRepo)
            const maxSortOrder = existingAttributes.reduce((max, attribute) => Math.max(max, attribute.sortOrder || 0), 0)
            const resolvedSortOrder = sortOrder ?? maxSortOrder + 1

            const attribute = attributeRepo.create({
                catalogId,
                codename: normalizedCodename,
                dataType,
                name: nameVlc,
                targetCatalogId: dataType === AttributeDataType.REF ? targetCatalogId : undefined,
                validationRules: validationRules ?? {},
                uiConfig: uiConfig ?? {},
                isRequired: isRequired ?? false,
                sortOrder: resolvedSortOrder
            })

            const saved = await attributeRepo.save(attribute)
            res.status(201).json(saved)
        })
    )

    /**
     * PATCH /metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId
     * PATCH /metahub/:metahubId/catalog/:catalogId/attribute/:attributeId
     * Update an attribute
     */
    router.patch(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId'
        ],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { catalogId, attributeId } = req.params
            const { attributeRepo, catalogRepo } = repos(req)

            const attribute = await attributeRepo.findOne({ where: { id: attributeId, catalogId } })
            if (!attribute) {
                return res.status(404).json({ error: 'Attribute not found' })
            }

            const parsed = updateAttributeSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, dataType, name, namePrimaryLocale, targetCatalogId, validationRules, uiConfig, isRequired, sortOrder } =
                parsed.data

            if (codename && codename !== attribute.codename) {
                const normalizedCodename = normalizeCodename(codename)
                if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                    })
                }
                if (normalizedCodename !== attribute.codename) {
                    const existing = await attributeRepo.findOne({ where: { catalogId, codename: normalizedCodename } })
                    if (existing) {
                        return res.status(409).json({ error: 'Attribute with this codename already exists' })
                    }
                    attribute.codename = normalizedCodename
                }
            }

            if (dataType) {
                attribute.dataType = dataType
            }

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? attribute.name?._primary ?? 'en'
                const nameVlc = buildLocalizedContent(sanitizedName, primary, primary)
                if (nameVlc) {
                    attribute.name = nameVlc
                }
            }

            if (targetCatalogId !== undefined) {
                if (targetCatalogId === null) {
                    attribute.targetCatalogId = undefined
                } else if (attribute.dataType === AttributeDataType.REF) {
                    const targetCatalog = await catalogRepo.findOne({ where: { id: targetCatalogId } })
                    if (!targetCatalog) {
                        return res.status(400).json({ error: 'Target catalog not found' })
                    }
                    attribute.targetCatalogId = targetCatalogId
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
     * PATCH /metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/move
     * PATCH /metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/move
     * Reorder attributes within a catalog
     */
    router.patch(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/move',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/move'
        ],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { catalogId, attributeId } = req.params
            const manager = getRequestManager(req, getDataSource())

            const parsed = z.object({ direction: z.enum(['up', 'down']) }).safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { direction } = parsed.data

            const result = await manager.transaction(async (transactionalEntityManager) => {
                const attributeRepo = transactionalEntityManager.getRepository(Attribute)
                const attribute = await attributeRepo.findOne({ where: { id: attributeId, catalogId } })
                if (!attribute) {
                    return { status: 404, payload: { error: 'Attribute not found' } }
                }

                await ensureSequentialSortOrder(catalogId, attributeRepo)

                const refreshedAttribute = await attributeRepo.findOne({ where: { id: attributeId, catalogId } })
                if (!refreshedAttribute) {
                    return { status: 404, payload: { error: 'Attribute not found' } }
                }

                const currentOrder = refreshedAttribute.sortOrder

                const neighbor = await attributeRepo
                    .createQueryBuilder('a')
                    .where('a.catalogId = :catalogId', { catalogId })
                    .andWhere(direction === 'up' ? 'a.sortOrder < :currentOrder' : 'a.sortOrder > :currentOrder', {
                        currentOrder
                    })
                    .orderBy('a.sortOrder', direction === 'up' ? 'DESC' : 'ASC')
                    .addOrderBy('a.created_at', direction === 'up' ? 'DESC' : 'ASC')
                    .getOne()

                if (!neighbor) {
                    return { status: 200, payload: refreshedAttribute }
                }

                refreshedAttribute.sortOrder = neighbor.sortOrder
                neighbor.sortOrder = currentOrder

                await attributeRepo.save([refreshedAttribute, neighbor])
                return { status: 200, payload: refreshedAttribute }
            })

            return res.status(result.status).json(result.payload)
        })
    )

    /**
     * DELETE /metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId
     * DELETE /metahub/:metahubId/catalog/:catalogId/attribute/:attributeId
     * Delete an attribute
     */
    router.delete(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId'
        ],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { catalogId, attributeId } = req.params

            const manager = getRequestManager(req, getDataSource())
            const result = await manager.transaction(async (transactionalEntityManager) => {
                const attributeRepo = transactionalEntityManager.getRepository(Attribute)

                const attribute = await attributeRepo.findOne({ where: { id: attributeId, catalogId } })
                if (!attribute) {
                    return { status: 404 as const, payload: { error: 'Attribute not found' } }
                }

                // Normalize before and after delete to guarantee contiguous 1..N sortOrder sequence.
                await ensureSequentialSortOrder(catalogId, attributeRepo)
                const refreshedAttribute = await attributeRepo.findOne({ where: { id: attributeId, catalogId } })
                if (!refreshedAttribute) {
                    return { status: 404 as const, payload: { error: 'Attribute not found' } }
                }

                await attributeRepo.remove(refreshedAttribute)
                await ensureSequentialSortOrder(catalogId, attributeRepo)

                return { status: 204 as const, payload: null }
            })

            if (result.status === 204) {
                return res.status(204).send()
            }

            return res.status(result.status).json(result.payload)
        })
    )

    return router
}
