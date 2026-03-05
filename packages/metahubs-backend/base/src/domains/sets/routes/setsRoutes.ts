import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, type QueryRunner } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { Metahub } from '../../../database/entities/Metahub'
import { z } from 'zod'
import { validateListQuery } from '../../shared/queryParams'
import { getRequestManager } from '../../../utils'
import { ensureMetahubAccess } from '../../shared/guards'
import { localizedContent, validation, OptimisticLockError } from '@universo/utils'
import { type SetCopyOptions, MetaEntityKind } from '@universo/types'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'
import { MetahubConstantsService } from '../../metahubs/services/MetahubConstantsService'
import { MetahubSettingsService } from '../../settings/services/MetahubSettingsService'
import { KnexClient } from '../../ddl'
import {
    getCodenameSettings,
    codenameErrorMessage,
    buildCodenameAttempt,
    CODENAME_RETRY_MAX_ATTEMPTS
} from '../../shared/codenameStyleHelper'

const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
const { normalizeSetCopyOptions, normalizeCodenameForStyle, isValidCodenameForStyle } = validation

type RequestUser = {
    id?: string
    sub?: string
    user_id?: string
    userId?: string
}

type RequestWithUser = Request & { user?: RequestUser }
type RequestWithDbContext = Request & { dbContext?: { queryRunner?: QueryRunner } }

type HubSummaryRow = {
    id: string
    name: unknown
    codename: string
}

type SetObjectRow = {
    id: string
    kind?: string
    codename: string
    presentation?: {
        codename?: unknown
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

type SetListItemRow = {
    id: string
    metahubId: string
    codename: string
    codenameLocalized: unknown
    name: unknown
    description: unknown
    isSingleHub: boolean
    isRequiredHub: boolean
    sortOrder: number
    version: number
    createdAt: unknown
    updatedAt: unknown
    constantsCount: number
    hubs: HubSummaryRow[]
}

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as RequestWithUser).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

const getRequestQueryRunner = (req: Request): QueryRunner | undefined => {
    return (req as RequestWithDbContext).dbContext?.queryRunner
}

const mapHubSummary = (hub: Record<string, unknown>): HubSummaryRow => ({
    id: String(hub.id),
    name: hub.name,
    codename: String(hub.codename)
})

const isSetObject = (row: SetObjectRow | null | undefined): row is SetObjectRow => {
    if (!row) return false
    return row.kind === MetaEntityKind.SET
}

const getSetHubIds = (row: SetObjectRow): string[] => {
    const rawHubs = row.config?.hubs
    if (!Array.isArray(rawHubs)) return []
    return rawHubs.filter((hubId): hubId is string => typeof hubId === 'string')
}

const mapSetListItem = (row: SetObjectRow, metahubId: string, constantsCount: number): SetListItemRow => ({
    id: row.id,
    metahubId,
    codename: row.codename,
    codenameLocalized: row.presentation?.codename ?? null,
    name: row.presentation?.name || {},
    description: row.presentation?.description || {},
    isSingleHub: row.config?.isSingleHub || false,
    isRequiredHub: row.config?.isRequiredHub || false,
    sortOrder: row.config?.sortOrder || 0,
    version: row._upl_version || 1,
    createdAt: row._upl_created_at,
    updatedAt: row._upl_updated_at,
    constantsCount,
    hubs: []
})

const getLocalizedCandidates = (value: unknown): string[] => {
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

const getLocalizedSortValue = (value: unknown, fallback: string): string => {
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

const toTimestamp = (value: unknown): number => {
    if (value instanceof Date) return value.getTime()
    if (typeof value === 'string' || typeof value === 'number') {
        const timestamp = new Date(value).getTime()
        return Number.isNaN(timestamp) ? 0 : timestamp
    }
    return 0
}

const matchesSetSearch = (codename: string, name: unknown, searchLower: string): boolean =>
    codename.toLowerCase().includes(searchLower) ||
    getLocalizedCandidates(name).some((candidate) => candidate.toLowerCase().includes(searchLower))

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

const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))
const optionalLocalizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))
const localizedCodenameInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))

const buildCodenameLocalizedVlc = (codenameInput: unknown, primaryLocale?: string, fallbackPrimary = 'en'): unknown => {
    if (codenameInput === undefined) return undefined
    const codenameRecord: Record<string, string | undefined> =
        typeof codenameInput === 'string' ? { en: codenameInput } : (codenameInput as Record<string, string | undefined>)
    const sanitizedCodename = sanitizeLocalizedInput(codenameRecord)
    if (Object.keys(sanitizedCodename).length === 0) return null
    return buildLocalizedContent(sanitizedCodename, primaryLocale, fallbackPrimary)
}

const createSetSchema = z.object({
    codename: z.string().min(1).max(100),
    codenameInput: localizedCodenameInputSchema.optional(),
    codenamePrimaryLocale: z.string().optional(),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isSingleHub: z.boolean().optional(),
    isRequiredHub: z.boolean().optional(),
    hubIds: z.array(z.string().uuid()).optional()
})

const updateSetSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    codenameInput: localizedCodenameInputSchema.optional(),
    codenamePrimaryLocale: z.string().optional(),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isSingleHub: z.boolean().optional(),
    isRequiredHub: z.boolean().optional(),
    hubIds: z.array(z.string().uuid()).optional(),
    expectedVersion: z.number().int().positive().optional()
})

const copySetSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    codenameInput: localizedCodenameInputSchema.optional(),
    codenamePrimaryLocale: z.string().optional(),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    copyConstants: z.boolean().optional()
})

const reorderSetsSchema = z.object({
    setId: z.string().uuid(),
    newSortOrder: z.number().int().min(1)
})

const compareSetTieBreak = (a: SetListItemRow, b: SetListItemRow): number => {
    const bySortOrder = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    if (bySortOrder !== 0) return bySortOrder

    const byCodename = a.codename.localeCompare(b.codename)
    if (byCodename !== 0) return byCodename

    return a.id.localeCompare(b.id)
}

const compareSetItems = (a: SetListItemRow, b: SetListItemRow, sortBy: string, sortOrder: 'asc' | 'desc'): number => {
    if (sortBy === 'name') {
        const valueA = getLocalizedSortValue(a.name, a.codename).toLowerCase()
        const valueB = getLocalizedSortValue(b.name, b.codename).toLowerCase()
        if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1
        if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1
        return compareSetTieBreak(a, b)
    }

    if (sortBy === 'created') {
        const createdDiff = toTimestamp(a.createdAt) - toTimestamp(b.createdAt)
        if (createdDiff !== 0) return sortOrder === 'asc' ? createdDiff : -createdDiff
        return compareSetTieBreak(a, b)
    }

    if (sortBy === 'updated') {
        const updatedDiff = toTimestamp(a.updatedAt) - toTimestamp(b.updatedAt)
        if (updatedDiff !== 0) return sortOrder === 'asc' ? updatedDiff : -updatedDiff
        return compareSetTieBreak(a, b)
    }

    if (sortBy === 'codename') {
        const codenameDiff = a.codename.localeCompare(b.codename)
        if (codenameDiff !== 0) return sortOrder === 'asc' ? codenameDiff : -codenameDiff
        return compareSetTieBreak(a, b)
    }

    if (sortBy === 'sortOrder') {
        const orderDiff = a.sortOrder - b.sortOrder
        if (orderDiff !== 0) return sortOrder === 'asc' ? orderDiff : -orderDiff
        return compareSetTieBreak(a, b)
    }

    return compareSetTieBreak(a, b)
}

const DEFAULT_PRIMARY_LOCALE = 'en'

const validateHubConstraints = (hubIds: string[], isSingleHub: boolean, isRequiredHub: boolean): string | null => {
    if (isSingleHub && hubIds.length > 1) {
        return 'Set with isSingleHub=true cannot be linked to multiple hubs'
    }
    if (isRequiredHub && hubIds.length === 0) {
        return 'Set with isRequiredHub=true must be linked to at least one hub'
    }
    return null
}

const isUniqueViolation = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false
    const code = (error as { code?: unknown }).code
    if (code === '23505') return true
    const message = (error as { message?: unknown }).message
    return typeof message === 'string' && message.toLowerCase().includes('duplicate key value')
}

const resolveUniqueSetCodename = async (params: {
    metahubId: string
    baseCodename: string
    codenameStyle: 'kebab-case' | 'pascal-case'
    objectsService: MetahubObjectsService
    userId: string
    excludeSetId?: string
}): Promise<string | null> => {
    const { metahubId, baseCodename, codenameStyle, objectsService, userId, excludeSetId } = params
    for (let attempt = 1; attempt <= CODENAME_RETRY_MAX_ATTEMPTS; attempt += 1) {
        const candidate = buildCodenameAttempt(baseCodename, attempt, codenameStyle)
        const existing = await objectsService.findByCodenameAndKind(metahubId, candidate, 'set', userId)
        if (!existing || (excludeSetId && existing.id === excludeSetId)) {
            return candidate
        }
    }
    return null
}

export function createSetsRoutes(
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
            metahubRepo: manager.getRepository(Metahub),
            schemaService,
            hubsService: new MetahubHubsService(schemaService),
            objectsService: new MetahubObjectsService(schemaService),
            constantsService: new MetahubConstantsService(schemaService),
            settingsService: new MetahubSettingsService(schemaService)
        }
    }

    const enrichSetItemsWithHubs = async (
        metahubId: string,
        items: SetListItemRow[],
        hubsService: MetahubHubsService,
        userId?: string
    ): Promise<SetListItemRow[]> => {
        const uniqueHubIds = Array.from(new Set(items.flatMap((item) => item.hubs.map((hub) => hub.id))))
        if (uniqueHubIds.length === 0) return items

        const hubs = (await hubsService.findByIds(metahubId, uniqueHubIds, userId)) as Record<string, unknown>[]
        const hubById = new Map<string, HubSummaryRow>()
        for (const hub of hubs) {
            hubById.set(String(hub.id), mapHubSummary(hub))
        }

        return items.map((item) => {
            const hubIds = item.hubs.map((hub) => hub.id)
            return {
                ...item,
                hubs: hubIds.map((hubId) => hubById.get(hubId)).filter((hub): hub is HubSummaryRow => Boolean(hub))
            }
        })
    }

    /**
     * GET /metahub/:metahubId/sets
     */
    router.get(
        '/metahub/:metahubId/sets',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const { ds, objectsService, hubsService, constantsService } = services(req)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(ds, userId, metahubId, undefined, getRequestQueryRunner(req))

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

            const rawSets = (await objectsService.findAllByKind(metahubId, 'set', userId)) as SetObjectRow[]
            const setRows = rawSets.filter(isSetObject)
            const setIds = setRows.map((row) => row.id)
            const constantsCounts = await constantsService.countByObjectIds(metahubId, setIds, userId)

            let items = setRows.map((row) => {
                const item = mapSetListItem(row, metahubId, constantsCounts.get(row.id) || 0)
                item.hubs = getSetHubIds(row).map((hubId) => ({ id: hubId, name: null, codename: hubId }))
                return item
            })

            if (search) {
                const searchLower = search.toLowerCase()
                items = items.filter((item) => matchesSetSearch(item.codename, item.name, searchLower))
            }

            items.sort((a, b) => compareSetItems(a, b, sortBy, sortOrder))

            const total = items.length
            const paginatedItems = items.slice(offset, offset + limit)
            const enrichedItems = await enrichSetItemsWithHubs(metahubId, paginatedItems, hubsService, userId)

            res.json({
                items: enrichedItems,
                pagination: {
                    total,
                    limit,
                    offset
                }
            })
        })
    )

    /**
     * GET /metahub/:metahubId/hub/:hubId/sets
     */
    router.get(
        '/metahub/:metahubId/hub/:hubId/sets',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { ds, objectsService, hubsService, constantsService } = services(req)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(ds, userId, metahubId, undefined, getRequestQueryRunner(req))

            const hub = await hubsService.findById(metahubId, hubId, userId)
            if (!hub) return res.status(404).json({ error: 'Hub not found' })

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

            const rawSets = (await objectsService.findAllByKind(metahubId, 'set', userId)) as SetObjectRow[]
            const setRows = rawSets.filter((row) => isSetObject(row) && getSetHubIds(row).includes(hubId))
            const setIds = setRows.map((row) => row.id)
            const constantsCounts = await constantsService.countByObjectIds(metahubId, setIds, userId)

            let items = setRows.map((row) => {
                const item = mapSetListItem(row, metahubId, constantsCounts.get(row.id) || 0)
                item.hubs = getSetHubIds(row).map((id) => ({ id, name: null, codename: id }))
                return item
            })

            if (search) {
                const searchLower = search.toLowerCase()
                items = items.filter((item) => matchesSetSearch(item.codename, item.name, searchLower))
            }

            items.sort((a, b) => compareSetItems(a, b, sortBy, sortOrder))

            const total = items.length
            const paginatedItems = items.slice(offset, offset + limit)
            const enrichedItems = await enrichSetItemsWithHubs(metahubId, paginatedItems, hubsService, userId)

            res.json({
                items: enrichedItems,
                pagination: {
                    total,
                    limit,
                    offset
                }
            })
        })
    )

    /**
     * PATCH /metahub/:metahubId/sets/reorder
     * PATCH /metahub/:metahubId/hub/:hubId/sets/reorder
     * Reorder a set in metahub list.
     */
    router.patch(
        ['/metahub/:metahubId/sets/reorder', '/metahub/:metahubId/hub/:hubId/sets/reorder'],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const { ds, objectsService } = services(req)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(ds, userId, metahubId, 'editContent', getRequestQueryRunner(req))

            const parsed = reorderSetsSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            try {
                const updated = await objectsService.reorderByKind(
                    metahubId,
                    MetaEntityKind.SET,
                    parsed.data.setId,
                    parsed.data.newSortOrder,
                    userId
                )
                return res.json({
                    id: updated.id,
                    sortOrder: updated.config?.sortOrder ?? 0
                })
            } catch (error: any) {
                if (error.message === 'set not found') {
                    return res.status(404).json({ error: 'Set not found' })
                }
                throw error
            }
        })
    )

    const getSetById = async (
        metahubId: string,
        setId: string,
        options: {
            hubId?: string
            userId?: string
            objectsService: MetahubObjectsService
            hubsService: MetahubHubsService
            constantsService: MetahubConstantsService
        }
    ): Promise<SetListItemRow | null> => {
        const { hubId, userId, objectsService, hubsService, constantsService } = options
        const row = (await objectsService.findById(metahubId, setId, userId)) as SetObjectRow | null
        if (!isSetObject(row)) return null

        const hubIds = getSetHubIds(row)
        if (hubId && !hubIds.includes(hubId)) return null

        const constantsCount = await constantsService.countByObjectId(metahubId, setId, userId)
        const item = mapSetListItem(row, metahubId, constantsCount)
        item.hubs = hubIds.map((id) => ({ id, name: null, codename: id }))
        const [enriched] = await enrichSetItemsWithHubs(metahubId, [item], hubsService, userId)
        return enriched ?? null
    }

    /**
     * GET /metahub/:metahubId/set/:setId
     * GET /metahub/:metahubId/hub/:hubId/set/:setId
     */
    router.get(
        ['/metahub/:metahubId/set/:setId', '/metahub/:metahubId/hub/:hubId/set/:setId'],
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, setId, hubId } = req.params
            const { ds, objectsService, hubsService, constantsService } = services(req)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(ds, userId, metahubId, undefined, getRequestQueryRunner(req))

            const setItem = await getSetById(metahubId, setId, {
                hubId,
                userId,
                objectsService,
                hubsService,
                constantsService
            })

            if (!setItem) {
                return res.status(404).json({ error: 'Set not found' })
            }

            res.json(setItem)
        })
    )

    const upsertSet = async (req: Request, res: Response, mode: 'create' | 'update', hubScoped: boolean): Promise<Response | void> => {
        const { metahubId, hubId, setId } = req.params
        const { ds, metahubRepo, objectsService, hubsService, settingsService, constantsService } = services(req)
        const userId = resolveUserId(req)

        if (!userId) return res.status(401).json({ error: 'Unauthorized' })
        await ensureMetahubAccess(ds, userId, metahubId, mode === 'create' ? 'createContent' : 'editContent', getRequestQueryRunner(req))

        const parsed = (mode === 'create' ? createSetSchema : updateSetSchema).safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
        }

        const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
        if (!metahub) {
            return res.status(404).json({ error: 'Metahub not found' })
        }

        if (hubScoped && hubId) {
            const hub = await hubsService.findById(metahubId, hubId, userId)
            if (!hub) return res.status(404).json({ error: 'Hub not found' })
        }

        const {
            style: codenameStyle,
            alphabet: codenameAlphabet,
            allowMixed
        } = await getCodenameSettings(settingsService, metahubId, userId)

        const currentSet =
            mode === 'update' && setId ? ((await objectsService.findById(metahubId, setId, userId)) as SetObjectRow | null) : null

        if (mode === 'update') {
            if (!currentSet || !isSetObject(currentSet)) {
                return res.status(404).json({ error: 'Set not found' })
            }

            if (hubScoped && hubId && !getSetHubIds(currentSet).includes(hubId)) {
                return res.status(404).json({ error: 'Set not found in this hub' })
            }
        }

        const baseCodename = parsed.data.codename ?? currentSet?.codename
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
        if (mode === 'create' || finalCodename !== currentSet?.codename) {
            const resolvedCodename = await resolveUniqueSetCodename({
                metahubId,
                baseCodename: normalizedCodename,
                codenameStyle,
                objectsService,
                userId,
                excludeSetId: currentSet?.id
            })
            if (!resolvedCodename) {
                return res.status(409).json({ error: 'Unable to generate unique codename for set' })
            }
            finalCodename = resolvedCodename
        }

        const codenameLocalizedVlc = buildCodenameLocalizedVlc(
            parsed.data.codenameInput,
            parsed.data.codenamePrimaryLocale,
            DEFAULT_PRIMARY_LOCALE
        )
        const sanitizedName =
            parsed.data.name !== undefined ? sanitizeLocalizedInput(parsed.data.name as Record<string, string | undefined>) : undefined
        const sanitizedDescription =
            parsed.data.description !== undefined
                ? sanitizeLocalizedInput(parsed.data.description as Record<string, string | undefined>)
                : undefined

        const resolvedName =
            sanitizedName !== undefined
                ? buildLocalizedContent(sanitizedName, parsed.data.namePrimaryLocale, DEFAULT_PRIMARY_LOCALE)
                : currentSet?.presentation?.name ||
                  buildLocalizedContent({ [DEFAULT_PRIMARY_LOCALE]: finalCodename }, parsed.data.namePrimaryLocale, DEFAULT_PRIMARY_LOCALE)

        const resolvedDescription =
            sanitizedDescription !== undefined
                ? buildLocalizedContent(sanitizedDescription, parsed.data.descriptionPrimaryLocale, DEFAULT_PRIMARY_LOCALE)
                : currentSet?.presentation?.description

        const currentHubIds = currentSet ? getSetHubIds(currentSet) : []
        let nextHubIds = parsed.data.hubIds ?? currentHubIds
        if (hubScoped && hubId) {
            if (!nextHubIds.includes(hubId)) {
                nextHubIds = [...nextHubIds, hubId]
            }
        }

        const isSingleHub = parsed.data.isSingleHub ?? currentSet?.config?.isSingleHub ?? false
        const isRequiredHub = parsed.data.isRequiredHub ?? currentSet?.config?.isRequiredHub ?? false
        const hubError = validateHubConstraints(nextHubIds, isSingleHub, isRequiredHub)
        if (hubError) {
            return res.status(400).json({ error: hubError })
        }

        if (mode === 'create') {
            let created: SetObjectRow
            try {
                created = (await objectsService.createSet(
                    metahubId,
                    {
                        codename: finalCodename,
                        codenameLocalized: codenameLocalizedVlc,
                        name: resolvedName,
                        description: resolvedDescription,
                        config: {
                            hubs: nextHubIds,
                            isSingleHub,
                            isRequiredHub,
                            ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {})
                        },
                        createdBy: userId
                    },
                    userId
                )) as SetObjectRow
            } catch (error) {
                if (isUniqueViolation(error)) {
                    return res.status(409).json({ error: 'Set with this codename already exists in this metahub' })
                }
                throw error
            }

            const createdItem = await getSetById(metahubId, created.id, {
                userId,
                objectsService,
                hubsService,
                constantsService
            })
            return res.status(201).json(createdItem)
        }

        const expectedVersion = mode === 'update' ? (parsed.data as z.infer<typeof updateSetSchema>).expectedVersion : undefined

        let updated: SetObjectRow | null
        try {
            updated = (await objectsService.updateSet(
                metahubId,
                setId,
                {
                    codename: finalCodename,
                    codenameLocalized: codenameLocalizedVlc,
                    name: resolvedName,
                    description: resolvedDescription,
                    config: {
                        hubs: nextHubIds,
                        isSingleHub,
                        isRequiredHub,
                        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {})
                    },
                    expectedVersion,
                    updatedBy: userId
                },
                userId
            )) as SetObjectRow | null
        } catch (error) {
            if (isUniqueViolation(error)) {
                return res.status(409).json({ error: 'Set with this codename already exists in this metahub' })
            }
            throw error
        }

        if (!updated) {
            return res.status(404).json({ error: 'Set not found' })
        }

        const updatedItem = await getSetById(metahubId, updated.id, {
            userId,
            objectsService,
            hubsService,
            constantsService
        })

        res.json(updatedItem)
    }

    router.post(
        ['/metahub/:metahubId/sets', '/metahub/:metahubId/hub/:hubId/sets'],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => upsertSet(req, res, 'create', Boolean(req.params.hubId)))
    )

    router.patch(
        ['/metahub/:metahubId/set/:setId', '/metahub/:metahubId/hub/:hubId/set/:setId'],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => upsertSet(req, res, 'update', Boolean(req.params.hubId)))
    )

    /**
     * POST /metahub/:metahubId/set/:setId/copy
     */
    router.post(
        '/metahub/:metahubId/set/:setId/copy',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, setId } = req.params
            const { ds, metahubRepo, objectsService, hubsService, constantsService, settingsService } = services(req)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(ds, userId, metahubId, 'createContent', getRequestQueryRunner(req))

            const sourceSet = (await objectsService.findById(metahubId, setId, userId)) as SetObjectRow | null
            if (!isSetObject(sourceSet)) {
                return res.status(404).json({ error: 'Set not found' })
            }

            const parsed = copySetSchema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const {
                style: codenameStyle,
                alphabet: codenameAlphabet,
                allowMixed
            } = await getCodenameSettings(settingsService, metahubId, userId)

            const copySuffix = codenameStyle === 'kebab-case' ? '-copy' : 'Copy'
            const normalizedBaseCodename = normalizeCodenameForStyle(
                parsed.data.codename ?? `${sourceSet.codename}${copySuffix}`,
                codenameStyle,
                codenameAlphabet
            )
            if (!normalizedBaseCodename || !isValidCodenameForStyle(normalizedBaseCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
                })
            }

            const codename = await resolveUniqueSetCodename({
                metahubId,
                baseCodename: normalizedBaseCodename,
                codenameStyle,
                objectsService,
                userId
            })
            if (!codename) {
                return res.status(409).json({ error: 'Unable to generate unique codename for set copy' })
            }

            const copyOptions: SetCopyOptions = normalizeSetCopyOptions({
                copyConstants: parsed.data.copyConstants
            })

            const codenameLocalizedVlc = buildCodenameLocalizedVlc(
                parsed.data.codenameInput,
                parsed.data.codenamePrimaryLocale,
                DEFAULT_PRIMARY_LOCALE
            )

            const nameInput = parsed.data.name ?? buildDefaultCopyNameInput(sourceSet.presentation?.name)
            const descriptionInput = parsed.data.description

            const sanitizedName = sanitizeLocalizedInput(nameInput as Record<string, string | undefined>)
            const nameVlc =
                Object.keys(sanitizedName).length > 0
                    ? buildLocalizedContent(sanitizedName, parsed.data.namePrimaryLocale, DEFAULT_PRIMARY_LOCALE)
                    : buildLocalizedContent(
                          { [DEFAULT_PRIMARY_LOCALE]: `${sourceSet.codename} (copy)` },
                          parsed.data.namePrimaryLocale,
                          DEFAULT_PRIMARY_LOCALE
                      )

            const sanitizedDescription = descriptionInput
                ? sanitizeLocalizedInput(descriptionInput as Record<string, string | undefined>)
                : null
            const descriptionVlc =
                sanitizedDescription && Object.keys(sanitizedDescription).length > 0
                    ? buildLocalizedContent(sanitizedDescription, parsed.data.descriptionPrimaryLocale, DEFAULT_PRIMARY_LOCALE)
                    : sourceSet.presentation?.description

            const sourceConfig = sourceSet.config ?? {}
            const sourceHubIds = Array.isArray(sourceConfig.hubs)
                ? sourceConfig.hubs.filter((value: unknown): value is string => typeof value === 'string')
                : []

            const sourceConstants = copyOptions.copyConstants ? await constantsService.findAll(metahubId, setId, userId) : []

            let copiedConstants = 0
            let createdSetId: string | null = null
            try {
                await KnexClient.getInstance().transaction(async (trx) => {
                    const createdSet = (await objectsService.createSet(
                        metahubId,
                        {
                            codename,
                            codenameLocalized: codenameLocalizedVlc,
                            name: nameVlc,
                            description: descriptionVlc,
                            config: {
                                ...sourceConfig,
                                sortOrder: undefined,
                                hubs: sourceHubIds
                            },
                            createdBy: userId
                        },
                        userId,
                        trx
                    )) as SetObjectRow
                    createdSetId = createdSet.id

                    if (copyOptions.copyConstants) {
                        for (const sourceConstant of sourceConstants) {
                            const constantCodename = await constantsService.ensureUniqueCodenameWithRetries({
                                metahubId,
                                setId: createdSet.id,
                                desiredCodename: String(sourceConstant.codename),
                                codenameStyle,
                                userId,
                                trx
                            })
                            await constantsService.create(
                                metahubId,
                                {
                                    setId: createdSet.id,
                                    codename: constantCodename,
                                    dataType: sourceConstant.dataType,
                                    name: sourceConstant.name,
                                    codenameLocalized: sourceConstant.codenameLocalized ?? undefined,
                                    validationRules: sourceConstant.validationRules,
                                    uiConfig: sourceConstant.uiConfig,
                                    value: sourceConstant.value,
                                    sortOrder: sourceConstant.sortOrder,
                                    createdBy: userId
                                },
                                userId,
                                trx
                            )
                            copiedConstants += 1
                        }
                    }
                })
            } catch (error) {
                if (isUniqueViolation(error)) {
                    return res.status(409).json({ error: 'Set with this codename already exists in this metahub' })
                }
                throw error
            }

            if (!createdSetId) {
                return res.status(500).json({ error: 'Failed to copy set' })
            }

            const copiedSet = await getSetById(metahubId, createdSetId, {
                userId,
                objectsService,
                hubsService,
                constantsService
            })
            if (!copiedSet) {
                return res.status(404).json({ error: 'Set not found' })
            }

            res.status(201).json({
                ...copiedSet,
                copy: {
                    constantsCopied: copiedConstants
                }
            })
        })
    )

    const getBlockingReferences = async (metahubId: string, setId: string, constantsService: MetahubConstantsService, userId?: string) =>
        constantsService.findSetReferenceBlockers(metahubId, setId, userId)

    /**
     * GET /metahub/:metahubId/set/:setId/blocking-references
     */
    router.get(
        '/metahub/:metahubId/set/:setId/blocking-references',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, setId } = req.params
            const { ds, objectsService, constantsService } = services(req)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(ds, userId, metahubId, undefined, getRequestQueryRunner(req))

            const existing = (await objectsService.findById(metahubId, setId, userId)) as SetObjectRow | null
            if (!isSetObject(existing)) {
                return res.status(404).json({ error: 'Set not found' })
            }

            const blockers = await getBlockingReferences(metahubId, setId, constantsService, userId)
            res.json({
                setId,
                blockingReferences: blockers,
                canDelete: blockers.length === 0
            })
        })
    )

    const hardDeleteSet = async (
        metahubId: string,
        setId: string,
        userId: string,
        objectsService: MetahubObjectsService,
        constantsService: MetahubConstantsService
    ): Promise<{ status: number; payload?: Record<string, unknown> }> => {
        const blockers = await getBlockingReferences(metahubId, setId, constantsService, userId)
        if (blockers.length > 0) {
            return {
                status: 409,
                payload: {
                    error: 'Cannot delete set because there are blocking references',
                    code: 'SET_DELETE_BLOCKED_BY_REFERENCES',
                    setId,
                    blockingReferences: blockers
                }
            }
        }

        await objectsService.delete(metahubId, setId, userId)
        return { status: 204 }
    }

    /**
     * DELETE /metahub/:metahubId/set/:setId
     * DELETE /metahub/:metahubId/hub/:hubId/set/:setId
     */
    router.delete(
        ['/metahub/:metahubId/set/:setId', '/metahub/:metahubId/hub/:hubId/set/:setId'],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, setId, hubId } = req.params
            const { ds, objectsService, constantsService } = services(req)
            const userId = resolveUserId(req)
            const forceDelete = req.query.force === 'true'

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(ds, userId, metahubId, 'deleteContent', getRequestQueryRunner(req))

            const setRow = (await objectsService.findById(metahubId, setId, userId)) as SetObjectRow | null
            if (!isSetObject(setRow)) {
                return res.status(404).json({ error: 'Set not found' })
            }

            const hubIds = getSetHubIds(setRow)
            if (hubId) {
                if (!hubIds.includes(hubId)) {
                    return res.status(404).json({ error: 'Set not found in this hub' })
                }

                if (!forceDelete && hubIds.length > 1) {
                    const nextHubIds = hubIds.filter((id) => id !== hubId)
                    const expectedVersion = typeof setRow._upl_version === 'number' ? setRow._upl_version : 1
                    try {
                        await objectsService.updateSet(
                            metahubId,
                            setId,
                            {
                                config: {
                                    ...(setRow.config ?? {}),
                                    hubs: nextHubIds
                                },
                                expectedVersion,
                                updatedBy: userId
                            },
                            userId
                        )
                    } catch (error) {
                        if (error instanceof OptimisticLockError) {
                            return res.status(409).json({
                                error: error.message,
                                code: error.code,
                                conflict: error.conflict
                            })
                        }
                        throw error
                    }

                    return res.status(200).json({
                        message: 'Set was removed from the selected hub but kept in other hubs',
                        remainingHubs: nextHubIds.length
                    })
                }
            }

            const result = await hardDeleteSet(metahubId, setId, userId, objectsService, constantsService)
            if (result.status === 204) {
                return res.status(204).send()
            }
            return res.status(result.status).json(result.payload)
        })
    )

    return router
}
