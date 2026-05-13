import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildBackendEnv, buildFrontendEnv, derivePostgresEnv, readFirstEnvSource } from '../write-env.mjs'

const statusEnv = {
    API_URL: 'http://127.0.0.1:54321',
    DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    ANON_KEY: 'anon-local-key',
    SERVICE_ROLE_KEY: 'service-role-local-key',
    JWT_SECRET: 'local-jwt-secret-that-is-long-enough-for-tests'
}

describe('local Supabase env writer', () => {
    it('derives direct Postgres connection settings from the Supabase CLI DB URL', () => {
        expect(derivePostgresEnv(statusEnv.DB_URL)).toEqual({
            DATABASE_HOST: '127.0.0.1',
            DATABASE_PORT: '54322',
            DATABASE_NAME: 'postgres',
            DATABASE_USER: 'postgres',
            DATABASE_PASSWORD: 'postgres',
            DATABASE_SSL: 'false'
        })
    })

    it('builds a development backend env with local-only Supabase and disabled transaction pooler', () => {
        const env = buildBackendEnv({
            statusEnv,
            target: 'dev',
            existingEnv: {
                SESSION_SECRET: 'kept-session-secret',
                BOOTSTRAP_SUPERUSER_EMAIL: 'admin@example.test',
                CUSTOM_FEATURE_FLAG: 'enabled'
            }
        })

        expect(env).toMatchObject({
            PORT: '3000',
            UNIVERSO_ENV_TARGET: 'local',
            DATABASE_HOST: '127.0.0.1',
            DATABASE_PORT: '54322',
            ALLOW_TRANSACTION_POOLER: 'false',
            SUPABASE_URL: 'http://127.0.0.1:54321',
            SUPABASE_PUBLISHABLE_DEFAULT_KEY: 'anon-local-key',
            SERVICE_ROLE_KEY: 'service-role-local-key',
            SUPABASE_JWT_SECRET: 'local-jwt-secret-that-is-long-enough-for-tests',
            SESSION_SECRET: 'kept-session-secret',
            BOOTSTRAP_SUPERUSER_EMAIL: 'admin@example.test',
            CUSTOM_FEATURE_FLAG: 'enabled',
            SMARTCAPTCHA_REGISTRATION_ENABLED: 'false'
        })
    })

    it('overrides hosted Supabase settings while preserving unrelated base env settings', () => {
        const env = buildBackendEnv({
            statusEnv,
            target: 'dev',
            existingEnv: {
                DATABASE_HOST: 'remote.pooler.supabase.com',
                DATABASE_PORT: '6543',
                DATABASE_SSL: 'true',
                DATABASE_SSL_KEY_BASE64: 'remote-cert',
                SUPABASE_URL: 'https://remote-project.supabase.co',
                SERVICE_ROLE_KEY: 'remote-service-role-key',
                SUPABASE_SERVICE_ROLE_KEY: 'remote-service-role-key',
                SUPABASE_JWKS_URL: 'https://remote-project.supabase.co/auth/v1/.well-known/jwks.json',
                SUPABASE_JWT_ISSUER: 'https://remote-project.supabase.co/auth/v1',
                FEATURE_FROM_BASE_ENV: 'keep-me'
            }
        })

        expect(env).toMatchObject({
            DATABASE_HOST: '127.0.0.1',
            DATABASE_PORT: '54322',
            DATABASE_SSL: 'false',
            SUPABASE_URL: 'http://127.0.0.1:54321',
            SERVICE_ROLE_KEY: 'service-role-local-key',
            SUPABASE_SERVICE_ROLE_KEY: 'service-role-local-key',
            FEATURE_FROM_BASE_ENV: 'keep-me'
        })
        expect(env.DATABASE_SSL_KEY_BASE64).toBe('')
        expect(env.SUPABASE_JWKS_URL).toBe('')
        expect(env.SUPABASE_JWT_ISSUER).toBe('')
    })

    it('prefers the first available base env source and keeps previous generated secrets as a fallback', () => {
        const tempDir = mkdtempSync(path.join(os.tmpdir(), 'universo-local-env-'))
        try {
            const missingPath = path.join(tempDir, 'missing.env')
            const basePath = path.join(tempDir, '.env')
            const previousPath = path.join(tempDir, '.env.local-supabase')
            writeFileSync(basePath, 'PORT=3000\nFEATURE_FROM_BASE=true\n')
            writeFileSync(previousPath, 'SESSION_SECRET=previous-session\nFEATURE_FROM_PREVIOUS=true\nFEATURE_FROM_BASE=false\n')

            const source = readFirstEnvSource([missingPath, basePath], { previousProfilePath: previousPath })

            expect(source.path).toBe(basePath)
            expect(source.env).toMatchObject({
                SESSION_SECRET: 'previous-session',
                FEATURE_FROM_PREVIOUS: 'true',
                FEATURE_FROM_BASE: 'true'
            })
        } finally {
            rmSync(tempDir, { recursive: true, force: true })
        }
    })

    it('builds an E2E backend env on port 3100 with strict reset defaults', () => {
        const env = buildBackendEnv({ statusEnv, target: 'e2e' })

        expect(env.PORT).toBe('3100')
        expect(env.UNIVERSO_ENV_TARGET).toBe('e2e')
        expect(env.E2E_FULL_RESET_MODE).toBe('strict')
        expect(env.E2E_SUPABASE_PROVIDER).toBe('local')
        expect(env.E2E_SUPABASE_ISOLATION).toBe('dedicated')
        expect(env.E2E_LOCAL_SUPABASE_INSTANCE).toBe('dedicated')
        expect(env.E2E_LOCAL_SUPABASE_STACK).toBe('minimal')
        expect(env.E2E_ALLOW_MAIN_SUPABASE).toBe('false')
        expect(env.AUTH_LOGIN_RATE_LIMIT_MAX).toBe('300')
    })

    it('rejects non-local Supabase URLs when generating local profiles', () => {
        expect(() =>
            buildBackendEnv({
                statusEnv: { ...statusEnv, API_URL: 'https://example.supabase.co' },
                target: 'dev'
            })
        ).toThrow('Supabase API URL must point to localhost or 127.0.0.1')
    })

    it('writes frontend profiles with explicit target, port separation, and local Supabase credentials', () => {
        expect(buildFrontendEnv({ statusEnv, target: 'dev' })).toMatchObject({
            UNIVERSO_ENV_TARGET: 'local',
            VITE_PORT: '8080',
            SUPABASE_URL: 'http://127.0.0.1:54321',
            SUPABASE_PUBLISHABLE_DEFAULT_KEY: 'anon-local-key',
            SUPABASE_ANON_KEY: 'anon-local-key',
            VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
            VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: 'anon-local-key',
            VITE_SUPABASE_ANON_KEY: 'anon-local-key'
        })
        expect(buildFrontendEnv({ statusEnv, target: 'e2e' })).toMatchObject({ UNIVERSO_ENV_TARGET: 'e2e', VITE_PORT: '3100' })
    })

    it('overrides hosted Supabase frontend values while preserving unrelated frontend settings', () => {
        const env = buildFrontendEnv({
            statusEnv,
            target: 'dev',
            existingEnv: {
                SUPABASE_URL: 'https://remote-project.supabase.co',
                SUPABASE_PUBLISHABLE_DEFAULT_KEY: 'remote-publishable-key',
                SUPABASE_ANON_KEY: 'remote-anon-key',
                VITE_SUPABASE_URL: 'https://remote-project.supabase.co',
                VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: 'remote-publishable-key',
                VITE_SUPABASE_ANON_KEY: 'remote-anon-key',
                VITE_API_BASE_URL: 'http://localhost:3000',
                FEATURE_FROM_FRONTEND_ENV: 'keep-me'
            }
        })

        expect(env).toMatchObject({
            SUPABASE_URL: 'http://127.0.0.1:54321',
            SUPABASE_PUBLISHABLE_DEFAULT_KEY: 'anon-local-key',
            SUPABASE_ANON_KEY: 'anon-local-key',
            VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
            VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: 'anon-local-key',
            VITE_SUPABASE_ANON_KEY: 'anon-local-key',
            VITE_API_BASE_URL: 'http://localhost:3000',
            FEATURE_FROM_FRONTEND_ENV: 'keep-me'
        })
    })
})
