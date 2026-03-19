const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}

const mockEnsureBootstrapSuperuser = jest.fn()
const mockCreateGlobalAccessService = jest.fn()
const mockCreateAuthUserProvisioningService = jest.fn(() => ({
    ensureBootstrapSuperuser: mockEnsureBootstrapSuperuser
}))
const mockGetPoolExecutor = jest.fn(() => ({ tag: 'pool-executor' }))
const mockWithAdvisoryLock = jest.fn(async (_executor, _key, work) => work({ tag: 'tx-executor' }))
const mockCreateSupabaseAdminClient = jest.fn(() => ({ tag: 'supabase-admin' }))

jest.mock('../utils/logger', () => ({
    __esModule: true,
    default: mockLogger
}))

jest.mock(
    '@universo/admin-backend',
    () => ({
        createGlobalAccessService: (...args: unknown[]) => mockCreateGlobalAccessService(...args),
        createAuthUserProvisioningService: (...args: unknown[]) => mockCreateAuthUserProvisioningService(...args)
    }),
    { virtual: true }
)

jest.mock(
    '@universo/database',
    () => ({
        getPoolExecutor: (...args: unknown[]) => mockGetPoolExecutor(...args)
    }),
    { virtual: true }
)

jest.mock(
    '@universo/utils/database',
    () => ({
        withAdvisoryLock: (...args: unknown[]) => mockWithAdvisoryLock(...args)
    }),
    { virtual: true }
)

jest.mock('../utils/supabaseAdmin', () => ({
    createSupabaseAdminClient: (...args: unknown[]) => mockCreateSupabaseAdminClient(...args)
}))

import { bootstrapStartupSuperuser, getBootstrapSuperuserConfig } from '../bootstrap/bootstrapSuperuser'

const ORIGINAL_ENV = process.env

describe('bootstrapStartupSuperuser', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        process.env = { ...ORIGINAL_ENV }
        delete process.env.BOOTSTRAP_SUPERUSER_ENABLED
        delete process.env.BOOTSTRAP_SUPERUSER_EMAIL
        delete process.env.BOOTSTRAP_SUPERUSER_PASSWORD
        delete process.env.SERVICE_ROLE_KEY
        delete process.env.SUPABASE_URL

        mockCreateGlobalAccessService.mockReturnValue({ tag: 'global-access-service' })
        mockEnsureBootstrapSuperuser.mockResolvedValue({
            userId: 'user-1',
            email: 'root@example.com',
            createdAuthUser: true,
            profileEnsured: true,
            status: 'created'
        })
    })

    afterAll(() => {
        process.env = ORIGINAL_ENV
    })

    it('returns disabled when BOOTSTRAP_SUPERUSER_ENABLED=false', async () => {
        process.env.BOOTSTRAP_SUPERUSER_ENABLED = 'false'

        expect(getBootstrapSuperuserConfig()).toEqual({ enabled: false })

        const result = await bootstrapStartupSuperuser()

        expect(result).toEqual({ enabled: false, status: 'disabled' })
        expect(mockWithAdvisoryLock).not.toHaveBeenCalled()
        expect(mockCreateSupabaseAdminClient).not.toHaveBeenCalled()
    })

    it('fails fast when bootstrap is enabled but SERVICE_ROLE_KEY is missing', () => {
        process.env.BOOTSTRAP_SUPERUSER_ENABLED = 'true'
        process.env.SUPABASE_URL = 'https://example.supabase.co'
        process.env.BOOTSTRAP_SUPERUSER_EMAIL = 'root@example.com'
        process.env.BOOTSTRAP_SUPERUSER_PASSWORD = 'ChangeMe_123456!'

        expect(() => getBootstrapSuperuserConfig()).toThrow(
            'Bootstrap superuser requires SERVICE_ROLE_KEY when BOOTSTRAP_SUPERUSER_ENABLED=true'
        )
    })

    it('fails fast when bootstrap email is invalid', () => {
        process.env.BOOTSTRAP_SUPERUSER_ENABLED = 'true'
        process.env.SUPABASE_URL = 'https://example.supabase.co'
        process.env.SERVICE_ROLE_KEY = 'service-role'
        process.env.BOOTSTRAP_SUPERUSER_EMAIL = 'not-an-email'
        process.env.BOOTSTRAP_SUPERUSER_PASSWORD = 'ChangeMe_123456!'

        expect(() => getBootstrapSuperuserConfig()).toThrow('Bootstrap superuser email must be a valid email address')
    })

    it('fails fast when bootstrap password is too weak', () => {
        process.env.BOOTSTRAP_SUPERUSER_ENABLED = 'true'
        process.env.SUPABASE_URL = 'https://example.supabase.co'
        process.env.SERVICE_ROLE_KEY = 'service-role'
        process.env.BOOTSTRAP_SUPERUSER_EMAIL = 'root@example.com'
        process.env.BOOTSTRAP_SUPERUSER_PASSWORD = 'short123'

        expect(() => getBootstrapSuperuserConfig()).toThrow('Bootstrap superuser password must be at least 12 characters long')
    })

    it('creates or confirms the bootstrap superuser inside an advisory lock', async () => {
        process.env.BOOTSTRAP_SUPERUSER_ENABLED = 'true'
        process.env.SUPABASE_URL = 'https://example.supabase.co'
        process.env.SERVICE_ROLE_KEY = 'service-role'
        process.env.BOOTSTRAP_SUPERUSER_EMAIL = ' Root@example.com '
        process.env.BOOTSTRAP_SUPERUSER_PASSWORD = 'ChangeMe_123456!'

        const result = await bootstrapStartupSuperuser()

        expect(mockCreateSupabaseAdminClient).toHaveBeenCalledWith('https://example.supabase.co', 'service-role')
        expect(mockWithAdvisoryLock).toHaveBeenCalledWith(
            { tag: 'pool-executor' },
            'core-bootstrap-superuser:root@example.com',
            expect.any(Function),
            { timeoutMs: 15000 }
        )
        expect(mockCreateGlobalAccessService).toHaveBeenCalledWith({
            getDbExecutor: expect.any(Function)
        })
        expect(mockCreateAuthUserProvisioningService).toHaveBeenCalledWith({
            getDbExecutor: expect.any(Function),
            globalAccessService: { tag: 'global-access-service' },
            supabaseAdmin: { tag: 'supabase-admin' }
        })
        expect(mockEnsureBootstrapSuperuser).toHaveBeenCalledWith({
            email: 'root@example.com',
            password: 'ChangeMe_123456!'
        })
        expect(result).toEqual({
            enabled: true,
            userId: 'user-1',
            email: 'root@example.com',
            createdAuthUser: true,
            profileEnsured: true,
            status: 'created'
        })
    })

    it('warns when bootstrap is running with the public demo credentials', async () => {
        process.env.BOOTSTRAP_SUPERUSER_ENABLED = 'true'
        process.env.SUPABASE_URL = 'https://example.supabase.co'
        process.env.SERVICE_ROLE_KEY = 'service-role'
        process.env.BOOTSTRAP_SUPERUSER_EMAIL = 'demo-admin@example.com'
        process.env.BOOTSTRAP_SUPERUSER_PASSWORD = 'ChangeMe_123456!'

        await bootstrapStartupSuperuser()

        expect(mockLogger.warn).toHaveBeenCalledWith(
            '[server]: Bootstrap superuser is using demo credentials. Change BOOTSTRAP_SUPERUSER_EMAIL and BOOTSTRAP_SUPERUSER_PASSWORD before real deployment.'
        )
    })
})
