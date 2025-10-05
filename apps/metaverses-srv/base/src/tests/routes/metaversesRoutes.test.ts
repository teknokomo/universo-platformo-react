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

        const dataSource = createMockDataSource({
            Metaverse: metaverseRepo,
            MetaverseUser: metaverseUserRepo,
            Entity: entityRepo,
            EntityMetaverse: linkRepo,
            Section: sectionRepo,
            SectionMetaverse: sectionLinkRepo
        })

        return {
            dataSource,
            metaverseRepo,
            metaverseUserRepo,
            entityRepo,
            linkRepo,
            sectionRepo,
            sectionLinkRepo
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

            await request(app).get('/metaverses?limit=200&offset=-5&sortBy=invalid&sortOrder=invalid').expect(200)

            // Should clamp limit to max 100 and offset to min 0
            expect(mockQB.limit).toHaveBeenCalledWith(100)
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

            // Should use defaults: limit=20, offset=0, orderBy updatedAt DESC
            expect(mockQB.limit).toHaveBeenCalledWith(20)
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
    })
})
