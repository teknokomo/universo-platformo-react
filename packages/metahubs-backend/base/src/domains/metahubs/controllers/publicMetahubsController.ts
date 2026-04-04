import type { Request, Response } from 'express'
import { z } from 'zod'
import { findPublicMetahubBySlug } from '../../../persistence'
import type { DbExecutor } from '../../../utils'
import { MetahubSchemaService } from '../services/MetahubSchemaService'
import { MetahubObjectsService } from '../services/MetahubObjectsService'
import type { MetahubObjectRow } from '../services/MetahubObjectsService'
import { MetahubAttributesService } from '../services/MetahubAttributesService'
import { MetahubElementsService } from '../services/MetahubElementsService'
import { MetahubHubsService } from '../services/MetahubHubsService'
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
    return metahub
}

const resolveHub = async (
    hubsService: MetahubHubsService,
    metahubId: string,
    hubCodename: string
): Promise<Record<string, unknown> & { id: string }> => {
    const hub = await hubsService.findByCodename(metahubId, hubCodename)
    if (!hub) {
        throw new MetahubNotFoundError('Hub')
    }
    return hub as Record<string, unknown> & { id: string }
}

const resolveCatalogInHub = async (
    objectsService: MetahubObjectsService,
    metahubId: string,
    catalogCodename: string,
    hubId: string
): Promise<MetahubObjectRow> => {
    const catalog = await objectsService.findByCodename(metahubId, catalogCodename)
    if (!catalog) {
        throw new MetahubNotFoundError('Catalog')
    }
    const hubs: string[] = ((catalog.config as Record<string, unknown>)?.hubs as string[]) || []
    if (!hubs.includes(hubId)) {
        throw new MetahubNotFoundError('Catalog')
    }
    return catalog
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export function createPublicMetahubsController(getDbExecutor: () => DbExecutor) {
    const services = () => {
        const exec = getDbExecutor()
        const schemaService = new MetahubSchemaService(exec)
        const objectsService = new MetahubObjectsService(exec, schemaService)
        const attributesService = new MetahubAttributesService(exec, schemaService)
        const elementsService = new MetahubElementsService(exec, schemaService, objectsService, attributesService)
        const hubsService = new MetahubHubsService(exec, schemaService)
        return { exec, hubsService, objectsService, attributesService, elementsService }
    }

    const getBySlug = async (req: Request, res: Response) => {
        const { slug } = req.params
        const { exec } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        res.json(metahub)
    }

    const listHubs = async (req: Request, res: Response) => {
        const { slug } = req.params
        const { exec, hubsService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)

        const { items: hubs } = await hubsService.findAll(metahub.id, {
            sortBy: 'sortOrder',
            sortOrder: 'asc'
        })
        res.json({ items: hubs, pagination: { total: hubs.length, limit: 100, offset: 0 } })
    }

    const getHub = async (req: Request, res: Response) => {
        const { slug, hubCodename } = req.params
        const { exec, hubsService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        const hub = await resolveHub(hubsService, metahub.id, hubCodename)
        res.json(hub)
    }

    const listCatalogs = async (req: Request, res: Response) => {
        const { slug, hubCodename } = req.params
        const { exec, hubsService, objectsService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        const hub = await resolveHub(hubsService, metahub.id, hubCodename)

        const allCatalogs = await objectsService.findAll(metahub.id)
        const catalogs = allCatalogs.filter((c) => {
            const hubs: string[] = ((c.config as Record<string, unknown>)?.hubs as string[]) || []
            return hubs.includes(hub.id)
        })
        res.json({ items: catalogs, pagination: { total: catalogs.length, limit: 100, offset: 0 } })
    }

    const getCatalog = async (req: Request, res: Response) => {
        const { slug, hubCodename, catalogCodename } = req.params
        const { exec, hubsService, objectsService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        const hub = await resolveHub(hubsService, metahub.id, hubCodename)
        const catalog = await resolveCatalogInHub(objectsService, metahub.id, catalogCodename, hub.id)
        res.json(catalog)
    }

    const listAttributes = async (req: Request, res: Response) => {
        const { slug, hubCodename, catalogCodename } = req.params
        const { exec, hubsService, objectsService, attributesService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        const hub = await resolveHub(hubsService, metahub.id, hubCodename)
        const catalog = await resolveCatalogInHub(objectsService, metahub.id, catalogCodename, hub.id)

        const attributes = await attributesService.findAll(metahub.id, catalog.id)
        res.json({ items: attributes, pagination: { total: attributes.length, limit: 100, offset: 0 } })
    }

    const listElements = async (req: Request, res: Response) => {
        const { slug, hubCodename, catalogCodename } = req.params
        const parsed = paginationSchema.safeParse(req.query)
        if (!parsed.success) {
            throw new MetahubValidationError('Invalid pagination parameters', { details: parsed.error.format() })
        }
        const { limit, offset } = parsed.data
        const { exec, hubsService, objectsService, elementsService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        const hub = await resolveHub(hubsService, metahub.id, hubCodename)
        const catalog = await resolveCatalogInHub(objectsService, metahub.id, catalogCodename, hub.id)

        const { items: elements, total } = await elementsService.findAllAndCount(metahub.id, catalog.id, {
            limit,
            offset,
            sortOrder: 'asc'
        })
        res.json({ items: elements, pagination: { total, limit, offset } })
    }

    const getElement = async (req: Request, res: Response) => {
        const { slug, hubCodename, catalogCodename, elementId } = req.params
        const { exec, hubsService, objectsService, elementsService } = services()
        const metahub = await resolvePublicMetahub(exec, slug)
        const hub = await resolveHub(hubsService, metahub.id, hubCodename)
        const catalog = await resolveCatalogInHub(objectsService, metahub.id, catalogCodename, hub.id)

        const element = await elementsService.findById(metahub.id, catalog.id, elementId)
        if (!element) {
            throw new MetahubNotFoundError('Element')
        }
        res.json(element)
    }

    return {
        getBySlug,
        listHubs,
        getHub,
        listCatalogs,
        getCatalog,
        listAttributes,
        listElements,
        getElement
    }
}
