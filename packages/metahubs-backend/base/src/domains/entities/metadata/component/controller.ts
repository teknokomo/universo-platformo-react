import { z } from 'zod'
import type { Request, Response } from 'express'
import type { DbExecutor, SqlQueryable } from '@universo/utils'
import { localizedContent, OptimisticLockError } from '@universo/utils'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '@universo/utils/validation/codename'
const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
import {
    ComponentDefinitionDataType,
    COMPONENT_DATA_TYPES,
    TABLE_CHILD_DATA_TYPES,
    isEnabledCapabilityConfig,
    type EntityKind,
    type ResolvedEntityType,
    type TableChildDataType
} from '@universo/types'
import { MetahubSchemaService } from '../../../metahubs/services/MetahubSchemaService'
import { MetahubComponentsService } from '../../../metahubs/services/MetahubComponentsService'
import { MetahubObjectsService } from '../../../metahubs/services/MetahubObjectsService'
import { MetahubOptionValuesService } from '../../../metahubs/services/MetahubOptionValuesService'
import { MetahubFixedValuesService } from '../../../metahubs/services/MetahubFixedValuesService'
import { MetahubSettingsService } from '../../../settings/services/MetahubSettingsService'
import { EntityTypeService } from '../../services/EntityTypeService'
import { ListQuerySchema } from '../../../shared/queryParams'
import { getRequestDbExecutor } from '../../../../utils'
import {
    getCodenameSettings,
    getComponentCodenameScope,
    codenameErrorMessage,
    buildCodenameAttempt,
    extractCodenameStyle,
    extractCodenameAlphabet,
    extractAllowMixedAlphabets,
    extractComponentCodenameScope,
    extractAllowedComponentTypes,
    getAllowComponentCopy,
    getAllowComponentDelete,
    getAllowDeleteLastDisplayComponent,
    getAllowComponentMoveBetweenRootAndChildren,
    getAllowComponentMoveBetweenChildLists,
    CODENAME_RETRY_MAX_ATTEMPTS
} from '../../../shared/codenameStyleHelper'
import {
    requiredCodenamePayloadSchema,
    optionalCodenamePayloadSchema,
    getCodenamePayloadText,
    syncCodenamePayloadText,
    syncOptionalCodenamePayloadText
} from '../../../shared/codenamePayload'
import { readPlatformSystemComponentsPolicy, shouldExposeObjectSystemComponent } from '../../../shared'
import { createEnsureMetahubRouteAccess } from '../../../shared/guards'
import { respondSchemaSyncFailure, isSchemaSyncFailure, syncMetahubSchemaOrThrow, isUniqueViolation } from '../../../shared/errorGuards'
import { uuidToLockKey, acquirePoolAdvisoryLock, releasePoolAdvisoryLock } from '../../../ddl'

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

const getForbiddenSystemComponentPatchKeys = (data: Record<string, unknown>): string[] => {
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
const COMPONENT_LIMIT = 100
const GLOBAL_COMPONENT_CODENAME_LOCK_ERROR = 'Could not acquire component codename lock. Please retry.'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ComponentsListQuerySchema = ListQuerySchema.extend({
    sortBy: z.enum(['name', 'created', 'updated', 'codename', 'sortOrder']).default('sortOrder'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    locale: z.string().trim().min(2).max(10).optional(),
    scope: z.enum(['business', 'system', 'all']).default('business'),
    includeShared: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false)
})

const validateComponentsListQuery = (query: unknown) => ComponentsListQuerySchema.parse(query)

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
        maxChildComponents: z.number().int().min(1).nullable().optional()
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

const createComponentSchema = z
    .object({
        codename: requiredCodenamePayloadSchema,
        dataType: z.enum(COMPONENT_DATA_TYPES),
        name: localizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        targetEntityId: z.string().uuid().optional(),
        targetEntityKind: targetEntityKindSchema.optional(),
        targetConstantId: z.string().uuid().optional(),
        validationRules: validationRulesSchema,
        uiConfig: uiConfigSchema,
        isRequired: z.boolean().optional(),
        isDisplayComponent: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        parentComponentId: z.string().uuid().nullish()
    })
    .strict()

const updateComponentSchema = z
    .object({
        codename: optionalCodenamePayloadSchema,
        dataType: z.enum(COMPONENT_DATA_TYPES).optional(),
        name: localizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        targetEntityId: z.string().uuid().nullable().optional(),
        targetEntityKind: targetEntityKindSchema.nullable().optional(),
        targetConstantId: z.string().uuid().nullable().optional(),
        validationRules: validationRulesSchema,
        uiConfig: uiConfigSchema,
        isRequired: z.boolean().optional(),
        isDisplayComponent: z.boolean().optional(),
        isEnabled: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

const moveComponentSchema = z
    .object({
        direction: z.enum(['up', 'down'])
    })
    .strict()

const copyComponentSchema = z
    .object({
        codename: optionalCodenamePayloadSchema,
        name: localizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        copyChildComponents: z.boolean().optional(),
        validationRules: validationRulesSchema,
        uiConfig: uiConfigSchema,
        isRequired: z.boolean().optional(),
        targetConstantId: z.string().uuid().nullable().optional()
    })
    .strict()

const reorderComponentSchema = z
    .object({
        componentId: z.string().uuid(),
        newSortOrder: z.number().int().min(1),
        newParentComponentId: z.string().uuid().nullable().optional(),
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
    dataType: ComponentDefinitionDataType,
    sourceUiConfig: Record<string, unknown>
): { uiConfig: Record<string, unknown>; error?: string } => {
    const nextUiConfig = { ...sourceUiConfig }

    if (nextUiConfig.widget === 'textarea' && dataType !== ComponentDefinitionDataType.STRING) {
        return {
            uiConfig: nextUiConfig,
            error: 'Multiline editor is supported only for STRING components'
        }
    }

    if (dataType !== ComponentDefinitionDataType.STRING) {
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

const isTableChildDataType = (value: ComponentDefinitionDataType): value is TableChildDataType =>
    (TABLE_CHILD_DATA_TYPES as readonly string[]).includes(value)

const isReferenceableEntityType = (resolvedType: ResolvedEntityType | null | undefined) =>
    Boolean(
        resolvedType &&
            (resolvedType.kindKey === ENUMERATION_KIND ||
                resolvedType.kindKey === SET_KIND ||
                isEnabledCapabilityConfig(resolvedType.capabilities.dataSchema))
    )

const getMissingReferenceTargetMessage = (targetEntityKind: EntityKind): string => {
    if (targetEntityKind === ENUMERATION_KIND) {
        return 'Target enumeration not found'
    }
    if (targetEntityKind === SET_KIND) {
        return 'Target set not found'
    }
    if (targetEntityKind === 'object') {
        return 'Target object not found'
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

export function createComponentsController(_createHandler: CreateHandler, getDbExecutor: () => DbExecutor) {
    const services = (req: Request) => {
        const exec = getRequestDbExecutor(req, getDbExecutor())
        const schemaService = new MetahubSchemaService(exec)
        return {
            exec,
            componentsService: new MetahubComponentsService(exec, schemaService),
            objectsService: new MetahubObjectsService(exec, schemaService),
            optionValuesService: new MetahubOptionValuesService(exec, schemaService),
            fixedValuesService: new MetahubFixedValuesService(exec, schemaService),
            entityTypeService: new EntityTypeService(exec, schemaService),
            schemaService,
            settingsService: new MetahubSettingsService(exec, schemaService)
        }
    }

    const ensureMetahubRouteAccess = createEnsureMetahubRouteAccess(getDbExecutor)

    // ─── List components ─────────────────────────────────────────────────
    const list = async (req: Request, res: Response) => {
        const { metahubId, objectCollectionId } = req.params
        const { componentsService, exec } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId)
        if (!userId) return
        const platformSystemComponentsPolicy = await readPlatformSystemComponentsPolicy(exec)

        let validatedQuery
        try {
            validatedQuery = validateComponentsListQuery(req.query)
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
            }
            throw error
        }

        const { limit, offset, sortBy, sortOrder, search, locale, scope, includeShared } = validatedQuery

        let items =
            includeShared && scope === 'business'
                ? await componentsService.findAllMerged(metahubId, objectCollectionId, userId, scope)
                : await componentsService.findAll(metahubId, objectCollectionId, userId, scope)

        if (scope !== 'business') {
            items = items.filter((item) =>
                shouldExposeObjectSystemComponent(item.system?.systemKey ?? null, platformSystemComponentsPolicy)
            )
        }

        const totalAll = items.length
        const limitReached = totalAll >= COMPONENT_LIMIT

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

            const tableParents = items.filter((item) => item.dataType === ComponentDefinitionDataType.TABLE)
            if (tableParents.length > 0) {
                const childMatchParentIds = new Set<string>()
                try {
                    const parentIds = tableParents.map((p) => p.id)
                    const childrenByParent = await componentsService.findChildComponentsByParentIds(metahubId, parentIds, userId)
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
                limit: COMPONENT_LIMIT,
                limitReached,
                includeShared: includeShared && scope === 'business',
                platformSystemComponentsPolicy,
                ...(childSearchMatchParentIds.length > 0 ? { childSearchMatchParentIds } : {})
            }
        })
    }

    // ─── Get component by ID ─────────────────────────────────────────────
    const getById = async (req: Request, res: Response) => {
        const { metahubId, objectCollectionId, componentId } = req.params
        const { componentsService } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId)
        if (!userId) return

        const component = await componentsService.findById(metahubId, componentId, userId)

        if (!component || component.objectCollectionId !== objectCollectionId) {
            return res.status(404).json({ error: 'Component not found' })
        }

        res.json(component)
    }

    // ─── Create component ────────────────────────────────────────────────
    const create = async (req: Request, res: Response) => {
        const { metahubId, objectCollectionId } = req.params
        const { componentsService, objectsService, optionValuesService, fixedValuesService, entityTypeService, exec, settingsService } =
            services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const object = await objectsService.findById(metahubId, objectCollectionId, userId)
        if (!object) {
            return res.status(404).json({ error: 'Object not found' })
        }

        const totalAll = await componentsService.countByObjectId(metahubId, objectCollectionId, userId)
        if (totalAll >= COMPONENT_LIMIT) {
            return res.status(409).json({
                error: 'Component limit reached',
                code: 'COMPONENT_LIMIT_REACHED',
                limit: COMPONENT_LIMIT
            })
        }

        const parsed = createComponentSchema.safeParse(req.body)
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
            isDisplayComponent,
            sortOrder,
            parentComponentId
        } = parsed.data
        const shouldBeDisplayComponent = Boolean(isDisplayComponent)
        const effectiveIsRequired = shouldBeDisplayComponent || Boolean(isRequired)

        const allSettings = await settingsService.findAll(metahubId, userId)

        const allowedTypes = extractAllowedComponentTypes(allSettings)
        if (allowedTypes.length > 0 && !allowedTypes.includes(dataType)) {
            return res.status(400).json({
                error: `Component data type "${dataType}" is not allowed by metahub settings`,
                code: 'DATA_TYPE_NOT_ALLOWED',
                allowedTypes
            })
        }

        if (dataType === ComponentDefinitionDataType.TABLE) {
            if (parentComponentId) {
                return res.status(400).json({
                    error: 'Nested TABLE components are not allowed',
                    code: 'NESTED_TABLE_FORBIDDEN'
                })
            }
            if (shouldBeDisplayComponent) {
                return res.status(400).json({
                    error: 'TABLE components cannot be set as display component',
                    code: 'TABLE_DISPLAY_COMPONENT_FORBIDDEN'
                })
            }
        }

        if (parentComponentId && !isTableChildDataType(dataType)) {
            return res.status(400).json({
                error: `Data type "${dataType}" is not allowed for child components`,
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

        const codenameScope = extractComponentCodenameScope(allSettings)

        if (dataType === ComponentDefinitionDataType.REF) {
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
        if (dataType !== ComponentDefinitionDataType.REF && resolvedTargetConstantId !== undefined) {
            return res.status(400).json({
                error: 'targetConstantId is only supported for REF type'
            })
        }

        let normalizedUiConfig: Record<string, unknown> = { ...(uiConfig ?? {}) }
        if (dataType === ComponentDefinitionDataType.REF && resolvedTargetEntityKind === ENUMERATION_KIND && resolvedTargetEntityId) {
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
            globalCodenameLockKey = uuidToLockKey(`component-codename-global:${metahubId}:${objectCollectionId}`)
            const lockAcquired = await acquirePoolAdvisoryLock(globalCodenameLockKey)
            if (!lockAcquired) {
                return res.status(409).json({ error: GLOBAL_COMPONENT_CODENAME_LOCK_ERROR })
            }
        }

        let component
        try {
            const existing = await componentsService.findByCodename(
                metahubId,
                objectCollectionId,
                normalizedCodename,
                parentComponentId ?? null,
                userId,
                undefined,
                { ignoreParentScope: codenameScope === 'global' }
            )
            if (existing) {
                return res.status(409).json({ error: 'Component with this codename already exists' })
            }

            component = await exec.transaction(async (trx: SqlQueryable) => {
                await componentsService.ensureSequentialSortOrder(metahubId, objectCollectionId, userId, parentComponentId ?? null, trx)

                const createdComponent = await componentsService.create(
                    metahubId,
                    {
                        objectCollectionId,
                        codename: codenamePayload ?? normalizedCodename,
                        dataType,
                        name: nameVlc,
                        targetEntityId: dataType === ComponentDefinitionDataType.REF ? resolvedTargetEntityId : undefined,
                        targetEntityKind: dataType === ComponentDefinitionDataType.REF ? resolvedTargetEntityKind : undefined,
                        targetConstantId:
                            dataType === ComponentDefinitionDataType.REF && resolvedTargetEntityKind === SET_KIND
                                ? resolvedTargetConstantId
                                : undefined,
                        validationRules: validationRules ?? {},
                        uiConfig: normalizedUiConfig,
                        isRequired: effectiveIsRequired,
                        isDisplayComponent: false,
                        sortOrder: sortOrder,
                        parentComponentId: parentComponentId ?? null,
                        createdBy: userId
                    },
                    userId,
                    trx
                )

                await componentsService.ensureSequentialSortOrder(metahubId, objectCollectionId, userId, parentComponentId ?? null, trx)

                if (shouldBeDisplayComponent) {
                    await componentsService.setDisplayComponent(metahubId, objectCollectionId, createdComponent.id, userId, trx)
                }

                await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'component create')
                return createdComponent
            })
        } catch (error) {
            if (isSchemaSyncFailure(error)) {
                return respondSchemaSyncFailure(res, error.operation, error.cause)
            }
            if (error instanceof Error && error.message === GLOBAL_COMPONENT_CODENAME_LOCK_ERROR) {
                return res.status(409).json({ error: GLOBAL_COMPONENT_CODENAME_LOCK_ERROR })
            }
            if (isUniqueViolation(error)) {
                return res.status(409).json({ error: 'Component with this codename already exists' })
            }
            throw error
        } finally {
            if (globalCodenameLockKey) {
                await releasePoolAdvisoryLock(globalCodenameLockKey)
            }
        }

        res.status(201).json(component)
    }

    // ─── Copy component ──────────────────────────────────────────────────
    const copy = async (req: Request, res: Response) => {
        const { metahubId, objectCollectionId, componentId } = req.params
        const { componentsService, fixedValuesService, exec, settingsService } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const source = await componentsService.findById(metahubId, componentId, userId)
        if (!source || source.objectCollectionId !== objectCollectionId) {
            return res.status(404).json({ error: 'Component not found' })
        }
        if (source.system?.isSystem) {
            return res.status(409).json({ error: 'System components cannot be copied', code: 'SYSTEM_COMPONENT_PROTECTED' })
        }

        const allowComponentCopy = await getAllowComponentCopy(settingsService, metahubId, userId)
        if (!allowComponentCopy) {
            return res.status(403).json({ error: 'Component copy is disabled by metahub settings' })
        }

        const parsed = copyComponentSchema.safeParse(req.body ?? {})
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
        }

        const copyOptions = {
            copyChildComponents: parsed.data.copyChildComponents !== false
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
                error: 'targetConstantId override is only supported for components referencing sets'
            })
        }
        const copyTargetConstantId = parsed.data.targetConstantId !== undefined ? parsed.data.targetConstantId : source.targetConstantId
        if (source.targetEntityKind === SET_KIND) {
            if (!source.targetEntityId) {
                return res.status(400).json({ error: 'Source component has invalid set reference configuration' })
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
                  copiedComponent: Awaited<ReturnType<MetahubComponentsService['create']>>
                  copiedChildComponents: number
              }
            | undefined
        const codenameScope = await getComponentCodenameScope(settingsService, metahubId, userId)
        let globalCodenameLockKey: string | null = null
        if (codenameScope === 'global') {
            globalCodenameLockKey = uuidToLockKey(`component-codename-global:${metahubId}:${objectCollectionId}`)
            const lockAcquired = await acquirePoolAdvisoryLock(globalCodenameLockKey)
            if (!lockAcquired) {
                return res.status(409).json({ error: GLOBAL_COMPONENT_CODENAME_LOCK_ERROR })
            }
        }

        try {
            for (let attempt = 1; attempt <= CODENAME_RETRY_MAX_ATTEMPTS && !copyResult; attempt++) {
                const codenameCandidate = buildCodenameAttempt(normalizedBaseCodename, attempt, codenameStyle)
                try {
                    copyResult = await exec.transaction(async (trx: SqlQueryable) => {
                        const existing = await componentsService.findByCodename(
                            metahubId,
                            objectCollectionId,
                            codenameCandidate,
                            source.parentComponentId ?? null,
                            userId,
                            trx,
                            { ignoreParentScope: codenameScope === 'global' }
                        )
                        if (existing) {
                            throw Object.assign(new Error('Component codename already exists'), { retryableConflict: true })
                        }

                        const copiedComponent = await componentsService.create(
                            metahubId,
                            {
                                objectCollectionId,
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
                                isDisplayComponent: false,
                                targetEntityId: source.targetEntityId ?? undefined,
                                targetEntityKind: source.targetEntityKind ?? undefined,
                                targetConstantId: source.targetEntityKind === SET_KIND ? copyTargetConstantId ?? undefined : undefined,
                                sortOrder: undefined,
                                parentComponentId: source.parentComponentId ?? null,
                                createdBy: userId
                            },
                            userId,
                            trx
                        )

                        let copiedChildComponents = 0
                        if (source.dataType === ComponentDefinitionDataType.TABLE && copyOptions.copyChildComponents) {
                            const children = await componentsService.findChildComponents(metahubId, source.id, userId, trx)
                            const usedChildCodenames = new Set<string>()
                            for (const child of children) {
                                let childCodename = child.codename
                                if (codenameScope === 'global') {
                                    let uniqueChildCodename: string | null = null
                                    for (let childAttempt = 1; childAttempt <= CODENAME_RETRY_MAX_ATTEMPTS; childAttempt++) {
                                        const candidate = buildCodenameAttempt(child.codename, childAttempt, codenameStyle)
                                        if (usedChildCodenames.has(candidate)) continue
                                        const existingChild = await componentsService.findByCodename(
                                            metahubId,
                                            objectCollectionId,
                                            candidate,
                                            copiedComponent.id,
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
                                        throw Object.assign(new Error('Unable to generate unique codename for copied child component'), {
                                            retryableConflict: true
                                        })
                                    }

                                    childCodename = uniqueChildCodename
                                }

                                usedChildCodenames.add(childCodename)
                                await componentsService.create(
                                    metahubId,
                                    {
                                        objectCollectionId,
                                        codename: childCodename,
                                        dataType: child.dataType,
                                        name: child.name,
                                        validationRules: (child.validationRules as Record<string, unknown> | undefined) ?? {},
                                        uiConfig: { ...((child.uiConfig as Record<string, unknown> | undefined) ?? {}) },
                                        isRequired: child.isDisplayComponent ? true : Boolean(child.isRequired),
                                        isDisplayComponent: Boolean(child.isDisplayComponent),
                                        targetEntityId: child.targetEntityId ?? undefined,
                                        targetEntityKind: child.targetEntityKind ?? undefined,
                                        targetConstantId:
                                            child.targetEntityKind === SET_KIND ? child.targetConstantId ?? undefined : undefined,
                                        sortOrder: child.sortOrder,
                                        parentComponentId: copiedComponent.id,
                                        createdBy: userId
                                    },
                                    userId,
                                    trx
                                )
                                copiedChildComponents += 1
                            }
                        }

                        await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'component copy')
                        return { copiedComponent, copiedChildComponents }
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
            return res.status(409).json({ error: 'Unable to generate unique codename for component copy' })
        }

        return res.status(201).json({
            ...copyResult!.copiedComponent,
            copyOptions,
            copiedChildComponents: copyResult!.copiedChildComponents
        })
    }

    // ─── Update component ────────────────────────────────────────────────
    const update = async (req: Request, res: Response) => {
        const { metahubId, objectCollectionId, componentId } = req.params
        const { componentsService, objectsService, optionValuesService, fixedValuesService, entityTypeService, exec, settingsService } =
            services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const component = await componentsService.findById(metahubId, componentId, userId)
        if (!component || component.objectCollectionId !== objectCollectionId) {
            return res.status(404).json({ error: 'Component not found' })
        }

        const parsed = updateComponentSchema.safeParse(req.body)
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
            isDisplayComponent,
            isEnabled,
            sortOrder,
            expectedVersion
        } = parsed.data

        if (component.system?.isSystem) {
            const forbiddenKeys = getForbiddenSystemComponentPatchKeys(parsed.data as Record<string, unknown>)
            if (forbiddenKeys.length > 0) {
                return res.status(409).json({
                    error: `System components only support enable/disable changes. Forbidden fields: ${forbiddenKeys.join(', ')}`,
                    code: 'SYSTEM_COMPONENT_PROTECTED'
                })
            }

            if (isEnabled === undefined) {
                return res.status(400).json({
                    error: 'System components require isEnabled for updates',
                    code: 'SYSTEM_COMPONENT_UPDATE_INVALID'
                })
            }

            try {
                const updated = await exec.transaction(async (trx: SqlQueryable) => {
                    const nextComponent = await componentsService.update(
                        metahubId,
                        componentId,
                        {
                            isEnabled,
                            expectedVersion,
                            updatedBy: userId
                        },
                        userId,
                        trx
                    )
                    await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'component update')
                    return nextComponent
                })

                return res.json(updated)
            } catch (error) {
                if (isSchemaSyncFailure(error)) {
                    return respondSchemaSyncFailure(res, error.operation, error.cause)
                }
                if (error instanceof OptimisticLockError) {
                    return res.status(409).json({
                        error: 'Component was modified by another user. Please refresh and try again.',
                        code: 'OPTIMISTIC_LOCK_CONFLICT',
                        conflict: error.conflict
                    })
                }
                throw error
            }
        }

        if (dataType && dataType !== component.dataType) {
            return res.status(400).json({
                error: 'Data type change not allowed',
                code: 'DATA_TYPE_CHANGE_FORBIDDEN',
                message: 'Changing data type after creation is not supported. Please delete and recreate the component.',
                currentType: component.dataType,
                requestedType: dataType
            })
        }

        if (component.dataType === ComponentDefinitionDataType.STRING && validationRules) {
            const oldRules = component.validationRules as Record<string, unknown> | undefined
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
        const effectiveDataType = dataType ?? component.dataType
        const requestedDisplayState = isDisplayComponent !== undefined ? isDisplayComponent : Boolean(component.isDisplayComponent)
        if (requestedDisplayState && effectiveDataType === ComponentDefinitionDataType.TABLE) {
            return res.status(400).json({
                error: 'TABLE components cannot be set as display component',
                code: 'TABLE_DISPLAY_COMPONENT_FORBIDDEN'
            })
        }
        const isRefType = effectiveDataType === ComponentDefinitionDataType.REF
        let codenameScope: 'per-level' | 'global' = 'per-level'

        let effectiveTargetEntityId = component.targetEntityId ?? null
        let effectiveTargetEntityKind = component.targetEntityKind ?? null
        let effectiveTargetConstantId = component.targetConstantId ?? null

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
            if (normalizedCodename !== component.codename) {
                codenameScope = await getComponentCodenameScope(settingsService, metahubId, userId)
                updateData.codename = normalizedCodename
            }
            updateData.codename =
                syncOptionalCodenamePayloadText(codename, component.name?._primary ?? namePrimaryLocale ?? 'en', normalizedCodename) ??
                normalizedCodename
        }

        if (name !== undefined) {
            const sanitizedName = sanitizeLocalizedInput(name)
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }
            const primary = namePrimaryLocale ?? component.name?._primary ?? 'en'
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
                    if (component.targetConstantId !== null || resolvedTargetConstantId !== undefined) {
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
        const effectiveIsRequired = Boolean(isRequired ?? component.isRequired) || requestedDisplayState
        if (uiConfig || targetChanged || (isRefType && effectiveTargetEntityKind === ENUMERATION_KIND && isRequired !== undefined)) {
            const currentUiConfig = (component.uiConfig as Record<string, unknown>) ?? {}
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
            updateData.isRequired = effectiveDataType === ComponentDefinitionDataType.TABLE ? false : effectiveIsRequired
        } else if (isDisplayComponent === true) {
            updateData.isRequired = true
        }
        if (isEnabled !== undefined) updateData.isEnabled = isEnabled
        if (sortOrder !== undefined) updateData.sortOrder = sortOrder
        if (expectedVersion !== undefined) updateData.expectedVersion = expectedVersion
        updateData.updatedBy = userId

        let globalCodenameLockKey: string | null = null
        if (updateData.codename && codenameScope === 'global') {
            globalCodenameLockKey = uuidToLockKey(`component-codename-global:${metahubId}:${objectCollectionId}`)
            const lockAcquired = await acquirePoolAdvisoryLock(globalCodenameLockKey)
            if (!lockAcquired) {
                return res.status(409).json({ error: GLOBAL_COMPONENT_CODENAME_LOCK_ERROR })
            }
        }

        let updated
        try {
            if (updateData.codename) {
                const existing = await componentsService.findByCodename(
                    metahubId,
                    objectCollectionId,
                    updateData.codename as string,
                    component.parentComponentId ?? null,
                    userId,
                    undefined,
                    { ignoreParentScope: codenameScope === 'global' }
                )
                if (existing) {
                    return res.status(409).json({ error: 'Component with this codename already exists' })
                }
            }

            updated = await exec.transaction(async (trx: SqlQueryable) => {
                const nextComponent = await componentsService.update(metahubId, componentId, updateData, userId, trx)

                if (isDisplayComponent === true) {
                    await componentsService.setDisplayComponent(metahubId, objectCollectionId, componentId, userId, trx)
                } else if (isDisplayComponent === false) {
                    await componentsService.clearDisplayComponent(metahubId, componentId, userId, trx)
                }

                if (sortOrder !== undefined) {
                    const existingAttr = await componentsService.findById(metahubId, componentId, userId, trx)
                    await componentsService.ensureSequentialSortOrder(
                        metahubId,
                        objectCollectionId,
                        userId,
                        existingAttr?.parentComponentId ?? null,
                        trx
                    )
                }

                await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'component update')
                return nextComponent
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

        if (updated?.system?.isSystem && (isDisplayComponent === true || isDisplayComponent === false)) {
            return res.status(409).json({ error: 'System components cannot be used as display components' })
        }

        res.json(updated)
    }

    // ─── Move component ──────────────────────────────────────────────────
    const move = async (req: Request, res: Response) => {
        const { metahubId, objectCollectionId, componentId } = req.params
        const { componentsService } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const component = await componentsService.findById(metahubId, componentId, userId)
        if (!component || component.objectCollectionId !== objectCollectionId) {
            return res.status(404).json({ error: 'Component not found' })
        }

        const parsed = moveComponentSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
        }

        const { direction } = parsed.data

        const updated = await componentsService.moveComponent(metahubId, objectCollectionId, componentId, direction, userId)
        res.json(updated)
    }

    // ─── Reorder component ───────────────────────────────────────────────
    const reorder = async (req: Request, res: Response) => {
        const { metahubId, objectCollectionId } = req.params
        const { componentsService, settingsService } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const parsed = reorderComponentSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
        }

        const { componentId, newSortOrder, newParentComponentId, autoRenameCodename, mergedOrderIds } = parsed.data

        if (newParentComponentId !== undefined && mergedOrderIds) {
            return res.status(400).json({
                error: 'Validation failed',
                details: { mergedOrderIds: ['mergedOrderIds is not supported for cross-list transfers'] }
            })
        }

        const codenameScope = await getComponentCodenameScope(settingsService, metahubId, userId)
        const { style: codenameStyle } = await getCodenameSettings(settingsService, metahubId, userId)
        const allowCrossListRootChildren = await getAllowComponentMoveBetweenRootAndChildren(settingsService, metahubId, userId)
        const allowCrossListBetweenChildren = await getAllowComponentMoveBetweenChildLists(settingsService, metahubId, userId)

        const updated = mergedOrderIds
            ? await componentsService.reorderComponentMergedOrder(metahubId, objectCollectionId, componentId, mergedOrderIds, userId)
            : await componentsService.reorderComponent(
                  metahubId,
                  objectCollectionId,
                  componentId,
                  newSortOrder,
                  newParentComponentId,
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
        const { metahubId, objectCollectionId, componentId } = req.params
        const { componentsService, optionValuesService, exec } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const component = await componentsService.findById(metahubId, componentId, userId)
        if (!component || component.objectCollectionId !== objectCollectionId) {
            return res.status(404).json({ error: 'Component not found' })
        }
        if (component.system?.isSystem) {
            return res
                .status(409)
                .json({ error: 'System components cannot be used as display components', code: 'SYSTEM_COMPONENT_PROTECTED' })
        }

        const newValue = !component.isRequired
        if (component.isDisplayComponent && !newValue) {
            return res.status(400).json({
                error: 'Display component must be required'
            })
        }

        const isEnumerationRef =
            component.dataType === ComponentDefinitionDataType.REF &&
            component.targetEntityKind === ENUMERATION_KIND &&
            typeof component.targetEntityId === 'string'

        const currentUiConfig = ((component.uiConfig as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>

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
                if (!enumValue || enumValue.objectId !== component.targetEntityId) {
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
                await componentsService.update(metahubId, componentId, updatePayload, userId, trx)
                await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'component toggle required')
            })
        } catch (error) {
            if (isSchemaSyncFailure(error)) {
                return respondSchemaSyncFailure(res, error.operation, error.cause)
            }
            throw error
        }

        res.json({ success: true, isRequired: newValue })
    }

    // ─── Set display component ───────────────────────────────────────────
    const setDisplay = async (req: Request, res: Response) => {
        const { metahubId, objectCollectionId, componentId } = req.params
        const { componentsService, exec } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const component = await componentsService.findById(metahubId, componentId, userId)
        if (!component || component.objectCollectionId !== objectCollectionId) {
            return res.status(404).json({ error: 'Component not found' })
        }
        if (component.system?.isSystem) {
            return res
                .status(409)
                .json({ error: 'System components cannot be used as display components', code: 'SYSTEM_COMPONENT_PROTECTED' })
        }

        if (component.dataType === ComponentDefinitionDataType.TABLE) {
            return res.status(400).json({
                error: 'TABLE components cannot be set as display component',
                code: 'TABLE_DISPLAY_COMPONENT_FORBIDDEN'
            })
        }

        try {
            await exec.transaction(async (trx: SqlQueryable) => {
                await componentsService.setDisplayComponent(metahubId, objectCollectionId, componentId, userId, trx)
                await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'component set display')
            })
        } catch (error) {
            if (isSchemaSyncFailure(error)) {
                return respondSchemaSyncFailure(res, error.operation, error.cause)
            }
            throw error
        }

        res.json({ success: true })
    }

    // ─── Clear display component ─────────────────────────────────────────
    const clearDisplay = async (req: Request, res: Response) => {
        const { metahubId, objectCollectionId, componentId } = req.params
        const { componentsService, exec } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const component = await componentsService.findById(metahubId, componentId, userId)
        if (!component || component.objectCollectionId !== objectCollectionId) {
            return res.status(404).json({ error: 'Component not found' })
        }

        try {
            await exec.transaction(async (trx: SqlQueryable) => {
                await componentsService.clearDisplayComponent(metahubId, componentId, userId, trx)
                await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'component clear display')
            })
        } catch (error) {
            if (isSchemaSyncFailure(error)) {
                return respondSchemaSyncFailure(res, error.operation, error.cause)
            }
            if (error instanceof Error && error.message === 'At least one display component is required in each scope') {
                return res.status(409).json({
                    error: 'Cannot clear display component. Set another component as display first.'
                })
            }
            throw error
        }

        res.json({ success: true })
    }

    // ─── Delete component ────────────────────────────────────────────────
    const deleteComponent = async (req: Request, res: Response) => {
        const { metahubId, objectCollectionId, componentId } = req.params
        const { componentsService, settingsService, exec } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'deleteContent')
        if (!userId) return

        const component = await componentsService.findById(metahubId, componentId, userId)
        if (!component || component.objectCollectionId !== objectCollectionId) {
            return res.status(404).json({ error: 'Component not found' })
        }

        const allowComponentDelete = await getAllowComponentDelete(settingsService, metahubId, userId)
        if (!allowComponentDelete) {
            return res.status(403).json({ error: 'Component delete is disabled by metahub settings' })
        }

        if (component.isDisplayComponent) {
            const allowDeleteLastDisplayComponent = await getAllowDeleteLastDisplayComponent(settingsService, metahubId, userId)
            if (!allowDeleteLastDisplayComponent) {
                const scopedComponents = component.parentComponentId
                    ? await componentsService.findChildComponents(metahubId, component.parentComponentId, userId)
                    : await componentsService.findAll(metahubId, objectCollectionId, userId)

                const displayComponentsCount = scopedComponents.reduce(
                    (count, scopedComponent) => count + (scopedComponent.isDisplayComponent ? 1 : 0),
                    0
                )

                if (displayComponentsCount <= 1) {
                    return res.status(409).json({
                        error: 'Cannot delete the last display component while this policy is disabled.'
                    })
                }
            }
        }

        try {
            await exec.transaction(async (trx: SqlQueryable) => {
                await componentsService.ensureSequentialSortOrder(
                    metahubId,
                    objectCollectionId,
                    userId,
                    component.parentComponentId ?? null,
                    trx
                )
                await componentsService.delete(metahubId, componentId, userId, trx)
                await componentsService.ensureSequentialSortOrder(
                    metahubId,
                    objectCollectionId,
                    userId,
                    component.parentComponentId ?? null,
                    trx
                )
                await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'component delete')
            })
        } catch (error) {
            if (isSchemaSyncFailure(error)) {
                return respondSchemaSyncFailure(res, error.operation, error.cause)
            }
            throw error
        }

        return res.status(204).send()
    }

    // ─── Component codenames ─────────────────────────────────────────────
    const listCodenames = async (req: Request, res: Response) => {
        const { metahubId, objectCollectionId } = req.params
        const { componentsService } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId)
        if (!userId) return

        const allComponents = await componentsService.findAllFlat(metahubId, objectCollectionId, userId)

        const items = allComponents.map((cmp) => ({
            id: cmp.id,
            codename: cmp.codename
        }))

        res.json({ items })
    }

    // ─── Batch list child components for multiple parents ────────────────
    const listChildrenBatch = async (req: Request, res: Response) => {
        const { metahubId } = req.params
        const { componentsService } = services(req)
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

        const childrenByParent = await componentsService.findChildComponentsByParentIds(metahubId, parentIds, userId)
        const children: Record<string, unknown[]> = {}
        for (const [parentId, items] of childrenByParent) {
            children[parentId] = items
        }

        res.json({ children })
    }

    // ─── List child components ───────────────────────────────────────────
    const listChildren = async (req: Request, res: Response) => {
        const { metahubId, objectCollectionId, componentId } = req.params
        const { componentsService } = services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId)
        if (!userId) return

        const parent = await componentsService.findById(metahubId, componentId, userId)
        if (!parent || parent.objectCollectionId !== objectCollectionId) {
            return res.status(404).json({ error: 'Component not found' })
        }
        if (parent.dataType !== ComponentDefinitionDataType.TABLE) {
            return res.status(400).json({ error: 'Component is not a TABLE type' })
        }

        const children = await componentsService.findChildComponents(metahubId, componentId, userId)

        res.json({ items: children, total: children.length })
    }

    // ─── Create child component ──────────────────────────────────────────
    const createChild = async (req: Request, res: Response) => {
        const { metahubId, objectCollectionId, componentId } = req.params
        const { componentsService, objectsService, optionValuesService, fixedValuesService, entityTypeService, exec, settingsService } =
            services(req)
        const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'editContent')
        if (!userId) return

        const parent = await componentsService.findById(metahubId, componentId, userId)
        if (!parent || parent.objectCollectionId !== objectCollectionId) {
            return res.status(404).json({ error: 'Parent component not found' })
        }
        if (parent.dataType !== ComponentDefinitionDataType.TABLE) {
            return res.status(400).json({ error: 'Parent component must be TABLE type' })
        }

        const parsed = createComponentSchema.safeParse({
            ...req.body,
            parentComponentId: componentId
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
        const shouldBeDisplayComponent = Boolean(req.body.isDisplayComponent)
        const effectiveIsRequired = shouldBeDisplayComponent || Boolean(isRequired)

        const allSettings = await settingsService.findAll(metahubId, userId)

        const allowedTypes = extractAllowedComponentTypes(allSettings)
        if (allowedTypes.length > 0 && !allowedTypes.includes(dataType)) {
            return res.status(400).json({
                error: `Component data type "${dataType}" is not allowed by metahub settings`,
                code: 'DATA_TYPE_NOT_ALLOWED',
                allowedTypes
            })
        }

        if (!isTableChildDataType(dataType)) {
            return res.status(400).json({
                error: `Data type "${dataType}" is not allowed for child components`,
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

        if (dataType === ComponentDefinitionDataType.REF) {
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
        if (dataType !== ComponentDefinitionDataType.REF && resolvedTargetConstantId !== undefined) {
            return res.status(400).json({
                error: 'targetConstantId is only supported for REF type'
            })
        }

        let normalizedUiConfig: Record<string, unknown> = { ...(uiConfig ?? {}) }
        if (dataType === ComponentDefinitionDataType.REF && resolvedTargetEntityKind === ENUMERATION_KIND && resolvedTargetEntityId) {
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

        const codenameScope = await getComponentCodenameScope(settingsService, metahubId, userId)

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
            globalCodenameLockKey = uuidToLockKey(`component-codename-global:${metahubId}:${objectCollectionId}`)
            const lockAcquired = await acquirePoolAdvisoryLock(globalCodenameLockKey)
            if (!lockAcquired) {
                return res.status(409).json({ error: GLOBAL_COMPONENT_CODENAME_LOCK_ERROR })
            }
        }

        let component
        try {
            const existing = await componentsService.findByCodename(
                metahubId,
                objectCollectionId,
                normalizedCodename,
                componentId,
                userId,
                undefined,
                { ignoreParentScope: codenameScope === 'global' }
            )
            if (existing) {
                return res.status(409).json({ error: 'Component with this codename already exists' })
            }

            component = await exec.transaction(async (trx: SqlQueryable) => {
                const createdComponent = await componentsService.create(
                    metahubId,
                    {
                        objectCollectionId,
                        codename: codenamePayload ?? normalizedCodename,
                        dataType,
                        name: nameVlc,
                        validationRules: validationRules ?? {},
                        uiConfig: normalizedUiConfig,
                        isRequired: effectiveIsRequired,
                        isDisplayComponent: false,
                        targetEntityId: resolvedTargetEntityId,
                        targetEntityKind: resolvedTargetEntityKind,
                        targetConstantId: resolvedTargetEntityKind === SET_KIND ? resolvedTargetConstantId : undefined,
                        sortOrder,
                        parentComponentId: componentId,
                        createdBy: userId
                    },
                    userId,
                    trx
                )

                if (shouldBeDisplayComponent && createdComponent.id) {
                    await componentsService.setDisplayComponent(metahubId, objectCollectionId, createdComponent.id, userId, trx)
                }

                await syncMetahubSchemaOrThrow(metahubId, trx, userId, 'child component create')
                return createdComponent
            })
        } catch (error) {
            if (isSchemaSyncFailure(error)) {
                return respondSchemaSyncFailure(res, error.operation, error.cause)
            }
            if (isUniqueViolation(error)) {
                return res.status(409).json({ error: 'Component with this codename already exists' })
            }
            throw error
        } finally {
            if (globalCodenameLockKey) {
                await releasePoolAdvisoryLock(globalCodenameLockKey)
            }
        }

        res.status(201).json(component)
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
        delete: deleteComponent,
        listCodenames,
        listChildren,
        listChildrenBatch,
        createChild
    }
}
