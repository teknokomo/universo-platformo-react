import { z } from 'zod'
import type { RequestHandler } from 'express'
import { OptimisticLockError } from '@universo/utils'
import { queryMany, queryOne } from '@universo/utils/database'
import { qSchemaTable } from '@universo/database'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { MetahubConflictError, MetahubNotFoundError } from '../../shared/domainErrors'
import { isUniqueViolation } from '@universo/utils/database'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubFixedValuesService } from '../../metahubs/services/MetahubFixedValuesService'
import { codenameErrorMessage, getCodenameSettings } from '../../shared/codenameStyleHelper'
import { getCodenamePayloadText, syncCodenamePayloadText, syncOptionalCodenamePayloadText } from '../../shared/codenamePayload'
import { isValidCodenameForStyle, normalizeCodenameForStyle } from '@universo/utils/validation/codename'
import { MetahubTreeEntitiesService } from '../../metahubs/services/MetahubTreeEntitiesService'
import { EntityTypeService } from '../services/EntityTypeService'
import {
    createLinkedCollectionByHub,
    deleteLinkedCollectionByHub,
    getLinkedCollectionByHub,
    listLinkedCollectionsByHub,
    reorderLinkedCollections,
    updateLinkedCollectionByHub
} from '../children/linkedCollectionHelpers'
import {
    compareOptionListItems,
    createOptionListSchema,
    enrichWithContainers,
    getOptionListCodenameText,
    getOptionListContainerIds,
    isOptionListContextKind,
    findBlockingOptionListReferences,
    loadCompatibleOptionListKinds,
    mapOptionListSummary,
    matchesOptionListSearch,
    reorderOptionListsSchema,
    resolveCreatedAt,
    resolvePrimaryLocale,
    resolveUpdatedAt,
    respondUniqueViolation,
    updateOptionListSchema,
    mapContainerSummary
} from '../children/optionListHelpers'
import { executeBlockedDelete, executeEntityReorder, executeHubScopedDelete } from '../services/entityDeletePatterns'
import {
    createEntityMetadataKindSet,
    resolveEntityMetadataKinds,
    resolveRequestedEntityMetadataKind,
    resolveRequestedEntityMetadataKinds
} from '../../shared/entityMetadataKinds'
import { validateListQuery } from '../../shared/queryParams'
import { codenamePrimaryTextSql } from '../../shared/codename'
import { loadTreeEntityContext } from '../children/treeEntityContext'
import {
    createOptionListRouteServices,
    createValueGroupRouteServices,
    isValueGroupObject,
    getValueGroupTreeEntityIds,
    mapValueGroupListItem,
    compareValueGroupItems,
    matchesValueGroupSearch,
    validateValueGroupHubConstraints,
    resolveUniqueValueGroupCodename,
    VALUE_GROUP_DEFAULT_PRIMARY_LOCALE,
    valueGroupListQuerySchema,
    createValueGroupSchema,
    updateValueGroupSchema,
    reorderValueGroupsSchema,
    type ValueGroupRouteRow,
    type ValueGroupListItemRow,
    type OptionListRouteRow,
    buildLocalizedContent,
    sanitizeLocalizedInput
} from './entityControllerShared'

export function createNestedChildHandlers(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    const enrichValueGroupItemsWithHubs = async (
        metahubId: string,
        items: ValueGroupListItemRow[],
        treeEntitiesService: MetahubTreeEntitiesService,
        userId?: string
    ): Promise<ValueGroupListItemRow[]> => {
        const uniqueTreeEntityIds = Array.from(new Set(items.flatMap((item) => item.hubs.map((hub) => hub.id))))
        if (uniqueTreeEntityIds.length === 0) return items

        const hubs = (await treeEntitiesService.findByIds(metahubId, uniqueTreeEntityIds, userId)) as Record<string, unknown>[]
        const hubById = new Map<string, { id: string; name: unknown; codename: string }>()
        for (const hub of hubs) {
            hubById.set(String(hub.id), mapContainerSummary(hub))
        }

        return items.map((item) => {
            const treeEntityIds = item.hubs.map((hub) => hub.id)
            return {
                ...item,
                hubs: treeEntityIds
                    .map((treeEntityId) => hubById.get(treeEntityId))
                    .filter((hub): hub is { id: string; name: unknown; codename: string } => Boolean(hub))
            }
        })
    }

    const getValueGroupByIdInternal = async (
        metahubId: string,
        valueGroupId: string,
        options: {
            treeEntityId?: string
            userId?: string
            allowedKinds?: Set<string>
            objectsService: MetahubObjectsService
            treeEntitiesService: MetahubTreeEntitiesService
            fixedValuesService: MetahubFixedValuesService
        }
    ): Promise<ValueGroupListItemRow | null> => {
        const { treeEntityId, userId, allowedKinds, objectsService, treeEntitiesService, fixedValuesService } = options
        const row = (await objectsService.findById(metahubId, valueGroupId, userId)) as ValueGroupRouteRow | null
        if (!isValueGroupObject(row, allowedKinds)) return null

        const treeEntityIds = getValueGroupTreeEntityIds(row)
        if (treeEntityId && !treeEntityIds.includes(treeEntityId)) return null

        const fixedValuesCount = await fixedValuesService.countByObjectId(metahubId, valueGroupId, userId)
        const item = mapValueGroupListItem(row, metahubId, fixedValuesCount)
        item.hubs = treeEntityIds.map((id) => ({ id, name: null, codename: id }))
        const [enriched] = await enrichValueGroupItemsWithHubs(metahubId, [item], treeEntitiesService, userId)
        return enriched ?? null
    }

    const getValueGroupBlockingReferences = async (
        metahubId: string,
        valueGroupId: string,
        compatibleSetKinds: readonly string[],
        fixedValuesService: MetahubFixedValuesService,
        userId?: string
    ) => fixedValuesService.findSetReferenceBlockers(metahubId, valueGroupId, userId, compatibleSetKinds)

    const upsertNestedValueGroup = async (
        { req, res, metahubId, userId, exec, schemaService }: Parameters<RequestHandler>[0] extends never ? never : any,
        mode: 'create' | 'update'
    ) => {
        const { treeEntityId, valueGroupId } = req.params
        const hubScoped = Boolean(treeEntityId)
        const { objectsService, treeEntitiesService, settingsService, fixedValuesService, entityTypeService } =
            createValueGroupRouteServices(exec, schemaService)

        if (hubScoped && treeEntityId) {
            const hub = await treeEntitiesService.findById(metahubId, treeEntityId, userId)
            if (!hub) throw new MetahubNotFoundError('hub', treeEntityId)
        }

        const parsed = (mode === 'create' ? createValueGroupSchema : updateValueGroupSchema).safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
        }

        const {
            style: codenameStyle,
            alphabet: codenameAlphabet,
            allowMixed
        } = await getCodenameSettings(settingsService, metahubId, userId)

        const compatibleSetKinds = await resolveEntityMetadataKinds(entityTypeService, metahubId, 'set', userId)
        const compatibleSetKindSet = createEntityMetadataKindSet(compatibleSetKinds)
        const requestedKindKey = 'kindKey' in parsed.data ? parsed.data.kindKey : undefined
        const requestedCreateKind =
            mode === 'create'
                ? await resolveRequestedEntityMetadataKind(entityTypeService, metahubId, 'set', requestedKindKey, userId)
                : null

        const currentSet =
            mode === 'update' && valueGroupId
                ? ((await objectsService.findById(metahubId, valueGroupId, userId)) as ValueGroupRouteRow | null)
                : null

        if (mode === 'update') {
            if (!currentSet || !isValueGroupObject(currentSet, compatibleSetKindSet)) {
                throw new MetahubNotFoundError('set', valueGroupId)
            }

            if (hubScoped && treeEntityId && !getValueGroupTreeEntityIds(currentSet).includes(treeEntityId)) {
                return res.status(404).json({ error: 'Set not found in this hub' })
            }
        }

        const baseCodename =
            parsed.data.codename !== undefined
                ? getCodenamePayloadText(parsed.data.codename)
                : getCodenamePayloadText(currentSet?.codename as never)
        if (!baseCodename) {
            return res.status(400).json({ error: 'Validation failed', details: { codename: ['Codename is required'] } })
        }

        const normalizedCodename = normalizeCodenameForStyle(baseCodename, codenameStyle, codenameAlphabet)
        if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
            return res.status(400).json({
                error: 'Validation failed',
                details: {
                    codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)]
                }
            })
        }

        let finalCodename = normalizedCodename
        if (mode === 'create' || finalCodename !== getCodenamePayloadText(currentSet?.codename as never)) {
            const resolvedCodename = await resolveUniqueValueGroupCodename({
                metahubId,
                baseCodename: normalizedCodename,
                codenameStyle,
                objectsService,
                userId,
                excludeValueGroupId: currentSet?.id
            })
            if (!resolvedCodename) {
                return res.status(409).json({ error: 'Unable to generate unique codename for set' })
            }
            finalCodename = resolvedCodename
        }

        const codenameFallbackPrimaryLocale =
            parsed.data.namePrimaryLocale ??
            (currentSet?.presentation?.name as { _primary?: string } | undefined)?._primary ??
            VALUE_GROUP_DEFAULT_PRIMARY_LOCALE
        const codenamePayload = syncOptionalCodenamePayloadText(parsed.data.codename, codenameFallbackPrimaryLocale, finalCodename)
        const sanitizedName =
            parsed.data.name !== undefined ? sanitizeLocalizedInput(parsed.data.name as Record<string, string | undefined>) : undefined
        const sanitizedDescription =
            parsed.data.description !== undefined
                ? sanitizeLocalizedInput(parsed.data.description as Record<string, string | undefined>)
                : undefined

        const resolvedName =
            sanitizedName !== undefined
                ? buildLocalizedContent(sanitizedName, parsed.data.namePrimaryLocale, VALUE_GROUP_DEFAULT_PRIMARY_LOCALE)
                : currentSet?.presentation?.name ||
                  buildLocalizedContent(
                      { [VALUE_GROUP_DEFAULT_PRIMARY_LOCALE]: finalCodename },
                      parsed.data.namePrimaryLocale,
                      VALUE_GROUP_DEFAULT_PRIMARY_LOCALE
                  )

        const resolvedDescription =
            sanitizedDescription !== undefined
                ? buildLocalizedContent(sanitizedDescription, parsed.data.descriptionPrimaryLocale, VALUE_GROUP_DEFAULT_PRIMARY_LOCALE)
                : currentSet?.presentation?.description

        const currentTreeEntityIds = currentSet ? getValueGroupTreeEntityIds(currentSet) : []
        let nextTreeEntityIds = parsed.data.treeEntityIds ?? currentTreeEntityIds
        if (mode === 'create' && hubScoped && treeEntityId && parsed.data.treeEntityIds === undefined) {
            nextTreeEntityIds = [treeEntityId]
        }

        const isSingleHub = parsed.data.isSingleHub ?? currentSet?.config?.isSingleHub ?? false
        const isRequiredHub = parsed.data.isRequiredHub ?? currentSet?.config?.isRequiredHub ?? false
        const hubError = validateValueGroupHubConstraints(nextTreeEntityIds, isSingleHub, isRequiredHub)
        if (hubError) {
            return res.status(400).json({ error: hubError })
        }

        if (mode === 'create') {
            let created: ValueGroupRouteRow
            try {
                created = (await objectsService.createObject(
                    metahubId,
                    requestedCreateKind ?? 'set',
                    {
                        codename: codenamePayload ?? finalCodename,
                        name: resolvedName,
                        description: resolvedDescription,
                        config: {
                            hubs: nextTreeEntityIds,
                            isSingleHub,
                            isRequiredHub,
                            ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {})
                        },
                        createdBy: userId
                    },
                    userId
                )) as ValueGroupRouteRow
            } catch (error) {
                if (isUniqueViolation(error)) {
                    throw new MetahubConflictError('Set with this codename already exists in this metahub')
                }
                throw error
            }

            const createdItem = await getValueGroupByIdInternal(metahubId, created.id, {
                userId,
                allowedKinds: createEntityMetadataKindSet([created.kind ?? 'set']),
                objectsService,
                treeEntitiesService,
                fixedValuesService
            })
            return res.status(201).json(createdItem)
        }

        const expectedVersion = mode === 'update' && 'expectedVersion' in parsed.data ? parsed.data.expectedVersion : undefined
        const currentSetKind = currentSet?.kind ?? 'set'

        let updated: ValueGroupRouteRow | null
        try {
            updated = (await objectsService.updateObject(
                metahubId,
                valueGroupId,
                currentSetKind,
                {
                    codename: codenamePayload ?? finalCodename,
                    name: resolvedName,
                    description: resolvedDescription,
                    config: {
                        hubs: nextTreeEntityIds,
                        isSingleHub,
                        isRequiredHub,
                        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {})
                    },
                    expectedVersion,
                    updatedBy: userId
                },
                userId
            )) as ValueGroupRouteRow | null
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new MetahubConflictError('Set with this codename already exists in this metahub')
            }
            throw error
        }

        if (!updated) {
            throw new MetahubNotFoundError('set', valueGroupId)
        }

        const updatedItem = await getValueGroupByIdInternal(metahubId, updated.id, {
            userId,
            allowedKinds: createEntityMetadataKindSet([updated.kind ?? currentSetKind]),
            objectsService,
            treeEntitiesService,
            fixedValuesService
        })

        return res.json(updatedItem)
    }

    const listNestedSets = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const treeEntityId = req.params.treeEntityId
        const { objectsService, treeEntitiesService, fixedValuesService, entityTypeService } = createValueGroupRouteServices(
            exec,
            schemaService
        )

        if (treeEntityId) {
            const hub = await treeEntitiesService.findById(metahubId, treeEntityId, userId)
            if (!hub) throw new MetahubNotFoundError('hub', treeEntityId)
        }

        const parsed = valueGroupListQuerySchema.safeParse(req.query)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
        }

        const { limit, offset, sortBy, sortOrder, search } = parsed.data
        const requestedKinds = await resolveRequestedEntityMetadataKinds(entityTypeService, metahubId, 'set', parsed.data.kindKey, userId)
        const requestedKindSet = createEntityMetadataKindSet(requestedKinds)

        const rawSets = (await objectsService.findAllByKinds(metahubId, requestedKinds, userId)) as ValueGroupRouteRow[]
        const setRows = treeEntityId
            ? rawSets.filter((row) => isValueGroupObject(row, requestedKindSet) && getValueGroupTreeEntityIds(row).includes(treeEntityId))
            : rawSets.filter((row) => isValueGroupObject(row, requestedKindSet))
        const valueGroupIds = setRows.map((row) => row.id)
        const fixedValuesCounts = await fixedValuesService.countByObjectIds(metahubId, valueGroupIds, userId)

        let items = setRows.map((row) => {
            const item = mapValueGroupListItem(row, metahubId, fixedValuesCounts.get(row.id) || 0)
            item.hubs = getValueGroupTreeEntityIds(row).map((id) => ({ id, name: null, codename: id }))
            return item
        })

        if (search) {
            const searchLower = search.toLowerCase()
            items = items.filter((item) => matchesValueGroupSearch(getCodenamePayloadText(item.codename as never), item.name, searchLower))
        }

        items.sort((a, b) => compareValueGroupItems(a, b, sortBy, sortOrder))

        const total = items.length
        const paginatedItems = items.slice(offset, offset + limit)
        const enrichedItems = await enrichValueGroupItemsWithHubs(metahubId, paginatedItems, treeEntitiesService, userId)

        return res.json({
            items: enrichedItems,
            pagination: {
                total,
                limit,
                offset
            }
        })
    })

    const reorderNestedSets = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectsService, entityTypeService } = createValueGroupRouteServices(exec, schemaService)

            const parsed = reorderValueGroupsSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const compatibleSetKinds = await resolveEntityMetadataKinds(entityTypeService, metahubId, 'set', userId)
            const compatibleSetKindSet = createEntityMetadataKindSet(compatibleSetKinds)
            const existing = (await objectsService.findById(metahubId, parsed.data.valueGroupId, userId)) as ValueGroupRouteRow | null
            if (!isValueGroupObject(existing, compatibleSetKindSet)) {
                throw new MetahubNotFoundError('set', parsed.data.valueGroupId)
            }

            const result = await executeEntityReorder({
                entityLabel: 'Set',
                notFoundErrorMessage: 'set not found',
                notFoundResponseMessage: 'set not found',
                reorderEntity: () =>
                    objectsService.reorderByKind(
                        metahubId,
                        existing.kind ?? 'set',
                        parsed.data.valueGroupId,
                        parsed.data.newSortOrder,
                        userId
                    ),
                getId: (updated) => updated.id,
                getSortOrder: (updated) => updated.config?.sortOrder ?? 0
            })

            if (result.status === 404) {
                throw new MetahubNotFoundError('set', parsed.data.valueGroupId)
            }

            return res.json(result.body)
        },
        { permission: 'editContent' }
    )

    const getNestedSetById = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { valueGroupId, treeEntityId } = req.params
        const { objectsService, treeEntitiesService, fixedValuesService, entityTypeService } = createValueGroupRouteServices(
            exec,
            schemaService
        )
        const compatibleSetKinds = await resolveEntityMetadataKinds(entityTypeService, metahubId, 'set', userId)

        const setItem = await getValueGroupByIdInternal(metahubId, valueGroupId, {
            treeEntityId,
            userId,
            allowedKinds: createEntityMetadataKindSet(compatibleSetKinds),
            objectsService,
            treeEntitiesService,
            fixedValuesService
        })

        if (!setItem) {
            throw new MetahubNotFoundError('set', valueGroupId)
        }

        return res.json(setItem)
    })

    const createNestedSet = createHandler(async (ctx) => upsertNestedValueGroup(ctx, 'create'), { permission: 'createContent' })
    const updateNestedSet = createHandler(async (ctx) => upsertNestedValueGroup(ctx, 'update'), { permission: 'editContent' })
    const deleteNestedSet = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { valueGroupId, treeEntityId } = req.params
            const { objectsService, fixedValuesService, entityTypeService } = createValueGroupRouteServices(exec, schemaService)
            const forceDelete = req.query.force === 'true'
            const compatibleSetKinds = await resolveEntityMetadataKinds(entityTypeService, metahubId, 'set', userId)
            const compatibleSetKindSet = createEntityMetadataKindSet(compatibleSetKinds)

            const setRow = (await objectsService.findById(metahubId, valueGroupId, userId)) as ValueGroupRouteRow | null
            const entity = isValueGroupObject(setRow, compatibleSetKindSet) ? setRow : null
            const blockedOutcome = (blockers: Awaited<ReturnType<typeof getValueGroupBlockingReferences>>) => ({
                status: 409,
                body: {
                    error: 'Cannot delete set because there are blocking references',
                    code: 'SET_DELETE_BLOCKED_BY_REFERENCES',
                    valueGroupId,
                    blockingReferences: blockers
                }
            })

            const result = treeEntityId
                ? await executeHubScopedDelete({
                      entity,
                      entityLabel: 'Set',
                      notFoundMessage: 'set not found',
                      notFoundInHubMessage: 'Set not found in this hub',
                      treeEntityId,
                      forceDelete,
                      getTreeEntityIds: getValueGroupTreeEntityIds,
                      detachFromHub: async (nextTreeEntityIds) => {
                          const expectedVersion = typeof entity?._upl_version === 'number' ? entity._upl_version : 1
                          await objectsService.updateObject(
                              metahubId,
                              valueGroupId,
                              entity?.kind ?? 'set',
                              {
                                  config: {
                                      ...(entity?.config ?? {}),
                                      hubs: nextTreeEntityIds
                                  },
                                  expectedVersion,
                                  updatedBy: userId
                              },
                              userId
                          )
                      },
                      detachConflictOutcome: (error) => {
                          if (error instanceof OptimisticLockError) {
                              return {
                                  status: 409,
                                  body: {
                                      error: error.message,
                                      code: error.code,
                                      conflict: error.conflict
                                  }
                              }
                          }
                          return null
                      },
                      detachedMessage: 'Set was removed from the selected hub but kept in other hubs',
                      findBlockingReferences: () =>
                          getValueGroupBlockingReferences(metahubId, valueGroupId, compatibleSetKinds, fixedValuesService, userId),
                      blockedOutcome,
                      deleteEntity: () => objectsService.delete(metahubId, valueGroupId, userId)
                  })
                : await executeBlockedDelete({
                      entity,
                      entityLabel: 'Set',
                      notFoundMessage: 'set not found',
                      findBlockingReferences: () =>
                          getValueGroupBlockingReferences(metahubId, valueGroupId, compatibleSetKinds, fixedValuesService, userId),
                      blockedOutcome,
                      deleteEntity: () => objectsService.delete(metahubId, valueGroupId, userId)
                  })

            if (result.status === 204) {
                return res.status(204).send()
            }
            return res.status(result.status).json(result.body)
        },
        { permission: 'deleteContent' }
    )
    const listNestedLinkedCollections = createHandler(listLinkedCollectionsByHub)
    const createNestedLinkedCollection = createHandler(createLinkedCollectionByHub, { permission: 'editContent' })
    const reorderNestedLinkedCollections = createHandler(reorderLinkedCollections, { permission: 'editContent' })
    const getNestedLinkedCollectionById = createHandler(getLinkedCollectionByHub)
    const updateNestedLinkedCollection = createHandler(updateLinkedCollectionByHub, { permission: 'editContent' })
    const deleteNestedLinkedCollection = createHandler(deleteLinkedCollectionByHub, { permission: 'deleteContent' })

    const listNestedTreeEntities = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const treeEntitiesService = new MetahubTreeEntitiesService(exec, schemaService)
        const entityTypeService = new EntityTypeService(exec, schemaService)
        const compatibility = await loadTreeEntityContext(entityTypeService, metahubId, userId)
        const parentHub = await treeEntitiesService.findByIdWithKinds(metahubId, req.params.treeEntityId, userId, compatibility.hubKinds)

        if (!parentHub) {
            throw new MetahubNotFoundError('hub', req.params.treeEntityId)
        }

        let parsed

        try {
            parsed = validateListQuery(req.query)
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
            }
            throw error
        }

        const schemaName = await schemaService.ensureSchema(metahubId, userId)
        const objectsTable = qSchemaTable(schemaName, '_mhb_objects')
        const baseWhere = `kind = ANY($1::text[]) AND _upl_deleted = false AND _mhb_deleted = false AND config->>'parentTreeEntityId' = $2`
        const baseParams: unknown[] = [compatibility.hubKinds, req.params.treeEntityId]

        let searchFilter = ''
        if (parsed.search) {
            const escapedSearch = `%${parsed.search.replace(/[%_]/g, '\\$&')}%`
            searchFilter = ` AND (${codenamePrimaryTextSql('codename')} ILIKE $3 OR presentation::text ILIKE $3)`
            baseParams.push(escapedSearch)
        }

        const countResult = await queryOne<{ total: string }>(
            exec,
            `SELECT COUNT(*) as total FROM ${objectsTable} WHERE ${baseWhere}${searchFilter}`,
            baseParams
        )

        const sortOrder = parsed.sortOrder === 'asc' ? 'asc' : 'desc'
        const sortClause = (() => {
            if (parsed.sortBy === 'name') return `presentation->'name'->>'en' ${sortOrder}`
            if (parsed.sortBy === 'codename') return `${codenamePrimaryTextSql('codename')} ${sortOrder}`
            if (parsed.sortBy === 'sortOrder') return `COALESCE((config->>'sortOrder')::int, 0) ${sortOrder}`
            if (parsed.sortBy === 'created') return `_upl_created_at ${sortOrder}`
            return `_upl_updated_at ${sortOrder}`
        })()

        const dataParams = [...baseParams, parsed.offset, parsed.limit]
        const offsetIdx = dataParams.length - 1
        const limitIdx = dataParams.length

        const rows = await queryMany<Record<string, unknown>>(
            exec,
            `SELECT * FROM ${objectsTable}
             WHERE ${baseWhere}${searchFilter}
             ORDER BY ${sortClause}, id ASC
             OFFSET $${offsetIdx} LIMIT $${limitIdx}`,
            dataParams
        )

        const items = rows.map((row) => {
            const presentation = (row.presentation as Record<string, unknown>) ?? {}
            const config = (row.config as Record<string, unknown>) ?? {}

            return {
                id: row.id,
                codename: row.codename,
                name: presentation.name ?? {},
                description: presentation.description ?? null,
                sortOrder: config.sortOrder ?? 0,
                parentTreeEntityId: typeof config.parentTreeEntityId === 'string' ? config.parentTreeEntityId : null,
                version: row._upl_version ?? 1,
                createdAt: row._upl_created_at ?? null,
                updatedAt: row._upl_updated_at ?? null
            }
        })

        return res.json({
            items,
            pagination: {
                total: Number(countResult?.total ?? 0),
                limit: parsed.limit,
                offset: parsed.offset
            }
        })
    })

    const listNestedOptionLists = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { objectsService, treeEntitiesService, valuesService, entityTypeService } = createOptionListRouteServices(exec, schemaService)

        let validatedQuery
        try {
            validatedQuery = validateListQuery(req.query)
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
            }
            throw error
        }

        const { limit, offset, sortBy, sortOrder, search } = validatedQuery
        const requestedKindKey = typeof req.query.kindKey === 'string' ? req.query.kindKey : undefined
        const requestedKinds = await resolveRequestedEntityMetadataKinds(
            entityTypeService,
            metahubId,
            'enumeration',
            requestedKindKey,
            userId
        )
        const requestedKindSet = createEntityMetadataKindSet(requestedKinds)
        const allOptionLists = (await objectsService.findAllByKinds(metahubId, requestedKinds, userId)) as OptionListRouteRow[]
        const hubOptionLists = allOptionLists.filter(
            (optionList) =>
                isOptionListContextKind(optionList.kind, requestedKindSet) &&
                getOptionListContainerIds(optionList).includes(req.params.treeEntityId)
        )

        if (hubOptionLists.length === 0) {
            return res.json({ items: [], pagination: { total: 0, limit, offset } })
        }

        const optionListIds = hubOptionLists.map((row) => row.id)
        const optionValuesCounts = await valuesService.countByObjectIds(metahubId, optionListIds, userId)

        let items = hubOptionLists.map((row) => mapOptionListSummary(row, metahubId, optionValuesCounts.get(row.id) || 0))

        if (search) {
            const searchLower = search.toLowerCase()
            items = items.filter((item) => matchesOptionListSearch(getOptionListCodenameText(item.codename), item.name, searchLower))
        }

        items.sort((a, b) => compareOptionListItems(a, b, sortBy, sortOrder))

        const total = items.length
        const paginatedItems = items.slice(offset, offset + limit)
        const resultItems = await enrichWithContainers(paginatedItems, hubOptionLists, treeEntitiesService, metahubId, userId)

        return res.json({ items: resultItems, pagination: { total, limit, offset } })
    })

    const reorderNestedOptionLists = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectsService, entityTypeService } = createOptionListRouteServices(exec, schemaService)
            const parsed = reorderOptionListsSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const compatibleKinds = await resolveEntityMetadataKinds(entityTypeService, metahubId, 'enumeration', userId)
            const compatibleKindSet = createEntityMetadataKindSet(compatibleKinds)
            const existing = await objectsService.findById(metahubId, parsed.data.optionListId, userId)
            if (!existing || !isOptionListContextKind(existing.kind, compatibleKindSet)) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const result = await executeEntityReorder({
                entityLabel: 'OptionList',
                notFoundErrorMessage: 'optionList not found',
                notFoundResponseMessage: 'Enumeration not found',
                reorderEntity: () =>
                    objectsService.reorderByKind(metahubId, existing.kind, parsed.data.optionListId, parsed.data.newSortOrder, userId),
                getId: (updated) => updated.id,
                getSortOrder: (updated) => updated.config?.sortOrder ?? 0
            })

            return res.status(result.status).json(result.body)
        },
        { permission: 'editContent' }
    )

    const getNestedOptionListById = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { objectsService, treeEntitiesService, valuesService, entityTypeService } = createOptionListRouteServices(exec, schemaService)
        const compatibleKinds = await loadCompatibleOptionListKinds(entityTypeService, metahubId, userId)
        const compatibleKindSet = createEntityMetadataKindSet(compatibleKinds)
        const optionList = await objectsService.findById(metahubId, req.params.optionListId, userId)
        if (!optionList || !isOptionListContextKind(optionList.kind, compatibleKindSet)) {
            return res.status(404).json({ error: 'Enumeration not found' })
        }

        const currentHubs = optionList.config?.hubs || []
        if (req.params.treeEntityId && !currentHubs.includes(req.params.treeEntityId)) {
            return res.status(404).json({ error: 'Enumeration not found in this hub' })
        }

        const hubs = currentHubs.length > 0 ? await treeEntitiesService.findByIds(metahubId, currentHubs, userId) : []
        const optionValuesCount = await valuesService.countByObjectId(metahubId, optionList.id, userId)

        return res.json({
            id: optionList.id,
            metahubId,
            codename: optionList.codename,
            name: optionList.presentation.name,
            description: optionList.presentation.description,
            isSingleHub: optionList.config?.isSingleHub,
            isRequiredHub: optionList.config?.isRequiredHub,
            sortOrder: optionList.config?.sortOrder,
            version: optionList._upl_version || 1,
            createdAt: resolveCreatedAt(optionList),
            updatedAt: resolveUpdatedAt(optionList),
            optionValuesCount,
            hubs: hubs.map(mapContainerSummary)
        })
    })

    const createNestedOptionList = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectsService, treeEntitiesService, settingsService, entityTypeService } = createOptionListRouteServices(
                exec,
                schemaService
            )

            const hub = await treeEntitiesService.findById(metahubId, req.params.treeEntityId, userId)
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const parsed = createOptionListSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const {
                codename,
                name,
                description,
                sortOrder,
                namePrimaryLocale,
                descriptionPrimaryLocale,
                isSingleHub,
                isRequiredHub,
                treeEntityIds,
                kindKey
            } = parsed.data

            const targetKind = await resolveRequestedEntityMetadataKind(entityTypeService, metahubId, 'enumeration', kindKey, userId)
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

            const existing = await objectsService.findByCodenameAndKind(metahubId, normalizedCodename, targetKind, userId)
            if (existing) {
                return res.status(409).json({ error: 'Enumeration with this codename already exists in this metahub' })
            }

            const sanitizedName = sanitizeLocalizedInput(name ?? {})
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            let descriptionVlc = undefined
            if (description) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    descriptionVlc = buildLocalizedContent(sanitizedDescription, descriptionPrimaryLocale, namePrimaryLocale ?? 'en')
                }
            }

            const codenamePayload = syncCodenamePayloadText(
                codename,
                namePrimaryLocale ?? 'en',
                normalizedCodename,
                codenameStyle,
                codenameAlphabet
            )
            if (!codenamePayload) {
                return res.status(400).json({ error: 'Validation failed', details: { codename: ['Codename is required'] } })
            }

            const targetTreeEntityIds = treeEntityIds && Array.isArray(treeEntityIds) ? treeEntityIds : [req.params.treeEntityId]
            if ((isSingleHub ?? false) && targetTreeEntityIds.length > 1) {
                return res.status(400).json({ error: 'This optionList is restricted to a single hub' })
            }

            const validHubs = await treeEntitiesService.findByIds(metahubId, targetTreeEntityIds, userId)
            if (validHubs.length !== targetTreeEntityIds.length) {
                return res.status(400).json({ error: 'One or more hub IDs are invalid' })
            }

            let created
            try {
                created = await objectsService.createObject(
                    metahubId,
                    targetKind,
                    {
                        codename: codenamePayload,
                        name: nameVlc,
                        description: descriptionVlc,
                        config: {
                            hubs: targetTreeEntityIds,
                            isSingleHub: isSingleHub ?? false,
                            isRequiredHub: isRequiredHub ?? false,
                            sortOrder
                        },
                        createdBy: userId
                    },
                    userId
                )
            } catch (error) {
                if (respondUniqueViolation(res, error, 'Enumeration with this codename already exists in this metahub')) {
                    return
                }
                throw error
            }

            const hubs = await treeEntitiesService.findByIds(metahubId, targetTreeEntityIds, userId)
            return res.status(201).json({
                id: created.id,
                metahubId,
                codename: created.codename,
                name: created.presentation.name,
                description: created.presentation.description,
                isSingleHub: created.config.isSingleHub,
                isRequiredHub: created.config.isRequiredHub,
                sortOrder: created.config.sortOrder,
                version: created._upl_version || 1,
                createdAt: resolveCreatedAt(created),
                updatedAt: resolveUpdatedAt(created),
                hubs: hubs.map(mapContainerSummary),
                optionValuesCount: 0
            })
        },
        { permission: 'editContent' }
    )

    const updateNestedOptionList = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectsService, treeEntitiesService, settingsService, entityTypeService } = createOptionListRouteServices(
                exec,
                schemaService
            )
            const compatibleKinds = await resolveEntityMetadataKinds(entityTypeService, metahubId, 'enumeration', userId)
            const compatibleKindSet = createEntityMetadataKindSet(compatibleKinds)
            const optionList = await objectsService.findById(metahubId, req.params.optionListId, userId)
            if (!optionList || !isOptionListContextKind(optionList.kind, compatibleKindSet)) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const currentHubs = optionList.config?.hubs || []
            if (!currentHubs.includes(req.params.treeEntityId)) {
                return res.status(404).json({ error: 'Enumeration not found in this hub' })
            }

            const parsed = updateOptionListSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const {
                codename,
                name,
                description,
                sortOrder,
                namePrimaryLocale,
                descriptionPrimaryLocale,
                isSingleHub,
                isRequiredHub,
                treeEntityIds,
                expectedVersion
            } = parsed.data

            const currentPresentation = optionList.presentation || {}
            const currentConfig = optionList.config || {}
            let finalName = currentPresentation.name
            let finalDescription = currentPresentation.description
            let finalCodename: unknown = optionList.codename
            let finalCodenameText = getOptionListCodenameText(optionList.codename)
            let targetTreeEntityIds = currentConfig.hubs || []

            if (treeEntityIds !== undefined) {
                targetTreeEntityIds = treeEntityIds
                if ((isSingleHub ?? currentConfig.isSingleHub) && targetTreeEntityIds.length > 1) {
                    return res.status(400).json({ error: 'This optionList is restricted to a single hub' })
                }
                const effectiveIsRequiredHub = isRequiredHub ?? currentConfig.isRequiredHub
                if (effectiveIsRequiredHub && targetTreeEntityIds.length === 0) {
                    return res.status(400).json({ error: 'This optionList requires at least one hub association' })
                }
                if (targetTreeEntityIds.length > 0) {
                    const validHubs = await treeEntitiesService.findByIds(metahubId, targetTreeEntityIds, userId)
                    if (validHubs.length !== targetTreeEntityIds.length) {
                        return res.status(400).json({ error: 'One or more hub IDs are invalid' })
                    }
                }
            }

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
                if (normalizedCodename !== getOptionListCodenameText(optionList.codename)) {
                    const existing = await objectsService.findByCodenameAndKind(metahubId, normalizedCodename, optionList.kind, userId)
                    if (existing && existing.id !== req.params.optionListId) {
                        return res.status(409).json({ error: 'Enumeration with this codename already exists' })
                    }
                }
                const nextCodename = syncCodenamePayloadText(
                    codename,
                    resolvePrimaryLocale(optionList.codename) ?? namePrimaryLocale ?? 'en',
                    normalizedCodename,
                    codenameStyle,
                    codenameAlphabet
                )
                if (!nextCodename) {
                    return res.status(400).json({ error: 'Validation failed', details: { codename: ['Codename is required'] } })
                }
                finalCodename = nextCodename
                finalCodenameText = normalizedCodename
            }

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? currentPresentation.name?._primary ?? 'en'
                const nameVlc = buildLocalizedContent(sanitizedName, primary, primary)
                if (nameVlc) {
                    finalName = nameVlc
                }
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const primary =
                        descriptionPrimaryLocale ??
                        currentPresentation.description?._primary ??
                        currentPresentation.name?._primary ??
                        namePrimaryLocale ??
                        'en'
                    finalDescription = buildLocalizedContent(sanitizedDescription, primary, primary)
                } else {
                    finalDescription = undefined
                }
            }

            let updated
            try {
                updated = await objectsService.updateObject(
                    metahubId,
                    req.params.optionListId,
                    optionList.kind,
                    {
                        codename: finalCodenameText !== getOptionListCodenameText(optionList.codename) ? finalCodename : undefined,
                        name: finalName,
                        description: finalDescription,
                        config: {
                            hubs: targetTreeEntityIds,
                            isSingleHub: isSingleHub ?? currentConfig.isSingleHub,
                            isRequiredHub: isRequiredHub ?? currentConfig.isRequiredHub,
                            sortOrder: sortOrder ?? currentConfig.sortOrder
                        },
                        updatedBy: userId,
                        expectedVersion
                    },
                    userId
                )
            } catch (error) {
                if (respondUniqueViolation(res, error, 'Enumeration with this codename already exists in this metahub')) {
                    return
                }
                throw error
            }

            const updatedOptionList = updated as OptionListRouteRow
            const hubs = targetTreeEntityIds.length > 0 ? await treeEntitiesService.findByIds(metahubId, targetTreeEntityIds, userId) : []
            return res.json({
                id: updatedOptionList.id,
                metahubId,
                codename: updatedOptionList.codename,
                name: updatedOptionList.presentation?.name ?? {},
                description: updatedOptionList.presentation?.description,
                isSingleHub: updatedOptionList.config?.isSingleHub ?? false,
                isRequiredHub: updatedOptionList.config?.isRequiredHub ?? false,
                sortOrder: updatedOptionList.config?.sortOrder ?? 0,
                version: updatedOptionList._upl_version || 1,
                createdAt: resolveCreatedAt(updatedOptionList),
                updatedAt: resolveUpdatedAt(updatedOptionList),
                hubs: hubs.map(mapContainerSummary)
            })
        },
        { permission: 'editContent' }
    )

    const deleteNestedOptionList = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectsService, fieldDefinitionsService, settingsService, entityTypeService } = createOptionListRouteServices(
                exec,
                schemaService
            )
            const compatibleKinds = await loadCompatibleOptionListKinds(entityTypeService, metahubId, userId)
            const compatibleKindSet = createEntityMetadataKindSet(compatibleKinds)
            const optionList = await objectsService.findById(metahubId, req.params.optionListId, userId)
            const result = await executeHubScopedDelete({
                entity: optionList && isOptionListContextKind(optionList.kind, compatibleKindSet) ? optionList : null,
                entityLabel: 'OptionList',
                notFoundMessage: 'Enumeration not found',
                notFoundInHubMessage: 'Enumeration not found in this hub',
                treeEntityId: req.params.treeEntityId,
                forceDelete: req.query.force === 'true',
                getTreeEntityIds: getOptionListContainerIds,
                isRequiredHub: (currentOptionList) => Boolean(currentOptionList.config?.isRequiredHub),
                lastHubConflictMessage:
                    'Cannot remove optionList from its last hub because it requires at least one hub association. Use force=true to delete the optionList entirely.',
                beforeDelete: async () => {
                    const allowDeleteRow = await settingsService.findByKey(metahubId, 'entity.optionList.allowDelete', userId)
                    const allowDelete = allowDeleteRow ? (allowDeleteRow.value as { _value: boolean })._value !== false : true
                    if (!allowDelete) {
                        return {
                            status: 403,
                            body: { error: 'Deleting enumerations is disabled by metahub settings' }
                        }
                    }

                    const refs = await findBlockingOptionListReferences(
                        metahubId,
                        req.params.optionListId,
                        compatibleKinds,
                        fieldDefinitionsService,
                        userId
                    )
                    if (refs.length > 0) {
                        return {
                            status: 409,
                            body: {
                                error: 'Cannot delete enumeration: it is referenced by attributes',
                                blockingReferences: refs
                            }
                        }
                    }

                    return null
                },
                detachFromHub: async (nextTreeEntityIds) => {
                    await objectsService.updateObject(
                        metahubId,
                        req.params.optionListId,
                        optionList?.kind ?? 'enumeration',
                        {
                            config: { hubs: nextTreeEntityIds },
                            updatedBy: userId,
                            expectedVersion: optionList?._upl_version
                        },
                        userId
                    )
                },
                detachedMessage: 'Enumeration removed from hub',
                deleteEntity: () => objectsService.delete(metahubId, req.params.optionListId, userId)
            })

            if (result.status === 204) {
                return res.status(204).send()
            }

            return res.status(result.status).json(result.body)
        },
        { permission: 'deleteContent' }
    )

    return {
        listNestedSets,
        reorderNestedSets,
        getNestedSetById,
        createNestedSet,
        updateNestedSet,
        deleteNestedSet,
        listNestedLinkedCollections,
        createNestedLinkedCollection,
        reorderNestedLinkedCollections,
        getNestedLinkedCollectionById,
        updateNestedLinkedCollection,
        deleteNestedLinkedCollection,
        listNestedTreeEntities,
        listNestedOptionLists,
        reorderNestedOptionLists,
        getNestedOptionListById,
        createNestedOptionList,
        updateNestedOptionList,
        deleteNestedOptionList
    }
}
