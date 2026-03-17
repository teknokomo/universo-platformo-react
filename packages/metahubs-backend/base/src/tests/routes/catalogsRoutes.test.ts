jest.mock('@universo/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createCatalogsRoutes } from '../../domains/catalogs/routes/catalogsRoutes'

const mockFindMetahubById = jest.fn(async () => ({ id: 'test-metahub-id' }))

jest.mock('../../persistence', () => ({
    __esModule: true,
    findMetahubById: (...args: unknown[]) => mockFindMetahubById(...args)
}))

const mockEnsureMetahubAccess = jest.fn()
const mockEnsureSchema = jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
const mockGenerateTableName = jest.fn((id: string, kind: string) => `${kind}_${id}`)

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

jest.mock('../../domains/ddl', () => ({
    __esModule: true,
    generateTableName: (...args: unknown[]) => mockGenerateTableName(...(args as [string, string]))
}))

const mockObjectsService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByCodename: jest.fn(),
    createCatalog: jest.fn(),
    createEnumeration: jest.fn(),
    updateCatalog: jest.fn(),
    delete: jest.fn(),
    findDeleted: jest.fn(),
    restore: jest.fn(),
    permanentDelete: jest.fn(),
    reorderByKind: jest.fn()
}

const mockHubsService = {
    findByIds: jest.fn(),
    findById: jest.fn()
}

const mockAttributesService = {
    countByObjectIds: jest.fn(),
    findCatalogReferenceBlockers: jest.fn(),
    ensureCatalogSystemAttributes: jest.fn(async () => [])
}

const mockElementsService = {
    countByObjectIds: jest.fn()
}

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn().mockImplementation(() => ({
        ensureSchema: (...args: unknown[]) => mockEnsureSchema(...args)
    }))
}))

jest.mock('../../domains/metahubs/services/MetahubObjectsService', () => ({
    __esModule: true,
    MetahubObjectsService: jest.fn().mockImplementation(() => mockObjectsService)
}))

jest.mock('../../domains/metahubs/services/MetahubHubsService', () => ({
    __esModule: true,
    MetahubHubsService: jest.fn().mockImplementation(() => mockHubsService)
}))

jest.mock('../../domains/metahubs/services/MetahubAttributesService', () => ({
    __esModule: true,
    MetahubAttributesService: jest.fn().mockImplementation(() => mockAttributesService)
}))

jest.mock('../../domains/metahubs/services/MetahubElementsService', () => ({
    __esModule: true,
    MetahubElementsService: jest.fn().mockImplementation(() => mockElementsService)
}))

const mockSettingsService = {
    findByKey: jest.fn(async (_metahubId: string, key: string) => {
        const values: Record<string, unknown> = {
            'general.codenameStyle': 'pascal-case',
            'general.codenameAlphabet': 'en-ru',
            'general.codenameAllowMixedAlphabets': false,
            'catalogs.allowCopy': true,
            'catalogs.allowDelete': true
        }
        return key in values ? { key, value: { _value: values[key] } } : null
    }),
    findAll: jest.fn(async () => [])
}

jest.mock('../../domains/settings/services/MetahubSettingsService', () => ({
    __esModule: true,
    MetahubSettingsService: jest.fn().mockImplementation(() => mockSettingsService)
}))

describe('Catalogs Routes', () => {
    const createCatalogCopyTransactionTrx = (params?: {
        sourceSystemRows?: Array<Record<string, unknown>>
        sourceAttributes?: Array<Record<string, unknown>>
        sourceElements?: Array<Record<string, unknown>>
    }) => {
        const sourceSystemRows = params?.sourceSystemRows ?? []
        const sourceAttributes = params?.sourceAttributes ?? []
        const sourceElements = params?.sourceElements ?? []

        const queryMock = jest.fn().mockResolvedValue([])

        if (sourceSystemRows.length > 0) {
            queryMock.mockResolvedValueOnce(sourceSystemRows)
        }

        // Sequenced responses: SELECT attrs, then INSERT per attr, then SELECT elems, then INSERT elems
        if (sourceAttributes.length > 0) {
            queryMock.mockResolvedValueOnce(sourceAttributes)
            for (let i = 0; i < sourceAttributes.length; i++) {
                queryMock.mockResolvedValueOnce([{ id: `copied-attr-${i}` }])
            }
        }
        if (sourceElements.length > 0) {
            queryMock.mockResolvedValueOnce(sourceElements)
            queryMock.mockResolvedValueOnce(sourceElements.map((_, i) => ({ id: `copied-elem-${i}` })))
        }

        return { query: queryMock }
    }

    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as unknown as { user?: { id: string } }).user = { id: 'test-user-id' }
        next()
    }

    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    const errorHandler = (err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, next: NextFunction) => {
        if (res.headersSent) {
            return next(err)
        }
        const statusCode = err.statusCode || err.status || 500
        const message = err.message || 'Internal Server Error'
        res.status(statusCode).json({ error: message })
    }

    const mockExec = {
        query: jest.fn(async () => []),
        transaction: jest.fn(async (cb: any) => cb({ query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false })),
        isReleased: () => false
    }

    const buildApp = () => {
        const app = express()
        app.use(express.json())
        app.use(createCatalogsRoutes(ensureAuth, () => mockExec as any, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()

        mockObjectsService.findAll.mockResolvedValue([])
        mockObjectsService.findById.mockResolvedValue(null)
        mockObjectsService.findByCodename.mockResolvedValue(null)
        mockObjectsService.createCatalog.mockResolvedValue({
            id: 'catalog-copy-id',
            codename: 'ProductsCopy',
            presentation: {
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Products (copy)' } } },
                description: null
            },
            config: { hubs: [], isSingleHub: false, isRequiredHub: false, sortOrder: 6 },
            _upl_version: 1,
            _upl_created_at: '2026-02-26T00:00:00.000Z',
            _upl_updated_at: '2026-02-26T00:00:00.000Z'
        })
        mockObjectsService.updateCatalog.mockResolvedValue(null)
        mockObjectsService.delete.mockResolvedValue(undefined)
        mockObjectsService.findDeleted.mockResolvedValue([])
        mockObjectsService.restore.mockResolvedValue(undefined)
        mockObjectsService.permanentDelete.mockResolvedValue(undefined)
        mockObjectsService.reorderByKind.mockResolvedValue({
            id: '22222222-2222-4222-8222-222222222222',
            config: { sortOrder: 3 }
        })

        mockHubsService.findByIds.mockResolvedValue([])
        mockHubsService.findById.mockResolvedValue(null)

        mockAttributesService.countByObjectIds.mockResolvedValue(new Map<string, number>())
        mockAttributesService.findCatalogReferenceBlockers.mockResolvedValue([])

        mockElementsService.countByObjectIds.mockResolvedValue(new Map<string, number>())
        mockFindMetahubById.mockResolvedValue({ id: 'test-metahub-id' })
        mockEnsureMetahubAccess.mockResolvedValue({ metahubId: 'test-metahub-id' })
        mockEnsureSchema.mockResolvedValue('mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
    })

    describe('GET /metahub/:metahubId/catalogs', () => {
        it('returns empty list', async () => {
            const app = buildApp()

            const response = await request(app).get('/metahub/test-metahub-id/catalogs').expect(200)

            expect(response.body).toMatchObject({ items: [], pagination: { total: 0 } })
            expect(mockObjectsService.findAll).toHaveBeenCalledWith('test-metahub-id', 'test-user-id')
        })

        it('accepts sortBy=sortOrder query parameter', async () => {
            const app = buildApp()

            const response = await request(app)
                .get('/metahub/test-metahub-id/catalogs?limit=20&offset=0&sortBy=sortOrder&sortOrder=asc')
                .expect(200)

            expect(response.body).toMatchObject({ items: [], pagination: { total: 0, limit: 20, offset: 0 } })
        })

        it('returns catalogs with counts and hub associations', async () => {
            const now = new Date('2026-02-11T00:00:00.000Z')
            const rawCatalogs = [
                {
                    id: 'catalog-1',
                    codename: 'products',
                    presentation: { name: { en: 'Products' }, description: { en: 'Product catalog' } },
                    config: { hubs: ['hub-1'], isSingleHub: false, isRequiredHub: false, sortOrder: 3 },
                    _upl_version: 7,
                    created_at: now,
                    updated_at: now
                }
            ]

            mockObjectsService.findAll.mockResolvedValue(rawCatalogs)
            mockAttributesService.countByObjectIds.mockResolvedValue(new Map([['catalog-1', 2]]))
            mockElementsService.countByObjectIds.mockResolvedValue(new Map([['catalog-1', 5]]))
            mockHubsService.findByIds.mockResolvedValue([{ id: 'hub-1', name: { en: 'Hub 1' }, codename: 'hub-1' }])

            const app = buildApp()
            const response = await request(app).get('/metahub/test-metahub-id/catalogs').expect(200)

            expect(response.body.pagination).toMatchObject({ total: 1, limit: 100, offset: 0 })
            expect(response.body.items).toHaveLength(1)
            expect(response.body.items[0]).toMatchObject({
                id: 'catalog-1',
                codename: 'products',
                sortOrder: 3,
                attributesCount: 2,
                elementsCount: 5
            })
            expect(response.body.items[0].hubs).toEqual([
                {
                    id: 'hub-1',
                    name: { en: 'Hub 1' },
                    codename: 'hub-1'
                }
            ])
        })
    })

    describe('PATCH /metahub/:metahubId/catalogs/reorder', () => {
        it('reorders catalog and returns updated sort order', async () => {
            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/test-metahub-id/catalogs/reorder')
                .send({
                    catalogId: '22222222-2222-4222-8222-222222222222',
                    newSortOrder: 3
                })
                .expect(200)

            expect(response.body).toEqual({
                id: '22222222-2222-4222-8222-222222222222',
                sortOrder: 3
            })
            expect(mockObjectsService.reorderByKind).toHaveBeenCalledWith(
                'test-metahub-id',
                'catalog',
                '22222222-2222-4222-8222-222222222222',
                3,
                'test-user-id'
            )
        })

        it('returns 404 when catalog is not found for reorder', async () => {
            mockObjectsService.reorderByKind.mockRejectedValueOnce(new Error('catalog not found'))

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/test-metahub-id/catalogs/reorder')
                .send({
                    catalogId: '22222222-2222-4222-8222-222222222222',
                    newSortOrder: 3
                })
                .expect(404)

            expect(response.body.error).toBe('Catalog not found')
        })
    })

    describe('POST /metahub/:metahubId/catalogs', () => {
        it('creates catalog without hub associations', async () => {
            const tx = { query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false }
            mockObjectsService.createCatalog.mockResolvedValue({
                id: 'catalog-new',
                codename: 'NewCatalog',
                presentation: { name: { en: 'New Catalog' }, description: undefined },
                config: { hubs: [], isSingleHub: false, isRequiredHub: false, sortOrder: 0 },
                _upl_version: 1,
                created_at: new Date('2026-02-11T00:00:00.000Z'),
                updated_at: new Date('2026-02-11T00:00:00.000Z')
            })

            const app = buildApp()
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(tx)
            )
            const response = await request(app)
                .post('/metahub/test-metahub-id/catalogs')
                .send({ codename: 'new-catalog', name: 'New Catalog' })
                .expect(201)

            expect(response.body).toMatchObject({ id: 'catalog-new', codename: 'NewCatalog' })
            expect(mockObjectsService.createCatalog).toHaveBeenCalledWith(
                'test-metahub-id',
                expect.objectContaining({
                    codename: 'NewCatalog',
                    config: expect.objectContaining({ hubs: [] })
                }),
                'test-user-id',
                tx
            )
            expect(mockAttributesService.ensureCatalogSystemAttributes).toHaveBeenCalledWith(
                'test-metahub-id',
                'catalog-new',
                'test-user-id',
                tx,
                {
                    policy: {
                        allowConfiguration: false,
                        forceCreate: true,
                        ignoreMetahubSettings: true
                    }
                }
            )
        })

        it('rejects duplicate codename', async () => {
            mockObjectsService.findByCodename.mockResolvedValue({ id: 'existing' })

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/test-metahub-id/catalogs')
                .send({ codename: 'existing', name: 'Existing' })
                .expect(409)

            expect(response.body.error).toContain('already exists')
        })

        it('rejects invalid hub IDs', async () => {
            mockHubsService.findByIds.mockResolvedValue([])

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/test-metahub-id/catalogs')
                .send({
                    codename: 'catalog-with-hub',
                    name: 'Catalog',
                    hubIds: ['00000000-0000-0000-0000-000000000001']
                })
                .expect(400)

            expect(response.body.error).toContain('hub IDs are invalid')
        })

        it('rejects single-hub catalog when multiple hub IDs are provided', async () => {
            const app = buildApp()

            const response = await request(app)
                .post('/metahub/test-metahub-id/catalogs')
                .send({
                    codename: 'Products',
                    name: { en: 'Products' },
                    isSingleHub: true,
                    hubIds: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002']
                })
                .expect(400)

            expect(response.body.error).toContain('single hub')
            expect(mockObjectsService.createCatalog).not.toHaveBeenCalled()
        })
    })

    describe('POST /metahub/:metahubId/hub/:hubId/catalogs', () => {
        it('creates catalog atomically with hub-scoped system-attribute seeding', async () => {
            const tx = { query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false }
            mockHubsService.findById.mockResolvedValue({ id: 'hub-1' })
            mockHubsService.findByIds.mockResolvedValue([{ id: 'hub-1' }])
            mockObjectsService.createCatalog.mockResolvedValue({
                id: 'catalog-hub-new',
                codename: 'HubCatalog',
                presentation: { name: { en: 'Hub Catalog' }, description: undefined },
                config: { hubs: ['hub-1'], isSingleHub: false, isRequiredHub: false, sortOrder: 0 },
                _upl_version: 1,
                created_at: new Date('2026-02-11T00:00:00.000Z'),
                updated_at: new Date('2026-02-11T00:00:00.000Z')
            })

            const app = buildApp()
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(tx)
            )
            const response = await request(app)
                .post('/metahub/test-metahub-id/hub/hub-1/catalogs')
                .send({ codename: 'hub-catalog', name: 'Hub Catalog' })
                .expect(201)

            expect(response.body).toMatchObject({ id: 'catalog-hub-new', codename: 'HubCatalog' })
            expect(mockObjectsService.createCatalog).toHaveBeenCalledWith(
                'test-metahub-id',
                expect.objectContaining({
                    codename: 'HubCatalog',
                    config: expect.objectContaining({ hubs: ['hub-1'] })
                }),
                'test-user-id',
                tx
            )
            expect(mockAttributesService.ensureCatalogSystemAttributes).toHaveBeenCalledWith(
                'test-metahub-id',
                'catalog-hub-new',
                'test-user-id',
                tx,
                {
                    policy: {
                        allowConfiguration: false,
                        forceCreate: true,
                        ignoreMetahubSettings: true
                    }
                }
            )
        })

        it('rejects single-hub catalog when explicit hub list contains multiple hubs', async () => {
            mockHubsService.findById.mockResolvedValue({ id: 'hub-1' })
            mockHubsService.findByIds.mockResolvedValue([
                { id: '00000000-0000-0000-0000-000000000001' },
                { id: '00000000-0000-0000-0000-000000000002' }
            ])

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/test-metahub-id/hub/hub-1/catalogs')
                .send({
                    codename: 'Products',
                    name: { en: 'Products' },
                    isSingleHub: true,
                    hubIds: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002']
                })
                .expect(400)

            expect(response.body.error).toContain('single hub')
            expect(mockObjectsService.createCatalog).not.toHaveBeenCalled()
        })
    })

    describe('DELETE /metahub/:metahubId/catalog/:catalogId', () => {
        it('returns 404 for non-existent catalog', async () => {
            const app = buildApp()
            const response = await request(app).delete('/metahub/test-metahub-id/catalog/non-existent-id').expect(404)

            expect(response.body.error).toBe('Catalog not found')
            expect(mockObjectsService.delete).not.toHaveBeenCalled()
        })

        it('deletes catalog when there are no blocking references', async () => {
            mockObjectsService.findById.mockResolvedValue({ id: 'catalog-to-delete', config: { hubs: [] } })

            const app = buildApp()
            await request(app).delete('/metahub/test-metahub-id/catalog/catalog-to-delete').expect(204)

            expect(mockAttributesService.findCatalogReferenceBlockers).toHaveBeenCalledWith(
                'test-metahub-id',
                'catalog-to-delete',
                'test-user-id'
            )
            expect(mockObjectsService.delete).toHaveBeenCalledWith('test-metahub-id', 'catalog-to-delete', 'test-user-id')
        })

        it('returns 404 when object kind is not catalog', async () => {
            mockObjectsService.findById.mockResolvedValue({ id: 'catalog-to-delete', kind: 'enumeration' })

            const app = buildApp()
            await request(app).delete('/metahub/test-metahub-id/catalog/catalog-to-delete').expect(404)

            expect(mockObjectsService.delete).not.toHaveBeenCalled()
        })
    })

    describe('DELETE /metahub/:metahubId/hub/:hubId/catalog/:catalogId', () => {
        it('removes only hub association when multiple hubs exist', async () => {
            mockObjectsService.findById.mockResolvedValue({
                id: 'catalog-1',
                config: { hubs: ['hub-1', 'hub-2'], isRequiredHub: false }
            })

            const app = buildApp()
            const response = await request(app).delete('/metahub/test-metahub-id/hub/hub-1/catalog/catalog-1').expect(200)

            expect(response.body).toMatchObject({ message: 'Catalog removed from hub', remainingHubs: 1 })
            expect(mockObjectsService.updateCatalog).toHaveBeenCalledWith(
                'test-metahub-id',
                'catalog-1',
                expect.objectContaining({ config: expect.objectContaining({ hubs: ['hub-2'] }) }),
                'test-user-id'
            )
            expect(mockObjectsService.delete).not.toHaveBeenCalled()
        })

        it('returns 409 for required catalog on last hub without force', async () => {
            mockObjectsService.findById.mockResolvedValue({
                id: 'catalog-1',
                config: { hubs: ['hub-1'], isRequiredHub: true }
            })

            const app = buildApp()
            const response = await request(app).delete('/metahub/test-metahub-id/hub/hub-1/catalog/catalog-1').expect(409)

            expect(response.body.error).toContain('Cannot remove catalog from its last hub')
            expect(mockObjectsService.delete).not.toHaveBeenCalled()
        })

        it('deletes catalog when force=true and no blocking references', async () => {
            mockObjectsService.findById.mockResolvedValue({
                id: 'catalog-1',
                config: { hubs: ['hub-1'], isRequiredHub: true }
            })

            const app = buildApp()
            await request(app).delete('/metahub/test-metahub-id/hub/hub-1/catalog/catalog-1?force=true').expect(204)

            expect(mockObjectsService.delete).toHaveBeenCalledWith('test-metahub-id', 'catalog-1', 'test-user-id')
        })

        it('returns 409 when blocking references exist on forced delete', async () => {
            mockObjectsService.findById.mockResolvedValue({
                id: 'catalog-1',
                config: { hubs: ['hub-1'], isRequiredHub: false }
            })
            mockAttributesService.findCatalogReferenceBlockers.mockResolvedValue([
                {
                    catalogId: 'other-catalog',
                    attributeId: 'attr-ref',
                    attributeCodename: 'owner',
                    attributeName: { en: 'Owner' },
                    catalogCodename: 'products',
                    catalogName: { en: 'Products' }
                }
            ])

            const app = buildApp()
            const response = await request(app).delete('/metahub/test-metahub-id/hub/hub-1/catalog/catalog-1?force=true').expect(409)

            expect(response.body.error).toContain('Cannot delete catalog')
            expect(response.body.blockingReferences).toHaveLength(1)
            expect(mockObjectsService.delete).not.toHaveBeenCalled()
        })
    })

    describe('Catalog restore/permanent safety', () => {
        it('returns 409 on restore when codename conflict exists', async () => {
            mockObjectsService.findById.mockResolvedValue({ id: 'catalog-1', kind: 'catalog' })
            mockObjectsService.restore.mockRejectedValue({ code: '23505' })

            const app = buildApp()
            const response = await request(app).post('/metahub/test-metahub-id/catalog/catalog-1/restore').expect(409)

            expect(response.body.error).toContain('codename already exists')
        })

        it('returns 409 on permanent delete when blocking references exist', async () => {
            mockObjectsService.findById.mockResolvedValue({ id: 'catalog-1', kind: 'catalog' })
            mockAttributesService.findCatalogReferenceBlockers.mockResolvedValue([
                {
                    catalogId: 'other-catalog',
                    attributeId: 'attr-ref',
                    attributeCodename: 'owner',
                    attributeName: { en: 'Owner' },
                    catalogCodename: 'products',
                    catalogName: { en: 'Products' }
                }
            ])

            const app = buildApp()
            const response = await request(app).delete('/metahub/test-metahub-id/catalog/catalog-1/permanent').expect(409)

            expect(response.body.error).toContain('Cannot delete catalog')
            expect(mockObjectsService.permanentDelete).not.toHaveBeenCalled()
        })
    })

    describe('POST /metahub/:metahubId/catalog/:catalogId/copy', () => {
        it('returns 404 when metahub does not exist', async () => {
            mockFindMetahubById.mockResolvedValueOnce(null)

            const app = buildApp()
            const response = await request(app).post('/metahub/missing/catalog/catalog-1/copy').send({ codename: 'copy-1' }).expect(404)

            expect(response.body.error).toBe('Metahub not found')
            expect(mockEnsureMetahubAccess).not.toHaveBeenCalled()
        })

        it('returns 403 when metahub access check fails', async () => {
            const forbidden = Object.assign(new Error('Access denied to this metahub'), { status: 403 })
            mockEnsureMetahubAccess.mockRejectedValueOnce(forbidden)

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/test-metahub-id/catalog/catalog-1/copy')
                .send({ codename: 'copy-1' })
                .expect(403)

            expect(response.body.error).toBe('Access denied to this metahub')
            expect(mockObjectsService.findById).not.toHaveBeenCalled()
        })

        it('returns 404 when source catalog is not found', async () => {
            mockObjectsService.findById.mockResolvedValueOnce(null)

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/test-metahub-id/catalog/catalog-1/copy')
                .send({ codename: 'copy-1' })
                .expect(404)

            expect(response.body.error).toBe('Catalog not found')
        })

        it('returns 400 when copyElements=true but copyAttributes=false', async () => {
            mockObjectsService.findById.mockResolvedValueOnce({
                id: 'catalog-1',
                kind: 'catalog',
                codename: 'products',
                presentation: { name: { en: 'Products' }, description: null },
                config: { hubs: ['hub-1'], isSingleHub: false, isRequiredHub: false, sortOrder: 0 }
            })

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/test-metahub-id/catalog/catalog-1/copy')
                .send({
                    codename: 'products-copy',
                    copyAttributes: false,
                    copyElements: true
                })
                .expect(400)

            expect(response.body.error).toBe('Validation failed')
            expect(Array.isArray(response.body.details)).toBe(true)
        })

        it('copies catalog successfully when attributes and elements copy are disabled', async () => {
            mockObjectsService.findById.mockResolvedValueOnce({
                id: 'catalog-1',
                kind: 'catalog',
                codename: 'products',
                presentation: { name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Products' } } }, description: null },
                config: { hubs: [], isSingleHub: false, isRequiredHub: false, sortOrder: 5 }
            })

            const trx = createCatalogCopyTransactionTrx({
                sourceSystemRows: [
                    {
                        system_key: 'app.deleted',
                        is_system_enabled: false
                    },
                    {
                        system_key: 'app.deleted_at',
                        is_system_enabled: false
                    },
                    {
                        system_key: 'app.deleted_by',
                        is_system_enabled: false
                    }
                ]
            })
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/test-metahub-id/catalog/catalog-1/copy')
                .send({
                    codename: 'products-copy',
                    copyAttributes: false,
                    copyElements: false
                })
                .expect(201)

            expect(mockEnsureSchema).toHaveBeenCalledWith('test-metahub-id', 'test-user-id')
            expect(response.body.id).toBe('catalog-copy-id')
            expect(response.body.codename).toBe('ProductsCopy')
            expect(response.body.sortOrder).toBe(6)
            expect(response.body.attributesCount).toBe(0)
            expect(response.body.elementsCount).toBe(0)
            expect(mockObjectsService.createCatalog).toHaveBeenCalled()
            expect(mockAttributesService.ensureCatalogSystemAttributes).toHaveBeenCalledWith(
                'test-metahub-id',
                'catalog-copy-id',
                'test-user-id',
                trx,
                {
                    states: [
                        { key: 'app.deleted', enabled: false },
                        { key: 'app.deleted_at', enabled: false },
                        { key: 'app.deleted_by', enabled: false }
                    ],
                    policy: {
                        allowConfiguration: false,
                        forceCreate: true,
                        ignoreMetahubSettings: true
                    }
                }
            )
        })

        it('copies attributes and elements by default when options are omitted', async () => {
            mockObjectsService.findById.mockResolvedValueOnce({
                id: 'catalog-1',
                kind: 'catalog',
                codename: 'products',
                presentation: { name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Products' } } }, description: null },
                config: { hubs: [], isSingleHub: false, isRequiredHub: false, sortOrder: 5 }
            })

            const trx = createCatalogCopyTransactionTrx({
                sourceAttributes: [
                    {
                        id: 'attr-1',
                        codename: 'title',
                        data_type: 'string',
                        presentation: {},
                        validation_rules: {},
                        ui_config: {},
                        sort_order: 1,
                        is_required: false,
                        is_display_attribute: true,
                        target_object_id: null,
                        target_object_kind: null,
                        parent_attribute_id: null
                    }
                ],
                sourceElements: [
                    {
                        data: { title: 'Sample' },
                        sort_order: 1,
                        owner_id: null
                    }
                ]
            })
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/test-metahub-id/catalog/catalog-1/copy')
                .send({ codename: 'products-copy' })
                .expect(201)

            expect(response.body.attributesCount).toBe(1)
            expect(response.body.elementsCount).toBe(1)
            // trx.query called: SELECT attrs (1) + INSERT per attr (1) + SELECT elems (1) + INSERT elems (1) = 4
            expect(trx.query).toHaveBeenCalledTimes(4)
            expect(mockAttributesService.ensureCatalogSystemAttributes).toHaveBeenCalledWith(
                'test-metahub-id',
                'catalog-copy-id',
                'test-user-id',
                trx,
                {
                    states: undefined,
                    policy: {
                        allowConfiguration: false,
                        forceCreate: true,
                        ignoreMetahubSettings: true
                    }
                }
            )
        })

        it('retries catalog copy after codename unique violation and succeeds', async () => {
            mockObjectsService.findById.mockResolvedValue({
                id: 'catalog-1',
                kind: 'catalog',
                codename: 'products',
                presentation: { name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Products' } } }, description: null },
                config: { hubs: [], isSingleHub: false, isRequiredHub: false, sortOrder: 5 }
            })

            const uniqueViolation = Object.assign(new Error('duplicate key value violates unique constraint'), {
                code: '23505',
                constraint: 'idx_mhb_objects_kind_codename_active'
            })
            const trx = createCatalogCopyTransactionTrx()
            mockObjectsService.createCatalog.mockResolvedValueOnce({
                id: 'catalog-copy-id-2',
                codename: 'ProductsCopy_2',
                presentation: {
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Products (copy)' } } },
                    description: null
                },
                config: { hubs: [], isSingleHub: false, isRequiredHub: false, sortOrder: 6 },
                _upl_version: 1,
                _upl_created_at: '2026-02-26T00:00:00.000Z',
                _upl_updated_at: '2026-02-26T00:00:00.000Z'
            })
            ;(mockExec.transaction as jest.Mock)
                .mockRejectedValueOnce(uniqueViolation)
                .mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(trx))

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/test-metahub-id/catalog/catalog-1/copy')
                .send({
                    codename: 'products-copy',
                    copyAttributes: false,
                    copyElements: false
                })
                .expect(201)

            expect(response.body.id).toBe('catalog-copy-id-2')
            expect(response.body.codename).toBe('ProductsCopy_2')
            expect(mockExec.transaction).toHaveBeenCalledTimes(2)
        })
    })
})
