import type { Request, Response } from 'express'
import { z } from 'zod'
import { findActivePublicationVersion, findPublicMetahubBySlug, listPublicationsByMetahub } from '../../../persistence'
import type { DbExecutor } from '../../../utils'
import { MetahubSchemaService } from '../services/MetahubSchemaService'
import { MetahubObjectsService } from '../services/MetahubObjectsService'
import type { MetahubObjectRow } from '../services/MetahubObjectsService'
import { MetahubComponentsService } from '../services/MetahubComponentsService'
import { MetahubRecordsService } from '../services/MetahubRecordsService'
import { MetahubTreeEntitiesService } from '../services/MetahubTreeEntitiesService'
import { MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const paginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(1000).default(100),
    offset: z.coerce.number().int().min(0).default(0)
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const resolvePublicMetahub = async (exec: DbExecutor, slug: string) => {
    const metahub = await findPublicMetahubBySlug(exec, slug)
    if (!metahub) {
        throw new MetahubNotFoundError('Metahub')
    }

    const publications = await listPublicationsByMetahub(exec, metahub.id)
    const publicPublication = publications.find((publication) => publication.accessMode === 'full' && publication.activeVersionId)
    if (!publicPublication) {
        throw new MetahubNotFoundError('Metahub')
    }

    const activeVersion = await findActivePublicationVersion(exec, publicPublication.id)
    if (!activeVersion || !activeVersion.snapshotJson || typeof activeVersion.snapshotJson !== 'object') {
        throw new MetahubNotFoundError('Metahub')
    }

    return metahub
}

const resolveTreeEntity = async (
    treeEntitiesService: MetahubTreeEntitiesService,
    metahubId: string,
    treeEntityCodename: string
): Promise<Record<string, unknown> & { id: string }> => {
    const treeEntity = await treeEntitiesService.findByCodename(metahubId, treeEntityCodename)
    if (!treeEntity) {
        throw new MetahubNotFoundError('Hub')
    }
    return treeEntity as Record<string, unknown> & { id: string }
}

const resolveObjectCollectionInTreeEntity = async (
    objectsService: MetahubObjectsService,
    metahubId: string,
    objectCollectionCodename: string,
    treeEntityId: string
): Promise<MetahubObjectRow> => {
    const objectCollection = await objectsService.findByCodename(metahubId, objectCollectionCodename)
    if (!objectCollection) {
        throw new MetahubNotFoundError('Object')
    }
    const objectKind = typeof objectCollection.kind === 'string' ? objectCollection.kind.trim() : ''
    if (objectKind !== 'object') {
        throw new MetahubNotFoundError('Object')
    }
    const treeEntityIds: string[] = ((objectCollection.config as Record<string, unknown>)?.hubs as string[]) || []
    if (!treeEntityIds.includes(treeEntityId)) {
        throw new MetahubNotFoundError('Object')
    }
    return objectCollection
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export function createPublicMetahubsController(getDbExecutor: () => DbExecutor) {
    const services = () => {
        const exec = getDbExecutor()
        const schemaService = new MetahubSchemaService(exec)
        const objectsService = new MetahubObjectsService(exec, schemaService)
        const componentsService = new MetahubComponentsService(exec, schemaService)
        const recordsService = new MetahubRecordsService(exec, schemaService, objectsService, componentsService)
        const treeEntitiesService = new MetahubTreeEntitiesService(exec, schemaService)
        return { exec, treeEntitiesService, objectsService, componentsService, recordsService }
    }

    const getBySlug = async (req: Request, res: Response) => {
        const { slug } = req.params
        const { exec } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        res.json(metahub)
    }

    const listTreeEntities = async (req: Request, res: Response) => {
        const { slug } = req.params
        const { exec, treeEntitiesService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)

        const { items: treeEntities } = await treeEntitiesService.findAll(metahub.id, {
            sortBy: 'sortOrder',
            sortOrder: 'asc'
        })
        res.json({ items: treeEntities, pagination: { total: treeEntities.length, limit: 100, offset: 0 } })
    }

    const getTreeEntity = async (req: Request, res: Response) => {
        const { slug, treeEntityCodename } = req.params
        const { exec, treeEntitiesService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        const treeEntity = await resolveTreeEntity(treeEntitiesService, metahub.id, treeEntityCodename)
        res.json(treeEntity)
    }

    const listObjectCollections = async (req: Request, res: Response) => {
        const { slug, treeEntityCodename } = req.params
        const { exec, treeEntitiesService, objectsService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        const treeEntity = await resolveTreeEntity(treeEntitiesService, metahub.id, treeEntityCodename)

        const allObjectCollections = await objectsService.findAll(metahub.id)
        const objectCollections = allObjectCollections.filter((collection) => {
            const objectKind = typeof collection.kind === 'string' ? collection.kind.trim() : ''
            if (objectKind !== 'object') {
                return false
            }
            const treeEntityIds: string[] = ((collection.config as Record<string, unknown>)?.hubs as string[]) || []
            return treeEntityIds.includes(treeEntity.id)
        })
        res.json({ items: objectCollections, pagination: { total: objectCollections.length, limit: 100, offset: 0 } })
    }

    const getObjectCollection = async (req: Request, res: Response) => {
        const { slug, treeEntityCodename, objectCollectionCodename } = req.params
        const { exec, treeEntitiesService, objectsService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        const treeEntity = await resolveTreeEntity(treeEntitiesService, metahub.id, treeEntityCodename)
        const objectCollection = await resolveObjectCollectionInTreeEntity(
            objectsService,
            metahub.id,
            objectCollectionCodename,
            treeEntity.id
        )
        res.json(objectCollection)
    }

    const listComponents = async (req: Request, res: Response) => {
        const { slug, treeEntityCodename, objectCollectionCodename } = req.params
        const { exec, treeEntitiesService, objectsService, componentsService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        const treeEntity = await resolveTreeEntity(treeEntitiesService, metahub.id, treeEntityCodename)
        const objectCollection = await resolveObjectCollectionInTreeEntity(
            objectsService,
            metahub.id,
            objectCollectionCodename,
            treeEntity.id
        )

        const components = await componentsService.findAll(metahub.id, objectCollection.id)
        res.json({ items: components, pagination: { total: components.length, limit: 100, offset: 0 } })
    }

    const listRecords = async (req: Request, res: Response) => {
        const { slug, treeEntityCodename, objectCollectionCodename } = req.params
        const parsed = paginationSchema.safeParse(req.query)
        if (!parsed.success) {
            throw new MetahubValidationError('Invalid pagination parameters', { details: parsed.error.format() })
        }
        const { limit, offset } = parsed.data
        const { exec, treeEntitiesService, objectsService, recordsService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        const treeEntity = await resolveTreeEntity(treeEntitiesService, metahub.id, treeEntityCodename)
        const objectCollection = await resolveObjectCollectionInTreeEntity(
            objectsService,
            metahub.id,
            objectCollectionCodename,
            treeEntity.id
        )

        const { items: records, total } = await recordsService.findAllAndCount(metahub.id, objectCollection.id, {
            limit,
            offset,
            sortOrder: 'asc'
        })
        res.json({ items: records, pagination: { total, limit, offset } })
    }

    const getRecord = async (req: Request, res: Response) => {
        const { slug, treeEntityCodename, objectCollectionCodename, recordId } = req.params
        const { exec, treeEntitiesService, objectsService, recordsService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        const treeEntity = await resolveTreeEntity(treeEntitiesService, metahub.id, treeEntityCodename)
        const objectCollection = await resolveObjectCollectionInTreeEntity(
            objectsService,
            metahub.id,
            objectCollectionCodename,
            treeEntity.id
        )

        const record = await recordsService.findById(metahub.id, objectCollection.id, recordId)
        if (!record) {
            throw new MetahubNotFoundError('Record')
        }
        res.json(record)
    }

    return {
        getBySlug,
        listTreeEntities,
        getTreeEntity,
        listObjectCollections,
        getObjectCollection,
        listComponents,
        listRecords,
        getRecord
    }
}
