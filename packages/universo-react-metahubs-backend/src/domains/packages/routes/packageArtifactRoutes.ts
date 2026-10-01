import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '../../../utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createPackagesController } from '../controllers/packagesController'

/** Mount before request-scoped RLS routers because artifact bodies are streamed. */
export function createPackageArtifactRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createPackagesController(createHandler, getDbExecutor)

    router.get(
        '/metahub/:metahubId/packages/:packageSlug/editor-artifact-token/:artifactToken/*',
        readLimiter,
        asyncHandler(ctrl.serveEditorArtifactWithToken)
    )
    router.get(
        '/metahub/:metahubId/packages/:packageSlug/editor-artifact/*',
        ensureAuth,
        readLimiter,
        asyncHandler(ctrl.serveEditorArtifact)
    )

    return router
}
