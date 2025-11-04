import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-srv'
import type { MetaverseRole } from '@universo/types'
import { Entity } from '../database/entities/Entity'
import { Section } from '../database/entities/Section'
import { EntitySection } from '../database/entities/EntitySection'
import { Metaverse } from '../database/entities/Metaverse'
import { MetaverseUser } from '../database/entities/MetaverseUser'
import { SectionMetaverse } from '../database/entities/SectionMetaverse'
import { EntityMetaverse } from '../database/entities/EntityMetaverse'
import { ensureMetaverseAccess, ensureSectionAccess, ensureEntityAccess, ROLE_PERMISSIONS } from './guards'
import { z } from 'zod'
import { validateListQuery } from '../schemas/queryParams'
import { escapeLikeWildcards } from '../utils'

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

// Helper to get repositories from the data source
function getRepositories(req: Request, getDataSource: () => DataSource) {
    const dataSource = getDataSource()
    const manager = getRequestManager(req, dataSource)
    return {
        entityRepo: manager.getRepository(Entity),
        sectionRepo: manager.getRepository(Section),
        entitySectionRepo: manager.getRepository(EntitySection),
        metaverseRepo: manager.getRepository(Metaverse),
        metaverseUserRepo: manager.getRepository(MetaverseUser),
        sectionMetaverseRepo: manager.getRepository(SectionMetaverse),
        entityMetaverseRepo: manager.getRepository(EntityMetaverse)
    }
}

// Comments in English only
export function createEntitiesRouter(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })

    // All routes in this router require authentication
    router.use(ensureAuth)

    // Async handler to wrap async functions and catch errors
    const asyncHandler = (fn: (req: Request, res: Response) => Promise<any>): RequestHandler => {
        return (req, res, next) => {
            fn(req, res).catch(next)
        }
    }

    // GET / - List all entities with pagination, search, sorting
    router.get(
        '/',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            try {
                // Validate and parse query parameters with Zod
                const { limit = 100, offset = 0, sortBy = 'updated', sortOrder = 'desc', search } = validateListQuery(req.query)

                // Parse search parameter
                const escapedSearch = search ? escapeLikeWildcards(search) : ''

                // Safe sorting with whitelist
                const ALLOWED_SORT_FIELDS = {
                    name: 'e.name',
                    created: 'e.createdAt',
                    updated: 'e.updatedAt'
                } as const

                const sortByField = ALLOWED_SORT_FIELDS[sortBy]
                const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'

                // Get entities accessible to user through section membership
                const { entityRepo } = getRepositories(req, getDataSource)
                const qb = entityRepo
                    .createQueryBuilder('e')
                    // Join with entity-section link
                    .innerJoin(EntitySection, 'es', 'es.entity_id = e.id')
                    // Join with section
                    .innerJoin(Section, 's', 's.id = es.section_id')
                    // Join with section-metaverse link
                    .innerJoin(SectionMetaverse, 'sm', 'sm.section_id = s.id')
                    // Join with metaverse user to filter by user access
                    .innerJoin(MetaverseUser, 'mu', 'mu.metaverse_id = sm.metaverse_id')
                    .where('mu.user_id = :userId', { userId })

                // Add search filter if provided (hybrid approach for better UX)
                if (escapedSearch) {
                    if (escapedSearch.length < 3) {
                        // Simple LIKE for short queries (1-2 chars) - works instantly
                        qb.andWhere(
                            '(LOWER(e.name) LIKE :search OR LOWER(COALESCE(e.description, \'\')) LIKE :search)',
                            { search: `%${escapedSearch.toLowerCase()}%` }
                        )
                    } else {
                        // Full-text search for longer queries (3+ chars) - uses GIN indexes for performance
                        qb.andWhere(
                            `(
                                to_tsvector('english', e.name) @@ plainto_tsquery('english', :search) OR
                                to_tsvector('english', COALESCE(e.description, '')) @@ plainto_tsquery('english', :search)
                            )`,
                            { search: escapedSearch }
                        )
                    }
                }

                qb.select([
                    'e.id as id',
                    'e.name as name',
                    'e.description as description',
                    'e.createdAt as created_at',
                    'e.updatedAt as updated_at',
                    'mu.role as user_role'
                ])
                    // Use window function to get total count in single query (performance optimization)
                    .addSelect('COUNT(*) OVER()', 'window_total')
                    .groupBy('e.id')
                    .addGroupBy('e.name')
                    .addGroupBy('e.description')
                    .addGroupBy('e.createdAt')
                    .addGroupBy('e.updatedAt')
                    .addGroupBy('mu.role')
                    .orderBy(sortByField, sortDirection)
                    .limit(limit)
                    .offset(offset)

                const raw = await qb.getRawMany<{
                    id: string
                    name: string
                    description: string | null
                    created_at: Date
                    updated_at: Date
                    user_role: string | null
                    window_total?: string
                }>()

                // Extract total count from window function (same value in all rows)
                // Handle edge case: empty result set
                const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) : 0

                const response = raw.map((row) => {
                    const role = (row.user_role || 'member') as MetaverseRole
                    const permissions = ROLE_PERMISSIONS[role]

                    return {
                        id: row.id,
                        name: row.name,
                        description: row.description ?? undefined,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                        role,
                        permissions
                    }
                })

                // Add pagination metadata headers for client awareness
                const hasMore = offset + raw.length < total
                res.setHeader('X-Pagination-Limit', limit.toString())
                res.setHeader('X-Pagination-Offset', offset.toString())
                res.setHeader('X-Pagination-Count', raw.length.toString())
                res.setHeader('X-Total-Count', total.toString())
                res.setHeader('X-Pagination-Has-More', hasMore.toString())

                res.json(response)
            } catch (error) {
                // Handle Zod validation errors
                if (error instanceof z.ZodError) {
                    return res.status(400).json({
                        error: 'Invalid query parameters',
                        details: error.errors.map((e) => ({
                            field: e.path.join('.'),
                            message: e.message
                        }))
                    })
                }
                console.error('[ERROR] GET /entities failed:', error)
                res.status(500).json({
                    error: 'Internal server error',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST / (Create a new entity)
    router.post(
        '/',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { entityRepo, sectionRepo, entitySectionRepo, metaverseRepo, entityMetaverseRepo } = getRepositories(req, getDataSource)
            const schema = z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                sectionId: z.string().uuid(),
                metaverseId: z.string().uuid().optional()
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            const { name, description, metaverseId, sectionId } = parsed.data
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Verify access to the section
            await ensureSectionAccess(getDataSource(), userId, sectionId, 'createContent')

            try {
                // Validate section exists
                const section = await sectionRepo.findOne({ where: { id: sectionId } })
                if (!section) return res.status(400).json({ error: 'Invalid sectionId' })

                const entity = entityRepo.create({ name, description })
                await entityRepo.save(entity)

                // Create mandatory entity-section link
                const entitySectionLink = entitySectionRepo.create({ entity, section })
                await entitySectionRepo.save(entitySectionLink)

                // Optional metaverse link for atomic create-in-metaverse flow
                if (metaverseId) {
                    // Verify access to the metaverse
                    await ensureMetaverseAccess(getDataSource(), userId, metaverseId, 'createContent')

                    const metaverse = await metaverseRepo.findOne({ where: { id: metaverseId } })
                    if (!metaverse) return res.status(400).json({ error: 'Invalid metaverseId' })
                    const exists = await entityMetaverseRepo.findOne({
                        where: { metaverse: { id: metaverseId }, entity: { id: entity.id } }
                    })
                    if (!exists) {
                        const link = entityMetaverseRepo.create({ metaverse, entity })
                        await entityMetaverseRepo.save(link)
                    }
                }

                res.status(201).json(entity)
            } catch (error) {
                console.error('POST /entities - Error:', error)
                res.status(500).json({
                    error: 'Failed to create entity',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // GET /:entityId (Get a single entity)
    router.get(
        '/:entityId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureEntityAccess(getDataSource(), userId, req.params.entityId)
            const { entityRepo } = getRepositories(req, getDataSource)
            const entity = await entityRepo.findOneBy({ id: req.params.entityId })
            if (!entity) {
                return res.status(404).json({ error: 'Entity not found' })
            }
            res.json(entity)
        })
    )

    // PUT /:entityId (Update a entity)
    router.put(
        '/:entityId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureEntityAccess(getDataSource(), userId, req.params.entityId, 'editContent')
            const { entityRepo } = getRepositories(req, getDataSource)
            const entity = await entityRepo.findOneBy({ id: req.params.entityId })
            if (!entity) {
                return res.status(404).json({ error: 'Entity not found' })
            }
            const { name, description } = req.body
            entityRepo.merge(entity, { name, description })
            await entityRepo.save(entity)
            res.json(entity)
        })
    )

    // DELETE /:entityId (Delete a entity)
    router.delete(
        '/:entityId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureEntityAccess(getDataSource(), userId, req.params.entityId, 'deleteContent')
            const { entityRepo } = getRepositories(req, getDataSource)
            const result = await entityRepo.delete({ id: req.params.entityId })
            if (result.affected === 0) {
                return res.status(404).json({ error: 'Entity not found' })
            }
            res.status(204).send()
        })
    )

    // PUT /:entityId/section { sectionId }
    router.put(
        '/:entityId/section',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { entityRepo, sectionRepo, entitySectionRepo } = getRepositories(req, getDataSource)
            const entityId = req.params.entityId
            const { sectionId } = req.body || {}
            if (!sectionId) return res.status(400).json({ error: 'sectionId is required' })
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureEntityAccess(getDataSource(), userId, entityId, 'editContent')
            await ensureSectionAccess(getDataSource(), userId, sectionId, 'editContent')

            const entity = await entityRepo.findOneBy({ id: entityId })
            if (!entity) return res.status(404).json({ error: 'Entity not found' })

            const section = await sectionRepo.findOneBy({ id: sectionId })
            if (!section) return res.status(404).json({ error: 'Section not found' })

            const exists = await entitySectionRepo.findOne({ where: { entity: { id: entityId }, section: { id: sectionId } } })
            if (exists) return res.status(200).json(exists)

            const link = entitySectionRepo.create({ entity, section })
            const saved = await entitySectionRepo.save(link)
            res.status(201).json(saved)
        })
    )

    // DELETE /:entityId/section – remove all section links for the entity (simple semantics)
    router.delete(
        '/:entityId/section',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { entityRepo, entitySectionRepo } = getRepositories(req, getDataSource)
            const entityId = req.params.entityId
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureEntityAccess(getDataSource(), userId, entityId, 'deleteContent')
            const entity = await entityRepo.findOneBy({ id: entityId })
            if (!entity) return res.status(404).json({ error: 'Entity not found' })

            const links = await entitySectionRepo.find({ where: { entity: { id: entityId } } })
            if (links.length === 0) return res.status(404).json({ error: 'No section links found' })

            await entitySectionRepo.remove(links)
            res.status(204).send()
        })
    )

    return router
}

export default createEntitiesRouter
