import { Router, type Request, type Response, type RequestHandler } from 'express'
import { randomUUID } from 'node:crypto'
import type {
    PlayCanvasEditorCompatibilityNoOpResponse,
    PlayCanvasEditorCompatibilityProtocolDescriptor,
    PlayCanvasProjectSummary,
    PlayCanvasScene,
    PlayCanvasEditorScenePayload,
    PlayCanvasEditorCompatibilitySettingsDocument
} from '@universo-react/types'
import { PlayCanvasEditorCompatibilityTokenService } from '../tokens/index.js'
import {
    PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE,
    PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
    playCanvasEditorCompatibilityParamsSchema,
    playCanvasEditorCompatibilitySceneParamsSchema,
    playCanvasEditorCompatibilitySceneSaveRequestSchema,
    playCanvasEditorCompatibilitySceneSummarySchema,
    playCanvasEditorCompatibilityAssetSummarySchema,
    playCanvasEditorCompatibilitySettingsParamsSchema,
    playCanvasEditorCompatibilitySettingsWriteRequestSchema,
    playCanvasEditorCompatibilityCloudSurfaceSchema,
    playCanvasEditorCompatibilityNoOpResponseSchema
} from '@universo-react/types'
import {
    resolvePlatformApiOrigin,
    resolveRequestOrigin,
    normalizeOrigin,
    isAllowedArtifactOrigin,
    isAllowedFullBootArtifactOrigin
} from '../middleware/index.js'
import {
    normalizeArtifactBaseUrl,
    createPlayCanvasEditorFullBootConfig,
    createPlayCanvasEditorCompatibilityConfig,
    getLocalizedName
} from '../config/index.js'
import { validateCompatibilityToken } from '../tokens/index.js'

export const validateParams = <T>(
    schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
    value: unknown
): T | null => {
    const parsed = schema.safeParse(value)
    return parsed.success ? parsed.data : null
}

export const sendInvalid = (res: Response, requestId?: string) =>
    res.status(400).json({
        ok: false,
        requestId,
        code: 'playcanvasEditor.compatibility.invalidRequest'
    })

export const sendUnauthorized = (res: Response, requestId?: string) =>
    res.status(401).json({
        ok: false,
        requestId,
        code: 'playcanvasEditor.compatibility.invalidToken'
    })

export const createCloudOnlyNoOp = (surface: unknown): PlayCanvasEditorCompatibilityNoOpResponse | null => {
    const parsed = playCanvasEditorCompatibilityCloudSurfaceSchema.safeParse(surface)
    if (!parsed.success) return null
    return playCanvasEditorCompatibilityNoOpResponseSchema.parse({
        ok: true,
        surface: parsed.data,
        status: 'stubbed',
        reason: 'cloudOnlySurfaceOutsideFirstSlice'
    })
}

const wrapAsync =
    (handler: RequestHandler): RequestHandler =>
    (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next)
    }

export interface PlayCanvasEditorCompatibilityContext {
    req: Request
    res: Response
    metahubId: string
    userId: string
    [key: string]: unknown
}

export type PlayCanvasEditorCompatibilityHandler = (
    handler: (context: PlayCanvasEditorCompatibilityContext) => Promise<Response | void>,
    options?: { permission?: 'manageMetahub' }
) => RequestHandler

export interface PlayCanvasEditorCompatibilityProjectPort {
    describeProtocol(input: {
        metahubId: string
        projectId: string
        userId: string
    }): Promise<PlayCanvasEditorCompatibilityProtocolDescriptor>
    resolveProject(input: { metahubId: string; projectId: string; userId: string }): Promise<PlayCanvasProjectSummary>
    listScenes(input: {
        metahubId: string
        projectId: string
        userId: string
    }): Promise<
        Array<Pick<PlayCanvasScene, 'id' | 'displayName' | 'codename' | 'checksum' | 'sortOrder' | 'publish'> & { version?: number }>
    >
    readScene(input: {
        metahubId: string
        projectId: string
        sceneId: string
        userId: string
    }): Promise<{ scene: PlayCanvasScene; payload: PlayCanvasEditorScenePayload | null }>
    saveScene(input: {
        metahubId: string
        projectId: string
        sceneId: string
        userId: string
        requestId: string
        payload: PlayCanvasEditorScenePayload
        expectedCurrentChecksum?: string | null
    }): Promise<{ scene: PlayCanvasScene; payload: PlayCanvasEditorScenePayload | null; checksum: string | null }>
    listAssets(input: { metahubId: string; projectId: string; userId: string }): Promise<unknown[]>
    readSettings(input: {
        metahubId: string
        projectId: string
        userId: string
        kind: PlayCanvasEditorCompatibilitySettingsDocument['kind']
    }): Promise<PlayCanvasEditorCompatibilitySettingsDocument>
    writeSettings(input: {
        metahubId: string
        projectId: string
        userId: string
        kind: PlayCanvasEditorCompatibilitySettingsDocument['kind']
        requestId: string
        data: PlayCanvasEditorCompatibilitySettingsDocument['data']
        expectedRevision?: string
    }): Promise<PlayCanvasEditorCompatibilitySettingsDocument>
}

export interface PlayCanvasEditorCompatibilityRouteDeps {
    createHandler: PlayCanvasEditorCompatibilityHandler
    createProjectPort: (context: PlayCanvasEditorCompatibilityContext) => PlayCanvasEditorCompatibilityProjectPort
    tokenService: PlayCanvasEditorCompatibilityTokenService
    readLimiter: RequestHandler
    writeLimiter: RequestHandler
    csrfProtection: RequestHandler
}

export const createPlayCanvasEditorCompatibilityRoutes = (deps: PlayCanvasEditorCompatibilityRouteDeps): Router => {
    const router = Router({ mergeParams: true })

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
                        const assets = await projectPort.listAssets({ metahubId, projectId: params.projectId, userId })
                        const sceneId = project.defaultSceneId || scenes[0]?.id
                        if (!sceneId) return sendInvalid(res)
                        const assetDocumentIds = assets
                            .map((asset) =>
                                asset && typeof asset === 'object' && 'editorDocumentId' in asset
                                    ? (asset as { editorDocumentId?: unknown }).editorDocumentId
                                    : null
                            )
                            .filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)
                        const token = deps.tokenService.create({
                            metahubId,
                            projectId: params.projectId,
                            sceneId,
                            userId,
                            packageSlug: 'playcanvas-editor',
                            mode: PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
                            origin: tokenOrigin,
                            sessionId: randomUUID(),
                            nonce: randomUUID(),
                            assetDocumentIds
                        })
                        res.setHeader('Cache-Control', 'no-store')
                        return res.json({
                            item: createPlayCanvasEditorFullBootConfig({
                                metahubId,
                                projectId: params.projectId,
                                sceneId,
                                userId,
                                projectName: getLocalizedName(project.displayName, 'PlayCanvas Project'),
                                accessToken: token.token,
                                apiOrigin,
                                artifactBaseUrl: artifactBase?.baseUrl ?? artifactOrigin
                            })
                        })
                    }
                    if (req.query.mode !== undefined && req.query.mode !== PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE) {
                        return sendInvalid(res)
                    }
                    const protocol = await projectPort.describeProtocol({ metahubId, projectId: params.projectId, userId })
                    const token = deps.tokenService.create({
                        metahubId,
                        projectId: params.projectId,
                        userId,
                        packageSlug: 'playcanvas-editor',
                        origin: tokenOrigin ?? requestOrigin ?? apiOrigin
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
                            apiOrigin
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
        deps.csrfProtection,
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

    router.get(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/assets',
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
                    const assets = await projectPort.listAssets({ metahubId, projectId: params.projectId, userId })
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json({ items: assets.map((asset) => playCanvasEditorCompatibilityAssetSummarySchema.parse(asset)) })
                },
                { permission: 'manageMetahub' }
            )
        )
    )

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
        deps.csrfProtection,
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

    return router
}
