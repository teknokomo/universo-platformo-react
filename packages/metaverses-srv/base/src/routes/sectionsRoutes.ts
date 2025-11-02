import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-srv'
import { Section } from '../database/entities/Section'
import { Metaverse } from '../database/entities/Metaverse'
import { MetaverseUser } from '../database/entities/MetaverseUser'
import { SectionMetaverse } from '../database/entities/SectionMetaverse'
import { Entity } from '../database/entities/Entity'
import { EntitySection } from '../database/entities/EntitySection'
import { ensureSectionAccess, ensureMetaverseAccess, ensureEntityAccess } from './guards'
import { z } from 'zod'
import { parseIntSafe, escapeLikeWildcards } from '../utils'

/**
 * Get the appropriate manager for the request (RLS-enabled if available)
 */
const getRequestManager = (req: Request, dataSource: DataSource) => {
    const rlsContext = (req as RequestWithDbContext).dbContext
    return rlsContext?.manager ?? dataSource.manager
}

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

// Comments in English only
export function createSectionsRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<any>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const repos = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return {
            sectionRepo: manager.getRepository(Section),
            metaverseRepo: manager.getRepository(Metaverse),
            metaverseUserRepo: manager.getRepository(MetaverseUser),
            sectionMetaverseRepo: manager.getRepository(SectionMetaverse),
            entityRepo: manager.getRepository(Entity),
            entitySectionRepo: manager.getRepository(EntitySection)
        }
    }

    // GET /sections - with pagination, search, sorting
    router.get(
        '/',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            try {
                const limit = parseIntSafe(req.query.limit, 100, 1, 1000)
                const offset = parseIntSafe(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER)

                // Parse search parameter
                const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
                const escapedSearch = escapeLikeWildcards(search)
                // Note: No toLowerCase() needed - SQL LOWER() handles case-insensitive search

                // Safe sorting with whitelist
                const ALLOWED_SORT_FIELDS = {
                    name: 's.name',
                    created: 's.createdAt',
                    updated: 's.updatedAt'
                } as const

                const sortBy =
                    typeof req.query.sortBy === 'string' && req.query.sortBy in ALLOWED_SORT_FIELDS
                        ? ALLOWED_SORT_FIELDS[req.query.sortBy as keyof typeof ALLOWED_SORT_FIELDS]
                        : 's.updatedAt'

                const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC'

                // Get sections accessible to user through metaverse membership
                const { sectionRepo } = repos(req)
                const qb = sectionRepo
                    .createQueryBuilder('s')
                    // Join with section-metaverse link
                    .innerJoin(SectionMetaverse, 'sm', 'sm.section_id = s.id')
                    // Join with metaverse user to filter by user access
                    .innerJoin(MetaverseUser, 'mu', 'mu.metaverse_id = sm.metaverse_id')
                    // Left join with entity-section to count entities
                    .leftJoin(EntitySection, 'es', 'es.section_id = s.id')
                    .where('mu.user_id = :userId', { userId })

                // Add search filter if provided
                if (escapedSearch) {
                    qb.andWhere('(LOWER(s.name) LIKE :search OR LOWER(s.description) LIKE :search)', {
                        search: `%${escapedSearch}%`
                    })
                }

                qb.select([
                    's.id as id',
                    's.name as name',
                    's.description as description',
                    's.createdAt as created_at',
                    's.updatedAt as updated_at'
                ])
                    .addSelect('COUNT(DISTINCT es.id)', 'entitiesCount')
                    // Use window function to get total count in single query (performance optimization)
                    .addSelect('COUNT(*) OVER()', 'window_total')
                    .groupBy('s.id')
                    .addGroupBy('s.name')
                    .addGroupBy('s.description')
                    .addGroupBy('s.createdAt')
                    .addGroupBy('s.updatedAt')
                    .orderBy(sortBy, sortOrder)
                    .limit(limit)
                    .offset(offset)

                const raw = await qb.getRawMany<{
                    id: string
                    name: string
                    description: string | null
                    created_at: Date
                    updated_at: Date
                    entitiesCount: string
                    window_total?: string
                }>()

                // Extract total count from window function (same value in all rows)
                // Handle edge case: empty result set
                const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) : 0

                const response = raw.map((row) => ({
                    id: row.id,
                    name: row.name,
                    description: row.description ?? undefined,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                    entitiesCount: parseInt(row.entitiesCount || '0', 10) || 0
                }))

                // Add pagination metadata headers for client awareness
                const hasMore = offset + raw.length < total
                res.setHeader('X-Pagination-Limit', limit.toString())
                res.setHeader('X-Pagination-Offset', offset.toString())
                res.setHeader('X-Pagination-Count', raw.length.toString())
                res.setHeader('X-Total-Count', total.toString())
                res.setHeader('X-Pagination-Has-More', hasMore.toString())

                res.json(response)
            } catch (error) {
                console.error('[ERROR] GET /sections failed:', error)
                res.status(500).json({
                    error: 'Internal server error',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /sections
    router.post(
        '/',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const schema = z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                metaverseId: z.string().uuid()
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            const { name, description, metaverseId } = parsed.data
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Validate required fields
            if (!name) return res.status(400).json({ error: 'name is required' })
            if (!metaverseId)
                return res.status(400).json({ error: 'metaverseId is required - sections must be associated with a metaverse' })

            await ensureMetaverseAccess(getDataSource(), userId, metaverseId, 'createContent')

            const { sectionRepo, metaverseRepo, sectionMetaverseRepo } = repos(req)

            try {
                // Validate metaverse exists
                const metaverse = await metaverseRepo.findOne({ where: { id: metaverseId } })
                if (!metaverse) return res.status(400).json({ error: 'Invalid metaverseId' })

                const entity = sectionRepo.create({ name, description })
                const saved = await sectionRepo.save(entity)

                // Create mandatory section-metaverse link
                const sectionMetaverseLink = sectionMetaverseRepo.create({ section: saved, metaverse })
                await sectionMetaverseRepo.save(sectionMetaverseLink)

                res.status(201).json(saved)
            } catch (error) {
                console.error('POST /sections - Error:', error)
                res.status(500).json({
                    error: 'Failed to create section',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // GET /sections/:sectionId
    router.get(
        '/:sectionId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { sectionId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            await ensureSectionAccess(getDataSource(), userId, sectionId)

            const { sectionRepo, entitySectionRepo } = repos(req)

            const section = await sectionRepo.findOne({ where: { id: sectionId } })
            if (!section) return res.status(404).json({ error: 'Section not found' })

            // Get entities count for this section
            const entitiesCount = await entitySectionRepo.count({ where: { section: { id: sectionId } } })

            const response = {
                id: section.id,
                name: section.name,
                description: section.description ?? undefined,
                createdAt: section.createdAt,
                updatedAt: section.updatedAt,
                entitiesCount
            }

            res.json(response)
        })
    )

    // PUT /sections/:sectionId
    router.put(
        '/:sectionId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const schema = z
                .object({
                    name: z.string().min(1).optional(),
                    description: z.string().optional()
                })
                .refine((data) => data.name !== undefined || data.description !== undefined, {
                    message: 'At least one field (name or description) must be provided'
                })

            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            }

            const { sectionId } = req.params
            const { name, description } = parsed.data
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureSectionAccess(getDataSource(), userId, sectionId, 'editContent')
            const { sectionRepo } = repos(req)

            const section = await sectionRepo.findOne({ where: { id: sectionId } })
            if (!section) return res.status(404).json({ error: 'Section not found' })

            if (name !== undefined) section.name = name
            if (description !== undefined) section.description = description

            const updated = await sectionRepo.save(section)
            res.json(updated)
        })
    )

    // DELETE /sections/:sectionId
    router.delete(
        '/:sectionId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { sectionId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureSectionAccess(getDataSource(), userId, sectionId, 'deleteContent')
            const { sectionRepo } = repos(req)

            const section = await sectionRepo.findOne({ where: { id: sectionId } })
            if (!section) return res.status(404).json({ error: 'Section not found' })

            await sectionRepo.remove(section)
            res.status(204).send()
        })
    )

    // GET /sections/:sectionId/entities
    router.get(
        '/:sectionId/entities',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { sectionId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureSectionAccess(getDataSource(), userId, sectionId)
            const { sectionRepo, entitySectionRepo } = repos(req)

            // Validate section exists
            const section = await sectionRepo.findOne({ where: { id: sectionId } })
            if (!section) return res.status(404).json({ error: 'Section not found' })

            // Get entities linked to this section
            const links = await entitySectionRepo.find({
                where: { section: { id: sectionId } },
                relations: ['entity']
            })
            const entities = links.map((link) => link.entity)
            res.json(entities)
        })
    )

    // POST /sections/:sectionId/entities/:entityId (attach entity to section)
    router.post(
        '/:sectionId/entities/:entityId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { sectionId, entityId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Ensure user has createContent permission for the section
            await ensureSectionAccess(getDataSource(), userId, sectionId, 'createContent')

            // SECURITY: Ensure user has access to the entity before attaching
            await ensureEntityAccess(getDataSource(), userId, entityId)

            const { sectionRepo, entityRepo, entitySectionRepo } = repos(req)

            // Validate section exists
            const section = await sectionRepo.findOne({ where: { id: sectionId } })
            if (!section) return res.status(404).json({ error: 'Section not found' })

            // Validate entity exists
            const entity = await entityRepo.findOne({ where: { id: entityId } })
            if (!entity) return res.status(404).json({ error: 'Entity not found' })

            // Check if link already exists (idempotent)
            const existing = await entitySectionRepo.findOne({
                where: { section: { id: sectionId }, entity: { id: entityId } }
            })
            if (existing) return res.status(200).json(existing)

            // Create new link
            const link = entitySectionRepo.create({ section, entity })
            const saved = await entitySectionRepo.save(link)
            res.status(201).json(saved)
        })
    )

    return router
}

export default createSectionsRoutes
