import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import { EntityStatus } from '../database/entities/EntityStatus'
import { EntityTemplate } from '../database/entities/EntityTemplate'
import { Entity } from '../database/entities/Entity'
import { EntityOwner } from '../database/entities/EntityOwner'
import { EntityResource } from '../database/entities/EntityResource'
import { Resource } from '@universo/resources-srv'

export function getRepositories(dataSource: DataSource) {
    return {
        statusRepo: dataSource.getRepository(EntityStatus),
        templateRepo: dataSource.getRepository(EntityTemplate),
        entityRepo: dataSource.getRepository(Entity),
        ownerRepo: dataSource.getRepository(EntityOwner),
        resourceRepo: dataSource.getRepository(EntityResource),
        resourceBaseRepo: dataSource.getRepository(Resource)
    }
}

export function createEntitiesRouter(ensureAuth: RequestHandler, dataSource: DataSource): Router {
    const router = Router({ mergeParams: true })

    router.use(ensureAuth)

    const asyncHandler = (fn: (req: Request, res: Response) => Promise<any>): RequestHandler => {
        return async (req, res) => {
            try {
                await fn(req, res)
            } catch (error) {
                console.error(error)
                res.status(500).json({ error: 'Internal server error' })
            }
        }
    }

    // ----- Template CRUD -----
    router.get(
        '/templates',
        asyncHandler(async (_req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { templateRepo } = getRepositories(dataSource)
            const templates = await templateRepo.find({ relations: ['rootResourceCategory', 'parentTemplate'] })
            res.json(templates)
        })
    )

    router.post(
        '/templates',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { templateRepo } = getRepositories(dataSource)
            const { code, titleEn, titleRu, descriptionEn, descriptionRu, rootResourceCategoryId, parentTemplateId, resourceSchema } =
                req.body
            const template = templateRepo.create({ code, titleEn, titleRu, descriptionEn, descriptionRu, resourceSchema })
            if (rootResourceCategoryId) {
                template.rootResourceCategory = { id: rootResourceCategoryId } as any
            }
            if (parentTemplateId) {
                template.parentTemplate = (await templateRepo.findOne({ where: { id: parentTemplateId } })) || null
            }
            await templateRepo.save(template)
            res.status(201).json(template)
        })
    )

    router.get(
        '/templates/:id',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { templateRepo } = getRepositories(dataSource)
            const template = await templateRepo.findOne({
                where: { id: req.params.id },
                relations: ['rootResourceCategory', 'parentTemplate']
            })
            if (!template) return res.status(404).json({ error: 'Not found' })
            res.json(template)
        })
    )

    router.put(
        '/templates/:id',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { templateRepo } = getRepositories(dataSource)
            const { code, titleEn, titleRu, descriptionEn, descriptionRu, rootResourceCategoryId, parentTemplateId, resourceSchema } =
                req.body
            const template = await templateRepo.findOne({ where: { id: req.params.id } })
            if (!template) return res.status(404).json({ error: 'Not found' })
            Object.assign(template, { code, titleEn, titleRu, descriptionEn, descriptionRu, resourceSchema })
            if (rootResourceCategoryId) {
                template.rootResourceCategory = { id: rootResourceCategoryId } as any
            } else {
                template.rootResourceCategory = null
            }
            if (parentTemplateId) {
                template.parentTemplate = (await templateRepo.findOne({ where: { id: parentTemplateId } })) || null
            } else {
                template.parentTemplate = null
            }
            await templateRepo.save(template)
            res.json(template)
        })
    )

    router.delete(
        '/templates/:id',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { templateRepo } = getRepositories(dataSource)
            await templateRepo.delete(req.params.id)
            res.status(204).send()
        })
    )

    // ----- Entity CRUD -----
    router.get(
        '/',
        asyncHandler(async (_req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { entityRepo } = getRepositories(dataSource)
            const entities = await entityRepo.find({ relations: ['template', 'status', 'rootResource', 'parentEntity'] })
            res.json(entities)
        })
    )

    router.post(
        '/',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { entityRepo, templateRepo, statusRepo, resourceBaseRepo } = getRepositories(dataSource)
            const { templateId, statusId, slug, titleEn, titleRu, descriptionEn, descriptionRu, rootResourceId, parentEntityId } = req.body
            const template = await templateRepo.findOne({ where: { id: templateId } })
            const status = await statusRepo.findOne({ where: { id: statusId } })
            if (!template || !status) return res.status(400).json({ error: 'Invalid references' })
            const entity = entityRepo.create({ template, status, slug, titleEn, titleRu, descriptionEn, descriptionRu })
            if (rootResourceId) entity.rootResource = (await resourceBaseRepo.findOne({ where: { id: rootResourceId } })) || null
            if (parentEntityId) entity.parentEntity = (await entityRepo.findOne({ where: { id: parentEntityId } })) || null
            await entityRepo.save(entity)
            res.status(201).json(entity)
        })
    )

    router.get(
        '/:id',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { entityRepo } = getRepositories(dataSource)
            const entity = await entityRepo.findOne({
                where: { id: req.params.id },
                relations: ['template', 'status', 'rootResource', 'parentEntity']
            })
            if (!entity) return res.status(404).json({ error: 'Not found' })
            res.json(entity)
        })
    )

    router.put(
        '/:id',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { entityRepo, templateRepo, statusRepo, resourceBaseRepo } = getRepositories(dataSource)
            const { templateId, statusId, slug, titleEn, titleRu, descriptionEn, descriptionRu, rootResourceId, parentEntityId } = req.body
            const entity = await entityRepo.findOne({
                where: { id: req.params.id },
                relations: ['template', 'status', 'rootResource', 'parentEntity']
            })
            if (!entity) return res.status(404).json({ error: 'Not found' })
            if (templateId) entity.template = (await templateRepo.findOne({ where: { id: templateId } })) || entity.template
            if (statusId) entity.status = (await statusRepo.findOne({ where: { id: statusId } })) || entity.status
            if (rootResourceId !== undefined)
                entity.rootResource = (await resourceBaseRepo.findOne({ where: { id: rootResourceId } })) || null
            if (parentEntityId !== undefined) entity.parentEntity = (await entityRepo.findOne({ where: { id: parentEntityId } })) || null
            Object.assign(entity, { slug, titleEn, titleRu, descriptionEn, descriptionRu })
            await entityRepo.save(entity)
            res.json(entity)
        })
    )

    router.delete(
        '/:id',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { entityRepo } = getRepositories(dataSource)
            await entityRepo.delete(req.params.id)
            res.status(204).send()
        })
    )

    router.get(
        '/:id/children',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { entityRepo } = getRepositories(dataSource)
            const children = await entityRepo.find({ where: { parentEntity: { id: req.params.id } } })
            res.json(children)
        })
    )

    router.get(
        '/:id/parents',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { entityRepo } = getRepositories(dataSource)
            const DEPTH_LIMIT = 50
            const rows = await entityRepo.query(
                `WITH RECURSIVE parent_chain AS (
                    SELECT e.*, ARRAY[e.id] AS path, FALSE AS cycle, 1 AS depth
                    FROM entity e
                    WHERE e.id = $1
                    UNION ALL
                    SELECT e.*, pc.path || e.id, e.id = ANY(pc.path), pc.depth + 1
                    FROM entity e
                    JOIN parent_chain pc ON e.id = pc.parent_entity_id
                    WHERE pc.cycle = FALSE AND pc.depth < $2
                )
                SELECT * FROM parent_chain ORDER BY depth`,
                [req.params.id, depthLimit]
            )
            if (rows.some((r: any) => r.cycle)) {
                return res.status(400).json({ error: 'Cycle detected' })
            }
            if (rows.some((r: any) => r.depth === depthLimit && r.parent_entity_id !== null)) {
                return res.status(400).json({ error: 'Depth limit exceeded' })
            }
            const chain = rows
                .filter((r: any) => r.id !== req.params.id)
                .map(({ path: _path, cycle: _cycle, depth: _depth, ...entity }: any) => entityRepo.create(entity))
            res.json(chain)
        })
    )

    // ----- Owners CRUD -----
    router.get(
        '/:entityId/owners',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { ownerRepo } = getRepositories(dataSource)
            const owners = await ownerRepo.find({ where: { entity: { id: req.params.entityId } } })
            res.json(owners)
        })
    )

    router.post(
        '/:entityId/owners',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { entityRepo, ownerRepo } = getRepositories(dataSource)
            const entity = await entityRepo.findOne({ where: { id: req.params.entityId } })
            if (!entity) return res.status(404).json({ error: 'Entity not found' })
            const { userId, role, isPrimary } = req.body
            const owner = ownerRepo.create({ entity, userId, role, isPrimary })
            await ownerRepo.save(owner)
            res.status(201).json(owner)
        })
    )

    router.put(
        '/:entityId/owners/:id',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { ownerRepo } = getRepositories(dataSource)
            const owner = await ownerRepo.findOne({
                where: { id: req.params.id, entity: { id: req.params.entityId } },
                relations: ['entity']
            })
            if (!owner) return res.status(404).json({ error: 'Not found' })
            const { userId, role, isPrimary } = req.body
            Object.assign(owner, { userId, role, isPrimary })
            await ownerRepo.save(owner)
            res.json(owner)
        })
    )

    router.delete(
        '/:entityId/owners/:id',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { ownerRepo } = getRepositories(dataSource)
            const owner = await ownerRepo.findOne({
                where: { id: req.params.id, entity: { id: req.params.entityId } }
            })
            if (!owner) return res.status(404).json({ error: 'Not found' })
            await ownerRepo.delete(owner.id)
            res.status(204).send()
        })
    )

    // ----- Resource assignments -----
    router.get(
        '/:entityId/resources',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { resourceRepo } = getRepositories(dataSource)
            const links = await resourceRepo.find({ where: { entity: { id: req.params.entityId } }, relations: ['resource'] })
            res.json(links)
        })
    )

    router.post(
        '/:entityId/resources',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { entityRepo, resourceRepo, resourceBaseRepo } = getRepositories(dataSource)
            const entity = await entityRepo.findOne({ where: { id: req.params.entityId } })
            const resource = await resourceBaseRepo.findOne({ where: { id: req.body.resourceId } })
            if (!entity || !resource) return res.status(400).json({ error: 'Invalid references' })
            const { slotCode, quantity, config } = req.body
            const link = resourceRepo.create({ entity, resource, slotCode, quantity, config })
            await resourceRepo.save(link)
            res.status(201).json(link)
        })
    )

    router.put(
        '/:entityId/resources/:id',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { resourceRepo, resourceBaseRepo } = getRepositories(dataSource)
            const link = await resourceRepo.findOne({
                where: { id: req.params.id, entity: { id: req.params.entityId } },
                relations: ['resource', 'entity']
            })
            if (!link) return res.status(404).json({ error: 'Not found' })
            const { resourceId, slotCode, quantity, config } = req.body
            if (resourceId) link.resource = (await resourceBaseRepo.findOne({ where: { id: resourceId } })) || link.resource
            Object.assign(link, { slotCode, quantity, config })
            await resourceRepo.save(link)
            res.json(link)
        })
    )

    router.delete(
        '/:entityId/resources/:id',
        asyncHandler(async (req, res) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { resourceRepo } = getRepositories(dataSource)
            const link = await resourceRepo.findOne({
                where: { id: req.params.id, entity: { id: req.params.entityId } }
            })
            if (!link) return res.status(404).json({ error: 'Not found' })
            await resourceRepo.delete(link.id)
            res.status(204).send()
        })
    )

    return router
}

export default createEntitiesRouter
