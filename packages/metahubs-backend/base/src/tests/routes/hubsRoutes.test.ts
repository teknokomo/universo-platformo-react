jest.mock(
    'typeorm',
    () => {
        const decorator = () => () => undefined
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
import { createHubsRoutes } from '../../domains/hubs/routes/hubsRoutes'

const mockEnsureMetahubAccess = jest.fn()
const mockEnsureSchema = jest.fn(async () => 'mhb_test_schema')

const mockKnex: Record<string, any> = {
    transaction: jest.fn()
}

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

jest.mock('../../domains/ddl', () => ({
    __esModule: true,
    KnexClient: {
        getInstance: () => mockKnex
    }
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

const createTransactionStub = (params?: {
    copiedHub?: Record<string, unknown>
    relationRows?: Array<Record<string, unknown>>
    relationUpdateRows?: Array<Record<string, unknown>>
}) => {
    const copiedHub =
        params?.copiedHub ??
        ({
            id: 'hub-copy-id',
            codename: 'MainHubCopy',
            presentation: { name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Main hub (copy)' } } }, description: null },
            config: { sortOrder: 3 },
            _upl_version: 1,
            _upl_created_at: '2026-02-26T00:00:00.000Z',
            _upl_updated_at: '2026-02-26T00:00:00.000Z'
        } as Record<string, unknown>)

    const insertReturning = jest.fn().mockResolvedValue([copiedHub])
    const relationSelect = jest.fn().mockResolvedValue(params?.relationRows ?? [])
    const relationUpdateReturning = jest.fn().mockResolvedValue(params?.relationUpdateRows ?? [{ id: 'related-1' }])

    const trx = {
        raw: jest.fn(() => '_upl_version + 1'),
        withSchema: jest.fn(() => ({
            into: jest.fn(() => ({
                insert: jest.fn(() => ({
                    returning: (...args: unknown[]) => insertReturning(...args)
                }))
            })),
            from: jest.fn(() => ({
                where: jest.fn((_criteria: Record<string, unknown>) => ({
                    update: jest.fn(() => ({
                        returning: (...args: unknown[]) => relationUpdateReturning(...args)
                    }))
                })),
                whereIn: jest.fn(() => ({
                    andWhere: jest.fn(() => ({
                        andWhere: jest.fn(() => ({
                            andWhereRaw: jest.fn(() => ({
                                forUpdate: jest.fn(() => ({
                                    select: (...args: unknown[]) => relationSelect(...args)
                                }))
                            }))
                        }))
                    }))
                }))
            }))
        }))
    }

    return { trx, insertReturning, relationSelect, relationUpdateReturning }
}

const mockKnexForBlockingChildHubs = (options?: {
    blockingObjects?: Array<Record<string, unknown>>
    blockingChildHubs?: Array<Record<string, unknown>>
}) => {
    const blockingObjects = options?.blockingObjects ?? []
    const blockingChildHubs = options?.blockingChildHubs ?? []

    const objectsChain = {
        whereIn: jest.fn(() => objectsChain),
        whereRaw: jest.fn(() => objectsChain),
        select: jest.fn(async () => blockingObjects)
    }

    const childHubsChain = {
        where: jest.fn(() => childHubsChain),
        andWhere: jest.fn(() => childHubsChain),
        andWhereRaw: jest.fn(() => childHubsChain),
        select: jest.fn(async () => blockingChildHubs)
    }

    const schemaChain = {
        from: jest.fn((tableName: string) => {
            if (tableName !== '_mhb_objects') throw new Error(`Unexpected table: ${tableName}`)
            return {
                whereIn: objectsChain.whereIn,
                where: childHubsChain.where
            }
        })
    }

    mockKnex.withSchema = jest.fn(() => schemaChain)
}

describe('Hubs Routes', () => {
    const mockMetahubRepo = createMockRepository<Record<string, unknown>>()

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
        const dataSource = createMockDataSource({
            Metahub: mockMetahubRepo
        })

        const app = express()
        app.use(express.json())
        app.use(createHubsRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockMetahubRepo.findOne.mockResolvedValue({ id: 'metahub-1' })
        mockEnsureMetahubAccess.mockResolvedValue({ metahubId: 'metahub-1' })
        mockHubsService.findById.mockResolvedValue(null)
        mockHubsService.create.mockResolvedValue({
            id: 'hub-copy-id',
            codename: 'MainHubCopy',
            codenameLocalized: null,
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
        mockEnsureSchema.mockResolvedValue('mhb_test_schema')
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
            mockMetahubRepo.findOne.mockResolvedValueOnce(null)

            const app = buildApp()
            const response = await request(app).post('/metahub/missing/hub/hub-1/copy').send({ codename: 'hub-copy' }).expect(404)

            expect(response.body.error).toBe('Metahub not found')
            expect(mockEnsureMetahubAccess).not.toHaveBeenCalled()
        })

        it('returns 403 when metahub access check fails', async () => {
            const forbidden = Object.assign(new Error('Access denied to this metahub'), { status: 403 })
            mockEnsureMetahubAccess.mockRejectedValueOnce(forbidden)

            const app = buildApp()
            const response = await request(app).post('/metahub/metahub-1/hub/hub-1/copy').send({ codename: 'hub-copy' }).expect(403)

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

            const txConflict = createTransactionStub({
                relationRows: [{ id: 'catalog-1', kind: 'catalog', config: { hubs: ['hub-1'], isSingleHub: true }, _upl_version: 1 }]
            })
            mockKnex.transaction.mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(txConflict.trx))

            const app = buildApp()
            const response = await request(app).post('/metahub/metahub-1/hub/hub-1/copy').send({ codename: 'main-hub-copy' }).expect(201)

            expect(response.body.id).toBe('hub-copy-id')
            expect(txConflict.relationSelect).toHaveBeenCalled()
            expect(txConflict.relationUpdateReturning).not.toHaveBeenCalled()
        })

        it('copies hub successfully when copyAllRelations is disabled', async () => {
            mockHubsService.findById.mockResolvedValueOnce({
                id: 'hub-1',
                codename: 'main-hub',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Main hub' } } },
                description: null,
                sort_order: 3
            })

            const tx = createTransactionStub()
            mockKnex.transaction.mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(tx.trx))

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/hub/hub-1/copy')
                .send({
                    codename: 'main-hub-copy',
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

            const txConcurrentConflict = createTransactionStub({
                relationRows: [{ id: 'catalog-1', kind: 'catalog', config: { hubs: ['hub-1'] }, _upl_version: 1 }],
                relationUpdateRows: []
            })
            const txSuccess = createTransactionStub({ relationRows: [] })

            mockKnex.transaction
                .mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(txConcurrentConflict.trx))
                .mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(txSuccess.trx))

            const app = buildApp()
            const response = await request(app).post('/metahub/metahub-1/hub/hub-1/copy').send({ codename: 'main-hub-copy' }).expect(201)

            expect(response.body.id).toBe('hub-copy-id')
            expect(mockKnex.transaction).toHaveBeenCalledTimes(2)
        })
    })

    describe('blocking child hubs', () => {
        it('returns child hubs in GET blocking-catalogs response', async () => {
            mockHubsService.findById.mockResolvedValueOnce({
                id: 'hub-1',
                codename: 'main-hub'
            })
            mockKnexForBlockingChildHubs({
                blockingObjects: [],
                blockingChildHubs: [
                    {
                        id: 'child-hub-1',
                        codename: 'child-hub',
                        presentation: { name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Child Hub' } } } }
                    }
                ]
            })

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
            mockKnexForBlockingChildHubs({
                blockingObjects: [],
                blockingChildHubs: [
                    {
                        id: 'child-hub-1',
                        codename: 'child-hub',
                        presentation: { name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Child Hub' } } } }
                    }
                ]
            })

            const app = buildApp()
            const response = await request(app).delete('/metahub/metahub-1/hub/hub-1').expect(409)

            expect(response.body.error).toBe('Cannot delete hub: required objects would become orphaned')
            expect(response.body.totalBlocking).toBe(1)
            expect(response.body.blockingChildHubs).toHaveLength(1)
            expect(mockHubsService.delete).not.toHaveBeenCalled()
        })
    })
})
