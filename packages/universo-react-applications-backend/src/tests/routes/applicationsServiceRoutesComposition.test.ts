import type { NextFunction, Request, Response } from 'express'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createMockDbExecutor } from '../utils/dbMocks'
import { createApplicationsServiceRoutes, initializeRateLimiters } from '../../routes'

type QueryScope = 'root' | 'tx'
type QueryHandler = (sql: string, params: unknown[], scope: QueryScope) => unknown[] | undefined

// Anonymous-denying guard that mirrors the real ensureAuth contract: missing
// bearer token must produce 401 before any controller logic runs.
const rejectingEnsureAuth = (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized Access: Missing session token' })
    }
    return next()
}

const buildDataSource = (handler?: QueryHandler) => {
    const { executor, txExecutor } = createMockDbExecutor()
    const respond = async (sql: string, params: unknown[] = [], scope: QueryScope) => {
        const override = handler?.(sql, params, scope)
        if (override !== undefined) {
            return override
        }
        return []
    }

    ;(executor.query as jest.Mock).mockImplementation((sql: string, params: unknown[] = []) => respond(sql, params, 'root'))
    ;(txExecutor.query as jest.Mock).mockImplementation((sql: string, params: unknown[] = []) => respond(sql, params, 'tx'))
    ;(executor.transaction as jest.Mock).mockImplementation(async (callback: (trx: typeof txExecutor) => Promise<unknown>) =>
        callback(txExecutor)
    )

    return executor
}

const buildApp = (dataSource: ReturnType<typeof buildDataSource>, loadPublishedPublicationRuntimeSource = async () => null) => {
    const app = express()
    app.use(express.json())
    app.use(
        '/',
        createApplicationsServiceRoutes(rejectingEnsureAuth, () => dataSource, loadPublishedPublicationRuntimeSource, {
            getRequestDbExecutor: () => dataSource
        })
    )
    app.use((_req: Request, res: Response) => res.status(404).json({ code: 'NOT_HANDLED' }))
    return app
}

describe('applications service route composition', () => {
    beforeAll(async () => {
        await initializeRateLimiters()
    })

    it('keeps anonymous guest access-link endpoints reachable behind the authenticated alias router', async () => {
        const dataSource = buildDataSource((sql) => {
            if (sql.includes('FROM applications.obj_applications') && sql.includes('links')) return []
            return undefined
        })
        const app = buildApp(dataSource)

        // The alias sub-router mounts `use(ensureAuth)`; if it ran before the
        // guest router, this anonymous request would fail with 401 instead of
        // reaching the public guest controller.
        const response = await request(app).get('/public/a/0198c0de-0000-7000-8000-000000000001/links/some-slug')
        expect(response.status).not.toBe(401)
    })

    it('still rejects anonymous alias management with 401', async () => {
        const dataSource = buildDataSource()
        const app = buildApp(dataSource)

        const response = await request(app).get('/application-aliases')
        expect(response.status).toBe(401)
    })

    it('keeps the anonymous public runtime endpoint reachable without credentials', async () => {
        const dataSource = buildDataSource((sql) => {
            if (sql.includes('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')) return []
            if (sql.includes('applications.obj_application_aliases')) return []
            return undefined
        })
        const app = buildApp(dataSource)

        const response = await request(app).get('/public/applications/0198c0de-0000-7000-8000-000000000001/runtime')
        // The mocked database has no application rows, so the boundary must
        // collapse the result to the single public-unavailable outcome and
        // never leak an authentication requirement.
        expect(response.status).toBe(404)
        expect(response.body).toEqual({ code: 'PUBLIC_APPLICATION_NOT_AVAILABLE' })
    })
})
