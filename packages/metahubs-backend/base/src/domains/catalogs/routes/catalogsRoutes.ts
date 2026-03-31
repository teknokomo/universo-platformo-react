import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createCatalogsController } from '../controllers/catalogsController'

export function createCatalogsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createCatalogsController(createHandler, getDbExecutor)

    // List catalogs (global)
    router.get('/metahub/:metahubId/catalogs', readLimiter, asyncHandler(ctrl.list))

    // Create catalog (metahub-level)
    router.post('/metahub/:metahubId/catalogs', writeLimiter, asyncHandler(ctrl.create))

    // Update catalog (global)
    router.patch('/metahub/:metahubId/catalog/:catalogId', writeLimiter, asyncHandler(ctrl.update))

    // List catalogs by hub
    router.get('/metahub/:metahubId/hub/:hubId/catalogs', readLimiter, asyncHandler(ctrl.listByHub))

    // Reorder catalogs (global + hub-scoped)
    router.patch(
        ['/metahub/:metahubId/catalogs/reorder', '/metahub/:metahubId/hub/:hubId/catalogs/reorder'],
        writeLimiter,
        asyncHandler(ctrl.reorder)
    )

    // Get catalog by hub
    router.get('/metahub/:metahubId/hub/:hubId/catalog/:catalogId', readLimiter, asyncHandler(ctrl.getByHub))

    // Get catalog by ID (global)
    router.get('/metahub/:metahubId/catalog/:catalogId', readLimiter, asyncHandler(ctrl.getById))

    // Copy catalog
    router.post('/metahub/:metahubId/catalog/:catalogId/copy', writeLimiter, asyncHandler(ctrl.copy))

    // Create catalog (hub-scoped)
    router.post('/metahub/:metahubId/hub/:hubId/catalogs', writeLimiter, asyncHandler(ctrl.createByHub))

    // Update catalog (hub-scoped)
    router.patch('/metahub/:metahubId/hub/:hubId/catalog/:catalogId', writeLimiter, asyncHandler(ctrl.updateByHub))

    // Blocking references
    router.get(
        ['/metahub/:metahubId/catalog/:catalogId/blocking-references', '/metahub/:metahubId/catalogs/:catalogId/blocking-references'],
        readLimiter,
        asyncHandler(ctrl.getBlockingReferences)
    )

    // Delete catalog from hub
    router.delete('/metahub/:metahubId/hub/:hubId/catalog/:catalogId', writeLimiter, asyncHandler(ctrl.deleteByHub))

    // Delete catalog (soft)
    router.delete('/metahub/:metahubId/catalog/:catalogId', writeLimiter, asyncHandler(ctrl.delete))

    // List trash
    router.get('/metahub/:metahubId/catalogs/trash', readLimiter, asyncHandler(ctrl.listTrash))

    // Restore catalog
    router.post('/metahub/:metahubId/catalog/:catalogId/restore', writeLimiter, asyncHandler(ctrl.restore))

    // Permanent delete
    router.delete('/metahub/:metahubId/catalog/:catalogId/permanent', writeLimiter, asyncHandler(ctrl.permanentDelete))

    return router
}
