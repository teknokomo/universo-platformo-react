import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '../../../utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createSettingsController } from '../controllers/settingsController'

export function createSettingsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createSettingsController(createHandler)

    router.get('/metahub/:metahubId/settings', readLimiter, asyncHandler(ctrl.list))
    router.put('/metahub/:metahubId/settings', writeLimiter, asyncHandler(ctrl.bulkUpdate))
    router.get('/metahub/:metahubId/setting/:key', readLimiter, asyncHandler(ctrl.getByKey))
    router.delete('/metahub/:metahubId/setting/:key', writeLimiter, asyncHandler(ctrl.resetByKey))

    return router
}
