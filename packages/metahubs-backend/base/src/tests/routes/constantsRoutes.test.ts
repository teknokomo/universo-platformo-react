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
import { createConstantsRoutes } from '../../domains/constants/routes/constantsRoutes'

const mockEnsureMetahubAccess = jest.fn()

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

const mockConstantsService = {
    findAll: jest.fn(),
    countByObjectId: jest.fn(),
    findById: jest.fn(),
    findByCodename: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    moveConstant: jest.fn(),
    reorderConstant: jest.fn(),
    findAttributeReferenceBlockersByConstant: jest.fn()
}

const mockObjectsService = {
    findById: jest.fn()
}

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/metahubs/services/MetahubConstantsService', () => ({
    __esModule: true,
    MetahubConstantsService: jest.fn().mockImplementation(() => mockConstantsService)
}))

jest.mock('../../domains/metahubs/services/MetahubObjectsService', () => ({
    __esModule: true,
    MetahubObjectsService: jest.fn().mockImplementation(() => mockObjectsService)
}))

const mockSettingsService = {
    findByKey: jest.fn(async (_metahubId: string, key: string) => {
        const values: Record<string, unknown> = {
            'general.codenameStyle': 'pascal-case',
            'general.codenameAlphabet': 'en-ru',
            'general.codenameAllowMixedAlphabets': false,
            'sets.allowedConstantTypes': ['STRING', 'NUMBER', 'BOOLEAN', 'DATE']
        }
        return key in values ? { key, value: { _value: values[key] } } : null
    }),
    findAll: jest.fn(async () => [])
}

jest.mock('../../domains/settings/services/MetahubSettingsService', () => ({
    __esModule: true,
    MetahubSettingsService: jest.fn().mockImplementation(() => mockSettingsService)
}))

describe('Constants Routes', () => {
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
        app.use(createConstantsRoutes(ensureAuth, () => mockExecutor, mockRateLimiter, mockRateLimiter))
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
        mockObjectsService.findById.mockResolvedValue(activeSet)

        mockConstantsService.findAll.mockResolvedValue([])
        mockConstantsService.countByObjectId.mockResolvedValue(0)
        mockConstantsService.findById.mockResolvedValue(null)
        mockConstantsService.findByCodename.mockResolvedValue(null)
        mockConstantsService.create.mockResolvedValue({})
        mockConstantsService.update.mockResolvedValue({})
        mockConstantsService.delete.mockResolvedValue(undefined)
        mockConstantsService.moveConstant.mockResolvedValue({})
        mockConstantsService.reorderConstant.mockResolvedValue({ id: 'constant-1', sortOrder: 2 })
        mockConstantsService.findAttributeReferenceBlockersByConstant.mockResolvedValue(false)
    })

    it('GET /metahub/:metahubId/set/:setId/constants returns list with pagination and meta', async () => {
        mockConstantsService.findAll.mockResolvedValue([
            {
                id: 'constant-1',
                setId: 'set-1',
                codename: 'TaxRate',
                name: { en: 'Tax Rate' },
                sortOrder: 1,
                createdAt: '2026-03-04T10:00:00.000Z',
                updatedAt: '2026-03-04T10:00:00.000Z'
            }
        ])

        const app = buildApp()
        const response = await request(app).get('/metahub/metahub-1/set/set-1/constants').expect(200)

        expect(response.body.items).toHaveLength(1)
        expect(response.body.pagination).toMatchObject({ total: 1, limit: 100, offset: 0 })
        expect(response.body.meta).toMatchObject({ totalAll: 1, limitReached: false })
    })

    it('POST /metahub/:metahubId/set/:setId/constants creates NUMBER constant with parsed numeric value', async () => {
        mockConstantsService.create.mockResolvedValue({
            id: 'constant-1',
            setId: 'set-1',
            codename: 'TaxRate',
            dataType: 'NUMBER',
            value: 20
        })

        const app = buildApp()
        const response = await request(app)
            .post('/metahub/metahub-1/set/set-1/constants')
            .send({
                codename: 'tax-rate',
                dataType: 'NUMBER',
                name: 'Tax Rate',
                value: '20'
            })
            .expect(201)

        expect(mockConstantsService.create).toHaveBeenCalledWith(
            'metahub-1',
            expect.objectContaining({ codename: 'TaxRate', dataType: 'NUMBER', value: 20 }),
            'test-user-id'
        )
        expect(response.body).toMatchObject({ id: 'constant-1', codename: 'TaxRate' })
    })

    it('PATCH /metahub/:metahubId/set/:setId/constants/reorder rejects unknown payload fields via strict schema', async () => {
        const app = buildApp()
        const response = await request(app)
            .patch('/metahub/metahub-1/set/set-1/constants/reorder')
            .send({
                constantId: '11111111-1111-1111-1111-111111111111',
                newSortOrder: 2,
                newParentConstantId: '33333333-3333-3333-3333-333333333333'
            })
            .expect(400)

        expect(response.body.error).toBe('Validation failed')
        expect(mockConstantsService.reorderConstant).not.toHaveBeenCalled()
    })

    it('POST /metahub/:metahubId/set/:setId/constants rejects invalid STRING regex pattern', async () => {
        const app = buildApp()
        const response = await request(app)
            .post('/metahub/metahub-1/set/set-1/constants')
            .send({
                codename: 'welcome-text',
                dataType: 'STRING',
                name: 'Welcome Text',
                validationRules: {
                    pattern: '['
                },
                value: 'Hello'
            })
            .expect(400)

        expect(response.body.error).toBe('STRING validation pattern is invalid')
        expect(mockConstantsService.create).not.toHaveBeenCalled()
    })

    it('PATCH /metahub/:metahubId/set/:setId/constants/reorder calls reorder service for valid payload', async () => {
        const app = buildApp()
        await request(app)
            .patch('/metahub/metahub-1/set/set-1/constants/reorder')
            .send({
                constantId: '11111111-1111-1111-1111-111111111111',
                newSortOrder: 2
            })
            .expect(200)

        expect(mockConstantsService.reorderConstant).toHaveBeenCalledWith(
            'metahub-1',
            'set-1',
            '11111111-1111-1111-1111-111111111111',
            2,
            'test-user-id'
        )
    })

    it('DELETE /metahub/:metahubId/set/:setId/constant/:constantId blocks deletion when attribute references exist', async () => {
        mockConstantsService.findById.mockResolvedValue({
            id: 'constant-1',
            setId: 'set-1',
            codename: 'TaxRate'
        })
        mockConstantsService.findAttributeReferenceBlockersByConstant.mockResolvedValue(true)

        const app = buildApp()
        const response = await request(app).delete('/metahub/metahub-1/set/set-1/constant/constant-1').expect(409)

        expect(response.body.code).toBe('CONSTANT_DELETE_BLOCKED_BY_REFERENCES')
        expect(mockConstantsService.delete).not.toHaveBeenCalled()
    })

    it('POST /metahub/:metahubId/set/:setId/constant/:constantId/copy copies constant without value when copyValue=false', async () => {
        mockConstantsService.findById.mockResolvedValue({
            id: 'constant-source',
            setId: 'set-1',
            codename: 'TaxRate',
            dataType: 'NUMBER',
            name: { en: 'Tax Rate' },
            validationRules: {},
            uiConfig: {},
            value: 20
        })
        mockConstantsService.create.mockResolvedValue({
            id: 'constant-copy',
            setId: 'set-1',
            codename: 'TaxRateCopy',
            value: null
        })

        const app = buildApp()
        const response = await request(app)
            .post('/metahub/metahub-1/set/set-1/constant/constant-source/copy')
            .send({ copyValue: false })
            .expect(201)

        expect(mockConstantsService.create).toHaveBeenCalledWith(
            'metahub-1',
            expect.objectContaining({ setId: 'set-1', value: null }),
            'test-user-id'
        )
        expect(response.body).toMatchObject({ id: 'constant-copy' })
    })
})
