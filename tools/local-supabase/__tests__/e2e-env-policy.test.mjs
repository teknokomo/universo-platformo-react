import { describe, expect, it } from 'vitest'
import {
    assertE2eSupabasePolicyIsSafe,
    buildE2eBackendCandidates,
    loadE2eSupabasePolicy
} from '../../testing/e2e/support/env/load-e2e-env.mjs'

describe('E2E Supabase source policy', () => {
    it('uses dedicated hosted E2E env files without falling back to the main .env', () => {
        expect(
            buildE2eBackendCandidates({
                provider: 'hosted',
                isolation: 'dedicated',
                localSupabaseInstance: 'dedicated',
                allowMainSupabase: false
            })
        ).toEqual(['.env.e2e.local', '.env.e2e'])
    })

    it('uses dedicated local E2E local-supabase env file', () => {
        expect(
            buildE2eBackendCandidates({
                provider: 'local',
                isolation: 'dedicated',
                localSupabaseInstance: 'dedicated',
                allowMainSupabase: false
            })
        ).toEqual(['.env.e2e.local-supabase'])
    })

    it('infers dedicated local policy from an explicit E2E local-supabase env file', () => {
        expect(loadE2eSupabasePolicy('.env.e2e.local-supabase')).toMatchObject({
            provider: 'local',
            isolation: 'dedicated',
            localSupabaseInstance: 'dedicated'
        })
    })

    it('requires explicit opt-in before hosted main .env can be selected', () => {
        expect(() =>
            buildE2eBackendCandidates({
                provider: 'hosted',
                isolation: 'main',
                localSupabaseInstance: 'dedicated',
                allowMainSupabase: false
            })
        ).toThrow('E2E_ALLOW_MAIN_SUPABASE')

        expect(
            buildE2eBackendCandidates({
                provider: 'hosted',
                isolation: 'main',
                localSupabaseInstance: 'dedicated',
                allowMainSupabase: true
            })
        ).toEqual(['.env'])
    })

    it('blocks destructive reset against shared or main Supabase profiles', () => {
        expect(() =>
            assertE2eSupabasePolicyIsSafe({
                policy: {
                    provider: 'hosted',
                    isolation: 'main',
                    localSupabaseInstance: 'dedicated',
                    allowMainSupabase: true
                },
                fullResetMode: 'strict'
            })
        ).toThrow('E2E_FULL_RESET_MODE=off')

        expect(() =>
            assertE2eSupabasePolicyIsSafe({
                policy: {
                    provider: 'local',
                    isolation: 'dedicated',
                    localSupabaseInstance: 'dev',
                    allowMainSupabase: false
                },
                fullResetMode: 'off'
            })
        ).toThrow('E2E_ALLOW_MAIN_SUPABASE')
    })
})
