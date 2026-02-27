import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, type QueryRunner } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { Metahub } from '../../../database/entities/Metahub'
import { z } from 'zod'
import { validateListQuery } from '../../shared/queryParams'
import { getRequestManager } from '../../../utils'
import { ensureMetahubAccess } from '../../shared/guards'
import { localizedContent, validation } from '@universo/utils'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubEnumerationValuesService } from '../../metahubs/services/MetahubEnumerationValuesService'
import { type EnumerationCopyOptions, MetaEntityKind } from '@universo/types'
import { KnexClient } from '../../ddl'

const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
const { normalizeCodename, isValidCodename, normalizeEnumerationCopyOptions } = validation

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

type EnumerationObjectRow = {
    id: string
    codename: string
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
    created_at?: unknown
    updated_at?: unknown
    _mhb_deleted_at?: unknown
    _mhb_deleted_by?: unknown
}

type EnumerationListItemRow = {
    id: string
    metahubId: string
    codename: string
    name: unknown
    description: unknown
    isSingleHub: boolean
    isRequiredHub: boolean
    sortOrder: number
    valuesCount: number
    version: number
    createdAt: unknown
    updatedAt: unknown
    hubs: HubSummaryRow[]
}

type LocalizedPrimaryCarrier = {
    _primary?: unknown
}

type EnumerationValueRow = {
    codename?: string
    presentation?: unknown
    sort_order?: number
    is_default?: boolean
}

type CopiedEnumerationRow = {
    id: string
    codename: string
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

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as RequestWithUser).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

const getRequestQueryRunner = (req: Request): QueryRunner | undefined => {
    return (req as RequestWithDbContext).dbContext?.queryRunner
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

const buildCodenameAttempt = (baseCodename: string, attempt: number): string => {
    if (attempt <= 1) {
        return baseCodename
    }

    const attemptSuffix = `-${attempt}`
    const maxLength = Math.max(1, 100 - attemptSuffix.length)
    return `${baseCodename.slice(0, maxLength)}${attemptSuffix}`
}

interface UniqueViolationErrorLike {
    code?: string
    constraint?: string
    driverError?: UniqueViolationErrorLike
    cause?: unknown
}

const extractUniqueViolationError = (error: unknown): UniqueViolationErrorLike | null => {
    if (!error || typeof error !== 'object') return null

    const root = error as UniqueViolationErrorLike
    const nestedDriver = root.driverError
    const nestedCause = root.cause && typeof root.cause === 'object' ? (root.cause as UniqueViolationErrorLike) : null
    const nestedCauseDriver = nestedCause?.driverError

    const candidates: Array<UniqueViolationErrorLike | null | undefined> = [root, nestedDriver, nestedCause, nestedCauseDriver]
    for (const candidate of candidates) {
        if (candidate?.code === '23505') return candidate
    }
    return null
}

const respondUniqueViolation = (res: Response, error: unknown, fallbackMessage: string): boolean => {
    const unique = extractUniqueViolationError(error)
    if (!unique) return false

    res.status(409).json({
        error: fallbackMessage,
        code: 'UNIQUE_VIOLATION',
        postgresCode: '23505',
        constraint: unique.constraint ?? null
    })
    return true
}

const findBlockingEnumerationReferences = async (
    metahubId: string,
    enumerationId: string,
    attributesService: MetahubAttributesService,
    userId?: string
) => attributesService.findReferenceBlockersByTarget(metahubId, enumerationId, MetaEntityKind.ENUMERATION, userId)

const findBlockingDefaultValueReferences = async (
    metahubId: string,
    valueId: string,
    attributesService: MetahubAttributesService,
    userId?: string
) => attributesService.findDefaultEnumValueBlockers(metahubId, valueId, userId)

const findBlockingElementValueReferences = async (
    metahubId: string,
    enumerationId: string,
    valueId: string,
    attributesService: MetahubAttributesService,
    userId?: string
) => attributesService.findElementEnumValueBlockers(metahubId, enumerationId, valueId, userId)

const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))
const optionalLocalizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))

const createEnumerationSchema = z.object({
    codename: z.string().min(1).max(100),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isSingleHub: z.boolean().optional(),
    isRequiredHub: z.boolean().optional(),
    hubIds: z.array(z.string().uuid()).optional()
})

const updateEnumerationSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
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

const copyEnumerationSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    copyValues: z.boolean().optional()
})

const createEnumerationValueSchema = z.object({
    codename: z.string().min(1).max(100),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isDefault: z.boolean().optional()
})

const updateEnumerationValueSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isDefault: z.boolean().optional(),
    expectedVersion: z.number().int().positive().optional()
})

const moveEnumerationValueSchema = z.object({
    direction: z.enum(['up', 'down'])
})

const mapHubSummary = (hub: Record<string, unknown>): HubSummaryRow => ({
    id: String(hub.id),
    name: hub.name,
    codename: String(hub.codename)
})

const mapHubSummaries = (hubs: Record<string, unknown>[]): HubSummaryRow[] => hubs.map(mapHubSummary)
const resolveCreatedAt = (row: EnumerationObjectRow): unknown => row._upl_created_at ?? row.created_at ?? null
const resolveUpdatedAt = (row: EnumerationObjectRow): unknown => row._upl_updated_at ?? row.updated_at ?? null

const getEnumerationHubIds = (row: EnumerationObjectRow): string[] => {
    const rawHubs = row.config?.hubs
    if (!Array.isArray(rawHubs)) return []
    return rawHubs.filter((hubId): hubId is string => typeof hubId === 'string')
}

const resolvePrimaryLocale = (value: unknown): string | undefined => {
    if (!value || typeof value !== 'object') return undefined
    const primary = (value as LocalizedPrimaryCarrier)._primary
    return typeof primary === 'string' ? primary : undefined
}

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

const matchesEnumerationSearch = (codename: string, name: unknown, searchLower: string): boolean =>
    codename.toLowerCase().includes(searchLower) ||
    getLocalizedCandidates(name).some((candidate) => candidate.toLowerCase().includes(searchLower))

const mapEnumerationSummary = (row: EnumerationObjectRow, metahubId: string, valuesCount: number): EnumerationListItemRow => ({
    id: row.id,
    metahubId,
    codename: row.codename,
    name: row.presentation?.name || {},
    description: row.presentation?.description || {},
    isSingleHub: row.config?.isSingleHub || false,
    isRequiredHub: row.config?.isRequiredHub || false,
    sortOrder: row.config?.sortOrder || 0,
    valuesCount,
    version: row._upl_version || 1,
    createdAt: resolveCreatedAt(row),
    updatedAt: resolveUpdatedAt(row),
    hubs: []
})

export function createEnumerationsRoutes(
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
        const objectsService = new MetahubObjectsService(schemaService)
        return {
            ds,
            manager,
            metahubRepo: manager.getRepository(Metahub),
            schemaService,
            objectsService,
            hubsService: new MetahubHubsService(schemaService),
            attributesService: new MetahubAttributesService(schemaService),
            valuesService: new MetahubEnumerationValuesService(schemaService)
        }
    }

    router.get(
        '/metahub/:metahubId/enumerations',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId } = req.params
            const { objectsService, hubsService, valuesService } = services(req)
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
            const rawEnumerations = (await objectsService.findAllByKind(
                metahubId,
                MetaEntityKind.ENUMERATION,
                userId
            )) as EnumerationObjectRow[]
            const enumerationIds = rawEnumerations.map((row) => row.id)
            const valuesCounts = await valuesService.countByObjectIds(metahubId, enumerationIds, userId)

            let items = rawEnumerations.map((row) => mapEnumerationSummary(row, metahubId, valuesCounts.get(row.id) || 0))

            if (search) {
                const searchLower = search.toLowerCase()
                items = items.filter((item) => matchesEnumerationSearch(item.codename, item.name, searchLower))
            }

            items.sort((a, b) => {
                const sortField = sortBy as string
                let valA
                let valB
                if (sortField === 'name') {
                    valA = getLocalizedSortValue(a.name, a.codename)
                    valB = getLocalizedSortValue(b.name, b.codename)
                } else if (sortField === 'codename') {
                    valA = a.codename
                    valB = b.codename
                } else if (sortField === 'sortOrder') {
                    valA = a.sortOrder ?? 0
                    valB = b.sortOrder ?? 0
                } else if (sortField === 'updated') {
                    valA = toTimestamp(a.updatedAt)
                    valB = toTimestamp(b.updatedAt)
                } else {
                    valA = toTimestamp(a.createdAt)
                    valB = toTimestamp(b.createdAt)
                }

                if (valA < valB) return sortOrder === 'asc' ? -1 : 1
                if (valA > valB) return sortOrder === 'asc' ? 1 : -1
                return 0
            })

            const total = items.length
            const paginatedItems = items.slice(offset, offset + limit)

            const allHubIds = new Set<string>()
            const hubIdsByEnumeration = new Map<string, string[]>()

            rawEnumerations.forEach((row) => {
                const ids = getEnumerationHubIds(row)
                if (ids.length > 0) {
                    ids.forEach((id) => allHubIds.add(id))
                    hubIdsByEnumeration.set(row.id, ids)
                }
            })

            const hubMap = new Map<string, HubSummaryRow>()
            if (allHubIds.size > 0) {
                const hubs = await hubsService.findByIds(metahubId, Array.from(allHubIds), userId)
                hubs.forEach((hub) => {
                    const summary = mapHubSummary(hub)
                    hubMap.set(summary.id, summary)
                })
            }

            const resultItems = paginatedItems.map((item) => {
                const ids = hubIdsByEnumeration.get(item.id) || []
                const matchedHubs = ids.map((id) => hubMap.get(id)).filter((hub): hub is HubSummaryRow => Boolean(hub))
                return { ...item, hubs: matchedHubs }
            })

            return res.json({ items: resultItems, pagination: { total, limit, offset } })
        })
    )

    router.post(
        '/metahub/:metahubId/enumerations',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId } = req.params
            const { objectsService, hubsService } = services(req)
            const userId = resolveUserId(req)

            const parsed = createEnumerationSchema.safeParse(req.body)
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
                hubIds
            } = parsed.data

            const normalizedCodename = normalizeCodename(codename)
            if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            const existing = await objectsService.findByCodenameAndKind(metahubId, normalizedCodename, MetaEntityKind.ENUMERATION, userId)
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

            const effectiveIsRequired = isRequiredHub ?? false
            const targetHubIds: string[] = hubIds ?? []

            if (effectiveIsRequired && targetHubIds.length === 0) {
                return res.status(400).json({ error: 'Enumeration with required hub flag must have at least one hub association' })
            }
            if ((isSingleHub ?? false) && targetHubIds.length > 1) {
                return res.status(400).json({ error: 'This enumeration is restricted to a single hub' })
            }

            if (targetHubIds.length > 0) {
                const validHubs = await hubsService.findByIds(metahubId, targetHubIds, userId)
                if (validHubs.length !== targetHubIds.length) {
                    return res.status(400).json({ error: 'One or more hub IDs are invalid' })
                }
            }

            let created
            try {
                created = await objectsService.createEnumeration(
                    metahubId,
                    {
                        codename: normalizedCodename,
                        name: nameVlc,
                        description: descriptionVlc,
                        config: {
                            isSingleHub: isSingleHub ?? false,
                            isRequiredHub: effectiveIsRequired,
                            sortOrder,
                            hubs: targetHubIds
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

            const hubs = targetHubIds.length > 0 ? await hubsService.findByIds(metahubId, targetHubIds, userId) : []

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
                hubs: hubs.map(mapHubSummary),
                valuesCount: 0
            })
        })
    )

    /**
     * POST /metahub/:metahubId/enumeration/:enumerationId/copy
     * Copy enumeration with optional values cloning.
     */
    router.post(
        '/metahub/:metahubId/enumeration/:enumerationId/copy',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId } = req.params
            const { ds, metahubRepo, objectsService, hubsService, schemaService } = services(req)
            const userId = resolveUserId(req)
            const rlsRunner = getRequestQueryRunner(req)

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' })
            }
            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }
            await ensureMetahubAccess(ds, userId, metahubId, 'editContent', rlsRunner)

            const sourceEnumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!sourceEnumeration || sourceEnumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const parsed = copyEnumerationSchema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const sourcePresentation = sourceEnumeration.presentation ?? {}
            const sourceConfig = sourceEnumeration.config ?? {}

            const requestedName = parsed.data.name
                ? sanitizeLocalizedInput(parsed.data.name)
                : buildDefaultCopyNameInput(sourcePresentation.name)
            if (Object.keys(requestedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const sourceNamePrimary = sourcePresentation.name?._primary ?? 'en'
            const nameVlc = buildLocalizedContent(requestedName, parsed.data.namePrimaryLocale, sourceNamePrimary)
            if (!nameVlc) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            let descriptionVlc: unknown = sourcePresentation.description ?? null
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

            const normalizedBaseCodename = normalizeCodename(parsed.data.codename ?? `${sourceEnumeration.codename}-copy`)
            if (!normalizedBaseCodename || !isValidCodename(normalizedBaseCodename)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            const copyOptions: EnumerationCopyOptions = normalizeEnumerationCopyOptions({
                copyValues: parsed.data.copyValues
            })

            const schemaName = await schemaService.ensureSchema(metahubId, userId)
            const knex = KnexClient.getInstance()

            const createEnumerationCopy = async (codename: string) => {
                return knex.transaction(async (trx) => {
                    const now = new Date()
                    const sourceHubIds = Array.isArray(sourceConfig.hubs)
                        ? sourceConfig.hubs.filter((value: unknown): value is string => typeof value === 'string')
                        : []

                    const [createdEnumeration] = await trx
                        .withSchema(schemaName)
                        .into('_mhb_objects')
                        .insert({
                            kind: MetaEntityKind.ENUMERATION,
                            codename,
                            table_name: null,
                            presentation: {
                                name: nameVlc,
                                description: descriptionVlc ?? null
                            },
                            config: {
                                ...sourceConfig,
                                hubs: sourceHubIds
                            },
                            _upl_created_at: now,
                            _upl_created_by: userId ?? null,
                            _upl_updated_at: now,
                            _upl_updated_by: userId ?? null
                        })
                        .returning('*')

                    let copiedValuesCount = 0
                    if (copyOptions.copyValues) {
                        const sourceValues = (await trx
                            .withSchema(schemaName)
                            .from('_mhb_values')
                            .where({ object_id: enumerationId })
                            .andWhere('_upl_deleted', false)
                            .andWhere('_mhb_deleted', false)
                            .orderBy('sort_order', 'asc')
                            .orderBy('_upl_created_at', 'asc')
                            .select('codename', 'presentation', 'sort_order', 'is_default')) as EnumerationValueRow[]

                        if (sourceValues.length > 0) {
                            await trx
                                .withSchema(schemaName)
                                .into('_mhb_values')
                                .insert(
                                    sourceValues.map((value) => ({
                                        object_id: createdEnumeration.id,
                                        codename: value.codename,
                                        presentation: value.presentation ?? {},
                                        sort_order: value.sort_order ?? 0,
                                        is_default: value.is_default ?? false,
                                        _upl_created_at: now,
                                        _upl_created_by: userId ?? null,
                                        _upl_updated_at: now,
                                        _upl_updated_by: userId ?? null
                                    }))
                                )
                            copiedValuesCount = sourceValues.length
                        }
                    }

                    return {
                        enumeration: createdEnumeration,
                        copiedValuesCount
                    }
                })
            }

            let copiedResult: { enumeration: CopiedEnumerationRow; copiedValuesCount: number } | null = null

            for (let attempt = 1; attempt <= 1000; attempt += 1) {
                const codenameCandidate = buildCodenameAttempt(normalizedBaseCodename, attempt)
                try {
                    copiedResult = await createEnumerationCopy(codenameCandidate)
                    break
                } catch (error) {
                    const unique = extractUniqueViolationError(error)
                    if (unique?.constraint === 'idx_mhb_objects_kind_codename_active') {
                        continue
                    }
                    throw error
                }
            }

            if (!copiedResult) {
                return res.status(409).json({ error: 'Unable to generate unique codename for enumeration copy' })
            }

            const copiedEnumeration = copiedResult.enumeration
            const copiedConfig = copiedEnumeration.config ?? {}
            const copiedHubIds = Array.isArray(copiedConfig.hubs)
                ? copiedConfig.hubs.filter((value: unknown): value is string => typeof value === 'string')
                : []
            const hubs = copiedHubIds.length > 0 ? await hubsService.findByIds(metahubId, copiedHubIds, userId) : []

            return res.status(201).json({
                id: copiedEnumeration.id,
                metahubId,
                codename: copiedEnumeration.codename,
                name: copiedEnumeration.presentation?.name ?? {},
                description: copiedEnumeration.presentation?.description ?? null,
                isSingleHub: copiedConfig.isSingleHub ?? false,
                isRequiredHub: copiedConfig.isRequiredHub ?? false,
                sortOrder: copiedConfig.sortOrder ?? 0,
                version: copiedEnumeration._upl_version || 1,
                createdAt: copiedEnumeration._upl_created_at,
                updatedAt: copiedEnumeration._upl_updated_at,
                valuesCount: copiedResult.copiedValuesCount,
                hubs: hubs.map(mapHubSummary)
            })
        })
    )

    router.patch(
        '/metahub/:metahubId/enumeration/:enumerationId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId } = req.params
            const { objectsService, hubsService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const parsed = updateEnumerationSchema.safeParse(req.body)
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
                hubIds,
                expectedVersion
            } = parsed.data

            const currentPresentation = enumeration.presentation || {}
            const currentConfig = enumeration.config || {}

            let finalName = currentPresentation.name
            let finalDescription = currentPresentation.description
            let finalCodename = enumeration.codename

            let targetHubIds: string[] = currentConfig.hubs || []
            if (hubIds !== undefined) {
                if ((isSingleHub ?? currentConfig.isSingleHub) && hubIds.length > 1) {
                    return res.status(400).json({ error: 'This enumeration is restricted to a single hub' })
                }
                const effectiveIsRequiredHub = isRequiredHub ?? currentConfig.isRequiredHub
                if (effectiveIsRequiredHub && hubIds.length === 0) {
                    return res.status(400).json({ error: 'This enumeration requires at least one hub association' })
                }
                targetHubIds = hubIds
                if (targetHubIds.length > 0) {
                    const validHubs = await hubsService.findByIds(metahubId, targetHubIds, userId)
                    if (validHubs.length !== targetHubIds.length) {
                        return res.status(400).json({ error: 'One or more hub IDs are invalid' })
                    }
                }
            }

            if (codename !== undefined) {
                const normalizedCodename = normalizeCodename(codename)
                if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                    })
                }
                if (normalizedCodename !== enumeration.codename) {
                    const existing = await objectsService.findByCodenameAndKind(
                        metahubId,
                        normalizedCodename,
                        MetaEntityKind.ENUMERATION,
                        userId
                    )
                    if (existing && existing.id !== enumerationId) {
                        return res.status(409).json({ error: 'Enumeration with this codename already exists in this metahub' })
                    }
                    finalCodename = normalizedCodename
                }
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
                    const descriptionVlc = buildLocalizedContent(sanitizedDescription, primary, primary)
                    if (descriptionVlc) {
                        finalDescription = descriptionVlc
                    }
                } else {
                    finalDescription = undefined
                }
            }

            if (isSingleHub !== undefined && isSingleHub && targetHubIds.length > 1) {
                return res.status(400).json({ error: 'Cannot set single hub mode when enumeration is associated with multiple hubs' })
            }

            if (isRequiredHub !== undefined && isRequiredHub && targetHubIds.length === 0) {
                return res.status(400).json({ error: 'Cannot require hub association when enumeration has no hubs' })
            }

            let updated: EnumerationObjectRow
            try {
                updated = (await objectsService.updateEnumeration(
                    metahubId,
                    enumerationId,
                    {
                        codename: finalCodename !== enumeration.codename ? finalCodename : undefined,
                        name: finalName,
                        description: finalDescription,
                        config: {
                            hubs: targetHubIds,
                            isSingleHub: isSingleHub ?? currentConfig.isSingleHub,
                            isRequiredHub: isRequiredHub ?? currentConfig.isRequiredHub,
                            sortOrder: sortOrder ?? currentConfig.sortOrder
                        },
                        updatedBy: userId,
                        expectedVersion
                    },
                    userId
                )) as EnumerationObjectRow
            } catch (error) {
                if (respondUniqueViolation(res, error, 'Enumeration with this codename already exists in this metahub')) {
                    return
                }
                throw error
            }

            const hubs = targetHubIds.length > 0 ? await hubsService.findByIds(metahubId, targetHubIds, userId) : []

            return res.json({
                id: updated.id,
                metahubId,
                codename: updated.codename,
                name: updated.presentation?.name ?? {},
                description: updated.presentation?.description,
                isSingleHub: updated.config?.isSingleHub ?? false,
                isRequiredHub: updated.config?.isRequiredHub ?? false,
                sortOrder: updated.config?.sortOrder ?? 0,
                version: updated._upl_version || 1,
                createdAt: resolveCreatedAt(updated),
                updatedAt: resolveUpdatedAt(updated),
                hubs: mapHubSummaries(hubs)
            })
        })
    )

    router.get(
        '/metahub/:metahubId/hub/:hubId/enumerations',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, hubId } = req.params
            const { objectsService, hubsService, valuesService } = services(req)
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
            const allEnumerations = await objectsService.findAllByKind(metahubId, MetaEntityKind.ENUMERATION, userId)
            const hubEnumerations = (allEnumerations as EnumerationObjectRow[]).filter((enumeration) =>
                getEnumerationHubIds(enumeration).includes(hubId)
            )

            if (hubEnumerations.length === 0) {
                return res.json({ items: [], pagination: { total: 0, limit, offset } })
            }

            const enumerationIds = hubEnumerations.map((row) => row.id)
            const valuesCounts = await valuesService.countByObjectIds(metahubId, enumerationIds, userId)

            let items = hubEnumerations.map((row) => mapEnumerationSummary(row, metahubId, valuesCounts.get(row.id) || 0))

            if (search) {
                const searchLower = search.toLowerCase()
                items = items.filter((item) => matchesEnumerationSearch(item.codename, item.name, searchLower))
            }

            items.sort((a, b) => {
                const sortField = sortBy as string
                let valA
                let valB
                if (sortField === 'name') {
                    valA = getLocalizedSortValue(a.name, a.codename)
                    valB = getLocalizedSortValue(b.name, b.codename)
                } else if (sortField === 'codename') {
                    valA = a.codename
                    valB = b.codename
                } else if (sortField === 'sortOrder') {
                    valA = a.sortOrder ?? 0
                    valB = b.sortOrder ?? 0
                } else if (sortField === 'updated') {
                    valA = toTimestamp(a.updatedAt)
                    valB = toTimestamp(b.updatedAt)
                } else {
                    valA = toTimestamp(a.createdAt)
                    valB = toTimestamp(b.createdAt)
                }

                if (valA < valB) return sortOrder === 'asc' ? -1 : 1
                if (valA > valB) return sortOrder === 'asc' ? 1 : -1
                return 0
            })

            const total = items.length
            const paginatedItems = items.slice(offset, offset + limit)

            const allHubIds = new Set<string>()
            const hubIdsByEnumeration = new Map<string, string[]>()
            hubEnumerations.forEach((row) => {
                if (paginatedItems.find((item) => item.id === row.id)) {
                    const ids = getEnumerationHubIds(row)
                    if (ids.length > 0) {
                        ids.forEach((id) => allHubIds.add(id))
                        hubIdsByEnumeration.set(row.id, ids)
                    }
                }
            })

            const hubMap = new Map<string, HubSummaryRow>()
            if (allHubIds.size > 0) {
                const hubs = await hubsService.findByIds(metahubId, Array.from(allHubIds), userId)
                hubs.forEach((hub) => {
                    const summary = mapHubSummary(hub)
                    hubMap.set(summary.id, summary)
                })
            }

            const resultItems = paginatedItems.map((item) => {
                const ids = hubIdsByEnumeration.get(item.id) || []
                const matchedHubs = ids.map((id) => hubMap.get(id)).filter((hub): hub is HubSummaryRow => Boolean(hub))
                return { ...item, hubs: matchedHubs }
            })

            return res.json({ items: resultItems, pagination: { total, limit, offset } })
        })
    )

    router.get(
        ['/metahub/:metahubId/hub/:hubId/enumeration/:enumerationId', '/metahub/:metahubId/enumeration/:enumerationId'],
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, hubId, enumerationId } = req.params
            const { objectsService, hubsService, valuesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const currentConfig = enumeration.config || {}
            const currentHubs = currentConfig.hubs || []

            if (hubId && !currentHubs.includes(hubId)) {
                return res.status(404).json({ error: 'Enumeration not found in this hub' })
            }

            const hubs = currentHubs.length > 0 ? await hubsService.findByIds(metahubId, currentHubs, userId) : []
            const valuesCount = await valuesService.countByObjectId(metahubId, enumeration.id, userId)

            return res.json({
                id: enumeration.id,
                metahubId,
                codename: enumeration.codename,
                name: enumeration.presentation.name,
                description: enumeration.presentation.description,
                isSingleHub: currentConfig.isSingleHub,
                isRequiredHub: currentConfig.isRequiredHub,
                sortOrder: currentConfig.sortOrder,
                version: enumeration._upl_version || 1,
                createdAt: resolveCreatedAt(enumeration),
                updatedAt: resolveUpdatedAt(enumeration),
                valuesCount,
                hubs: hubs.map(mapHubSummary)
            })
        })
    )

    router.post(
        '/metahub/:metahubId/hub/:hubId/enumerations',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, hubId } = req.params
            const { objectsService, hubsService } = services(req)
            const userId = resolveUserId(req)

            const hub = await hubsService.findById(metahubId, hubId, userId)
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const parsed = createEnumerationSchema.safeParse(req.body)
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
                hubIds
            } = parsed.data

            const normalizedCodename = normalizeCodename(codename)
            if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            const existing = await objectsService.findByCodenameAndKind(metahubId, normalizedCodename, MetaEntityKind.ENUMERATION, userId)
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

            const effectiveIsRequired = isRequiredHub ?? false
            let targetHubIds = [hubId]
            if (hubIds && Array.isArray(hubIds)) {
                targetHubIds = Array.from(new Set([...hubIds, hubId]))
            }
            if ((isSingleHub ?? false) && targetHubIds.length > 1) {
                return res.status(400).json({ error: 'This enumeration is restricted to a single hub' })
            }

            const validHubs = await hubsService.findByIds(metahubId, targetHubIds, userId)
            if (validHubs.length !== targetHubIds.length) {
                return res.status(400).json({ error: 'One or more hub IDs are invalid' })
            }

            let created
            try {
                created = await objectsService.createEnumeration(
                    metahubId,
                    {
                        codename: normalizedCodename,
                        name: nameVlc,
                        description: descriptionVlc,
                        config: {
                            hubs: targetHubIds,
                            isSingleHub: isSingleHub ?? false,
                            isRequiredHub: effectiveIsRequired,
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

            const hubs = await hubsService.findByIds(metahubId, targetHubIds, userId)

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
                hubs: hubs.map(mapHubSummary),
                valuesCount: 0
            })
        })
    )

    router.patch(
        '/metahub/:metahubId/hub/:hubId/enumeration/:enumerationId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, hubId, enumerationId } = req.params
            const { objectsService, hubsService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const currentHubs = enumeration.config?.hubs || []
            if (!currentHubs.includes(hubId)) {
                return res.status(404).json({ error: 'Enumeration not found in this hub' })
            }

            const parsed = updateEnumerationSchema.safeParse(req.body)
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
                hubIds,
                expectedVersion
            } = parsed.data

            const currentPresentation = enumeration.presentation || {}
            const currentConfig = enumeration.config || {}

            let finalName = currentPresentation.name
            let finalDescription = currentPresentation.description
            let finalCodename = enumeration.codename
            let targetHubIds = currentConfig.hubs || []

            if (hubIds !== undefined) {
                targetHubIds = hubIds

                if ((isSingleHub ?? currentConfig.isSingleHub) && targetHubIds.length > 1) {
                    return res.status(400).json({ error: 'This enumeration is restricted to a single hub' })
                }
                const effectiveIsRequiredHub = isRequiredHub ?? currentConfig.isRequiredHub
                if (effectiveIsRequiredHub && targetHubIds.length === 0) {
                    return res.status(400).json({ error: 'This enumeration requires at least one hub association' })
                }

                if (targetHubIds.length > 0) {
                    const validHubs = await hubsService.findByIds(metahubId, targetHubIds, userId)
                    if (validHubs.length !== targetHubIds.length) {
                        return res.status(400).json({ error: 'One or more hub IDs are invalid' })
                    }
                }
            }

            if (codename !== undefined) {
                const normalizedCodename = normalizeCodename(codename)
                if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                    return res.status(400).json({ error: 'Validation failed', details: { codename: ['Invalid format'] } })
                }
                if (normalizedCodename !== enumeration.codename) {
                    const existing = await objectsService.findByCodenameAndKind(
                        metahubId,
                        normalizedCodename,
                        MetaEntityKind.ENUMERATION,
                        userId
                    )
                    if (existing && existing.id !== enumerationId) {
                        return res.status(409).json({ error: 'Enumeration with this codename already exists' })
                    }
                    finalCodename = normalizedCodename
                }
            }

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? currentPresentation.name?.['_primary'] ?? 'en'
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

            let updated: EnumerationObjectRow
            try {
                updated = (await objectsService.updateEnumeration(
                    metahubId,
                    enumerationId,
                    {
                        codename: finalCodename !== enumeration.codename ? finalCodename : undefined,
                        name: finalName,
                        description: finalDescription,
                        config: {
                            hubs: targetHubIds,
                            isSingleHub: isSingleHub ?? currentConfig.isSingleHub,
                            isRequiredHub: isRequiredHub ?? currentConfig.isRequiredHub,
                            sortOrder: sortOrder ?? currentConfig.sortOrder
                        },
                        updatedBy: userId,
                        expectedVersion
                    },
                    userId
                )) as EnumerationObjectRow
            } catch (error) {
                if (respondUniqueViolation(res, error, 'Enumeration with this codename already exists in this metahub')) {
                    return
                }
                throw error
            }

            const hubs = targetHubIds.length > 0 ? await hubsService.findByIds(metahubId, targetHubIds, userId) : []

            return res.json({
                id: updated.id,
                metahubId,
                codename: updated.codename,
                name: updated.presentation?.name ?? {},
                description: updated.presentation?.description,
                isSingleHub: updated.config?.isSingleHub ?? false,
                isRequiredHub: updated.config?.isRequiredHub ?? false,
                sortOrder: updated.config?.sortOrder ?? 0,
                version: updated._upl_version || 1,
                createdAt: resolveCreatedAt(updated),
                updatedAt: resolveUpdatedAt(updated),
                hubs: mapHubSummaries(hubs)
            })
        })
    )

    router.get(
        [
            '/metahub/:metahubId/enumeration/:enumerationId/blocking-references',
            '/metahub/:metahubId/enumerations/:enumerationId/blocking-references'
        ],
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId } = req.params
            const { objectsService, attributesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const blockingReferences = await findBlockingEnumerationReferences(metahubId, enumerationId, attributesService, userId)
            return res.json({
                enumerationId,
                blockingReferences,
                canDelete: blockingReferences.length === 0
            })
        })
    )

    router.delete(
        '/metahub/:metahubId/hub/:hubId/enumeration/:enumerationId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, hubId, enumerationId } = req.params
            const { objectsService, attributesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const currentConfig = enumeration.config || {}
            const currentHubIds: string[] = currentConfig.hubs || []

            if (!currentHubIds.includes(hubId)) {
                return res.status(404).json({ error: 'Enumeration not found in this hub' })
            }

            const forceDelete = req.query.force === 'true'

            if (currentConfig.isRequiredHub && currentHubIds.length === 1 && !forceDelete) {
                return res.status(409).json({
                    error: 'Cannot remove enumeration from its last hub because it requires at least one hub association. Use force=true to delete the enumeration entirely.'
                })
            }

            if (currentHubIds.length > 1 && !forceDelete) {
                const newHubIds = currentHubIds.filter((id) => id !== hubId)
                await objectsService.updateEnumeration(
                    metahubId,
                    enumerationId,
                    {
                        config: { ...currentConfig, hubs: newHubIds },
                        updatedBy: userId
                    },
                    userId
                )
                return res.status(200).json({ message: 'Enumeration removed from hub', remainingHubs: newHubIds.length })
            }

            const blockingReferences = await findBlockingEnumerationReferences(metahubId, enumerationId, attributesService, userId)
            if (blockingReferences.length > 0) {
                return res.status(409).json({
                    error: 'Cannot delete enumeration: it is referenced by attributes',
                    blockingReferences
                })
            }

            await objectsService.delete(metahubId, enumerationId, userId)
            return res.status(204).send()
        })
    )

    router.delete(
        '/metahub/:metahubId/enumeration/:enumerationId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId } = req.params
            const { objectsService, attributesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const blockingReferences = await findBlockingEnumerationReferences(metahubId, enumerationId, attributesService, userId)
            if (blockingReferences.length > 0) {
                return res.status(409).json({
                    error: 'Cannot delete enumeration: it is referenced by attributes',
                    blockingReferences
                })
            }

            await objectsService.delete(metahubId, enumerationId, userId)
            return res.status(204).send()
        })
    )

    router.get(
        '/metahub/:metahubId/enumerations/trash',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId } = req.params
            const { objectsService } = services(req)
            const userId = resolveUserId(req)

            const deletedEnumerations = await objectsService.findDeletedByKind(metahubId, MetaEntityKind.ENUMERATION, userId)
            const items = (deletedEnumerations as EnumerationObjectRow[]).map((row) => ({
                id: row.id,
                metahubId,
                codename: row.codename,
                name: row.presentation?.name || {},
                description: row.presentation?.description || {},
                deletedAt: row._mhb_deleted_at,
                deletedBy: row._mhb_deleted_by
            }))

            return res.json({ items, total: items.length })
        })
    )

    router.post(
        '/metahub/:metahubId/enumeration/:enumerationId/restore',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId } = req.params
            const { objectsService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId, { onlyDeleted: true })
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found in trash' })
            }

            try {
                await objectsService.restore(metahubId, enumerationId, userId)
            } catch (error) {
                if (extractUniqueViolationError(error)) {
                    return res.status(409).json({
                        error: 'Cannot restore enumeration: codename already exists in this metahub'
                    })
                }
                throw error
            }
            return res.json({ message: 'Enumeration restored successfully', id: enumerationId })
        })
    )

    router.delete(
        '/metahub/:metahubId/enumeration/:enumerationId/permanent',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId } = req.params
            const { objectsService, attributesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId, { includeDeleted: true })
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const blockingReferences = await findBlockingEnumerationReferences(metahubId, enumerationId, attributesService, userId)
            if (blockingReferences.length > 0) {
                return res.status(409).json({
                    error: 'Cannot delete enumeration: it is referenced by attributes',
                    blockingReferences
                })
            }

            await objectsService.permanentDelete(metahubId, enumerationId, userId)
            return res.status(204).send()
        })
    )

    // Values CRUD

    router.get(
        '/metahub/:metahubId/enumeration/:enumerationId/values',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId } = req.params
            const { objectsService, valuesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const items = await valuesService.findAll(metahubId, enumerationId, userId)
            return res.json({ items, total: items.length })
        })
    )

    router.get(
        '/metahub/:metahubId/enumeration/:enumerationId/value/:valueId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId, valueId } = req.params
            const { objectsService, valuesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const value = await valuesService.findById(metahubId, valueId, userId)
            if (!value || value.objectId !== enumerationId) {
                return res.status(404).json({ error: 'Enumeration value not found' })
            }

            return res.json(value)
        })
    )

    router.post(
        '/metahub/:metahubId/enumeration/:enumerationId/values',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId } = req.params
            const { objectsService, valuesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const parsed = createEnumerationValueSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, sortOrder, namePrimaryLocale, descriptionPrimaryLocale, isDefault } = parsed.data

            const normalizedCodename = normalizeCodename(codename)
            if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            const existing = await valuesService.findByCodename(metahubId, enumerationId, normalizedCodename, userId)
            if (existing) {
                return res.status(409).json({ error: 'Enumeration value with this codename already exists' })
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

            let created
            try {
                created = await valuesService.create(
                    metahubId,
                    {
                        enumerationId,
                        codename: normalizedCodename,
                        name: nameVlc,
                        description: descriptionVlc,
                        sortOrder,
                        isDefault,
                        createdBy: userId
                    },
                    userId
                )
            } catch (error) {
                if (respondUniqueViolation(res, error, 'Enumeration value with this codename already exists')) {
                    return
                }
                throw error
            }

            return res.status(201).json(created)
        })
    )

    router.patch(
        '/metahub/:metahubId/enumeration/:enumerationId/value/:valueId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId, valueId } = req.params
            const { objectsService, valuesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const currentValue = await valuesService.findById(metahubId, valueId, userId)
            if (!currentValue || currentValue.objectId !== enumerationId) {
                return res.status(404).json({ error: 'Enumeration value not found' })
            }

            const parsed = updateEnumerationValueSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, sortOrder, namePrimaryLocale, descriptionPrimaryLocale, isDefault, expectedVersion } =
                parsed.data

            const patch: Record<string, unknown> = {
                updatedBy: userId,
                expectedVersion
            }

            if (codename !== undefined) {
                const normalizedCodename = normalizeCodename(codename)
                if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                    })
                }
                if (normalizedCodename !== currentValue.codename) {
                    const existing = await valuesService.findByCodename(metahubId, enumerationId, normalizedCodename, userId)
                    if (existing && existing.id !== valueId) {
                        return res.status(409).json({ error: 'Enumeration value with this codename already exists' })
                    }
                    patch.codename = normalizedCodename
                }
            }

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? resolvePrimaryLocale(currentValue.name) ?? 'en'
                patch.name = buildLocalizedContent(sanitizedName, primary, primary)
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const primary = descriptionPrimaryLocale ?? resolvePrimaryLocale(currentValue.description) ?? 'en'
                    patch.description = buildLocalizedContent(sanitizedDescription, primary, primary)
                } else {
                    patch.description = null
                }
            }

            if (sortOrder !== undefined) patch.sortOrder = sortOrder
            if (isDefault !== undefined) patch.isDefault = isDefault

            let updated
            try {
                updated = await valuesService.update(metahubId, valueId, patch, userId)
            } catch (error) {
                if (respondUniqueViolation(res, error, 'Enumeration value with this codename already exists')) {
                    return
                }
                throw error
            }
            return res.json(updated)
        })
    )

    router.patch(
        '/metahub/:metahubId/enumeration/:enumerationId/value/:valueId/move',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId, valueId } = req.params
            const { objectsService, valuesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const parsed = moveEnumerationValueSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            try {
                const updated = await valuesService.moveValue(metahubId, enumerationId, valueId, parsed.data.direction, userId)
                return res.json(updated)
            } catch (error) {
                if (error instanceof Error && error.message === 'Enumeration value not found') {
                    return res.status(404).json({ error: 'Enumeration value not found' })
                }
                throw error
            }
        })
    )

    router.delete(
        '/metahub/:metahubId/enumeration/:enumerationId/value/:valueId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId, valueId } = req.params
            const { objectsService, valuesService, attributesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const value = await valuesService.findById(metahubId, valueId, userId)
            if (!value || value.objectId !== enumerationId) {
                return res.status(404).json({ error: 'Enumeration value not found' })
            }

            const blockingDefaults = await findBlockingDefaultValueReferences(metahubId, valueId, attributesService, userId)
            if (blockingDefaults.length > 0) {
                return res.status(409).json({
                    error: 'Cannot delete enumeration value: it is configured as default in attributes',
                    blockingDefaults
                })
            }

            const blockingElements = await findBlockingElementValueReferences(metahubId, enumerationId, valueId, attributesService, userId)
            if (blockingElements.length > 0) {
                return res.status(409).json({
                    error: 'Cannot delete enumeration value: it is used in predefined elements',
                    blockingElements
                })
            }

            await valuesService.delete(metahubId, valueId, userId)
            return res.status(204).send()
        })
    )

    return router
}
