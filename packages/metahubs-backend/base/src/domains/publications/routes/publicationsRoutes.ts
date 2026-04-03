import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '../../../utils'
import { asyncHandler } from '../../shared'
import { createPublicationsController } from '../controllers/publicationsController'

export function createPublicationsRoutes(
  ensureAuth: RequestHandler,
  getDbExecutor: () => DbExecutor,
  readLimiter: RateLimitRequestHandler,
  writeLimiter: RateLimitRequestHandler
): Router {
  const router = Router({ mergeParams: true })
  router.use(ensureAuth)

  const ctrl = createPublicationsController(getDbExecutor)

  // List available publications (no metahub membership needed)
  router.get('/publications/available', readLimiter, asyncHandler(ctrl.listAvailable))

  // List publications by metahub
  router.get('/metahub/:metahubId/publications', readLimiter, asyncHandler(ctrl.list))

  // Create publication
  router.post('/metahub/:metahubId/publications', writeLimiter, asyncHandler(ctrl.create))

  // Get publication by ID
  router.get('/metahub/:metahubId/publication/:publicationId', readLimiter, asyncHandler(ctrl.getById))

  // Update publication
  router.patch('/metahub/:metahubId/publication/:publicationId', writeLimiter, asyncHandler(ctrl.update))

  // Delete publication
  router.delete('/metahub/:metahubId/publication/:publicationId', writeLimiter, asyncHandler(ctrl.remove))

  // List linked applications
  router.get('/metahub/:metahubId/publication/:publicationId/applications', readLimiter, asyncHandler(ctrl.listLinkedApps))

  // Create linked application
  router.post('/metahub/:metahubId/publication/:publicationId/applications', writeLimiter, asyncHandler(ctrl.createLinkedApp))

  // Get schema diff
  router.get('/metahub/:metahubId/publication/:publicationId/diff', readLimiter, asyncHandler(ctrl.diff))

  // Sync schema
  router.post('/metahub/:metahubId/publication/:publicationId/sync', writeLimiter, asyncHandler(ctrl.sync))

  // List versions
  router.get('/metahub/:metahubId/publication/:publicationId/versions', readLimiter, asyncHandler(ctrl.listVersions))

  // Create version
  router.post('/metahub/:metahubId/publication/:publicationId/versions', writeLimiter, asyncHandler(ctrl.createVersion))

  // Activate version
  router.post('/metahub/:metahubId/publication/:publicationId/versions/:versionId/activate', writeLimiter, asyncHandler(ctrl.activateVersion))

  // Export version as snapshot bundle
  router.get('/metahub/:metahubId/publication/:publicationId/versions/:versionId/export', readLimiter, asyncHandler(ctrl.exportVersion))

  // Import version from snapshot bundle
  router.post('/metahub/:metahubId/publication/:publicationId/versions/import', writeLimiter, asyncHandler(ctrl.importVersion))

  // Update version
  router.patch('/metahub/:metahubId/publication/:publicationId/versions/:versionId', writeLimiter, asyncHandler(ctrl.updateVersion))

  // Delete version
  router.delete('/metahub/:metahubId/publication/:publicationId/versions/:versionId', writeLimiter, asyncHandler(ctrl.deleteVersion))

  return router
}
