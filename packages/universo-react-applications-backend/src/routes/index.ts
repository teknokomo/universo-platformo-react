import { Router, type Request, type RequestHandler } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { createRateLimiters } from '@universo-react/utils/rate-limiting'
import { createApplicationsRoutes } from './applicationsRoutes'
import { createApplicationSyncRoutes } from './applicationSyncRoutes'
import { createConnectorsRoutes } from './connectorsRoutes'
import { createPublicApplicationsRoutes } from './publicApplicationsRoutes'
import { createLoadPublishedApplicationSyncContext, type LoadPublishedPublicationRuntimeSource } from '../services'

let rateLimiters: Awaited<ReturnType<typeof createRateLimiters>> | null = null

/**
 * Initialize rate limiters (call once at startup)
 */
export async function initializeRateLimiters(): Promise<void> {
    rateLimiters = await createRateLimiters({
        keyPrefix: 'applications-backend',
        maxRead: 600, // Increased for normal workflow
        maxWrite: 240 // Increased for active editing
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
export function createApplicationsServiceRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    loadPublishedPublicationRuntimeSource: LoadPublishedPublicationRuntimeSource,
    options: {
        /**
         * Schema sync performs long-running DDL in its own explicit trusted
         * transactions. It must not use the request-scoped RLS transaction,
         * because that transaction would retain metadata row locks while the
         * DDL transaction persists the final sync state. The sync controller
         * performs the owner/admin authorization check before entering DDL.
         */
        syncEnsureAuth?: RequestHandler
        /**
         * Resolves the request-scoped executor for sync/diff routes. There is
         * deliberately no pool fallback: missing RLS context must fail closed.
         */
        getRequestDbExecutor?: (req: Request) => DbExecutor
    } = {}
): Router {
    const router = Router()

    const { read, write } = getRateLimiters()
    const loadPublishedApplicationSyncContext = createLoadPublishedApplicationSyncContext(loadPublishedPublicationRuntimeSource)
    const syncEnsureAuth = options.syncEnsureAuth ?? ensureAuth
    const getRequestScopedDbExecutor =
        options.getRequestDbExecutor ??
        ((_req: Request): DbExecutor => {
            throw new Error('Request-scoped database executor is required for application sync routes')
        })

    // Core applications CRUD
    router.use('/applications', createApplicationsRoutes(ensureAuth, getDbExecutor, read, write, getRequestScopedDbExecutor))

    // Public runtime access for guest/anonymous flows
    router.use('/', createPublicApplicationsRoutes(getDbExecutor, read, write))

    // Application runtime schema sync and diff
    router.use('/', createApplicationSyncRoutes(syncEnsureAuth, getDbExecutor, loadPublishedApplicationSyncContext, read, write))

    // Connectors routes
    router.use('/', createConnectorsRoutes(ensureAuth, getDbExecutor, read, write))

    return router
}

export { createApplicationsRoutes } from './applicationsRoutes'
export { createApplicationSyncRoutes } from './applicationSyncRoutes'
export { createConnectorsRoutes } from './connectorsRoutes'
export * from './guards'
