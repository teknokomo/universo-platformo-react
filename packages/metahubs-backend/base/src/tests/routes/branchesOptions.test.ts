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

import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createMockDataSource, createMockRepository } from '../utils/typeormMocks'
import { createBranchesRoutes } from '../../domains/branches/routes/branchesRoutes'

describe('Branches Options Routes', () => {
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
        app.use('/', createBranchesRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('returns all branches without pagination', async () => {
        const branchRepo = createMockRepository<any>()
        const metahubRepo = createMockRepository<any>()
        const metahubUserRepo = createMockRepository<any>()

        const dataSource = createMockDataSource({
            MetahubBranch: branchRepo,
            Metahub: metahubRepo,
            MetahubUser: metahubUserRepo
        })

        const metahubId = 'metahub-1'
        const defaultBranchId = 'branch-default'
        const activeBranchId = 'branch-active'

        const qb = branchRepo.createQueryBuilder()
        qb.getMany.mockResolvedValue([
            {
                id: defaultBranchId,
                metahub_id: metahubId,
                codename: 'main',
                name: { locales: { en: { content: 'Main' } }, _primary: 'en', _schema: '1' },
                description: null,
                branch_number: 1,
                created_at: new Date('2026-01-01'),
                updated_at: new Date('2026-01-02')
            },
            {
                id: activeBranchId,
                metahub_id: metahubId,
                codename: 'dev',
                name: { locales: { en: { content: 'Dev' } }, _primary: 'en', _schema: '1' },
                description: null,
                branch_number: 2,
                created_at: new Date('2026-01-03'),
                updated_at: new Date('2026-01-04')
            }
        ])

        metahubRepo.findOne.mockResolvedValue({ id: metahubId, defaultBranchId })
        metahubUserRepo.findOne.mockResolvedValue({ metahub_id: metahubId, user_id: 'test-user-id', active_branch_id: activeBranchId })

        const app = buildApp(dataSource)

        const response = await request(app).get(`/metahub/${metahubId}/branches/options`).expect(200)

        expect(response.body.items).toHaveLength(2)
        expect(response.body.meta).toMatchObject({
            defaultBranchId,
            activeBranchId
        })
    })
})
