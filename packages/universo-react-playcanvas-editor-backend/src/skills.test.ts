import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('AI Skills Directory Validation', () => {
    const skillsDir = path.resolve(__dirname, '../../../.agents/skills')

    it('should verify that all skill folders contain a valid SKILL.md with frontmatter', () => {
        if (!fs.existsSync(skillsDir)) {
            console.warn(`Skills directory not found at ${skillsDir}. Skipping test.`)
            return
        }

        const items = fs.readdirSync(skillsDir)
        const skillFolders = items.filter((item) => {
            const fullPath = path.join(skillsDir, item)
            return fs.statSync(fullPath).isDirectory()
        })

        expect(skillFolders.length).toBeGreaterThan(0)

        for (const folder of skillFolders) {
            const skillFile = path.join(skillsDir, folder, 'SKILL.md')
            expect(fs.existsSync(skillFile)).toBe(true)

            const content = fs.readFileSync(skillFile, 'utf-8')

            // Basic YAML Frontmatter Validation
            expect(content.startsWith('---')).toBe(true)

            const parts = content.split('---')
            expect(parts.length).toBeGreaterThanOrEqual(3)

            const frontmatter = parts[1]
            expect(frontmatter).toContain('name:')
            expect(frontmatter).toContain('description:')
        }
    })
})
