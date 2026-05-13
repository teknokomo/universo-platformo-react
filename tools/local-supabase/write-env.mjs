import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import {
    assertLocalHttpUrl,
    assertLocalPostgresUrl,
    assertTarget,
    backendEnvPathByTarget,
    firstPresent,
    frontendEnvPathByTarget,
    isMainModule,
    maskSecret,
    parseArgs,
    parseEnvText,
    REPO_ROOT,
    readEnvFile,
    serializeEnv
} from './shared.mjs'
import { ensureLocalSupabaseProject, getLocalSupabaseProfile, runSupabaseCli } from './profiles.mjs'

const backendBaseEnvCandidatesByTarget = {
    dev: ['packages/universo-core-backend/base/.env', 'packages/universo-core-backend/base/.env.example'],
    e2e: [
        'packages/universo-core-backend/base/.env.e2e',
        'packages/universo-core-backend/base/.env',
        'packages/universo-core-backend/base/.env.e2e.example',
        'packages/universo-core-backend/base/.env.example'
    ]
}

const frontendBaseEnvCandidatesByTarget = {
    dev: ['packages/universo-core-frontend/base/.env', 'packages/universo-core-frontend/base/.env.example'],
    e2e: [
        'packages/universo-core-frontend/base/.env.e2e',
        'packages/universo-core-frontend/base/.env',
        'packages/universo-core-frontend/base/.env.e2e.example',
        'packages/universo-core-frontend/base/.env.example'
    ]
}

export function readSupabaseStatusEnv(target = 'dev') {
    const profile = getLocalSupabaseProfile(target)
    ensureLocalSupabaseProject(profile)
    return parseEnvText(runSupabaseCli(profile, ['status', '-o', 'env']))
}

export function readFirstEnvSource(candidatePaths, { previousProfilePath } = {}) {
    const previousProfileEnv = previousProfilePath ? readEnvFile(previousProfilePath) : {}

    for (const candidatePath of candidatePaths) {
        if (!existsSync(candidatePath)) continue

        return {
            path: candidatePath,
            env: { ...previousProfileEnv, ...readEnvFile(candidatePath) }
        }
    }

    return {
        path: null,
        env: previousProfileEnv
    }
}

export function derivePostgresEnv(dbUrl) {
    const parsed = assertLocalPostgresUrl(dbUrl, 'Supabase DB URL')
    return {
        DATABASE_HOST: parsed.hostname,
        DATABASE_PORT: parsed.port || '5432',
        DATABASE_NAME: parsed.pathname.replace(/^\//, '') || 'postgres',
        DATABASE_USER: decodeURIComponent(parsed.username || 'postgres'),
        DATABASE_PASSWORD: decodeURIComponent(parsed.password || ''),
        DATABASE_SSL: 'false'
    }
}

export function buildBackendEnv({ statusEnv, target, existingEnv = {} }) {
    const supabaseUrl = firstPresent(statusEnv, ['SUPABASE_URL', 'API_URL', 'SUPA_API_URL'])
    const dbUrl = firstPresent(statusEnv, ['DB_URL', 'POSTGRES_URL', 'SUPA_DB_URL'])
    const anonKey = firstPresent(statusEnv, ['SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'SUPABASE_ANON_KEY', 'ANON_KEY', 'SUPA_ANON_KEY'])
    const serviceRoleKey = firstPresent(statusEnv, [
        'SERVICE_ROLE_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SERVICE_ROLE_KEY_JWT',
        'SUPA_SERVICE_KEY'
    ])
    const jwtSecret = firstPresent(statusEnv, ['SUPABASE_JWT_SECRET', 'JWT_SECRET', 'SUPA_JWT_SECRET'])

    if (!supabaseUrl) throw new Error('Supabase status output does not contain API_URL/SUPABASE_URL.')
    if (!dbUrl) throw new Error('Supabase status output does not contain DB_URL.')
    if (!anonKey) throw new Error('Supabase status output does not contain an anon key.')
    if (!serviceRoleKey) throw new Error('Supabase status output does not contain a service_role key.')
    if (!jwtSecret) throw new Error('Supabase status output does not contain JWT_SECRET.')

    assertLocalHttpUrl(supabaseUrl, 'Supabase API URL')
    const databaseEnv = derivePostgresEnv(dbUrl)
    const port = target === 'e2e' ? '3100' : existingEnv.PORT || '3000'
    const bootstrapEmail = target === 'e2e' ? 'e2e-admin@example.com' : 'local-admin@example.com'
    const sessionSecret = existingEnv.SESSION_SECRET || crypto.randomBytes(32).toString('hex')

    return {
        ...existingEnv,
        PORT: port,
        NODE_ENV: 'development',
        UNIVERSO_ENV_TARGET: target === 'e2e' ? 'e2e' : 'local',
        E2E_SUPABASE_PROVIDER: target === 'e2e' ? 'local' : existingEnv.E2E_SUPABASE_PROVIDER,
        E2E_SUPABASE_ISOLATION: target === 'e2e' ? 'dedicated' : existingEnv.E2E_SUPABASE_ISOLATION,
        E2E_LOCAL_SUPABASE_STACK:
            target === 'e2e' ? existingEnv.E2E_LOCAL_SUPABASE_STACK || 'minimal' : existingEnv.E2E_LOCAL_SUPABASE_STACK,
        E2E_LOCAL_SUPABASE_INSTANCE:
            target === 'e2e' ? existingEnv.E2E_LOCAL_SUPABASE_INSTANCE || 'dedicated' : existingEnv.E2E_LOCAL_SUPABASE_INSTANCE,
        E2E_ALLOW_MAIN_SUPABASE: target === 'e2e' ? 'false' : existingEnv.E2E_ALLOW_MAIN_SUPABASE,
        ...databaseEnv,
        DATABASE_SSL_KEY_BASE64: '',
        ALLOW_TRANSACTION_POOLER: 'false',
        SUPABASE_URL: supabaseUrl,
        SUPABASE_PUBLISHABLE_DEFAULT_KEY: anonKey,
        SUPABASE_ANON_KEY: anonKey,
        SERVICE_ROLE_KEY: serviceRoleKey,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
        SUPABASE_JWT_SECRET: jwtSecret,
        SUPABASE_JWKS_URL: '',
        SUPABASE_JWT_ISSUER: '',
        SESSION_SECRET: sessionSecret,
        BOOTSTRAP_SUPERUSER_ENABLED: existingEnv.BOOTSTRAP_SUPERUSER_ENABLED || 'true',
        BOOTSTRAP_SUPERUSER_EMAIL: existingEnv.BOOTSTRAP_SUPERUSER_EMAIL || bootstrapEmail,
        BOOTSTRAP_SUPERUSER_PASSWORD: existingEnv.BOOTSTRAP_SUPERUSER_PASSWORD || 'UniversoLocal_123456!',
        AUTH_REGISTRATION_ENABLED: existingEnv.AUTH_REGISTRATION_ENABLED || 'true',
        AUTH_LOGIN_ENABLED: existingEnv.AUTH_LOGIN_ENABLED || 'true',
        AUTH_EMAIL_CONFIRMATION_REQUIRED: target === 'e2e' ? 'false' : existingEnv.AUTH_EMAIL_CONFIRMATION_REQUIRED || 'false',
        AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: existingEnv.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS || '60000',
        AUTH_LOGIN_RATE_LIMIT_MAX: target === 'e2e' ? '300' : existingEnv.AUTH_LOGIN_RATE_LIMIT_MAX || '100',
        SMARTCAPTCHA_REGISTRATION_ENABLED: target === 'e2e' ? 'false' : existingEnv.SMARTCAPTCHA_REGISTRATION_ENABLED || 'false',
        SMARTCAPTCHA_LOGIN_ENABLED: target === 'e2e' ? 'false' : existingEnv.SMARTCAPTCHA_LOGIN_ENABLED || 'false',
        SMARTCAPTCHA_PUBLICATION_ENABLED: target === 'e2e' ? 'false' : existingEnv.SMARTCAPTCHA_PUBLICATION_ENABLED || 'false',
        ...(target === 'e2e'
            ? {
                  E2E_TEST_USER_PASSWORD: existingEnv.E2E_TEST_USER_PASSWORD || 'UniversoE2E_123456!',
                  E2E_TEST_USER_EMAIL_DOMAIN: existingEnv.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test',
                  E2E_FULL_RESET_MODE: existingEnv.E2E_FULL_RESET_MODE || 'strict'
              }
            : {})
    }
}

export function buildFrontendEnv({ target, existingEnv = {} }) {
    return {
        ...existingEnv,
        UNIVERSO_ENV_TARGET: target === 'e2e' ? 'e2e' : 'local',
        VITE_HOST: existingEnv.VITE_HOST || '127.0.0.1',
        VITE_PORT: target === 'e2e' ? '3100' : existingEnv.VITE_PORT || '8080'
    }
}

export function writeProfileFiles({ target, statusEnv }) {
    const backendPath = backendEnvPathByTarget[target]
    const frontendPath = frontendEnvPathByTarget[target]
    const backendSource = readFirstEnvSource(
        backendBaseEnvCandidatesByTarget[target].map((candidatePath) => path.join(REPO_ROOT, candidatePath)),
        { previousProfilePath: backendPath }
    )
    const frontendSource = readFirstEnvSource(
        frontendBaseEnvCandidatesByTarget[target].map((candidatePath) => path.join(REPO_ROOT, candidatePath)),
        { previousProfilePath: frontendPath }
    )
    const backendEnv = buildBackendEnv({ statusEnv, target, existingEnv: backendSource.env })
    const frontendEnv = buildFrontendEnv({ target, existingEnv: frontendSource.env })

    mkdirSync(path.dirname(backendPath), { recursive: true })
    mkdirSync(path.dirname(frontendPath), { recursive: true })

    const header = [
        '# Generated by pnpm env:local-supabase.',
        '# Local-only Supabase profile. Do not commit this file.',
        '# Regenerate after pnpm supabase:local:nuke or Supabase CLI key changes.'
    ]

    writeFileSync(backendPath, serializeEnv(backendEnv, header), { mode: 0o600 })
    writeFileSync(frontendPath, serializeEnv(frontendEnv, header), { mode: 0o600 })

    return {
        backendPath,
        frontendPath,
        backendEnv,
        frontendEnv,
        backendSourcePath: backendSource.path,
        frontendSourcePath: frontendSource.path
    }
}

export function summarizeProfile(result) {
    return [
        `Backend env: ${result.backendPath}`,
        `Backend base: ${result.backendSourcePath || 'minimal generated profile'}`,
        `Frontend env: ${result.frontendPath}`,
        `Frontend base: ${result.frontendSourcePath || 'minimal generated profile'}`,
        `Profile target: ${result.backendEnv.UNIVERSO_ENV_TARGET}`,
        `E2E provider: ${result.backendEnv.E2E_SUPABASE_PROVIDER || 'n/a'}`,
        `E2E isolation: ${result.backendEnv.E2E_SUPABASE_ISOLATION || 'n/a'}`,
        `Supabase URL: ${result.backendEnv.SUPABASE_URL}`,
        `Database: ${result.backendEnv.DATABASE_USER}@${result.backendEnv.DATABASE_HOST}:${result.backendEnv.DATABASE_PORT}/${result.backendEnv.DATABASE_NAME}`,
        `Anon key: ${maskSecret(result.backendEnv.SUPABASE_ANON_KEY)}`,
        `Service role key: ${maskSecret(result.backendEnv.SERVICE_ROLE_KEY)}`
    ].join('\n')
}

export async function main(argv = process.argv.slice(2)) {
    const args = parseArgs(argv)
    const target = assertTarget(args.get('target') || 'dev')
    const result = writeProfileFiles({ target, statusEnv: readSupabaseStatusEnv(target) })
    process.stdout.write(`${summarizeProfile(result)}\n`)
}

if (isMainModule(import.meta.url)) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error)
        process.exitCode = 1
    })
}
