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
import { createBranchesRoutes } from '../../domains/branches/routes/branchesRoutes'
import { MetahubBranchesService } from '../../domains/branches/services/MetahubBranchesService'

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
        app.use(
            '/',
            createBranchesRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
        )
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    afterEach(() => {
        jest.restoreAllMocks()
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
        metahubUserRepo.findOne.mockResolvedValue({ metahubId, userId: 'test-user-id', role: 'owner', activeBranchId })

        const app = buildApp(dataSource)

        const response = await request(app).get(`/metahub/${metahubId}/branches/options`).expect(200)

        expect(response.body.items).toHaveLength(2)
        expect(response.body.meta).toMatchObject({
            defaultBranchId,
            activeBranchId
        })
    })

    it('maps branch deletion lock contention to HTTP 409', async () => {
        const metahubUserRepo = createMockRepository<any>()
        const dataSource = createMockDataSource({
            MetahubUser: metahubUserRepo
        })

        const metahubId = 'metahub-1'
        const branchId = 'branch-1'
        metahubUserRepo.findOne.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            role: 'owner'
        })

        jest.spyOn(MetahubBranchesService.prototype, 'getBlockingUsers').mockResolvedValue([])
        jest.spyOn(MetahubBranchesService.prototype, 'deleteBranch').mockRejectedValue(new Error('Branch deletion in progress'))

        const app = buildApp(dataSource)
        const response = await request(app).delete(`/metahub/${metahubId}/branch/${branchId}`).expect(409)

        expect(response.body).toEqual({
            code: 'BRANCH_DELETION_IN_PROGRESS',
            error: 'Branch deletion in progress'
        })
    })

    it('returns 400 for incompatible branch copy options', async () => {
        const metahubUserRepo = createMockRepository<any>()
        const branchRepo = createMockRepository<any>()
        const dataSource = createMockDataSource({
            MetahubUser: metahubUserRepo,
            MetahubBranch: branchRepo
        })

        const metahubId = 'metahub-1'
        metahubUserRepo.findOne.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            role: 'owner'
        })
        branchRepo.createQueryBuilder().getOne.mockResolvedValue(null)

        jest.spyOn(MetahubBranchesService.prototype, 'createBranch').mockRejectedValue(new Error('BRANCH_COPY_ENUM_REFERENCES'))

        const app = buildApp(dataSource)

        const response = await request(app)
            .post(`/metahub/${metahubId}/branches`)
            .send({
                codename: 'copy-test',
                name: { en: 'Copy Test' },
                sourceBranchId: '00000000-0000-0000-0000-000000000001',
                fullCopy: false,
                copyCatalogs: true,
                copyEnumerations: false
            })
            .expect(400)

        expect(response.body).toEqual({
            code: 'BRANCH_COPY_ENUM_REFERENCES',
            error: 'Cannot disable enumerations copy while catalogs/hubs with enumeration references are copied'
        })
    })

    it('returns 400 for branch copy options that produce dangling references', async () => {
        const metahubUserRepo = createMockRepository<any>()
        const branchRepo = createMockRepository<any>()
        const dataSource = createMockDataSource({
            MetahubUser: metahubUserRepo,
            MetahubBranch: branchRepo
        })

        const metahubId = 'metahub-1'
        metahubUserRepo.findOne.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            role: 'owner'
        })
        branchRepo.createQueryBuilder().getOne.mockResolvedValue(null)

        jest.spyOn(MetahubBranchesService.prototype, 'createBranch').mockRejectedValue(new Error('BRANCH_COPY_DANGLING_REFERENCES'))

        const app = buildApp(dataSource)

        const response = await request(app)
            .post(`/metahub/${metahubId}/branches`)
            .send({
                codename: 'copy-test-2',
                name: { en: 'Copy Test 2' },
                sourceBranchId: '00000000-0000-0000-0000-000000000001',
                fullCopy: false,
                copyHubs: true,
                copyCatalogs: false
            })
            .expect(400)

        expect(response.body).toEqual({
            code: 'BRANCH_COPY_DANGLING_REFERENCES',
            error: 'Copy options would produce dangling object references. Keep all referenced object groups enabled.'
        })
    })

    it('maps structured branch-copy compatibility error code to deterministic 400 response', async () => {
        const metahubUserRepo = createMockRepository<any>()
        const branchRepo = createMockRepository<any>()
        const dataSource = createMockDataSource({
            MetahubUser: metahubUserRepo,
            MetahubBranch: branchRepo
        })

        const metahubId = 'metahub-1'
        metahubUserRepo.findOne.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            role: 'owner'
        })
        branchRepo.createQueryBuilder().getOne.mockResolvedValue(null)

        const structuredError = Object.assign(new Error('copy compatibility failed'), {
            code: 'BRANCH_COPY_DANGLING_REFERENCES'
        })
        jest.spyOn(MetahubBranchesService.prototype, 'createBranch').mockRejectedValue(structuredError)

        const app = buildApp(dataSource)

        const response = await request(app)
            .post(`/metahub/${metahubId}/branches`)
            .send({
                codename: 'copy-test-structured',
                name: { en: 'Copy Test Structured' },
                sourceBranchId: '00000000-0000-0000-0000-000000000001',
                fullCopy: false,
                copyHubs: true,
                copyCatalogs: false
            })
            .expect(400)

        expect(response.body).toEqual({
            code: 'BRANCH_COPY_DANGLING_REFERENCES',
            error: 'Copy options would produce dangling object references. Keep all referenced object groups enabled.'
        })
    })
})
