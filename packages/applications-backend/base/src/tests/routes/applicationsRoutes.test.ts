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
        const authUserRepo = createMockRepository<any>()
        const profileRepo = createMockRepository<any>()

        const dataSource = createMockDataSource({
            Application: applicationRepo,
            ApplicationUser: applicationUserRepo,
            Connector: connectorRepo,
            AuthUser: authUserRepo,
            Profile: profileRepo
        })

        return {
            dataSource,
            applicationRepo,
            applicationUserRepo,
            connectorRepo,
            authUserRepo,
            profileRepo
        }
    }

    beforeEach(() => {
        jest.clearAllMocks()
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
                name: 'Test Application'
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
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                const mockQB = applicationUserRepo.createQueryBuilder()
                mockQB.getManyAndCount.mockResolvedValue([
                    [
                        {
                            id: 'member-1',
                            user_id: 'user-1',
                            role: 'member',
                            created_at: new Date()
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
