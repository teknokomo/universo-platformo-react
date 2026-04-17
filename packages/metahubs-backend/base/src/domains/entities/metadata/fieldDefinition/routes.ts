import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../../shared/createMetahubHandler'
import { createFieldDefinitionsController } from './controller'

export function createEntityFieldDefinitionRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createFieldDefinitionsController(createHandler, getDbExecutor)

    const linkedCollectionPaths = (suffix: string) => [
        `/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:linkedCollectionId/${suffix}`,
        `/metahub/:metahubId/entities/:kindKey/instance/:linkedCollectionId/${suffix}`
    ]

    // List field definitions
    router.get(linkedCollectionPaths('field-definitions'), readLimiter, asyncHandler(ctrl.list))

    // Get field definition by ID
    router.get(linkedCollectionPaths('field-definition/:fieldDefinitionId'), readLimiter, asyncHandler(ctrl.getById))

    // Create field definition
    router.post(linkedCollectionPaths('field-definitions'), writeLimiter, asyncHandler(ctrl.create))

    // Copy field definition
    router.post(linkedCollectionPaths('field-definition/:fieldDefinitionId/copy'), writeLimiter, asyncHandler(ctrl.copy))

    // Update field definition
    router.patch(linkedCollectionPaths('field-definition/:fieldDefinitionId'), writeLimiter, asyncHandler(ctrl.update))

    // Move field definition
    router.patch(linkedCollectionPaths('field-definition/:fieldDefinitionId/move'), writeLimiter, asyncHandler(ctrl.move))

    // Reorder field definitions
    router.patch(linkedCollectionPaths('field-definitions/reorder'), writeLimiter, asyncHandler(ctrl.reorder))

    // Toggle required
    router.patch(
        linkedCollectionPaths('field-definition/:fieldDefinitionId/toggle-required'),
        writeLimiter,
        asyncHandler(ctrl.toggleRequired)
    )

    // Set display field
    router.patch(linkedCollectionPaths('field-definition/:fieldDefinitionId/set-display'), writeLimiter, asyncHandler(ctrl.setDisplay))

    // Clear display field
    router.patch(linkedCollectionPaths('field-definition/:fieldDefinitionId/clear-display'), writeLimiter, asyncHandler(ctrl.clearDisplay))

    // Delete field definition
    router.delete(linkedCollectionPaths('field-definition/:fieldDefinitionId'), writeLimiter, asyncHandler(ctrl.delete))

    // Field-definition codenames (global scope duplicate checking)
    router.get(linkedCollectionPaths('field-definition-codenames'), readLimiter, asyncHandler(ctrl.listCodenames))

    // Batch child field definitions (for multiple parents)
    router.get(linkedCollectionPaths('field-definitions/children/batch'), readLimiter, asyncHandler(ctrl.listChildrenBatch))

    // List child field definitions
    router.get(linkedCollectionPaths('field-definition/:fieldDefinitionId/children'), readLimiter, asyncHandler(ctrl.listChildren))

    // Create child field definition
    router.post(linkedCollectionPaths('field-definition/:fieldDefinitionId/children'), writeLimiter, asyncHandler(ctrl.createChild))

    return router
}
