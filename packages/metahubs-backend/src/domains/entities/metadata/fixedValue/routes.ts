import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../../shared/createMetahubHandler'
import { createFixedValuesController } from './controller'

export function createEntityFixedValueRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createFixedValuesController(createHandler)

    const valueGroupPaths = (suffix: string) => [
        `/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:valueGroupId/${suffix}`,
        `/metahub/:metahubId/entities/:kindKey/instance/:valueGroupId/${suffix}`
    ]

    // List fixed values
    router.get(valueGroupPaths('fixed-values'), readLimiter, asyncHandler(ctrl.list))

    // Get fixed value by ID
    router.get(valueGroupPaths('fixed-value/:fixedValueId'), readLimiter, asyncHandler(ctrl.getById))

    // Create fixed value
    router.post(valueGroupPaths('fixed-values'), writeLimiter, asyncHandler(ctrl.create))

    // Update fixed value
    router.patch(valueGroupPaths('fixed-value/:fixedValueId'), writeLimiter, asyncHandler(ctrl.update))

    // Delete fixed value
    router.delete(valueGroupPaths('fixed-value/:fixedValueId'), writeLimiter, asyncHandler(ctrl.delete))

    // Move fixed value (up/down)
    router.patch(valueGroupPaths('fixed-value/:fixedValueId/move'), writeLimiter, asyncHandler(ctrl.move))

    // Reorder fixed values
    router.patch(valueGroupPaths('fixed-values/reorder'), writeLimiter, asyncHandler(ctrl.reorder))

    // Copy fixed value
    router.post(valueGroupPaths('fixed-value/:fixedValueId/copy'), writeLimiter, asyncHandler(ctrl.copy))

    // Get fixed-value codenames
    router.get(
        [
            '/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:valueGroupId/fixed-value-codenames',
            '/metahub/:metahubId/entities/:kindKey/instance/:valueGroupId/fixed-value-codenames'
        ],
        readLimiter,
        asyncHandler(ctrl.getCodenames)
    )

    return router
}
