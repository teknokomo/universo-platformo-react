import { Router, type Request, type Response, type RequestHandler } from 'express'
import { randomUUID } from 'node:crypto'
import type {
    PlayCanvasEditorCompatibilityNoOpResponse,
    PlayCanvasEditorCompatibilityProtocolDescriptor,
    PlayCanvasProjectSummary,
    PlayCanvasScene,
    PlayCanvasEditorScenePayload,
    PlayCanvasEditorCompatibilitySettingsDocument,
    PlayCanvasEditorCompatibilitySourceFileDocument,
    PlayCanvasEditorCompatibilitySourceFileSummary
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
    playCanvasEditorCompatibilitySourceFileDeleteRequestSchema,
    playCanvasEditorCompatibilitySourceFileDocumentSchema,
    playCanvasEditorCompatibilitySourceFileParamsSchema,
    playCanvasEditorCompatibilitySourceFileSummarySchema,
    playCanvasEditorCompatibilitySourceFileWriteRequestSchema,
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
import { resolveCompatibilityToken, validateCompatibilityToken, validateFullBootClaims } from '../tokens/index.js'

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

export const sendUnsupported = (res: Response, requestId?: string) =>
    res.status(501).json({
        ok: false,
        requestId,
        code: 'playcanvasEditor.compatibility.unsupported'
    })

export const sendNotFound = (res: Response, requestId?: string) =>
    res.status(404).json({
        ok: false,
        requestId,
        code: 'playcanvasEditor.compatibility.notFound'
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

const normalizeSourceFilePath = (value: string): string => value.replace(/\\/g, '/').split('/').filter(Boolean).join('/')

const sourceFileBasename = (value: string): string => normalizeSourceFilePath(value).split('/').filter(Boolean).pop() ?? value

const findMatchingSourceFile = (
    sourceFiles: PlayCanvasEditorCompatibilitySourceFileSummary[],
    filename: string
): PlayCanvasEditorCompatibilitySourceFileSummary | undefined => {
    const normalizedFilename = normalizeSourceFilePath(filename)
    const exactMatch = sourceFiles.find(
        (sourceFile) => sourceFile.id === filename || normalizeSourceFilePath(sourceFile.path) === normalizedFilename
    )
    if (exactMatch) return exactMatch
    if (normalizedFilename.includes('/')) return undefined

    const expected = sourceFileBasename(filename)
    const basenameMatches = sourceFiles.filter(
        (sourceFile) =>
            sourceFileBasename(sourceFile.path) === expected || sourceFileBasename(sourceFile.filename ?? sourceFile.name) === expected
    )
    return basenameMatches.length === 1 ? basenameMatches[0] : undefined
}

const sourceFileDeleteRequestId = (req: Request): string => {
    const bodyRequestId = typeof req.body?.requestId === 'string' ? req.body.requestId.trim() : ''
    if (bodyRequestId) return bodyRequestId
    const queryRequestId = typeof req.query.requestId === 'string' ? req.query.requestId.trim() : ''
    if (queryRequestId) return queryRequestId
    const headerRequestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'].trim() : ''
    return headerRequestId || randomUUID()
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
    listAssets(input: { metahubId: string; projectId: string; userId: string; sceneId?: string | null }): Promise<unknown[]>
    listSourceFiles?(input: {
        metahubId: string
        projectId: string
        userId: string
    }): Promise<PlayCanvasEditorCompatibilitySourceFileSummary[]>
    readSourceFile?(input: {
        metahubId: string
        projectId: string
        sourceFileId: string
        userId: string
    }): Promise<PlayCanvasEditorCompatibilitySourceFileDocument>
    writeSourceFile?(input: {
        metahubId: string
        projectId: string
        sourceFileId: string
        userId: string
        requestId: string
        path: string
        name?: string
        content: string
        expectedCurrentChecksum?: string | null
    }): Promise<PlayCanvasEditorCompatibilitySourceFileDocument>
    deleteSourceFile?(input: {
        metahubId: string
        projectId: string
        sourceFileId: string
        userId: string
        requestId: string
        expectedCurrentChecksum?: string | null
    }): Promise<{ id: string; deleted: true }>
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
        deps.csrfProtection,
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
                            .map((asset) =>
                                asset && typeof asset === 'object' && 'editorDocumentId' in asset
                                    ? (asset as { editorDocumentId?: unknown }).editorDocumentId
                                    : null
                            )
                            .filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)
                        if (new Set(assetDocumentIds).size !== assetDocumentIds.length) {
                            return sendInvalid(res)
                        }
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
                    const claims = validateCompatibilityToken(req, deps.tokenService, { metahubId, projectId: params.projectId, userId })
                    const fullBootClaims = claims
                        ? null
                        : validateFullBootClaims(deps.tokenService, resolveCompatibilityToken(req) ?? '', {
                              metahubId,
                              projectId: params.projectId,
                              origin: resolveRequestOrigin(req) ?? resolvePlatformApiOrigin(req)
                          })
                    if (!claims && !fullBootClaims) {
                        return sendUnauthorized(res)
                    }
                    const assets = await projectPort.listAssets({
                        metahubId,
                        projectId: params.projectId,
                        userId,
                        sceneId: claims?.sceneId ?? fullBootClaims?.sceneId
                    })
                    const allowedFullBootAssetIds = new Set(fullBootClaims?.assetDocumentIds ?? [])
                    const visibleAssets = fullBootClaims
                        ? assets.filter((asset) => {
                              const documentId =
                                  asset && typeof asset === 'object' && 'editorDocumentId' in asset
                                      ? (asset as { editorDocumentId?: unknown }).editorDocumentId
                                      : null
                              return typeof documentId === 'number' && allowedFullBootAssetIds.has(documentId)
                          })
                        : assets
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json({ items: visibleAssets.map((asset) => playCanvasEditorCompatibilityAssetSummarySchema.parse(asset)) })
                },
                { permission: 'manageMetahub' }
            )
        )
    )

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
        deps.csrfProtection,
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
        deps.csrfProtection,
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
