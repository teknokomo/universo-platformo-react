import type { Request, Response } from 'express'
import { z } from 'zod'
import { findActivePublicationVersion, findPublicMetahubBySlug, listPublicationsByMetahub } from '../../../persistence'
import type { DbExecutor } from '../../../utils'
import { MetahubSchemaService } from '../services/MetahubSchemaService'
import { MetahubObjectsService } from '../services/MetahubObjectsService'
import type { MetahubObjectRow } from '../services/MetahubObjectsService'
import { MetahubFieldDefinitionsService } from '../services/MetahubFieldDefinitionsService'
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

const resolveLinkedCollectionInTreeEntity = async (
    objectsService: MetahubObjectsService,
    metahubId: string,
    linkedCollectionCodename: string,
    treeEntityId: string
): Promise<MetahubObjectRow> => {
    const linkedCollection = await objectsService.findByCodename(metahubId, linkedCollectionCodename)
    if (!linkedCollection) {
        throw new MetahubNotFoundError('Catalog')
    }
    const objectKind = typeof linkedCollection.kind === 'string' ? linkedCollection.kind.trim() : ''
    if (objectKind !== 'catalog') {
        throw new MetahubNotFoundError('Catalog')
    }
    const treeEntityIds: string[] = ((linkedCollection.config as Record<string, unknown>)?.hubs as string[]) || []
    if (!treeEntityIds.includes(treeEntityId)) {
        throw new MetahubNotFoundError('Catalog')
    }
    return linkedCollection
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export function createPublicMetahubsController(getDbExecutor: () => DbExecutor) {
    const services = () => {
        const exec = getDbExecutor()
        const schemaService = new MetahubSchemaService(exec)
        const objectsService = new MetahubObjectsService(exec, schemaService)
        const fieldDefinitionsService = new MetahubFieldDefinitionsService(exec, schemaService)
        const recordsService = new MetahubRecordsService(exec, schemaService, objectsService, fieldDefinitionsService)
        const treeEntitiesService = new MetahubTreeEntitiesService(exec, schemaService)
        return { exec, treeEntitiesService, objectsService, fieldDefinitionsService, recordsService }
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

    const listLinkedCollections = async (req: Request, res: Response) => {
        const { slug, treeEntityCodename } = req.params
        const { exec, treeEntitiesService, objectsService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        const treeEntity = await resolveTreeEntity(treeEntitiesService, metahub.id, treeEntityCodename)

        const allLinkedCollections = await objectsService.findAll(metahub.id)
        const linkedCollections = allLinkedCollections.filter((collection) => {
            const objectKind = typeof collection.kind === 'string' ? collection.kind.trim() : ''
            if (objectKind !== 'catalog') {
                return false
            }
            const treeEntityIds: string[] = ((collection.config as Record<string, unknown>)?.hubs as string[]) || []
            return treeEntityIds.includes(treeEntity.id)
        })
        res.json({ items: linkedCollections, pagination: { total: linkedCollections.length, limit: 100, offset: 0 } })
    }

    const getLinkedCollection = async (req: Request, res: Response) => {
        const { slug, treeEntityCodename, linkedCollectionCodename } = req.params
        const { exec, treeEntitiesService, objectsService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        const treeEntity = await resolveTreeEntity(treeEntitiesService, metahub.id, treeEntityCodename)
        const linkedCollection = await resolveLinkedCollectionInTreeEntity(
            objectsService,
            metahub.id,
            linkedCollectionCodename,
            treeEntity.id
        )
        res.json(linkedCollection)
    }

    const listFieldDefinitions = async (req: Request, res: Response) => {
        const { slug, treeEntityCodename, linkedCollectionCodename } = req.params
        const { exec, treeEntitiesService, objectsService, fieldDefinitionsService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        const treeEntity = await resolveTreeEntity(treeEntitiesService, metahub.id, treeEntityCodename)
        const linkedCollection = await resolveLinkedCollectionInTreeEntity(
            objectsService,
            metahub.id,
            linkedCollectionCodename,
            treeEntity.id
        )

        const fieldDefinitions = await fieldDefinitionsService.findAll(metahub.id, linkedCollection.id)
        res.json({ items: fieldDefinitions, pagination: { total: fieldDefinitions.length, limit: 100, offset: 0 } })
    }

    const listRecords = async (req: Request, res: Response) => {
        const { slug, treeEntityCodename, linkedCollectionCodename } = req.params
        const parsed = paginationSchema.safeParse(req.query)
        if (!parsed.success) {
            throw new MetahubValidationError('Invalid pagination parameters', { details: parsed.error.format() })
        }
        const { limit, offset } = parsed.data
        const { exec, treeEntitiesService, objectsService, recordsService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        const treeEntity = await resolveTreeEntity(treeEntitiesService, metahub.id, treeEntityCodename)
        const linkedCollection = await resolveLinkedCollectionInTreeEntity(
            objectsService,
            metahub.id,
            linkedCollectionCodename,
            treeEntity.id
        )

        const { items: records, total } = await recordsService.findAllAndCount(metahub.id, linkedCollection.id, {
            limit,
            offset,
            sortOrder: 'asc'
        })
        res.json({ items: records, pagination: { total, limit, offset } })
    }

    const getRecord = async (req: Request, res: Response) => {
        const { slug, treeEntityCodename, linkedCollectionCodename, recordId } = req.params
        const { exec, treeEntitiesService, objectsService, recordsService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        const treeEntity = await resolveTreeEntity(treeEntitiesService, metahub.id, treeEntityCodename)
        const linkedCollection = await resolveLinkedCollectionInTreeEntity(
            objectsService,
            metahub.id,
            linkedCollectionCodename,
            treeEntity.id
        )

        const record = await recordsService.findById(metahub.id, linkedCollection.id, recordId)
        if (!record) {
            throw new MetahubNotFoundError('Record')
        }
        res.json(record)
    }

    return {
        getBySlug,
        listTreeEntities,
        getTreeEntity,
        listLinkedCollections,
        getLinkedCollection,
        listFieldDefinitions,
        listRecords,
        getRecord
    }
}
