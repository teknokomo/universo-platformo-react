import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '../../../utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createPackagesController } from '../controllers/packagesController'

export function createPackagesRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createPackagesController(createHandler, getDbExecutor)

    router.get(
        '/metahub/:metahubId/packages/:packageSlug/editor-artifact-token/:artifactToken/*',
        readLimiter,
        asyncHandler(ctrl.serveEditorArtifactWithToken)
    )

    router.use(ensureAuth)

    router.get('/metahub/:metahubId/packages/catalog', readLimiter, asyncHandler(ctrl.listCatalog))
    router.get('/metahub/:metahubId/packages', readLimiter, asyncHandler(ctrl.listAttached))
    router.get('/metahub/:metahubId/packages/:packageSlug/authoring-host', readLimiter, asyncHandler(ctrl.getAuthoringHost))
    router.get('/metahub/:metahubId/packages/:packageSlug/editor-artifact/*', readLimiter, asyncHandler(ctrl.serveEditorArtifact))
    router.post('/metahub/:metahubId/packages', writeLimiter, asyncHandler(ctrl.attach))
    router.patch('/metahub/:metahubId/package/:attachmentId', writeLimiter, asyncHandler(ctrl.changeVersion))
    router.patch('/metahub/:metahubId/package/:attachmentId/config', writeLimiter, asyncHandler(ctrl.updateConfig))
    router.delete('/metahub/:metahubId/package/:attachmentId', writeLimiter, asyncHandler(ctrl.detach))

    return router
}
