import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createSetsController } from '../controllers/setsController'

export function createSetsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createSetsController(createHandler)

    // List sets (global or hub-scoped)
    router.get(['/metahub/:metahubId/sets', '/metahub/:metahubId/hub/:hubId/sets'], readLimiter, asyncHandler(ctrl.list))

    // Reorder sets
    router.patch(
        ['/metahub/:metahubId/sets/reorder', '/metahub/:metahubId/hub/:hubId/sets/reorder'],
        writeLimiter,
        asyncHandler(ctrl.reorder)
    )

    // Get set by ID
    router.get(['/metahub/:metahubId/set/:setId', '/metahub/:metahubId/hub/:hubId/set/:setId'], readLimiter, asyncHandler(ctrl.getById))

    // Create set
    router.post(['/metahub/:metahubId/sets', '/metahub/:metahubId/hub/:hubId/sets'], writeLimiter, asyncHandler(ctrl.create))

    // Update set
    router.patch(['/metahub/:metahubId/set/:setId', '/metahub/:metahubId/hub/:hubId/set/:setId'], writeLimiter, asyncHandler(ctrl.update))

    // Copy set
    router.post('/metahub/:metahubId/set/:setId/copy', writeLimiter, asyncHandler(ctrl.copy))

    // Get blocking references
    router.get('/metahub/:metahubId/set/:setId/blocking-references', readLimiter, asyncHandler(ctrl.getBlockingReferences))

    // Delete set
    router.delete(['/metahub/:metahubId/set/:setId', '/metahub/:metahubId/hub/:hubId/set/:setId'], writeLimiter, asyncHandler(ctrl.delete))

    return router
}
