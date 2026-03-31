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
 * Hierarchy: Metahub → Hub → Catalog → Attributes/Elements
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
    router.get('/:slug/hubs', readLimiter, asyncHandler(ctrl.listHubs))
    router.get('/:slug/hub/:hubCodename', readLimiter, asyncHandler(ctrl.getHub))
    router.get('/:slug/hub/:hubCodename/catalogs', readLimiter, asyncHandler(ctrl.listCatalogs))
    router.get('/:slug/hub/:hubCodename/catalog/:catalogCodename', readLimiter, asyncHandler(ctrl.getCatalog))
    router.get('/:slug/hub/:hubCodename/catalog/:catalogCodename/attributes', readLimiter, asyncHandler(ctrl.listAttributes))
    router.get('/:slug/hub/:hubCodename/catalog/:catalogCodename/elements', readLimiter, asyncHandler(ctrl.listElements))
    router.get('/:slug/hub/:hubCodename/catalog/:catalogCodename/element/:elementId', readLimiter, asyncHandler(ctrl.getElement))

    return router
}
