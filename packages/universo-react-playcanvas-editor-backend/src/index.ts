import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { Router, type Request, type RequestHandler, type Response } from 'express'
import type {
    PlayCanvasEditorCompatibilityConfig,
    PlayCanvasEditorCompatibilityNoOpResponse,
    PlayCanvasEditorCompatibilityProtocolDescriptor,
    PlayCanvasEditorCompatibilitySettingsDocument,
    PlayCanvasEditorCompatibilityTokenClaims,
    PlayCanvasEditorScenePayload,
    PlayCanvasProjectSummary,
    PlayCanvasScene
} from '@universo-react/types'
import {
    PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE,
    PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_TTL_MS,
    PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION,
    playCanvasEditorCompatibilityAssetSummarySchema,
    playCanvasEditorCompatibilityCloudSurfaceSchema,
    playCanvasEditorCompatibilityConfigSchema,
    playCanvasEditorCompatibilityNoOpResponseSchema,
    playCanvasEditorCompatibilityParamsSchema,
    playCanvasEditorCompatibilitySceneParamsSchema,
    playCanvasEditorCompatibilitySceneSaveRequestSchema,
    playCanvasEditorCompatibilitySceneSummarySchema,
    playCanvasEditorCompatibilitySettingsParamsSchema,
    playCanvasEditorCompatibilitySettingsWriteRequestSchema,
    playCanvasEditorCompatibilityTokenClaimsSchema
} from '@universo-react/types'

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

export interface PlayCanvasEditorCompatibilityTokenService {
    create(input: {
        metahubId: string
        projectId: string
        userId: string
        packageSlug: 'playcanvas-editor'
        origin?: string
        now?: number
    }): { token: string; claims: PlayCanvasEditorCompatibilityTokenClaims }
    read(token: string): PlayCanvasEditorCompatibilityTokenClaims | null
}

export interface PlayCanvasEditorCompatibilityRouteDeps {
    createHandler: PlayCanvasEditorCompatibilityHandler
    createProjectPort: (context: PlayCanvasEditorCompatibilityContext) => PlayCanvasEditorCompatibilityProjectPort
    tokenService: PlayCanvasEditorCompatibilityTokenService
    readLimiter: RequestHandler
    writeLimiter: RequestHandler
    csrfProtection: RequestHandler
}

const validateParams = <T>(
    schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
    value: unknown
): T | null => {
    const parsed = schema.safeParse(value)
    return parsed.success ? parsed.data : null
}

const sendInvalid = (res: Response, requestId?: string) =>
    res.status(400).json({
        ok: false,
        requestId,
        code: 'playcanvasEditor.compatibility.invalidRequest'
    })

const buildBasePath = (metahubId: string, projectId: string, apiOrigin?: string) =>
    `${apiOrigin ?? ''}/api/v1/metahub/${encodeURIComponent(metahubId)}/playcanvas/editor-compatible/projects/${encodeURIComponent(
        projectId
    )}`

const parseSafeHttpOrigin = (value: unknown): string | undefined => {
    if (typeof value !== 'string' || !value.trim()) return undefined
    try {
        const parsed = new URL(value.trim())
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
            return undefined
        }
        return parsed.origin
    } catch {
        return undefined
    }
}

const resolveRequestOrigin = (req: Request): string | undefined => {
    const origin = req.get('origin')
    const parsedOrigin = parseSafeHttpOrigin(origin)
    if (parsedOrigin) return parsedOrigin
    const referer = req.get('referer')
    if (!referer) return undefined
    return parseSafeHttpOrigin(referer)
}

const resolvePlatformApiOrigin = (req: Request): string | undefined => {
    const configuredOrigin = parseSafeHttpOrigin(process.env.PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN)
    if (configuredOrigin) {
        return configuredOrigin
    }

    const refererOrigin = parseSafeHttpOrigin(req.get('referer'))
    if (refererOrigin) {
        return refererOrigin
    }

    const trustProxyHeaders = process.env.PLAYCANVAS_EDITOR_TRUST_PROXY_HEADERS === 'true'
    const forwardedHost = trustProxyHeaders ? req.get('x-forwarded-host')?.split(',')[0]?.trim() : undefined
    const host = forwardedHost || req.get('host')
    if (!host) return undefined
    const forwardedProto = trustProxyHeaders ? req.get('x-forwarded-proto')?.split(',')[0]?.trim() : undefined
    const protocol = forwardedProto || req.protocol || 'http'
    return parseSafeHttpOrigin(`${protocol}://${host}`)
}

const normalizeOrigin = (value: unknown): string | null => {
    const origin = parseSafeHttpOrigin(value)
    if (!origin) return null
    try {
        const url = new URL((value as string).trim())
        if (url.pathname !== '/' || url.search || url.hash) return null
        return origin
    } catch {
        return null
    }
}

const PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_HEADER = 'X-PlayCanvas-Editor-Token'

const resolveCompatibilityToken = (req: Request): string | null => req.get(PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_HEADER)?.trim() || null

const timingSafeEqualString = (left: string, right: string): boolean => {
    const leftBuffer = Buffer.from(left)
    const rightBuffer = Buffer.from(right)
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

const resolveTokenSecret = (): string => {
    const secret =
        process.env.PLAYCANVAS_EDITOR_COMPATIBILITY_SECRET ??
        process.env.PLAYCANVAS_EDITOR_BRIDGE_SECRET ??
        process.env.SESSION_SECRET ??
        process.env.SUPABASE_JWT_SECRET
    if (secret) return secret
    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            'PLAYCANVAS_EDITOR_COMPATIBILITY_SECRET, PLAYCANVAS_EDITOR_BRIDGE_SECRET, SESSION_SECRET, or SUPABASE_JWT_SECRET must be configured in production'
        )
    }
    const globalKey = '__universoPlayCanvasEditorCompatibilityDevelopmentSecret'
    const globalValue = globalThis as typeof globalThis & { [globalKey]?: string }
    globalValue[globalKey] ??= `dev-playcanvas-editor-compatibility-${randomUUID()}`
    return globalValue[globalKey]
}

const encodeTokenPart = (value: unknown): string => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')

const decodeTokenPart = (value: string): unknown | null => {
    try {
        return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown
    } catch {
        return null
    }
}

const signTokenPart = (encodedPayload: string): string =>
    createHmac('sha256', resolveTokenSecret()).update(encodedPayload).digest('base64url')

export const createPlayCanvasEditorCompatibilityTokenService = (): PlayCanvasEditorCompatibilityTokenService => ({
    create: (input) => {
        const now = input.now ?? Date.now()
        const claims = playCanvasEditorCompatibilityTokenClaimsSchema.parse({
            metahubId: input.metahubId,
            projectId: input.projectId,
            userId: input.userId,
            packageSlug: input.packageSlug,
            mode: PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE,
            origin: input.origin,
            expiresAt: now + PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_TTL_MS
        })
        const encodedPayload = encodeTokenPart(claims)
        return {
            token: `${encodedPayload}.${signTokenPart(encodedPayload)}`,
            claims
        }
    },
    read: (token) => {
        const [encodedPayload, signature, extra] = token.split('.')
        if (!encodedPayload || !signature || extra) return null
        if (!timingSafeEqualString(signTokenPart(encodedPayload), signature)) return null
        const parsed = playCanvasEditorCompatibilityTokenClaimsSchema.safeParse(decodeTokenPart(encodedPayload))
        if (!parsed.success || parsed.data.expiresAt <= Date.now()) return null
        return parsed.data
    }
})

const wrapAsync =
    (handler: RequestHandler): RequestHandler =>
    (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next)
    }

export const createPlayCanvasEditorCompatibilityConfig = (input: {
    metahubId: string
    projectId: string
    userId: string
    protocol: PlayCanvasEditorCompatibilityProtocolDescriptor
    accessToken: string
    tokenExpiresAt: number
    apiOrigin?: string
}): PlayCanvasEditorCompatibilityConfig => {
    const basePath = buildBasePath(input.metahubId, input.projectId, input.apiOrigin)
    return playCanvasEditorCompatibilityConfigSchema.parse({
        schemaVersion: PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION,
        mode: PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE,
        protocol: input.protocol,
        projectId: input.projectId,
        defaultSceneId: input.protocol.defaultSceneId,
        userId: input.userId,
        permissions: {
            read: true,
            write: true,
            admin: false
        },
        endpoints: {
            scenes: `${basePath}/scenes`,
            assets: `${basePath}/assets`,
            settings: `${basePath}/settings`,
            cloudOnly: `${basePath}/cloud-only`
        },
        auth: {
            scheme: 'signed-header',
            headerName: PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_HEADER,
            accessToken: input.accessToken,
            expiresAt: new Date(input.tokenExpiresAt).toISOString()
        },
        csrf: {
            tokenUrl: `${input.apiOrigin ?? ''}/api/v1/auth/csrf`,
            headerName: 'X-CSRF-Token'
        }
    })
}

const validateCompatibilityToken = (
    req: Request,
    tokenService: PlayCanvasEditorCompatibilityTokenService,
    expected: { metahubId: string; projectId: string; userId: string }
): PlayCanvasEditorCompatibilityTokenClaims | null => {
    const token = resolveCompatibilityToken(req)
    if (!token) return null
    const claims = tokenService.read(token)
    if (!claims) return null
    if (
        claims.metahubId !== expected.metahubId ||
        claims.projectId !== expected.projectId ||
        claims.userId !== expected.userId ||
        claims.packageSlug !== 'playcanvas-editor' ||
        claims.mode !== PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE
    ) {
        return null
    }
    const requestOrigin = resolveRequestOrigin(req)
    if (claims.origin && requestOrigin && claims.origin !== requestOrigin) {
        return null
    }
    return claims
}

const sendUnauthorized = (res: Response, requestId?: string) =>
    res.status(401).json({
        ok: false,
        requestId,
        code: 'playcanvasEditor.compatibility.invalidToken'
    })

const createCloudOnlyNoOp = (surface: unknown): PlayCanvasEditorCompatibilityNoOpResponse | null => {
    const parsed = playCanvasEditorCompatibilityCloudSurfaceSchema.safeParse(surface)
    if (!parsed.success) return null
    return playCanvasEditorCompatibilityNoOpResponseSchema.parse({
        ok: true,
        surface: parsed.data,
        status: 'stubbed',
        reason: 'cloudOnlySurfaceOutsideFirstSlice'
    })
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
                    const requestedArtifactOrigin = req.query.artifactOrigin
                    const artifactOrigin =
                        requestedArtifactOrigin === undefined ? undefined : normalizeOrigin(requestedArtifactOrigin as unknown)
                    if (requestedArtifactOrigin !== undefined && !artifactOrigin) {
                        return sendInvalid(res)
                    }
                    const apiOrigin = resolvePlatformApiOrigin(req)
                    const requestOrigin = resolveRequestOrigin(req)
                    const protocol = await projectPort.describeProtocol({ metahubId, projectId: params.projectId, userId })
                    const token = deps.tokenService.create({
                        metahubId,
                        projectId: params.projectId,
                        userId,
                        packageSlug: 'playcanvas-editor',
                        origin: artifactOrigin ?? requestOrigin ?? apiOrigin
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

export const attachPlayCanvasEditorCompatibilityRuntime = (): { attached: false; reason: 'websocketRuntimeOutsideFirstSlice' } => ({
    attached: false,
    reason: 'websocketRuntimeOutsideFirstSlice'
})
