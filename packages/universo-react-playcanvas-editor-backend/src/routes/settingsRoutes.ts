import type { Router, RequestHandler } from 'express'

import {
    playCanvasEditorCompatibilityParamsSchema,
    playCanvasEditorCompatibilitySettingsParamsSchema,
    playCanvasEditorCompatibilitySettingsWriteRequestSchema
} from '@universo-react/types'

import { validateCompatibilityToken } from '../tokens/index.js'
import {
    createCloudOnlyNoOp,
    validateParams,
    sendInvalid,
    sendUnauthorized,
    type PlayCanvasEditorCompatibilityRouteDeps,
    wrapAsync
} from './index.js'

export const registerPlayCanvasSettingsRoutes = (
    router: Router,
    deps: PlayCanvasEditorCompatibilityRouteDeps,
    editorCompatibilityWriteGuard: RequestHandler
): void => {
    router.get(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/settings/:kind',
        deps.readLimiter,
        wrapAsync(
            deps.createHandler(
                async (context) => {
                    const { req, res, metahubId, userId } = context
                    const projectPort = deps.createProjectPort(context)
                    const params = validateParams(playCanvasEditorCompatibilitySettingsParamsSchema, { ...req.params, metahubId })
                    if (!params) return sendInvalid(res)
                    if (!validateCompatibilityToken(req, deps.tokenService, { metahubId, projectId: params.projectId, userId })) {
                        return sendUnauthorized(res)
                    }
                    const item = await projectPort.readSettings({ metahubId, projectId: params.projectId, userId, kind: params.kind })
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json({ item })
                },
                { permission: 'manageMetahub' }
            )
        )
    )

    router.put(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/settings/:kind',
        editorCompatibilityWriteGuard,
        deps.writeLimiter,
        wrapAsync(
            deps.createHandler(
                async (context) => {
                    const { req, res, metahubId, userId } = context
                    const projectPort = deps.createProjectPort(context)
                    const params = validateParams(playCanvasEditorCompatibilitySettingsParamsSchema, { ...req.params, metahubId })
                    const body = playCanvasEditorCompatibilitySettingsWriteRequestSchema.safeParse(req.body)
                    if (!params || !body.success)
                        return sendInvalid(res, body.success ? undefined : (req.body as { requestId?: string })?.requestId)
                    if (!validateCompatibilityToken(req, deps.tokenService, { metahubId, projectId: params.projectId, userId })) {
                        return sendUnauthorized(res, body.data.requestId)
                    }
                    const item = await projectPort.writeSettings({
                        metahubId,
                        projectId: params.projectId,
                        userId,
                        kind: params.kind,
                        requestId: body.data.requestId,
                        data: body.data.data,
                        expectedRevision: body.data.expectedRevision
                    })
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json({ ok: true, requestId: body.data.requestId, item })
                },
                { permission: 'manageMetahub' }
            )
        )
    )

    router.get(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/cloud-only/:surface',
        deps.readLimiter,
        wrapAsync(
            deps.createHandler(
                async (context) => {
                    const { req, res, metahubId, userId } = context
                    const projectPort = deps.createProjectPort(context)
                    const params = validateParams(playCanvasEditorCompatibilityParamsSchema, {
                        metahubId,
                        projectId: req.params.projectId
                    })
                    if (!params) return sendInvalid(res)
                    const noOp = createCloudOnlyNoOp(req.params.surface)
                    if (!noOp) return sendInvalid(res)
                    if (!validateCompatibilityToken(req, deps.tokenService, { metahubId, projectId: params.projectId, userId })) {
                        return sendUnauthorized(res)
                    }
                    await projectPort.resolveProject({ metahubId, projectId: params.projectId, userId })
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json(noOp)
                },
                { permission: 'manageMetahub' }
            )
        )
    )
}
