import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../../shared/createMetahubHandler'
import { createComponentsController } from './controller'

export function createEntityComponentRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createComponentsController(createHandler, getDbExecutor)

    const objectCollectionPaths = (suffix: string) => [
        `/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:objectCollectionId/${suffix}`,
        `/metahub/:metahubId/entities/:kindKey/instance/:objectCollectionId/${suffix}`
    ]

    // List components
    router.get(objectCollectionPaths('components'), readLimiter, asyncHandler(ctrl.list))

    // Get component by ID
    router.get(objectCollectionPaths('component/:componentId'), readLimiter, asyncHandler(ctrl.getById))

    // Create component
    router.post(objectCollectionPaths('components'), writeLimiter, asyncHandler(ctrl.create))

    // Copy component
    router.post(objectCollectionPaths('component/:componentId/copy'), writeLimiter, asyncHandler(ctrl.copy))

    // Update component
    router.patch(objectCollectionPaths('component/:componentId'), writeLimiter, asyncHandler(ctrl.update))

    // Move component
    router.patch(objectCollectionPaths('component/:componentId/move'), writeLimiter, asyncHandler(ctrl.move))

    // Reorder components
    router.patch(objectCollectionPaths('components/reorder'), writeLimiter, asyncHandler(ctrl.reorder))

    // Toggle required
    router.patch(objectCollectionPaths('component/:componentId/toggle-required'), writeLimiter, asyncHandler(ctrl.toggleRequired))

    // Set display field
    router.patch(objectCollectionPaths('component/:componentId/set-display'), writeLimiter, asyncHandler(ctrl.setDisplay))

    // Clear display field
    router.patch(objectCollectionPaths('component/:componentId/clear-display'), writeLimiter, asyncHandler(ctrl.clearDisplay))

    // Delete component
    router.delete(objectCollectionPaths('component/:componentId'), writeLimiter, asyncHandler(ctrl.delete))

    // Component codenames (global scope duplicate checking)
    router.get(objectCollectionPaths('component-codenames'), readLimiter, asyncHandler(ctrl.listCodenames))

    // Batch child components (for multiple parents)
    router.get(objectCollectionPaths('components/children/batch'), readLimiter, asyncHandler(ctrl.listChildrenBatch))

    // List child components
    router.get(objectCollectionPaths('component/:componentId/children'), readLimiter, asyncHandler(ctrl.listChildren))

    // Create child component
    router.post(objectCollectionPaths('component/:componentId/children'), writeLimiter, asyncHandler(ctrl.createChild))

    return router
}
