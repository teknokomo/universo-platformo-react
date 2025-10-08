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
            Index: decorator
        }
    },
    { virtual: true }
)

import type { Request, Response, NextFunction } from 'express'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')
import { createMockDataSource, createMockRepository } from '../utils/typeormMocks'
import { createMetaversesRoutes } from '../../routes/metaversesRoutes'

describe('Metaverses Routes', () => {
    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as any).user = { id: 'test-user-id' }
        next()
    }

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
                createMetaversesRoutes(ensureAuth, () => dataSource)
            )

            const response = await request(app).get('/metaverses').expect(200)

            expect(Array.isArray(response.body)).toBe(true)
            expect(response.body).toHaveLength(0)
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
                    entitiesCount: '5'
                }
            ]

            const mockQB = metaverseRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue(mockMetaverses)

            const app = express()
            app.use(express.json())
            app.use(
                '/metaverses',
                createMetaversesRoutes(ensureAuth, () => dataSource)
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
        })

        it('should handle pagination parameters correctly', async () => {
            const { dataSource, metaverseRepo } = buildDataSource()

            const mockQB = metaverseRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = express()
            app.use(express.json())
            app.use(
                '/metaverses',
                createMetaversesRoutes(ensureAuth, () => dataSource)
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
                createMetaversesRoutes(ensureAuth, () => dataSource)
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
                createMetaversesRoutes(ensureAuth, () => dataSource)
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
                createMetaversesRoutes(noAuthMiddleware, () => dataSource)
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
                createMetaversesRoutes(ensureAuth, () => dataSource)
            )

            const response = await request(app).get('/metaverses').expect(500)

            expect(response.body).toMatchObject({
                error: 'Internal server error',
                details: 'Database connection failed'
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
                    entitiesCount: '5'
                }
            ]

            const mockQB = metaverseRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue(mockMetaverses)

            const app = express()
            app.use(express.json())
            app.use(
                '/metaverses',
                createMetaversesRoutes(ensureAuth, () => dataSource)
            )

            await request(app)
                .get('/metaverses?limit=50&offset=25')
                .expect(200)
                .expect((res) => {
                    expect(res.headers['x-pagination-limit']).toBe('50')
                    expect(res.headers['x-pagination-offset']).toBe('25')
                    expect(res.headers['x-pagination-count']).toBe('1')
                    expect(res.headers['x-pagination-has-more']).toBe('false')
                })
        })
    })

    describe('Members management endpoints', () => {
        const buildApp = () => {
            const context = buildDataSource()
            const app = express()
            app.use(express.json())
            app.use('/metaverses', createMetaversesRoutes(ensureAuth, () => context.dataSource))
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

            await request(app)
                .post('/metaverses/metaverse-1/members')
                .send({ email: 'target@example.com', role: 'member' })
                .expect(403)

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
            expect(metaverseUserRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'membership-target', role: 'editor' })
            )
        })

        it('should forbid updating member without permission', async () => {
            const { app, metaverseUserRepo } = buildApp()

            metaverseUserRepo.findOne.mockResolvedValueOnce({
                id: 'membership-member',
                metaverse_id: 'metaverse-1',
                user_id: 'test-user-id',
                role: 'member'
            })

            await request(app)
                .patch('/metaverses/metaverse-1/members/membership-target')
                .send({ role: 'editor' })
                .expect(403)
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
            expect(metaverseUserRepo.remove).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'membership-target' })
            )
        })

        it('should reject deleting member without permission', async () => {
            const { app, metaverseUserRepo } = buildApp()

            metaverseUserRepo.findOne.mockResolvedValueOnce({
                id: 'membership-member',
                metaverse_id: 'metaverse-1',
                user_id: 'test-user-id',
                role: 'member'
            })

            await request(app)
                .delete('/metaverses/metaverse-1/members/membership-target')
                .expect(403)
        })
    })
})
