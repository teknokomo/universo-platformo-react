import type { Knex } from 'knex'
import { SYSTEM_TABLE_VERSIONS, type SystemTableDef } from './systemTableDefinitions'
import { SystemTableDDLGenerator } from './SystemTableDDLGenerator'
import { MetahubValidationError } from '../../shared/domainErrors'
import { CURRENT_METAHUB_STRUCTURE_VERSION_SEMVER } from '@universo-react/types'

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
export const CURRENT_STRUCTURE_VERSION = 1

/** Public SemVer label for metahub structure version. */
export const CURRENT_STRUCTURE_VERSION_SEMVER = CURRENT_METAHUB_STRUCTURE_VERSION_SEMVER

const STRUCTURE_SEMVER_MAP = new Map<number, typeof CURRENT_STRUCTURE_VERSION_SEMVER>([
    [CURRENT_STRUCTURE_VERSION, CURRENT_STRUCTURE_VERSION_SEMVER]
])
const SEMVER_TO_STRUCTURE_MAP = new Map<string, number>([[CURRENT_STRUCTURE_VERSION_SEMVER, CURRENT_STRUCTURE_VERSION]])

const unsupportedStructureVersion = (value: unknown): MetahubValidationError =>
    new MetahubValidationError(`Unsupported metahub structure version: ${String(value)}`, { structureVersion: value })

export const structureVersionToSemver = (version: string | number | null | undefined): typeof CURRENT_STRUCTURE_VERSION_SEMVER => {
    if (version === null || version === undefined) throw unsupportedStructureVersion(version)

    if (typeof version === 'string') {
        const trimmed = version.trim()
        const numericVersion = SEMVER_TO_STRUCTURE_MAP.get(trimmed)
        const semver = numericVersion === undefined ? undefined : STRUCTURE_SEMVER_MAP.get(numericVersion)
        if (semver !== undefined) return semver
        throw unsupportedStructureVersion(version)
    }

    const semver = STRUCTURE_SEMVER_MAP.get(version)
    if (semver !== undefined) return semver
    throw unsupportedStructureVersion(version)
}

export const semverToStructureVersion = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) throw unsupportedStructureVersion(value)

    if (typeof value === 'number') {
        if (STRUCTURE_SEMVER_MAP.has(value)) return value
        throw unsupportedStructureVersion(value)
    }

    const trimmed = value.trim()
    const mappedVersion = SEMVER_TO_STRUCTURE_MAP.get(trimmed)
    if (mappedVersion !== undefined) return mappedVersion
    throw unsupportedStructureVersion(value)
}

export const normalizeStoredStructureVersion = (value: string | number | null | undefined): typeof CURRENT_STRUCTURE_VERSION_SEMVER => {
    return structureVersionToSemver(semverToStructureVersion(value))
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
