// Contracts
export { ApplicationSchemaStatus } from './persistence/contracts'

// Route exports
export { createApplicationsRoutes } from './routes/applicationsRoutes'
export { createApplicationAliasesRoutes } from './routes/applicationAliasesRoutes'
export { createConnectorsRoutes } from './routes/connectorsRoutes'
export { createApplicationSyncRoutes } from './routes/applicationSyncRoutes'
export { createPublicApplicationRuntimeRoutes } from './routes/publicApplicationRuntimeRoutes'
export { runPublishedApplicationRuntimeSync, seedPredefinedElements } from './routes/applicationSyncRoutes'
export { initializeRateLimiters, getRateLimiters, createApplicationsServiceRoutes } from './routes/index'
export { attachApplicationsRealtimeRuntime } from './realtime/applicationsRealtimeRuntime'
export type { ApplicationsRealtimeRuntimeHandle } from './realtime/applicationsRealtimeRuntime'

// Guard exports
export { ensureApplicationAccess, ensureConnectorAccess, assertNotOwner } from './routes/guards'
export type { ApplicationRole } from './routes/guards'

// Platform migration exports
export {
    createApplicationsSchemaMigrationDefinition,
    prepareApplicationsSchemaSupportMigrationDefinition,
    finalizeApplicationsSchemaSupportMigrationDefinition,
    addApplicationSettingsMigrationDefinition
} from './platform/migrations'
export { applicationsSystemAppDefinition } from './platform/systemAppDefinition'

// Service exports
export { createLoadPublishedApplicationSyncContext } from './services'
export type {
    LoadPublishedApplicationSyncContext,
    LoadPublishedPublicationRuntimeSource,
    PublishedApplicationSnapshot,
    PublishedApplicationRuntimeSource,
    PublishedApplicationSyncContext
} from './services'
