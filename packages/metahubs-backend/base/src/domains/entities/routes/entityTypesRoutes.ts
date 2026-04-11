import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createEntityTypesController } from '../controllers/entityTypesController'

export function createEntityTypesRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createEntityTypesController(createHandler)

    router.get('/metahub/:metahubId/entity-types', readLimiter, asyncHandler(ctrl.list))
    router.post('/metahub/:metahubId/entity-types', writeLimiter, asyncHandler(ctrl.create))
    router.get('/metahub/:metahubId/entity-type/:entityTypeId', readLimiter, asyncHandler(ctrl.getById))
    router.patch('/metahub/:metahubId/entity-type/:entityTypeId', writeLimiter, asyncHandler(ctrl.update))
    router.delete('/metahub/:metahubId/entity-type/:entityTypeId', writeLimiter, asyncHandler(ctrl.remove))

    return router
}
