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
        it('should copy application, schema and access (excluding requester duplicate role)', async () => {
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
                    copyAccess: true
                })
                .expect(201)

            expect(response.body.id).toBe('018f8a78-7b8f-7c1d-a111-222233334444')
            expect(mockGenerateSchemaName).toHaveBeenCalledWith('018f8a78-7b8f-7c1d-a111-222233334444')
            expect(mockCloneSchemaWithExecutor).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    sourceSchema: 'app_source001',
                    targetSchema: 'app_018f8a787b8f7c1da111222233334444',
                    copyData: true
                })
            )

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
})
