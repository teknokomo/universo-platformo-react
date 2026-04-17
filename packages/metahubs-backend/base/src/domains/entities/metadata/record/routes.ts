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

    const linkedCollectionPaths = (suffix: string) => [
        `/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:linkedCollectionId/${suffix}`,
        `/metahub/:metahubId/entities/:kindKey/instance/:linkedCollectionId/${suffix}`
    ]

    router.get(linkedCollectionPaths('records'), readLimiter, asyncHandler(ctrl.list))
    router.get(linkedCollectionPaths('record/:recordId'), readLimiter, asyncHandler(ctrl.getById))
    router.post(linkedCollectionPaths('records'), writeLimiter, asyncHandler(ctrl.create))
    router.patch(linkedCollectionPaths('record/:recordId'), writeLimiter, asyncHandler(ctrl.update))
    router.patch(linkedCollectionPaths('record/:recordId/move'), writeLimiter, asyncHandler(ctrl.move))
    router.patch(linkedCollectionPaths('records/reorder'), writeLimiter, asyncHandler(ctrl.reorder))
    router.delete(linkedCollectionPaths('record/:recordId'), writeLimiter, asyncHandler(ctrl.remove))
    router.post(linkedCollectionPaths('record/:recordId/copy'), writeLimiter, asyncHandler(ctrl.copy))

    return router
}
