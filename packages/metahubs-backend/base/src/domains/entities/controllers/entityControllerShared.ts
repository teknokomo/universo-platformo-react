import { z } from 'zod'
import type { Request, Response, RequestHandler } from 'express'
import type { DbExecutor } from '@universo/utils'
import {
    localizedContent,
    resolveLocalizedContent,
    normalizeObjectCollectionCopyOptions,
    normalizeOptionListCopyOptions,
    normalizeTreeEntityCopyOptions,
    normalizeValueGroupCopyOptions
} from '@universo/utils'
import { isValidCodenameForStyle, normalizeCodenameForStyle } from '@universo/utils/validation/codename'
import {
    isEnabledCapabilityConfig,
    isBuiltinEntityKind,
    normalizePageBlockContentForStorage,
    normalizeLedgerConfigFromConfig,
    supportsLedgerSchema,
    validateLedgerConfigReferences,
    type BlockContentCapabilityConfig,
    type PageBlockContentValidationOptions,
    type ResolvedEntityType,
    type BuiltinEntityKind
} from '@universo/types'
import { getRequestDbSession } from '@universo/utils/database'
import { ListQuerySchema } from '../../shared/queryParams'
import { MetahubConflictError, MetahubValidationError } from '../../shared/domainErrors'
import {
    CODENAME_RETRY_MAX_ATTEMPTS,
    buildCodenameAttempt,
    codenameErrorMessage,
    getCodenameSettings
} from '../../shared/codenameStyleHelper'
import {
    enforceSingleLocaleCodename,
    getCodenamePayloadText,
    requiredCodenamePayloadSchema,
    optionalCodenamePayloadSchema,
    syncCodenamePayloadText
} from '../../shared/codenamePayload'
import { MetahubFixedValuesService } from '../../metahubs/services/MetahubFixedValuesService'
import { MetahubComponentsService } from '../../metahubs/services/MetahubComponentsService'
import { MetahubObjectsService, type MetahubObjectRow } from '../../metahubs/services/MetahubObjectsService'
import { MetahubOptionValuesService } from '../../metahubs/services/MetahubOptionValuesService'
import { MetahubSettingsService } from '../../settings/services/MetahubSettingsService'
import { ensureMetahubAccess, type RolePermission } from '../../shared/guards'
import { EntityTypeResolver } from '../../shared/entityTypeResolver'
import { EntityTypeService } from '../services/EntityTypeService'
import { ActionService } from '../services/ActionService'
import { EntityActionExecutionService } from '../services/EntityActionExecutionService'
import { EventBindingService } from '../services/EventBindingService'
import { EntityEventRouter } from '../services/EntityEventRouter'
import { EntityMutationService } from '../services/EntityMutationService'
import { MetahubTreeEntitiesService } from '../../metahubs/services/MetahubTreeEntitiesService'
import { executeBlockedDelete, type EntityDeleteOutcome } from '../services/entityDeletePatterns'
import { MetahubScriptsService } from '../../scripts/services/MetahubScriptsService'
import { resolveEntityMetadataAclPermission, resolveEntityMetadataSettingKey } from '../../shared/entityMetadataKinds'
import { toTimestamp } from '../../shared/timestamps'
import type { EntityBehaviorDeleteContext, EntityBehaviorService } from '../services/EntityBehaviorService'

export const { buildLocalizedContent, sanitizeLocalizedInput } = localizedContent

export type BuiltinEntityRouteKind = 'hub' | 'object' | 'set' | 'enumeration' | 'page'

export const STANDARD_ENTITY_PARAM_BY_KIND: Record<
    BuiltinEntityRouteKind,
    'treeEntityId' | 'objectCollectionId' | 'valueGroupId' | 'optionListId' | 'pageId'
> = {
    hub: 'treeEntityId',
    object: 'objectCollectionId',
    set: 'valueGroupId',
    enumeration: 'optionListId',
    page: 'pageId'
}

export const normalizeLocaleCode = (locale?: string): string => locale?.split('-')[0].split('_')[0].toLowerCase() || 'en'
export const normalizeRouteKindKey = (value?: string | null): string => (typeof value === 'string' ? value.trim() : '')
export const isBuiltinEntityRouteKind = (value: string | null | undefined): value is BuiltinEntityRouteKind =>
    value === 'hub' || value === 'object' || value === 'set' || value === 'enumeration' || value === 'page'

export const ensureStandardRouteKindQuery = (req: Request): void => {
    const routeKindKey = normalizeRouteKindKey(req.params.kindKey)
    if (!routeKindKey || typeof req.query.kindKey === 'string') {
        return
    }

    req.query = {
        ...req.query,
        kindKey: routeKindKey
    }
}

export const ensureStandardCreateRouteKindBody = (req: Request): void => {
    const routeKindKey = normalizeRouteKindKey(req.params.kindKey)
    if (!routeKindKey) {
        return
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        req.body = { kindKey: routeKindKey }
        return
    }

    if (!('kindKey' in req.body)) {
        req.body = {
            ...req.body,
            kindKey: routeKindKey
        }
    }
}

export const assignBuiltinEntityIdParam = (req: Request, routeKind: BuiltinEntityRouteKind): void => {
    const paramName = STANDARD_ENTITY_PARAM_BY_KIND[routeKind]
    if (req.params.entityId && !req.params[paramName]) {
        req.params[paramName] = req.params.entityId
    }
}

export const invokeHandler = async (handler: RequestHandler, req: Request, res: Response): Promise<void> => {
    await Promise.resolve((handler as unknown as (request: Request, response: Response) => unknown)(req, res))
}

export const respondUnsupportedEntityRouteKind = (res: Response): void => {
    res.status(404).json({ error: 'Unsupported entity route kind' })
}

export const optionalBooleanFromQuery = z.preprocess((value) => {
    if (value === undefined) return undefined
    return value === 'true' || value === true
}, z.boolean().optional())

export const localizedFieldSchema = z.record(z.string().max(5000))
export const codenameInputSchema = z.union([z.string().trim().min(1), requiredCodenamePayloadSchema])
export const optionalCodenameInputSchema = z.union([z.string().trim().min(1), optionalCodenamePayloadSchema]).optional()

export const entityListQuerySchema = ListQuerySchema.extend({
    kind: z.string().trim().min(1).max(64),
    locale: z.string().trim().min(2).max(10).optional(),
    includeDeleted: optionalBooleanFromQuery.default(false),
    onlyDeleted: optionalBooleanFromQuery.default(false),
    treeEntityId: z.string().uuid().optional()
})

export const entityGetQuerySchema = z.object({
    includeDeleted: optionalBooleanFromQuery.default(false)
})

export const createEntitySchema = z
    .object({
        kind: z.string().trim().min(1).max(64),
        codename: codenameInputSchema,
        name: localizedFieldSchema.optional(),
        namePrimaryLocale: z.string().trim().min(2).max(10).optional(),
        description: localizedFieldSchema.optional(),
        descriptionPrimaryLocale: z.string().trim().min(2).max(10).optional(),
        config: z.record(z.unknown()).optional()
    })
    .strict()

export const updateEntitySchema = z
    .object({
        codename: optionalCodenameInputSchema,
        name: localizedFieldSchema.optional(),
        namePrimaryLocale: z.string().trim().min(2).max(10).optional(),
        description: localizedFieldSchema.optional(),
        descriptionPrimaryLocale: z.string().trim().min(2).max(10).optional(),
        config: z.record(z.unknown()).optional(),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

export const copyEntitySchema = z
    .object({
        codename: optionalCodenameInputSchema,
        name: localizedFieldSchema.optional(),
        namePrimaryLocale: z.string().trim().min(2).max(10).optional(),
        description: localizedFieldSchema.optional(),
        descriptionPrimaryLocale: z.string().trim().min(2).max(10).optional(),
        config: z.record(z.unknown()).optional(),
        parentTreeEntityId: z.string().trim().uuid().nullable().optional(),
        copyAllRelations: z.boolean().optional(),
        copyObjectCollectionRelations: z.boolean().optional(),
        copyValueGroupRelations: z.boolean().optional(),
        copyOptionListRelations: z.boolean().optional(),
        copyComponents: z.boolean().optional(),
        copyRecords: z.boolean().optional(),
        copyFixedValues: z.boolean().optional(),
        copyOptionValues: z.boolean().optional()
    })
    .strict()
    .superRefine((value, ctx) => {
        const copyComponents = value.copyComponents
        const copyRecords = value.copyRecords
        if (copyComponents === false && copyRecords === true) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['copyRecords'],
                message: 'copyRecords requires copyComponents=true'
            })
        }
    })

export const validateEntityConfigForComponents = (
    resolvedType: ResolvedEntityType,
    config: Record<string, unknown> | undefined
): Record<string, unknown> | undefined => {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return config
    }

    if (!Object.prototype.hasOwnProperty.call(config, 'blockContent')) {
        return config
    }

    const blockContentComponent = resolvedType.capabilities.blockContent
    if (!isEnabledCapabilityConfig(blockContentComponent)) {
        throw new MetahubValidationError('Block content is not enabled for this entity type', {
            kind: resolvedType.kindKey,
            field: 'config.blockContent'
        })
    }

    try {
        return {
            ...config,
            blockContent: normalizePageBlockContentForStorage(
                config.blockContent,
                buildPageBlockContentValidationOptions(blockContentComponent)
            )
        }
    } catch (error) {
        throw new MetahubValidationError('Invalid page block content', {
            field: 'config.blockContent',
            issues: error instanceof Error ? error.message : error
        })
    }
}

export const validateLedgerConfigReferencesForEntity = async (params: {
    resolvedType: ResolvedEntityType
    config: Record<string, unknown> | undefined
    metahubId: string
    objectId: string | null
    userId?: string
    componentsService: MetahubComponentsService
}): Promise<void> => {
    if (
        !params.config ||
        !supportsLedgerSchema(params.resolvedType.capabilities) ||
        !Object.prototype.hasOwnProperty.call(params.config, 'ledger')
    ) {
        return
    }

    const config = normalizeLedgerConfigFromConfig(params.config)
    const fields = params.objectId
        ? (await params.componentsService.findAllFlat(params.metahubId, params.objectId, params.userId, 'business')).map((field) => ({
              codename: field.codename,
              dataType: field.dataType
          }))
        : []
    const referenceErrors = validateLedgerConfigReferences({ config, fields })
    const blockingReferenceErrors = params.objectId
        ? referenceErrors
        : referenceErrors.filter((error) => error.code === 'DUPLICATE_FIELD_ROLE' || error.code === 'DUPLICATE_PROJECTION_CODENAME')

    if (blockingReferenceErrors.length > 0) {
        throw new MetahubValidationError('Ledger schema config contains invalid field references', {
            field: 'config.ledger',
            errors: blockingReferenceErrors
        })
    }
}

export const buildPageBlockContentValidationOptions = (
    component: Partial<BlockContentCapabilityConfig>
): PageBlockContentValidationOptions => ({
    allowedBlockTypes: component.allowedBlockTypes,
    maxBlocks: component.maxBlocks
})

export const reorderEntitiesSchema = z
    .object({
        kind: z.string().trim().min(1).max(64),
        entityId: z.string().trim().uuid(),
        newSortOrder: z.number().int().min(1)
    })
    .strict()

export const createEntityServices = (
    exec: ConstructorParameters<typeof MetahubObjectsService>[0],
    schemaService: ConstructorParameters<typeof MetahubObjectsService>[1]
) => {
    const objectsService = new MetahubObjectsService(exec, schemaService)
    const componentsService = new MetahubComponentsService(exec, schemaService)
    const settingsService = new MetahubSettingsService(exec, schemaService)
    const fixedValuesService = new MetahubFixedValuesService(exec, schemaService)
    const entityTypeService = new EntityTypeService(exec, schemaService)
    const resolver = new EntityTypeResolver(entityTypeService)
    const actionService = new ActionService(exec, schemaService, entityTypeService)
    const eventBindingService = new EventBindingService(exec, schemaService, entityTypeService)
    const scriptsService = new MetahubScriptsService(exec, schemaService)
    const actionExecutionService = new EntityActionExecutionService(scriptsService)
    const eventRouter = new EntityEventRouter(eventBindingService, actionService)
    const mutationService = new EntityMutationService(exec, schemaService, eventRouter)

    return {
        objectsService,
        componentsService,
        settingsService,
        fixedValuesService,
        entityTypeService,
        resolver,
        mutationService,
        actionExecutor: actionExecutionService.execute
    }
}

export const assertSupportedEntityKind = async (resolver: EntityTypeResolver, kind: string, metahubId: string, userId?: string) => {
    const resolved = await resolver.resolve(kind, { metahubId, userId })

    if (!resolved) {
        throw new MetahubValidationError('Unknown entity kind', { kind })
    }

    return resolved
}

export type MutationPermissionMode = 'create' | 'edit' | 'delete'

export type PolicyOutcome = {
    status: number
    body: Record<string, unknown>
}

export const ENTITY_METADATA_LABEL_PLURAL_MAP = {
    object: 'objects',
    hub: 'hubs',
    set: 'sets',
    enumeration: 'enumerations',
    page: 'pages',
    ledger: 'ledgers'
} as const

export type ResolvedTypeWithOptionalConfig = ResolvedEntityType & { config?: Record<string, unknown> | null }

export const getEntityMutationPermission = (resolvedType: ResolvedEntityType, mode: MutationPermissionMode): RolePermission =>
    resolveEntityMetadataAclPermission(
        resolvedType as ResolvedTypeWithOptionalConfig,
        mode === 'delete' ? 'delete' : mode === 'create' ? 'create' : 'edit'
    )

export const getEntityMetadataKind = (resolvedType: ResolvedEntityType | null | undefined): BuiltinEntityKind | null => {
    const resolvedKindKey = resolvedType?.kindKey?.trim() ?? ''
    return isBuiltinEntityKind(resolvedKindKey) ? resolvedKindKey : null
}

export const buildEntityMetadataPolicyError = (
    resolvedType: ResolvedEntityType,
    operation: 'copy' | 'delete'
): { status: number; body: Record<string, unknown> } | null => {
    const metadataKind = getEntityMetadataKind(resolvedType)
    if (!metadataKind) {
        return null
    }

    const label = ENTITY_METADATA_LABEL_PLURAL_MAP[metadataKind]
    return {
        status: 403,
        body: {
            error: `${operation === 'copy' ? 'Copying' : 'Deleting'} ${label} is disabled in metahub settings`
        }
    }
}

export const ensureEntityMutationPermission = async ({
    req,
    exec,
    userId,
    metahubId,
    resolvedType,
    mode
}: {
    req: Request
    exec: ConstructorParameters<typeof MetahubObjectsService>[0]
    userId: string
    metahubId: string
    resolvedType: ResolvedEntityType
    mode: MutationPermissionMode
}) => {
    const dbSession = getRequestDbSession(req)
    await ensureMetahubAccess(exec, userId, metahubId, getEntityMutationPermission(resolvedType, mode), dbSession)
}

export const checkEntityMetadataCopyPolicy = async ({
    resolvedType,
    settingsService,
    metahubId,
    userId
}: {
    resolvedType: ResolvedEntityType
    settingsService: MetahubSettingsService
    metahubId: string
    userId?: string
}): Promise<PolicyOutcome | null> => {
    const allowCopySettingKey = resolveEntityMetadataSettingKey(resolvedType, 'allowCopy')
    if (!allowCopySettingKey) {
        return null
    }

    const allowCopyRow = await settingsService.findByKey(metahubId, allowCopySettingKey, userId)
    if (allowCopyRow && allowCopyRow.value?._value === false) {
        return buildEntityMetadataPolicyError(resolvedType, 'copy')
    }

    return null
}

export const buildDesignTimeCopyPlan = (resolvedType: ResolvedEntityType) => ({
    copyComponents: isEnabledCapabilityConfig(resolvedType.capabilities.dataSchema),
    copyRecords: isEnabledCapabilityConfig(resolvedType.capabilities.records),
    copyFixedValues: isEnabledCapabilityConfig(resolvedType.capabilities.fixedValues),
    copyOptionValues: isEnabledCapabilityConfig(resolvedType.capabilities.optionValues)
})

export const applyDesignTimeCopyOverrides = (
    plan: ReturnType<typeof buildDesignTimeCopyPlan>,
    input: {
        copyAllRelations?: boolean
        copyObjectCollectionRelations?: boolean
        copyValueGroupRelations?: boolean
        copyOptionListRelations?: boolean
        copyComponents?: boolean
        copyRecords?: boolean
        copyFixedValues?: boolean
        copyOptionValues?: boolean
    }
) => {
    const treeCopyOptions = normalizeTreeEntityCopyOptions({
        copyAllRelations: input.copyAllRelations,
        copyObjectCollectionRelations: input.copyObjectCollectionRelations,
        copyValueGroupRelations: input.copyValueGroupRelations,
        copyOptionListRelations: input.copyOptionListRelations
    })
    const copyOptions = normalizeObjectCollectionCopyOptions({
        copyComponents: input.copyComponents,
        copyRecords: input.copyRecords
    })
    const valueGroupCopyOptions = normalizeValueGroupCopyOptions({
        copyFixedValues: input.copyFixedValues
    })
    const optionListCopyOptions = normalizeOptionListCopyOptions({
        copyOptionValues: input.copyOptionValues
    })

    return {
        ...plan,
        copyComponents: plan.copyComponents && copyOptions.copyComponents && treeCopyOptions.copyObjectCollectionRelations,
        copyRecords: plan.copyRecords && copyOptions.copyRecords,
        copyFixedValues: plan.copyFixedValues && valueGroupCopyOptions.copyFixedValues && treeCopyOptions.copyValueGroupRelations,
        copyOptionValues: plan.copyOptionValues && optionListCopyOptions.copyOptionValues && treeCopyOptions.copyOptionListRelations
    }
}

export const hasDesignTimeChildrenToCopy = (plan: ReturnType<typeof buildDesignTimeCopyPlan>) =>
    plan.copyComponents || plan.copyRecords || plan.copyFixedValues || plan.copyOptionValues

export const executeBehaviorDelete = async ({
    behavior,
    entity,
    context,
    deleteEntity
}: {
    behavior: EntityBehaviorService
    entity: MetahubObjectRow
    context: EntityBehaviorDeleteContext
    deleteEntity: () => Promise<void>
}): Promise<EntityDeleteOutcome> => {
    let beforeEntityDelete: (() => Promise<void>) | undefined

    return executeBlockedDelete({
        entity,
        entityLabel: behavior.entityLabel,
        beforeDelete: async () => {
            const deletePlan = behavior.buildDeletePlan ? await behavior.buildDeletePlan(context) : { policyOutcome: null }
            beforeEntityDelete = deletePlan.beforeEntityDelete
            return deletePlan.policyOutcome
        },
        deleteEntity: async () => {
            await beforeEntityDelete?.()
            await deleteEntity()
        }
    })
}

export const executeBehaviorBlockingState = async ({
    behavior,
    context
}: {
    behavior: EntityBehaviorService
    context: EntityBehaviorDeleteContext
}) => {
    if (!behavior.buildBlockingState) {
        throw new MetahubValidationError('Blocking-state behavior is not available for this entity kind', {
            kind: behavior.kindKey
        })
    }

    return behavior.buildBlockingState(context)
}

export const buildRequiredLocalizedField = (
    value: Record<string, string> | undefined,
    primaryLocale: string | undefined,
    fieldName: string,
    fallbackText?: string
) => {
    const normalizedPrimaryLocale = normalizeLocaleCode(primaryLocale)
    const sanitized = sanitizeLocalizedInput(value ?? (fallbackText ? { [normalizedPrimaryLocale]: fallbackText } : {}))

    if (Object.keys(sanitized).length === 0) {
        throw new MetahubValidationError(`${fieldName} must contain at least one locale value`)
    }

    return buildLocalizedContent(sanitized, normalizedPrimaryLocale, 'en')
}

export const buildOptionalLocalizedField = (value: Record<string, string> | undefined, primaryLocale?: string) => {
    if (value === undefined) {
        return undefined
    }

    const sanitized = sanitizeLocalizedInput(value)
    if (Object.keys(sanitized).length === 0) {
        return null
    }

    return buildLocalizedContent(sanitized, normalizeLocaleCode(primaryLocale), 'en')
}

export const buildNameSearchText = (value: unknown, locale?: string): string => {
    const localized = typeof locale === 'string' ? resolveLocalizedContent(value as never, locale) : undefined
    if (localized) {
        return localized.toLowerCase()
    }

    if (value && typeof value === 'object') {
        return JSON.stringify(value).toLowerCase()
    }

    return ''
}

export type EntityInstanceRow = MetahubObjectRow & {
    name?: unknown
    description?: unknown
    _mhb_deleted?: unknown
}

export type OptionListRouteRow = {
    id: string
    kind?: string
    codename: unknown
    presentation?: {
        name?: unknown
        description?: unknown
    }
    config?: {
        hubs?: string[]
        isSingleHub?: boolean
        isRequiredHub?: boolean
        sortOrder?: number
    }
    _upl_version?: number
    _upl_created_at?: unknown
    _upl_updated_at?: unknown
    created_at?: unknown
    updated_at?: unknown
}

export type ValueGroupRouteRow = {
    id: string
    kind?: string
    codename: unknown
    presentation?: {
        name?: unknown
        description?: unknown
    }
    config?: {
        hubs?: unknown
        isSingleHub?: boolean
        isRequiredHub?: boolean
        sortOrder?: number
    }
    _upl_version?: number
    _upl_created_at?: unknown
    _upl_updated_at?: unknown
}

export type ValueGroupListItemRow = {
    id: string
    metahubId: string
    codename: unknown
    name: unknown
    description: unknown
    isSingleHub: boolean
    isRequiredHub: boolean
    sortOrder: number
    version: number
    createdAt: unknown
    updatedAt: unknown
    fixedValuesCount: number
    hubs: Array<{ id: string; name: unknown; codename: string }>
}

export const getLocalizedCandidates = (value: unknown): string[] => {
    if (!value || typeof value !== 'object') return []
    const raw = value as Record<string, unknown>

    const locales = raw.locales
    if (locales && typeof locales === 'object') {
        return Object.values(locales as Record<string, unknown>)
            .map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>).content : null))
            .filter((content): content is string => typeof content === 'string' && content.trim().length > 0)
    }

    return Object.values(raw).filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

export const getLocalizedSortValue = (value: unknown, fallback: string): string => {
    if (!value || typeof value !== 'object') return fallback
    const raw = value as Record<string, unknown>

    const locales = raw.locales
    if (locales && typeof locales === 'object') {
        const localesRecord = locales as Record<string, unknown>
        const primary = typeof raw._primary === 'string' ? raw._primary : null
        const enContent =
            localesRecord.en && typeof localesRecord.en === 'object' ? (localesRecord.en as Record<string, unknown>).content : null
        if (typeof enContent === 'string' && enContent.trim().length > 0) return enContent

        if (primary) {
            const primaryContent =
                localesRecord[primary] && typeof localesRecord[primary] === 'object'
                    ? (localesRecord[primary] as Record<string, unknown>).content
                    : null
            if (typeof primaryContent === 'string' && primaryContent.trim().length > 0) return primaryContent
        }

        const firstContent = Object.values(localesRecord)
            .map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>).content : null))
            .find((content): content is string => typeof content === 'string' && content.trim().length > 0)
        return firstContent ?? fallback
    }

    if (typeof raw.en === 'string' && raw.en.trim().length > 0) return raw.en

    const firstSimple = Object.values(raw).find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    return firstSimple ?? fallback
}

export const isValueGroupObject = (row: ValueGroupRouteRow | null | undefined, allowedKinds?: Set<string>): row is ValueGroupRouteRow => {
    if (!row) return false
    if (allowedKinds) {
        return typeof row.kind === 'string' && allowedKinds.has(row.kind)
    }

    return row.kind === 'set'
}

export const getValueGroupTreeEntityIds = (row: ValueGroupRouteRow): string[] => {
    const rawHubs = row.config?.hubs
    if (!Array.isArray(rawHubs)) return []
    return rawHubs.filter((treeEntityId): treeEntityId is string => typeof treeEntityId === 'string')
}

export const mapValueGroupListItem = (row: ValueGroupRouteRow, metahubId: string, fixedValuesCount: number): ValueGroupListItemRow => ({
    id: row.id,
    metahubId,
    codename: row.codename,
    name: row.presentation?.name || {},
    description: row.presentation?.description || {},
    isSingleHub: row.config?.isSingleHub || false,
    isRequiredHub: row.config?.isRequiredHub || false,
    sortOrder: row.config?.sortOrder || 0,
    version: row._upl_version || 1,
    createdAt: row._upl_created_at,
    updatedAt: row._upl_updated_at,
    fixedValuesCount,
    hubs: []
})

export const compareValueGroupTieBreak = (a: ValueGroupListItemRow, b: ValueGroupListItemRow): number => {
    const bySortOrder = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    if (bySortOrder !== 0) return bySortOrder

    const byCodename = getCodenamePayloadText(a.codename as never).localeCompare(getCodenamePayloadText(b.codename as never))
    if (byCodename !== 0) return byCodename

    return a.id.localeCompare(b.id)
}

export const compareValueGroupItems = (
    a: ValueGroupListItemRow,
    b: ValueGroupListItemRow,
    sortBy: string,
    sortOrder: 'asc' | 'desc'
): number => {
    if (sortBy === 'name') {
        const valueA = getLocalizedSortValue(a.name, getCodenamePayloadText(a.codename as never)).toLowerCase()
        const valueB = getLocalizedSortValue(b.name, getCodenamePayloadText(b.codename as never)).toLowerCase()
        if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1
        if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1
        return compareValueGroupTieBreak(a, b)
    }

    if (sortBy === 'created') {
        const createdDiff = toTimestamp(a.createdAt) - toTimestamp(b.createdAt)
        if (createdDiff !== 0) return sortOrder === 'asc' ? createdDiff : -createdDiff
        return compareValueGroupTieBreak(a, b)
    }

    if (sortBy === 'updated') {
        const updatedDiff = toTimestamp(a.updatedAt) - toTimestamp(b.updatedAt)
        if (updatedDiff !== 0) return sortOrder === 'asc' ? updatedDiff : -updatedDiff
        return compareValueGroupTieBreak(a, b)
    }

    if (sortBy === 'codename') {
        const codenameDiff = getCodenamePayloadText(a.codename as never).localeCompare(getCodenamePayloadText(b.codename as never))
        if (codenameDiff !== 0) return sortOrder === 'asc' ? codenameDiff : -codenameDiff
        return compareValueGroupTieBreak(a, b)
    }

    if (sortBy === 'sortOrder') {
        const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        if (orderDiff !== 0) return sortOrder === 'asc' ? orderDiff : -orderDiff
        return compareValueGroupTieBreak(a, b)
    }

    return compareValueGroupTieBreak(a, b)
}

export const matchesValueGroupSearch = (codename: string, name: unknown, searchLower: string): boolean =>
    codename.toLowerCase().includes(searchLower) ||
    getLocalizedCandidates(name).some((candidate) => candidate.toLowerCase().includes(searchLower))

export const VALUE_GROUP_DEFAULT_PRIMARY_LOCALE = 'en'

export const validateValueGroupHubConstraints = (treeEntityIds: string[], isSingleHub: boolean, isRequiredHub: boolean): string | null => {
    if (isSingleHub && treeEntityIds.length > 1) {
        return 'Set with isSingleHub=true cannot be linked to multiple hubs'
    }
    if (isRequiredHub && treeEntityIds.length === 0) {
        return 'Set with isRequiredHub=true must be linked to at least one hub'
    }
    return null
}

export const resolveUniqueValueGroupCodename = async (params: {
    metahubId: string
    baseCodename: string
    codenameStyle: 'kebab-case' | 'pascal-case'
    objectsService: MetahubObjectsService
    userId: string
    excludeValueGroupId?: string
}): Promise<string | null> => {
    const { metahubId, baseCodename, codenameStyle, objectsService, userId, excludeValueGroupId } = params
    for (let attempt = 1; attempt <= CODENAME_RETRY_MAX_ATTEMPTS; attempt += 1) {
        const candidate = buildCodenameAttempt(baseCodename, attempt, codenameStyle)
        const existing = await objectsService.findByCodenameAndKind(metahubId, candidate, 'set', userId)
        if (!existing || (excludeValueGroupId && existing.id === excludeValueGroupId)) {
            return candidate
        }
    }
    return null
}

export const valueGroupListQuerySchema = ListQuerySchema.extend({
    sortBy: z.enum(['name', 'codename', 'created', 'updated', 'sortOrder']).default('updated'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    kindKey: z.string().trim().min(1).max(128).optional()
})

export const localizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((value) => (typeof value === 'string' ? { en: value } : value))
export const optionalLocalizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((value) => (typeof value === 'string' ? { en: value } : value))

export const createValueGroupSchema = z
    .object({
        codename: requiredCodenamePayloadSchema,
        name: localizedInputSchema.optional(),
        description: optionalLocalizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        sortOrder: z.number().int().optional(),
        isSingleHub: z.boolean().optional(),
        isRequiredHub: z.boolean().optional(),
        treeEntityIds: z.array(z.string().uuid()).optional(),
        kindKey: z.string().trim().min(1).max(128).optional()
    })
    .strict()

export const updateValueGroupSchema = z
    .object({
        codename: optionalCodenamePayloadSchema,
        name: localizedInputSchema.optional(),
        description: optionalLocalizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        sortOrder: z.number().int().optional(),
        isSingleHub: z.boolean().optional(),
        isRequiredHub: z.boolean().optional(),
        treeEntityIds: z.array(z.string().uuid()).optional(),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

export const reorderValueGroupsSchema = z
    .object({
        valueGroupId: z.string().uuid(),
        newSortOrder: z.number().int().min(1)
    })
    .strict()

export const getEntityPresentation = (value: Pick<EntityInstanceRow, 'presentation'>): Record<string, unknown> =>
    value.presentation && typeof value.presentation === 'object' ? (value.presentation as Record<string, unknown>) : {}

export const getEntityNameField = (value: EntityInstanceRow): unknown => value.name ?? getEntityPresentation(value).name

export const getEntityDescriptionField = (value: EntityInstanceRow): unknown =>
    value.description ?? getEntityPresentation(value).description

export const toIsoTimestamp = (value: unknown): string | null => {
    if (typeof value === 'string') {
        return value
    }
    if (value instanceof Date) {
        return value.toISOString()
    }
    return null
}

export const mapEntityInstanceResponse = (entity: EntityInstanceRow) => {
    const config = entity.config && typeof entity.config === 'object' ? (entity.config as Record<string, unknown>) : null
    const sortOrder =
        typeof entity.sortOrder === 'number' ? entity.sortOrder : typeof config?.sortOrder === 'number' ? config.sortOrder : undefined

    return {
        ...entity,
        name: getEntityNameField(entity) ?? null,
        description: getEntityDescriptionField(entity) ?? null,
        config,
        sortOrder,
        version: typeof entity._upl_version === 'number' ? entity._upl_version : undefined,
        createdAt: toIsoTimestamp(entity._upl_created_at),
        updatedAt: toIsoTimestamp(entity._upl_updated_at),
        _mhb_deleted: entity._mhb_deleted === true || entity._mhb_deleted_at != null
    }
}

export const normalizeEntityCodename = (
    codename: unknown,
    fallbackPrimaryLocale: string,
    settings: Awaited<ReturnType<typeof getCodenameSettings>>
) => {
    const requestedText = getCodenamePayloadText(codename as never)
    if (!requestedText.trim()) {
        throw new MetahubValidationError('Codename is required')
    }

    const normalizedCodename = normalizeCodenameForStyle(requestedText.trim(), settings.style, settings.alphabet)
    if (!isValidCodenameForStyle(normalizedCodename, settings.style, settings.alphabet, settings.allowMixed)) {
        throw new MetahubValidationError(codenameErrorMessage(settings.style, settings.alphabet, settings.allowMixed))
    }

    const payload = syncCodenamePayloadText(codename, fallbackPrimaryLocale, normalizedCodename, settings.style, settings.alphabet)
    if (!payload) {
        throw new MetahubValidationError('Codename is required')
    }

    return {
        normalizedCodename,
        payload: settings.localizedEnabled ? payload : enforceSingleLocaleCodename(payload, false)
    }
}

export const assertCodenameAvailable = async (
    objectsService: MetahubObjectsService,
    metahubId: string,
    kind: string,
    codename: string,
    userId?: string,
    excludeId?: string
) => {
    const existing = await objectsService.findByCodenameAndKind(metahubId, codename, kind, userId)
    if (existing && existing.id !== excludeId) {
        throw new MetahubConflictError('Entity codename already exists', { kind, codename, existingId: existing.id })
    }
}

export const buildCopyCodename = async (
    objectsService: MetahubObjectsService,
    metahubId: string,
    kind: string,
    sourceCodename: unknown,
    settings: Awaited<ReturnType<typeof getCodenameSettings>>,
    attempt: number,
    userId?: string
) => {
    const sourceText = getCodenamePayloadText(sourceCodename as never).trim()
    if (!sourceText) {
        throw new MetahubValidationError('Source entity codename is required for copy')
    }

    const baseCodename = normalizeCodenameForStyle(sourceText, settings.style, settings.alphabet)

    const candidate = buildCodenameAttempt(baseCodename, attempt, settings.style)
    const existing = await objectsService.findByCodenameAndKind(metahubId, candidate, kind, userId)
    if (existing) {
        return null
    }

    const payload = syncCodenamePayloadText(sourceCodename, 'en', candidate, settings.style, settings.alphabet)
    if (!payload) {
        throw new MetahubValidationError('Source entity codename is required for copy')
    }

    return {
        baseCodename,
        payload: settings.localizedEnabled ? payload : enforceSingleLocaleCodename(payload, false)
    }
}

export const createOptionListRouteServices = (exec: DbExecutor, schemaService: ConstructorParameters<typeof MetahubObjectsService>[1]) => ({
    objectsService: new MetahubObjectsService(exec, schemaService),
    treeEntitiesService: new MetahubTreeEntitiesService(exec, schemaService),
    componentsService: new MetahubComponentsService(exec, schemaService),
    valuesService: new MetahubOptionValuesService(exec, schemaService),
    settingsService: new MetahubSettingsService(exec, schemaService),
    entityTypeService: new EntityTypeService(exec, schemaService)
})

export const createValueGroupRouteServices = (exec: DbExecutor, schemaService: ConstructorParameters<typeof MetahubObjectsService>[1]) => ({
    objectsService: new MetahubObjectsService(exec, schemaService),
    treeEntitiesService: new MetahubTreeEntitiesService(exec, schemaService),
    fixedValuesService: new MetahubFixedValuesService(exec, schemaService),
    settingsService: new MetahubSettingsService(exec, schemaService),
    entityTypeService: new EntityTypeService(exec, schemaService)
})
