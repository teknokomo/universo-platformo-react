import type { NextFunction, Request, Response } from 'express'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

const mockEnsureApplicationAccess = jest.fn()
const mockFindApplicationIdByActiveAlias = jest.fn()

jest.mock('../../routes/guards', () => ({
    ensureApplicationAccess: (...args: unknown[]) => mockEnsureApplicationAccess(...args)
}))

jest.mock('../../persistence/applicationAliasesStore', () => ({
    findApplicationIdByActiveAlias: (...args: unknown[]) => mockFindApplicationIdByActiveAlias(...args)
}))

import { createApplicationRuntimeReferenceController } from '../../controllers/applicationRuntimeReferenceController'

const applicationId = '0190a9b5-3cde-7abc-8def-0123456789ab'
const userId = '0190a9b5-3cde-7abc-8def-0123456789ac'

const buildApp = () => {
    const executor = { query: jest.fn() }
    const app = express()
    app.use((req: Request, _res: Response, next: NextFunction) => {
        ;(req as Request & { user?: { id: string } }).user = { id: userId }
        next()
    })
    const controller = createApplicationRuntimeReferenceController(
        () => executor as never,
        () => executor as never
    )
    app.get('/runtime-reference/:applicationRef', async (req, res, next) => {
        try {
            await controller.resolve(req, res)
        } catch (error) {
            next(error)
        }
    })
    app.use((error: { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
        res.status(error.statusCode ?? error.status ?? 500).json({ error: 'request failed' })
    })
    return { app, executor }
}

describe('application runtime reference controller', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockFindApplicationIdByActiveAlias.mockResolvedValue(applicationId)
        mockEnsureApplicationAccess.mockResolvedValue(undefined)
    })

    it('resolves an active alias and verifies the normal application access guard', async () => {
        const { app, executor } = buildApp()

        const response = await request(app).get('/runtime-reference/meridian-73')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({ applicationId })
        expect(mockFindApplicationIdByActiveAlias).toHaveBeenCalledWith(executor, 'meridian-73')
        expect(mockEnsureApplicationAccess).toHaveBeenCalledWith(executor, userId, applicationId)
    })

    it('does not query aliases for a UUID v7 reference', async () => {
        const { app, executor } = buildApp()

        const response = await request(app).get(`/runtime-reference/${applicationId}`)

        expect(response.status).toBe(200)
        expect(response.body).toEqual({ applicationId })
        expect(mockFindApplicationIdByActiveAlias).not.toHaveBeenCalled()
        expect(mockEnsureApplicationAccess).toHaveBeenCalledWith(executor, userId, applicationId)
    })

    it('returns a generic not-found response for malformed or unknown references', async () => {
        const { app } = buildApp()

        const malformed = await request(app).get('/runtime-reference/bad%252Falias')
        expect(malformed.status).toBe(404)
        expect(malformed.body).toEqual({ error: 'Application not found' })
        expect(mockFindApplicationIdByActiveAlias).not.toHaveBeenCalled()

        mockFindApplicationIdByActiveAlias.mockResolvedValueOnce(null)
        const unknown = await request(app).get('/runtime-reference/unknown-app')
        expect(unknown.status).toBe(404)
        expect(unknown.body).toEqual({ error: 'Application not found' })
        expect(mockEnsureApplicationAccess).not.toHaveBeenCalled()
    })

    it('hides a known private alias from users who do not have application access', async () => {
        const { app } = buildApp()
        mockEnsureApplicationAccess.mockRejectedValueOnce(Object.assign(new Error('Access denied'), { statusCode: 403 }))

        const response = await request(app).get('/runtime-reference/private-app')

        expect(response.status).toBe(404)
        expect(response.body).toEqual({ error: 'Application not found' })
    })
})
