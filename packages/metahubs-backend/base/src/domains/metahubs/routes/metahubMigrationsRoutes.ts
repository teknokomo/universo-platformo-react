import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '../../../utils'
import { asyncHandler } from '../../shared'
import { createMetahubMigrationsController } from '../controllers/metahubMigrationsController'

export function createMetahubMigrationsRoutes(
  ensureAuth: RequestHandler,
  getDbExecutor: () => DbExecutor,
  readLimiter: RateLimitRequestHandler,
  writeLimiter: RateLimitRequestHandler
): Router {
  const router = Router({ mergeParams: true })
  router.use(ensureAuth)

  const ctrl = createMetahubMigrationsController(getDbExecutor)

  router.get('/metahub/:metahubId/migrations/status', readLimiter, asyncHandler(ctrl.status))
  router.get('/metahub/:metahubId/migrations', readLimiter, asyncHandler(ctrl.list))
  router.post('/metahub/:metahubId/migrations/plan', writeLimiter, asyncHandler(ctrl.plan))
  router.post('/metahub/:metahubId/migrations/apply', writeLimiter, asyncHandler(ctrl.apply))

  return router
}
