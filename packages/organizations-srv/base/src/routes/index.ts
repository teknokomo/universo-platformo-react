import { Router, type RequestHandler } from 'express'
import type { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { createRateLimiters } from '@universo/utils/rate-limiting'
import { createOrganizationsRoutes } from './organizationsRoutes'
import { createDepartmentsRoutes } from './departmentsRoutes'
import { createPositionsRouter } from './positionsRoutes'

let rateLimiters: Awaited<ReturnType<typeof createRateLimiters>> | null = null

/**
 * Initialize rate limiters (call once at startup)
 */
export async function initializeRateLimiters(): Promise<void> {
    rateLimiters = await createRateLimiters({
        keyPrefix: 'organizations-srv',
        maxRead: 100,
        maxWrite: 60
    })
    console.info('[Organizations] Rate limiters initialized')
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
 * Create all organizations service routes
 */
export function createOrganizationsServiceRoutes(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
    const router = Router()

    const { read, write } = getRateLimiters()

    router.use('/organizations', createOrganizationsRoutes(ensureAuth, getDataSource, read, write))
    router.use('/departments', createDepartmentsRoutes(ensureAuth, getDataSource, read, write))
    router.use('/positions', createPositionsRouter(ensureAuth, getDataSource, read, write))

    return router
}
