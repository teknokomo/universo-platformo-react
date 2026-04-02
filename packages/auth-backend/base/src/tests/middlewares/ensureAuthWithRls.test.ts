import type { NextFunction, Request, Response } from 'express'

jest.mock('../../middlewares/ensureAuth', () => ({
    ensureAuth: jest.fn((_req: Request, _res: Response, next: NextFunction) => next())
}))

jest.mock('../../utils/rlsContext', () => ({
    applyRlsContext: jest.fn()
}))

jest.mock('@universo/database', () => ({
    convertPgBindings: jest.requireActual('@universo/database').convertPgBindings,
    createRlsExecutor: jest.fn(() => ({
        query: jest.fn(),
        transaction: jest.fn(),
        isReleased: jest.fn(() => false)
    }))
}))

import { ensureAuth } from '../../middlewares/ensureAuth'
import { createRlsExecutor } from '@universo/database'
import { applyRlsContext } from '../../utils/rlsContext'
import { createEnsureAuthWithRls } from '../../middlewares/ensureAuthWithRls'

const mockedEnsureAuth = ensureAuth as jest.MockedFunction<typeof ensureAuth>
const mockedCreateRlsExecutor = createRlsExecutor as jest.MockedFunction<typeof createRlsExecutor>
const mockedApplyRlsContext = applyRlsContext as jest.MockedFunction<typeof applyRlsContext>

const createResponse = () => {
    const eventHandlers = new Map<string, () => Promise<void> | void>()
    const res = {
        once: jest.fn((event: string, handler: () => Promise<void> | void) => {
            eventHandlers.set(event, handler)
            return res
        }),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        emit: async (event: string) => {
            const handler = eventHandlers.get(event)
            if (handler) {
                await handler()
            }
        }
    }

    return res as unknown as Response & {
        once: jest.Mock
        status: jest.Mock
        json: jest.Mock
        emit: (event: string) => Promise<void>
    }
}

describe('createEnsureAuthWithRls', () => {
    beforeEach(() => {
        mockedEnsureAuth.mockImplementation((_req, _res, next) => next())
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('skips auth and RLS for whitelisted API paths', async () => {
        const next = jest.fn()
        const getKnex = jest.fn()
        const middleware = createEnsureAuthWithRls({ getKnex: getKnex as never })
        const req = {
            originalUrl: '/api/v1/ping',
            url: '/api/v1/ping',
            path: '/api/v1/ping',
            method: 'GET'
        } as unknown as Request
        const res = createResponse()

        await middleware(req, res, next)

        expect(next).toHaveBeenCalledTimes(1)
        expect(mockedEnsureAuth).not.toHaveBeenCalled()
        expect(getKnex).not.toHaveBeenCalled()
    })

    it('reuses an existing active request db context', async () => {
        const next = jest.fn()
        const getKnex = jest.fn()
        const middleware = createEnsureAuthWithRls({ getKnex: getKnex as never })
        const req = {
            originalUrl: '/api/private',
            url: '/api/private',
            path: '/api/private',
            method: 'GET',
            session: { tokens: { access: 'token' } },
            user: { id: 'user-1' },
            dbContext: {
                session: { query: jest.fn(), isReleased: jest.fn(() => false) },
                executor: { query: jest.fn(), transaction: jest.fn() },
                isReleased: jest.fn(() => false),
                release: jest.fn()
            }
        } as unknown as Request
        const res = createResponse()

        await middleware(req, res, next)

        expect(next).toHaveBeenCalledTimes(1)
        expect(getKnex).not.toHaveBeenCalled()
    })

    it('returns 401 when the authenticated request has no access token', async () => {
        const next = jest.fn()
        const getKnex = jest.fn()
        const middleware = createEnsureAuthWithRls({ getKnex: getKnex as never })
        const req = {
            originalUrl: '/api/private',
            url: '/api/private',
            path: '/api/private',
            method: 'GET',
            session: { tokens: {} },
            user: { id: 'user-1' }
        } as unknown as Request
        const res = createResponse()

        await middleware(req, res, next)

        expect(res.status).toHaveBeenCalledWith(401)
        expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Missing access token' })
        expect(next).not.toHaveBeenCalled()
        expect(getKnex).not.toHaveBeenCalled()
    })

    it('applies RLS context and releases the pinned connection on finish exactly once', async () => {
        const next = jest.fn()
        const connection = { id: 'conn-1' }
        const rawCalls: string[] = []
        const connectionRaw = jest.fn().mockImplementation(function () {
            return Promise.resolve({ rows: [] })
        })
        const raw = jest.fn((sql: string) => {
            rawCalls.push(sql)
            return { connection: connectionRaw }
        })
        const releaseConnection = jest.fn()
        const getKnex = jest.fn(() => ({
            raw,
            client: {
                acquireConnection: jest.fn(async () => connection),
                releaseConnection
            }
        }))
        const executor = {
            query: jest.fn(),
            transaction: jest.fn(),
            isReleased: jest.fn(() => false)
        }
        mockedCreateRlsExecutor.mockReturnValue(executor as never)
        mockedApplyRlsContext.mockResolvedValue(undefined)

        const middleware = createEnsureAuthWithRls({ getKnex: getKnex as never })
        const req = {
            originalUrl: '/api/private',
            url: '/api/private',
            path: '/api/private',
            method: 'GET',
            session: { tokens: { access: 'token' } },
            user: { id: 'user-1' }
        } as unknown as Request & { dbContext?: unknown }
        const res = createResponse()

        await middleware(req, res, next)

        expect(next).toHaveBeenCalledTimes(1)
        expect(mockedApplyRlsContext).toHaveBeenCalledWith(expect.objectContaining({ query: expect.any(Function) }), 'token')
        // Should pass { inTransaction: true } since we wrapped in BEGIN
        expect(mockedCreateRlsExecutor).toHaveBeenCalledWith(getKnex.mock.results[0].value, connection, { inTransaction: true })
        expect(req.dbContext).toEqual(expect.objectContaining({ executor }))

        // Verify BEGIN and SET LOCAL were called during setup
        expect(rawCalls).toContain('BEGIN')
        expect(rawCalls).toContain("SET LOCAL statement_timeout TO '30000ms'")

        await res.emit('finish')
        await res.emit('close')

        // Verify COMMIT is called during cleanup (no more set_config reset needed)
        expect(rawCalls).toContain('COMMIT')
        expect(releaseConnection).toHaveBeenCalledTimes(1)
        expect(releaseConnection).toHaveBeenCalledWith(connection)
        expect(req.dbContext).toBeUndefined()
    })

    it('converts PostgreSQL-style $1 bindings for applyRlsContext queries on the pinned session', async () => {
        const next = jest.fn()
        const connection = { id: 'conn-3' }
        const rawCalls: Array<{ sql: string; bindings?: unknown[] }> = []
        const connectionRaw = jest.fn().mockResolvedValue({ rows: [] })
        const raw = jest.fn((sql: string, bindings?: unknown[]) => {
            rawCalls.push({ sql, bindings })
            return { connection: connectionRaw }
        })
        const releaseConnection = jest.fn()
        const getKnex = jest.fn(() => ({
            raw,
            client: {
                acquireConnection: jest.fn(async () => connection),
                releaseConnection
            }
        }))

        mockedCreateRlsExecutor.mockReturnValue({
            query: jest.fn(),
            transaction: jest.fn(),
            isReleased: jest.fn(() => false)
        } as never)
        mockedApplyRlsContext.mockImplementation(async (session) => {
            await session.query("SELECT set_config('request.jwt.claims', $1::text, true)", ['{"sub":"user-1"}'])
        })

        const middleware = createEnsureAuthWithRls({ getKnex: getKnex as never })
        const req = {
            originalUrl: '/api/private',
            url: '/api/private',
            path: '/api/private',
            method: 'GET',
            session: { tokens: { access: 'token' } },
            user: { id: 'user-1' }
        } as unknown as Request
        const res = createResponse()

        await middleware(req, res, next)

        expect(next).toHaveBeenCalledTimes(1)
        expect(rawCalls).toContainEqual({
            sql: "SELECT set_config('request.jwt.claims', ?::text, true)",
            bindings: ['{"sub":"user-1"}']
        })

        await res.emit('finish')
        expect(releaseConnection).toHaveBeenCalledWith(connection)
    })

    it('still releases the connection when COMMIT during cleanup fails', async () => {
        const next = jest.fn()
        const connection = { id: 'conn-2' }
        let callCount = 0
        const connectionRaw = jest.fn().mockImplementation(function () {
            callCount++
            // First 2 calls are BEGIN + SET LOCAL (succeed), then COMMIT fails, then ROLLBACK succeeds
            if (callCount <= 2) return Promise.resolve({ rows: [] })
            if (callCount === 3) return Promise.reject(new Error('commit failed'))
            return Promise.resolve({ rows: [] })
        })
        const raw = jest.fn(() => ({ connection: connectionRaw }))
        const releaseConnection = jest.fn()
        const getKnex = jest.fn(() => ({
            raw,
            client: {
                acquireConnection: jest.fn(async () => connection),
                releaseConnection
            }
        }))
        mockedCreateRlsExecutor.mockReturnValue({
            query: jest.fn(),
            transaction: jest.fn(),
            isReleased: jest.fn(() => false)
        } as never)
        mockedApplyRlsContext.mockResolvedValue(undefined)

        const middleware = createEnsureAuthWithRls({ getKnex: getKnex as never })
        const req = {
            originalUrl: '/api/private',
            url: '/api/private',
            path: '/api/private',
            method: 'GET',
            session: { tokens: { access: 'token' } },
            user: { id: 'user-1' }
        } as unknown as Request
        const res = createResponse()

        await middleware(req, res, next)
        await res.emit('finish')

        expect(releaseConnection).toHaveBeenCalledTimes(1)
        expect(releaseConnection).toHaveBeenCalledWith(connection)
    })

    it('rolls back aborted requests without marking the session released during setup', async () => {
        const next = jest.fn()
        const connection = { id: 'conn-4' }
        const rawCalls: string[] = []
        const connectionRaw = jest.fn().mockResolvedValue({ rows: [] })
        const raw = jest.fn((sql: string) => {
            rawCalls.push(sql)
            return { connection: connectionRaw }
        })
        const releaseConnection = jest.fn()
        const getKnex = jest.fn(() => ({
            raw,
            client: {
                acquireConnection: jest.fn(async () => connection),
                releaseConnection
            }
        }))
        mockedCreateRlsExecutor.mockReturnValue({
            query: jest.fn(),
            transaction: jest.fn(),
            isReleased: jest.fn(() => false)
        } as never)

        const middleware = createEnsureAuthWithRls({ getKnex: getKnex as never })
        const req = {
            originalUrl: '/api/private',
            url: '/api/private',
            path: '/api/private',
            method: 'GET',
            session: { tokens: { access: 'token' } },
            user: { id: 'user-1' }
        } as unknown as Request & { dbContext?: unknown }
        const res = createResponse()

        mockedApplyRlsContext.mockImplementation(async (session) => {
            await res.emit('close')
            expect(session.isReleased()).toBe(false)
            await session.query('SELECT 1')
        })

        await middleware(req, res, next)

        expect(next).not.toHaveBeenCalled()
        expect(rawCalls).toContain('ROLLBACK')
        expect(rawCalls).not.toContain('COMMIT')
        expect(releaseConnection).toHaveBeenCalledTimes(1)
        expect(releaseConnection).toHaveBeenCalledWith(connection)
        expect(req.dbContext).toBeUndefined()
    })

    it('defers cleanup when the request closes before the pinned connection is acquired', async () => {
        const next = jest.fn()
        const connection = { id: 'conn-early-close' }
        const rawCalls: string[] = []
        const connectionRaw = jest.fn().mockResolvedValue({ rows: [] })
        const raw = jest.fn((sql: string) => {
            rawCalls.push(sql)
            return { connection: connectionRaw }
        })
        const releaseConnection = jest.fn()
        const acquireConnection = jest.fn(async () => {
            await res.emit('close')
            return connection
        })
        const getKnex = jest.fn(() => ({
            raw,
            client: {
                acquireConnection,
                releaseConnection
            }
        }))

        mockedCreateRlsExecutor.mockReturnValue({
            query: jest.fn(),
            transaction: jest.fn(),
            isReleased: jest.fn(() => false)
        } as never)
        mockedApplyRlsContext.mockResolvedValue(undefined)

        const middleware = createEnsureAuthWithRls({ getKnex: getKnex as never })
        const req = {
            originalUrl: '/api/private',
            url: '/api/private',
            path: '/api/private',
            method: 'GET',
            session: { tokens: { access: 'token' } },
            user: { id: 'user-1' }
        } as unknown as Request & { dbContext?: unknown }
        const res = createResponse()

        await middleware(req, res, next)

        expect(next).not.toHaveBeenCalled()
        expect(acquireConnection).toHaveBeenCalledTimes(1)
        expect(rawCalls).toContain('ROLLBACK')
        expect(rawCalls).not.toContain('COMMIT')
        expect(releaseConnection).toHaveBeenCalledTimes(1)
        expect(releaseConnection).toHaveBeenCalledWith(connection)
        expect(req.dbContext).toBeUndefined()
    })
})
