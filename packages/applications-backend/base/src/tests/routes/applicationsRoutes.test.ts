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
            VersionColumn: decorator,
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

jest.mock('@universo/admin-backend', () => ({
    __esModule: true,
    isSuperuserByDataSource: jest.fn(async () => false),
    getGlobalRoleCodenameByDataSource: jest.fn(async () => null),
    hasSubjectPermissionByDataSource: jest.fn(async () => false)
}))

const mockCloneSchemaWithExecutor = jest.fn(async () => undefined)
const mockGenerateSchemaName = jest.fn((id: string) => `app_${id.replace(/-/g, '')}`)
const mockIsValidSchemaName = jest.fn(() => true)

jest.mock('@universo/schema-ddl', () => ({
    __esModule: true,
    cloneSchemaWithExecutor: (...args: unknown[]) => mockCloneSchemaWithExecutor(...args),
    generateSchemaName: (...args: unknown[]) => mockGenerateSchemaName(...(args as [string])),
    isValidSchemaName: (...args: unknown[]) => mockIsValidSchemaName(...(args as [string]))
}))

import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')
import { createMockDataSource, createMockRepository } from '../utils/typeormMocks'
import { createApplicationsRoutes } from '../../routes/applicationsRoutes'

describe('Applications Routes', () => {
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
            '/applications',
            createApplicationsRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
        )
        app.use(errorHandler)
        return app
    }

    const buildDataSource = () => {
        const applicationRepo = createMockRepository<any>()
        const applicationUserRepo = createMockRepository<any>()
        const connectorRepo = createMockRepository<any>()
        const connectorPublicationRepo = createMockRepository<any>()
        const authUserRepo = createMockRepository<any>()
        const profileRepo = createMockRepository<any>()

        const dataSource = createMockDataSource({
            Application: applicationRepo,
            ApplicationUser: applicationUserRepo,
            Connector: connectorRepo,
            ConnectorPublication: connectorPublicationRepo,
            AuthUser: authUserRepo,
            Profile: profileRepo
        })

        return {
            dataSource,
            applicationRepo,
            applicationUserRepo,
            connectorRepo,
            connectorPublicationRepo,
            authUserRepo,
            profileRepo
        }
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockCloneSchemaWithExecutor.mockClear()
        mockGenerateSchemaName.mockClear()
        mockIsValidSchemaName.mockClear()
        mockIsValidSchemaName.mockReturnValue(true)
    })

    describe('GET /applications', () => {
        it('should return empty array for user with no applications', async () => {
            const { dataSource, applicationRepo } = buildDataSource()

            applicationRepo.createQueryBuilder().getManyAndCount.mockResolvedValue([[], 0])

            const app = buildApp(dataSource)

            const response = await request(app).get('/applications').expect(200)

            expect(response.body).toMatchObject({
                items: [],
                total: 0,
                limit: 100,
                offset: 0
            })
        })

        it('should return applications with counts for authenticated user', async () => {
            const { dataSource, applicationRepo } = buildDataSource()

            const mockApplications = [
                {
                    id: 'application-1',
                    name: 'Test Application',
                    description: 'Test Description',
                    slug: 'test-app',
                    isPublic: false,
                    createdAt: new Date('2025-01-01'),
                    updatedAt: new Date('2025-01-02')
                }
            ]

            const mockQB = applicationRepo.createQueryBuilder()
            mockQB.getManyAndCount.mockResolvedValue([mockApplications, 1])

            const app = buildApp(dataSource)

            const response = await request(app).get('/applications').expect(200)

            expect(response.body.items).toHaveLength(1)
            expect(response.body.items[0]).toMatchObject({
                id: 'application-1',
                name: 'Test Application',
                description: 'Test Description'
            })
        })

        it('should support pagination parameters', async () => {
            const { dataSource, applicationRepo } = buildDataSource()

            applicationRepo.createQueryBuilder().getManyAndCount.mockResolvedValue([[], 0])

            const app = buildApp(dataSource)

            const response = await request(app).get('/applications').query({ limit: 10, offset: 20 }).expect(200)

            expect(response.body).toMatchObject({
                items: [],
                total: 0,
                limit: 10,
                offset: 20
            })
        })

        it('should support search parameter', async () => {
            const { dataSource, applicationRepo } = buildDataSource()

            const mockQB = applicationRepo.createQueryBuilder()
            mockQB.getManyAndCount.mockResolvedValue([[], 0])

            const app = buildApp(dataSource)

            const response = await request(app).get('/applications').query({ search: 'test' }).expect(200)

            expect(mockQB.andWhere).toHaveBeenCalled()
            expect(response.body).toMatchObject({ items: [], total: 0 })
        })
    })

    describe('POST /applications', () => {
        it('should create a new application', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationRepo.findOne.mockResolvedValue(null) // slug not taken
            applicationRepo.save.mockResolvedValue({
                id: 'new-application-id',
                name: 'New Application',
                description: 'Description',
                slug: 'new-application',
                isPublic: false,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            applicationUserRepo.save.mockResolvedValue({ id: 'member-id' })

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications')
                .send({
                    name: 'New Application',
                    description: 'Description',
                    slug: 'new-application'
                })
                .expect(201)

            expect(response.body).toMatchObject({
                id: 'new-application-id',
                name: 'New Application'
            })
        })

        it('should reject invalid request body', async () => {
            const { dataSource } = buildDataSource()

            const app = buildApp(dataSource)

            const response = await request(app).post('/applications').send({ description: 'Missing name' }).expect(400)

            expect(response.body.error).toBeDefined()
        })

        it('should reject duplicate slug', async () => {
            const { dataSource, applicationRepo } = buildDataSource()

            applicationRepo.findOne.mockResolvedValue({ id: 'existing', slug: 'taken-slug' })

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications')
                .send({
                    name: 'New Application',
                    slug: 'taken-slug'
                })
                .expect(409)

            expect(response.body.error).toContain('slug')
        })
    })

    describe('POST /applications/:applicationId/copy', () => {
        it('should copy application with connectors and access (excluding requester duplicate role)', async () => {
            const { dataSource, applicationRepo, applicationUserRepo, connectorRepo, connectorPublicationRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValueOnce({
                userId: 'test-user-id',
                applicationId: 'application-1',
                role: 'owner'
            })

            const sourceApplication = {
                id: 'application-1',
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: { en: { content: 'Source App' }, ru: { content: 'Исходное приложение' } }
                },
                description: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: { en: { content: 'Source desc' } }
                },
                slug: 'source-app',
                isPublic: false,
                schemaName: 'app_source001',
                schemaStatus: 'synced',
                schemaSyncedAt: null,
                schemaError: null,
                schemaSnapshot: null,
                _uplVersion: 1,
                _uplCreatedAt: new Date(),
                _uplUpdatedAt: new Date()
            }

            applicationRepo.findOne.mockResolvedValueOnce(sourceApplication).mockResolvedValueOnce(null)
            applicationRepo.create.mockImplementation((entity: any) => entity)
            applicationRepo.save.mockImplementation(async (entity: any) => ({
                ...entity,
                id: entity.id ?? 'copied-application-id'
            }))

            applicationUserRepo.find.mockResolvedValue([
                { userId: 'test-user-id', role: 'admin', comment: null },
                { userId: 'member-2', role: 'member', comment: 'Keep access' }
            ])
            connectorRepo.find.mockResolvedValue([
                {
                    id: 'connector-1',
                    applicationId: 'application-1',
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Connector 1' } } },
                    description: null,
                    sortOrder: 10,
                    isSingleMetahub: true,
                    isRequiredMetahub: true
                }
            ])
            connectorPublicationRepo.find.mockResolvedValue([
                {
                    connectorId: 'connector-1',
                    publicationId: 'publication-1',
                    sortOrder: 1
                }
            ])
            ;(dataSource.manager.query as jest.Mock).mockResolvedValueOnce([{ id: '018f8a78-7b8f-7c1d-a111-222233334444' }])

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications/application-1/copy')
                .send({
                    name: { en: 'Source App (copy)' },
                    copyConnector: true,
                    createSchema: false,
                    copyAccess: true
                })
                .expect(201)

            expect(response.body.id).toBe('018f8a78-7b8f-7c1d-a111-222233334444')
            expect(mockGenerateSchemaName).toHaveBeenCalledWith('018f8a78-7b8f-7c1d-a111-222233334444')
            expect(mockCloneSchemaWithExecutor).not.toHaveBeenCalled()

            expect(applicationUserRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    applicationId: '018f8a78-7b8f-7c1d-a111-222233334444',
                    userId: 'test-user-id',
                    role: 'owner'
                })
            )
            expect(applicationUserRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    applicationId: '018f8a78-7b8f-7c1d-a111-222233334444',
                    userId: 'member-2',
                    role: 'member'
                })
            )
            expect(applicationUserRepo.find).toHaveBeenCalledWith({
                where: {
                    applicationId: 'application-1',
                    _uplDeleted: false,
                    _appDeleted: false
                }
            })
        })

        it('should copy without connectors when copyConnector is false', async () => {
            const { dataSource, applicationRepo, applicationUserRepo, connectorRepo, connectorPublicationRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValueOnce({
                userId: 'test-user-id',
                applicationId: 'application-1',
                role: 'owner'
            })

            applicationRepo.findOne.mockResolvedValueOnce({
                id: 'application-1',
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: { en: { content: 'Source App' } }
                },
                description: null,
                slug: 'source-app',
                isPublic: false,
                schemaName: 'app_source001',
                schemaStatus: 'synced',
                schemaSyncedAt: new Date(),
                schemaError: null,
                schemaSnapshot: { entities: {} },
                appStructureVersion: 1,
                _uplVersion: 1,
                _uplCreatedAt: new Date(),
                _uplUpdatedAt: new Date()
            })
            applicationRepo.findOne.mockResolvedValueOnce(null)
            applicationRepo.create.mockImplementation((entity: any) => entity)
            applicationRepo.save.mockImplementation(async (entity: any) => ({
                ...entity,
                id: entity.id ?? 'copied-application-id'
            }))
            ;(dataSource.manager.query as jest.Mock).mockResolvedValueOnce([{ id: '018f8a78-7b8f-7c1d-a111-222233334445' }])

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications/application-1/copy')
                .send({
                    name: { en: 'Source App (copy)' },
                    copyConnector: false,
                    createSchema: false,
                    copyAccess: false
                })
                .expect(201)

            expect(response.body.id).toBe('018f8a78-7b8f-7c1d-a111-222233334445')
            expect(connectorRepo.find).not.toHaveBeenCalled()
            expect(connectorPublicationRepo.find).not.toHaveBeenCalled()
            const createdApplicationPayload = applicationRepo.create.mock.calls[0][0]
            expect(createdApplicationPayload.schemaStatus).toBe('draft')
            expect(createdApplicationPayload.schemaSnapshot).toBeNull()
            expect(createdApplicationPayload.appStructureVersion).toBeNull()
            expect(createdApplicationPayload.lastSyncedPublicationVersionId).toBeNull()
        })

        it('should auto-resolve slug collisions for repeated copies when slug is not provided explicitly', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValueOnce({
                userId: 'test-user-id',
                applicationId: 'application-1',
                role: 'owner'
            })

            applicationRepo.findOne
                .mockResolvedValueOnce({
                    id: 'application-1',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Source App' } }
                    },
                    description: null,
                    slug: 'source-app',
                    isPublic: false,
                    schemaName: 'app_source001',
                    schemaStatus: 'synced',
                    _uplVersion: 1,
                    _uplCreatedAt: new Date(),
                    _uplUpdatedAt: new Date()
                })
                .mockResolvedValueOnce({ id: 'existing-copy-1' })
                .mockResolvedValueOnce(null)

            applicationRepo.create.mockImplementation((entity: any) => entity)
            applicationRepo.save.mockImplementation(async (entity: any) => ({
                ...entity,
                id: entity.id ?? 'copied-application-id'
            }))
            ;(dataSource.manager.query as jest.Mock).mockResolvedValueOnce([{ id: '018f8a78-7b8f-7c1d-a111-222233334447' }])

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications/application-1/copy')
                .send({
                    name: { en: 'Source App (copy)' },
                    copyConnector: false,
                    createSchema: false,
                    copyAccess: false
                })
                .expect(201)

            expect(response.body.id).toBe('018f8a78-7b8f-7c1d-a111-222233334447')
            const createdApplicationPayload = applicationRepo.create.mock.calls[0][0]
            expect(createdApplicationPayload.slug).toBe('source-app-copy-2')
        })

        it('should retry with next generated slug when insert fails with concurrent slug conflict', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValueOnce({
                userId: 'test-user-id',
                applicationId: 'application-1',
                role: 'owner'
            })

            applicationRepo.findOne
                .mockResolvedValueOnce({
                    id: 'application-1',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Source App' } }
                    },
                    description: null,
                    slug: 'source-app',
                    isPublic: false,
                    schemaName: 'app_source001',
                    schemaStatus: 'synced',
                    _uplVersion: 1,
                    _uplCreatedAt: new Date(),
                    _uplUpdatedAt: new Date()
                })
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null)

            const slugRaceError = Object.assign(new Error('duplicate key value violates unique constraint "applications_slug_key"'), {
                code: '23505',
                constraint: 'applications_slug_key'
            })

            applicationRepo.create.mockImplementation((entity: any) => entity)
            applicationRepo.save.mockRejectedValueOnce(slugRaceError).mockImplementation(async (entity: any) => ({
                ...entity,
                id: entity.id ?? 'copied-application-id'
            }))
            ;(dataSource.manager.query as jest.Mock).mockResolvedValueOnce([{ id: '018f8a78-7b8f-7c1d-a111-222233334448' }])

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications/application-1/copy')
                .send({
                    name: { en: 'Source App (copy)' },
                    copyConnector: false,
                    createSchema: false,
                    copyAccess: false
                })
                .expect(201)

            expect(response.body.id).toBe('018f8a78-7b8f-7c1d-a111-222233334448')
            expect(applicationRepo.save).toHaveBeenCalledTimes(2)

            const firstAttemptPayload = applicationRepo.create.mock.calls[0][0]
            const secondAttemptPayload = applicationRepo.create.mock.calls[1][0]
            expect(firstAttemptPayload.slug).toBe('source-app-copy')
            expect(secondAttemptPayload.slug).toBe('source-app-copy-2')
        })

        it('should ignore legacy createSchema flag and still copy without connectors when copyConnector=false', async () => {
            const { dataSource, applicationRepo, applicationUserRepo, connectorRepo, connectorPublicationRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValueOnce({
                userId: 'test-user-id',
                applicationId: 'application-1',
                role: 'owner'
            })

            applicationRepo.findOne.mockResolvedValueOnce({
                id: 'application-1',
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: { en: { content: 'Source App' } }
                },
                description: null,
                slug: 'source-app',
                isPublic: false,
                schemaName: 'app_source001'
            })
            applicationRepo.findOne.mockResolvedValueOnce(null)
            applicationRepo.create.mockImplementation((entity: any) => entity)
            applicationRepo.save.mockImplementation(async (entity: any) => ({
                ...entity,
                id: entity.id ?? 'copied-application-id'
            }))
            ;(dataSource.manager.query as jest.Mock).mockResolvedValueOnce([{ id: '018f8a78-7b8f-7c1d-a111-222233334449' }])

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications/application-1/copy')
                .send({
                    name: { en: 'Source App (copy)' },
                    copyConnector: false,
                    createSchema: true
                })
                .expect(201)

            expect(response.body.id).toBe('018f8a78-7b8f-7c1d-a111-222233334449')
            expect(connectorRepo.find).not.toHaveBeenCalled()
            expect(connectorPublicationRepo.find).not.toHaveBeenCalled()
        })
    })

    describe('GET /applications/:applicationId', () => {
        it('should return 403 when user has no access', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationRepo.findOne.mockResolvedValue({
                id: 'application-1',
                name: 'Test'
            })
            applicationUserRepo.findOne.mockResolvedValue(null) // no membership

            const app = buildApp(dataSource)

            // API returns 403 when user has no access (checked before 404)
            await request(app).get('/applications/non-existent-id').expect(403)
        })

        it('should return application details for member', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            const mockApplication = {
                id: 'application-1',
                name: 'Test Application',
                description: 'Description',
                slug: 'test-app',
                isPublic: false,
                createdAt: new Date(),
                updatedAt: new Date()
            }

            applicationRepo.findOne.mockResolvedValue(mockApplication)
            applicationUserRepo.findOne.mockResolvedValue({
                user_id: 'test-user-id',
                role: 'owner'
            })

            const app = buildApp(dataSource)

            const response = await request(app).get('/applications/application-1').expect(200)

            expect(response.body).toMatchObject({
                id: 'application-1',
                name: 'Test Application'
            })
        })
    })

    describe('PATCH /applications/:applicationId', () => {
        it('should update application for owner', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            const mockApplication = {
                id: 'application-1',
                name: 'Old Name',
                description: 'Old Description',
                slug: 'test-app',
                isPublic: false
            }

            applicationRepo.findOne.mockResolvedValue(mockApplication)
            applicationUserRepo.findOne.mockResolvedValue({
                user_id: 'test-user-id',
                role: 'owner'
            })
            applicationRepo.save.mockResolvedValue({
                ...mockApplication,
                name: 'New Name'
            })

            const app = buildApp(dataSource)

            const response = await request(app).patch('/applications/application-1').send({ name: 'New Name' }).expect(200)

            expect(response.body.name).toBe('New Name')
        })
    })

    describe('DELETE /applications/:applicationId', () => {
        it('should delete application for owner', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            const mockApplication = {
                id: 'application-1',
                name: 'Test Application',
                schemaName: 'app_1234567890abcdef1234567890abcdef'
            }

            applicationRepo.findOne.mockResolvedValue(mockApplication)
            applicationUserRepo.findOne.mockResolvedValue({
                user_id: 'test-user-id',
                role: 'owner'
            })
            applicationRepo.remove.mockResolvedValue(mockApplication)

            const app = buildApp(dataSource)

            await request(app).delete('/applications/application-1').expect(204)

            expect(applicationRepo.remove).toHaveBeenCalled()
            expect(dataSource.manager.query).toHaveBeenCalledWith('DROP SCHEMA IF EXISTS "app_1234567890abcdef1234567890abcdef" CASCADE')
        })

        it('should return 403 for non-owner', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationRepo.findOne.mockResolvedValue({
                id: 'application-1',
                name: 'Test Application'
            })
            applicationUserRepo.findOne.mockResolvedValue({
                user_id: 'test-user-id',
                role: 'editor' // not owner
            })

            const app = buildApp(dataSource)

            await request(app).delete('/applications/application-1').expect(403)
        })
    })

    describe('Members endpoints', () => {
        describe('GET /applications/:applicationId/members', () => {
            it('should return members list for admin', async () => {
                const { dataSource, applicationRepo, applicationUserRepo, authUserRepo } = buildDataSource()

                applicationRepo.findOne.mockResolvedValue({
                    id: 'application-1',
                    name: 'Test'
                })
                applicationUserRepo.findOne.mockResolvedValue({
                    userId: 'test-user-id',
                    role: 'admin'
                })

                const mockQB = applicationUserRepo.createQueryBuilder()
                mockQB.getManyAndCount.mockResolvedValue([
                    [
                        {
                            id: 'member-1',
                            userId: 'user-1',
                            role: 'member',
                            _uplCreatedAt: new Date()
                        }
                    ],
                    1
                ])

                authUserRepo.find.mockResolvedValue([{ id: 'user-1', email: 'member@example.com' }])

                const app = buildApp(dataSource)

                const response = await request(app).get('/applications/application-1/members').expect(200)

                expect(response.body.items).toHaveLength(1)
                expect(response.body.items[0]).toMatchObject({
                    userId: 'user-1',
                    role: 'member'
                })
            })
        })

        describe('POST /applications/:applicationId/members', () => {
            it('should invite new member', async () => {
                const { dataSource, applicationRepo, applicationUserRepo, authUserRepo } = buildDataSource()

                applicationRepo.findOne.mockResolvedValue({
                    id: 'application-1',
                    name: 'Test'
                })
                applicationUserRepo.findOne
                    .mockResolvedValueOnce({ user_id: 'test-user-id', role: 'admin' }) // inviter
                    .mockResolvedValueOnce(null) // new member not already in app
                authUserRepo.findOne.mockResolvedValue({
                    id: 'new-user-id',
                    email: 'newuser@example.com'
                })
                applicationUserRepo.save.mockResolvedValue({
                    id: 'new-member-id',
                    user_id: 'new-user-id',
                    role: 'member'
                })

                const app = buildApp(dataSource)

                const response = await request(app)
                    .post('/applications/application-1/members')
                    .send({ email: 'newuser@example.com', role: 'member' })
                    .expect(201)

                expect(response.body).toMatchObject({
                    userId: 'new-user-id',
                    role: 'member'
                })
            })

            it('should reject inviting already existing member', async () => {
                const { dataSource, applicationRepo, applicationUserRepo, authUserRepo } = buildDataSource()

                applicationRepo.findOne.mockResolvedValue({
                    id: 'application-1',
                    name: 'Test'
                })
                applicationUserRepo.findOne
                    .mockResolvedValueOnce({ user_id: 'test-user-id', role: 'admin' }) // inviter
                    .mockResolvedValueOnce({ user_id: 'existing-id', role: 'member' }) // already member
                authUserRepo.findOne.mockResolvedValue({
                    id: 'existing-id',
                    email: 'existing@example.com'
                })

                const app = buildApp(dataSource)

                await request(app)
                    .post('/applications/application-1/members')
                    .send({ email: 'existing@example.com', role: 'member' })
                    .expect(409)
            })
        })

        describe('PATCH /applications/:applicationId/members/:userId', () => {
            it('should update member role', async () => {
                const { dataSource, applicationRepo, applicationUserRepo, authUserRepo } = buildDataSource()

                applicationRepo.findOne.mockResolvedValue({
                    id: 'application-1',
                    name: 'Test'
                })
                applicationUserRepo.findOne
                    .mockResolvedValueOnce({ user_id: 'test-user-id', role: 'admin' }) // actor
                    .mockResolvedValueOnce({
                        id: 'member-id',
                        user_id: 'target-user',
                        role: 'member'
                    }) // target
                applicationUserRepo.save.mockResolvedValue({
                    id: 'member-id',
                    user_id: 'target-user',
                    role: 'editor'
                })
                authUserRepo.find.mockResolvedValue([{ id: 'target-user', email: 'target@example.com' }])

                const app = buildApp(dataSource)

                const response = await request(app)
                    .patch('/applications/application-1/members/target-user')
                    .send({ role: 'editor' })
                    .expect(200)

                expect(response.body.role).toBe('editor')
            })
        })

        describe('DELETE /applications/:applicationId/members/:userId', () => {
            it('should remove member', async () => {
                const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

                applicationRepo.findOne.mockResolvedValue({
                    id: 'application-1',
                    name: 'Test'
                })
                applicationUserRepo.findOne
                    .mockResolvedValueOnce({ user_id: 'test-user-id', role: 'admin' }) // actor
                    .mockResolvedValueOnce({
                        id: 'member-id',
                        user_id: 'target-user',
                        role: 'member'
                    }) // target
                applicationUserRepo.remove.mockResolvedValue({ id: 'member-id' })

                const app = buildApp(dataSource)

                await request(app).delete('/applications/application-1/members/target-user').expect(204)

                expect(applicationUserRepo.remove).toHaveBeenCalled()
            })

            it('should prevent removing owner', async () => {
                const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

                applicationRepo.findOne.mockResolvedValue({
                    id: 'application-1',
                    name: 'Test'
                })
                applicationUserRepo.findOne
                    .mockResolvedValueOnce({ user_id: 'test-user-id', role: 'admin' }) // actor
                    .mockResolvedValueOnce({
                        id: 'owner-id',
                        user_id: 'owner-user',
                        role: 'owner'
                    }) // target is owner

                const app = buildApp(dataSource)

                await request(app).delete('/applications/application-1/members/owner-user').expect(403)
            })
        })
    })

    describe('Runtime enumeration validation', () => {
        const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334444'
        const runtimeCatalogId = '018f8a78-7b8f-7c1d-a111-222233334445'

        it('rejects create when enum REF field in label mode is explicitly provided by user', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'owner'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test'
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [{ id: runtimeCatalogId, codename: 'orders', table_name: 'orders' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_attributes')) {
                    return [
                        {
                            id: 'attr-1',
                            codename: 'status',
                            column_name: 'status_ref',
                            data_type: 'REF',
                            is_required: false,
                            validation_rules: {},
                            target_object_id: 'enum-obj-1',
                            target_object_kind: 'enumeration',
                            ui_config: { enumPresentationMode: 'label' }
                        }
                    ]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows`)
                .send({
                    catalogId: runtimeCatalogId,
                    data: {
                        status_ref: '018f8a78-7b8f-7c1d-a111-222233334444'
                    }
                })
                .expect(400)

            expect(response.body.error).toBe('Field is read-only: status')
        })

        it('rejects PATCH when enum value does not belong to selected target enumeration', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'owner'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test'
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [{ id: runtimeCatalogId, codename: 'orders', table_name: 'orders' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_attributes')) {
                    return [
                        {
                            id: 'attr-1',
                            codename: 'status',
                            column_name: 'status_ref',
                            data_type: 'REF',
                            is_required: false,
                            validation_rules: {},
                            target_object_id: 'enum-obj-1',
                            target_object_kind: 'enumeration',
                            ui_config: { enumPresentationMode: 'select' }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_values')) {
                    return []
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .patch(`/applications/${runtimeApplicationId}/runtime/018f8a78-7b8f-7c1d-a111-222233334444`)
                .send({
                    catalogId: runtimeCatalogId,
                    field: 'status_ref',
                    value: '018f8a78-7b8f-7c1d-a111-222233334444'
                })
                .expect(400)

            expect(response.body.error).toBe('Enumeration value does not belong to target enumeration')
        })

        it('applies default enum value for label-mode REF when user value is omitted', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const defaultEnumValueId = '018f8a78-7b8f-7c1d-a111-222233334446'
            const insertedRowId = '018f8a78-7b8f-7c1d-a111-222233334447'

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'owner'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test'
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [{ id: runtimeCatalogId, codename: 'orders', table_name: 'orders' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_attributes')) {
                    return [
                        {
                            id: 'attr-1',
                            codename: 'status',
                            column_name: 'status_ref',
                            data_type: 'REF',
                            is_required: false,
                            validation_rules: {},
                            target_object_id: 'enum-obj-1',
                            target_object_kind: 'enumeration',
                            ui_config: { enumPresentationMode: 'label', defaultEnumValueId }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_values')) {
                    return [{ id: defaultEnumValueId }]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."orders"')) {
                    return [{ id: insertedRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows`)
                .send({
                    catalogId: runtimeCatalogId,
                    data: {}
                })
                .expect(201)

            expect(response.body).toEqual({ id: insertedRowId, status: 'created' })

            const insertCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('INSERT INTO "app_runtime_test"."orders"')
            )
            expect(insertCall).toBeDefined()
            expect(insertCall?.[1]).toContain(defaultEnumValueId)
        })
    })
})
