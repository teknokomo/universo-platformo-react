import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { Catalog } from '../database/entities/Catalog'
import { CatalogHub } from '../database/entities/CatalogHub'
import { Attribute } from '../database/entities/Attribute'
import { Hub } from '../database/entities/Hub'
import { HubRecord } from '../database/entities/Record'
import { z } from 'zod'
import { validateListQuery } from '../schemas/queryParams'
import { escapeLikeWildcards, getRequestManager } from '../utils'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo/utils/vlc'
import { normalizeCodename, isValidCodename } from '@universo/utils/validation/codename'

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
    hubIds: z.array(z.string().uuid()).optional() // Replace all hub associations (can be empty if isRequiredHub=false)
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

    const repos = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return {
            catalogRepo: manager.getRepository(Catalog),
            catalogHubRepo: manager.getRepository(CatalogHub),
            hubRepo: manager.getRepository(Hub),
            attributeRepo: manager.getRepository(Attribute),
            recordRepo: manager.getRepository(HubRecord)
        }
    }

    /**
     * GET /metahubs/:metahubId/catalogs
     * List all catalogs in a metahub (owner-level view)
     */
    router.get(
        '/metahubs/:metahubId/catalogs',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const { catalogRepo, catalogHubRepo, hubRepo } = repos(req)

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

            // Get all hubs in this metahub for reference
            const hubs = await hubRepo.find({
                where: { metahubId },
                select: ['id', 'name', 'codename']
            })
            const hubMap = new Map(hubs.map((h) => [h.id, h]))

            // Optimized query for catalogs owned by this metahub
            const qb = catalogRepo
                .createQueryBuilder('c')
                .leftJoin(Attribute, 'a', 'a.catalogId = c.id')
                .leftJoin(HubRecord, 'r', 'r.catalogId = c.id')
                .where('c.metahubId = :metahubId', { metahubId })

            if (search) {
                const escapedSearch = escapeLikeWildcards(search)
                qb.andWhere("(c.name::text ILIKE :search OR COALESCE(c.description::text, '') ILIKE :search OR c.codename ILIKE :search)", {
                    search: `%${escapedSearch}%`
                })
            }

            const orderColumn =
                sortBy === 'name'
                    ? "COALESCE(c.name->>(c.name->>'_primary'), c.name->>'en', '')"
                    : sortBy === 'created'
                    ? 'c.created_at'
                    : 'c.updated_at'

            qb.select([
                'c.id as id',
                'c.metahub_id as "metahubId"',
                'c.codename as codename',
                'c.name as name',
                'c.description as description',
                'c.is_single_hub as "isSingleHub"',
                'c.is_required_hub as "isRequiredHub"',
                'c.sortOrder as "sortOrder"',
                'c.created_at as "createdAt"',
                'c.updated_at as "updatedAt"'
            ])
                .addSelect('COUNT(DISTINCT a.id)', 'attributesCount')
                .addSelect('COUNT(DISTINCT r.id)', 'recordsCount')
                .addSelect('COUNT(*) OVER()', 'window_total')
                .groupBy('c.id')
                .orderBy(orderColumn, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')
                .limit(limit)
                .offset(offset)

            const raw = await qb.getRawMany<{
                id: string
                metahubId: string
                codename: string
                name: Record<string, string> | null
                description: Record<string, string> | null
                isSingleHub: boolean
                isRequiredHub: boolean
                sortOrder: number
                createdAt: Date
                updatedAt: Date
                attributesCount: string
                recordsCount: string
                window_total?: string
            }>()

            // Extract total count from window function (same value in all rows)
            const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) : 0

            // Fetch hub associations for all catalogs
            const catalogIds = raw.map((r) => r.id)
            const catalogHubAssociations =
                catalogIds.length > 0
                    ? await catalogHubRepo.find({
                          where: { catalogId: In(catalogIds) },
                          order: { sortOrder: 'ASC' }
                      })
                    : []

            // Group hub associations by catalog
            const hubsByCatalog = new Map<string, Array<{ hubId: string; sortOrder: number }>>()
            for (const assoc of catalogHubAssociations) {
                const list = hubsByCatalog.get(assoc.catalogId) ?? []
                list.push({ hubId: assoc.hubId, sortOrder: assoc.sortOrder })
                hubsByCatalog.set(assoc.catalogId, list)
            }

            const catalogsWithCounts = raw.map((row) => {
                const hubAssocs = hubsByCatalog.get(row.id) ?? []
                const hubs = hubAssocs
                    .map((assoc) => {
                        const hub = hubMap.get(assoc.hubId)
                        return hub ? { id: hub.id, name: hub.name, codename: hub.codename } : null
                    })
                    .filter(Boolean)

                return {
                    id: row.id,
                    metahubId: row.metahubId,
                    codename: row.codename,
                    name: row.name,
                    description: row.description,
                    isSingleHub: row.isSingleHub,
                    isRequiredHub: row.isRequiredHub,
                    sortOrder: row.sortOrder,
                    createdAt: row.createdAt,
                    updatedAt: row.updatedAt,
                    attributesCount: parseInt(row.attributesCount || '0', 10),
                    recordsCount: parseInt(row.recordsCount || '0', 10),
                    hubs
                }
            })

            res.json({ items: catalogsWithCounts, pagination: { total, limit, offset } })
        })
    )

    /**
     * POST /metahubs/:metahubId/catalogs
     * Create a new catalog at metahub level (can have 0+ hub associations)
     * This endpoint is used when creating catalogs from the global catalogs list
     */
    router.post(
        '/metahubs/:metahubId/catalogs',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const { catalogRepo, catalogHubRepo, hubRepo } = repos(req)

            const parsed = createCatalogSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, sortOrder, namePrimaryLocale, descriptionPrimaryLocale, isSingleHub, isRequiredHub, hubIds } = parsed.data

            const normalizedCodename = normalizeCodename(codename)
            if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            // Check for duplicate codename within the metahub
            const existing = await catalogRepo.findOne({ where: { metahubId, codename: normalizedCodename } })
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

            // Determine which hubs to associate with (can be empty if isRequiredHub=false)
            const effectiveIsRequired = isRequiredHub ?? false
            const targetHubIds: string[] = hubIds ?? []

            // Validate isRequiredHub constraint
            if (effectiveIsRequired && targetHubIds.length === 0) {
                return res.status(400).json({ error: 'Catalog with required hub flag must have at least one hub association' })
            }

            // Validate all hub IDs belong to this metahub
            if (targetHubIds.length > 0) {
                const validHubs = await hubRepo.find({
                    where: { id: In(targetHubIds), metahubId }
                })
                if (validHubs.length !== targetHubIds.length) {
                    return res.status(400).json({ error: 'One or more hub IDs are invalid' })
                }
            }

            // Create catalog
            const catalog = catalogRepo.create({
                metahubId,
                codename: normalizedCodename,
                name: nameVlc,
                description: descriptionVlc,
                isSingleHub: isSingleHub ?? false,
                isRequiredHub: effectiveIsRequired,
                sortOrder: sortOrder ?? 0
            })

            const saved = await catalogRepo.save(catalog)

            // Create hub associations (can be empty)
            if (targetHubIds.length > 0) {
                const catalogHubs = targetHubIds.map((hId, index) =>
                    catalogHubRepo.create({
                        catalogId: saved.id,
                        hubId: hId,
                        sortOrder: index
                    })
                )
                await catalogHubRepo.save(catalogHubs)
            }

            // Return with hub associations
            const hubs =
                targetHubIds.length > 0 ? await hubRepo.find({ where: { id: In(targetHubIds), metahubId } }) : []

            res.status(201).json({
                ...saved,
                hubs: hubs.map((h) => ({ id: h.id, name: h.name, codename: h.codename }))
            })
        })
    )

    /**
     * PATCH /metahubs/:metahubId/catalogs/:catalogId
     * Update a catalog at metahub level (for catalogs without hub or with multiple hubs)
     */
    router.patch(
        '/metahubs/:metahubId/catalogs/:catalogId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
            const { catalogRepo, catalogHubRepo, hubRepo } = repos(req)

            // Verify catalog exists and belongs to this metahub
            const catalog = await catalogRepo.findOne({ where: { id: catalogId, metahubId } })
            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            const parsed = updateCatalogSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, sortOrder, namePrimaryLocale, descriptionPrimaryLocale, isSingleHub, hubIds } = parsed.data

            // Handle hub associations update
            if (hubIds !== undefined) {
                // Validate isSingleHub constraint
                if (catalog.isSingleHub && hubIds.length > 1) {
                    return res.status(400).json({ error: 'This catalog is restricted to a single hub' })
                }

                // Validate isRequiredHub constraint (min 1 hub required)
                const effectiveIsRequiredHub = parsed.data.isRequiredHub ?? catalog.isRequiredHub
                if (effectiveIsRequiredHub && hubIds.length === 0) {
                    return res.status(400).json({ error: 'This catalog requires at least one hub association' })
                }

                // Validate all hub IDs belong to this metahub (if any provided)
                if (hubIds.length > 0) {
                    const validHubs = await hubRepo.find({
                        where: { id: In(hubIds), metahubId }
                    })
                    if (validHubs.length !== hubIds.length) {
                        return res.status(400).json({ error: 'One or more hub IDs are invalid' })
                    }
                }

                // Replace all hub associations
                await catalogHubRepo.delete({ catalogId })
                if (hubIds.length > 0) {
                    const newAssociations = hubIds.map((hId, index) =>
                        catalogHubRepo.create({
                            catalogId,
                            hubId: hId,
                            sortOrder: index
                        })
                    )
                    await catalogHubRepo.save(newAssociations)
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
                    const existing = await catalogRepo.findOne({ where: { metahubId, codename: normalizedCodename } })
                    if (existing && existing.id !== catalogId) {
                        return res.status(409).json({ error: 'Catalog with this codename already exists in this metahub' })
                    }
                    catalog.codename = normalizedCodename
                }
            }

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? catalog.name?._primary ?? 'en'
                const nameVlc = buildLocalizedContent(sanitizedName, primary, primary)
                if (nameVlc) {
                    catalog.name = nameVlc
                }
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const primary =
                        descriptionPrimaryLocale ?? catalog.description?._primary ?? catalog.name?._primary ?? namePrimaryLocale ?? 'en'
                    const descriptionVlc = buildLocalizedContent(sanitizedDescription, primary, primary)
                    if (descriptionVlc) {
                        catalog.description = descriptionVlc
                    }
                } else {
                    catalog.description = undefined
                }
            }

            if (sortOrder !== undefined) {
                catalog.sortOrder = sortOrder
            }

            if (isSingleHub !== undefined) {
                // If setting to single hub, verify only one hub is associated
                if (isSingleHub) {
                    const currentHubs = await catalogHubRepo.count({ where: { catalogId } })
                    if (currentHubs > 1) {
                        return res.status(400).json({ error: 'Cannot set single hub mode when catalog is associated with multiple hubs' })
                    }
                }
                catalog.isSingleHub = isSingleHub
            }

            // Handle isRequiredHub update
            const { isRequiredHub } = parsed.data
            if (isRequiredHub !== undefined) {
                // If setting to required, verify at least one hub is associated
                if (isRequiredHub) {
                    const currentHubs = await catalogHubRepo.count({ where: { catalogId } })
                    if (currentHubs === 0) {
                        return res.status(400).json({ error: 'Cannot require hub association when catalog has no hubs' })
                    }
                }
                catalog.isRequiredHub = isRequiredHub
            }

            const saved = await catalogRepo.save(catalog)

            // Get updated hub associations for response
            const updatedAssociations = await catalogHubRepo.find({
                where: { catalogId },
                order: { sortOrder: 'ASC' }
            })
            const hubIdsForResponse = updatedAssociations.map((a) => a.hubId)
            const hubs =
                hubIdsForResponse.length > 0 ? await hubRepo.find({ where: { id: In(hubIdsForResponse) }, select: ['id', 'name', 'codename'] }) : []

            res.json({
                ...saved,
                hubs: hubs.map((h) => ({ id: h.id, name: h.name, codename: h.codename }))
            })
        })
    )

    /**
     * GET /metahubs/:metahubId/hubs/:hubId/catalogs
     * List all catalogs in a hub (via junction table)
     */
    router.get(
        '/metahubs/:metahubId/hubs/:hubId/catalogs',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { catalogRepo, catalogHubRepo, hubRepo } = repos(req)

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

            // Get catalog IDs associated with this hub via junction table
            const hubCatalogs = await catalogHubRepo.find({
                where: { hubId },
                select: ['catalogId', 'sortOrder']
            })

            if (hubCatalogs.length === 0) {
                return res.json({ items: [], pagination: { total: 0, limit, offset } })
            }

            const catalogIds = hubCatalogs.map((hc) => hc.catalogId)

            // Query catalogs via junction table
            const qb = catalogRepo
                .createQueryBuilder('c')
                .leftJoin(Attribute, 'a', 'a.catalogId = c.id')
                .leftJoin(HubRecord, 'r', 'r.catalogId = c.id')
                .leftJoin(CatalogHub, 'ch', 'ch.catalogId = c.id AND ch.hubId = :hubId', { hubId })
                .where('c.id IN (:...catalogIds)', { catalogIds })

            if (search) {
                const escapedSearch = escapeLikeWildcards(search)
                qb.andWhere("(c.name::text ILIKE :search OR COALESCE(c.description::text, '') ILIKE :search OR c.codename ILIKE :search)", {
                    search: `%${escapedSearch}%`
                })
            }

            const orderColumn =
                sortBy === 'name'
                    ? "COALESCE(c.name->>(c.name->>'_primary'), c.name->>'en', '')"
                    : sortBy === 'created'
                    ? 'c.created_at'
                    : 'ch.sort_order'

            qb.select([
                'c.id as id',
                'c.metahub_id as "metahubId"',
                'c.codename as codename',
                'c.name as name',
                'c.description as description',
                'c.is_single_hub as "isSingleHub"',
                'c.is_required_hub as "isRequiredHub"',
                'c.sort_order as "sortOrder"',
                'c.created_at as "createdAt"',
                'c.updated_at as "updatedAt"',
                'ch.sort_order as "hubSortOrder"'
            ])
                .addSelect('COUNT(DISTINCT a.id)', 'attributesCount')
                .addSelect('COUNT(DISTINCT r.id)', 'recordsCount')
                .addSelect('COUNT(*) OVER()', 'window_total')
                .groupBy('c.id, ch.sort_order')
                .orderBy(orderColumn, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')
                .limit(limit)
                .offset(offset)

            const raw = await qb.getRawMany<{
                id: string
                metahubId: string
                codename: string
                name: Record<string, string> | null
                description: Record<string, string> | null
                isSingleHub: boolean
                isRequiredHub: boolean
                sortOrder: number
                hubSortOrder: number
                createdAt: Date
                updatedAt: Date
                attributesCount: string
                recordsCount: string
                window_total?: string
            }>()

            // Extract total count from window function (same value in all rows)
            const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) : 0

            // Get all hubs in this metahub for reference
            const hubs = await hubRepo.find({
                where: { metahubId },
                select: ['id', 'name', 'codename']
            })
            const hubMap = new Map(hubs.map((h) => [h.id, h]))

            // Fetch hub associations for all catalogs in this page
            const pageCatalogIds = raw.map((r) => r.id)
            const catalogHubAssociations =
                pageCatalogIds.length > 0
                    ? await catalogHubRepo.find({
                          where: { catalogId: In(pageCatalogIds) },
                          order: { sortOrder: 'ASC' }
                      })
                    : []

            // Group hub associations by catalog
            const hubsByCatalog = new Map<string, Array<{ hubId: string; sortOrder: number }>>()
            for (const assoc of catalogHubAssociations) {
                const list = hubsByCatalog.get(assoc.catalogId) ?? []
                list.push({ hubId: assoc.hubId, sortOrder: assoc.sortOrder })
                hubsByCatalog.set(assoc.catalogId, list)
            }

            const catalogsWithCounts = raw.map((row) => {
                const hubAssocs = hubsByCatalog.get(row.id) ?? []
                const hubs = hubAssocs
                    .map((assoc) => {
                        const hub = hubMap.get(assoc.hubId)
                        return hub ? { id: hub.id, name: hub.name, codename: hub.codename } : null
                    })
                    .filter(Boolean)

                return {
                    id: row.id,
                    metahubId: row.metahubId,
                    codename: row.codename,
                    name: row.name,
                    description: row.description,
                    isSingleHub: row.isSingleHub,
                    isRequiredHub: row.isRequiredHub,
                    sortOrder: row.sortOrder,
                    hubSortOrder: row.hubSortOrder,
                    createdAt: row.createdAt,
                    updatedAt: row.updatedAt,
                    attributesCount: parseInt(row.attributesCount || '0', 10),
                    recordsCount: parseInt(row.recordsCount || '0', 10),
                    hubs
                }
            })

            res.json({ items: catalogsWithCounts, pagination: { total, limit, offset } })
        })
    )

    /**
     * GET /metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId
     * Get a single catalog (verify it's associated with this hub)
     */
    router.get(
        '/metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { hubId, catalogId } = req.params
            const { catalogRepo, catalogHubRepo, hubRepo } = repos(req)

            // Check if catalog is associated with this hub
            const catalogHub = await catalogHubRepo.findOne({
                where: { catalogId, hubId }
            })

            if (!catalogHub) {
                return res.status(404).json({ error: 'Catalog not found in this hub' })
            }

            const catalog = await catalogRepo.findOne({
                where: { id: catalogId }
            })

            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            // Get all hub associations
            const allAssociations = await catalogHubRepo.find({
                where: { catalogId },
                order: { sortOrder: 'ASC' }
            })

            const hubIds = allAssociations.map((a) => a.hubId)
            const hubs = await hubRepo.find({
                where: { id: In(hubIds) },
                select: ['id', 'name', 'codename']
            })

            res.json({
                ...catalog,
                hubs: hubs.map((h) => ({ id: h.id, name: h.name, codename: h.codename }))
            })
        })
    )

    /**
     * GET /metahubs/:metahubId/catalogs/:catalogId
     * Get a single catalog by ID (owner-level access, no hub required)
     * Returns catalog with all associated hubs
     */
    router.get(
        '/metahubs/:metahubId/catalogs/:catalogId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
            const { catalogRepo, catalogHubRepo, hubRepo, attributeRepo, recordRepo } = repos(req)

            const catalog = await catalogRepo.findOne({
                where: { id: catalogId, metahubId }
            })

            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            // Get all hub associations
            const allAssociations = await catalogHubRepo.find({
                where: { catalogId },
                order: { sortOrder: 'ASC' }
            })

            const hubIds = allAssociations.map((a) => a.hubId)
            const hubs =
                hubIds.length > 0
                    ? await hubRepo.find({
                          where: { id: In(hubIds) },
                          select: ['id', 'name', 'codename']
                      })
                    : []

            // Sort hubs by association sortOrder
            const hubMap = new Map(hubs.map((h) => [h.id, h]))
            const sortedHubs = allAssociations
                .map((a) => hubMap.get(a.hubId))
                .filter(Boolean)
                .map((h) => ({ id: h!.id, name: h!.name, codename: h!.codename }))

            // Get counts
            const attributesCount = await attributeRepo.count({ where: { catalogId } })
            const recordsCount = await recordRepo.count({ where: { catalogId } })

            res.json({
                ...catalog,
                hubs: sortedHubs,
                attributesCount,
                recordsCount
            })
        })
    )

    /**
     * POST /metahubs/:metahubId/hubs/:hubId/catalogs
     * Create a new catalog and associate with this hub
     */
    router.post(
        '/metahubs/:metahubId/hubs/:hubId/catalogs',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { catalogRepo, catalogHubRepo, hubRepo } = repos(req)

            // Verify hub exists and belongs to this metahub
            const hub = await hubRepo.findOne({ where: { id: hubId, metahubId } })
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const parsed = createCatalogSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, sortOrder, namePrimaryLocale, descriptionPrimaryLocale, isSingleHub, isRequiredHub, hubIds } = parsed.data

            const normalizedCodename = normalizeCodename(codename)
            if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            // Check for duplicate codename within the metahub
            const existing = await catalogRepo.findOne({ where: { metahubId, codename: normalizedCodename } })
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

            // Determine which hubs to associate with
            // If hubIds provided, use them; otherwise use hubId from URL if available
            // If isRequiredHub is false and no hubs specified, catalog can exist without hubs
            const effectiveIsRequired = isRequiredHub ?? false
            let targetHubIds: string[] = []

            if (hubIds && hubIds.length > 0) {
                targetHubIds = hubIds
            } else if (hubId) {
                targetHubIds = [hubId]
            }

            // Validate isRequiredHub constraint
            if (effectiveIsRequired && targetHubIds.length === 0) {
                return res.status(400).json({ error: 'Catalog with required hub flag must have at least one hub association' })
            }

            // Validate all hub IDs belong to this metahub
            if (targetHubIds.length > 0) {
                const validHubs = await hubRepo.find({
                    where: { id: In(targetHubIds), metahubId }
                })
                if (validHubs.length !== targetHubIds.length) {
                    return res.status(400).json({ error: 'One or more hub IDs are invalid' })
                }
            }

            // Create catalog
            const catalog = catalogRepo.create({
                metahubId,
                codename: normalizedCodename,
                name: nameVlc,
                description: descriptionVlc,
                isSingleHub: isSingleHub ?? false,
                isRequiredHub: effectiveIsRequired,
                sortOrder: sortOrder ?? 0
            })

            const saved = await catalogRepo.save(catalog)

            // Create hub associations (can be empty if isRequiredHub=false)
            if (targetHubIds.length > 0) {
                const catalogHubs = targetHubIds.map((hId, index) =>
                    catalogHubRepo.create({
                        catalogId: saved.id,
                        hubId: hId,
                        sortOrder: index
                    })
                )
                await catalogHubRepo.save(catalogHubs)
            }

            // Return catalog with hubs
            const hubs = await hubRepo.find({
                where: { id: In(targetHubIds) },
                select: ['id', 'name', 'codename']
            })

            res.status(201).json({
                ...saved,
                hubs: hubs.map((h) => ({ id: h.id, name: h.name, codename: h.codename }))
            })
        })
    )

    /**
     * PATCH /metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId
     * Update a catalog
     */
    router.patch(
        '/metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId, catalogId } = req.params
            const { catalogRepo, catalogHubRepo, hubRepo } = repos(req)

            // Verify catalog exists and belongs to this metahub
            const catalog = await catalogRepo.findOne({ where: { id: catalogId, metahubId } })
            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            // Verify catalog is associated with this hub (for path validation)
            const catalogHub = await catalogHubRepo.findOne({ where: { catalogId, hubId } })
            if (!catalogHub) {
                return res.status(404).json({ error: 'Catalog not found in this hub' })
            }

            const parsed = updateCatalogSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, sortOrder, namePrimaryLocale, descriptionPrimaryLocale, isSingleHub, hubIds } = parsed.data

            // Handle hub associations update
            if (hubIds !== undefined) {
                // Validate isSingleHub constraint
                if (catalog.isSingleHub && hubIds.length > 1) {
                    return res.status(400).json({ error: 'This catalog is restricted to a single hub' })
                }

                // Validate isRequiredHub constraint (min 1 hub required)
                const effectiveIsRequiredHub = parsed.data.isRequiredHub ?? catalog.isRequiredHub
                if (effectiveIsRequiredHub && hubIds.length === 0) {
                    return res.status(400).json({ error: 'This catalog requires at least one hub association' })
                }

                // Validate all hub IDs belong to this metahub
                const validHubs = await hubRepo.find({
                    where: { id: In(hubIds), metahubId }
                })
                if (validHubs.length !== hubIds.length) {
                    return res.status(400).json({ error: 'One or more hub IDs are invalid' })
                }

                // Replace all hub associations
                await catalogHubRepo.delete({ catalogId })
                const newAssociations = hubIds.map((hId, index) =>
                    catalogHubRepo.create({
                        catalogId,
                        hubId: hId,
                        sortOrder: index
                    })
                )
                await catalogHubRepo.save(newAssociations)
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
                    const existing = await catalogRepo.findOne({ where: { metahubId, codename: normalizedCodename } })
                    if (existing && existing.id !== catalogId) {
                        return res.status(409).json({ error: 'Catalog with this codename already exists in this metahub' })
                    }
                    catalog.codename = normalizedCodename
                }
            }

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? catalog.name?._primary ?? 'en'
                const nameVlc = buildLocalizedContent(sanitizedName, primary, primary)
                if (nameVlc) {
                    catalog.name = nameVlc
                }
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const primary =
                        descriptionPrimaryLocale ?? catalog.description?._primary ?? catalog.name?._primary ?? namePrimaryLocale ?? 'en'
                    const descriptionVlc = buildLocalizedContent(sanitizedDescription, primary, primary)
                    if (descriptionVlc) {
                        catalog.description = descriptionVlc
                    }
                } else {
                    catalog.description = undefined
                }
            }

            if (sortOrder !== undefined) {
                catalog.sortOrder = sortOrder
            }

            if (isSingleHub !== undefined) {
                // If setting to single hub, verify only one hub is associated
                if (isSingleHub) {
                    const currentHubs = await catalogHubRepo.count({ where: { catalogId } })
                    if (currentHubs > 1) {
                        return res.status(400).json({ error: 'Cannot set single hub mode when catalog is associated with multiple hubs' })
                    }
                }
                catalog.isSingleHub = isSingleHub
            }

            // Handle isRequiredHub update
            const { isRequiredHub } = parsed.data
            if (isRequiredHub !== undefined) {
                // If setting to required, verify at least one hub is associated
                if (isRequiredHub) {
                    const currentHubs = await catalogHubRepo.count({ where: { catalogId } })
                    if (currentHubs === 0) {
                        return res.status(400).json({ error: 'Cannot require hub association when catalog has no hubs' })
                    }
                }
                catalog.isRequiredHub = isRequiredHub
            }

            const saved = await catalogRepo.save(catalog)

            // Get updated hub associations for response
            const updatedAssociations = await catalogHubRepo.find({
                where: { catalogId },
                order: { sortOrder: 'ASC' }
            })
            const hubIdsForResponse = updatedAssociations.map((a) => a.hubId)
            const hubs = await hubRepo.find({
                where: { id: In(hubIdsForResponse) },
                select: ['id', 'name', 'codename']
            })

            res.json({
                ...saved,
                hubs: hubs.map((h) => ({ id: h.id, name: h.name, codename: h.codename }))
            })
        })
    )

    /**
     * DELETE /metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId
     * Delete a catalog (or remove from hub if associated with multiple hubs)
     */
    router.delete(
        '/metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId, catalogId } = req.params
            const { catalogRepo, catalogHubRepo } = repos(req)

            // Verify catalog exists and belongs to this metahub
            const catalog = await catalogRepo.findOne({ where: { id: catalogId, metahubId } })
            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            // Verify catalog is associated with this hub
            const catalogHub = await catalogHubRepo.findOne({ where: { catalogId, hubId } })
            if (!catalogHub) {
                return res.status(404).json({ error: 'Catalog not found in this hub' })
            }

            // Check if force delete is requested (query param ?force=true)
            const forceDelete = req.query.force === 'true'

            // Count total hub associations
            const totalHubs = await catalogHubRepo.count({ where: { catalogId } })

            // Check if this is the last hub and catalog requires at least one hub
            if (catalog.isRequiredHub && totalHubs === 1 && !forceDelete) {
                return res.status(409).json({
                    error: 'Cannot remove catalog from its last hub because it requires at least one hub association. Use force=true to delete the catalog entirely.'
                })
            }

            if (totalHubs > 1 && !forceDelete) {
                // Remove only from this hub
                await catalogHubRepo.remove(catalogHub)
                res.status(200).json({ message: 'Catalog removed from hub', remainingHubs: totalHubs - 1 })
            } else {
                // Delete the entire catalog (cascades to all associations)
                await catalogRepo.remove(catalog)
                res.status(204).send()
            }
        })
    )

    /**
     * DELETE /metahubs/:metahubId/catalogs/:catalogId
     * Delete a catalog directly (removes from all hubs and deletes completely)
     * Use this for catalogs without hub associations or when force-deleting
     */
    router.delete(
        '/metahubs/:metahubId/catalogs/:catalogId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, catalogId } = req.params
            const { catalogRepo } = repos(req)

            // Verify catalog exists and belongs to this metahub
            const catalog = await catalogRepo.findOne({ where: { id: catalogId, metahubId } })
            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            // Delete the catalog (CatalogHub records will cascade delete automatically)
            await catalogRepo.remove(catalog)
            res.status(204).send()
        })
    )

    return router
}
