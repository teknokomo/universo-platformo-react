jest.mock(
    'typeorm',
    () => {
        const decorator = () => () => undefined
        return {
            __esModule: true,
            Entity: decorator,
            PrimaryGeneratedColumn: decorator,
            PrimaryColumn: decorator,
            Column: decorator,
            CreateDateColumn: decorator,
            UpdateDateColumn: decorator,
            VersionColumn: decorator,
            ManyToOne: decorator,
            OneToMany: decorator,
            OneToOne: decorator,
            ManyToMany: decorator,
            JoinTable: decorator,
            JoinColumn: decorator,
            Index: decorator,
            Unique: decorator,
            In: jest.fn((value) => value)
        }
    },
    { virtual: true }
)

jest.mock('@universo/admin-backend', () => ({
    __esModule: true,
    isSuperuserByDataSource: jest.fn(async () => false),
    getGlobalRoleCodenameByDataSource: jest.fn(async () => null),
    hasSubjectPermissionByDataSource: jest.fn(async () => false)
}))

import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createMockDataSource, createMockRepository } from '../utils/typeormMocks'
import { createCatalogsRoutes } from '../../domains/catalogs/routes/catalogsRoutes'

const mockEnsureMetahubAccess = jest.fn()
const mockEnsureSchema = jest.fn(async () => 'mhb_test_schema')
const mockGenerateTableName = jest.fn((id: string, kind: string) => `${kind}_${id}`)
const mockKnex = {
    transaction: jest.fn()
}

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

jest.mock('../../domains/ddl', () => ({
    __esModule: true,
    KnexClient: {
        getInstance: () => mockKnex
    },
    generateTableName: (...args: unknown[]) => mockGenerateTableName(...(args as [string, string]))
}))

const mockObjectsService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByCodename: jest.fn(),
    createCatalog: jest.fn(),
    updateCatalog: jest.fn(),
    delete: jest.fn(),
    findDeleted: jest.fn(),
    restore: jest.fn(),
    permanentDelete: jest.fn()
}

const mockHubsService = {
    findByIds: jest.fn(),
    findById: jest.fn()
}

const mockAttributesService = {
    countByObjectIds: jest.fn(),
    findCatalogReferenceBlockers: jest.fn()
}

const mockElementsService = {
    countByObjectIds: jest.fn()
}

const mockMetahubRepo = createMockRepository<Record<string, unknown>>()

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

describe('Catalogs Routes', () => {
    const createCatalogCopyTransactionStub = (params?: {
        copiedCatalog?: Record<string, unknown>
        sourceAttributes?: Array<Record<string, unknown>>
        sourceElements?: Array<Record<string, unknown>>
    }) => {
        const created =
            params?.copiedCatalog ??
            ({
                id: 'catalog-copy-id',
                codename: 'products-copy',
                presentation: {
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Products (copy)' } } },
                    description: null
                },
                config: { hubs: [], isSingleHub: false, isRequiredHub: false, sortOrder: 5 },
                _upl_version: 1,
                _upl_created_at: '2026-02-26T00:00:00.000Z',
                _upl_updated_at: '2026-02-26T00:00:00.000Z'
            } as Record<string, unknown>)

        const sourceAttributes = params?.sourceAttributes ?? []
        const sourceElements = params?.sourceElements ?? []

        const insertReturning = jest.fn().mockResolvedValue([{ id: created.id }])
        const updateReturning = jest.fn().mockResolvedValue([created])
        const attributeSelect = jest.fn().mockResolvedValue(sourceAttributes)
        const elementSelect = jest.fn().mockResolvedValue(sourceElements)
        const attributeInsertReturning = jest.fn().mockResolvedValue([{ id: 'copied-attr-id' }])
        const elementInsert = jest.fn().mockResolvedValue(undefined)

        const trx = {
            withSchema: jest.fn(() => ({
                into: jest.fn((tableName: string) => {
                    if (tableName === '_mhb_objects') {
                        return {
                            insert: jest.fn(() => ({
                                returning: (...args: unknown[]) => insertReturning(...args)
                            }))
                        }
                    }

                    if (tableName === '_mhb_attributes') {
                        return {
                            insert: jest.fn(() => ({
                                returning: (...args: unknown[]) => attributeInsertReturning(...args)
                            }))
                        }
                    }

                    if (tableName === '_mhb_elements') {
                        return {
                            insert: (...args: unknown[]) => elementInsert(...args)
                        }
                    }

                    return {
                        insert: jest.fn()
                    }
                }),
                from: jest.fn((tableName: string) => {
                    if (tableName === '_mhb_objects') {
                        return {
                            where: jest.fn(() => ({
                                update: jest.fn(() => ({
                                    returning: (...args: unknown[]) => updateReturning(...args)
                                }))
                            }))
                        }
                    }

                    if (tableName === '_mhb_attributes') {
                        return {
                            where: jest.fn(() => ({
                                andWhere: jest.fn(() => ({
                                    andWhere: jest.fn(() => ({
                                        orderBy: jest.fn(() => ({
                                            orderBy: (..._args: unknown[]) => attributeSelect()
                                        }))
                                    }))
                                }))
                            }))
                        }
                    }

                    if (tableName === '_mhb_elements') {
                        return {
                            where: jest.fn(() => ({
                                andWhere: jest.fn(() => ({
                                    andWhere: jest.fn(() => ({
                                        orderBy: jest.fn(() => ({
                                            orderBy: (..._args: unknown[]) => elementSelect()
                                        }))
                                    }))
                                }))
                            }))
                        }
                    }

                    return {
                        where: jest.fn()
                    }
                })
            }))
        }

        return { trx, attributeSelect, attributeInsertReturning, elementSelect, elementInsert }
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

    const buildApp = () => {
        const dataSource = createMockDataSource({
            Metahub: mockMetahubRepo
        })
        const app = express()
        app.use(express.json())
        app.use(createCatalogsRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()

        mockObjectsService.findAll.mockResolvedValue([])
        mockObjectsService.findById.mockResolvedValue(null)
        mockObjectsService.findByCodename.mockResolvedValue(null)
        mockObjectsService.createCatalog.mockResolvedValue(null)
        mockObjectsService.updateCatalog.mockResolvedValue(null)
        mockObjectsService.delete.mockResolvedValue(undefined)
        mockObjectsService.findDeleted.mockResolvedValue([])
        mockObjectsService.restore.mockResolvedValue(undefined)
        mockObjectsService.permanentDelete.mockResolvedValue(undefined)

        mockHubsService.findByIds.mockResolvedValue([])
        mockHubsService.findById.mockResolvedValue(null)

        mockAttributesService.countByObjectIds.mockResolvedValue(new Map<string, number>())
        mockAttributesService.findCatalogReferenceBlockers.mockResolvedValue([])

        mockElementsService.countByObjectIds.mockResolvedValue(new Map<string, number>())
        mockMetahubRepo.findOne.mockResolvedValue({ id: 'test-metahub-id' })
        mockEnsureMetahubAccess.mockResolvedValue({ metahubId: 'test-metahub-id' })
        mockEnsureSchema.mockResolvedValue('mhb_test_schema')
        mockGenerateTableName.mockImplementation((id: string, kind: string) => `${kind}_${id}`)
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

    describe('POST /metahub/:metahubId/catalogs', () => {
        it('creates catalog without hub associations', async () => {
            mockObjectsService.createCatalog.mockResolvedValue({
                id: 'catalog-new',
                codename: 'new-catalog',
                presentation: { name: { en: 'New Catalog' }, description: undefined },
                config: { hubs: [], isSingleHub: false, isRequiredHub: false, sortOrder: 0 },
                _upl_version: 1,
                created_at: new Date('2026-02-11T00:00:00.000Z'),
                updated_at: new Date('2026-02-11T00:00:00.000Z')
            })

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/test-metahub-id/catalogs')
                .send({ codename: 'new-catalog', name: 'New Catalog' })
                .expect(201)

            expect(response.body).toMatchObject({ id: 'catalog-new', codename: 'new-catalog' })
            expect(mockObjectsService.createCatalog).toHaveBeenCalledWith(
                'test-metahub-id',
                expect.objectContaining({
                    codename: 'new-catalog',
                    config: expect.objectContaining({ hubs: [] })
                }),
                'test-user-id'
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

    describe('POST /metahub/:metahubId/catalog/:catalogId/copy', () => {
        it('returns 404 when metahub does not exist', async () => {
            mockMetahubRepo.findOne.mockResolvedValueOnce(null)

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

            const tx = createCatalogCopyTransactionStub()
            mockKnex.transaction.mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(tx.trx))

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
            expect(mockGenerateTableName).toHaveBeenCalledWith('catalog-copy-id', 'catalog')
            expect(response.body.id).toBe('catalog-copy-id')
            expect(response.body.codename).toBe('products-copy')
            expect(response.body.attributesCount).toBe(0)
            expect(response.body.elementsCount).toBe(0)
        })

        it('copies attributes and elements by default when options are omitted', async () => {
            mockObjectsService.findById.mockResolvedValueOnce({
                id: 'catalog-1',
                kind: 'catalog',
                codename: 'products',
                presentation: { name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Products' } } }, description: null },
                config: { hubs: [], isSingleHub: false, isRequiredHub: false, sortOrder: 5 }
            })

            const tx = createCatalogCopyTransactionStub({
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
            mockKnex.transaction.mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(tx.trx))

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/test-metahub-id/catalog/catalog-1/copy')
                .send({ codename: 'products-copy' })
                .expect(201)

            expect(response.body.attributesCount).toBe(1)
            expect(response.body.elementsCount).toBe(1)
            expect(tx.attributeSelect).toHaveBeenCalledTimes(1)
            expect(tx.attributeInsertReturning).toHaveBeenCalledTimes(1)
            expect(tx.elementSelect).toHaveBeenCalledTimes(1)
            expect(tx.elementInsert).toHaveBeenCalledTimes(1)
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
            const tx = createCatalogCopyTransactionStub({
                copiedCatalog: {
                    id: 'catalog-copy-id-2',
                    codename: 'products-copy-2',
                    presentation: {
                        name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Products (copy)' } } },
                        description: null
                    },
                    config: { hubs: [], isSingleHub: false, isRequiredHub: false, sortOrder: 5 },
                    _upl_version: 1,
                    _upl_created_at: '2026-02-26T00:00:00.000Z',
                    _upl_updated_at: '2026-02-26T00:00:00.000Z'
                }
            })

            mockKnex.transaction
                .mockRejectedValueOnce(uniqueViolation)
                .mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(tx.trx))

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
            expect(response.body.codename).toBe('products-copy-2')
            expect(mockKnex.transaction).toHaveBeenCalledTimes(2)
        })
    })
})
