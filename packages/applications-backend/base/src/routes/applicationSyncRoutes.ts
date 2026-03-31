/**
 * Application Schema Sync Routes
 *
 * These routes handle schema creation, synchronization and diff calculation
 * for Applications. They use the Application -> Connector -> ConnectorPublication -> Publication
 * chain to determine the structure.
 *
 * Implementation is split across focused modules in ./sync/:
 *   syncTypes.ts             - types, schemas, constants
 *   syncHelpers.ts           - pure utility functions
 *   syncDataLoader.ts        - runtime data loading, bundle building
 *   syncSeeding.ts           - element & enumeration seeding
 *   syncLayoutPersistence.ts - layout/widget persistence & change detection
 *   syncEngine.ts            - core sync engine & diff builders
 */

import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import type { LoadPublishedApplicationSyncContext } from '../services/applicationSyncContracts'
import { createSyncController } from '../controllers/syncController'
import { asyncHandler } from './sync/syncHelpers'

// Re-export all public symbols for backward compatibility
export type { SyncableApplicationRecord, ApplicationSchemaSyncSource, DiffStructuredChange } from './sync/syncTypes'
export {
    applicationReleaseBundleSchema,
    UI_LAYOUT_DIFF_MARKER,
    UI_LAYOUTS_DIFF_MARKER,
    UI_LAYOUT_ZONES_DIFF_MARKER,
    SYSTEM_METADATA_DIFF_MARKER
} from './sync/syncTypes'
export { toStructuralSchemaSnapshot } from './sync/syncHelpers'
export {
    createExistingApplicationReleaseBundle,
    createPublicationApplicationReleaseBundle,
    buildApplicationSyncSourceFromPublication,
    buildApplicationSyncSourceFromBundle
} from './sync/syncDataLoader'
export { seedPredefinedElements, syncEnumerationValues } from './sync/syncSeeding'
export {
    persistPublishedLayouts,
    persistPublishedWidgets,
    hasDashboardLayoutConfigChanges,
    hasPublishedLayoutsChanges,
    hasPublishedWidgetsChanges,
    persistSeedWarnings
} from './sync/syncLayoutPersistence'
export {
    syncApplicationSchemaFromSource,
    runPublishedApplicationRuntimeSync,
    buildCreateTableDetails,
    mapStructuredChange
} from './sync/syncEngine'

export function createApplicationSyncRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    loadPublishedApplicationSyncContext: LoadPublishedApplicationSyncContext,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router()
    const ctrl = createSyncController(getDbExecutor, loadPublishedApplicationSyncContext)

    router.post('/application/:applicationId/sync', ensureAuth, writeLimiter, asyncHandler(ctrl.sync))
    router.get('/application/:applicationId/release-bundle', ensureAuth, readLimiter, asyncHandler(ctrl.getReleaseBundle))
    router.post('/application/:applicationId/release-bundle/apply', ensureAuth, writeLimiter, asyncHandler(ctrl.applyReleaseBundle))
    router.get('/application/:applicationId/diff', ensureAuth, readLimiter, asyncHandler(ctrl.getDiff))

    return router
}
