import type { Knex } from 'knex'
import { SYSTEM_TABLE_VERSIONS, type SystemTableDef } from './systemTableDefinitions'
import { SystemTableDDLGenerator } from './SystemTableDDLGenerator'

/**
 * Structure version specification.
 * Each version describes a set of system tables and how to create them.
 */
export interface StructureVersionSpec {
    version: number
    tables: string[]
    description: string
    /** Creates all system tables in the given schema (DDL only, no seed data). */
    init: (knex: Knex, schemaName: string) => Promise<void>
    /** Declarative table definitions for this version (used by diff engine). */
    definitions: readonly SystemTableDef[]
}

/** Current numeric structure revision for internal migration engine. */
export const CURRENT_STRUCTURE_VERSION = 4

/** Public SemVer label for metahub structure version. */
export const CURRENT_STRUCTURE_VERSION_SEMVER = '0.4.0'

const STRUCTURE_SEMVER_MAP: Record<number, string> = {
    1: '0.1.0',
    2: '0.2.0',
    3: '0.3.0',
    4: CURRENT_STRUCTURE_VERSION_SEMVER
}

const SEMVER_TO_STRUCTURE_MAP: Record<string, number> = {
    '0.1.0': 1,
    '0.2.0': 2,
    '0.3.0': 3,
    [CURRENT_STRUCTURE_VERSION_SEMVER]: CURRENT_STRUCTURE_VERSION
}

const parseSemver = (value: string): [number, number, number] | null => {
    const match = value.match(/^(\d+)\.(\d+)\.(\d+)$/)
    if (!match) return null
    return [Number(match[1]), Number(match[2]), Number(match[3])]
}

const compareSemver = (left: string, right: string): number => {
    const parsedLeft = parseSemver(left)
    const parsedRight = parseSemver(right)
    if (!parsedLeft || !parsedRight) return 0
    for (let index = 0; index < 3; index += 1) {
        if (parsedLeft[index] > parsedRight[index]) return 1
        if (parsedLeft[index] < parsedRight[index]) return -1
    }
    return 0
}

const normalizeNumericStructureVersion = (value: number | null | undefined): number => {
    if (!Number.isFinite(value) || !Number.isInteger(value) || (value ?? 0) <= 0) {
        return CURRENT_STRUCTURE_VERSION
    }
    return Number(value)
}

export const structureVersionToSemver = (version: string | number | null | undefined): string => {
    if (typeof version === 'string') {
        const trimmed = version.trim()
        if (!trimmed) return CURRENT_STRUCTURE_VERSION_SEMVER
        if (parseSemver(trimmed)) return trimmed

        const numericFromString = Number(trimmed)
        if (Number.isFinite(numericFromString) && Number.isInteger(numericFromString) && numericFromString > 0) {
            return STRUCTURE_SEMVER_MAP[numericFromString] ?? CURRENT_STRUCTURE_VERSION_SEMVER
        }
        return CURRENT_STRUCTURE_VERSION_SEMVER
    }

    const normalized = normalizeNumericStructureVersion(version)
    if (normalized <= 0) {
        return CURRENT_STRUCTURE_VERSION_SEMVER
    }
    return STRUCTURE_SEMVER_MAP[normalized] ?? CURRENT_STRUCTURE_VERSION_SEMVER
}

export const semverToStructureVersion = (value: string | number | null | undefined): number => {
    if (!value) {
        return CURRENT_STRUCTURE_VERSION
    }

    if (typeof value === 'number') {
        const normalized = normalizeNumericStructureVersion(value)
        return normalized > CURRENT_STRUCTURE_VERSION ? CURRENT_STRUCTURE_VERSION + 1 : normalized
    }

    const trimmed = value.trim()
    if (!trimmed) {
        return CURRENT_STRUCTURE_VERSION
    }

    if (trimmed === CURRENT_STRUCTURE_VERSION_SEMVER) {
        return CURRENT_STRUCTURE_VERSION
    }

    const mappedVersion = SEMVER_TO_STRUCTURE_MAP[trimmed]
    if (mappedVersion) {
        return mappedVersion
    }

    const numericFromString = Number(trimmed)
    if (Number.isFinite(numericFromString) && Number.isInteger(numericFromString) && numericFromString > 0) {
        return numericFromString > CURRENT_STRUCTURE_VERSION ? CURRENT_STRUCTURE_VERSION + 1 : numericFromString
    }

    const parsed = parseSemver(trimmed)
    if (!parsed) return CURRENT_STRUCTURE_VERSION
    return compareSemver(trimmed, CURRENT_STRUCTURE_VERSION_SEMVER) > 0 ? CURRENT_STRUCTURE_VERSION + 1 : CURRENT_STRUCTURE_VERSION
}

export const normalizeStoredStructureVersion = (value: string | number | null | undefined): string => {
    const numericVersion = semverToStructureVersion(value)
    if (numericVersion === CURRENT_STRUCTURE_VERSION + 1) {
        return CURRENT_STRUCTURE_VERSION_SEMVER
    }
    return structureVersionToSemver(numericVersion)
}

/**
 * Registry of all structure versions.
 * Auto-populated from SYSTEM_TABLE_VERSIONS declarative definitions.
 */
const structureVersionRegistry = new Map<number, StructureVersionSpec>()

// ─── Build registry from declarative definitions ─────────────────────────────

for (const [version, tableDefs] of SYSTEM_TABLE_VERSIONS) {
    structureVersionRegistry.set(version, {
        version,
        tables: tableDefs.map((t) => t.name),
        description: `Structure version ${version}: ${tableDefs.map((t) => t.name).join(', ')}`,
        definitions: tableDefs,
        init: async (knex: Knex, schemaName: string): Promise<void> => {
            const generator = new SystemTableDDLGenerator(knex, schemaName)
            await generator.createAll(tableDefs)
        }
    })
}

/**
 * Returns the structure version handler for the given version.
 * Throws if version is not registered.
 */
export function getStructureVersion(version: number): StructureVersionSpec {
    const spec = structureVersionRegistry.get(version)
    if (!spec) {
        throw new Error(`Unknown structure version: ${version}. Available: [${[...structureVersionRegistry.keys()].join(', ')}]`)
    }
    return spec
}
