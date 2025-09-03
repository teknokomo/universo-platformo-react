import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
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

    // ------- Categories CRUD -------
    router.get(
        '/categories',
        asyncHandler(async (_req: Request, res: Response) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { categoryRepo } = getRepositories(dataSource)
            const categories = await categoryRepo.find({ relations: ['parentCategory'] })
            res.json(categories)
        })
    )

    router.post(
        '/categories',
        asyncHandler(async (req: Request, res: Response) => {
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
    )

    router.get(
        '/categories/:id',
        asyncHandler(async (req: Request, res: Response) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { categoryRepo } = getRepositories(dataSource)
            const category = await categoryRepo.findOne({ where: { id: req.params.id }, relations: ['parentCategory'] })
            if (!category) return res.status(404).json({ error: 'Not found' })
            res.json(category)
        })
    )

    router.put(
        '/categories/:id',
        asyncHandler(async (req: Request, res: Response) => {
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
    )

    router.delete(
        '/categories/:id',
        asyncHandler(async (req: Request, res: Response) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { categoryRepo } = getRepositories(dataSource)
            await categoryRepo.delete(req.params.id)
            res.status(204).send()
        })
    )

    // ------- Resources CRUD -------
    router.get(
        '/',
        asyncHandler(async (_req: Request, res: Response) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { resourceRepo } = getRepositories(dataSource)
            const resources = await resourceRepo.find({ relations: ['category', 'state', 'storageType'] })
            res.json(resources)
        })
    )

    router.post(
        '/',
        asyncHandler(async (req: Request, res: Response) => {
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
    )

    router.get(
        '/:id',
        asyncHandler(async (req: Request, res: Response) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { resourceRepo } = getRepositories(dataSource)
            const resource = await resourceRepo.findOne({ where: { id: req.params.id }, relations: ['category', 'state', 'storageType'] })
            if (!resource) return res.status(404).json({ error: 'Not found' })
            res.json(resource)
        })
    )

    router.put(
        '/:id',
        asyncHandler(async (req: Request, res: Response) => {
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
    )

    router.delete(
        '/:id',
        asyncHandler(async (req: Request, res: Response) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { resourceRepo } = getRepositories(dataSource)
            await resourceRepo.delete(req.params.id)
            res.status(204).send()
        })
    )

    // ------- Revisions -------
    router.get(
        '/:id/revisions',
        asyncHandler(async (req: Request, res: Response) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { revisionRepo } = getRepositories(dataSource)
            const revisions = await revisionRepo.find({ where: { resource: { id: req.params.id } }, order: { version: 'DESC' } })
            res.json(revisions)
        })
    )

    router.post(
        '/:id/revisions',
        asyncHandler(async (req: Request, res: Response) => {
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
    )

    router.get(
        '/:id/revisions/:revId',
        asyncHandler(async (req: Request, res: Response) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { revisionRepo } = getRepositories(dataSource)
            const revision = await revisionRepo.findOne({ where: { id: req.params.revId, resource: { id: req.params.id } } })
            if (!revision) return res.status(404).json({ error: 'Not found' })
            res.json(revision)
        })
    )

    router.delete(
        '/:id/revisions/:revId',
        asyncHandler(async (req: Request, res: Response) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { revisionRepo } = getRepositories(dataSource)
            const revision = await revisionRepo.findOne({ where: { id: req.params.revId, resource: { id: req.params.id } } })
            if (!revision) return res.status(404).json({ error: 'Not found' })
            await revisionRepo.delete(revision.id)
            res.status(204).send()
        })
    )

    // ------- Composition -------
    router.post(
        '/:id/children',
        asyncHandler(async (req: Request, res: Response) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const { resourceRepo, compositionRepo } = getRepositories(dataSource)
            const parent = await resourceRepo.findOne({ where: { id: req.params.id } })
            const child = await resourceRepo.findOne({ where: { id: req.body.childId } })
            if (!parent || !child) return res.status(400).json({ error: 'Invalid resources' })
            if (parent.id === child.id) return res.status(400).json({ error: 'Cycle detected' })

            const cycleCheck = await dataSource.query(
                `WITH RECURSIVE descendants AS (
                    SELECT child_resource_id
                    FROM resource_composition
                    WHERE parent_resource_id = $1
                    UNION
                    SELECT rc.child_resource_id
                    FROM resource_composition rc
                    JOIN descendants d ON rc.parent_resource_id = d.child_resource_id
                )
                SELECT 1 FROM descendants WHERE child_resource_id = $2`,
                [req.body.childId, req.params.id]
            )
            if (cycleCheck.length > 0) return res.status(400).json({ error: 'Cycle detected' })

            const { quantity, sortOrder, isRequired, config } = req.body
            const comp = compositionRepo.create({ parentResource: parent, childResource: child, quantity, sortOrder, isRequired, config })
            await compositionRepo.save(comp)
            res.status(201).json(comp)
        })
    )

    router.delete(
        '/:id/children/:childId',
        asyncHandler(async (req: Request, res: Response) => {
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
    )

    router.get(
        '/:id/tree',
        asyncHandler(async (req: Request, res: Response) => {
            if (!dataSource.isInitialized) {
                return res.status(500).json({ error: 'Data source is not initialized' })
            }
            const rows = await dataSource.query(
                `WITH RECURSIVE tree AS (
                    SELECT r.id AS resource_id,
                        to_jsonb(r) || jsonb_build_object(
                            'category', to_jsonb(cat),
                            'state', to_jsonb(st),
                            'storageType', to_jsonb(stype)
                        ) AS resource,
                        NULL::uuid AS comp_id,
                        NULL::uuid AS parent_resource_id,
                        NULL::int AS quantity,
                        NULL::int AS sort_order,
                        NULL::boolean AS is_required,
                        NULL::jsonb AS config
                    FROM resource r
                    JOIN resource_category cat ON r.category_id = cat.id
                    JOIN resource_state st ON r.state_id = st.id
                    JOIN storage_type stype ON r.storage_type_id = stype.id
                    WHERE r.id = $1
                    UNION ALL
                    SELECT r2.id,
                        to_jsonb(r2) || jsonb_build_object(
                            'category', to_jsonb(cat2),
                            'state', to_jsonb(st2),
                            'storageType', to_jsonb(stype2)
                        ),
                        rc.id,
                        rc.parent_resource_id,
                        rc.quantity,
                        rc.sort_order,
                        rc.is_required,
                        rc.config
                    FROM resource_composition rc
                    JOIN resource r2 ON rc.child_resource_id = r2.id
                    JOIN resource_category cat2 ON r2.category_id = cat2.id
                    JOIN resource_state st2 ON r2.state_id = st2.id
                    JOIN storage_type stype2 ON r2.storage_type_id = stype2.id
                    JOIN tree t ON rc.parent_resource_id = t.resource_id
                )
                SELECT * FROM tree`,
                [req.params.id]
            )

            if (rows.length === 0) return res.json(null)

            const nodes = new Map<string, any>()
            let root: any = null
            for (const row of rows) {
                const node = nodes.get(row.resource_id) || { resource: row.resource, children: [] }
                node.resource = row.resource
                nodes.set(row.resource_id, node)
                if (!row.comp_id) {
                    root = node
                } else {
                    const parent = nodes.get(row.parent_resource_id)!
                    parent.children.push({
                        id: row.comp_id,
                        quantity: row.quantity,
                        sortOrder: row.sort_order,
                        isRequired: row.is_required,
                        config: row.config,
                        child: node
                    })
                }
            }
            res.json(root)
        })
    )

    return router
}

export default createResourcesRouter
