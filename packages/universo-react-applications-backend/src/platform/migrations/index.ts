export {
    createApplicationsSchemaMigrationDefinition,
    prepareApplicationsSchemaSupportMigrationDefinition,
    finalizeApplicationsSchemaSupportMigrationDefinition,
    addApplicationSettingsMigrationDefinition
} from './1800000000000-CreateApplicationsSchema.sql'
export { createGlobalShortLinksMigrationDefinition } from './1800000000290-CreateGlobalShortLinks.sql'
export { createGuestSessionIdempotencyMigrationDefinition } from './1800000000300-CreateGuestSessionIdempotency.sql'
export { bindGlobalShortLinksToAccessLinkIdentityMigrationDefinition } from './1800000000310-BindGlobalShortLinksToAccessLinkIdentity.sql'
export { createApplicationBotBindingsMigrationDefinition } from './1800000000320-CreateApplicationBotBindings.sql'
export { addApplicationCatalogVisibilityAndMembershipRlsMigrationDefinition } from './1800000000340-ApplicationCatalogVisibilityAndMembershipRls.sql'
export { createThemePresetsMigrationDefinition } from './1800000000350-CreateThemePresets.sql'
