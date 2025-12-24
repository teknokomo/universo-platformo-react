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
import { createMetahubsRoutes } from '../../routes/metahubsRoutes'

describe('Metahubs Routes', () => {
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
        // Don't send if headers already sent
        if (res.headersSent) {
            return _next(err)
        }
        // Handle http-errors (from createError) - extract statusCode/status
        const statusCode = err.statusCode || err.status || 500
        const message = err.message || 'Internal Server Error'
        res.status(statusCode).json({ error: message })
    }

    // Helper to build Express app with error handler
    const buildApp = (dataSource: any) => {
        const app = express()
        app.use(express.json())
        app.use(
            '/metahubs',
            createMetahubsRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
        )
        app.use(errorHandler) // Must be after routes to catch errors from asyncHandler
        return app
    }

    const buildDataSource = () => {
        const metahubRepo = createMockRepository<any>()
        const metahubUserRepo = createMockRepository<any>()
        const hubRepo = createMockRepository<any>()
        const attributeRepo = createMockRepository<any>()
        const hubRecordRepo = createMockRepository<any>()
        const authUserRepo = createMockRepository<any>()
        const profileRepo = createMockRepository<any>()

        const dataSource = createMockDataSource({
            Metahub: metahubRepo,
            MetahubUser: metahubUserRepo,
            Hub: hubRepo,
            Attribute: attributeRepo,
            HubRecord: hubRecordRepo,
            AuthUser: authUserRepo,
            Profile: profileRepo
        })

        return {
            dataSource,
            metahubRepo,
            metahubUserRepo,
            hubRepo,
            attributeRepo,
            hubRecordRepo,
            authUserRepo,
            profileRepo
        }
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('GET /metahubs', () => {
        it('should return empty array for user with no metahubs', async () => {
            const { dataSource, metahubRepo } = buildDataSource()

            // Default mock returns [[], 0]
            metahubRepo.createQueryBuilder().getManyAndCount.mockResolvedValue([[], 0])

            const app = buildApp(dataSource)

            const response = await request(app).get('/metahubs').expect(200)

            expect(response.body).toMatchObject({
                items: [],
                total: 0,
                limit: 100,
                offset: 0
            })
        })

        it('should return metahubs with counts for authenticated user', async () => {
            const { dataSource, metahubRepo } = buildDataSource()

            const mockMetahubs = [
                {
                    id: 'metahub-1',
                    name: 'Test Metahub',
                    description: 'Test Description',
                    createdAt: new Date('2025-01-01'),
                    updatedAt: new Date('2025-01-02')
                }
            ]

            const mockQB = metahubRepo.createQueryBuilder()
            mockQB.getManyAndCount.mockResolvedValue([mockMetahubs, 1])

            const app = buildApp(dataSource)

            const response = await request(app).get('/metahubs').expect(200)

            expect(response.body.items).toHaveLength(1)
            expect(response.body.items[0]).toMatchObject({
                id: 'metahub-1',
                name: 'Test Metahub',
                description: 'Test Description',
                entitiesCount: 0,
                membersCount: 0
            })
            expect(response.body.items[0]).toHaveProperty('createdAt')
            expect(response.body.items[0]).toHaveProperty('updatedAt')
            expect(response.body).toMatchObject({ total: 1, limit: 100, offset: 0 })
        })

        it('should handle pagination parameters correctly', async () => {
            const { dataSource, metahubRepo } = buildDataSource()

            const mockQB = metahubRepo.createQueryBuilder()
            mockQB.getManyAndCount.mockResolvedValue([[], 0])

            const app = buildApp(dataSource)

            await request(app).get('/metahubs?limit=5&offset=10&sortBy=name&sortOrder=asc').expect(200)

            expect(mockQB.take).toHaveBeenCalledWith(5)
            expect(mockQB.skip).toHaveBeenCalledWith(10)
            expect(mockQB.orderBy).toHaveBeenCalledWith('m.name', 'ASC')
        })

        it('should validate pagination parameters', async () => {
            const { dataSource, metahubRepo } = buildDataSource()

            const mockQB = metahubRepo.createQueryBuilder()
            mockQB.getManyAndCount.mockResolvedValue([[], 0])

            const app = buildApp(dataSource)

            // Test 1: Negative offset is rejected by validation
            await request(app).get('/metahubs?offset=-5').expect(400)

            // Test 2: Limit over 1000 is rejected by validation
            await request(app).get('/metahubs?limit=2000').expect(400)

            // Test 3: Valid params pass through
            await request(app).get('/metahubs?limit=50&offset=10').expect(200)
            expect(mockQB.take).toHaveBeenCalledWith(50)
            expect(mockQB.skip).toHaveBeenCalledWith(10)
        })

        it('should use default pagination when no parameters provided', async () => {
            const { dataSource, metahubRepo } = buildDataSource()

            const mockQB = metahubRepo.createQueryBuilder()
            mockQB.getManyAndCount.mockResolvedValue([[], 0])

            const app = buildApp(dataSource)

            await request(app).get('/metahubs').expect(200)

            // Should use defaults: limit=100, offset=0, orderBy updatedAt DESC
            expect(mockQB.take).toHaveBeenCalledWith(100)
            expect(mockQB.skip).toHaveBeenCalledWith(0)
            expect(mockQB.orderBy).toHaveBeenCalledWith('m.updated_at', 'DESC')
        })

        it('should return 401 when user is not authenticated', async () => {
            const { dataSource } = buildDataSource()

            const noAuthMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
                // No user set in request
                next()
            }

            // Special case: test with noAuthMiddleware
            const app = express()
            app.use(express.json())
            app.use(
                '/metahubs',
                createMetahubsRoutes(noAuthMiddleware, () => dataSource, mockRateLimiter, mockRateLimiter)
            )
            app.use(errorHandler)

            await request(app).get('/metahubs').expect(401)
        })

        it('should handle database errors gracefully', async () => {
            const { dataSource, metahubRepo } = buildDataSource()

            const mockQB = metahubRepo.createQueryBuilder()
            mockQB.getManyAndCount.mockRejectedValue(new Error('Database connection failed'))

            const app = buildApp(dataSource)

            const response = await request(app).get('/metahubs').expect(500)

            expect(response.body).toMatchObject({ error: 'Database connection failed' })
        })

        it('should filter by search query (case-insensitive)', async () => {
            const { dataSource, metahubRepo } = buildDataSource()

            const mockMetahubs = [
                {
                    id: 'metahub-1',
                    name: 'Test Metahub',
                    description: 'A test description',
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ]

            const mockQB = metahubRepo.createQueryBuilder()
            mockQB.getManyAndCount.mockResolvedValue([mockMetahubs, 1])

            const app = buildApp(dataSource)

            await request(app).get('/metahubs?search=test').expect(200)

            expect(mockQB.andWhere).toHaveBeenCalledWith('(LOWER(m.name) LIKE :search OR LOWER(m.description) LIKE :search)', {
                search: '%test%'
            })
        })

        it('should set correct pagination headers', async () => {
            const { dataSource, metahubRepo } = buildDataSource()

            const mockMetahubs = [
                {
                    id: 'metahub-1',
                    name: 'Test Metahub',
                    description: 'Test Description',
                    createdAt: new Date('2025-01-01'),
                    updatedAt: new Date('2025-01-02')
                }
            ]

            const mockQB = metahubRepo.createQueryBuilder()
            mockQB.getManyAndCount.mockResolvedValue([mockMetahubs, 1])

            const app = buildApp(dataSource)

            await request(app)
                .get('/metahubs?limit=50&offset=25')
                .expect(200)
                .expect((res) => {
                    expect(res.body).toMatchObject({ limit: 50, offset: 25, total: 1 })
                })
        })
    })

    // NOTE: Removed tests for legacy /entities and /sections endpoints.
    // These endpoints were removed in the metadata-driven platform refactoring.
    // New tests for /hubs, /attributes, and /records should be added.

    describe('Members management endpoints', () => {
        const buildApp = () => {
            const context = buildDataSource()
            const app = express()
            app.use(express.json())
            app.use(
                '/metahubs',
                createMetahubsRoutes(ensureAuth, () => context.dataSource, mockRateLimiter, mockRateLimiter)
            )
            app.use(errorHandler) // Add error handler for http-errors
            return { app, ...context }
        }

        it('should return members when user has manageMembers permission', async () => {
            const { app, metahubUserRepo, dataSource, profileRepo } = buildApp()

            const now = new Date('2024-01-01T00:00:00.000Z')

            metahubUserRepo.findOne.mockResolvedValueOnce({
                id: 'membership-admin',
                metahub_id: 'metahub-1',
                user_id: 'test-user-id',
                role: 'admin'
            })

            // Mock QueryBuilder for loadMembers
            const mockQB = metahubUserRepo.createQueryBuilder()
            const membersList = [
                {
                    id: 'membership-owner',
                    metahub_id: 'metahub-1',
                    user_id: 'owner-id',
                    role: 'owner',
                    created_at: now
                },
                {
                    id: 'membership-editor',
                    metahub_id: 'metahub-1',
                    user_id: 'editor-id',
                    role: 'editor',
                    created_at: now
                }
            ]
            mockQB.getManyAndCount.mockResolvedValue([membersList, 2])

            const authQb = createMockRepository<any>().createQueryBuilder()
            authQb.getRawMany.mockResolvedValue([
                { id: 'owner-id', email: 'owner@example.com' },
                { id: 'editor-id', email: 'editor@example.com' }
            ])
            dataSource.createQueryBuilder.mockReturnValueOnce(authQb)
            profileRepo.find.mockResolvedValue([])

            const response = await request(app).get('/metahubs/metahub-1/members').expect(200)

            expect(response.body).toMatchObject({ total: 2, role: 'admin' })
            expect(Array.isArray(response.body.members)).toBe(true)
            expect(response.body.members).toEqual([
                expect.objectContaining({
                    id: 'membership-owner',
                    userId: 'owner-id',
                    email: 'owner@example.com',
                    role: 'owner'
                }),
                expect.objectContaining({
                    id: 'membership-editor',
                    userId: 'editor-id',
                    email: 'editor@example.com',
                    role: 'editor'
                })
            ])
        })

        it('should allow listing members without manageMembers permission', async () => {
            const { app, metahubUserRepo } = buildApp()

            metahubUserRepo.findOne.mockResolvedValueOnce({
                id: 'membership-basic',
                metahub_id: 'metahub-1',
                user_id: 'test-user-id',
                role: 'member'
            })

            const response = await request(app).get('/metahubs/metahub-1/members').expect(200)
            expect(response.body).toMatchObject({ role: 'member' })
            expect(response.body.permissions?.manageMembers).toBe(false)
        })

        it('should create member when requester can manage members', async () => {
            const { app, metahubUserRepo, authUserRepo } = buildApp()

            metahubUserRepo.findOne
                .mockResolvedValueOnce({
                    id: 'membership-admin',
                    metahub_id: 'metahub-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })
                .mockResolvedValueOnce(null)

            const qb = authUserRepo.createQueryBuilder()
            qb.getOne.mockResolvedValue({ id: 'target-user', email: 'target@example.com' })

            const response = await request(app)
                .post('/metahubs/metahub-1/members')
                .send({ email: 'target@example.com', role: 'editor' })
                .expect(201)

            expect(response.body).toMatchObject({
                userId: 'target-user',
                email: 'target@example.com',
                role: 'editor'
            })
            expect(metahubUserRepo.save).toHaveBeenCalled()
        })

        it('should reject creating member without permission', async () => {
            const { app, metahubUserRepo, authUserRepo } = buildApp()

            metahubUserRepo.findOne.mockResolvedValueOnce({
                id: 'membership-editor',
                metahub_id: 'metahub-1',
                user_id: 'test-user-id',
                role: 'editor'
            })

            await request(app).post('/metahubs/metahub-1/members').send({ email: 'target@example.com', role: 'member' }).expect(403)

            expect(authUserRepo.createQueryBuilder).not.toHaveBeenCalled()
        })

        it('should update member role when authorized', async () => {
            const { app, metahubUserRepo } = buildApp()

            metahubUserRepo.findOne
                .mockResolvedValueOnce({
                    id: 'membership-admin',
                    metahub_id: 'metahub-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })
                .mockResolvedValueOnce({
                    id: 'membership-target',
                    metahub_id: 'metahub-1',
                    user_id: 'target-user',
                    role: 'member'
                })

            const response = await request(app).patch('/metahubs/metahub-1/members/membership-target').send({ role: 'editor' }).expect(200)

            expect(response.body).toMatchObject({
                id: 'membership-target',
                role: 'editor'
            })
            expect(metahubUserRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'membership-target', role: 'editor' }))
        })

        it('should forbid updating member without permission', async () => {
            const { app, metahubUserRepo } = buildApp()

            metahubUserRepo.findOne.mockResolvedValueOnce({
                id: 'membership-member',
                metahub_id: 'metahub-1',
                user_id: 'test-user-id',
                role: 'member'
            })

            await request(app).patch('/metahubs/metahub-1/members/membership-target').send({ role: 'editor' }).expect(403)
        })

        it('should delete member when authorized', async () => {
            const { app, metahubUserRepo } = buildApp()

            metahubUserRepo.findOne
                .mockResolvedValueOnce({
                    id: 'membership-admin',
                    metahub_id: 'metahub-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })
                .mockResolvedValueOnce({
                    id: 'membership-target',
                    metahub_id: 'metahub-1',
                    user_id: 'target-user',
                    role: 'member'
                })

            await request(app).delete('/metahubs/metahub-1/members/membership-target').expect(204)
            expect(metahubUserRepo.delete).toHaveBeenCalledWith('membership-target')
        })

        it('should reject deleting member without permission', async () => {
            const { app, metahubUserRepo } = buildApp()

            metahubUserRepo.findOne.mockResolvedValueOnce({
                id: 'membership-member',
                metahub_id: 'metahub-1',
                user_id: 'test-user-id',
                role: 'member'
            })

            await request(app).delete('/metahubs/metahub-1/members/membership-target').expect(403)
        })

        describe('Members data enrichment', () => {
            it('should fetch nickname from profiles table via batch query', async () => {
                const { app, metahubUserRepo, dataSource, profileRepo } = buildApp()

                const now = new Date('2024-01-01T00:00:00.000Z')

                // Mock admin user permission check
                metahubUserRepo.findOne.mockResolvedValueOnce({
                    id: 'membership-admin',
                    metahub_id: 'metahub-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                // Mock QueryBuilder for loadMembers
                const mockQB = metahubUserRepo.createQueryBuilder()
                mockQB.getManyAndCount.mockResolvedValue([
                    [
                        {
                            id: 'membership-owner',
                            metahub_id: 'metahub-1',
                            user_id: 'owner-id',
                            role: 'owner',
                            comment: null,
                            created_at: now
                        },
                        {
                            id: 'membership-editor',
                            metahub_id: 'metahub-1',
                            user_id: 'editor-id',
                            role: 'editor',
                            comment: 'Test comment',
                            created_at: now
                        }
                    ],
                    2
                ])

                const authQb = createMockRepository<any>().createQueryBuilder()
                authQb.getRawMany.mockResolvedValue([
                    { id: 'owner-id', email: 'owner@example.com' },
                    { id: 'editor-id', email: 'editor@example.com' }
                ])
                dataSource.createQueryBuilder.mockReturnValueOnce(authQb)
                profileRepo.find.mockResolvedValue([
                    { user_id: 'owner-id', nickname: 'OwnerNick' },
                    { user_id: 'editor-id', nickname: 'EditorNick' }
                ])

                const response = await request(app).get('/metahubs/metahub-1/members').expect(200)

                // Verify nickname is fetched from profiles table
                expect(response.body.members).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            userId: 'owner-id',
                            email: 'owner@example.com',
                            nickname: 'OwnerNick',
                            role: 'owner'
                        }),
                        expect.objectContaining({
                            userId: 'editor-id',
                            email: 'editor@example.com',
                            nickname: 'EditorNick',
                            role: 'editor',
                            comment: 'Test comment'
                        })
                    ])
                )
            })

            it('should fetch comment from metahubs_users table', async () => {
                const { app, metahubUserRepo, dataSource, profileRepo } = buildApp()

                const now = new Date('2024-01-01T00:00:00.000Z')

                metahubUserRepo.findOne.mockResolvedValueOnce({
                    id: 'membership-admin',
                    metahub_id: 'metahub-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                const mockQB = metahubUserRepo.createQueryBuilder()
                mockQB.getManyAndCount.mockResolvedValue([
                    [
                        {
                            id: 'membership-editor',
                            metahub_id: 'metahub-1',
                            user_id: 'editor-id',
                            role: 'editor',
                            comment: 'This is a test comment from metahubs_users table',
                            created_at: now
                        }
                    ],
                    1
                ])

                const authQb = createMockRepository<any>().createQueryBuilder()
                authQb.getRawMany.mockResolvedValue([{ id: 'editor-id', email: 'editor@example.com' }])
                dataSource.createQueryBuilder.mockReturnValueOnce(authQb)
                profileRepo.find.mockResolvedValue([{ user_id: 'editor-id', nickname: 'EditorNick' }])

                const response = await request(app).get('/metahubs/metahub-1/members').expect(200)

                // Verify comment is returned from MetahubUser entity
                expect(response.body.members).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            userId: 'editor-id',
                            comment: 'This is a test comment from metahubs_users table'
                        })
                    ])
                )
            })

            it('should handle null email and nickname gracefully', async () => {
                const { app, metahubUserRepo, dataSource, profileRepo } = buildApp()

                const now = new Date('2024-01-01T00:00:00.000Z')

                metahubUserRepo.findOne.mockResolvedValueOnce({
                    id: 'membership-admin',
                    metahub_id: 'metahub-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                const mockQB = metahubUserRepo.createQueryBuilder()
                mockQB.getManyAndCount.mockResolvedValue([
                    [
                        {
                            id: 'membership-orphan',
                            metahub_id: 'metahub-1',
                            user_id: 'orphan-user-id',
                            role: 'member',
                            comment: null,
                            created_at: now
                        }
                    ],
                    1
                ])

                const authQb = createMockRepository<any>().createQueryBuilder()
                authQb.getRawMany.mockResolvedValue([{ id: 'orphan-user-id', email: null }])
                dataSource.createQueryBuilder.mockReturnValueOnce(authQb)
                profileRepo.find.mockResolvedValue([])

                const response = await request(app).get('/metahubs/metahub-1/members').expect(200)

                // Should return null for missing email and nickname
                expect(response.body.members).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            userId: 'orphan-user-id',
                            email: null,
                            nickname: null,
                            role: 'member'
                        })
                    ])
                )
            })
        })

        describe('Comment validation with trim', () => {
            it('should trim comment and validate max 500 characters on create', async () => {
                const { app, metahubUserRepo, authUserRepo, dataSource } = buildApp()

                metahubUserRepo.findOne.mockResolvedValueOnce({
                    id: 'membership-admin',
                    metahub_id: 'metahub-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                metahubUserRepo.findOne.mockResolvedValueOnce(null) // No existing membership

                const qb = authUserRepo.createQueryBuilder()
                qb.getOne.mockResolvedValue({ id: 'target-user', email: 'target@example.com' })

                metahubUserRepo.create.mockImplementation((data: any) => ({ ...data, id: 'new-membership-id' }))
                metahubUserRepo.save.mockImplementation((entity: any) => Promise.resolve(entity))

                // Mock Profile.findOne for the POST response
                dataSource.manager.findOne.mockResolvedValue({ user_id: 'target-user', nickname: 'TargetNick' })

                const commentWithWhitespace = '   This comment has leading and trailing spaces   '

                const response = await request(app)
                    .post('/metahubs/metahub-1/members')
                    .send({
                        email: 'target@example.com',
                        role: 'editor',
                        comment: commentWithWhitespace
                    })
                    .expect(201)

                // Verify comment was trimmed before saving
                expect(metahubUserRepo.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        comment: 'This comment has leading and trailing spaces'
                    })
                )
            })

            it('should reject comment longer than 500 characters after trim', async () => {
                const { app, metahubUserRepo, authUserRepo } = buildApp()

                metahubUserRepo.findOne.mockResolvedValueOnce({
                    id: 'membership-admin',
                    metahub_id: 'metahub-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                // Create comment with exactly 501 characters (after trim)
                const longComment = 'a'.repeat(501)

                const qb = authUserRepo.createQueryBuilder()
                qb.getOne.mockResolvedValue({ id: 'target-user', email: 'target@example.com' })

                const response = await request(app)
                    .post('/metahubs/metahub-1/members')
                    .send({
                        email: 'target@example.com',
                        role: 'editor',
                        comment: longComment
                    })
                    .expect(400)

                expect(response.body).toMatchObject({
                    error: 'Invalid payload'
                })

                // Verify Zod validation error details
                expect(response.body.details).toBeDefined()
            })

            it('should return 400 with validation details for invalid role or email', async () => {
                const { app, metahubUserRepo } = buildApp()

                metahubUserRepo.findOne.mockResolvedValue({
                    id: 'membership-admin',
                    metahub_id: 'metahub-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                // Test invalid role
                let response = await request(app)
                    .post('/metahubs/metahub-1/members')
                    .send({
                        email: 'target@example.com',
                        role: 'invalid-role'
                    })
                    .expect(400)

                expect(response.body).toMatchObject({
                    error: 'Invalid payload'
                })
                expect(response.body.details).toBeDefined()

                // Test invalid email
                response = await request(app)
                    .post('/metahubs/metahub-1/members')
                    .send({
                        email: 'not-an-email',
                        role: 'editor'
                    })
                    .expect(400)

                expect(response.body).toMatchObject({
                    error: 'Invalid payload'
                })
                expect(response.body.details).toBeDefined()

                // Verify no member was created
                expect(metahubUserRepo.save).not.toHaveBeenCalled()
            })
        })
    })

    describe('Rate Limiting', () => {
        // Note: Rate limiting tests use mock limiters since we test the integration,
        // not the actual rate limiting library functionality.
        // The real rate limiting is tested via integration tests with actual Redis.

        it('should allow requests within read limit (integration test with mock)', async () => {
            const { dataSource, metahubRepo } = buildDataSource()
            const mockQB = metahubRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = buildApp(dataSource)

            // Make 5 requests (well below 100 limit)
            for (let i = 0; i < 5; i++) {
                await request(app).get('/metahubs').expect(200)
            }

            // All requests should pass with mock limiter
        })

        it.skip('should return 429 after exceeding read limit (requires real Redis)', async () => {
            // This test requires actual Redis connection and real rate limiters
            // Skip in unit tests - covered by integration tests
        })

        it.skip('should return 429 after exceeding write limit (requires real Redis)', async () => {
            // This test requires actual Redis connection and real rate limiters
            // Skip in unit tests - covered by integration tests
        })

        it('should have separate limits for read and write', async () => {
            const { dataSource, metahubRepo, authUserRepo } = buildDataSource()
            const mockQB = metahubRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            metahubRepo.create.mockImplementation((data: any) => ({ ...data, id: 'new-id' }))
            metahubRepo.save.mockImplementation((entity: any) => Promise.resolve(entity))
            authUserRepo.findOne.mockResolvedValue({ id: 'test-user-id', email: 'test@example.com' })

            const app = buildApp(dataSource)

            // Make 100 GET requests (at read limit)
            for (let i = 0; i < 100; i++) {
                await request(app).get('/metahubs').expect(200)
            }

            // POST should still work (separate write counter)
            await request(app).post('/metahubs').send({ name: 'test', description: 'test' }).expect(201)
        })

        it.skip('should include rate limit headers in response (requires real Redis)', async () => {
            // This test requires actual rate limiter with Redis to inject headers
            // Skip in unit tests - covered by integration tests
        })
    })
})
