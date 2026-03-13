import express from 'express'
import type { Router as ExpressRouter, Request, Response, NextFunction } from 'express'
import pingRouter from './ping'
// Universo Platformo | Logger
import logger from '../utils/logger'
// Universo Platformo | Import auth middleware
import { createEnsureAuthWithRls, createPermissionService } from '@universo/auth-backend'
// Universo Platformo | Metahubs
import {
    createMetahubsServiceRoutes,
    createPublicMetahubsServiceRoutes,
    loadPublishedPublicationRuntimeSource
} from '@universo/metahubs-backend'
// Universo Platformo | Applications
import { createApplicationsServiceRoutes } from '@universo/applications-backend'
// Universo Platformo | Start (Onboarding)
import { createStartServiceRoutes } from '@universo/start-backend'
// Universo Platformo | Admin
import {
    createGlobalUsersRoutes,
    createGlobalAccessService,
    createInstancesRoutes,
    createRolesRoutes,
    createLocalesRoutes,
    createPublicLocalesRoutes,
    createAdminSettingsRoutes
} from '@universo/admin-backend'
// Universo Platformo | Profile
import { createProfileRoutes } from '@universo/profile-backend'
import { getKnex, createKnexExecutor } from '@universo/database'
import { OptimisticLockError, lookupUserEmail, isDatabaseConnectTimeoutError, getRequestDbExecutor } from '@universo/utils'
import helmet from 'helmet'

const router: ExpressRouter = express.Router()

// Create RLS-enabled authentication middleware
const ensureAuthWithRls = createEnsureAuthWithRls({ getKnex })

// Security headers (safe defaults for APIs; CSP disabled for now)
router.use(helmet({ contentSecurityPolicy: false }))

// ═══════════════════════════════════════════════════════════════════════
// Health check
// ═══════════════════════════════════════════════════════════════════════
router.use('/ping', pingRouter)

// ═══════════════════════════════════════════════════════════════════════
// Public routes (no auth required)
// ═══════════════════════════════════════════════════════════════════════

// Public Metahub routes (read-only access to published metahubs)
let publicMetahubsRouter: ExpressRouter | null = null
router.use('/public/metahub', (req: Request, res: Response, next: NextFunction) => {
    if (!publicMetahubsRouter) {
        publicMetahubsRouter = createPublicMetahubsServiceRoutes(() => createKnexExecutor(getKnex()))
        logger.info('[Metahubs] Public router created')
    }
    if (publicMetahubsRouter) {
        publicMetahubsRouter(req, res, next)
    } else {
        next()
    }
})

// Public locales (no auth required)
const publicLocalesRouter = createPublicLocalesRoutes({ getDbExecutor: () => createKnexExecutor(getKnex()) })
router.use('/locales', publicLocalesRouter)

// ═══════════════════════════════════════════════════════════════════════
// Authenticated routes — lazy initialization
// ═══════════════════════════════════════════════════════════════════════

// Metahubs, MetaEntities, MetaSections
let metahubsRouter: ExpressRouter | null = null
router.use((req: Request, res: Response, next: NextFunction) => {
    if (!metahubsRouter) {
        metahubsRouter = createMetahubsServiceRoutes(ensureAuthWithRls, () => createKnexExecutor(getKnex()))
    }
    if (metahubsRouter) {
        metahubsRouter(req, res, next)
    } else {
        next()
    }
})

// Applications, Connectors
let applicationsRouter: ExpressRouter | null = null
router.use((req: Request, res: Response, next: NextFunction) => {
    if (!applicationsRouter) {
        applicationsRouter = createApplicationsServiceRoutes(
            ensureAuthWithRls,
            () => createKnexExecutor(getKnex()),
            loadPublishedPublicationRuntimeSource
        )
    }
    if (applicationsRouter) {
        applicationsRouter(req, res, next)
    } else {
        next()
    }
})

// Start (Onboarding wizard)
let startRouter: ExpressRouter | null = null
router.use((req: Request, res: Response, next: NextFunction) => {
    if (!startRouter) {
        startRouter = createStartServiceRoutes(ensureAuthWithRls, (r) => getRequestDbExecutor(r, createKnexExecutor(getKnex())))
    }
    if (startRouter) {
        startRouter(req, res, next)
    } else {
        next()
    }
})

// ═══════════════════════════════════════════════════════════════════════
// Admin routes
// ═══════════════════════════════════════════════════════════════════════
const globalAccessService = createGlobalAccessService({ getDbExecutor: () => createKnexExecutor(getKnex()) })
const permissionService = createPermissionService({ getKnex })

const globalUsersRouter = createGlobalUsersRoutes({ globalAccessService, permissionService })
router.use('/admin/global-users', ensureAuthWithRls, globalUsersRouter)

const instancesRouter = createInstancesRoutes({
    globalAccessService,
    permissionService,
    getDbExecutor: () => createKnexExecutor(getKnex())
})
router.use('/admin/instances', ensureAuthWithRls, instancesRouter)

const rolesRouter = createRolesRoutes({
    globalAccessService,
    permissionService,
    getDbExecutor: () => createKnexExecutor(getKnex())
})
router.use('/admin/roles', ensureAuthWithRls, rolesRouter)

const localesRouter = createLocalesRoutes({
    globalAccessService,
    permissionService,
    getDbExecutor: () => createKnexExecutor(getKnex())
})
router.use('/admin/locales', ensureAuthWithRls, localesRouter)

const adminSettingsRouter = createAdminSettingsRoutes({
    globalAccessService,
    permissionService,
    getDbExecutor: () => createKnexExecutor(getKnex())
})
router.use('/admin/settings', ensureAuthWithRls, adminSettingsRouter)

// ═══════════════════════════════════════════════════════════════════════
// Profile routes
// ═══════════════════════════════════════════════════════════════════════
const profileRouter = createProfileRoutes(
    {
        getDbExecutor: () => createKnexExecutor(getKnex()),
        getRequestDbExecutor: (req) => getRequestDbExecutor(req, createKnexExecutor(getKnex()))
    },
    ensureAuthWithRls
)
router.use('/profile', profileRouter)

// ═══════════════════════════════════════════════════════════════════════
// Global error handler
// ═══════════════════════════════════════════════════════════════════════
function isOptimisticLockError(err: unknown): err is OptimisticLockError {
    if (err instanceof OptimisticLockError && err.conflict && typeof err.conflict === 'object') {
        return true
    }
    if (err && typeof err === 'object') {
        const e = err as { name?: string; code?: string; conflict?: unknown }
        const hasValidConflict = !!e.conflict && typeof e.conflict === 'object'
        return hasValidConflict && (e.name === 'OptimisticLockError' || e.code === 'OPTIMISTIC_LOCK_CONFLICT')
    }
    return false
}

router.use(async (err: Error & { statusCode?: number }, req: Request, res: Response, next: NextFunction) => {
    if (isOptimisticLockError(err)) {
        const conflict = err.conflict
        let updatedByEmail = conflict?.updatedByEmail ?? null

        if (!updatedByEmail && conflict?.updatedBy) {
            updatedByEmail = await lookupUserEmail(createKnexExecutor(getKnex()), conflict.updatedBy)
        }

        res.setHeader('Content-Type', 'application/json')
        return res.status(409).json({
            error: 'Conflict: entity was modified by another user',
            code: err.code,
            conflict: { ...conflict, updatedByEmail }
        })
    }

    // Determine HTTP status code
    const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : isDatabaseConnectTimeoutError(err) ? 503 : 500

    if (statusCode !== 404) {
        logger.error('[API Error Handler]', {
            error: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
            statusCode,
            timestamp: new Date().toISOString()
        })
    }

    if (res.headersSent) {
        return next(err)
    }

    const isDbTimeout = statusCode === 503 && isDatabaseConnectTimeoutError(err)
    res.status(statusCode).json({
        error: statusCode === 404 ? 'Not Found' : statusCode === 503 ? 'Service Unavailable' : 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : statusCode === 404 ? 'Resource not found' : 'An error occurred',
        code: isDbTimeout ? 'DB_CONNECTION_TIMEOUT' : undefined,
        path: req.path
    })
})

export default router
