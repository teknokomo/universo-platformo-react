import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { ListQuerySchema } from '../../shared/queryParams'
import { getRequestManager } from '../../../utils'
import { localizedContent } from '@universo/utils'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '@universo/utils/validation/codename'
const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
import { AttributeDataType, ATTRIBUTE_DATA_TYPES, TABLE_CHILD_DATA_TYPES, MetaEntityKind, META_ENTITY_KINDS } from '@universo/types'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubEnumerationValuesService } from '../../metahubs/services/MetahubEnumerationValuesService'
import { MetahubConstantsService } from '../../metahubs/services/MetahubConstantsService'
import { MetahubSettingsService } from '../../settings/services/MetahubSettingsService'
import {
    getCodenameSettings,
    getAttributeCodenameScope,
    codenameErrorMessage,
    buildCodenameAttempt,
    extractCodenameStyle,
    extractCodenameAlphabet,
    extractAllowMixedAlphabets,
    extractAttributeCodenameScope,
    extractAllowedAttributeTypes,
    getAllowAttributeCopy,
    getAllowAttributeDelete,
    getAllowDeleteLastDisplayAttribute,
    getAllowAttributeMoveBetweenRootAndChildren,
    getAllowAttributeMoveBetweenChildLists,
    CODENAME_RETRY_MAX_ATTEMPTS
} from '../../shared/codenameStyleHelper'
import { syncMetahubSchema } from '../../metahubs/services/schemaSync'
import { KnexClient, uuidToLockKey, acquireAdvisoryLock, releaseAdvisoryLock } from '../../ddl'

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

const ENUM_PRESENTATION_MODES = ['select', 'radio', 'label'] as const
const ENUM_LABEL_EMPTY_DISPLAY_MODES = ['empty', 'dash'] as const
const ENUMERATION_KIND = 'enumeration' as const
const SET_KIND = 'set' as const

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
        dateComposition: z.enum(['date', 'time', 'datetime']).nullable().optional(),
        // TABLE settings (row count limits for child table)
        minRows: z.number().int().min(0).nullable().optional(),
        maxRows: z.number().int().min(1).nullable().optional()
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
            // Validate minRows <= maxRows for TABLE (only if both are non-null numbers)
            if (
                typeof rules.minRows === 'number' &&
                rules.minRows !== null &&
                typeof rules.maxRows === 'number' &&
                rules.maxRows !== null
            ) {
                if (rules.minRows > rules.maxRows) return false
            }
            return true
        },
        {
            message:
                'Invalid validation rules: scale must be less than precision, min must be <= max, minLength must be <= maxLength, and minRows must be <= maxRows.'
        }
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

const buildCodenameLocalizedVlc = (codenameInput: unknown, primaryLocale?: string, fallbackPrimary = 'en'): unknown => {
    if (codenameInput === undefined) return undefined
    const codenameRecord: Record<string, string | undefined> =
        typeof codenameInput === 'string' ? { en: codenameInput } : (codenameInput as Record<string, string | undefined>)
    const sanitizedCodename = sanitizeLocalizedInput(codenameRecord)
    if (Object.keys(sanitizedCodename).length === 0) return null
    return buildLocalizedContent(sanitizedCodename, primaryLocale, fallbackPrimary)
}

const createAttributeSchema = z
    .object({
        codename: z.string().min(1).max(100),
        codenameInput: localizedInputSchema.optional(),
        codenamePrimaryLocale: z.string().optional(),
        dataType: z.enum(ATTRIBUTE_DATA_TYPES),
        name: localizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        // Polymorphic reference fields
        targetEntityId: z.string().uuid().optional(),
        targetEntityKind: z.enum(META_ENTITY_KINDS).optional(),
        targetConstantId: z.string().uuid().optional(),
        validationRules: validationRulesSchema,
        uiConfig: uiConfigSchema,
        isRequired: z.boolean().optional(),
        isDisplayAttribute: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        // TABLE parent reference
        parentAttributeId: z.string().uuid().nullish()
    })
    .strict()

const updateAttributeSchema = z
    .object({
        codename: z.string().min(1).max(100).optional(),
        codenameInput: localizedInputSchema.optional(),
        codenamePrimaryLocale: z.string().optional(),
        dataType: z.enum(ATTRIBUTE_DATA_TYPES).optional(),
        name: localizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        // Polymorphic reference fields
        targetEntityId: z.string().uuid().nullable().optional(),
        targetEntityKind: z.enum(META_ENTITY_KINDS).nullable().optional(),
        targetConstantId: z.string().uuid().nullable().optional(),
        validationRules: validationRulesSchema,
        uiConfig: uiConfigSchema,
        isRequired: z.boolean().optional(),
        isDisplayAttribute: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        expectedVersion: z.number().int().positive().optional() // For optimistic locking
    })
    .strict()

const moveAttributeSchema = z.object({
    direction: z.enum(['up', 'down'])
})

const copyAttributeSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    codenameInput: localizedInputSchema.optional(),
    codenamePrimaryLocale: z.string().optional(),
    name: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    copyChildAttributes: z.boolean().optional(),
    // Optional overrides — when provided, the copy uses these instead of the source values
    validationRules: validationRulesSchema,
    uiConfig: uiConfigSchema,
    isRequired: z.boolean().optional(),
    targetConstantId: z.string().uuid().nullable().optional()
})

const ATTRIBUTE_LIMIT = 100

const buildDefaultCopyNameInput = (name: unknown): Record<string, string> => {
    if (!name || typeof name !== 'object') {
        return { en: 'Copy (copy)' }
    }

    const asRecord = name as Record<string, unknown>
    const locales =
        asRecord.locales && typeof asRecord.locales === 'object'
            ? (asRecord.locales as Record<string, { content?: unknown }>)
            : (asRecord as Record<string, unknown>)

    const result: Record<string, string> = {}
    for (const [locale, entry] of Object.entries(locales)) {
        const content =
            entry && typeof entry === 'object' && 'content' in entry
                ? typeof (entry as { content?: unknown }).content === 'string'
                    ? (entry as { content: string }).content.trim()
                    : ''
                : typeof entry === 'string'
                ? entry.trim()
                : ''
        const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'
        result[locale] = content ? `${content}${suffix}` : locale === 'ru' ? `Копия${suffix}` : `Copy${suffix}`
    }

    if (Object.keys(result).length === 0) {
        return { en: 'Copy (copy)' }
    }

    return result
}

const isUniqueViolation = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false
    const code = (error as { code?: unknown }).code
    if (code === '23505') return true
    const message = (error as { message?: unknown }).message
    return typeof message === 'string' && message.toLowerCase().includes('duplicate key value')
}

const GLOBAL_ATTRIBUTE_CODENAME_LOCK_ERROR = 'Could not acquire attribute codename lock. Please retry.'

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
            constantsService: new MetahubConstantsService(schemaService),
            schemaService,
            settingsService: new MetahubSettingsService(schemaService)
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
            const { attributesService, objectsService, enumerationValuesService, constantsService, ds, manager, settingsService } =
                services(req)
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
                codenameInput,
                codenamePrimaryLocale,
                dataType,
                name,
                namePrimaryLocale,
                targetEntityId,
                targetEntityKind,
                targetConstantId,
                validationRules,
                uiConfig,
                isRequired,
                isDisplayAttribute,
                sortOrder,
                parentAttributeId
            } = parsed.data
            const shouldBeDisplayAttribute = Boolean(isDisplayAttribute)
            const effectiveIsRequired = shouldBeDisplayAttribute || Boolean(isRequired)

            // Load all settings in one query to avoid N+1
            const allSettings = await settingsService.findAll(metahubId, userId)

            // Check allowedAttributeTypes setting
            const allowedTypes = extractAllowedAttributeTypes(allSettings)
            if (allowedTypes.length > 0 && !allowedTypes.includes(dataType)) {
                return res.status(400).json({
                    error: `Attribute data type "${dataType}" is not allowed by metahub settings`,
                    code: 'DATA_TYPE_NOT_ALLOWED',
                    allowedTypes
                })
            }

            // TABLE-specific validation
            if (dataType === AttributeDataType.TABLE) {
                if (parentAttributeId) {
                    return res.status(400).json({
                        error: 'Nested TABLE attributes are not allowed',
                        code: 'NESTED_TABLE_FORBIDDEN'
                    })
                }
                if (shouldBeDisplayAttribute) {
                    return res.status(400).json({
                        error: 'TABLE attributes cannot be set as display attribute'
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

            // Resolve target entity from polymorphic reference fields
            const resolvedTargetEntityId = targetEntityId
            const resolvedTargetEntityKind = targetEntityKind
            const resolvedTargetConstantId = targetConstantId

            const codenameStyle = extractCodenameStyle(allSettings)
            const codenameAlphabet = extractCodenameAlphabet(allSettings)
            const allowMixed = extractAllowMixedAlphabets(allSettings)
            const normalizedCodename = normalizeCodenameForStyle(codename, codenameStyle, codenameAlphabet)
            if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
                })
            }

            const codenameScope = extractAttributeCodenameScope(allSettings)

            // For REF type, verify target entity exists and validate required fields
            if (dataType === AttributeDataType.REF) {
                if (!resolvedTargetEntityId || !resolvedTargetEntityKind) {
                    return res.status(400).json({
                        error: 'REF type requires targetEntityId and targetEntityKind'
                    })
                }
                if (
                    resolvedTargetEntityKind !== MetaEntityKind.CATALOG &&
                    resolvedTargetEntityKind !== ENUMERATION_KIND &&
                    resolvedTargetEntityKind !== SET_KIND
                ) {
                    return res.status(400).json({
                        error: 'Unsupported targetEntityKind for REF',
                        details: { targetEntityKind: resolvedTargetEntityKind }
                    })
                }

                const targetEntity = await objectsService.findById(metahubId, resolvedTargetEntityId, userId)
                if (!targetEntity || targetEntity.kind !== resolvedTargetEntityKind) {
                    return res.status(400).json({
                        error:
                            resolvedTargetEntityKind === ENUMERATION_KIND
                                ? 'Target enumeration not found'
                                : resolvedTargetEntityKind === SET_KIND
                                ? 'Target set not found'
                                : 'Target catalog not found'
                    })
                }

                if (resolvedTargetEntityKind === SET_KIND) {
                    if (!resolvedTargetConstantId) {
                        return res.status(400).json({
                            error: 'REF type with targetEntityKind=set requires targetConstantId'
                        })
                    }
                    const constantBelongsToSet = await constantsService.belongsToSet(
                        metahubId,
                        resolvedTargetEntityId,
                        resolvedTargetConstantId,
                        userId
                    )
                    if (!constantBelongsToSet) {
                        return res.status(400).json({
                            error: 'Target constant not found in selected set'
                        })
                    }
                } else if (resolvedTargetConstantId !== undefined && resolvedTargetConstantId !== null) {
                    return res.status(400).json({
                        error: 'targetConstantId is only supported for targetEntityKind=set'
                    })
                }
            }
            if (dataType !== AttributeDataType.REF && resolvedTargetConstantId !== undefined) {
                return res.status(400).json({
                    error: 'targetConstantId is only supported for REF type'
                })
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

            const codenameLocalized = buildCodenameLocalizedVlc(codenameInput, codenamePrimaryLocale, namePrimaryLocale ?? 'en')

            let globalCodenameLockKey: string | null = null
            if (codenameScope === 'global') {
                globalCodenameLockKey = uuidToLockKey(`attribute-codename-global:${metahubId}:${catalogId}`)
                const lockAcquired = await acquireAdvisoryLock(KnexClient.getInstance(), globalCodenameLockKey)
                if (!lockAcquired) {
                    return res.status(409).json({ error: GLOBAL_ATTRIBUTE_CODENAME_LOCK_ERROR })
                }
            }

            // Normalize sort orders (scoped to siblings at same parent level)
            let attribute
            try {
                // Check for duplicate codename (respecting scope setting)
                const existing = await attributesService.findByCodename(
                    metahubId,
                    catalogId,
                    normalizedCodename,
                    parentAttributeId ?? null,
                    userId,
                    undefined,
                    { ignoreParentScope: codenameScope === 'global' }
                )
                if (existing) {
                    return res.status(409).json({ error: 'Attribute with this codename already exists' })
                }

                await attributesService.ensureSequentialSortOrder(metahubId, catalogId, userId, parentAttributeId ?? null)

                // If sortOrder not provided, append to end
                // We can fetch max sort order or trust service default (0 might overlap)
                // Ideally we calculate max sort order here or in service.
                // Let's rely on client or default 0 (which might conflict if unique? sort_order is not unique in schema usually).
                // Actually, `ensureSequentialSortOrder` fixes it to 1..N. If we insert 0, we might need to reorder again.
                // Better: get count/max.
                // But let's simplify: pass provided sortOrder or default.

                attribute = await attributesService.create(
                    metahubId,
                    {
                        catalogId,
                        codename: normalizedCodename,
                        codenameLocalized,
                        dataType,
                        name: nameVlc,
                        targetEntityId: dataType === AttributeDataType.REF ? resolvedTargetEntityId : undefined,
                        targetEntityKind: dataType === AttributeDataType.REF ? resolvedTargetEntityKind : undefined,
                        targetConstantId:
                            dataType === AttributeDataType.REF && resolvedTargetEntityKind === SET_KIND
                                ? resolvedTargetConstantId
                                : undefined,
                        validationRules: validationRules ?? {},
                        uiConfig: normalizedUiConfig,
                        isRequired: effectiveIsRequired,
                        isDisplayAttribute: false,
                        sortOrder: sortOrder,
                        parentAttributeId: parentAttributeId ?? null,
                        createdBy: userId
                    },
                    userId
                )
            } catch (error) {
                if (error instanceof Error && error.message === GLOBAL_ATTRIBUTE_CODENAME_LOCK_ERROR) {
                    return res.status(409).json({ error: GLOBAL_ATTRIBUTE_CODENAME_LOCK_ERROR })
                }
                if (isUniqueViolation(error)) {
                    return res.status(409).json({ error: 'Attribute with this codename already exists' })
                }
                throw error
            } finally {
                if (globalCodenameLockKey) {
                    await releaseAdvisoryLock(KnexClient.getInstance(), globalCodenameLockKey)
                }
            }

            // Normalize again to fit new item (scoped to siblings)
            await attributesService.ensureSequentialSortOrder(metahubId, catalogId, userId, parentAttributeId ?? null)

            // If isDisplayAttribute was set, ensure exclusivity (clear from others)
            if (shouldBeDisplayAttribute) {
                await attributesService.setDisplayAttribute(metahubId, catalogId, attribute.id, userId)
            }

            await syncMetahubSchema(metahubId, ds, userId, manager).catch((err) => {
                console.error('[Attributes] Schema sync failed:', err)
            })

            res.status(201).json(attribute)
        })
    )

    /**
     * POST /metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/copy
     * Copy attribute with optional TABLE children copy.
     */
    router.post(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/copy',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/copy'
        ],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId, attributeId } = req.params
            const { attributesService, constantsService, ds, manager, settingsService } = services(req)
            const userId = resolveUserId(req)

            const source = await attributesService.findById(metahubId, attributeId, userId)
            if (!source || source.catalogId !== catalogId) {
                return res.status(404).json({ error: 'Attribute not found' })
            }

            const allowAttributeCopy = await getAllowAttributeCopy(settingsService, metahubId, userId)
            if (!allowAttributeCopy) {
                return res.status(403).json({ error: 'Attribute copy is disabled by metahub settings' })
            }

            const parsed = copyAttributeSchema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const copyOptions = {
                copyChildAttributes: parsed.data.copyChildAttributes !== false
            }

            const {
                style: codenameStyle,
                alphabet: codenameAlphabet,
                allowMixed
            } = await getCodenameSettings(settingsService, metahubId, userId)
            const copySuffix = codenameStyle === 'pascal-case' ? 'Copy' : '-copy'
            const normalizedBaseCodename = normalizeCodenameForStyle(
                parsed.data.codename ?? `${source.codename}${copySuffix}`,
                codenameStyle,
                codenameAlphabet
            )
            if (!normalizedBaseCodename || !isValidCodenameForStyle(normalizedBaseCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
                })
            }

            const requestedNameInput =
                parsed.data.name !== undefined ? sanitizeLocalizedInput(parsed.data.name) : buildDefaultCopyNameInput(source.name)
            const copyName = buildLocalizedContent(
                requestedNameInput,
                parsed.data.namePrimaryLocale ?? source.name?._primary ?? 'en',
                source.name?._primary ?? 'en'
            )
            if (!copyName) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const copyCodenameLocalized =
                parsed.data.codenameInput !== undefined
                    ? buildCodenameLocalizedVlc(
                          parsed.data.codenameInput,
                          parsed.data.codenamePrimaryLocale,
                          parsed.data.namePrimaryLocale ?? source.name?._primary ?? 'en'
                      )
                    : source.codenameLocalized

            // Apply overrides from request body if provided, otherwise use source values
            const copyValidationRules: Record<string, unknown> =
                parsed.data.validationRules !== undefined
                    ? (parsed.data.validationRules as Record<string, unknown>)
                    : (source.validationRules as Record<string, unknown> | undefined) ?? {}
            const copyUiConfig: Record<string, unknown> =
                parsed.data.uiConfig !== undefined
                    ? (parsed.data.uiConfig as Record<string, unknown>)
                    : { ...((source.uiConfig as Record<string, unknown> | undefined) ?? {}) }
            const copyIsRequired: boolean = parsed.data.isRequired !== undefined ? parsed.data.isRequired : Boolean(source.isRequired)

            if (parsed.data.targetConstantId !== undefined && source.targetEntityKind !== SET_KIND) {
                return res.status(400).json({
                    error: 'targetConstantId override is only supported for attributes referencing sets'
                })
            }
            const copyTargetConstantId = parsed.data.targetConstantId !== undefined ? parsed.data.targetConstantId : source.targetConstantId
            if (source.targetEntityKind === SET_KIND) {
                if (!source.targetEntityId) {
                    return res.status(400).json({ error: 'Source attribute has invalid set reference configuration' })
                }
                if (!copyTargetConstantId) {
                    return res.status(400).json({ error: 'Set reference copy requires targetConstantId' })
                }
                const constantBelongsToSet = await constantsService.belongsToSet(
                    metahubId,
                    source.targetEntityId,
                    copyTargetConstantId,
                    userId
                )
                if (!constantBelongsToSet) {
                    return res.status(400).json({
                        error: 'targetConstantId override must reference a constant from source target set'
                    })
                }
            }

            const knex = KnexClient.getInstance()
            let copyResult:
                | {
                      copiedAttribute: Awaited<ReturnType<MetahubAttributesService['create']>>
                      copiedChildAttributes: number
                  }
                | undefined
            const codenameScope = await getAttributeCodenameScope(settingsService, metahubId, userId)
            let globalCodenameLockKey: string | null = null
            if (codenameScope === 'global') {
                globalCodenameLockKey = uuidToLockKey(`attribute-codename-global:${metahubId}:${catalogId}`)
                const lockAcquired = await acquireAdvisoryLock(KnexClient.getInstance(), globalCodenameLockKey)
                if (!lockAcquired) {
                    return res.status(409).json({ error: GLOBAL_ATTRIBUTE_CODENAME_LOCK_ERROR })
                }
            }

            try {
                for (let attempt = 1; attempt <= CODENAME_RETRY_MAX_ATTEMPTS && !copyResult; attempt++) {
                    const codenameCandidate = buildCodenameAttempt(normalizedBaseCodename, attempt, codenameStyle)
                    try {
                        copyResult = await knex.transaction(async (trx) => {
                            const existing = await attributesService.findByCodename(
                                metahubId,
                                catalogId,
                                codenameCandidate,
                                source.parentAttributeId ?? null,
                                userId,
                                trx,
                                { ignoreParentScope: codenameScope === 'global' }
                            )
                            if (existing) {
                                throw Object.assign(new Error('Attribute codename already exists'), { retryableConflict: true })
                            }

                            const copiedAttribute = await attributesService.create(
                                metahubId,
                                {
                                    catalogId,
                                    codename: codenameCandidate,
                                    codenameLocalized: copyCodenameLocalized,
                                    dataType: source.dataType,
                                    name: copyName,
                                    validationRules: copyValidationRules,
                                    uiConfig: copyUiConfig,
                                    isRequired: copyIsRequired,
                                    isDisplayAttribute: false,
                                    targetEntityId: source.targetEntityId ?? undefined,
                                    targetEntityKind: source.targetEntityKind ?? undefined,
                                    targetConstantId: source.targetEntityKind === SET_KIND ? copyTargetConstantId ?? undefined : undefined,
                                    sortOrder: undefined,
                                    parentAttributeId: source.parentAttributeId ?? null,
                                    createdBy: userId
                                },
                                userId,
                                trx
                            )

                            let copiedChildAttributes = 0
                            if (source.dataType === AttributeDataType.TABLE && copyOptions.copyChildAttributes) {
                                const children = await attributesService.findChildAttributes(metahubId, source.id, userId, trx)
                                const usedChildCodenames = new Set<string>()
                                for (const child of children) {
                                    let childCodename = child.codename
                                    if (codenameScope === 'global') {
                                        let uniqueChildCodename: string | null = null
                                        for (let childAttempt = 1; childAttempt <= CODENAME_RETRY_MAX_ATTEMPTS; childAttempt++) {
                                            const candidate = buildCodenameAttempt(child.codename, childAttempt, codenameStyle)
                                            if (usedChildCodenames.has(candidate)) continue
                                            const existingChild = await attributesService.findByCodename(
                                                metahubId,
                                                catalogId,
                                                candidate,
                                                copiedAttribute.id,
                                                userId,
                                                trx,
                                                { ignoreParentScope: true }
                                            )
                                            if (!existingChild) {
                                                uniqueChildCodename = candidate
                                                break
                                            }
                                        }

                                        if (!uniqueChildCodename) {
                                            throw Object.assign(
                                                new Error('Unable to generate unique codename for copied child attribute'),
                                                {
                                                    retryableConflict: true
                                                }
                                            )
                                        }

                                        childCodename = uniqueChildCodename
                                    }

                                    usedChildCodenames.add(childCodename)
                                    await attributesService.create(
                                        metahubId,
                                        {
                                            catalogId,
                                            codename: childCodename,
                                            dataType: child.dataType,
                                            name: child.name,
                                            validationRules: (child.validationRules as Record<string, unknown> | undefined) ?? {},
                                            uiConfig: { ...((child.uiConfig as Record<string, unknown> | undefined) ?? {}) },
                                            isRequired: child.isDisplayAttribute ? true : Boolean(child.isRequired),
                                            isDisplayAttribute: Boolean(child.isDisplayAttribute),
                                            targetEntityId: child.targetEntityId ?? undefined,
                                            targetEntityKind: child.targetEntityKind ?? undefined,
                                            targetConstantId:
                                                child.targetEntityKind === SET_KIND ? child.targetConstantId ?? undefined : undefined,
                                            sortOrder: child.sortOrder,
                                            parentAttributeId: copiedAttribute.id,
                                            createdBy: userId
                                        },
                                        userId,
                                        trx
                                    )
                                    copiedChildAttributes += 1
                                }
                            }

                            return { copiedAttribute, copiedChildAttributes }
                        })
                    } catch (error: unknown) {
                        const retryableConflict =
                            (error &&
                                typeof error === 'object' &&
                                'retryableConflict' in error &&
                                (error as { retryableConflict?: boolean }).retryableConflict === true) ||
                            isUniqueViolation(error)
                        if (!retryableConflict) {
                            throw error
                        }
                    }
                }
            } finally {
                if (globalCodenameLockKey) {
                    await releaseAdvisoryLock(KnexClient.getInstance(), globalCodenameLockKey)
                }
            }

            if (!copyResult) {
                return res.status(409).json({ error: 'Unable to generate unique codename for attribute copy' })
            }

            await syncMetahubSchema(metahubId, ds, userId, manager).catch((err) => {
                console.error('[Attributes] Copy schema sync failed:', err)
            })

            return res.status(201).json({
                ...copyResult!.copiedAttribute,
                copyOptions,
                copiedChildAttributes: copyResult!.copiedChildAttributes
            })
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
            const { attributesService, objectsService, enumerationValuesService, constantsService, ds, manager, settingsService } =
                services(req)
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
                codenameInput,
                codenamePrimaryLocale,
                dataType,
                name,
                namePrimaryLocale,
                targetEntityId,
                targetEntityKind,
                targetConstantId,
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

            // Resolve target entity from polymorphic reference fields
            const resolvedTargetEntityId = targetEntityId
            const resolvedTargetEntityKind = targetEntityKind
            const resolvedTargetConstantId = targetConstantId
            const targetChanged =
                resolvedTargetEntityId !== undefined || resolvedTargetEntityKind !== undefined || resolvedTargetConstantId !== undefined

            const updateData: any = {}
            const effectiveDataType = dataType ?? attribute.dataType
            const requestedDisplayState = isDisplayAttribute !== undefined ? isDisplayAttribute : Boolean(attribute.isDisplayAttribute)
            if (requestedDisplayState && effectiveDataType === AttributeDataType.TABLE) {
                return res.status(400).json({
                    error: 'TABLE attributes cannot be set as display attribute'
                })
            }
            const isRefType = effectiveDataType === AttributeDataType.REF
            let codenameScope: 'per-level' | 'global' = 'per-level'

            let effectiveTargetEntityId = attribute.targetEntityId ?? null
            let effectiveTargetEntityKind = attribute.targetEntityKind ?? null
            let effectiveTargetConstantId = attribute.targetConstantId ?? null

            if (codename && codename !== attribute.codename) {
                const {
                    style: codenameStyle,
                    alphabet: codenameAlphabet,
                    allowMixed
                } = await getCodenameSettings(settingsService, metahubId, userId)
                const normalizedCodename = normalizeCodenameForStyle(codename, codenameStyle, codenameAlphabet)
                if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
                    })
                }
                if (normalizedCodename !== attribute.codename) {
                    codenameScope = await getAttributeCodenameScope(settingsService, metahubId, userId)
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

            if (codenameInput !== undefined) {
                updateData.codenameLocalized = buildCodenameLocalizedVlc(
                    codenameInput,
                    codenamePrimaryLocale,
                    attribute.name?._primary ?? namePrimaryLocale ?? 'en'
                )
            }

            // Handle polymorphic reference update
            if (resolvedTargetEntityId !== undefined || resolvedTargetEntityKind !== undefined || resolvedTargetConstantId !== undefined) {
                if (resolvedTargetEntityId === null) {
                    // Clear reference
                    effectiveTargetEntityId = null
                    effectiveTargetEntityKind = null
                    effectiveTargetConstantId = null
                    updateData.targetEntityId = null
                    updateData.targetEntityKind = null
                    updateData.targetConstantId = null
                } else if (isRefType) {
                    effectiveTargetEntityId = resolvedTargetEntityId ?? effectiveTargetEntityId
                    effectiveTargetEntityKind = resolvedTargetEntityKind ?? effectiveTargetEntityKind

                    if (!effectiveTargetEntityId || !effectiveTargetEntityKind) {
                        return res.status(400).json({
                            error: 'REF type requires targetEntityId and targetEntityKind'
                        })
                    }

                    if (
                        effectiveTargetEntityKind !== MetaEntityKind.CATALOG &&
                        effectiveTargetEntityKind !== ENUMERATION_KIND &&
                        effectiveTargetEntityKind !== SET_KIND
                    ) {
                        return res.status(400).json({
                            error: 'Unsupported targetEntityKind for REF',
                            details: { targetEntityKind: effectiveTargetEntityKind }
                        })
                    }

                    const targetEntity = await objectsService.findById(metahubId, effectiveTargetEntityId, userId)
                    if (!targetEntity || targetEntity.kind !== effectiveTargetEntityKind) {
                        return res.status(400).json({
                            error:
                                effectiveTargetEntityKind === ENUMERATION_KIND
                                    ? 'Target enumeration not found'
                                    : effectiveTargetEntityKind === SET_KIND
                                    ? 'Target set not found'
                                    : 'Target catalog not found'
                        })
                    }

                    if (effectiveTargetEntityKind === SET_KIND) {
                        effectiveTargetConstantId =
                            resolvedTargetConstantId !== undefined ? resolvedTargetConstantId : effectiveTargetConstantId
                        if (!effectiveTargetConstantId) {
                            return res.status(400).json({
                                error: 'REF type with targetEntityKind=set requires targetConstantId'
                            })
                        }
                        const constantBelongsToSet = await constantsService.belongsToSet(
                            metahubId,
                            effectiveTargetEntityId,
                            effectiveTargetConstantId,
                            userId
                        )
                        if (!constantBelongsToSet) {
                            return res.status(400).json({
                                error: 'Target constant not found in selected set'
                            })
                        }
                        if (resolvedTargetConstantId !== undefined) {
                            updateData.targetConstantId = resolvedTargetConstantId
                        } else if (resolvedTargetEntityId !== undefined || resolvedTargetEntityKind !== undefined) {
                            updateData.targetConstantId = effectiveTargetConstantId
                        }
                    } else {
                        if (resolvedTargetConstantId !== undefined && resolvedTargetConstantId !== null) {
                            return res.status(400).json({
                                error: 'targetConstantId is only supported for targetEntityKind=set'
                            })
                        }
                        effectiveTargetConstantId = null
                        if (attribute.targetConstantId !== null || resolvedTargetConstantId !== undefined) {
                            updateData.targetConstantId = null
                        }
                    }

                    if (resolvedTargetEntityId !== undefined) updateData.targetEntityId = resolvedTargetEntityId
                    if (resolvedTargetEntityKind !== undefined) updateData.targetEntityKind = resolvedTargetEntityKind
                }
            }

            if (resolvedTargetConstantId !== undefined && !isRefType) {
                return res.status(400).json({
                    error: 'targetConstantId is only supported for REF type'
                })
            }

            if (validationRules) updateData.validationRules = validationRules
            const effectiveIsRequired = Boolean(isRequired ?? attribute.isRequired) || requestedDisplayState
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
                updateData.isRequired = effectiveDataType === AttributeDataType.TABLE ? false : effectiveIsRequired
            } else if (isDisplayAttribute === true) {
                updateData.isRequired = true
            }
            // isDisplayAttribute is handled separately via setDisplayAttribute for atomicity
            if (sortOrder !== undefined) updateData.sortOrder = sortOrder
            if (expectedVersion !== undefined) updateData.expectedVersion = expectedVersion
            updateData.updatedBy = userId

            let globalCodenameLockKey: string | null = null
            if (updateData.codename && codenameScope === 'global') {
                globalCodenameLockKey = uuidToLockKey(`attribute-codename-global:${metahubId}:${catalogId}`)
                const lockAcquired = await acquireAdvisoryLock(KnexClient.getInstance(), globalCodenameLockKey)
                if (!lockAcquired) {
                    return res.status(409).json({ error: GLOBAL_ATTRIBUTE_CODENAME_LOCK_ERROR })
                }
            }

            let updated
            try {
                if (updateData.codename) {
                    const existing = await attributesService.findByCodename(
                        metahubId,
                        catalogId,
                        updateData.codename,
                        attribute.parentAttributeId ?? null,
                        userId,
                        undefined,
                        { ignoreParentScope: codenameScope === 'global' }
                    )
                    if (existing) {
                        return res.status(409).json({ error: 'Attribute with this codename already exists' })
                    }
                }

                updated = await attributesService.update(metahubId, attributeId, updateData, userId)
            } finally {
                if (globalCodenameLockKey) {
                    await releaseAdvisoryLock(KnexClient.getInstance(), globalCodenameLockKey)
                }
            }

            // Handle isDisplayAttribute change atomically (clears flag from other attributes)
            if (isDisplayAttribute === true) {
                await attributesService.setDisplayAttribute(metahubId, catalogId, attributeId, userId)
            } else if (isDisplayAttribute === false) {
                try {
                    await attributesService.clearDisplayAttribute(metahubId, attributeId, userId)
                } catch (error) {
                    if (error instanceof Error && error.message === 'At least one display attribute is required in each scope') {
                        return res.status(409).json({
                            error: 'Cannot clear display attribute. Set another attribute as display first.'
                        })
                    }
                    throw error
                }
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
     * PATCH /metahub/:metahubId/hub/:hubId/catalog/:catalogId/attributes/reorder
     * PATCH /metahub/:metahubId/catalog/:catalogId/attributes/reorder
     * Reorder an attribute within its list, or transfer to a different parent list (cross-list DnD)
     */
    const reorderAttributeSchema = z.object({
        attributeId: z.string().uuid(),
        newSortOrder: z.number().int().min(1),
        newParentAttributeId: z.string().uuid().nullable().optional(),
        autoRenameCodename: z.boolean().optional()
    })

    router.patch(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attributes/reorder',
            '/metahub/:metahubId/catalog/:catalogId/attributes/reorder'
        ],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
            const { attributesService, settingsService } = services(req)
            const userId = resolveUserId(req)

            const parsed = reorderAttributeSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { attributeId, newSortOrder, newParentAttributeId, autoRenameCodename } = parsed.data

            // Load codename settings from the route layer (service doesn't own settingsService)
            const codenameScope = await getAttributeCodenameScope(settingsService, metahubId, userId)
            const { style: codenameStyle } = await getCodenameSettings(settingsService, metahubId, userId)
            const allowCrossListRootChildren = await getAllowAttributeMoveBetweenRootAndChildren(settingsService, metahubId, userId)
            const allowCrossListBetweenChildren = await getAllowAttributeMoveBetweenChildLists(settingsService, metahubId, userId)

            try {
                const updated = await attributesService.reorderAttribute(
                    metahubId,
                    catalogId,
                    attributeId,
                    newSortOrder,
                    newParentAttributeId,
                    codenameScope as 'per-level' | 'global',
                    codenameStyle as 'kebab-case' | 'pascal-case',
                    allowCrossListRootChildren,
                    allowCrossListBetweenChildren,
                    autoRenameCodename,
                    userId
                )
                res.json(updated)
            } catch (error: any) {
                if (error.message?.startsWith('CODENAME_CONFLICT')) {
                    return res.status(409).json({
                        message: error.message,
                        code: 'CODENAME_CONFLICT',
                        codename: error.codename
                    })
                }
                if (error.message?.startsWith('DISPLAY_ATTRIBUTE_TRANSFER_BLOCKED')) {
                    return res.status(422).json({ message: error.message, code: 'DISPLAY_ATTRIBUTE_TRANSFER_BLOCKED' })
                }
                if (error.message?.startsWith('TRANSFER_NOT_ALLOWED')) {
                    return res.status(403).json({ message: error.message, code: 'TRANSFER_NOT_ALLOWED' })
                }
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

            const newValue = !attribute.isRequired
            if (attribute.isDisplayAttribute && !newValue) {
                return res.status(400).json({
                    error: 'Display attribute must be required'
                })
            }

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
            const { attributesService, ds, manager, settingsService } = services(req)
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

            try {
                await attributesService.clearDisplayAttribute(metahubId, attributeId, userId)
            } catch (error) {
                if (error instanceof Error && error.message === 'At least one display attribute is required in each scope') {
                    return res.status(409).json({
                        error: 'Cannot clear display attribute. Set another attribute as display first.'
                    })
                }
                throw error
            }

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
            const { attributesService, settingsService, ds, manager } = services(req)
            const userId = resolveUserId(req)

            const attribute = await attributesService.findById(metahubId, attributeId, userId)
            if (!attribute || attribute.catalogId !== catalogId) {
                return res.status(404).json({ error: 'Attribute not found' })
            }

            const allowAttributeDelete = await getAllowAttributeDelete(settingsService, metahubId, userId)
            if (!allowAttributeDelete) {
                return res.status(403).json({ error: 'Attribute delete is disabled by metahub settings' })
            }

            if (attribute.isDisplayAttribute) {
                const allowDeleteLastDisplayAttribute = await getAllowDeleteLastDisplayAttribute(settingsService, metahubId, userId)
                if (!allowDeleteLastDisplayAttribute) {
                    const scopedAttributes = attribute.parentAttributeId
                        ? await attributesService.findChildAttributes(metahubId, attribute.parentAttributeId, userId)
                        : await attributesService.findAll(metahubId, catalogId, userId)

                    const displayAttributesCount = scopedAttributes.reduce(
                        (count, scopedAttribute) => count + (scopedAttribute.isDisplayAttribute ? 1 : 0),
                        0
                    )

                    if (displayAttributesCount <= 1) {
                        return res.status(409).json({
                            error: 'Cannot delete the last display attribute while this policy is disabled.'
                        })
                    }
                }
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

    // ─── All attribute codenames (for global scope duplicate checking) ────────

    /**
     * GET /metahub/:metahubId/catalog/:catalogId/attribute-codenames
     * Returns lightweight list of ALL attribute codenames (root + children) for the catalog.
     * Used by the frontend when attributeCodenameScope = 'global' to enable cross-level
     * duplicate checking in the UI.
     */
    router.get(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute-codenames',
            '/metahub/:metahubId/catalog/:catalogId/attribute-codenames'
        ],
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
            const { attributesService } = services(req)
            const userId = resolveUserId(req)

            const allAttributes = await attributesService.findAllFlat(metahubId, catalogId, userId)

            const items = allAttributes.map((attr) => ({
                id: attr.id,
                codename: attr.codename,
                codenameLocalized: attr.codenameLocalized ?? null
            }))

            res.json({ items })
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
            const { attributesService, objectsService, enumerationValuesService, constantsService, ds, manager, settingsService } =
                services(req)
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
                codenameInput,
                codenamePrimaryLocale,
                dataType,
                name,
                namePrimaryLocale,
                targetEntityId,
                targetEntityKind,
                targetConstantId,
                validationRules,
                uiConfig,
                isRequired,
                sortOrder
            } = parsed.data
            const shouldBeDisplayAttribute = Boolean(req.body.isDisplayAttribute)
            const effectiveIsRequired = shouldBeDisplayAttribute || Boolean(isRequired)

            // Load all settings in one query to avoid N+1
            const allSettings = await settingsService.findAll(metahubId, userId)

            // Check allowedAttributeTypes setting
            const allowedTypes = extractAllowedAttributeTypes(allSettings)
            if (allowedTypes.length > 0 && !allowedTypes.includes(dataType)) {
                return res.status(400).json({
                    error: `Attribute data type "${dataType}" is not allowed by metahub settings`,
                    code: 'DATA_TYPE_NOT_ALLOWED',
                    allowedTypes
                })
            }

            // Validate child data type
            if (!TABLE_CHILD_DATA_TYPES.includes(dataType as any)) {
                return res.status(400).json({
                    error: `Data type "${dataType}" is not allowed for child attributes`,
                    code: 'INVALID_CHILD_DATA_TYPE'
                })
            }

            const codenameStyle = extractCodenameStyle(allSettings)
            const codenameAlphabet = extractCodenameAlphabet(allSettings)
            const allowMixed = extractAllowMixedAlphabets(allSettings)
            const normalizedCodename = normalizeCodenameForStyle(codename, codenameStyle, codenameAlphabet)
            if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
                })
            }

            const resolvedTargetEntityId = targetEntityId
            const resolvedTargetEntityKind = targetEntityKind
            const resolvedTargetConstantId = targetConstantId

            if (dataType === AttributeDataType.REF) {
                if (!resolvedTargetEntityId || !resolvedTargetEntityKind) {
                    return res.status(400).json({
                        error: 'REF type requires targetEntityId and targetEntityKind'
                    })
                }
                if (
                    resolvedTargetEntityKind !== MetaEntityKind.CATALOG &&
                    resolvedTargetEntityKind !== ENUMERATION_KIND &&
                    resolvedTargetEntityKind !== SET_KIND
                ) {
                    return res.status(400).json({
                        error: 'Unsupported targetEntityKind for REF',
                        details: { targetEntityKind: resolvedTargetEntityKind }
                    })
                }

                const targetEntity = await objectsService.findById(metahubId, resolvedTargetEntityId, userId)
                if (!targetEntity || targetEntity.kind !== resolvedTargetEntityKind) {
                    return res.status(400).json({
                        error:
                            resolvedTargetEntityKind === ENUMERATION_KIND
                                ? 'Target enumeration not found'
                                : resolvedTargetEntityKind === SET_KIND
                                ? 'Target set not found'
                                : 'Target catalog not found'
                    })
                }

                if (resolvedTargetEntityKind === SET_KIND) {
                    if (!resolvedTargetConstantId) {
                        return res.status(400).json({
                            error: 'REF type with targetEntityKind=set requires targetConstantId'
                        })
                    }
                    const constantBelongsToSet = await constantsService.belongsToSet(
                        metahubId,
                        resolvedTargetEntityId,
                        resolvedTargetConstantId,
                        userId
                    )
                    if (!constantBelongsToSet) {
                        return res.status(400).json({
                            error: 'Target constant not found in selected set'
                        })
                    }
                } else if (resolvedTargetConstantId !== undefined && resolvedTargetConstantId !== null) {
                    return res.status(400).json({
                        error: 'targetConstantId is only supported for targetEntityKind=set'
                    })
                }
            }
            if (dataType !== AttributeDataType.REF && resolvedTargetConstantId !== undefined) {
                return res.status(400).json({
                    error: 'targetConstantId is only supported for REF type'
                })
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

            const codenameScope = await getAttributeCodenameScope(settingsService, metahubId, userId)

            const sanitizedName = sanitizeLocalizedInput(name ?? {})
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }
            const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, namePrimaryLocale ?? 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const codenameLocalized = buildCodenameLocalizedVlc(codenameInput, codenamePrimaryLocale, namePrimaryLocale ?? 'en')

            let globalCodenameLockKey: string | null = null
            if (codenameScope === 'global') {
                globalCodenameLockKey = uuidToLockKey(`attribute-codename-global:${metahubId}:${catalogId}`)
                const lockAcquired = await acquireAdvisoryLock(KnexClient.getInstance(), globalCodenameLockKey)
                if (!lockAcquired) {
                    return res.status(409).json({ error: GLOBAL_ATTRIBUTE_CODENAME_LOCK_ERROR })
                }
            }

            let attribute
            try {
                const existing = await attributesService.findByCodename(
                    metahubId,
                    catalogId,
                    normalizedCodename,
                    attributeId,
                    userId,
                    undefined,
                    { ignoreParentScope: codenameScope === 'global' }
                )
                if (existing) {
                    return res.status(409).json({ error: 'Attribute with this codename already exists' })
                }

                attribute = await attributesService.create(
                    metahubId,
                    {
                        catalogId,
                        codename: normalizedCodename,
                        codenameLocalized,
                        dataType,
                        name: nameVlc,
                        validationRules: validationRules ?? {},
                        uiConfig: normalizedUiConfig,
                        isRequired: effectiveIsRequired,
                        isDisplayAttribute: false,
                        targetEntityId: resolvedTargetEntityId,
                        targetEntityKind: resolvedTargetEntityKind,
                        targetConstantId: resolvedTargetEntityKind === SET_KIND ? resolvedTargetConstantId : undefined,
                        sortOrder,
                        parentAttributeId: attributeId,
                        createdBy: userId
                    },
                    userId
                )
            } catch (error) {
                if (isUniqueViolation(error)) {
                    return res.status(409).json({ error: 'Attribute with this codename already exists' })
                }
                throw error
            } finally {
                if (globalCodenameLockKey) {
                    await releaseAdvisoryLock(KnexClient.getInstance(), globalCodenameLockKey)
                }
            }

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
