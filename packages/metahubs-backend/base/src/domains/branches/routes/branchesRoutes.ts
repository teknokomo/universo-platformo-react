import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '../../../utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createBranchesController } from '../controllers/branchesController'

export function createBranchesRoutes(
  ensureAuth: RequestHandler,
  getDbExecutor: () => DbExecutor,
  readLimiter: RateLimitRequestHandler,
  writeLimiter: RateLimitRequestHandler
): Router {
  const router = Router({ mergeParams: true })
  router.use(ensureAuth)

  const createHandler = createMetahubHandlerFactory(getDbExecutor)
  const ctrl = createBranchesController(createHandler)

  router.get('/metahub/:metahubId/branches/options', readLimiter, asyncHandler(ctrl.listOptions))
  router.get('/metahub/:metahubId/branches', readLimiter, asyncHandler(ctrl.list))
  router.get('/metahub/:metahubId/branch/:branchId', readLimiter, asyncHandler(ctrl.getById))
  router.post('/metahub/:metahubId/branches', writeLimiter, asyncHandler(ctrl.create))
  router.patch('/metahub/:metahubId/branch/:branchId', writeLimiter, asyncHandler(ctrl.update))
  router.post('/metahub/:metahubId/branch/:branchId/activate', writeLimiter, asyncHandler(ctrl.activate))
  router.post('/metahub/:metahubId/branch/:branchId/default', writeLimiter, asyncHandler(ctrl.setDefault))
  router.get('/metahub/:metahubId/branch/:branchId/blocking-users', readLimiter, asyncHandler(ctrl.blockingUsers))
  router.delete('/metahub/:metahubId/branch/:branchId', writeLimiter, asyncHandler(ctrl.remove))

  return router
}
