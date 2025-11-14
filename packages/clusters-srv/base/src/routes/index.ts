import { Router, type RequestHandler } from 'express'
import type { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { createRateLimiters } from '@universo/utils/rate-limiting'
import { createClustersRoutes } from './clustersRoutes'
import { createDomainsRoutes } from './domainsRoutes'
import { createResourcesRouter } from './resourcesRoutes'

let rateLimiters: Awaited<ReturnType<typeof createRateLimiters>> | null = null

/**
 * Initialize rate limiters (call once at startup)
 */
export async function initializeRateLimiters(): Promise<void> {
    rateLimiters = await createRateLimiters({
        keyPrefix: 'clusters-srv',
        maxRead: 100,
        maxWrite: 60
    })
    console.info('[Clusters] Rate limiters initialized')
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
 * Create all clusters service routes
 */
export function createClustersServiceRoutes(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
    const router = Router()

    const { read, write } = getRateLimiters()

    router.use('/clusters', createClustersRoutes(ensureAuth, getDataSource, read, write))
    router.use('/domains', createDomainsRoutes(ensureAuth, getDataSource, read, write))
    router.use('/resources', createResourcesRouter(ensureAuth, getDataSource, read, write))

    return router
}
