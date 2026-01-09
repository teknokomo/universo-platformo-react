import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-backend'
import { Hub } from '../database/entities/Hub'
import { Attribute } from '../database/entities/Attribute'
import { Metahub } from '../database/entities/Metahub'
import { HubRecord } from '../database/entities/Record'
import { z } from 'zod'
import { validateListQuery } from '../schemas/queryParams'
import { escapeLikeWildcards } from '../utils'
import { createLocalizedContent, updateLocalizedContentLocale } from '@universo/utils'
import type { VersionedLocalizedContent } from '@universo/types'
import { isValidLocaleCode } from '@universo/types'

/**
 * Get the appropriate manager for the request (RLS-enabled if available)
 */
const getRequestManager = (req: Request, dataSource: DataSource) => {
    const rlsContext = (req as RequestWithDbContext).dbContext
    return rlsContext?.manager ?? dataSource.manager
}

const CODENAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const normalizeCodename = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')

const isValidCodename = (value: string) => CODENAME_PATTERN.test(value)

const sanitizeLocalizedInput = (input: Record<string, string | undefined>) => {
    const sanitized: Record<string, string> = {}
    for (const [locale, value] of Object.entries(input)) {
        if (typeof value !== 'string') continue
        const trimmedValue = value.trim()
        if (!trimmedValue) continue
        const normalized = locale.trim().replace('_', '-')
        const [lang, region] = normalized.split('-')
        const normalizedCode = region ? `${lang.toLowerCase()}-${region.toUpperCase()}` : lang.toLowerCase()
        if (!isValidLocaleCode(normalizedCode)) continue
        sanitized[normalizedCode] = trimmedValue
    }
    return sanitized
}

const buildLocalizedContent = (
    input: Record<string, string>,
    primaryLocale?: string,
    fallbackPrimary?: string
): VersionedLocalizedContent<string> | undefined => {
    const localeCodes = Object.keys(input).sort()
    if (localeCodes.length === 0) return undefined

    const primaryCandidate =
        primaryLocale && input[primaryLocale] ? primaryLocale : fallbackPrimary && input[fallbackPrimary] ? fallbackPrimary : undefined
    const primary = primaryCandidate ?? localeCodes[0]
    let content = createLocalizedContent(primary, input[primary] ?? '')

    for (const locale of localeCodes) {
        if (locale === primary) continue
        const value = input[locale]
        if (typeof value !== 'string') continue
        content = updateLocalizedContentLocale(content, locale, value)
    }

    return content
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
            attributeRepo: manager.getRepository(Attribute),
            recordRepo: manager.getRepository(HubRecord),
            metahubRepo: manager.getRepository(Metahub)
        }
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
            const { hubRepo, attributeRepo, recordRepo } = repos(req)

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

            let qb = hubRepo.createQueryBuilder('h').where('h.metahubId = :metahubId', { metahubId })

            if (search) {
                const escapedSearch = escapeLikeWildcards(search)
                qb = qb.andWhere(
                    "(h.name::text ILIKE :search OR COALESCE(h.description::text, '') ILIKE :search OR h.codename ILIKE :search)",
                    { search: `%${escapedSearch}%` }
                )
            }

            const orderColumn =
                sortBy === 'name'
                    ? "COALESCE(h.name->>(h.name->>'_primary'), h.name->>'en', '')"
                    : sortBy === 'created'
                    ? 'h.created_at'
                    : 'h.updated_at'
            qb = qb
                .orderBy(orderColumn, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')
                .skip(offset)
                .take(limit)

            const [hubs, total] = await qb.getManyAndCount()

            const hubsWithCounts = await Promise.all(
                hubs.map(async (hub) => {
                    const [attributesCount, recordsCount] = await Promise.all([
                        attributeRepo.count({ where: { hubId: hub.id } }),
                        recordRepo.count({ where: { hubId: hub.id } })
                    ])
                    return { ...hub, attributesCount, recordsCount }
                })
            )

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
     * DELETE /metahubs/:metahubId/hubs/:hubId
     * Delete a hub
     */
    router.delete(
        '/metahubs/:metahubId/hubs/:hubId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId } = req.params
            const { hubRepo } = repos(req)

            const hub = await hubRepo.findOne({ where: { id: hubId, metahubId } })
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            await hubRepo.remove(hub)
            res.status(204).send()
        })
    )

    return router
}
