import { Router, type RequestHandler } from 'express'
import type { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { createRateLimiters } from '@universo/utils/rate-limiting'
import { createApplicationsRoutes } from './applicationsRoutes'
import { createConnectorsRoutes } from './connectorsRoutes'

let rateLimiters: Awaited<ReturnType<typeof createRateLimiters>> | null = null

/**
 * Initialize rate limiters (call once at startup)
 */
export async function initializeRateLimiters(): Promise<void> {
    rateLimiters = await createRateLimiters({
        keyPrefix: 'applications-backend',
        maxRead: 100,
        maxWrite: 60
    })
    console.info('[Applications] Rate limiters initialized')
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
 * Create all applications service routes
 */
export function createApplicationsServiceRoutes(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
    const router = Router()

    const { read, write } = getRateLimiters()

    // Core applications CRUD
    router.use('/applications', createApplicationsRoutes(ensureAuth, getDataSource, read, write))

    // Connectors routes
    router.use('/', createConnectorsRoutes(ensureAuth, getDataSource, read, write))

    return router
}

export { createApplicationsRoutes } from './applicationsRoutes'
export { createConnectorsRoutes } from './connectorsRoutes'
export * from './guards'
