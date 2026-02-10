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

/** Current structure version for new schemas. */
export const CURRENT_STRUCTURE_VERSION = 2

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
