/**
 * @universo/schema-ddl
 *
 * Shared DDL utilities for PostgreSQL schema management.
 * Uses Dependency Injection pattern - all classes receive Knex instance via constructor.
 *
 * Usage:
 * ```typescript
 * import { createDDLServices, generateSchemaName } from '@universo/schema-ddl'
 * import { KnexClient } from 'your-knex-singleton'
 *
 * const knex = KnexClient.getInstance()
 * const { generator, migrator, migrationManager } = createDDLServices(knex)
 *
 * const schemaName = generateSchemaName(applicationId)
 * await generator.createSchema(schemaName)
 * ```
 */

import type { Knex } from 'knex'

// Pure functions - no dependencies
export {
    generateSchemaName,
    generateTableName,
    generateColumnName,
    generateChildTableName,
    buildFkConstraintName,
    isValidSchemaName,
    generateMetahubSchemaName
} from './naming'

// Locking utilities
export { uuidToLockKey, acquireAdvisoryLock, releaseAdvisoryLock } from './locking'

// Type definitions
export type {
    EntityDefinition,
    FieldDefinition,
    SchemaSnapshot,
    SchemaEntitySnapshot,
    SchemaFieldSnapshot,
    SchemaGenerationResult,
    MigrationResult,
    MigrationRecord,
    MigrationMeta,
    MigrationChangeRecord,
    RollbackAnalysis
} from './types'

// Snapshot utilities
export { buildSchemaSnapshot, CURRENT_SCHEMA_SNAPSHOT_VERSION } from './snapshot'

// Diff utilities
export { calculateSchemaDiff, ChangeType } from './diff'
export type { SchemaDiff, SchemaChange } from './diff'

// Migration name generation
export { generateMigrationName } from './MigrationManager'

// Import classes for use in factory function
import { SchemaGenerator } from './SchemaGenerator'
import { SchemaMigrator } from './SchemaMigrator'
import { MigrationManager } from './MigrationManager'
import { SchemaCloner } from './SchemaCloner'

// Re-export classes and types (require DI)
export { SchemaGenerator, type GenerateFullSchemaOptions } from './SchemaGenerator'
export { SchemaMigrator, type ApplyChangesOptions } from './SchemaMigrator'
export { MigrationManager } from './MigrationManager'
export { SchemaCloner, cloneSchemaWithExecutor, type SchemaCloneExecutor, type CloneSchemaOptions } from './SchemaCloner'

/**
 * DDL Services container - provides all DDL classes instantiated with the same Knex instance
 */
export interface DDLServices {
    /** Schema generator for creating schemas and tables */
    generator: import('./SchemaGenerator').SchemaGenerator
    /** Schema migrator for applying schema changes */
    migrator: import('./SchemaMigrator').SchemaMigrator
    /** Migration manager for recording and listing migrations */
    migrationManager: import('./MigrationManager').MigrationManager
    /** Schema cloner for full schema copy between isolated schemas */
    cloner: import('./SchemaCloner').SchemaCloner
}

/**
 * Factory function to create all DDL services with a shared Knex instance.
 *
 * This is the recommended way to instantiate DDL classes, as it ensures
 * they all share the same database connection.
 *
 * @param knex - Knex instance to use for all DDL operations
 * @returns Object containing generator, migrator, and migrationManager instances
 *
 * @example
 * ```typescript
 * import { createDDLServices } from '@universo/schema-ddl'
 * import { KnexClient } from './KnexClient'
 *
 * const knex = KnexClient.getInstance()
 * const { generator, migrator, migrationManager } = createDDLServices(knex)
 *
 * // Now use the services
 * await generator.createSchema('app_xxx')
 * const diff = migrator.calculateDiff(oldSnapshot, newEntities)
 * ```
 */
export function createDDLServices(knex: Knex): DDLServices {
    const generator = new SchemaGenerator(knex)
    const migrationManager = new MigrationManager(knex)
    const migrator = new SchemaMigrator(knex, generator, migrationManager)
    const cloner = new SchemaCloner(knex)

    return {
        generator,
        migrator,
        migrationManager,
        cloner
    }
}
