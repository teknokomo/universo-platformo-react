import { Router, type RequestHandler } from 'express'
import type { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { createRateLimiters } from '@universo/utils/rate-limiting'
import { createCampaignsRoutes } from './campaignsRoutes'
import { createEventsRoutes } from './eventsRoutes'
import { createActivitiesRouter } from './activitiesRoutes'

let rateLimiters: Awaited<ReturnType<typeof createRateLimiters>> | null = null

/**
 * Initialize rate limiters (call once at startup)
 */
export async function initializeRateLimiters(): Promise<void> {
    rateLimiters = await createRateLimiters({
        keyPrefix: 'campaigns-backend',
        maxRead: 100,
        maxWrite: 60
    })
    console.info('[Campaigns] Rate limiters initialized')
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
 * Create all campaigns service routes
 */
export function createCampaignsServiceRoutes(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
    const router = Router()

    const { read, write } = getRateLimiters()

    router.use('/campaigns', createCampaignsRoutes(ensureAuth, getDataSource, read, write))
    router.use('/events', createEventsRoutes(ensureAuth, getDataSource, read, write))
    router.use('/activities', createActivitiesRouter(ensureAuth, getDataSource, read, write))

    return router
}
