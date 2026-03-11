import { Router, Request, Response, RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { Knex } from 'knex'
import { z } from 'zod'
import { validateListQuery } from '../../shared/queryParams'
import { getRequestDbSession, getRequestDbExecutor, type DbExecutor } from '../../../utils'
import { findMetahubById } from '../../../persistence'
import { ensureMetahubAccess } from '../../shared/guards'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo/utils/vlc'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '@universo/utils/validation/codename'
import { database, normalizeHubCopyOptions } from '@universo/utils'
import { MetaEntityKind, type HubCopyOptions } from '@universo/types'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'
import { MetahubSettingsService } from '../../settings/services/MetahubSettingsService'
import {
    getCodenameSettings,
    codenameErrorMessage,
    buildCodenameAttempt,
    CODENAME_RETRY_MAX_ATTEMPTS,
    CODENAME_CONCURRENT_RETRIES_PER_ATTEMPT
} from '../../shared/codenameStyleHelper'
import { KnexClient } from '../../ddl'

type RequestUser = {
    id?: string
    sub?: string
    user_id?: string
    userId?: string
}

type RequestWithUser = Request & { user?: RequestUser }

type HubListItemRow = {
    id: string
    codename: string
    name?: unknown
    description?: unknown
    sort_order?: number
    parent_hub_id?: string | null
    _upl_version?: number
    created_at?: unknown
    updated_at?: unknown
}

type RelatedObjectRow = {
    config?: {
        hubs?: unknown
        isSingleHub?: unknown
    }
}

type CopiedHubRow = HubListItemRow & {
    codenameLocalized?: unknown
    name?: unknown
    description?: unknown
}

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as RequestWithUser).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

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

const resolveParentHubId = (hub: Record<string, unknown> | null | undefined): string | null => {
    if (!hub || typeof hub !== 'object') return null
    const direct = (hub as { parent_hub_id?: unknown }).parent_hub_id
    if (typeof direct === 'string' && direct.length > 0) return direct
    const configParent = (hub as { config?: { parentHubId?: unknown } }).config?.parentHubId
    if (typeof configParent === 'string' && configParent.length > 0) return configParent
    return null
}

// Validation schemas
const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))
const optionalLocalizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))
const localizedCodenameInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))

const createHubSchema = z.object({
    codename: z.string().min(1).max(100),
    codenameInput: localizedCodenameInputSchema.optional(),
    codenamePrimaryLocale: z.string().optional(),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sortOrder: z.number().int().optional(),
    parentHubId: z.string().uuid().nullable().optional()
})

const updateHubSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    codenameInput: localizedCodenameInputSchema.optional(),
    codenamePrimaryLocale: z.string().optional(),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sortOrder: z.number().int().optional(),
    parentHubId: z.string().uuid().nullable().optional(),
    expectedVersion: z.number().int().positive().optional() // For optimistic locking
})

const copyHubSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    codenameInput: localizedCodenameInputSchema.optional(),
    codenamePrimaryLocale: z.string().optional(),
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

const reorderHubsSchema = z.object({
    hubId: z.string().uuid(),
    newSortOrder: z.number().int().min(1)
})

export function createHubsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
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
        const exec = getRequestDbExecutor(req, getDbExecutor())
        const schemaService = new MetahubSchemaService(exec)
        const objectsService = new MetahubObjectsService(schemaService)
        const hubsService = new MetahubHubsService(schemaService)
        const settingsService = new MetahubSettingsService(schemaService)
        return {
            exec,
            schemaService,
            objectsService,
            hubsService,
            settingsService
        }
    }

    type BlockingHubObject = {
        id: string
        name: unknown
        codename: string
    }

    /**
     * Helper function to find objects that would block hub deletion.
     * Returns objects with:
     * - config.hubs containing this hub
     * - config.isRequiredHub=true
     * - exactly one hub association (this hub only)
     */
    const findBlockingHubObjects = async (metahubId: string, hubId: string, schemaService: MetahubSchemaService, userId?: string) => {
        const schemaName = await schemaService.ensureSchema(metahubId, userId)
        const knex = KnexClient.getInstance()

        const objects = await knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .whereIn('kind', [MetaEntityKind.CATALOG, MetaEntityKind.SET, MetaEntityKind.ENUMERATION])
            .whereRaw(`config->'hubs' @> ?::jsonb`, [JSON.stringify([hubId])])
            .whereRaw(`jsonb_typeof(config->'hubs') = 'array'`)
            .whereRaw(`COALESCE((config->>'isRequiredHub')::boolean, false) = true`)
            .whereRaw(`jsonb_array_length(config->'hubs') = 1`)
            .select('id', 'kind', 'codename', 'presentation')

        const blockingCatalogs: BlockingHubObject[] = []
        const blockingSets: BlockingHubObject[] = []
        const blockingEnumerations: BlockingHubObject[] = []
        const blockingChildHubs: BlockingHubObject[] = []

        for (const objectRow of objects as Array<{
            id: string
            kind: string
            codename: string
            presentation?: { name?: unknown }
        }>) {
            const mapped: BlockingHubObject = {
                id: objectRow.id,
                name: objectRow.presentation?.name,
                codename: objectRow.codename
            }

            if (objectRow.kind === MetaEntityKind.CATALOG) {
                blockingCatalogs.push(mapped)
                continue
            }
            if (objectRow.kind === MetaEntityKind.SET) {
                blockingSets.push(mapped)
                continue
            }
            if (objectRow.kind === MetaEntityKind.ENUMERATION) {
                blockingEnumerations.push(mapped)
            }
        }

        const childHubs = (await knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ kind: MetaEntityKind.HUB })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .andWhereRaw(`config->>'parentHubId' = ?`, [hubId])
            .select('id', 'codename', 'presentation')) as Array<{
            id: string
            codename: string
            presentation?: { name?: unknown }
        }>

        for (const childHub of childHubs) {
            blockingChildHubs.push({
                id: childHub.id,
                name: childHub.presentation?.name,
                codename: childHub.codename
            })
        }

        return {
            blockingCatalogs,
            blockingSets,
            blockingEnumerations,
            blockingChildHubs
        }
    }

    const removeHubFromObjectAssociations = async (
        metahubId: string,
        hubId: string,
        schemaService: MetahubSchemaService,
        userId?: string
    ) => {
        const schemaName = await schemaService.ensureSchema(metahubId, userId)
        const knex = KnexClient.getInstance()

        await knex.transaction(async (trx) => {
            const linkedObjects = (await trx
                .withSchema(schemaName)
                .from('_mhb_objects')
                .whereIn('kind', [MetaEntityKind.CATALOG, MetaEntityKind.SET, MetaEntityKind.ENUMERATION])
                .andWhere('_upl_deleted', false)
                .andWhere('_mhb_deleted', false)
                .andWhereRaw(`config->'hubs' @> ?::jsonb`, [JSON.stringify([hubId])])
                .forUpdate()
                .select('id', 'config')) as Array<{ id: string; config?: Record<string, unknown> }>

            if (linkedObjects.length === 0) return

            const now = new Date()
            for (const objectRow of linkedObjects) {
                const currentConfig =
                    objectRow.config && typeof objectRow.config === 'object' ? { ...(objectRow.config as Record<string, unknown>) } : {}

                const currentHubs = Array.isArray(currentConfig.hubs) ? (currentConfig.hubs as unknown[]) : []
                const filteredHubIds = currentHubs.filter((value): value is string => typeof value === 'string' && value !== hubId)

                if (filteredHubIds.length === currentHubs.length) continue

                currentConfig.hubs = filteredHubIds

                await trx
                    .withSchema(schemaName)
                    .from('_mhb_objects')
                    .where({ id: objectRow.id })
                    .update({
                        config: currentConfig,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: knex.raw('_upl_version + 1')
                    })
            }
        })
    }

    const getAllowHubNesting = async (metahubId: string, settingsService: MetahubSettingsService, userId?: string): Promise<boolean> => {
        const row = await settingsService.findByKey(metahubId, 'hubs.allowNesting', userId)
        if (!row) return true
        return (row.value as { _value?: unknown })._value !== false
    }

    const loadHubParentMap = async (
        metahubId: string,
        schemaService: MetahubSchemaService,
        userId?: string,
        runner?: Knex.Transaction
    ): Promise<Map<string, string | null>> => {
        const schemaName = await schemaService.ensureSchema(metahubId, userId)
        const db = runner ?? KnexClient.getInstance()

        const query = db
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ kind: MetaEntityKind.HUB })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .select('id', 'config')

        const rows = (await query) as Array<{ id: string; config?: { parentHubId?: unknown } }>

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
        runner
    }: {
        metahubId: string
        hubId: string
        parentHubId: string | null
        schemaService: MetahubSchemaService
        userId?: string
        runner?: Knex.Transaction
    }): Promise<{ ok: true } | { ok: false; message: string }> => {
        if (!parentHubId) return { ok: true }
        if (parentHubId === hubId) {
            return { ok: false, message: 'Hub cannot be a parent of itself' }
        }

        const parentMap = await loadHubParentMap(metahubId, schemaService, userId, runner)
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

    /**
     * GET /metahub/:metahubId/hubs
     * List all hubs in a metahub (from _mhb_objects with kind='hub')
     */
    router.get(
        '/metahub/:metahubId/hubs',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const { hubsService, objectsService } = services(req)
            const userId = resolveUserId(req)

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

            const { items: hubs, total } = await hubsService.findAll(
                metahubId,
                {
                    limit,
                    offset,
                    sortBy,
                    sortOrder,
                    search
                },
                userId
            )

            // Calculate aggregated items per hub (catalogs + sets + enumerations)
            const [catalogs, sets, enumerations] = await Promise.all([
                objectsService.findAllByKind(metahubId, MetaEntityKind.CATALOG, userId),
                objectsService.findAllByKind(metahubId, MetaEntityKind.SET, userId),
                objectsService.findAllByKind(metahubId, MetaEntityKind.ENUMERATION, userId)
            ])

            const catalogsCountByHub = new Map<string, number>()
            const itemsCountByHub = new Map<string, number>()

            const registerCounts = (rows: RelatedObjectRow[], counter?: Map<string, number>) => {
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
    )

    /**
     * GET /metahub/:metahubId/hub/:hubId/hubs
     * List direct child hubs for a parent hub.
     */
    router.get(
        '/metahub/:metahubId/hub/:hubId/hubs',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { schemaService, hubsService } = services(req)
            const userId = resolveUserId(req)

            const parentHub = await hubsService.findById(metahubId, hubId, userId)
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
            const knex = KnexClient.getInstance()

            const baseQuery = knex
                .withSchema(schemaName)
                .from('_mhb_objects')
                .where({ kind: MetaEntityKind.HUB })
                .andWhere('_upl_deleted', false)
                .andWhere('_mhb_deleted', false)
                .andWhereRaw(`config->>'parentHubId' = ?`, [hubId])

            if (parsed.search) {
                const escapedSearch = `%${parsed.search.replace(/[%_]/g, '\\$&')}%`
                baseQuery.andWhere((qb) => {
                    qb.where('codename', 'ilike', escapedSearch).orWhereRaw(`presentation::text ILIKE ?`, [escapedSearch])
                })
            }

            const countResult = await baseQuery.clone().count('* as total').first<{ total: string | number }>()
            const sortOrder = parsed.sortOrder === 'asc' ? 'asc' : 'desc'
            const applySorting = (query: Knex.QueryBuilder) => {
                if (parsed.sortBy === 'name') {
                    return query.orderByRaw(`presentation->'name'->>'en' ${sortOrder}`)
                }
                if (parsed.sortBy === 'codename') {
                    return query.orderBy('codename', sortOrder)
                }
                if (parsed.sortBy === 'sortOrder') {
                    return query.orderByRaw(`COALESCE((config->>'sortOrder')::int, 0) ${sortOrder}`)
                }
                if (parsed.sortBy === 'created') {
                    return query.orderBy('_upl_created_at', sortOrder)
                }
                return query.orderBy('_upl_updated_at', sortOrder)
            }

            const rows = (await applySorting(baseQuery.clone())
                .orderBy('id', 'asc')
                .offset(parsed.offset)
                .limit(parsed.limit)
                .select('*')) as Array<Record<string, unknown>>

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
    )

    /**
     * PATCH /metahub/:metahubId/hubs/reorder
     * Reorder a hub in metahub list.
     */
    router.patch(
        '/metahub/:metahubId/hubs/reorder',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const { exec, objectsService } = services(req)
            const userId = resolveUserId(req)
            const dbSession = getRequestDbSession(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(exec, userId, metahubId, 'editContent', dbSession)

            const parsed = reorderHubsSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            try {
                const updated = await objectsService.reorderByKind(
                    metahubId,
                    MetaEntityKind.HUB,
                    parsed.data.hubId,
                    parsed.data.newSortOrder,
                    userId
                )
                return res.json({
                    id: updated.id,
                    sortOrder: updated.config?.sortOrder ?? 0
                })
            } catch (error: any) {
                if (error.message === 'hub not found') {
                    return res.status(404).json({ error: 'Hub not found' })
                }
                throw error
            }
        })
    )

    /**
     * GET /metahub/:metahubId/hub/:hubId
     * Get a single hub (from _mhb_objects with kind='hub')
     */
    router.get(
        '/metahub/:metahubId/hub/:hubId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { hubsService } = services(req)
            const userId = resolveUserId(req)

            const hub = await hubsService.findById(metahubId, hubId, userId)

            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
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
    )

    /**
     * POST /metahub/:metahubId/hubs
     * Create a new hub (in _mhb_objects with kind='hub')
     */
    router.post(
        '/metahub/:metahubId/hubs',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const { exec, hubsService, settingsService, schemaService } = services(req)
            const userId = resolveUserId(req)

            // Verify metahub exists
            const metahub = await findMetahubById(exec, metahubId)
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const parsed = createHubSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const {
                codename,
                codenameInput,
                codenamePrimaryLocale,
                name,
                description,
                sortOrder,
                parentHubId,
                namePrimaryLocale,
                descriptionPrimaryLocale
            } = parsed.data

            const allowHubNesting = await getAllowHubNesting(metahubId, settingsService, userId)
            if (!allowHubNesting && parentHubId) {
                return res.status(400).json({ error: 'Hub nesting is disabled by metahub settings' })
            }

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

            // Check for duplicate codename
            const existing = await hubsService.findByCodename(metahubId, normalizedCodename, userId)
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

            const sanitizedCodenameInput = sanitizeLocalizedInput(codenameInput ?? {})
            const codenameLocalizedVlc =
                Object.keys(sanitizedCodenameInput).length > 0
                    ? buildLocalizedContent(sanitizedCodenameInput, codenamePrimaryLocale, namePrimaryLocale ?? 'en')
                    : null

            const parentValidation = await validateHubParentRelation({
                metahubId,
                hubId: 'new-hub',
                parentHubId: parentHubId ?? null,
                schemaService,
                userId
            })
            if (!parentValidation.ok) {
                return res.status(400).json({ error: parentValidation.message })
            }

            let saved
            try {
                saved = await hubsService.create(
                    metahubId,
                    {
                        codename: normalizedCodename,
                        codenameLocalized: (codenameLocalizedVlc as unknown as Record<string, unknown>) ?? null,
                        name: nameVlc as unknown as Record<string, unknown>,
                        description: descriptionVlc as unknown as Record<string, unknown> | undefined,
                        sortOrder,
                        parentHubId: parentHubId ?? null,
                        createdBy: userId
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
                codenameLocalized: saved.codenameLocalized ?? null,
                name: saved.name,
                description: saved.description,
                sortOrder: saved.sort_order,
                parentHubId: (saved as HubListItemRow).parent_hub_id ?? resolveParentHubId(saved as Record<string, unknown>),
                version: saved._upl_version || 1,
                createdAt: saved.created_at,
                updatedAt: saved.updated_at
            })
        })
    )

    /**
     * POST /metahub/:metahubId/hub/:hubId/copy
     * Copy an existing hub with optional relation propagation.
     */
    router.post(
        '/metahub/:metahubId/hub/:hubId/copy',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const dbSession = getRequestDbSession(req)
            const { exec, schemaService, hubsService, settingsService } = services(req)
            const userId = resolveUserId(req)

            const metahub = await findMetahubById(exec, metahubId)
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' })
            }
            await ensureMetahubAccess(exec, userId, metahubId, 'editContent', dbSession)

            // Check allowCopy setting
            const allowCopyRow = await settingsService.findByKey(metahubId, 'hubs.allowCopy', userId)
            const allowCopy = allowCopyRow ? (allowCopyRow.value as { _value: boolean })._value !== false : true
            if (!allowCopy) {
                return res.status(403).json({ error: 'Copying hubs is disabled by metahub settings' })
            }

            const sourceHub = await hubsService.findById(metahubId, hubId, userId)
            if (!sourceHub) {
                return res.status(404).json({ error: 'Hub not found' })
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

            let codenameLocalizedVlc: unknown = sourceHub.codenameLocalized ?? null
            if (parsed.data.codenameInput !== undefined) {
                const sanitizedCodenameInput = sanitizeLocalizedInput(parsed.data.codenameInput)
                codenameLocalizedVlc =
                    Object.keys(sanitizedCodenameInput).length > 0
                        ? buildLocalizedContent(
                              sanitizedCodenameInput,
                              parsed.data.codenamePrimaryLocale,
                              parsed.data.namePrimaryLocale ?? sourceNamePrimary
                          )
                        : null
            }
            const codenamePrimaryLocale = normalizeLocaleCode(
                parsed.data.codenamePrimaryLocale ?? parsed.data.namePrimaryLocale ?? sourceNamePrimary
            )

            const {
                style: codenameStyle,
                alphabet: codenameAlphabet,
                allowMixed
            } = await getCodenameSettings(settingsService, metahubId, userId)
            const copySuffix = codenameStyle === 'pascal-case' ? 'Copy' : '-copy'
            const normalizedBaseCodename = normalizeCodenameForStyle(
                parsed.data.codename ?? `${sourceHub.codename}${copySuffix}`,
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
            const targetParentHubId = allowHubNesting
                ? requestedParentHubId !== undefined
                    ? requestedParentHubId
                    : sourceParentHubId
                : null

            if (!allowHubNesting && requestedParentHubId) {
                return res.status(400).json({ error: 'Hub nesting is disabled by metahub settings' })
            }

            if (targetParentHubId) {
                const parentMap = await loadHubParentMap(metahubId, schemaService, userId)
                if (!parentMap.has(targetParentHubId)) {
                    return res.status(400).json({ error: 'Parent hub not found' })
                }
            }

            const schemaName = await schemaService.ensureSchema(metahubId, userId)
            const knex = KnexClient.getInstance()

            const createHubCopy = async (codename: string) => {
                return knex.transaction(async (trx) => {
                    const codenameLocalizedForCopy =
                        parsed.data.codenameInput === undefined
                            ? buildLocalizedContent({ [codenamePrimaryLocale]: codename }, codenamePrimaryLocale, codenamePrimaryLocale)
                            : codenameLocalizedVlc

                    const copiedHub = (await hubsService.create(
                        metahubId,
                        {
                            codename,
                            codenameLocalized: (codenameLocalizedForCopy as unknown as Record<string, unknown> | null | undefined) ?? null,
                            name: nameVlc as unknown as Record<string, unknown>,
                            description: (descriptionVlc as unknown as Record<string, unknown> | undefined) ?? undefined,
                            parentHubId: targetParentHubId ?? null,
                            createdBy: userId
                        },
                        userId,
                        trx
                    )) as CopiedHubRow

                    const now = new Date()

                    const relationKinds: MetaEntityKind[] = []
                    if (copyOptions.copyCatalogRelations) relationKinds.push(MetaEntityKind.CATALOG)
                    if (copyOptions.copySetRelations) relationKinds.push(MetaEntityKind.SET)
                    if (copyOptions.copyEnumerationRelations) relationKinds.push(MetaEntityKind.ENUMERATION)

                    if (relationKinds.length > 0) {
                        const relatedObjects = (await trx
                            .withSchema(schemaName)
                            .from('_mhb_objects')
                            .whereIn('kind', relationKinds)
                            .andWhere('_upl_deleted', false)
                            .andWhere('_mhb_deleted', false)
                            .andWhereRaw(`config->'hubs' @> ?::jsonb`, [JSON.stringify([hubId])])
                            .forUpdate()
                            .select('id', 'kind', 'config', '_upl_version')) as Array<{
                            id: string
                            kind: MetaEntityKind
                            config?: Record<string, unknown>
                            _upl_version: number
                        }>

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
                            const updatedRows = await trx
                                .withSchema(schemaName)
                                .from('_mhb_objects')
                                .where({ id: row.id, _upl_version: row._upl_version })
                                .update({
                                    config: {
                                        ...rowConfig,
                                        hubs: nextHubIds
                                    },
                                    _upl_updated_at: now,
                                    _upl_updated_by: userId ?? null,
                                    _upl_version: trx.raw('_upl_version + 1')
                                })
                                .returning(['id'])

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
                codenameLocalized: copiedHub.codenameLocalized ?? null,
                name: copiedHub.name ?? {},
                description: copiedHub.description ?? null,
                sortOrder: copiedHub.sort_order ?? 0,
                parentHubId: copiedHub.parent_hub_id ?? null,
                version: copiedHub._upl_version || 1,
                createdAt: copiedHub.created_at,
                updatedAt: copiedHub.updated_at
            })
        })
    )

    /**
     * PATCH /metahub/:metahubId/hub/:hubId
     * Update a hub (in _mhb_objects with kind='hub')
     */
    router.patch(
        '/metahub/:metahubId/hub/:hubId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { hubsService, settingsService, schemaService } = services(req)
            const userId = resolveUserId(req)

            const hub = await hubsService.findById(metahubId, hubId, userId)
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const parsed = updateHubSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const {
                codename,
                codenameInput,
                codenamePrimaryLocale,
                name,
                description,
                sortOrder,
                parentHubId,
                namePrimaryLocale,
                descriptionPrimaryLocale,
                expectedVersion
            } = parsed.data

            const updateData: Record<string, unknown> = {}
            const currentParentHubId = resolveParentHubId(hub as Record<string, unknown>)

            if (codename !== undefined) {
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
                if (normalizedCodename !== hub.codename) {
                    const existing = await hubsService.findByCodename(metahubId, normalizedCodename, userId)
                    if (existing) {
                        return res.status(409).json({ error: 'Hub with this codename already exists' })
                    }
                    updateData.codename = normalizedCodename
                }
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

            if (codenameInput !== undefined) {
                const sanitizedCodenameInput = sanitizeLocalizedInput(codenameInput)
                updateData.codenameLocalized =
                    Object.keys(sanitizedCodenameInput).length > 0
                        ? (buildLocalizedContent(
                              sanitizedCodenameInput,
                              codenamePrimaryLocale,
                              namePrimaryLocale ?? 'en'
                          ) as unknown as Record<string, unknown>)
                        : null
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
                const knex = KnexClient.getInstance()
                try {
                    saved = await knex.transaction(async (trx) => {
                        const relationValidation = await validateHubParentRelation({
                            metahubId,
                            hubId,
                            parentHubId,
                            schemaService,
                            userId,
                            runner: trx
                        })
                        if (!relationValidation.ok) {
                            throw new HubParentRelationValidationError(relationValidation.message)
                        }
                        return hubsService.update(metahubId, hubId, updateData, userId, trx)
                    })
                } catch (error) {
                    if (error instanceof HubParentRelationValidationError) {
                        return res.status(400).json({ error: error.message })
                    }
                    throw error
                }
            } else {
                saved = await hubsService.update(metahubId, hubId, updateData, userId)
            }

            res.json({
                id: saved.id,
                codename: saved.codename,
                codenameLocalized: saved.codenameLocalized ?? null,
                name: saved.name,
                description: saved.description,
                sortOrder: saved.sort_order,
                parentHubId: (saved as HubListItemRow).parent_hub_id ?? resolveParentHubId(saved as Record<string, unknown>),
                version: saved._upl_version || 1,
                createdAt: saved.created_at,
                updatedAt: saved.updated_at
            })
        })
    )

    /**
     * GET /metahub/:metahubId/hub/:hubId/blocking-catalogs
     * Get objects that would block this hub's deletion:
     * - catalogs with isRequiredHub=true and only this hub
     * - enumerations with isRequiredHub=true and only this hub
     */
    router.get(
        '/metahub/:metahubId/hub/:hubId/blocking-catalogs',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { hubsService, schemaService } = services(req)
            const userId = resolveUserId(req)

            const hub = await hubsService.findById(metahubId, hubId, userId)
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const { blockingCatalogs, blockingSets, blockingEnumerations, blockingChildHubs } = await findBlockingHubObjects(
                metahubId,
                hubId,
                schemaService,
                userId
            )
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
    )

    /**
     * DELETE /metahub/:metahubId/hub/:hubId
     * Delete a hub (blocked if required catalog/enumeration objects would become orphaned)
     */
    router.delete(
        '/metahub/:metahubId/hub/:hubId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { hubsService, schemaService, settingsService } = services(req)
            const userId = resolveUserId(req)

            const hub = await hubsService.findById(metahubId, hubId, userId)
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            // Check allowDelete setting
            const allowDeleteRow = await settingsService.findByKey(metahubId, 'hubs.allowDelete', userId)
            const allowDelete = allowDeleteRow ? (allowDeleteRow.value as { _value: boolean })._value !== false : true
            if (!allowDelete) {
                return res.status(403).json({ error: 'Deleting hubs is disabled by metahub settings' })
            }

            const { blockingCatalogs, blockingSets, blockingEnumerations, blockingChildHubs } = await findBlockingHubObjects(
                metahubId,
                hubId,
                schemaService,
                userId
            )
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

            await removeHubFromObjectAssociations(metahubId, hubId, schemaService, userId)
            await hubsService.delete(metahubId, hubId, userId)
            res.status(204).send()
        })
    )

    return router
}
