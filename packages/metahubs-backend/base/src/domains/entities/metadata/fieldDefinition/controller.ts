import { z } from 'zod'
import type { Request, Response } from 'express'
import type { DbExecutor, SqlQueryable } from '@universo/utils'
import { localizedContent, OptimisticLockError } from '@universo/utils'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '@universo/utils/validation/codename'
const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
import {
    FieldDefinitionDataType,
    FIELD_DEFINITION_DATA_TYPES,
    TABLE_CHILD_DATA_TYPES,
    isEnabledComponentConfig,
    type EntityKind,
    type ResolvedEntityType,
    type TableChildDataType
} from '@universo/types'
import { MetahubSchemaService } from '../../../metahubs/services/MetahubSchemaService'
import { MetahubFieldDefinitionsService } from '../../../metahubs/services/MetahubFieldDefinitionsService'
import { MetahubObjectsService } from '../../../metahubs/services/MetahubObjectsService'
import { MetahubOptionValuesService } from '../../../metahubs/services/MetahubOptionValuesService'
import { MetahubFixedValuesService } from '../../../metahubs/services/MetahubFixedValuesService'
import { MetahubSettingsService } from '../../../settings/services/MetahubSettingsService'
import { EntityTypeService } from '../../services/EntityTypeService'
import { ListQuerySchema } from '../../../shared/queryParams'
import { getRequestDbExecutor } from '../../../../utils'
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
    getAllowFieldDefinitionCopy,
    getAllowFieldDefinitionDelete,
    getAllowDeleteLastDisplayAttribute,
    getAllowAttributeMoveBetweenRootAndChildren,
    getAllowAttributeMoveBetweenChildLists,
    CODENAME_RETRY_MAX_ATTEMPTS
} from '../../../shared/codenameStyleHelper'
import {
    requiredCodenamePayloadSchema,
    optionalCodenamePayloadSchema,
    getCodenamePayloadText,
    syncCodenamePayloadText,
    syncOptionalCodenamePayloadText
} from '../../../shared/codenamePayload'
import { readPlatformSystemFieldDefinitionsPolicy, shouldExposeCatalogSystemField } from '../../../shared'
import { createEnsureMetahubRouteAccess } from '../../../shared/guards'
import { respondSchemaSyncFailure, isSchemaSyncFailure, syncMetahubSchemaOrThrow, isUniqueViolation } from '../../../shared/errorGuards'
import { uuidToLockKey, acquirePoolAdvisoryLock, releasePoolAdvisoryLock } from '../../../ddl'

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

const getForbiddenSystemFieldDefinitionPatchKeys = (data: Record<string, unknown>): string[] => {
    const allowedKeys = new Set(['isEnabled', 'expectedVersion'])
    return Object.keys(data).filter((key) => data[key] !== undefined && !allowedKeys.has(key))
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENUM_PRESENTATION_MODES = ['select', 'radio', 'label'] as const
const ENUM_LABEL_EMPTY_DISPLAY_MODES = ['empty', 'dash'] as const
const ENUMERATION_KIND = 'enumeration' as const
const SET_KIND = 'set' as const
const ATTRIBUTE_LIMIT = 100
const GLOBAL_ATTRIBUTE_CODENAME_LOCK_ERROR = 'Could not acquire attribute codename lock. Please retry.'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const FieldDefinitionsListQuerySchema = ListQuerySchema.extend({
    sortBy: z.enum(['name', 'created', 'updated', 'codename', 'sortOrder']).default('sortOrder'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    locale: z.string().trim().min(2).max(10).optional(),
    scope: z.enum(['business', 'system', 'all']).default('business'),
    includeShared: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false)
})

const validateFieldDefinitionsListQuery = (query: unknown) => FieldDefinitionsListQuerySchema.parse(query)

const validationRulesSchema = z
    .object({
        required: z.boolean().nullable().optional(),
        minLength: z.number().int().min(0).max(10000).nullable().optional(),
        maxLength: z.number().int().min(1).max(10000).nullable().optional(),
        pattern: z.string().max(500).nullable().optional(),
        options: z.array(z.string().max(200)).max(100).nullable().optional(),
        versioned: z.boolean().nullable().optional(),
        localized: z.boolean().nullable().optional(),
        precision: z.number().int().min(1).max(15).nullable().optional(),
        scale: z.number().int().min(0).max(14).nullable().optional(),
        min: z.number().nullable().optional(),
        max: z.number().nullable().optional(),
        nonNegative: z.boolean().nullable().optional(),
        dateComposition: z.enum(['date', 'time', 'datetime']).nullable().optional(),
        minRows: z.number().int().min(0).nullable().optional(),
        maxRows: z.number().int().min(1).nullable().optional(),
        maxChildAttributes: z.number().int().min(1).nullable().optional()
    })
    .optional()
    .refine(
        (rules) => {
            if (!rules) return true
            if (typeof rules.scale === 'number' && rules.scale !== null) {
                const effectivePrecision = typeof rules.precision === 'number' && rules.precision !== null ? rules.precision : 10
                if (rules.scale >= effectivePrecision) return false
            }
            if (typeof rules.min === 'number' && rules.min !== null && typeof rules.max === 'number' && rules.max !== null) {
                if (rules.min > rules.max) return false
            }
            if (
                typeof rules.minLength === 'number' &&
                rules.minLength !== null &&
                typeof rules.maxLength === 'number' &&
                rules.maxLength !== null
            ) {
                if (rules.minLength > rules.maxLength) return false
            }
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
        rows: z.number().int().min(2).max(12).optional(),
        placeholder: z.record(z.string()).optional(),
        helpText: z.record(z.string()).optional(),
        hidden: z.boolean().optional(),
        width: z.number().optional(),
        headerAsCheckbox: z.boolean().optional(),
        sharedBehavior: z
            .object({
                canDeactivate: z.boolean().optional(),
                canExclude: z.boolean().optional(),
                positionLocked: z.boolean().optional()
            })
            .optional(),
        enumPresentationMode: z.enum(ENUM_PRESENTATION_MODES).optional(),
        defaultEnumValueId: z.string().uuid().nullable().optional(),
        enumAllowEmpty: z.boolean().optional(),
        enumLabelEmptyDisplay: z.enum(ENUM_LABEL_EMPTY_DISPLAY_MODES).optional(),
        showTitle: z.boolean().optional()
    })
    .optional()

const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))
const targetEntityKindSchema = z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((value) => value as EntityKind)

const createFieldDefinitionSchema = z
    .object({
        codename: requiredCodenamePayloadSchema,
        dataType: z.enum(FIELD_DEFINITION_DATA_TYPES),
        name: localizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        targetEntityId: z.string().uuid().optional(),
        targetEntityKind: targetEntityKindSchema.optional(),
        targetConstantId: z.string().uuid().optional(),
        validationRules: validationRulesSchema,
        uiConfig: uiConfigSchema,
        isRequired: z.boolean().optional(),
        isDisplayAttribute: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        parentAttributeId: z.string().uuid().nullish()
    })
    .strict()

const updateFieldDefinitionSchema = z
    .object({
        codename: optionalCodenamePayloadSchema,
        dataType: z.enum(FIELD_DEFINITION_DATA_TYPES).optional(),
        name: localizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        targetEntityId: z.string().uuid().nullable().optional(),
        targetEntityKind: targetEntityKindSchema.nullable().optional(),
        targetConstantId: z.string().uuid().nullable().optional(),
        validationRules: validationRulesSchema,
        uiConfig: uiConfigSchema,
        isRequired: z.boolean().optional(),
        isDisplayAttribute: z.boolean().optional(),
        isEnabled: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

const moveFieldDefinitionSchema = z
    .object({
        direction: z.enum(['up', 'down'])
    })
    .strict()

const copyFieldDefinitionSchema = z
    .object({
        codename: optionalCodenamePayloadSchema,
        name: localizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        copyChildFieldDefinitions: z.boolean().optional(),
        validationRules: validationRulesSchema,
        uiConfig: uiConfigSchema,
        isRequired: z.boolean().optional(),
        targetConstantId: z.string().uuid().nullable().optional()
    })
    .strict()

const reorderFieldDefinitionSchema = z
    .object({
        fieldDefinitionId: z.string().uuid(),
        newSortOrder: z.number().int().min(1),
        newParentAttributeId: z.string().uuid().nullable().optional(),
        autoRenameCodename: z.boolean().optional(),
        mergedOrderIds: z.array(z.string().uuid()).min(1).optional()
    })
    .strict()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const normalizeMultilineUiConfig = (
    dataType: FieldDefinitionDataType,
    sourceUiConfig: Record<string, unknown>
): { uiConfig: Record<string, unknown>; error?: string } => {
    const nextUiConfig = { ...sourceUiConfig }

    if (nextUiConfig.widget === 'textarea' && dataType !== FieldDefinitionDataType.STRING) {
        return {
            uiConfig: nextUiConfig,
            error: 'Multiline editor is supported only for STRING attributes'
        }
    }

    if (dataType !== FieldDefinitionDataType.STRING) {
        delete nextUiConfig.rows
        return { uiConfig: nextUiConfig }
    }

    if (nextUiConfig.widget !== 'textarea') {
        delete nextUiConfig.rows
        return { uiConfig: nextUiConfig }
    }

    if (typeof nextUiConfig.rows !== 'number' || !Number.isInteger(nextUiConfig.rows) || nextUiConfig.rows < 2 || nextUiConfig.rows > 12) {
        nextUiConfig.rows = 4
    }

    return { uiConfig: nextUiConfig }
}

const isTableChildDataType = (value: FieldDefinitionDataType): value is TableChildDataType =>
    (TABLE_CHILD_DATA_TYPES as readonly string[]).includes(value)

const isReferenceableEntityType = (resolvedType: ResolvedEntityType | null | undefined) =>
    Boolean(
        resolvedType &&
            (resolvedType.kindKey === ENUMERATION_KIND ||
                resolvedType.kindKey === SET_KIND ||
                isEnabledComponentConfig(resolvedType.components.dataSchema))
    )

const getMissingReferenceTargetMessage = (targetEntityKind: EntityKind): string => {
    if (targetEntityKind === ENUMERATION_KIND) {
        return 'Target enumeration not found'
    }
    if (targetEntityKind === SET_KIND) {
        return 'Target set not found'
    }
    if (targetEntityKind === 'catalog') {
        return 'Target catalog not found'
    }
    return 'Target entity not found'
}

const validateReferenceTarget = async ({
    metahubId,
    targetEntityId,
    targetEntityKind,
    targetConstantId,
    userId,
    objectsService,
    fixedValuesService,
    entityTypeService
}: {
    metahubId: string
    targetEntityId: string
    targetEntityKind: EntityKind
    targetConstantId?: string | null
    userId?: string
    objectsService: MetahubObjectsService
    fixedValuesService: MetahubFixedValuesService
    entityTypeService: EntityTypeService
}): Promise<{ error: string; details?: Record<string, unknown> } | null> => {
    const resolvedType = await entityTypeService.resolveType(metahubId, targetEntityKind, userId)

    if (!isReferenceableEntityType(resolvedType)) {
        return {
            error: 'Unsupported targetEntityKind for REF',
            details: { targetEntityKind }
        }
    }

    const targetEntity = await objectsService.findById(metahubId, targetEntityId, userId)
    if (!targetEntity || targetEntity.kind !== targetEntityKind) {
        return { error: getMissingReferenceTargetMessage(targetEntityKind) }
    }

    if (targetEntityKind === SET_KIND) {
        if (!targetConstantId) {
            return {
                error: 'REF type with targetEntityKind=set requires targetConstantId'
            }
        }

        const constantBelongsToSet = await fixedValuesService.belongsToSet(metahubId, targetEntityId, targetConstantId, userId)
        if (!constantBelongsToSet) {
            return {
                error: 'Target constant not found in selected set'
            }
        }

        return null
    }

    if (targetConstantId !== undefined && targetConstantId !== null) {
        return {
            error: 'targetConstantId is only supported for targetEntityKind=set'
        }
    }

    return null
}

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

type CreateHandler = ReturnType<typeof import('../../../shared/createMetahubHandler').createMetahubHandlerFactory>

export function createFieldDefinitionsController(_createHandler: CreateHandler, getDbExecutor: () => DbExecutor) {
    const services = (req: Request) => {
        const exec = getRequestDbExecutor(req, getDbExecutor())
        const schemaService = new MetahubSchemaService(exec)
        return {
            exec,
            fieldDefinitionsService: new MetahubFieldDefinitionsService(exec, schemaService),
            objectsService: new MetahubObjectsService(exec, schemaService),
            optionValuesService: new MetahubOptionValuesService(exec, schemaService),
            fixedValuesService: new MetahubFixedValuesService(exec, schemaService),
            entityTypeService: new EntityTypeService(exec, schemaService),
            schemaService,
            settingsService: new MetahubSettingsService(exec, schemaService)
        }
    }

    const ensureMetahubRouteAccess = createEnsureMetahubRouteAccess(getDbExecutor)

    // ─── List attributes ─────────────────────────────────────────────────
    const list = async (req: Request, res: Response) => {
        const { metahubId, linkedCollectionId } = req.params
        const { fieldDefinitionsService, exec } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId)
        if (!userId) return
        const platformSystemFieldDefinitionsPolicy = await readPlatformSystemFieldDefinitionsPolicy(exec)

        let validatedQuery
        try {
            validatedQuery = validateFieldDefinitionsListQuery(req.query)
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
            }
            throw error
        }

        const { limit, offset, sortBy, sortOrder, search, locale, scope, includeShared } = validatedQuery

        let items =
            includeShared && scope === 'business'
                ? await fieldDefinitionsService.findAllMerged(metahubId, linkedCollectionId, userId, scope)
                : await fieldDefinitionsService.findAll(metahubId, linkedCollectionId, userId, scope)

        if (scope !== 'business') {
            items = items.filter((item) =>
                shouldExposeCatalogSystemField(item.system?.systemKey ?? null, platformSystemFieldDefinitionsPolicy)
            )
        }

        const totalAll = items.length
        const limitReached = totalAll >= ATTRIBUTE_LIMIT

        let childSearchMatchParentIds: string[] = []
        if (search) {
            const searchLower = search.toLowerCase()
            const matchesName = (name: unknown): boolean => {
                if (!name) return false
                if (typeof name === 'string') return name.toLowerCase().includes(searchLower)
                if (typeof name === 'object') {
                    if (
                        'locales' in name &&
                        (name as Record<string, unknown>).locales &&
                        typeof (name as Record<string, unknown>).locales === 'object'
                    ) {
                        return Object.values((name as Record<string, unknown>).locales as Record<string, unknown>).some((entry: unknown) =>
                            String((entry as Record<string, unknown>)?.content ?? '')
                                .toLowerCase()
                                .includes(searchLower)
                        )
                    }
                    return Object.values(name as Record<string, unknown>).some((value: unknown) =>
                        String(value ?? '')
                            .toLowerCase()
                            .includes(searchLower)
                    )
                }
                return false
            }
            const matchesItem = (item: { codename: string; name: unknown }) =>
                item.codename.toLowerCase().includes(searchLower) || matchesName(item.name)

            const tableParents = items.filter((item) => item.dataType === FieldDefinitionDataType.TABLE)
            if (tableParents.length > 0) {
                const childMatchParentIds = new Set<string>()
                try {
                    const parentIds = tableParents.map((p) => p.id)
                    const childrenByParent = await fieldDefinitionsService.findChildAttributesByParentIds(metahubId, parentIds, userId)
                    for (const [parentId, children] of childrenByParent) {
                        if (children.some((child) => matchesItem(child))) {
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

        const getNameValue = (name: unknown): string => {
            if (!name) return ''
            if (typeof name === 'string') return name
            if (typeof name !== 'object') return String(name)

            const nameObj = name as Record<string, unknown>
            const locales = nameObj.locales && typeof nameObj.locales === 'object' ? (nameObj.locales as Record<string, unknown>) : null
            const primary = typeof nameObj._primary === 'string' ? nameObj._primary : undefined

            const pick = (key?: string) => {
                if (!key || !locales) return undefined
                const entry = locales[key]
                if (!entry) return undefined
                return typeof entry === 'string' ? entry : (entry as Record<string, unknown>)?.content
            }

            const byLocale = pick(locale)
            const byPrimary = pick(primary)
            if (byLocale) return String(byLocale)
            if (byPrimary) return String(byPrimary)

            if (locales) {
                for (const entry of Object.values(locales)) {
                    const content = typeof entry === 'string' ? entry : (entry as Record<string, unknown>)?.content
                    if (content) return String(content)
                }
            }

            return ''
        }

        items.sort((a, b) => {
            let valA: unknown = a[sortBy as keyof typeof a]
            let valB: unknown = b[sortBy as keyof typeof b]

            if (sortBy === 'name') {
                valA = getNameValue(a.name)
                valB = getNameValue(b.name)
            } else if (sortBy === 'sortOrder') {
                valA = (a as { effectiveSortOrder?: number }).effectiveSortOrder ?? a.sortOrder
                valB = (b as { effectiveSortOrder?: number }).effectiveSortOrder ?? b.sortOrder
            } else if (sortBy === 'created') {
                valA = a.createdAt
                valB = b.createdAt
            } else if (sortBy === 'updated') {
                valA = a.updatedAt
                valB = b.updatedAt
            }

            const cmpA = String(valA ?? '')
            const cmpB = String(valB ?? '')
            if (cmpA < cmpB) return sortOrder === 'asc' ? -1 : 1
            if (cmpA > cmpB) return sortOrder === 'asc' ? 1 : -1
            return 0
        })

        const paginatedItems = items.slice(offset, offset + limit)

        res.json({
            items: paginatedItems,
            pagination: { total, limit, offset },
            meta: {
                totalAll,
                limit: ATTRIBUTE_LIMIT,
                limitReached,
                includeShared: includeShared && scope === 'business',
                platformSystemFieldDefinitionsPolicy,
                ...(childSearchMatchParentIds.length > 0 ? { childSearchMatchParentIds } : {})
            }
        })
    }

    // ─── Get attribute by ID ─────────────────────────────────────────────
    const getById = async (req: Request, res: Response) => {
        const { metahubId, linkedCollectionId, fieldDefinitionId } = req.params
        const { fieldDefinitionsService } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId)
        if (!userId) return

        const attribute = await fieldDefinitionsService.findById(metahubId, fieldDefinitionId, userId)

        if (!attribute || attribute.linkedCollectionId !== linkedCollectionId) {
            return res.status(404).json({ error: 'Attribute not found' })
        }

        res.json(attribute)
    }

    // ─── Create attribute ────────────────────────────────────────────────
    const create = async (req: Request, res: Response) => {
        const { metahubId, linkedCollectionId } = req.params
        const {
            fieldDefinitionsService,
            objectsService,
            optionValuesService,
            fixedValuesService,
            entityTypeService,
            exec,
            settingsService
        } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const catalog = await objectsService.findById(metahubId, linkedCollectionId, userId)
        if (!catalog) {
            return res.status(404).json({ error: 'Catalog not found' })
        }

        const totalAll = await fieldDefinitionsService.countByObjectId(metahubId, linkedCollectionId, userId)
        if (totalAll >= ATTRIBUTE_LIMIT) {
            return res.status(409).json({
                error: 'Attribute limit reached',
                code: 'ATTRIBUTE_LIMIT_REACHED',
                limit: ATTRIBUTE_LIMIT
            })
        }

        const parsed = createFieldDefinitionSchema.safeParse(req.body)
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

        const allSettings = await settingsService.findAll(metahubId, userId)

        const allowedTypes = extractAllowedAttributeTypes(allSettings)
        if (allowedTypes.length > 0 && !allowedTypes.includes(dataType)) {
            return res.status(400).json({
                error: `Attribute data type "${dataType}" is not allowed by metahub settings`,
                code: 'DATA_TYPE_NOT_ALLOWED',
                allowedTypes
            })
        }

        if (dataType === FieldDefinitionDataType.TABLE) {
            if (parentAttributeId) {
                return res.status(400).json({
                    error: 'Nested TABLE attributes are not allowed',
                    code: 'NESTED_TABLE_FORBIDDEN'
                })
            }
            if (shouldBeDisplayAttribute) {
                return res.status(400).json({
                    error: 'TABLE attributes cannot be set as display attribute',
                    code: 'TABLE_DISPLAY_ATTRIBUTE_FORBIDDEN'
                })
            }
        }

        if (parentAttributeId && !isTableChildDataType(dataType)) {
            return res.status(400).json({
                error: `Data type "${dataType}" is not allowed for child attributes`,
                code: 'INVALID_CHILD_DATA_TYPE'
            })
        }

        const resolvedTargetEntityId = targetEntityId
        const resolvedTargetEntityKind = targetEntityKind
        const resolvedTargetConstantId = targetConstantId

        const codenameStyle = extractCodenameStyle(allSettings)
        const codenameAlphabet = extractCodenameAlphabet(allSettings)
        const allowMixed = extractAllowMixedAlphabets(allSettings)
        const normalizedCodename = normalizeCodenameForStyle(getCodenamePayloadText(codename), codenameStyle, codenameAlphabet)
        if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
            return res.status(400).json({
                error: 'Validation failed',
                details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
            })
        }

        const codenameScope = extractAttributeCodenameScope(allSettings)

        if (dataType === FieldDefinitionDataType.REF) {
            if (!resolvedTargetEntityId || !resolvedTargetEntityKind) {
                return res.status(400).json({
                    error: 'REF type requires targetEntityId and targetEntityKind'
                })
            }
            const referenceTargetError = await validateReferenceTarget({
                metahubId,
                targetEntityId: resolvedTargetEntityId,
                targetEntityKind: resolvedTargetEntityKind,
                targetConstantId: resolvedTargetConstantId,
                userId,
                objectsService,
                fixedValuesService,
                entityTypeService
            })
            if (referenceTargetError) {
                return res.status(400).json(referenceTargetError)
            }
        }
        if (dataType !== FieldDefinitionDataType.REF && resolvedTargetConstantId !== undefined) {
            return res.status(400).json({
                error: 'targetConstantId is only supported for REF type'
            })
        }

        let normalizedUiConfig: Record<string, unknown> = { ...(uiConfig ?? {}) }
        if (dataType === FieldDefinitionDataType.REF && resolvedTargetEntityKind === ENUMERATION_KIND && resolvedTargetEntityId) {
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
                const enumValue = await optionValuesService.findById(metahubId, defaultEnumValueId, userId)
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

        {
            const multilineUiConfig = normalizeMultilineUiConfig(dataType, normalizedUiConfig)
            if (multilineUiConfig.error) {
                return res.status(400).json({ error: multilineUiConfig.error })
            }
            normalizedUiConfig = multilineUiConfig.uiConfig
        }

        const sanitizedName = sanitizeLocalizedInput(name ?? {})
        if (Object.keys(sanitizedName).length === 0) {
            return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
        }

        const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, namePrimaryLocale ?? 'en')
        if (!nameVlc) {
            return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
        }

        const codenamePayload = syncCodenamePayloadText(
            codename,
            namePrimaryLocale ?? 'en',
            normalizedCodename,
            codenameStyle,
            codenameAlphabet
        )

        let globalCodenameLockKey: string | null = null
        if (codenameScope === 'global') {
            globalCodenameLockKey = uuidToLockKey(`attribute-codename-global:${metahubId}:${linkedCollectionId}`)
            const lockAcquired = await acquirePoolAdvisoryLock(globalCodenameLockKey)
            if (!lockAcquired) {
                return res.status(409).json({ error: GLOBAL_ATTRIBUTE_CODENAME_LOCK_ERROR })
            }
        }

        let attribute
        try {
            const existing = await fieldDefinitionsService.findByCodename(
                metahubId,
                linkedCollectionId,
                normalizedCodename,
                parentAttributeId ?? null,
                userId,
                undefined,
                { ignoreParentScope: codenameScope === 'global' }
            )
            if (existing) {
                return res.status(409).json({ error: 'Field definition with this codename already exists' })
            }

            attribute = await exec.transaction(async (trx: SqlQueryable) => {
                await fieldDefinitionsService.ensureSequentialSortOrder(
                    metahubId,
                    linkedCollectionId,
                    userId,
                    parentAttributeId ?? null,
                    trx
                )

                const createdAttribute = await fieldDefinitionsService.create(
                    metahubId,
                    {
                        linkedCollectionId,
                        codename: codenamePayload ?? normalizedCodename,
                        dataType,
                        name: nameVlc,
                        targetEntityId: dataType === FieldDefinitionDataType.REF ? resolvedTargetEntityId : undefined,
                        targetEntityKind: dataType === FieldDefinitionDataType.REF ? resolvedTargetEntityKind : undefined,
                        targetConstantId:
                            dataType === FieldDefinitionDataType.REF && resolvedTargetEntityKind === SET_KIND
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
                    userId,
                    trx
                )

                await fieldDefinitionsService.ensureSequentialSortOrder(
                    metahubId,
                    linkedCollectionId,
                    userId,
                    parentAttributeId ?? null,
                    trx
                )

                if (shouldBeDisplayAttribute) {
                    await fieldDefinitionsService.setDisplayAttribute(metahubId, linkedCollectionId, createdAttribute.id, userId, trx)
                }

                await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'attribute create')
                return createdAttribute
            })
        } catch (error) {
            if (isSchemaSyncFailure(error)) {
                return respondSchemaSyncFailure(res, error.operation, error.cause)
            }
            if (error instanceof Error && error.message === GLOBAL_ATTRIBUTE_CODENAME_LOCK_ERROR) {
                return res.status(409).json({ error: GLOBAL_ATTRIBUTE_CODENAME_LOCK_ERROR })
            }
            if (isUniqueViolation(error)) {
                return res.status(409).json({ error: 'Field definition with this codename already exists' })
            }
            throw error
        } finally {
            if (globalCodenameLockKey) {
                await releasePoolAdvisoryLock(globalCodenameLockKey)
            }
        }

        res.status(201).json(attribute)
    }

    // ─── Copy attribute ──────────────────────────────────────────────────
    const copy = async (req: Request, res: Response) => {
        const { metahubId, linkedCollectionId, fieldDefinitionId } = req.params
        const { fieldDefinitionsService, fixedValuesService, exec, settingsService } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const source = await fieldDefinitionsService.findById(metahubId, fieldDefinitionId, userId)
        if (!source || source.linkedCollectionId !== linkedCollectionId) {
            return res.status(404).json({ error: 'Attribute not found' })
        }
        if (source.system?.isSystem) {
            return res.status(409).json({ error: 'System attributes cannot be copied', code: 'SYSTEM_ATTRIBUTE_PROTECTED' })
        }

        const allowAttributeCopy = await getAllowFieldDefinitionCopy(settingsService, metahubId, userId)
        if (!allowAttributeCopy) {
            return res.status(403).json({ error: 'Attribute copy is disabled by metahub settings' })
        }

        const parsed = copyFieldDefinitionSchema.safeParse(req.body ?? {})
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
        }

        const copyOptions = {
            copyChildFieldDefinitions: parsed.data.copyChildFieldDefinitions !== false
        }

        const {
            style: codenameStyle,
            alphabet: codenameAlphabet,
            allowMixed
        } = await getCodenameSettings(settingsService, metahubId, userId)
        const copySuffix = codenameStyle === 'pascal-case' ? 'Copy' : '-copy'
        const normalizedBaseCodename = normalizeCodenameForStyle(
            parsed.data.codename ? getCodenamePayloadText(parsed.data.codename) : `${source.codename}${copySuffix}`,
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

        const codenamePrimaryLocale = (parsed.data.namePrimaryLocale ?? source.name?._primary ?? 'en')
            .split('-')[0]
            .split('_')[0]
            .toLowerCase()

        const copyValidationRules: Record<string, unknown> =
            parsed.data.validationRules !== undefined
                ? (parsed.data.validationRules as Record<string, unknown>)
                : (source.validationRules as Record<string, unknown> | undefined) ?? {}
        let copyUiConfig: Record<string, unknown> =
            parsed.data.uiConfig !== undefined
                ? (parsed.data.uiConfig as Record<string, unknown>)
                : { ...((source.uiConfig as Record<string, unknown> | undefined) ?? {}) }
        const copyIsRequired: boolean = parsed.data.isRequired !== undefined ? parsed.data.isRequired : Boolean(source.isRequired)

        {
            const multilineUiConfig = normalizeMultilineUiConfig(source.dataType, copyUiConfig)
            if (multilineUiConfig.error) {
                return res.status(400).json({ error: multilineUiConfig.error })
            }
            copyUiConfig = multilineUiConfig.uiConfig
        }

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
            const constantBelongsToSet = await fixedValuesService.belongsToSet(
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

        let copyResult:
            | {
                  copiedAttribute: Awaited<ReturnType<MetahubFieldDefinitionsService['create']>>
                  copiedChildAttributes: number
              }
            | undefined
        const codenameScope = await getAttributeCodenameScope(settingsService, metahubId, userId)
        let globalCodenameLockKey: string | null = null
        if (codenameScope === 'global') {
            globalCodenameLockKey = uuidToLockKey(`attribute-codename-global:${metahubId}:${linkedCollectionId}`)
            const lockAcquired = await acquirePoolAdvisoryLock(globalCodenameLockKey)
            if (!lockAcquired) {
                return res.status(409).json({ error: GLOBAL_ATTRIBUTE_CODENAME_LOCK_ERROR })
            }
        }

        try {
            for (let attempt = 1; attempt <= CODENAME_RETRY_MAX_ATTEMPTS && !copyResult; attempt++) {
                const codenameCandidate = buildCodenameAttempt(normalizedBaseCodename, attempt, codenameStyle)
                try {
                    copyResult = await exec.transaction(async (trx: SqlQueryable) => {
                        const existing = await fieldDefinitionsService.findByCodename(
                            metahubId,
                            linkedCollectionId,
                            codenameCandidate,
                            source.parentAttributeId ?? null,
                            userId,
                            trx,
                            { ignoreParentScope: codenameScope === 'global' }
                        )
                        if (existing) {
                            throw Object.assign(new Error('Attribute codename already exists'), { retryableConflict: true })
                        }

                        const copiedAttribute = await fieldDefinitionsService.create(
                            metahubId,
                            {
                                linkedCollectionId,
                                codename:
                                    syncCodenamePayloadText(
                                        parsed.data.codename ?? source.codename,
                                        codenamePrimaryLocale,
                                        codenameCandidate,
                                        codenameStyle,
                                        codenameAlphabet
                                    ) ?? codenameCandidate,
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
                        if (source.dataType === FieldDefinitionDataType.TABLE && copyOptions.copyChildFieldDefinitions) {
                            const children = await fieldDefinitionsService.findChildAttributes(metahubId, source.id, userId, trx)
                            const usedChildCodenames = new Set<string>()
                            for (const child of children) {
                                let childCodename = child.codename
                                if (codenameScope === 'global') {
                                    let uniqueChildCodename: string | null = null
                                    for (let childAttempt = 1; childAttempt <= CODENAME_RETRY_MAX_ATTEMPTS; childAttempt++) {
                                        const candidate = buildCodenameAttempt(child.codename, childAttempt, codenameStyle)
                                        if (usedChildCodenames.has(candidate)) continue
                                        const existingChild = await fieldDefinitionsService.findByCodename(
                                            metahubId,
                                            linkedCollectionId,
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
                                        throw Object.assign(new Error('Unable to generate unique codename for copied child attribute'), {
                                            retryableConflict: true
                                        })
                                    }

                                    childCodename = uniqueChildCodename
                                }

                                usedChildCodenames.add(childCodename)
                                await fieldDefinitionsService.create(
                                    metahubId,
                                    {
                                        linkedCollectionId,
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

                        await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'attribute copy')
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
        } catch (error) {
            if (isSchemaSyncFailure(error)) {
                return respondSchemaSyncFailure(res, error.operation, error.cause)
            }
            throw error
        } finally {
            if (globalCodenameLockKey) {
                await releasePoolAdvisoryLock(globalCodenameLockKey)
            }
        }

        if (!copyResult) {
            return res.status(409).json({ error: 'Unable to generate unique codename for field definition copy' })
        }

        return res.status(201).json({
            ...copyResult!.copiedAttribute,
            copyOptions,
            copiedChildAttributes: copyResult!.copiedChildAttributes
        })
    }

    // ─── Update attribute ────────────────────────────────────────────────
    const update = async (req: Request, res: Response) => {
        const { metahubId, linkedCollectionId, fieldDefinitionId } = req.params
        const {
            fieldDefinitionsService,
            objectsService,
            optionValuesService,
            fixedValuesService,
            entityTypeService,
            exec,
            settingsService
        } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const attribute = await fieldDefinitionsService.findById(metahubId, fieldDefinitionId, userId)
        if (!attribute || attribute.linkedCollectionId !== linkedCollectionId) {
            return res.status(404).json({ error: 'Attribute not found' })
        }

        const parsed = updateFieldDefinitionSchema.safeParse(req.body)
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
            targetConstantId,
            validationRules,
            uiConfig,
            isRequired,
            isDisplayAttribute,
            isEnabled,
            sortOrder,
            expectedVersion
        } = parsed.data

        if (attribute.system?.isSystem) {
            const forbiddenKeys = getForbiddenSystemFieldDefinitionPatchKeys(parsed.data as Record<string, unknown>)
            if (forbiddenKeys.length > 0) {
                return res.status(409).json({
                    error: `System attributes only support enable/disable changes. Forbidden fields: ${forbiddenKeys.join(', ')}`,
                    code: 'SYSTEM_ATTRIBUTE_PROTECTED'
                })
            }

            if (isEnabled === undefined) {
                return res.status(400).json({
                    error: 'System attributes require isEnabled for updates',
                    code: 'SYSTEM_ATTRIBUTE_UPDATE_INVALID'
                })
            }

            try {
                const updated = await exec.transaction(async (trx: SqlQueryable) => {
                    const nextAttribute = await fieldDefinitionsService.update(
                        metahubId,
                        fieldDefinitionId,
                        {
                            isEnabled,
                            expectedVersion,
                            updatedBy: userId
                        },
                        userId,
                        trx
                    )
                    await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'attribute update')
                    return nextAttribute
                })

                return res.json(updated)
            } catch (error) {
                if (isSchemaSyncFailure(error)) {
                    return respondSchemaSyncFailure(res, error.operation, error.cause)
                }
                if (error instanceof OptimisticLockError) {
                    return res.status(409).json({
                        error: 'Attribute was modified by another user. Please refresh and try again.',
                        code: 'OPTIMISTIC_LOCK_CONFLICT',
                        conflict: error.conflict
                    })
                }
                throw error
            }
        }

        if (dataType && dataType !== attribute.dataType) {
            return res.status(400).json({
                error: 'Data type change not allowed',
                code: 'DATA_TYPE_CHANGE_FORBIDDEN',
                message: 'Changing data type after creation is not supported. Please delete and recreate the attribute.',
                currentType: attribute.dataType,
                requestedType: dataType
            })
        }

        if (attribute.dataType === FieldDefinitionDataType.STRING && validationRules) {
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

        const resolvedTargetEntityId = targetEntityId
        const resolvedTargetEntityKind = targetEntityKind
        const resolvedTargetConstantId = targetConstantId
        const targetChanged =
            resolvedTargetEntityId !== undefined || resolvedTargetEntityKind !== undefined || resolvedTargetConstantId !== undefined

        const updateData: Record<string, unknown> = {}
        const effectiveDataType = dataType ?? attribute.dataType
        const requestedDisplayState = isDisplayAttribute !== undefined ? isDisplayAttribute : Boolean(attribute.isDisplayAttribute)
        if (requestedDisplayState && effectiveDataType === FieldDefinitionDataType.TABLE) {
            return res.status(400).json({
                error: 'TABLE attributes cannot be set as display attribute',
                code: 'TABLE_DISPLAY_ATTRIBUTE_FORBIDDEN'
            })
        }
        const isRefType = effectiveDataType === FieldDefinitionDataType.REF
        let codenameScope: 'per-level' | 'global' = 'per-level'

        let effectiveTargetEntityId = attribute.targetEntityId ?? null
        let effectiveTargetEntityKind = attribute.targetEntityKind ?? null
        let effectiveTargetConstantId = attribute.targetConstantId ?? null

        if (codename !== undefined) {
            const {
                style: codenameStyle,
                alphabet: codenameAlphabet,
                allowMixed
            } = await getCodenameSettings(settingsService, metahubId, userId)
            const normalizedCodename = normalizeCodenameForStyle(getCodenamePayloadText(codename), codenameStyle, codenameAlphabet)
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
            updateData.codename =
                syncOptionalCodenamePayloadText(codename, attribute.name?._primary ?? namePrimaryLocale ?? 'en', normalizedCodename) ??
                normalizedCodename
        }

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

        if (resolvedTargetEntityId !== undefined || resolvedTargetEntityKind !== undefined || resolvedTargetConstantId !== undefined) {
            if (resolvedTargetEntityId === null) {
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

                effectiveTargetConstantId = resolvedTargetConstantId !== undefined ? resolvedTargetConstantId : effectiveTargetConstantId

                const referenceTargetError = await validateReferenceTarget({
                    metahubId,
                    targetEntityId: effectiveTargetEntityId,
                    targetEntityKind: effectiveTargetEntityKind,
                    targetConstantId: effectiveTargetConstantId,
                    userId,
                    objectsService,
                    fixedValuesService,
                    entityTypeService
                })
                if (referenceTargetError) {
                    return res.status(400).json(referenceTargetError)
                }

                if (effectiveTargetEntityKind === SET_KIND) {
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
            let mergedUiConfig: Record<string, unknown> = { ...currentUiConfig, ...(uiConfig ?? {}) }

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
                    const enumValue = await optionValuesService.findById(metahubId, defaultEnumValueId, userId)
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

            const multilineUiConfig = normalizeMultilineUiConfig(effectiveDataType, mergedUiConfig)
            if (multilineUiConfig.error) {
                return res.status(400).json({ error: multilineUiConfig.error })
            }
            mergedUiConfig = multilineUiConfig.uiConfig

            updateData.uiConfig = mergedUiConfig
        }
        if (isRequired !== undefined) {
            updateData.isRequired = effectiveDataType === FieldDefinitionDataType.TABLE ? false : effectiveIsRequired
        } else if (isDisplayAttribute === true) {
            updateData.isRequired = true
        }
        if (isEnabled !== undefined) updateData.isEnabled = isEnabled
        if (sortOrder !== undefined) updateData.sortOrder = sortOrder
        if (expectedVersion !== undefined) updateData.expectedVersion = expectedVersion
        updateData.updatedBy = userId

        let globalCodenameLockKey: string | null = null
        if (updateData.codename && codenameScope === 'global') {
            globalCodenameLockKey = uuidToLockKey(`attribute-codename-global:${metahubId}:${linkedCollectionId}`)
            const lockAcquired = await acquirePoolAdvisoryLock(globalCodenameLockKey)
            if (!lockAcquired) {
                return res.status(409).json({ error: GLOBAL_ATTRIBUTE_CODENAME_LOCK_ERROR })
            }
        }

        let updated
        try {
            if (updateData.codename) {
                const existing = await fieldDefinitionsService.findByCodename(
                    metahubId,
                    linkedCollectionId,
                    updateData.codename as string,
                    attribute.parentAttributeId ?? null,
                    userId,
                    undefined,
                    { ignoreParentScope: codenameScope === 'global' }
                )
                if (existing) {
                    return res.status(409).json({ error: 'Field definition with this codename already exists' })
                }
            }

            updated = await exec.transaction(async (trx: SqlQueryable) => {
                const nextAttribute = await fieldDefinitionsService.update(metahubId, fieldDefinitionId, updateData, userId, trx)

                if (isDisplayAttribute === true) {
                    await fieldDefinitionsService.setDisplayAttribute(metahubId, linkedCollectionId, fieldDefinitionId, userId, trx)
                } else if (isDisplayAttribute === false) {
                    await fieldDefinitionsService.clearDisplayAttribute(metahubId, fieldDefinitionId, userId, trx)
                }

                if (sortOrder !== undefined) {
                    const existingAttr = await fieldDefinitionsService.findById(metahubId, fieldDefinitionId, userId, trx)
                    await fieldDefinitionsService.ensureSequentialSortOrder(
                        metahubId,
                        linkedCollectionId,
                        userId,
                        existingAttr?.parentAttributeId ?? null,
                        trx
                    )
                }

                await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'attribute update')
                return nextAttribute
            })
        } catch (error) {
            if (isSchemaSyncFailure(error)) {
                return respondSchemaSyncFailure(res, error.operation, error.cause)
            }
            throw error
        } finally {
            if (globalCodenameLockKey) {
                await releasePoolAdvisoryLock(globalCodenameLockKey)
            }
        }

        if (updated?.system?.isSystem && (isDisplayAttribute === true || isDisplayAttribute === false)) {
            return res.status(409).json({ error: 'System attributes cannot be used as display attributes' })
        }

        res.json(updated)
    }

    // ─── Move attribute ──────────────────────────────────────────────────
    const move = async (req: Request, res: Response) => {
        const { metahubId, linkedCollectionId, fieldDefinitionId } = req.params
        const { fieldDefinitionsService } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const attribute = await fieldDefinitionsService.findById(metahubId, fieldDefinitionId, userId)
        if (!attribute || attribute.linkedCollectionId !== linkedCollectionId) {
            return res.status(404).json({ error: 'Attribute not found' })
        }

        const parsed = moveFieldDefinitionSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
        }

        const { direction } = parsed.data

        const updated = await fieldDefinitionsService.moveAttribute(metahubId, linkedCollectionId, fieldDefinitionId, direction, userId)
        res.json(updated)
    }

    // ─── Reorder attribute ───────────────────────────────────────────────
    const reorder = async (req: Request, res: Response) => {
        const { metahubId, linkedCollectionId } = req.params
        const { fieldDefinitionsService, settingsService } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const parsed = reorderFieldDefinitionSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
        }

        const { fieldDefinitionId, newSortOrder, newParentAttributeId, autoRenameCodename, mergedOrderIds } = parsed.data

        if (newParentAttributeId !== undefined && mergedOrderIds) {
            return res.status(400).json({
                error: 'Validation failed',
                details: { mergedOrderIds: ['mergedOrderIds is not supported for cross-list transfers'] }
            })
        }

        const codenameScope = await getAttributeCodenameScope(settingsService, metahubId, userId)
        const { style: codenameStyle } = await getCodenameSettings(settingsService, metahubId, userId)
        const allowCrossListRootChildren = await getAllowAttributeMoveBetweenRootAndChildren(settingsService, metahubId, userId)
        const allowCrossListBetweenChildren = await getAllowAttributeMoveBetweenChildLists(settingsService, metahubId, userId)

        const updated = mergedOrderIds
            ? await fieldDefinitionsService.reorderAttributeMergedOrder(
                  metahubId,
                  linkedCollectionId,
                  fieldDefinitionId,
                  mergedOrderIds,
                  userId
              )
            : await fieldDefinitionsService.reorderAttribute(
                  metahubId,
                  linkedCollectionId,
                  fieldDefinitionId,
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
    }

    // ─── Toggle required ─────────────────────────────────────────────────
    const toggleRequired = async (req: Request, res: Response) => {
        const { metahubId, linkedCollectionId, fieldDefinitionId } = req.params
        const { fieldDefinitionsService, optionValuesService, exec } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const attribute = await fieldDefinitionsService.findById(metahubId, fieldDefinitionId, userId)
        if (!attribute || attribute.linkedCollectionId !== linkedCollectionId) {
            return res.status(404).json({ error: 'Attribute not found' })
        }
        if (attribute.system?.isSystem) {
            return res
                .status(409)
                .json({ error: 'System attributes cannot be used as display attributes', code: 'SYSTEM_ATTRIBUTE_PROTECTED' })
        }

        const newValue = !attribute.isRequired
        if (attribute.isDisplayAttribute && !newValue) {
            return res.status(400).json({
                error: 'Display attribute must be required'
            })
        }

        const isEnumerationRef =
            attribute.dataType === FieldDefinitionDataType.REF &&
            attribute.targetEntityKind === ENUMERATION_KIND &&
            typeof attribute.targetEntityId === 'string'

        const currentUiConfig = ((attribute.uiConfig as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>

        if (newValue && isEnumerationRef) {
            const enumPresentationMode = currentUiConfig.enumPresentationMode
            const defaultEnumValueId = typeof currentUiConfig.defaultEnumValueId === 'string' ? currentUiConfig.defaultEnumValueId : null

            if (enumPresentationMode === 'label' && !defaultEnumValueId) {
                return res.status(400).json({
                    error: 'required REF label mode requires defaultEnumValueId'
                })
            }

            if (defaultEnumValueId) {
                const enumValue = await optionValuesService.findById(metahubId, defaultEnumValueId, userId)
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

        try {
            await exec.transaction(async (trx: SqlQueryable) => {
                await fieldDefinitionsService.update(metahubId, fieldDefinitionId, updatePayload, userId, trx)
                await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'attribute toggle required')
            })
        } catch (error) {
            if (isSchemaSyncFailure(error)) {
                return respondSchemaSyncFailure(res, error.operation, error.cause)
            }
            throw error
        }

        res.json({ success: true, isRequired: newValue })
    }

    // ─── Set display attribute ───────────────────────────────────────────
    const setDisplay = async (req: Request, res: Response) => {
        const { metahubId, linkedCollectionId, fieldDefinitionId } = req.params
        const { fieldDefinitionsService, exec } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const attribute = await fieldDefinitionsService.findById(metahubId, fieldDefinitionId, userId)
        if (!attribute || attribute.linkedCollectionId !== linkedCollectionId) {
            return res.status(404).json({ error: 'Attribute not found' })
        }
        if (attribute.system?.isSystem) {
            return res
                .status(409)
                .json({ error: 'System attributes cannot be used as display attributes', code: 'SYSTEM_ATTRIBUTE_PROTECTED' })
        }

        if (attribute.dataType === FieldDefinitionDataType.TABLE) {
            return res.status(400).json({
                error: 'TABLE attributes cannot be set as display attribute',
                code: 'TABLE_DISPLAY_ATTRIBUTE_FORBIDDEN'
            })
        }

        try {
            await exec.transaction(async (trx: SqlQueryable) => {
                await fieldDefinitionsService.setDisplayAttribute(metahubId, linkedCollectionId, fieldDefinitionId, userId, trx)
                await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'attribute set display')
            })
        } catch (error) {
            if (isSchemaSyncFailure(error)) {
                return respondSchemaSyncFailure(res, error.operation, error.cause)
            }
            throw error
        }

        res.json({ success: true })
    }

    // ─── Clear display attribute ─────────────────────────────────────────
    const clearDisplay = async (req: Request, res: Response) => {
        const { metahubId, linkedCollectionId, fieldDefinitionId } = req.params
        const { fieldDefinitionsService, exec } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const attribute = await fieldDefinitionsService.findById(metahubId, fieldDefinitionId, userId)
        if (!attribute || attribute.linkedCollectionId !== linkedCollectionId) {
            return res.status(404).json({ error: 'Attribute not found' })
        }

        try {
            await exec.transaction(async (trx: SqlQueryable) => {
                await fieldDefinitionsService.clearDisplayAttribute(metahubId, fieldDefinitionId, userId, trx)
                await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'attribute clear display')
            })
        } catch (error) {
            if (isSchemaSyncFailure(error)) {
                return respondSchemaSyncFailure(res, error.operation, error.cause)
            }
            if (error instanceof Error && error.message === 'At least one display attribute is required in each scope') {
                return res.status(409).json({
                    error: 'Cannot clear display attribute. Set another attribute as display first.'
                })
            }
            throw error
        }

        res.json({ success: true })
    }

    // ─── Delete attribute ────────────────────────────────────────────────
    const deleteAttribute = async (req: Request, res: Response) => {
        const { metahubId, linkedCollectionId, fieldDefinitionId } = req.params
        const { fieldDefinitionsService, settingsService, exec } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'deleteContent')
        if (!userId) return

        const attribute = await fieldDefinitionsService.findById(metahubId, fieldDefinitionId, userId)
        if (!attribute || attribute.linkedCollectionId !== linkedCollectionId) {
            return res.status(404).json({ error: 'Attribute not found' })
        }

        const allowAttributeDelete = await getAllowFieldDefinitionDelete(settingsService, metahubId, userId)
        if (!allowAttributeDelete) {
            return res.status(403).json({ error: 'Attribute delete is disabled by metahub settings' })
        }

        if (attribute.isDisplayAttribute) {
            const allowDeleteLastDisplayAttribute = await getAllowDeleteLastDisplayAttribute(settingsService, metahubId, userId)
            if (!allowDeleteLastDisplayAttribute) {
                const scopedAttributes = attribute.parentAttributeId
                    ? await fieldDefinitionsService.findChildAttributes(metahubId, attribute.parentAttributeId, userId)
                    : await fieldDefinitionsService.findAll(metahubId, linkedCollectionId, userId)

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

        try {
            await exec.transaction(async (trx: SqlQueryable) => {
                await fieldDefinitionsService.ensureSequentialSortOrder(
                    metahubId,
                    linkedCollectionId,
                    userId,
                    attribute.parentAttributeId ?? null,
                    trx
                )
                await fieldDefinitionsService.delete(metahubId, fieldDefinitionId, userId, trx)
                await fieldDefinitionsService.ensureSequentialSortOrder(
                    metahubId,
                    linkedCollectionId,
                    userId,
                    attribute.parentAttributeId ?? null,
                    trx
                )
                await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'attribute delete')
            })
        } catch (error) {
            if (isSchemaSyncFailure(error)) {
                return respondSchemaSyncFailure(res, error.operation, error.cause)
            }
            throw error
        }

        return res.status(204).send()
    }

    // ─── Attribute codenames ─────────────────────────────────────────────
    const listCodenames = async (req: Request, res: Response) => {
        const { metahubId, linkedCollectionId } = req.params
        const { fieldDefinitionsService } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId)
        if (!userId) return

        const allAttributes = await fieldDefinitionsService.findAllFlat(metahubId, linkedCollectionId, userId)

        const items = allAttributes.map((attr) => ({
            id: attr.id,
            codename: attr.codename
        }))

        res.json({ items })
    }

    // ─── Batch list child attributes for multiple parents ────────────────
    const listChildrenBatch = async (req: Request, res: Response) => {
        const { metahubId } = req.params
        const { fieldDefinitionsService } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId)
        if (!userId) return

        const raw = req.query.parentIds
        if (!raw || typeof raw !== 'string' || raw.trim() === '') {
            return res.status(400).json({ error: 'parentIds query parameter is required' })
        }

        const parentIds = raw
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        if (parentIds.length === 0) {
            return res.json({ children: {} })
        }
        if (parentIds.length > 100) {
            return res.status(400).json({ error: 'Maximum 100 parent IDs allowed' })
        }

        const childrenByParent = await fieldDefinitionsService.findChildAttributesByParentIds(metahubId, parentIds, userId)
        const children: Record<string, unknown[]> = {}
        for (const [parentId, items] of childrenByParent) {
            children[parentId] = items
        }

        res.json({ children })
    }

    // ─── List child attributes ───────────────────────────────────────────
    const listChildren = async (req: Request, res: Response) => {
        const { metahubId, linkedCollectionId, fieldDefinitionId } = req.params
        const { fieldDefinitionsService } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId)
        if (!userId) return

        const parent = await fieldDefinitionsService.findById(metahubId, fieldDefinitionId, userId)
        if (!parent || parent.linkedCollectionId !== linkedCollectionId) {
            return res.status(404).json({ error: 'Attribute not found' })
        }
        if (parent.dataType !== FieldDefinitionDataType.TABLE) {
            return res.status(400).json({ error: 'Attribute is not a TABLE type' })
        }

        const children = await fieldDefinitionsService.findChildAttributes(metahubId, fieldDefinitionId, userId)

        res.json({ items: children, total: children.length })
    }

    // ─── Create child attribute ──────────────────────────────────────────
    const createChild = async (req: Request, res: Response) => {
        const { metahubId, linkedCollectionId, fieldDefinitionId } = req.params
        const {
            fieldDefinitionsService,
            objectsService,
            optionValuesService,
            fixedValuesService,
            entityTypeService,
            exec,
            settingsService
        } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const parent = await fieldDefinitionsService.findById(metahubId, fieldDefinitionId, userId)
        if (!parent || parent.linkedCollectionId !== linkedCollectionId) {
            return res.status(404).json({ error: 'Parent attribute not found' })
        }
        if (parent.dataType !== FieldDefinitionDataType.TABLE) {
            return res.status(400).json({ error: 'Parent attribute must be TABLE type' })
        }

        const parsed = createFieldDefinitionSchema.safeParse({
            ...req.body,
            parentAttributeId: fieldDefinitionId
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
            targetConstantId,
            validationRules,
            uiConfig,
            isRequired,
            sortOrder
        } = parsed.data
        const shouldBeDisplayAttribute = Boolean(req.body.isDisplayAttribute)
        const effectiveIsRequired = shouldBeDisplayAttribute || Boolean(isRequired)

        const allSettings = await settingsService.findAll(metahubId, userId)

        const allowedTypes = extractAllowedAttributeTypes(allSettings)
        if (allowedTypes.length > 0 && !allowedTypes.includes(dataType)) {
            return res.status(400).json({
                error: `Attribute data type "${dataType}" is not allowed by metahub settings`,
                code: 'DATA_TYPE_NOT_ALLOWED',
                allowedTypes
            })
        }

        if (!isTableChildDataType(dataType)) {
            return res.status(400).json({
                error: `Data type "${dataType}" is not allowed for child attributes`,
                code: 'INVALID_CHILD_DATA_TYPE'
            })
        }

        const codenameStyle = extractCodenameStyle(allSettings)
        const codenameAlphabet = extractCodenameAlphabet(allSettings)
        const allowMixed = extractAllowMixedAlphabets(allSettings)
        const normalizedCodename = normalizeCodenameForStyle(getCodenamePayloadText(codename), codenameStyle, codenameAlphabet)
        if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
            return res.status(400).json({
                error: 'Validation failed',
                details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
            })
        }

        const resolvedTargetEntityId = targetEntityId
        const resolvedTargetEntityKind = targetEntityKind
        const resolvedTargetConstantId = targetConstantId

        if (dataType === FieldDefinitionDataType.REF) {
            if (!resolvedTargetEntityId || !resolvedTargetEntityKind) {
                return res.status(400).json({
                    error: 'REF type requires targetEntityId and targetEntityKind'
                })
            }
            const referenceTargetError = await validateReferenceTarget({
                metahubId,
                targetEntityId: resolvedTargetEntityId,
                targetEntityKind: resolvedTargetEntityKind,
                targetConstantId: resolvedTargetConstantId,
                userId,
                objectsService,
                fixedValuesService,
                entityTypeService
            })
            if (referenceTargetError) {
                return res.status(400).json(referenceTargetError)
            }
        }
        if (dataType !== FieldDefinitionDataType.REF && resolvedTargetConstantId !== undefined) {
            return res.status(400).json({
                error: 'targetConstantId is only supported for REF type'
            })
        }

        let normalizedUiConfig: Record<string, unknown> = { ...(uiConfig ?? {}) }
        if (dataType === FieldDefinitionDataType.REF && resolvedTargetEntityKind === ENUMERATION_KIND && resolvedTargetEntityId) {
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
                const enumValue = await optionValuesService.findById(metahubId, defaultEnumValueId, userId)
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

        {
            const multilineUiConfig = normalizeMultilineUiConfig(dataType, normalizedUiConfig)
            if (multilineUiConfig.error) {
                return res.status(400).json({ error: multilineUiConfig.error })
            }
            normalizedUiConfig = multilineUiConfig.uiConfig
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

        const codenamePayload = syncCodenamePayloadText(
            codename,
            namePrimaryLocale ?? 'en',
            normalizedCodename,
            codenameStyle,
            codenameAlphabet
        )

        let globalCodenameLockKey: string | null = null
        if (codenameScope === 'global') {
            globalCodenameLockKey = uuidToLockKey(`attribute-codename-global:${metahubId}:${linkedCollectionId}`)
            const lockAcquired = await acquirePoolAdvisoryLock(globalCodenameLockKey)
            if (!lockAcquired) {
                return res.status(409).json({ error: GLOBAL_ATTRIBUTE_CODENAME_LOCK_ERROR })
            }
        }

        let attribute
        try {
            const existing = await fieldDefinitionsService.findByCodename(
                metahubId,
                linkedCollectionId,
                normalizedCodename,
                fieldDefinitionId,
                userId,
                undefined,
                { ignoreParentScope: codenameScope === 'global' }
            )
            if (existing) {
                return res.status(409).json({ error: 'Field definition with this codename already exists' })
            }

            attribute = await exec.transaction(async (trx: SqlQueryable) => {
                const createdAttribute = await fieldDefinitionsService.create(
                    metahubId,
                    {
                        linkedCollectionId,
                        codename: codenamePayload ?? normalizedCodename,
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
                        parentAttributeId: fieldDefinitionId,
                        createdBy: userId
                    },
                    userId,
                    trx
                )

                if (shouldBeDisplayAttribute && createdAttribute.id) {
                    await fieldDefinitionsService.setDisplayAttribute(metahubId, linkedCollectionId, createdAttribute.id, userId, trx)
                }

                await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'child attribute create')
                return createdAttribute
            })
        } catch (error) {
            if (isSchemaSyncFailure(error)) {
                return respondSchemaSyncFailure(res, error.operation, error.cause)
            }
            if (isUniqueViolation(error)) {
                return res.status(409).json({ error: 'Field definition with this codename already exists' })
            }
            throw error
        } finally {
            if (globalCodenameLockKey) {
                await releasePoolAdvisoryLock(globalCodenameLockKey)
            }
        }

        res.status(201).json(attribute)
    }

    return {
        list,
        getById,
        create,
        copy,
        update,
        move,
        reorder,
        toggleRequired,
        setDisplay,
        clearDisplay,
        delete: deleteAttribute,
        listCodenames,
        listChildren,
        listChildrenBatch,
        createChild
    }
}
