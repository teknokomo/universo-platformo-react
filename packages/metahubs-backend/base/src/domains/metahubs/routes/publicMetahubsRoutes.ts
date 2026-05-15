import { Router, type RequestHandler } from 'express'
import type { Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '../../../utils'
import { createPublicMetahubsController } from '../controllers/publicMetahubsController'

/**
 * Public API routes for accessing published Metahubs
 *
 * These routes do NOT require authentication.
 * Only metahubs with isPublic=true are accessible.
 * All operations are read-only.
 *
 * Hierarchy: Metahub → Hub → Object → Components/Records
 */
export function createPublicMetahubsRoutes(getDbExecutor: () => DbExecutor, readLimiter: RateLimitRequestHandler): Router {
    const router = Router({ mergeParams: true })
    const ctrl = createPublicMetahubsController(getDbExecutor)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    router.get('/:slug', readLimiter, asyncHandler(ctrl.getBySlug))
    router.get('/:slug/tree-entities', readLimiter, asyncHandler(ctrl.listTreeEntities))
    router.get('/:slug/tree-entity/:treeEntityCodename', readLimiter, asyncHandler(ctrl.getTreeEntity))
    router.get('/:slug/tree-entity/:treeEntityCodename/objects', readLimiter, asyncHandler(ctrl.listObjectCollections))
    router.get(
        '/:slug/tree-entity/:treeEntityCodename/object/:objectCollectionCodename',
        readLimiter,
        asyncHandler(ctrl.getObjectCollection)
    )
    router.get(
        '/:slug/tree-entity/:treeEntityCodename/object/:objectCollectionCodename/components',
        readLimiter,
        asyncHandler(ctrl.listComponents)
    )
    router.get(
        '/:slug/tree-entity/:treeEntityCodename/object/:objectCollectionCodename/records',
        readLimiter,
        asyncHandler(ctrl.listRecords)
    )
    router.get(
        '/:slug/tree-entity/:treeEntityCodename/object/:objectCollectionCodename/record/:recordId',
        readLimiter,
        asyncHandler(ctrl.getRecord)
    )

    return router
}
