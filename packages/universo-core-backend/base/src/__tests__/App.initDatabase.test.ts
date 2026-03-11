import express from 'express'

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}
const mockValidateRegisteredPlatformMigrations = jest.fn(() => ({
    ok: true,
    issues: []
}))
const mockRunRegisteredPlatformMigrations = jest.fn().mockResolvedValue({
    applied: ['CreateMetahubsSchema1766351182000'],
    skipped: [],
    drifted: []
})
const mockKnex = { tag: 'knex' }
const mockGetKnex = jest.fn(() => mockKnex)
const mockDestroyKnex = jest.fn().mockResolvedValue(undefined)
const mockCreateKnexExecutor = jest.fn(() => ({ tag: 'executor' }))
const mockTelemetry = jest.fn(function MockTelemetry(this: { ready: boolean }) {
    this.ready = true
})

jest.mock('../utils/logger', () => ({
    __esModule: true,
    default: mockLogger,
    expressRequestLogger: jest.fn((_req, _res, next) => next())
}))

jest.mock('../utils/telemetry', () => ({
    Telemetry: mockTelemetry
}))

jest.mock('../utils/XSS', () => ({
    sanitizeMiddleware: jest.fn((_req, _res, next) => next()),
    getCorsOptions: jest.fn(() => ({})),
    getAllowedIframeOrigins: jest.fn(() => '*')
}))

jest.mock('../utils', () => ({
    getNodeModulesPackagePath: jest.fn(() => '/tmp/node_modules')
}))

jest.mock('../routes', () => ({
    __esModule: true,
    default: express.Router()
}))

jest.mock('../middlewares/errors', () => ({
    __esModule: true,
    default: jest.fn((error, _req, _res, next) => next(error))
}))

jest.mock(
    '@universo/auth-backend',
    () => ({
        passport: {
            initialize: jest.fn(() => jest.fn((_req, _res, next) => next())),
            session: jest.fn(() => jest.fn((_req, _res, next) => next()))
        },
        createAuthRouter: jest.fn(() => express.Router())
    }),
    { virtual: true }
)

jest.mock(
    '@universo/database',
    () => ({
        getKnex: mockGetKnex,
        destroyKnex: mockDestroyKnex,
        createKnexExecutor: mockCreateKnexExecutor
    }),
    { virtual: true }
)

jest.mock(
    '@universo/metahubs-backend',
    () => ({
        initializeRateLimiters: jest.fn(),
        seedTemplates: jest.fn()
    }),
    { virtual: true }
)

jest.mock(
    '@universo/applications-backend',
    () => ({
        initializeRateLimiters: jest.fn()
    }),
    { virtual: true }
)

jest.mock(
    '@universo/start-backend',
    () => ({
        initializeRateLimiters: jest.fn()
    }),
    { virtual: true }
)

jest.mock(
    '@universo/migrations-platform',
    () => ({
        validateRegisteredPlatformMigrations: mockValidateRegisteredPlatformMigrations,
        runRegisteredPlatformMigrations: mockRunRegisteredPlatformMigrations
    }),
    { virtual: true }
)

jest.mock(
    '@universo/utils',
    () => ({
        API_WHITELIST_URLS: []
    }),
    { virtual: true }
)

import { App } from '../index'

describe('App.initDatabase', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockValidateRegisteredPlatformMigrations.mockReturnValue({
            ok: true,
            issues: []
        })
        mockRunRegisteredPlatformMigrations.mockResolvedValue({
            applied: ['CreateMetahubsSchema1766351182000'],
            skipped: [],
            drifted: []
        })
    })

    it('initializes database and runs unified platform migrations', async () => {
        const app = new App()

        await app.initDatabase()

        expect(mockValidateRegisteredPlatformMigrations).toHaveBeenCalledTimes(1)
        expect(mockGetKnex).toHaveBeenCalled()
        expect(mockRunRegisteredPlatformMigrations).toHaveBeenCalledWith(
            mockKnex,
            expect.objectContaining({
                info: expect.any(Function),
                warn: expect.any(Function),
                error: expect.any(Function)
            })
        )
        expect(mockTelemetry).toHaveBeenCalledTimes(1)
        expect(mockDestroyKnex).not.toHaveBeenCalled()
    })

    it('fails fast when platform migration validation is not ok', async () => {
        mockValidateRegisteredPlatformMigrations.mockReturnValue({
            ok: false,
            issues: [{ message: 'invalid migration registry' }]
        })
        const app = new App()

        await expect(app.initDatabase()).rejects.toThrow('invalid migration registry')

        expect(mockRunRegisteredPlatformMigrations).not.toHaveBeenCalled()
        expect(mockTelemetry).not.toHaveBeenCalled()
        expect(mockDestroyKnex).toHaveBeenCalledTimes(1)
        expect(mockLogger.error).toHaveBeenCalledWith('❌ [server]: Error during database initialization:', expect.any(Error))
    })

    it('fails fast when platform migration execution throws', async () => {
        mockRunRegisteredPlatformMigrations.mockRejectedValue(new Error('platform migration failed'))
        const app = new App()

        await expect(app.initDatabase()).rejects.toThrow('platform migration failed')

        expect(mockTelemetry).not.toHaveBeenCalled()
        expect(mockDestroyKnex).toHaveBeenCalledTimes(1)
        expect(mockLogger.error).toHaveBeenCalledWith('❌ [server]: Error during database initialization:', expect.any(Error))
    })
})
