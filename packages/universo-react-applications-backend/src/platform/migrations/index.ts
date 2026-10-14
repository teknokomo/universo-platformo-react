export {
    createApplicationsSchemaMigrationDefinition,
    prepareApplicationsSchemaSupportMigrationDefinition,
    finalizeApplicationsSchemaSupportMigrationDefinition,
    addApplicationSettingsMigrationDefinition
} from './1800000000000-CreateApplicationsSchema.sql'
export { createGlobalShortLinksMigrationDefinition } from './1800000000290-CreateGlobalShortLinks.sql'
export { createGuestSessionIdempotencyMigrationDefinition } from './1800000000300-CreateGuestSessionIdempotency.sql'
export { bindGlobalShortLinksToAccessLinkIdentityMigrationDefinition } from './1800000000310-BindGlobalShortLinksToAccessLinkIdentity.sql'
