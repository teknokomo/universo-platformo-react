const mockEnsureMetahubAccess = jest.fn(async () => undefined)

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

import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createMockDbExecutor } from '../utils/dbMocks'
import { createEntityRecordRoutes } from '../../domains/entities/metadata/record/routes'
import { MetahubNotFoundError } from '../../domains/shared/domainErrors'

const mockRecordsService = {
    findAllAndCount: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    moveRecord: jest.fn(),
    reorderRecord: jest.fn()
}

const mockFieldDefinitionsService = {
    findAllFlat: jest.fn()
}

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/metahubs/services/MetahubObjectsService', () => ({
    __esModule: true,
    MetahubObjectsService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/metahubs/services/MetahubFieldDefinitionsService', () => ({
    __esModule: true,
    MetahubFieldDefinitionsService: jest.fn().mockImplementation(() => mockFieldDefinitionsService)
}))

jest.mock('../../domains/metahubs/services/MetahubRecordsService', () => ({
    __esModule: true,
    MetahubRecordsService: jest.fn().mockImplementation(() => mockRecordsService)
}))

describe('Record Routes', () => {
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
        app.use(createEntityRecordRoutes(ensureAuth, () => mockExecutor, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockRecordsService.moveRecord.mockResolvedValue({
            id: '55555555-5555-4555-8555-555555555555',
            sortOrder: 2
        })
        mockRecordsService.reorderRecord.mockResolvedValue({
            id: '55555555-5555-4555-8555-555555555555',
            sortOrder: 2
        })
    })

    it('PATCH /metahub/:metahubId/catalog/:linkedCollectionId/record/:recordId/move moves record', async () => {
        const app = buildApp()
        const response = await request(app)
            .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/record/55555555-5555-4555-8555-555555555555/move')
            .send({ direction: 'up' })
            .expect(200)

        expect(response.body).toMatchObject({
            id: '55555555-5555-4555-8555-555555555555',
            sortOrder: 2
        })
        expect(mockRecordsService.moveRecord).toHaveBeenCalledWith(
            'metahub-1',
            'catalog-1',
            '55555555-5555-4555-8555-555555555555',
            'up',
            'test-user-id'
        )
    })

    it('PATCH /metahub/:metahubId/catalog/:linkedCollectionId/record/:recordId/move returns 404 when missing', async () => {
        const missingError = new MetahubNotFoundError('Element', '55555555-5555-4555-8555-555555555555')
        mockRecordsService.moveRecord.mockRejectedValueOnce(missingError)

        const app = buildApp()
        const response = await request(app)
            .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/record/55555555-5555-4555-8555-555555555555/move')
            .send({ direction: 'down' })
            .expect(404)

        expect(response.body.error).toBe('Element not found')
    })

    it('PATCH /metahub/:metahubId/catalog/:linkedCollectionId/records/reorder reorders record', async () => {
        const app = buildApp()
        const response = await request(app)
            .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/records/reorder')
            .send({
                recordId: '55555555-5555-4555-8555-555555555555',
                newSortOrder: 2
            })
            .expect(200)

        expect(response.body).toMatchObject({
            id: '55555555-5555-4555-8555-555555555555',
            sortOrder: 2
        })
        expect(mockRecordsService.reorderRecord).toHaveBeenCalledWith(
            'metahub-1',
            'catalog-1',
            '55555555-5555-4555-8555-555555555555',
            2,
            'test-user-id'
        )
    })

    it('PATCH /metahub/:metahubId/catalog/:linkedCollectionId/records/reorder validates payload', async () => {
        const app = buildApp()
        const response = await request(app)
            .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/records/reorder')
            .send({
                recordId: 'bad-id',
                newSortOrder: 0
            })
            .expect(400)

        expect(response.body.error).toBe('Validation failed')
        expect(mockRecordsService.reorderRecord).not.toHaveBeenCalled()
    })
})
