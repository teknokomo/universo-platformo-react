// Template seeder and platform bootstrap helpers
export { seedTemplates } from './domains/templates/services/TemplateSeeder'

// Route exports
export { createMetahubsRoutes } from './domains/metahubs/routes/metahubsRoutes'
export { createEntityFieldDefinitionRoutes } from './domains/entities/metadata/fieldDefinition/routes'
export { createEntityFixedValueRoutes } from './domains/entities/metadata/fixedValue/routes'
export { createEntityRecordRoutes } from './domains/entities/metadata/record/routes'
export { createPublicMetahubsRoutes } from './domains/metahubs/routes/publicMetahubsRoutes'
export { createMetahubMigrationsRoutes } from './domains/metahubs/routes/metahubMigrationsRoutes'
export { createApplicationMigrationsRoutes } from './domains/applications/routes/applicationMigrationsRoutes'
export { loadPublishedPublicationRuntimeSource } from './domains/publications/services/loadPublishedPublicationRuntimeSource'
export { initializeRateLimiters, getRateLimiters, createMetahubsServiceRoutes, createPublicMetahubsServiceRoutes } from './domains/router'

// Guard exports
export { ensureMetahubAccess, ensureHubAccess, assertNotOwner } from './domains/shared/guards'

// Platform migration exports
export {
    createMetahubsSchemaMigrationDefinition,
    finalizeMetahubsSchemaSupportMigrationDefinition,
    prepareMetahubsSchemaSupportMigrationDefinition,
    seedBuiltinTemplatesMigration
} from './platform/migrations'
export { metahubsSystemAppDefinition } from './platform/systemAppDefinition'

// DDL exports (runtime schema management)
// Re-export from @universo/schema-ddl for convenience
export {
    SchemaGenerator,
    SchemaMigrator,
    MigrationManager,
    getDDLServices,
    ChangeType,
    calculateSchemaDiff,
    generateSchemaName,
    generateTableName,
    generateColumnName
} from './domains/ddl'
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
    SchemaDiff,
    SchemaChange
} from './domains/ddl'
