/**
 * Application Sync - Barrel Re-exports
 *
 * Re-exports all public symbols from sync sub-modules
 * for backward compatibility with existing consumers.
 */

// Types & schemas
export type { SyncableApplicationRecord, ApplicationSchemaSyncSource, DiffStructuredChange } from './syncTypes'
export {
    applicationReleaseBundleSchema,
    UI_LAYOUT_DIFF_MARKER,
    UI_LAYOUTS_DIFF_MARKER,
    UI_LAYOUT_ZONES_DIFF_MARKER,
    SYSTEM_METADATA_DIFF_MARKER
} from './syncTypes'

// Helpers
export { toStructuralSchemaSnapshot } from './syncHelpers'

// Data loaders & bundle builders
export {
    createExistingApplicationReleaseBundle,
    createPublicationApplicationReleaseBundle,
    buildApplicationSyncSourceFromPublication,
    buildApplicationSyncSourceFromBundle
} from './syncDataLoader'

// Seeding
export { seedPredefinedElements, syncEnumerationValues } from './syncSeeding'

// Layout persistence
export {
    persistPublishedLayouts,
    persistPublishedWidgets,
    hasDashboardLayoutConfigChanges,
    hasPublishedLayoutsChanges,
    hasPublishedWidgetsChanges,
    persistSeedWarnings
} from './syncLayoutPersistence'

// Engine
export {
    syncApplicationSchemaFromSource,
    runPublishedApplicationRuntimeSync,
    buildCreateTableDetails,
    mapStructuredChange
} from './syncEngine'
