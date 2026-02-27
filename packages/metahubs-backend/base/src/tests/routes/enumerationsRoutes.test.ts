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
import { createEnumerationsRoutes } from '../../domains/enumerations/routes/enumerationsRoutes'

const mockEnsureMetahubAccess = jest.fn()
const mockEnsureSchema = jest.fn(async () => 'mhb_test_schema')
const mockKnex = {
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

const baseNameVlc = {
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: 'Status', version: 1, isActive: true, createdAt: '1970-01-01T00:00:00.000Z', updatedAt: '1970-01-01T00:00:00.000Z' }
    }
}
const baseDescriptionVlc = {
    _schema: '1',
    _primary: 'ru',
    locales: {
        ru: {
            content: 'Старое описание',
            version: 1,
            isActive: true,
            createdAt: '1970-01-01T00:00:00.000Z',
            updatedAt: '1970-01-01T00:00:00.000Z'
        }
    }
}

const mockObjectsService = {
    findById: jest.fn(),
    updateEnumeration: jest.fn(),
    restore: jest.fn(),
    permanentDelete: jest.fn()
}

const mockAttributesService = {
    findReferenceBlockersByTarget: jest.fn()
}

const mockValuesService = {}
const mockHubsService = {
    findByIds: jest.fn()
}
const mockMetahubRepo = createMockRepository<Record<string, unknown>>()

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

jest.mock('../../domains/metahubs/services/MetahubAttributesService', () => ({
    __esModule: true,
    MetahubAttributesService: jest.fn().mockImplementation(() => mockAttributesService)
}))

jest.mock('../../domains/metahubs/services/MetahubEnumerationValuesService', () => ({
    __esModule: true,
    MetahubEnumerationValuesService: jest.fn().mockImplementation(() => mockValuesService)
}))

jest.mock('../../domains/metahubs/services/MetahubHubsService', () => ({
    __esModule: true,
    MetahubHubsService: jest.fn().mockImplementation(() => mockHubsService)
}))

describe('Enumerations Routes', () => {
    const createEnumerationCopyTransactionStub = (params?: {
        copiedEnumeration?: Record<string, unknown>
        sourceValues?: Array<Record<string, unknown>>
    }) => {
        const createdEnumeration =
            params?.copiedEnumeration ??
            ({
                id: 'enum-copy-id',
                codename: 'status-copy',
                presentation: { name: baseNameVlc, description: baseDescriptionVlc },
                config: { hubs: ['hub-1'], isSingleHub: false, isRequiredHub: false, sortOrder: 0 },
                _upl_version: 1,
                _upl_created_at: '2026-02-26T00:00:00.000Z',
                _upl_updated_at: '2026-02-26T00:00:00.000Z'
            } as Record<string, unknown>)

        const sourceValues = params?.sourceValues ?? [
            {
                codename: 'open',
                presentation: baseNameVlc,
                sort_order: 1,
                is_default: true
            }
        ]

        const objectsInsertReturning = jest.fn().mockResolvedValue([createdEnumeration])
        const valuesSelect = jest.fn().mockResolvedValue(sourceValues)
        const valuesInsert = jest.fn().mockResolvedValue(undefined)

        const trx = {
            withSchema: jest.fn(() => ({
                into: jest.fn((tableName: string) => {
                    if (tableName === '_mhb_objects') {
                        return {
                            insert: jest.fn(() => ({
                                returning: (...args: unknown[]) => objectsInsertReturning(...args)
                            }))
                        }
                    }
                    if (tableName === '_mhb_values') {
                        return {
                            insert: (...args: unknown[]) => valuesInsert(...args)
                        }
                    }
                    return {
                        insert: jest.fn()
                    }
                }),
                from: jest.fn((tableName: string) => {
                    if (tableName === '_mhb_values') {
                        return {
                            where: jest.fn(() => ({
                                andWhere: jest.fn(() => ({
                                    andWhere: jest.fn(() => ({
                                        orderBy: jest.fn(() => ({
                                            orderBy: jest.fn(() => ({
                                                select: (...args: unknown[]) => valuesSelect(...args)
                                            }))
                                        }))
                                    }))
                                }))
                            }))
                        }
                    }
                    return {
                        where: jest.fn()
                    }
                })
            }))
        }

        return {
            trx,
            valuesInsert,
            valuesSelect
        }
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
        const dataSource = createMockDataSource({
            Metahub: mockMetahubRepo
        })
        const app = express()
        app.use(express.json())
        app.use(createEnumerationsRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockObjectsService.findById.mockResolvedValue({
            id: 'enum-1',
            kind: 'enumeration',
            codename: 'status',
            presentation: {
                name: baseNameVlc,
                description: baseDescriptionVlc
            },
            config: {
                hubs: ['hub-1'],
                isSingleHub: false,
                isRequiredHub: false,
                sortOrder: 0
            },
            _upl_version: 1,
            _upl_created_at: new Date('2026-02-18T00:00:00.000Z').toISOString(),
            _upl_updated_at: new Date('2026-02-18T00:00:00.000Z').toISOString()
        })
        mockObjectsService.updateEnumeration.mockImplementation(
            async (_metahubId: string, enumerationId: string, payload: Record<string, unknown>) => ({
                id: enumerationId,
                codename: payload.codename ?? 'status',
                presentation: {
                    name: payload.name ?? baseNameVlc,
                    description: payload.description ?? baseDescriptionVlc
                },
                config: {
                    hubs: payload.config?.hubs ?? ['hub-1'],
                    isSingleHub: payload.config?.isSingleHub ?? false,
                    isRequiredHub: payload.config?.isRequiredHub ?? false,
                    sortOrder: payload.config?.sortOrder ?? 0
                },
                _upl_version: 2,
                _upl_created_at: new Date('2026-02-18T00:00:00.000Z').toISOString(),
                _upl_updated_at: new Date('2026-02-18T01:00:00.000Z').toISOString()
            })
        )
        mockObjectsService.restore.mockResolvedValue(undefined)
        mockObjectsService.permanentDelete.mockResolvedValue(undefined)
        mockAttributesService.findReferenceBlockersByTarget.mockResolvedValue([])
        mockHubsService.findByIds.mockResolvedValue([
            {
                id: 'hub-1',
                name: baseNameVlc,
                codename: 'main-hub'
            }
        ])
        mockMetahubRepo.findOne.mockResolvedValue({ id: 'metahub-1' })
        mockEnsureMetahubAccess.mockResolvedValue({ metahubId: 'metahub-1' })
        mockEnsureSchema.mockResolvedValue('mhb_test_schema')
    })

    describe('DELETE /metahub/:metahubId/enumeration/:enumerationId/permanent', () => {
        it('returns 409 when enumeration has blocking references', async () => {
            mockAttributesService.findReferenceBlockersByTarget.mockResolvedValue([
                {
                    attributeId: 'attr-1',
                    catalogId: 'catalog-1',
                    codename: 'status'
                }
            ])

            const app = buildApp()
            const response = await request(app).delete('/metahub/metahub-1/enumeration/enum-1/permanent').expect(409)

            expect(response.body.error).toBe('Cannot delete enumeration: it is referenced by attributes')
            expect(response.body.blockingReferences).toHaveLength(1)
            expect(mockObjectsService.permanentDelete).not.toHaveBeenCalled()
        })
    })

    describe('POST /metahub/:metahubId/enumeration/:enumerationId/restore', () => {
        it('returns 409 on codename unique conflict', async () => {
            const uniqueViolation = Object.assign(new Error('duplicate key value violates unique constraint'), {
                code: '23505',
                constraint: 'idx_mhb_objects_kind_codename_active'
            })
            mockObjectsService.restore.mockRejectedValueOnce(uniqueViolation)

            const app = buildApp()
            const response = await request(app).post('/metahub/metahub-1/enumeration/enum-1/restore').expect(409)

            expect(response.body.error).toBe('Cannot restore enumeration: codename already exists in this metahub')
            expect(mockObjectsService.restore).toHaveBeenCalledWith('metahub-1', 'enum-1', 'test-user-id')
        })
    })

    describe('PATCH /metahub/:metahubId/hub/:hubId/enumeration/:enumerationId', () => {
        it('preserves existing description primary locale when descriptionPrimaryLocale is omitted', async () => {
            const app = buildApp()
            await request(app)
                .patch('/metahub/metahub-1/hub/hub-1/enumeration/enum-1')
                .send({
                    description: {
                        ru: 'Новое описание'
                    }
                })
                .expect(200)

            expect(mockObjectsService.updateEnumeration).toHaveBeenCalled()
            const payload = mockObjectsService.updateEnumeration.mock.calls[0][2]
            expect(payload.description?._primary).toBe('ru')
        })
    })

    describe('POST /metahub/:metahubId/enumeration/:enumerationId/copy', () => {
        it('returns 404 when metahub does not exist', async () => {
            mockMetahubRepo.findOne.mockResolvedValueOnce(null)

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/missing/enumeration/enum-1/copy')
                .send({ codename: 'status-copy' })
                .expect(404)

            expect(response.body.error).toBe('Metahub not found')
            expect(mockEnsureMetahubAccess).not.toHaveBeenCalled()
        })

        it('returns 403 when metahub access check fails', async () => {
            const forbidden = Object.assign(new Error('Access denied to this metahub'), { status: 403 })
            mockEnsureMetahubAccess.mockRejectedValueOnce(forbidden)

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/enumeration/enum-1/copy')
                .send({ codename: 'status-copy' })
                .expect(403)

            expect(response.body.error).toBe('Access denied to this metahub')
            expect(mockObjectsService.findById).not.toHaveBeenCalled()
        })

        it('returns 404 when source enumeration is not found', async () => {
            mockObjectsService.findById.mockResolvedValueOnce(null)

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/enumeration/enum-1/copy')
                .send({ codename: 'status-copy' })
                .expect(404)

            expect(response.body.error).toBe('Enumeration not found')
        })

        it('returns 400 when codename is invalid', async () => {
            const app = buildApp()
            const response = await request(app).post('/metahub/metahub-1/enumeration/enum-1/copy').send({ codename: '!!!' }).expect(400)

            expect(response.body.error).toBe('Validation failed')
            expect(response.body.details?.codename).toBeDefined()
        })

        it('copies enumeration with values successfully', async () => {
            const tx = createEnumerationCopyTransactionStub()
            mockKnex.transaction.mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(tx.trx))

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/enumeration/enum-1/copy')
                .send({
                    codename: 'status-copy',
                    copyValues: true
                })
                .expect(201)

            expect(mockEnsureSchema).toHaveBeenCalledWith('metahub-1', 'test-user-id')
            expect(response.body.id).toBe('enum-copy-id')
            expect(response.body.codename).toBe('status-copy')
            expect(response.body.valuesCount).toBe(1)
            expect(tx.valuesInsert).toHaveBeenCalledTimes(1)
        })

        it('does not copy values when copyValues is disabled', async () => {
            const tx = createEnumerationCopyTransactionStub({
                sourceValues: [
                    {
                        codename: 'open',
                        presentation: baseNameVlc,
                        sort_order: 1,
                        is_default: true
                    }
                ]
            })
            mockKnex.transaction.mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(tx.trx))

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/enumeration/enum-1/copy')
                .send({
                    codename: 'status-copy',
                    copyValues: false
                })
                .expect(201)

            expect(response.body.valuesCount).toBe(0)
            expect(tx.valuesSelect).not.toHaveBeenCalled()
            expect(tx.valuesInsert).not.toHaveBeenCalled()
        })

        it('retries copy after codename unique violation and succeeds', async () => {
            const uniqueViolation = Object.assign(new Error('duplicate key value violates unique constraint'), {
                code: '23505',
                constraint: 'idx_mhb_objects_kind_codename_active'
            })
            const tx = createEnumerationCopyTransactionStub({
                copiedEnumeration: {
                    id: 'enum-copy-id-2',
                    codename: 'status-copy-2',
                    presentation: { name: baseNameVlc, description: baseDescriptionVlc },
                    config: { hubs: ['hub-1'], isSingleHub: false, isRequiredHub: false, sortOrder: 0 },
                    _upl_version: 1,
                    _upl_created_at: '2026-02-26T00:00:00.000Z',
                    _upl_updated_at: '2026-02-26T00:00:00.000Z'
                }
            })

            mockKnex.transaction
                .mockRejectedValueOnce(uniqueViolation)
                .mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(tx.trx))

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/enumeration/enum-1/copy')
                .send({ codename: 'status-copy' })
                .expect(201)

            expect(response.body.id).toBe('enum-copy-id-2')
            expect(response.body.codename).toBe('status-copy-2')
            expect(mockKnex.transaction).toHaveBeenCalledTimes(2)
        })
    })
})
