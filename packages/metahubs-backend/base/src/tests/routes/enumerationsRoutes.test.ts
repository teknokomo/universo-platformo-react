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

import { createEnumerationsRoutes } from '../../domains/enumerations/routes/enumerationsRoutes'
import { MetahubNotFoundError } from '../../domains/shared/domainErrors'
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
    createEnumeration: jest.fn(),
    updateEnumeration: jest.fn(),
    restore: jest.fn(),
    permanentDelete: jest.fn(),
    reorderByKind: jest.fn()
}

const mockAttributesService = {
    findReferenceBlockersByTarget: jest.fn()
}

const mockValuesService = {
    reorderValue: jest.fn()
}
const mockHubsService = {
    findByIds: jest.fn()
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

const mockSettingsService = {
    findByKey: jest.fn(async (_metahubId: string, key: string) => {
        const values: Record<string, unknown> = {
            'general.codenameStyle': 'pascal-case',
            'general.codenameAlphabet': 'en-ru',
            'general.codenameAllowMixedAlphabets': false,
            'enumerations.allowCopy': true,
            'enumerations.allowDelete': true
        }
        return key in values ? { key, value: { _value: values[key] } } : null
    }),
    findAll: jest.fn(async () => [])
}

jest.mock('../../domains/settings/services/MetahubSettingsService', () => ({
    __esModule: true,
    MetahubSettingsService: jest.fn().mockImplementation(() => mockSettingsService)
}))

describe('Enumerations Routes', () => {
    const createEnumerationCopyTransactionTrx = (params?: { sourceValues?: Array<Record<string, unknown>> }) => {
        const sourceValues = params?.sourceValues ?? [
            {
                codename: 'open',
                presentation: baseNameVlc,
                sort_order: 1,
                is_default: true
            }
        ]

        const queryMock = jest.fn().mockResolvedValue([])
        // Sequence: SELECT values → sourceValues, INSERT values batch → undefined
        if (sourceValues.length > 0) {
            queryMock.mockResolvedValueOnce(sourceValues)
            queryMock.mockResolvedValueOnce(sourceValues.map((_, i) => ({ id: `copied-value-${i}` })))
        }

        return { query: queryMock }
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

    const mockExec = {
        query: jest.fn(async () => []),
        transaction: jest.fn(async (cb: any) => cb({ query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false })),
        isReleased: () => false
    }

    const buildApp = () => {
        const app = express()
        app.use(express.json())
        app.use(createEnumerationsRoutes(ensureAuth, () => mockExec as any, mockRateLimiter, mockRateLimiter))
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
        mockObjectsService.createEnumeration.mockResolvedValue({
            id: 'enum-copy-id',
            codename: 'StatusCopy',
            presentation: { name: baseNameVlc, description: baseDescriptionVlc },
            config: { hubs: ['hub-1'], isSingleHub: false, isRequiredHub: false, sortOrder: 1 },
            _upl_version: 1,
            _upl_created_at: '2026-02-26T00:00:00.000Z',
            _upl_updated_at: '2026-02-26T00:00:00.000Z'
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
        mockObjectsService.reorderByKind.mockResolvedValue({
            id: '44444444-4444-4444-8444-444444444444',
            config: { sortOrder: 2 }
        })
        mockValuesService.reorderValue.mockResolvedValue({
            id: '44444444-4444-4444-4444-444444444444',
            objectId: 'enum-1',
            sortOrder: 2
        })
        mockAttributesService.findReferenceBlockersByTarget.mockResolvedValue([])
        mockHubsService.findByIds.mockResolvedValue([
            {
                id: 'hub-1',
                name: baseNameVlc,
                codename: 'main-hub'
            }
        ])
        mockFindMetahubById.mockResolvedValue({ id: 'metahub-1' })
        mockEnsureMetahubAccess.mockResolvedValue({ metahubId: 'metahub-1' })
        mockEnsureSchema.mockResolvedValue('mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
    })

    describe('PATCH /metahub/:metahubId/enumeration/:enumerationId/values/reorder', () => {
        it('reorders enumeration value and returns updated value', async () => {
            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/enumeration/enum-1/values/reorder')
                .send({
                    valueId: '44444444-4444-4444-4444-444444444444',
                    newSortOrder: 2
                })
                .expect(200)

            expect(response.body.id).toBe('44444444-4444-4444-4444-444444444444')
            expect(mockValuesService.reorderValue).toHaveBeenCalledWith(
                'metahub-1',
                'enum-1',
                '44444444-4444-4444-4444-444444444444',
                2,
                'test-user-id'
            )
        })

        it('returns 404 when reordered value is not found in target enumeration', async () => {
            mockValuesService.reorderValue.mockRejectedValueOnce(
                new MetahubNotFoundError('Enumeration value', '44444444-4444-4444-4444-444444444444')
            )

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/enumeration/enum-1/values/reorder')
                .send({
                    valueId: '44444444-4444-4444-4444-444444444444',
                    newSortOrder: 2
                })
                .expect(404)

            expect(response.body.error).toBe('Enumeration value not found')
        })

        it('returns 400 when payload is invalid', async () => {
            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/enumeration/enum-1/values/reorder')
                .send({ valueId: 'not-a-uuid', newSortOrder: 0 })
                .expect(400)

            expect(response.body.error).toBe('Validation failed')
            expect(mockValuesService.reorderValue).not.toHaveBeenCalled()
        })
    })

    describe('PATCH /metahub/:metahubId/enumerations/reorder', () => {
        it('reorders enumeration and returns updated sort order', async () => {
            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/enumerations/reorder')
                .send({
                    enumerationId: '44444444-4444-4444-8444-444444444444',
                    newSortOrder: 2
                })
                .expect(200)

            expect(response.body).toEqual({
                id: '44444444-4444-4444-8444-444444444444',
                sortOrder: 2
            })
            expect(mockObjectsService.reorderByKind).toHaveBeenCalledWith(
                'metahub-1',
                'enumeration',
                '44444444-4444-4444-8444-444444444444',
                2,
                'test-user-id'
            )
        })
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
            mockFindMetahubById.mockResolvedValueOnce(null)

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/missing/enumeration/enum-1/copy')
                .send({ codename: testCodenameVlc('status-copy') })
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
                .send({ codename: testCodenameVlc('status-copy') })
                .expect(403)

            expect(response.body.error).toBe('Access denied to this metahub')
            expect(mockObjectsService.findById).not.toHaveBeenCalled()
        })

        it('returns 404 when source enumeration is not found', async () => {
            mockObjectsService.findById.mockResolvedValueOnce(null)

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/enumeration/enum-1/copy')
                .send({ codename: testCodenameVlc('status-copy') })
                .expect(404)

            expect(response.body.error).toBe('Enumeration not found')
        })

        it('returns 400 when codename is invalid', async () => {
            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/enumeration/enum-1/copy')
                .send({ codename: testCodenameVlc('!!!') })
                .expect(400)

            expect(response.body.error).toBe('Validation failed')
            expect(response.body.details?.codename).toBeDefined()
        })

        it('copies enumeration with values successfully', async () => {
            const trx = createEnumerationCopyTransactionTrx()
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/enumeration/enum-1/copy')
                .send({
                    codename: testCodenameVlc('status-copy'),
                    copyValues: true
                })
                .expect(201)

            expect(mockEnsureSchema).toHaveBeenCalledWith('metahub-1', 'test-user-id')
            expect(response.body.id).toBe('enum-copy-id')
            expect(response.body.codename).toBe('StatusCopy')
            expect(response.body.sortOrder).toBe(1)
            expect(response.body.valuesCount).toBe(1)
            // trx.query called: SELECT values (1) + INSERT values (1) = 2
            expect(trx.query).toHaveBeenCalledTimes(2)
            expect(mockObjectsService.createEnumeration).toHaveBeenCalled()
        })

        it('does not copy values when copyValues is disabled', async () => {
            const trx = createEnumerationCopyTransactionTrx()
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/enumeration/enum-1/copy')
                .send({
                    codename: testCodenameVlc('status-copy'),
                    copyValues: false
                })
                .expect(201)

            expect(response.body.valuesCount).toBe(0)
            // No queries on trx for values (createEnumeration is a mocked service call, not SQL)
            expect(trx.query).not.toHaveBeenCalled()
        })

        it('retries copy after codename unique violation and succeeds', async () => {
            const uniqueViolation = Object.assign(new Error('duplicate key value violates unique constraint'), {
                code: '23505',
                constraint: 'idx_mhb_objects_kind_codename_active'
            })
            const trx = createEnumerationCopyTransactionTrx()
            mockObjectsService.createEnumeration.mockResolvedValueOnce({
                id: 'enum-copy-id-2',
                codename: 'StatusCopy_2',
                presentation: { name: baseNameVlc, description: baseDescriptionVlc },
                config: { hubs: ['hub-1'], isSingleHub: false, isRequiredHub: false, sortOrder: 1 },
                _upl_version: 1,
                _upl_created_at: '2026-02-26T00:00:00.000Z',
                _upl_updated_at: '2026-02-26T00:00:00.000Z'
            })
            ;(mockExec.transaction as jest.Mock)
                .mockRejectedValueOnce(uniqueViolation)
                .mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(trx))

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/enumeration/enum-1/copy')
                .send({ codename: testCodenameVlc('status-copy') })
                .expect(201)

            expect(response.body.id).toBe('enum-copy-id-2')
            expect(response.body.codename).toBe('StatusCopy_2')
            expect(mockExec.transaction).toHaveBeenCalledTimes(2)
        })
    })
})
