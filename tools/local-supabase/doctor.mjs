import pg from 'pg'
import {
    assertLocalHttpUrl,
    assertTarget,
    envFileByTarget,
    firstPresent,
    isMainModule,
    maskSecret,
    parseArgs,
    readEnvFile,
    runCommand
} from './shared.mjs'
import { getLocalSupabaseProfile } from './profiles.mjs'

const DEFAULT_TIMEOUT_MS = 10_000
const { Client } = pg

export function validateDoctorEnv(env) {
    const requiredKeys = [
        'SUPABASE_URL',
        'SERVICE_ROLE_KEY',
        'SUPABASE_JWT_SECRET',
        'DATABASE_HOST',
        'DATABASE_PORT',
        'DATABASE_USER',
        'DATABASE_PASSWORD',
        'DATABASE_NAME'
    ]
    const missing = requiredKeys.filter((key) => !env[key])
    const publicKey = firstPresent(env, ['SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'SUPABASE_ANON_KEY'])
    if (!publicKey) missing.push('SUPABASE_PUBLISHABLE_DEFAULT_KEY or SUPABASE_ANON_KEY')
    if (missing.length > 0) {
        throw new Error(`Local Supabase env is incomplete: ${missing.join(', ')}`)
    }

    const supabaseUrl = assertLocalHttpUrl(env.SUPABASE_URL, 'SUPABASE_URL')
    if (env.SUPABASE_JWT_SECRET.length < 32) {
        throw new Error('SUPABASE_JWT_SECRET is unexpectedly short.')
    }

    return { supabaseUrl, publicKey }
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(url, { ...options, signal: controller.signal })
    } finally {
        clearTimeout(timeout)
    }
}

export async function checkHttp({ name, url, headers, acceptedStatuses = [200] }) {
    const response = await fetchWithTimeout(url, { headers })
    if (!acceptedStatuses.includes(response.status)) {
        const body = await response.text().catch(() => '')
        throw new Error(`${name} returned HTTP ${response.status}${body ? `: ${body.slice(0, 240)}` : ''}`)
    }
    return response.status
}

export async function checkPostgres(env) {
    const client = new Client({
        host: env.DATABASE_HOST,
        port: Number(env.DATABASE_PORT),
        user: env.DATABASE_USER,
        password: env.DATABASE_PASSWORD,
        database: env.DATABASE_NAME,
        ssl: env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: DEFAULT_TIMEOUT_MS
    })

    await client.connect()
    try {
        const result = await client.query('select current_database() as database, current_user as username')
        return result.rows[0]
    } finally {
        await client.end()
    }
}

export async function runDoctor({ target = 'dev', envPath = envFileByTarget[target] } = {}) {
    const env = readEnvFile(envPath)
    const { supabaseUrl, publicKey } = validateDoctorEnv(env)
    const profile = getLocalSupabaseProfile(target)

    const checks = []
    checks.push(['docker', () => runCommand('docker', ['--version']).trim()])
    checks.push(['supabase-cli', () => runCommand('supabase', ['--version']).trim()])
    checks.push([
        'auth-health',
        () => checkHttp({ name: 'Auth health', url: new URL('/auth/v1/health', supabaseUrl).toString(), acceptedStatuses: [200] })
    ])
    checks.push([
        'rest-api',
        () =>
            checkHttp({
                name: 'REST API',
                url: new URL('/rest/v1/', supabaseUrl).toString(),
                headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
                acceptedStatuses: [200, 300, 404]
            })
    ])
    checks.push([
        'auth-admin',
        () =>
            checkHttp({
                name: 'Auth Admin API',
                url: new URL('/auth/v1/admin/users?page=1&per_page=1', supabaseUrl).toString(),
                headers: { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}` },
                acceptedStatuses: [200]
            })
    ])
    checks.push(['postgres', () => checkPostgres(env)])

    const results = []
    for (const [name, check] of checks) {
        try {
            const value = await check()
            results.push({ name, ok: true, value })
        } catch (error) {
            results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) })
        }
    }

    return { envPath, env, publicKey, profile, results }
}

export function formatDoctorReport(report) {
    const lines = [
        `Local Supabase doctor: ${report.envPath}`,
        `Profile: ${report.profile.target}`,
        `Project id: ${report.profile.projectId}`,
        `SUPABASE_URL: ${report.env.SUPABASE_URL}`,
        `Studio URL: http://127.0.0.1:${report.profile.ports.studio}`,
        `Database port: ${report.profile.ports.db}`,
        `SERVICE_ROLE_KEY: ${maskSecret(report.env.SERVICE_ROLE_KEY)}`,
        `SUPABASE_JWT_SECRET: ${maskSecret(report.env.SUPABASE_JWT_SECRET)}`
    ]

    for (const result of report.results) {
        lines.push(result.ok ? `OK ${result.name}` : `FAIL ${result.name}: ${result.error}`)
    }

    return lines.join('\n')
}

export async function main(argv = process.argv.slice(2)) {
    const args = parseArgs(argv)
    const target = assertTarget(args.get('target') || 'dev')
    const report = await runDoctor({ target })
    process.stdout.write(`${formatDoctorReport(report)}\n`)

    if (report.results.some((result) => !result.ok)) {
        process.exitCode = 1
    }
}

if (isMainModule(import.meta.url)) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error)
        process.exitCode = 1
    })
}
