import { resolveSupabasePublicKey } from '../../utils/resolveSupabasePublicKey'

describe('resolveSupabasePublicKey', () => {
    const originalAnonKey = process.env.SUPABASE_ANON_KEY
    const originalPublishableKey = process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY

    afterEach(() => {
        if (typeof originalAnonKey === 'undefined') {
            delete process.env.SUPABASE_ANON_KEY
        } else {
            process.env.SUPABASE_ANON_KEY = originalAnonKey
        }

        if (typeof originalPublishableKey === 'undefined') {
            delete process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY
        } else {
            process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY = originalPublishableKey
        }
    })

    it('prefers the new publishable-key env when it is present', () => {
        process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'sb_publishable_test'
        process.env.SUPABASE_ANON_KEY = 'legacy_anon_test'

        expect(resolveSupabasePublicKey()).toBe('sb_publishable_test')
    })

    it('falls back to the legacy anon-key env when publishable key is absent', () => {
        delete process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY
        process.env.SUPABASE_ANON_KEY = 'legacy_anon_test'

        expect(resolveSupabasePublicKey()).toBe('legacy_anon_test')
    })

    it('throws when neither public key env is configured', () => {
        delete process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY
        delete process.env.SUPABASE_ANON_KEY

        expect(() => resolveSupabasePublicKey()).toThrow(
            'Missing Supabase public key. Set SUPABASE_PUBLISHABLE_DEFAULT_KEY or SUPABASE_ANON_KEY.'
        )
    })
})
