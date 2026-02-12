import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { Metahub } from '../../../database/entities/Metahub'
import { z } from 'zod'
import { validateListQuery } from '../../shared/queryParams'
import { getRequestManager } from '../../../utils'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo/utils/vlc'
import { normalizeCodename, isValidCodename } from '@universo/utils/validation/codename'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'
import { KnexClient } from '../../ddl'

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

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
    sortOrder: z.number().int().optional(),
    expectedVersion: z.number().int().positive().optional() // For optimistic locking
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

    const services = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        const schemaService = new MetahubSchemaService(ds, undefined, manager)
        const objectsService = new MetahubObjectsService(schemaService)
        const hubsService = new MetahubHubsService(schemaService)
        return {
            metahubRepo: manager.getRepository(Metahub),
            schemaService,
            objectsService,
            hubsService
        }
    }

    /**
     * Helper function to find catalogs that would block hub deletion.
     * Uses SQL-level JSONB filtering instead of loading all catalogs into memory.
     * Returns catalogs with isRequiredHub=true that have this as their ONLY hub association.
     */
    const findBlockingCatalogs = async (metahubId: string, hubId: string, schemaService: MetahubSchemaService, userId?: string) => {
        const schemaName = await schemaService.ensureSchema(metahubId, userId)
        const knex = KnexClient.getInstance()

        // SQL-level filtering using JSONB operators
        const catalogs = await knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ kind: 'catalog' })
            // hubId exists in config.hubs array
            .whereRaw(`config->'hubs' @> ?::jsonb`, [JSON.stringify([hubId])])
            // isRequiredHub is true
            .whereRaw(`(config->>'isRequiredHub')::boolean = true`)
            // hubs array has exactly 1 element
            .whereRaw(`jsonb_array_length(config->'hubs') = 1`)
            .select('id', 'codename', 'presentation')

        return catalogs.map((c: any) => ({
            id: c.id,
            name: c.presentation?.name,
            codename: c.codename
        }))
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

            // Calculate catalog counts
            const catalogs = await objectsService.findAll(metahubId, userId)
            const counts = new Map<string, number>()

            for (const catalog of catalogs) {
                const hubIds: string[] = (catalog as any).config?.hubs || []
                for (const hid of hubIds) {
                    counts.set(hid, (counts.get(hid) || 0) + 1)
                }
            }

            const items = hubs.map((h: any) => ({
                id: h.id,
                codename: h.codename,
                name: h.name,
                description: h.description,
                sortOrder: h.sort_order,
                version: h._upl_version || 1,
                createdAt: h.created_at,
                updatedAt: h.updated_at,
                catalogsCount: counts.get(h.id) || 0
            }))

            res.json({ items, pagination: { total, limit, offset } })
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
            const { metahubRepo, hubsService } = services(req)
            const userId = resolveUserId(req)

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

            const saved = await hubsService.create(
                metahubId,
                {
                    codename: normalizedCodename,
                    name: nameVlc as unknown as Record<string, unknown>,
                    description: descriptionVlc as unknown as Record<string, unknown> | undefined,
                    sortOrder: sortOrder ?? 0,
                    createdBy: userId
                },
                userId
            )

            res.status(201).json({
                id: saved.id,
                codename: saved.codename,
                name: saved.name,
                description: saved.description,
                sortOrder: saved.sort_order,
                version: saved._upl_version || 1,
                createdAt: saved.created_at,
                updatedAt: saved.updated_at
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
            const { hubsService } = services(req)
            const userId = resolveUserId(req)

            const hub = await hubsService.findById(metahubId, hubId, userId)
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const parsed = updateHubSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, sortOrder, namePrimaryLocale, descriptionPrimaryLocale, expectedVersion } = parsed.data

            const updateData: any = {}

            if (codename !== undefined) {
                const normalizedCodename = normalizeCodename(codename)
                if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
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

            if (sortOrder !== undefined) {
                updateData.sortOrder = sortOrder
            }

            if (expectedVersion !== undefined) {
                updateData.expectedVersion = expectedVersion
            }

            updateData.updatedBy = userId

            const saved = await hubsService.update(metahubId, hubId, updateData, userId)

            res.json({
                id: saved.id,
                codename: saved.codename,
                name: saved.name,
                description: saved.description,
                sortOrder: saved.sort_order,
                version: saved._upl_version || 1,
                createdAt: saved.created_at,
                updatedAt: saved.updated_at
            })
        })
    )

    /**
     * GET /metahub/:metahubId/hub/:hubId/blocking-catalogs
     * Get catalogs that would block this hub's deletion
     * (catalogs with isRequiredHub=true that have this as their only hub)
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

            // Use helper function to find blocking catalogs
            const blockingCatalogs = await findBlockingCatalogs(metahubId, hubId, schemaService, userId)

            res.json({
                hubId,
                blockingCatalogs,
                canDelete: blockingCatalogs.length === 0
            })
        })
    )

    /**
     * DELETE /metahub/:metahubId/hub/:hubId
     * Delete a hub (blocked if catalogs with isRequiredHub=true would become orphaned)
     */
    router.delete(
        '/metahub/:metahubId/hub/:hubId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { hubsService, schemaService } = services(req)
            const userId = resolveUserId(req)

            const hub = await hubsService.findById(metahubId, hubId, userId)
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            // Use helper function to check for blocking catalogs
            const blockingCatalogs = await findBlockingCatalogs(metahubId, hubId, schemaService, userId)

            if (blockingCatalogs.length > 0) {
                return res.status(409).json({
                    error: 'Cannot delete hub: catalogs with required hub flag would become orphaned',
                    blockingCatalogs
                })
            }

            await hubsService.delete(metahubId, hubId, userId)
            res.status(204).send()
        })
    )

    return router
}
