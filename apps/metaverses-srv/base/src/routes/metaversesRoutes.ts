import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import { Metaverse } from '../database/entities/Metaverse'
import { MetaverseUser } from '../database/entities/MetaverseUser'
import { Entity } from '../database/entities/Entity'
import { EntityMetaverse } from '../database/entities/EntityMetaverse'
import { Section } from '../database/entities/Section'
import { SectionMetaverse } from '../database/entities/SectionMetaverse'
import { ensureMetaverseAccess, ensureSectionAccess } from './guards'

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

// Comments in English only
export function createMetaversesRoutes(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<any>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const repos = () => {
        const ds = getDataSource()
        return {
            metaverseRepo: ds.getRepository(Metaverse),
            metaverseUserRepo: ds.getRepository(MetaverseUser),
            entityRepo: ds.getRepository(Entity),
            linkRepo: ds.getRepository(EntityMetaverse),
            sectionRepo: ds.getRepository(Section),
            sectionLinkRepo: ds.getRepository(SectionMetaverse)
        }
    }

    // Helper function to check if user has access to metaverse
    const checkMetaverseAccess = async (metaverseId: string, userId: string) => {
        const { metaverseUserRepo } = repos()
        const userMetaverse = await metaverseUserRepo.findOne({
            where: { metaverse_id: metaverseId, user_id: userId }
        })
        return userMetaverse !== null
    }

    // GET /metaverses
    router.get(
        '/',
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            try {
                // Parse pagination parameters with validation
                const parseIntSafe = (value: any, defaultValue: number, min: number, max: number): number => {
                    const parsed = parseInt(String(value || ''), 10)
                    if (!Number.isFinite(parsed)) return defaultValue
                    return Math.max(min, Math.min(max, parsed))
                }

                const limit = parseIntSafe(req.query.limit, 20, 1, 100)
                const offset = parseIntSafe(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER)

                // Safe sorting with whitelist
                const ALLOWED_SORT_FIELDS = {
                    name: 'm.name',
                    created: 'm.createdAt',
                    updated: 'm.updatedAt'
                } as const

                const sortBy =
                    typeof req.query.sortBy === 'string' && req.query.sortBy in ALLOWED_SORT_FIELDS
                        ? ALLOWED_SORT_FIELDS[req.query.sortBy as keyof typeof ALLOWED_SORT_FIELDS]
                        : 'm.updatedAt'

                const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC'

                // Aggregate counts per metaverse in a single query filtered by current user membership
                const { metaverseRepo } = repos()
                const qb = metaverseRepo
                    .createQueryBuilder('m')
                    // Join using entity classes to respect schema mapping and avoid alias parsing issues
                    .innerJoin(MetaverseUser, 'mu', 'mu.metaverse_id = m.id')
                    .leftJoin(SectionMetaverse, 'sm', 'sm.metaverse_id = m.id')
                    .leftJoin(EntityMetaverse, 'em', 'em.metaverse_id = m.id')
                    .where('mu.user_id = :userId', { userId })
                    .select([
                        'm.id as id',
                        'm.name as name',
                        'm.description as description',
                        // Use entity property names; TypeORM will map to actual column names
                        'm.createdAt as created_at',
                        'm.updatedAt as updated_at'
                    ])
                    .addSelect('COUNT(DISTINCT sm.id)', 'sectionsCount')
                    .addSelect('COUNT(DISTINCT em.id)', 'entitiesCount')
                    .groupBy('m.id')
                    .addGroupBy('m.name')
                    .addGroupBy('m.description')
                    .addGroupBy('m.createdAt')
                    .addGroupBy('m.updatedAt')
                    .orderBy(sortBy, sortOrder)
                    .limit(limit)
                    .offset(offset)

                const raw = await qb.getRawMany<{
                    id: string
                    name: string
                    description: string | null
                    created_at: Date
                    updated_at: Date
                    sectionsCount: string
                    entitiesCount: string
                }>()

                const response = raw.map((row) => ({
                    id: row.id,
                    name: row.name,
                    description: row.description ?? undefined,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                    sectionsCount: parseInt(row.sectionsCount || '0', 10) || 0,
                    entitiesCount: parseInt(row.entitiesCount || '0', 10) || 0
                }))

                res.json(response)
            } catch (error) {
                console.error('[ERROR] GET /metaverses failed:', error)
                res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) })
            }
        })
    )

    // POST /metaverses
    router.post(
        '/',
        asyncHandler(async (req, res) => {
            // Debug logs removed to keep production logs clean

            const { name, description } = req.body || {}
            if (!name) return res.status(400).json({ error: 'name is required' })

            // Get user ID from middleware (req.user should be set by ensureAuth)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { metaverseRepo, metaverseUserRepo } = repos()

            try {
                // Create metaverse
                // Creating metaverse
                const entity = metaverseRepo.create({ name, description })
                const saved = await metaverseRepo.save(entity)

                // Create metaverse-user relationship (user becomes owner)
                // Creating metaverse-user relationship
                const metaverseUser = metaverseUserRepo.create({
                    metaverse_id: saved.id,
                    user_id: userId,
                    role: 'owner'
                })
                const _savedMetaverseUser = await metaverseUserRepo.save(metaverseUser)

                res.status(201).json(saved)
            } catch (error) {
                console.error('POST /metaverses - Error:', error)
                res.status(500).json({
                    error: 'Failed to create metaverse',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    router.put(
        '/:metaverseId',
        asyncHandler(async (req, res) => {
            const { metaverseId } = req.params
            const { name, description } = req.body || {}
            if (!name) {
                return res.status(400).json({ error: 'name is required' })
            }

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { metaverseRepo, metaverseUserRepo } = repos()
            const membership = await metaverseUserRepo.findOne({ where: { metaverse_id: metaverseId, user_id: userId } })
            if (!membership || membership.role !== 'owner') {
                return res.status(403).json({ error: 'Not authorized to update this metaverse' })
            }

            const metaverse = await metaverseRepo.findOne({ where: { id: metaverseId } })
            if (!metaverse) {
                return res.status(404).json({ error: 'Metaverse not found' })
            }

            metaverse.name = name
            metaverse.description = description

            const saved = await metaverseRepo.save(metaverse)
            res.json(saved)
        })
    )

    router.delete(
        '/:metaverseId',
        asyncHandler(async (req, res) => {
            const { metaverseId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { metaverseRepo, metaverseUserRepo } = repos()
            const membership = await metaverseUserRepo.findOne({ where: { metaverse_id: metaverseId, user_id: userId } })
            if (!membership || membership.role !== 'owner') {
                return res.status(403).json({ error: 'Not authorized to delete this metaverse' })
            }

            const metaverse = await metaverseRepo.findOne({ where: { id: metaverseId } })
            if (!metaverse) {
                return res.status(404).json({ error: 'Metaverse not found' })
            }

            await metaverseRepo.remove(metaverse)
            res.status(204).send()
        })
    )

    // GET /metaverses/:metaverseId/entities
    router.get(
        '/:metaverseId/entities',
        asyncHandler(async (req, res) => {
            const { metaverseId } = req.params
            const userId = resolveUserId(req)
            // Debug log removed

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Check if user has access to this metaverse
            const hasAccess = await checkMetaverseAccess(metaverseId, userId)
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied to this metaverse' })
            }

            const { linkRepo } = repos()
            try {
                const links = await linkRepo.find({ where: { metaverse: { id: metaverseId } }, relations: ['entity', 'metaverse'] })
                const entities = links.map((l) => ({ ...l.entity, sortOrder: l.sortOrder }))
                // Debug log removed
                res.json(entities)
            } catch (error) {
                console.error(`GET /metaverses/${metaverseId}/entities - Error:`, error)
                res.status(500).json({
                    error: 'Failed to get metaverse entities',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /metaverses/:metaverseId/entities/:entityId (attach)
    router.post(
        '/:metaverseId/entities/:entityId',
        asyncHandler(async (req, res) => {
            const { metaverseId, entityId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureMetaverseAccess(getDataSource(), userId, metaverseId)
            const { linkRepo, metaverseRepo, entityRepo } = repos()
            const metaverse = await metaverseRepo.findOne({ where: { id: metaverseId } })
            const entity = await entityRepo.findOne({ where: { id: entityId } })
            if (!metaverse || !entity) return res.status(404).json({ error: 'Not found' })
            // Avoid duplicates at API level (no UNIQUE in DB as per requirements)
            const exists = await linkRepo.findOne({ where: { metaverse: { id: metaverseId }, entity: { id: entityId } } })
            if (exists) return res.status(200).json(exists)
            const link = linkRepo.create({ metaverse, entity })
            const saved = await linkRepo.save(link)
            res.status(201).json(saved)
        })
    )

    // DELETE /metaverses/:metaverseId/entities/:entityId (detach)
    router.delete(
        '/:metaverseId/entities/:entityId',
        asyncHandler(async (req, res) => {
            const { metaverseId, entityId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureMetaverseAccess(getDataSource(), userId, metaverseId)
            const { linkRepo } = repos()
            const existing = await linkRepo.findOne({ where: { metaverse: { id: metaverseId }, entity: { id: entityId } } })
            if (!existing) return res.status(404).json({ error: 'Link not found' })
            await linkRepo.remove(existing)
            res.status(204).send()
        })
    )

    // POST /metaverses/:metaverseId/entities/reorder { items: [{entityId, sortOrder}] }
    router.post(
        '/:metaverseId/entities/reorder',
        asyncHandler(async (req, res) => {
            const { metaverseId } = req.params
            const { items } = req.body || {}
            if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' })
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureMetaverseAccess(getDataSource(), userId, metaverseId)
            const { linkRepo } = repos()
            for (const it of items) {
                if (!it?.entityId) continue
                const link = await linkRepo.findOne({ where: { metaverse: { id: metaverseId }, entity: { id: it.entityId } } })
                if (link) {
                    link.sortOrder = Number(it.sortOrder) || 1
                    await linkRepo.save(link)
                }
            }
            res.json({ success: true })
        })
    )

    // --- Sections in metaverse ---

    // GET /metaverses/:metaverseId/sections
    router.get(
        '/:metaverseId/sections',
        asyncHandler(async (req, res) => {
            const { metaverseId } = req.params
            const userId = resolveUserId(req)
            // Debug log removed

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Check if user has access to this metaverse
            const hasAccess = await checkMetaverseAccess(metaverseId, userId)
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied to this metaverse' })
            }

            const { sectionLinkRepo } = repos()
            try {
                const links = await sectionLinkRepo.find({ where: { metaverse: { id: metaverseId } }, relations: ['section', 'metaverse'] })
                const sections = links.map((l) => l.section)
                // Debug log removed
                res.json(sections)
            } catch (error) {
                console.error(`GET /metaverses/${metaverseId}/sections - Error:`, error)
                res.status(500).json({
                    error: 'Failed to get metaverse sections',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /metaverses/:metaverseId/sections/:sectionId (attach)
    router.post(
        '/:metaverseId/sections/:sectionId',
        asyncHandler(async (req, res) => {
            const { metaverseId, sectionId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            // Ensure the user can access both the metaverse and the section
            await ensureMetaverseAccess(getDataSource(), userId, metaverseId)
            await ensureSectionAccess(getDataSource(), userId, sectionId)
            const { metaverseRepo, sectionRepo, sectionLinkRepo } = repos()
            const metaverse = await metaverseRepo.findOne({ where: { id: metaverseId } })
            const section = await sectionRepo.findOne({ where: { id: sectionId } })
            if (!metaverse || !section) return res.status(404).json({ error: 'Not found' })

            const exists = await sectionLinkRepo.findOne({ where: { metaverse: { id: metaverseId }, section: { id: sectionId } } })
            if (exists) return res.status(200).json(exists)

            const link = sectionLinkRepo.create({ metaverse, section })
            const saved = await sectionLinkRepo.save(link)
            res.status(201).json(saved)
        })
    )

    return router
}

export default createMetaversesRoutes
