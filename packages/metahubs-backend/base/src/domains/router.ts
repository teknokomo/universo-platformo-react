import { Router, type ErrorRequestHandler, type RequestHandler } from 'express'
import type { DbExecutor } from '@universo/utils'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { createRateLimiters } from '@universo/utils/rate-limiting'
import { createLogger } from '../utils/logger'
import { createMetahubsRoutes } from './metahubs/routes/metahubsRoutes'
import { createBranchesRoutes } from './branches/routes/branchesRoutes'
import { createEntityFieldDefinitionRoutes } from './entities/metadata/fieldDefinition/routes'
import { createEntityRecordRoutes } from './entities/metadata/record/routes'
import { createEntityFixedValueRoutes } from './entities/metadata/fixedValue/routes'
import { createLayoutsRoutes } from './layouts/routes/layoutsRoutes'
import { createScriptsRoutes } from './scripts/routes/scriptsRoutes'
import { createTemplatesRoutes } from './templates/routes/templatesRoutes'
import { createPublicMetahubsRoutes } from './metahubs/routes/publicMetahubsRoutes'
import { createMetahubMigrationsRoutes } from './metahubs/routes/metahubMigrationsRoutes'
import { createPublicationsRoutes } from './publications/routes/publicationsRoutes'
import { createApplicationMigrationsRoutes } from './applications/routes/applicationMigrationsRoutes'
import { createSettingsRoutes } from './settings/routes/settingsRoutes'
import { createSharedEntityOverridesRoutes } from './shared/routes/sharedEntityOverridesRoutes'
import { createEntityTypesRoutes } from './entities/routes/entityTypesRoutes'
import { createActionsRoutes } from './entities/routes/actionsRoutes'
import { createEventBindingsRoutes } from './entities/routes/eventBindingsRoutes'
import { createEntityInstancesRoutes } from './entities/routes/entityInstancesRoutes'
import { isMetahubDomainError } from './shared/domainErrors'

const log = createLogger('Metahubs')

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
    log.info('Rate limiters initialized (read: 600/15min, write: 240/15min)')
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

    // Entity-owned metadata routes
    router.use('/', createEntityFieldDefinitionRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createEntityFixedValueRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createEntityRecordRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createLayoutsRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createScriptsRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createSharedEntityOverridesRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createEntityTypesRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createEntityInstancesRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createActionsRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createEventBindingsRoutes(ensureAuth, getDbExecutor, read, write))

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
            ...(err.details ?? {})
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
    const router = Router()
    router.use('/', createPublicMetahubsRoutes(getDbExecutor, read))

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
            ...(err.details ?? {})
        })
    }
    router.use(domainErrorHandler)

    return router
}

export { createMetahubsRoutes } from './metahubs/routes/metahubsRoutes'
export { createBranchesRoutes } from './branches/routes/branchesRoutes'
export { createEntityFieldDefinitionRoutes } from './entities/metadata/fieldDefinition/routes'
export { createEntityFixedValueRoutes } from './entities/metadata/fixedValue/routes'
export { createEntityRecordRoutes } from './entities/metadata/record/routes'
export { createLayoutsRoutes } from './layouts/routes/layoutsRoutes'
export { createScriptsRoutes } from './scripts/routes/scriptsRoutes'
export { createSharedEntityOverridesRoutes } from './shared/routes/sharedEntityOverridesRoutes'
export { createEntityTypesRoutes } from './entities/routes/entityTypesRoutes'
export { createEntityInstancesRoutes } from './entities/routes/entityInstancesRoutes'
export { createActionsRoutes } from './entities/routes/actionsRoutes'
export { createEventBindingsRoutes } from './entities/routes/eventBindingsRoutes'
export { createTemplatesRoutes } from './templates/routes/templatesRoutes'
export { createPublicMetahubsRoutes } from './metahubs/routes/publicMetahubsRoutes'
export { createMetahubMigrationsRoutes } from './metahubs/routes/metahubMigrationsRoutes'
export { createPublicationsRoutes } from './publications/routes/publicationsRoutes'
export { createApplicationMigrationsRoutes } from './applications/routes/applicationMigrationsRoutes'
export { createSettingsRoutes } from './settings/routes/settingsRoutes'
export * from './shared/guards'
