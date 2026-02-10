import { Router, type RequestHandler } from 'express'
import type { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { createRateLimiters } from '@universo/utils/rate-limiting'
import { createMetahubsRoutes } from './metahubs/routes/metahubsRoutes'
import { createBranchesRoutes } from './branches/routes/branchesRoutes'
import { createHubsRoutes } from './hubs/routes/hubsRoutes'
import { createCatalogsRoutes } from './catalogs/routes/catalogsRoutes'
import { createAttributesRoutes } from './attributes/routes/attributesRoutes'
import { createElementsRoutes } from './elements/routes/elementsRoutes'
import { createLayoutsRoutes } from './layouts/routes/layoutsRoutes'
import { createTemplatesRoutes } from './templates/routes/templatesRoutes'
import { createPublicMetahubsRoutes } from './metahubs/routes/publicMetahubsRoutes'
import { createPublicationsRoutes } from './publications/routes/publicationsRoutes'
import { createApplicationMigrationsRoutes } from './applications/routes/applicationMigrationsRoutes'
import { createApplicationSyncRoutes } from './applications/routes/applicationSyncRoutes'

let rateLimiters: Awaited<ReturnType<typeof createRateLimiters>> | null = null

/**
 * Initialize rate limiters (call once at startup)
 *
 * Rate limits optimized for normal user workflow:
 * - Read: 600/15min = 40/min (sufficient for page loads with multiple API calls)
 * - Write: 240/15min = 16/min (sufficient for active editing sessions)
 *
 * These limits are per-IP by default. For multi-user scenarios behind NAT,
 * consider using user-based keys via Redis store.
 */
export async function initializeRateLimiters(): Promise<void> {
    rateLimiters = await createRateLimiters({
        keyPrefix: 'metahubs-backend',
        maxRead: 600, // Increased from 100 for normal workflow
        maxWrite: 240 // Increased from 60 for active editing
    })
    console.info('[Metahubs] Rate limiters initialized (read: 600/15min, write: 240/15min)')
}

/**
 * Get initialized rate limiters
 * Throws if not initialized
 */
export function getRateLimiters(): { read: RateLimitRequestHandler; write: RateLimitRequestHandler } {
    if (!rateLimiters) {
        throw new Error('Rate limiters not initialized. Call initializeRateLimiters() first.')
    }
    return rateLimiters
}

/**
 * Create all metahubs service routes
 */
export function createMetahubsServiceRoutes(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
    const router = Router()

    const { read, write } = getRateLimiters()

    // Core metahubs CRUD
    router.use('/', createMetahubsRoutes(ensureAuth, getDataSource, read, write))

    // Branches (metahub design-time branches)
    router.use('/', createBranchesRoutes(ensureAuth, getDataSource, read, write))

    // Publications (Information Bases) - imports entities from @universo/applications-backend
    router.use('/', createPublicationsRoutes(ensureAuth, getDataSource, read, write))

    // Application migrations - runtime schema migration history and rollback
    router.use('/', createApplicationMigrationsRoutes(ensureAuth, getDataSource, read, write))

    // Application sync - schema creation and synchronization
    router.use('/', createApplicationSyncRoutes(ensureAuth, getDataSource, read, write))

    // New metadata-driven routes
    router.use('/', createHubsRoutes(ensureAuth, getDataSource, read, write))
    router.use('/', createCatalogsRoutes(ensureAuth, getDataSource, read, write))
    router.use('/', createAttributesRoutes(ensureAuth, getDataSource, read, write))
    router.use('/', createElementsRoutes(ensureAuth, getDataSource, read, write))
    router.use('/', createLayoutsRoutes(ensureAuth, getDataSource, read, write))

    // Templates catalog (read-only)
    router.use('/', createTemplatesRoutes(ensureAuth, getDataSource, read))

    return router
}

/**
 * Create public API routes for accessing published Metahubs
 * These routes do NOT require authentication
 */
export function createPublicMetahubsServiceRoutes(getDataSource: () => DataSource): Router {
    const { read } = getRateLimiters()
    return createPublicMetahubsRoutes(getDataSource, read)
}

export { createMetahubsRoutes } from './metahubs/routes/metahubsRoutes'
export { createBranchesRoutes } from './branches/routes/branchesRoutes'
export { createHubsRoutes } from './hubs/routes/hubsRoutes'
export { createCatalogsRoutes } from './catalogs/routes/catalogsRoutes'
export { createAttributesRoutes } from './attributes/routes/attributesRoutes'
export { createElementsRoutes } from './elements/routes/elementsRoutes'
export { createLayoutsRoutes } from './layouts/routes/layoutsRoutes'
export { createTemplatesRoutes } from './templates/routes/templatesRoutes'
export { createPublicMetahubsRoutes } from './metahubs/routes/publicMetahubsRoutes'
export { createPublicationsRoutes } from './publications/routes/publicationsRoutes'
export { createApplicationMigrationsRoutes } from './applications/routes/applicationMigrationsRoutes'
export { createApplicationSyncRoutes } from './applications/routes/applicationSyncRoutes'
export * from './shared/guards'
