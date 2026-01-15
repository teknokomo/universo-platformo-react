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
import { createConnectorsRoutes } from '../../routes/connectorsRoutes'

describe('Connectors Routes', () => {
    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as any).user = { id: 'test-user-id' }
        next()
    }

    // Mock rate limiters (no-op middleware for tests)
    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    // Error handler middleware for http-errors compatibility
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
        app.use(
            '/',
            createConnectorsRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
        )
        app.use(errorHandler)
        return app
    }

    const buildDataSource = () => {
        const applicationRepo = createMockRepository<any>()
        const connectorRepo = createMockRepository<any>()

        const dataSource = createMockDataSource({
            Application: applicationRepo,
            Connector: connectorRepo
        })

        return {
            dataSource,
            applicationRepo,
            connectorRepo
        }
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('GET /applications/:applicationId/connectors', () => {
        it('should return empty array when no connectors exist', async () => {
            const { dataSource, connectorRepo } = buildDataSource()

            // API uses getRawMany with window function, returns { items, pagination }
            const mockQB = connectorRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = buildApp(dataSource)

            const response = await request(app).get('/applications/application-1/connectors').expect(200)

            expect(response.body).toMatchObject({
                items: [],
                pagination: { total: 0, limit: 100, offset: 0 }
            })
        })

        it('should return connectors list for application', async () => {
            const { dataSource, connectorRepo } = buildDataSource()

            const mockRawConnectors = [
                {
                    id: 'connector-1',
                    applicationId: 'application-1',
                    codename: 'connector-one',
                    name: { en: 'Connector One', _primary: 'en' },
                    description: { en: 'Description', _primary: 'en' },
                    sortOrder: 1,
                    createdAt: new Date('2025-01-01'),
                    updatedAt: new Date('2025-01-02'),
                    window_total: '1'
                }
            ]

            const mockQB = connectorRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue(mockRawConnectors)

            const app = buildApp(dataSource)

            const response = await request(app).get('/applications/application-1/connectors').expect(200)

            expect(response.body.items).toHaveLength(1)
            expect(response.body.items[0]).toMatchObject({
                id: 'connector-1',
                codename: 'connector-one'
            })
            expect(response.body.pagination.total).toBe(1)
        })

        it('should support pagination parameters', async () => {
            const { dataSource, connectorRepo } = buildDataSource()

            const mockQB = connectorRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = buildApp(dataSource)

            const response = await request(app).get('/applications/application-1/connectors').query({ limit: 10, offset: 5 }).expect(200)

            expect(response.body).toMatchObject({
                items: [],
                pagination: { total: 0, limit: 10, offset: 5 }
            })
        })

        it('should support search parameter', async () => {
            const { dataSource, connectorRepo } = buildDataSource()

            const mockQB = connectorRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = buildApp(dataSource)

            const response = await request(app).get('/applications/application-1/connectors').query({ search: 'test' }).expect(200)

            expect(mockQB.andWhere).toHaveBeenCalled()
            expect(response.body).toMatchObject({ items: [], pagination: { total: 0 } })
        })
    })

    describe('POST /applications/:applicationId/connectors', () => {
        it('should create a new connector', async () => {
            const { dataSource, applicationRepo, connectorRepo } = buildDataSource()

            // Application must exist for POST to succeed
            applicationRepo.findOne.mockResolvedValue({ id: 'application-1', name: 'Test App' })
            connectorRepo.findOne.mockResolvedValue(null) // codename not taken
            connectorRepo.create.mockImplementation((data: any) => ({ ...data }))
            connectorRepo.save.mockResolvedValue({
                id: 'new-connector-id',
                applicationId: 'application-1',
                codename: 'new-connector',
                name: { en: 'New Connector', _primary: 'en' },
                description: { en: 'Description', _primary: 'en' },
                sortOrder: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            })

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications/application-1/connectors')
                .send({
                    codename: 'new-connector',
                    name: 'New Connector',
                    description: 'Description'
                })
                .expect(201)

            expect(response.body).toMatchObject({
                id: 'new-connector-id',
                codename: 'new-connector'
            })
        })

        it('should return 404 when application does not exist', async () => {
            const { dataSource, applicationRepo } = buildDataSource()

            applicationRepo.findOne.mockResolvedValue(null) // application not found

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications/non-existent/connectors')
                .send({
                    codename: 'new-connector',
                    name: 'New Connector'
                })
                .expect(404)

            expect(response.body.error).toBe('Application not found')
        })

        it('should reject invalid codename', async () => {
            const { dataSource, applicationRepo } = buildDataSource()

            applicationRepo.findOne.mockResolvedValue({ id: 'application-1', name: 'Test App' })

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications/application-1/connectors')
                .send({
                    codename: '', // empty - validation fails before application check
                    name: 'Connector'
                })
                .expect(400)

            expect(response.body.error).toBeDefined()
        })

        it('should reject duplicate codename in same application', async () => {
            const { dataSource, applicationRepo, connectorRepo } = buildDataSource()

            applicationRepo.findOne.mockResolvedValue({ id: 'application-1', name: 'Test App' })
            connectorRepo.findOne.mockResolvedValue({
                id: 'existing',
                codename: 'existing-connector'
            })

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications/application-1/connectors')
                .send({
                    codename: 'existing-connector',
                    name: 'New Connector'
                })
                .expect(409)

            expect(response.body.error).toContain('codename')
        })

        it('should use sortOrder 0 when not provided', async () => {
            const { dataSource, applicationRepo, connectorRepo } = buildDataSource()

            applicationRepo.findOne.mockResolvedValue({ id: 'application-1', name: 'Test App' })
            connectorRepo.findOne.mockResolvedValue(null)
            connectorRepo.create.mockImplementation((data: any) => ({ ...data }))
            connectorRepo.save.mockImplementation((entity: any) =>
                Promise.resolve({
                    ...entity,
                    id: 'new-id',
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
            )

            const app = buildApp(dataSource)

            await request(app)
                .post('/applications/application-1/connectors')
                .send({
                    codename: 'new-connector',
                    name: 'New Connector'
                })
                .expect(201)

            // API uses sortOrder: sortOrder ?? 0, so default is 0
            expect(connectorRepo.create).toHaveBeenCalledWith(expect.objectContaining({ sortOrder: 0 }))
        })
    })

    describe('GET /applications/:applicationId/connectors/:connectorId', () => {
        it('should return 404 for non-existent connector', async () => {
            const { dataSource, connectorRepo } = buildDataSource()

            connectorRepo.findOne.mockResolvedValue(null)

            const app = buildApp(dataSource)

            await request(app).get('/applications/application-1/connectors/non-existent-id').expect(404)
        })

        it('should return connector details', async () => {
            const { dataSource, connectorRepo } = buildDataSource()

            const mockConnector = {
                id: 'connector-1',
                codename: 'test-connector',
                name: { en: 'Test Connector', _primary: 'en' },
                description: { en: 'Description', _primary: 'en' },
                sortOrder: 1,
                createdAt: new Date(),
                updatedAt: new Date()
            }

            connectorRepo.findOne.mockResolvedValue(mockConnector)

            const app = buildApp(dataSource)

            const response = await request(app).get('/applications/application-1/connectors/connector-1').expect(200)

            expect(response.body).toMatchObject({
                id: 'connector-1',
                codename: 'test-connector'
            })
        })
    })

    describe('PATCH /applications/:applicationId/connectors/:connectorId', () => {
        it('should update connector', async () => {
            const { dataSource, connectorRepo } = buildDataSource()

            const mockConnector = {
                id: 'connector-1',
                codename: 'old-codename',
                name: { en: 'Old Name', _primary: 'en' },
                sortOrder: 1
            }

            connectorRepo.findOne.mockResolvedValueOnce(mockConnector) // initial fetch
            connectorRepo.findOne.mockResolvedValueOnce(null) // codename check
            connectorRepo.save.mockResolvedValue({
                ...mockConnector,
                name: { en: 'New Name', _primary: 'en' }
            })

            const app = buildApp(dataSource)

            const response = await request(app).patch('/applications/application-1/connectors/connector-1').send({ name: 'New Name' }).expect(200)

            expect(response.body.name).toMatchObject({ en: 'New Name' })
        })

        it('should reject updating to existing codename', async () => {
            const { dataSource, connectorRepo } = buildDataSource()

            connectorRepo.findOne.mockResolvedValueOnce({
                id: 'connector-1',
                codename: 'current-codename'
            })
            connectorRepo.findOne.mockResolvedValueOnce({
                id: 'other-connector',
                codename: 'taken-codename'
            }) // codename taken by another connector

            const app = buildApp(dataSource)

            await request(app).patch('/applications/application-1/connectors/connector-1').send({ codename: 'taken-codename' }).expect(409)
        })
    })

    describe('DELETE /applications/:applicationId/connectors/:connectorId', () => {
        it('should delete connector', async () => {
            const { dataSource, connectorRepo } = buildDataSource()

            const mockConnector = {
                id: 'connector-1',
                codename: 'test-connector'
            }

            connectorRepo.findOne.mockResolvedValue(mockConnector)
            connectorRepo.remove.mockResolvedValue(mockConnector)

            const app = buildApp(dataSource)

            await request(app).delete('/applications/application-1/connectors/connector-1').expect(204)

            expect(connectorRepo.remove).toHaveBeenCalled()
        })

        it('should return 404 for non-existent connector', async () => {
            const { dataSource, connectorRepo } = buildDataSource()

            connectorRepo.findOne.mockResolvedValue(null)

            const app = buildApp(dataSource)

            await request(app).delete('/applications/application-1/connectors/non-existent').expect(404)
        })
    })
})
