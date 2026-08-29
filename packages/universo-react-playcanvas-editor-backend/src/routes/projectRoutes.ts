import type { Router, RequestHandler } from 'express'

import {
    PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE,
    PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
    playCanvasEditorCompatibilityParamsSchema,
    playCanvasEditorCompatibilitySceneParamsSchema,
    playCanvasEditorCompatibilitySceneSaveRequestSchema,
    playCanvasEditorCompatibilitySceneSummarySchema
} from '@universo-react/types'
import { generateUuidV7 } from '@universo-react/utils'

import {
    normalizeArtifactBaseUrl,
    createPlayCanvasEditorFullBootConfig,
    createPlayCanvasEditorCompatibilityConfig,
    getLocalizedName
} from '../config/index.js'
import {
    resolvePlatformApiOrigin,
    resolveRequestOrigin,
    normalizeOrigin,
    isAllowedArtifactOrigin,
    isAllowedFullBootArtifactOrigin
} from '../middleware/index.js'
import { parseCanonicalPlayCanvasEditorDocumentId, validateCompatibilityToken, createCompatibilityCsrfToken } from '../tokens/index.js'
import {
    validateParams,
    sendInvalid,
    sendUnauthorized,
    sendUnsupported,
    sendNotFound,
    type PlayCanvasEditorCompatibilityRouteDeps,
    findMatchingSourceFile,
    sourceFileDeleteRequestId,
    wrapAsync
} from './index.js'

export const registerPlayCanvasProjectRoutes = (
    router: Router,
    deps: PlayCanvasEditorCompatibilityRouteDeps,
    editorCompatibilityWriteGuard: RequestHandler
): void => {
    router.get(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/projects/:cloudProjectId/repositories',
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
                    if (!params || req.params.cloudProjectId !== params.projectId) return sendInvalid(res)
                    if (!validateCompatibilityToken(req, deps.tokenService, { metahubId, projectId: params.projectId, userId })) {
                        return sendUnauthorized(res)
                    }
                    await projectPort.resolveProject({ metahubId, projectId: params.projectId, userId })
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json({ current: 'directory', directory: 'directory' })
                },
                { permission: 'manageMetahub' }
            )
        )
    )

    router.get(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/projects/:cloudProjectId/repositories/:repoService/sourcefiles',
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
                    if (!params || req.params.cloudProjectId !== params.projectId || req.params.repoService !== 'directory') {
                        return sendInvalid(res)
                    }
                    if (!validateCompatibilityToken(req, deps.tokenService, { metahubId, projectId: params.projectId, userId })) {
                        return sendUnauthorized(res)
                    }
                    if (!projectPort.listSourceFiles) {
                        return sendUnsupported(res)
                    }
                    const sourceFiles = await projectPort.listSourceFiles({ metahubId, projectId: params.projectId, userId })
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json({
                        result: sourceFiles.map((sourceFile) => ({
                            filename: sourceFile.filename ?? sourceFile.name ?? sourceFile.path.split('/').pop()
                        }))
                    })
                },
                { permission: 'manageMetahub' }
            )
        )
    )

    router.get(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/projects/:cloudProjectId/repositories/:repoService/sourcefiles/*',
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
                    if (!params || req.params.cloudProjectId !== params.projectId || req.params.repoService !== 'directory') {
                        return sendInvalid(res)
                    }
                    const filename = String(req.params[0] ?? '').trim()
                    if (!filename) return sendInvalid(res)
                    if (!validateCompatibilityToken(req, deps.tokenService, { metahubId, projectId: params.projectId, userId })) {
                        return sendUnauthorized(res)
                    }
                    if (!projectPort.listSourceFiles || !projectPort.readSourceFile) {
                        return sendUnsupported(res)
                    }
                    const sourceFiles = await projectPort.listSourceFiles({ metahubId, projectId: params.projectId, userId })
                    const matched = findMatchingSourceFile(sourceFiles, filename)
                    if (!matched) {
                        return sendNotFound(res)
                    }
                    const item = await projectPort.readSourceFile({
                        metahubId,
                        projectId: params.projectId,
                        sourceFileId: matched.id,
                        userId
                    })
                    res.setHeader('Cache-Control', 'no-store')
                    res.type(item.mime ?? 'text/javascript')
                    return res.send(item.content)
                },
                { permission: 'manageMetahub' }
            )
        )
    )

    router.delete(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/projects/:cloudProjectId/repositories/:repoService/sourcefiles/*',
        editorCompatibilityWriteGuard,
        deps.writeLimiter,
        wrapAsync(
            deps.createHandler(
                async (context) => {
                    const { req, res, metahubId, userId } = context
                    const projectPort = deps.createProjectPort(context)
                    const params = validateParams(playCanvasEditorCompatibilityParamsSchema, {
                        metahubId,
                        projectId: req.params.projectId
                    })
                    if (!params || req.params.cloudProjectId !== params.projectId || req.params.repoService !== 'directory') {
                        return sendInvalid(res)
                    }
                    const filename = String(req.params[0] ?? '').trim()
                    if (!filename) return sendInvalid(res)
                    const requestId = sourceFileDeleteRequestId(req)
                    if (!validateCompatibilityToken(req, deps.tokenService, { metahubId, projectId: params.projectId, userId })) {
                        return sendUnauthorized(res, requestId)
                    }
                    if (!projectPort.listSourceFiles || !projectPort.deleteSourceFile) {
                        return sendUnsupported(res, requestId)
                    }
                    const sourceFiles = await projectPort.listSourceFiles({ metahubId, projectId: params.projectId, userId })
                    const matched = findMatchingSourceFile(sourceFiles, filename)
                    if (!matched) {
                        return sendNotFound(res, requestId)
                    }
                    const expectedCurrentChecksum =
                        typeof req.body?.expectedCurrentChecksum === 'string'
                            ? req.body.expectedCurrentChecksum.trim()
                            : typeof req.query.expectedCurrentChecksum === 'string'
                            ? req.query.expectedCurrentChecksum.trim()
                            : ''
                    if (!expectedCurrentChecksum) {
                        return sendInvalid(res, requestId)
                    }
                    const item = await projectPort.deleteSourceFile({
                        metahubId,
                        projectId: params.projectId,
                        sourceFileId: matched.id,
                        userId,
                        requestId,
                        expectedCurrentChecksum
                    })
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json({ ok: true, requestId, item })
                },
                { permission: 'manageMetahub' }
            )
        )
    )

    router.get(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/config',
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
                    const apiOrigin = resolvePlatformApiOrigin(req)
                    const requestOrigin = resolveRequestOrigin(req)
                    const requestedArtifactOrigin = req.query.artifactOrigin
                    const artifactOrigin =
                        requestedArtifactOrigin === undefined ? undefined : normalizeOrigin(requestedArtifactOrigin as unknown)
                    if (
                        requestedArtifactOrigin !== undefined &&
                        (!artifactOrigin || !isAllowedArtifactOrigin(artifactOrigin, requestOrigin, apiOrigin))
                    ) {
                        return sendInvalid(res)
                    }
                    const requestedArtifactBaseUrl = req.query.artifactBaseUrl
                    const artifactBase =
                        requestedArtifactBaseUrl === undefined ? null : normalizeArtifactBaseUrl(requestedArtifactBaseUrl as unknown)
                    if (
                        requestedArtifactBaseUrl !== undefined &&
                        (!artifactBase || !isAllowedArtifactOrigin(artifactBase.origin, requestOrigin, apiOrigin))
                    ) {
                        return sendInvalid(res)
                    }
                    const tokenOrigin = artifactBase?.origin ?? artifactOrigin
                    if (req.query.mode === PLAYCANVAS_EDITOR_FULL_BOOT_MODE) {
                        if (!tokenOrigin || !isAllowedFullBootArtifactOrigin(tokenOrigin, apiOrigin)) {
                            return sendInvalid(res)
                        }
                        const protocol = await projectPort.describeProtocol({ metahubId, projectId: params.projectId, userId })
                        if (
                            protocol.mode !== PLAYCANVAS_EDITOR_FULL_BOOT_MODE ||
                            protocol.endpoints.rest.status !== 'enabled' ||
                            protocol.endpoints.realtime.status !== 'enabled' ||
                            protocol.endpoints.messenger.status !== 'enabled' ||
                            protocol.endpoints.relay.status !== 'enabled' ||
                            protocol.shareDb.persisted !== true
                        ) {
                            return sendInvalid(res)
                        }
                        const project = await projectPort.resolveProject({ metahubId, projectId: params.projectId, userId })
                        const scenes = await projectPort.listScenes({ metahubId, projectId: params.projectId, userId })
                        const sceneId = project.defaultSceneId || scenes[0]?.id
                        if (!sceneId) return sendInvalid(res)
                        const assets = await projectPort.listAssets({ metahubId, projectId: params.projectId, userId, sceneId })
                        const assetDocumentIds = assets
                            .map((asset) => {
                                const rawId =
                                    asset && typeof asset === 'object' && 'editorDocumentId' in asset
                                        ? (asset as { editorDocumentId?: unknown }).editorDocumentId
                                        : null
                                return parseCanonicalPlayCanvasEditorDocumentId(rawId)
                            })
                            .filter((id): id is number => id !== null)
                        if (new Set(assetDocumentIds).size !== assetDocumentIds.length) {
                            return sendInvalid(res)
                        }
                        // Token-refresh discriminator: the artifact re-issues its
                        // five-minute access token against this same endpoint while
                        // carrying its live bridgeSessionId. A refresh must neither
                        // create a new session nor snapshot already-mutated documents
                        // (that would erode the pre-authoring backup set); only a
                        // genuine editor open takes the backup path.
                        const rawBridgeSessionId = req.query.bridgeSessionId
                        if (rawBridgeSessionId !== undefined && typeof rawBridgeSessionId !== 'string') {
                            return sendInvalid(res)
                        }
                        const renewalBridgeSessionId = typeof rawBridgeSessionId === 'string' ? rawBridgeSessionId.trim() : ''
                        if (renewalBridgeSessionId.length > 160) return sendInvalid(res)
                        const sessionId = renewalBridgeSessionId || generateUuidV7()
                        if (renewalBridgeSessionId) {
                            const canReuseBridgeSession = await deps.validateBridgeSession?.({
                                metahubId,
                                projectId: params.projectId,
                                sceneId,
                                userId,
                                sessionId: renewalBridgeSessionId,
                                origin: tokenOrigin
                            })
                            if (canReuseBridgeSession !== true) return sendUnauthorized(res)
                        } else if (projectPort.ensureOpenedProjectBackup) {
                            // Ordering invariant: the derived-document backup gate must commit
                            // strictly before the first authoring write of this editor session.
                            // The full-boot access token is issued only after the backup set is
                            // durably committed; a backup failure fails config issuance closed,
                            // so no ShareDB or compatibility write can start from an unbacked
                            // state (upstream editor migrations persist through the realtime port).
                            await projectPort.ensureOpenedProjectBackup({
                                metahubId,
                                projectId: params.projectId,
                                userId,
                                sceneId,
                                sessionId,
                                assetDocumentIds
                            })
                        }
                        const token = deps.tokenService.create({
                            metahubId,
                            projectId: params.projectId,
                            sceneId,
                            userId,
                            packageSlug: 'playcanvas-editor',
                            mode: PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
                            origin: tokenOrigin,
                            sessionId,
                            nonce: generateUuidV7(),
                            assetDocumentIds
                        })
                        const compatibilityCsrfToken = createCompatibilityCsrfToken({
                            metahubId,
                            projectId: params.projectId,
                            userId,
                            accessToken: token.token,
                            origin: tokenOrigin
                        })
                        res.setHeader('Cache-Control', 'no-store')
                        // Sliding session-bound artifact token renewal: the
                        // platform issuer mints a fresh token bound to the same
                        // bridge session/origin, or returns null (absolute cap
                        // exceeded, dead session, or same/opaque origin) so the
                        // response simply carries no artifactToken and the
                        // client falls back to its reload flow.
                        const renewalArtifactToken = deps.issueRenewalArtifactToken
                            ? await deps.issueRenewalArtifactToken({ req, metahubId, userId, tokenOrigin })
                            : null
                        return res.json({
                            item: createPlayCanvasEditorFullBootConfig({
                                metahubId,
                                projectId: params.projectId,
                                sceneId,
                                userId,
                                projectName: getLocalizedName(project.displayName, 'PlayCanvas Project'),
                                accessToken: token.token,
                                apiOrigin,
                                artifactBaseUrl: artifactBase?.baseUrl ?? artifactOrigin,
                                csrfToken: compatibilityCsrfToken
                            }),
                            ...(renewalArtifactToken ? { artifactToken: renewalArtifactToken } : {})
                        })
                    }
                    if (req.query.mode !== undefined && req.query.mode !== PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE) {
                        return sendInvalid(res)
                    }
                    const compatibilityTokenOrigin = tokenOrigin ?? requestOrigin ?? apiOrigin
                    if (!compatibilityTokenOrigin) return sendInvalid(res)
                    const protocol = await projectPort.describeProtocol({ metahubId, projectId: params.projectId, userId })
                    const token = deps.tokenService.create({
                        metahubId,
                        projectId: params.projectId,
                        userId,
                        packageSlug: 'playcanvas-editor',
                        origin: compatibilityTokenOrigin
                    })
                    const compatibilityCsrfToken = createCompatibilityCsrfToken({
                        metahubId,
                        projectId: params.projectId,
                        userId,
                        accessToken: token.token,
                        origin: compatibilityTokenOrigin
                    })
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json({
                        item: createPlayCanvasEditorCompatibilityConfig({
                            metahubId,
                            projectId: params.projectId,
                            userId,
                            protocol,
                            accessToken: token.token,
                            tokenExpiresAt: token.claims.expiresAt,
                            apiOrigin,
                            csrfToken: compatibilityCsrfToken
                        })
                    })
                },
                { permission: 'manageMetahub' }
            )
        )
    )

    router.get(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/scenes',
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
                    if (!validateCompatibilityToken(req, deps.tokenService, { metahubId, projectId: params.projectId, userId })) {
                        return sendUnauthorized(res)
                    }
                    const scenes = await projectPort.listScenes({ metahubId, projectId: params.projectId, userId })
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json({
                        items: scenes.map((scene) =>
                            playCanvasEditorCompatibilitySceneSummarySchema.parse({
                                ...scene,
                                checksum: scene.checksum ?? null
                            })
                        )
                    })
                },
                { permission: 'manageMetahub' }
            )
        )
    )

    router.get(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/scenes/:sceneId',
        deps.readLimiter,
        wrapAsync(
            deps.createHandler(
                async (context) => {
                    const { req, res, metahubId, userId } = context
                    const projectPort = deps.createProjectPort(context)
                    const params = validateParams(playCanvasEditorCompatibilitySceneParamsSchema, { ...req.params, metahubId })
                    if (!params) return sendInvalid(res)
                    if (!validateCompatibilityToken(req, deps.tokenService, { metahubId, projectId: params.projectId, userId })) {
                        return sendUnauthorized(res)
                    }
                    const item = await projectPort.readScene({ metahubId, projectId: params.projectId, sceneId: params.sceneId, userId })
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json({ item })
                },
                { permission: 'manageMetahub' }
            )
        )
    )

    router.put(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/scenes/:sceneId',
        editorCompatibilityWriteGuard,
        deps.writeLimiter,
        wrapAsync(
            deps.createHandler(
                async (context) => {
                    const { req, res, metahubId, userId } = context
                    const projectPort = deps.createProjectPort(context)
                    const params = validateParams(playCanvasEditorCompatibilitySceneParamsSchema, { ...req.params, metahubId })
                    const body = playCanvasEditorCompatibilitySceneSaveRequestSchema.safeParse(req.body)
                    if (!params || !body.success)
                        return sendInvalid(res, body.success ? undefined : (req.body as { requestId?: string })?.requestId)
                    if (!validateCompatibilityToken(req, deps.tokenService, { metahubId, projectId: params.projectId, userId })) {
                        return sendUnauthorized(res, body.data.requestId)
                    }
                    const item = await projectPort.saveScene({
                        metahubId,
                        projectId: params.projectId,
                        sceneId: params.sceneId,
                        userId,
                        requestId: body.data.requestId,
                        payload: body.data.payload,
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
