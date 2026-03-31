/**
 * Application Migrations Routes for Metahubs Backend
 *
 * Thin route registration. Handler logic lives in
 * ../controllers/applicationMigrationsController.ts
 */

import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../../shared'
import { createApplicationMigrationsController } from '../controllers/applicationMigrationsController'

export function createApplicationMigrationsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const ctrl = createApplicationMigrationsController(getDbExecutor)

    router.get('/application/:applicationId/migrations/status', readLimiter, asyncHandler(ctrl.status))
    router.get('/application/:applicationId/migrations', readLimiter, asyncHandler(ctrl.list))
    router.get('/application/:applicationId/migration/:migrationId', readLimiter, asyncHandler(ctrl.get))
    router.get('/application/:applicationId/migration/:migrationId/analyze', readLimiter, asyncHandler(ctrl.analyze))
    router.post('/application/:applicationId/migration/:migrationId/rollback', writeLimiter, asyncHandler(ctrl.rollback))

    return router
}
