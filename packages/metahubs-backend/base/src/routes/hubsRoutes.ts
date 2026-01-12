import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { Hub } from '../database/entities/Hub'
import { Catalog } from '../database/entities/Catalog'
import { CatalogHub } from '../database/entities/CatalogHub'
import { Metahub } from '../database/entities/Metahub'
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

const createHubSchema = z.object({
    codename: z.string().min(1).max(100),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sortOrder: z.number().int().optional()
})

const updateHubSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sortOrder: z.number().int().optional()
})

export function createHubsRoutes(
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
            hubRepo: manager.getRepository(Hub),
            catalogRepo: manager.getRepository(Catalog),
            catalogHubRepo: manager.getRepository(CatalogHub),
            metahubRepo: manager.getRepository(Metahub)
        }
    }

    /**
     * Helper function to find catalogs that would block hub deletion.
     * Returns catalogs with isRequiredHub=true that have this as their ONLY hub association.
     */
    const findBlockingCatalogs = async (hubId: string, catalogRepo: ReturnType<typeof repos>['catalogRepo']) => {
        return catalogRepo
            .createQueryBuilder('c')
            .innerJoin('c.catalogHubs', 'ch')
            .where('ch.hubId = :hubId', { hubId })
            .andWhere('c.isRequiredHub = true')
            .andWhere((qb) => {
                const subQuery = qb
                    .subQuery()
                    .select('COUNT(*)')
                    .from(CatalogHub, 'ch2')
                    .where('ch2.catalogId = c.id')
                    .getQuery()
                return `(${subQuery}) = 1`
            })
            .select(['c.id', 'c.name', 'c.codename'])
            .getMany()
    }

    /**
     * GET /metahubs/:metahubId/hubs
     * List all hubs in a metahub
     */
    router.get(
        '/metahubs/:metahubId/hubs',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const { hubRepo } = repos(req)

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

            // Optimized single query with LEFT JOIN via junction table and window function (N+1 → 1 query)
            const qb = hubRepo
                .createQueryBuilder('h')
                .leftJoin(CatalogHub, 'ch', 'ch.hubId = h.id')
                .where('h.metahubId = :metahubId', { metahubId })

            if (search) {
                const escapedSearch = escapeLikeWildcards(search)
                qb.andWhere("(h.name::text ILIKE :search OR COALESCE(h.description::text, '') ILIKE :search OR h.codename ILIKE :search)", {
                    search: `%${escapedSearch}%`
                })
            }

            const orderColumn =
                sortBy === 'name'
                    ? "COALESCE(h.name->>(h.name->>'_primary'), h.name->>'en', '')"
                    : sortBy === 'created'
                    ? 'h.created_at'
                    : 'h.updated_at'

            qb.select([
                'h.id as id',
                'h.metahubId as "metahubId"',
                'h.codename as codename',
                'h.name as name',
                'h.description as description',
                'h.sortOrder as "sortOrder"',
                'h.created_at as "createdAt"',
                'h.updated_at as "updatedAt"'
            ])
                .addSelect('COUNT(DISTINCT ch.catalog_id)', 'catalogsCount')
                .addSelect('COUNT(*) OVER()', 'window_total')
                .groupBy('h.id')
                .orderBy(orderColumn, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')
                .limit(limit)
                .offset(offset)

            const raw = await qb.getRawMany<{
                id: string
                metahubId: string
                codename: string
                name: Record<string, string> | null
                description: Record<string, string> | null
                sortOrder: number
                createdAt: Date
                updatedAt: Date
                catalogsCount: string
                window_total?: string
            }>()

            // Extract total count from window function (same value in all rows)
            const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) : 0

            const hubsWithCounts = raw.map((row) => ({
                id: row.id,
                metahubId: row.metahubId,
                codename: row.codename,
                name: row.name,
                description: row.description,
                sortOrder: row.sortOrder,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                catalogsCount: parseInt(row.catalogsCount || '0', 10)
            }))

            res.json({ items: hubsWithCounts, pagination: { total, limit, offset } })
        })
    )

    /**
     * GET /metahubs/:metahubId/hubs/:hubId
     * Get a single hub
     */
    router.get(
        '/metahubs/:metahubId/hubs/:hubId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { hubRepo } = repos(req)

            const hub = await hubRepo.findOne({
                where: { id: hubId, metahubId }
            })

            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            res.json(hub)
        })
    )

    /**
     * POST /metahubs/:metahubId/hubs
     * Create a new hub
     */
    router.post(
        '/metahubs/:metahubId/hubs',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const { hubRepo, metahubRepo } = repos(req)

            // Verify metahub exists
            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const parsed = createHubSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, sortOrder, namePrimaryLocale, descriptionPrimaryLocale } = parsed.data

            const normalizedCodename = normalizeCodename(codename)
            if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            // Check for duplicate codename
            const existing = await hubRepo.findOne({ where: { metahubId, codename: normalizedCodename } })
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

            const hub = hubRepo.create({
                metahubId,
                codename: normalizedCodename,
                name: nameVlc,
                description: descriptionVlc,
                sortOrder: sortOrder ?? 0
            })

            const saved = await hubRepo.save(hub)
            res.status(201).json(saved)
        })
    )

    /**
     * PATCH /metahubs/:metahubId/hubs/:hubId
     * Update a hub
     */
    router.patch(
        '/metahubs/:metahubId/hubs/:hubId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { hubRepo } = repos(req)

            const hub = await hubRepo.findOne({ where: { id: hubId, metahubId } })
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const parsed = updateHubSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, sortOrder, namePrimaryLocale, descriptionPrimaryLocale } = parsed.data

            if (codename !== undefined) {
                const normalizedCodename = normalizeCodename(codename)
                if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                    })
                }
                if (normalizedCodename !== hub.codename) {
                    const existing = await hubRepo.findOne({ where: { metahubId, codename: normalizedCodename } })
                    if (existing) {
                        return res.status(409).json({ error: 'Hub with this codename already exists' })
                    }
                    hub.codename = normalizedCodename
                }
            }

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? hub.name?._primary ?? 'en'
                const nameVlc = buildLocalizedContent(sanitizedName, primary, primary)
                if (nameVlc) {
                    hub.name = nameVlc
                }
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const primary = descriptionPrimaryLocale ?? hub.description?._primary ?? hub.name?._primary ?? namePrimaryLocale ?? 'en'
                    const descriptionVlc = buildLocalizedContent(sanitizedDescription, primary, primary)
                    if (descriptionVlc) {
                        hub.description = descriptionVlc
                    }
                } else {
                    hub.description = undefined
                }
            }

            if (sortOrder !== undefined) {
                hub.sortOrder = sortOrder
            }

            const saved = await hubRepo.save(hub)
            res.json(saved)
        })
    )

    /**
     * GET /metahubs/:metahubId/hubs/:hubId/blocking-catalogs
     * Get catalogs that would block this hub's deletion
     * (catalogs with isRequiredHub=true that have this as their only hub)
     */
    router.get(
        '/metahubs/:metahubId/hubs/:hubId/blocking-catalogs',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { hubRepo, catalogRepo } = repos(req)

            const hub = await hubRepo.findOne({ where: { id: hubId, metahubId } })
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            // Use helper function to find blocking catalogs
            const blockingCatalogs = await findBlockingCatalogs(hubId, catalogRepo)

            res.json({
                hubId,
                blockingCatalogs: blockingCatalogs.map((c) => ({
                    id: c.id,
                    name: c.name,
                    codename: c.codename
                })),
                canDelete: blockingCatalogs.length === 0
            })
        })
    )

    /**
     * DELETE /metahubs/:metahubId/hubs/:hubId
     * Delete a hub (blocked if catalogs with isRequiredHub=true would become orphaned)
     */
    router.delete(
        '/metahubs/:metahubId/hubs/:hubId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { hubRepo, catalogRepo } = repos(req)

            const hub = await hubRepo.findOne({ where: { id: hubId, metahubId } })
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            // Use helper function to check for blocking catalogs
            const blockingCatalogs = await findBlockingCatalogs(hubId, catalogRepo)

            if (blockingCatalogs.length > 0) {
                return res.status(409).json({
                    error: 'Cannot delete hub: catalogs with required hub flag would become orphaned',
                    blockingCatalogs: blockingCatalogs.map((c) => ({
                        id: c.id,
                        name: c.name,
                        codename: c.codename
                    }))
                })
            }

            await hubRepo.remove(hub)
            res.status(204).send()
        })
    )

    return router
}
