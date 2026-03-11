jest.mock('@universo/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: jest.fn(async () => {}),
    ROLE_PERMISSIONS: {},
    assertNotOwner: jest.fn(),
    MetahubRole: {}
}))

const mockFindMetahubById = jest.fn()
const mockFindMetahubMembership = jest.fn()
const mockFindBranchByIdAndMetahub = jest.fn()
const mockCountBranches = jest.fn()
const mockCountMetahubMembers = jest.fn()

jest.mock('../../persistence', () => ({
    __esModule: true,
    findMetahubById: (...args: any[]) => mockFindMetahubById(...args),
    findMetahubMembership: (...args: any[]) => mockFindMetahubMembership(...args),
    findBranchByIdAndMetahub: (...args: any[]) => mockFindBranchByIdAndMetahub(...args),
    countBranches: (...args: any[]) => mockCountBranches(...args),
    countMetahubMembers: (...args: any[]) => mockCountMetahubMembers(...args),
    findMetahubByCodename: jest.fn(async () => null),
    findMetahubBySlug: jest.fn(async () => null),
    findMetahubForUpdate: jest.fn(async () => null),
    listMetahubs: jest.fn(async () => ({ rows: [], total: 0 })),
    createMetahub: jest.fn(async () => ({})),
    updateMetahub: jest.fn(async () => ({})),
    findMetahubMemberById: jest.fn(async () => null),
    listMetahubMembers: jest.fn(async () => []),
    addMetahubMember: jest.fn(async () => ({})),
    updateMetahubMember: jest.fn(async () => ({})),
    removeMetahubMember: jest.fn(async () => {}),
    findBranchesByMetahub: jest.fn(async () => []),
    createBranch: jest.fn(async () => ({})),
    findTemplateByIdNotDeleted: jest.fn(async () => null),
    findTemplateByCodename: jest.fn(async () => null),
    softDelete: jest.fn(async () => true)
}))

import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

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

    let mockExec: any

    const buildApp = () => {
        const app = express()
        app.use(express.json())
        app.use(
            '/',
            createMetahubsRoutes(ensureAuth, () => mockExec as any, mockRateLimiter, mockRateLimiter)
        )
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockExec = {
            query: jest.fn(async () => []),
            transaction: jest.fn(async (cb: any) =>
                cb({ query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false })
            ),
            isReleased: () => false
        }
    })

    it('returns aggregated counts for metahub board', async () => {
        const metahubId = 'metahub-1'
        const branchId = 'branch-1'

        mockFindMetahubById.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId
        })

        mockFindMetahubMembership.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            role: 'owner',
            activeBranchId: branchId
        })

        mockFindBranchByIdAndMetahub.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName: 'mhb_abcdef_b1'
        })

        mockCountBranches.mockResolvedValue(3)
        mockCountMetahubMembers.mockResolvedValue(5)

        mockExec.query.mockImplementation(async (sql: string) => {
            if (sql.includes('_mhb_objects') && sql.includes("kind = 'hub'")) {
                return [{ count: 2 }]
            }
            if (sql.includes('_mhb_objects') && sql.includes("kind = 'catalog'")) {
                return [{ count: 4 }]
            }
            if (sql.includes('publications_versions')) {
                return [{ count: 7 }]
            }
            if (sql.includes('applications.applications')) {
                return [{ count: 1 }]
            }
            if (sql.includes('metahubs.publications')) {
                return [{ count: 2 }]
            }
            return [{ count: 0 }]
        })

        const app = buildApp()

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
