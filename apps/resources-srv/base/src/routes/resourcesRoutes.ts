import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import { ResourceCategory } from '../database/entities/ResourceCategory'
import { Resource } from '../database/entities/Resource'
import { ResourceRevision } from '../database/entities/ResourceRevision'
import { ResourceComposition } from '../database/entities/ResourceComposition'
import { ResourceState } from '../database/entities/ResourceState'
import { StorageType } from '../database/entities/StorageType'

export function getRepositories(dataSource: DataSource) {
    return {
        categoryRepo: dataSource.getRepository(ResourceCategory),
        resourceRepo: dataSource.getRepository(Resource),
        revisionRepo: dataSource.getRepository(ResourceRevision),
        compositionRepo: dataSource.getRepository(ResourceComposition),
        stateRepo: dataSource.getRepository(ResourceState),
        storageRepo: dataSource.getRepository(StorageType)
    }
}

export function createResourcesRouter(ensureAuth: RequestHandler, dataSource: DataSource): Router {
    const router = Router({ mergeParams: true })

    router.use(ensureAuth)

    // ------- Categories CRUD -------
    router.get('/categories', async (_req: Request, res: Response) => {
        if (!dataSource.isInitialized) {
            return res.status(500).json({ error: 'Data source is not initialized' })
        }
        const { categoryRepo } = getRepositories(dataSource)
        const categories = await categoryRepo.find({ relations: ['parentCategory'] })
        res.json(categories)
    })

    router.post('/categories', async (req: Request, res: Response) => {
        if (!dataSource.isInitialized) {
            return res.status(500).json({ error: 'Data source is not initialized' })
        }
        const { categoryRepo } = getRepositories(dataSource)
        const { slug, parentCategoryId, titleEn, titleRu, descriptionEn, descriptionRu } = req.body
        const category = categoryRepo.create({ slug, titleEn, titleRu, descriptionEn, descriptionRu })
        if (parentCategoryId) {
            const parent = await categoryRepo.findOne({ where: { id: parentCategoryId } })
            if (parent) category.parentCategory = parent
        }
        await categoryRepo.save(category)
        res.status(201).json(category)
    })

    router.get('/categories/:id', async (req: Request, res: Response) => {
        if (!dataSource.isInitialized) {
            return res.status(500).json({ error: 'Data source is not initialized' })
        }
        const { categoryRepo } = getRepositories(dataSource)
        const category = await categoryRepo.findOne({ where: { id: req.params.id }, relations: ['parentCategory'] })
        if (!category) return res.status(404).json({ error: 'Not found' })
        res.json(category)
    })

    router.put('/categories/:id', async (req: Request, res: Response) => {
        if (!dataSource.isInitialized) {
            return res.status(500).json({ error: 'Data source is not initialized' })
        }
        const { categoryRepo } = getRepositories(dataSource)
        const { slug, parentCategoryId, titleEn, titleRu, descriptionEn, descriptionRu } = req.body
        const category = await categoryRepo.findOne({ where: { id: req.params.id } })
        if (!category) return res.status(404).json({ error: 'Not found' })
        Object.assign(category, { slug, titleEn, titleRu, descriptionEn, descriptionRu })
        if (parentCategoryId) {
            category.parentCategory = (await categoryRepo.findOne({ where: { id: parentCategoryId } })) || null
        } else {
            category.parentCategory = null
        }
        await categoryRepo.save(category)
        res.json(category)
    })

    router.delete('/categories/:id', async (req: Request, res: Response) => {
        if (!dataSource.isInitialized) {
            return res.status(500).json({ error: 'Data source is not initialized' })
        }
        const { categoryRepo } = getRepositories(dataSource)
        await categoryRepo.delete(req.params.id)
        res.status(204).send()
    })

    // ------- Resources CRUD -------
    router.get('/', async (_req: Request, res: Response) => {
        if (!dataSource.isInitialized) {
            return res.status(500).json({ error: 'Data source is not initialized' })
        }
        const { resourceRepo } = getRepositories(dataSource)
        const resources = await resourceRepo.find({ relations: ['category', 'state', 'storageType'] })
        res.json(resources)
    })

    router.post('/', async (req: Request, res: Response) => {
        if (!dataSource.isInitialized) {
            return res.status(500).json({ error: 'Data source is not initialized' })
        }
        const { categoryRepo, stateRepo, storageRepo, resourceRepo } = getRepositories(dataSource)
        const { categoryId, stateId, storageTypeId, slug, titleEn, titleRu, descriptionEn, descriptionRu, metadata } = req.body
        const [category, state, storageType] = await Promise.all([
            categoryRepo.findOne({ where: { id: categoryId } }),
            stateRepo.findOne({ where: { id: stateId } }),
            storageRepo.findOne({ where: { id: storageTypeId } })
        ])
        if (!category || !state || !storageType) return res.status(400).json({ error: 'Invalid references' })
        const resource = resourceRepo.create({
            category,
            state,
            storageType,
            slug,
            titleEn,
            titleRu,
            descriptionEn,
            descriptionRu,
            metadata
        })
        await resourceRepo.save(resource)
        res.status(201).json(resource)
    })

    router.get('/:id', async (req: Request, res: Response) => {
        if (!dataSource.isInitialized) {
            return res.status(500).json({ error: 'Data source is not initialized' })
        }
        const { resourceRepo } = getRepositories(dataSource)
        const resource = await resourceRepo.findOne({ where: { id: req.params.id }, relations: ['category', 'state', 'storageType'] })
        if (!resource) return res.status(404).json({ error: 'Not found' })
        res.json(resource)
    })

    router.put('/:id', async (req: Request, res: Response) => {
        if (!dataSource.isInitialized) {
            return res.status(500).json({ error: 'Data source is not initialized' })
        }
        const { categoryRepo, stateRepo, storageRepo, resourceRepo } = getRepositories(dataSource)
        const { categoryId, stateId, storageTypeId, slug, titleEn, titleRu, descriptionEn, descriptionRu, metadata } = req.body
        const resource = await resourceRepo.findOne({ where: { id: req.params.id }, relations: ['category', 'state', 'storageType'] })
        if (!resource) return res.status(404).json({ error: 'Not found' })
        if (categoryId) resource.category = (await categoryRepo.findOne({ where: { id: categoryId } })) || resource.category
        if (stateId) resource.state = (await stateRepo.findOne({ where: { id: stateId } })) || resource.state
        if (storageTypeId) resource.storageType = (await storageRepo.findOne({ where: { id: storageTypeId } })) || resource.storageType
        Object.assign(resource, { slug, titleEn, titleRu, descriptionEn, descriptionRu, metadata })
        await resourceRepo.save(resource)
        res.json(resource)
    })

    router.delete('/:id', async (req: Request, res: Response) => {
        if (!dataSource.isInitialized) {
            return res.status(500).json({ error: 'Data source is not initialized' })
        }
        const { resourceRepo } = getRepositories(dataSource)
        await resourceRepo.delete(req.params.id)
        res.status(204).send()
    })

    // ------- Revisions -------
    router.get('/:id/revisions', async (req: Request, res: Response) => {
        if (!dataSource.isInitialized) {
            return res.status(500).json({ error: 'Data source is not initialized' })
        }
        const { revisionRepo } = getRepositories(dataSource)
        const revisions = await revisionRepo.find({ where: { resource: { id: req.params.id } }, order: { version: 'DESC' } })
        res.json(revisions)
    })

    router.post('/:id/revisions', async (req: Request, res: Response) => {
        if (!dataSource.isInitialized) {
            return res.status(500).json({ error: 'Data source is not initialized' })
        }
        const { resourceRepo, revisionRepo } = getRepositories(dataSource)
        const resource = await resourceRepo.findOne({ where: { id: req.params.id } })
        if (!resource) return res.status(404).json({ error: 'Resource not found' })
        const { version, data, authorId } = req.body
        const revision = revisionRepo.create({ resource, version, data, authorId })
        await revisionRepo.save(revision)
        res.status(201).json(revision)
    })

    router.get('/:id/revisions/:revId', async (req: Request, res: Response) => {
        if (!dataSource.isInitialized) {
            return res.status(500).json({ error: 'Data source is not initialized' })
        }
        const { revisionRepo } = getRepositories(dataSource)
        const revision = await revisionRepo.findOne({ where: { id: req.params.revId, resource: { id: req.params.id } } })
        if (!revision) return res.status(404).json({ error: 'Not found' })
        res.json(revision)
    })

    router.delete('/:id/revisions/:revId', async (req: Request, res: Response) => {
        if (!dataSource.isInitialized) {
            return res.status(500).json({ error: 'Data source is not initialized' })
        }
        const { revisionRepo } = getRepositories(dataSource)
        await revisionRepo.delete({ id: req.params.revId })
        res.status(204).send()
    })

    // ------- Composition -------
    router.post('/:id/children', async (req: Request, res: Response) => {
        if (!dataSource.isInitialized) {
            return res.status(500).json({ error: 'Data source is not initialized' })
        }
        const { resourceRepo, compositionRepo } = getRepositories(dataSource)
        const parent = await resourceRepo.findOne({ where: { id: req.params.id } })
        const child = await resourceRepo.findOne({ where: { id: req.body.childId } })
        if (!parent || !child) return res.status(400).json({ error: 'Invalid resources' })
        const { quantity, sortOrder, isRequired, config } = req.body
        const comp = compositionRepo.create({ parentResource: parent, childResource: child, quantity, sortOrder, isRequired, config })
        await compositionRepo.save(comp)
        res.status(201).json(comp)
    })

    router.delete('/:id/children/:childId', async (req: Request, res: Response) => {
        if (!dataSource.isInitialized) {
            return res.status(500).json({ error: 'Data source is not initialized' })
        }
        const { compositionRepo } = getRepositories(dataSource)
        const comp = await compositionRepo.findOne({
            where: {
                parentResource: { id: req.params.id },
                childResource: { id: req.params.childId }
            }
        })
        if (!comp) return res.status(404).json({ error: 'Not found' })
        await compositionRepo.delete(comp.id)
        res.status(204).send()
    })

    router.get('/:id/tree', async (req: Request, res: Response) => {
        if (!dataSource.isInitialized) {
            return res.status(500).json({ error: 'Data source is not initialized' })
        }
        const { resourceRepo } = getRepositories(dataSource)
        const rootId = req.params.id
        const rootResource = await resourceRepo.findOne({ where: { id: rootId }, relations: ['category', 'state', 'storageType'] })
        if (!rootResource) return res.status(404).json({ error: 'Not found' })
        const compositions = await dataSource.query(
            `WITH RECURSIVE comp AS (
                SELECT id, parent_resource_id, child_resource_id, quantity, sort_order, is_required, config
                FROM resource_composition
                WHERE parent_resource_id = $1
                UNION ALL
                SELECT rc.id, rc.parent_resource_id, rc.child_resource_id, rc.quantity, rc.sort_order, rc.is_required, rc.config
                FROM resource_composition rc
                JOIN comp c ON c.child_resource_id = rc.parent_resource_id
            )
            SELECT * FROM comp`,
            [rootId]
        )
        const ids = new Set<string>([rootId])
        for (const row of compositions) {
            ids.add(row.parent_resource_id)
            ids.add(row.child_resource_id)
        }
        const resources = await resourceRepo.find({
            where: { id: In([...ids]) },
            relations: ['category', 'state', 'storageType']
        })
        const nodeMap = new Map<string, any>()
        resources.forEach((r) => nodeMap.set(r.id, { resource: r, children: [] }))
        for (const row of compositions) {
            const parentNode = nodeMap.get(row.parent_resource_id)
            const childNode = nodeMap.get(row.child_resource_id)
            if (parentNode && childNode) {
                parentNode.children.push({
                    id: row.id,
                    quantity: row.quantity,
                    sortOrder: row.sort_order,
                    isRequired: row.is_required,
                    config: row.config,
                    child: childNode
                })
            }
        }
        res.json(nodeMap.get(rootId))
    })

    return router
}

export default createResourcesRouter
