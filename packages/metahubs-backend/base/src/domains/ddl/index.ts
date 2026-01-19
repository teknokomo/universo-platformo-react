/**
 * DDL Domain - Re-exports from @universo/schema-ddl with local KnexClient integration
 * 
 * This module provides pre-configured DDL services using the local KnexClient singleton.
 * For pure functions and types, import directly from '@universo/schema-ddl'.
 */

import { KnexClient } from './KnexClient'
import {
    createDDLServices,
    SchemaGenerator as SchemaGeneratorClass,
    SchemaMigrator as SchemaMigratorClass,
    MigrationManager as MigrationManagerClass,
} from '@universo/schema-ddl'

// Re-export pure functions from @universo/schema-ddl
export {
    generateSchemaName,
    generateTableName,
    generateColumnName,
    buildFkConstraintName,
    isValidSchemaName,
    uuidToLockKey,
    acquireAdvisoryLock,
    releaseAdvisoryLock,
    buildSchemaSnapshot,
    calculateSchemaDiff,
    ChangeType,
    generateMigrationName,
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
} from '@universo/schema-ddl'

// Re-export classes for type usage
export { SchemaGeneratorClass as SchemaGenerator }
export { SchemaMigratorClass as SchemaMigrator }
export { MigrationManagerClass as MigrationManager }

// Re-export local-only exports
export { KnexClient } from './KnexClient'
export { buildCatalogDefinitions } from './definitions/catalogs'

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
    const knex = KnexClient.getInstance()
    return createDDLServices(knex)
}

/**
 * Create a new SchemaGenerator instance using the local KnexClient.
 * @deprecated Use getDDLServices() instead for better dependency management.
 */
export function createSchemaGenerator() {
    const knex = KnexClient.getInstance()
    return new SchemaGeneratorClass(knex)
}

/**
 * Create a new MigrationManager instance using the local KnexClient.
 * @deprecated Use getDDLServices() instead for better dependency management.
 */
export function createMigrationManager() {
    const knex = KnexClient.getInstance()
    return new MigrationManagerClass(knex)
}

/**
 * Create a new SchemaMigrator instance using the local KnexClient.
 * @deprecated Use getDDLServices() instead for better dependency management.
 */
export function createSchemaMigrator() {
    const { migrator } = getDDLServices()
    return migrator
}
