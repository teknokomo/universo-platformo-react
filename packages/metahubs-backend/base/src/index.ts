// Template seeder and platform bootstrap helpers
export { seedTemplates } from './domains/templates/services/TemplateSeeder'

// Route exports
export { createMetahubsRoutes } from './domains/metahubs/routes/metahubsRoutes'
export { createHubsRoutes } from './domains/hubs/routes/hubsRoutes'
export { createCatalogsRoutes } from './domains/catalogs/routes/catalogsRoutes'
export { createSetsRoutes } from './domains/sets/routes/setsRoutes'
export { createEnumerationsRoutes } from './domains/enumerations/routes/enumerationsRoutes'
export { createAttributesRoutes } from './domains/attributes/routes/attributesRoutes'
export { createConstantsRoutes } from './domains/constants/routes/constantsRoutes'
export { createElementsRoutes } from './domains/elements/routes/elementsRoutes'
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
    KnexClient,
    getDDLServices,
    ChangeType,
    calculateSchemaDiff,
    generateSchemaName,
    generateTableName,
    generateColumnName,
    buildCatalogDefinitions
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
