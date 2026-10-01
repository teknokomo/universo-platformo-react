import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../..')
const ISOLATION_POLICY = path.join(REPOSITORY_ROOT, 'tools/check-apps-template-isolation.mjs')

describe('apps-template-mui package boundary', () => {
    it('uses the repository isolation policy for source and dependency boundaries', () => {
        const output = execFileSync(process.execPath, [ISOLATION_POLICY], {
            cwd: REPOSITORY_ROOT,
            encoding: 'utf8'
        })

        expect(output).toContain('apps-template-mui isolation guard passed.')
    })
})
