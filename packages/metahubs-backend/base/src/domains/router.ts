import { Router, type RequestHandler } from 'express'
import type { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { createRateLimiters } from '@universo/utils/rate-limiting'
import { createMetahubsRoutes } from './metahubs/routes/metahubsRoutes'
import { createHubsRoutes } from './hubs/routes/hubsRoutes'
import { createCatalogsRoutes } from './catalogs/routes/catalogsRoutes'
import { createAttributesRoutes } from './attributes/routes/attributesRoutes'
import { createRecordsRoutes } from './records/routes/recordsRoutes'
import { createPublicMetahubsRoutes } from './metahubs/routes/publicMetahubsRoutes'
import { createPublicationsRoutes } from './publications/routes/publicationsRoutes'

let rateLimiters: Awaited<ReturnType<typeof createRateLimiters>> | null = null

/**
 * Initialize rate limiters (call once at startup)
 */
export async function initializeRateLimiters(): Promise<void> {
    rateLimiters = await createRateLimiters({
        keyPrefix: 'metahubs-backend',
        maxRead: 100,
        maxWrite: 60
    })
    console.info('[Metahubs] Rate limiters initialized')
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

    // Publications (Information Bases) - imports entities from @universo/applications-backend
    router.use('/', createPublicationsRoutes(ensureAuth, getDataSource, read, write))

    // New metadata-driven routes
    router.use('/', createHubsRoutes(ensureAuth, getDataSource, read, write))
    router.use('/', createCatalogsRoutes(ensureAuth, getDataSource, read, write))
    router.use('/', createAttributesRoutes(ensureAuth, getDataSource, read, write))
    router.use('/', createRecordsRoutes(ensureAuth, getDataSource, read, write))

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
export { createHubsRoutes } from './hubs/routes/hubsRoutes'
export { createCatalogsRoutes } from './catalogs/routes/catalogsRoutes'
export { createAttributesRoutes } from './attributes/routes/attributesRoutes'
export { createRecordsRoutes } from './records/routes/recordsRoutes'
export { createPublicMetahubsRoutes } from './metahubs/routes/publicMetahubsRoutes'
export { createPublicationsRoutes } from './publications/routes/publicationsRoutes'
export * from './shared/guards'
