import type { Router, RequestHandler } from 'express'

import {
    playCanvasEditorCompatibilityParamsSchema,
    playCanvasEditorCompatibilitySourceFileDeleteRequestSchema,
    playCanvasEditorCompatibilitySourceFileDocumentSchema,
    playCanvasEditorCompatibilitySourceFileParamsSchema,
    playCanvasEditorCompatibilitySourceFileSummarySchema,
    playCanvasEditorCompatibilitySourceFileWriteRequestSchema
} from '@universo-react/types'

import { validateCompatibilityToken } from '../tokens/index.js'
import {
    validateParams,
    sendInvalid,
    sendUnauthorized,
    sendUnsupported,
    type PlayCanvasEditorCompatibilityRouteDeps,
    wrapAsync
} from './index.js'

export const registerPlayCanvasSourceFileRoutes = (
    router: Router,
    deps: PlayCanvasEditorCompatibilityRouteDeps,
    editorCompatibilityWriteGuard: RequestHandler
): void => {
    router.get(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/sourcefiles',
        deps.readLimiter,
        wrapAsync(
            deps.createHandler(
                async (context) => {
                    const { req, res, metahubId, userId } = context
                    const projectPort = deps.createProjectPort(context)
                    const params = validateParams(playCanvasEditorCompatibilityParamsSchema, { ...req.params, metahubId })
                    if (!params) return sendInvalid(res)
                    if (!validateCompatibilityToken(req, deps.tokenService, { metahubId, projectId: params.projectId, userId })) {
                        return sendUnauthorized(res)
                    }
                    if (!projectPort.listSourceFiles) {
                        return sendUnsupported(res)
                    }
                    const sourceFiles = await projectPort.listSourceFiles({ metahubId, projectId: params.projectId, userId })
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json({
                        items: sourceFiles.map((sourceFile) => playCanvasEditorCompatibilitySourceFileSummarySchema.parse(sourceFile))
                    })
                },
                { permission: 'manageMetahub' }
            )
        )
    )

    router.get(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/sourcefiles/:sourceFileId',
        deps.readLimiter,
        wrapAsync(
            deps.createHandler(
                async (context) => {
                    const { req, res, metahubId, userId } = context
                    const projectPort = deps.createProjectPort(context)
                    const params = validateParams(playCanvasEditorCompatibilitySourceFileParamsSchema, { ...req.params, metahubId })
                    if (!params) return sendInvalid(res)
                    if (!validateCompatibilityToken(req, deps.tokenService, { metahubId, projectId: params.projectId, userId })) {
                        return sendUnauthorized(res)
                    }
                    if (!projectPort.readSourceFile) {
                        return sendUnsupported(res)
                    }
                    const item = await projectPort.readSourceFile({
                        metahubId,
                        projectId: params.projectId,
                        sourceFileId: params.sourceFileId,
                        userId
                    })
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json({ item: playCanvasEditorCompatibilitySourceFileDocumentSchema.parse(item) })
                },
                { permission: 'manageMetahub' }
            )
        )
    )

    router.put(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/sourcefiles/:sourceFileId',
        editorCompatibilityWriteGuard,
        deps.writeLimiter,
        wrapAsync(
            deps.createHandler(
                async (context) => {
                    const { req, res, metahubId, userId } = context
                    const projectPort = deps.createProjectPort(context)
                    const params = validateParams(playCanvasEditorCompatibilitySourceFileParamsSchema, { ...req.params, metahubId })
                    const body = playCanvasEditorCompatibilitySourceFileWriteRequestSchema.safeParse(req.body)
                    if (!params || !body.success)
                        return sendInvalid(res, body.success ? undefined : (req.body as { requestId?: string })?.requestId)
                    if (!validateCompatibilityToken(req, deps.tokenService, { metahubId, projectId: params.projectId, userId })) {
                        return sendUnauthorized(res, body.data.requestId)
                    }
                    if (!projectPort.writeSourceFile) {
                        return sendUnsupported(res, body.data.requestId)
                    }
                    const item = await projectPort.writeSourceFile({
                        metahubId,
                        projectId: params.projectId,
                        sourceFileId: params.sourceFileId,
                        userId,
                        requestId: body.data.requestId,
                        path: body.data.path,
                        name: body.data.name,
                        content: body.data.content,
                        expectedCurrentChecksum: body.data.expectedCurrentChecksum
                    })
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json({
                        ok: true,
                        requestId: body.data.requestId,
                        item: playCanvasEditorCompatibilitySourceFileDocumentSchema.parse(item)
                    })
                },
                { permission: 'manageMetahub' }
            )
        )
    )

    router.delete(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/sourcefiles/:sourceFileId',
        editorCompatibilityWriteGuard,
        deps.writeLimiter,
        wrapAsync(
            deps.createHandler(
                async (context) => {
                    const { req, res, metahubId, userId } = context
                    const projectPort = deps.createProjectPort(context)
                    const params = validateParams(playCanvasEditorCompatibilitySourceFileParamsSchema, { ...req.params, metahubId })
                    const body = playCanvasEditorCompatibilitySourceFileDeleteRequestSchema.safeParse(req.body)
                    if (!params || !body.success)
                        return sendInvalid(res, body.success ? undefined : (req.body as { requestId?: string })?.requestId)
                    if (!validateCompatibilityToken(req, deps.tokenService, { metahubId, projectId: params.projectId, userId })) {
                        return sendUnauthorized(res, body.data.requestId)
                    }
                    if (!projectPort.deleteSourceFile) {
                        return sendUnsupported(res, body.data.requestId)
                    }
                    const item = await projectPort.deleteSourceFile({
                        metahubId,
                        projectId: params.projectId,
                        sourceFileId: params.sourceFileId,
                        userId,
                        requestId: body.data.requestId,
                        expectedCurrentChecksum: body.data.expectedCurrentChecksum
                    })
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json({ ok: true, requestId: body.data.requestId, item })
                },
                { permission: 'manageMetahub' }
            )
        )
    )
}
