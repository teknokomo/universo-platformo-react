const mockEnsureMetahubAccess = jest.fn(async () => undefined)

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createMockDbExecutor } from '../utils/dbMocks'
import { createElementsRoutes } from '../../domains/elements/routes/elementsRoutes'

const mockElementsService = {
    findAllAndCount: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    moveElement: jest.fn(),
    reorderElement: jest.fn()
}

const mockAttributesService = {
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

jest.mock('../../domains/metahubs/services/MetahubAttributesService', () => ({
    __esModule: true,
    MetahubAttributesService: jest.fn().mockImplementation(() => mockAttributesService)
}))

jest.mock('../../domains/metahubs/services/MetahubElementsService', () => ({
    __esModule: true,
    MetahubElementsService: jest.fn().mockImplementation(() => mockElementsService)
}))

describe('Elements Routes', () => {
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
        app.use(createElementsRoutes(ensureAuth, () => mockExecutor, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockElementsService.moveElement.mockResolvedValue({
            id: '55555555-5555-4555-8555-555555555555',
            sortOrder: 2
        })
        mockElementsService.reorderElement.mockResolvedValue({
            id: '55555555-5555-4555-8555-555555555555',
            sortOrder: 2
        })
    })

    it('PATCH /metahub/:metahubId/catalog/:catalogId/element/:elementId/move moves element', async () => {
        const app = buildApp()
        const response = await request(app)
            .patch('/metahub/metahub-1/catalog/catalog-1/element/55555555-5555-4555-8555-555555555555/move')
            .send({ direction: 'up' })
            .expect(200)

        expect(response.body).toMatchObject({
            id: '55555555-5555-4555-8555-555555555555',
            sortOrder: 2
        })
        expect(mockElementsService.moveElement).toHaveBeenCalledWith(
            'metahub-1',
            'catalog-1',
            '55555555-5555-4555-8555-555555555555',
            'up',
            'test-user-id'
        )
    })

    it('PATCH /metahub/:metahubId/catalog/:catalogId/element/:elementId/move returns 404 when missing', async () => {
        const missingError = Object.assign(new Error('Element not found'), { code: 'ELEMENT_NOT_FOUND' })
        mockElementsService.moveElement.mockRejectedValueOnce(missingError)

        const app = buildApp()
        const response = await request(app)
            .patch('/metahub/metahub-1/catalog/catalog-1/element/55555555-5555-4555-8555-555555555555/move')
            .send({ direction: 'down' })
            .expect(404)

        expect(response.body.error).toBe('Element not found')
    })

    it('PATCH /metahub/:metahubId/catalog/:catalogId/elements/reorder reorders element', async () => {
        const app = buildApp()
        const response = await request(app)
            .patch('/metahub/metahub-1/catalog/catalog-1/elements/reorder')
            .send({
                elementId: '55555555-5555-4555-8555-555555555555',
                newSortOrder: 2
            })
            .expect(200)

        expect(response.body).toMatchObject({
            id: '55555555-5555-4555-8555-555555555555',
            sortOrder: 2
        })
        expect(mockElementsService.reorderElement).toHaveBeenCalledWith(
            'metahub-1',
            'catalog-1',
            '55555555-5555-4555-8555-555555555555',
            2,
            'test-user-id'
        )
    })

    it('PATCH /metahub/:metahubId/catalog/:catalogId/elements/reorder validates payload', async () => {
        const app = buildApp()
        const response = await request(app)
            .patch('/metahub/metahub-1/catalog/catalog-1/elements/reorder')
            .send({
                elementId: 'bad-id',
                newSortOrder: 0
            })
            .expect(400)

        expect(response.body.error).toBe('Validation failed')
        expect(mockElementsService.reorderElement).not.toHaveBeenCalled()
    })
})
