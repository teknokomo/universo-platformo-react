import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createEventBindingsController } from '../controllers/eventBindingsController'

export function createEventBindingsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createEventBindingsController(createHandler)

    router.get('/metahub/:metahubId/object/:objectId/event-bindings', readLimiter, asyncHandler(ctrl.list))
    router.post('/metahub/:metahubId/object/:objectId/event-bindings', writeLimiter, asyncHandler(ctrl.create))
    router.get('/metahub/:metahubId/event-binding/:bindingId', readLimiter, asyncHandler(ctrl.getById))
    router.patch('/metahub/:metahubId/event-binding/:bindingId', writeLimiter, asyncHandler(ctrl.update))
    router.delete('/metahub/:metahubId/event-binding/:bindingId', writeLimiter, asyncHandler(ctrl.remove))

    return router
}
