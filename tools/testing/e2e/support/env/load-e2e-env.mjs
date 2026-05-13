import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const repoRoot = path.resolve(currentDir, '../../../../..')
export const e2eRootDir = path.resolve(repoRoot, 'tools/testing/e2e')
export const backendRootDir = path.resolve(repoRoot, 'packages/universo-core-backend/base')
export const frontendRootDir = path.resolve(repoRoot, 'packages/universo-core-frontend/base')
export const artifactsDir = path.resolve(e2eRootDir, '.artifacts')
export const authDir = path.resolve(e2eRootDir, '.auth')
export const manifestPath = path.resolve(artifactsDir, 'run-manifest.json')
export const storageStatePath = path.resolve(authDir, 'storage-state.json')

let cachedEnv = null

const parsePositiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(String(value ?? ''), 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const parsePositiveIntegerWithMinimum = (value, fallback, minimum) => {
    const parsed = parsePositiveInteger(value, fallback)
    return Math.max(parsed, minimum)
}

const normalizeFullResetMode = (value) => {
    const normalized = String(value || 'strict')
        .trim()
        .toLowerCase()

    if (normalized === 'strict' || normalized === 'off') {
        return normalized
    }

    throw new Error(`Invalid E2E_FULL_RESET_MODE value: ${value}. Expected 'strict' or 'off'.`)
}

const normalizeEnum = (name, value, allowedValues, fallback) => {
    const normalized = String(value || fallback)
        .trim()
        .toLowerCase()

    if (allowedValues.includes(normalized)) {
        return normalized
    }

    throw new Error(`Invalid ${name} value: ${value}. Expected one of: ${allowedValues.join(', ')}.`)
}

const normalizeHost = (value) => {
    if (!value || value === '0.0.0.0' || value === '::') {
        return '127.0.0.1'
    }

    return value
}

const buildCandidateEnvFiles = (target) => {
    if (target === 'e2e') {
        return ['.env.e2e.local', '.env.e2e', '.env']
    }

    if (target === 'test') {
        return ['.env.test.local', '.env.test', '.env']
    }

    return ['.env']
}

const readEnvObject = (envPath) => {
    if (!envPath || !fs.existsSync(envPath)) {
        return {}
    }

    return dotenv.parse(fs.readFileSync(envPath, 'utf8'))
}

const inferPolicyFromPath = (explicitPath) => {
    if (!explicitPath) return {}
    if (explicitPath.includes('.env.e2e.local-supabase')) {
        return { provider: 'local', isolation: 'dedicated', localSupabaseInstance: 'dedicated' }
    }
    if (explicitPath.includes('.env.local-supabase')) {
        return { provider: 'local', localSupabaseInstance: 'dev' }
    }
    if (explicitPath.includes('.env.e2e')) {
        return { provider: 'hosted', isolation: 'dedicated' }
    }
    return {}
}

export const loadE2eSupabasePolicy = (explicitBackendPath) => {
    const mainEnv = readEnvObject(path.resolve(backendRootDir, '.env'))
    const explicitPolicy = inferPolicyFromPath(explicitBackendPath)
    const provider = normalizeEnum(
        'E2E_SUPABASE_PROVIDER',
        explicitPolicy.provider || process.env.E2E_SUPABASE_PROVIDER || mainEnv.E2E_SUPABASE_PROVIDER,
        ['hosted', 'local'],
        'hosted'
    )
    const isolation = normalizeEnum(
        'E2E_SUPABASE_ISOLATION',
        explicitPolicy.isolation || process.env.E2E_SUPABASE_ISOLATION || mainEnv.E2E_SUPABASE_ISOLATION,
        ['dedicated', 'main'],
        'dedicated'
    )
    const localSupabaseStack = normalizeEnum(
        'E2E_LOCAL_SUPABASE_STACK',
        process.env.E2E_LOCAL_SUPABASE_STACK || mainEnv.E2E_LOCAL_SUPABASE_STACK,
        ['minimal', 'full'],
        'minimal'
    )
    const localSupabaseInstance = normalizeEnum(
        'E2E_LOCAL_SUPABASE_INSTANCE',
        explicitPolicy.localSupabaseInstance || process.env.E2E_LOCAL_SUPABASE_INSTANCE || mainEnv.E2E_LOCAL_SUPABASE_INSTANCE,
        ['dedicated', 'dev'],
        'dedicated'
    )
    const allowMainSupabase = String(process.env.E2E_ALLOW_MAIN_SUPABASE || mainEnv.E2E_ALLOW_MAIN_SUPABASE || 'false').trim() === 'true'

    return {
        provider,
        isolation,
        localSupabaseStack,
        localSupabaseInstance,
        allowMainSupabase
    }
}

export const assertE2eSupabasePolicyIsSafe = ({ policy, fullResetMode }) => {
    const usesMainSupabase = policy.isolation === 'main' || (policy.provider === 'local' && policy.localSupabaseInstance === 'dev')

    if (!usesMainSupabase) {
        return
    }

    if (!policy.allowMainSupabase) {
        throw new Error('E2E shared/main Supabase mode requires E2E_ALLOW_MAIN_SUPABASE=true.')
    }

    if (fullResetMode !== 'off') {
        throw new Error('E2E shared/main Supabase mode requires E2E_FULL_RESET_MODE=off.')
    }
}

export const buildE2eBackendCandidates = (policy, explicitPath) => {
    if (explicitPath) {
        return [explicitPath]
    }

    if (policy.provider === 'hosted' && policy.isolation === 'dedicated') {
        return ['.env.e2e.local', '.env.e2e']
    }

    if (policy.provider === 'hosted' && policy.isolation === 'main') {
        if (!policy.allowMainSupabase) {
            throw new Error('Hosted E2E main Supabase mode requires E2E_ALLOW_MAIN_SUPABASE=true before .env can be used.')
        }
        return ['.env']
    }

    if (policy.provider === 'local' && policy.localSupabaseInstance === 'dedicated') {
        return ['.env.e2e.local-supabase']
    }

    if (policy.provider === 'local' && policy.localSupabaseInstance === 'dev') {
        if (!policy.allowMainSupabase) {
            throw new Error('Local E2E dev Supabase mode requires E2E_ALLOW_MAIN_SUPABASE=true before .env.local-supabase can be used.')
        }
        return ['.env.local-supabase']
    }

    throw new Error(`Unsupported E2E Supabase policy: provider=${policy.provider}, instance=${policy.localSupabaseInstance}`)
}

const resolveExplicitPath = (rootDir, explicitPath) => {
    if (!explicitPath) {
        return null
    }

    return path.isAbsolute(explicitPath) ? explicitPath : path.resolve(rootDir, explicitPath)
}

const resolveEnvFile = (rootDir, explicitPath, target) => {
    const explicitResolved = resolveExplicitPath(rootDir, explicitPath)
    if (explicitResolved) {
        return explicitResolved
    }

    return buildCandidateEnvFiles(target)
        .map((candidate) => path.resolve(rootDir, candidate))
        .find((candidate) => fs.existsSync(candidate))
}

const resolveE2eBackendEnvFile = (explicitPath, policy) => {
    const candidates = buildE2eBackendCandidates(policy, explicitPath)
        .map((candidate) => (path.isAbsolute(candidate) ? candidate : path.resolve(backendRootDir, candidate)))
        .filter((candidate) => fs.existsSync(candidate))

    if (candidates.length > 0) {
        return candidates[0]
    }

    throw new Error(
        `Unable to resolve E2E backend env file for provider=${policy.provider}, isolation=${policy.isolation}, localInstance=${
            policy.localSupabaseInstance
        }. Expected one of: ${buildE2eBackendCandidates(policy, explicitPath).join(', ')}`
    )
}

const loadEnvFileIntoProcess = (envPath) => {
    if (!envPath || !fs.existsSync(envPath)) {
        return null
    }

    dotenv.config({ path: envPath, override: false })
    return envPath
}

export function ensureE2eDirectories() {
    fs.mkdirSync(artifactsDir, { recursive: true })
    fs.mkdirSync(authDir, { recursive: true })
}

export function loadE2eEnvironment() {
    if (cachedEnv) {
        return cachedEnv
    }

    const envTarget = (process.env.UNIVERSO_ENV_TARGET || 'e2e').trim()
    process.env.UNIVERSO_ENV_TARGET = envTarget

    const explicitBackendEnvPath = process.env.UNIVERSO_ENV_FILE?.trim()
    const e2eSupabasePolicy = envTarget === 'e2e' ? loadE2eSupabasePolicy(explicitBackendEnvPath) : null
    const backendEnvPath = loadEnvFileIntoProcess(
        envTarget === 'e2e'
            ? resolveE2eBackendEnvFile(resolveExplicitPath(backendRootDir, explicitBackendEnvPath), e2eSupabasePolicy)
            : resolveEnvFile(backendRootDir, explicitBackendEnvPath, envTarget)
    )
    if (backendEnvPath) {
        process.env.UNIVERSO_ENV_FILE = backendEnvPath
    }

    const frontendEnvPath = resolveEnvFile(frontendRootDir, process.env.UNIVERSO_FRONTEND_ENV_FILE?.trim(), envTarget)
    if (frontendEnvPath) {
        process.env.UNIVERSO_FRONTEND_ENV_FILE = frontendEnvPath
    }

    ensureE2eDirectories()

    const effectivePort = process.env.E2E_PORT || (envTarget === 'e2e' ? '3100' : process.env.PORT || '3000')
    process.env.PORT = effectivePort

    const port = Number.parseInt(effectivePort, 10)
    const baseURL = process.env.E2E_BASE_URL || `http://${normalizeHost(process.env.HOST)}:${Number.isNaN(port) ? 3000 : port}`

    process.env.E2E_BASE_URL = baseURL
    process.env.E2E_AUTH_PATH = process.env.E2E_AUTH_PATH || '/auth'
    process.env.E2E_TEST_USER_PASSWORD = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
    process.env.E2E_TEST_USER_ROLE_CODENAMES = process.env.E2E_TEST_USER_ROLE_CODENAMES || 'User'
    process.env.E2E_TEST_USER_EMAIL_DOMAIN = process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'
    process.env.E2E_FULL_RESET_MODE = normalizeFullResetMode(process.env.E2E_FULL_RESET_MODE)
    if (e2eSupabasePolicy) {
        process.env.E2E_SUPABASE_PROVIDER = e2eSupabasePolicy.provider
        process.env.E2E_SUPABASE_ISOLATION = e2eSupabasePolicy.isolation
        process.env.E2E_LOCAL_SUPABASE_STACK = e2eSupabasePolicy.localSupabaseStack
        process.env.E2E_LOCAL_SUPABASE_INSTANCE = e2eSupabasePolicy.localSupabaseInstance
        process.env.E2E_ALLOW_MAIN_SUPABASE = e2eSupabasePolicy.allowMainSupabase ? 'true' : 'false'
        assertE2eSupabasePolicyIsSafe({ policy: e2eSupabasePolicy, fullResetMode: process.env.E2E_FULL_RESET_MODE })
    }
    process.env.E2E_SERVER_READY_TIMEOUT_MS = String(parsePositiveInteger(process.env.E2E_SERVER_READY_TIMEOUT_MS, 300000))
    process.env.E2E_SERVER_STOP_TIMEOUT_MS = String(parsePositiveInteger(process.env.E2E_SERVER_STOP_TIMEOUT_MS, 15000))
    process.env.E2E_SERVER_POLL_INTERVAL_MS = String(parsePositiveInteger(process.env.E2E_SERVER_POLL_INTERVAL_MS, 1000))

    if (envTarget === 'e2e') {
        process.env.DATABASE_POOL_MAX = String(parsePositiveIntegerWithMinimum(process.env.DATABASE_POOL_MAX, 15, 15))
        process.env.DATABASE_KNEX_ACQUIRE_TIMEOUT_MS = String(
            parsePositiveIntegerWithMinimum(process.env.DATABASE_KNEX_ACQUIRE_TIMEOUT_MS, 60000, 60000)
        )
        process.env.DATABASE_KNEX_CREATE_TIMEOUT_MS = String(
            parsePositiveIntegerWithMinimum(process.env.DATABASE_KNEX_CREATE_TIMEOUT_MS, 30000, 30000)
        )
        process.env.DATABASE_KNEX_IDLE_TIMEOUT_MS = String(
            parsePositiveIntegerWithMinimum(process.env.DATABASE_KNEX_IDLE_TIMEOUT_MS, 30000, 30000)
        )
    }

    const serverReadyTimeoutMs = parsePositiveInteger(process.env.E2E_SERVER_READY_TIMEOUT_MS, 300000)
    const serverStopTimeoutMs = parsePositiveInteger(process.env.E2E_SERVER_STOP_TIMEOUT_MS, 15000)
    const serverPollIntervalMs = parsePositiveInteger(process.env.E2E_SERVER_POLL_INTERVAL_MS, 1000)

    cachedEnv = {
        envTarget,
        repoRoot,
        e2eRootDir,
        backendRootDir,
        frontendRootDir,
        artifactsDir,
        authDir,
        manifestPath,
        storageStatePath,
        backendEnvPath,
        frontendEnvPath,
        baseURL,
        fullResetMode: process.env.E2E_FULL_RESET_MODE,
        supabaseProvider: e2eSupabasePolicy?.provider ?? null,
        supabaseIsolation: e2eSupabasePolicy?.isolation ?? null,
        localSupabaseStack: e2eSupabasePolicy?.localSupabaseStack ?? null,
        localSupabaseInstance: e2eSupabasePolicy?.localSupabaseInstance ?? null,
        allowMainSupabase: e2eSupabasePolicy?.allowMainSupabase ?? false,
        serverReadyTimeoutMs,
        serverStopTimeoutMs,
        serverPollIntervalMs
    }

    return cachedEnv
}
