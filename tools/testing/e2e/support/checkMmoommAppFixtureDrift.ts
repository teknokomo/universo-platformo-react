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
    if (isVolatilePlayCanvasProjectNumericIdPath(pathSegments) && typeof value === 'number') {
        return '<playcanvas-project-number>'
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
        const entries = Object.entries(value as Record<string, unknown>)
        const normalizedEntries = entries
            .filter(
                ([key, item]) =>
                    !isDefaultPlayCanvasMaterialField(key, item, value) &&
                    !isEmptyPlayCanvasAssetMetaField(key, item, value, pathSegments) &&
                    !isEmptyPlayCanvasEditorDocumentMetaField(key, item, value, pathSegments) &&
                    !isVolatilePlayCanvasEditorDocumentVersionField(key, pathSegments)
            )
            .map(([key, item]) => [normalizeString(key, maps), normalizeVolatileValues(item, maps, [...pathSegments, key])])
        return Object.fromEntries(normalizedEntries)
    }
    return value
}

const DEFAULT_PLAYCANVAS_MATERIAL_FIELDS = new Map<string, unknown>([
    ['alphaFade', 1],
    ['alphaToCoverage', false],
    ['ambient', [1, 1, 1]],
    ['ambientTint', true],
    ['anisotropyIntensity', 0],
    ['anisotropyRotation', 0],
    ['clearCoat', 0],
    ['clearCoatBumpiness', 1],
    ['clearCoatGloss', 1],
    ['clearCoatGlossMap', null],
    ['clearCoatGlossMapChannel', 'r'],
    ['clearCoatGlossMapOffset', [0, 0]],
    ['clearCoatGlossMapTiling', [1, 1]],
    ['clearCoatGlossMapUv', 0],
    ['clearCoatGlossVertexColor', false],
    ['clearCoatGlossVertexColorChannel', 'r'],
    ['clearCoatMap', null],
    ['clearCoatMapChannel', 'r'],
    ['clearCoatMapOffset', [0, 0]],
    ['clearCoatMapTiling', [1, 1]],
    ['clearCoatMapUv', 0],
    ['clearCoatNormalMap', null],
    ['clearCoatNormalMapOffset', [0, 0]],
    ['clearCoatNormalMapTiling', [1, 1]],
    ['clearCoatNormalMapUv', 0],
    ['clearCoatVertexColor', false],
    ['clearCoatVertexColorChannel', 'r'],
    ['cubeMapProjectionBox', { center: [0, 0, 0], halfExtents: [0.5, 0.5, 0.5] }],
    ['diffuseTint', true],
    ['emissiveTint', true],
    ['metalnessTint', true],
    ['mipmaps', true],
    ['opacityFadesSpecular', true],
    ['sheenGlossTint', true],
    ['sheenTint', true],
    ['twoSidedLighting', false]
])

const isDefaultPlayCanvasMaterialField = (key: string, item: unknown, owner: unknown): boolean => {
    const expectedValue = DEFAULT_PLAYCANVAS_MATERIAL_FIELDS.get(key)
    if (!DEFAULT_PLAYCANVAS_MATERIAL_FIELDS.has(key) || stableStringify(item) !== stableStringify(expectedValue)) {
        return false
    }
    if (!owner || typeof owner !== 'object' || Array.isArray(owner)) {
        return false
    }
    const record = owner as Record<string, unknown>
    return (
        (Array.isArray(record.diffuse) || Array.isArray(record.emissive)) &&
        (record.blendType === 1 || record.blendType === 2 || typeof record.blendType === 'string') &&
        (typeof record.opacity === 'number' || record.opacity === undefined)
    )
}

const isEmptyPlayCanvasAssetMetaField = (key: string, item: unknown, owner: unknown, pathSegments: string[]): boolean => {
    if (key !== 'meta' || item !== null || pathSegments.at(-2) !== 'assets' || !/^\d+$/.test(pathSegments.at(-1) ?? '')) {
        return false
    }
    if (!owner || typeof owner !== 'object' || Array.isArray(owner)) {
        return false
    }
    const record = owner as Record<string, unknown>
    return (
        typeof record.name === 'string' &&
        (typeof record.id === 'number' || typeof record.id === 'string') &&
        (typeof record.type === 'string' || typeof record.file === 'object' || typeof record.url === 'string')
    )
}

const isEmptyPlayCanvasEditorDocumentMetaField = (key: string, item: unknown, owner: unknown, pathSegments: string[]): boolean => {
    if (
        key !== 'meta' ||
        item !== null ||
        pathSegments.at(-1) !== 'editorDocument' ||
        pathSegments.at(-2) !== 'metadata' ||
        !pathSegments.includes('assets')
    ) {
        return false
    }
    if (!owner || typeof owner !== 'object' || Array.isArray(owner)) {
        return false
    }
    const record = owner as Record<string, unknown>
    return (
        (record.data !== undefined || Array.isArray(record.tags) || typeof record.preload === 'boolean') &&
        (typeof record.source === 'boolean' || record.file !== undefined || record.data !== undefined)
    )
}

// Scene-local asset saves increment this optimistic-concurrency revision in the
// runtime payload. It is intentionally absent from the authored fixture and must
// not make an otherwise equivalent generated snapshot drift.
const isVolatilePlayCanvasEditorDocumentVersionField = (key: string, pathSegments: string[]): boolean =>
    key === 'version' && pathSegments.at(-1) === 'editorDocument' && pathSegments.includes('assets')

const isVolatileFileSizePath = (pathSegments: string[]): boolean => {
    if (pathSegments.at(-1) !== 'size') return false
    return pathSegments.some((segment) =>
        ['files', 'sourceFiles', 'assetFiles', 'generatedArtifacts', 'localFiles', 'bundledFiles', 'payloadFile', 'assets'].includes(
            segment
        )
    )
}

const isVolatilePlayCanvasProjectNumericIdPath = (pathSegments: string[]): boolean =>
    pathSegments.at(-1) === 'project' &&
    pathSegments.at(-2) === 'data' &&
    pathSegments.at(-3)?.startsWith('project_') === true &&
    pathSegments.includes('playCanvasEditorRealtime') &&
    pathSegments.includes('documents')

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

const normalizeJsonBase64String = (value: string, maps: NormalizerMaps): unknown | null => {
    const dataUrlPrefix = 'data:application/json;base64,'
    if (value.startsWith(dataUrlPrefix)) {
        const normalizedPayload = normalizeJsonBase64Payload(value.slice(dataUrlPrefix.length), maps)
        return normalizedPayload
            ? {
                  __type: 'normalized-json-data-url',
                  prefix: dataUrlPrefix,
                  payload: normalizedPayload
              }
            : null
    }
    return normalizeJsonBase64Payload(value, maps)
}

const normalizeJsonBase64Payload = (value: string, maps: NormalizerMaps): unknown | null => {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length < 64) {
        return null
    }
    try {
        const decoded = Buffer.from(value, 'base64').toString('utf8')
        if (!decoded.trimStart().startsWith('{')) {
            return null
        }
        const parsed = JSON.parse(decoded) as unknown
        return normalizeVolatileValues(parsed, maps)
    } catch {
        return null
    }
}

const stableStringify = (value: unknown): string => {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value)
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`
    }
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
        .join(',')}}`
}

const summarizeValue = (value: unknown): string => {
    const serialized = JSON.stringify(value)
    return serialized === undefined ? 'undefined' : serialized.slice(0, 300)
}

const findFirstDiff = (left: unknown, right: unknown, pathLabel = '$'): string | null => {
    if (stableStringify(left) === stableStringify(right)) {
        return null
    }
    if (typeof left !== typeof right || left === null || right === null || typeof left !== 'object') {
        return `${pathLabel}\nTracked: ${summarizeValue(left)}\nGenerated: ${summarizeValue(right)}`
    }
    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right)) {
            return `${pathLabel}\nTracked: ${summarizeValue(left)}\nGenerated: ${summarizeValue(right)}`
        }
        if (left.length !== right.length) {
            return `${pathLabel}.length\nTracked: ${left.length}\nGenerated: ${right.length}`
        }
        for (const [index, item] of left.entries()) {
            const diff = findFirstDiff(item, right[index], `${pathLabel}[${index}]`)
            if (diff) return diff
        }
        return `${pathLabel}\nTracked: ${summarizeValue(left)}\nGenerated: ${summarizeValue(right)}`
    }
    const leftRecord = left as Record<string, unknown>
    const rightRecord = right as Record<string, unknown>
    const keys = [...new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])].sort()
    for (const key of keys) {
        if (!(key in leftRecord) || !(key in rightRecord)) {
            return `${pathLabel}.${key}\nTracked: ${summarizeValue(leftRecord[key])}\nGenerated: ${summarizeValue(rightRecord[key])}`
        }
        const diff = findFirstDiff(leftRecord[key], rightRecord[key], `${pathLabel}.${key}`)
        if (diff) return diff
    }
    return `${pathLabel}\nTracked: ${summarizeValue(left)}\nGenerated: ${summarizeValue(right)}`
}

const tracked = readJson(trackedPath)
const generated = readJson(generatedPath)

assertMmoommAppFixtureEnvelopeContract(tracked as Record<string, unknown>)
assertMmoommAppFixtureEnvelopeContract(generated as Record<string, unknown>)

const normalizedTracked = normalizeVolatileValues(tracked)
const normalizedGenerated = normalizeVolatileValues(generated)

if (stableStringify(normalizedTracked) !== stableStringify(normalizedGenerated)) {
    const firstDiff = findFirstDiff(normalizedTracked, normalizedGenerated)
    throw new Error(
        [
            'MMOOMM app fixture drift detected after normalizing volatile IDs, timestamps, and checksums.',
            `Tracked fixture: ${trackedPath}`,
            `Generated fixture: ${generatedPath}`,
            firstDiff ? `First normalized difference:\n${firstDiff}` : null
        ]
            .filter(Boolean)
            .join('\n')
    )
}

// eslint-disable-next-line no-console
console.log(`MMOOMM app fixture drift check passed: ${path.relative(repoRoot, generatedPath)}`)
