import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, type QueryRunner } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
// Hub entity removed - hubs are now in isolated schemas (_mhb_hubs)
import { Metahub } from '../../../database/entities/Metahub'
import { z } from 'zod'
import { validateListQuery } from '../../shared/queryParams'
import { getRequestManager } from '../../../utils'
import { ensureMetahubAccess } from '../../shared/guards'
import { localizedContent, validation, database } from '@universo/utils'
const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
const { normalizeCodename, isValidCodename, normalizeCatalogCopyOptions } = validation
import { type CatalogCopyOptions, MetaEntityKind } from '@universo/types'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubElementsService } from '../../metahubs/services/MetahubElementsService'
import { KnexClient, generateTableName } from '../../ddl'

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

type CatalogObjectRow = {
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
    created_at?: unknown
    updated_at?: unknown
    deleted_at?: unknown
    deleted_by?: unknown
}

type CatalogListItemRow = {
    id: string
    metahubId: string
    codename: string
    name: unknown
    description: unknown
    isSingleHub: boolean
    isRequiredHub: boolean
    sortOrder: number
    version: number
    createdAt: unknown
    updatedAt: unknown
    attributesCount: number
    elementsCount: number
    hubs: HubSummaryRow[]
}

type CatalogAttributeRow = {
    id: string
    codename?: string
    data_type?: string
    presentation?: unknown
    validation_rules?: unknown
    ui_config?: unknown
    sort_order?: number
    is_required?: boolean
    is_display_attribute?: boolean
    target_object_id?: string | null
    target_object_kind?: string | null
    parent_attribute_id?: string | null
}

type CatalogElementRow = {
    data?: unknown
    sort_order?: number
    owner_id?: string | null
}

type CopiedCatalogRow = {
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

const mapHubSummary = (hub: Record<string, unknown>): HubSummaryRow => ({
    id: String(hub.id),
    name: hub.name,
    codename: String(hub.codename)
})

const mapHubSummaries = (hubs: Record<string, unknown>[]): HubSummaryRow[] => hubs.map(mapHubSummary)

const getCatalogHubIds = (row: CatalogObjectRow): string[] => {
    const rawHubs = row.config?.hubs
    if (!Array.isArray(rawHubs)) return []
    return rawHubs.filter((hubId): hubId is string => typeof hubId === 'string')
}

const mapCatalogListItem = (
    row: CatalogObjectRow,
    metahubId: string,
    attributesCount: number,
    elementsCount: number
): CatalogListItemRow => ({
    id: row.id,
    metahubId,
    codename: row.codename,
    name: row.presentation?.name || {},
    description: row.presentation?.description || {},
    isSingleHub: row.config?.isSingleHub || false,
    isRequiredHub: row.config?.isRequiredHub || false,
    sortOrder: row.config?.sortOrder || 0,
    version: row._upl_version || 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attributesCount,
    elementsCount,
    hubs: []
})

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

const findBlockingCatalogReferences = async (
    metahubId: string,
    catalogId: string,
    attributesService: MetahubAttributesService,
    userId?: string
) => attributesService.findCatalogReferenceBlockers(metahubId, catalogId, userId)

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

const matchesCatalogSearch = (codename: string, name: unknown, searchLower: string): boolean =>
    codename.toLowerCase().includes(searchLower) ||
    getLocalizedCandidates(name).some((candidate) => candidate.toLowerCase().includes(searchLower))

// Validation schemas
const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))
const optionalLocalizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))

const createCatalogSchema = z.object({
    codename: z.string().min(1).max(100),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isSingleHub: z.boolean().optional(),
    isRequiredHub: z.boolean().optional(), // If true, catalog must have at least one hub
    hubIds: z.array(z.string().uuid()).optional() // Array of hub IDs for N:M relationship (can be empty if isRequiredHub=false)
})

const updateCatalogSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isSingleHub: z.boolean().optional(),
    isRequiredHub: z.boolean().optional(), // If true, catalog must have at least one hub
    hubIds: z.array(z.string().uuid()).optional(), // Replace all hub associations (can be empty if isRequiredHub=false)
    expectedVersion: z.number().int().positive().optional() // For optimistic locking
})

const copyCatalogSchema = z
    .object({
        codename: z.string().min(1).max(100).optional(),
        name: localizedInputSchema.optional(),
        description: optionalLocalizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        copyAttributes: z.boolean().optional(),
        copyElements: z.boolean().optional()
    })
    .superRefine((value, ctx) => {
        if (value.copyAttributes === false && value.copyElements === true) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['copyElements'],
                message: 'copyElements requires copyAttributes=true'
            })
        }
    })

export function createCatalogsRoutes(
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
        const hubsService = new MetahubHubsService(schemaService)
        const attributesService = new MetahubAttributesService(schemaService)
        const elementsService = new MetahubElementsService(schemaService, objectsService, attributesService)
        return {
            ds,
            manager,
            metahubRepo: manager.getRepository(Metahub),
            schemaService,
            hubsService,
            objectsService,
            attributesService,
            elementsService
        }
    }

    /**
     * GET /metahub/:metahubId/catalogs
     * List all catalogs in a metahub (owner-level view)
     */
    router.get(
        '/metahub/:metahubId/catalogs',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const { objectsService, hubsService, attributesService, elementsService } = services(req)
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

            // Fetch catalogs from _mhb_objects
            const rawCatalogs = (await objectsService.findAll(metahubId, userId)) as CatalogObjectRow[]

            // Get all catalog IDs for batch count queries
            const catalogIds = rawCatalogs.map((row) => row.id)

            // Batch fetch counts for attributes and elements
            const [attributesCounts, elementsCounts] = await Promise.all([
                attributesService.countByObjectIds(metahubId, catalogIds, userId),
                elementsService.countByObjectIds(metahubId, catalogIds, userId)
            ])

            let items = rawCatalogs.map((row) =>
                mapCatalogListItem(row, metahubId, attributesCounts.get(row.id) || 0, elementsCounts.get(row.id) || 0)
            )

            if (search) {
                const searchLower = search.toLowerCase()
                items = items.filter((item) => matchesCatalogSearch(item.codename, item.name, searchLower))
            }

            // Sort
            items.sort((a, b) => {
                const sortField = sortBy as string
                let valA, valB
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

            // Resolve hubs
            const allHubIds = new Set<string>()
            const hubIdsByCatalog = new Map<string, string[]>()

            rawCatalogs.forEach((row) => {
                const ids = getCatalogHubIds(row)
                if (ids.length > 0) {
                    ids.forEach((id) => allHubIds.add(id))
                    hubIdsByCatalog.set(row.id, ids)
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
                const ids = hubIdsByCatalog.get(item.id) || []
                const matchedHubs = ids.map((id) => hubMap.get(id)).filter((hub): hub is HubSummaryRow => Boolean(hub))
                return { ...item, hubs: matchedHubs }
            })

            res.json({ items: resultItems, pagination: { total, limit, offset } })
        })
    )

    /**
     * POST /metahub/:metahubId/catalogs
     * Create a new catalog at metahub level (can have 0+ hub associations)
     * This endpoint is used when creating catalogs from the global catalogs list
     */
    router.post(
        '/metahub/:metahubId/catalogs',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const { objectsService, hubsService } = services(req)
            const userId = resolveUserId(req)

            const parsed = createCatalogSchema.safeParse(req.body)
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

            // Check for duplicate codename within the metahub
            const existing = await objectsService.findByCodename(metahubId, normalizedCodename, userId)
            if (existing) {
                return res.status(409).json({ error: 'Catalog with this codename already exists in this metahub' })
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
                return res.status(400).json({ error: 'Catalog with required hub flag must have at least one hub association' })
            }

            // Validate all hub IDs belong to this metahub
            if (targetHubIds.length > 0) {
                const validHubs = await hubsService.findByIds(metahubId, targetHubIds, userId)
                if (validHubs.length !== targetHubIds.length) {
                    return res.status(400).json({ error: 'One or more hub IDs are invalid' })
                }
            }

            // Create catalog
            const created = await objectsService.createCatalog(
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

            // Fetch hubs for response
            const hubs = targetHubIds.length > 0 ? await hubsService.findByIds(metahubId, targetHubIds, userId) : []

            res.status(201).json({
                id: created.id,
                metahubId,
                codename: created.codename,
                name: created.presentation.name,
                description: created.presentation.description,
                isSingleHub: created.config.isSingleHub,
                isRequiredHub: created.config.isRequiredHub,
                sortOrder: created.config.sortOrder,
                version: created._upl_version || 1,
                createdAt: created.created_at,
                updatedAt: created.updated_at,
                hubs: mapHubSummaries(hubs)
            })
        })
    )

    /**
     * PATCH /metahub/:metahubId/catalog/:catalogId
     * Update a catalog at metahub level (for catalogs without hub or with multiple hubs)
     */
    router.patch(
        '/metahub/:metahubId/catalog/:catalogId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
            const { objectsService, hubsService } = services(req)
            const userId = resolveUserId(req)

            // Verify catalog exists
            const catalog = await objectsService.findById(metahubId, catalogId, userId)
            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            const parsed = updateCatalogSchema.safeParse(req.body)
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

            const currentPresentation = catalog.presentation || {}
            const currentConfig = catalog.config || {}

            let finalName = currentPresentation.name
            let finalDescription = currentPresentation.description
            let finalCodename = catalog.codename

            // Handle hub associations update
            let currentHubIds: string[] = currentConfig.hubs || []
            let targetHubIds = currentHubIds

            if (hubIds !== undefined) {
                // Validate isSingleHub constraint
                if ((isSingleHub ?? currentConfig.isSingleHub) && hubIds.length > 1) {
                    return res.status(400).json({ error: 'This catalog is restricted to a single hub' })
                }

                // Validate isRequiredHub constraint (min 1 hub required)
                const effectiveIsRequiredHub = isRequiredHub ?? currentConfig.isRequiredHub
                if (effectiveIsRequiredHub && hubIds.length === 0) {
                    return res.status(400).json({ error: 'This catalog requires at least one hub association' })
                }

                targetHubIds = hubIds

                // Validate all hub IDs belong to this metahub (if any provided)
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
                if (normalizedCodename !== catalog.codename) {
                    // Check for duplicate codename within the metahub
                    const existing = await objectsService.findByCodename(metahubId, normalizedCodename, userId)
                    if (existing && existing.id !== catalogId) {
                        return res.status(409).json({ error: 'Catalog with this codename already exists in this metahub' })
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
                        currentPresentation.description?.['_primary'] ??
                        currentPresentation.name?.['_primary'] ??
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

            if (isSingleHub !== undefined) {
                // If setting to single hub, verify only one hub is associated
                if (isSingleHub) {
                    if (targetHubIds.length > 1) {
                        return res.status(400).json({ error: 'Cannot set single hub mode when catalog is associated with multiple hubs' })
                    }
                }
            }

            // Handle isRequiredHub update
            if (isRequiredHub !== undefined) {
                // If setting to required, verify at least one hub is associated
                if (isRequiredHub) {
                    if (targetHubIds.length === 0) {
                        return res.status(400).json({ error: 'Cannot require hub association when catalog has no hubs' })
                    }
                }
            }

            const updated = (await objectsService.updateCatalog(
                metahubId,
                catalogId,
                {
                    codename: finalCodename !== catalog.codename ? finalCodename : undefined,
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
            )) as CatalogObjectRow

            // Get updated hub associations for response
            const hubs = targetHubIds.length > 0 ? await hubsService.findByIds(metahubId, targetHubIds, userId) : []

            res.json({
                id: updated.id,
                metahubId,
                codename: updated.codename,
                name: updated.presentation?.name ?? {},
                description: updated.presentation?.description,
                isSingleHub: updated.config?.isSingleHub ?? false,
                isRequiredHub: updated.config?.isRequiredHub ?? false,
                sortOrder: updated.config?.sortOrder ?? 0,
                version: updated._upl_version || 1,
                createdAt: updated.created_at,
                updatedAt: updated.updated_at,
                hubs: mapHubSummaries(hubs)
            })
        })
    )

    /**
     * GET /metahub/:metahubId/hub/:hubId/catalogs
     * List all catalogs in a hub (via junction table -> config.hubs)
     */
    router.get(
        '/metahub/:metahubId/hub/:hubId/catalogs',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { objectsService, hubsService, attributesService, elementsService } = services(req)
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

            // Fetch all catalogs and filter by hubId in config
            const allCatalogs = (await objectsService.findAll(metahubId, userId)) as CatalogObjectRow[]

            const hubCatalogs = allCatalogs.filter((cat) => getCatalogHubIds(cat).includes(hubId))

            if (hubCatalogs.length === 0) {
                return res.json({ items: [], pagination: { total: 0, limit, offset } })
            }

            // Get catalog IDs for batch count queries
            const catalogIds = hubCatalogs.map((row) => row.id)

            // Batch fetch counts for attributes and elements
            const [attributesCounts, elementsCounts] = await Promise.all([
                attributesService.countByObjectIds(metahubId, catalogIds, userId),
                elementsService.countByObjectIds(metahubId, catalogIds, userId)
            ])

            // Map to items
            let items = hubCatalogs.map((row) =>
                mapCatalogListItem(row, metahubId, attributesCounts.get(row.id) || 0, elementsCounts.get(row.id) || 0)
            )

            if (search) {
                const searchLower = search.toLowerCase()
                items = items.filter((item) => matchesCatalogSearch(item.codename, item.name, searchLower))
            }

            // Sort
            items.sort((a, b) => {
                const sortField = sortBy as string
                let valA, valB
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

            // Resolve hubs for these catalogs
            const allHubIds = new Set<string>()
            const hubIdsByCatalog = new Map<string, string[]>()

            hubCatalogs.forEach((row) => {
                if (paginatedItems.find((item) => item.id === row.id)) {
                    const ids = getCatalogHubIds(row)
                    if (ids.length > 0) {
                        ids.forEach((id) => allHubIds.add(id))
                        hubIdsByCatalog.set(row.id, ids)
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
                const ids = hubIdsByCatalog.get(item.id) || []
                const matchedHubs = ids.map((id) => hubMap.get(id)).filter((hub): hub is HubSummaryRow => Boolean(hub))
                return { ...item, hubs: matchedHubs }
            })

            res.json({ items: resultItems, pagination: { total, limit, offset } })
        })
    )

    /**
     * GET /metahub/:metahubId/hub/:hubId/catalog/:catalogId
     * Get a single catalog (verify it's associated with this hub)
     */
    router.get(
        '/metahub/:metahubId/hub/:hubId/catalog/:catalogId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId, catalogId } = req.params
            const { objectsService, hubsService } = services(req)
            const userId = resolveUserId(req)

            const catalog = await objectsService.findById(metahubId, catalogId, userId)

            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            // Check if catalog is associated with this hub
            const currentConfig = catalog.config || {}
            const currentHubs = currentConfig.hubs || []

            if (!currentHubs.includes(hubId)) {
                return res.status(404).json({ error: 'Catalog not found in this hub' })
            }

            // Get all hub associations
            const hubs = currentHubs.length > 0 ? await hubsService.findByIds(metahubId, currentHubs, userId) : []

            // TODO: Implement counts
            const attributesCount = 0
            const elementsCount = 0

            res.json({
                id: catalog.id,
                metahubId,
                codename: catalog.codename,
                name: catalog.presentation.name,
                description: catalog.presentation.description,
                isSingleHub: currentConfig.isSingleHub,
                isRequiredHub: currentConfig.isRequiredHub,
                sortOrder: currentConfig.sortOrder,
                version: catalog._upl_version || 1,
                createdAt: catalog.created_at,
                updatedAt: catalog.updated_at,
                hubs: mapHubSummaries(hubs),
                attributesCount,
                elementsCount
            })
        })
    )

    /**
     * GET /metahub/:metahubId/catalog/:catalogId
     * Get a single catalog by ID (owner-level access, no hub required)
     * Returns catalog with all associated hubs
     */
    router.get(
        '/metahub/:metahubId/catalog/:catalogId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
            const { objectsService, hubsService } = services(req)
            const userId = resolveUserId(req)

            const catalog = await objectsService.findById(metahubId, catalogId, userId)

            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            const currentConfig = catalog.config || {}
            const hubIds = currentConfig.hubs || []

            const hubs = hubIds.length > 0 ? await hubsService.findByIds(metahubId, hubIds, userId) : []

            // TODO: Implement counts using specialized services
            const attributesCount = 0
            const elementsCount = 0

            res.json({
                id: catalog.id,
                metahubId,
                codename: catalog.codename,
                name: catalog.presentation.name,
                description: catalog.presentation.description,
                isSingleHub: currentConfig.isSingleHub,
                isRequiredHub: currentConfig.isRequiredHub,
                sortOrder: currentConfig.sortOrder,
                version: catalog._upl_version || 1,
                createdAt: catalog.created_at,
                updatedAt: catalog.updated_at,
                hubs: mapHubSummaries(hubs),
                attributesCount,
                elementsCount
            })
        })
    )

    /**
     * POST /metahub/:metahubId/catalog/:catalogId/copy
     * Copy catalog with optional attributes/elements cloning.
     */
    router.post(
        '/metahub/:metahubId/catalog/:catalogId/copy',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
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

            const sourceCatalog = await objectsService.findById(metahubId, catalogId, userId)
            if (!sourceCatalog || sourceCatalog.kind !== MetaEntityKind.CATALOG) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            const parsed = copyCatalogSchema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const sourcePresentation = sourceCatalog.presentation ?? {}
            const sourceConfig = sourceCatalog.config ?? {}

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

            const normalizedBaseCodename = normalizeCodename(parsed.data.codename ?? `${sourceCatalog.codename}-copy`)
            if (!normalizedBaseCodename || !isValidCodename(normalizedBaseCodename)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            const copyOptions: CatalogCopyOptions = normalizeCatalogCopyOptions({
                copyAttributes: parsed.data.copyAttributes,
                copyElements: parsed.data.copyElements
            })

            const schemaName = await schemaService.ensureSchema(metahubId, userId)
            const knex = KnexClient.getInstance()

            const createCatalogCopy = async (codename: string) => {
                return knex.transaction(async (trx) => {
                    const now = new Date()
                    const sourceHubIds = Array.isArray(sourceConfig.hubs)
                        ? sourceConfig.hubs.filter((value: unknown): value is string => typeof value === 'string')
                        : []

                    const [createdCatalog] = await trx
                        .withSchema(schemaName)
                        .into('_mhb_objects')
                        .insert({
                            kind: MetaEntityKind.CATALOG,
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

                    const tableName = generateTableName(createdCatalog.id, 'catalog')
                    const [updatedCatalog] = await trx
                        .withSchema(schemaName)
                        .from('_mhb_objects')
                        .where({ id: createdCatalog.id })
                        .update({
                            table_name: tableName
                        })
                        .returning('*')

                    let copiedAttributesCount = 0
                    if (copyOptions.copyAttributes) {
                        const sourceAttributes = (await trx
                            .withSchema(schemaName)
                            .from('_mhb_attributes')
                            .where({ object_id: catalogId })
                            .andWhere('_upl_deleted', false)
                            .andWhere('_mhb_deleted', false)
                            .orderBy('sort_order', 'asc')
                            .orderBy('_upl_created_at', 'asc')) as CatalogAttributeRow[]

                        const attributeIdMap = new Map<string, string>()
                        const pendingAttributes = [...sourceAttributes]

                        while (pendingAttributes.length > 0) {
                            let progressed = false

                            for (let index = 0; index < pendingAttributes.length; index += 1) {
                                const sourceAttr = pendingAttributes[index]
                                const sourceParentId = sourceAttr.parent_attribute_id as string | null

                                if (sourceParentId && !attributeIdMap.has(sourceParentId)) {
                                    continue
                                }

                                const targetObjectId =
                                    sourceAttr.target_object_id && sourceAttr.target_object_id === catalogId
                                        ? updatedCatalog.id
                                        : sourceAttr.target_object_id

                                const [createdAttr] = await trx
                                    .withSchema(schemaName)
                                    .into('_mhb_attributes')
                                    .insert({
                                        object_id: updatedCatalog.id,
                                        codename: sourceAttr.codename,
                                        data_type: sourceAttr.data_type,
                                        presentation: sourceAttr.presentation ?? {},
                                        validation_rules: sourceAttr.validation_rules ?? {},
                                        ui_config: sourceAttr.ui_config ?? {},
                                        sort_order: sourceAttr.sort_order ?? 0,
                                        is_required: sourceAttr.is_required ?? false,
                                        is_display_attribute: sourceAttr.is_display_attribute ?? false,
                                        target_object_id: targetObjectId ?? null,
                                        target_object_kind: sourceAttr.target_object_kind ?? null,
                                        parent_attribute_id: sourceParentId ? attributeIdMap.get(sourceParentId) ?? null : null,
                                        _upl_created_at: now,
                                        _upl_created_by: userId ?? null,
                                        _upl_updated_at: now,
                                        _upl_updated_by: userId ?? null
                                    })
                                    .returning(['id'])

                                attributeIdMap.set(sourceAttr.id, createdAttr.id)
                                pendingAttributes.splice(index, 1)
                                index -= 1
                                copiedAttributesCount += 1
                                progressed = true
                            }

                            if (!progressed) {
                                throw new Error('Failed to copy catalog attributes hierarchy')
                            }
                        }
                    }

                    let copiedElementsCount = 0
                    if (copyOptions.copyElements) {
                        const sourceElements = (await trx
                            .withSchema(schemaName)
                            .from('_mhb_elements')
                            .where({ object_id: catalogId })
                            .andWhere('_upl_deleted', false)
                            .andWhere('_mhb_deleted', false)
                            .orderBy('sort_order', 'asc')
                            .orderBy('_upl_created_at', 'asc')) as CatalogElementRow[]

                        if (sourceElements.length > 0) {
                            await trx
                                .withSchema(schemaName)
                                .into('_mhb_elements')
                                .insert(
                                    sourceElements.map((element) => ({
                                        object_id: updatedCatalog.id,
                                        data: element.data ?? {},
                                        sort_order: element.sort_order ?? 0,
                                        owner_id: element.owner_id ?? null,
                                        _upl_created_at: now,
                                        _upl_created_by: userId ?? null,
                                        _upl_updated_at: now,
                                        _upl_updated_by: userId ?? null
                                    }))
                                )
                            copiedElementsCount = sourceElements.length
                        }
                    }

                    return {
                        catalog: updatedCatalog,
                        copiedAttributesCount,
                        copiedElementsCount
                    }
                })
            }

            let copiedResult: { catalog: CopiedCatalogRow; copiedAttributesCount: number; copiedElementsCount: number } | null = null

            for (let attempt = 1; attempt <= 1000; attempt += 1) {
                const codenameCandidate = buildCodenameAttempt(normalizedBaseCodename, attempt)
                try {
                    copiedResult = await createCatalogCopy(codenameCandidate)
                    break
                } catch (error) {
                    if (database.isUniqueViolation(error)) {
                        const constraint = database.getDbErrorConstraint(error) ?? ''
                        if (constraint === 'idx_mhb_objects_kind_codename_active') {
                            continue
                        }
                    }
                    throw error
                }
            }

            if (!copiedResult) {
                return res.status(409).json({ error: 'Unable to generate unique codename for catalog copy' })
            }

            const copiedCatalog = copiedResult.catalog
            const copiedConfig = copiedCatalog.config ?? {}
            const copiedHubIds = Array.isArray(copiedConfig.hubs)
                ? copiedConfig.hubs.filter((value: unknown): value is string => typeof value === 'string')
                : []
            const hubs = copiedHubIds.length > 0 ? await hubsService.findByIds(metahubId, copiedHubIds, userId) : []

            return res.status(201).json({
                id: copiedCatalog.id,
                metahubId,
                codename: copiedCatalog.codename,
                name: copiedCatalog.presentation?.name ?? {},
                description: copiedCatalog.presentation?.description ?? null,
                isSingleHub: copiedConfig.isSingleHub ?? false,
                isRequiredHub: copiedConfig.isRequiredHub ?? false,
                sortOrder: copiedConfig.sortOrder ?? 0,
                version: copiedCatalog._upl_version || 1,
                createdAt: copiedCatalog._upl_created_at,
                updatedAt: copiedCatalog._upl_updated_at,
                attributesCount: copiedResult.copiedAttributesCount,
                elementsCount: copiedResult.copiedElementsCount,
                hubs: hubs.map((h: Record<string, unknown>) => {
                    const hub = h as { id: string; name: unknown; codename: string }
                    return { id: hub.id, name: hub.name, codename: hub.codename }
                })
            })
        })
    )

    /**
     * POST /metahub/:metahubId/hub/:hubId/catalogs
     * Create a new catalog and associate with this hub
     */
    router.post(
        '/metahub/:metahubId/hub/:hubId/catalogs',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { objectsService, hubsService } = services(req)
            const userId = resolveUserId(req)

            // Verify hub exists in this metahub
            const hub = await hubsService.findById(metahubId, hubId, userId)
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const parsed = createCatalogSchema.safeParse(req.body)
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

            // Check for duplicate codename within the metahub
            const existing = await objectsService.findByCodename(metahubId, normalizedCodename, userId)
            if (existing) {
                return res.status(409).json({ error: 'Catalog with this codename already exists in this metahub' })
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

            // Determine target hubs - Must include current hubId
            const effectiveIsRequired = isRequiredHub ?? false
            let targetHubIds = [hubId]
            if (hubIds && Array.isArray(hubIds)) {
                // Merge provided hubIds with current hubId
                targetHubIds = Array.from(new Set([...hubIds, hubId]))
            }

            // Validate all hub IDs belong to this metahub
            const validHubs = await hubsService.findByIds(metahubId, targetHubIds, userId)
            if (validHubs.length !== targetHubIds.length) {
                return res.status(400).json({ error: 'One or more hub IDs are invalid' })
            }

            // Create catalog
            const catalog = await objectsService.createCatalog(
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

            // Return catalog with hubs
            const hubs = await hubsService.findByIds(metahubId, targetHubIds, userId)

            res.status(201).json({
                id: catalog.id,
                metahubId,
                codename: catalog.codename,
                name: catalog.presentation.name,
                description: catalog.presentation.description,
                isSingleHub: catalog.config.isSingleHub,
                isRequiredHub: catalog.config.isRequiredHub,
                sortOrder: catalog.config.sortOrder,
                version: catalog._upl_version || 1,
                createdAt: catalog.created_at,
                updatedAt: catalog.updated_at,
                hubs: mapHubSummaries(hubs)
            })
        })
    )

    /**
     * PATCH /metahub/:metahubId/hub/:hubId/catalog/:catalogId
     * Update a catalog (ensure it remains in hub if not specifically removing?)
     * Actually, this endpoint might be redundant if we have the global PATCH.
     * But for now, we maintain it and ensure it works.
     */
    router.patch(
        '/metahub/:metahubId/hub/:hubId/catalog/:catalogId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId, catalogId } = req.params
            const { objectsService, hubsService } = services(req)
            const userId = resolveUserId(req)

            const catalog = await objectsService.findById(metahubId, catalogId, userId)
            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            // Verify catalog is associated with this hub
            const currentHubs = catalog.config?.hubs || []
            if (!currentHubs.includes(hubId)) {
                return res.status(404).json({ error: 'Catalog not found in this hub' })
            }

            const parsed = updateCatalogSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            // Reuse logic from main PATCH or implement similar
            // Here we just forward the update but we need to respect the context if needed.
            // If user updates hubs, we must ensure consistency logic.

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

            const currentPresentation = catalog.presentation || {}
            const currentConfig = catalog.config || {}

            let finalName = currentPresentation.name
            let finalDescription = currentPresentation.description
            let finalCodename = catalog.codename
            let targetHubIds = currentConfig.hubs || []

            if (hubIds !== undefined) {
                targetHubIds = hubIds

                // Validate isSingleHub/RequiredHub
                if ((isSingleHub ?? currentConfig.isSingleHub) && targetHubIds.length > 1) {
                    return res.status(400).json({ error: 'This catalog is restricted to a single hub' })
                }
                const effectiveIsRequiredHub = isRequiredHub ?? currentConfig.isRequiredHub
                if (effectiveIsRequiredHub && targetHubIds.length === 0) {
                    return res.status(400).json({ error: 'This catalog requires at least one hub association' })
                }

                // Validate hubs
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
                if (normalizedCodename !== catalog.codename) {
                    const existing = await objectsService.findByCodename(metahubId, normalizedCodename, userId)
                    if (existing && existing.id !== catalogId) {
                        return res.status(409).json({ error: 'Catalog with this codename already exists' })
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
                finalName = buildLocalizedContent(sanitizedName, primary, primary)
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                finalDescription =
                    Object.keys(sanitizedDescription).length > 0
                        ? buildLocalizedContent(sanitizedDescription, descriptionPrimaryLocale || 'en', 'en')
                        : undefined
            }

            const updated = (await objectsService.updateCatalog(
                metahubId,
                catalogId,
                {
                    codename: finalCodename !== catalog.codename ? finalCodename : undefined,
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
            )) as CatalogObjectRow

            const outputHubs = targetHubIds.length > 0 ? await hubsService.findByIds(metahubId, targetHubIds, userId) : []

            res.json({
                id: updated.id,
                metahubId,
                codename: updated.codename,
                name: updated.presentation?.name ?? {},
                description: updated.presentation?.description,
                isSingleHub: updated.config?.isSingleHub ?? false,
                isRequiredHub: updated.config?.isRequiredHub ?? false,
                sortOrder: updated.config?.sortOrder ?? 0,
                version: updated._upl_version || 1,
                createdAt: updated.created_at,
                updatedAt: updated.updated_at,
                hubs: mapHubSummaries(outputHubs)
            })
        })
    )

    /**
     * GET /metahub/:metahubId/catalog/:catalogId/blocking-references
     * Return cross-catalog REF attributes that block deleting this catalog.
     */
    router.get(
        ['/metahub/:metahubId/catalog/:catalogId/blocking-references', '/metahub/:metahubId/catalogs/:catalogId/blocking-references'],
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
            const { objectsService, attributesService } = services(req)
            const userId = resolveUserId(req)

            const catalog = await objectsService.findById(metahubId, catalogId, userId)
            if (!catalog) {
                // Return empty result for non-existent catalogs instead of 404.
                // This prevents noisy console errors when React Query refetches
                // after a successful catalog deletion (race condition).
                return res.json({
                    catalogId,
                    blockingReferences: [],
                    canDelete: true
                })
            }

            const blockingReferences = await findBlockingCatalogReferences(metahubId, catalogId, attributesService, userId)
            return res.json({
                catalogId,
                blockingReferences,
                canDelete: blockingReferences.length === 0
            })
        })
    )

    /**
     * DELETE /metahub/:metahubId/hub/:hubId/catalog/:catalogId
     * Delete catalog association from a specific hub.
     * If it's the last hub and catalog requires hub, prevent unless force=true (which deletes catalog).
     */
    router.delete(
        '/metahub/:metahubId/hub/:hubId/catalog/:catalogId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId, catalogId } = req.params
            const { objectsService, attributesService } = services(req)
            const userId = resolveUserId(req)

            const catalog = await objectsService.findById(metahubId, catalogId, userId)
            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            const currentConfig = catalog.config || {}
            let currentHubIds: string[] = currentConfig.hubs || []

            if (!currentHubIds.includes(hubId)) {
                return res.status(404).json({ error: 'Catalog not found in this hub' })
            }

            const forceDelete = req.query.force === 'true'

            if (currentConfig.isRequiredHub && currentHubIds.length === 1 && !forceDelete) {
                return res.status(409).json({
                    error: 'Cannot remove catalog from its last hub because it requires at least one hub association. Use force=true to delete the catalog entirely.'
                })
            }

            if (currentHubIds.length > 1 && !forceDelete) {
                // Remove only from this hub
                const newHubIds = currentHubIds.filter((id) => id !== hubId)
                await objectsService.updateCatalog(
                    metahubId,
                    catalogId,
                    {
                        config: { ...currentConfig, hubs: newHubIds },
                        updatedBy: userId
                    },
                    userId
                )
                res.status(200).json({ message: 'Catalog removed from hub', remainingHubs: newHubIds.length })
            } else {
                // Delete entire catalog
                const blockingReferences = await findBlockingCatalogReferences(metahubId, catalogId, attributesService, userId)
                if (blockingReferences.length > 0) {
                    return res.status(409).json({
                        error: 'Cannot delete catalog: it is referenced by attributes in other catalogs',
                        blockingReferences
                    })
                }
                await objectsService.delete(metahubId, catalogId, userId)
                res.status(204).send()
            }
        })
    )

    /**
     * DELETE /metahub/:metahubId/catalog/:catalogId
     * Delete a catalog directly (soft delete - moves to trash)
     */
    router.delete(
        '/metahub/:metahubId/catalog/:catalogId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
            const { objectsService, attributesService } = services(req)
            const userId = resolveUserId(req)

            const catalog = await objectsService.findById(metahubId, catalogId, userId)
            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            const blockingReferences = await findBlockingCatalogReferences(metahubId, catalogId, attributesService, userId)
            if (blockingReferences.length > 0) {
                return res.status(409).json({
                    error: 'Cannot delete catalog: it is referenced by attributes in other catalogs',
                    blockingReferences
                })
            }

            await objectsService.delete(metahubId, catalogId, userId)

            res.status(204).send()
        })
    )

    /**
     * GET /metahub/:metahubId/catalogs/trash
     * List all soft-deleted catalogs (trash view)
     */
    router.get(
        '/metahub/:metahubId/catalogs/trash',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const { objectsService } = services(req)
            const userId = resolveUserId(req)

            const deletedCatalogs = await objectsService.findDeleted(metahubId, userId)

            const items = (deletedCatalogs as CatalogObjectRow[]).map((row) => ({
                id: row.id,
                metahubId,
                codename: row.codename,
                name: row.presentation?.name || {},
                description: row.presentation?.description || {},
                deletedAt: row.deleted_at,
                deletedBy: row.deleted_by
            }))

            res.json({ items, total: items.length })
        })
    )

    /**
     * POST /metahub/:metahubId/catalog/:catalogId/restore
     * Restore a soft-deleted catalog from trash
     */
    router.post(
        '/metahub/:metahubId/catalog/:catalogId/restore',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
            const { objectsService } = services(req)
            const userId = resolveUserId(req)

            // Check if catalog exists in trash
            const catalog = await objectsService.findById(metahubId, catalogId, userId, { onlyDeleted: true })
            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found in trash' })
            }

            await objectsService.restore(metahubId, catalogId, userId)

            res.json({ message: 'Catalog restored successfully', id: catalogId })
        })
    )

    /**
     * DELETE /metahub/:metahubId/catalog/:catalogId/permanent
     * Permanently delete a catalog (irreversible)
     */
    router.delete(
        '/metahub/:metahubId/catalog/:catalogId/permanent',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
            const { objectsService } = services(req)
            const userId = resolveUserId(req)

            // Check if catalog exists (including deleted)
            const catalog = await objectsService.findById(metahubId, catalogId, userId, { includeDeleted: true })
            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            await objectsService.permanentDelete(metahubId, catalogId, userId)

            res.status(204).send()
        })
    )

    return router
}
