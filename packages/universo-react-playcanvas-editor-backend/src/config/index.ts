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
    PLAYCANVAS_EDITOR_PAGE_UNAVAILABLE_REASONS,
    PLAYCANVAS_EDITOR_SURFACE_UNAVAILABLE_PATH,
    playCanvasEditorFullBootConfigSchema,
    playCanvasEditorCompatibilityConfigSchema
} from '@universo-react/types'
import { buildEditorSchemaCatalog } from './schemaCatalog'

export const hashToPositiveInt = (value: string): number => {
    const hash = createHash('sha256').update(value).digest()
    return (hash.readUInt32BE(0) % 2_000_000_000) + 1
}

export interface PlayCanvasEditorNumericIdAssignmentInput {
    key: string
}

/**
 * Deterministically assigns collision-free positive numeric ids for a batch of keys.
 *
 * Base ids come from hashToPositiveInt; when two keys in the batch share a base id,
 * contested keys rehash deterministically with an ordered suffix (`${key}#1`, `#2`, ...)
 * until an unused slot is found. Keys are processed in sorted order and every base id
 * that is unique within the batch is reserved first, so the assignment never depends on
 * input order and non-colliding members always keep their base id. `reservedIds`
 * pre-occupies slots (for example fixed upstream numeric ids) so hashed assignments
 * avoid them.
 */
export const deriveUniqueNumericIds = (
    inputs: readonly PlayCanvasEditorNumericIdAssignmentInput[],
    reservedIds?: ReadonlySet<number>
): Map<string, number> => {
    const usedIds = new Set<number>(reservedIds ?? [])
    const assignment = new Map<string, number>()
    const orderedKeys = [...new Set(inputs.map((input) => input.key))].sort()
    const baseIdByKey = new Map<string, number>(orderedKeys.map((key) => [key, hashToPositiveInt(key)]))
    for (const key of orderedKeys) {
        const baseId = baseIdByKey.get(key) ?? 0
        if (usedIds.has(baseId)) continue
        const isContested = orderedKeys.some((other) => other !== key && baseIdByKey.get(other) === baseId)
        if (isContested) continue
        usedIds.add(baseId)
        assignment.set(key, baseId)
    }
    for (const key of orderedKeys) {
        if (assignment.has(key)) continue
        let suffix = 0
        let candidate = baseIdByKey.get(key) ?? 0
        while (usedIds.has(candidate)) {
            suffix += 1
            candidate = hashToPositiveInt(`${key}#${suffix}`)
        }
        usedIds.add(candidate)
        assignment.set(key, candidate)
    }
    return assignment
}

const numericIdAssignmentKey = {
    self: (userId: string) => `self:${userId}`,
    owner: (metahubId: string) => `owner:${metahubId}`,
    project: (projectId: string) => `project:${projectId}`,
    scene: (sceneId: string) => `scene:${sceneId}`
} as const

export const createPlayCanvasEditorNumericIds = (input: { metahubId: string; projectId: string; sceneId: string; userId: string }) => {
    // Identity roles allocate in ISOLATED namespaces: a hash collision between a
    // user key and a project/scene key must never remap the persistent project or
    // scene identity for that user while others keep the base id. Cross-role
    // collisions are resolved by construction (each role derives from its own
    // single-key namespace); only the per-role asset batch uses contested-slot
    // rehashing via deriveUniqueNumericAssetIds.
    const roleNamespaceId = (key: string): number => {
        const [assigned] = [...deriveUniqueNumericIds([{ key }]).values()]
        return assigned ?? hashToPositiveInt(key)
    }
    const projectIdNumber = roleNamespaceId(numericIdAssignmentKey.project(input.projectId))
    return {
        selfId: roleNamespaceId(numericIdAssignmentKey.self(input.userId)),
        ownerId: roleNamespaceId(numericIdAssignmentKey.owner(input.metahubId)),
        projectId: projectIdNumber,
        sceneId: roleNamespaceId(numericIdAssignmentKey.scene(input.sceneId)),
        settingsId: `project_${projectIdNumber}`,
        storage: {
            metahubId: input.metahubId,
            projectId: input.projectId,
            sceneId: input.sceneId
        }
    }
}

export const createPlayCanvasEditorNumericAssetId = (assetId: string): number => hashToPositiveInt(`asset:${assetId}`)

export interface PlayCanvasEditorNumericAssetIdInput {
    assetId: string
}

/**
 * Batch counterpart of createPlayCanvasEditorNumericAssetId: derives one numeric
 * document id per asset id for a whole project asset set with collision-safe
 * deterministic assignment, optionally avoiding `reservedIds` already claimed by
 * fixed upstream ids. Non-colliding members keep the exact single-asset value.
 */
export const deriveUniqueNumericAssetIds = (
    inputs: readonly PlayCanvasEditorNumericAssetIdInput[],
    reservedIds?: ReadonlySet<number>
): Map<string, number> =>
    deriveUniqueNumericIds(
        inputs.map((input) => ({ key: `asset:${input.assetId}` })),
        reservedIds
    )

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
            // D4: the launch page surface is deferred; the sentinel path is
            // recognized by the artifact navigation guard and the host page,
            // which fail closed with localized messaging instead of navigating.
            launch: PLAYCANVAS_EDITOR_SURFACE_UNAVAILABLE_PATH,
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
        pages: {
            fullEditor: { kind: 'fullEditor' },
            codeEditor: {
                kind: 'unavailable',
                surface: 'codeEditor',
                reasonKey: PLAYCANVAS_EDITOR_PAGE_UNAVAILABLE_REASONS.codeEditor
            },
            launchPage: {
                kind: 'unavailable',
                surface: 'launchPage',
                reasonKey: PLAYCANVAS_EDITOR_PAGE_UNAVAILABLE_REASONS.launchPage
            },
            blankProjectPicker: {
                kind: 'unavailable',
                surface: 'blankProjectPicker',
                reasonKey: PLAYCANVAS_EDITOR_PAGE_UNAVAILABLE_REASONS.blankProjectPicker
            },
            fontImport: {
                kind: 'unavailable',
                surface: 'fontImport',
                reasonKey: PLAYCANVAS_EDITOR_PAGE_UNAVAILABLE_REASONS.fontImport
            }
        },
        schema: buildEditorSchemaCatalog(),
        engineVersions: {
            force: { version: '2.21.3', description: 'Engine v2.21.3' },
            current: { version: '2.21.3', description: 'Current' }
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

export { SCHEMA_CATALOG_VERSION, buildEditorSchemaCatalog } from './schemaCatalog'
