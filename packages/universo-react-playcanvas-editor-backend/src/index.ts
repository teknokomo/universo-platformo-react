import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { Router, type Request, type RequestHandler, type Response } from 'express'
import ShareDB from 'sharedb'
import WebSocketJSONStream from '@teamwork/websocket-json-stream'
import { WebSocketServer, type WebSocket } from 'ws'
import type {
    PlayCanvasEditorCompatibilityConfig,
    PlayCanvasEditorCompatibilityNoOpResponse,
    PlayCanvasEditorCompatibilityProtocolDescriptor,
    PlayCanvasEditorCompatibilitySettingsDocument,
    PlayCanvasEditorCompatibilityTokenClaims,
    PlayCanvasEditorFullBootConfig,
    PlayCanvasEditorFullBootEndpointDescriptor,
    PlayCanvasEditorScenePayload,
    PlayCanvasProjectSummary,
    PlayCanvasScene
} from '@universo-react/types'
import {
    PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE,
    PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_TTL_MS,
    PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION,
    PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
    playCanvasEditorFullBootConfigSchema,
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
        sceneId?: string
        userId: string
        packageSlug: 'playcanvas-editor'
        mode?: typeof PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE | typeof PLAYCANVAS_EDITOR_FULL_BOOT_MODE
        origin?: string
        sessionId?: string
        nonce?: string
        assetDocumentIds?: number[]
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

export interface PlayCanvasEditorRealtimeDocument {
    collection: 'scenes' | 'assets' | 'settings'
    id: string
    data: Record<string, unknown>
    version?: number
    checksum?: string | null
    revision?: string | null
}

export interface PlayCanvasEditorRealtimeDocumentPort {
    loadDocument(input: {
        metahubId: string
        projectId: string
        sceneId: string
        userId: string
        collection: 'scenes' | 'assets' | 'settings'
        documentId: string
        numericProjectId: number
        numericSceneId: number
        numericUserId: number
    }): Promise<PlayCanvasEditorRealtimeDocument | null>
    persistDocument(input: {
        metahubId: string
        projectId: string
        sceneId: string
        userId: string
        collection: 'scenes' | 'assets' | 'settings'
        documentId: string
        data: Record<string, unknown>
        version: number
        checksum?: string | null
        revision?: string | null
    }): Promise<{ checksum?: string | null; revision?: string | null } | void>
}

export interface PlayCanvasEditorRealtimeRuntimeDeps {
    server: import('node:http').Server
    tokenService: PlayCanvasEditorCompatibilityTokenService
    documentPort: PlayCanvasEditorRealtimeDocumentPort
    authorize?: (claims: PlayCanvasEditorCompatibilityTokenClaims) => Promise<void>
    basePath?: string
}

export interface PlayCanvasEditorRealtimeRuntimeHandle {
    close(): Promise<void>
    paths: {
        realtime: string
        messenger: string
        relay: string
    }
}

type RealtimeCollection = 'scenes' | 'assets' | 'settings'
type RealtimeSurface = 'realtime' | 'messenger' | 'relay'

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

const normalizeArtifactBaseUrl = (value: unknown): { baseUrl: string; origin: string } | null => {
    if (typeof value !== 'string' || !value.trim()) return null
    try {
        const url = new URL(value.trim())
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null
        if (!url.pathname.endsWith('/')) {
            url.pathname = `${url.pathname}/`
        }
        return { baseUrl: url.href, origin: url.origin }
    } catch {
        return null
    }
}

const resolveLoopbackSiblingOrigin = (origin: string | undefined): string | null => {
    if (!origin) return null
    try {
        const url = new URL(origin)
        if (url.hostname === '127.0.0.1') {
            url.hostname = 'localhost'
            return url.origin
        }
        if (url.hostname === 'localhost') {
            url.hostname = '127.0.0.1'
            return url.origin
        }
        return null
    } catch {
        return null
    }
}

const addSafeOrigin = (origins: Set<string>, value: string | undefined | null): void => {
    const parsed = parseSafeHttpOrigin(value)
    if (parsed) origins.add(parsed)
}

const addConfiguredArtifactOrigins = (origins: Set<string>): void => {
    for (const value of (
        process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS ??
        process.env.PLAYCANVAS_EDITOR_ARTIFACT_PUBLIC_ORIGIN ??
        ''
    )
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)) {
        addSafeOrigin(origins, value)
    }
}

const resolveAllowedArtifactOrigins = (requestOrigin: string | undefined, apiOrigin: string | undefined): Set<string> => {
    const origins = new Set<string>()
    addSafeOrigin(origins, requestOrigin)
    addSafeOrigin(origins, apiOrigin)
    addSafeOrigin(origins, resolveLoopbackSiblingOrigin(requestOrigin))
    addSafeOrigin(origins, resolveLoopbackSiblingOrigin(apiOrigin))
    addConfiguredArtifactOrigins(origins)
    return origins
}

const resolveAllowedFullBootArtifactOrigins = (apiOrigin: string | undefined): Set<string> => {
    const origins = new Set<string>()
    addSafeOrigin(origins, apiOrigin)
    addSafeOrigin(origins, resolveLoopbackSiblingOrigin(apiOrigin))
    addConfiguredArtifactOrigins(origins)
    return origins
}

const isAllowedArtifactOrigin = (origin: string, requestOrigin: string | undefined, apiOrigin: string | undefined): boolean =>
    resolveAllowedArtifactOrigins(requestOrigin, apiOrigin).has(origin)

const isAllowedFullBootArtifactOrigin = (origin: string, apiOrigin: string | undefined): boolean =>
    resolveAllowedFullBootArtifactOrigins(apiOrigin).has(origin)

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
            mode: input.mode ?? PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE,
            expiresAt: now + PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_TTL_MS,
            ...(input.sceneId ? { sceneId: input.sceneId } : {}),
            ...(input.origin ? { origin: input.origin } : {}),
            ...(input.sessionId ? { sessionId: input.sessionId } : {}),
            ...(input.nonce ? { nonce: input.nonce } : {}),
            ...(input.assetDocumentIds ? { assetDocumentIds: input.assetDocumentIds } : {})
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

const hashToPositiveInt = (value: string): number => {
    const hash = createHash('sha256').update(value).digest()
    return (hash.readUInt32BE(0) % 2_000_000_000) + 1
}

export const createPlayCanvasEditorNumericIds = (input: { metahubId: string; projectId: string; sceneId: string; userId: string }) => ({
    selfId: hashToPositiveInt(`self:${input.userId}`),
    ownerId: hashToPositiveInt(`owner:${input.metahubId}`),
    projectId: hashToPositiveInt(`project:${input.projectId}`),
    sceneId: hashToPositiveInt(`scene:${input.sceneId}`),
    settingsId: `project_${hashToPositiveInt(`project:${input.projectId}`)}`,
    storage: {
        metahubId: input.metahubId,
        projectId: input.projectId,
        sceneId: input.sceneId
    }
})

export const createPlayCanvasEditorNumericAssetId = (assetId: string): number => hashToPositiveInt(`asset:${assetId}`)

const toWsUrl = (httpUrl: string): string => httpUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')

export const createPlayCanvasEditorFullBootEndpointDescriptor = (input: {
    metahubId: string
    projectId: string
    apiOrigin?: string
}): PlayCanvasEditorFullBootEndpointDescriptor => {
    const basePath = buildBasePath(input.metahubId, input.projectId, input.apiOrigin)
    const wsBase = toWsUrl(basePath)
    return {
        restBaseUrl: basePath,
        realtimeWsUrl: `${wsBase}/realtime`,
        messengerWsUrl: `${wsBase}/messenger`,
        relayWsUrl: `${wsBase}/relay`
    }
}

const buildDefaultEditorSchema = () => ({
    asset: { type: { $enum: ['script', 'texture', 'material', 'model', 'json', 'template'] } },
    animstategraphData: {},
    materialData: {},
    scene: {
        entities: {
            $of: {
                components: {
                    camera: { enabled: { $type: 'boolean', $default: true } },
                    light: { enabled: { $type: 'boolean', $default: true } },
                    render: { enabled: { $type: 'boolean', $default: true } },
                    script: {
                        enabled: { $type: 'boolean', $default: true },
                        scripts: { $type: 'array', $default: [] },
                        order: { $type: 'array', $default: [] }
                    }
                }
            }
        },
        settings: { physics: {}, render: {} }
    },
    settings: {
        width: { $type: 'number', $default: 1280, $scope: 'project' },
        height: { $type: 'number', $default: 720, $scope: 'project' },
        useLegacyScripts: { $type: 'boolean', $default: false, $scope: 'project' },
        editor: {
            gridDivisions: { $type: 'number', $default: 8, $scope: 'projectUser' },
            gridDivisionSize: { $type: 'number', $default: 1, $scope: 'projectUser' },
            snapIncrement: { $type: 'number', $default: 1, $scope: 'projectUser' },
            cameraGrabDepth: { $type: 'boolean', $default: false, $scope: 'projectUser' },
            cameraGrabColor: { $type: 'boolean', $default: false, $scope: 'projectUser' },
            cameraNearClip: { $type: 'number', $default: 0.0001, $scope: 'projectUser' },
            cameraFarClip: { $type: 'number', $default: 10000, $scope: 'projectUser' },
            cameraClearColor: { $type: 'array', $default: [0.118, 0.118, 0.118, 1], $scope: 'projectUser' },
            cameraToneMapping: { $type: 'number', $default: 0, $scope: 'projectUser' },
            cameraGammaCorrection: { $type: 'number', $default: 1, $scope: 'projectUser' },
            showFog: { $type: 'boolean', $default: true, $scope: 'projectUser' },
            locale: { $type: 'string', $default: 'en-US', $scope: 'projectUser' },
            renameDuplicatedEntities: { $type: 'boolean', $default: true, $scope: 'projectUser' },
            lightmapperAutoBake: { $type: 'boolean', $default: true, $scope: 'projectUser' },
            codeEditor: { $type: 'string', $default: 'web', $scope: 'projectUser' },
            zoomSensitivity: { $type: 'number', $default: 1, $scope: 'user' },
            gizmoSize: { $type: 'number', $default: 1, $scope: 'user' },
            gizmoPreset: { $type: 'string', $default: 'default', $scope: 'user' },
            showViewCube: { $type: 'boolean', $default: true, $scope: 'user' },
            viewCubeSize: { $type: 'number', $default: 1, $scope: 'user' },
            iconSize: { $type: 'number', $default: 32, $scope: 'user' },
            showSkeleton: { $type: 'boolean', $default: true, $scope: 'user' }
        }
    }
})

const createDefaultRealtimeSceneSettings = () => ({
    priority_scripts: [],
    physics: {
        gravity: [0, -9.81, 0]
    },
    render: {
        global_ambient: [0.2, 0.2, 0.2],
        fog_color: [0, 0, 0],
        fog: 'none',
        fog_start: 1,
        fog_end: 1000,
        fog_density: 0,
        ambientLuminance: 0,
        lightmapSizeMultiplier: 1,
        lightmapMaxResolution: 2048,
        lightmapMode: 0,
        exposure: 1,
        gamma_correction: 1,
        tonemapping: 0,
        skybox: null
    }
})

const createDefaultProjectSettingsDocument = (input: { documentId: string; projectId: number }) => ({
    id: input.documentId,
    project: input.projectId,
    scripts: [],
    useLegacyScripts: false,
    engineV2: true,
    width: 1280,
    height: 720
})

export const createPlayCanvasEditorFullBootConfig = (input: {
    metahubId: string
    projectId: string
    sceneId: string
    userId: string
    projectName: string
    accessToken: string
    apiOrigin?: string
    artifactBaseUrl?: string
}): PlayCanvasEditorFullBootConfig => {
    const numericIds = createPlayCanvasEditorNumericIds(input)
    const endpoints = createPlayCanvasEditorFullBootEndpointDescriptor(input)
    const frontend = input.artifactBaseUrl ?? '/'
    const tokenRefreshUrl = new URL(`${endpoints.restBaseUrl}/config?mode=${PLAYCANVAS_EDITOR_FULL_BOOT_MODE}`, 'http://universo.local')
    if (input.artifactBaseUrl && normalizeArtifactBaseUrl(input.artifactBaseUrl)) {
        tokenRefreshUrl.searchParams.set('artifactBaseUrl', input.artifactBaseUrl)
    }
    const tokenRefreshUrlText = endpoints.restBaseUrl.startsWith('http')
        ? tokenRefreshUrl.toString()
        : `${endpoints.restBaseUrl}/config?${tokenRefreshUrl.searchParams.toString()}`
    const apiRoot = `${input.apiOrigin ?? ''}/api`
    const config = {
        mode: PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
        accessToken: input.accessToken,
        project: {
            id: numericIds.projectId,
            name: input.projectName,
            description: '',
            private: true,
            privateAssets: true,
            hasPrivateSettings: true,
            primaryApp: null,
            thumbnails: {},
            masterBranch: numericIds.sceneId,
            permissions: { read: [numericIds.selfId], write: [numericIds.selfId], admin: [] },
            settings: {
                id: numericIds.settingsId,
                engineV2: true,
                width: 1280,
                height: 720,
                scripts: [],
                useLegacyScripts: false
            },
            playUrl: '/'
        },
        scene: { id: numericIds.sceneId, uniqueId: numericIds.sceneId },
        self: {
            id: numericIds.selfId,
            username: 'universo',
            locale: 'en-US',
            plan: 'free',
            branch: { id: numericIds.sceneId, name: 'Main', merge: null },
            flags: { openedEditor: true, superUser: false, tips: { howdoi: true } }
        },
        owner: {
            id: numericIds.ownerId,
            username: 'universo',
            plan: 'free',
            size: 0,
            diskAllowance: 0
        },
        branch: { id: numericIds.sceneId, name: 'Main' },
        url: {
            api: apiRoot,
            launch: '/',
            home: '/',
            frontend,
            engine: `${frontend.replace(/\/?$/, '/')}js/playcanvas-engine.js`,
            images: '/',
            static: '/',
            store: `${endpoints.restBaseUrl}/cloud-only/store`,
            howdoi: `${endpoints.restBaseUrl}/cloud-only/jobs`,
            realtime: { http: endpoints.realtimeWsUrl },
            messenger: { ws: endpoints.messengerWsUrl, http: endpoints.restBaseUrl },
            relay: { ws: endpoints.relayWsUrl, http: endpoints.restBaseUrl }
        },
        schema: buildDefaultEditorSchema(),
        engineVersions: {
            force: { version: '2.19.5', description: 'Engine v2.19.5' },
            current: { version: '2.19.5', description: 'Current' }
        },
        store: {},
        aws: { s3Prefix: '' },
        wasmModules: [],
        sentry: { enabled: false },
        metrics: { enabled: false },
        oneTrustDomainKey: '',
        selfHosted: true,
        universoHosted: true,
        universoBridge: {
            compatibilityRestBaseUrl: endpoints.restBaseUrl,
            tokenRefreshUrl: tokenRefreshUrlText
        }
    }
    return playCanvasEditorFullBootConfigSchema.parse(config)
}

const getLocalizedName = (value: unknown, fallback: string): string => {
    if (!value || typeof value !== 'object') return fallback
    const record = value as { _primary?: unknown; locales?: Record<string, { content?: unknown }> }
    const primary = typeof record._primary === 'string' ? record._primary : null
    const primaryContent = primary ? record.locales?.[primary]?.content : null
    if (typeof primaryContent === 'string' && primaryContent.trim()) return primaryContent.trim()
    const first = Object.values(record.locales || {}).find((entry) => typeof entry?.content === 'string' && entry.content.trim())
    return typeof first?.content === 'string' ? first.content.trim() : fallback
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
    if (claims.origin && (!requestOrigin || claims.origin !== requestOrigin)) {
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

const parseJsonMessage = (value: unknown): Record<string, unknown> | null => {
    if (typeof value !== 'string') return null
    try {
        const parsed = JSON.parse(value)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
    } catch {
        return null
    }
}

const isPingMessage = (value: string): boolean => {
    if (value === 'ping') return true
    try {
        return JSON.parse(value) === 'ping'
    } catch {
        return false
    }
}

const parseRealtimeAuthMessage = (value: unknown): { accessToken: string } | null => {
    if (typeof value !== 'string' || !value.startsWith('auth')) return null
    const parsed = parseJsonMessage(value.slice('auth'.length))
    const accessToken = parsed?.accessToken
    return typeof accessToken === 'string' && accessToken.length > 0 ? { accessToken } : null
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeUpgradeBasePath = (basePath = '/api/v1/metahub'): string => {
    const trimmed = basePath.trim().replace(/\/+$/, '')
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

const parseUpgradePath = (
    request: IncomingMessage,
    basePath = '/api/v1/metahub'
): { metahubId: string; projectId: string; surface: RealtimeSurface } | null => {
    try {
        const url = new URL(request.url ?? '/', 'http://localhost')
        const normalizedBasePath = normalizeUpgradeBasePath(basePath)
        const match = new RegExp(
            `^${escapeRegExp(normalizedBasePath)}/([^/]+)/playcanvas/editor-compatible/projects/([^/]+)/(realtime|messenger|relay)$`
        ).exec(url.pathname)
        if (!match) return null
        const params = playCanvasEditorCompatibilityParamsSchema.safeParse({
            metahubId: decodeURIComponent(match[1]),
            projectId: decodeURIComponent(match[2])
        })
        if (!params.success) return null
        return {
            metahubId: params.data.metahubId,
            projectId: params.data.projectId,
            surface: match[3] as RealtimeSurface
        }
    } catch {
        return null
    }
}

const validateFullBootClaims = (
    tokenService: PlayCanvasEditorCompatibilityTokenService,
    accessToken: string,
    expected: { metahubId: string; projectId: string; origin?: string | null }
): PlayCanvasEditorCompatibilityTokenClaims | null => {
    const claims = tokenService.read(accessToken)
    if (!claims) return null
    if (
        claims.mode !== PLAYCANVAS_EDITOR_FULL_BOOT_MODE ||
        claims.packageSlug !== 'playcanvas-editor' ||
        claims.metahubId !== expected.metahubId ||
        claims.projectId !== expected.projectId ||
        !claims.sceneId
    ) {
        return null
    }
    if (!claims.sessionId || !claims.nonce) {
        return null
    }
    if (claims.origin && (!expected.origin || claims.origin !== expected.origin)) {
        return null
    }
    return claims
}

const closeUnauthorized = (socket: WebSocket, reason = 'playcanvasEditor.fullBoot.invalidToken'): void => {
    socket.close(4401, reason.slice(0, 120))
}

const closeInternalError = (socket: WebSocket, reason = 'playcanvasEditor.fullBoot.internalError'): void => {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1011, reason.slice(0, 120))
    }
}

const closePolicyViolation = (socket: WebSocket, reason = 'playcanvasEditor.fullBoot.protocolViolation'): void => {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1008, reason.slice(0, 120))
    }
}

const isSocketOpen = (socket: WebSocket): boolean => socket.readyState === WebSocket.OPEN

const writeUpgradeTooManyRequests = (socket: import('node:net').Socket): void => {
    if (socket.destroyed) return
    socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
    socket.destroy()
}

const getUpgradeRemoteAddress = (request: IncomingMessage): string => {
    return request.socket.remoteAddress || 'unknown'
}

const isPlayCanvasRealtimeControlFrame = (value: unknown): boolean => {
    const text = Buffer.isBuffer(value) ? value.toString('utf8') : typeof value === 'string' ? value : null
    if (typeof text !== 'string') return false
    if (/^close:(?:scene|document):[A-Za-z0-9_-]{1,128}$/.test(text)) return true
    if (/^(?:selection|pipeline|fs)\{/.test(text)) return true
    if (/^(?:doc:save:|cubemap:clear:)[A-Za-z0-9_-]{1,128}$/.test(text)) return true
    return false
}

const createShareDbWebSocket = (socket: WebSocket): WebSocket => {
    const filteredSocket = Object.create(socket) as WebSocket
    const addEventListener: WebSocket['addEventListener'] = (type, listener, options) => {
        if (type !== 'message') {
            socket.addEventListener(type, listener, options)
            return
        }
        const wrapped = ((event: { data: unknown }) => {
            if (isPlayCanvasRealtimeControlFrame(event.data)) {
                return
            }
            if (typeof listener === 'function') {
                listener.call(filteredSocket, event)
                return
            }
            ;(listener as { handleEvent: (event: { data: unknown }) => void }).handleEvent(event)
        }) as Parameters<WebSocket['addEventListener']>[1]
        socket.addEventListener(type, wrapped, options)
    }
    filteredSocket.addEventListener = addEventListener
    return filteredSocket
}

const authorizeFullBootClaims = async (
    deps: PlayCanvasEditorRealtimeRuntimeDeps,
    socket: WebSocket,
    claims: PlayCanvasEditorCompatibilityTokenClaims
): Promise<boolean> => {
    try {
        await deps.authorize?.(claims)
        return true
    } catch {
        closeUnauthorized(socket, 'playcanvasEditor.fullBoot.accessDenied')
        return false
    }
}

const asRecordData = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

type ShareDbDocumentMetadata = { checksum?: string | null; revision?: string | null; dirty?: boolean }

const shareDbPersistedMetadata = new WeakMap<ShareDB, Map<string, ShareDbDocumentMetadata>>()
const shareDbPersistQueues = new WeakMap<ShareDB, Map<string, Promise<void>>>()
const shareDbSeedWriteKeys = new WeakMap<ShareDB, Set<string>>()
const shareDbAllowedDocumentKeys = new WeakMap<ShareDB, Set<string>>()

const getShareDbPersistedMetadata = (backend: ShareDB): Map<string, ShareDbDocumentMetadata> => {
    let metadata = shareDbPersistedMetadata.get(backend)
    if (!metadata) {
        metadata = new Map()
        shareDbPersistedMetadata.set(backend, metadata)
    }
    return metadata
}

const getShareDbPersistQueues = (backend: ShareDB): Map<string, Promise<void>> => {
    let queues = shareDbPersistQueues.get(backend)
    if (!queues) {
        queues = new Map()
        shareDbPersistQueues.set(backend, queues)
    }
    return queues
}

const getShareDbSeedWriteKeys = (backend: ShareDB): Set<string> => {
    let keys = shareDbSeedWriteKeys.get(backend)
    if (!keys) {
        keys = new Set()
        shareDbSeedWriteKeys.set(backend, keys)
    }
    return keys
}

const getShareDbAllowedDocumentKeys = (backend: ShareDB): Set<string> => {
    let keys = shareDbAllowedDocumentKeys.get(backend)
    if (!keys) {
        keys = new Set()
        shareDbAllowedDocumentKeys.set(backend, keys)
    }
    return keys
}

const createAllowedShareDbDocumentKeys = (claims: PlayCanvasEditorCompatibilityTokenClaims): Set<string> => {
    const numericIds = createPlayCanvasEditorNumericIds({
        metahubId: claims.metahubId,
        projectId: claims.projectId,
        sceneId: claims.sceneId ?? claims.projectId,
        userId: claims.userId
    })
    return new Set([
        `scenes:${numericIds.sceneId}`,
        `settings:${numericIds.settingsId}`,
        `settings:user_${numericIds.selfId}`,
        `settings:project_${numericIds.projectId}_${numericIds.selfId}`,
        `settings:project-private_${numericIds.projectId}`,
        ...(claims.assetDocumentIds ?? []).map((id) => `assets:${id}`)
    ])
}

const isAllowedShareDbDocument = (backend: ShareDB, collection: unknown, documentId: unknown): collection is RealtimeCollection =>
    typeof collection === 'string' &&
    typeof documentId === 'string' &&
    getShareDbAllowedDocumentKeys(backend).has(`${collection}:${documentId}`)

const createDefaultRealtimeDocument = (
    collection: 'scenes' | 'assets' | 'settings',
    documentId: string,
    claims: PlayCanvasEditorCompatibilityTokenClaims
): Record<string, unknown> => {
    const numericIds = createPlayCanvasEditorNumericIds({
        metahubId: claims.metahubId,
        projectId: claims.projectId,
        sceneId: claims.sceneId ?? claims.projectId,
        userId: claims.userId
    })
    if (collection === 'scenes') {
        return {
            item_id: numericIds.sceneId,
            name: 'Main Scene',
            settings: createDefaultRealtimeSceneSettings(),
            entities: {
                root: {
                    resource_id: 'root',
                    name: 'Root',
                    parent: null,
                    enabled: true,
                    components: {},
                    children: []
                }
            },
            scene: numericIds.sceneId
        }
    }
    if (collection === 'settings') {
        if (documentId === numericIds.settingsId || /^project_\d+$/.test(documentId)) {
            return createDefaultProjectSettingsDocument({ documentId, projectId: numericIds.projectId })
        }
        return {
            id: documentId,
            userId: numericIds.selfId,
            projectId: numericIds.projectId
        }
    }
    return {
        id: documentId,
        project: numericIds.projectId
    }
}

const seedShareDbDocument = async (
    backend: ShareDB,
    input: {
        port: PlayCanvasEditorRealtimeDocumentPort
        claims: PlayCanvasEditorCompatibilityTokenClaims
        collection: RealtimeCollection
        documentId: string
    }
): Promise<void> => {
    const numericIds = createPlayCanvasEditorNumericIds({
        metahubId: input.claims.metahubId,
        projectId: input.claims.projectId,
        sceneId: input.claims.sceneId ?? input.claims.projectId,
        userId: input.claims.userId
    })
    const persisted = await input.port.loadDocument({
        metahubId: input.claims.metahubId,
        projectId: input.claims.projectId,
        sceneId: input.claims.sceneId ?? input.claims.projectId,
        userId: input.claims.userId,
        collection: input.collection,
        documentId: input.documentId,
        numericProjectId: numericIds.projectId,
        numericSceneId: numericIds.sceneId,
        numericUserId: numericIds.selfId
    })
    const connection = backend.connect()
    const doc = connection.get(input.collection, input.documentId)
    const metadataKey = `${input.collection}:${input.documentId}`
    const metadata: ShareDbDocumentMetadata = {
        checksum: persisted?.checksum ?? null,
        revision: persisted?.revision ?? null,
        dirty: false
    }
    const nextData = persisted
        ? asRecordData(persisted.data)
        : createDefaultRealtimeDocument(input.collection, input.documentId, input.claims)
    const metadataMatches = (current: ShareDbDocumentMetadata | undefined): boolean =>
        current?.dirty !== true && (current?.checksum ?? null) === metadata.checksum && (current?.revision ?? null) === metadata.revision
    await new Promise<void>((resolve, reject) => {
        doc.fetch((error) => {
            if (error) {
                reject(error)
                return
            }
            if (doc.type) {
                const persistedMetadata = getShareDbPersistedMetadata(backend).get(metadataKey)
                if (metadataMatches(persistedMetadata)) {
                    resolve()
                    return
                }
                getShareDbPersistedMetadata(backend).set(metadataKey, metadata)
                getShareDbSeedWriteKeys(backend).add(metadataKey)
                doc.submitOp([{ p: [], od: doc.data, oi: nextData }], (submitError) => {
                    if (submitError) {
                        getShareDbSeedWriteKeys(backend).delete(metadataKey)
                        reject(submitError)
                        return
                    }
                    resolve()
                })
                return
            }
            getShareDbPersistedMetadata(backend).set(metadataKey, metadata)
            getShareDbSeedWriteKeys(backend).add(metadataKey)
            doc.create(nextData, (createError) => {
                if (createError) {
                    getShareDbSeedWriteKeys(backend).delete(metadataKey)
                    reject(createError)
                    return
                }
                resolve()
            })
        })
    })
    getShareDbPersistedMetadata(backend).set(metadataKey, metadata)
    connection.close()
}

const persistShareDbSnapshot = async (
    backend: ShareDB,
    port: PlayCanvasEditorRealtimeDocumentPort,
    claims: PlayCanvasEditorCompatibilityTokenClaims,
    persistedMetadata: Map<string, ShareDbDocumentMetadata>,
    collection: RealtimeCollection,
    documentId: string
): Promise<void> => {
    const connection = backend.connect()
    const doc = connection.get(collection, documentId)
    await new Promise<void>((resolve, reject) => {
        doc.fetch((error) => {
            if (error) {
                reject(error)
                return
            }
            const metadataKey = `${collection}:${documentId}`
            const metadata = persistedMetadata.get(metadataKey)
            persistedMetadata.set(metadataKey, { ...metadata, dirty: true })
            port.persistDocument({
                metahubId: claims.metahubId,
                projectId: claims.projectId,
                sceneId: claims.sceneId ?? claims.projectId,
                userId: claims.userId,
                collection,
                documentId,
                data: asRecordData(doc.data),
                version: doc.version,
                checksum: metadata?.checksum ?? null,
                revision: metadata?.revision ?? null
            })
                .then((updated) => {
                    persistedMetadata.set(metadataKey, {
                        checksum: updated?.checksum ?? metadata?.checksum ?? null,
                        revision: updated?.revision ?? metadata?.revision ?? null,
                        dirty: false
                    })
                    resolve()
                })
                .catch(reject)
        })
    })
    connection.close()
}

const queueShareDbSnapshotPersistence = (
    backend: ShareDB,
    port: PlayCanvasEditorRealtimeDocumentPort,
    claims: PlayCanvasEditorCompatibilityTokenClaims,
    persistedMetadata: Map<string, ShareDbDocumentMetadata>,
    collection: RealtimeCollection,
    documentId: string
): Promise<void> => {
    const queueKey = `${collection}:${documentId}`
    const queues = getShareDbPersistQueues(backend)
    const previous = queues.get(queueKey) ?? Promise.resolve()
    const next = previous
        .catch(() => undefined)
        .then(() => persistShareDbSnapshot(backend, port, claims, persistedMetadata, collection, documentId))
    queues.set(queueKey, next)
    void next.then(
        () => {
            if (queues.get(queueKey) === next) {
                queues.delete(queueKey)
            }
        },
        () => {
            if (queues.get(queueKey) === next) {
                queues.delete(queueKey)
            }
        }
    )
    return next
}

const isRecoverableShareDbPersistenceConflict = (error: unknown): boolean => {
    const details =
        error && typeof error === 'object' && 'details' in error && (error as { details?: unknown }).details
            ? ((error as { details?: unknown }).details as Record<string, unknown>)
            : null
    const statusCode = error && typeof error === 'object' && 'statusCode' in error ? (error as { statusCode?: unknown }).statusCode : null
    const messageCode =
        typeof details?.messageCode === 'string'
            ? details.messageCode
            : error &&
              typeof error === 'object' &&
              'messageCode' in error &&
              typeof (error as { messageCode?: unknown }).messageCode === 'string'
            ? String((error as { messageCode?: unknown }).messageCode)
            : ''
    const message = error instanceof Error ? error.message : String(error)
    return (
        statusCode === 409 ||
        /checksum.*match|current checksum|revisionMismatch|settingsRevisionMismatch|settings revision/i.test(`${messageCode} ${message}`)
    )
}

const createRealtimeScopeKey = (claims: PlayCanvasEditorCompatibilityTokenClaims): string =>
    [claims.metahubId, claims.projectId, claims.sceneId ?? '', claims.userId].join(':')

const createScopedShareDbBackend = (
    claims: PlayCanvasEditorCompatibilityTokenClaims,
    port: PlayCanvasEditorRealtimeDocumentPort
): ShareDB => {
    const backend = new ShareDB()
    const persistedMetadata = getShareDbPersistedMetadata(backend)
    for (const key of createAllowedShareDbDocumentKeys(claims)) {
        getShareDbAllowedDocumentKeys(backend).add(key)
    }
    backend.use('submit', (context, next) => {
        if (!isAllowedShareDbDocument(backend, context.collection, context.id)) {
            next(new Error('playcanvasEditor.fullBoot.documentNotAllowed'))
            return
        }
        next()
    })
    backend.use('afterWrite', (context, next) => {
        const collection = context.collection as RealtimeCollection
        const documentId = context.id as string
        if (!isAllowedShareDbDocument(backend, collection, documentId)) {
            next()
            return
        }
        const queueKey = `${collection}:${documentId}`
        if (getShareDbSeedWriteKeys(backend).delete(queueKey)) {
            next()
            return
        }
        queueShareDbSnapshotPersistence(backend, port, claims, persistedMetadata, collection, documentId)
            .then(() => next())
            .catch((error) => {
                if (!isRecoverableShareDbPersistenceConflict(error)) {
                    next(error)
                    return
                }
                seedShareDbDocument(backend, { port, claims, collection, documentId })
                    .then(() => next())
                    .catch(next)
            })
    })
    return backend
}

const handleRealtimeSocket = (
    socket: WebSocket,
    request: IncomingMessage,
    deps: PlayCanvasEditorRealtimeRuntimeDeps,
    path: NonNullable<ReturnType<typeof parseUpgradePath>>,
    getBackend: (claims: PlayCanvasEditorCompatibilityTokenClaims) => ShareDB,
    reserveAuth: (socket: WebSocket, claims: PlayCanvasEditorCompatibilityTokenClaims, surface: RealtimeSurface) => boolean
) => {
    const authTimer = setTimeout(() => closeUnauthorized(socket, 'playcanvasEditor.fullBoot.authTimeout'), 10_000)
    socket.once('close', () => clearTimeout(authTimer))

    socket.once('message', async (data) => {
        try {
            const auth = parseRealtimeAuthMessage(data.toString())
            if (!auth) {
                closeUnauthorized(socket, 'playcanvasEditor.fullBoot.invalidRealtimeAuth')
                return
            }
            const claims = validateFullBootClaims(deps.tokenService, auth.accessToken, {
                metahubId: path.metahubId,
                projectId: path.projectId,
                origin: parseSafeHttpOrigin(request.headers.origin) ?? null
            })
            if (!claims) {
                closeUnauthorized(socket)
                return
            }
            if (!(await authorizeFullBootClaims(deps, socket, claims))) return
            if (!isSocketOpen(socket)) return
            if (!reserveAuth(socket, claims, path.surface)) return
            clearTimeout(authTimer)
            const backend = getBackend(claims)
            const numericIds = createPlayCanvasEditorNumericIds({
                metahubId: claims.metahubId,
                projectId: claims.projectId,
                sceneId: claims.sceneId ?? claims.projectId,
                userId: claims.userId
            })
            await Promise.all([
                seedShareDbDocument(backend, {
                    port: deps.documentPort,
                    claims,
                    collection: 'scenes',
                    documentId: String(numericIds.sceneId)
                }),
                seedShareDbDocument(backend, {
                    port: deps.documentPort,
                    claims,
                    collection: 'settings',
                    documentId: numericIds.settingsId
                }),
                seedShareDbDocument(backend, {
                    port: deps.documentPort,
                    claims,
                    collection: 'settings',
                    documentId: `user_${numericIds.selfId}`
                }),
                seedShareDbDocument(backend, {
                    port: deps.documentPort,
                    claims,
                    collection: 'settings',
                    documentId: `project_${numericIds.projectId}_${numericIds.selfId}`
                }),
                seedShareDbDocument(backend, {
                    port: deps.documentPort,
                    claims,
                    collection: 'settings',
                    documentId: `project-private_${numericIds.projectId}`
                })
            ])
            socket.send('auth{"ok":true}')
            const stream = new WebSocketJSONStream(createShareDbWebSocket(socket))
            stream.on('error', () => closeInternalError(socket, 'playcanvasEditor.fullBoot.realtimeProtocolError'))
            backend.listen(stream, request)
        } catch (error) {
            console.warn('[PlayCanvasEditorFullBootRuntime] Realtime socket initialization failed', {
                metahubId: path.metahubId,
                projectId: path.projectId,
                error: error instanceof Error ? error.message : String(error)
            })
            clearTimeout(authTimer)
            closeInternalError(socket)
        }
    })
}

const handleMessengerSocket = (
    socket: WebSocket,
    request: IncomingMessage,
    deps: PlayCanvasEditorRealtimeRuntimeDeps,
    path: NonNullable<ReturnType<typeof parseUpgradePath>>,
    reserveAuth: (socket: WebSocket, claims: PlayCanvasEditorCompatibilityTokenClaims, surface: RealtimeSurface) => boolean
) => {
    let authenticatedClaims: PlayCanvasEditorCompatibilityTokenClaims | null = null
    const authTimer = setTimeout(() => closeUnauthorized(socket, 'playcanvasEditor.fullBoot.authTimeout'), 10_000)
    socket.once('close', () => clearTimeout(authTimer))
    socket.on('message', async (data) => {
        try {
            const raw = data.toString()
            if (isPingMessage(raw)) {
                socket.send('pong')
                return
            }
            const msg = parseJsonMessage(raw)
            if (!msg) return
            if (msg.name === 'authenticate') {
                const token = typeof msg.token === 'string' ? msg.token : ''
                const claims = validateFullBootClaims(deps.tokenService, token, {
                    metahubId: path.metahubId,
                    projectId: path.projectId,
                    origin: parseSafeHttpOrigin(request.headers.origin) ?? null
                })
                if (!claims) {
                    closeUnauthorized(socket)
                    return
                }
                if (!(await authorizeFullBootClaims(deps, socket, claims))) return
                if (!isSocketOpen(socket)) return
                if (!reserveAuth(socket, claims, path.surface)) return
                clearTimeout(authTimer)
                authenticatedClaims = claims
                socket.send(
                    JSON.stringify({
                        name: 'welcome',
                        userId: createPlayCanvasEditorNumericIds({
                            metahubId: claims.metahubId,
                            projectId: claims.projectId,
                            sceneId: claims.sceneId ?? claims.projectId,
                            userId: claims.userId
                        }).selfId
                    })
                )
                return
            }
            if (!authenticatedClaims) {
                closeUnauthorized(socket, 'playcanvasEditor.fullBoot.messengerAuthRequired')
                return
            }
            if (msg.name === 'project.watch') {
                socket.send(JSON.stringify({ name: 'project.watch', ok: true }))
            }
        } catch {
            clearTimeout(authTimer)
            closeInternalError(socket)
        }
    })
}

const handleRelaySocket = (
    socket: WebSocket,
    request: IncomingMessage,
    deps: PlayCanvasEditorRealtimeRuntimeDeps,
    path: NonNullable<ReturnType<typeof parseUpgradePath>>,
    reserveAuth: (socket: WebSocket, claims: PlayCanvasEditorCompatibilityTokenClaims, surface: RealtimeSurface) => boolean
): void => {
    const maxPendingMessages = 16
    let userId: number = hashToPositiveInt(`relay:${path.metahubId}:${path.projectId}`)
    let authenticationPending = false
    let authenticated = false
    const pendingMessages: string[] = []
    const authTimer = setTimeout(() => closeUnauthorized(socket, 'playcanvasEditor.fullBoot.authTimeout'), 10_000)
    socket.once('close', () => {
        clearTimeout(authTimer)
        pendingMessages.length = 0
    })

    const authenticate = async (token: string): Promise<boolean> => {
        if (authenticationPending) return true
        authenticationPending = true
        try {
            const claims = validateFullBootClaims(deps.tokenService, token, {
                metahubId: path.metahubId,
                projectId: path.projectId,
                origin: parseSafeHttpOrigin(request.headers.origin) ?? null
            })
            if (!claims) {
                return false
            }
            if (!(await authorizeFullBootClaims(deps, socket, claims))) return false
            if (!isSocketOpen(socket)) return false
            if (!reserveAuth(socket, claims, path.surface)) return false
            userId = createPlayCanvasEditorNumericIds({
                metahubId: claims.metahubId,
                projectId: claims.projectId,
                sceneId: claims.sceneId ?? claims.projectId,
                userId: claims.userId
            }).selfId
            authenticated = true
            clearTimeout(authTimer)
            socket.send(JSON.stringify({ t: 'welcome', userId }))
            return true
        } finally {
            authenticationPending = false
        }
    }

    const handleAuthenticatedMessage = (msg: Record<string, unknown>): void => {
        if (msg.t === 'room:join' && typeof msg.name === 'string') {
            socket.send(JSON.stringify({ t: 'room:join', name: msg.name, users: [userId] }))
            return
        }
        if (msg.t === 'room:leave' && typeof msg.name === 'string') {
            socket.send(JSON.stringify({ t: 'room:leave', name: msg.name, userId }))
        }
    }

    socket.on('message', async (data) => {
        try {
            const raw = data.toString()
            if (isPingMessage(raw)) {
                socket.send('pong')
                return
            }
            const msg = parseJsonMessage(raw)
            if (!msg) return
            if (authenticationPending) {
                if (pendingMessages.length >= maxPendingMessages) {
                    closePolicyViolation(socket, 'playcanvasEditor.fullBoot.relayPendingLimit')
                    return
                }
                pendingMessages.push(raw)
                return
            }
            if (msg.t === 'authenticate') {
                const token = typeof msg.token === 'string' ? msg.token : ''
                const isAuthenticated = await authenticate(token)
                if (isAuthenticated) {
                    while (pendingMessages.length > 0) {
                        const pending = parseJsonMessage(pendingMessages.shift() ?? '')
                        if (pending) handleAuthenticatedMessage(pending)
                    }
                } else {
                    closeUnauthorized(socket)
                }
                return
            }
            if (!authenticated) {
                return
            }
            handleAuthenticatedMessage(msg)
        } catch {
            closeInternalError(socket)
        }
    })
}

export const isPlayCanvasEditorFullBootUpgradeRequest = (request: IncomingMessage, basePath?: string): boolean =>
    Boolean(parseUpgradePath(request, basePath))

export const attachPlayCanvasEditorFullBootRuntime = (deps: PlayCanvasEditorRealtimeRuntimeDeps): PlayCanvasEditorRealtimeRuntimeHandle => {
    const basePath = normalizeUpgradeBasePath(deps.basePath)
    const backends = new Map<string, ShareDB>()
    const activeSocketKeys = new Map<string, WebSocket>()
    const authTimers = new Map<WebSocket, NodeJS.Timeout>()
    const pendingUnauthSockets = new Map<string, number>()
    const pendingUnauthSocketLimit = 128
    const pendingUnauthSocketLimitPerAddress = 16
    let pendingUnauthSocketCount = 0
    const reservePendingAuthSocket = (request: IncomingMessage): (() => void) | null => {
        const remoteAddress = getUpgradeRemoteAddress(request)
        const addressCount = pendingUnauthSockets.get(remoteAddress) ?? 0
        if (pendingUnauthSocketCount >= pendingUnauthSocketLimit || addressCount >= pendingUnauthSocketLimitPerAddress) {
            return null
        }
        pendingUnauthSocketCount += 1
        pendingUnauthSockets.set(remoteAddress, addressCount + 1)
        let released = false
        return () => {
            if (released) return
            released = true
            pendingUnauthSocketCount = Math.max(0, pendingUnauthSocketCount - 1)
            const nextAddressCount = (pendingUnauthSockets.get(remoteAddress) ?? 1) - 1
            if (nextAddressCount > 0) {
                pendingUnauthSockets.set(remoteAddress, nextAddressCount)
            } else {
                pendingUnauthSockets.delete(remoteAddress)
            }
        }
    }
    const authKeyFor = (claims: PlayCanvasEditorCompatibilityTokenClaims, surface: RealtimeSurface): string =>
        [claims.metahubId, claims.projectId, claims.sceneId ?? '', claims.userId, claims.sessionId, claims.nonce, surface].join(':')
    const reserveAuth = (socket: WebSocket, claims: PlayCanvasEditorCompatibilityTokenClaims, surface: RealtimeSurface): boolean => {
        const key = authKeyFor(claims, surface)
        const activeSocket = activeSocketKeys.get(key)
        if (activeSocket && activeSocket !== socket && isSocketOpen(activeSocket)) {
            closeUnauthorized(socket, 'playcanvasEditor.fullBoot.sessionAlreadyActive')
            return false
        }
        activeSocketKeys.set(key, socket)
        const ttl = claims.expiresAt - Date.now()
        if (ttl <= 0) {
            activeSocketKeys.delete(key)
            closeUnauthorized(socket, 'playcanvasEditor.fullBoot.tokenExpired')
            return false
        }
        const expiryTimer = setTimeout(() => closeUnauthorized(socket, 'playcanvasEditor.fullBoot.tokenExpired'), ttl)
        authTimers.set(socket, expiryTimer)
        socket.once('close', () => {
            if (activeSocketKeys.get(key) === socket) {
                activeSocketKeys.delete(key)
            }
            const timer = authTimers.get(socket)
            if (timer) {
                clearTimeout(timer)
                authTimers.delete(socket)
            }
        })
        return true
    }
    const getBackend = (claims: PlayCanvasEditorCompatibilityTokenClaims): ShareDB => {
        const key = createRealtimeScopeKey(claims)
        let backend = backends.get(key)
        if (!backend) {
            backend = createScopedShareDbBackend(claims, deps.documentPort)
            backends.set(key, backend)
        }
        return backend
    }
    const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 })
    const paths = {
        realtime: `${basePath}/:metahubId/playcanvas/editor-compatible/projects/:projectId/realtime`,
        messenger: `${basePath}/:metahubId/playcanvas/editor-compatible/projects/:projectId/messenger`,
        relay: `${basePath}/:metahubId/playcanvas/editor-compatible/projects/:projectId/relay`
    }
    const onUpgrade = (request: IncomingMessage, socket: import('node:net').Socket, head: Buffer) => {
        const path = parseUpgradePath(request, basePath)
        if (!path) return
        const releasePendingAuth = reservePendingAuthSocket(request)
        if (!releasePendingAuth) {
            writeUpgradeTooManyRequests(socket)
            return
        }
        try {
            webSocketServer.handleUpgrade(request, socket, head, (ws) => {
                ws.once('close', releasePendingAuth)
                const reserveAuthenticatedSocket = (
                    authenticatedSocket: WebSocket,
                    claims: PlayCanvasEditorCompatibilityTokenClaims,
                    surface: RealtimeSurface
                ): boolean => {
                    releasePendingAuth()
                    return reserveAuth(authenticatedSocket, claims, surface)
                }
                if (path.surface === 'realtime') {
                    handleRealtimeSocket(ws, request, deps, path, getBackend, reserveAuthenticatedSocket)
                    return
                }
                if (path.surface === 'messenger') {
                    handleMessengerSocket(ws, request, deps, path, reserveAuthenticatedSocket)
                    return
                }
                handleRelaySocket(ws, request, deps, path, reserveAuthenticatedSocket)
            })
        } catch (error) {
            releasePendingAuth()
            throw error
        }
    }
    deps.server.on('upgrade', onUpgrade)
    return {
        paths,
        close: async () => {
            deps.server.off('upgrade', onUpgrade)
            for (const timer of authTimers.values()) {
                clearTimeout(timer)
            }
            authTimers.clear()
            activeSocketKeys.clear()
            pendingUnauthSockets.clear()
            pendingUnauthSocketCount = 0
            for (const backend of backends.values()) {
                await new Promise<void>((resolve) => {
                    const close = (backend as ShareDB & { close?: (callback: () => void) => void }).close
                    if (!close) {
                        resolve()
                        return
                    }
                    close.call(backend, resolve)
                })
            }
            await new Promise<void>((resolve, reject) => webSocketServer.close((error) => (error ? reject(error) : resolve())))
        }
    }
}

export const attachPlayCanvasEditorCompatibilityRuntime = (): { attached: false; reason: 'websocketRuntimeOutsideFirstSlice' } => ({
    attached: false,
    reason: 'websocketRuntimeOutsideFirstSlice'
})
