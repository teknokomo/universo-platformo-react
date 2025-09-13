import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import { Entity } from '../database/entities/Entity'
import { Section } from '../database/entities/Section'
import { EntitySection } from '../database/entities/EntitySection'
import { Metaverse } from '../database/entities/Metaverse'
import { MetaverseUser } from '../database/entities/MetaverseUser'
import { SectionMetaverse } from '../database/entities/SectionMetaverse'
import { EntityMetaverse } from '../database/entities/EntityMetaverse'
import { ensureMetaverseAccess, ensureSectionAccess, ensureEntityAccess } from './guards'
import { z } from 'zod'

// Helper to get repositories from the data source
function getRepositories(getDataSource: () => DataSource) {
    const dataSource = getDataSource()
    return {
        entityRepo: dataSource.getRepository(Entity),
        sectionRepo: dataSource.getRepository(Section),
        entitySectionRepo: dataSource.getRepository(EntitySection),
        metaverseRepo: dataSource.getRepository(Metaverse),
        metaverseUserRepo: dataSource.getRepository(MetaverseUser),
        sectionMetaverseRepo: dataSource.getRepository(SectionMetaverse),
        entityMetaverseRepo: dataSource.getRepository(EntityMetaverse)
    }
}

// Main function to create the entities router
export function createEntitiesRouter(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
    const router = Router({ mergeParams: true })

    // All routes in this router require authentication
    router.use(ensureAuth)

    // Async handler to wrap async functions and catch errors
    const asyncHandler = (fn: (req: Request, res: Response) => Promise<any>): RequestHandler => {
        return (req, res, next) => {
            fn(req, res).catch(next)
        }
    }

    // Helper function to check if user has access to metaverse
    const checkMetaverseAccess = async (metaverseId: string, userId: string) => {
        const { metaverseUserRepo } = getRepositories(getDataSource)
        const userMetaverse = await metaverseUserRepo.findOne({
            where: { metaverse_id: metaverseId, user_id: userId }
        })
        return userMetaverse !== null
    }

    // Helper function to check if user has access to section (through its metaverse)
    const checkSectionAccess = async (sectionId: string, userId: string) => {
        const { sectionMetaverseRepo } = getRepositories(getDataSource)
        const sectionMetaverse = await sectionMetaverseRepo.findOne({
            where: { section: { id: sectionId } },
            relations: ['metaverse']
        })
        if (!sectionMetaverse) return false
        return await checkMetaverseAccess(sectionMetaverse.metaverse.id, userId)
    }

    // --- Entity CRUD (flat, no categories) ---

    // GET / (List all entities)
    router.get(
        '/',
        asyncHandler(async (req: Request, res: Response) => {
            const userId = (req as any).user?.sub
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { metaverseUserRepo, sectionMetaverseRepo, entitySectionRepo } = getRepositories(getDataSource)

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
            const sectionIds = sectionMetaverses.map((dc) => dc.section.id)

            if (sectionIds.length === 0) {
                return res.json([])
            }

            // Get entities from user's sections
            const entitySections = await entitySectionRepo.find({
                where: sectionIds.map((sectionId) => ({ section: { id: sectionId } })),
                relations: ['entity']
            })

            const entities = entitySections.map((rd) => rd.entity)

            // Remove duplicates
            const uniqueEntities = entities.filter((entity, index, self) => index === self.findIndex((r) => r.id === entity.id))

            res.json(uniqueEntities)
        })
    )

    // POST / (Create a new entity)
    router.post(
        '/',
        asyncHandler(async (req: Request, res: Response) => {
            const { entityRepo, sectionRepo, entitySectionRepo, metaverseRepo, entityMetaverseRepo } = getRepositories(getDataSource)
            const schema = z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                sectionId: z.string().uuid(),
                metaverseId: z.string().uuid().optional()
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            const { name, description, metaverseId, sectionId } = parsed.data
            const userId = (req as any).user?.sub

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Verify access to the section
            await ensureSectionAccess(getDataSource(), userId, sectionId)

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
                await ensureMetaverseAccess(getDataSource(), userId, metaverseId)

                const metaverse = await metaverseRepo.findOne({ where: { id: metaverseId } })
                if (!metaverse) return res.status(400).json({ error: 'Invalid metaverseId' })
                const exists = await entityMetaverseRepo.findOne({ where: { metaverse: { id: metaverseId }, entity: { id: entity.id } } })
                if (!exists) {
                    const link = entityMetaverseRepo.create({ metaverse, entity })
                    await entityMetaverseRepo.save(link)
                }
            }

            res.status(201).json(entity)
        })
    )

    // GET /:entityId (Get a single entity)
    router.get(
        '/:entityId',
        asyncHandler(async (req: Request, res: Response) => {
            const userId = (req as any).user?.sub
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureEntityAccess(getDataSource(), userId, req.params.entityId)
            const { entityRepo } = getRepositories(getDataSource)
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
        asyncHandler(async (req: Request, res: Response) => {
            const userId = (req as any).user?.sub
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureEntityAccess(getDataSource(), userId, req.params.entityId)
            const { entityRepo } = getRepositories(getDataSource)
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
        asyncHandler(async (req: Request, res: Response) => {
            const userId = (req as any).user?.sub
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureEntityAccess(getDataSource(), userId, req.params.entityId)
            const { entityRepo } = getRepositories(getDataSource)
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
        asyncHandler(async (req: Request, res: Response) => {
            const { entityRepo, sectionRepo, entitySectionRepo } = getRepositories(getDataSource)
            const entityId = req.params.entityId
            const { sectionId } = req.body || {}
            if (!sectionId) return res.status(400).json({ error: 'sectionId is required' })
            const userId = (req as any).user?.sub
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureEntityAccess(getDataSource(), userId, entityId)
            await ensureSectionAccess(getDataSource(), userId, sectionId)

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
        asyncHandler(async (req: Request, res: Response) => {
            const { entityRepo, entitySectionRepo } = getRepositories(getDataSource)
            const entityId = req.params.entityId
            const userId = (req as any).user?.sub
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureEntityAccess(getDataSource(), userId, entityId)
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
