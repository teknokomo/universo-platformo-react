import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '../../../../utils'
import { asyncHandler } from '../../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../../shared/createMetahubHandler'
import { createRecordsController } from './controller'

export function createEntityRecordRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createRecordsController(createHandler)

    const objectCollectionPaths = (suffix: string) => [
        `/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:objectCollectionId/${suffix}`,
        `/metahub/:metahubId/entities/:kindKey/instance/:objectCollectionId/${suffix}`
    ]

    router.get(objectCollectionPaths('records'), readLimiter, asyncHandler(ctrl.list))
    router.get(objectCollectionPaths('record/:recordId'), readLimiter, asyncHandler(ctrl.getById))
    router.post(objectCollectionPaths('records'), writeLimiter, asyncHandler(ctrl.create))
    router.patch(objectCollectionPaths('record/:recordId'), writeLimiter, asyncHandler(ctrl.update))
    router.patch(objectCollectionPaths('record/:recordId/move'), writeLimiter, asyncHandler(ctrl.move))
    router.patch(objectCollectionPaths('records/reorder'), writeLimiter, asyncHandler(ctrl.reorder))
    router.delete(objectCollectionPaths('record/:recordId'), writeLimiter, asyncHandler(ctrl.remove))
    router.post(objectCollectionPaths('record/:recordId/copy'), writeLimiter, asyncHandler(ctrl.copy))

    return router
}
