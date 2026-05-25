const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}

const mockTx = { query: jest.fn() }

const mockWithAdvisoryLock = jest.fn((_executor, _lockKey, work) => work(mockTx))
const mockGetPoolExecutor = jest.fn(() => mockPoolExec)

const mockPoolExec = { query: jest.fn() }

const ORIGINAL_ENV = process.env

jest.mock('../utils/logger', () => ({
    __esModule: true,
    default: mockLogger
}))

jest.mock(
    '@universo/database',
    () => ({
        getPoolExecutor: (...args) => mockGetPoolExecutor(...args)
    }),
    { virtual: true }
)

jest.mock(
    '@universo/utils/database',
    () => ({
        withAdvisoryLock: (...args) => mockWithAdvisoryLock(...args)
    }),
    { virtual: true }
)

jest.mock(
    '@universo/migrations-platform',
    () => ({
        registeredSystemAppDefinitions: [
            { schemaTarget: { kind: 'fixed', schemaName: 'metahubs' } },
            { schemaTarget: { kind: 'fixed', schemaName: 'applications' } },
            { schemaTarget: { kind: 'fixed', schemaName: 'admin' } },
            { schemaTarget: { kind: 'fixed', schemaName: 'profiles' } },
            { schemaTarget: { kind: 'fixed', schemaName: 'start' } }
        ]
    }),
    { virtual: true }
)

import { executeStartupFullReset } from '../bootstrap/startupReset'

describe('startupReset', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        process.env = { ...ORIGINAL_ENV }
        delete process.env.FULL_DATABASE_RESET
        delete process.env.NODE_ENV

        mockWithAdvisoryLock.mockImplementation((_executor, _lockKey, work) => work(mockTx))

        // Default: all SQL queries return empty arrays (no schemas, no users)
        mockTx.query.mockResolvedValue([])
    })

    afterAll(() => {
        process.env = ORIGINAL_ENV
    })

    describe('config parsing', () => {
        it('returns disabled when FULL_DATABASE_RESET is unset', async () => {
            const result = await executeStartupFullReset()
            expect(result).toEqual({ enabled: false, status: 'disabled' })
        })

        it('returns disabled when FULL_DATABASE_RESET=false', async () => {
            process.env.FULL_DATABASE_RESET = 'false'
            const result = await executeStartupFullReset()
            expect(result).toEqual({ enabled: false, status: 'disabled' })
        })
    })

    describe('production guard', () => {
        it('throws when NODE_ENV=production and reset enabled', async () => {
            process.env.FULL_DATABASE_RESET = 'true'
            process.env.NODE_ENV = 'production'

            await expect(executeStartupFullReset()).rejects.toThrow('not allowed in production')
        })

        it('does not throw in development', async () => {
            process.env.FULL_DATABASE_RESET = 'true'
            process.env.NODE_ENV = 'development'

            await executeStartupFullReset()
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('FULL DATABASE RESET IS ENABLED'))
        })
    })

    describe('reset execution', () => {
        beforeEach(() => {
            process.env.FULL_DATABASE_RESET = 'true'
            process.env.NODE_ENV = 'development'
        })

        it('does not call advisory lock when disabled', async () => {
            process.env.FULL_DATABASE_RESET = 'false'
            await executeStartupFullReset()
            expect(mockWithAdvisoryLock).not.toHaveBeenCalled()
        })

        it('acquires advisory lock with correct key and executor', async () => {
            await executeStartupFullReset()

            expect(mockWithAdvisoryLock).toHaveBeenCalledWith(
                expect.anything(),
                'universo:startup:full-database-reset',
                expect.any(Function),
                { timeoutMs: 30_000 }
            )
        })

        it('ensures public schema exists', async () => {
            await executeStartupFullReset()

            const publicSchemaCalls = mockTx.query.mock.calls.filter((call) => call[0] === 'CREATE SCHEMA IF NOT EXISTS public')
            expect(publicSchemaCalls.length).toBeGreaterThanOrEqual(2)
        })

        it('drops discovered schemas and returns report', async () => {
            let dropStarted = false
            mockTx.query.mockImplementation((sql) => {
                if (sql === 'CREATE SCHEMA IF NOT EXISTS public') return Promise.resolve([])
                if (sql.includes('DROP SCHEMA')) {
                    dropStarted = true
                    return Promise.resolve([])
                }
                if (dropStarted) return Promise.resolve([])
                if (sql.includes('ANY($1'))
                    return Promise.resolve([{ schema_name: 'admin' }, { schema_name: 'metahubs' }, { schema_name: 'upl_migrations' }])
                if (sql.includes("LIKE 'app") && sql.includes("LIKE 'mhb"))
                    return Promise.resolve([{ schema_name: 'app_test123' }, { schema_name: 'mhb_test456' }])
                if (sql.includes('auth.users')) return Promise.resolve([])
                return Promise.resolve([])
            })

            const result = await executeStartupFullReset()

            expect(result).toHaveProperty('enabled', true)
            if ('enabled' in result && result.enabled) {
                const droppedNames = result.droppedSchemas.map((s) => s.schemaName)
                expect(droppedNames).toContain('app_test123')
                expect(droppedNames).toContain('mhb_test456')
                expect(droppedNames).toContain('upl_migrations')
                expect(droppedNames[droppedNames.length - 1]).toBe('upl_migrations')
                expect(result.droppedSchemas.every((s) => s.status === 'dropped')).toBe(true)
            }
        })

        it('deletes auth users via direct SQL', async () => {
            let authUsersQueryCount = 0

            mockTx.query.mockImplementation((sql) => {
                if (sql.includes('auth.users') && sql.includes('SELECT')) {
                    authUsersQueryCount++
                    if (authUsersQueryCount === 1) {
                        return Promise.resolve([
                            { id: 'user-1', email: 'a@test.com' },
                            { id: 'user-2', email: 'b@test.com' }
                        ])
                    }
                    return Promise.resolve([])
                }
                if (sql.includes('auth.users') && sql.includes('DELETE')) {
                    return Promise.resolve([])
                }
                return Promise.resolve([])
            })

            const result = await executeStartupFullReset()

            // Verify DELETE FROM auth.users was called with user IDs
            const deleteCalls = mockTx.query.mock.calls.filter(
                (call) => typeof call[0] === 'string' && call[0].includes('DELETE FROM auth.users')
            )
            expect(deleteCalls.length).toBe(1)
            expect(deleteCalls[0][1]).toEqual([['user-1', 'user-2']])

            if ('enabled' in result && result.enabled) {
                expect(result.deletedAuthUsers.length).toBe(2)
                expect(result.deletedAuthUsers.every((u) => u.status === 'deleted')).toBe(true)
            }
        })

        it('handles partial schema drop failures gracefully', async () => {
            let dropStarted = false
            mockTx.query.mockImplementation((sql) => {
                if (sql === 'CREATE SCHEMA IF NOT EXISTS public') return Promise.resolve([])
                if (sql.includes('DROP SCHEMA')) {
                    dropStarted = true
                    if (sql.includes('app_test')) return Promise.reject(new Error('drop failed'))
                    return Promise.resolve([])
                }
                if (dropStarted) return Promise.resolve([])
                if (sql.includes('ANY($1')) return Promise.resolve([{ schema_name: 'upl_migrations' }])
                if (sql.includes("LIKE 'app")) return Promise.resolve([{ schema_name: 'app_test' }])
                if (sql.includes("LIKE 'mhb")) return Promise.resolve([])
                if (sql.includes('auth.users')) return Promise.resolve([])
                return Promise.resolve([])
            })

            const result = await executeStartupFullReset()

            expect(result).toHaveProperty('enabled', true)
            if ('enabled' in result && result.enabled) {
                expect(result.droppedSchemas[0].status).toBe('failed')
                expect(result.droppedSchemas[0].schemaName).toBe('app_test')
            }
        })

        it('throws when residue remains after reset', async () => {
            let afterPhase = false
            mockTx.query.mockImplementation((sql) => {
                if (sql === 'CREATE SCHEMA IF NOT EXISTS public') {
                    afterPhase = true
                    return Promise.resolve([])
                }
                if (sql.includes('auth.users')) return Promise.resolve([])
                if (sql.includes('DROP SCHEMA')) return Promise.resolve([])
                if (afterPhase) {
                    if (sql.includes('ANY($1')) return Promise.resolve([])
                    if (sql.includes("LIKE 'app")) return Promise.resolve([{ schema_name: 'app_residual' }])
                    if (sql.includes("LIKE 'mhb")) return Promise.resolve([])
                } else {
                    if (sql.includes('ANY($1')) return Promise.resolve([])
                    if (sql.includes("LIKE 'app")) return Promise.resolve([{ schema_name: 'app_residual' }])
                    if (sql.includes("LIKE 'mhb")) return Promise.resolve([])
                }
                return Promise.resolve([])
            })

            await expect(executeStartupFullReset()).rejects.toThrow('Startup reset incomplete')
        })
    })

    describe('force mode', () => {
        beforeEach(() => {
            process.env.FULL_DATABASE_RESET = 'false'
            process.env.NODE_ENV = 'development'

            mockTx.query.mockResolvedValue([])
        })

        it('executes reset when force=true even if env var is false', async () => {
            const result = await executeStartupFullReset({ force: true })

            expect(result).toHaveProperty('enabled', true)
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('FULL DATABASE RESET IS ENABLED'))
        })

        it('respects env var when force is undefined', async () => {
            const result = await executeStartupFullReset()

            expect(result).toEqual({ enabled: false, status: 'disabled' })
            expect(mockWithAdvisoryLock).not.toHaveBeenCalled()
        })

        it('respects env var when force is false', async () => {
            const result = await executeStartupFullReset({ force: false })

            expect(result).toEqual({ enabled: false, status: 'disabled' })
        })

        it('still blocks force reset in production', async () => {
            process.env.NODE_ENV = 'production'

            await expect(executeStartupFullReset({ force: true })).rejects.toThrow('not allowed in production')
        })

        it('force=true with env=true still works (idempotent)', async () => {
            process.env.FULL_DATABASE_RESET = 'true'

            const result = await executeStartupFullReset({ force: true })

            expect(result).toHaveProperty('enabled', true)
        })

        it('executes full reset flow with force=true', async () => {
            let dropStarted = false
            mockTx.query.mockImplementation((sql) => {
                if (sql === 'CREATE SCHEMA IF NOT EXISTS public') return Promise.resolve([])
                if (sql.includes('DROP SCHEMA')) {
                    dropStarted = true
                    return Promise.resolve([])
                }
                if (dropStarted) return Promise.resolve([])
                if (sql.includes('ANY($1')) return Promise.resolve([{ schema_name: 'upl_migrations' }])
                if (sql.includes("LIKE 'app")) return Promise.resolve([{ schema_name: 'app_test' }])
                if (sql.includes("LIKE 'mhb")) return Promise.resolve([])
                if (sql.includes('auth.users')) return Promise.resolve([])
                return Promise.resolve([])
            })

            const result = await executeStartupFullReset({ force: true })

            expect(result).toHaveProperty('enabled', true)
            if ('enabled' in result && result.enabled) {
                expect(result.droppedSchemas.length).toBeGreaterThan(0)
            }
        })
    })
})
