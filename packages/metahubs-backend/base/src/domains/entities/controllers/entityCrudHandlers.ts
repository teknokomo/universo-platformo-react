import { generateUuidV7 } from '@universo/utils'
import { isUniqueViolation, getDbErrorConstraint } from '@universo/utils/database'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { paginateItems } from '../../shared/queryParams'
import { MetahubConflictError, MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
import { getCodenameSettings, CODENAME_RETRY_MAX_ATTEMPTS } from '../../shared/codenameStyleHelper'
import { getCodenamePayloadText } from '../../shared/codenamePayload'
import { copyDesignTimeObjectChildren } from '../services/designTimeObjectChildrenCopy'
import { getEntityBehaviorService } from '../services/builtinKindBehaviorRegistry'
import {
    createEntityServices,
    assertSupportedEntityKind,
    entityListQuerySchema,
    entityGetQuerySchema,
    createEntitySchema,
    updateEntitySchema,
    copyEntitySchema,
    reorderEntitiesSchema,
    normalizeLocaleCode,
    normalizeEntityCodename,
    assertCodenameAvailable,
    buildCopyCodename,
    mapEntityInstanceResponse,
    buildRequiredLocalizedField,
    buildOptionalLocalizedField,
    buildNameSearchText,
    getEntityNameField,
    getEntityDescriptionField,
    getEntityMetadataKind,
    ensureEntityMutationPermission,
    checkEntityMetadataCopyPolicy,
    buildDesignTimeCopyPlan,
    applyDesignTimeCopyOverrides,
    hasDesignTimeChildrenToCopy,
    validateEntityConfigForComponents,
    validateLedgerConfigReferencesForEntity,
    executeBehaviorDelete,
    executeBehaviorBlockingState,
    type EntityInstanceRow
} from './entityControllerShared'

export function createEntityCrudHandlers(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    const list = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const parsed = entityListQuerySchema.safeParse(req.query)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
        }

        const { objectsService, resolver } = createEntityServices(exec, schemaService)
        await assertSupportedEntityKind(resolver, parsed.data.kind, metahubId, userId)

        const items = (await objectsService.findAllByKind(metahubId, parsed.data.kind, userId, {
            includeDeleted: parsed.data.includeDeleted || parsed.data.onlyDeleted,
            onlyDeleted: parsed.data.onlyDeleted
        })) as EntityInstanceRow[]

        const hubScopedItems = parsed.data.treeEntityId
            ? items.filter((item) => {
                  const config = item.config && typeof item.config === 'object' ? (item.config as Record<string, unknown>) : {}
                  const hubs = Array.isArray(config.hubs) ? config.hubs : []
                  return hubs.some((hubId) => hubId === parsed.data.treeEntityId)
              })
            : items

        const search = parsed.data.search?.toLowerCase()
        const filtered =
            search && search.length > 0
                ? hubScopedItems.filter((item) => {
                      const codename = getCodenamePayloadText(item.codename as never).toLowerCase()
                      const name = buildNameSearchText(getEntityNameField(item), parsed.data.locale)
                      const description = buildNameSearchText(getEntityDescriptionField(item), parsed.data.locale)
                      return codename.includes(search) || name.includes(search) || description.includes(search)
                  })
                : hubScopedItems

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

        await assertSupportedEntityKind(resolver, entity.kind, metahubId, userId)
        return res.json(mapEntityInstanceResponse(entity))
    })

    const create = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const parsed = createEntitySchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
        }

        const { objectsService, fieldDefinitionsService, settingsService, resolver, mutationService, actionExecutor } =
            createEntityServices(exec, schemaService)
        const resolvedType = await assertSupportedEntityKind(resolver, parsed.data.kind, metahubId, userId)
        await ensureEntityMutationPermission({ req, exec, userId, metahubId, resolvedType, mode: 'create' })

        const codenameSettings = await getCodenameSettings(settingsService, metahubId, userId)
        const codenamePrimaryLocale = normalizeLocaleCode(parsed.data.namePrimaryLocale)
        const { normalizedCodename, payload } = normalizeEntityCodename(parsed.data.codename, codenamePrimaryLocale, codenameSettings)
        await assertCodenameAvailable(objectsService, metahubId, parsed.data.kind, normalizedCodename, userId)

        const name = buildRequiredLocalizedField(parsed.data.name, parsed.data.namePrimaryLocale, 'Name', normalizedCodename)
        const description = buildOptionalLocalizedField(parsed.data.description, parsed.data.descriptionPrimaryLocale)
        const config = validateEntityConfigForComponents(resolvedType, parsed.data.config)
        await validateLedgerConfigReferencesForEntity({
            resolvedType,
            config,
            metahubId,
            objectId: null,
            userId,
            fieldDefinitionsService
        })

        const pendingObjectId = generateUuidV7()

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
                        config
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

        const { objectsService, fieldDefinitionsService, settingsService, resolver, mutationService, actionExecutor } =
            createEntityServices(exec, schemaService)
        const existing = (await objectsService.findById(metahubId, req.params.entityId, userId)) as EntityInstanceRow | null
        if (!existing) {
            throw new MetahubNotFoundError('Entity', req.params.entityId)
        }

        const resolvedType = await assertSupportedEntityKind(resolver, existing.kind, metahubId, userId)
        await ensureEntityMutationPermission({ req, exec, userId, metahubId, resolvedType, mode: 'edit' })

        const codenameSettings = await getCodenameSettings(settingsService, metahubId, userId)
        const nextCodename =
            parsed.data.codename !== undefined
                ? normalizeEntityCodename(parsed.data.codename, normalizeLocaleCode(parsed.data.namePrimaryLocale), codenameSettings)
                : null

        if (nextCodename) {
            await assertCodenameAvailable(objectsService, metahubId, existing.kind, nextCodename.normalizedCodename, userId, existing.id)
        }
        const config = validateEntityConfigForComponents(resolvedType, parsed.data.config)
        await validateLedgerConfigReferencesForEntity({
            resolvedType,
            config,
            metahubId,
            objectId: existing.id,
            userId,
            fieldDefinitionsService
        })

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
                        config,
                        updatedBy: userId,
                        expectedVersion: parsed.data.expectedVersion
                    },
                    userId,
                    tx
                )
        })) as EntityInstanceRow

        return res.json(mapEntityInstanceResponse(updated))
    })

    const getBlockingDependencies = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const routeKind = req.params.kindKey?.trim()
        if (routeKind !== 'hub') {
            throw new MetahubNotFoundError('hub', req.params.entityId)
        }

        const { objectsService, fieldDefinitionsService, fixedValuesService, settingsService, entityTypeService, resolver } =
            createEntityServices(exec, schemaService)
        const resolvedType = await assertSupportedEntityKind(resolver, routeKind, metahubId, userId)
        const behavior = getEntityBehaviorService(routeKind)
        if (!behavior) {
            throw new MetahubValidationError('No behavior service registered for entity kind', { kind: routeKind })
        }

        const existing = await objectsService.findById(metahubId, req.params.entityId, userId)
        if (!existing) {
            throw new MetahubNotFoundError('hub', req.params.entityId)
        }

        const result = await executeBehaviorBlockingState({
            behavior,
            context: {
                resolvedType,
                settingsService,
                fieldDefinitionsService,
                fixedValuesService,
                entityTypeService,
                metahubId,
                entityId: req.params.entityId,
                userId,
                exec,
                schemaService
            }
        })

        return res.status(result.status).json(result.body)
    })

    const getBlockingReferences = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const routeKind = req.params.kindKey?.trim()
        if (routeKind !== 'catalog' && routeKind !== 'set' && routeKind !== 'enumeration') {
            throw new MetahubNotFoundError('Entity', req.params.entityId)
        }

        const { objectsService, fieldDefinitionsService, fixedValuesService, settingsService, entityTypeService, resolver } =
            createEntityServices(exec, schemaService)
        const resolvedType = await assertSupportedEntityKind(resolver, routeKind, metahubId, userId)
        const behavior = getEntityBehaviorService(routeKind)
        if (!behavior) {
            throw new MetahubValidationError('No behavior service registered for entity kind', { kind: routeKind })
        }

        const existing = await objectsService.findById(metahubId, req.params.entityId, userId)
        if (!existing) {
            throw new MetahubNotFoundError('Entity', req.params.entityId)
        }

        const result = await executeBehaviorBlockingState({
            behavior,
            context: {
                resolvedType,
                settingsService,
                fieldDefinitionsService,
                fixedValuesService,
                entityTypeService,
                metahubId,
                entityId: req.params.entityId,
                userId,
                exec,
                schemaService
            }
        })

        return res.status(result.status).json(result.body)
    })

    const remove = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const {
            objectsService,
            fieldDefinitionsService,
            fixedValuesService,
            settingsService,
            entityTypeService,
            resolver,
            mutationService,
            actionExecutor
        } = createEntityServices(exec, schemaService)
        const existing = await objectsService.findById(metahubId, req.params.entityId, userId)
        if (!existing) {
            throw new MetahubNotFoundError('Entity', req.params.entityId)
        }

        const resolvedType = await assertSupportedEntityKind(resolver, existing.kind, metahubId, userId)
        await ensureEntityMutationPermission({ req, exec, userId, metahubId, resolvedType, mode: 'delete' })

        const metadataKind = getEntityMetadataKind(resolvedType)
        const behavior = metadataKind ? getEntityBehaviorService(metadataKind) : null
        if (behavior) {
            const result = await executeBehaviorDelete({
                behavior,
                entity: existing,
                context: {
                    resolvedType,
                    settingsService,
                    fieldDefinitionsService,
                    fixedValuesService,
                    entityTypeService,
                    metahubId,
                    entityId: existing.id,
                    userId,
                    exec,
                    schemaService
                },
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

        const resolvedType = await assertSupportedEntityKind(resolver, entity.kind, metahubId, userId)
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
        const { objectsService, fieldDefinitionsService, fixedValuesService, settingsService, entityTypeService, resolver } =
            createEntityServices(exec, schemaService)
        const entity = await objectsService.findById(metahubId, req.params.entityId, userId, { includeDeleted: true })
        if (!entity) {
            throw new MetahubNotFoundError('Entity', req.params.entityId)
        }

        const resolvedType = await assertSupportedEntityKind(resolver, entity.kind, metahubId, userId)
        await ensureEntityMutationPermission({ req, exec, userId, metahubId, resolvedType, mode: 'delete' })

        if (entity._mhb_deleted !== true) {
            throw new MetahubValidationError('Entity is not deleted', { entityId: entity.id })
        }

        const metadataKind = getEntityMetadataKind(resolvedType)
        const behavior = metadataKind ? getEntityBehaviorService(metadataKind) : null
        if (behavior) {
            const result = await executeBehaviorDelete({
                behavior,
                entity,
                context: {
                    resolvedType,
                    settingsService,
                    fieldDefinitionsService,
                    fixedValuesService,
                    entityTypeService,
                    metahubId,
                    entityId: entity.id,
                    userId,
                    exec,
                    schemaService
                },
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

        const { objectsService, fieldDefinitionsService, settingsService, fixedValuesService, resolver, mutationService, actionExecutor } =
            createEntityServices(exec, schemaService)
        const source = (await objectsService.findById(metahubId, req.params.entityId, userId)) as EntityInstanceRow | null
        if (!source) {
            throw new MetahubNotFoundError('Entity', req.params.entityId)
        }

        const resolvedType = await assertSupportedEntityKind(resolver, source.kind, metahubId, userId)
        await ensureEntityMutationPermission({ req, exec, userId, metahubId, resolvedType, mode: 'edit' })
        const copyPolicyOutcome = await checkEntityMetadataCopyPolicy({
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
            designTimeCopyPlan.copyFieldDefinitions || designTimeCopyPlan.copyRecords || designTimeCopyPlan.copyOptionValues
                ? await schemaService.ensureSchema(metahubId, userId)
                : undefined
        const nextCopyConfig = {
            ...((source.config && typeof source.config === 'object' && !Array.isArray(source.config)
                ? (source.config as Record<string, unknown>)
                : {}) as Record<string, unknown>),
            ...((parsed.data.config && typeof parsed.data.config === 'object' && !Array.isArray(parsed.data.config)
                ? parsed.data.config
                : {}) as Record<string, unknown>)
        }
        if (parsed.data.parentTreeEntityId !== undefined) {
            nextCopyConfig.parentTreeEntityId = parsed.data.parentTreeEntityId
        }
        const validatedCopyConfig = validateEntityConfigForComponents(resolvedType, nextCopyConfig)
        await validateLedgerConfigReferencesForEntity({
            resolvedType,
            config: validatedCopyConfig,
            metahubId,
            objectId: designTimeCopyPlan.copyFieldDefinitions ? source.id : null,
            userId,
            fieldDefinitionsService
        })

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
                                config: validatedCopyConfig
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
                                copyFieldDefinitions: designTimeCopyPlan.copyFieldDefinitions,
                                copyRecords: designTimeCopyPlan.copyRecords,
                                copyFixedValues: designTimeCopyPlan.copyFixedValues,
                                copyOptionValues: designTimeCopyPlan.copyOptionValues,
                                codenameStyle: codenameSettings.style,
                                codenameAlphabet: codenameSettings.alphabet,
                                fixedValuesService
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
        const resolvedType = await assertSupportedEntityKind(resolver, parsed.data.kind, metahubId, userId)
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
        getBlockingDependencies,
        getBlockingReferences,
        remove,
        restore,
        permanentRemove,
        copy,
        reorder
    }
}
