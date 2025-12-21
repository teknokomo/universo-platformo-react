import { Router, type RequestHandler } from 'express'
import type { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { createRateLimiters } from '@universo/utils/rate-limiting'
import { createMetahubsRoutes } from './metahubsRoutes'
import { createEntitiesRoutes } from './entitiesRoutes'
import { createRecordsRoutes } from './recordsRoutes'

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
    console.info('[MetaHubs] Rate limiters initialized')
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
 *
 * Mounts:
 * - /metahubs - CRUD for metahub containers
 * - /metahubs/:metahubId/entities - Entity definitions
 * - /metahubs/:metahubId/entities/:entityId/fields - Field definitions
 * - /metahubs/:metahubId/entities/:entityId/records - User data records
 */
export function createMetahubsServiceRoutes(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
    const router = Router()

    const { read, write } = getRateLimiters()

    // Mount metahubs routes at /metahubs
    router.use('/metahubs', createMetahubsRoutes(ensureAuth, getDataSource, read, write))

    // Mount entity/field routes (nested under /metahubs)
    router.use('/metahubs', createEntitiesRoutes(ensureAuth, getDataSource, read, write))

    // Mount records routes (nested under /metahubs)
    router.use('/metahubs', createRecordsRoutes(ensureAuth, getDataSource, read, write))

    return router
}
