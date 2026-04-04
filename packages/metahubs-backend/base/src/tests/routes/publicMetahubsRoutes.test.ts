/**
 * Public Metahubs Routes Tests
 *
 * Tests for the public API that exposes published metahubs without authentication.
 * Hierarchy: Metahub → Hub → Catalog → Attributes/Elements
 */

const mockFindPublicMetahubBySlug = jest.fn()
const mockHubsFindAll = jest.fn()
const mockHubsFindByCodename = jest.fn()
const mockObjectsFindAll = jest.fn()
const mockObjectsFindByCodename = jest.fn()
const mockAttributesFindAll = jest.fn()
const mockElementsFindAllAndCount = jest.fn()
const mockElementsFindById = jest.fn()

jest.mock('../../persistence', () => ({
    findPublicMetahubBySlug: (...args: unknown[]) => mockFindPublicMetahubBySlug(...args)
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

jest.mock('../../domains/metahubs/services/MetahubAttributesService', () => ({
    MetahubAttributesService: jest.fn().mockImplementation(() => ({
        findAll: (...args: unknown[]) => mockAttributesFindAll(...args)
    }))
}))

jest.mock('../../domains/metahubs/services/MetahubElementsService', () => ({
    MetahubElementsService: jest.fn().mockImplementation(() => ({
        findAllAndCount: (...args: unknown[]) => mockElementsFindAllAndCount(...args),
        findById: (...args: unknown[]) => mockElementsFindById(...args)
    }))
}))

jest.mock('../../domains/metahubs/services/MetahubHubsService', () => ({
    MetahubHubsService: jest.fn().mockImplementation(() => ({
        findAll: (...args: unknown[]) => mockHubsFindAll(...args),
        findByCodename: (...args: unknown[]) => mockHubsFindByCodename(...args)
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
const HUB = { id: 'hub-1', codename: 'main-hub', metahubId: 'mh-1' }
const CATALOG = {
    id: 'cat-1',
    codename: 'products',
    metahubId: 'mh-1',
    config: { hubs: ['hub-1'] }
}
const ATTRIBUTE = { id: 'attr-1', codename: 'title', catalogId: 'cat-1' }
const ELEMENT = { id: 'el-1', catalogId: 'cat-1', data: { title: 'Book' } }

describe('publicMetahubsRoutes', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockFindPublicMetahubBySlug.mockResolvedValue(METAHUB)
        mockHubsFindByCodename.mockResolvedValue(HUB)
        mockObjectsFindByCodename.mockResolvedValue(CATALOG)
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

    // ── GET /:slug/hubs ───────────────────────────────────────
    it('lists hubs for a metahub', async () => {
        mockHubsFindAll.mockResolvedValue({ items: [HUB] })

        const res = await request(buildApp()).get('/public/my-project/hubs')
        expect(res.status).toBe(200)
        expect(res.body.items).toHaveLength(1)
    })

    // ── GET /:slug/hub/:hubCodename ───────────────────────────
    it('returns a hub by codename', async () => {
        const res = await request(buildApp()).get('/public/my-project/hub/main-hub')
        expect(res.status).toBe(200)
        expect(res.body.codename).toBe('main-hub')
    })

    it('returns 404 for unknown hub codename', async () => {
        mockHubsFindByCodename.mockResolvedValue(null)

        const res = await request(buildApp()).get('/public/my-project/hub/nope')
        expect(res.status).toBe(404)
    })

    // ── GET /:slug/hub/:hubCodename/catalogs ──────────────────
    it('lists catalogs in a hub', async () => {
        mockObjectsFindAll.mockResolvedValue([CATALOG])

        const res = await request(buildApp()).get('/public/my-project/hub/main-hub/catalogs')
        expect(res.status).toBe(200)
        expect(res.body.items).toHaveLength(1)
    })

    it('filters catalogs not belonging to the hub', async () => {
        const otherCatalog = { ...CATALOG, id: 'cat-2', config: { hubs: ['other-hub'] } }
        mockObjectsFindAll.mockResolvedValue([CATALOG, otherCatalog])

        const res = await request(buildApp()).get('/public/my-project/hub/main-hub/catalogs')
        expect(res.status).toBe(200)
        expect(res.body.items).toHaveLength(1)
        expect(res.body.items[0].id).toBe('cat-1')
    })

    // ── GET /:slug/hub/:hubCodename/catalog/:catalogCodename ──
    it('returns a catalog by codename', async () => {
        const res = await request(buildApp()).get('/public/my-project/hub/main-hub/catalog/products')
        expect(res.status).toBe(200)
        expect(res.body.codename).toBe('products')
    })

    it('returns 404 for catalog not in hub', async () => {
        mockObjectsFindByCodename.mockResolvedValue({
            ...CATALOG,
            config: { hubs: ['other-hub-id'] }
        })

        const res = await request(buildApp()).get('/public/my-project/hub/main-hub/catalog/products')
        expect(res.status).toBe(404)
    })

    // ── GET .../attributes ────────────────────────────────────
    it('lists attributes for a catalog', async () => {
        mockAttributesFindAll.mockResolvedValue([ATTRIBUTE])

        const res = await request(buildApp()).get('/public/my-project/hub/main-hub/catalog/products/attributes')
        expect(res.status).toBe(200)
        expect(res.body.items).toHaveLength(1)
    })

    // ── GET .../elements ──────────────────────────────────────
    it('lists elements with pagination', async () => {
        mockElementsFindAllAndCount.mockResolvedValue({ items: [ELEMENT], total: 1 })

        const res = await request(buildApp()).get('/public/my-project/hub/main-hub/catalog/products/elements?limit=10&offset=0')
        expect(res.status).toBe(200)
        expect(res.body.items).toHaveLength(1)
        expect(res.body.pagination.total).toBe(1)
    })

    // ── GET .../element/:elementId ────────────────────────────
    it('returns a single element', async () => {
        mockElementsFindById.mockResolvedValue(ELEMENT)

        const res = await request(buildApp()).get('/public/my-project/hub/main-hub/catalog/products/element/el-1')
        expect(res.status).toBe(200)
        expect(res.body.id).toBe('el-1')
    })

    it('returns 404 for missing element', async () => {
        mockElementsFindById.mockResolvedValue(null)

        const res = await request(buildApp()).get('/public/my-project/hub/main-hub/catalog/products/element/no-such')
        expect(res.status).toBe(404)
    })
})
