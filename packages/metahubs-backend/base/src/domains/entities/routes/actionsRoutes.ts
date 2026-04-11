import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createActionsController } from '../controllers/actionsController'

export function createActionsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createActionsController(createHandler)

    router.get('/metahub/:metahubId/object/:objectId/actions', readLimiter, asyncHandler(ctrl.list))
    router.post('/metahub/:metahubId/object/:objectId/actions', writeLimiter, asyncHandler(ctrl.create))
    router.get('/metahub/:metahubId/action/:actionId', readLimiter, asyncHandler(ctrl.getById))
    router.patch('/metahub/:metahubId/action/:actionId', writeLimiter, asyncHandler(ctrl.update))
    router.delete('/metahub/:metahubId/action/:actionId', writeLimiter, asyncHandler(ctrl.remove))

    return router
}
