import type { NextFunction, Request, Response } from 'express'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

const mockEnsureApplicationAccess = jest.fn()

jest.mock('../../routes/guards', () => ({
    ensureApplicationAccess: (...args: unknown[]) => mockEnsureApplicationAccess(...args)
}))

import { createApplicationRuntimeReferenceController } from '../../controllers/applicationRuntimeReferenceController'
import { createMockDbExecutor } from '../utils/dbMocks'

const applicationId = '0190a9b5-3cde-7abc-8def-0123456789ab'
const userId = '0190a9b5-3cde-7abc-8def-0123456789ac'

const buildApp = (queryImplementation?: (sql: string, parameters?: unknown[]) => unknown) => {
    const { executor } = createMockDbExecutor()
    if (queryImplementation) {
        executor.query.mockImplementation((sql: string, parameters?: unknown[]) => queryImplementation(sql, parameters))
    }
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
        mockEnsureApplicationAccess.mockResolvedValue(undefined)
    })

    it('resolves an active alias through the SECURITY DEFINER resolver and verifies the normal application access guard', async () => {
        const { app, executor } = buildApp((sql) => (sql.includes('applications.resolve_application_alias') ? [{ applicationId }] : []))

        const response = await request(app).get('/runtime-reference/meridian-73')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({ applicationId })
        expect(String(executor.query.mock.calls[0]?.[0])).toContain('applications.resolve_application_alias($1)')
        expect(executor.query.mock.calls[0]?.[1]).toEqual(['meridian-73'])
        expect(mockEnsureApplicationAccess).toHaveBeenCalledWith(executor, userId, applicationId)
    })

    it('resolves a closed-application alias for a plain member without reading the alias table under RLS', async () => {
        const { app, executor } = buildApp((sql) => {
            if (sql.includes('applications.resolve_application_alias')) return [{ applicationId }]
            if (sql.includes('applications.obj_application_aliases')) return []
            return []
        })

        const response = await request(app).get('/runtime-reference/private-app')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({ applicationId })
        expect(mockEnsureApplicationAccess).toHaveBeenCalledWith(executor, userId, applicationId)
        for (const [sql] of executor.query.mock.calls) {
            expect(String(sql)).not.toContain('FROM applications.obj_application_aliases')
        }
    })

    it('does not query aliases for a UUID v7 reference', async () => {
        const { app, executor } = buildApp()

        const response = await request(app).get(`/runtime-reference/${applicationId}`)

        expect(response.status).toBe(200)
        expect(response.body).toEqual({ applicationId })
        expect(executor.query).not.toHaveBeenCalled()
        expect(mockEnsureApplicationAccess).toHaveBeenCalledWith(executor, userId, applicationId)
    })

    it('returns a generic not-found response for malformed or unknown references', async () => {
        const { app, executor } = buildApp()

        const malformed = await request(app).get('/runtime-reference/bad%252Falias')
        expect(malformed.status).toBe(404)
        expect(malformed.body).toEqual({ error: 'Application not found' })
        expect(executor.query).not.toHaveBeenCalled()

        executor.query.mockResolvedValueOnce([])
        const unknown = await request(app).get('/runtime-reference/unknown-app')
        expect(unknown.status).toBe(404)
        expect(unknown.body).toEqual({ error: 'Application not found' })
        expect(mockEnsureApplicationAccess).not.toHaveBeenCalled()
    })

    it('hides a known private alias from users who do not have application access', async () => {
        const { app } = buildApp((sql) => (sql.includes('applications.resolve_application_alias') ? [{ applicationId }] : []))
        mockEnsureApplicationAccess.mockRejectedValueOnce(Object.assign(new Error('Access denied'), { statusCode: 403 }))

        const response = await request(app).get('/runtime-reference/private-app')

        expect(response.status).toBe(404)
        expect(response.body).toEqual({ error: 'Application not found' })
    })
})
