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
 * Hierarchy: Metahub → Tree Entity → Linked Collection → Field Definitions/Records
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
    router.get('/:slug/tree-entity/:treeEntityCodename/linked-collections', readLimiter, asyncHandler(ctrl.listLinkedCollections))
    router.get(
        '/:slug/tree-entity/:treeEntityCodename/linked-collection/:linkedCollectionCodename',
        readLimiter,
        asyncHandler(ctrl.getLinkedCollection)
    )
    router.get(
        '/:slug/tree-entity/:treeEntityCodename/linked-collection/:linkedCollectionCodename/field-definitions',
        readLimiter,
        asyncHandler(ctrl.listFieldDefinitions)
    )
    router.get(
        '/:slug/tree-entity/:treeEntityCodename/linked-collection/:linkedCollectionCodename/records',
        readLimiter,
        asyncHandler(ctrl.listRecords)
    )
    router.get(
        '/:slug/tree-entity/:treeEntityCodename/linked-collection/:linkedCollectionCodename/record/:recordId',
        readLimiter,
        asyncHandler(ctrl.getRecord)
    )

    return router
}
