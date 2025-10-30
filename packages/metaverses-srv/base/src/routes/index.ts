import { Router, type RequestHandler } from 'express'
import type { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { createRateLimiters } from '@universo/utils/rate-limiting'
import { createMetaversesRoutes } from './metaversesRoutes'
import { createSectionsRoutes } from './sectionsRoutes'
import { createEntitiesRouter } from './entitiesRoutes'

let rateLimiters: Awaited<ReturnType<typeof createRateLimiters>> | null = null

/**
 * Initialize rate limiters (call once at startup)
 */
export async function initializeRateLimiters(): Promise<void> {
    rateLimiters = await createRateLimiters({
        keyPrefix: 'metaverses-srv',
        maxRead: 100,
        maxWrite: 60
    })
    console.info('[Metaverses] Rate limiters initialized')
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
 * Create all metaverses service routes
 */
export function createMetaversesServiceRoutes(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
    const router = Router()

    const { read, write } = getRateLimiters()

    router.use('/metaverses', createMetaversesRoutes(ensureAuth, getDataSource, read, write))
    router.use('/sections', createSectionsRoutes(ensureAuth, getDataSource, read, write))
    router.use('/entities', createEntitiesRouter(ensureAuth, getDataSource, read, write))

    return router
}
