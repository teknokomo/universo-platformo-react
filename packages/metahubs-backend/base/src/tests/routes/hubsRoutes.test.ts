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

import { createHubsRoutes } from '../../domains/hubs/routes/hubsRoutes'
import { testCodenameVlc } from '../utils/codenameTestHelpers'

const mockFindMetahubById = jest.fn(async () => ({ id: 'metahub-1' }))

jest.mock('../../persistence', () => ({
    __esModule: true,
    findMetahubById: (...args: unknown[]) => mockFindMetahubById(...args)
}))

const mockEnsureMetahubAccess = jest.fn()
const mockEnsureSchema = jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args),
    createEnsureMetahubRouteAccess: () => async (req: any, res: any, metahubId: string, permission?: string) => {
        const user = (req as any).user
        const userId = user?.id ?? user?.sub ?? user?.user_id ?? user?.userId
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' })
            return null
        }
        await mockEnsureMetahubAccess({}, userId, metahubId, permission)
        return userId
    }
}))

jest.mock('../../domains/ddl', () => ({
    __esModule: true
}))

const mockHubsService = {
    findById: jest.fn(),
    findAll: jest.fn(),
    findByCodename: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
}

const mockObjectsService = {
    reorderByKind: jest.fn()
}

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn().mockImplementation(() => ({
        ensureSchema: (...args: unknown[]) => mockEnsureSchema(...args)
    }))
}))

jest.mock('../../domains/metahubs/services/MetahubObjectsService', () => ({
    __esModule: true,
    MetahubObjectsService: jest.fn().mockImplementation(() => mockObjectsService)
}))

jest.mock('../../domains/metahubs/services/MetahubHubsService', () => ({
    __esModule: true,
    MetahubHubsService: jest.fn().mockImplementation(() => mockHubsService)
}))

const mockSettingsService = {
    findByKey: jest.fn(async (_metahubId: string, key: string) => {
        const values: Record<string, unknown> = {
            'general.codenameStyle': 'pascal-case',
            'general.codenameAlphabet': 'en-ru',
            'general.codenameAllowMixedAlphabets': false,
            'hubs.allowCopy': true,
            'hubs.allowDelete': true
        }
        return key in values ? { key, value: { _value: values[key] } } : null
    }),
    findAll: jest.fn(async () => [])
}

jest.mock('../../domains/settings/services/MetahubSettingsService', () => ({
    __esModule: true,
    MetahubSettingsService: jest.fn().mockImplementation(() => mockSettingsService)
}))

const createCopyTransactionTrx = (params?: {
    relationRows?: Array<Record<string, unknown>>
    relationUpdateRows?: Array<Record<string, unknown>>
}) => {
    const queryMock = jest.fn().mockResolvedValue([])
    const relationRows = params?.relationRows ?? []
    const relationUpdateRows = params?.relationUpdateRows ?? [{ id: 'related-1' }]

    if (relationRows.length > 0) {
        queryMock.mockResolvedValueOnce(relationRows)
        const eligible = relationRows.filter((r) => {
            const config = r.config as Record<string, unknown> | undefined
            return config?.isSingleHub !== true
        })
        for (let i = 0; i < eligible.length; i++) {
            queryMock.mockResolvedValueOnce(relationUpdateRows)
        }
    }

    return { query: queryMock }
}

const defaultCopiedHub = {
    id: 'hub-copy-id',
    codename: 'MainHubCopy',
    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Main hub (copy)' } } },
    description: null,
    sort_order: 4,
    parent_hub_id: null,
    _upl_version: 1,
    created_at: '2026-02-26T00:00:00.000Z',
    updated_at: '2026-02-26T00:00:00.000Z'
}

describe('Hubs Routes', () => {
    const mockExec = {
        query: jest.fn(async () => []),
        transaction: jest.fn(async (cb: any) => cb({ query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false })),
        isReleased: () => false
    }

    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as unknown as { user?: { id: string } }).user = { id: 'test-user-id' }
        next()
    }

    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    const errorHandler = (err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, next: NextFunction) => {
        if (res.headersSent) {
            return next(err)
        }
        const statusCode = err.statusCode || err.status || 500
        res.status(statusCode).json({ error: err.message || 'Internal Server Error' })
    }

    const buildApp = () => {
        const app = express()
        app.use(express.json())
        app.use(createHubsRoutes(ensureAuth, () => mockExec as any, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockFindMetahubById.mockResolvedValue({ id: 'metahub-1' })
        mockEnsureMetahubAccess.mockResolvedValue({ metahubId: 'metahub-1' })
        mockHubsService.findById.mockResolvedValue(null)
        mockHubsService.create.mockResolvedValue({
            id: 'hub-copy-id',
            codename: 'MainHubCopy',
            name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Main hub (copy)' } } },
            description: null,
            sort_order: 4,
            parent_hub_id: null,
            _upl_version: 1,
            created_at: '2026-02-26T00:00:00.000Z',
            updated_at: '2026-02-26T00:00:00.000Z'
        })
        mockObjectsService.reorderByKind.mockResolvedValue({
            id: '11111111-1111-4111-8111-111111111111',
            config: { sortOrder: 2 }
        })
        mockEnsureSchema.mockResolvedValue('mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
    })

    describe('PATCH /metahub/:metahubId/hubs/reorder', () => {
        it('reorders hub and returns updated sort order', async () => {
            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/hubs/reorder')
                .send({
                    hubId: '11111111-1111-4111-8111-111111111111',
                    newSortOrder: 2
                })
                .expect(200)

            expect(response.body).toEqual({
                id: '11111111-1111-4111-8111-111111111111',
                sortOrder: 2
            })
            expect(mockObjectsService.reorderByKind).toHaveBeenCalledWith(
                'metahub-1',
                'hub',
                '11111111-1111-4111-8111-111111111111',
                2,
                'test-user-id'
            )
        })

        it('returns 404 when hub is not found', async () => {
            mockObjectsService.reorderByKind.mockRejectedValueOnce(new Error('hub not found'))

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/hubs/reorder')
                .send({
                    hubId: '11111111-1111-4111-8111-111111111111',
                    newSortOrder: 2
                })
                .expect(404)

            expect(response.body.error).toBe('Hub not found')
        })

        it('returns 400 for invalid payload', async () => {
            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/hubs/reorder')
                .send({
                    hubId: 'invalid-id',
                    newSortOrder: 0
                })
                .expect(400)

            expect(response.body.error).toBe('Validation failed')
            expect(mockObjectsService.reorderByKind).not.toHaveBeenCalled()
        })
    })

    describe('POST /metahub/:metahubId/hub/:hubId/copy', () => {
        it('returns 404 when metahub does not exist', async () => {
            mockFindMetahubById.mockResolvedValueOnce(null)

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/missing/hub/hub-1/copy')
                .send({ codename: testCodenameVlc('hub-copy') })
                .expect(404)

            expect(response.body.error).toBe('Metahub not found')
            expect(mockEnsureMetahubAccess).not.toHaveBeenCalled()
        })

        it('returns 403 when metahub access check fails', async () => {
            const forbidden = Object.assign(new Error('Access denied to this metahub'), { status: 403 })
            mockEnsureMetahubAccess.mockRejectedValueOnce(forbidden)

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/hub/hub-1/copy')
                .send({ codename: testCodenameVlc('hub-copy') })
                .expect(403)

            expect(response.body.error).toBe('Access denied to this metahub')
            expect(mockHubsService.findById).not.toHaveBeenCalled()
        })

        it('skips single-hub relation entities during relation propagation', async () => {
            mockHubsService.findById.mockResolvedValueOnce({
                id: 'hub-1',
                codename: 'main-hub',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Main hub' } } },
                description: null,
                sort_order: 3
            })

            mockHubsService.create.mockResolvedValueOnce(defaultCopiedHub)
            const trx = createCopyTransactionTrx({
                relationRows: [{ id: 'catalog-1', kind: 'catalog', config: { hubs: ['hub-1'], isSingleHub: true }, _upl_version: 1 }]
            })
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/hub/hub-1/copy')
                .send({ codename: testCodenameVlc('main-hub-copy') })
                .expect(201)

            expect(response.body.id).toBe('hub-copy-id')
            expect(trx.query).toHaveBeenCalledTimes(1)
        })

        it('copies hub successfully when copyAllRelations is disabled', async () => {
            mockHubsService.findById.mockResolvedValueOnce({
                id: 'hub-1',
                codename: 'main-hub',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Main hub' } } },
                description: null,
                sort_order: 3
            })

            mockHubsService.create.mockResolvedValueOnce(defaultCopiedHub)
            const trx = createCopyTransactionTrx()
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/hub/hub-1/copy')
                .send({
                    codename: testCodenameVlc('main-hub-copy'),
                    copyAllRelations: false
                })
                .expect(201)

            expect(mockEnsureSchema).toHaveBeenCalledWith('metahub-1', 'test-user-id')
            expect(response.body.id).toBe('hub-copy-id')
            expect(response.body.codename).toBe('MainHubCopy')
            expect(response.body.sortOrder).toBe(4)
            expect(mockHubsService.create).toHaveBeenCalled()
        })

        it('retries hub copy after concurrent relation update conflict and succeeds', async () => {
            mockHubsService.findById.mockResolvedValue({
                id: 'hub-1',
                codename: 'main-hub',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Main hub' } } },
                description: null,
                sort_order: 3
            })

            mockHubsService.create.mockResolvedValue(defaultCopiedHub)
            const trxConflict = createCopyTransactionTrx({
                relationRows: [{ id: 'catalog-1', kind: 'catalog', config: { hubs: ['hub-1'] }, _upl_version: 1 }],
                relationUpdateRows: []
            })
            const trxSuccess = createCopyTransactionTrx({ relationRows: [] })

            ;(mockExec.transaction as jest.Mock)
                .mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(trxConflict))
                .mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(trxSuccess))

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/hub/hub-1/copy')
                .send({ codename: testCodenameVlc('main-hub-copy') })
                .expect(201)

            expect(response.body.id).toBe('hub-copy-id')
            expect(mockExec.transaction).toHaveBeenCalledTimes(2)
        })
    })

    describe('blocking child hubs', () => {
        it('returns child hubs in GET blocking-catalogs response', async () => {
            mockHubsService.findById.mockResolvedValueOnce({
                id: 'hub-1',
                codename: 'main-hub'
            })
            ;(mockExec.query as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce([
                {
                    id: 'child-hub-1',
                    codename: 'child-hub',
                    presentation: { name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Child Hub' } } } }
                }
            ])

            const app = buildApp()
            const response = await request(app).get('/metahub/metahub-1/hub/hub-1/blocking-catalogs').expect(200)

            expect(response.body.canDelete).toBe(false)
            expect(response.body.totalBlocking).toBe(1)
            expect(response.body.blockingChildHubs).toHaveLength(1)
            expect(response.body.blockingChildHubs[0].id).toBe('child-hub-1')
        })

        it('blocks DELETE when child hubs are linked to parent', async () => {
            mockHubsService.findById.mockResolvedValueOnce({
                id: 'hub-1',
                codename: 'main-hub'
            })
            ;(mockExec.query as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce([
                {
                    id: 'child-hub-1',
                    codename: 'child-hub',
                    presentation: { name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Child Hub' } } } }
                }
            ])

            const app = buildApp()
            const response = await request(app).delete('/metahub/metahub-1/hub/hub-1').expect(409)

            expect(response.body.error).toBe('Cannot delete hub: required objects would become orphaned')
            expect(response.body.totalBlocking).toBe(1)
            expect(response.body.blockingChildHubs).toHaveLength(1)
            expect(mockHubsService.delete).not.toHaveBeenCalled()
        })
    })
})
