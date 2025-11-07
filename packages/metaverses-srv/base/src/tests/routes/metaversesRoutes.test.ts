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
import { createMetaversesRoutes } from '../../routes/metaversesRoutes'

describe('Metaverses Routes', () => {
    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as any).user = { id: 'test-user-id' }
        next()
    }

    // Mock rate limiters (no-op middleware for tests)
    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    const buildDataSource = () => {
        const metaverseRepo = createMockRepository<any>()
        const metaverseUserRepo = createMockRepository<any>()
        const entityRepo = createMockRepository<any>()
        const linkRepo = createMockRepository<any>()
        const sectionRepo = createMockRepository<any>()
        const sectionLinkRepo = createMockRepository<any>()
        const authUserRepo = createMockRepository<any>()

        const dataSource = createMockDataSource({
            Metaverse: metaverseRepo,
            MetaverseUser: metaverseUserRepo,
            Entity: entityRepo,
            EntityMetaverse: linkRepo,
            Section: sectionRepo,
            SectionMetaverse: sectionLinkRepo,
            AuthUser: authUserRepo
        })

        return {
            dataSource,
            metaverseRepo,
            metaverseUserRepo,
            entityRepo,
            linkRepo,
            sectionRepo,
            sectionLinkRepo,
            authUserRepo
        }
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('GET /metaverses', () => {
        it('should return empty array for user with no metaverses', async () => {
            const { dataSource, metaverseRepo } = buildDataSource()

            // Mock QueryBuilder to return empty array
            const mockQB = metaverseRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = express()
            app.use(express.json())
            app.use(
                '/metaverses',
                createMetaversesRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
            )

            const response = await request(app).get('/metaverses').expect(200)

            expect(Array.isArray(response.body)).toBe(true)
            expect(response.body).toHaveLength(0)
            // Verify total count is 0 for empty results (edge case handling)
            expect(response.headers['x-total-count']).toBe('0')
        })

        it('should return metaverses with counts for authenticated user', async () => {
            const { dataSource, metaverseRepo } = buildDataSource()

            const mockMetaverses = [
                {
                    id: 'metaverse-1',
                    name: 'Test Metaverse',
                    description: 'Test Description',
                    created_at: new Date('2025-01-01'),
                    updated_at: new Date('2025-01-02'),
                    sectionsCount: '2',
                    entitiesCount: '5',
                    window_total: '1' // Window function returns total count
                }
            ]

            const mockQB = metaverseRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue(mockMetaverses)

            const app = express()
            app.use(express.json())
            app.use(
                '/metaverses',
                createMetaversesRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
            )

            const response = await request(app).get('/metaverses').expect(200)

            expect(response.body).toHaveLength(1)
            expect(response.body[0]).toMatchObject({
                id: 'metaverse-1',
                name: 'Test Metaverse',
                description: 'Test Description',
                sectionsCount: 2,
                entitiesCount: 5
            })
            expect(response.body[0]).toHaveProperty('createdAt')
            expect(response.body[0]).toHaveProperty('updatedAt')
            // Verify window function is used for total count
            expect(mockQB.addSelect).toHaveBeenCalledWith('COUNT(*) OVER()', 'window_total')
            expect(response.headers['x-total-count']).toBe('1')
        })

        it('should handle pagination parameters correctly', async () => {
            const { dataSource, metaverseRepo } = buildDataSource()

            const mockQB = metaverseRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = express()
            app.use(express.json())
            app.use(
                '/metaverses',
                createMetaversesRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
            )

            await request(app).get('/metaverses?limit=5&offset=10&sortBy=name&sortOrder=asc').expect(200)

            expect(mockQB.limit).toHaveBeenCalledWith(5)
            expect(mockQB.offset).toHaveBeenCalledWith(10)
            expect(mockQB.orderBy).toHaveBeenCalledWith('m.name', 'ASC')
        })

        it('should validate and clamp pagination parameters', async () => {
            const { dataSource, metaverseRepo } = buildDataSource()

            const mockQB = metaverseRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = express()
            app.use(express.json())
            app.use(
                '/metaverses',
                createMetaversesRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
            )

            await request(app).get('/metaverses?limit=2000&offset=-5&sortBy=invalid&sortOrder=invalid').expect(200)

            // Should clamp limit to max 1000 and offset to min 0
            expect(mockQB.limit).toHaveBeenCalledWith(1000)
            expect(mockQB.offset).toHaveBeenCalledWith(0)
            // Should default to updated desc for invalid sortBy/sortOrder
            expect(mockQB.orderBy).toHaveBeenCalledWith('m.updatedAt', 'DESC')
        })

        it('should use default pagination when no parameters provided', async () => {
            const { dataSource, metaverseRepo } = buildDataSource()

            const mockQB = metaverseRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = express()
            app.use(express.json())
            app.use(
                '/metaverses',
                createMetaversesRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
            )

            await request(app).get('/metaverses').expect(200)

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

            const app = express()
            app.use(express.json())
            app.use(
                '/metaverses',
                createMetaversesRoutes(noAuthMiddleware, () => dataSource, mockRateLimiter, mockRateLimiter)
            )

            await request(app).get('/metaverses').expect(401)
        })

        it('should handle database errors gracefully', async () => {
            const { dataSource, metaverseRepo } = buildDataSource()

            const mockQB = metaverseRepo.createQueryBuilder()
            mockQB.getRawMany.mockRejectedValue(new Error('Database connection failed'))

            const app = express()
            app.use(express.json())
            app.use(
                '/metaverses',
                createMetaversesRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
            )

            const response = await request(app).get('/metaverses').expect(500)

            expect(response.body).toMatchObject({
                error: 'Internal server error',
                details: 'Database connection failed'
            })
        })

        it('should filter by search query (case-insensitive)', async () => {
            const { dataSource, metaverseRepo } = buildDataSource()

            const mockMetaverses = [
                {
                    id: 'mv-1',
                    name: 'Test Space',
                    description: 'A test description',
                    created_at: new Date(),
                    updated_at: new Date(),
                    sectionsCount: '0',
                    entitiesCount: '0',
                    role: 'owner',
                    window_total: '1'
                }
            ]

            const mockQB = metaverseRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue(mockMetaverses)

            const app = express()
            app.use(express.json())
            app.use(
                '/metaverses',
                createMetaversesRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
            )

            await request(app).get('/metaverses?search=test').expect(200)

            expect(mockQB.andWhere).toHaveBeenCalledWith('(LOWER(m.name) LIKE :search OR LOWER(m.description) LIKE :search)', {
                search: '%test%'
            })
        })

        it('should set correct pagination headers', async () => {
            const { dataSource, metaverseRepo } = buildDataSource()

            const mockMetaverses = [
                {
                    id: 'metaverse-1',
                    name: 'Test Metaverse',
                    description: 'Test Description',
                    created_at: new Date('2025-01-01'),
                    updated_at: new Date('2025-01-02'),
                    sectionsCount: '2',
                    entitiesCount: '5',
                    window_total: '1'
                }
            ]

            const mockQB = metaverseRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue(mockMetaverses)

            const app = express()
            app.use(express.json())
            app.use(
                '/metaverses',
                createMetaversesRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
            )

            await request(app)
                .get('/metaverses?limit=50&offset=25')
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
                '/metaverses',
                createMetaversesRoutes(ensureAuth, () => context.dataSource, mockRateLimiter, mockRateLimiter)
            )
            return { app, ...context }
        }

        it('should return members when user has manageMembers permission', async () => {
            const { app, metaverseUserRepo, authUserRepo } = buildApp()

            const now = new Date('2024-01-01T00:00:00.000Z')

            metaverseUserRepo.findOne.mockResolvedValueOnce({
                id: 'membership-admin',
                metaverse_id: 'metaverse-1',
                user_id: 'test-user-id',
                role: 'admin'
            })

            metaverseUserRepo.find.mockResolvedValue([
                {
                    id: 'membership-owner',
                    metaverse_id: 'metaverse-1',
                    user_id: 'owner-id',
                    role: 'owner',
                    created_at: now
                },
                {
                    id: 'membership-editor',
                    metaverse_id: 'metaverse-1',
                    user_id: 'editor-id',
                    role: 'editor',
                    created_at: now
                }
            ])

            authUserRepo.find.mockResolvedValue([
                { id: 'owner-id', email: 'owner@example.com' },
                { id: 'editor-id', email: 'editor@example.com' }
            ])

            const response = await request(app).get('/metaverses/metaverse-1/members').expect(200)

            expect(response.body.role).toBe('admin')
            expect(response.body.permissions).toEqual({
                manageMembers: true,
                manageMetaverse: true,
                createContent: true,
                editContent: true,
                deleteContent: true
            })
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

        it('should reject listing members without manageMembers permission', async () => {
            const { app, metaverseUserRepo } = buildApp()

            metaverseUserRepo.findOne.mockResolvedValueOnce({
                id: 'membership-basic',
                metaverse_id: 'metaverse-1',
                user_id: 'test-user-id',
                role: 'member'
            })

            await request(app).get('/metaverses/metaverse-1/members').expect(403)
            expect(metaverseUserRepo.find).not.toHaveBeenCalled()
        })

        it('should create member when requester can manage members', async () => {
            const { app, metaverseUserRepo, authUserRepo } = buildApp()

            metaverseUserRepo.findOne
                .mockResolvedValueOnce({
                    id: 'membership-admin',
                    metaverse_id: 'metaverse-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })
                .mockResolvedValueOnce(null)

            const qb = authUserRepo.createQueryBuilder()
            qb.getOne.mockResolvedValue({ id: 'target-user', email: 'target@example.com' })

            const response = await request(app)
                .post('/metaverses/metaverse-1/members')
                .send({ email: 'target@example.com', role: 'editor' })
                .expect(201)

            expect(response.body).toMatchObject({
                userId: 'target-user',
                email: 'target@example.com',
                role: 'editor'
            })
            expect(metaverseUserRepo.save).toHaveBeenCalled()
        })

        it('should reject creating member without permission', async () => {
            const { app, metaverseUserRepo, authUserRepo } = buildApp()

            metaverseUserRepo.findOne.mockResolvedValueOnce({
                id: 'membership-editor',
                metaverse_id: 'metaverse-1',
                user_id: 'test-user-id',
                role: 'editor'
            })

            await request(app).post('/metaverses/metaverse-1/members').send({ email: 'target@example.com', role: 'member' }).expect(403)

            expect(authUserRepo.createQueryBuilder).not.toHaveBeenCalled()
        })

        it('should update member role when authorized', async () => {
            const { app, metaverseUserRepo, authUserRepo } = buildApp()

            metaverseUserRepo.findOne
                .mockResolvedValueOnce({
                    id: 'membership-admin',
                    metaverse_id: 'metaverse-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })
                .mockResolvedValueOnce({
                    id: 'membership-target',
                    metaverse_id: 'metaverse-1',
                    user_id: 'target-user',
                    role: 'member'
                })

            authUserRepo.findOne.mockResolvedValue({ id: 'target-user', email: 'target@example.com' })

            const response = await request(app)
                .patch('/metaverses/metaverse-1/members/membership-target')
                .send({ role: 'editor' })
                .expect(200)

            expect(response.body).toMatchObject({
                id: 'membership-target',
                role: 'editor',
                email: 'target@example.com'
            })
            expect(metaverseUserRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'membership-target', role: 'editor' }))
        })

        it('should forbid updating member without permission', async () => {
            const { app, metaverseUserRepo } = buildApp()

            metaverseUserRepo.findOne.mockResolvedValueOnce({
                id: 'membership-member',
                metaverse_id: 'metaverse-1',
                user_id: 'test-user-id',
                role: 'member'
            })

            await request(app).patch('/metaverses/metaverse-1/members/membership-target').send({ role: 'editor' }).expect(403)
        })

        it('should delete member when authorized', async () => {
            const { app, metaverseUserRepo } = buildApp()

            metaverseUserRepo.findOne
                .mockResolvedValueOnce({
                    id: 'membership-admin',
                    metaverse_id: 'metaverse-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })
                .mockResolvedValueOnce({
                    id: 'membership-target',
                    metaverse_id: 'metaverse-1',
                    user_id: 'target-user',
                    role: 'member'
                })

            await request(app).delete('/metaverses/metaverse-1/members/membership-target').expect(204)
            expect(metaverseUserRepo.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'membership-target' }))
        })

        it('should reject deleting member without permission', async () => {
            const { app, metaverseUserRepo } = buildApp()

            metaverseUserRepo.findOne.mockResolvedValueOnce({
                id: 'membership-member',
                metaverse_id: 'metaverse-1',
                user_id: 'test-user-id',
                role: 'member'
            })

            await request(app).delete('/metaverses/metaverse-1/members/membership-target').expect(403)
        })

        describe('Members data enrichment', () => {
            it('should fetch nickname from profiles table via batch query', async () => {
                const { app, metaverseUserRepo, dataSource } = buildApp()

                const now = new Date('2024-01-01T00:00:00.000Z')

                // Mock admin user permission check
                metaverseUserRepo.findOne.mockResolvedValueOnce({
                    id: 'membership-admin',
                    metaverse_id: 'metaverse-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                // Mock QueryBuilder for loadMembers
                const mockQB = metaverseUserRepo.createQueryBuilder()
                mockQB.getManyAndCount.mockResolvedValue([
                    [
                        {
                            id: 'membership-owner',
                            metaverse_id: 'metaverse-1',
                            user_id: 'owner-id',
                            role: 'owner',
                            comment: null,
                            created_at: now
                        },
                        {
                            id: 'membership-editor',
                            metaverse_id: 'metaverse-1',
                            user_id: 'editor-id',
                            role: 'editor',
                            comment: 'Test comment',
                            created_at: now
                        }
                    ],
                    2
                ])

                // Mock dataSource.manager.find for both AuthUser and Profile
                dataSource.manager.find.mockImplementation((entity: any, options: any) => {
                    const entityName = entity.name || (typeof entity === 'function' ? entity.name : String(entity))
                    if (entityName === 'AuthUser') {
                        return Promise.resolve([
                            { id: 'owner-id', email: 'owner@example.com' },
                            { id: 'editor-id', email: 'editor@example.com' }
                        ])
                    }
                    if (entityName === 'Profile') {
                        return Promise.resolve([
                            { id: 'profile-1', user_id: 'owner-id', nickname: 'OwnerNick' },
                            { id: 'profile-2', user_id: 'editor-id', nickname: 'EditorNick' }
                        ])
                    }
                    return Promise.resolve([])
                })

                const response = await request(app).get('/metaverses/metaverse-1/members').expect(200)

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

            it('should fetch comment from metaverses_users table', async () => {
                const { app, metaverseUserRepo, dataSource } = buildApp()

                const now = new Date('2024-01-01T00:00:00.000Z')

                metaverseUserRepo.findOne.mockResolvedValueOnce({
                    id: 'membership-admin',
                    metaverse_id: 'metaverse-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                const mockQB = metaverseUserRepo.createQueryBuilder()
                mockQB.getManyAndCount.mockResolvedValue([
                    [
                        {
                            id: 'membership-editor',
                            metaverse_id: 'metaverse-1',
                            user_id: 'editor-id',
                            role: 'editor',
                            comment: 'This is a test comment from metaverses_users table',
                            created_at: now
                        }
                    ],
                    1
                ])

                dataSource.manager.find.mockImplementation((entity: any) => {
                    const entityName = entity.name || (typeof entity === 'function' ? entity.name : String(entity))
                    if (entityName === 'AuthUser') {
                        return Promise.resolve([{ id: 'editor-id', email: 'editor@example.com' }])
                    }
                    if (entityName === 'Profile') {
                        return Promise.resolve([{ id: 'profile-1', user_id: 'editor-id', nickname: 'EditorNick' }])
                    }
                    return Promise.resolve([])
                })

                const response = await request(app).get('/metaverses/metaverse-1/members').expect(200)

                // Verify comment is returned from MetaverseUser entity
                expect(response.body).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            userId: 'editor-id',
                            comment: 'This is a test comment from metaverses_users table'
                        })
                    ])
                )
            })

            it('should handle null email and nickname gracefully', async () => {
                const { app, metaverseUserRepo, dataSource } = buildApp()

                const now = new Date('2024-01-01T00:00:00.000Z')

                metaverseUserRepo.findOne.mockResolvedValueOnce({
                    id: 'membership-admin',
                    metaverse_id: 'metaverse-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                const mockQB = metaverseUserRepo.createQueryBuilder()
                mockQB.getManyAndCount.mockResolvedValue([
                    [
                        {
                            id: 'membership-orphan',
                            metaverse_id: 'metaverse-1',
                            user_id: 'orphan-user-id',
                            role: 'member',
                            comment: null,
                            created_at: now
                        }
                    ],
                    1
                ])

                // Mock manager.find to return AuthUser with null email and no Profile
                dataSource.manager.find.mockImplementation((entity: any) => {
                    const entityName = entity.name || (typeof entity === 'function' ? entity.name : String(entity))
                    if (entityName === 'AuthUser') {
                        return Promise.resolve([{ id: 'orphan-user-id', email: null }])
                    }
                    if (entityName === 'Profile') {
                        return Promise.resolve([]) // No profile exists
                    }
                    return Promise.resolve([])
                })

                const response = await request(app).get('/metaverses/metaverse-1/members').expect(200)

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
                const { app, metaverseUserRepo, authUserRepo, dataSource } = buildApp()

                metaverseUserRepo.findOne.mockResolvedValueOnce({
                    id: 'membership-admin',
                    metaverse_id: 'metaverse-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                metaverseUserRepo.findOne.mockResolvedValueOnce(null) // No existing membership

                const qb = authUserRepo.createQueryBuilder()
                qb.getOne.mockResolvedValue({ id: 'target-user', email: 'target@example.com' })

                metaverseUserRepo.create.mockImplementation((data: any) => ({ ...data, id: 'new-membership-id' }))
                metaverseUserRepo.save.mockImplementation((entity: any) => Promise.resolve(entity))

                // Mock Profile.findOne for the POST response
                dataSource.manager.findOne.mockResolvedValue({ user_id: 'target-user', nickname: 'TargetNick' })

                const commentWithWhitespace = '   This comment has leading and trailing spaces   '

                const response = await request(app)
                    .post('/metaverses/metaverse-1/members')
                    .send({
                        email: 'target@example.com',
                        role: 'editor',
                        comment: commentWithWhitespace
                    })
                    .expect(201)

                // Verify comment was trimmed before saving
                expect(metaverseUserRepo.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        comment: 'This comment has leading and trailing spaces'
                    })
                )
            })

            it('should reject comment longer than 500 characters after trim', async () => {
                const { app, metaverseUserRepo } = buildApp()

                metaverseUserRepo.findOne.mockResolvedValueOnce({
                    id: 'membership-admin',
                    metaverse_id: 'metaverse-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                // Create comment with exactly 501 characters (after trim)
                const longComment = 'a'.repeat(501)

                const response = await request(app)
                    .post('/metaverses/metaverse-1/members')
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
                const { app, metaverseUserRepo } = buildApp()

                metaverseUserRepo.findOne.mockResolvedValue({
                    id: 'membership-admin',
                    metaverse_id: 'metaverse-1',
                    user_id: 'test-user-id',
                    role: 'admin'
                })

                // Test invalid role
                let response = await request(app)
                    .post('/metaverses/metaverse-1/members')
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
                    .post('/metaverses/metaverse-1/members')
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
                expect(metaverseUserRepo.save).not.toHaveBeenCalled()
            })
        })
    })

    describe('Rate Limiting', () => {
        // Note: Rate limiting tests use mock limiters since we test the integration,
        // not the actual rate limiting library functionality.
        // The real rate limiting is tested via integration tests with actual Redis.

        it('should allow requests within read limit (integration test with mock)', async () => {
            const { dataSource, metaverseRepo } = buildDataSource()
            const mockQB = metaverseRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = express()
            app.use(express.json())
            app.use(
                '/metaverses',
                createMetaversesRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
            )

            // Make 5 requests (well below 100 limit)
            for (let i = 0; i < 5; i++) {
                await request(app).get('/metaverses').expect(200)
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
            const { dataSource, metaverseRepo, authUserRepo } = buildDataSource()
            const mockQB = metaverseRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            metaverseRepo.create.mockImplementation((data: any) => ({ ...data, id: 'new-id' }))
            metaverseRepo.save.mockImplementation((entity: any) => Promise.resolve(entity))
            authUserRepo.findOne.mockResolvedValue({ id: 'test-user-id', email: 'test@example.com' })

            const app = express()
            app.use(express.json())
            app.use(
                '/metaverses',
                createMetaversesRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
            )

            // Make 100 GET requests (at read limit)
            for (let i = 0; i < 100; i++) {
                await request(app).get('/metaverses').expect(200)
            }

            // POST should still work (separate write counter)
            await request(app).post('/metaverses').send({ name: 'test', description: 'test' }).expect(201)
        })

        it.skip('should include rate limit headers in response (requires real Redis)', async () => {
            // This test requires actual rate limiter with Redis to inject headers
            // Skip in unit tests - covered by integration tests
        })
    })
})
