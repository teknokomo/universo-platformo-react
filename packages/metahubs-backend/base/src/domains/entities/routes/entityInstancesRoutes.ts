import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createEntityInstancesController } from '../controllers/entityInstancesController'

export function createEntityInstancesRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createEntityInstancesController(createHandler)

    router.get('/metahub/:metahubId/entities', readLimiter, asyncHandler(ctrl.list))
    router.post('/metahub/:metahubId/entities', writeLimiter, asyncHandler(ctrl.create))
    router.post('/metahub/:metahubId/entities/reorder', writeLimiter, asyncHandler(ctrl.reorder))
    router.get('/metahub/:metahubId/entity/:entityId', readLimiter, asyncHandler(ctrl.getById))
    router.patch('/metahub/:metahubId/entity/:entityId', writeLimiter, asyncHandler(ctrl.update))
    router.delete('/metahub/:metahubId/entity/:entityId', writeLimiter, asyncHandler(ctrl.remove))
    router.post('/metahub/:metahubId/entity/:entityId/restore', writeLimiter, asyncHandler(ctrl.restore))
    router.delete('/metahub/:metahubId/entity/:entityId/permanent', writeLimiter, asyncHandler(ctrl.permanentRemove))
    router.post('/metahub/:metahubId/entity/:entityId/copy', writeLimiter, asyncHandler(ctrl.copy))

    return router
}
