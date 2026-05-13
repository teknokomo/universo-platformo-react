import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const skillPath = path.resolve('.agents/skills/playwright-best-practices/SKILL.md')
const referencePath = path.resolve('.agents/skills/playwright-best-practices/references/universo-e2e.md')

describe('Playwright agent skill repository rules', () => {
    it('keeps Universo E2E rules in the skill entrypoint', () => {
        const skill = readFileSync(skillPath, 'utf8')

        expect(skill).toContain('Universo Platformo Repository Rules')
        expect(skill).toContain('http://127.0.0.1:3100')
        expect(skill).toContain('do not run `pnpm dev`')
        expect(skill).toContain('packages/universo-core-backend/base/.env.e2e')
        expect(skill).toContain('minimal stack')
    })

    it('keeps a dedicated repository E2E reference for agents', () => {
        const reference = readFileSync(referencePath, 'utf8')

        expect(reference).toContain('pnpm run test:e2e:smoke')
        expect(reference).toContain('pnpm supabase:e2e:start:minimal')
        expect(reference).toContain('http://127.0.0.1:3100')
        expect(reference).toContain('Do not run `pnpm dev`')
    })
})
