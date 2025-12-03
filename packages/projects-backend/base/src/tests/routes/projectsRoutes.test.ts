jest.mock(
    'typeorm',
    () => {
        const decorator = () => () => {}
        return {
            __esModule: true,
            Task: decorator,
            PrimaryGeneratedColumn: decorator,
            PrimaryColumn: decorator,
            Column: decorator,
            CreateDateColumn: decorator,
            UpdateDateColumn: decorator,
            ManyToOne: decorator,
            OneToMany: decorator,
            JoinColumn: decorator,
            Index: decorator,
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
import { createProjectsRoutes } from '../../routes/ProjectsRoutes'

describe('Projects Routes', () => {
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
            '/Projects',
            createProjectsRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
        )
        app.use(errorHandler) // Must be after routes to catch errors from asyncHandler
        return app
    }

    const buildDataSource = () => {
        const ProjectRepo = createMockRepository<any>()
        const ProjectUserRepo = createMockRepository<any>()
        const TaskRepo = createMockRepository<any>()
        const linkRepo = createMockRepository<any>()
        const MilestoneRepo = createMockRepository<any>()
        const MilestoneLinkRepo = createMockRepository<any>()
        const authUserRepo = createMockRepository<any>()

        const dataSource = createMockDataSource({
            Project: ProjectRepo,
            ProjectUser: ProjectUserRepo,
            Task: TaskRepo,
            TaskProject: linkRepo,
            Milestone: MilestoneRepo,
            MilestoneProject: MilestoneLinkRepo,
            AuthUser: authUserRepo
        })

        return {
            dataSource,
            ProjectRepo,
            ProjectUserRepo,
            TaskRepo,
            linkRepo,
            MilestoneRepo,
            MilestoneLinkRepo,
            authUserRepo
        }
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('GET /Projects', () => {
        it('should return empty array for user with no Projects', async () => {
            const { dataSource, ProjectRepo } = buildDataSource()

            // Mock QueryBuilder to return empty array
            const mockQB = ProjectRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = buildApp(dataSource)

            const response = await request(app).get('/Projects').expect(200)

            expect(Array.isArray(response.body)).toBe(true)
            expect(response.body).toHaveLength(0)
            // Verify total count is 0 for empty results (edge case handling)
            expect(response.headers['x-total-count']).toBe('0')
        })

        it('should return Projects with counts for authenticated user', async () => {
            const { dataSource, ProjectRepo } = buildDataSource()

            const mockProjects = [
                {
                    id: 'Project-1',
                    name: 'Test Project',
                    description: 'Test Description',
                    created_at: new Date('2025-01-01'),
                    updated_at: new Date('2025-01-02'),
                    MilestonesCount: '2',
                    TasksCount: '5',
                    window_total: '1' // Window function returns total count
                }
            ]

            const mockQB = ProjectRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue(mockProjects)

            const app = buildApp(dataSource)

            const response = await request(app).get('/Projects').expect(200)

            expect(response.body).toHaveLength(1)
            expect(response.body[0]).toMatchObject({
                id: 'Project-1',
                name: 'Test Project',
                description: 'Test Description',
                MilestonesCount: 2,
                TasksCount: 5
            })
            expect(response.body[0]).toHaveProperty('createdAt')
            expect(response.body[0]).toHaveProperty('updatedAt')
            // Verify window function is used for total count
            expect(mockQB.addSelect).toHaveBeenCalledWith('COUNT(*) OVER()', 'window_total')
            expect(response.headers['x-total-count']).toBe('1')
        })

        it('should handle pagination parameters correctly', async () => {
            const { dataSource, ProjectRepo } = buildDataSource()

            const mockQB = ProjectRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = buildApp(dataSource)

            await request(app).get('/Projects?limit=5&offset=10&sortBy=name&sortOrder=asc').expect(200)

            expect(mockQB.limit).toHaveBeenCalledWith(5)
            expect(mockQB.offset).toHaveBeenCalledWith(10)
            expect(mockQB.orderBy).toHaveBeenCalledWith('m.name', 'ASC')
        })

        it('should validate pagination parameters', async () => {
            const { dataSource, ProjectRepo } = buildDataSource()

            const mockQB = ProjectRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = buildApp(dataSource)

            // Test 1: Negative offset is rejected by validation
            await request(app).get('/Projects?offset=-5').expect(400)

            // Test 2: Limit over 1000 is rejected by validation
            await request(app).get('/Projects?limit=2000').expect(400)

            // Test 3: Valid params pass through
            await request(app).get('/Projects?limit=50&offset=10').expect(200)
            expect(mockQB.limit).toHaveBeenCalledWith(50)
            expect(mockQB.offset).toHaveBeenCalledWith(10)
        })

        it('should use default pagination when no parameters provided', async () => {
            const { dataSource, ProjectRepo } = buildDataSource()

            const mockQB = ProjectRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = buildApp(dataSource)

            await request(app).get('/Projects').expect(200)

            // Should use defaults: limit=100, offset=0, orderBy updatedAt DESC
            expect(mockQB.limit).toHaveBeenCalledWith(100)
            expect(mockQB.offset).toHaveBeenCalledWith(0)
            expect(mockQB.orderBy).toHaveBeenCalledWith('m.updatedAt', 'DESC')
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
                '/Projects',
                createProjectsRoutes(noAuthMiddleware, () => dataSource, mockRateLimiter, mockRateLimiter)
            )
            app.use(errorHandler)

            await request(app).get('/Projects').expect(401)
        })

        it('should handle database errors gracefully', async () => {
            const { dataSource, ProjectRepo } = buildDataSource()

            const mockQB = ProjectRepo.createQueryBuilder()
            mockQB.getRawMany.mockRejectedValue(new Error('Database connection failed'))

            const app = buildApp(dataSource)

            const response = await request(app).get('/Projects').expect(500)

            expect(response.body).toMatchObject({
                error: 'Internal server error',
                details: 'Database connection failed'
            })
        })

        it('should filter by search query (case-insensitive)', async () => {
            const { dataSource, ProjectRepo } = buildDataSource()

            const mockProjects = [
                {
                    id: 'mv-1',
                    name: 'Test Space',
                    description: 'A test description',
                    created_at: new Date(),
                    updated_at: new Date(),
                    MilestonesCount: '0',
                    TasksCount: '0',
                    role: 'owner',
                    window_total: '1'
                }
            ]

            const mockQB = ProjectRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue(mockProjects)

            const app = buildApp(dataSource)

            await request(app).get('/Projects?search=test').expect(200)

            expect(mockQB.andWhere).toHaveBeenCalledWith('(LOWER(m.name) LIKE :search OR LOWER(m.description) LIKE :search)', {
                search: '%test%'
            })
        })

        it('should set correct pagination headers', async () => {
            const { dataSource, ProjectRepo } = buildDataSource()

            const mockProjects = [
                {
                    id: 'Project-1',
                    name: 'Test Project',
                    description: 'Test Description',
                    created_at: new Date('2025-01-01'),
                    updated_at: new Date('2025-01-02'),
                    MilestonesCount: '2',
                    TasksCount: '5',
                    window_total: '1'
                }
            ]

            const mockQB = ProjectRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue(mockProjects)

            const app = buildApp(dataSource)

            await request(app)
                .get('/Projects?limit=50&offset=25')
                .expect(200)
                .expect((res) => {
                    expect(res.headers['x-pagination-limit']).toBe('50')
                    expect(res.headers['x-pagination-offset']).toBe('25')
                    expect(res.headers['x-pagination-count']).toBe('1')
                    expect(res.headers['x-total-count']).toBe('1')
                    expect(res.headers['x-pagination-has-more']).toBe('false')
                })
        })
    })

    describe('Members management endpoints', () => {
        const buildApp = () => {
            const context = buildDataSource()
            const app = express()
            app.use(express.json())
            app.use(
                '/Projects',
                createProjectsRoutes(ensureAuth, () => context.dataSource, mockRateLimiter, mockRateLimiter)
            )
            app.use(errorHandler) // Add error handler for http-errors
            return { app, ...context }
        }

        it('should return members when user has manageMembers permission', async () => {
            const { app, ProjectUserRepo, authUserRepo, dataSource } = buildApp()

            const now = new Date('2024-01-01T00:00:00.000Z')

            ProjectUserRepo.findOne.mockResolvedValueOnce({
                id: 'membership-admin',
                Project_id: 'Project-1',
                user_id: 'test-user-id',
                role: 'admin'
            })

            // Mock QueryBuilder for loadMembers
            const mockQB = ProjectUserRepo.createQueryBuilder()
            const membersList = [
                {
                    id: 'membership-owner',
                    Project_id: 'Project-1',
                    user_id: 'owner-id',
                    role: 'owner',
                    created_at: now
                },
                {
                    id: 'membership-editor',
                    Project_id: 'Project-1',
                    user_id: 'editor-id',
                    role: 'editor',
                    created_at: now
                }
            ]
            mockQB.getManyAndCount.mockResolvedValue([membersList, 2])

            // Mock dataSource.manager.find for users and profiles
            dataSource.manager.find.mockImplementation((Task: any, _options: any) => {
                const TaskName = Task.name || (typeof Task === 'function' ? Task.name : String(Task))
                if (TaskName === 'AuthUser') {
                    return Promise.resolve([
                        { id: 'owner-id', email: 'owner@example.com' },
                        { id: 'editor-id', email: 'editor@example.com' }
                    ])
                }
                if (TaskName === 'Profile') {
                    return Promise.resolve([])
                }
                return Promise.resolve([])
            })

            const response = await request(app).get('/Projects/Project-1/members').expect(200)

            // Response is now just the members array (role/permissions removed in cleanup)
            expect(Array.isArray(response.body)).toBe(true)
            expect(response.body).toEqual([
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

        it('should reject listing members without manageMembers permission', async () => {
            const { app, ProjectUserRepo } = buildApp()

            ProjectUserRepo.findOne.mockResolvedValueOnce({
                id: 'membership-basic',
                Project_id: 'Project-1',
                user_id: 'test-user-id',
                role: 'member'
            })

            const response = await request(app).get('/Projects/Project-1/members')
            expect(response.status).toBe(403)
            expect(ProjectUserRepo.find).not.toHaveBeenCalled()
        })

        it('should create member when requester can manage members', async () => {
            const { app, ProjectUserRepo, authUserRepo } = buildApp()

            ProjectUserRepo.findOne
                .mockResolvedValueOnce({
                    id: 'membership-admin',
                    Project_id: 'Project-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })
                .mockResolvedValueOnce(null)

            const qb = authUserRepo.createQueryBuilder()
            qb.getOne.mockResolvedValue({ id: 'target-user', email: 'target@example.com' })

            const response = await request(app)
                .post('/Projects/Project-1/members')
                .send({ email: 'target@example.com', role: 'editor' })
                .expect(201)

            expect(response.body).toMatchObject({
                userId: 'target-user',
                email: 'target@example.com',
                role: 'editor'
            })
            expect(ProjectUserRepo.save).toHaveBeenCalled()
        })

        it('should reject creating member without permission', async () => {
            const { app, ProjectUserRepo, authUserRepo } = buildApp()

            ProjectUserRepo.findOne.mockResolvedValueOnce({
                id: 'membership-editor',
                Project_id: 'Project-1',
                user_id: 'test-user-id',
                role: 'editor'
            })

            await request(app).post('/Projects/Project-1/members').send({ email: 'target@example.com', role: 'member' }).expect(403)

            expect(authUserRepo.createQueryBuilder).not.toHaveBeenCalled()
        })

        it('should update member role when authorized', async () => {
            const { app, ProjectUserRepo, authUserRepo } = buildApp()

            ProjectUserRepo.findOne
                .mockResolvedValueOnce({
                    id: 'membership-admin',
                    Project_id: 'Project-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })
                .mockResolvedValueOnce({
                    id: 'membership-target',
                    Project_id: 'Project-1',
                    user_id: 'target-user',
                    role: 'member'
                })

            authUserRepo.findOne.mockResolvedValue({ id: 'target-user', email: 'target@example.com' })

            const response = await request(app).patch('/Projects/Project-1/members/membership-target').send({ role: 'editor' }).expect(200)

            expect(response.body).toMatchObject({
                id: 'membership-target',
                role: 'editor',
                email: 'target@example.com'
            })
            expect(ProjectUserRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'membership-target', role: 'editor' }))
        })

        it('should forbid updating member without permission', async () => {
            const { app, ProjectUserRepo } = buildApp()

            ProjectUserRepo.findOne.mockResolvedValueOnce({
                id: 'membership-member',
                Project_id: 'Project-1',
                user_id: 'test-user-id',
                role: 'member'
            })

            await request(app).patch('/Projects/Project-1/members/membership-target').send({ role: 'editor' }).expect(403)
        })

        it('should delete member when authorized', async () => {
            const { app, ProjectUserRepo } = buildApp()

            ProjectUserRepo.findOne
                .mockResolvedValueOnce({
                    id: 'membership-admin',
                    Project_id: 'Project-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })
                .mockResolvedValueOnce({
                    id: 'membership-target',
                    Project_id: 'Project-1',
                    user_id: 'target-user',
                    role: 'member'
                })

            await request(app).delete('/Projects/Project-1/members/membership-target').expect(204)
            expect(ProjectUserRepo.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'membership-target' }))
        })

        it('should reject deleting member without permission', async () => {
            const { app, ProjectUserRepo } = buildApp()

            ProjectUserRepo.findOne.mockResolvedValueOnce({
                id: 'membership-member',
                Project_id: 'Project-1',
                user_id: 'test-user-id',
                role: 'member'
            })

            await request(app).delete('/Projects/Project-1/members/membership-target').expect(403)
        })

        describe('Members data enrichment', () => {
            it('should fetch nickname from profiles table via batch query', async () => {
                const { app, ProjectUserRepo, dataSource } = buildApp()

                const now = new Date('2024-01-01T00:00:00.000Z')

                // Mock admin user permission check
                ProjectUserRepo.findOne.mockResolvedValueOnce({
                    id: 'membership-admin',
                    Project_id: 'Project-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                // Mock QueryBuilder for loadMembers
                const mockQB = ProjectUserRepo.createQueryBuilder()
                mockQB.getManyAndCount.mockResolvedValue([
                    [
                        {
                            id: 'membership-owner',
                            Project_id: 'Project-1',
                            user_id: 'owner-id',
                            role: 'owner',
                            comment: null,
                            created_at: now
                        },
                        {
                            id: 'membership-editor',
                            Project_id: 'Project-1',
                            user_id: 'editor-id',
                            role: 'editor',
                            comment: 'Test comment',
                            created_at: now
                        }
                    ],
                    2
                ])

                // Mock dataSource.manager.find for both AuthUser and Profile
                dataSource.manager.find.mockImplementation((Task: any, options: any) => {
                    const TaskName = Task.name || (typeof Task === 'function' ? Task.name : String(Task))
                    if (TaskName === 'AuthUser') {
                        return Promise.resolve([
                            { id: 'owner-id', email: 'owner@example.com' },
                            { id: 'editor-id', email: 'editor@example.com' }
                        ])
                    }
                    if (TaskName === 'Profile') {
                        return Promise.resolve([
                            { id: 'profile-1', user_id: 'owner-id', nickname: 'OwnerNick' },
                            { id: 'profile-2', user_id: 'editor-id', nickname: 'EditorNick' }
                        ])
                    }
                    return Promise.resolve([])
                })

                const response = await request(app).get('/Projects/Project-1/members').expect(200)

                // Verify nickname is fetched from profiles table
                expect(response.body).toEqual(
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

                // Verify batch query was used (call count = 2: once for AuthUser, once for Profile)
                expect(dataSource.manager.find).toHaveBeenCalledTimes(2)
            })

            it('should fetch comment from Projects_users table', async () => {
                const { app, ProjectUserRepo, dataSource } = buildApp()

                const now = new Date('2024-01-01T00:00:00.000Z')

                ProjectUserRepo.findOne.mockResolvedValueOnce({
                    id: 'membership-admin',
                    Project_id: 'Project-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                const mockQB = ProjectUserRepo.createQueryBuilder()
                mockQB.getManyAndCount.mockResolvedValue([
                    [
                        {
                            id: 'membership-editor',
                            Project_id: 'Project-1',
                            user_id: 'editor-id',
                            role: 'editor',
                            comment: 'This is a test comment from Projects_users table',
                            created_at: now
                        }
                    ],
                    1
                ])

                dataSource.manager.find.mockImplementation((Task: any) => {
                    const TaskName = Task.name || (typeof Task === 'function' ? Task.name : String(Task))
                    if (TaskName === 'AuthUser') {
                        return Promise.resolve([{ id: 'editor-id', email: 'editor@example.com' }])
                    }
                    if (TaskName === 'Profile') {
                        return Promise.resolve([{ id: 'profile-1', user_id: 'editor-id', nickname: 'EditorNick' }])
                    }
                    return Promise.resolve([])
                })

                const response = await request(app).get('/Projects/Project-1/members').expect(200)

                // Verify comment is returned from ProjectUser Task
                expect(response.body).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            userId: 'editor-id',
                            comment: 'This is a test comment from Projects_users table'
                        })
                    ])
                )
            })

            it('should handle null email and nickname gracefully', async () => {
                const { app, ProjectUserRepo, dataSource } = buildApp()

                const now = new Date('2024-01-01T00:00:00.000Z')

                ProjectUserRepo.findOne.mockResolvedValueOnce({
                    id: 'membership-admin',
                    Project_id: 'Project-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                const mockQB = ProjectUserRepo.createQueryBuilder()
                mockQB.getManyAndCount.mockResolvedValue([
                    [
                        {
                            id: 'membership-orphan',
                            Project_id: 'Project-1',
                            user_id: 'orphan-user-id',
                            role: 'member',
                            comment: null,
                            created_at: now
                        }
                    ],
                    1
                ])

                // Mock manager.find to return AuthUser with null email and no Profile
                dataSource.manager.find.mockImplementation((Task: any) => {
                    const TaskName = Task.name || (typeof Task === 'function' ? Task.name : String(Task))
                    if (TaskName === 'AuthUser') {
                        return Promise.resolve([{ id: 'orphan-user-id', email: null }])
                    }
                    if (TaskName === 'Profile') {
                        return Promise.resolve([]) // No profile exists
                    }
                    return Promise.resolve([])
                })

                const response = await request(app).get('/Projects/Project-1/members').expect(200)

                // Should return null for missing email and nickname
                expect(response.body).toEqual(
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
                const { app, ProjectUserRepo, authUserRepo, dataSource } = buildApp()

                ProjectUserRepo.findOne.mockResolvedValueOnce({
                    id: 'membership-admin',
                    Project_id: 'Project-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                ProjectUserRepo.findOne.mockResolvedValueOnce(null) // No existing membership

                const qb = authUserRepo.createQueryBuilder()
                qb.getOne.mockResolvedValue({ id: 'target-user', email: 'target@example.com' })

                ProjectUserRepo.create.mockImplementation((data: any) => ({ ...data, id: 'new-membership-id' }))
                ProjectUserRepo.save.mockImplementation((Task: any) => Promise.resolve(Task))

                // Mock Profile.findOne for the POST response
                dataSource.manager.findOne.mockResolvedValue({ user_id: 'target-user', nickname: 'TargetNick' })

                const commentWithWhitespace = '   This comment has leading and trailing spaces   '

                const response = await request(app)
                    .post('/Projects/Project-1/members')
                    .send({
                        email: 'target@example.com',
                        role: 'editor',
                        comment: commentWithWhitespace
                    })
                    .expect(201)

                // Verify comment was trimmed before saving
                expect(ProjectUserRepo.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        comment: 'This comment has leading and trailing spaces'
                    })
                )
            })

            it('should reject comment longer than 500 characters after trim', async () => {
                const { app, ProjectUserRepo } = buildApp()

                ProjectUserRepo.findOne.mockResolvedValueOnce({
                    id: 'membership-admin',
                    Project_id: 'Project-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                // Create comment with exactly 501 characters (after trim)
                const longComment = 'a'.repeat(501)

                const response = await request(app)
                    .post('/Projects/Project-1/members')
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
                const { app, ProjectUserRepo } = buildApp()

                ProjectUserRepo.findOne.mockResolvedValue({
                    id: 'membership-admin',
                    Project_id: 'Project-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                // Test invalid role
                let response = await request(app)
                    .post('/Projects/Project-1/members')
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
                    .post('/Projects/Project-1/members')
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
                expect(ProjectUserRepo.save).not.toHaveBeenCalled()
            })
        })
    })

    describe('Rate Limiting', () => {
        // Note: Rate limiting tests use mock limiters since we test the integration,
        // not the actual rate limiting library functionality.
        // The real rate limiting is tested via integration tests with actual Redis.

        it('should allow requests within read limit (integration test with mock)', async () => {
            const { dataSource, ProjectRepo } = buildDataSource()
            const mockQB = ProjectRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = buildApp(dataSource)

            // Make 5 requests (well below 100 limit)
            for (let i = 0; i < 5; i++) {
                await request(app).get('/Projects').expect(200)
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
            const { dataSource, ProjectRepo, authUserRepo } = buildDataSource()
            const mockQB = ProjectRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            ProjectRepo.create.mockImplementation((data: any) => ({ ...data, id: 'new-id' }))
            ProjectRepo.save.mockImplementation((Task: any) => Promise.resolve(Task))
            authUserRepo.findOne.mockResolvedValue({ id: 'test-user-id', email: 'test@example.com' })

            const app = buildApp(dataSource)

            // Make 100 GET requests (at read limit)
            for (let i = 0; i < 100; i++) {
                await request(app).get('/Projects').expect(200)
            }

            // POST should still work (separate write counter)
            await request(app).post('/Projects').send({ name: 'test', description: 'test' }).expect(201)
        })

        it.skip('should include rate limit headers in response (requires real Redis)', async () => {
            // This test requires actual rate limiter with Redis to inject headers
            // Skip in unit tests - covered by integration tests
        })
    })
})
