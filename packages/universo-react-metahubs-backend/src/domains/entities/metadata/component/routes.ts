import { Router, type Request, type Response, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { getRequestDbContext, type DbExecutor } from '@universo-react/utils'
import { uuidToLockKey } from '../../../ddl'
import { asyncHandler } from '../../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../../shared/createMetahubHandler'
import { createComponentsController } from './controller'

const componentMetadataMutationLockError = {
    error: 'Component metadata is being changed by another request. Retry shortly.',
    code: 'COMPONENT_METADATA_LOCKED'
}

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

    const componentMetadataMutationLock: RequestHandler = async (req, res, next) => {
        const { metahubId, objectCollectionId } = req.params
        if (!metahubId || !objectCollectionId) return next()
        if (res.destroyed || res.writableEnded) return

        const lockKey = uuidToLockKey(`component-metadata-sibling-reference:${metahubId}:${objectCollectionId}`)
        const requestDbContext = getRequestDbContext(req)
        if (!requestDbContext || requestDbContext.isReleased()) {
            return next(new Error('Request-scoped database transaction is required for component metadata writes'))
        }

        try {
            const [lock] = await requestDbContext.executor.query<{ acquired: boolean }>(
                'SELECT pg_try_advisory_xact_lock($1::bigint) AS acquired',
                [lockKey]
            )
            if (!lock?.acquired) return res.status(409).json(componentMetadataMutationLockError)
            next()
        } catch (error) {
            next(error)
        }
    }

    const writeHandlers = (handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler[] => [
        writeLimiter,
        componentMetadataMutationLock,
        asyncHandler(handler)
    ]

    const objectCollectionPaths = (suffix: string) => [
        `/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:objectCollectionId/${suffix}`,
        `/metahub/:metahubId/entities/:kindKey/instance/:objectCollectionId/${suffix}`
    ]

    // List components
    router.get(objectCollectionPaths('components'), readLimiter, asyncHandler(ctrl.list))

    // Get component by ID
    router.get(objectCollectionPaths('component/:componentId'), readLimiter, asyncHandler(ctrl.getById))

    // Create component
    router.post(objectCollectionPaths('components'), ...writeHandlers(ctrl.create))

    // Copy component
    router.post(objectCollectionPaths('component/:componentId/copy'), ...writeHandlers(ctrl.copy))

    // Update component
    router.patch(objectCollectionPaths('component/:componentId'), ...writeHandlers(ctrl.update))

    // Move component
    router.patch(objectCollectionPaths('component/:componentId/move'), ...writeHandlers(ctrl.move))

    // Reorder components
    router.patch(objectCollectionPaths('components/reorder'), ...writeHandlers(ctrl.reorder))

    // Toggle required
    router.patch(objectCollectionPaths('component/:componentId/toggle-required'), ...writeHandlers(ctrl.toggleRequired))

    // Set display field
    router.patch(objectCollectionPaths('component/:componentId/set-display'), ...writeHandlers(ctrl.setDisplay))

    // Clear display field
    router.patch(objectCollectionPaths('component/:componentId/clear-display'), ...writeHandlers(ctrl.clearDisplay))

    // Delete component
    router.delete(objectCollectionPaths('component/:componentId'), ...writeHandlers(ctrl.delete))

    // Component codenames (global scope duplicate checking)
    router.get(objectCollectionPaths('component-codenames'), readLimiter, asyncHandler(ctrl.listCodenames))

    // Batch child components (for multiple parents)
    router.get(objectCollectionPaths('components/children/batch'), readLimiter, asyncHandler(ctrl.listChildrenBatch))

    // List child components
    router.get(objectCollectionPaths('component/:componentId/children'), readLimiter, asyncHandler(ctrl.listChildren))

    // Create child component
    router.post(objectCollectionPaths('component/:componentId/children'), ...writeHandlers(ctrl.createChild))

    return router
}
