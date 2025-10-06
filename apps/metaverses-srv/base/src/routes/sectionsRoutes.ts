import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import { Section } from '../database/entities/Section'
import { Metaverse } from '../database/entities/Metaverse'
import { MetaverseUser } from '../database/entities/MetaverseUser'
import { SectionMetaverse } from '../database/entities/SectionMetaverse'
import { Entity } from '../database/entities/Entity'
import { EntitySection } from '../database/entities/EntitySection'
import { ensureSectionAccess } from './guards'
import { z } from 'zod'

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

// Comments in English only
export function createSectionsRoutes(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
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
            sectionRepo: ds.getRepository(Section),
            metaverseRepo: ds.getRepository(Metaverse),
            metaverseUserRepo: ds.getRepository(MetaverseUser),
            sectionMetaverseRepo: ds.getRepository(SectionMetaverse),
            entityRepo: ds.getRepository(Entity),
            entitySectionRepo: ds.getRepository(EntitySection)
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

    // GET /sections
    router.get(
        '/',
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { metaverseUserRepo, sectionMetaverseRepo } = repos()

            // Get metaverses accessible to user
            const userMetaverses = await metaverseUserRepo.find({
                where: { user_id: userId }
            })
            const metaverseIds = userMetaverses.map((uc) => uc.metaverse_id)

            if (metaverseIds.length === 0) {
                return res.json([])
            }

            // Get sections from user's metaverses
            const sectionMetaverses = await sectionMetaverseRepo.find({
                where: metaverseIds.map((metaverseId) => ({ metaverse: { id: metaverseId } })),
                relations: ['section']
            })

            const sections = sectionMetaverses.map((dc) => dc.section)
            res.json(sections)
        })
    )

    // POST /sections
    router.post(
        '/',
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

            // Check if user has access to the metaverse
            const hasAccess = await checkMetaverseAccess(metaverseId, userId)
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied to this metaverse' })
            }

            const { sectionRepo, metaverseRepo, sectionMetaverseRepo } = repos()

            // Validate metaverse exists
            const metaverse = await metaverseRepo.findOne({ where: { id: metaverseId } })
            if (!metaverse) return res.status(400).json({ error: 'Invalid metaverseId' })

            const entity = sectionRepo.create({ name, description })
            const saved = await sectionRepo.save(entity)

            // Create mandatory section-metaverse link
            const sectionMetaverseLink = sectionMetaverseRepo.create({ section: saved, metaverse })
            await sectionMetaverseRepo.save(sectionMetaverseLink)

            res.status(201).json(saved)
        })
    )

    // GET /sections/:sectionId
    router.get(
        '/:sectionId',
        asyncHandler(async (req, res) => {
            const { sectionId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureSectionAccess(getDataSource(), userId, sectionId)
            const { sectionRepo } = repos()
            const section = await sectionRepo.findOne({ where: { id: sectionId } })
            if (!section) return res.status(404).json({ error: 'Section not found' })
            res.json(section)
        })
    )

    // PUT /sections/:sectionId
    router.put(
        '/:sectionId',
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
            await ensureSectionAccess(getDataSource(), userId, sectionId)
            const { sectionRepo } = repos()

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
        asyncHandler(async (req, res) => {
            const { sectionId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureSectionAccess(getDataSource(), userId, sectionId)
            const { sectionRepo } = repos()

            const section = await sectionRepo.findOne({ where: { id: sectionId } })
            if (!section) return res.status(404).json({ error: 'Section not found' })

            await sectionRepo.remove(section)
            res.status(204).send()
        })
    )

    // GET /sections/:sectionId/entities
    router.get(
        '/:sectionId/entities',
        asyncHandler(async (req, res) => {
            const { sectionId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureSectionAccess(getDataSource(), userId, sectionId)
            const { sectionRepo, entitySectionRepo } = repos()

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

    return router
}

export default createSectionsRoutes
