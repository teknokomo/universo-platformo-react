import type { NextFunction, Request, Response } from 'express'

jest.mock('../../middlewares/ensureAuth', () => ({
    ensureAuth: jest.fn((_req: Request, _res: Response, next: NextFunction) => next())
}))

jest.mock('../../utils/rlsContext', () => ({
    applyRlsContext: jest.fn()
}))

jest.mock('@universo-react/database', () => ({
    convertPgBindings: jest.requireActual('@universo-react/database').convertPgBindings,
    releaseKnexConnection: jest.requireActual('@universo-react/database').releaseKnexConnection,
    runInRlsOperationScope: jest.requireActual('@universo-react/database').runInRlsOperationScope,
    createRlsExecutor: jest.fn(() => ({
        query: jest.fn(),
        transaction: jest.fn(),
        isReleased: jest.fn(() => false)
    }))
}))

import { ensureAuth } from '../../middlewares/ensureAuth'
import { createRlsExecutor } from '@universo-react/database'
import { applyRlsContext } from '../../utils/rlsContext'
import { createEnsureAuthWithRls, type RequestWithDbContext } from '../../middlewares/ensureAuthWithRls'

const mockedEnsureAuth = ensureAuth as jest.MockedFunction<typeof ensureAuth>
const mockedCreateRlsExecutor = createRlsExecutor as jest.MockedFunction<typeof createRlsExecutor>
const mockedApplyRlsContext = applyRlsContext as jest.MockedFunction<typeof applyRlsContext>

const createResponse = () => {
    const eventHandlers = new Map<string, Array<() => Promise<void> | void>>()
    const res = {
        once: jest.fn((event: string, handler: () => Promise<void> | void) => {
            const handlers = eventHandlers.get(event) ?? []
            handlers.push(handler)
            eventHandlers.set(event, handlers)
            return res
        }),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        end: jest.fn(),
        headersSent: false,
        writableFinished: false,
        statusCode: 200,
        setHeader: jest.fn(),
        removeHeader: jest.fn(),
        destroy: jest.fn(),
        emit: async (event: string) => {
            if (event === 'finish') res.writableFinished = true
            for (const handler of eventHandlers.get(event) ?? []) await handler()
        }
    }

    return res as unknown as Response & {
        once: jest.Mock
        status: jest.Mock
        json: jest.Mock
        end: jest.Mock
        headersSent: boolean
        writableFinished: boolean
        statusCode: number
        setHeader: jest.Mock
        removeHeader: jest.Mock
        destroy: jest.Mock
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

    it('does not include signed public route tokens in RLS debug logs', async () => {
        const previousDebugSetting = process.env.AUTH_RLS_DEBUG
        process.env.AUTH_RLS_DEBUG = 'true'
        const debugLog = jest.spyOn(console, 'log').mockImplementation(() => undefined)

        try {
            let debugMiddleware!: typeof createEnsureAuthWithRls
            jest.isolateModules(() => {
                debugMiddleware = (require('../../middlewares/ensureAuthWithRls') as typeof import('../../middlewares/ensureAuthWithRls'))
                    .createEnsureAuthWithRls
            })

            const next = jest.fn()
            const signedToken = 'signed-artifact-token-must-not-appear-in-logs'
            const originalUrl = `/api/v1/metahub/hub-1/packages/package-1/editor-artifact-token/${signedToken}/artifact?signature=query-secret`
            const req = {
                originalUrl,
                url: originalUrl,
                path: originalUrl,
                method: 'GET'
            } as unknown as Request
            const res = createResponse()

            await debugMiddleware({ getKnex: jest.fn() as never })(req, res, next)

            expect(next).toHaveBeenCalledTimes(1)
            expect(debugLog).toHaveBeenCalledWith('[RLS] Whitelisted request - skipping auth/RLS', { method: 'GET' })
            expect(JSON.stringify(debugLog.mock.calls)).not.toContain(signedToken)
            expect(JSON.stringify(debugLog.mock.calls)).not.toContain('query-secret')
        } finally {
            debugLog.mockRestore()
            if (previousDebugSetting === undefined) delete process.env.AUTH_RLS_DEBUG
            else process.env.AUTH_RLS_DEBUG = previousDebugSetting
        }
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
            return { connection: () => connectionRaw(sql) }
        })
        const releaseConnection = jest.fn()
        let markConnectionReleased!: () => void
        const connectionReleased = new Promise<void>((resolve) => {
            markConnectionReleased = resolve
        })
        releaseConnection.mockImplementation(async () => markConnectionReleased())
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
        expect(mockedCreateRlsExecutor).toHaveBeenCalledWith(
            getKnex.mock.results[0].value,
            connection,
            expect.objectContaining({
                inTransaction: true,
                isConnectionUnavailable: expect.any(Function),
                runWithConnectionLease: expect.any(Function)
            })
        )
        expect(req.dbContext).toEqual(expect.objectContaining({ executor }))

        // Verify BEGIN and SET LOCAL were called during setup
        expect(rawCalls).toContain('BEGIN')
        expect(rawCalls).toContain("SET LOCAL statement_timeout TO '30000ms'")

        await res.emit('finish')
        await res.emit('close')
        await connectionReleased
        await new Promise<void>((resolve) => setImmediate(resolve))

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
        let markConnectionReleased!: () => void
        const connectionReleased = new Promise<void>((resolve) => {
            markConnectionReleased = resolve
        })
        releaseConnection.mockImplementation(async () => markConnectionReleased())
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
        await connectionReleased
        await new Promise<void>((resolve) => setImmediate(resolve))
        expect(releaseConnection).toHaveBeenCalledWith(connection)
    })

    it('commits the request transaction before sending the response body', async () => {
        const next = jest.fn()
        const connection = { id: 'conn-response-barrier' }
        const rawCalls: string[] = []
        const connectionRaw = jest.fn().mockResolvedValue({ rows: [] })
        const raw = jest.fn((sql: string) => {
            rawCalls.push(sql)
            return { connection: () => connectionRaw(sql) }
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
        mockedApplyRlsContext.mockResolvedValue(undefined)

        const middleware = createEnsureAuthWithRls({ getKnex: getKnex as never })
        const req = {
            originalUrl: '/api/private',
            url: '/api/private',
            path: '/api/private',
            method: 'POST',
            session: { tokens: { access: 'token' } },
            user: { id: 'user-1' }
        } as unknown as Request & { dbContext?: unknown }
        const res = createResponse()
        const originalEnd = res.end
        let markResponseSent!: () => void
        const responseSent = new Promise<void>((resolve) => {
            markResponseSent = resolve
        })
        originalEnd.mockImplementation(() => {
            markResponseSent()
            return res
        })

        await middleware(req, res, next)
        res.end('committed body')

        expect(originalEnd).not.toHaveBeenCalled()
        expect(rawCalls).not.toContain('COMMIT')

        await responseSent
        expect(originalEnd).toHaveBeenCalledWith('committed body')
        expect(rawCalls).toContain('COMMIT')
        await res.emit('finish')
        expect(releaseConnection).toHaveBeenCalledWith(connection)
    })

    it('rolls back work admitted before a client disconnect and suppresses the buffered success body', async () => {
        const next = jest.fn()
        const connection = { id: 'conn-disconnect-during-drain' }
        const rawCalls: string[] = []
        let markSlowQueryStarted!: () => void
        let resolveSlowQuery!: (result: { rows: unknown[] }) => void
        let markConnectionReleased!: () => void
        const slowQueryStarted = new Promise<void>((resolve) => {
            markSlowQueryStarted = resolve
        })
        const slowQuery = new Promise<{ rows: unknown[] }>((resolve) => {
            resolveSlowQuery = resolve
        })
        const connectionReleased = new Promise<void>((resolve) => {
            markConnectionReleased = resolve
        })
        const connectionRaw = jest.fn((sql: string) => {
            if (sql === 'SELECT delayed') {
                markSlowQueryStarted()
                return slowQuery
            }
            return Promise.resolve({ rows: [] })
        })
        const raw = jest.fn((sql: string) => {
            rawCalls.push(sql)
            return { connection: () => connectionRaw(sql) }
        })
        const releaseConnection = jest.fn(async () => markConnectionReleased())
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
            method: 'POST',
            session: { tokens: { access: 'token' } },
            user: { id: 'user-1' }
        } as unknown as Request & { dbContext?: { session: { query: (sql: string) => Promise<unknown[]> } } }
        const res = createResponse()
        const originalEnd = res.end

        await middleware(req, res, next)
        const inFlightQuery = req.dbContext!.session.query('SELECT delayed')
        await slowQueryStarted
        res.end('success body')
        await res.emit('close')

        expect(rawCalls).not.toContain('COMMIT')
        expect(releaseConnection).not.toHaveBeenCalled()
        resolveSlowQuery({ rows: [] })
        await inFlightQuery
        await connectionReleased
        await new Promise<void>((resolve) => setImmediate(resolve))

        expect(rawCalls).toContain('ROLLBACK')
        expect(rawCalls).not.toContain('COMMIT')
        expect(releaseConnection).toHaveBeenCalledTimes(1)
        expect(originalEnd).not.toHaveBeenCalled()
    })

    it('rolls back and replaces a success response when an RLS query aborted the request transaction', async () => {
        const next = jest.fn()
        const connection = { id: 'conn-aborted-transaction' }
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
        let executorOptions: NonNullable<Parameters<typeof createRlsExecutor>[2]> | undefined
        mockedCreateRlsExecutor.mockImplementation((_knex, _connection, options) => {
            executorOptions = options
            return {
                query: jest.fn(),
                transaction: jest.fn(),
                isReleased: jest.fn(() => false)
            } as never
        })
        mockedApplyRlsContext.mockResolvedValue(undefined)

        const middleware = createEnsureAuthWithRls({ getKnex: getKnex as never })
        const req = {
            originalUrl: '/api/private',
            url: '/api/private',
            path: '/api/private',
            method: 'POST',
            session: { tokens: { access: 'token' } },
            user: { id: 'user-1' }
        } as unknown as Request
        const res = createResponse()
        const originalEnd = res.end
        let markResponseSent!: (body: unknown) => void
        const responseSent = new Promise<unknown>((resolve) => {
            markResponseSent = resolve
        })
        originalEnd.mockImplementation((body) => {
            markResponseSent(body)
            return res
        })

        await middleware(req, res, next)
        expect(executorOptions?.onOuterTransactionFailure).toEqual(expect.any(Function))
        rawCalls.length = 0
        executorOptions!.onOuterTransactionFailure!(new Error('private database error detail'))
        res.end('success body')

        await expect(responseSent).resolves.toBe('{"error":"Database transaction failed"}')
        expect(rawCalls).toContain('ROLLBACK')
        expect(rawCalls).not.toContain('COMMIT')
        expect(res.statusCode).toBe(500)
        expect(originalEnd).not.toHaveBeenCalledWith('success body')
        expect(releaseConnection).toHaveBeenCalledWith(connection)
    })

    it('replaces a success response when a caught session SQL error aborted the request transaction', async () => {
        const next = jest.fn()
        const connection = { id: 'conn-caught-session-query-error' }
        const failure = new Error('private statement detail')
        const rawCalls: string[] = []
        const connectionRaw = jest.fn((sql: string) =>
            sql === 'SELECT session failure' ? Promise.reject(failure) : Promise.resolve({ rows: [] })
        )
        const raw = jest.fn((sql: string) => {
            rawCalls.push(sql)
            return { connection: () => connectionRaw(sql) }
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
        mockedApplyRlsContext.mockResolvedValue(undefined)

        const middleware = createEnsureAuthWithRls({ getKnex: getKnex as never })
        const req = {
            originalUrl: '/api/private',
            url: '/api/private',
            path: '/api/private',
            method: 'POST',
            session: { tokens: { access: 'token' } },
            user: { id: 'user-1' }
        } as unknown as Request & { dbContext?: { session: { query: (sql: string) => Promise<unknown[]> } } }
        const res = createResponse()
        const originalEnd = res.end
        let markResponseSent!: (body: unknown) => void
        const responseSent = new Promise<unknown>((resolve) => {
            markResponseSent = resolve
        })
        originalEnd.mockImplementation((body) => {
            markResponseSent(body)
            return res
        })

        await middleware(req, res, next)
        await expect(req.dbContext!.session.query('SELECT session failure')).rejects.toBe(failure)
        res.end('success body')

        await expect(responseSent).resolves.toBe('{"error":"Database transaction failed"}')
        expect(rawCalls).toContain('ROLLBACK')
        expect(rawCalls).not.toContain('COMMIT')
        expect(res.statusCode).toBe(500)
        expect(originalEnd).not.toHaveBeenCalledWith('success body')
        expect(releaseConnection).toHaveBeenCalledWith(connection)
    })

    it('preserves an ordinary client-error response while rolling back its request transaction', async () => {
        const next = jest.fn()
        const connection = { id: 'conn-domain-conflict' }
        const rawCalls: string[] = []
        const connectionRaw = jest.fn().mockResolvedValue({ rows: [] })
        const raw = jest.fn((sql: string) => {
            rawCalls.push(sql)
            return { connection: () => connectionRaw(sql) }
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
        mockedApplyRlsContext.mockResolvedValue(undefined)

        const middleware = createEnsureAuthWithRls({ getKnex: getKnex as never })
        const req = {
            originalUrl: '/api/private',
            url: '/api/private',
            path: '/api/private',
            method: 'POST',
            session: { tokens: { access: 'token' } },
            user: { id: 'user-1' }
        } as unknown as Request
        const res = createResponse()
        const originalEnd = res.end
        let markResponseSent!: (body: unknown) => void
        const responseSent = new Promise<unknown>((resolve) => {
            markResponseSent = resolve
        })
        originalEnd.mockImplementation((body) => {
            markResponseSent(body)
            return res
        })

        await middleware(req, res, next)
        res.statusCode = 409
        res.end('{"error":"Conflict"}')

        await expect(responseSent).resolves.toBe('{"error":"Conflict"}')
        expect(rawCalls).toContain('ROLLBACK')
        expect(rawCalls).not.toContain('COMMIT')
        expect(res.statusCode).toBe(409)
        expect(releaseConnection).toHaveBeenCalledWith(connection)
    })

    it('preserves a client error after a failed request transaction triggers rollback', async () => {
        const next = jest.fn()
        const connection = { id: 'conn-failed-domain-transaction' }
        const rawCalls: string[] = []
        const connectionRaw = jest.fn().mockResolvedValue({ rows: [] })
        const raw = jest.fn((sql: string) => {
            rawCalls.push(sql)
            return { connection: () => connectionRaw(sql) }
        })
        const releaseConnection = jest.fn()
        const getKnex = jest.fn(() => ({
            raw,
            client: {
                acquireConnection: jest.fn(async () => connection),
                releaseConnection
            }
        }))
        const { createRlsExecutor: actualCreateRlsExecutor } = jest.requireActual(
            '@universo-react/database'
        ) as typeof import('@universo-react/database')
        mockedCreateRlsExecutor.mockImplementation((knex, pinnedConnection, executorOptions) =>
            actualCreateRlsExecutor(knex, pinnedConnection, executorOptions)
        )
        mockedApplyRlsContext.mockResolvedValue(undefined)

        const middleware = createEnsureAuthWithRls({ getKnex: getKnex as never })
        const req = {
            originalUrl: '/api/private',
            url: '/api/private',
            path: '/api/private',
            method: 'POST',
            session: { tokens: { access: 'token' } },
            user: { id: 'user-1' }
        } as unknown as RequestWithDbContext
        const res = createResponse()
        const originalEnd = res.end
        let markResponseSent!: (body: unknown) => void
        const responseSent = new Promise<unknown>((resolve) => {
            markResponseSent = resolve
        })
        originalEnd.mockImplementation((body) => {
            markResponseSent(body)
            return res
        })

        await middleware(req, res, next)
        const domainFailure = new Error('domain conflict')
        await expect(req.dbContext!.executor.transaction(async () => Promise.reject(domainFailure))).rejects.toBe(domainFailure)
        res.statusCode = 409
        res.end('{"error":"Conflict"}')

        await expect(responseSent).resolves.toBe('{"error":"Conflict"}')
        expect(rawCalls.filter((sql) => sql === 'ROLLBACK')).toHaveLength(2)
        expect(rawCalls).not.toContain('COMMIT')
        expect(res.statusCode).toBe(409)
        expect(releaseConnection).toHaveBeenCalledWith(connection)
    })

    it('sends a server error instead of a success body when request COMMIT fails', async () => {
        const next = jest.fn()
        const connection = { id: 'conn-2' }
        const rawCalls: string[] = []
        let callCount = 0
        const connectionRaw = jest.fn().mockImplementation(function () {
            callCount++
            // The connection reset, BEGIN, and SET LOCAL succeed before COMMIT fails.
            if (callCount <= 3) return Promise.resolve({ rows: [] })
            if (callCount === 4) return Promise.reject(new Error('commit failed'))
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
        const originalEnd = res.end
        let markResponseSent!: () => void
        const responseSent = new Promise<void>((resolve) => {
            markResponseSent = resolve
        })
        originalEnd.mockImplementation(() => {
            markResponseSent()
            return res
        })

        await middleware(req, res, next)
        res.end('success body')
        expect(originalEnd).not.toHaveBeenCalled()
        await responseSent

        expect(rawCalls).toContain('COMMIT')
        expect(rawCalls).toContain('ROLLBACK')
        expect(res.statusCode).toBe(500)
        expect(originalEnd).toHaveBeenCalledWith('{"error":"Database transaction failed"}')
        expect(originalEnd).not.toHaveBeenCalledWith('success body')
        expect(releaseConnection).toHaveBeenCalledTimes(1)
        expect(releaseConnection).toHaveBeenCalledWith(connection)
        await res.emit('finish')
    })

    it('discards the connection when both request COMMIT and fallback ROLLBACK fail', async () => {
        const next = jest.fn()
        const connection = { id: 'conn-commit-and-rollback-failed' } as { id: string; __knex__disposed?: string }
        const rawCalls: string[] = []
        let callCount = 0
        const connectionRaw = jest.fn().mockImplementation(function () {
            callCount++
            if (callCount <= 3) return Promise.resolve({ rows: [] })
            return Promise.reject(new Error(callCount === 4 ? 'commit failed' : 'rollback failed'))
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
        const originalEnd = res.end
        let markResponseSent!: () => void
        const responseSent = new Promise<void>((resolve) => {
            markResponseSent = resolve
        })
        originalEnd.mockImplementation(() => {
            markResponseSent()
            return res
        })

        await middleware(req, res, next)
        res.end('success body')
        expect(originalEnd).not.toHaveBeenCalled()
        await responseSent

        expect(rawCalls.filter((sql) => sql === 'COMMIT')).toHaveLength(1)
        expect(rawCalls.filter((sql) => sql === 'ROLLBACK')).toHaveLength(2)
        expect(res.statusCode).toBe(500)
        expect(originalEnd).toHaveBeenCalledWith('{"error":"Database transaction failed"}')
        expect(connection.__knex__disposed).toBe('Connection transaction state is unknown')
        expect(releaseConnection).toHaveBeenCalledTimes(1)
        expect(releaseConnection).toHaveBeenCalledWith(connection)
        await res.emit('finish')
    })

    it('does not send a client response when request ROLLBACK fails', async () => {
        const next = jest.fn()
        const connection = { id: 'conn-rollback-failure' }
        const rawCalls: string[] = []
        let rollbackCount = 0
        const connectionRaw = jest.fn().mockImplementation((sql: string) => {
            if (sql === 'ROLLBACK') {
                rollbackCount += 1
                if (rollbackCount === 2) return Promise.reject(new Error('rollback failed'))
            }
            return Promise.resolve({ rows: [] })
        })
        const raw = jest.fn((sql: string) => {
            rawCalls.push(sql)
            return { connection: () => connectionRaw(sql) }
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
        res.statusCode = 400
        const originalEnd = res.end
        let markResponseSent!: (body: unknown) => void
        const responseSent = new Promise<unknown>((resolve) => {
            markResponseSent = resolve
        })
        originalEnd.mockImplementation((body) => {
            markResponseSent(body)
            return res
        })

        await middleware(req, res, next)
        res.end('client error body')

        await expect(responseSent).resolves.toBe('{"error":"Database transaction failed"}')
        expect(rawCalls.filter((sql) => sql === 'ROLLBACK')).toHaveLength(2)
        expect(res.statusCode).toBe(500)
        expect(originalEnd).not.toHaveBeenCalledWith('client error body')
        expect(releaseConnection).toHaveBeenCalledWith(connection)
        expect((connection as { __knex__disposed?: string }).__knex__disposed).toBe('Connection transaction state is unknown')
    })

    it('discards a connection when the defensive transaction reset fails', async () => {
        const next = jest.fn()
        const staleConnection = { id: 'conn-stale-reset' }
        const freshConnection = { id: 'conn-fresh-reset' }
        const rawCalls: Array<{ sql: string; connection: unknown }> = []
        const raw = jest.fn((sql: string) => ({
            connection: (connection: unknown) => {
                rawCalls.push({ sql, connection })
                if (sql === 'ROLLBACK' && connection === staleConnection) return Promise.reject(new Error('reset failed'))
                return Promise.resolve({ rows: [] })
            }
        }))
        let acquireCount = 0
        const acquireConnection = jest.fn(async () => (acquireCount++ === 0 ? staleConnection : freshConnection))
        const releaseConnection = jest.fn()
        const getKnex = jest.fn(() => ({ raw, client: { acquireConnection, releaseConnection } }))
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

        expect(acquireConnection).toHaveBeenCalledTimes(2)
        expect((staleConnection as { __knex__disposed?: string }).__knex__disposed).toBe('Connection transaction state is unknown')
        expect(rawCalls).not.toContainEqual({ sql: 'BEGIN', connection: staleConnection })
        expect(rawCalls).toContainEqual({ sql: 'BEGIN', connection: freshConnection })
        expect(releaseConnection).toHaveBeenCalledWith(staleConnection)
        expect(next).toHaveBeenCalledTimes(1)

        await res.emit('finish')
        await new Promise<void>((resolve) => setImmediate(resolve))

        expect(releaseConnection).toHaveBeenCalledWith(freshConnection)
    })

    it('waits for in-flight RLS transactions before rolling back and releasing an aborted request connection', async () => {
        const next = jest.fn()
        const connection = { id: 'conn-aborted-operation' }
        const rawCalls: string[] = []
        const connectionRaw = jest.fn().mockResolvedValue({ rows: [] })
        const raw = jest.fn((sql: string) => {
            rawCalls.push(sql)
            return { connection: connectionRaw }
        })
        let markConnectionReleaseStarted!: () => void
        let completeConnectionRelease!: () => void
        const connectionReleaseStarted = new Promise<void>((resolve) => {
            markConnectionReleaseStarted = resolve
        })
        const connectionRelease = new Promise<void>((resolve) => {
            completeConnectionRelease = resolve
        })
        const releaseConnection = jest.fn(() => {
            markConnectionReleaseStarted()
            return connectionRelease
        })
        const getKnex = jest.fn(() => ({
            raw,
            client: {
                acquireConnection: jest.fn(async () => connection),
                releaseConnection
            }
        }))
        let executorOptions: NonNullable<Parameters<typeof createRlsExecutor>[2]> | undefined
        mockedCreateRlsExecutor.mockImplementation((_knex, _connection, options) => {
            executorOptions = options
            return {
                query: jest.fn(),
                transaction: jest.fn(),
                isReleased: () => executorOptions?.isConnectionUnavailable?.() ?? false
            } as never
        })
        mockedApplyRlsContext.mockResolvedValue(undefined)

        const middleware = createEnsureAuthWithRls({ getKnex: getKnex as never })
        const req = {
            originalUrl: '/api/private',
            url: '/api/private',
            path: '/api/private',
            method: 'GET',
            session: { tokens: { access: 'token' } },
            user: { id: 'user-1' }
        } as unknown as Request & { dbContext?: { isReleased: () => boolean } }
        const res = createResponse()

        await middleware(req, res, next)
        expect(next).toHaveBeenCalledTimes(1)
        expect(executorOptions?.runWithConnectionLease).toEqual(expect.any(Function))
        rawCalls.length = 0

        let resolveTransaction!: () => void
        let markTransactionStarted!: () => void
        const transactionStarted = new Promise<void>((resolve) => {
            markTransactionStarted = resolve
        })
        const transactionBarrier = new Promise<void>((resolve) => {
            resolveTransaction = resolve
        })
        const transaction = executorOptions!.runWithConnectionLease!(async () => {
            await raw('SAVEPOINT rls_sp_2').connection(connection)
            markTransactionStarted()
            await transactionBarrier
            await raw('RELEASE SAVEPOINT rls_sp_2').connection(connection)
        })
        await transactionStarted

        await res.emit('close')
        expect(rawCalls).toContain('SAVEPOINT rls_sp_2')
        expect(rawCalls).not.toContain('ROLLBACK')
        expect(releaseConnection).not.toHaveBeenCalled()
        expect(req.dbContext?.isReleased()).toBe(true)
        await expect(executorOptions!.runWithConnectionLease!(async () => undefined)).rejects.toThrow('RLS connection lease is closed')

        resolveTransaction()
        await transaction
        await connectionReleaseStarted

        expect(rawCalls.indexOf('RELEASE SAVEPOINT rls_sp_2')).toBeLessThan(rawCalls.indexOf('ROLLBACK'))
        expect(releaseConnection).toHaveBeenCalledTimes(1)
        expect(req.dbContext).toBeDefined()
        completeConnectionRelease()
        await new Promise<void>((resolve) => setImmediate(resolve))
        expect(req.dbContext).toBeUndefined()
        expect(executorOptions?.isConnectionUnavailable?.()).toBe(true)
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
