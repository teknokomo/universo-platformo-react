import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import {
    createPlayCanvasEditorCompatibilityRoutes,
    resolveCompatibilityToken,
    resolvePlatformApiOrigin,
    resolveRequestOrigin,
    validateCompatibilityToken,
    validateFullBootClaims
} from '@universo-react/playcanvas-editor-backend'
import type { PlayCanvasEditorCompatibilityContext } from '@universo-react/playcanvas-editor-backend'
import type { DbExecutor } from '../../../utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import type { MetahubHandlerContext } from '../../shared/createMetahubHandler'
import type { RequestWithAuthUser } from '../../shared/routeAuth'
import { createPlayCanvasProjectsController } from '../controllers/playCanvasProjectsController'
import { PlayCanvasProjectsService } from '../services/PlayCanvasProjectsService'
import { playCanvasEditorCompatibilityTokenService } from '../services/playCanvasEditorCompatibilityTokenService'

export function createPlayCanvasProjectsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler,
    csrfProtection: RequestHandler
): Router {
    const router = Router({ mergeParams: true })

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createPlayCanvasProjectsController(createHandler)
    const resolveEditorCompatibilityTokenUserId = (req: Request): string | null => {
        const token = resolveCompatibilityToken(req)
        const claims = token ? playCanvasEditorCompatibilityTokenService.read(token) : null
        const { metahubId, projectId } = req.params
        if (!claims || typeof metahubId !== 'string' || typeof projectId !== 'string') return null

        const compatibilityClaims = validateCompatibilityToken(req, playCanvasEditorCompatibilityTokenService, {
            metahubId,
            projectId,
            userId: claims.userId
        })
        if (compatibilityClaims) return compatibilityClaims.userId

        const fullBootClaims = validateFullBootClaims(playCanvasEditorCompatibilityTokenService, token ?? '', {
            metahubId,
            projectId,
            origin: resolveRequestOrigin(req) ?? resolvePlatformApiOrigin(req)
        })
        return fullBootClaims?.userId ?? null
    }
    const isEditorCompatibilityConfigRequest = (req: Request): boolean =>
        req.method === 'GET' && /\/playcanvas\/editor-compatible\/projects\/[^/]+\/config\/?$/.test(req.path)
    const createEditorCompatibilityHandler = (
        handler: (ctx: MetahubHandlerContext & PlayCanvasEditorCompatibilityContext) => Promise<Response | void>,
        options?: Parameters<typeof createHandler>[1]
    ): RequestHandler => {
        const metahubHandler = createHandler(
            async (ctx) => handler(ctx as MetahubHandlerContext & PlayCanvasEditorCompatibilityContext),
            options
        )
        return (req: Request, res: Response, next: NextFunction) => {
            const tokenUserId = isEditorCompatibilityConfigRequest(req) ? null : resolveEditorCompatibilityTokenUserId(req)
            if (tokenUserId) {
                ;(req as RequestWithAuthUser).user = { id: tokenUserId }
                void metahubHandler(req, res).catch(next)
                return
            }
            try {
                ensureAuth(req, res, (error?: unknown) => {
                    if (error) {
                        next(error)
                        return
                    }
                    void metahubHandler(req, res).catch(next)
                })
            } catch (error) {
                next(error)
            }
        }
    }
    const compatibilityRoutes = createPlayCanvasEditorCompatibilityRoutes({
        readLimiter,
        writeLimiter,
        csrfProtection,
        tokenService: playCanvasEditorCompatibilityTokenService,
        createHandler: createEditorCompatibilityHandler,
        createProjectPort: (ctx) => {
            const requestContext = ctx as unknown as MetahubHandlerContext
            const service = new PlayCanvasProjectsService(requestContext.exec, requestContext.schemaService)
            return {
                describeProtocol: ({ metahubId, projectId, userId }) =>
                    service.describeEditorCompatibilityProtocol(metahubId, projectId, userId),
                resolveProject: ({ metahubId, projectId, userId }) => service.getProject(metahubId, projectId, userId),
                listScenes: ({ metahubId, projectId, userId }) => service.listScenes(metahubId, projectId, userId),
                readScene: ({ metahubId, projectId, sceneId, userId }) => service.readEditorScene(metahubId, projectId, sceneId, userId),
                saveScene: ({ metahubId, projectId, sceneId, userId, requestId, payload, expectedCurrentChecksum }) =>
                    service.saveEditorCompatibilityScene(
                        metahubId,
                        projectId,
                        sceneId,
                        { requestId, payload, expectedCurrentChecksum },
                        userId
                    ),
                listAssets: ({ metahubId, projectId, userId, sceneId }) =>
                    service.listEditorCompatibilityAssetSummaries(metahubId, projectId, userId, { sceneId }),
                listSourceFiles: ({ metahubId, projectId, userId }) =>
                    service.listEditorCompatibilitySourceFiles(metahubId, projectId, userId),
                readSourceFile: ({ metahubId, projectId, sourceFileId, userId }) =>
                    service.readEditorCompatibilitySourceFile(metahubId, projectId, sourceFileId, userId),
                writeSourceFile: ({
                    metahubId,
                    projectId,
                    sourceFileId,
                    userId,
                    requestId,
                    path,
                    name,
                    content,
                    expectedCurrentChecksum
                }) =>
                    service.writeEditorCompatibilitySourceFile(
                        metahubId,
                        projectId,
                        sourceFileId,
                        { requestId, path, name, content, expectedCurrentChecksum },
                        userId
                    ),
                deleteSourceFile: ({ metahubId, projectId, sourceFileId, userId, requestId, expectedCurrentChecksum }) =>
                    service.deleteEditorCompatibilitySourceFile(
                        metahubId,
                        projectId,
                        sourceFileId,
                        { requestId, expectedCurrentChecksum },
                        userId
                    ),
                readSettings: ({ metahubId, projectId, userId, kind }) =>
                    service.readEditorCompatibilitySettings(metahubId, projectId, kind, userId),
                writeSettings: ({ metahubId, projectId, userId, kind, requestId, data, expectedRevision }) =>
                    service.writeEditorCompatibilitySettings(metahubId, projectId, kind, { data, expectedRevision, requestId }, userId)
            }
        }
    })

    router.use('/', compatibilityRoutes)
    router.use('/metahub/:metahubId/playcanvas', ensureAuth)
    router.post('/metahub/:metahubId/playcanvas/editor-bridge/commands', writeLimiter, asyncHandler(ctrl.editorBridgeCommand))
    router.get(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/protocol',
        readLimiter,
        asyncHandler(ctrl.editorCompatibleProtocol)
    )
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
    router.get('/metahub/:metahubId/playcanvas/published-runtime-manifests', readLimiter, asyncHandler(ctrl.listPublishedRuntimeManifests))
    router.get('/metahub/:metahubId/playcanvas/projects/:projectId/export', readLimiter, asyncHandler(ctrl.exportProjectState))
    router.get('/metahub/:metahubId/playcanvas/projects/:projectId/files', readLimiter, asyncHandler(ctrl.readFile))
    router.put('/metahub/:metahubId/playcanvas/projects/:projectId/files', writeLimiter, asyncHandler(ctrl.writeFile))
    router.delete('/metahub/:metahubId/playcanvas/projects/:projectId/files', writeLimiter, asyncHandler(ctrl.deleteFile))

    return router
}
