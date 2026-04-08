import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '../../../utils'
import { asyncHandler } from '../asyncHandler'
import { createMetahubHandlerFactory } from '../createMetahubHandler'
import { createSharedEntityOverridesController } from '../controllers/sharedEntityOverridesController'

export function createSharedEntityOverridesRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createSharedEntityOverridesController(createHandler)

    router.get('/metahub/:metahubId/shared-containers', readLimiter, asyncHandler(ctrl.listContainers))
    router.post('/metahub/:metahubId/shared-containers/ensure', writeLimiter, asyncHandler(ctrl.ensureContainers))
    router.get('/metahub/:metahubId/shared-entity-overrides', readLimiter, asyncHandler(ctrl.list))
    router.patch('/metahub/:metahubId/shared-entity-overrides', writeLimiter, asyncHandler(ctrl.patch))
    router.delete('/metahub/:metahubId/shared-entity-overrides', writeLimiter, asyncHandler(ctrl.remove))

    return router
}
