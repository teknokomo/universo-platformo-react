import { Router, type RequestHandler } from 'express'
import type { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { createRateLimiters } from '@universo/utils/rate-limiting'
import { createProjectsRoutes } from './ProjectsRoutes'
import { createMilestonesRoutes } from './MilestonesRoutes'
import { createTasksRouter } from './TasksRoutes'

let rateLimiters: Awaited<ReturnType<typeof createRateLimiters>> | null = null

/**
 * Initialize rate limiters (call once at startup)
 */
export async function initializeRateLimiters(): Promise<void> {
    rateLimiters = await createRateLimiters({
        keyPrefix: 'Projects-backend',
        maxRead: 100,
        maxWrite: 60
    })
    console.info('[Projects] Rate limiters initialized')
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
 * Create all Projects service routes
 */
export function createProjectsServiceRoutes(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
    const router = Router()

    const { read, write } = getRateLimiters()

    router.use('/Projects', createProjectsRoutes(ensureAuth, getDataSource, read, write))
    router.use('/Milestones', createMilestonesRoutes(ensureAuth, getDataSource, read, write))
    router.use('/Tasks', createTasksRouter(ensureAuth, getDataSource, read, write))

    return router
}
