import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '../../../utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createElementsController } from '../controllers/elementsController'

export function createElementsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createElementsController(createHandler)

    const catalogPaths = (suffix: string) => [
        `/metahub/:metahubId/hub/:hubId/catalog/:catalogId/${suffix}`,
        `/metahub/:metahubId/catalog/:catalogId/${suffix}`
    ]

    router.get(catalogPaths('elements'), readLimiter, asyncHandler(ctrl.list))
    router.get(catalogPaths('element/:elementId'), readLimiter, asyncHandler(ctrl.getById))
    router.post(catalogPaths('elements'), writeLimiter, asyncHandler(ctrl.create))
    router.patch(catalogPaths('element/:elementId'), writeLimiter, asyncHandler(ctrl.update))
    router.patch(catalogPaths('element/:elementId/move'), writeLimiter, asyncHandler(ctrl.move))
    router.patch(catalogPaths('elements/reorder'), writeLimiter, asyncHandler(ctrl.reorder))
    router.delete(catalogPaths('element/:elementId'), writeLimiter, asyncHandler(ctrl.remove))
    router.post(catalogPaths('element/:elementId/copy'), writeLimiter, asyncHandler(ctrl.copy))

    return router
}
