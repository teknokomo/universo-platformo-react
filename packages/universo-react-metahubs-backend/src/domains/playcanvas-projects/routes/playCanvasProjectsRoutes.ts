import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '../../../utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createPlayCanvasProjectsController } from '../controllers/playCanvasProjectsController'

export function createPlayCanvasProjectsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createPlayCanvasProjectsController(createHandler)

    router.get('/metahub/:metahubId/playcanvas/projects', readLimiter, asyncHandler(ctrl.list))
    router.post('/metahub/:metahubId/playcanvas/projects', writeLimiter, asyncHandler(ctrl.create))
    router.get('/metahub/:metahubId/playcanvas/projects/:projectId', readLimiter, asyncHandler(ctrl.getById))
    router.patch('/metahub/:metahubId/playcanvas/projects/:projectId', writeLimiter, asyncHandler(ctrl.update))
    router.delete('/metahub/:metahubId/playcanvas/projects/:projectId', writeLimiter, asyncHandler(ctrl.remove))
    router.get('/metahub/:metahubId/playcanvas/projects/:projectId/scenes', readLimiter, asyncHandler(ctrl.listScenes))
    router.get('/metahub/:metahubId/playcanvas/projects/:projectId/scenes/:sceneId', readLimiter, asyncHandler(ctrl.getScene))
    router.put('/metahub/:metahubId/playcanvas/projects/:projectId/scenes/:sceneId', writeLimiter, asyncHandler(ctrl.writeScene))
    router.get('/metahub/:metahubId/playcanvas/projects/:projectId/assets', readLimiter, asyncHandler(ctrl.listAssets))
    router.get('/metahub/:metahubId/playcanvas/projects/:projectId/assets/:assetId', readLimiter, asyncHandler(ctrl.getAsset))
    router.put('/metahub/:metahubId/playcanvas/projects/:projectId/assets/:assetId', writeLimiter, asyncHandler(ctrl.writeAsset))
    router.get('/metahub/:metahubId/playcanvas/projects/:projectId/assets/:assetId/file', readLimiter, asyncHandler(ctrl.readFile))
    router.put('/metahub/:metahubId/playcanvas/projects/:projectId/assets/:assetId/file', writeLimiter, asyncHandler(ctrl.writeFile))
    router.delete('/metahub/:metahubId/playcanvas/projects/:projectId/assets/:assetId/file', writeLimiter, asyncHandler(ctrl.deleteFile))
    router.put(
        '/metahub/:metahubId/playcanvas/projects/:projectId/script-assets/:scriptAssetId',
        writeLimiter,
        asyncHandler(ctrl.writeScriptAsset)
    )
    router.put(
        '/metahub/:metahubId/playcanvas/projects/:projectId/script-bindings/:bindingId',
        writeLimiter,
        asyncHandler(ctrl.writeBinding)
    )
    router.put(
        '/metahub/:metahubId/playcanvas/projects/:projectId/generated-artifacts/:artifactId',
        writeLimiter,
        asyncHandler(ctrl.writeGeneratedArtifact)
    )
    router.post('/metahub/:metahubId/playcanvas/projects/:projectId/publish', writeLimiter, asyncHandler(ctrl.publishProjectState))
    router.get('/metahub/:metahubId/playcanvas/projects/:projectId/export', readLimiter, asyncHandler(ctrl.exportProjectState))
    router.get('/metahub/:metahubId/playcanvas/projects/:projectId/files', readLimiter, asyncHandler(ctrl.readFile))
    router.put('/metahub/:metahubId/playcanvas/projects/:projectId/files', writeLimiter, asyncHandler(ctrl.writeFile))
    router.delete('/metahub/:metahubId/playcanvas/projects/:projectId/files', writeLimiter, asyncHandler(ctrl.deleteFile))

    return router
}
