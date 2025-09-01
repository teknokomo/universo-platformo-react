import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import { EntityStatus } from '../database/entities/EntityStatus'
import { EntityTemplate } from '../database/entities/EntityTemplate'
import { Entity } from '../database/entities/Entity'
import { EntityOwner } from '../database/entities/EntityOwner'
import { EntityResource } from '../database/entities/EntityResource'
import { Resource } from '@universo/resources-srv'

export function createEntitiesRouter(ensureAuth: RequestHandler, dataSource: DataSource): Router {
    const router = Router({ mergeParams: true })

    const statusRepo = dataSource.getRepository(EntityStatus)
    const templateRepo = dataSource.getRepository(EntityTemplate)
    const entityRepo = dataSource.getRepository(Entity)
    const ownerRepo = dataSource.getRepository(EntityOwner)
    const resourceRepo = dataSource.getRepository(EntityResource)
    const resourceBaseRepo = dataSource.getRepository(Resource)

    router.use(ensureAuth)

    // ----- Template CRUD -----
    router.get('/templates', async (_req: Request, res: Response) => {
        const templates = await templateRepo.find({ relations: ['rootResourceCategory', 'parentTemplate'] })
        res.json(templates)
    })

    router.post('/templates', async (req: Request, res: Response) => {
        const { code, titleEn, titleRu, descriptionEn, descriptionRu, rootResourceCategoryId, parentTemplateId, resourceSchema } = req.body
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

    router.get('/templates/:id', async (req: Request, res: Response) => {
        const template = await templateRepo.findOne({ where: { id: req.params.id }, relations: ['rootResourceCategory', 'parentTemplate'] })
        if (!template) return res.status(404).json({ error: 'Not found' })
        res.json(template)
    })

    router.put('/templates/:id', async (req: Request, res: Response) => {
        const { code, titleEn, titleRu, descriptionEn, descriptionRu, rootResourceCategoryId, parentTemplateId, resourceSchema } = req.body
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

    router.delete('/templates/:id', async (req: Request, res: Response) => {
        await templateRepo.delete(req.params.id)
        res.status(204).send()
    })

    // ----- Entity CRUD -----
    router.get('/', async (_req: Request, res: Response) => {
        const entities = await entityRepo.find({ relations: ['template', 'status', 'rootResource', 'parentEntity'] })
        res.json(entities)
    })

    router.post('/', async (req: Request, res: Response) => {
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

    router.get('/:id', async (req: Request, res: Response) => {
        const entity = await entityRepo.findOne({
            where: { id: req.params.id },
            relations: ['template', 'status', 'rootResource', 'parentEntity']
        })
        if (!entity) return res.status(404).json({ error: 'Not found' })
        res.json(entity)
    })

    router.put('/:id', async (req: Request, res: Response) => {
        const { templateId, statusId, slug, titleEn, titleRu, descriptionEn, descriptionRu, rootResourceId, parentEntityId } = req.body
        const entity = await entityRepo.findOne({
            where: { id: req.params.id },
            relations: ['template', 'status', 'rootResource', 'parentEntity']
        })
        if (!entity) return res.status(404).json({ error: 'Not found' })
        if (templateId) entity.template = (await templateRepo.findOne({ where: { id: templateId } })) || entity.template
        if (statusId) entity.status = (await statusRepo.findOne({ where: { id: statusId } })) || entity.status
        if (rootResourceId !== undefined) entity.rootResource = (await resourceBaseRepo.findOne({ where: { id: rootResourceId } })) || null
        if (parentEntityId !== undefined) entity.parentEntity = (await entityRepo.findOne({ where: { id: parentEntityId } })) || null
        Object.assign(entity, { slug, titleEn, titleRu, descriptionEn, descriptionRu })
        await entityRepo.save(entity)
        res.json(entity)
    })

    router.delete('/:id', async (req: Request, res: Response) => {
        await entityRepo.delete(req.params.id)
        res.status(204).send()
    })

    router.get('/:id/children', async (req: Request, res: Response) => {
        const children = await entityRepo.find({ where: { parentEntity: { id: req.params.id } } })
        res.json(children)
    })

    router.get('/:id/parents', async (req: Request, res: Response) => {
        const chain: Entity[] = []
        let current = await entityRepo.findOne({ where: { id: req.params.id }, relations: ['parentEntity'] })
        while (current?.parentEntity) {
            const parent = await entityRepo.findOne({ where: { id: current.parentEntity.id }, relations: ['parentEntity'] })
            if (parent) chain.push(parent)
            current = parent || null
        }
        res.json(chain)
    })

    // ----- Owners CRUD -----
    router.get('/:entityId/owners', async (req: Request, res: Response) => {
        const owners = await ownerRepo.find({ where: { entity: { id: req.params.entityId } } })
        res.json(owners)
    })

    router.post('/:entityId/owners', async (req: Request, res: Response) => {
        const entity = await entityRepo.findOne({ where: { id: req.params.entityId } })
        if (!entity) return res.status(404).json({ error: 'Entity not found' })
        const { userId, role, isPrimary } = req.body
        const owner = ownerRepo.create({ entity, userId, role, isPrimary })
        await ownerRepo.save(owner)
        res.status(201).json(owner)
    })

    router.put('/owners/:id', async (req: Request, res: Response) => {
        const owner = await ownerRepo.findOne({ where: { id: req.params.id }, relations: ['entity'] })
        if (!owner) return res.status(404).json({ error: 'Not found' })
        const { userId, role, isPrimary } = req.body
        Object.assign(owner, { userId, role, isPrimary })
        await ownerRepo.save(owner)
        res.json(owner)
    })

    router.delete('/owners/:id', async (req: Request, res: Response) => {
        await ownerRepo.delete(req.params.id)
        res.status(204).send()
    })

    // ----- Resource assignments -----
    router.get('/:entityId/resources', async (req: Request, res: Response) => {
        const links = await resourceRepo.find({ where: { entity: { id: req.params.entityId } }, relations: ['resource'] })
        res.json(links)
    })

    router.post('/:entityId/resources', async (req: Request, res: Response) => {
        const entity = await entityRepo.findOne({ where: { id: req.params.entityId } })
        const resource = await resourceBaseRepo.findOne({ where: { id: req.body.resourceId } })
        if (!entity || !resource) return res.status(400).json({ error: 'Invalid references' })
        const { slotCode, quantity, config } = req.body
        const link = resourceRepo.create({ entity, resource, slotCode, quantity, config })
        await resourceRepo.save(link)
        res.status(201).json(link)
    })

    router.put('/:entityId/resources/:id', async (req: Request, res: Response) => {
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

    router.delete('/:entityId/resources/:id', async (req: Request, res: Response) => {
        await resourceRepo.delete({ id: req.params.id })
        res.status(204).send()
    })

    return router
}

export default createEntitiesRouter
