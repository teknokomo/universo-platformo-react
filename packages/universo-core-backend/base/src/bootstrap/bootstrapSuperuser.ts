import { createAuthUserProvisioningService, createGlobalAccessService, type EnsureBootstrapSuperuserResult } from '@universo/admin-backend'
import { getPoolExecutor } from '@universo/database'
import { withAdvisoryLock } from '@universo/utils/database'
import logger from '../utils/logger'
import { createSupabaseAdminClient } from '../utils/supabaseAdmin'

const BOOTSTRAP_SUPERUSER_LOCK_TIMEOUT_MS = 15_000
const BOOTSTRAP_SUPERUSER_LOCK_PREFIX = 'core-bootstrap-superuser'
const DEMO_BOOTSTRAP_SUPERUSER_EMAIL = 'demo-admin@example.com'
const DEMO_BOOTSTRAP_SUPERUSER_PASSWORD = 'ChangeMe_123456!'

interface BootstrapSuperuserDisabledConfig {
    enabled: false
}

interface BootstrapSuperuserEnabledConfig {
    enabled: true
    supabaseUrl: string
    serviceRoleKey: string
    email: string
    password: string
}

type BootstrapSuperuserConfig = BootstrapSuperuserDisabledConfig | BootstrapSuperuserEnabledConfig

export interface BootstrapSuperuserStartupResult extends EnsureBootstrapSuperuserResult {
    enabled: true
}

const parseEnvBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
    if (value === undefined || value === '') {
        return defaultValue
    }

    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1'
}

const normalizeEmail = (value: string): string => value.trim().toLowerCase()

const assertPresent = (value: string | undefined, envName: string): string => {
    const normalized = value?.trim()
    if (!normalized) {
        throw new Error(`Bootstrap superuser requires ${envName} when BOOTSTRAP_SUPERUSER_ENABLED=true`)
    }

    return normalized
}

const assertBootstrapEmail = (value: string): string => {
    const normalized = normalizeEmail(value)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailPattern.test(normalized)) {
        throw new Error('Bootstrap superuser email must be a valid email address')
    }

    return normalized
}

const assertBootstrapPassword = (value: string): string => {
    if (value.length < 12) {
        throw new Error('Bootstrap superuser password must be at least 12 characters long')
    }

    if (/\s/.test(value)) {
        throw new Error('Bootstrap superuser password must not contain whitespace')
    }

    return value
}

export const getBootstrapSuperuserConfig = (): BootstrapSuperuserConfig => {
    const enabled = parseEnvBoolean(process.env.BOOTSTRAP_SUPERUSER_ENABLED, true)

    if (!enabled) {
        return { enabled: false }
    }

    return {
        enabled: true,
        supabaseUrl: assertPresent(process.env.SUPABASE_URL, 'SUPABASE_URL'),
        serviceRoleKey: assertPresent(process.env.SERVICE_ROLE_KEY, 'SERVICE_ROLE_KEY'),
        email: assertBootstrapEmail(assertPresent(process.env.BOOTSTRAP_SUPERUSER_EMAIL, 'BOOTSTRAP_SUPERUSER_EMAIL')),
        password: assertBootstrapPassword(assertPresent(process.env.BOOTSTRAP_SUPERUSER_PASSWORD, 'BOOTSTRAP_SUPERUSER_PASSWORD'))
    }
}

export async function bootstrapStartupSuperuser(): Promise<BootstrapSuperuserStartupResult | { enabled: false; status: 'disabled' }> {
    const config = getBootstrapSuperuserConfig()

    if (!config.enabled) {
        logger.info('[server]: Bootstrap superuser is disabled')
        return {
            enabled: false,
            status: 'disabled'
        }
    }

    if (config.email === DEMO_BOOTSTRAP_SUPERUSER_EMAIL && config.password === DEMO_BOOTSTRAP_SUPERUSER_PASSWORD) {
        logger.warn(
            '[server]: Bootstrap superuser is using demo credentials. Change BOOTSTRAP_SUPERUSER_EMAIL and BOOTSTRAP_SUPERUSER_PASSWORD before real deployment.'
        )
    }

    logger.info('[server]: Bootstrap superuser is enabled', { email: config.email })

    const supabaseAdmin = createSupabaseAdminClient(config.supabaseUrl, config.serviceRoleKey)

    const result = await withAdvisoryLock(
        getPoolExecutor(),
        `${BOOTSTRAP_SUPERUSER_LOCK_PREFIX}:${config.email}`,
        async (tx) => {
            const globalAccessService = createGlobalAccessService({ getDbExecutor: () => tx })
            const provisioningService = createAuthUserProvisioningService({
                getDbExecutor: () => tx,
                globalAccessService,
                supabaseAdmin
            })

            return provisioningService.ensureBootstrapSuperuser({
                email: config.email,
                password: config.password
            })
        },
        { timeoutMs: BOOTSTRAP_SUPERUSER_LOCK_TIMEOUT_MS }
    )

    logger.info('[server]: Bootstrap superuser completed', {
        email: result.email,
        status: result.status,
        createdAuthUser: result.createdAuthUser
    })

    return {
        enabled: true,
        ...result
    }
}
