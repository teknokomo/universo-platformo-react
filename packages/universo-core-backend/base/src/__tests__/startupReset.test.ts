const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}

const mockTx = { query: jest.fn() }

const mockWithAdvisoryLock = jest.fn((_executor, _lockKey, work) => work(mockTx))
const mockGetPoolExecutor = jest.fn(() => mockPoolExec)
const mockCreateSupabaseAdminClient = jest.fn()

const mockPoolExec = { query: jest.fn() }

const mockSupabaseAdmin = {
    auth: {
        admin: {
            deleteUser: jest.fn()
        }
    }
}

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

jest.mock('../utils/supabaseAdmin', () => ({
    createSupabaseAdminClient: (...args) => {
        mockCreateSupabaseAdminClient(...args)
        return mockSupabaseAdmin
    }
}))

import { executeStartupFullReset } from '../bootstrap/startupReset'

describe('startupReset', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        process.env = { ...ORIGINAL_ENV }
        delete process.env.FULL_DATABASE_RESET
        delete process.env.NODE_ENV
        delete process.env.SUPABASE_URL
        delete process.env.SERVICE_ROLE_KEY

        mockWithAdvisoryLock.mockImplementation((_executor, _lockKey, work) => work(mockTx))
        mockSupabaseAdmin.auth.admin.deleteUser.mockResolvedValue({ error: null })

        // Default: all SQL queries return empty arrays (no schemas, no users)
        mockTx.query.mockResolvedValue([])
        mockPoolExec.query.mockResolvedValue([])
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

        it('throws when enabled but SUPABASE_URL is missing', async () => {
            process.env.FULL_DATABASE_RESET = 'true'
            process.env.SERVICE_ROLE_KEY = 'test-key'
            await expect(executeStartupFullReset()).rejects.toThrow('SUPABASE_URL')
        })

        it('throws when enabled but SERVICE_ROLE_KEY is missing', async () => {
            process.env.FULL_DATABASE_RESET = 'true'
            process.env.SUPABASE_URL = 'https://test.supabase.co'
            await expect(executeStartupFullReset()).rejects.toThrow('SERVICE_ROLE_KEY')
        })
    })

    describe('production guard', () => {
        it('throws when NODE_ENV=production and reset enabled', async () => {
            process.env.FULL_DATABASE_RESET = 'true'
            process.env.NODE_ENV = 'production'
            process.env.SUPABASE_URL = 'https://test.supabase.co'
            process.env.SERVICE_ROLE_KEY = 'test-key'

            await expect(executeStartupFullReset()).rejects.toThrow('not allowed in production')
        })

        it('does not throw in development', async () => {
            process.env.FULL_DATABASE_RESET = 'true'
            process.env.NODE_ENV = 'development'
            process.env.SUPABASE_URL = 'https://test.supabase.co'
            process.env.SERVICE_ROLE_KEY = 'test-key'

            await executeStartupFullReset()
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('FULL DATABASE RESET IS ENABLED'))
        })
    })

    describe('reset execution', () => {
        beforeEach(() => {
            process.env.FULL_DATABASE_RESET = 'true'
            process.env.NODE_ENV = 'development'
            process.env.SUPABASE_URL = 'https://test.supabase.co'
            process.env.SERVICE_ROLE_KEY = 'test-key'
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
                // Dynamic schemas: single query returns both app_* and mhb_*
                if (sql.includes("LIKE 'app") && sql.includes("LIKE 'mhb"))
                    return Promise.resolve([{ schema_name: 'app_test123' }, { schema_name: 'mhb_test456' }])
                if (sql.includes('auth.users')) return Promise.resolve([])
                return Promise.resolve([])
            })

            // Auth users for deleteAllAuthUsers (uses poolExec)
            mockPoolExec.query.mockResolvedValue([])
            mockSupabaseAdmin.auth.admin.deleteUser.mockResolvedValue({ error: null })

            const result = await executeStartupFullReset()

            expect(result).toHaveProperty('enabled', true)
            if ('enabled' in result && result.enabled) {
                // app_test123, mhb_test456, admin, metahubs, upl_migrations
                const droppedNames = result.droppedSchemas.map((s) => s.schemaName)
                expect(droppedNames).toContain('app_test123')
                expect(droppedNames).toContain('mhb_test456')
                expect(droppedNames).toContain('upl_migrations')
                // upl_migrations should be last
                expect(droppedNames[droppedNames.length - 1]).toBe('upl_migrations')
                // All drops should succeed
                expect(result.droppedSchemas.every((s) => s.status === 'dropped')).toBe(true)
            }
        })

        it('deletes auth users via Supabase Admin API', async () => {
            // No schemas in tx, but auth users exist via poolExec
            mockTx.query.mockResolvedValue([])
            mockPoolExec.query.mockResolvedValue([
                { id: 'user-1', email: 'a@test.com' },
                { id: 'user-2', email: 'b@test.com' }
            ])

            await executeStartupFullReset()

            expect(mockCreateSupabaseAdminClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-key')
            expect(mockSupabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledTimes(2)
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
                // After drops, all empty (but the test expects residue check to pass
                // because hasProjectOwnedResidue counts after-state)
                if (dropStarted) return Promise.resolve([])
                if (sql.includes('ANY($1')) return Promise.resolve([{ schema_name: 'upl_migrations' }])
                if (sql.includes("LIKE 'app")) return Promise.resolve([{ schema_name: 'app_test' }])
                if (sql.includes("LIKE 'mhb")) return Promise.resolve([])
                if (sql.includes('auth.users')) return Promise.resolve([])
                return Promise.resolve([])
            })
            mockPoolExec.query.mockResolvedValue([])

            const result = await executeStartupFullReset()

            expect(result).toHaveProperty('enabled', true)
            if ('enabled' in result && result.enabled) {
                expect(result.droppedSchemas[0].status).toBe('failed')
                expect(result.droppedSchemas[0].schemaName).toBe('app_test')
            }
        })

        it('throws when residue remains after reset', async () => {
            // Before: one schema exists. After: schema still exists (not dropped)
            let afterPhase = false
            mockTx.query.mockImplementation((sql) => {
                if (sql === 'CREATE SCHEMA IF NOT EXISTS public') {
                    afterPhase = true
                    return Promise.resolve([])
                }
                if (sql.includes('auth.users')) return Promise.resolve([])
                if (sql.includes('DROP SCHEMA')) return Promise.resolve([])
                // Schema discovery
                if (afterPhase) {
                    // After phase: schema still present (residue!)
                    if (sql.includes('ANY($1')) return Promise.resolve([])
                    if (sql.includes("LIKE 'app")) return Promise.resolve([{ schema_name: 'app_residual' }])
                    if (sql.includes("LIKE 'mhb")) return Promise.resolve([])
                } else {
                    // Before phase: one dynamic schema
                    if (sql.includes('ANY($1')) return Promise.resolve([])
                    if (sql.includes("LIKE 'app")) return Promise.resolve([{ schema_name: 'app_residual' }])
                    if (sql.includes("LIKE 'mhb")) return Promise.resolve([])
                }
                return Promise.resolve([])
            })
            mockPoolExec.query.mockResolvedValue([])

            await expect(executeStartupFullReset()).rejects.toThrow('Startup reset incomplete')
        })
    })

    describe('force mode', () => {
        beforeEach(() => {
            // Env var is false, but we'll use force=true
            process.env.FULL_DATABASE_RESET = 'false'
            process.env.NODE_ENV = 'development'
            process.env.SUPABASE_URL = 'https://test.supabase.co'
            process.env.SERVICE_ROLE_KEY = 'test-key'

            mockTx.query.mockResolvedValue([])
            mockPoolExec.query.mockResolvedValue([])
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

        it('requires SUPABASE_URL when force=true and env var is false', async () => {
            delete process.env.SUPABASE_URL

            await expect(executeStartupFullReset({ force: true })).rejects.toThrow('SUPABASE_URL')
        })

        it('requires SERVICE_ROLE_KEY when force=true and env var is false', async () => {
            delete process.env.SERVICE_ROLE_KEY

            await expect(executeStartupFullReset({ force: true })).rejects.toThrow('SERVICE_ROLE_KEY')
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
            mockPoolExec.query.mockResolvedValue([])
            mockSupabaseAdmin.auth.admin.deleteUser.mockResolvedValue({ error: null })

            const result = await executeStartupFullReset({ force: true })

            expect(result).toHaveProperty('enabled', true)
            if ('enabled' in result && result.enabled) {
                expect(result.droppedSchemas.length).toBeGreaterThan(0)
            }
        })
    })
})
