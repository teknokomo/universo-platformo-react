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
    const normalized = String(value || 'strict').trim().toLowerCase()

    if (normalized === 'strict' || normalized === 'off') {
        return normalized
    }

    throw new Error(`Invalid E2E_FULL_RESET_MODE value: ${value}. Expected 'strict' or 'off'.`)
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

    const backendEnvPath = loadEnvFileIntoProcess(resolveEnvFile(backendRootDir, process.env.UNIVERSO_ENV_FILE?.trim(), envTarget))
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
        serverReadyTimeoutMs,
        serverStopTimeoutMs,
        serverPollIntervalMs
    }

    return cachedEnv
}
