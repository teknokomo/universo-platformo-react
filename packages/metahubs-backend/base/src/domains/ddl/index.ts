/**
 * DDL Domain - Re-exports from @universo/schema-ddl with the shared database runtime.
 *
 * This module provides pre-configured DDL services using the shared Knex singleton
 * from @universo/database. For pure functions and types, import directly from
 * @universo/schema-ddl.
 *
 * Route handlers must NOT import getKnex() directly — instead, use the pool-level
 * wrappers exported from this module (acquirePoolAdvisoryLock, releasePoolAdvisoryLock,
 * createPoolTemplateSeedCleanupService, createPoolTemplateSeedMigrator, etc.).
 */

import type { Knex } from 'knex'
import { getKnex } from '@universo/database'
import {
    createDDLServices,
    SchemaGenerator as SchemaGeneratorClass,
    SchemaMigrator as SchemaMigratorClass,
    MigrationManager as MigrationManagerClass,
    SchemaCloner as SchemaClonerClass,
    acquireAdvisoryLock as _acquireAdvisoryLock,
    releaseAdvisoryLock as _releaseAdvisoryLock
} from '@universo/schema-ddl'
import { hasRuntimeHistoryTable as _hasRuntimeHistoryTable } from '@universo/migrations-core'
import { TemplateSeedCleanupService } from '../templates/services/TemplateSeedCleanupService'
import { TemplateSeedMigrator } from '../templates/services/TemplateSeedMigrator'

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

export { buildCatalogDefinitions } from './definitions/catalogs'

// ═══════════════════════════════════════════════════════════════════════════
// Pool-level DDL wrappers
// ═══════════════════════════════════════════════════════════════════════════
// These encapsulate getKnex() inside the DDL module so that route handlers
// never need to import getKnex() directly.

/**
 * Acquire a session-scoped advisory lock via the shared Knex pool.
 */
export function acquirePoolAdvisoryLock(lockKey: number | string): Promise<boolean> {
    return _acquireAdvisoryLock(getKnex(), lockKey)
}

/**
 * Release a session-scoped advisory lock via the shared Knex pool.
 */
export function releasePoolAdvisoryLock(lockKey: number | string): Promise<void> {
    return _releaseAdvisoryLock(getKnex(), lockKey)
}

/**
 * Check whether a runtime migration history table exists in a branch schema.
 */
export function hasPoolRuntimeHistoryTable(schemaName: string, tableName: string): Promise<boolean> {
    return _hasRuntimeHistoryTable(getKnex(), schemaName, tableName)
}

/**
 * Create a TemplateSeedCleanupService backed by the shared Knex pool.
 */
export function createPoolTemplateSeedCleanupService(schemaName: string): TemplateSeedCleanupService {
    return new TemplateSeedCleanupService(getKnex(), schemaName)
}

/**
 * Create a TemplateSeedMigrator backed by the shared Knex pool.
 */
export function createPoolTemplateSeedMigrator(schemaName: string): TemplateSeedMigrator {
    return new TemplateSeedMigrator(getKnex(), schemaName)
}

/**
 * Run a callback inside a Knex transaction from the shared pool.
 * Used for DDL rollback operations that need raw Knex transaction access.
 */
export function poolKnexTransaction<T>(fn: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
    return getKnex().transaction(fn)
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
