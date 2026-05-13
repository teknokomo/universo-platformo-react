import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const rootPackageJson = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8'))

describe('local Supabase package scripts', () => {
    it('keeps destructive local start behind env generation and doctor checks', () => {
        const script = rootPackageJson.scripts['start:allclean:local-supabase']

        expect(script).toContain('pnpm supabase:local:start')
        expect(script).toContain('pnpm doctor:local-supabase')
        expect(script).toContain('_FORCE_DATABASE_RESET=true')
        expect(script).toContain('UNIVERSO_ENV_FILE=.env.local-supabase')
        expect(script.indexOf('pnpm supabase:local:start')).toBeLessThan(script.indexOf('pnpm doctor:local-supabase'))
        expect(script.indexOf('pnpm doctor:local-supabase')).toBeLessThan(script.indexOf('pnpm clean:all'))
    })

    it('starts the local Supabase stack before normal local app start', () => {
        const script = rootPackageJson.scripts['start:local-supabase']

        expect(script).toContain('pnpm supabase:local:start')
        expect(script).toContain('pnpm doctor:local-supabase')
        expect(script.indexOf('pnpm supabase:local:start')).toBeLessThan(script.indexOf('pnpm doctor:local-supabase'))
    })

    it('keeps minimal local app starts on the reduced Supabase stack', () => {
        const startScript = rootPackageJson.scripts['start:local-supabase:minimal']
        const allcleanScript = rootPackageJson.scripts['start:allclean:local-supabase:minimal']

        expect(startScript).toContain('pnpm supabase:local:start:minimal')
        expect(startScript).toContain('pnpm doctor:local-supabase')
        expect(startScript).toContain('UNIVERSO_ENV_FILE=.env.local-supabase')
        expect(startScript.indexOf('pnpm supabase:local:start:minimal')).toBeLessThan(startScript.indexOf('pnpm doctor:local-supabase'))

        expect(allcleanScript).toContain('pnpm supabase:local:start:minimal')
        expect(allcleanScript).toContain('pnpm doctor:local-supabase')
        expect(allcleanScript).toContain('_FORCE_DATABASE_RESET=true')
        expect(allcleanScript.indexOf('pnpm supabase:local:start:minimal')).toBeLessThan(
            allcleanScript.indexOf('pnpm doctor:local-supabase')
        )
        expect(allcleanScript.indexOf('pnpm doctor:local-supabase')).toBeLessThan(allcleanScript.indexOf('pnpm clean:all'))
    })

    it('keeps local E2E commands behind the E2E profile doctor', () => {
        const buildScript = rootPackageJson.scripts['build:e2e:local-supabase']
        const smokeScript = rootPackageJson.scripts['test:e2e:smoke:local-supabase']

        expect(buildScript).toContain('pnpm supabase:e2e:start:minimal')
        expect(buildScript).toContain('pnpm doctor:e2e:local-supabase')
        expect(smokeScript).toContain('pnpm supabase:e2e:start:minimal')
        expect(smokeScript).toContain('pnpm doctor:e2e:local-supabase')
        expect(smokeScript).toContain('UNIVERSO_ENV_FILE=.env.e2e.local-supabase')
        expect(buildScript.indexOf('pnpm supabase:e2e:start:minimal')).toBeLessThan(buildScript.indexOf('pnpm env:e2e:local-supabase'))
    })

    it('starts Supabase through the localhost-bound Docker network', () => {
        const script = rootPackageJson.scripts['supabase:local:start']

        expect(script).toContain('tools/local-supabase/supabase.mjs')
        expect(script).toContain('--action start')
        expect(script).toContain('--target dev')
    })

    it('exposes dedicated local E2E Supabase lifecycle commands', () => {
        expect(rootPackageJson.scripts['supabase:e2e:start:minimal']).toContain('--target e2e --stack minimal')
        expect(rootPackageJson.scripts['supabase:e2e:start']).toContain('--target e2e --stack full')
        expect(rootPackageJson.scripts['supabase:e2e:stop']).toContain('--action stop --target e2e')
        expect(rootPackageJson.scripts['supabase:e2e:nuke']).toContain('--action nuke --target e2e')
    })

    it('provides full local E2E variants for service-specific suites', () => {
        expect(rootPackageJson.scripts['build:e2e:local-supabase:full']).toContain('pnpm supabase:e2e:start')
        expect(rootPackageJson.scripts['test:e2e:smoke:local-supabase:full']).toContain('pnpm supabase:e2e:start')
    })
})
