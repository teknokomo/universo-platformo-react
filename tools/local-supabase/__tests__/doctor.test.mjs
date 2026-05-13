import { describe, expect, it } from 'vitest'
import { validateDoctorEnv } from '../doctor.mjs'

const validEnv = {
    SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_PUBLISHABLE_DEFAULT_KEY: 'anon-local-key',
    SERVICE_ROLE_KEY: 'service-role-local-key',
    SUPABASE_JWT_SECRET: 'local-jwt-secret-that-is-long-enough-for-tests',
    DATABASE_HOST: '127.0.0.1',
    DATABASE_PORT: '54322',
    DATABASE_USER: 'postgres',
    DATABASE_PASSWORD: 'postgres',
    DATABASE_NAME: 'postgres'
}

describe('local Supabase doctor env validation', () => {
    it('accepts a complete local Supabase profile', () => {
        const result = validateDoctorEnv(validEnv)

        expect(result.supabaseUrl.toString()).toBe('http://127.0.0.1:54321/')
        expect(result.publicKey).toBe('anon-local-key')
    })

    it('rejects incomplete profiles before network checks run', () => {
        expect(() => validateDoctorEnv({ ...validEnv, SERVICE_ROLE_KEY: '' })).toThrow('SERVICE_ROLE_KEY')
    })

    it('rejects hosted Supabase URLs for local doctor mode', () => {
        expect(() => validateDoctorEnv({ ...validEnv, SUPABASE_URL: 'https://example.supabase.co' })).toThrow(
            'SUPABASE_URL must point to localhost or 127.0.0.1'
        )
    })

    it('rejects unexpectedly short JWT secrets', () => {
        expect(() => validateDoctorEnv({ ...validEnv, SUPABASE_JWT_SECRET: 'short' })).toThrow('SUPABASE_JWT_SECRET')
    })
})
