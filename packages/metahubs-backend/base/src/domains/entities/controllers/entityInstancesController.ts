import { randomUUID } from 'crypto'
import { z } from 'zod'
import type { Request } from 'express'
import { localizedContent, resolveLocalizedContent, normalizeCatalogCopyOptions } from '@universo/utils'
import { isValidCodenameForStyle, normalizeCodenameForStyle } from '@universo/utils/validation/codename'
import { isEnabledComponentConfig, type ResolvedEntityType } from '@universo/types'
import { getDbErrorConstraint, getRequestDbSession, isUniqueViolation } from '@universo/utils/database'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { ListQuerySchema, paginateItems } from '../../shared/queryParams'
import { MetahubConflictError, MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
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
import { MetahubConstantsService } from '../../metahubs/services/MetahubConstantsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubObjectsService, type MetahubObjectRow } from '../../metahubs/services/MetahubObjectsService'
import { MetahubSettingsService } from '../../settings/services/MetahubSettingsService'
import { ensureMetahubAccess, type RolePermission } from '../../shared/guards'
import { EntityTypeResolver } from '../../shared/entityTypeResolver'
import { EntityTypeService } from '../services/EntityTypeService'
import { ActionService } from '../services/ActionService'
import { EntityActionExecutionService } from '../services/EntityActionExecutionService'
import { EventBindingService } from '../services/EventBindingService'
import { EntityEventRouter } from '../services/EntityEventRouter'
import { EntityMutationService } from '../services/EntityMutationService'
import { copyDesignTimeObjectChildren } from '../services/designTimeObjectChildrenCopy'
import { executeBlockedDelete } from '../services/legacyBuiltinObjectCompatibility'
import { findBlockingCatalogReferences, isCatalogCompatibleResolvedType } from '../../catalogs/services/catalogCompatibility'
import { MetahubScriptsService } from '../../scripts/services/MetahubScriptsService'

const { buildLocalizedContent, sanitizeLocalizedInput } = localizedContent

const normalizeLocaleCode = (locale?: string): string => locale?.split('-')[0].split('_')[0].toLowerCase() || 'en'

const optionalBooleanFromQuery = z.preprocess((value) => {
    if (value === undefined) return undefined
    return value === 'true' || value === true
}, z.boolean().optional())

const localizedFieldSchema = z.record(z.string().max(5000))
const codenameInputSchema = z.union([z.string().trim().min(1), requiredCodenamePayloadSchema])
const optionalCodenameInputSchema = z.union([z.string().trim().min(1), optionalCodenamePayloadSchema]).optional()

const entityListQuerySchema = ListQuerySchema.extend({
    kind: z.string().trim().min(1).max(64),
    locale: z.string().trim().min(2).max(10).optional(),
    includeDeleted: optionalBooleanFromQuery.default(false),
    onlyDeleted: optionalBooleanFromQuery.default(false)
})

const entityGetQuerySchema = z.object({
    includeDeleted: optionalBooleanFromQuery.default(false)
})

const createEntitySchema = z
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

const updateEntitySchema = z
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

const copyEntitySchema = z
    .object({
        codename: optionalCodenameInputSchema,
        name: localizedFieldSchema.optional(),
        namePrimaryLocale: z.string().trim().min(2).max(10).optional(),
        description: localizedFieldSchema.optional(),
        descriptionPrimaryLocale: z.string().trim().min(2).max(10).optional(),
        config: z.record(z.unknown()).optional(),
        copyAttributes: z.boolean().optional(),
        copyElements: z.boolean().optional()
    })
    .strict()
    .superRefine((value, ctx) => {
        if (value.copyAttributes === false && value.copyElements === true) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['copyElements'],
                message: 'copyElements requires copyAttributes=true'
            })
        }
    })

const reorderEntitiesSchema = z
    .object({
        kind: z.string().trim().min(1).max(64),
        entityId: z.string().trim().uuid(),
        newSortOrder: z.number().int().min(1)
    })
    .strict()

const createEntityServices = (
    exec: ConstructorParameters<typeof MetahubObjectsService>[0],
    schemaService: ConstructorParameters<typeof MetahubObjectsService>[1]
) => {
    const objectsService = new MetahubObjectsService(exec, schemaService)
    const attributesService = new MetahubAttributesService(exec, schemaService)
    const settingsService = new MetahubSettingsService(exec, schemaService)
    const constantsService = new MetahubConstantsService(exec, schemaService)
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
        attributesService,
        settingsService,
        constantsService,
        entityTypeService,
        resolver,
        mutationService,
        actionExecutor: actionExecutionService.execute
    }
}

const assertCustomEntityKind = async (resolver: EntityTypeResolver, kind: string, metahubId: string, userId?: string) => {
    const resolved = await resolver.resolve(kind, { metahubId, userId })

    if (!resolved) {
        throw new MetahubValidationError('Unknown entity kind', { kind })
    }

    if (resolved.source !== 'custom') {
        throw new MetahubValidationError('Generic entity routes currently support custom entity kinds only', { kind })
    }

    return resolved
}

type MutationPermissionMode = 'edit' | 'delete'

type PolicyOutcome = {
    status: number
    body: Record<string, unknown>
}

const isCatalogCompatibleEntityType = (resolvedType: ResolvedEntityType | null | undefined) =>
    isCatalogCompatibleResolvedType((resolvedType ?? null) as (ResolvedEntityType & { config?: Record<string, unknown> | null }) | null)

const getEntityMutationPermission = (resolvedType: ResolvedEntityType, mode: MutationPermissionMode): RolePermission => {
    if (isCatalogCompatibleEntityType(resolvedType)) {
        return mode === 'delete' ? 'deleteContent' : 'editContent'
    }

    return 'manageMetahub'
}

const ensureEntityMutationPermission = async ({
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

const checkCatalogCompatibleCopyPolicy = async ({
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
    if (!isCatalogCompatibleEntityType(resolvedType)) {
        return null
    }

    const allowCopyRow = await settingsService.findByKey(metahubId, 'catalogs.allowCopy', userId)
    if (allowCopyRow && allowCopyRow.value?._value === false) {
        return {
            status: 403,
            body: { error: 'Copying catalogs is disabled in metahub settings' }
        }
    }

    return null
}

const checkCatalogCompatibleDeletePolicy = async ({
    resolvedType,
    settingsService,
    attributesService,
    metahubId,
    entityId,
    userId
}: {
    resolvedType: ResolvedEntityType
    settingsService: MetahubSettingsService
    attributesService: MetahubAttributesService
    metahubId: string
    entityId: string
    userId?: string
}): Promise<PolicyOutcome | null> => {
    if (!isCatalogCompatibleEntityType(resolvedType)) {
        return null
    }

    const allowDeleteRow = await settingsService.findByKey(metahubId, 'catalogs.allowDelete', userId)
    if (allowDeleteRow && allowDeleteRow.value?._value === false) {
        return {
            status: 403,
            body: { error: 'Deleting catalogs is disabled in metahub settings' }
        }
    }

    const blockingReferences = await findBlockingCatalogReferences(metahubId, entityId, attributesService, userId)
    if (blockingReferences.length > 0) {
        return {
            status: 409,
            body: {
                error: 'Cannot delete catalog: it is referenced by attributes in other catalogs',
                blockingReferences
            }
        }
    }

    return null
}

const buildDesignTimeCopyPlan = (resolvedType: ResolvedEntityType) => ({
    copyAttributes: isEnabledComponentConfig(resolvedType.components.dataSchema),
    copyElements: isEnabledComponentConfig(resolvedType.components.predefinedElements),
    copyConstants: isEnabledComponentConfig(resolvedType.components.constants),
    copyEnumerationValues: isEnabledComponentConfig(resolvedType.components.enumerationValues)
})

const applyDesignTimeCopyOverrides = (
    plan: ReturnType<typeof buildDesignTimeCopyPlan>,
    input: {
        copyAttributes?: boolean
        copyElements?: boolean
    }
) => {
    const copyOptions = normalizeCatalogCopyOptions({
        copyAttributes: input.copyAttributes,
        copyElements: input.copyElements
    })

    return {
        ...plan,
        copyAttributes: plan.copyAttributes && copyOptions.copyAttributes,
        copyElements: plan.copyElements && copyOptions.copyElements
    }
}

const hasDesignTimeChildrenToCopy = (plan: ReturnType<typeof buildDesignTimeCopyPlan>) =>
    plan.copyAttributes || plan.copyElements || plan.copyConstants || plan.copyEnumerationValues

const buildRequiredLocalizedField = (
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

const buildOptionalLocalizedField = (value: Record<string, string> | undefined, primaryLocale?: string) => {
    if (value === undefined) {
        return undefined
    }

    const sanitized = sanitizeLocalizedInput(value)
    if (Object.keys(sanitized).length === 0) {
        return null
    }

    return buildLocalizedContent(sanitized, normalizeLocaleCode(primaryLocale), 'en')
}

const buildNameSearchText = (value: unknown, locale?: string): string => {
    const localized = typeof locale === 'string' ? resolveLocalizedContent(value as never, locale) : undefined
    if (localized) {
        return localized.toLowerCase()
    }

    if (value && typeof value === 'object') {
        return JSON.stringify(value).toLowerCase()
    }

    return ''
}

type EntityInstanceRow = MetahubObjectRow & {
    name?: unknown
    description?: unknown
    _mhb_deleted?: unknown
}

const getEntityPresentation = (value: Pick<EntityInstanceRow, 'presentation'>): Record<string, unknown> =>
    value.presentation && typeof value.presentation === 'object' ? (value.presentation as Record<string, unknown>) : {}

const getEntityNameField = (value: EntityInstanceRow): unknown => value.name ?? getEntityPresentation(value).name

const getEntityDescriptionField = (value: EntityInstanceRow): unknown => value.description ?? getEntityPresentation(value).description

const toIsoTimestamp = (value: unknown): string | null => {
    if (typeof value === 'string') {
        return value
    }
    if (value instanceof Date) {
        return value.toISOString()
    }
    return null
}

const mapEntityInstanceResponse = (entity: EntityInstanceRow) => {
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

const normalizeEntityCodename = (
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

const assertCodenameAvailable = async (
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

const buildCopyCodename = async (
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

export function createEntityInstancesController(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    const list = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const parsed = entityListQuerySchema.safeParse(req.query)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
        }

        const { objectsService, resolver } = createEntityServices(exec, schemaService)
        await assertCustomEntityKind(resolver, parsed.data.kind, metahubId, userId)

        const items = (await objectsService.findAllByKind(metahubId, parsed.data.kind, userId, {
            includeDeleted: parsed.data.includeDeleted || parsed.data.onlyDeleted,
            onlyDeleted: parsed.data.onlyDeleted
        })) as EntityInstanceRow[]

        const search = parsed.data.search?.toLowerCase()
        const filtered =
            search && search.length > 0
                ? items.filter((item) => {
                      const codename = getCodenamePayloadText(item.codename as never).toLowerCase()
                      const name = buildNameSearchText(getEntityNameField(item), parsed.data.locale)
                      const description = buildNameSearchText(getEntityDescriptionField(item), parsed.data.locale)
                      return codename.includes(search) || name.includes(search) || description.includes(search)
                  })
                : items

        return res.json(paginateItems(filtered.map(mapEntityInstanceResponse), parsed.data))
    })

    const getById = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const parsed = entityGetQuerySchema.safeParse(req.query)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
        }

        const { objectsService, resolver } = createEntityServices(exec, schemaService)
        const entity = (
            parsed.data.includeDeleted
                ? await objectsService.findById(metahubId, req.params.entityId, userId, { includeDeleted: true })
                : await objectsService.findById(metahubId, req.params.entityId, userId)
        ) as EntityInstanceRow | null
        if (!entity) {
            throw new MetahubNotFoundError('Entity', req.params.entityId)
        }

        await assertCustomEntityKind(resolver, entity.kind, metahubId, userId)
        return res.json(mapEntityInstanceResponse(entity))
    })

    const create = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const parsed = createEntitySchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
        }

        const { objectsService, settingsService, resolver, mutationService, actionExecutor } = createEntityServices(exec, schemaService)
        const resolvedType = await assertCustomEntityKind(resolver, parsed.data.kind, metahubId, userId)
        await ensureEntityMutationPermission({ req, exec, userId, metahubId, resolvedType, mode: 'edit' })

        const codenameSettings = await getCodenameSettings(settingsService, metahubId, userId)
        const codenamePrimaryLocale = normalizeLocaleCode(parsed.data.namePrimaryLocale)
        const { normalizedCodename, payload } = normalizeEntityCodename(parsed.data.codename, codenamePrimaryLocale, codenameSettings)
        await assertCodenameAvailable(objectsService, metahubId, parsed.data.kind, normalizedCodename, userId)

        const name = buildRequiredLocalizedField(parsed.data.name, parsed.data.namePrimaryLocale, 'Name', normalizedCodename)
        const description = buildOptionalLocalizedField(parsed.data.description, parsed.data.descriptionPrimaryLocale)

        const pendingObjectId = randomUUID()

        const created = (await mutationService.run({
            metahubId,
            objectId: pendingObjectId,
            userId,
            beforeEvent: 'beforeCreate',
            afterEvent: 'afterCreate',
            afterEventObjectId: (createdEntity) => createdEntity.id,
            actionExecutor,
            mutation: async (tx) =>
                objectsService.createObject(
                    metahubId,
                    parsed.data.kind,
                    {
                        id: pendingObjectId,
                        codename: payload,
                        name,
                        description,
                        config: parsed.data.config
                    },
                    userId,
                    tx
                )
        })) as EntityInstanceRow

        return res.status(201).json(mapEntityInstanceResponse(created))
    })

    const update = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const parsed = updateEntitySchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
        }

        const { objectsService, settingsService, resolver, mutationService, actionExecutor } = createEntityServices(exec, schemaService)
        const existing = (await objectsService.findById(metahubId, req.params.entityId, userId)) as EntityInstanceRow | null
        if (!existing) {
            throw new MetahubNotFoundError('Entity', req.params.entityId)
        }

        const resolvedType = await assertCustomEntityKind(resolver, existing.kind, metahubId, userId)
        await ensureEntityMutationPermission({ req, exec, userId, metahubId, resolvedType, mode: 'edit' })

        const codenameSettings = await getCodenameSettings(settingsService, metahubId, userId)
        const nextCodename =
            parsed.data.codename !== undefined
                ? normalizeEntityCodename(parsed.data.codename, normalizeLocaleCode(parsed.data.namePrimaryLocale), codenameSettings)
                : null

        if (nextCodename) {
            await assertCodenameAvailable(objectsService, metahubId, existing.kind, nextCodename.normalizedCodename, userId, existing.id)
        }

        const updated = (await mutationService.run({
            metahubId,
            objectId: existing.id,
            userId,
            beforeEvent: 'beforeUpdate',
            afterEvent: 'afterUpdate',
            actionExecutor,
            mutation: async (tx) =>
                objectsService.updateObject(
                    metahubId,
                    existing.id,
                    existing.kind,
                    {
                        codename: nextCodename?.payload,
                        name: buildOptionalLocalizedField(parsed.data.name, parsed.data.namePrimaryLocale),
                        description: buildOptionalLocalizedField(parsed.data.description, parsed.data.descriptionPrimaryLocale),
                        config: parsed.data.config,
                        updatedBy: userId,
                        expectedVersion: parsed.data.expectedVersion
                    },
                    userId,
                    tx
                )
        })) as EntityInstanceRow

        return res.json(mapEntityInstanceResponse(updated))
    })

    const remove = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { objectsService, attributesService, settingsService, resolver, mutationService, actionExecutor } = createEntityServices(
            exec,
            schemaService
        )
        const existing = await objectsService.findById(metahubId, req.params.entityId, userId)
        if (!existing) {
            throw new MetahubNotFoundError('Entity', req.params.entityId)
        }

        const resolvedType = await assertCustomEntityKind(resolver, existing.kind, metahubId, userId)
        await ensureEntityMutationPermission({ req, exec, userId, metahubId, resolvedType, mode: 'delete' })

        if (isCatalogCompatibleEntityType(resolvedType)) {
            const result = await executeBlockedDelete({
                entity: existing,
                entityLabel: 'Catalog',
                beforeDelete: () =>
                    checkCatalogCompatibleDeletePolicy({
                        resolvedType,
                        settingsService,
                        attributesService,
                        metahubId,
                        entityId: existing.id,
                        userId
                    }),
                deleteEntity: async () => {
                    await mutationService.run({
                        metahubId,
                        objectId: existing.id,
                        userId,
                        beforeEvent: 'beforeDelete',
                        afterEvent: 'afterDelete',
                        actionExecutor,
                        mutation: async (tx) => {
                            await objectsService.delete(metahubId, existing.id, userId, tx)
                        }
                    })
                }
            })

            if (result.status === 204) {
                return res.status(204).send()
            }

            return res.status(result.status).json(result.body)
        }

        await mutationService.run({
            metahubId,
            objectId: existing.id,
            userId,
            beforeEvent: 'beforeDelete',
            afterEvent: 'afterDelete',
            actionExecutor,
            mutation: async (tx) => {
                await objectsService.delete(metahubId, existing.id, userId, tx)
            }
        })

        return res.status(204).send()
    })

    const restore = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { objectsService, resolver, mutationService } = createEntityServices(exec, schemaService)
        const entity = await objectsService.findById(metahubId, req.params.entityId, userId, { includeDeleted: true })
        if (!entity) {
            throw new MetahubNotFoundError('Entity', req.params.entityId)
        }

        const resolvedType = await assertCustomEntityKind(resolver, entity.kind, metahubId, userId)
        await ensureEntityMutationPermission({ req, exec, userId, metahubId, resolvedType, mode: 'edit' })

        if (entity._mhb_deleted !== true) {
            throw new MetahubValidationError('Entity is not deleted', { entityId: entity.id })
        }

        await mutationService.run({
            metahubId,
            objectId: entity.id,
            userId,
            mode: 'restore',
            mutation: async (tx) => {
                await objectsService.restore(metahubId, entity.id, userId, tx)
            }
        })

        return res.status(204).send()
    })

    const permanentRemove = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { objectsService, attributesService, settingsService, resolver } = createEntityServices(exec, schemaService)
        const entity = await objectsService.findById(metahubId, req.params.entityId, userId, { includeDeleted: true })
        if (!entity) {
            throw new MetahubNotFoundError('Entity', req.params.entityId)
        }

        const resolvedType = await assertCustomEntityKind(resolver, entity.kind, metahubId, userId)
        await ensureEntityMutationPermission({ req, exec, userId, metahubId, resolvedType, mode: 'delete' })

        if (entity._mhb_deleted !== true) {
            throw new MetahubValidationError('Entity is not deleted', { entityId: entity.id })
        }

        if (isCatalogCompatibleEntityType(resolvedType)) {
            const result = await executeBlockedDelete({
                entity,
                entityLabel: 'Catalog',
                beforeDelete: () =>
                    checkCatalogCompatibleDeletePolicy({
                        resolvedType,
                        settingsService,
                        attributesService,
                        metahubId,
                        entityId: entity.id,
                        userId
                    }),
                deleteEntity: async () => {
                    await objectsService.permanentDelete(metahubId, entity.id, userId)
                }
            })

            if (result.status === 204) {
                return res.status(204).send()
            }

            return res.status(result.status).json(result.body)
        }

        await objectsService.permanentDelete(metahubId, entity.id, userId)
        return res.status(204).send()
    })

    const copy = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const parsed = copyEntitySchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
        }

        const { objectsService, settingsService, constantsService, resolver, mutationService, actionExecutor } = createEntityServices(
            exec,
            schemaService
        )
        const source = (await objectsService.findById(metahubId, req.params.entityId, userId)) as EntityInstanceRow | null
        if (!source) {
            throw new MetahubNotFoundError('Entity', req.params.entityId)
        }

        const resolvedType = await assertCustomEntityKind(resolver, source.kind, metahubId, userId)
        await ensureEntityMutationPermission({ req, exec, userId, metahubId, resolvedType, mode: 'edit' })
        const copyPolicyOutcome = await checkCatalogCompatibleCopyPolicy({
            resolvedType,
            settingsService,
            metahubId,
            userId
        })
        if (copyPolicyOutcome) {
            return res.status(copyPolicyOutcome.status).json(copyPolicyOutcome.body)
        }
        const designTimeCopyPlan = applyDesignTimeCopyOverrides(buildDesignTimeCopyPlan(resolvedType), parsed.data)

        const codenameSettings = await getCodenameSettings(settingsService, metahubId, userId)
        const copyCodename =
            parsed.data.codename !== undefined
                ? normalizeEntityCodename(parsed.data.codename, normalizeLocaleCode(parsed.data.namePrimaryLocale), codenameSettings)
                : null

        if (copyCodename) {
            await assertCodenameAvailable(objectsService, metahubId, source.kind, copyCodename.normalizedCodename, userId)
        }

        const schemaName =
            designTimeCopyPlan.copyAttributes || designTimeCopyPlan.copyElements || designTimeCopyPlan.copyEnumerationValues
                ? await schemaService.ensureSchema(metahubId, userId)
                : undefined

        const maxCopyAttempts = copyCodename ? 1 : CODENAME_RETRY_MAX_ATTEMPTS
        let created: EntityInstanceRow | null = null
        let generatedBaseCodename: string | null = null

        for (let attempt = 1; attempt <= maxCopyAttempts; attempt += 1) {
            const generatedCodename = copyCodename
                ? null
                : await buildCopyCodename(objectsService, metahubId, source.kind, source.codename, codenameSettings, attempt, userId)

            if (!copyCodename && !generatedCodename) {
                continue
            }

            if (generatedCodename?.baseCodename) {
                generatedBaseCodename = generatedCodename.baseCodename
            }

            try {
                created = (await mutationService.run({
                    metahubId,
                    objectId: source.id,
                    userId,
                    mode: 'copy',
                    actionExecutor,
                    mutation: async (tx) => {
                        const nextEntity = await objectsService.createObject(
                            metahubId,
                            source.kind,
                            {
                                codename: copyCodename?.payload ?? generatedCodename?.payload,
                                name: parsed.data.name
                                    ? buildRequiredLocalizedField(parsed.data.name, parsed.data.namePrimaryLocale, 'Name')
                                    : getEntityNameField(source),
                                description:
                                    parsed.data.description !== undefined
                                        ? buildOptionalLocalizedField(parsed.data.description, parsed.data.descriptionPrimaryLocale)
                                        : getEntityDescriptionField(source),
                                config: parsed.data.config ?? source.config
                            },
                            userId,
                            tx
                        )

                        if (hasDesignTimeChildrenToCopy(designTimeCopyPlan)) {
                            await copyDesignTimeObjectChildren({
                                metahubId,
                                sourceObjectId: source.id,
                                targetObjectId: nextEntity.id,
                                tx,
                                userId,
                                schemaName,
                                copyAttributes: designTimeCopyPlan.copyAttributes,
                                copyElements: designTimeCopyPlan.copyElements,
                                copyConstants: designTimeCopyPlan.copyConstants,
                                copyEnumerationValues: designTimeCopyPlan.copyEnumerationValues,
                                codenameStyle: codenameSettings.style,
                                codenameAlphabet: codenameSettings.alphabet,
                                constantsService
                            })
                        }

                        return nextEntity
                    }
                })) as EntityInstanceRow

                break
            } catch (error) {
                if (isUniqueViolation(error)) {
                    const constraint = getDbErrorConstraint(error) ?? ''
                    if (constraint === 'idx_mhb_objects_kind_codename_active') {
                        continue
                    }
                }

                throw error
            }
        }

        if (!created) {
            if (copyCodename) {
                return res.status(409).json({ error: 'Entity codename already exists' })
            }

            throw new MetahubConflictError('Unable to generate a unique codename for the copied entity', {
                kind: source.kind,
                baseCodename: generatedBaseCodename ?? getCodenamePayloadText(source.codename as never).trim()
            })
        }

        return res.status(201).json(mapEntityInstanceResponse(created))
    })

    const reorder = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const parsed = reorderEntitiesSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
        }

        const { objectsService, resolver } = createEntityServices(exec, schemaService)
        const resolvedType = await assertCustomEntityKind(resolver, parsed.data.kind, metahubId, userId)
        await ensureEntityMutationPermission({ req, exec, userId, metahubId, resolvedType, mode: 'edit' })
        const updated = (await objectsService.reorderByKind(
            metahubId,
            parsed.data.kind,
            parsed.data.entityId,
            parsed.data.newSortOrder,
            userId
        )) as EntityInstanceRow
        return res.json(mapEntityInstanceResponse(updated))
    })

    return {
        list,
        getById,
        create,
        update,
        remove,
        restore,
        permanentRemove,
        copy,
        reorder
    }
}
