import { z } from 'zod'
import type { Request, Response } from 'express'
import type { DbExecutor, SqlQueryable } from '@universo/utils'
import { database, normalizeHubCopyOptions } from '@universo/utils'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '@universo/utils/validation/codename'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo/utils/vlc'
import { queryMany, queryOne } from '@universo/utils/database'
import { qSchemaTable } from '@universo/database'
import { MetaEntityKind, type HubCopyOptions } from '@universo/types'
import { findMetahubById } from '../../../persistence'
import { getRequestDbExecutor } from '../../../utils'
import { getRequestDbSession } from '@universo/utils/database'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'
import { MetahubSettingsService } from '../../settings/services/MetahubSettingsService'
import { EntityTypeService } from '../../entities/services/EntityTypeService'
import { validateListQuery } from '../../shared/queryParams'
import { MetahubNotFoundError } from '../../shared/domainErrors'
import { ensureMetahubAccess } from '../../shared/guards'
import { resolveUserId } from '../../shared/routeAuth'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { codenamePrimaryTextSql } from '../../shared/codename'
import {
    getCodenameSettings,
    codenameErrorMessage,
    buildCodenameAttempt,
    CODENAME_RETRY_MAX_ATTEMPTS,
    CODENAME_CONCURRENT_RETRIES_PER_ATTEMPT
} from '../../shared/codenameStyleHelper'
import {
    getCodenamePayloadText,
    optionalCodenamePayloadSchema,
    requiredCodenamePayloadSchema,
    syncOptionalCodenamePayloadText,
    syncCodenamePayloadText
} from '../../shared/codenamePayload'
import {
    createLegacyCompatibleKindSet,
    resolveLegacyCompatibleKinds,
    resolveRequestedLegacyCompatibleKind,
    resolveRequestedLegacyCompatibleKinds
} from '../../shared/legacyCompatibility'
import {
    findBlockingHubObjects,
    loadHubCompatibilityContext,
    removeHubFromObjectAssociations,
    type HubCompatibilityContext
} from '../services/hubCompatibility'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HubListItemRow = {
    id: string
    kind?: string
    codename: unknown
    name?: unknown
    description?: unknown
    sort_order?: number
    parent_hub_id?: string | null
    _upl_version?: number
    created_at?: unknown
    updated_at?: unknown
}

type CopiedHubRow = HubListItemRow & {
    name?: unknown
    description?: unknown
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

class HubCopyConcurrentUpdateError extends Error {
    constructor() {
        super('Concurrent update detected while propagating hub relations')
    }
}

class HubParentRelationValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'HubParentRelationValidationError'
    }
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

const getHubCodenameText = (codename: unknown): string => getCodenamePayloadText(codename as Parameters<typeof getCodenamePayloadText>[0])

const normalizeLocaleCode = (locale: string): string => locale.split('-')[0].split('_')[0].toLowerCase()

const buildDefaultCopyNameInput = (name: unknown): Record<string, string> => {
    const locales = (name as { locales?: Record<string, { content?: string }> } | undefined)?.locales ?? {}
    const entries = Object.entries(locales)
        .map(([locale, value]) => [normalizeLocaleCode(locale), typeof value?.content === 'string' ? value.content.trim() : ''] as const)
        .filter(([, content]) => content.length > 0)

    if (entries.length === 0) {
        return {
            en: 'Copy (copy)'
        }
    }

    const result: Record<string, string> = {}
    for (const [locale, content] of entries) {
        const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'
        result[locale] = `${content}${suffix}`
    }
    return result
}

const resolveParentHubId = (hub: Record<string, unknown> | null | undefined): string | null => {
    if (!hub || typeof hub !== 'object') return null
    const direct = (hub as { parent_hub_id?: unknown }).parent_hub_id
    if (typeof direct === 'string' && direct.length > 0) return direct
    const configParent = (hub as { config?: { parentHubId?: unknown } }).config?.parentHubId
    if (typeof configParent === 'string' && configParent.length > 0) return configParent
    return null
}

const getRequestedKindKey = (query: Request['query']): string | undefined =>
    typeof query.kindKey === 'string' && query.kindKey.trim().length > 0 ? query.kindKey : undefined

const getStoredHubKind = (hub: Record<string, unknown> | null | undefined): string => {
    const kind = typeof hub?.kind === 'string' ? hub.kind.trim() : ''
    return kind.length > 0 ? kind : MetaEntityKind.HUB
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))
const optionalLocalizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))

const createHubSchema = z
    .object({
        codename: requiredCodenamePayloadSchema,
        kindKey: z.string().min(1).optional(),
        name: localizedInputSchema.optional(),
        description: optionalLocalizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        sortOrder: z.number().int().optional(),
        parentHubId: z.string().uuid().nullable().optional()
    })
    .strict()

const updateHubSchema = z
    .object({
        codename: optionalCodenamePayloadSchema,
        name: localizedInputSchema.optional(),
        description: optionalLocalizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        sortOrder: z.number().int().optional(),
        parentHubId: z.string().uuid().nullable().optional(),
        expectedVersion: z.number().int().positive().optional() // For optimistic locking
    })
    .strict()

const copyHubSchema = z
    .object({
        codename: optionalCodenamePayloadSchema,
        name: localizedInputSchema.optional(),
        description: optionalLocalizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        parentHubId: z.string().uuid().nullable().optional(),
        copyAllRelations: z.boolean().optional(),
        copyCatalogRelations: z.boolean().optional(),
        copySetRelations: z.boolean().optional(),
        copyEnumerationRelations: z.boolean().optional()
    })
    .strict()

const reorderHubsSchema = z
    .object({
        hubId: z.string().uuid(),
        newSortOrder: z.number().int().min(1)
    })
    .strict()

const getAllowHubNesting = async (metahubId: string, settingsService: MetahubSettingsService, userId?: string): Promise<boolean> => {
    const row = await settingsService.findByKey(metahubId, 'hubs.allowNesting', userId)
    if (!row) return true
    return (row.value as { _value?: unknown })._value !== false
}

const loadHubParentMap = async ({
    metahubId,
    schemaService,
    userId,
    db,
    hubKinds
}: {
    metahubId: string
    schemaService: MetahubSchemaService
    userId?: string
    db?: SqlQueryable
    hubKinds: readonly string[]
}): Promise<Map<string, string | null>> => {
    const schemaName = await schemaService.ensureSchema(metahubId, userId)
    const objQt = qSchemaTable(schemaName, '_mhb_objects')

    const rows = await queryMany<{ id: string; config?: { parentHubId?: unknown } }>(
        db!,
        `SELECT id, config FROM ${objQt}
         WHERE kind = ANY($1::text[]) AND _upl_deleted = false AND _mhb_deleted = false`,
        [hubKinds]
    )

    const map = new Map<string, string | null>()
    for (const row of rows) {
        const parentHubId = typeof row.config?.parentHubId === 'string' ? row.config.parentHubId : null
        map.set(row.id, parentHubId)
    }
    return map
}

const validateHubParentRelation = async ({
    metahubId,
    hubId,
    parentHubId,
    schemaService,
    userId,
    db,
    hubKinds
}: {
    metahubId: string
    hubId: string
    parentHubId: string | null
    schemaService: MetahubSchemaService
    userId?: string
    db?: SqlQueryable
    hubKinds: readonly string[]
}): Promise<{ ok: true } | { ok: false; message: string }> => {
    if (!parentHubId) return { ok: true }
    if (parentHubId === hubId) {
        return { ok: false, message: 'Hub cannot be a parent of itself' }
    }

    const parentMap = await loadHubParentMap({ metahubId, schemaService, userId, db, hubKinds })
    if (!parentMap.has(parentHubId)) {
        return { ok: false, message: 'Parent hub not found' }
    }

    let current: string | null = parentHubId
    const visited = new Set<string>()
    while (current) {
        if (current === hubId) {
            return { ok: false, message: 'Hub nesting cycle is not allowed' }
        }
        if (visited.has(current)) {
            return { ok: false, message: 'Hub nesting cycle is not allowed' }
        }
        visited.add(current)
        current = parentMap.get(current) ?? null
    }

    return { ok: true }
}

// ---------------------------------------------------------------------------
// Domain services factory
// ---------------------------------------------------------------------------

function createDomainServices(exec: DbExecutor, schemaService: MetahubSchemaService) {
    return {
        objectsService: new MetahubObjectsService(exec, schemaService),
        hubsService: new MetahubHubsService(exec, schemaService),
        settingsService: new MetahubSettingsService(exec, schemaService),
        entityTypeService: new EntityTypeService(exec, schemaService)
    }
}

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createHubsController(createHandler: ReturnType<typeof createMetahubHandlerFactory>, getDbExecutor: () => DbExecutor) {
    const list = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { hubsService, objectsService, entityTypeService } = createDomainServices(exec, schemaService)

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

        const requestedKindKey = getRequestedKindKey(req.query)
        const [requestedKinds, compatibility] = await Promise.all([
            resolveRequestedLegacyCompatibleKinds(entityTypeService, metahubId, 'hub', requestedKindKey, userId),
            loadHubCompatibilityContext(entityTypeService, metahubId, userId)
        ])

        const { items: hubs, total } = await hubsService.findAll(
            metahubId,
            {
                limit,
                offset,
                sortBy,
                sortOrder,
                search,
                kinds: requestedKinds
            },
            userId
        )

        // Calculate aggregated items per hub (catalogs + sets + enumerations)
        const [catalogs, sets, enumerations] = await Promise.all([
            objectsService.findAllByKinds(metahubId, compatibility.catalogKinds, userId),
            objectsService.findAllByKinds(metahubId, compatibility.setKinds, userId),
            objectsService.findAllByKinds(metahubId, compatibility.enumerationKinds, userId)
        ])

        const catalogsCountByHub = new Map<string, number>()
        const itemsCountByHub = new Map<string, number>()

        const registerCounts = (
            rows: Array<{
                config?: {
                    hubs?: unknown
                    isSingleHub?: unknown
                }
            }>,
            counter?: Map<string, number>
        ) => {
            for (const row of rows) {
                const hubIds = Array.isArray(row.config?.hubs)
                    ? row.config.hubs.filter((value): value is string => typeof value === 'string')
                    : []
                for (const associatedHubId of hubIds) {
                    if (counter) {
                        counter.set(associatedHubId, (counter.get(associatedHubId) || 0) + 1)
                    }
                    itemsCountByHub.set(associatedHubId, (itemsCountByHub.get(associatedHubId) || 0) + 1)
                }
            }
        }

        registerCounts(catalogs, catalogsCountByHub)
        registerCounts(sets)
        registerCounts(enumerations)

        const items = hubs.map((h) => {
            const hub = h as HubListItemRow
            return {
                id: hub.id,
                codename: hub.codename,
                name: hub.name,
                description: hub.description,
                sortOrder: hub.sort_order,
                parentHubId: hub.parent_hub_id ?? null,
                version: hub._upl_version || 1,
                createdAt: hub.created_at,
                updatedAt: hub.updated_at,
                catalogsCount: catalogsCountByHub.get(hub.id) || 0,
                itemsCount: itemsCountByHub.get(hub.id) || 0
            }
        })

        res.json({ items, pagination: { total, limit, offset } })
    })

    const listChildHubs = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { hubId } = req.params
        const { hubsService, entityTypeService } = createDomainServices(exec, schemaService)

        const requestedKindKey = getRequestedKindKey(req.query)
        const [requestedKinds, compatibility] = await Promise.all([
            resolveRequestedLegacyCompatibleKinds(entityTypeService, metahubId, 'hub', requestedKindKey, userId),
            loadHubCompatibilityContext(entityTypeService, metahubId, userId)
        ])

        const parentHub = await hubsService.findByIdWithKinds(metahubId, hubId, userId, compatibility.hubKinds)
        if (!parentHub) {
            return res.status(404).json({ error: 'Hub not found' })
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
        const objQt = qSchemaTable(schemaName, '_mhb_objects')

        const baseWhere = `kind = ANY($1::text[]) AND _upl_deleted = false AND _mhb_deleted = false AND config->>'parentHubId' = $2`
        const baseParams: unknown[] = [requestedKinds, hubId]

        let searchFilter = ''
        if (parsed.search) {
            const escapedSearch = `%${parsed.search.replace(/[%_]/g, '\\$&')}%`
            searchFilter = ` AND (${codenamePrimaryTextSql('codename')} ILIKE $3 OR presentation::text ILIKE $3)`
            baseParams.push(escapedSearch)
        }

        const countResult = await queryOne<{ total: string }>(
            exec,
            `SELECT COUNT(*) as total FROM ${objQt} WHERE ${baseWhere}${searchFilter}`,
            baseParams
        )

        const sortOrder = parsed.sortOrder === 'asc' ? 'asc' : 'desc'
        const sortClause = (() => {
            if (parsed.sortBy === 'name') return `presentation->'name'->>'en' ${sortOrder}`
            if (parsed.sortBy === 'codename') return `codename ${sortOrder}`
            if (parsed.sortBy === 'sortOrder') return `COALESCE((config->>'sortOrder')::int, 0) ${sortOrder}`
            if (parsed.sortBy === 'created') return `_upl_created_at ${sortOrder}`
            return `_upl_updated_at ${sortOrder}`
        })()

        const dataParams = [...baseParams, parsed.offset, parsed.limit]
        const offsetIdx = dataParams.length - 1
        const limitIdx = dataParams.length

        const rows = await queryMany<Record<string, unknown>>(
            exec,
            `SELECT * FROM ${objQt}
             WHERE ${baseWhere}${searchFilter}
             ORDER BY ${sortClause}, id ASC
             OFFSET $${offsetIdx} LIMIT $${limitIdx}`,
            dataParams
        )

        const items = rows.map((row) => {
            const mapped = row as Record<string, unknown>
            const presentation = (mapped.presentation as Record<string, unknown>) ?? {}
            const config = (mapped.config as Record<string, unknown>) ?? {}
            return {
                id: mapped.id,
                codename: mapped.codename,
                name: presentation.name ?? {},
                description: presentation.description ?? null,
                sortOrder: config.sortOrder ?? 0,
                parentHubId: typeof config.parentHubId === 'string' ? config.parentHubId : null,
                version: mapped._upl_version ?? 1,
                createdAt: mapped._upl_created_at ?? null,
                updatedAt: mapped._upl_updated_at ?? null
            }
        })

        const total = Number(countResult?.total ?? 0)
        return res.json({
            items,
            pagination: {
                total,
                limit: parsed.limit,
                offset: parsed.offset
            }
        })
    })

    const reorder = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectsService, hubsService, entityTypeService } = createDomainServices(exec, schemaService)

            const parsed = reorderHubsSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const compatibleHubKinds = await resolveLegacyCompatibleKinds(entityTypeService, metahubId, 'hub', userId)
            const existing = await hubsService.findByIdWithKinds(metahubId, parsed.data.hubId, userId, compatibleHubKinds)
            if (!existing) {
                throw new MetahubNotFoundError('hub', parsed.data.hubId)
            }

            const updated = await objectsService.reorderByKind(
                metahubId,
                getStoredHubKind(existing),
                parsed.data.hubId,
                parsed.data.newSortOrder,
                userId
            )
            return res.json({
                id: updated.id,
                sortOrder: updated.config?.sortOrder ?? 0
            })
        },
        { permission: 'editContent' }
    )

    const getById = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { hubId } = req.params
        const { hubsService, entityTypeService } = createDomainServices(exec, schemaService)

        const compatibleHubKinds = await resolveLegacyCompatibleKinds(entityTypeService, metahubId, 'hub', userId)

        const hub = await hubsService.findByIdWithKinds(metahubId, hubId, userId, compatibleHubKinds)

        if (!hub) {
            throw new MetahubNotFoundError('hub', hubId)
        }

        res.json({
            id: hub.id,
            codename: hub.codename,
            name: hub.name,
            description: hub.description,
            sortOrder: hub.sort_order,
            parentHubId: (hub as HubListItemRow).parent_hub_id ?? resolveParentHubId(hub as Record<string, unknown>),
            version: hub._upl_version || 1,
            createdAt: hub.created_at,
            updatedAt: hub.updated_at
        })
    })

    const create = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { hubsService, settingsService, entityTypeService } = createDomainServices(exec, schemaService)

            // Verify metahub exists
            const metahub = await findMetahubById(exec, metahubId)
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const parsed = createHubSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, sortOrder, parentHubId, namePrimaryLocale, descriptionPrimaryLocale, kindKey } = parsed.data

            const [compatibleHubKinds, targetKind] = await Promise.all([
                resolveLegacyCompatibleKinds(entityTypeService, metahubId, 'hub', userId),
                resolveRequestedLegacyCompatibleKind(entityTypeService, metahubId, 'hub', kindKey, userId)
            ])

            const allowHubNesting = await getAllowHubNesting(metahubId, settingsService, userId)
            if (!allowHubNesting && parentHubId) {
                return res.status(400).json({ error: 'Hub nesting is disabled by metahub settings' })
            }

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

            // Check for duplicate codename
            const existing = await hubsService.findByCodenameWithKinds(metahubId, normalizedCodename, userId, [targetKind])
            if (existing) {
                return res.status(409).json({ error: 'Hub with this codename already exists' })
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

            const codenamePayload = syncOptionalCodenamePayloadText(codename, namePrimaryLocale ?? 'en', normalizedCodename)

            const parentValidation = await validateHubParentRelation({
                metahubId,
                hubId: 'new-hub',
                parentHubId: parentHubId ?? null,
                schemaService,
                userId,
                hubKinds: compatibleHubKinds
            })
            if (!parentValidation.ok) {
                return res.status(400).json({ error: parentValidation.message })
            }

            let saved
            try {
                saved = await hubsService.create(
                    metahubId,
                    {
                        codename: codenamePayload ?? normalizedCodename,
                        name: nameVlc as unknown as Record<string, unknown>,
                        description: descriptionVlc as unknown as Record<string, unknown> | undefined,
                        sortOrder,
                        parentHubId: parentHubId ?? null,
                        createdBy: userId,
                        kind: targetKind
                    },
                    userId
                )
            } catch (error) {
                if (database.isUniqueViolation(error)) {
                    return res.status(409).json({ error: 'Hub with this codename already exists' })
                }
                throw error
            }

            res.status(201).json({
                id: saved.id,
                codename: saved.codename,
                name: saved.name,
                description: saved.description,
                sortOrder: saved.sort_order,
                parentHubId: (saved as HubListItemRow).parent_hub_id ?? resolveParentHubId(saved as Record<string, unknown>),
                version: saved._upl_version || 1,
                createdAt: saved.created_at,
                updatedAt: saved.updated_at
            })
        },
        { permission: 'editContent' }
    )

    const copy = async (req: Request, res: Response) => {
        const { metahubId, hubId } = req.params
        const exec = getRequestDbExecutor(req, getDbExecutor())
        const dbSession = getRequestDbSession(req)

        const metahub = await findMetahubById(exec, metahubId)
        if (!metahub) {
            res.status(404).json({ error: 'Metahub not found' })
            return
        }

        const userId = resolveUserId(req)
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' })
            return
        }
        await ensureMetahubAccess(exec, userId, metahubId, 'editContent', dbSession)

        const schemaService = new MetahubSchemaService(exec)
        const { hubsService, settingsService, entityTypeService } = createDomainServices(exec, schemaService)
        const compatibility = await loadHubCompatibilityContext(entityTypeService, metahubId, userId)

        // Check allowCopy setting
        const allowCopyRow = await settingsService.findByKey(metahubId, 'hubs.allowCopy', userId)
        const allowCopy = allowCopyRow ? (allowCopyRow.value as { _value: boolean })._value !== false : true
        if (!allowCopy) {
            return res.status(403).json({ error: 'Copying hubs is disabled by metahub settings' })
        }

        const sourceHub = await hubsService.findByIdWithKinds(metahubId, hubId, userId, compatibility.hubKinds)
        if (!sourceHub) {
            throw new MetahubNotFoundError('hub', hubId)
        }

        const parsed = copyHubSchema.safeParse(req.body ?? {})
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
        }

        const requestedName = parsed.data.name ? sanitizeLocalizedInput(parsed.data.name) : buildDefaultCopyNameInput(sourceHub.name)
        if (Object.keys(requestedName).length === 0) {
            return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
        }

        const sourceNamePrimary = (sourceHub.name as { _primary?: string } | undefined)?._primary ?? 'en'
        const nameVlc = buildLocalizedContent(requestedName, parsed.data.namePrimaryLocale, sourceNamePrimary)
        if (!nameVlc) {
            return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
        }

        let descriptionVlc: unknown = sourceHub.description ?? null
        if (parsed.data.description !== undefined) {
            const sanitizedDescription = sanitizeLocalizedInput(parsed.data.description)
            if (Object.keys(sanitizedDescription).length > 0) {
                descriptionVlc = buildLocalizedContent(
                    sanitizedDescription,
                    parsed.data.descriptionPrimaryLocale,
                    parsed.data.namePrimaryLocale ?? sourceNamePrimary
                )
            } else {
                descriptionVlc = null
            }
        }

        const {
            style: codenameStyle,
            alphabet: codenameAlphabet,
            allowMixed
        } = await getCodenameSettings(settingsService, metahubId, userId)
        const copySuffix = codenameStyle === 'pascal-case' ? 'Copy' : '-copy'
        const normalizedBaseCodename = normalizeCodenameForStyle(
            parsed.data.codename ? getCodenamePayloadText(parsed.data.codename) : `${getHubCodenameText(sourceHub.codename)}${copySuffix}`,
            codenameStyle,
            codenameAlphabet
        )
        if (!normalizedBaseCodename || !isValidCodenameForStyle(normalizedBaseCodename, codenameStyle, codenameAlphabet, allowMixed)) {
            return res.status(400).json({
                error: 'Validation failed',
                details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
            })
        }

        const copyOptions: HubCopyOptions = normalizeHubCopyOptions({
            copyAllRelations: parsed.data.copyAllRelations,
            copyCatalogRelations: parsed.data.copyCatalogRelations,
            copySetRelations: parsed.data.copySetRelations,
            copyEnumerationRelations: parsed.data.copyEnumerationRelations
        })

        const allowHubNesting = await getAllowHubNesting(metahubId, settingsService, userId)
        const sourceParentHubId = resolveParentHubId(sourceHub as Record<string, unknown>)
        const requestedParentHubId = parsed.data.parentHubId
        const targetParentHubId = allowHubNesting ? (requestedParentHubId !== undefined ? requestedParentHubId : sourceParentHubId) : null

        if (!allowHubNesting && requestedParentHubId) {
            return res.status(400).json({ error: 'Hub nesting is disabled by metahub settings' })
        }

        if (targetParentHubId) {
            const parentMap = await loadHubParentMap({
                metahubId,
                schemaService,
                userId,
                db: exec,
                hubKinds: compatibility.hubKinds
            })
            if (!parentMap.has(targetParentHubId)) {
                return res.status(400).json({ error: 'Parent hub not found' })
            }
        }

        const schemaName = await schemaService.ensureSchema(metahubId, userId)
        const objQt = qSchemaTable(schemaName, '_mhb_objects')

        const createHubCopy = async (codename: string) => {
            return exec.transaction(async (trx: SqlQueryable) => {
                const codenamePayloadForCopy =
                    parsed.data.codename === undefined
                        ? syncCodenamePayloadText(
                              undefined,
                              parsed.data.namePrimaryLocale ?? sourceNamePrimary,
                              codename,
                              codenameStyle,
                              codenameAlphabet
                          )
                        : syncCodenamePayloadText(
                              parsed.data.codename,
                              parsed.data.namePrimaryLocale ?? sourceNamePrimary,
                              codename,
                              codenameStyle,
                              codenameAlphabet
                          )

                const copiedHub = (await hubsService.create(
                    metahubId,
                    {
                        codename: codenamePayloadForCopy ?? codename,
                        name: nameVlc as unknown as Record<string, unknown>,
                        description: (descriptionVlc as unknown as Record<string, unknown> | undefined) ?? undefined,
                        parentHubId: targetParentHubId ?? null,
                        createdBy: userId,
                        kind: getStoredHubKind(sourceHub)
                    },
                    userId,
                    trx
                )) as CopiedHubRow

                const now = new Date()

                const relationKinds: string[] = []
                if (copyOptions.copyCatalogRelations) relationKinds.push(...compatibility.catalogKinds)
                if (copyOptions.copySetRelations) relationKinds.push(...compatibility.setKinds)
                if (copyOptions.copyEnumerationRelations) relationKinds.push(...compatibility.enumerationKinds)

                if (relationKinds.length > 0) {
                    const relatedObjects = await queryMany<{
                        id: string
                        kind: string
                        config?: Record<string, unknown>
                        _upl_version: number
                    }>(
                        trx,
                        `SELECT id, kind, config, _upl_version FROM ${objQt}
                             WHERE kind = ANY($1::text[])
                               AND _upl_deleted = false AND _mhb_deleted = false
                               AND config->'hubs' @> $2::jsonb
                             FOR UPDATE`,
                        [relationKinds, JSON.stringify([hubId])]
                    )

                    const eligibleRelatedObjects = relatedObjects.filter((row) => {
                        const rowConfig = row.config ?? {}
                        // Skip entities that are restricted to exactly one hub.
                        return rowConfig.isSingleHub !== true
                    })

                    for (const row of eligibleRelatedObjects) {
                        const rowConfig = row.config ?? {}
                        const currentHubIds = Array.isArray(rowConfig.hubs)
                            ? rowConfig.hubs.filter((value): value is string => typeof value === 'string')
                            : []

                        if (currentHubIds.includes(copiedHub.id)) {
                            continue
                        }

                        const nextHubIds = Array.from(new Set([...currentHubIds, copiedHub.id]))
                        const updatedRows = await queryMany<{ id: string }>(
                            trx,
                            `UPDATE ${objQt}
                                 SET config = $1, _upl_updated_at = $2, _upl_updated_by = $3, _upl_version = _upl_version + 1
                                 WHERE id = $4 AND _upl_version = $5
                                 RETURNING id`,
                            [JSON.stringify({ ...rowConfig, hubs: nextHubIds }), now, userId ?? null, row.id, row._upl_version]
                        )

                        if (updatedRows.length === 0) {
                            throw new HubCopyConcurrentUpdateError()
                        }
                    }
                }

                return copiedHub
            })
        }

        let copiedHub: CopiedHubRow | null = null
        for (let attempt = 1; attempt <= CODENAME_RETRY_MAX_ATTEMPTS; attempt += 1) {
            const codenameCandidate = buildCodenameAttempt(normalizedBaseCodename, attempt, codenameStyle)
            let shouldTryNextCodename = false

            for (let concurrentRetry = 0; concurrentRetry <= CODENAME_CONCURRENT_RETRIES_PER_ATTEMPT; concurrentRetry += 1) {
                try {
                    copiedHub = await createHubCopy(codenameCandidate)
                    break
                } catch (error) {
                    if (error instanceof HubCopyConcurrentUpdateError) {
                        if (concurrentRetry < CODENAME_CONCURRENT_RETRIES_PER_ATTEMPT) {
                            continue
                        }
                        shouldTryNextCodename = true
                        break
                    }

                    if (database.isUniqueViolation(error)) {
                        const constraint = database.getDbErrorConstraint(error) ?? ''
                        if (constraint === 'idx_mhb_objects_kind_codename_active') {
                            shouldTryNextCodename = true
                            break
                        }
                    }

                    throw error
                }
            }

            if (copiedHub) {
                break
            }
            if (!shouldTryNextCodename) {
                break
            }
        }

        if (!copiedHub) {
            return res.status(409).json({ error: 'Unable to generate unique codename for hub copy' })
        }

        return res.status(201).json({
            id: copiedHub.id,
            codename: copiedHub.codename,
            name: copiedHub.name ?? {},
            description: copiedHub.description ?? null,
            sortOrder: copiedHub.sort_order ?? 0,
            parentHubId: copiedHub.parent_hub_id ?? null,
            version: copiedHub._upl_version || 1,
            createdAt: copiedHub.created_at,
            updatedAt: copiedHub.updated_at
        })
    }

    const update = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { hubId } = req.params
            const { hubsService, settingsService, entityTypeService } = createDomainServices(exec, schemaService)

            const compatibleHubKinds = await resolveLegacyCompatibleKinds(entityTypeService, metahubId, 'hub', userId)

            const hub = await hubsService.findByIdWithKinds(metahubId, hubId, userId, compatibleHubKinds)
            if (!hub) {
                throw new MetahubNotFoundError('hub', hubId)
            }

            const hubKind = getStoredHubKind(hub)

            const parsed = updateHubSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, sortOrder, parentHubId, namePrimaryLocale, descriptionPrimaryLocale, expectedVersion } =
                parsed.data

            const updateData: Record<string, unknown> = {}
            const currentParentHubId = resolveParentHubId(hub as Record<string, unknown>)

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
                if (normalizedCodename !== getHubCodenameText(hub.codename)) {
                    const existing = await hubsService.findByCodenameWithKinds(metahubId, normalizedCodename, userId, [hubKind])
                    if (existing) {
                        return res.status(409).json({ error: 'Hub with this codename already exists' })
                    }
                }
                updateData.codename =
                    syncOptionalCodenamePayloadText(codename, namePrimaryLocale ?? 'en', normalizedCodename) ?? normalizedCodename
            }

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const hubName = hub.name as Record<string, unknown> | undefined
                const primary = namePrimaryLocale ?? (hubName as { _primary?: string })?._primary ?? 'en'
                const nameVlc = buildLocalizedContent(sanitizedName, primary, primary)
                if (nameVlc) {
                    updateData.name = nameVlc
                }
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const hubName = hub.name as Record<string, unknown> | undefined
                    const hubDesc = hub.description as Record<string, unknown> | undefined
                    const primary =
                        descriptionPrimaryLocale ??
                        (hubDesc as { _primary?: string })?._primary ??
                        (hubName as { _primary?: string })?._primary ??
                        namePrimaryLocale ??
                        'en'
                    const descriptionVlc = buildLocalizedContent(sanitizedDescription, primary, primary)
                    if (descriptionVlc) {
                        updateData.description = descriptionVlc
                    }
                } else {
                    updateData.description = null
                }
            }

            if (sortOrder !== undefined) {
                updateData.sortOrder = sortOrder
            }

            if (parentHubId !== undefined) {
                const allowHubNesting = await getAllowHubNesting(metahubId, settingsService, userId)
                if (!allowHubNesting) {
                    const canUnsetExistingParent = currentParentHubId !== null && parentHubId === null
                    const isSameValue = currentParentHubId === parentHubId
                    if (!canUnsetExistingParent && !isSameValue) {
                        return res.status(400).json({ error: 'Hub nesting is disabled by metahub settings' })
                    }
                }

                updateData.parentHubId = parentHubId
            }

            if (expectedVersion !== undefined) {
                updateData.expectedVersion = expectedVersion
            }

            updateData.updatedBy = userId

            let saved: Record<string, unknown>
            if (parentHubId !== undefined) {
                try {
                    saved = await exec.transaction(async (trx: SqlQueryable) => {
                        const relationValidation = await validateHubParentRelation({
                            metahubId,
                            hubId,
                            parentHubId,
                            schemaService,
                            userId,
                            db: trx,
                            hubKinds: compatibleHubKinds
                        })
                        if (!relationValidation.ok) {
                            throw new HubParentRelationValidationError(relationValidation.message)
                        }
                        return hubsService.update(metahubId, hubId, { ...updateData, kind: hubKind }, userId, trx)
                    })
                } catch (error) {
                    if (error instanceof HubParentRelationValidationError) {
                        return res.status(400).json({ error: error.message })
                    }
                    throw error
                }
            } else {
                saved = await hubsService.update(metahubId, hubId, { ...updateData, kind: hubKind }, userId)
            }

            res.json({
                id: saved.id,
                codename: saved.codename,
                name: saved.name,
                description: saved.description,
                sortOrder: saved.sort_order,
                parentHubId: (saved as HubListItemRow).parent_hub_id ?? resolveParentHubId(saved as Record<string, unknown>),
                version: saved._upl_version || 1,
                createdAt: saved.created_at,
                updatedAt: saved.updated_at
            })
        },
        { permission: 'editContent' }
    )

    const getBlockingCatalogs = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { hubId } = req.params
        const { hubsService, entityTypeService } = createDomainServices(exec, schemaService)
        const compatibility = await loadHubCompatibilityContext(entityTypeService, metahubId, userId)

        const hub = await hubsService.findByIdWithKinds(metahubId, hubId, userId, compatibility.hubKinds)
        if (!hub) {
            throw new MetahubNotFoundError('hub', hubId)
        }

        const { blockingCatalogs, blockingSets, blockingEnumerations, blockingChildHubs } = await findBlockingHubObjects({
            metahubId,
            hubId,
            schemaService,
            userId,
            db: exec,
            compatibility
        })
        const totalBlocking = blockingCatalogs.length + blockingSets.length + blockingEnumerations.length + blockingChildHubs.length

        res.json({
            hubId,
            blockingCatalogs,
            blockingSets,
            blockingEnumerations,
            blockingChildHubs,
            totalBlocking,
            canDelete: totalBlocking === 0
        })
    })

    const deleteHub = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { hubId } = req.params
            const { hubsService, settingsService, entityTypeService } = createDomainServices(exec, schemaService)
            const compatibility = await loadHubCompatibilityContext(entityTypeService, metahubId, userId)

            const hub = await hubsService.findByIdWithKinds(metahubId, hubId, userId, compatibility.hubKinds)
            if (!hub) {
                throw new MetahubNotFoundError('hub', hubId)
            }

            // Check allowDelete setting
            const allowDeleteRow = await settingsService.findByKey(metahubId, 'hubs.allowDelete', userId)
            const allowDelete = allowDeleteRow ? (allowDeleteRow.value as { _value: boolean })._value !== false : true
            if (!allowDelete) {
                return res.status(403).json({ error: 'Deleting hubs is disabled by metahub settings' })
            }

            const { blockingCatalogs, blockingSets, blockingEnumerations, blockingChildHubs } = await findBlockingHubObjects({
                metahubId,
                hubId,
                schemaService,
                userId,
                db: exec,
                compatibility
            })
            const totalBlocking = blockingCatalogs.length + blockingSets.length + blockingEnumerations.length + blockingChildHubs.length

            if (totalBlocking > 0) {
                return res.status(409).json({
                    error: 'Cannot delete hub: required objects would become orphaned',
                    blockingCatalogs,
                    blockingSets,
                    blockingEnumerations,
                    blockingChildHubs,
                    totalBlocking
                })
            }

            await removeHubFromObjectAssociations({
                metahubId,
                hubId,
                schemaService,
                userId,
                hubExec: exec,
                compatibility
            })
            await hubsService.delete(metahubId, hubId, userId, getStoredHubKind(hub))
            res.status(204).send()
        },
        { permission: 'deleteContent' }
    )

    return {
        list,
        listChildHubs,
        reorder,
        getById,
        create,
        copy,
        update,
        getBlockingCatalogs,
        delete: deleteHub
    }
}
