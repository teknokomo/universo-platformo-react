import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { ListQuerySchema } from '../../shared/queryParams'
import { getRequestManager } from '../../../utils'
import { localizedContent, validation } from '@universo/utils'
const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
const { normalizeCodename, isValidCodename } = validation
import { AttributeDataType, ATTRIBUTE_DATA_TYPES, TABLE_CHILD_DATA_TYPES, MetaEntityKind, META_ENTITY_KINDS } from '@universo/types'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubEnumerationValuesService } from '../../metahubs/services/MetahubEnumerationValuesService'
import { syncMetahubSchema } from '../../metahubs/services/schemaSync'

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

const ENUM_PRESENTATION_MODES = ['select', 'radio', 'label'] as const
const ENUM_LABEL_EMPTY_DISPLAY_MODES = ['empty', 'dash'] as const
const ENUMERATION_KIND = 'enumeration' as const

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
        width: z.number().optional(),
        headerAsCheckbox: z.boolean().optional(),
        enumPresentationMode: z.enum(ENUM_PRESENTATION_MODES).optional(),
        defaultEnumValueId: z.string().uuid().nullable().optional(),
        enumAllowEmpty: z.boolean().optional(),
        enumLabelEmptyDisplay: z.enum(ENUM_LABEL_EMPTY_DISPLAY_MODES).optional(),
        // TABLE-specific settings
        showTitle: z.boolean().optional()
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
    sortOrder: z.number().int().optional(),
    // TABLE parent reference
    parentAttributeId: z.string().uuid().nullish()
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
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        const schemaService = new MetahubSchemaService(ds, undefined, manager)
        return {
            ds,
            manager,
            attributesService: new MetahubAttributesService(schemaService),
            objectsService: new MetahubObjectsService(schemaService),
            enumerationValuesService: new MetahubEnumerationValuesService(schemaService),
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
            let childSearchMatchParentIds: string[] = []
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
                const matchesItem = (item: any) => item.codename.toLowerCase().includes(searchLower) || matchesName(item.name)

                // Also search among children of TABLE attributes
                const tableParents = items.filter((item) => item.dataType === AttributeDataType.TABLE)
                if (tableParents.length > 0) {
                    const childMatchParentIds = new Set<string>()
                    try {
                        const parentIds = tableParents.map((p) => p.id)
                        const childrenByParent = await attributesService.findChildAttributesByParentIds(metahubId, parentIds, userId)
                        for (const [parentId, children] of childrenByParent) {
                            if (children.some((child: any) => matchesItem(child))) {
                                childMatchParentIds.add(parentId)
                            }
                        }
                    } catch {
                        // Ignore failures
                    }
                    childSearchMatchParentIds = Array.from(childMatchParentIds)
                }

                items = items.filter((item) => matchesItem(item) || childSearchMatchParentIds.includes(item.id))
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
                meta: {
                    totalAll,
                    limit: ATTRIBUTE_LIMIT,
                    limitReached,
                    ...(childSearchMatchParentIds.length > 0 ? { childSearchMatchParentIds } : {})
                }
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
            const { attributesService, objectsService, enumerationValuesService, ds, manager } = services(req)
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
                sortOrder,
                parentAttributeId
            } = parsed.data
            const effectiveIsRequired = Boolean(isRequired)

            // TABLE-specific validation
            if (dataType === AttributeDataType.TABLE) {
                if (parentAttributeId) {
                    return res.status(400).json({
                        error: 'Nested TABLE attributes are not allowed',
                        code: 'NESTED_TABLE_FORBIDDEN'
                    })
                }
            }

            // Validate child data type is allowed (no TABLE in children)
            if (parentAttributeId && !TABLE_CHILD_DATA_TYPES.includes(dataType as any)) {
                return res.status(400).json({
                    error: `Data type "${dataType}" is not allowed for child attributes`,
                    code: 'INVALID_CHILD_DATA_TYPE'
                })
            }

            // Resolve target entity with compatibility fallback
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
                if (resolvedTargetEntityKind !== MetaEntityKind.CATALOG && resolvedTargetEntityKind !== ENUMERATION_KIND) {
                    return res.status(400).json({
                        error: 'Unsupported targetEntityKind for REF',
                        details: { targetEntityKind: resolvedTargetEntityKind }
                    })
                }

                const targetEntity = await objectsService.findById(metahubId, resolvedTargetEntityId, userId)
                if (!targetEntity || targetEntity.kind !== resolvedTargetEntityKind) {
                    return res.status(400).json({
                        error: resolvedTargetEntityKind === ENUMERATION_KIND ? 'Target enumeration not found' : 'Target catalog not found'
                    })
                }
            }

            const normalizedUiConfig: Record<string, unknown> = { ...(uiConfig ?? {}) }
            if (dataType === AttributeDataType.REF && resolvedTargetEntityKind === ENUMERATION_KIND && resolvedTargetEntityId) {
                if (normalizedUiConfig.enumPresentationMode === undefined) {
                    normalizedUiConfig.enumPresentationMode = 'select'
                }
                if (normalizedUiConfig.enumAllowEmpty === undefined) {
                    normalizedUiConfig.enumAllowEmpty = true
                }
                if (normalizedUiConfig.enumLabelEmptyDisplay !== 'empty' && normalizedUiConfig.enumLabelEmptyDisplay !== 'dash') {
                    normalizedUiConfig.enumLabelEmptyDisplay = 'dash'
                }

                const defaultEnumValueId = normalizedUiConfig.defaultEnumValueId
                if (typeof defaultEnumValueId === 'string') {
                    const enumValue = await enumerationValuesService.findById(metahubId, defaultEnumValueId, userId)
                    if (!enumValue || enumValue.objectId !== resolvedTargetEntityId) {
                        return res.status(400).json({
                            error: 'defaultEnumValueId must reference a value from the selected target enumeration'
                        })
                    }
                } else if (defaultEnumValueId !== null && defaultEnumValueId !== undefined) {
                    return res.status(400).json({
                        error: 'defaultEnumValueId must be UUID string or null'
                    })
                }

                const hasDefaultEnumValueId = typeof normalizedUiConfig.defaultEnumValueId === 'string'
                if (hasDefaultEnumValueId || effectiveIsRequired) {
                    normalizedUiConfig.enumAllowEmpty = false
                } else if (normalizedUiConfig.enumAllowEmpty === true) {
                    normalizedUiConfig.defaultEnumValueId = null
                }
            } else {
                delete normalizedUiConfig.enumPresentationMode
                delete normalizedUiConfig.defaultEnumValueId
                delete normalizedUiConfig.enumAllowEmpty
                delete normalizedUiConfig.enumLabelEmptyDisplay
            }

            const sanitizedName = sanitizeLocalizedInput(name ?? {})
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, namePrimaryLocale ?? 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            // Normalize sort orders (scoped to siblings at same parent level)
            await attributesService.ensureSequentialSortOrder(metahubId, catalogId, userId, parentAttributeId ?? null)

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
                    uiConfig: normalizedUiConfig,
                    isRequired: dataType === AttributeDataType.TABLE ? false : isRequired ?? false,
                    isDisplayAttribute: isDisplayAttribute ?? false,
                    sortOrder: sortOrder,
                    parentAttributeId: parentAttributeId ?? null,
                    createdBy: userId
                },
                userId
            )

            // Normalize again to fit new item (scoped to siblings)
            await attributesService.ensureSequentialSortOrder(metahubId, catalogId, userId, parentAttributeId ?? null)

            // If isDisplayAttribute was set, ensure exclusivity (clear from others)
            if (isDisplayAttribute) {
                await attributesService.setDisplayAttribute(metahubId, catalogId, attribute.id, userId)
            }

            await syncMetahubSchema(metahubId, ds, userId, manager).catch((err) => {
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
            const { attributesService, objectsService, enumerationValuesService, ds, manager } = services(req)
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

            // Resolve target entity with compatibility fallback
            const resolvedTargetEntityId = targetEntityId ?? targetCatalogId
            const resolvedTargetEntityKind =
                targetEntityKind ?? (targetCatalogId !== undefined && targetCatalogId !== null ? MetaEntityKind.CATALOG : undefined)
            const targetChanged = resolvedTargetEntityId !== undefined || resolvedTargetEntityKind !== undefined

            const updateData: any = {}
            const effectiveDataType = dataType ?? attribute.dataType
            const isRefType = effectiveDataType === AttributeDataType.REF

            if (effectiveDataType === AttributeDataType.TABLE && isRequired === true) {
                return res.status(400).json({
                    error: 'TABLE attributes cannot be set as required'
                })
            }

            let effectiveTargetEntityId = attribute.targetEntityId ?? null
            let effectiveTargetEntityKind = attribute.targetEntityKind ?? null

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
                    effectiveTargetEntityId = null
                    effectiveTargetEntityKind = null
                    updateData.targetEntityId = null
                    updateData.targetEntityKind = null
                } else if (isRefType) {
                    effectiveTargetEntityId = resolvedTargetEntityId ?? effectiveTargetEntityId
                    effectiveTargetEntityKind = resolvedTargetEntityKind ?? effectiveTargetEntityKind

                    if (!effectiveTargetEntityId || !effectiveTargetEntityKind) {
                        return res.status(400).json({
                            error: 'REF type requires targetEntityId and targetEntityKind'
                        })
                    }

                    if (effectiveTargetEntityKind !== MetaEntityKind.CATALOG && effectiveTargetEntityKind !== ENUMERATION_KIND) {
                        return res.status(400).json({
                            error: 'Unsupported targetEntityKind for REF',
                            details: { targetEntityKind: effectiveTargetEntityKind }
                        })
                    }

                    const targetEntity = await objectsService.findById(metahubId, effectiveTargetEntityId, userId)
                    if (!targetEntity || targetEntity.kind !== effectiveTargetEntityKind) {
                        return res.status(400).json({
                            error:
                                effectiveTargetEntityKind === ENUMERATION_KIND ? 'Target enumeration not found' : 'Target catalog not found'
                        })
                    }

                    if (resolvedTargetEntityId !== undefined) updateData.targetEntityId = resolvedTargetEntityId
                    if (resolvedTargetEntityKind !== undefined) updateData.targetEntityKind = resolvedTargetEntityKind
                }
            }

            if (validationRules) updateData.validationRules = validationRules
            const effectiveIsRequired = effectiveDataType === AttributeDataType.TABLE ? false : isRequired ?? attribute.isRequired
            if (uiConfig || targetChanged || (isRefType && effectiveTargetEntityKind === ENUMERATION_KIND && isRequired !== undefined)) {
                const currentUiConfig = (attribute.uiConfig as Record<string, unknown>) ?? {}
                const mergedUiConfig: Record<string, unknown> = { ...currentUiConfig, ...(uiConfig ?? {}) }

                if (isRefType && effectiveTargetEntityKind === ENUMERATION_KIND && effectiveTargetEntityId) {
                    if (mergedUiConfig.enumPresentationMode === undefined) {
                        mergedUiConfig.enumPresentationMode = 'select'
                    }
                    if (mergedUiConfig.enumAllowEmpty === undefined) {
                        mergedUiConfig.enumAllowEmpty = true
                    }
                    if (mergedUiConfig.enumLabelEmptyDisplay !== 'empty' && mergedUiConfig.enumLabelEmptyDisplay !== 'dash') {
                        mergedUiConfig.enumLabelEmptyDisplay = 'dash'
                    }

                    const defaultEnumValueId = mergedUiConfig.defaultEnumValueId
                    if (typeof defaultEnumValueId === 'string') {
                        const enumValue = await enumerationValuesService.findById(metahubId, defaultEnumValueId, userId)
                        const isValueInTargetEnumeration = Boolean(enumValue && enumValue.objectId === effectiveTargetEntityId)
                        if (!isValueInTargetEnumeration) {
                            if (targetChanged) {
                                mergedUiConfig.defaultEnumValueId = null
                            } else {
                                return res.status(400).json({
                                    error: 'defaultEnumValueId must reference a value from the selected target enumeration'
                                })
                            }
                        }
                    } else if (defaultEnumValueId !== null && defaultEnumValueId !== undefined) {
                        return res.status(400).json({
                            error: 'defaultEnumValueId must be UUID string or null'
                        })
                    }

                    const hasDefaultEnumValueId = typeof mergedUiConfig.defaultEnumValueId === 'string'
                    if (hasDefaultEnumValueId || effectiveIsRequired) {
                        mergedUiConfig.enumAllowEmpty = false
                    } else if (mergedUiConfig.enumAllowEmpty === true) {
                        mergedUiConfig.defaultEnumValueId = null
                    }
                } else {
                    delete mergedUiConfig.enumPresentationMode
                    delete mergedUiConfig.defaultEnumValueId
                    delete mergedUiConfig.enumAllowEmpty
                    delete mergedUiConfig.enumLabelEmptyDisplay
                }

                updateData.uiConfig = mergedUiConfig
            }
            if (isRequired !== undefined) {
                updateData.isRequired = effectiveDataType === AttributeDataType.TABLE ? false : isRequired
            }
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
                // Scope reordering to the attribute's sibling level
                const existingAttr = await attributesService.findById(metahubId, attributeId, userId)
                await attributesService.ensureSequentialSortOrder(metahubId, catalogId, userId, existingAttr?.parentAttributeId ?? null)
            }

            await syncMetahubSchema(metahubId, ds, userId, manager).catch((err) => {
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
            const { attributesService, enumerationValuesService, ds, manager } = services(req)
            const userId = resolveUserId(req)

            const attribute = await attributesService.findById(metahubId, attributeId, userId)
            if (!attribute || attribute.catalogId !== catalogId) {
                return res.status(404).json({ error: 'Attribute not found' })
            }

            if (attribute.dataType === AttributeDataType.TABLE) {
                return res.status(400).json({
                    error: 'TABLE attributes cannot be set as required'
                })
            }

            const newValue = !attribute.isRequired

            const isEnumerationRef =
                attribute.dataType === AttributeDataType.REF &&
                attribute.targetEntityKind === ENUMERATION_KIND &&
                typeof attribute.targetEntityId === 'string'

            const currentUiConfig = ((attribute.uiConfig as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>

            if (newValue && isEnumerationRef) {
                const enumPresentationMode = currentUiConfig.enumPresentationMode
                const defaultEnumValueId =
                    typeof currentUiConfig.defaultEnumValueId === 'string' ? currentUiConfig.defaultEnumValueId : null

                if (enumPresentationMode === 'label' && !defaultEnumValueId) {
                    return res.status(400).json({
                        error: 'required REF label mode requires defaultEnumValueId'
                    })
                }

                if (defaultEnumValueId) {
                    const enumValue = await enumerationValuesService.findById(metahubId, defaultEnumValueId, userId)
                    if (!enumValue || enumValue.objectId !== attribute.targetEntityId) {
                        return res.status(400).json({
                            error: 'defaultEnumValueId must reference a value from the selected target enumeration'
                        })
                    }
                }
            }

            const updatePayload: Record<string, unknown> = {
                isRequired: newValue,
                updatedBy: userId
            }

            if (isEnumerationRef) {
                const nextUiConfig = { ...currentUiConfig }
                if (newValue) {
                    nextUiConfig.enumAllowEmpty = false
                } else if (typeof nextUiConfig.defaultEnumValueId !== 'string' && nextUiConfig.enumAllowEmpty === undefined) {
                    nextUiConfig.enumAllowEmpty = true
                }
                updatePayload.uiConfig = nextUiConfig
            }

            await attributesService.update(metahubId, attributeId, updatePayload, userId)

            await syncMetahubSchema(metahubId, ds, userId, manager).catch((err) => {
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
            const { attributesService, ds, manager } = services(req)
            const userId = resolveUserId(req)

            const attribute = await attributesService.findById(metahubId, attributeId, userId)
            if (!attribute || attribute.catalogId !== catalogId) {
                return res.status(404).json({ error: 'Attribute not found' })
            }

            // TABLE attributes cannot be display attributes
            if (attribute.dataType === AttributeDataType.TABLE) {
                return res.status(400).json({ error: 'TABLE attributes cannot be set as display attribute' })
            }

            await attributesService.setDisplayAttribute(metahubId, catalogId, attributeId, userId)

            await syncMetahubSchema(metahubId, ds, userId, manager).catch((err) => {
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
            const { attributesService, ds, manager } = services(req)
            const userId = resolveUserId(req)

            const attribute = await attributesService.findById(metahubId, attributeId, userId)
            if (!attribute || attribute.catalogId !== catalogId) {
                return res.status(404).json({ error: 'Attribute not found' })
            }

            await attributesService.clearDisplayAttribute(metahubId, attributeId, userId)

            await syncMetahubSchema(metahubId, ds, userId, manager).catch((err) => {
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
            const { attributesService, ds, manager } = services(req)
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

            await attributesService.ensureSequentialSortOrder(metahubId, catalogId, userId, attribute.parentAttributeId ?? null)
            await attributesService.delete(metahubId, attributeId, userId)
            await attributesService.ensureSequentialSortOrder(metahubId, catalogId, userId, attribute.parentAttributeId ?? null)

            await syncMetahubSchema(metahubId, ds, userId, manager).catch((err) => {
                console.error('[Attributes] Schema sync failed:', err)
            })

            return res.status(204).send()
        })
    )

    // ─── Child attribute endpoints (TABLE tabular parts) ─────────────────────

    /**
     * GET /metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/children
     * List child attributes of a TABLE attribute
     */
    router.get(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/children',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/children'
        ],
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId, attributeId } = req.params
            const { attributesService } = services(req)
            const userId = resolveUserId(req)

            const parent = await attributesService.findById(metahubId, attributeId, userId)
            if (!parent || parent.catalogId !== catalogId) {
                return res.status(404).json({ error: 'Attribute not found' })
            }
            if (parent.dataType !== AttributeDataType.TABLE) {
                return res.status(400).json({ error: 'Attribute is not a TABLE type' })
            }

            const children = await attributesService.findChildAttributes(metahubId, attributeId, userId)

            res.json({ items: children, total: children.length })
        })
    )

    /**
     * POST /metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/children
     * Create a child attribute inside a TABLE attribute
     */
    router.post(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/children',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/children'
        ],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId, attributeId } = req.params
            const { attributesService, objectsService, enumerationValuesService, ds, manager } = services(req)
            const userId = resolveUserId(req)

            // Verify parent TABLE attribute exists
            const parent = await attributesService.findById(metahubId, attributeId, userId)
            if (!parent || parent.catalogId !== catalogId) {
                return res.status(404).json({ error: 'Parent attribute not found' })
            }
            if (parent.dataType !== AttributeDataType.TABLE) {
                return res.status(400).json({ error: 'Parent attribute must be TABLE type' })
            }

            // Force parentAttributeId and restrict data types
            const parsed = createAttributeSchema.safeParse({
                ...req.body,
                parentAttributeId: attributeId
            })
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
                sortOrder
            } = parsed.data

            // Validate child data type
            if (!TABLE_CHILD_DATA_TYPES.includes(dataType as any)) {
                return res.status(400).json({
                    error: `Data type "${dataType}" is not allowed for child attributes`,
                    code: 'INVALID_CHILD_DATA_TYPE'
                })
            }

            const normalizedCodename = normalizeCodename(codename)
            if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            const resolvedTargetEntityId = targetEntityId ?? targetCatalogId
            const resolvedTargetEntityKind = targetEntityKind ?? (targetCatalogId ? MetaEntityKind.CATALOG : undefined)

            if (dataType === AttributeDataType.REF) {
                if (!resolvedTargetEntityId || !resolvedTargetEntityKind) {
                    return res.status(400).json({
                        error: 'REF type requires targetEntityId and targetEntityKind'
                    })
                }
                if (resolvedTargetEntityKind !== MetaEntityKind.CATALOG && resolvedTargetEntityKind !== ENUMERATION_KIND) {
                    return res.status(400).json({
                        error: 'Unsupported targetEntityKind for REF',
                        details: { targetEntityKind: resolvedTargetEntityKind }
                    })
                }

                const targetEntity = await objectsService.findById(metahubId, resolvedTargetEntityId, userId)
                if (!targetEntity || targetEntity.kind !== resolvedTargetEntityKind) {
                    return res.status(400).json({
                        error: resolvedTargetEntityKind === ENUMERATION_KIND ? 'Target enumeration not found' : 'Target catalog not found'
                    })
                }
            }

            const normalizedUiConfig: Record<string, unknown> = { ...(uiConfig ?? {}) }
            if (dataType === AttributeDataType.REF && resolvedTargetEntityKind === ENUMERATION_KIND && resolvedTargetEntityId) {
                if (normalizedUiConfig.enumPresentationMode === undefined) {
                    normalizedUiConfig.enumPresentationMode = 'select'
                }
                if (normalizedUiConfig.enumAllowEmpty === undefined) {
                    normalizedUiConfig.enumAllowEmpty = true
                }
                if (normalizedUiConfig.enumLabelEmptyDisplay !== 'empty' && normalizedUiConfig.enumLabelEmptyDisplay !== 'dash') {
                    normalizedUiConfig.enumLabelEmptyDisplay = 'dash'
                }

                const defaultEnumValueId = normalizedUiConfig.defaultEnumValueId
                if (typeof defaultEnumValueId === 'string') {
                    const enumValue = await enumerationValuesService.findById(metahubId, defaultEnumValueId, userId)
                    if (!enumValue || enumValue.objectId !== resolvedTargetEntityId) {
                        return res.status(400).json({
                            error: 'defaultEnumValueId must reference a value from the selected target enumeration'
                        })
                    }
                } else if (defaultEnumValueId !== null && defaultEnumValueId !== undefined) {
                    return res.status(400).json({
                        error: 'defaultEnumValueId must be UUID string or null'
                    })
                }

                const effectiveIsRequired = isRequired ?? false
                const hasDefaultEnumValueId = typeof normalizedUiConfig.defaultEnumValueId === 'string'
                if (hasDefaultEnumValueId || effectiveIsRequired) {
                    normalizedUiConfig.enumAllowEmpty = false
                } else if (normalizedUiConfig.enumAllowEmpty === true) {
                    normalizedUiConfig.defaultEnumValueId = null
                }
            } else {
                delete normalizedUiConfig.enumPresentationMode
                delete normalizedUiConfig.defaultEnumValueId
                delete normalizedUiConfig.enumAllowEmpty
                delete normalizedUiConfig.enumLabelEmptyDisplay
            }

            // Check for duplicate codename among active attributes in the same catalog
            const existing = await attributesService.findByCodename(metahubId, catalogId, normalizedCodename, userId)
            if (existing) {
                return res.status(409).json({ error: 'Attribute with this codename already exists' })
            }

            const sanitizedName = sanitizeLocalizedInput(name ?? {})
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }
            const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, namePrimaryLocale ?? 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const shouldBeDisplayAttribute = Boolean(req.body.isDisplayAttribute)

            const attribute = await attributesService.create(
                metahubId,
                {
                    catalogId,
                    codename: normalizedCodename,
                    dataType,
                    name: nameVlc,
                    validationRules: validationRules ?? {},
                    uiConfig: normalizedUiConfig,
                    isRequired: isRequired ?? false,
                    isDisplayAttribute: false,
                    targetEntityId: resolvedTargetEntityId,
                    targetEntityKind: resolvedTargetEntityKind,
                    sortOrder,
                    parentAttributeId: attributeId,
                    createdBy: userId
                },
                userId
            )

            // If this should be the display attribute, set it (clears siblings automatically)
            if (shouldBeDisplayAttribute && attribute.id) {
                try {
                    await attributesService.setDisplayAttribute(metahubId, catalogId, attribute.id, userId)
                } catch (err) {
                    console.warn('[Attributes] Failed to set display attribute on child:', err)
                }
            }

            await syncMetahubSchema(metahubId, ds, userId, manager).catch((err) => {
                console.error('[Attributes] Child attribute schema sync failed:', err)
            })

            res.status(201).json(attribute)
        })
    )

    return router
}
