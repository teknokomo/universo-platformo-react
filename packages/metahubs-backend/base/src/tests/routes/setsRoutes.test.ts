jest.mock('@universo/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { OptimisticLockError } from '@universo/utils'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createSetsRoutes } from '../../domains/sets/routes/setsRoutes'
import { testCodenameVlc } from '../utils/codenameTestHelpers'

const mockFindMetahubById = jest.fn(async () => ({ id: 'test-metahub-id' }))

jest.mock('../../persistence', () => ({
    __esModule: true,
    findMetahubById: (...args: unknown[]) => mockFindMetahubById(...args)
}))

const mockEnsureMetahubAccess = jest.fn()

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

jest.mock('../../domains/ddl', () => ({
    __esModule: true
}))

const mockObjectsService = {
    findAllByKind: jest.fn(),
    findById: jest.fn(),
    findByCodenameAndKind: jest.fn(),
    createSet: jest.fn(),
    updateSet: jest.fn(),
    delete: jest.fn(),
    reorderByKind: jest.fn()
}

const mockHubsService = {
    findByIds: jest.fn(),
    findById: jest.fn()
}

const mockConstantsService = {
    countByObjectIds: jest.fn(),
    countByObjectId: jest.fn(),
    findSetReferenceBlockers: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    ensureUniqueCodenameWithRetries: jest.fn()
}

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/metahubs/services/MetahubObjectsService', () => ({
    __esModule: true,
    MetahubObjectsService: jest.fn().mockImplementation(() => mockObjectsService)
}))

jest.mock('../../domains/metahubs/services/MetahubHubsService', () => ({
    __esModule: true,
    MetahubHubsService: jest.fn().mockImplementation(() => mockHubsService)
}))

jest.mock('../../domains/metahubs/services/MetahubConstantsService', () => ({
    __esModule: true,
    MetahubConstantsService: jest.fn().mockImplementation(() => mockConstantsService)
}))

const mockSettingsService = {
    findByKey: jest.fn(async (_metahubId: string, key: string) => {
        const values: Record<string, unknown> = {
            'general.codenameStyle': 'pascal-case',
            'general.codenameAlphabet': 'en-ru',
            'general.codenameAllowMixedAlphabets': false
        }
        return key in values ? { key, value: { _value: values[key] } } : null
    }),
    findAll: jest.fn(async () => [])
}

jest.mock('../../domains/settings/services/MetahubSettingsService', () => ({
    __esModule: true,
    MetahubSettingsService: jest.fn().mockImplementation(() => mockSettingsService)
}))

type MockTransactionExecutor = {
    query: ReturnType<typeof jest.fn>
    transaction: ReturnType<typeof jest.fn>
    isReleased: () => boolean
}

describe('Sets Routes', () => {
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

    const mockExec = {
        query: jest.fn(async () => []),
        transaction: jest.fn(async (cb: (trx: MockTransactionExecutor) => unknown) =>
            cb({ query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false })
        ),
        isReleased: () => false
    }

    const buildApp = () => {
        const app = express()
        app.use(express.json())
        app.use(createSetsRoutes(ensureAuth, () => mockExec as never, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()

        mockObjectsService.findAllByKind.mockResolvedValue([])
        mockObjectsService.findById.mockResolvedValue(null)
        mockObjectsService.findByCodenameAndKind.mockResolvedValue(null)
        mockObjectsService.createSet.mockResolvedValue(null)
        mockObjectsService.updateSet.mockResolvedValue(null)
        mockObjectsService.delete.mockResolvedValue(undefined)
        mockObjectsService.reorderByKind.mockResolvedValue({
            id: '33333333-3333-4333-8333-333333333333',
            config: { sortOrder: 4 }
        })

        mockHubsService.findByIds.mockResolvedValue([])
        mockHubsService.findById.mockResolvedValue({ id: 'hub-1' })

        mockConstantsService.countByObjectIds.mockResolvedValue(new Map<string, number>())
        mockConstantsService.countByObjectId.mockResolvedValue(0)
        mockConstantsService.findSetReferenceBlockers.mockResolvedValue([])
        mockConstantsService.findAll.mockResolvedValue([])
        mockConstantsService.create.mockResolvedValue(undefined)
        mockConstantsService.ensureUniqueCodenameWithRetries.mockImplementation(
            async ({ desiredCodename }: { desiredCodename: string }) => desiredCodename
        )

        mockFindMetahubById.mockResolvedValue({ id: 'test-metahub-id' })
        mockEnsureMetahubAccess.mockResolvedValue(undefined)
    })

    it('GET /metahub/:metahubId/sets returns paginated items with hub and constants counts', async () => {
        mockObjectsService.findAllByKind.mockResolvedValue([
            {
                id: 'set-1',
                kind: 'set',
                codename: 'Products',
                presentation: { name: { en: 'Products' }, description: { en: 'Main set' } },
                config: { hubs: ['hub-1'], isSingleHub: false, isRequiredHub: false, sortOrder: 3 },
                _upl_version: 2,
                _upl_created_at: '2026-03-04T10:00:00.000Z',
                _upl_updated_at: '2026-03-04T11:00:00.000Z'
            }
        ])
        mockConstantsService.countByObjectIds.mockResolvedValue(new Map([['set-1', 2]]))
        mockHubsService.findByIds.mockResolvedValue([{ id: 'hub-1', name: { en: 'Hub One' }, codename: 'HubOne' }])

        const app = buildApp()
        const response = await request(app).get('/metahub/test-metahub-id/sets').expect(200)

        expect(response.body.pagination).toMatchObject({ total: 1, limit: 100, offset: 0 })
        expect(response.body.items[0]).toMatchObject({
            id: 'set-1',
            codename: 'Products',
            constantsCount: 2,
            sortOrder: 3
        })
        expect(response.body.items[0].hubs).toEqual([{ id: 'hub-1', name: { en: 'Hub One' }, codename: 'HubOne' }])
    })

    it('POST /metahub/:metahubId/sets creates set and returns enriched item', async () => {
        const created = {
            id: 'set-new',
            kind: 'set',
            codename: 'ProductsSet',
            presentation: { name: { en: 'Products' }, description: null },
            config: { hubs: [], isSingleHub: false, isRequiredHub: false, sortOrder: 0 },
            _upl_version: 1,
            _upl_created_at: '2026-03-04T12:00:00.000Z',
            _upl_updated_at: '2026-03-04T12:00:00.000Z'
        }

        mockObjectsService.createSet.mockResolvedValue(created)
        mockObjectsService.findById.mockResolvedValue(created)

        const app = buildApp()
        const response = await request(app)
            .post('/metahub/test-metahub-id/sets')
            .send({ codename: testCodenameVlc('products-set'), name: 'Products' })
            .expect(201)

        expect(mockObjectsService.createSet).toHaveBeenCalledWith(
            'test-metahub-id',
            expect.objectContaining({
                codename: expect.objectContaining({
                    _primary: 'en',
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: 'ProductsSet' })
                    })
                })
            }),
            'test-user-id'
        )
        expect(response.body).toMatchObject({ id: 'set-new', codename: 'ProductsSet' })
    })

    it('POST /metahub/:metahubId/set/:setId/copy copies constants when enabled', async () => {
        const sourceSet = {
            id: 'set-1',
            kind: 'set',
            codename: 'Products',
            presentation: { name: { en: 'Products' }, description: null },
            config: { hubs: [], isSingleHub: false, isRequiredHub: false, sortOrder: 1 }
        }
        const copiedSet = {
            id: 'set-copy',
            kind: 'set',
            codename: 'ProductsCopy',
            presentation: { name: { en: 'Products (copy)' }, description: null },
            config: { hubs: [], isSingleHub: false, isRequiredHub: false, sortOrder: 1 },
            _upl_version: 1,
            _upl_created_at: '2026-03-04T12:00:00.000Z',
            _upl_updated_at: '2026-03-04T12:00:00.000Z'
        }

        mockObjectsService.findById.mockResolvedValueOnce(sourceSet).mockResolvedValueOnce(copiedSet)
        mockObjectsService.createSet.mockResolvedValue(copiedSet)
        mockConstantsService.findAll.mockResolvedValue([
            {
                id: 'const-1',
                codename: testCodenameVlc('TaxRate'),
                dataType: 'NUMBER',
                name: { en: 'Tax Rate' },
                validationRules: {},
                uiConfig: {},
                value: 20,
                sortOrder: 1
            }
        ])
        mockConstantsService.countByObjectId.mockResolvedValue(1)

        const app = buildApp()
        const response = await request(app).post('/metahub/test-metahub-id/set/set-1/copy').send({ copyConstants: true }).expect(201)

        expect(mockExec.transaction).toHaveBeenCalledTimes(1)
        expect(mockConstantsService.ensureUniqueCodenameWithRetries).toHaveBeenCalledWith(
            expect.objectContaining({
                desiredCodename: 'TaxRate'
            })
        )
        expect(mockObjectsService.createSet).toHaveBeenCalledWith(
            'test-metahub-id',
            expect.objectContaining({
                codename: expect.objectContaining({
                    _primary: 'en',
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: 'ProductsCopy' })
                    })
                })
            }),
            'test-user-id',
            expect.anything()
        )
        expect(mockConstantsService.create).toHaveBeenCalledWith(
            'test-metahub-id',
            expect.objectContaining({
                setId: 'set-copy',
                codename: expect.objectContaining({
                    _primary: 'en',
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: 'TaxRate' })
                    })
                })
            }),
            'test-user-id',
            expect.anything()
        )
        expect(response.body.copy).toMatchObject({ constantsCopied: 1 })
    })

    it('POST /metahub/:metahubId/set/:setId/copy returns 500 and rolls back on constant copy failure', async () => {
        const sourceSet = {
            id: 'set-1',
            kind: 'set',
            codename: 'Products',
            presentation: { name: { en: 'Products' }, description: null },
            config: { hubs: [], isSingleHub: false, isRequiredHub: false, sortOrder: 1 }
        }
        const copiedSet = {
            id: 'set-copy',
            kind: 'set',
            codename: 'ProductsCopy',
            presentation: { name: { en: 'Products (copy)' }, description: null },
            config: { hubs: [], isSingleHub: false, isRequiredHub: false, sortOrder: 1 },
            _upl_version: 1,
            _upl_created_at: '2026-03-04T12:00:00.000Z',
            _upl_updated_at: '2026-03-04T12:00:00.000Z'
        }

        mockObjectsService.findById.mockResolvedValue(sourceSet)
        mockObjectsService.createSet.mockResolvedValue(copiedSet)
        mockConstantsService.findAll.mockResolvedValue([
            {
                id: 'const-1',
                codename: 'TaxRate',
                dataType: 'NUMBER',
                name: { en: 'Tax Rate' },
                validationRules: {},
                uiConfig: {},
                value: 20,
                sortOrder: 1
            }
        ])
        mockConstantsService.create.mockRejectedValue(new Error('Copy constant failed'))

        const app = buildApp()
        const response = await request(app).post('/metahub/test-metahub-id/set/set-1/copy').send({ copyConstants: true }).expect(500)

        expect(response.body.error).toContain('Copy constant failed')
        expect(mockExec.transaction).toHaveBeenCalledTimes(1)
    })

    it('DELETE /metahub/:metahubId/hub/:hubId/set/:setId removes only selected hub when set is linked to multiple hubs', async () => {
        mockObjectsService.findById.mockResolvedValue({
            id: 'set-1',
            kind: 'set',
            codename: 'Products',
            config: { hubs: ['hub-1', 'hub-2'] },
            _upl_version: 7
        })

        const app = buildApp()
        const response = await request(app).delete('/metahub/test-metahub-id/hub/hub-1/set/set-1')

        expect(response.status).toBe(200)

        expect(response.body).toMatchObject({ remainingHubs: 1 })
        expect(mockObjectsService.updateSet).toHaveBeenCalledWith(
            'test-metahub-id',
            'set-1',
            expect.objectContaining({ config: expect.objectContaining({ hubs: ['hub-2'] }), expectedVersion: 7 }),
            'test-user-id'
        )
        expect(mockObjectsService.delete).not.toHaveBeenCalled()
    })

    it('DELETE /metahub/:metahubId/hub/:hubId/set/:setId returns 409 on optimistic lock conflict', async () => {
        mockObjectsService.findById.mockResolvedValue({
            id: 'set-1',
            kind: 'set',
            codename: 'Products',
            config: { hubs: ['hub-1', 'hub-2'] },
            _upl_version: 3
        })
        mockObjectsService.updateSet.mockRejectedValue(
            new OptimisticLockError({
                entityId: 'set-1',
                entityType: 'set',
                expectedVersion: 3,
                actualVersion: 4,
                updatedAt: new Date('2026-03-04T12:00:00.000Z'),
                updatedBy: 'other-user'
            })
        )

        const app = buildApp()
        const response = await request(app).delete('/metahub/test-metahub-id/hub/hub-1/set/set-1').expect(409)

        expect(response.body.code).toBe('OPTIMISTIC_LOCK_CONFLICT')
        expect(mockObjectsService.delete).not.toHaveBeenCalled()
    })

    it('DELETE /metahub/:metahubId/set/:setId returns 409 when blocking references exist', async () => {
        mockObjectsService.findById.mockResolvedValue({
            id: 'set-1',
            kind: 'set',
            codename: 'Products',
            config: { hubs: [] }
        })
        mockConstantsService.findSetReferenceBlockers.mockResolvedValue([
            {
                sourceCatalogId: 'catalog-2',
                sourceCatalogCodename: 'ProductsCatalog',
                sourceCatalogName: { en: 'Products Catalog' },
                attributeId: 'attr-1',
                attributeCodename: 'OwnerRef',
                attributeName: { en: 'Owner Ref' }
            }
        ])

        const app = buildApp()
        const response = await request(app).delete('/metahub/test-metahub-id/set/set-1').expect(409)

        expect(response.body.code).toBe('SET_DELETE_BLOCKED_BY_REFERENCES')
        expect(mockObjectsService.delete).not.toHaveBeenCalled()
    })

    it('PATCH /metahub/:metahubId/sets/reorder reorders set and returns updated sort order', async () => {
        const app = buildApp()
        const response = await request(app)
            .patch('/metahub/test-metahub-id/sets/reorder')
            .send({
                setId: '33333333-3333-4333-8333-333333333333',
                newSortOrder: 4
            })
            .expect(200)

        expect(response.body).toEqual({
            id: '33333333-3333-4333-8333-333333333333',
            sortOrder: 4
        })
        expect(mockObjectsService.reorderByKind).toHaveBeenCalledWith(
            'test-metahub-id',
            'set',
            '33333333-3333-4333-8333-333333333333',
            4,
            'test-user-id'
        )
    })
})
