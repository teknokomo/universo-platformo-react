// MetaHubs Backend - Metadata-driven architecture for dynamic entities
// Main entry point - exports entities, migrations, and route factories

// Entities
export { metahubsEntities } from './database/entities/index'
export { Metahub } from './database/entities/Metahub'
export { MetahubUser } from './database/entities/MetahubUser'
export { SysEntity } from './database/entities/SysEntity'
export { SysField } from './database/entities/SysField'
export { UserDataStore } from './database/entities/UserDataStore'

// Migrations
export { metahubsMigrations } from './database/migrations/postgres'

// Routes
export { createMetahubsRoutes } from './routes/metahubsRoutes'
export { createEntitiesRoutes } from './routes/entitiesRoutes'
export { createRecordsRoutes } from './routes/recordsRoutes'
export { initializeRateLimiters, getRateLimiters, createMetahubsServiceRoutes } from './routes/index'

// Schemas
export {
    validateListQuery,
    CreateMetahubSchema,
    UpdateMetahubSchema,
    CreateEntitySchema,
    CreateFieldSchema,
    CreateRecordSchema,
    UpdateRecordSchema
} from './schemas/queryParams'
export type {
    ListQueryParams,
    CreateMetahubInput,
    UpdateMetahubInput,
    CreateEntityInput,
    CreateFieldInput,
    CreateRecordInput,
    UpdateRecordInput
} from './schemas/queryParams'
