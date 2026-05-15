import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { SHARED_OBJECT_KINDS } from '@universo/types'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

const mockResolveUserId = jest.fn<() => string | undefined>()
const mockEnsureMetahubAccess = jest.fn()
const mockFindAllContainerObjectIds = jest.fn()
const mockResolveAllContainerObjectIds = jest.fn()
const mockFindBySharedEntity = jest.fn()
const mockFindByTargetObject = jest.fn()
const mockUpsertOverride = jest.fn()
const mockClearOverride = jest.fn()

const mockDbSession = { isReleased: () => false }

jest.mock('../../utils', () => ({
    __esModule: true,
    getRequestDbExecutor: (_req: unknown, fallback: unknown) => fallback
}))

jest.mock('@universo/utils/database', () => ({
    __esModule: true,
    getRequestDbSession: () => mockDbSession
}))

jest.mock('../../domains/shared/routeAuth', () => ({
    __esModule: true,
    resolveUserId: (...args: unknown[]) => mockResolveUserId(...args)
}))

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/shared/services/SharedContainerService', () => ({
    __esModule: true,
    SharedContainerService: jest.fn().mockImplementation(() => ({
        findAllContainerObjectIds: (...args: unknown[]) => mockFindAllContainerObjectIds(...args),
        resolveAllContainerObjectIds: (...args: unknown[]) => mockResolveAllContainerObjectIds(...args)
    }))
}))

jest.mock('../../domains/shared/services/SharedEntityOverridesService', () => ({
    __esModule: true,
    SharedEntityOverridesService: jest.fn().mockImplementation(() => ({
        findBySharedEntity: (...args: unknown[]) => mockFindBySharedEntity(...args),
        findByTargetObject: (...args: unknown[]) => mockFindByTargetObject(...args),
        upsertOverride: (...args: unknown[]) => mockUpsertOverride(...args),
        clearOverride: (...args: unknown[]) => mockClearOverride(...args)
    }))
}))

import { createSharedEntityOverridesRoutes } from '../../domains/shared/routes/sharedEntityOverridesRoutes'

const attributeEntityId = '00000000-0000-0000-0000-000000000001'
const targetObjectId = '00000000-0000-0000-0000-000000000002'

const createOverrideRecord = (overrides: Record<string, unknown> = {}) => ({
    id: 'override-1',
    entityKind: 'component',
    sharedEntityId: attributeEntityId,
    targetObjectId,
    isExcluded: false,
    isActive: true,
    sortOrder: 10,
    ...overrides
})

describe('Shared Entity Override Routes', () => {
    const ensureAuth = (_req: Request, _res: Response, next: NextFunction) => next()
    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    const mockExec = {
        query: jest.fn(),
        transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(mockExec)),
        isReleased: jest.fn(() => false)
    }

    const buildApp = () => {
        const app = express()
        app.use(express.json())
        app.use(
            '/',
            createSharedEntityOverridesRoutes(ensureAuth, () => mockExec as never, mockRateLimiter, mockRateLimiter)
        )
        app.use((error: Error & { statusCode?: number; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
            res.status(error.statusCode || error.status || 500).json({ error: error.message })
        })
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveUserId.mockReturnValue('user-1')
        mockEnsureMetahubAccess.mockResolvedValue({
            membership: { role: 'owner' },
            entityId: 'metahub-1',
            metahubId: 'metahub-1',
            isSynthetic: false
        })
        mockFindAllContainerObjectIds.mockResolvedValue({
            [SHARED_OBJECT_KINDS.SHARED_OBJECT_POOL]: '00000000-0000-0000-0000-000000000011',
            [SHARED_OBJECT_KINDS.SHARED_SET_POOL]: '00000000-0000-0000-0000-000000000012'
        })
        mockResolveAllContainerObjectIds.mockResolvedValue({
            [SHARED_OBJECT_KINDS.SHARED_OBJECT_POOL]: '00000000-0000-0000-0000-000000000011',
            [SHARED_OBJECT_KINDS.SHARED_SET_POOL]: '00000000-0000-0000-0000-000000000012',
            [SHARED_OBJECT_KINDS.SHARED_ENUM_POOL]: '00000000-0000-0000-0000-000000000013'
        })
        mockFindBySharedEntity.mockResolvedValue([createOverrideRecord()])
        mockFindByTargetObject.mockResolvedValue([createOverrideRecord()])
        mockUpsertOverride.mockResolvedValue(createOverrideRecord({ isExcluded: true }))
        mockClearOverride.mockResolvedValue(undefined)
    })

    it('lists only existing shared containers through the read-only manageMetahub route guard', async () => {
        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/shared-containers').expect(200)

        expect(response.body.items).toEqual([
            { kind: SHARED_OBJECT_KINDS.SHARED_OBJECT_POOL, objectId: '00000000-0000-0000-0000-000000000011' },
            { kind: SHARED_OBJECT_KINDS.SHARED_SET_POOL, objectId: '00000000-0000-0000-0000-000000000012' }
        ])
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
        expect(mockFindAllContainerObjectIds).toHaveBeenCalledWith('metahub-1', 'user-1')
        expect(mockResolveAllContainerObjectIds).not.toHaveBeenCalled()
    })

    it('ensures shared containers through the explicit write route surface', async () => {
        const app = buildApp()

        const response = await request(app).post('/metahub/metahub-1/shared-containers/ensure').expect(200)

        expect(response.body.items).toEqual([
            { kind: SHARED_OBJECT_KINDS.SHARED_OBJECT_POOL, objectId: '00000000-0000-0000-0000-000000000011' },
            { kind: SHARED_OBJECT_KINDS.SHARED_SET_POOL, objectId: '00000000-0000-0000-0000-000000000012' },
            { kind: SHARED_OBJECT_KINDS.SHARED_ENUM_POOL, objectId: '00000000-0000-0000-0000-000000000013' }
        ])
        expect(mockResolveAllContainerObjectIds).toHaveBeenCalledWith('metahub-1', 'user-1')
    })

    it('rejects shared override list queries without exactly one filter', async () => {
        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/shared-entity-overrides?entityKind=component').expect(400)

        expect(response.body.error).toBe('Invalid query')
        expect(mockFindBySharedEntity).not.toHaveBeenCalled()
        expect(mockFindByTargetObject).not.toHaveBeenCalled()
    })

    it('lists shared overrides by shared entity when the query is valid', async () => {
        const app = buildApp()

        const response = await request(app)
            .get(`/metahub/metahub-1/shared-entity-overrides?entityKind=component&sharedEntityId=${attributeEntityId}`)
            .expect(200)

        expect(response.body.items).toHaveLength(1)
        expect(mockFindBySharedEntity).toHaveBeenCalledWith('metahub-1', 'component', attributeEntityId, 'user-1')
        expect(mockFindByTargetObject).not.toHaveBeenCalled()
    })

    it('rejects shared override patch payloads with no override fields', async () => {
        const app = buildApp()

        const response = await request(app)
            .patch('/metahub/metahub-1/shared-entity-overrides')
            .send({
                entityKind: 'component',
                sharedEntityId: attributeEntityId,
                targetObjectId
            })
            .expect(400)

        expect(response.body.error).toBe('Invalid input')
        expect(mockUpsertOverride).not.toHaveBeenCalled()
    })

    it('returns 403 when manageMetahub access is denied for override writes', async () => {
        mockEnsureMetahubAccess.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { statusCode: 403 }))
        const app = buildApp()

        const response = await request(app)
            .patch('/metahub/metahub-1/shared-entity-overrides')
            .send({
                entityKind: 'component',
                sharedEntityId: attributeEntityId,
                targetObjectId,
                isExcluded: true
            })
            .expect(403)

        expect(response.body).toEqual({ error: 'Forbidden' })
        expect(mockUpsertOverride).not.toHaveBeenCalled()
    })

    it('clears overrides through the guarded delete route surface', async () => {
        const app = buildApp()

        await request(app)
            .delete(
                `/metahub/metahub-1/shared-entity-overrides?entityKind=component&sharedEntityId=${attributeEntityId}&targetObjectId=${targetObjectId}`
            )
            .expect(204)

        expect(mockClearOverride).toHaveBeenCalledWith('metahub-1', 'component', attributeEntityId, targetObjectId, 'user-1')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
    })
})
