import { createHash } from 'node:crypto'
import type {
    PlayCanvasEditorCompatibilityConfig,
    PlayCanvasEditorCompatibilityProtocolDescriptor,
    PlayCanvasEditorFullBootConfig,
    PlayCanvasEditorFullBootEndpointDescriptor
} from '@universo-react/types'
import {
    PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE,
    PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION,
    PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
    playCanvasEditorFullBootConfigSchema,
    playCanvasEditorCompatibilityConfigSchema
} from '@universo-react/types'

export const hashToPositiveInt = (value: string): number => {
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

export const buildBasePath = (metahubId: string, projectId: string, apiOrigin?: string) =>
    `${apiOrigin ?? ''}/api/v1/metahub/${encodeURIComponent(metahubId)}/playcanvas/editor-compatible/projects/${encodeURIComponent(
        projectId
    )}`

export const toWsUrl = (httpUrl: string): string => httpUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')

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

export const buildDefaultEditorSchema = () => ({
    asset: { type: { $enum: ['script', 'texture', 'material', 'model', 'json', 'template'] } },
    animstategraphData: {},
    materialData: {},
    scene: {
        entities: {
            $of: {
                components: {
                    camera: { enabled: { $type: 'boolean', $default: true } },
                    light: { enabled: { $type: 'boolean', $default: true } },
                    render: {
                        enabled: { $type: 'boolean', $default: true },
                        type: { $type: 'string', $default: 'box' },
                        asset: { $default: null },
                        materialAssets: { $type: 'array', $default: [null] },
                        layers: { $type: 'array', $default: [0] },
                        castShadows: { $type: 'boolean', $default: true },
                        receiveShadows: { $type: 'boolean', $default: true },
                        castShadowsLightmap: { $type: 'boolean', $default: true },
                        lightmapped: { $type: 'boolean', $default: false },
                        isStatic: { $type: 'boolean', $default: false },
                        batchGroupId: { $default: null },
                        rootBone: { $default: null }
                    },
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

export const createDefaultRealtimeSceneSettings = () => ({
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

export const createDefaultProjectSettingsDocument = (input: { documentId: string; projectId: number }) => ({
    id: input.documentId,
    project: input.projectId,
    scripts: [],
    useLegacyScripts: false,
    engineV2: true,
    width: 1280,
    height: 720
})

export const normalizeArtifactBaseUrl = (value: unknown): { baseUrl: string; origin: string } | null => {
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

export const getLocalizedName = (value: unknown, fallback: string): string => {
    if (!value || typeof value !== 'object') return fallback
    const record = value as { _primary?: unknown; locales?: Record<string, { content?: unknown }> }
    const primary = typeof record._primary === 'string' ? record._primary : null
    const primaryContent = primary ? record.locales?.[primary]?.content : null
    if (typeof primaryContent === 'string' && primaryContent.trim()) return primaryContent.trim()
    const first = Object.values(record.locales || {}).find((entry) => typeof entry?.content === 'string' && entry.content.trim())
    return typeof first?.content === 'string' ? first.content.trim() : fallback
}

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
            sourcefiles: `${basePath}/sourcefiles`,
            settings: `${basePath}/settings`,
            cloudOnly: `${basePath}/cloud-only`
        },
        auth: {
            scheme: 'signed-header',
            headerName: 'X-PlayCanvas-Editor-Token',
            accessToken: input.accessToken,
            expiresAt: new Date(input.tokenExpiresAt).toISOString()
        },
        csrf: {
            tokenUrl: `${input.apiOrigin ?? ''}/api/v1/auth/csrf`,
            headerName: 'X-CSRF-Token'
        }
    })
}
