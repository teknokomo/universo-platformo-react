import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-backend'
import { Attribute, AttributeDataType } from '../database/entities/Attribute'
import { Hub } from '../database/entities/Hub'
import { z } from 'zod'
import { ListQuerySchema } from '../schemas/queryParams'
import { escapeLikeWildcards } from '../utils'
import { createLocalizedContent, updateLocalizedContentLocale } from '@universo/utils'
import type { VersionedLocalizedContent } from '@universo/types'
import { isValidLocaleCode } from '@universo/types'

/**
 * Get the appropriate manager for the request (RLS-enabled if available)
 */
const getRequestManager = (req: Request, dataSource: DataSource) => {
    const rlsContext = (req as RequestWithDbContext).dbContext
    return rlsContext?.manager ?? dataSource.manager
}

const CODENAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const normalizeCodename = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')

const isValidCodename = (value: string) => CODENAME_PATTERN.test(value)

const sanitizeLocalizedInput = (input: Record<string, string | undefined>) => {
    const sanitized: Record<string, string> = {}
    for (const [locale, value] of Object.entries(input)) {
        if (typeof value !== 'string') continue
        const trimmedValue = value.trim()
        if (!trimmedValue) continue
        const normalized = locale.trim().replace('_', '-')
        const [lang, region] = normalized.split('-')
        const normalizedCode = region ? `${lang.toLowerCase()}-${region.toUpperCase()}` : lang.toLowerCase()
        if (!isValidLocaleCode(normalizedCode)) continue
        sanitized[normalizedCode] = trimmedValue
    }
    return sanitized
}

const AttributesListQuerySchema = ListQuerySchema.extend({
    sortBy: z.enum(['name', 'created', 'updated', 'codename', 'sortOrder']).default('sortOrder'),
    sortOrder: z.enum(['asc', 'desc']).default('asc')
})

const validateAttributesListQuery = (query: unknown) => AttributesListQuerySchema.parse(query)

const buildLocalizedContent = (
    input: Record<string, string>,
    primaryLocale?: string,
    fallbackPrimary?: string
): VersionedLocalizedContent<string> | undefined => {
    const localeCodes = Object.keys(input).sort()
    if (localeCodes.length === 0) return undefined

    const primaryCandidate =
        primaryLocale && input[primaryLocale] ? primaryLocale : fallbackPrimary && input[fallbackPrimary] ? fallbackPrimary : undefined
    const primary = primaryCandidate ?? localeCodes[0]
    let content = createLocalizedContent(primary, input[primary] ?? '')

    for (const locale of localeCodes) {
        if (locale === primary) continue
        const value = input[locale]
        if (typeof value !== 'string') continue
        content = updateLocalizedContentLocale(content, locale, value)
    }

    return content
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

const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))

const createAttributeSchema = z.object({
    codename: z.string().min(1).max(100),
    dataType: z.nativeEnum(AttributeDataType),
    name: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    targetHubId: z.string().uuid().optional(),
    validationRules: validationRulesSchema,
    uiConfig: uiConfigSchema,
    isRequired: z.boolean().optional(),
    sortOrder: z.number().int().optional()
})

const updateAttributeSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    dataType: z.nativeEnum(AttributeDataType).optional(),
    name: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
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

    const ensureSequentialSortOrder = async (hubId: string, attributeRepo: ReturnType<typeof repos>['attributeRepo']) => {
        const attributes = await attributeRepo.find({
            where: { hubId },
            order: { sortOrder: 'ASC', createdAt: 'ASC' }
        })
        const requiresReset = attributes.some((attribute) => !attribute.sortOrder || attribute.sortOrder <= 0)
        if (!requiresReset) return attributes
        attributes.forEach((attribute, index) => {
            attribute.sortOrder = index + 1
        })
        await attributeRepo.save(attributes)
        return attributes
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

            let validatedQuery
            try {
                validatedQuery = validateAttributesListQuery(req.query)
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
                }
                throw error
            }

            const { limit, offset, sortBy, sortOrder, search } = validatedQuery

            let qb = attributeRepo.createQueryBuilder('a').where('a.hubId = :hubId', { hubId })

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

            const { codename, dataType, name, namePrimaryLocale, targetHubId, validationRules, uiConfig, isRequired, sortOrder } =
                parsed.data

            const normalizedCodename = normalizeCodename(codename)
            if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            // Check for duplicate codename
            const existing = await attributeRepo.findOne({ where: { hubId, codename: normalizedCodename } })
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

            const sanitizedName = sanitizeLocalizedInput(name ?? {})
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, namePrimaryLocale ?? 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const existingAttributes = await ensureSequentialSortOrder(hubId, attributeRepo)
            const maxSortOrder = existingAttributes.reduce((max, attribute) => Math.max(max, attribute.sortOrder || 0), 0)
            const resolvedSortOrder = sortOrder ?? maxSortOrder + 1

            const attribute = attributeRepo.create({
                hubId,
                codename: normalizedCodename,
                dataType,
                name: nameVlc,
                targetHubId: dataType === AttributeDataType.REF ? targetHubId : undefined,
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

            const { codename, dataType, name, namePrimaryLocale, targetHubId, validationRules, uiConfig, isRequired, sortOrder } =
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
                    const existing = await attributeRepo.findOne({ where: { hubId, codename: normalizedCodename } })
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
     * PATCH /metahubs/:metahubId/hubs/:hubId/attributes/:attributeId/move
     * Reorder attributes within a hub
     */
    router.patch(
        '/metahubs/:metahubId/hubs/:hubId/attributes/:attributeId/move',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { hubId, attributeId } = req.params
            const manager = getRequestManager(req, getDataSource())

            const parsed = z.object({ direction: z.enum(['up', 'down']) }).safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { direction } = parsed.data

            const result = await manager.transaction(async (transactionalEntityManager) => {
                const attributeRepo = transactionalEntityManager.getRepository(Attribute)
                const attribute = await attributeRepo.findOne({ where: { id: attributeId, hubId } })
                if (!attribute) {
                    return { status: 404, payload: { error: 'Attribute not found' } }
                }

                await ensureSequentialSortOrder(hubId, attributeRepo)

                const refreshedAttribute = await attributeRepo.findOne({ where: { id: attributeId, hubId } })
                if (!refreshedAttribute) {
                    return { status: 404, payload: { error: 'Attribute not found' } }
                }

                const currentOrder = refreshedAttribute.sortOrder

                const neighbor = await attributeRepo
                    .createQueryBuilder('a')
                    .where('a.hubId = :hubId', { hubId })
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
