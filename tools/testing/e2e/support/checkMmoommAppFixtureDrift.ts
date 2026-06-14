import fs from 'fs'
import path from 'path'
import { repoRoot } from './env/load-e2e-env.mjs'
import { MMOOMM_APP_FIXTURE_FILENAME, assertMmoommAppFixtureEnvelopeContract } from './mmoommAppFixtureContract.ts'

const trackedPath = path.resolve(repoRoot, 'tools', 'fixtures', MMOOMM_APP_FIXTURE_FILENAME)
const generatedPathArg = process.argv.slice(2).find((arg) => arg !== '--')
const generatedPath = generatedPathArg
    ? path.resolve(repoRoot, generatedPathArg)
    : path.resolve(repoRoot, 'tools', 'fixtures', `.generated-${MMOOMM_APP_FIXTURE_FILENAME}`)

if (!fs.existsSync(generatedPath)) {
    throw new Error(
        `Generated MMOOMM app fixture does not exist: ${generatedPath}. Run the generator with MMOOMM_APP_FIXTURE_OUTPUT_PATH=tools/fixtures/.generated-${MMOOMM_APP_FIXTURE_FILENAME} or pass an explicit generated fixture path.`
    )
}

const readJson = (filePath: string): unknown => JSON.parse(fs.readFileSync(filePath, 'utf8'))

const normalizeVolatileValues = (value: unknown, maps = createNormalizerMaps(), pathSegments: string[] = []): unknown => {
    if (isVolatileFileSizePath(pathSegments) && typeof value === 'number') {
        return '<file-size>'
    }
    if (typeof value === 'number' && Number.isInteger(value) && value >= 1_700_000_000_000) {
        return '<numeric-timestamp>'
    }
    if (typeof value === 'string') {
        return normalizeJsonBase64String(value, maps) ?? normalizeString(value, maps)
    }
    if (Array.isArray(value)) {
        return value.map((item, index) => normalizeVolatileValues(item, maps, [...pathSegments, String(index)]))
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, item]) => [
                normalizeString(key, maps),
                normalizeVolatileValues(item, maps, [...pathSegments, key])
            ])
        )
    }
    return value
}

const isVolatileFileSizePath = (pathSegments: string[]): boolean => {
    if (pathSegments.at(-1) !== 'size') return false
    return pathSegments.some((segment) =>
        ['files', 'sourceFiles', 'assetFiles', 'generatedArtifacts', 'localFiles', 'bundledFiles', 'payloadFile', 'assets'].includes(
            segment
        )
    )
}

const createNormalizerMaps = () => ({
    uuid: new Map<string, string>(),
    hex32: new Map<string, string>(),
    hash64: new Map<string, string>()
})

type NormalizerMaps = ReturnType<typeof createNormalizerMaps>

const tokenFor = (map: Map<string, string>, value: string, prefix: string): string => {
    const existing = map.get(value)
    if (existing) return existing
    const token = `<${prefix}:${map.size + 1}>`
    map.set(value, token)
    return token
}

const normalizeString = (value: string, maps: NormalizerMaps): string =>
    value
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, (match) =>
            tokenFor(maps.uuid, match.toLowerCase(), 'uuid')
        )
        .replace(/\b[0-9a-f]{64}\b/gi, (match) => tokenFor(maps.hash64, match.toLowerCase(), 'hash64'))
        .replace(/[0-9a-f]{32}/gi, (match) => tokenFor(maps.hex32, match.toLowerCase(), 'hex32'))
        .replace(/\bproject_\d+\b/g, 'project_<number>')
        .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\b/g, '<timestamp>')

const normalizeJsonBase64String = (value: string, maps: NormalizerMaps): string | null => {
    const dataUrlPrefix = 'data:application/json;base64,'
    if (value.startsWith(dataUrlPrefix)) {
        const normalizedPayload = normalizeJsonBase64Payload(value.slice(dataUrlPrefix.length), maps)
        return normalizedPayload ? `${dataUrlPrefix}${normalizedPayload}` : null
    }
    return normalizeJsonBase64Payload(value, maps)
}

const normalizeJsonBase64Payload = (value: string, maps: NormalizerMaps): string | null => {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length < 64) {
        return null
    }
    try {
        const decoded = Buffer.from(value, 'base64').toString('utf8')
        if (!decoded.trimStart().startsWith('{')) {
            return null
        }
        const parsed = JSON.parse(decoded) as unknown
        return `normalized-json:${JSON.stringify(normalizeVolatileValues(parsed, maps))}`
    } catch {
        return null
    }
}

const tracked = readJson(trackedPath)
const generated = readJson(generatedPath)

assertMmoommAppFixtureEnvelopeContract(tracked as Record<string, unknown>)
assertMmoommAppFixtureEnvelopeContract(generated as Record<string, unknown>)

const normalizedTracked = JSON.stringify(normalizeVolatileValues(tracked), null, 2)
const normalizedGenerated = JSON.stringify(normalizeVolatileValues(generated), null, 2)

if (normalizedTracked !== normalizedGenerated) {
    throw new Error(
        [
            'MMOOMM app fixture drift detected after normalizing volatile IDs, timestamps, and checksums.',
            `Tracked fixture: ${trackedPath}`,
            `Generated fixture: ${generatedPath}`
        ].join('\n')
    )
}

console.log(`MMOOMM app fixture drift check passed: ${path.relative(repoRoot, generatedPath)}`)
