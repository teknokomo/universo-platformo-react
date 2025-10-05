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
import { createClustersRoutes } from '../../routes/clustersRoutes'

describe('Clusters Routes', () => {
    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as any).user = { id: 'test-user-id' }
        next()
    }

    const buildDataSource = () => {
        const clusterRepo = createMockRepository<any>()
        const clusterUserRepo = createMockRepository<any>()
        const resourceRepo = createMockRepository<any>()
        const linkRepo = createMockRepository<any>()
        const domainRepo = createMockRepository<any>()
        const domainLinkRepo = createMockRepository<any>()

        const dataSource = createMockDataSource({
            Cluster: clusterRepo,
            ClusterUser: clusterUserRepo,
            Resource: resourceRepo,
            ResourceCluster: linkRepo,
            Domain: domainRepo,
            DomainCluster: domainLinkRepo
        })

        return {
            dataSource,
            clusterRepo,
            clusterUserRepo,
            resourceRepo,
            linkRepo,
            domainRepo,
            domainLinkRepo
        }
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('GET /clusters', () => {
        it('should return empty array for user with no clusters', async () => {
            const { dataSource, clusterRepo } = buildDataSource()

            // Mock QueryBuilder to return empty array
            const mockQB = clusterRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = express()
            app.use(express.json())
            app.use(
                '/clusters',
                createClustersRoutes(ensureAuth, () => dataSource)
            )

            const response = await request(app).get('/clusters').expect(200)

            expect(Array.isArray(response.body)).toBe(true)
            expect(response.body).toHaveLength(0)
        })

        it('should return clusters with counts for authenticated user', async () => {
            const { dataSource, clusterRepo } = buildDataSource()

            const mockClusters = [
                {
                    id: 'cluster-1',
                    name: 'Test Cluster',
                    description: 'Test Description',
                    created_at: new Date('2025-01-01'),
                    updated_at: new Date('2025-01-02'),
                    domainsCount: '2',
                    resourcesCount: '5'
                }
            ]

            const mockQB = clusterRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue(mockClusters)

            const app = express()
            app.use(express.json())
            app.use(
                '/clusters',
                createClustersRoutes(ensureAuth, () => dataSource)
            )

            const response = await request(app).get('/clusters').expect(200)

            expect(response.body).toHaveLength(1)
            expect(response.body[0]).toMatchObject({
                id: 'cluster-1',
                name: 'Test Cluster',
                description: 'Test Description',
                domainsCount: 2,
                resourcesCount: 5
            })
            expect(response.body[0]).toHaveProperty('createdAt')
            expect(response.body[0]).toHaveProperty('updatedAt')
        })

        it('should handle pagination parameters correctly', async () => {
            const { dataSource, clusterRepo } = buildDataSource()

            const mockQB = clusterRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = express()
            app.use(express.json())
            app.use(
                '/clusters',
                createClustersRoutes(ensureAuth, () => dataSource)
            )

            await request(app).get('/clusters?limit=5&offset=10&sortBy=name&sortOrder=asc').expect(200)

            expect(mockQB.limit).toHaveBeenCalledWith(5)
            expect(mockQB.offset).toHaveBeenCalledWith(10)
            expect(mockQB.orderBy).toHaveBeenCalledWith('c.name', 'ASC')
        })

        it('should validate and clamp pagination parameters', async () => {
            const { dataSource, clusterRepo } = buildDataSource()

            const mockQB = clusterRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = express()
            app.use(express.json())
            app.use(
                '/clusters',
                createClustersRoutes(ensureAuth, () => dataSource)
            )

            await request(app).get('/clusters?limit=2000&offset=-5&sortBy=invalid&sortOrder=invalid').expect(200)

            // Should clamp limit to max 1000 and offset to min 0
            expect(mockQB.limit).toHaveBeenCalledWith(1000)
            expect(mockQB.offset).toHaveBeenCalledWith(0)
            // Should default to updated desc for invalid sortBy/sortOrder
            expect(mockQB.orderBy).toHaveBeenCalledWith('c.updatedAt', 'DESC')
        })

        it('should use default pagination when no parameters provided', async () => {
            const { dataSource, clusterRepo } = buildDataSource()

            const mockQB = clusterRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue([])

            const app = express()
            app.use(express.json())
            app.use(
                '/clusters',
                createClustersRoutes(ensureAuth, () => dataSource)
            )

            await request(app).get('/clusters').expect(200)

            expect(mockQB.limit).toHaveBeenCalledWith(100)
            expect(mockQB.offset).toHaveBeenCalledWith(0)
            expect(mockQB.orderBy).toHaveBeenCalledWith('c.updatedAt', 'DESC')
        })

        it('should return 401 when user is not authenticated', async () => {
            const { dataSource } = buildDataSource()
            const noAuth = (_req: Request, _res: Response, next: NextFunction) => {
                // Don't set req.user to simulate unauthenticated request
                next()
            }

            const app = express()
            app.use(express.json())
            app.use(
                '/clusters',
                createClustersRoutes(noAuth, () => dataSource)
            )

            await request(app)
                .get('/clusters')
                .expect(401)
                .expect((res) => {
                    expect(res.body.error).toBe('User not authenticated')
                })
        })

        it('should handle database errors gracefully', async () => {
            const { dataSource, clusterRepo } = buildDataSource()

            const mockQB = clusterRepo.createQueryBuilder()
            mockQB.getRawMany.mockRejectedValue(new Error('Database connection failed'))

            const app = express()
            app.use(express.json())
            app.use(
                '/clusters',
                createClustersRoutes(ensureAuth, () => dataSource)
            )

            await request(app)
                .get('/clusters')
                .expect(500)
                .expect((res) => {
                    expect(res.body.error).toBe('Internal server error')
                    expect(res.body.details).toBe('Database connection failed')
                })
        })

        it('should set correct pagination headers', async () => {
            const { dataSource, clusterRepo } = buildDataSource()

            const mockClusters = [
                {
                    id: 'cluster-1',
                    name: 'Test Cluster',
                    description: 'Test Description',
                    created_at: new Date('2025-01-01'),
                    updated_at: new Date('2025-01-02'),
                    domainsCount: '2',
                    resourcesCount: '5'
                }
            ]

            const mockQB = clusterRepo.createQueryBuilder()
            mockQB.getRawMany.mockResolvedValue(mockClusters)

            const app = express()
            app.use(express.json())
            app.use(
                '/clusters',
                createClustersRoutes(ensureAuth, () => dataSource)
            )

            await request(app)
                .get('/clusters?limit=50&offset=25')
                .expect(200)
                .expect((res) => {
                    expect(res.headers['x-pagination-limit']).toBe('50')
                    expect(res.headers['x-pagination-offset']).toBe('25')
                    expect(res.headers['x-pagination-count']).toBe('1')
                    expect(res.headers['x-pagination-has-more']).toBe('false')
                })
        })
    })
})
