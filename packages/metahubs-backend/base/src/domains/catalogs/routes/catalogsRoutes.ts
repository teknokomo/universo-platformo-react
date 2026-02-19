import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
// Hub entity removed - hubs are now in isolated schemas (_mhb_hubs)
import { z } from 'zod'
import { validateListQuery } from '../../shared/queryParams'
import { getRequestManager } from '../../../utils'
import { localizedContent, validation } from '@universo/utils'
const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
const { normalizeCodename, isValidCodename } = validation
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubElementsService } from '../../metahubs/services/MetahubElementsService'

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
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
            const rawCatalogs = await objectsService.findAll(metahubId, userId)

            // Get all catalog IDs for batch count queries
            const catalogIds = rawCatalogs.map((row: any) => row.id)

            // Batch fetch counts for attributes and elements
            const [attributesCounts, elementsCounts] = await Promise.all([
                attributesService.countByObjectIds(metahubId, catalogIds, userId),
                elementsService.countByObjectIds(metahubId, catalogIds, userId)
            ])

            let items = rawCatalogs.map((row: any) => ({
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
                attributesCount: attributesCounts.get(row.id) || 0,
                elementsCount: elementsCounts.get(row.id) || 0,
                hubs: [] as any[]
            }))

            if (search) {
                const searchLower = search.toLowerCase()
                items = items.filter((item: any) => matchesCatalogSearch(item.codename, item.name, searchLower))
            }

            // Sort
            items.sort((a: any, b: any) => {
                let valA, valB
                if (sortBy === 'name') {
                    valA = getLocalizedSortValue(a.name, a.codename)
                    valB = getLocalizedSortValue(b.name, b.codename)
                } else if (sortBy === 'codename') {
                    valA = a.codename
                    valB = b.codename
                } else if (sortBy === 'updated') {
                    valA = new Date(a.updatedAt).getTime()
                    valB = new Date(b.updatedAt).getTime()
                } else {
                    valA = new Date(a.createdAt).getTime()
                    valB = new Date(b.createdAt).getTime()
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

            rawCatalogs.forEach((row: any) => {
                const ids = row.config?.hubs || []
                if (Array.isArray(ids)) {
                    ids.forEach((id: string) => allHubIds.add(id))
                    hubIdsByCatalog.set(row.id, ids)
                }
            })

            const hubMap = new Map<string, any>()
            if (allHubIds.size > 0) {
                const hubs = await hubsService.findByIds(metahubId, Array.from(allHubIds), userId)
                hubs.forEach((h: any) => hubMap.set(h.id, h))
            }

            const resultItems = paginatedItems.map((item: any) => {
                const ids = hubIdsByCatalog.get(item.id) || []
                const matchedHubs = ids
                    .map((id) => hubMap.get(id))
                    .filter(Boolean)
                    .map((h) => ({
                        id: h.id,
                        name: h.name,
                        codename: h.codename
                    }))
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
                        sortOrder: sortOrder ?? 0,
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
                hubs: hubs.map((h: any) => ({ id: h.id, name: h.name, codename: h.codename }))
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

            const updated: Record<string, any> = await objectsService.updateCatalog(
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
            )

            // Get updated hub associations for response
            const hubs = targetHubIds.length > 0 ? await hubsService.findByIds(metahubId, targetHubIds, userId) : []

            res.json({
                id: updated.id,
                metahubId,
                codename: updated.codename,
                name: updated.presentation.name,
                description: updated.presentation.description,
                isSingleHub: updated.config.isSingleHub,
                isRequiredHub: updated.config.isRequiredHub,
                sortOrder: updated.config.sortOrder,
                version: updated._upl_version || 1,
                createdAt: updated.created_at,
                updatedAt: updated.updated_at,
                hubs: hubs.map((h: any) => ({ id: h.id, name: h.name, codename: h.codename }))
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
            const allCatalogs = await objectsService.findAll(metahubId, userId)

            let hubCatalogs = allCatalogs.filter((cat: any) => {
                const hubs = cat.config?.hubs || []
                return Array.isArray(hubs) && hubs.includes(hubId)
            })

            if (hubCatalogs.length === 0) {
                return res.json({ items: [], pagination: { total: 0, limit, offset } })
            }

            // Get catalog IDs for batch count queries
            const catalogIds = hubCatalogs.map((row: any) => row.id)

            // Batch fetch counts for attributes and elements
            const [attributesCounts, elementsCounts] = await Promise.all([
                attributesService.countByObjectIds(metahubId, catalogIds, userId),
                elementsService.countByObjectIds(metahubId, catalogIds, userId)
            ])

            // Map to items
            let items = hubCatalogs.map((row: any) => ({
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
                attributesCount: attributesCounts.get(row.id) || 0,
                elementsCount: elementsCounts.get(row.id) || 0,
                hubs: [] as any[]
            }))

            if (search) {
                const searchLower = search.toLowerCase()
                items = items.filter((item: any) => matchesCatalogSearch(item.codename, item.name, searchLower))
            }

            // Sort
            items.sort((a: any, b: any) => {
                let valA, valB
                if (sortBy === 'name') {
                    valA = getLocalizedSortValue(a.name, a.codename)
                    valB = getLocalizedSortValue(b.name, b.codename)
                } else if (sortBy === 'codename') {
                    valA = a.codename
                    valB = b.codename
                } else if (sortBy === 'updated') {
                    valA = new Date(a.updatedAt).getTime()
                    valB = new Date(b.updatedAt).getTime()
                } else {
                    valA = new Date(a.createdAt).getTime()
                    valB = new Date(b.createdAt).getTime()
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

            hubCatalogs.forEach((row: any) => {
                if (paginatedItems.find((p: any) => p.id === row.id)) {
                    const ids = row.config?.hubs || []
                    if (Array.isArray(ids)) {
                        ids.forEach((id: string) => allHubIds.add(id))
                        hubIdsByCatalog.set(row.id, ids)
                    }
                }
            })

            const hubMap = new Map<string, any>()
            if (allHubIds.size > 0) {
                const hubs = await hubsService.findByIds(metahubId, Array.from(allHubIds), userId)
                hubs.forEach((h: any) => hubMap.set(h.id, h))
            }

            const resultItems = paginatedItems.map((item: any) => {
                const ids = hubIdsByCatalog.get(item.id) || []
                const matchedHubs = ids
                    .map((id) => hubMap.get(id))
                    .filter(Boolean)
                    .map((h) => ({
                        id: h.id,
                        name: h.name,
                        codename: h.codename
                    }))
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
                hubs: hubs.map((h: any) => ({ id: h.id, name: h.name, codename: h.codename })),
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
                hubs: hubs.map((h: any) => ({ id: h.id, name: h.name, codename: h.codename })),
                attributesCount,
                elementsCount
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
                        sortOrder: sortOrder ?? 0
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
                hubs: hubs.map((h: any) => ({ id: h.id, name: h.name, codename: h.codename }))
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

            const updated: Record<string, any> = await objectsService.updateCatalog(
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
            )

            const outputHubs = targetHubIds.length > 0 ? await hubsService.findByIds(metahubId, targetHubIds, userId) : []

            res.json({
                id: updated.id,
                metahubId,
                codename: updated.codename,
                name: updated.presentation.name,
                description: updated.presentation.description,
                isSingleHub: updated.config.isSingleHub,
                isRequiredHub: updated.config.isRequiredHub,
                sortOrder: updated.config.sortOrder,
                version: updated._upl_version || 1,
                createdAt: updated.created_at,
                updatedAt: updated.updated_at,
                hubs: outputHubs.map((h: any) => ({ id: h.id, name: h.name, codename: h.codename }))
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
                return res.status(404).json({ error: 'Catalog not found' })
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

            const items = deletedCatalogs.map((row: any) => ({
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
