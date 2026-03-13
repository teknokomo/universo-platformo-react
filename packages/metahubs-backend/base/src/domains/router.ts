import { Router, type ErrorRequestHandler, type RequestHandler } from 'express'
import type { DbExecutor } from '@universo/utils'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { createRateLimiters } from '@universo/utils/rate-limiting'
import { createMetahubsRoutes } from './metahubs/routes/metahubsRoutes'
import { createBranchesRoutes } from './branches/routes/branchesRoutes'
import { createHubsRoutes } from './hubs/routes/hubsRoutes'
import { createCatalogsRoutes } from './catalogs/routes/catalogsRoutes'
import { createEnumerationsRoutes } from './enumerations/routes/enumerationsRoutes'
import { createAttributesRoutes } from './attributes/routes/attributesRoutes'
import { createElementsRoutes } from './elements/routes/elementsRoutes'
import { createSetsRoutes } from './sets/routes/setsRoutes'
import { createConstantsRoutes } from './constants/routes/constantsRoutes'
import { createLayoutsRoutes } from './layouts/routes/layoutsRoutes'
import { createTemplatesRoutes } from './templates/routes/templatesRoutes'
import { createPublicMetahubsRoutes } from './metahubs/routes/publicMetahubsRoutes'
import { createMetahubMigrationsRoutes } from './metahubs/routes/metahubMigrationsRoutes'
import { createPublicationsRoutes } from './publications/routes/publicationsRoutes'
import { createApplicationMigrationsRoutes } from './applications/routes/applicationMigrationsRoutes'
import { createSettingsRoutes } from './settings/routes/settingsRoutes'
import { isMetahubDomainError } from './shared/domainErrors'

let rateLimiters: Awaited<ReturnType<typeof createRateLimiters>> | null = null

/**
 * Initialize rate limiters (call once at startup)
 *
 * Rate limits optimized for normal user workflow:
 * - Read: 600/15min = 40/min (sufficient for page loads with multiple API calls)
 * - Write: 240/15min = 16/min (sufficient for active editing sessions)
 *
 * These limits are per-IP by default. For multi-user scenarios behind NAT,
 * consider using user-based keys via Redis store.
 */
export async function initializeRateLimiters(): Promise<void> {
    rateLimiters = await createRateLimiters({
        keyPrefix: 'metahubs-backend',
        maxRead: 600, // Increased from 100 for normal workflow
        maxWrite: 240 // Increased from 60 for active editing
    })
    console.info('[Metahubs] Rate limiters initialized (read: 600/15min, write: 240/15min)')
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
 */
export function createMetahubsServiceRoutes(ensureAuth: RequestHandler, getDbExecutor: () => DbExecutor): Router {
    const router = Router()

    const { read, write } = getRateLimiters()

    // Core metahubs CRUD
    router.use('/', createMetahubsRoutes(ensureAuth, getDbExecutor, read, write))

    // Branches (metahub design-time branches)
    router.use('/', createBranchesRoutes(ensureAuth, getDbExecutor, read, write))

    // Publications (Information Bases)
    router.use('/', createPublicationsRoutes(ensureAuth, getDbExecutor, read, write))

    // Metahub migration history and controlled apply/dry-run endpoints
    router.use('/', createMetahubMigrationsRoutes(ensureAuth, getDbExecutor, read, write))

    // Application migrations - runtime schema migration history and rollback
    router.use('/', createApplicationMigrationsRoutes(ensureAuth, getDbExecutor, read, write))

    // New metadata-driven routes
    router.use('/', createHubsRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createCatalogsRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createSetsRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createEnumerationsRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createAttributesRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createConstantsRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createElementsRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createLayoutsRoutes(ensureAuth, getDbExecutor, read, write))

    // Settings (metahub-level configuration)
    router.use('/', createSettingsRoutes(ensureAuth, getDbExecutor, read, write))

    // Templates catalog (read-only)
    router.use('/', createTemplatesRoutes(ensureAuth, getDbExecutor, read))

    const domainErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
        if (!isMetahubDomainError(err)) {
            next(err)
            return
        }

        if (res.headersSent) {
            next(err)
            return
        }

        res.status(err.statusCode).json({
            error: err.message,
            code: err.code,
            details: err.details ?? null
        })
    }
    router.use(domainErrorHandler)

    return router
}

/**
 * Create public API routes for accessing published Metahubs
 * These routes do NOT require authentication
 */
export function createPublicMetahubsServiceRoutes(getDbExecutor: () => DbExecutor): Router {
    const { read } = getRateLimiters()
    return createPublicMetahubsRoutes(getDbExecutor, read)
}

export { createMetahubsRoutes } from './metahubs/routes/metahubsRoutes'
export { createBranchesRoutes } from './branches/routes/branchesRoutes'
export { createHubsRoutes } from './hubs/routes/hubsRoutes'
export { createCatalogsRoutes } from './catalogs/routes/catalogsRoutes'
export { createSetsRoutes } from './sets/routes/setsRoutes'
export { createEnumerationsRoutes } from './enumerations/routes/enumerationsRoutes'
export { createAttributesRoutes } from './attributes/routes/attributesRoutes'
export { createConstantsRoutes } from './constants/routes/constantsRoutes'
export { createElementsRoutes } from './elements/routes/elementsRoutes'
export { createLayoutsRoutes } from './layouts/routes/layoutsRoutes'
export { createTemplatesRoutes } from './templates/routes/templatesRoutes'
export { createPublicMetahubsRoutes } from './metahubs/routes/publicMetahubsRoutes'
export { createMetahubMigrationsRoutes } from './metahubs/routes/metahubMigrationsRoutes'
export { createPublicationsRoutes } from './publications/routes/publicationsRoutes'
export { createApplicationMigrationsRoutes } from './applications/routes/applicationMigrationsRoutes'
export { createSettingsRoutes } from './settings/routes/settingsRoutes'
export * from './shared/guards'
