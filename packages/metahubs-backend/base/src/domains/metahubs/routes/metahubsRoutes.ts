import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '../../../utils'
import { asyncHandler } from '../../shared'
import { createMetahubsController } from '../controllers/metahubsController'

export function createMetahubsRoutes(
  ensureAuth: RequestHandler,
  getDbExecutor: () => DbExecutor,
  readLimiter: RateLimitRequestHandler,
  writeLimiter: RateLimitRequestHandler
): Router {
  const router = Router({ mergeParams: true })
  router.use(ensureAuth)

  const ctrl = createMetahubsController(getDbExecutor)

  // Codename defaults (no metahub membership needed)
  router.get('/metahubs/codename-defaults', readLimiter, asyncHandler(ctrl.codenameDefaults))

  // List metahubs
  router.get('/metahubs', readLimiter, asyncHandler(ctrl.list))

  // Get metahub by ID
  router.get('/metahub/:metahubId', readLimiter, asyncHandler(ctrl.getById))

  // Board summary
  router.get('/metahub/:metahubId/board/summary', readLimiter, asyncHandler(ctrl.boardSummary))

  // Create metahub
  router.post('/metahubs', writeLimiter, asyncHandler(ctrl.create))

  // Import metahub from snapshot
  router.post('/metahubs/import', writeLimiter, asyncHandler(ctrl.importFromSnapshot))

  // Copy metahub
  router.post('/metahub/:metahubId/copy', writeLimiter, asyncHandler(ctrl.copy))

  // Update metahub
  router.put('/metahub/:metahubId', writeLimiter, asyncHandler(ctrl.update))

  // Delete metahub
  router.delete('/metahub/:metahubId', writeLimiter, asyncHandler(ctrl.remove))

  // Export metahub snapshot
  router.get('/metahub/:metahubId/export', readLimiter, asyncHandler(ctrl.exportMetahub))

  // List members
  router.get('/metahub/:metahubId/members', readLimiter, asyncHandler(ctrl.listMembers))

  // Add member
  router.post('/metahub/:metahubId/members', writeLimiter, asyncHandler(ctrl.addMember))

  // Update member
  router.patch('/metahub/:metahubId/member/:memberId', writeLimiter, asyncHandler(ctrl.updateMember))

  // Remove member
  router.delete('/metahub/:metahubId/member/:memberId', writeLimiter, asyncHandler(ctrl.removeMember))

  return router
}
