jest.mock('@universo/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createBranchesRoutes } from '../../domains/branches/routes/branchesRoutes'
import { MetahubBranchesService } from '../../domains/branches/services/MetahubBranchesService'

const mockEnsureMetahubAccess = jest.fn(async () => ({ membership: { role: 'owner' } }))
jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

const mockFindMetahubById = jest.fn()
const mockFindMetahubMembership = jest.fn()
const mockFindBranchByCodename = jest.fn(async () => null)

jest.mock('../../persistence', () => ({
    __esModule: true,
    findMetahubById: (...args: unknown[]) => mockFindMetahubById(...args),
    findMetahubForUpdate: jest.fn(async () => null),
    findMetahubMembership: (...args: unknown[]) => mockFindMetahubMembership(...args),
    updateMetahubFieldsRaw: jest.fn(async () => null),
    updateMetahubMember: jest.fn(async () => null),
    findBranchByIdAndMetahub: jest.fn(async () => null),
    findBranchByCodename: (...args: unknown[]) => mockFindBranchByCodename(...args),
    findBranchBySchemaName: jest.fn(async () => null),
    findBranchForUpdate: jest.fn(async () => null),
    findBranchesByMetahub: jest.fn(async () => []),
    createBranch: jest.fn(async () => ({})),
    updateBranch: jest.fn(async () => null),
    deleteBranchById: jest.fn(async () => undefined),
    getMaxBranchNumber: jest.fn(async () => 0),
    countMembersOnBranch: jest.fn(async () => 0),
    clearMemberActiveBranch: jest.fn(async () => undefined),
    findTemplateVersionById: jest.fn(async () => null)
}))

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

    const mockExec = {
        query: jest.fn(async () => []),
        transaction: jest.fn(async (cb: any) => cb({ query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false })),
        isReleased: () => false
    }

    const buildApp = () => {
        const app = express()
        app.use(express.json())
        app.use(
            '/',
            createBranchesRoutes(ensureAuth, () => mockExec as any, mockRateLimiter, mockRateLimiter)
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
        const metahubId = 'metahub-1'
        const defaultBranchId = 'branch-default'
        const activeBranchId = 'branch-active'

        // listAllBranches calls this.exec.query(SQL) directly
        mockExec.query.mockResolvedValueOnce([
            {
                id: defaultBranchId,
                metahubId,
                codename: 'main',
                name: { locales: { en: { content: 'Main' } }, _primary: 'en', _schema: '1' },
                description: null,
                branchNumber: 1,
                _uplCreatedAt: new Date('2026-01-01'),
                _uplUpdatedAt: new Date('2026-01-02')
            },
            {
                id: activeBranchId,
                metahubId,
                codename: 'dev',
                name: { locales: { en: { content: 'Dev' } }, _primary: 'en', _schema: '1' },
                description: null,
                branchNumber: 2,
                _uplCreatedAt: new Date('2026-01-03'),
                _uplUpdatedAt: new Date('2026-01-04')
            }
        ])
        // getDefaultBranchId calls findMetahubById
        mockFindMetahubById.mockResolvedValue({ id: metahubId, defaultBranchId })
        // getUserActiveBranchId calls findMetahubMembership
        mockFindMetahubMembership.mockResolvedValue({ metahubId, userId: 'test-user-id', role: 'owner', activeBranchId })

        const app = buildApp()

        const response = await request(app).get(`/metahub/${metahubId}/branches/options`).expect(200)

        expect(response.body.items).toHaveLength(2)
        expect(response.body.meta).toMatchObject({
            defaultBranchId,
            activeBranchId
        })
    })

    it('maps branch deletion lock contention to HTTP 409', async () => {
        const metahubId = 'metahub-1'
        const branchId = 'branch-1'

        jest.spyOn(MetahubBranchesService.prototype, 'getBlockingUsers').mockResolvedValue([])
        jest.spyOn(MetahubBranchesService.prototype, 'deleteBranch').mockRejectedValue(new Error('Branch deletion in progress'))

        const app = buildApp()
        const response = await request(app).delete(`/metahub/${metahubId}/branch/${branchId}`).expect(409)

        expect(response.body).toEqual({
            code: 'BRANCH_DELETION_IN_PROGRESS',
            error: 'Branch deletion in progress'
        })
    })

    it('returns 400 for incompatible branch copy options', async () => {
        const metahubId = 'metahub-1'

        jest.spyOn(MetahubBranchesService.prototype, 'createBranch').mockRejectedValue(new Error('BRANCH_COPY_ENUM_REFERENCES'))

        const app = buildApp()

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
        const metahubId = 'metahub-1'

        jest.spyOn(MetahubBranchesService.prototype, 'createBranch').mockRejectedValue(new Error('BRANCH_COPY_DANGLING_REFERENCES'))

        const app = buildApp()

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
        const metahubId = 'metahub-1'

        const structuredError = Object.assign(new Error('copy compatibility failed'), {
            code: 'BRANCH_COPY_DANGLING_REFERENCES'
        })
        jest.spyOn(MetahubBranchesService.prototype, 'createBranch').mockRejectedValue(structuredError)

        const app = buildApp()

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
