import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createHubsController } from '../controllers/hubsController'

export function createHubsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createHubsController(createHandler, getDbExecutor)

    // List hubs (global)
    router.get('/metahub/:metahubId/hubs', readLimiter, asyncHandler(ctrl.list))

    // List child hubs
    router.get('/metahub/:metahubId/hub/:hubId/hubs', readLimiter, asyncHandler(ctrl.listChildHubs))

    // Reorder hubs
    router.patch('/metahub/:metahubId/hubs/reorder', writeLimiter, asyncHandler(ctrl.reorder))

    // Get hub by ID
    router.get('/metahub/:metahubId/hub/:hubId', readLimiter, asyncHandler(ctrl.getById))

    // Create hub
    router.post('/metahub/:metahubId/hubs', writeLimiter, asyncHandler(ctrl.create))

    // Copy hub
    router.post('/metahub/:metahubId/hub/:hubId/copy', writeLimiter, asyncHandler(ctrl.copy))

    // Update hub
    router.patch('/metahub/:metahubId/hub/:hubId', writeLimiter, asyncHandler(ctrl.update))

    // Get blocking catalogs
    router.get('/metahub/:metahubId/hub/:hubId/blocking-catalogs', readLimiter, asyncHandler(ctrl.getBlockingCatalogs))

    // Delete hub
    router.delete('/metahub/:metahubId/hub/:hubId', writeLimiter, asyncHandler(ctrl.delete))

    return router
}
