import { describe, expect, it } from 'vitest'
import {
    buildE2eSupabaseConfig,
    getExcludeArgs,
    getLocalSupabaseProfile,
    getSupabaseWorkdirArgs,
    localSupabaseProfiles,
    minimalExcludedServices
} from '../profiles.mjs'

describe('local Supabase profiles', () => {
    it('keeps development and E2E profiles on separate project ids and ports', () => {
        const dev = getLocalSupabaseProfile('dev')
        const e2e = getLocalSupabaseProfile('e2e')

        expect(dev.projectId).toBe('upstream-universo-platformo-react')
        expect(e2e.projectId).toBe('upstream-universo-platformo-react-e2e')
        expect(e2e.workdir).toContain('.local/supabase-e2e')
        expect(new Set(Object.values(dev.ports)).size).toBe(Object.values(dev.ports).length)
        expect(new Set(Object.values(e2e.ports)).size).toBe(Object.values(e2e.ports).length)

        for (const devPort of Object.values(dev.ports)) {
            expect(Object.values(e2e.ports)).not.toContain(devPort)
        }
    })

    it('uses explicit workdir arguments for Supabase CLI commands', () => {
        expect(getSupabaseWorkdirArgs(localSupabaseProfiles.e2e)).toEqual(['--workdir', localSupabaseProfiles.e2e.workdir])
    })

    it('keeps minimal stack exclusions centralized', () => {
        const args = getExcludeArgs('minimal')

        for (const serviceName of minimalExcludedServices) {
            expect(args).toContain(serviceName)
        }
        expect(getExcludeArgs('full')).toEqual([])
    })

    it('generates E2E config with isolated ports and E2E redirects', () => {
        const config = buildE2eSupabaseConfig()

        expect(config).toContain('project_id = "upstream-universo-platformo-react-e2e"')
        expect(config).toContain('port = 55321')
        expect(config).toContain('port = 55322')
        expect(config).toContain('port = 55323')
        expect(config).toContain('shadow_port = 55320')
        expect(config).toContain('api_url = "http://127.0.0.1:55321"')
        expect(config).toContain('site_url = "http://localhost:3100"')
        expect(config).toContain('http://127.0.0.1:3100')
    })
})
