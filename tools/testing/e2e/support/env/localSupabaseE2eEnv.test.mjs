import assert from 'node:assert/strict'
import test from 'node:test'
import { withLocalSupabaseE2eEnv } from './localSupabaseE2eEnv.mjs'

test('local Supabase target overrides ambient or caller-provided remote E2E settings', () => {
    const childEnv = withLocalSupabaseE2eEnv({
        E2E_BASE_URL: 'https://remote.example.test',
        E2E_PORT: '3000',
        HOST: 'remote.example.test',
        PORT: '3000',
        UNIVERSO_E2E_RUN_LOCK_OWNER_PID: '4123',
        UNIVERSO_E2E_RUN_LOCK_TOKEN: 'delegated-lock-token'
    })

    assert.equal(childEnv.E2E_BASE_URL, 'http://127.0.0.1:3100')
    assert.equal(childEnv.E2E_PORT, '3100')
    assert.equal(childEnv.HOST, '127.0.0.1')
    assert.equal(childEnv.PORT, '3100')
    assert.equal(childEnv.UNIVERSO_ENV_FILE, '.env.e2e.local-supabase')
    assert.equal(childEnv.UNIVERSO_FRONTEND_ENV_FILE, 'packages/universo-react-core-frontend/.env.e2e.local-supabase')
    assert.equal(childEnv.UNIVERSO_E2E_RUN_LOCK_OWNER_PID, '4123')
    assert.equal(childEnv.UNIVERSO_E2E_RUN_LOCK_TOKEN, 'delegated-lock-token')
})
