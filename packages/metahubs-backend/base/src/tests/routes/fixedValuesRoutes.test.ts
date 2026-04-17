jest.mock('@universo/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createMockDbExecutor } from '../utils/dbMocks'
import { createEntityFixedValueRoutes } from '../../domains/entities/metadata/fixedValue/routes'
import { testCodenameVlc } from '../utils/codenameTestHelpers'
import { SHARED_OBJECT_KINDS } from '@universo/types'

const mockEnsureMetahubAccess = jest.fn()

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

const mockFixedValuesService = {
    findAll: jest.fn(),
    findAllMerged: jest.fn(),
    countByObjectId: jest.fn(),
    findById: jest.fn(),
    findByCodename: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    moveFixedValue: jest.fn(),
    reorderConstant: jest.fn(),
    reorderConstantMergedOrder: jest.fn(),
    findAttributeReferenceBlockersByConstant: jest.fn()
}

const mockObjectsService = {
    findById: jest.fn()
}

const mockEntityTypeService = {
    listEditableTypes: jest.fn(async () => []),
    resolveType: jest.fn(async () => null)
}

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/metahubs/services/MetahubFixedValuesService', () => ({
    __esModule: true,
    MetahubFixedValuesService: jest.fn().mockImplementation(() => mockFixedValuesService)
}))

jest.mock('../../domains/metahubs/services/MetahubObjectsService', () => ({
    __esModule: true,
    MetahubObjectsService: jest.fn().mockImplementation(() => mockObjectsService)
}))

jest.mock('../../domains/entities/services/EntityTypeService', () => ({
    __esModule: true,
    EntityTypeService: jest.fn().mockImplementation(() => mockEntityTypeService)
}))

const mockSettingsService = {
    findByKey: jest.fn(async (_metahubId: string, key: string) => {
        const values: Record<string, unknown> = {
            'general.codenameStyle': 'pascal-case',
            'general.codenameAlphabet': 'en-ru',
            'general.codenameAllowMixedAlphabets': false,
            'entity.set.allowedConstantTypes': ['STRING', 'NUMBER', 'BOOLEAN', 'DATE']
        }
        return key in values ? { key, value: { _value: values[key] } } : null
    }),
    findAll: jest.fn(async () => [])
}

jest.mock('../../domains/settings/services/MetahubSettingsService', () => ({
    __esModule: true,
    MetahubSettingsService: jest.fn().mockImplementation(() => mockSettingsService)
}))

describe('Fixed Value Routes', () => {
    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as unknown as { user?: { id: string } }).user = { id: 'test-user-id' }
        next()
    }

    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    const errorHandler = (err: Error, _req: Request, res: Response, next: NextFunction) => {
        if (res.headersSent) {
            return next(err)
        }
        res.status(500).json({ error: err.message || 'Internal Server Error' })
    }

    const buildApp = () => {
        const mockExecutor = createMockDbExecutor()
        const app = express()
        app.use(express.json())
        app.use(createEntityFixedValueRoutes(ensureAuth, () => mockExecutor, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    const activeSet = {
        id: 'set-1',
        kind: 'set',
        codename: 'Products',
        config: { hubs: ['hub-1'] }
    }

    beforeEach(() => {
        jest.clearAllMocks()

        mockEnsureMetahubAccess.mockResolvedValue(undefined)
        mockEntityTypeService.listEditableTypes.mockResolvedValue([])
        mockEntityTypeService.resolveType.mockResolvedValue(null)
        mockObjectsService.findById.mockResolvedValue(activeSet)

        mockFixedValuesService.findAll.mockResolvedValue([])
        mockFixedValuesService.findAllMerged.mockResolvedValue([])
        mockFixedValuesService.countByObjectId.mockResolvedValue(0)
        mockFixedValuesService.findById.mockResolvedValue(null)
        mockFixedValuesService.findByCodename.mockResolvedValue(null)
        mockFixedValuesService.create.mockResolvedValue({})
        mockFixedValuesService.update.mockResolvedValue({})
        mockFixedValuesService.delete.mockResolvedValue(undefined)
        mockFixedValuesService.moveFixedValue.mockResolvedValue({})
        mockFixedValuesService.reorderConstant.mockResolvedValue({ id: 'constant-1', sortOrder: 2 })
        mockFixedValuesService.reorderConstantMergedOrder.mockResolvedValue({ id: 'constant-1', effectiveSortOrder: 2, isShared: true })
        mockFixedValuesService.findAttributeReferenceBlockersByConstant.mockResolvedValue(false)
    })

    it('GET /metahub/:metahubId/set/:valueGroupId/fixed-values returns list with pagination and meta', async () => {
        mockFixedValuesService.findAll.mockResolvedValue([
            {
                id: 'constant-1',
                valueGroupId: 'set-1',
                codename: 'TaxRate',
                name: { en: 'Tax Rate' },
                sortOrder: 1,
                createdAt: '2026-03-04T10:00:00.000Z',
                updatedAt: '2026-03-04T10:00:00.000Z'
            }
        ])

        const app = buildApp()
        const response = await request(app).get('/metahub/metahub-1/entities/set/instance/set-1/fixed-values').expect(200)

        expect(response.body.items).toHaveLength(1)
        expect(response.body.pagination).toMatchObject({ total: 1, limit: 100, offset: 0 })
        expect(response.body.meta).toMatchObject({ totalAll: 1, limitReached: false })
    })

    it('GET /metahub/:metahubId/set/:valueGroupId/fixed-values accepts shared set pool context ids', async () => {
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'shared-set-pool-1',
            kind: SHARED_OBJECT_KINDS.SHARED_SET_POOL,
            codename: 'shared-constants',
            config: { hubs: [] }
        })

        const app = buildApp()
        await request(app).get('/metahub/metahub-1/entities/set/instance/shared-set-pool-1/fixed-values').expect(200)

        expect(mockFixedValuesService.findAll).toHaveBeenCalledWith('metahub-1', 'shared-set-pool-1', 'test-user-id')
        expect(mockFixedValuesService.countByObjectId).not.toHaveBeenCalled()
    })

    it('GET /metahub/:metahubId/set/:valueGroupId/fixed-values uses merged read when includeShared=true', async () => {
        mockFixedValuesService.findAllMerged.mockResolvedValue([
            {
                id: 'shared-constant-1',
                valueGroupId: 'shared-pool-1',
                codename: 'SharedTaxRate',
                name: { en: 'Shared Tax Rate' },
                sortOrder: 1,
                effectiveSortOrder: 1,
                isShared: true,
                isActive: true,
                isExcluded: false,
                sharedBehavior: { canDeactivate: true, canExclude: true, positionLocked: false },
                createdAt: '2026-03-04T10:00:00.000Z',
                updatedAt: '2026-03-04T10:00:00.000Z'
            }
        ])

        const app = buildApp()
        const response = await request(app)
            .get('/metahub/metahub-1/entities/set/instance/set-1/fixed-values?includeShared=true')
            .expect(200)

        expect(response.body.items[0]).toMatchObject({ id: 'shared-constant-1', isShared: true, effectiveSortOrder: 1 })
        expect(response.body.meta).toMatchObject({ includeShared: true })
        expect(mockFixedValuesService.findAllMerged).toHaveBeenCalledWith('metahub-1', 'set-1', 'test-user-id')
        expect(mockFixedValuesService.findAll).not.toHaveBeenCalled()
    })

    it('POST /metahub/:metahubId/set/:valueGroupId/fixed-values creates NUMBER fixed value with parsed numeric value', async () => {
        mockFixedValuesService.create.mockResolvedValue({
            id: 'constant-1',
            valueGroupId: 'set-1',
            codename: 'TaxRate',
            dataType: 'NUMBER',
            value: 20
        })

        const app = buildApp()
        const response = await request(app)
            .post('/metahub/metahub-1/entities/set/instance/set-1/fixed-values')
            .send({
                codename: testCodenameVlc('tax-rate'),
                dataType: 'NUMBER',
                name: 'Tax Rate',
                value: '20'
            })
            .expect(201)

        expect(mockFixedValuesService.create).toHaveBeenCalledWith(
            'metahub-1',
            expect.objectContaining({
                codename: expect.objectContaining({
                    _primary: 'en',
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: 'TaxRate' })
                    })
                }),
                dataType: 'NUMBER',
                value: 20
            }),
            'test-user-id'
        )
        expect(response.body).toMatchObject({ id: 'constant-1', codename: 'TaxRate' })
    })

    it('POST /metahub/:metahubId/set/:valueGroupId/fixed-values preserves uiConfig.sharedBehavior when provided', async () => {
        mockFixedValuesService.create.mockResolvedValue({
            id: 'constant-1',
            valueGroupId: 'set-1',
            codename: 'WelcomeText',
            dataType: 'STRING',
            value: 'Hello',
            uiConfig: {
                sharedBehavior: {
                    canDeactivate: true,
                    canExclude: false,
                    positionLocked: true
                }
            }
        })

        const app = buildApp()
        const response = await request(app)
            .post('/metahub/metahub-1/entities/set/instance/set-1/fixed-values')
            .send({
                codename: testCodenameVlc('welcome-text'),
                dataType: 'STRING',
                name: 'Welcome Text',
                value: 'Hello',
                uiConfig: {
                    sharedBehavior: {
                        canDeactivate: true,
                        canExclude: false,
                        positionLocked: true
                    }
                }
            })
            .expect(201)

        expect(mockFixedValuesService.create).toHaveBeenCalledWith(
            'metahub-1',
            expect.objectContaining({
                valueGroupId: 'set-1',
                uiConfig: {
                    sharedBehavior: {
                        canDeactivate: true,
                        canExclude: false,
                        positionLocked: true
                    }
                }
            }),
            'test-user-id'
        )
        expect(response.body).toMatchObject({ id: 'constant-1', codename: 'WelcomeText' })
    })

    it('POST /metahub/:metahubId/set/:valueGroupId/fixed-values accepts the direct set kind contract', async () => {
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'custom-set-1',
            kind: 'set',
            codename: 'CustomSet',
            config: { hubs: [] }
        })
        mockEntityTypeService.listEditableTypes.mockResolvedValueOnce([
            {
                kindKey: 'set',
                config: { compatibility: { legacyObjectKind: 'set' } }
            }
        ])
        mockFixedValuesService.create.mockResolvedValue({
            id: 'constant-1',
            valueGroupId: 'custom-set-1',
            codename: 'CustomValue',
            dataType: 'STRING',
            value: 'Hello'
        })

        const app = buildApp()
        const response = await request(app)
            .post('/metahub/metahub-1/entities/set/instance/custom-set-1/fixed-values')
            .send({
                codename: testCodenameVlc('custom-value'),
                dataType: 'STRING',
                name: 'Custom Value',
                value: 'Hello'
            })
            .expect(201)

        expect(mockFixedValuesService.create).toHaveBeenCalledWith(
            'metahub-1',
            expect.objectContaining({ valueGroupId: 'custom-set-1', dataType: 'STRING', value: 'Hello' }),
            'test-user-id'
        )
        expect(response.body).toMatchObject({ id: 'constant-1', valueGroupId: 'custom-set-1', codename: 'CustomValue' })
    })

    it('PATCH /metahub/:metahubId/set/:valueGroupId/fixed-values/reorder rejects unknown payload fields via strict schema', async () => {
        const app = buildApp()
        const response = await request(app)
            .patch('/metahub/metahub-1/entities/set/instance/set-1/fixed-values/reorder')
            .send({
                fixedValueId: '11111111-1111-1111-1111-111111111111',
                newSortOrder: 2,
                newParentConstantId: '33333333-3333-3333-3333-333333333333'
            })
            .expect(400)

        expect(response.body.error).toBe('Validation failed')
        expect(mockFixedValuesService.reorderConstant).not.toHaveBeenCalled()
    })

    it('POST /metahub/:metahubId/set/:valueGroupId/fixed-values rejects invalid STRING regex pattern', async () => {
        const app = buildApp()
        const response = await request(app)
            .post('/metahub/metahub-1/entities/set/instance/set-1/fixed-values')
            .send({
                codename: testCodenameVlc('welcome-text'),
                dataType: 'STRING',
                name: 'Welcome Text',
                validationRules: {
                    pattern: '['
                },
                value: 'Hello'
            })
            .expect(400)

        expect(response.body.error).toBe('STRING validation pattern is invalid')
        expect(mockFixedValuesService.create).not.toHaveBeenCalled()
    })

    it('PATCH /metahub/:metahubId/set/:valueGroupId/fixed-values/reorder calls reorder service for valid payload', async () => {
        const app = buildApp()
        await request(app)
            .patch('/metahub/metahub-1/entities/set/instance/set-1/fixed-values/reorder')
            .send({
                fixedValueId: '11111111-1111-1111-1111-111111111111',
                newSortOrder: 2
            })
            .expect(200)

        expect(mockFixedValuesService.reorderConstant).toHaveBeenCalledWith(
            'metahub-1',
            'set-1',
            '11111111-1111-1111-1111-111111111111',
            2,
            'test-user-id'
        )
    })

    it('PATCH /metahub/:metahubId/set/:valueGroupId/fixed-values/reorder calls merged reorder service when mergedOrderIds are provided', async () => {
        const app = buildApp()
        await request(app)
            .patch('/metahub/metahub-1/entities/set/instance/set-1/fixed-values/reorder')
            .send({
                fixedValueId: '11111111-1111-1111-1111-111111111111',
                newSortOrder: 2,
                mergedOrderIds: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']
            })
            .expect(200)

        expect(mockFixedValuesService.reorderConstantMergedOrder).toHaveBeenCalledWith(
            'metahub-1',
            'set-1',
            '11111111-1111-1111-1111-111111111111',
            ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'],
            'test-user-id'
        )
        expect(mockFixedValuesService.reorderConstant).not.toHaveBeenCalled()
    })

    it('DELETE /metahub/:metahubId/set/:valueGroupId/fixed-value/:fixedValueId blocks deletion when attribute references exist', async () => {
        mockFixedValuesService.findById.mockResolvedValue({
            id: 'constant-1',
            valueGroupId: 'set-1',
            codename: 'TaxRate'
        })
        mockFixedValuesService.findAttributeReferenceBlockersByConstant.mockResolvedValue(true)

        const app = buildApp()
        const response = await request(app).delete('/metahub/metahub-1/entities/set/instance/set-1/fixed-value/constant-1').expect(409)

        expect(response.body.code).toBe('CONSTANT_DELETE_BLOCKED_BY_REFERENCES')
        expect(mockFixedValuesService.delete).not.toHaveBeenCalled()
    })

    it('POST /metahub/:metahubId/set/:valueGroupId/fixed-value/:fixedValueId/copy copies fixed value without value when copyValue=false', async () => {
        mockFixedValuesService.findById.mockResolvedValue({
            id: 'constant-source',
            valueGroupId: 'set-1',
            codename: 'TaxRate',
            dataType: 'NUMBER',
            name: { en: 'Tax Rate' },
            validationRules: {},
            uiConfig: {},
            value: 20
        })
        mockFixedValuesService.create.mockResolvedValue({
            id: 'constant-copy',
            valueGroupId: 'set-1',
            codename: 'TaxRateCopy',
            value: null
        })

        const app = buildApp()
        const response = await request(app)
            .post('/metahub/metahub-1/entities/set/instance/set-1/fixed-value/constant-source/copy')
            .send({ copyValue: false })
            .expect(201)

        expect(mockFixedValuesService.create).toHaveBeenCalledWith(
            'metahub-1',
            expect.objectContaining({ valueGroupId: 'set-1', value: null }),
            'test-user-id'
        )
        expect(response.body).toMatchObject({ id: 'constant-copy' })
    })
})
