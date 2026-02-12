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
            OneToOne: decorator,
            ManyToMany: decorator,
            JoinTable: decorator,
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
import { createMetahubsRoutes } from '../../domains/metahubs/routes/metahubsRoutes'

describe('Metahub Board Summary', () => {
    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as any).user = { id: 'test-user-id' }
        next()
    }

    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
        if (res.headersSent) {
            return _next(err)
        }
        const statusCode = err.statusCode || err.status || 500
        const message = err.message || 'Internal Server Error'
        res.status(statusCode).json({ error: message })
    }

    const buildApp = (dataSource: any) => {
        const app = express()
        app.use(express.json())
        app.use(
            '/',
            createMetahubsRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
        )
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('returns aggregated counts for metahub board', async () => {
        const metahubRepo = createMockRepository<any>()
        const metahubUserRepo = createMockRepository<any>()
        const branchRepo = createMockRepository<any>()
        const publicationRepo = createMockRepository<any>()
        const authUserRepo = createMockRepository<any>()

        const dataSource = createMockDataSource({
            Metahub: metahubRepo,
            MetahubUser: metahubUserRepo,
            MetahubBranch: branchRepo,
            Publication: publicationRepo,
            AuthUser: authUserRepo
        })

        const metahubId = 'metahub-1'
        const branchId = 'branch-1'

        metahubRepo.findOne.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId
        })

        metahubUserRepo.findOne.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            role: 'owner',
            activeBranchId: branchId
        })

        branchRepo.findOne.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName: 'mhb_abcdef_b1'
        })

        branchRepo.count.mockResolvedValue(3)
        publicationRepo.count.mockResolvedValue(2)
        metahubUserRepo.count.mockResolvedValue(5)

        dataSource.manager.query = jest.fn(async (sql: string) => {
            if (sql.includes('_mhb_objects') && sql.includes("kind = 'hub'")) {
                return [{ count: 2 }]
            }
            if (sql.includes('_mhb_objects') && sql.includes("kind = 'catalog'")) {
                return [{ count: 4 }]
            }
            if (sql.includes('FROM metahubs.publications_versions')) {
                return [{ count: 7 }]
            }
            if (sql.includes('FROM applications.applications')) {
                return [{ count: 1 }]
            }
            return [{ count: 0 }]
        })

        const app = buildApp(dataSource)

        const response = await request(app).get(`/metahub/${metahubId}/board/summary`).expect(200)

        expect(response.body).toMatchObject({
            metahubId,
            activeBranchId: branchId,
            branchesCount: 3,
            hubsCount: 2,
            catalogsCount: 4,
            membersCount: 5,
            publicationsCount: 2,
            publicationVersionsCount: 7,
            applicationsCount: 1
        })
    })
})
