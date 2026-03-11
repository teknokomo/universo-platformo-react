import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { createRateLimiters } from '@universo/utils/rate-limiting'
import type { DbExecutor } from '@universo/utils/database'
import { createOnboardingRoutes } from './onboardingRoutes'

let rateLimiters: Awaited<ReturnType<typeof createRateLimiters>> | null = null

/**
 * Initialize rate limiters (call once at startup)
 */
export async function initializeRateLimiters(): Promise<void> {
    rateLimiters = await createRateLimiters({
        keyPrefix: 'start-backend',
        maxRead: 600, // Increased for normal workflow
        maxWrite: 240 // Increased for active editing
    })
    console.info('[Start] Rate limiters initialized')
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
 * Create all start service routes
 */
export function createStartServiceRoutes(ensureAuth: RequestHandler, getRequestDbExecutor: (req: unknown) => DbExecutor): Router {
    const router = Router()

    const { read, write } = getRateLimiters()

    router.use('/onboarding', createOnboardingRoutes(ensureAuth, getRequestDbExecutor, read, write))

    return router
}
