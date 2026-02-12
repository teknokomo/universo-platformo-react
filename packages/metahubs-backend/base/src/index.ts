// Entity exports
export { metahubsEntities } from './database/entities/index'
export { Metahub } from './database/entities/Metahub'
export { MetahubUser } from './database/entities/MetahubUser'
export { Publication, PublicationAccessMode, PublicationSchemaStatus } from './database/entities/Publication'
export { Template } from './database/entities/Template'
export { TemplateVersion } from './database/entities/TemplateVersion'

// Template seeder (call at startup after DataSource initialization)
export { seedTemplates } from './domains/templates/services/TemplateSeeder'

// Route exports
export { createMetahubsRoutes } from './domains/metahubs/routes/metahubsRoutes'
export { createHubsRoutes } from './domains/hubs/routes/hubsRoutes'
export { createCatalogsRoutes } from './domains/catalogs/routes/catalogsRoutes'
export { createAttributesRoutes } from './domains/attributes/routes/attributesRoutes'
export { createElementsRoutes } from './domains/elements/routes/elementsRoutes'
export { createPublicMetahubsRoutes } from './domains/metahubs/routes/publicMetahubsRoutes'
export { createMetahubMigrationsRoutes } from './domains/metahubs/routes/metahubMigrationsRoutes'
export { createApplicationMigrationsRoutes } from './domains/applications/routes/applicationMigrationsRoutes'
export { initializeRateLimiters, getRateLimiters, createMetahubsServiceRoutes, createPublicMetahubsServiceRoutes } from './domains/router'

// Guard exports
export { ensureMetahubAccess, ensureHubAccess, assertNotOwner } from './domains/shared/guards'

// Migration exports
export { metahubsMigrations } from './database/migrations/postgres'

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
