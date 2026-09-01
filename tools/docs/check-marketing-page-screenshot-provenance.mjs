import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const PROVENANCE_PATH = path.join(ROOT, 'tools/docs/marketing-page-screenshot-provenance.json')

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')
const resolveRepoPath = (relativePath) => {
    const absolutePath = path.resolve(ROOT, relativePath)
    if (!absolutePath.startsWith(`${ROOT}${path.sep}`)) {
        throw new Error(`Provenance path escapes the repository: ${relativePath}`)
    }
    return absolutePath
}

const readPngDimensions = (buffer) => {
    if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) {
        throw new Error('not a valid PNG file')
    }
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

const errors = []
let provenance
try {
    provenance = JSON.parse(await readFile(PROVENANCE_PATH, 'utf8'))
} catch (error) {
    console.error(`Marketing-page screenshot provenance check failed: ${error.message}`)
    process.exit(1)
}

if (provenance.version !== 1) errors.push('provenance version must be 1')
if (provenance.locale !== 'en' || provenance.theme !== 'light' || provenance.project !== 'chromium') {
    errors.push('provenance must describe the committed Chromium English/light evidence')
}
if (provenance.route !== '/a/:applicationId') errors.push('provenance route must be /a/:applicationId')

for (const [field, expected] of [
    ['generator', provenance.generator],
    ['sourceTemplate', provenance.sourceTemplate]
]) {
    try {
        const file = await readFile(resolveRepoPath(expected))
        const hashField = field === 'generator' ? 'generatorSha256' : 'sourceTemplateSha256'
        if (sha256(file) !== provenance[hashField]) errors.push(`${field} hash differs from provenance`)
    } catch (error) {
        errors.push(`${field} cannot be read: ${error.message}`)
    }
}

if (!provenance.viewport || provenance.viewport.width !== 1440 || provenance.viewport.height !== 900) {
    errors.push('viewport must be 1440x900')
}

const assetPaths = new Set()
for (const asset of provenance.assets ?? []) {
    if (assetPaths.has(asset.path)) {
        errors.push(`duplicate asset entry: ${asset.path}`)
        continue
    }
    assetPaths.add(asset.path)
    try {
        const buffer = await readFile(resolveRepoPath(asset.path))
        if (sha256(buffer) !== asset.sha256) errors.push(`asset hash differs from provenance: ${asset.path}`)
        const dimensions = readPngDimensions(buffer)
        if (dimensions.width !== asset.dimensions?.width || dimensions.height !== asset.dimensions?.height) {
            errors.push(
                `asset dimensions differ from provenance: ${asset.path} (${dimensions.width}x${dimensions.height} instead of ${asset.dimensions?.width}x${asset.dimensions?.height})`
            )
        }
    } catch (error) {
        errors.push(`asset cannot be read: ${asset.path} (${error.message})`)
    }
}

if (assetPaths.size === 0) errors.push('at least one committed screenshot asset is required')

if (errors.length > 0) {
    console.error('Marketing-page screenshot provenance check failed:')
    for (const error of errors) console.error(`- ${error}`)
    process.exit(1)
}

console.log('Marketing-page screenshot provenance check passed.')
