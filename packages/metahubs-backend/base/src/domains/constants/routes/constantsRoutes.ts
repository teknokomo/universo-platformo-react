import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createConstantsController } from '../controllers/constantsController'

export function createConstantsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createConstantsController(createHandler)

    // List constants
    router.get(
        ['/metahub/:metahubId/hub/:hubId/set/:setId/constants', '/metahub/:metahubId/set/:setId/constants'],
        readLimiter,
        asyncHandler(ctrl.list)
    )

    // Get constant by ID
    router.get(
        ['/metahub/:metahubId/hub/:hubId/set/:setId/constant/:constantId', '/metahub/:metahubId/set/:setId/constant/:constantId'],
        readLimiter,
        asyncHandler(ctrl.getById)
    )

    // Create constant
    router.post(
        ['/metahub/:metahubId/hub/:hubId/set/:setId/constants', '/metahub/:metahubId/set/:setId/constants'],
        writeLimiter,
        asyncHandler(ctrl.create)
    )

    // Update constant
    router.patch(
        ['/metahub/:metahubId/hub/:hubId/set/:setId/constant/:constantId', '/metahub/:metahubId/set/:setId/constant/:constantId'],
        writeLimiter,
        asyncHandler(ctrl.update)
    )

    // Delete constant
    router.delete(
        ['/metahub/:metahubId/hub/:hubId/set/:setId/constant/:constantId', '/metahub/:metahubId/set/:setId/constant/:constantId'],
        writeLimiter,
        asyncHandler(ctrl.delete)
    )

    // Move constant (up/down)
    router.patch(
        ['/metahub/:metahubId/hub/:hubId/set/:setId/constant/:constantId/move', '/metahub/:metahubId/set/:setId/constant/:constantId/move'],
        writeLimiter,
        asyncHandler(ctrl.move)
    )

    // Reorder constants
    router.patch(
        ['/metahub/:metahubId/hub/:hubId/set/:setId/constants/reorder', '/metahub/:metahubId/set/:setId/constants/reorder'],
        writeLimiter,
        asyncHandler(ctrl.reorder)
    )

    // Copy constant
    router.post(
        ['/metahub/:metahubId/hub/:hubId/set/:setId/constant/:constantId/copy', '/metahub/:metahubId/set/:setId/constant/:constantId/copy'],
        writeLimiter,
        asyncHandler(ctrl.copy)
    )

    // Get constant codenames
    router.get('/metahub/:metahubId/set/:setId/constant-codenames', readLimiter, asyncHandler(ctrl.getCodenames))

    return router
}
