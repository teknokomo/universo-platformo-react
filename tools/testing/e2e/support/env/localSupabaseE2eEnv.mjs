const localSupabaseOverrides = Object.freeze({
    UNIVERSO_ENV_FILE: '.env.e2e.local-supabase',
    UNIVERSO_FRONTEND_ENV_FILE: 'packages/universo-react-core-frontend/.env.e2e.local-supabase',
    E2E_BASE_URL: 'http://127.0.0.1:3100',
    E2E_PORT: '3100',
    HOST: '127.0.0.1',
    PORT: '3100'
})

export function withLocalSupabaseE2eEnv(overrides = {}) {
    return { ...overrides, ...localSupabaseOverrides }
}
