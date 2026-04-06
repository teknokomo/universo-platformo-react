import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '../../../utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createScriptsController } from '../controllers/scriptsController'

export function createScriptsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createScriptsController(createHandler)

    router.get('/metahub/:metahubId/scripts', readLimiter, asyncHandler(ctrl.list))
    router.post('/metahub/:metahubId/scripts', writeLimiter, asyncHandler(ctrl.create))
    router.get('/metahub/:metahubId/script/:scriptId', readLimiter, asyncHandler(ctrl.getById))
    router.patch('/metahub/:metahubId/script/:scriptId', writeLimiter, asyncHandler(ctrl.update))
    router.delete('/metahub/:metahubId/script/:scriptId', writeLimiter, asyncHandler(ctrl.remove))

    return router
}