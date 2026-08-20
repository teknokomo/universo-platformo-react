import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { measurePngDifferenceRatio } from './png-inspection.mjs'

const EVIDENCE_PATHS = [
    'docs/en/.gitbook/assets/interpretation-network',
    'docs/ru/.gitbook/assets/interpretation-network',
    'tools/docs/interpretation-network-screenshot-provenance.json'
]
const MAX_PNG_DIFFERENCE_RATIO = 0.005

const runGit = (args, binary = false) =>
    spawnSync('git', args, {
        cwd: process.cwd(),
        ...(binary ? {} : { encoding: 'utf8' }),
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe']
    })

const untracked = runGit(['ls-files', '--others', '--exclude-standard', '--', ...EVIDENCE_PATHS])
if (untracked.error) throw untracked.error
if (untracked.status !== 0) {
    process.stderr.write(untracked.stderr)
    process.exit(untracked.status ?? 1)
}

const untrackedFiles = untracked.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

if (untrackedFiles.length > 0) {
    console.error('Interpretation Network screenshot drift check failed.')
    console.error(`Untracked evidence files:\n${untrackedFiles.map((file) => `- ${file}`).join('\n')}`)
    process.exit(1)
}

const changed = runGit(['diff', '--name-only', '--', ...EVIDENCE_PATHS])
if (changed.error) throw changed.error
if (changed.status !== 0) {
    process.stderr.write(changed.stderr)
    process.exit(changed.status ?? 1)
}

const driftErrors = []
for (const file of changed.stdout.split('\n').filter(Boolean)) {
    const baseline = runGit(['show', `:${file}`], true)
    if (baseline.error || baseline.status !== 0) {
        driftErrors.push(`${file}: tracked baseline is unavailable`)
        continue
    }

    if (file.endsWith('.png')) {
        try {
            const ratio = measurePngDifferenceRatio(baseline.stdout, readFileSync(file))
            if (ratio > MAX_PNG_DIFFERENCE_RATIO) {
                driftErrors.push(`${file}: visual difference ${(ratio * 100).toFixed(3)}% exceeds 0.500%`)
            }
        } catch (error) {
            driftErrors.push(`${file}: ${error.message}`)
        }
        continue
    }

    const normalizeProvenance = (buffer) => {
        const value = JSON.parse(buffer.toString('utf8'))
        for (const asset of value.assets ?? []) delete asset.sha256
        return JSON.stringify(value)
    }
    if (normalizeProvenance(baseline.stdout) !== normalizeProvenance(readFileSync(file))) {
        driftErrors.push(`${file}: semantic provenance changed`)
    }
}

if (driftErrors.length > 0) {
    console.error('Interpretation Network screenshot drift check failed:')
    for (const error of driftErrors) console.error(`- ${error}`)
    process.exit(1)
}

console.log('Interpretation Network screenshot drift check passed.')
