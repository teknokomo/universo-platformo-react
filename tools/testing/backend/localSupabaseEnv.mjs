import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const REPO_ROOT = process.cwd()
export const BACKEND_ENV_PATH = path.resolve(REPO_ROOT, 'packages/universo-react-core-backend/.env.e2e.local-supabase')

export const parseEnvFile = (filePath) => {
    const entries = new Map()
    for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/u)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const separatorIndex = line.indexOf('=')
        if (separatorIndex === -1) continue
        const key = line.slice(0, separatorIndex).trim()
        let value = line.slice(separatorIndex + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
        }
        entries.set(key, value)
    }
    return entries
}

/**
 * Loads the generated local-Supabase backend env, validates the required
 * connection keys and returns the derived PostgreSQL URL. Exits with a clear
 * message when the env file is missing or incomplete.
 */
export const loadLocalSupabaseDatabaseUrl = () => {
    if (!fs.existsSync(BACKEND_ENV_PATH)) {
        console.error(`Missing ${path.relative(REPO_ROOT, BACKEND_ENV_PATH)}. Run "pnpm env:e2e:local-supabase" first.`)
        process.exit(1)
    }

    const envFile = parseEnvFile(BACKEND_ENV_PATH)
    const resolveValue = (key) => process.env[key]?.trim() || envFile.get(key)?.trim() || ''
    const requiredKeys = ['DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_NAME']
    const missingKeys = requiredKeys.filter((key) => {
        const value = resolveValue(key)
        return value.length === 0 && !(key === 'DATABASE_PASSWORD' && envFile.has(key))
    })
    if (missingKeys.length > 0) {
        console.error(`Local E2E Supabase env is incomplete; missing: ${missingKeys.join(', ')}`)
        process.exit(1)
    }

    return {
        envFile,
        databaseUrl: `postgres://${encodeURIComponent(resolveValue('DATABASE_USER'))}:${encodeURIComponent(
            resolveValue('DATABASE_PASSWORD')
        )}@${resolveValue('DATABASE_HOST')}:${resolveValue('DATABASE_PORT')}/${resolveValue('DATABASE_NAME')}`
    }
}

export const runStep = (command, args, label, extraEnv = {}) =>
    new Promise((resolve) => {
        const step = spawn(command, args, {
            stdio: 'inherit',
            shell: process.platform === 'win32',
            env: { ...process.env, ...extraEnv }
        })
        step.on('error', (error) => {
            console.error(`${label} failed to start: ${error instanceof Error ? error.message : String(error)}`)
            resolve(1)
        })
        step.on('close', (code) => resolve(code ?? 1))
    })

/**
 * Applies the registered platform migrations before real-PostgreSQL suites run;
 * the E2E runner resets schemas after browser runs, so suites that rely on the
 * `applications` schema must recreate it deterministically.
 */
export const ensurePlatformMigrations = async (databaseUrl) => {
    const exitCode = await runStep('node', ['tools/testing/backend/ensure-platform-migrations.mjs'], 'Platform migrations', {
        DATABASE_TEST_URL: databaseUrl
    })
    return exitCode
}
