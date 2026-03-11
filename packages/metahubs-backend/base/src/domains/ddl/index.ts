/**
 * DDL Domain - Re-exports from @universo/schema-ddl with the shared database runtime.
 *
 * This module provides pre-configured DDL services using the shared Knex singleton
 * from @universo/database. For pure functions and types, import directly from
 * @universo/schema-ddl.
 */

import { getKnex } from '@universo/database'
import {
    createDDLServices,
    SchemaGenerator as SchemaGeneratorClass,
    SchemaMigrator as SchemaMigratorClass,
    MigrationManager as MigrationManagerClass,
    SchemaCloner as SchemaClonerClass
} from '@universo/schema-ddl'

// Re-export pure functions from @universo/schema-ddl
export {
    generateSchemaName,
    generateTableName,
    generateColumnName,
    generateChildTableName,
    buildFkConstraintName,
    isValidSchemaName,
    uuidToLockKey,
    acquireAdvisoryLock,
    releaseAdvisoryLock,
    buildSchemaSnapshot,
    calculateSchemaDiff,
    ChangeType,
    generateMigrationName,
    generateMetahubSchemaName,
    cloneSchemaWithExecutor
} from '@universo/schema-ddl'

// Re-export types from @universo/schema-ddl
export type {
    EntityDefinition,
    FieldDefinition,
    SchemaGenerationResult,
    SchemaSnapshot,
    SchemaEntitySnapshot,
    SchemaFieldSnapshot,
    MigrationResult,
    MigrationMeta,
    MigrationRecord,
    MigrationChangeRecord,
    RollbackAnalysis,
    SchemaDiff,
    SchemaChange,
    GenerateFullSchemaOptions,
    ApplyChangesOptions,
    SchemaCloneExecutor,
    CloneSchemaOptions
} from '@universo/schema-ddl'

// Re-export classes for type usage
export { SchemaGeneratorClass as SchemaGenerator }
export { SchemaMigratorClass as SchemaMigrator }
export { MigrationManagerClass as MigrationManager }
export { SchemaClonerClass as SchemaCloner }

// Re-export from @universo/database for backward compatibility
export { getKnex, initKnex, destroyKnex } from '@universo/database'
export { buildCatalogDefinitions } from './definitions/catalogs'

/**
 * @deprecated Use getKnex() from '@universo/database' directly.
 * Kept for backward compatibility during migration.
 */
export const KnexClient = {
    getInstance: () => getKnex(),
    destroy: async () => {
        const { destroyKnex: dk } = await import('@universo/database')
        return dk()
    }
}

/**
 * Get pre-configured DDL services using the local KnexClient singleton.
 *
 * @example
 * ```typescript
 * const { generator, migrator, migrationManager } = getDDLServices()
 * await generator.createSchema(schemaName)
 * ```
 */
export function getDDLServices() {
    return createDDLServices(getKnex())
}

/**
 * Create a new SchemaGenerator instance using the local KnexClient.
 * @deprecated Use getDDLServices() instead for better dependency management.
 */
export function createSchemaGenerator() {
    return new SchemaGeneratorClass(getKnex())
}

/**
 * Create a new MigrationManager instance using the local KnexClient.
 * @deprecated Use getDDLServices() instead for better dependency management.
 */
export function createMigrationManager() {
    return new MigrationManagerClass(getKnex())
}

/**
 * Create a new SchemaMigrator instance using the local KnexClient.
 * @deprecated Use getDDLServices() instead for better dependency management.
 */
export function createSchemaMigrator() {
    const { migrator } = getDDLServices()
    return migrator
}
