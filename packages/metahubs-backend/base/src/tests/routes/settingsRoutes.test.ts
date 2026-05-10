import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createMockDbExecutor } from '../utils/dbMocks'
import { createSettingsRoutes } from '../../domains/settings/routes/settingsRoutes'

const mockEnsureMetahubAccess = jest.fn()
const mockEnsureSchema = jest.fn(async () => 'mhb_test_schema')
const mockListEntityTypes = jest.fn(async () => [
    { kindKey: 'hub' },
    { kindKey: 'page' },
    { kindKey: 'catalog' },
    { kindKey: 'set' },
    { kindKey: 'enumeration' },
    { kindKey: 'ledger' }
])

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn().mockImplementation(() => ({
        ensureSchema: (...args: unknown[]) => mockEnsureSchema(...args)
    }))
}))

jest.mock('../../domains/entities/services/EntityTypeService', () => ({
    __esModule: true,
    EntityTypeService: jest.fn().mockImplementation(() => ({
        listTypes: (...args: unknown[]) => mockListEntityTypes(...args)
    }))
}))

const mockSettingsService = {
    findAll: jest.fn(async () => []),
    findByKey: jest.fn(async () => null),
    bulkUpsert: jest.fn(async () => []),
    clearHubNesting: jest.fn(async () => 0),
    resetToDefault: jest.fn(async () => undefined),
    hasHubNesting: jest.fn(async () => false)
}

jest.mock('../../domains/settings/services/MetahubSettingsService', () => ({
    __esModule: true,
    MetahubSettingsService: jest.fn().mockImplementation(() => mockSettingsService)
}))

describe('Settings Routes', () => {
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
        const mockExecutor = createMockDbExecutor()

        const app = express()
        app.use(express.json())
        app.use(createSettingsRoutes(ensureAuth, () => mockExecutor, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureMetahubAccess.mockResolvedValue({ metahubId: 'metahub-1' })
        mockEnsureSchema.mockResolvedValue('mhb_test_schema')
        mockListEntityTypes.mockResolvedValue([
            { kindKey: 'hub' },
            { kindKey: 'page' },
            { kindKey: 'catalog' },
            { kindKey: 'set' },
            { kindKey: 'enumeration' },
            { kindKey: 'ledger' }
        ])
        mockSettingsService.findAll.mockResolvedValue([])
        mockSettingsService.hasHubNesting.mockResolvedValue(false)
    })

    it('runs one-shot hub nesting reset when resetNestingOnce=true and allowNesting=false', async () => {
        mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
            if (key === 'entity.hub.allowNesting') return { key, value: { _value: false } }
            return null
        })

        const app = buildApp()
        await request(app)
            .put('/metahub/metahub-1/settings')
            .send({
                settings: [
                    { key: 'entity.hub.allowNesting', value: { _value: false } },
                    { key: 'entity.hub.resetNestingOnce', value: { _value: true } }
                ]
            })
            .expect(200)

        expect(mockSettingsService.bulkUpsert).toHaveBeenCalledTimes(1)
        expect(mockSettingsService.clearHubNesting).toHaveBeenCalledWith('metahub-1', 'test-user-id')
        expect(mockSettingsService.resetToDefault).toHaveBeenCalledWith('metahub-1', 'entity.hub.resetNestingOnce', 'test-user-id')
    })

    it('runs one-shot hub nesting reset when allowNesting=true', async () => {
        mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
            if (key === 'entity.hub.allowNesting') return { key, value: { _value: true } }
            return null
        })

        const app = buildApp()
        await request(app)
            .put('/metahub/metahub-1/settings')
            .send({
                settings: [
                    { key: 'entity.hub.allowNesting', value: { _value: true } },
                    { key: 'entity.hub.resetNestingOnce', value: { _value: true } }
                ]
            })
            .expect(200)

        expect(mockSettingsService.bulkUpsert).toHaveBeenCalledTimes(1)
        expect(mockSettingsService.clearHubNesting).toHaveBeenCalledWith('metahub-1', 'test-user-id')
        expect(mockSettingsService.resetToDefault).toHaveBeenCalledWith('metahub-1', 'entity.hub.resetNestingOnce', 'test-user-id')
    })
})
