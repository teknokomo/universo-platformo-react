import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC_DIR = path.resolve(__dirname, '..')

const collectSourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
        const fullPath = path.join(dir, entry)
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
            if (entry === 'node_modules' || entry === 'dist') return []
            return collectSourceFiles(fullPath)
        }
        return /\.(ts|tsx)$/.test(entry) ? [fullPath] : []
    })

describe('apps-template-mui package boundary', () => {
    it('does not import the old universo template package from runtime source', () => {
        const offenders = collectSourceFiles(SRC_DIR).filter(
            (filePath) =>
                path.basename(filePath) !== 'packageBoundary.test.ts' && readFileSync(filePath, 'utf8').includes('@universo/template-mui')
        )

        expect(offenders).toEqual([])
    })
})
