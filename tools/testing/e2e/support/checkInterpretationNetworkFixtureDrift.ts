import fs from 'fs'
import path from 'path'
import type { MetahubSnapshotTransportEnvelope } from '@universo-react/types'
import { validateSnapshotEnvelope } from '@universo-react/utils'
import { repoRoot } from './env/load-e2e-env.mjs'
import {
    INTERPRETATION_NETWORK_FIXTURE_FILENAME,
    assertInterpretationNetworkFixtureEnvelopeContract
} from './interpretationNetworkFixtureContract.ts'

const trackedPath = path.resolve(repoRoot, 'tools', 'fixtures', INTERPRETATION_NETWORK_FIXTURE_FILENAME)
const generatedPathArg = process.argv.slice(2).find((arg) => arg !== '--')
const generatedPath = generatedPathArg
    ? path.resolve(repoRoot, generatedPathArg)
    : path.resolve(repoRoot, 'tools', 'testing', 'e2e', '.artifacts', `generated-${INTERPRETATION_NETWORK_FIXTURE_FILENAME}`)

type NormalizerMaps = ReturnType<typeof createNormalizerMaps>

const createNormalizerMaps = () => ({
    uuid: new Map<string, string>(),
    hex32: new Map<string, string>(),
    hash64: new Map<string, string>()
})

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
        .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\b/g, '<timestamp>')

const normalizeVolatileValues = (value: unknown, maps = createNormalizerMaps()): unknown => {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 1_700_000_000_000) {
        return '<numeric-timestamp>'
    }
    if (typeof value === 'string') {
        return normalizeString(value, maps)
    }
    if (Array.isArray(value)) {
        return value.map((item) => normalizeVolatileValues(item, maps))
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, item]) => [
                normalizeString(key, maps),
                normalizeVolatileValues(item, maps)
            ])
        )
    }
    return value
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

const readFixture = (filePath: string): MetahubSnapshotTransportEnvelope => {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Interpretation Network fixture does not exist: ${filePath}`)
    }
    return validateSnapshotEnvelope(JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>)
}

const validateContract = (label: string, fixture: MetahubSnapshotTransportEnvelope): void => {
    try {
        assertInterpretationNetworkFixtureEnvelopeContract(fixture)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`${label} fixture does not satisfy the Interpretation Network contract.\n${message}`)
    }
}

const tracked = readFixture(trackedPath)
const generated = readFixture(generatedPath)

validateContract('Tracked', tracked)
validateContract('Generated', generated)

const normalizedTracked = normalizeVolatileValues(tracked)
const normalizedGenerated = normalizeVolatileValues(generated)

if (stableStringify(normalizedTracked) !== stableStringify(normalizedGenerated)) {
    const firstDiff = findFirstDiff(normalizedTracked, normalizedGenerated)
    throw new Error(
        [
            'Interpretation Network fixture drift detected after normalizing volatile IDs, timestamps, and snapshot hashes.',
            `Tracked fixture: ${trackedPath}`,
            `Generated fixture: ${generatedPath}`,
            firstDiff ? `First normalized difference:\n${firstDiff}` : null
        ]
            .filter(Boolean)
            .join('\n')
    )
}

process.stdout.write(`Interpretation Network fixture drift check passed: ${path.relative(repoRoot, generatedPath)}\n`)
