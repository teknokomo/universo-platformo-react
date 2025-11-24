import { Router, type RequestHandler } from 'express'
import type { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { createRateLimiters } from '@universo/utils/rate-limiting'
import { createStoragesRoutes } from './storagesRoutes'
import { createContainersRoutes } from './containersRoutes'
import { createSlotsRouter } from './slotsRoutes'

let rateLimiters: Awaited<ReturnType<typeof createRateLimiters>> | null = null

/**
 * Initialize rate limiters (call once at startup)
 */
export async function initializeRateLimiters(): Promise<void> {
    rateLimiters = await createRateLimiters({
        keyPrefix: 'storages-srv',
        maxRead: 100,
        maxWrite: 60
    })
    console.info('[Storages] Rate limiters initialized')
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
 * Create all storages service routes
 */
export function createStoragesServiceRoutes(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
    const router = Router()

    const { read, write } = getRateLimiters()

    router.use('/storages', createStoragesRoutes(ensureAuth, getDataSource, read, write))
    router.use('/containers', createContainersRoutes(ensureAuth, getDataSource, read, write))
    router.use('/slots', createSlotsRouter(ensureAuth, getDataSource, read, write))

    return router
}
