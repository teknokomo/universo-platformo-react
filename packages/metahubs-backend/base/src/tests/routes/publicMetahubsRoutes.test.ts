/**
 * Public Metahubs Routes Tests
 *
 * Tests for the public API that exposes published metahubs without authentication.
 * Hierarchy: Metahub → Hub → Catalog → Attributes/Records
 */

const mockFindPublicMetahubBySlug = jest.fn()
const mockListPublicationsByMetahub = jest.fn()
const mockFindActivePublicationVersion = jest.fn()
const mockTreeEntitiesFindAll = jest.fn()
const mockTreeEntitiesFindByCodename = jest.fn()
const mockObjectsFindAll = jest.fn()
const mockObjectsFindByCodename = jest.fn()
const mockFieldDefinitionsFindAll = jest.fn()
const mockRecordsFindAllAndCount = jest.fn()
const mockRecordsFindById = jest.fn()

jest.mock('../../persistence', () => ({
    findPublicMetahubBySlug: (...args: unknown[]) => mockFindPublicMetahubBySlug(...args),
    listPublicationsByMetahub: (...args: unknown[]) => mockListPublicationsByMetahub(...args),
    findActivePublicationVersion: (...args: unknown[]) => mockFindActivePublicationVersion(...args)
}))

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    MetahubSchemaService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/metahubs/services/MetahubObjectsService', () => ({
    MetahubObjectsService: jest.fn().mockImplementation(() => ({
        findAll: (...args: unknown[]) => mockObjectsFindAll(...args),
        findByCodename: (...args: unknown[]) => mockObjectsFindByCodename(...args)
    }))
}))

jest.mock('../../domains/metahubs/services/MetahubFieldDefinitionsService', () => ({
    MetahubFieldDefinitionsService: jest.fn().mockImplementation(() => ({
        findAll: (...args: unknown[]) => mockFieldDefinitionsFindAll(...args)
    }))
}))

jest.mock('../../domains/metahubs/services/MetahubRecordsService', () => ({
    MetahubRecordsService: jest.fn().mockImplementation(() => ({
        findAllAndCount: (...args: unknown[]) => mockRecordsFindAllAndCount(...args),
        findById: (...args: unknown[]) => mockRecordsFindById(...args)
    }))
}))

jest.mock('../../domains/metahubs/services/MetahubTreeEntitiesService', () => ({
    MetahubTreeEntitiesService: jest.fn().mockImplementation(() => ({
        findAll: (...args: unknown[]) => mockTreeEntitiesFindAll(...args),
        findByCodename: (...args: unknown[]) => mockTreeEntitiesFindByCodename(...args)
    }))
}))

import express, { type Request, type Response, type NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const request = require('supertest')

import { createPublicMetahubsRoutes } from '../../domains/metahubs/routes/publicMetahubsRoutes'

const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
    next()
}) as RateLimitRequestHandler

const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return _next(err)
    const e = err as { statusCode?: number; status?: number; message?: string }
    const statusCode = e.statusCode || e.status || 500
    res.status(statusCode).json({ error: e.message || 'Internal Server Error' })
}

const mockExec = { query: jest.fn(), transaction: jest.fn() }

function buildApp() {
    const app = express()
    app.use(express.json())
    app.use(
        '/public',
        createPublicMetahubsRoutes(() => mockExec as never, mockRateLimiter)
    )
    app.use(errorHandler)
    return app
}

const METAHUB = { id: 'mh-1', slug: 'my-project', name: 'My Project', isPublic: true }
const PUBLICATION = { id: 'pub-1', metahubId: 'mh-1', accessMode: 'full', activeVersionId: 'ver-1' }
const ACTIVE_VERSION = { id: 'ver-1', publicationId: 'pub-1', isActive: true, snapshotJson: { entities: {} } }
const TREE_ENTITY = { id: 'hub-1', codename: 'main-hub', metahubId: 'mh-1' }
const LINKED_COLLECTION = {
    id: 'cat-1',
    kind: 'catalog',
    codename: 'products',
    metahubId: 'mh-1',
    config: { hubs: ['hub-1'] }
}
const FIELD_DEFINITION = { id: 'attr-1', codename: 'title', linkedCollectionId: 'cat-1' }
const RECORD = { id: 'el-1', linkedCollectionId: 'cat-1', data: { title: 'Book' } }

describe('publicMetahubsRoutes', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockFindPublicMetahubBySlug.mockResolvedValue(METAHUB)
        mockListPublicationsByMetahub.mockResolvedValue([PUBLICATION])
        mockFindActivePublicationVersion.mockResolvedValue(ACTIVE_VERSION)
        mockTreeEntitiesFindByCodename.mockResolvedValue(TREE_ENTITY)
        mockObjectsFindByCodename.mockResolvedValue(LINKED_COLLECTION)
    })

    // ── GET /:slug ────────────────────────────────────────────
    it('returns metahub by slug', async () => {
        const res = await request(buildApp()).get('/public/my-project')
        expect(res.status).toBe(200)
        expect(res.body.slug).toBe('my-project')
    })

    it('returns 404 for unknown slug', async () => {
        mockFindPublicMetahubBySlug.mockResolvedValue(null)

        const res = await request(buildApp()).get('/public/unknown')
        expect(res.status).toBe(404)
    })

    it('returns 404 when the public metahub has no active full-access publication', async () => {
        mockListPublicationsByMetahub.mockResolvedValue([])

        const res = await request(buildApp()).get('/public/my-project')
        expect(res.status).toBe(404)
    })

    it('returns 404 when the only publication is access-restricted', async () => {
        mockListPublicationsByMetahub.mockResolvedValue([{ ...PUBLICATION, accessMode: 'restricted' }])

        const res = await request(buildApp()).get('/public/my-project')
        expect(res.status).toBe(404)
    })

    it('returns 404 when the public publication has no active snapshot-backed version', async () => {
        mockFindActivePublicationVersion.mockResolvedValue(null)

        const res = await request(buildApp()).get('/public/my-project')
        expect(res.status).toBe(404)
    })

    // ── GET /:slug/tree-entities ──────────────────────────────
    it('lists hubs for a metahub', async () => {
        mockTreeEntitiesFindAll.mockResolvedValue({ items: [TREE_ENTITY] })

        const res = await request(buildApp()).get('/public/my-project/tree-entities')
        expect(res.status).toBe(200)
        expect(res.body.items).toHaveLength(1)
    })

    // ── GET /:slug/tree-entity/:treeEntityCodename ───────────
    it('returns a hub by codename', async () => {
        const res = await request(buildApp()).get('/public/my-project/tree-entity/main-hub')
        expect(res.status).toBe(200)
        expect(res.body.codename).toBe('main-hub')
    })

    it('returns 404 for unknown hub codename', async () => {
        mockTreeEntitiesFindByCodename.mockResolvedValue(null)

        const res = await request(buildApp()).get('/public/my-project/tree-entity/nope')
        expect(res.status).toBe(404)
    })

    // ── GET /:slug/tree-entity/:treeEntityCodename/linked-collections ──
    it('lists catalogs in a hub', async () => {
        mockObjectsFindAll.mockResolvedValue([LINKED_COLLECTION])

        const res = await request(buildApp()).get('/public/my-project/tree-entity/main-hub/linked-collections')
        expect(res.status).toBe(200)
        expect(res.body.items).toHaveLength(1)
    })

    it('filters catalogs not belonging to the hub', async () => {
        const otherLinkedCollection = { ...LINKED_COLLECTION, id: 'cat-2', config: { hubs: ['other-hub'] } }
        mockObjectsFindAll.mockResolvedValue([LINKED_COLLECTION, otherLinkedCollection])

        const res = await request(buildApp()).get('/public/my-project/tree-entity/main-hub/linked-collections')
        expect(res.status).toBe(200)
        expect(res.body.items).toHaveLength(1)
        expect(res.body.items[0].id).toBe('cat-1')
    })

    it('filters objects that are not catalog compatible kinds', async () => {
        const nonLinkedCollection = { ...LINKED_COLLECTION, id: 'cat-2', kind: 'set', config: { hubs: ['hub-1'] } }
        mockObjectsFindAll.mockResolvedValue([LINKED_COLLECTION, nonLinkedCollection])

        const res = await request(buildApp()).get('/public/my-project/tree-entity/main-hub/linked-collections')
        expect(res.status).toBe(200)
        expect(res.body.items).toHaveLength(1)
        expect(res.body.items[0].id).toBe('cat-1')
    })

    // ── GET /:slug/tree-entity/:treeEntityCodename/linked-collection/:linkedCollectionCodename ──
    it('returns a catalog by codename', async () => {
        const res = await request(buildApp()).get('/public/my-project/tree-entity/main-hub/linked-collection/products')
        expect(res.status).toBe(200)
        expect(res.body.codename).toBe('products')
    })

    it('returns 404 for catalog not in hub', async () => {
        mockObjectsFindByCodename.mockResolvedValue({
            ...LINKED_COLLECTION,
            config: { hubs: ['other-hub-id'] }
        })

        const res = await request(buildApp()).get('/public/my-project/tree-entity/main-hub/linked-collection/products')
        expect(res.status).toBe(404)
    })

    it('returns 404 for object codename that is not catalog compatible', async () => {
        mockObjectsFindByCodename.mockResolvedValue({ ...LINKED_COLLECTION, kind: 'set' })

        const res = await request(buildApp()).get('/public/my-project/tree-entity/main-hub/linked-collection/products')
        expect(res.status).toBe(404)
    })

    // ── GET .../field-definitions ─────────────────────────────
    it('lists field definitions for a catalog', async () => {
        mockFieldDefinitionsFindAll.mockResolvedValue([FIELD_DEFINITION])

        const res = await request(buildApp()).get('/public/my-project/tree-entity/main-hub/linked-collection/products/field-definitions')
        expect(res.status).toBe(200)
        expect(res.body.items).toHaveLength(1)
    })

    // ── GET .../records ───────────────────────────────────────
    it('lists records with pagination', async () => {
        mockRecordsFindAllAndCount.mockResolvedValue({ items: [RECORD], total: 1 })

        const res = await request(buildApp()).get(
            '/public/my-project/tree-entity/main-hub/linked-collection/products/records?limit=10&offset=0'
        )
        expect(res.status).toBe(200)
        expect(res.body.items).toHaveLength(1)
        expect(res.body.pagination.total).toBe(1)
    })

    // ── GET .../record/:recordId ──────────────────────────────
    it('returns a single record', async () => {
        mockRecordsFindById.mockResolvedValue(RECORD)

        const res = await request(buildApp()).get('/public/my-project/tree-entity/main-hub/linked-collection/products/record/el-1')
        expect(res.status).toBe(200)
        expect(res.body.id).toBe('el-1')
    })

    it('returns 404 for missing record', async () => {
        mockRecordsFindById.mockResolvedValue(null)

        const res = await request(buildApp()).get('/public/my-project/tree-entity/main-hub/linked-collection/products/record/no-such')
        expect(res.status).toBe(404)
    })
})
