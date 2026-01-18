export { SchemaGenerator } from './SchemaGenerator'
export type { GenerateFullSchemaOptions } from './SchemaGenerator'
export { SchemaMigrator, ChangeType } from './SchemaMigrator'
export { MigrationManager } from './MigrationManager'
export { calculateSchemaDiff } from './diff'
export type { SchemaDiff, SchemaChange } from './diff'
export type {
    EntityDefinition,
    FieldDefinition,
    SchemaGenerationResult,
    SchemaSnapshot,
    MigrationResult,
    MigrationMeta,
    MigrationRecord,
    MigrationChangeRecord,
    RollbackAnalysis,
} from './types'
export { buildCatalogDefinitions } from './definitions/catalogs'
export { generateSchemaName, generateTableName, generateColumnName } from './naming'

