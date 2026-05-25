import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '../../../utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createModulesController } from '../controllers/modulesController'

export function createModulesRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createModulesController(createHandler)

    router.get('/metahub/:metahubId/modules', readLimiter, asyncHandler(ctrl.list))
    router.post('/metahub/:metahubId/modules', writeLimiter, asyncHandler(ctrl.create))
    router.get('/metahub/:metahubId/module/:moduleId', readLimiter, asyncHandler(ctrl.getById))
    router.patch('/metahub/:metahubId/module/:moduleId', writeLimiter, asyncHandler(ctrl.update))
    router.delete('/metahub/:metahubId/module/:moduleId', writeLimiter, asyncHandler(ctrl.remove))

    return router
}
