import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createAttributesController } from '../controllers/attributesController'

export function createAttributesRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createAttributesController(createHandler, getDbExecutor)

    // List attributes
    router.get(
        ['/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attributes', '/metahub/:metahubId/catalog/:catalogId/attributes'],
        readLimiter,
        asyncHandler(ctrl.list)
    )

    // Get attribute by ID
    router.get(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId'
        ],
        readLimiter,
        asyncHandler(ctrl.getById)
    )

    // Create attribute
    router.post(
        ['/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attributes', '/metahub/:metahubId/catalog/:catalogId/attributes'],
        writeLimiter,
        asyncHandler(ctrl.create)
    )

    // Copy attribute
    router.post(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/copy',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/copy'
        ],
        writeLimiter,
        asyncHandler(ctrl.copy)
    )

    // Update attribute
    router.patch(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId'
        ],
        writeLimiter,
        asyncHandler(ctrl.update)
    )

    // Move attribute
    router.patch(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/move',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/move'
        ],
        writeLimiter,
        asyncHandler(ctrl.move)
    )

    // Reorder attribute
    router.patch(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attributes/reorder',
            '/metahub/:metahubId/catalog/:catalogId/attributes/reorder'
        ],
        writeLimiter,
        asyncHandler(ctrl.reorder)
    )

    // Toggle required
    router.patch(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/toggle-required',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/toggle-required'
        ],
        writeLimiter,
        asyncHandler(ctrl.toggleRequired)
    )

    // Set display attribute
    router.patch(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/set-display',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/set-display'
        ],
        writeLimiter,
        asyncHandler(ctrl.setDisplay)
    )

    // Clear display attribute
    router.patch(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/clear-display',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/clear-display'
        ],
        writeLimiter,
        asyncHandler(ctrl.clearDisplay)
    )

    // Delete attribute
    router.delete(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId'
        ],
        writeLimiter,
        asyncHandler(ctrl.delete)
    )

    // Attribute codenames (global scope duplicate checking)
    router.get(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute-codenames',
            '/metahub/:metahubId/catalog/:catalogId/attribute-codenames'
        ],
        readLimiter,
        asyncHandler(ctrl.listCodenames)
    )

    // Batch child attributes (for multiple parents)
    router.get(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attributes/children/batch',
            '/metahub/:metahubId/catalog/:catalogId/attributes/children/batch'
        ],
        readLimiter,
        asyncHandler(ctrl.listChildrenBatch)
    )

    // List child attributes
    router.get(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/children',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/children'
        ],
        readLimiter,
        asyncHandler(ctrl.listChildren)
    )

    // Create child attribute
    router.post(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/attribute/:attributeId/children',
            '/metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/children'
        ],
        writeLimiter,
        asyncHandler(ctrl.createChild)
    )

    return router
}

