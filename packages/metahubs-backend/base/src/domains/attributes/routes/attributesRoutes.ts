import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { ListQuerySchema } from '../../shared/queryParams'
import { escapeLikeWildcards, getRequestManager } from '../../../utils'
import { localizedContent, validation } from '@universo/utils'
const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
const { normalizeCodename, isValidCodename } = validation
import { AttributeDataType, ATTRIBUTE_DATA_TYPES, MetaEntityKind, META_ENTITY_KINDS } from '@universo/types'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { syncMetahubSchema } from '../../metahubs/services/schemaSync'

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

const AttributesListQuerySchema = ListQuerySchema.extend({
    sortBy: z.enum(['name', 'created', 'updated', 'codename', 'sortOrder']).default('sortOrder'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    locale: z.string().trim().min(2).max(10).optional()
})

const validateAttributesListQuery = (query: unknown) => AttributesListQuerySchema.parse(query)

// Validation schemas
// Note: Fields use .nullable() to accept null values from frontend (e.g., cleared inputs)
const validationRulesSchema = z
    .object({
        required: z.boolean().nullable().optional(),
        // STRING settings
        minLength: z.number().int().min(0).max(10000).nullable().optional(),
        maxLength: z.number().int().min(1).max(10000).nullable().optional(),
        pattern: z.string().max(500).nullable().optional(),
        options: z.array(z.string().max(200)).max(100).nullable().optional(),
        // VLC support for STRING (stores as JSONB when enabled)
        versioned: z.boolean().nullable().optional(),
        localized: z.boolean().nullable().optional(),
        // NUMBER settings (max precision limited to 15 due to JavaScript number precision)
        precision: z.number().int().min(1).max(15).nullable().optional(),
        scale: z.number().int().min(0).max(14).nullable().optional(),
        min: z.number().nullable().optional(),
        max: z.number().nullable().optional(),
        nonNegative: z.boolean().nullable().optional(),
        // DATE settings (replaces DATETIME type)
        dateComposition: z.enum(['date', 'time', 'datetime']).nullable().optional()
    })
    .optional()
    .refine(
        (rules) => {
            if (!rules) return true
            // Validate scale < precision for NUMBER type (only if both are non-null numbers)
            if (typeof rules.scale === 'number' && rules.scale !== null) {
                const effectivePrecision = typeof rules.precision === 'number' && rules.precision !== null ? rules.precision : 10
                if (rules.scale >= effectivePrecision) return false
            }
            // Validate min <= max (only if both are non-null numbers)
            if (typeof rules.min === 'number' && rules.min !== null && typeof rules.max === 'number' && rules.max !== null) {
                if (rules.min > rules.max) return false
            }
            // Validate minLength <= maxLength for STRING (only if both are non-null numbers)
            if (
                typeof rules.minLength === 'number' &&
                rules.minLength !== null &&
                typeof rules.maxLength === 'number' &&
                rules.maxLength !== null
            ) {
                if (rules.minLength > rules.maxLength) return false
            }
            return true
        },
        { message: 'Invalid validation rules: scale must be less than precision, min must be <= max, and minLength must be <= maxLength.' }
    )

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
    // Polymorphic reference fields
    targetEntityId: z.string().uuid().optional(),
    targetEntityKind: z.enum(META_ENTITY_KINDS).optional(),
    // Legacy alias for backward compatibility
    targetCatalogId: z.string().uuid().optional(),
    validationRules: validationRulesSchema,
    uiConfig: uiConfigSchema,
    isRequired: z.boolean().optional(),
    isDisplayAttribute: z.boolean().optional(),
    sortOrder: z.number().int().optional()
})

const updateAttributeSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    dataType: z.enum(ATTRIBUTE_DATA_TYPES).optional(),
    name: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    // Polymorphic reference fields
    targetEntityId: z.string().uuid().nullable().optional(),
    targetEntityKind: z.enum(META_ENTITY_KINDS).nullable().optional(),
    // Legacy alias for backward compatibility
    targetCatalogId: z.string().uuid().nullable().optional(),
    validationRules: validationRulesSchema,
    uiConfig: uiConfigSchema,
    isRequired: z.boolean().optional(),
    isDisplayAttribute: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    expectedVersion: z.number().int().positive().optional() // For optimistic locking
})

const moveAttributeSchema = z.object({
    direction: z.enum(['up', 'down'])
})

const ATTRIBUTE_LIMIT = 100

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

    const services = (req: Request) => {
        const schemaService = new MetahubSchemaService(getDataSource())
        return {
            attributesService: new MetahubAttributesService(schemaService),
            objectsService: new MetahubObjectsService(schemaService),
            schemaService
        }
    }

    /**
     * GET /metahub/:metahubId/hub/:hubId/catalog/:catalogId/attributes
     * GET /metahub/:metahubId/catalog/:catalogId/attributes
     * List all attributes in a catalog
     */
    router.get(
        ['/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attributes', '/metahub/:metahubId/catalog/:catalogId/attributes'],
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
            const { attributesService } = services(req)
            const userId = resolveUserId(req)

            let validatedQuery
            try {
                validatedQuery = validateAttributesListQuery(req.query)
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
                }
                throw error
            }

            const { limit, offset, sortBy, sortOrder, search, locale } = validatedQuery

            // Fetch all attributes for the catalog (usually small number < 100)
            let items = await attributesService.findAll(metahubId, catalogId, userId)

            const totalAll = items.length
            const limitReached = totalAll >= ATTRIBUTE_LIMIT

            // Calculate total before filtering? Or after?
            // Usually search filters total.

            // Search filter
            if (search) {
                const searchLower = search.toLowerCase()
                const matchesName = (name: any) => {
                    if (!name) return false
                    if (typeof name === 'string') return name.toLowerCase().includes(searchLower)
                    if (typeof name === 'object') {
                        if ('locales' in name && name.locales && typeof name.locales === 'object') {
                            return Object.values(name.locales).some((entry: any) =>
                                String(entry?.content ?? '')
                                    .toLowerCase()
                                    .includes(searchLower)
                            )
                        }
                        return Object.values(name).some((value: any) =>
                            String(value ?? '')
                                .toLowerCase()
                                .includes(searchLower)
                        )
                    }
                    return false
                }
                items = items.filter((item) => item.codename.toLowerCase().includes(searchLower) || matchesName(item.name))
            }

            const total = items.length

            const getNameValue = (name: any) => {
                if (!name) return ''
                if (typeof name === 'string') return name
                if (typeof name !== 'object') return String(name)

                const locales = name.locales && typeof name.locales === 'object' ? name.locales : null
                const primary = typeof name._primary === 'string' ? name._primary : undefined

                const pick = (key?: string) => {
                    if (!key || !locales) return undefined
                    const entry = (locales as Record<string, any>)[key]
                    if (!entry) return undefined
                    return typeof entry === 'string' ? entry : entry?.content
                }

                const byLocale = pick(locale)
                const byPrimary = pick(primary)
                if (byLocale) return String(byLocale)
                if (byPrimary) return String(byPrimary)

                if (locales) {
                    for (const entry of Object.values(locales)) {
                        const content = typeof entry === 'string' ? entry : (entry as any)?.content
                        if (content) return String(content)
                    }
                }

                return ''
            }

            // Sort
            items.sort((a, b) => {
                let valA: any = a[sortBy as keyof typeof a]
                let valB: any = b[sortBy as keyof typeof b]

                if (sortBy === 'name') {
                    valA = getNameValue(a.name)
                    valB = getNameValue(b.name)
                } else if (sortBy === 'created') {
                    valA = a.createdAt
                    valB = b.createdAt
                } else if (sortBy === 'updated') {
                    valA = a.updatedAt
                    valB = b.updatedAt
                }

                if (valA < valB) return sortOrder === 'asc' ? -1 : 1
                if (valA > valB) return sortOrder === 'asc' ? 1 : -1
                return 0
            })

            // Pagination
            const paginatedItems = items.slice(offset, offset + limit)

            res.json({
                items: paginatedItems,
                pagination: { total, limit, offset },
                meta: { totalAll, limit: ATTRIBUTE_LIMIT, limitReached }
            })
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
            const { metahubId, catalogId, attributeId } = req.params
            const { attributesService } = services(req)
            const userId = resolveUserId(req)

            const attribute = await attributesService.findById(metahubId, attributeId, userId)

            if (!attribute || attribute.catalogId !== catalogId) {
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
            const { metahubId, catalogId } = req.params
            const { attributesService, objectsService, schemaService } = services(req)
            const userId = resolveUserId(req)

            // Verify catalog exists
            const catalog = await objectsService.findById(metahubId, catalogId, userId)
            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            const totalAll = await attributesService.countByObjectId(metahubId, catalogId, userId)
            if (totalAll >= ATTRIBUTE_LIMIT) {
                return res.status(409).json({
                    error: 'Attribute limit reached',
                    code: 'ATTRIBUTE_LIMIT_REACHED',
                    limit: ATTRIBUTE_LIMIT
                })
            }

            const parsed = createAttributeSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const {
                codename,
                dataType,
                name,
                namePrimaryLocale,
                targetEntityId,
                targetEntityKind,
                targetCatalogId,
                validationRules,
                uiConfig,
                isRequired,
                isDisplayAttribute,
                sortOrder
            } = parsed.data

            // Resolve target entity: prefer new fields, fallback to legacy
            const resolvedTargetEntityId = targetEntityId ?? targetCatalogId
            const resolvedTargetEntityKind = targetEntityKind ?? (targetCatalogId ? MetaEntityKind.CATALOG : undefined)

            const normalizedCodename = normalizeCodename(codename)
            if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            // Check for duplicate codename
            const existing = await attributesService.findByCodename(metahubId, catalogId, normalizedCodename, userId)
            if (existing) {
                return res.status(409).json({ error: 'Attribute with this codename already exists' })
            }

            // For REF type, verify target entity exists and validate required fields
            if (dataType === AttributeDataType.REF) {
                if (!resolvedTargetEntityId || !resolvedTargetEntityKind) {
                    return res.status(400).json({
                        error: 'REF type requires targetEntityId and targetEntityKind'
                    })
                }
                // Verify target exists (currently only catalog is fully supported)
                if (resolvedTargetEntityKind === MetaEntityKind.CATALOG) {
                    const targetCatalog = await objectsService.findById(metahubId, resolvedTargetEntityId, userId)
                    if (!targetCatalog) {
                        return res.status(400).json({ error: 'Target catalog not found' })
                    }
                }
                // Future: add validation for DOCUMENT, HUB when needed
            }

            const sanitizedName = sanitizeLocalizedInput(name ?? {})
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, namePrimaryLocale ?? 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            // Normalize sort orders
            await attributesService.ensureSequentialSortOrder(metahubId, catalogId, userId)

            // If sortOrder not provided, append to end
            // We can fetch max sort order or trust service default (0 might overlap)
            // Ideally we calculate max sort order here or in service.
            // Let's rely on client or default 0 (which might conflict if unique? sort_order is not unique in schema usually).
            // Actually, `ensureSequentialSortOrder` fixes it to 1..N. If we insert 0, we might need to reorder again.
            // Better: get count/max.
            // But let's simplify: pass provided sortOrder or default.

            const attribute = await attributesService.create(
                metahubId,
                {
                    catalogId,
                    codename: normalizedCodename,
                    dataType,
                    name: nameVlc,
                    targetEntityId: dataType === AttributeDataType.REF ? resolvedTargetEntityId : undefined,
                    targetEntityKind: dataType === AttributeDataType.REF ? resolvedTargetEntityKind : undefined,
                    validationRules: validationRules ?? {},
                    uiConfig: uiConfig ?? {},
                    isRequired: isRequired ?? false,
                    isDisplayAttribute: isDisplayAttribute ?? false,
                    sortOrder: sortOrder,
                    createdBy: userId
                },
                userId
            )

            // Normalize again to fit new item
            await attributesService.ensureSequentialSortOrder(metahubId, catalogId, userId)

            // If isDisplayAttribute was set, ensure exclusivity (clear from others)
            if (isDisplayAttribute) {
                await attributesService.setDisplayAttribute(metahubId, catalogId, attribute.id, userId)
            }

            await syncMetahubSchema(metahubId, getDataSource(), userId).catch((err) => {
                console.error('[Attributes] Schema sync failed:', err)
            })

            res.status(201).json(attribute)
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
            const { metahubId, catalogId, attributeId } = req.params
            const { attributesService, objectsService, schemaService } = services(req)
            const userId = resolveUserId(req)

            const attribute = await attributesService.findById(metahubId, attributeId, userId)
            if (!attribute || attribute.catalogId !== catalogId) {
                return res.status(404).json({ error: 'Attribute not found' })
            }

            const parsed = updateAttributeSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const {
                codename,
                dataType,
                name,
                namePrimaryLocale,
                targetEntityId,
                targetEntityKind,
                targetCatalogId,
                validationRules,
                uiConfig,
                isRequired,
                isDisplayAttribute,
                sortOrder,
                expectedVersion
            } = parsed.data

            // MVP: Prevent data type change (would require schema migration)
            if (dataType && dataType !== attribute.dataType) {
                return res.status(400).json({
                    error: 'Data type change not allowed',
                    code: 'DATA_TYPE_CHANGE_FORBIDDEN',
                    message: 'Changing data type after creation is not supported. Please delete and recreate the attribute.',
                    currentType: attribute.dataType,
                    requestedType: dataType
                })
            }

            // MVP: Prevent VLC settings change for STRING type (would change physical type TEXT <-> JSONB)
            if (attribute.dataType === AttributeDataType.STRING && validationRules) {
                const oldRules = attribute.validationRules as Record<string, unknown> | undefined
                const wasVersioned = Boolean(oldRules?.versioned)
                const wasLocalized = Boolean(oldRules?.localized)
                const willBeVersioned = Boolean(validationRules.versioned)
                const willBeLocalized = Boolean(validationRules.localized)
                const wasVLC = wasVersioned || wasLocalized
                const willBeVLC = willBeVersioned || willBeLocalized
                if (wasVLC !== willBeVLC) {
                    return res.status(400).json({
                        error: 'VLC settings change not allowed',
                        code: 'VLC_CHANGE_FORBIDDEN',
                        message: 'Changing versioned/localized settings after creation is not supported (would change PostgreSQL type).',
                        currentVLC: wasVLC,
                        requestedVLC: willBeVLC
                    })
                }
            }

            // Resolve target entity: prefer new fields, fallback to legacy
            const resolvedTargetEntityId = targetEntityId ?? targetCatalogId
            const resolvedTargetEntityKind =
                targetEntityKind ?? (targetCatalogId !== undefined && targetCatalogId !== null ? MetaEntityKind.CATALOG : undefined)

            const updateData: any = {}

            if (codename && codename !== attribute.codename) {
                const normalizedCodename = normalizeCodename(codename)
                if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                    })
                }
                if (normalizedCodename !== attribute.codename) {
                    const existing = await attributesService.findByCodename(metahubId, catalogId, normalizedCodename, userId)
                    if (existing) {
                        return res.status(409).json({ error: 'Attribute with this codename already exists' })
                    }
                    updateData.codename = normalizedCodename
                }
            }

            // dataType is intentionally NOT updatable (see validation above)

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? attribute.name?._primary ?? 'en'
                const nameVlc = buildLocalizedContent(sanitizedName, primary, primary)
                if (nameVlc) {
                    updateData.name = nameVlc
                }
            }

            // Handle polymorphic reference update
            if (resolvedTargetEntityId !== undefined || resolvedTargetEntityKind !== undefined) {
                if (resolvedTargetEntityId === null) {
                    // Clear reference
                    updateData.targetEntityId = null
                    updateData.targetEntityKind = null
                } else if ((dataType || attribute.dataType) === AttributeDataType.REF) {
                    // Validate target exists (currently only catalog is fully supported)
                    if (resolvedTargetEntityKind === MetaEntityKind.CATALOG && resolvedTargetEntityId) {
                        const targetCatalog = await objectsService.findById(metahubId, resolvedTargetEntityId, userId)
                        if (!targetCatalog) {
                            return res.status(400).json({ error: 'Target catalog not found' })
                        }
                    }
                    if (resolvedTargetEntityId) updateData.targetEntityId = resolvedTargetEntityId
                    if (resolvedTargetEntityKind) updateData.targetEntityKind = resolvedTargetEntityKind
                }
            }

            if (validationRules) updateData.validationRules = validationRules
            if (uiConfig) updateData.uiConfig = uiConfig
            if (isRequired !== undefined) updateData.isRequired = isRequired
            // isDisplayAttribute is handled separately via setDisplayAttribute for atomicity
            if (sortOrder !== undefined) updateData.sortOrder = sortOrder
            if (expectedVersion !== undefined) updateData.expectedVersion = expectedVersion
            updateData.updatedBy = userId

            const updated = await attributesService.update(metahubId, attributeId, updateData, userId)

            // Handle isDisplayAttribute change atomically (clears flag from other attributes)
            if (isDisplayAttribute === true) {
                await attributesService.setDisplayAttribute(metahubId, catalogId, attributeId, userId)
            } else if (isDisplayAttribute === false) {
                await attributesService.clearDisplayAttribute(metahubId, attributeId, userId)
            }

            if (sortOrder !== undefined) {
                await attributesService.ensureSequentialSortOrder(metahubId, catalogId, userId)
            }

            await syncMetahubSchema(metahubId, getDataSource(), userId).catch((err) => {
                console.error('[Attributes] Schema sync failed:', err)
            })

            res.json(updated)
        })
    )

    /**
     * PATCH /metahub/:metahubId/center/:hubId/catalog/:catalogId/attribute/:attributeId/move
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
            const { metahubId, catalogId, attributeId } = req.params
            const { attributesService } = services(req)
            const userId = resolveUserId(req)

            const parsed = moveAttributeSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { direction } = parsed.data

            try {
                // Ensure existence first? Service does it.
                const updated = await attributesService.moveAttribute(metahubId, catalogId, attributeId, direction, userId)
                res.json(updated)
            } catch (error: any) {
                if (error.message === 'Attribute not found') {
                    return res.status(404).json({ error: 'Attribute not found' })
                }
                throw error
            }
        })
    )

    /**
     * PATCH /metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/toggle-required
     * PATCH /metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/toggle-required
     * Toggle the isRequired flag on an attribute
     */
    router.patch(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/toggle-required',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/toggle-required'
        ],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId, attributeId } = req.params
            const { attributesService } = services(req)
            const userId = resolveUserId(req)

            const attribute = await attributesService.findById(metahubId, attributeId, userId)
            if (!attribute || attribute.catalogId !== catalogId) {
                return res.status(404).json({ error: 'Attribute not found' })
            }

            const newValue = !attribute.isRequired
            await attributesService.update(
                metahubId,
                attributeId,
                {
                    isRequired: newValue,
                    updatedBy: userId
                },
                userId
            )

            await syncMetahubSchema(metahubId, getDataSource(), userId).catch((err) => {
                console.error('[Attributes] Schema sync failed:', err)
            })

            res.json({ success: true, isRequired: newValue })
        })
    )

    /**
     * PATCH /metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/set-display
     * PATCH /metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/set-display
     * Set this attribute as the display attribute for the catalog
     */
    router.patch(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/set-display',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/set-display'
        ],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId, attributeId } = req.params
            const { attributesService } = services(req)
            const userId = resolveUserId(req)

            const attribute = await attributesService.findById(metahubId, attributeId, userId)
            if (!attribute || attribute.catalogId !== catalogId) {
                return res.status(404).json({ error: 'Attribute not found' })
            }

            await attributesService.setDisplayAttribute(metahubId, catalogId, attributeId, userId)

            await syncMetahubSchema(metahubId, getDataSource(), userId).catch((err) => {
                console.error('[Attributes] Schema sync failed:', err)
            })

            res.json({ success: true })
        })
    )

    /**
     * PATCH /metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/clear-display
     * PATCH /metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/clear-display
     * Clear the display attribute flag from this attribute
     */
    router.patch(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/clear-display',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/clear-display'
        ],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId, attributeId } = req.params
            const { attributesService } = services(req)
            const userId = resolveUserId(req)

            const attribute = await attributesService.findById(metahubId, attributeId, userId)
            if (!attribute || attribute.catalogId !== catalogId) {
                return res.status(404).json({ error: 'Attribute not found' })
            }

            await attributesService.clearDisplayAttribute(metahubId, attributeId, userId)

            await syncMetahubSchema(metahubId, getDataSource(), userId).catch((err) => {
                console.error('[Attributes] Schema sync failed:', err)
            })

            res.json({ success: true })
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
            const { metahubId, catalogId, attributeId } = req.params
            const { attributesService, schemaService } = services(req)
            const userId = resolveUserId(req)

            const attribute = await attributesService.findById(metahubId, attributeId, userId)
            if (!attribute || attribute.catalogId !== catalogId) {
                return res.status(404).json({ error: 'Attribute not found' })
            }

            if (attribute.isDisplayAttribute) {
                return res.status(409).json({
                    error: 'Cannot delete display attribute. Set another attribute as display first.'
                })
            }

            await attributesService.ensureSequentialSortOrder(metahubId, catalogId, userId)
            await attributesService.delete(metahubId, attributeId, userId)
            await attributesService.ensureSequentialSortOrder(metahubId, catalogId, userId)

            await syncMetahubSchema(metahubId, getDataSource(), userId).catch((err) => {
                console.error('[Attributes] Schema sync failed:', err)
            })

            return res.status(204).send()
        })
    )

    return router
}
