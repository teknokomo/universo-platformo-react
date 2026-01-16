jest.mock(
    'typeorm',
    () => {
        const decorator = () => () => {}
        return {
            __esModule: true,
            Entity: decorator,
            PrimaryGeneratedColumn: decorator,
            PrimaryColumn: decorator,
            Column: decorator,
            CreateDateColumn: decorator,
            UpdateDateColumn: decorator,
            ManyToOne: decorator,
            OneToMany: decorator,
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

import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')
import { createMockDataSource, createMockRepository } from '../utils/typeormMocks'
import { createCatalogsRoutes } from '../../domains/catalogs/routes/catalogsRoutes'

describe('Catalogs Routes', () => {
    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as any).user = { id: 'test-user-id' }
        next()
    }

    // Mock rate limiters (no-op middleware for tests)
    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    // Error handler middleware
    const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
        if (res.headersSent) {
            return _next(err)
        }
        const statusCode = err.statusCode || err.status || 500
        const message = err.message || 'Internal Server Error'
        res.status(statusCode).json({ error: message })
    }

    // Helper to build Express app with error handler
    const buildApp = (dataSource: any) => {
        const app = express()
        app.use(express.json())
        app.use(createCatalogsRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    const buildDataSource = () => {
        const catalogRepo = createMockRepository<any>()
        const catalogHubRepo = createMockRepository<any>()
        const hubRepo = createMockRepository<any>()
        const attributeRepo = createMockRepository<any>()
        const recordRepo = createMockRepository<any>()

        const dataSource = createMockDataSource({
            Catalog: catalogRepo,
            CatalogHub: catalogHubRepo,
            Hub: hubRepo,
            Attribute: attributeRepo,
            HubRecord: recordRepo
        })

        return {
            dataSource,
            catalogRepo,
            catalogHubRepo,
            hubRepo,
            attributeRepo,
            recordRepo
        }
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    // =========================================================================
    // GET /metahub/:metahubId/catalogs - List all catalogs
    // =========================================================================
    describe('GET /metahub/:metahubId/catalogs', () => {
        it('should return empty array when no catalogs exist', async () => {
            const { dataSource, catalogRepo, hubRepo } = buildDataSource()

            hubRepo.find.mockResolvedValue([])
            // getRawMany returns empty array for window function query
            catalogRepo.createQueryBuilder().getRawMany.mockResolvedValue([])

            const app = buildApp(dataSource)

            const response = await request(app).get('/metahub/test-metahub-id/catalogs').expect(200)

            expect(response.body).toMatchObject({
                items: [],
                pagination: { total: 0 }
            })
        })

        it('should return catalogs with hub associations', async () => {
            const { dataSource, catalogRepo, catalogHubRepo, hubRepo } = buildDataSource()

            const mockHubs = [
                { id: 'hub-1', name: { en: 'Hub 1' }, codename: 'hub-1' },
                { id: 'hub-2', name: { en: 'Hub 2' }, codename: 'hub-2' }
            ]

            // Raw result from window function query
            const mockRawCatalogs = [
                {
                    id: 'catalog-1',
                    metahubId: 'test-metahub-id',
                    codename: 'products',
                    name: { en: 'Products' },
                    description: { en: 'Product catalog' },
                    sortOrder: 0,
                    isSingleHub: false,
                    isRequiredHub: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    attributesCount: '0',
                    recordsCount: '0',
                    window_total: '1'
                }
            ]

            const mockCatalogHubs = [{ catalogId: 'catalog-1', hubId: 'hub-1', sortOrder: 0 }]

            hubRepo.find.mockResolvedValue(mockHubs)
            catalogRepo.createQueryBuilder().getRawMany.mockResolvedValue(mockRawCatalogs)
            catalogHubRepo.find.mockResolvedValue(mockCatalogHubs)

            const app = buildApp(dataSource)

            const response = await request(app).get('/metahub/test-metahub-id/catalogs').expect(200)

            expect(response.body.pagination.total).toBe(1)
            expect(response.body.items).toHaveLength(1)
            expect(response.body.items[0].codename).toBe('products')
            expect(response.body.items[0].hubs).toHaveLength(1)
            expect(response.body.items[0].hubs[0].id).toBe('hub-1')
        })

        it('should handle invalid query parameters', async () => {
            const { dataSource } = buildDataSource()
            const app = buildApp(dataSource)

            const response = await request(app)
                .get('/metahub/test-metahub-id/catalogs?limit=invalid')
                .expect(400)

            expect(response.body.error).toBe('Invalid query')
        })
    })

    // =========================================================================
    // POST /metahub/:metahubId/catalogs - Create catalog
    // =========================================================================
    describe('POST /metahub/:metahubId/catalogs', () => {
        it('should create a catalog without hub associations', async () => {
            const { dataSource, catalogRepo, catalogHubRepo, hubRepo } = buildDataSource()

            catalogRepo.findOne.mockResolvedValue(null) // No existing catalog with same codename
            hubRepo.find.mockResolvedValue([])
            catalogHubRepo.find.mockResolvedValue([])

            catalogRepo.create.mockImplementation((data: any) => ({
                id: 'new-catalog-id',
                ...data
            }))
            catalogRepo.save.mockImplementation((entity: any) => Promise.resolve(entity))

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/metahub/test-metahub-id/catalogs')
                .send({
                    codename: 'new-catalog',
                    name: 'New Catalog',
                    description: 'A test catalog'
                })
                .expect(201)

            expect(response.body.codename).toBe('new-catalog')
            expect(catalogRepo.create).toHaveBeenCalled()
            expect(catalogRepo.save).toHaveBeenCalled()
        })

        it('should create a catalog with hub associations', async () => {
            const { dataSource, catalogRepo, catalogHubRepo, hubRepo } = buildDataSource()

            // Use valid UUID format for hub IDs
            const hubId = '00000000-0000-0000-0000-000000000001'
            const mockHubs = [
                { id: hubId, metahubId: 'test-metahub-id' }
            ]

            catalogRepo.findOne.mockResolvedValue(null)
            // First call for reference hubs in response, second for validation
            hubRepo.find.mockResolvedValue(mockHubs)
            catalogHubRepo.find.mockResolvedValue([])
            catalogHubRepo.create.mockImplementation((data: any) => data)
            catalogHubRepo.save.mockImplementation((entity: any) => Promise.resolve(entity))

            catalogRepo.create.mockImplementation((data: any) => ({
                id: 'new-catalog-id',
                ...data
            }))
            catalogRepo.save.mockImplementation((entity: any) => Promise.resolve(entity))

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/metahub/test-metahub-id/catalogs')
                .send({
                    codename: 'new-catalog',
                    name: 'New Catalog',
                    hubIds: [hubId]
                })
                .expect(201)

            expect(response.body.codename).toBe('new-catalog')
        })

        it('should reject duplicate codename', async () => {
            const { dataSource, catalogRepo, hubRepo } = buildDataSource()

            catalogRepo.findOne.mockResolvedValue({
                id: 'existing-catalog',
                codename: 'existing-catalog'
            })
            hubRepo.find.mockResolvedValue([])

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/metahub/test-metahub-id/catalogs')
                .send({
                    codename: 'existing-catalog',
                    name: 'Duplicate Catalog'
                })
                .expect(409)

            expect(response.body.error).toContain('already exists')
        })

        it('should reject missing codename', async () => {
            const { dataSource, hubRepo } = buildDataSource()
            hubRepo.find.mockResolvedValue([])

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/metahub/test-metahub-id/catalogs')
                .send({
                    name: 'No Codename Catalog'
                })
                .expect(400)

            expect(response.body.error).toBe('Validation failed')
        })

        it('should reject invalid hub IDs', async () => {
            const { dataSource, catalogRepo, hubRepo } = buildDataSource()

            catalogRepo.findOne.mockResolvedValue(null)
            // Return empty array - hub not found
            hubRepo.find.mockResolvedValue([])

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/metahub/test-metahub-id/catalogs')
                .send({
                    codename: 'new-catalog',
                    name: 'New Catalog',
                    hubIds: ['00000000-0000-0000-0000-000000000001'] // Valid UUID but doesn't exist
                })
                .expect(400)

            expect(response.body.error).toContain('hub IDs are invalid')
        })
    })

    // =========================================================================
    // DELETE /metahub/:metahubId/catalog/:catalogId - Direct catalog deletion
    // =========================================================================
    describe('DELETE /metahub/:metahubId/catalog/:catalogId', () => {
        it('should delete catalog and return 204', async () => {
            const { dataSource, catalogRepo } = buildDataSource()

            const mockCatalog = {
                id: 'catalog-to-delete',
                metahubId: 'test-metahub-id',
                codename: 'test-catalog'
            }

            catalogRepo.findOne.mockResolvedValue(mockCatalog)
            catalogRepo.remove.mockResolvedValue(mockCatalog)

            const app = buildApp(dataSource)

            await request(app)
                .delete('/metahub/test-metahub-id/catalog/catalog-to-delete')
                .expect(204)

            expect(catalogRepo.findOne).toHaveBeenCalledWith({
                where: { id: 'catalog-to-delete', metahubId: 'test-metahub-id' }
            })
            expect(catalogRepo.remove).toHaveBeenCalledWith(mockCatalog)
        })

        it('should return 404 for non-existent catalog', async () => {
            const { dataSource, catalogRepo } = buildDataSource()

            catalogRepo.findOne.mockResolvedValue(null)

            const app = buildApp(dataSource)

            const response = await request(app)
                .delete('/metahub/test-metahub-id/catalog/non-existent-id')
                .expect(404)

            expect(response.body.error).toBe('Catalog not found')
            expect(catalogRepo.remove).not.toHaveBeenCalled()
        })

        it('should return 404 when catalog belongs to different metahub', async () => {
            const { dataSource, catalogRepo } = buildDataSource()

            // findOne returns null because metahubId doesn't match
            catalogRepo.findOne.mockResolvedValue(null)

            const app = buildApp(dataSource)

            const response = await request(app)
                .delete('/metahub/test-metahub-id/catalog/catalog-from-other-metahub')
                .expect(404)

            expect(response.body.error).toBe('Catalog not found')
        })

        it('should cascade delete CatalogHub records', async () => {
            const { dataSource, catalogRepo } = buildDataSource()

            const mockCatalog = {
                id: 'catalog-with-hubs',
                metahubId: 'test-metahub-id',
                codename: 'catalog-with-hubs'
            }

            catalogRepo.findOne.mockResolvedValue(mockCatalog)
            catalogRepo.remove.mockResolvedValue(mockCatalog)

            const app = buildApp(dataSource)

            await request(app)
                .delete('/metahub/test-metahub-id/catalog/catalog-with-hubs')
                .expect(204)

            // Cascade delete is handled by TypeORM entity configuration
            // We just verify that remove was called on the catalog
            expect(catalogRepo.remove).toHaveBeenCalledWith(mockCatalog)
        })
    })

    // =========================================================================
    // DELETE /metahub/:metahubId/hub/:hubId/catalog/:catalogId - Hub-scoped deletion
    // =========================================================================
    describe('DELETE /metahub/:metahubId/hub/:hubId/catalog/:catalogId', () => {
        it('should delete catalog completely when force=true', async () => {
            const { dataSource, catalogRepo, catalogHubRepo } = buildDataSource()

            const mockCatalog = {
                id: 'catalog-1',
                metahubId: 'test-metahub-id',
                codename: 'test-catalog'
            }

            const mockCatalogHub = {
                id: 'catalog-hub-1',
                catalogId: 'catalog-1',
                hubId: 'hub-1'
            }

            catalogRepo.findOne.mockResolvedValue(mockCatalog)
            catalogHubRepo.findOne.mockResolvedValue(mockCatalogHub)
            catalogHubRepo.count.mockResolvedValue(2) // Has 2 hubs
            catalogRepo.remove.mockResolvedValue(mockCatalog)

            const app = buildApp(dataSource)

            await request(app)
                .delete('/metahub/test-metahub-id/hub/hub-1/catalog/catalog-1?force=true')
                .expect(204)

            expect(catalogRepo.remove).toHaveBeenCalledWith(mockCatalog)
        })

        it('should only remove hub association when force=false and multiple hubs exist', async () => {
            const { dataSource, catalogRepo, catalogHubRepo } = buildDataSource()

            const mockCatalog = {
                id: 'catalog-1',
                metahubId: 'test-metahub-id',
                codename: 'test-catalog'
            }

            const mockCatalogHub = {
                id: 'catalog-hub-1',
                catalogId: 'catalog-1',
                hubId: 'hub-1'
            }

            catalogRepo.findOne.mockResolvedValue(mockCatalog)
            catalogHubRepo.findOne.mockResolvedValue(mockCatalogHub)
            catalogHubRepo.count.mockResolvedValue(2) // Has 2 hubs - will only remove association
            catalogHubRepo.remove.mockResolvedValue(mockCatalogHub)

            const app = buildApp(dataSource)

            const response = await request(app)
                .delete('/metahub/test-metahub-id/hub/hub-1/catalog/catalog-1')
                .expect(200) // Returns 200 with message when only removing association

            expect(response.body.message).toBe('Catalog removed from hub')
            expect(response.body.remainingHubs).toBe(1)
            expect(catalogHubRepo.remove).toHaveBeenCalledWith(mockCatalogHub)
        })

        it('should delete catalog when only one hub exists and force=false', async () => {
            const { dataSource, catalogRepo, catalogHubRepo } = buildDataSource()

            const mockCatalog = {
                id: 'catalog-1',
                metahubId: 'test-metahub-id',
                codename: 'test-catalog'
            }

            const mockCatalogHub = {
                id: 'catalog-hub-1',
                catalogId: 'catalog-1',
                hubId: 'hub-1'
            }

            catalogRepo.findOne.mockResolvedValue(mockCatalog)
            catalogHubRepo.findOne.mockResolvedValue(mockCatalogHub)
            catalogHubRepo.count.mockResolvedValue(1) // Only 1 hub - will delete entire catalog
            catalogRepo.remove.mockResolvedValue(mockCatalog)

            const app = buildApp(dataSource)

            await request(app)
                .delete('/metahub/test-metahub-id/hub/hub-1/catalog/catalog-1')
                .expect(204)

            expect(catalogRepo.remove).toHaveBeenCalledWith(mockCatalog)
        })

        it('should return 404 when catalog not in hub', async () => {
            const { dataSource, catalogHubRepo, catalogRepo } = buildDataSource()

            // Catalog exists but not associated with this hub
            catalogRepo.findOne.mockResolvedValue({
                id: 'catalog-1',
                metahubId: 'test-metahub-id'
            })
            catalogHubRepo.findOne.mockResolvedValue(null)

            const app = buildApp(dataSource)

            const response = await request(app)
                .delete('/metahub/test-metahub-id/hub/hub-1/catalog/catalog-1')
                .expect(404)

            expect(response.body.error).toBe('Catalog not found in this hub')
        })

        it('should return 404 when catalog does not exist', async () => {
            const { dataSource, catalogRepo } = buildDataSource()

            catalogRepo.findOne.mockResolvedValue(null)

            const app = buildApp(dataSource)

            const response = await request(app)
                .delete('/metahub/test-metahub-id/hub/hub-1/catalog/non-existent')
                .expect(404)

            expect(response.body.error).toBe('Catalog not found')
        })

        it('should return 409 when unlinking catalog with isRequiredHub=true from its last hub', async () => {
            const { dataSource, catalogRepo, catalogHubRepo } = buildDataSource()

            const mockCatalog = {
                id: 'catalog-1',
                metahubId: 'test-metahub-id',
                isRequiredHub: true,
                codename: 'required-catalog'
            }

            const mockCatalogHub = {
                catalogId: 'catalog-1',
                hubId: 'hub-1'
            }

            catalogRepo.findOne.mockResolvedValue(mockCatalog)
            catalogHubRepo.findOne.mockResolvedValue(mockCatalogHub)
            catalogHubRepo.count.mockResolvedValue(1) // Only 1 hub - would orphan if unlinked

            const app = buildApp(dataSource)

            const response = await request(app)
                .delete('/metahub/test-metahub-id/hub/hub-1/catalog/catalog-1')
                .expect(409)

            expect(response.body.error).toContain('Cannot remove catalog from its last hub')
            expect(catalogRepo.remove).not.toHaveBeenCalled()
        })

        it('should delete catalog with isRequiredHub=true from last hub when force=true', async () => {
            const { dataSource, catalogRepo, catalogHubRepo } = buildDataSource()

            const mockCatalog = {
                id: 'catalog-1',
                metahubId: 'test-metahub-id',
                isRequiredHub: true,
                codename: 'required-catalog'
            }

            const mockCatalogHub = {
                catalogId: 'catalog-1',
                hubId: 'hub-1'
            }

            catalogRepo.findOne.mockResolvedValue(mockCatalog)
            catalogHubRepo.findOne.mockResolvedValue(mockCatalogHub)
            catalogHubRepo.count.mockResolvedValue(1) // Only 1 hub
            catalogRepo.remove.mockResolvedValue(mockCatalog)

            const app = buildApp(dataSource)

            await request(app)
                .delete('/metahub/test-metahub-id/hub/hub-1/catalog/catalog-1?force=true')
                .expect(204)

            expect(catalogRepo.remove).toHaveBeenCalledWith(mockCatalog)
        })
    })
})
