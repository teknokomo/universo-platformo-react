import express from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import http from 'node:http'
import type { Server } from 'node:http'
import ShareDB from 'sharedb'
import ShareDBClient from 'sharedb/lib/client'
import WebSocket from 'ws'
import {
    PLAYCANVAS_PROJECT_FILE_MAX_BYTES,
    PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_TTL_MS,
    PLAYCANVAS_EDITOR_PACKAGE_NAME,
    PLAYCANVAS_EDITOR_PAGE_UNAVAILABLE_REASONS,
    PLAYCANVAS_EDITOR_SURFACE_UNAVAILABLE_PATH,
    type PlayCanvasEditorCompatibilityProtocolDescriptor,
    type PlayCanvasScene,
    type VersionedLocalizedContent
} from '@universo-react/types'
import {
    attachPlayCanvasEditorFullBootRuntime as attachPlayCanvasEditorFullBootRuntimeRaw,
    createAllowedShareDbDocumentKeys,
    createDefaultRealtimeDocument,
    createCompatibilityCsrfToken,
    createPlayCanvasEditorCompatibilityConfig,
    createPlayCanvasEditorCompatibilityRoutes,
    createPlayCanvasEditorFullBootConfig,
    createPlayCanvasEditorNumericIds,
    createPlayCanvasEditorCompatibilityTokenService,
    grantRealtimeAssetDocuments,
    seedShareDbDocument,
    sendMessengerEvent,
    isPlayCanvasEditorFullBootUpgradeRequest,
    persistShareDbSnapshot,
    ensureArrayPathForJson0ListOperation,
    repairSnapshotForJson0ListOperations
} from './index'
import { normalizeEditorAssetCreateFields, normalizeEditorAssetUpdateFields } from './routes/index'
import {
    MAX_REALTIME_HANDSHAKE_BUFFER_MESSAGES,
    MAX_REALTIME_RELAY_PENDING_BYTES,
    MAX_REALTIME_RELAY_PENDING_MESSAGES,
    assertPlayCanvasEditorRealtimeWorkerTopology
} from './realtime/index'

const uuid = '019e9146-fd1b-7d1d-a858-d1e96485d901'
const sceneId = '019e9147-16c4-738c-ab0f-b98c443ee676'
const localized = (value: string): VersionedLocalizedContent<string> => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: {
            content: value,
            version: 1,
            isActive: true,
            createdAt: '2026-06-05T00:00:00.000Z',
            updatedAt: '2026-06-05T00:00:00.000Z'
        }
    }
})

const protocol: PlayCanvasEditorCompatibilityProtocolDescriptor = {
    schemaVersion: '1',
    mode: 'universo-bridge-minimal',
    upstream: {
        repository: 'https://github.com/playcanvas/editor',
        minimumTag: 'v2.30.4'
    },
    project: null,
    defaultSceneId: sceneId,
    identity: {
        self: { id: 'user-1', role: 'designer' },
        owner: { id: 'metahub-1', type: 'metahub' },
        permissions: { read: true, write: true, admin: false },
        branch: { id: sceneId, name: 'Main', active: true },
        teams: [],
        organizations: []
    },
    endpoints: {
        rest: { status: 'disabled', reason: 'notRequiredForUniversoBridgeMinimal' },
        realtime: { status: 'disabled', reason: 'notRequiredForUniversoBridgeMinimal' },
        messenger: { status: 'disabled', reason: 'notRequiredForUniversoBridgeMinimal' }
    },
    shareDb: {
        requiredCollections: ['scenes', 'assets', 'settings', 'user_data'],
        persisted: false,
        persistence: 'not-implemented',
        sceneStorage: 'metahub-playcanvas-project-storage'
    },
    cloudOnly: {
        store: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' },
        jobs: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' },
        branchesCheckpoints: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' },
        sourcefiles: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' },
        publishing: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' },
        usersCollaboration: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' },
        assetPipeline: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' }
    },
    documents: {
        codeEditorSourcefiles: { status: 'unsupported', reason: 'codeEditorSourcefilesOutsideFirstSlice' }
    },
    settingsDocuments: {
        user: 'user_user-1',
        projectUser: `project_${uuid}_user-1`,
        projectPrivate: `project-private_${uuid}`
    }
}
const numericIds = createPlayCanvasEditorNumericIds({
    metahubId: 'metahub-1',
    projectId: uuid,
    sceneId,
    userId: 'user-1'
})
const fullBootProtocol: PlayCanvasEditorCompatibilityProtocolDescriptor = {
    ...protocol,
    mode: 'universo-full-upstream-ui',
    numericIds,
    endpoints: {
        rest: { status: 'enabled', reason: 'universoFullUpstreamUi' },
        realtime: { status: 'enabled', reason: 'universoFullUpstreamUi' },
        messenger: { status: 'enabled', reason: 'universoFullUpstreamUi' },
        relay: { status: 'enabled', reason: 'universoFullUpstreamUi' }
    },
    shareDb: {
        requiredCollections: ['scenes', 'assets', 'settings', 'user_data'],
        persisted: true,
        persistence: 'snapshot-port',
        sceneStorage: 'metahub-playcanvas-project-storage'
    }
}

const servers: Server[] = []
const tokenService = createPlayCanvasEditorCompatibilityTokenService()
const attachPlayCanvasEditorFullBootRuntime = (
    deps: Parameters<typeof attachPlayCanvasEditorFullBootRuntimeRaw>[0]
): ReturnType<typeof attachPlayCanvasEditorFullBootRuntimeRaw> =>
    attachPlayCanvasEditorFullBootRuntimeRaw({ authorize: async () => undefined, ...deps })
let testServerOrigin = 'http://127.0.0.1'
const originalAllowedArtifactOrigins = process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS
const originalAllowedFullBootWsOrigins = process.env.PLAYCANVAS_EDITOR_FULL_BOOT_WS_ORIGINS
const originalCorsOrigins = process.env.CORS_ORIGINS
const originalNodeEnv = process.env.NODE_ENV
const originalAllowSameHostOrigin = process.env.PLAYCANVAS_EDITOR_ALLOW_SAME_HOST_ORIGIN
const originalPort = process.env.PORT

describe('PlayCanvas Editor user data realtime contract', () => {
    it('allows and seeds only the current scene and current user camera document', () => {
        const claims = {
            metahubId: 'metahub-1',
            projectId: uuid,
            sceneId,
            userId: 'user-1',
            packageSlug: 'playcanvas-editor',
            mode: 'universo-full-upstream-ui',
            origin: 'https://editor-assets.example.test',
            sessionId: 'session-1',
            nonce: 'nonce-1',
            exp: Math.floor(Date.now() / 1000) + 60
        } as const
        const documentId = `${numericIds.sceneId}_${numericIds.selfId}`
        const allowed = createAllowedShareDbDocumentKeys(claims)

        expect(allowed).toContain(`user_data:${documentId}`)
        expect(allowed).not.toContain(`user_data:${numericIds.sceneId}_${numericIds.selfId + 1}`)
        expect(createDefaultRealtimeDocument('user_data', documentId, claims)).toMatchObject({
            cameras: {
                perspective: {
                    position: [9.2, 6, 9],
                    rotation: [-25, 45, 0],
                    focus: [0, 0, 0]
                },
                top: { orthoHeight: 5 },
                bottom: { orthoHeight: 5 },
                front: { orthoHeight: 5 },
                back: { orthoHeight: 5 },
                left: { orthoHeight: 5 },
                right: { orthoHeight: 5 }
            }
        })
    })
})

describe('PlayCanvas Editor ShareDB seed coordination', () => {
    it('serializes concurrent seeds for the same document', async () => {
        const backend = new ShareDB()
        const claims = tokenService.create({
            metahubId: 'metahub-1',
            projectId: uuid,
            sceneId,
            userId: 'user-1',
            packageSlug: 'playcanvas-editor',
            mode: 'universo-full-upstream-ui',
            origin: 'https://editor-assets.example.test',
            sessionId: 'seed-session',
            nonce: 'seed-nonce',
            assetDocumentIds: [700111],
            now: Date.now()
        }).claims
        let activeLoads = 0
        let maximumActiveLoads = 0
        const loadDocument = vi.fn(async ({ collection, documentId }: { collection: string; documentId: string }) => {
            activeLoads += 1
            maximumActiveLoads = Math.max(maximumActiveLoads, activeLoads)
            await new Promise<void>((resolve) => setTimeout(resolve, 10))
            activeLoads -= 1
            return {
                collection: collection as 'assets',
                id: documentId,
                data: { item_id: Number(documentId), name: 'Material', type: 'material', data: {} },
                version: 0,
                checksum: 'checksum-700111',
                revision: 'revision-700111'
            }
        })
        const input = {
            port: { loadDocument, persistDocument: vi.fn(async () => undefined) },
            claims,
            collection: 'assets' as const,
            documentId: '700111'
        }

        await expect(Promise.all([seedShareDbDocument(backend, input), seedShareDbDocument(backend, input)])).resolves.toEqual([
            undefined,
            undefined
        ])
        expect(maximumActiveLoads).toBe(1)

        const connection = backend.connect()
        try {
            const document = connection.get('assets', '700111')
            await new Promise<void>((resolve, reject) => {
                document.fetch((error) => (error ? reject(error) : resolve()))
            })
            expect(document.data).toMatchObject({ item_id: 700111, name: 'Material' })
        } finally {
            connection.close()
        }
    })
})

const createTokenHeader = (projectId = uuid, userId = 'user-1', input: { sceneId?: string; origin?: string } = {}) => {
    const { token } = tokenService.create({
        metahubId: 'metahub-1',
        projectId,
        userId,
        packageSlug: 'playcanvas-editor',
        ...(input.sceneId ? { sceneId: input.sceneId } : {}),
        origin: input.origin ?? testServerOrigin,
        now: Date.now()
    })
    return token
}

const createFullBootToken = (
    input: {
        now?: number
        sessionId?: string
        nonce?: string
        assetDocumentIds?: number[]
        projectId?: string
        origin?: string
    } = {}
) =>
    tokenService.create({
        metahubId: 'metahub-1',
        projectId: input.projectId ?? uuid,
        sceneId,
        userId: 'user-1',
        packageSlug: 'playcanvas-editor',
        mode: 'universo-full-upstream-ui',
        origin: input.origin ?? 'https://editor-assets.example.test',
        sessionId: input.sessionId ?? `session-${Date.now()}-${Math.random()}`,
        nonce: input.nonce ?? `nonce-${Date.now()}-${Math.random()}`,
        assetDocumentIds: input.assetDocumentIds,
        now: input.now
    }).token

const createFullBootTokenForArtifactOrigin = (origin: string, input: { sessionId?: string; nonce?: string } = {}) =>
    tokenService.create({
        metahubId: 'metahub-1',
        projectId: uuid,
        sceneId,
        userId: 'user-1',
        packageSlug: 'playcanvas-editor',
        mode: 'universo-full-upstream-ui',
        origin,
        sessionId: input.sessionId ?? `session-${Date.now()}-${Math.random()}`,
        nonce: input.nonce ?? `nonce-${Date.now()}-${Math.random()}`
    }).token

const waitForEvent = <T>(target: { once: (event: string, listener: (...args: T[]) => void) => void }, event: string): Promise<T> =>
    new Promise((resolve) => target.once(event, (...args) => resolve(args[0] as T)))

const waitForJsonFrame = <T extends Record<string, unknown>>(
    socket: WebSocket,
    predicate: (frame: Record<string, unknown>) => boolean
): Promise<T> =>
    new Promise((resolve) => {
        const listener = (data: { toString: () => string }) => {
            let frame: Record<string, unknown>
            try {
                const parsed = JSON.parse(data.toString())
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
                frame = parsed as Record<string, unknown>
            } catch {
                return
            }
            if (!predicate(frame)) return
            socket.off('message', listener)
            resolve(frame as T)
        }
        socket.on('message', listener)
    })

const createTestServer = async (
    descriptor: PlayCanvasEditorCompatibilityProtocolDescriptor = fullBootProtocol,
    options: {
        assets?: unknown[]
        sourceFiles?: PlayCanvasEditorCompatibilitySourceFileSummary[]
        createAsset?: (input: {
            metahubId: string
            projectId: string
            userId: string
            fields: Record<string, unknown>
            file: { buffer: Buffer; filename: string } | null
        }) => Promise<{ id: number; name: string; type: string; createdAt: string }>
        updateAsset?: (input: {
            metahubId: string
            projectId: string
            userId: string
            documentId: number
            fields: { name?: string; parent?: number }
        }) => Promise<{ id: number; name: string; type: string }>
        deleteAssets?: (input: {
            metahubId: string
            projectId: string
            userId: string
            documentIds: readonly number[]
        }) => Promise<{ deletedDocumentIds: number[] }>
        readAssetFile?: (input: {
            metahubId: string
            projectId: string
            userId: string
            assetId: string
        }) => Promise<{ content: Buffer; mime: string | null; hash: string | null; filename: string } | null>
        readAsset?: (input: {
            metahubId: string
            projectId: string
            userId: string
            documentId: number
            sceneId?: string | null
        }) => Promise<Record<string, unknown> | null>
    } = {}
) => {
    const saveScene = vi.fn(async ({ payload }) => ({
        scene: {
            id: sceneId,
            projectId: uuid,
            displayName: localized('Main Scene'),
            codename: localized('main_scene'),
            payloadSchemaVersion: '1',
            payloadFile: null,
            checksum: 'a'.repeat(64),
            sortOrder: 0,
            publish: true
        } satisfies PlayCanvasScene,
        payload,
        checksum: 'a'.repeat(64)
    }))
    const writeSettings = vi.fn(async ({ kind, data, expectedRevision, requestId }) => ({
        kind,
        documentId: `${kind}-doc`,
        data: { ...data, expectedRevision, requestId },
        revision: 'project-2'
    }))
    const sourceFile = {
        id: 'main-script',
        path: 'scripts/main.mjs',
        name: 'main.mjs',
        hash: 'b'.repeat(64),
        size: 34,
        mime: 'text/javascript',
        updatedAt: '2026-06-10T00:00:00.000Z'
    }
    const writeSourceFile = vi.fn(async ({ sourceFileId, path, name, content }) => ({
        ...sourceFile,
        id: sourceFileId,
        path,
        name: name ?? path.split('/').pop() ?? sourceFile.name,
        content,
        hash: 'c'.repeat(64),
        size: content.length
    }))
    const deleteSourceFile = vi.fn(async ({ sourceFileId }) => ({ id: sourceFileId, deleted: true as const }))
    const listAssets = vi.fn(async () => options.assets ?? [])
    const createAsset = vi.fn(
        options.createAsset ??
            (async ({ fields }) => ({
                id: 700001,
                name: String(fields.name),
                type: String(fields.type),
                createdAt: '2026-08-26T00:00:00.000Z'
            }))
    )
    const updateAsset = vi.fn(
        options.updateAsset ??
            (async ({ documentId, fields }) => ({
                id: documentId,
                name: String(fields.name ?? 'Updated asset'),
                type: 'script'
            }))
    )
    const deleteAssets = vi.fn(options.deleteAssets ?? (async ({ documentIds }) => ({ deletedDocumentIds: Array.from(documentIds) })))
    const readAssetFile = vi.fn(
        options.readAssetFile ??
            (async ({ assetId }) =>
                assetId === '700001'
                    ? {
                          content: Buffer.from('export class FlightControls {}', 'utf8'),
                          mime: 'text/javascript',
                          hash: 'd'.repeat(64),
                          filename: 'flight-controls.mjs'
                      }
                    : null)
    )
    const readAsset = vi.fn(
        options.readAsset ??
            (async ({ documentId }) =>
                documentId === 700001
                    ? {
                          item_id: 700001,
                          name: 'Flight Controls',
                          type: 'script',
                          file: {
                              filename: 'flight-controls.mjs',
                              hash: 'd'.repeat(64),
                              size: 34,
                              url: '',
                              variants: null
                          },
                          path: [],
                          createdAt: '2026-08-26T00:00:00.000Z',
                          tags: ['mmoomm'],
                          data: null,
                          meta: null,
                          preload: true,
                          source: false
                      }
                    : null)
    )
    const app = express()
    app.use(express.json())
    app.use((req, _res, next) => {
        ;(req as typeof req & { user?: { id: string } }).user = { id: 'user-1' }
        next()
    })
    app.use(
        createPlayCanvasEditorCompatibilityRoutes({
            readLimiter: (_req, _res, next) => next(),
            writeLimiter: (_req, _res, next) => next(),
            csrfProtection: (req, res, next) => {
                if (req.get('x-csrf-token') !== 'test-csrf') return res.status(403).json({ error: 'invalid csrf token' })
                next()
            },
            tokenService,
            createHandler: (handler) => (req, res, next) => {
                Promise.resolve(handler({ req, res, metahubId: req.params.metahubId, userId: 'user-1' })).catch(next)
            },
            createProjectPort: () => ({
                describeProtocol: async () => descriptor,
                resolveProject: async () => ({
                    id: uuid,
                    codename: localized('playcanvas_project'),
                    displayName: localized('PlayCanvas Project'),
                    description: null,
                    packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                    packageVersion: '0.1.0',
                    compatibilityStatus: 'compatible',
                    compatibilityNotes: {},
                    schemaVersion: '1',
                    settings: {},
                    defaultSceneId: sceneId,
                    publicationConfig: {},
                    sceneCount: 1,
                    assetCount: 0,
                    scriptCount: 0,
                    generatedArtifactCount: 0,
                    publishable: true,
                    status: 'ready',
                    version: 1
                }),
                listScenes: async () => [
                    {
                        id: sceneId,
                        displayName: localized('Main Scene'),
                        codename: localized('main_scene'),
                        sortOrder: 0,
                        publish: true
                    }
                ],
                readScene: async () => ({
                    scene: {
                        id: sceneId,
                        projectId: uuid,
                        displayName: localized('Main Scene'),
                        codename: localized('main_scene'),
                        payloadSchemaVersion: '1',
                        payloadFile: null,
                        checksum: null,
                        sortOrder: 0,
                        publish: true
                    } satisfies PlayCanvasScene,
                    payload: { schemaVersion: '1', entities: [] }
                }),
                saveScene,
                listAssets,
                readAsset,
                createAsset,
                updateAsset,
                deleteAssets,
                readAssetFile,
                listSourceFiles: async () => options.sourceFiles ?? [sourceFile],
                readSourceFile: async ({ sourceFileId }) => ({
                    ...sourceFile,
                    id: sourceFileId,
                    content: 'export default class MainScript {}'
                }),
                writeSourceFile,
                deleteSourceFile,
                readSettings: async ({ kind }) => ({ kind, documentId: `${kind}-doc`, data: {}, revision: 'project-1' }),
                writeSettings
            })
        })
    )
    const server = app.listen(0)
    servers.push(server)
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
    testServerOrigin = `http://127.0.0.1:${address.port}`
    return {
        baseUrl: testServerOrigin,
        saveScene,
        listAssets,
        createAsset,
        updateAsset,
        deleteAssets,
        readAssetFile,
        readAsset,
        writeSettings,
        writeSourceFile,
        deleteSourceFile
    }
}

beforeEach(() => {
    process.env.PLAYCANVAS_EDITOR_FULL_BOOT_WS_ORIGINS = 'https://editor-assets.example.test'
})

afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
    testServerOrigin = 'http://127.0.0.1'
    if (originalAllowedArtifactOrigins === undefined) {
        delete process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS
    } else {
        process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS = originalAllowedArtifactOrigins
    }
    if (originalAllowedFullBootWsOrigins === undefined) {
        delete process.env.PLAYCANVAS_EDITOR_FULL_BOOT_WS_ORIGINS
    } else {
        process.env.PLAYCANVAS_EDITOR_FULL_BOOT_WS_ORIGINS = originalAllowedFullBootWsOrigins
    }
    if (originalCorsOrigins === undefined) {
        delete process.env.CORS_ORIGINS
    } else {
        process.env.CORS_ORIGINS = originalCorsOrigins
    }
    if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV
    } else {
        process.env.NODE_ENV = originalNodeEnv
    }
    if (originalAllowSameHostOrigin === undefined) {
        delete process.env.PLAYCANVAS_EDITOR_ALLOW_SAME_HOST_ORIGIN
    } else {
        process.env.PLAYCANVAS_EDITOR_ALLOW_SAME_HOST_ORIGIN = originalAllowSameHostOrigin
    }
    if (originalPort === undefined) {
        delete process.env.PORT
    } else {
        process.env.PORT = originalPort
    }
})

describe('PlayCanvas Editor compatibility backend routes', () => {
    it('builds a schema-valid config without admin permissions', () => {
        const config = createPlayCanvasEditorCompatibilityConfig({
            metahubId: 'metahub-1',
            projectId: uuid,
            userId: 'user-1',
            protocol,
            accessToken: createTokenHeader(),
            tokenExpiresAt: Date.now() + 60_000
        })

        expect(config.mode).toBe('universo-compatibility-rest-minimal')
        expect(config.permissions).toEqual({ read: true, write: true, admin: false })
        expect(config.endpoints.scenes).toContain('/playcanvas/editor-compatible/projects/')
        expect(config.endpoints.sourcefiles).toContain('/playcanvas/editor-compatible/projects/')
        expect(config.auth.scheme).toBe('signed-header')
        expect(config.auth.headerName).toBe('X-PlayCanvas-Editor-Token')
        expect(config.auth.accessToken).toBeTruthy()
        expect(config.csrf).toEqual({ tokenUrl: '/api/v1/auth/csrf', headerName: 'X-CSRF-Token' })
    })

    it('serves scenes and persists a scene payload through the injected port', async () => {
        const { baseUrl, saveScene } = await createTestServer()
        const token = createTokenHeader()
        const listResponse = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/scenes`, {
            headers: { 'x-playcanvas-editor-token': token }
        })
        await expect(listResponse.json()).resolves.toMatchObject({ items: [{ id: sceneId }] })

        const requestId = '019e9147-27e7-7ad4-b4e4-02174d3bcfad'
        const saveResponse = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/scenes/${sceneId}`, {
            method: 'PUT',
            headers: { 'x-playcanvas-editor-token': token, 'content-type': 'application/json', 'x-csrf-token': 'test-csrf' },
            body: JSON.stringify({
                requestId,
                expectedCurrentChecksum: 'a'.repeat(64),
                payload: { schemaVersion: '1', entities: [{ id: 'entity-1', name: 'Entity' }] }
            })
        })

        expect(saveResponse.status).toBe(200)
        await expect(saveResponse.json()).resolves.toMatchObject({ ok: true, requestId, item: { checksum: 'a'.repeat(64) } })
        expect(saveScene).toHaveBeenCalledWith(expect.objectContaining({ requestId, sceneId, expectedCurrentChecksum: 'a'.repeat(64) }))
    })

    it('accepts same-origin compatibility REST tokens when browser GET requests omit Origin and Referer', async () => {
        const { baseUrl } = await createTestServer()
        const { token } = tokenService.create({
            metahubId: 'metahub-1',
            projectId: uuid,
            userId: 'user-1',
            packageSlug: 'playcanvas-editor',
            origin: baseUrl,
            now: Date.now()
        })

        const sameOriginResponse = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/scenes`, {
            headers: { 'x-playcanvas-editor-token': token }
        })
        expect(sameOriginResponse.status).toBe(200)

        const hostileRefererResponse = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/scenes`, {
            headers: { 'x-playcanvas-editor-token': token, referer: 'https://attacker.example.test/editor/' }
        })
        expect(hostileRefererResponse.status).toBe(401)
    })

    it('rejects compatibility REST writes when the token origin differs from the request origin', async () => {
        const { baseUrl, writeSettings } = await createTestServer()
        const { token } = tokenService.create({
            metahubId: 'metahub-1',
            projectId: uuid,
            userId: 'user-1',
            packageSlug: 'playcanvas-editor',
            origin: 'https://attacker.example.test'
        })
        const response = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/settings/projectUser`, {
            method: 'PUT',
            headers: {
                origin: baseUrl,
                'x-playcanvas-editor-token': token,
                'x-csrf-token': 'test-csrf',
                'content-type': 'application/json'
            },
            body: JSON.stringify({ requestId: uuid, data: { grid: { snap: true } }, expectedRevision: 'project-1' })
        })

        expect(response.status).toBe(401)
        expect(writeSettings).not.toHaveBeenCalled()
    })

    it('scopes compatibility REST asset summaries to the token scene', async () => {
        const { baseUrl, listAssets } = await createTestServer(fullBootProtocol, {
            assets: [
                {
                    id: 'asset-1',
                    stableAssetId: 'asset-1',
                    type: 'material',
                    name: 'Material',
                    virtualPath: '/',
                    mime: null,
                    hash: null,
                    size: null,
                    editorDocumentId: 123,
                    editorParentDocumentId: null,
                    editorPathDocumentIds: [],
                    createdAt: null
                }
            ]
        })
        const response = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/assets`, {
            headers: { 'x-playcanvas-editor-token': createTokenHeader(uuid, 'user-1', { sceneId }) }
        })

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({ items: [{ editorDocumentId: 123 }] })
        expect(listAssets).toHaveBeenCalledWith(expect.objectContaining({ sceneId }))
    })

    it('serves full-boot asset summaries through the signed full-boot asset allowlist', async () => {
        const { baseUrl, listAssets } = await createTestServer(fullBootProtocol, {
            assets: [
                {
                    id: 'asset-1',
                    stableAssetId: 'asset-1',
                    type: 'material',
                    name: 'Visible Material',
                    virtualPath: '/',
                    mime: null,
                    hash: null,
                    size: null,
                    editorDocumentId: 123,
                    editorParentDocumentId: null,
                    editorPathDocumentIds: [],
                    createdAt: null
                },
                {
                    id: 'asset-2',
                    stableAssetId: 'asset-2',
                    type: 'material',
                    name: 'Hidden Material',
                    virtualPath: '/',
                    mime: null,
                    hash: null,
                    size: null,
                    editorDocumentId: 456,
                    editorParentDocumentId: null,
                    editorPathDocumentIds: [],
                    createdAt: null
                }
            ]
        })
        const response = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/assets`, {
            headers: {
                origin: 'https://editor-assets.example.test',
                'x-playcanvas-editor-token': createFullBootToken({ assetDocumentIds: [123] })
            }
        })

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({ items: [{ editorDocumentId: 123, name: 'Visible Material' }] })
        expect(listAssets).toHaveBeenCalledWith(expect.objectContaining({ sceneId }))
    })

    it('serves full-boot asset metadata through the signed document allowlist', async () => {
        const { baseUrl, readAsset } = await createTestServer()
        const token = createFullBootToken({ assetDocumentIds: [700001] })
        const response = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/assets/700001?branchId=${numericIds.sceneId}`,
            {
                headers: { origin: 'https://editor-assets.example.test', 'x-playcanvas-editor-token': token }
            }
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({
            id: 700001,
            item_id: 700001,
            name: 'Flight Controls',
            file: { filename: 'flight-controls.mjs' }
        })
        expect(readAsset).toHaveBeenCalledWith(expect.objectContaining({ documentId: 700001, sceneId }))

        const hidden = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/assets/700002?branchId=${numericIds.sceneId}`,
            {
                headers: { origin: 'https://editor-assets.example.test', 'x-playcanvas-editor-token': token }
            }
        )
        expect(hidden.status).toBe(404)
        expect(readAsset).toHaveBeenCalledTimes(1)
    })

    it('serves dynamically granted asset metadata after full-boot token issuance', async () => {
        const { baseUrl, readAsset } = await createTestServer()
        grantRealtimeAssetDocuments('metahub-1', uuid, [700001])
        const response = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/assets/700001?branchId=${numericIds.sceneId}`,
            {
                headers: { origin: 'https://editor-assets.example.test', 'x-playcanvas-editor-token': createFullBootToken() }
            }
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({ id: 700001, item_id: 700001 })
        expect(readAsset).toHaveBeenCalledWith(expect.objectContaining({ documentId: 700001, sceneId }))
    })

    it('accepts an upstream multipart script create and normalizes typed fields', async () => {
        const { baseUrl, createAsset } = await createTestServer()
        const token = createFullBootToken()
        const csrfToken = createCompatibilityCsrfToken({
            metahubId: 'metahub-1',
            projectId: uuid,
            userId: 'user-1',
            accessToken: token,
            origin: 'https://editor-assets.example.test'
        })
        const form = new FormData()
        // The vendored upload helper includes transport metadata alongside the
        // domain fields; the compatibility route must strip it before zod
        // validation because project/branch are carried by the URL/token.
        form.set('branchId', 'main')
        form.set('projectId', uuid)
        form.set('source_asset_id', '0')
        form.set('name', 'Pilot script')
        form.set('type', 'script')
        form.set('parent', '42')
        form.set('data', JSON.stringify({ scripts: {}, loading: false }))
        form.set('meta', JSON.stringify({ language: 'javascript' }))
        form.set('tags', 'mmoomm\nflight')
        form.set('preload', 'true')
        form.append('file', new Blob(['export class Pilot {}'], { type: 'text/javascript' }), 'pilot.mjs')

        const response = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/assets`, {
            method: 'POST',
            headers: {
                origin: 'https://editor-assets.example.test',
                'x-playcanvas-editor-token': token,
                'x-csrf-token': csrfToken ?? ''
            },
            body: form
        })

        expect(response.status).toBe(201)
        await expect(response.json()).resolves.toEqual({ id: 700001 })
        expect(createAsset).toHaveBeenCalledWith(
            expect.objectContaining({
                fields: expect.objectContaining({
                    name: 'Pilot script',
                    type: 'script',
                    parent: 42,
                    data: { scripts: {}, loading: false },
                    meta: { language: 'javascript' }
                }),
                file: expect.objectContaining({ filename: 'pilot.mjs' })
            })
        )
        const call = createAsset.mock.calls[0]?.[0]
        expect(call?.file?.buffer.toString('utf8')).toBe('export class Pilot {}')
    })

    it('rejects multipart asset writes without a CSRF proof and never calls the project port', async () => {
        const { baseUrl, createAsset } = await createTestServer()
        const form = new FormData()
        form.set('name', 'Rejected script')
        form.set('type', 'script')
        form.append('file', new Blob(['export class Rejected {}'], { type: 'text/javascript' }), 'rejected.mjs')

        const response = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/assets`, {
            method: 'POST',
            body: form
        })

        expect(response.status).toBe(403)
        expect(createAsset).not.toHaveBeenCalled()
    })

    it('rejects multipart file, file-count, and field-count limit breaches', async () => {
        const fileLimitServer = await createTestServer()
        const token = createFullBootToken({ assetDocumentIds: [700001] })
        const csrfToken = createCompatibilityCsrfToken({
            metahubId: 'metahub-1',
            projectId: uuid,
            userId: 'user-1',
            accessToken: token,
            origin: 'https://editor-assets.example.test'
        })
        const headers = {
            origin: 'https://editor-assets.example.test',
            'x-playcanvas-editor-token': token,
            'x-csrf-token': csrfToken ?? ''
        }
        const oversized = new FormData()
        oversized.set('name', 'Too large')
        oversized.set('type', 'script')
        oversized.append('file', new Blob([Buffer.alloc(PLAYCANVAS_PROJECT_FILE_MAX_BYTES + 1)]), 'too-large.mjs')
        const oversizedResponse = await fetch(
            `${fileLimitServer.baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/assets`,
            {
                method: 'POST',
                headers,
                body: oversized
            }
        )
        expect(oversizedResponse.status).toBe(400)

        const multipleFiles = new FormData()
        multipleFiles.set('name', 'Multiple')
        multipleFiles.set('type', 'script')
        multipleFiles.append('file-a', new Blob(['a']), 'a.mjs')
        multipleFiles.append('file-b', new Blob(['b']), 'b.mjs')
        const multipleFilesResponse = await fetch(
            `${fileLimitServer.baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/assets`,
            {
                method: 'POST',
                headers,
                body: multipleFiles
            }
        )
        expect(multipleFilesResponse.status).toBe(400)

        const tooManyFields = new FormData()
        for (let index = 0; index < 25; index += 1) tooManyFields.set(`field-${index}`, 'value')
        const tooManyFieldsResponse = await fetch(
            `${fileLimitServer.baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/assets`,
            {
                method: 'POST',
                headers,
                body: tooManyFields
            }
        )
        expect(tooManyFieldsResponse.status).toBe(400)
    })

    it('normalizes safe multipart records and rejects prototype-pollution keys', () => {
        expect(
            normalizeEditorAssetCreateFields({
                branchId: 'main',
                projectId: uuid,
                source_asset_id: '0',
                parent: '12',
                data: '{"safe":true}',
                meta: '{}',
                name: 'file',
                type: 'json'
            })
        ).toEqual({
            parent: 12,
            data: { safe: true },
            meta: {},
            name: 'file',
            type: 'json'
        })
        expect(normalizeEditorAssetCreateFields({ parent: '0', name: 'file', type: 'json' })).toBeNull()
        expect(normalizeEditorAssetCreateFields({ data: '{"__proto__":{"polluted":true}}', name: 'file', type: 'json' })).toBeNull()
        const deeplyNested: Record<string, unknown> = {}
        let cursor = deeplyNested
        for (let depth = 0; depth < 40; depth += 1) {
            cursor.next = {}
            cursor = cursor.next as Record<string, unknown>
        }
        expect(normalizeEditorAssetCreateFields({ data: JSON.stringify(deeplyNested), name: 'file', type: 'json' })).toBeNull()
        expect(normalizeEditorAssetUpdateFields({ branchId: 'main', name: 'renamed.mjs' })).toEqual({ name: 'renamed.mjs' })
        expect(normalizeEditorAssetUpdateFields({ name: '', type: 'script' })).toBeNull()
    })

    it('accepts an upstream multipart asset rename and returns the refreshed asset identity', async () => {
        const { baseUrl, updateAsset } = await createTestServer()
        const token = createFullBootToken({ assetDocumentIds: [700001] })
        const csrfToken = createCompatibilityCsrfToken({
            metahubId: 'metahub-1',
            projectId: uuid,
            userId: 'user-1',
            accessToken: token,
            origin: 'https://editor-assets.example.test'
        })
        const form = new FormData()
        form.set('branchId', 'main')
        form.set('name', 'pilot-renamed.mjs')
        const response = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/assets/700001`, {
            method: 'PUT',
            headers: {
                origin: 'https://editor-assets.example.test',
                'x-playcanvas-editor-token': token,
                'x-csrf-token': csrfToken ?? ''
            },
            body: form
        })

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({ id: 700001, name: 'pilot-renamed.mjs', type: 'script' })
        expect(updateAsset).toHaveBeenCalledWith(expect.objectContaining({ documentId: 700001, fields: { name: 'pilot-renamed.mjs' } }))
    })

    it('serves raw asset bytes with MIME and ETag, and returns JSON 404 for a missing file', async () => {
        const { baseUrl } = await createTestServer()
        const token = createTokenHeader()
        const fileUrl = `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/assets/700001/file/pilot.mjs`
        const response = await fetch(fileUrl, { headers: { 'x-playcanvas-editor-token': token } })
        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toMatch(/^text\/javascript/)
        expect(response.headers.get('etag')).toBe(`"${'d'.repeat(64)}"`)
        await expect(response.text()).resolves.toBe('export class FlightControls {}')

        const missing = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/assets/700002/file/missing.mjs`,
            { headers: { 'x-playcanvas-editor-token': token } }
        )
        expect(missing.status).toBe(404)
        await expect(missing.json()).resolves.toMatchObject({ ok: false, code: 'playcanvasEditor.compatibility.notFound' })
    })

    it('answers asset overwrite and unknown compatibility asset paths with JSON, never the SPA HTML fallback', async () => {
        const { baseUrl } = await createTestServer()
        const token = createFullBootToken({ assetDocumentIds: [700001] })
        const csrfToken = createCompatibilityCsrfToken({
            metahubId: 'metahub-1',
            projectId: uuid,
            userId: 'user-1',
            accessToken: token,
            origin: 'https://editor-assets.example.test'
        })
        const headers = {
            origin: 'https://editor-assets.example.test',
            'x-playcanvas-editor-token': token,
            'x-csrf-token': csrfToken ?? ''
        }
        const overwrite = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/assets/700001`, {
            method: 'PUT',
            headers
        })
        expect(overwrite.status).toBe(501)
        await expect(overwrite.json()).resolves.toMatchObject({ ok: false, code: 'playcanvasEditor.compatibility.unsupported' })

        const unknown = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/assets/unknown/extra`, {
            headers
        })
        expect(unknown.status).toBe(404)
        expect(unknown.headers.get('content-type')).toMatch(/application\/json/)
        await expect(unknown.json()).resolves.toMatchObject({ ok: false, code: 'playcanvasEditor.compatibility.notFound' })
    })

    it('deletes requested editor asset document ids and returns upstream 204', async () => {
        const { baseUrl, deleteAssets } = await createTestServer()
        const token = createFullBootToken()
        const csrfToken = createCompatibilityCsrfToken({
            metahubId: 'metahub-1',
            projectId: uuid,
            userId: 'user-1',
            accessToken: token,
            origin: 'https://editor-assets.example.test'
        })
        const response = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/assets`, {
            method: 'DELETE',
            headers: {
                origin: 'https://editor-assets.example.test',
                'x-playcanvas-editor-token': token,
                'x-csrf-token': csrfToken ?? '',
                'content-type': 'application/json'
            },
            body: JSON.stringify({ assets: [700001], branchId: 1 })
        })
        expect(response.status).toBe(204)
        expect(await response.text()).toBe('')
        expect(deleteAssets).toHaveBeenCalledWith(expect.objectContaining({ documentIds: [700001] }))
    })

    it('persists settings through the compatibility endpoint with CSRF and optimistic revision', async () => {
        const { baseUrl, writeSettings } = await createTestServer()
        const token = createTokenHeader()
        const requestId = '019e9147-27e7-7ad4-b4e4-02174d3bcfad'
        const response = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/settings/projectUser`, {
            method: 'PUT',
            headers: { 'x-playcanvas-editor-token': token, 'content-type': 'application/json', 'x-csrf-token': 'test-csrf' },
            body: JSON.stringify({ requestId, data: { grid: { snap: true } }, expectedRevision: 'project-1' })
        })

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({ ok: true, requestId, item: { revision: 'project-2' } })
        expect(writeSettings).toHaveBeenCalledWith(expect.objectContaining({ requestId, expectedRevision: 'project-1' }))
    })

    it('serves and mutates sourcefiles through the compatibility endpoint with CSRF and checksum guards', async () => {
        const { baseUrl, writeSourceFile, deleteSourceFile } = await createTestServer()
        const token = createTokenHeader()
        const listResponse = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/sourcefiles`, {
            headers: { 'x-playcanvas-editor-token': token }
        })
        const listBody = await listResponse.text()
        expect(listResponse.status).toBe(200)
        expect(JSON.parse(listBody)).toMatchObject({ items: [{ id: 'main-script', path: 'scripts/main.mjs' }] })

        const readResponse = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/sourcefiles/main-script`,
            {
                headers: { 'x-playcanvas-editor-token': token }
            }
        )
        await expect(readResponse.json()).resolves.toMatchObject({
            item: { id: 'main-script', content: 'export default class MainScript {}' }
        })

        const requestId = '019e9147-27e7-7ad4-b4e4-02174d3bcfad'
        const writeResponse = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/sourcefiles/main-script`,
            {
                method: 'PUT',
                headers: { 'x-playcanvas-editor-token': token, 'content-type': 'application/json', 'x-csrf-token': 'test-csrf' },
                body: JSON.stringify({
                    requestId,
                    path: 'scripts/main.mjs',
                    content: 'export default class MainScript { initialize() {} }',
                    expectedCurrentChecksum: 'b'.repeat(64)
                })
            }
        )
        expect(writeResponse.status).toBe(200)
        await expect(writeResponse.json()).resolves.toMatchObject({ ok: true, requestId, item: { hash: 'c'.repeat(64) } })
        expect(writeSourceFile).toHaveBeenCalledWith(
            expect.objectContaining({ requestId, sourceFileId: 'main-script', expectedCurrentChecksum: 'b'.repeat(64) })
        )

        const deleteResponse = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/sourcefiles/main-script`,
            {
                method: 'DELETE',
                headers: { 'x-playcanvas-editor-token': token, 'content-type': 'application/json', 'x-csrf-token': 'test-csrf' },
                body: JSON.stringify({ requestId, expectedCurrentChecksum: 'c'.repeat(64) })
            }
        )
        expect(deleteResponse.status).toBe(200)
        await expect(deleteResponse.json()).resolves.toMatchObject({ ok: true, requestId, item: { id: 'main-script', deleted: true } })
        expect(deleteSourceFile).toHaveBeenCalledWith(
            expect.objectContaining({ requestId, sourceFileId: 'main-script', expectedCurrentChecksum: 'c'.repeat(64) })
        )
    })

    it('serves upstream-compatible repository sourcefile reads and deletes for the real Editor API client', async () => {
        const { baseUrl, deleteSourceFile } = await createTestServer()
        const token = createTokenHeader()

        const repositoriesResponse = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/projects/${uuid}/repositories`,
            { headers: { 'x-playcanvas-editor-token': token } }
        )
        await expect(repositoriesResponse.json()).resolves.toMatchObject({ current: 'directory', directory: 'directory' })

        const listResponse = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/projects/${uuid}/repositories/directory/sourcefiles`,
            { headers: { 'x-playcanvas-editor-token': token } }
        )
        await expect(listResponse.json()).resolves.toMatchObject({ result: [{ filename: 'main.mjs' }] })

        const contentResponse = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/projects/${uuid}/repositories/directory/sourcefiles/main.mjs`,
            { headers: { 'x-playcanvas-editor-token': token } }
        )
        expect(contentResponse.status).toBe(200)
        await expect(contentResponse.text()).resolves.toBe('export default class MainScript {}')

        const upstreamDeleteUrl = `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/projects/${uuid}/repositories/directory/sourcefiles/main.mjs?requestId=019e9147-27e7-7ad4-b4e4-02174d3bcfae&expectedCurrentChecksum=${'b'.repeat(
            64
        )}`
        const csrfMissingResponse = await fetch(upstreamDeleteUrl, {
            method: 'DELETE',
            headers: { 'x-playcanvas-editor-token': token }
        })
        expect(csrfMissingResponse.status).toBe(403)
        expect(deleteSourceFile).not.toHaveBeenCalled()

        const checksumMissingResponse = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/projects/${uuid}/repositories/directory/sourcefiles/main.mjs?requestId=019e9147-27e7-7ad4-b4e4-02174d3bcfae`,
            {
                method: 'DELETE',
                headers: { 'x-playcanvas-editor-token': token, 'x-csrf-token': 'test-csrf' }
            }
        )
        expect(checksumMissingResponse.status).toBe(400)
        expect(deleteSourceFile).not.toHaveBeenCalled()

        const deleteResponse = await fetch(upstreamDeleteUrl, {
            method: 'DELETE',
            headers: { 'x-playcanvas-editor-token': token, 'x-csrf-token': 'test-csrf' }
        })
        expect(deleteResponse.status).toBe(200)
        await expect(deleteResponse.json()).resolves.toMatchObject({
            ok: true,
            requestId: '019e9147-27e7-7ad4-b4e4-02174d3bcfae',
            item: { id: 'main-script', deleted: true }
        })
        expect(deleteSourceFile).toHaveBeenCalledWith(
            expect.objectContaining({
                requestId: '019e9147-27e7-7ad4-b4e4-02174d3bcfae',
                sourceFileId: 'main-script',
                expectedCurrentChecksum: 'b'.repeat(64)
            })
        )
    })

    it('fails closed when upstream-compatible sourcefile basename requests are ambiguous', async () => {
        const { baseUrl, deleteSourceFile } = await createTestServer(fullBootProtocol, {
            sourceFiles: [
                {
                    id: 'folder-a-main',
                    path: 'folderA/main.mjs',
                    name: 'main.mjs',
                    hash: 'a'.repeat(64),
                    size: 10,
                    mime: 'text/javascript',
                    updatedAt: '2026-06-10T00:00:00.000Z'
                },
                {
                    id: 'folder-b-main',
                    path: 'folderB/main.mjs',
                    name: 'main.mjs',
                    hash: 'b'.repeat(64),
                    size: 10,
                    mime: 'text/javascript',
                    updatedAt: '2026-06-10T00:00:00.000Z'
                }
            ]
        })
        const token = createTokenHeader()

        const ambiguousRead = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/projects/${uuid}/repositories/directory/sourcefiles/main.mjs`,
            { headers: { 'x-playcanvas-editor-token': token } }
        )
        expect(ambiguousRead.status).toBe(404)

        const exactPathRead = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/projects/${uuid}/repositories/directory/sourcefiles/folderB/main.mjs`,
            { headers: { 'x-playcanvas-editor-token': token } }
        )
        expect(exactPathRead.status).toBe(200)
        await expect(exactPathRead.text()).resolves.toBe('export default class MainScript {}')

        const ambiguousDelete = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/projects/${uuid}/repositories/directory/sourcefiles/main.mjs?requestId=019e9147-27e7-7ad4-b4e4-02174d3bcfaf&expectedCurrentChecksum=${'a'.repeat(
                64
            )}`,
            { method: 'DELETE', headers: { 'x-playcanvas-editor-token': token, 'x-csrf-token': 'test-csrf' } }
        )
        expect(ambiguousDelete.status).toBe(404)
        expect(deleteSourceFile).not.toHaveBeenCalled()
    })

    it('rejects compatibility mutations before handlers when CSRF token is missing', async () => {
        const { baseUrl, saveScene } = await createTestServer()
        const response = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/scenes/${sceneId}`, {
            method: 'PUT',
            headers: { 'x-playcanvas-editor-token': createTokenHeader(), 'content-type': 'application/json' },
            body: JSON.stringify({
                requestId: '019e9147-27e7-7ad4-b4e4-02174d3bcfad',
                payload: { schemaVersion: '1', entities: [] }
            })
        })

        expect(response.status).toBe(403)
        expect(saveScene).not.toHaveBeenCalled()
    })

    it('fails closed on invalid scene save requests and stubs cloud-only surfaces explicitly', async () => {
        const { baseUrl } = await createTestServer()
        const token = createTokenHeader()
        const invalidResponse = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/scenes/${sceneId}`,
            {
                method: 'PUT',
                headers: { 'x-playcanvas-editor-token': token, 'content-type': 'application/json', 'x-csrf-token': 'test-csrf' },
                body: JSON.stringify({ payload: { entities: [] } })
            }
        )
        expect(invalidResponse.status).toBe(400)

        const invalidSettings = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/settings/projectUser`,
            {
                method: 'PUT',
                headers: { 'x-playcanvas-editor-token': token, 'content-type': 'application/json', 'x-csrf-token': 'test-csrf' },
                body: JSON.stringify({ data: { grid: { snap: true } } })
            }
        )
        expect(invalidSettings.status).toBe(400)

        const noOpResponse = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/cloud-only/jobs`, {
            headers: { 'x-playcanvas-editor-token': token }
        })
        await expect(noOpResponse.json()).resolves.toEqual({
            ok: true,
            surface: 'jobs',
            status: 'stubbed',
            reason: 'cloudOnlySurfaceOutsideFirstSlice'
        })
    })

    it('rejects compatibility REST requests without a matching bearer token before project ports are used', async () => {
        const { baseUrl, saveScene } = await createTestServer()
        const missingToken = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/scenes`)
        expect(missingToken.status).toBe(401)

        const wrongProjectToken = createTokenHeader('019e9147-9999-7000-8000-000000000999')
        const wrongToken = await fetch(`${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/scenes/${sceneId}`, {
            method: 'PUT',
            headers: { 'x-playcanvas-editor-token': wrongProjectToken, 'content-type': 'application/json', 'x-csrf-token': 'test-csrf' },
            body: JSON.stringify({
                requestId: '019e9147-27e7-7ad4-b4e4-02174d3bcfad',
                payload: { schemaVersion: '1', entities: [] }
            })
        })
        expect(wrongToken.status).toBe(401)
        expect(saveScene).not.toHaveBeenCalled()
    })

    it('preserves the artifact subpath in full-boot frontend and engine URLs', async () => {
        process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS = 'https://assets.example.test'
        const { baseUrl, listAssets } = await createTestServer()
        const response = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/config?mode=universo-full-upstream-ui&artifactBaseUrl=${encodeURIComponent(
                'https://assets.example.test/editor-artifact/'
            )}`,
            { headers: { origin: 'https://platform.example.test' } }
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({
            item: {
                mode: 'universo-full-upstream-ui',
                url: {
                    frontend: 'https://assets.example.test/editor-artifact/',
                    engine: 'https://assets.example.test/editor-artifact/js/playcanvas-engine.js'
                }
            }
        })
        expect(listAssets).toHaveBeenCalledWith(expect.objectContaining({ sceneId }))
    })

    it('rejects full-boot config when asset realtime document ids collide', async () => {
        process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS = 'https://assets.example.test'
        const { baseUrl } = await createTestServer(fullBootProtocol, {
            assets: [
                { id: 'asset-1', editorDocumentId: 123 },
                { id: 'asset-2', editorDocumentId: 123 }
            ]
        })
        const response = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/config?mode=universo-full-upstream-ui&artifactBaseUrl=${encodeURIComponent(
                'https://assets.example.test/editor-artifact/'
            )}`,
            { headers: { origin: 'https://platform.example.test' } }
        )

        expect(response.status).toBe(400)
    })

    it('rejects hostile full-boot artifact origins instead of minting tokens for them', async () => {
        const { baseUrl } = await createTestServer()
        const response = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/config?mode=universo-full-upstream-ui&artifactBaseUrl=${encodeURIComponent(
                'https://attacker.example.test/editor-artifact/'
            )}`,
            { headers: { origin: 'https://platform.example.test' } }
        )

        expect(response.status).toBe(400)
    })

    it('rejects full-boot config without an explicit trusted artifact origin', async () => {
        const { baseUrl } = await createTestServer()
        const response = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/config?mode=universo-full-upstream-ui`,
            { headers: { origin: 'https://attacker.example.test' } }
        )

        expect(response.status).toBe(400)
    })

    it('rejects full-boot artifact origins that only match the caller origin', async () => {
        const { baseUrl } = await createTestServer()
        const response = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/config?mode=universo-full-upstream-ui&artifactOrigin=${encodeURIComponent(
                'https://attacker.example.test'
            )}`,
            { headers: { origin: 'https://attacker.example.test' } }
        )

        expect(response.status).toBe(400)
    })

    it('rejects full-boot config when the project descriptor still exposes the bridge-minimal contract', async () => {
        const { baseUrl } = await createTestServer(protocol)
        const response = await fetch(
            `${baseUrl}/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/config?mode=universo-full-upstream-ui&artifactBaseUrl=${encodeURIComponent(
                'http://127.0.0.1/editor-artifact/'
            )}`,
            { headers: { origin: 'http://127.0.0.1' } }
        )

        expect(response.status).toBe(400)
    })
})

describe('PlayCanvas Editor full-boot runtime', () => {
    it.each([
        { workerCount: undefined, nodeUniqueId: undefined, expectedError: false, label: 'single process with default settings' },
        { workerCount: '1', nodeUniqueId: undefined, expectedError: false, label: 'single configured worker' },
        { workerCount: '2', nodeUniqueId: undefined, expectedError: true, label: 'multiple configured workers' },
        { workerCount: undefined, nodeUniqueId: '1', expectedError: true, label: 'Node cluster worker' },
        { workerCount: '1', nodeUniqueId: '1', expectedError: true, label: 'Node cluster worker with an explicit single-worker setting' }
    ])('enforces the single-process topology for $label', ({ workerCount, nodeUniqueId, expectedError }) => {
        const previousWorkerCount = process.env.PLAYCANVAS_EDITOR_REALTIME_WORKER_COUNT
        const previousNodeUniqueId = process.env.NODE_UNIQUE_ID
        try {
            if (workerCount === undefined) delete process.env.PLAYCANVAS_EDITOR_REALTIME_WORKER_COUNT
            else process.env.PLAYCANVAS_EDITOR_REALTIME_WORKER_COUNT = workerCount
            if (nodeUniqueId === undefined) delete process.env.NODE_UNIQUE_ID
            else process.env.NODE_UNIQUE_ID = nodeUniqueId

            if (expectedError) {
                expect(() => assertPlayCanvasEditorRealtimeWorkerTopology()).toThrow(
                    /PlayCanvas Editor realtime (?:requires one process|cannot run in a Node cluster worker)/
                )
            } else {
                expect(() => assertPlayCanvasEditorRealtimeWorkerTopology()).not.toThrow()
            }
        } finally {
            if (previousWorkerCount === undefined) delete process.env.PLAYCANVAS_EDITOR_REALTIME_WORKER_COUNT
            else process.env.PLAYCANVAS_EDITOR_REALTIME_WORKER_COUNT = previousWorkerCount
            if (previousNodeUniqueId === undefined) delete process.env.NODE_UNIQUE_ID
            else process.env.NODE_UNIQUE_ID = previousNodeUniqueId
        }
    })

    it('fails closed on malformed full-boot upgrade paths', () => {
        expect(() =>
            isPlayCanvasEditorFullBootUpgradeRequest({
                url: `/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/%E0%A4%A/realtime`
            } as http.IncomingMessage)
        ).not.toThrow()
        expect(
            isPlayCanvasEditorFullBootUpgradeRequest({
                url: `/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/%E0%A4%A/realtime`
            } as http.IncomingMessage)
        ).toBe(false)
    })

    it('rejects full-boot WebSocket upgrades before auth when the Origin is missing or not allowlisted', async () => {
        const server = http.createServer(express())
        servers.push(server)
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async ({ collection, documentId }) => ({ collection, id: documentId, data: {}, version: 0 }),
                persistDocument: async () => undefined
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const wsUrl = `ws://127.0.0.1:${address.port}/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/realtime`

        const expectForbiddenUpgrade = async (socket: WebSocket) => {
            await expect(
                new Promise<number>((resolve, reject) => {
                    socket.once('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0))
                    socket.once('open', () => reject(new Error('Expected full-boot upgrade to be rejected before auth')))
                    socket.once('error', reject)
                })
            ).resolves.toBe(403)
        }

        await expectForbiddenUpgrade(new WebSocket(wsUrl))
        await expectForbiddenUpgrade(new WebSocket(wsUrl, { headers: { Origin: 'https://attacker.example.test' } }))
        await handle.close()
    })

    it('rejects same-host full-boot WebSocket upgrades in production when no origin allow-list is configured', async () => {
        delete process.env.PLAYCANVAS_EDITOR_FULL_BOOT_WS_ORIGINS
        delete process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS
        delete process.env.PLAYCANVAS_EDITOR_ARTIFACT_PUBLIC_ORIGIN
        delete process.env.PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN
        process.env.NODE_ENV = 'production'
        process.env.CORS_ORIGINS = '*'
        const server = http.createServer(express())
        servers.push(server)
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async ({ collection, documentId }) => ({ collection, id: documentId, data: {}, version: 0 }),
                persistDocument: async () => undefined
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const origin = `http://127.0.0.1:${address.port}`
        const realtime = new WebSocket(
            `ws://127.0.0.1:${address.port}/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/realtime`,
            { headers: { Origin: origin } }
        )

        await expect(
            new Promise<number>((resolve, reject) => {
                realtime.once('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0))
                realtime.once('open', () => reject(new Error('Expected production empty origin allow-list to be rejected')))
                realtime.once('error', (error) => reject(error))
            })
        ).resolves.toBe(403)

        await handle.close()
    })

    it('accepts loopback sibling full-boot WebSocket upgrades and still rejects invalid realtime auth', async () => {
        delete process.env.PLAYCANVAS_EDITOR_FULL_BOOT_WS_ORIGINS
        delete process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS
        delete process.env.PLAYCANVAS_EDITOR_ARTIFACT_PUBLIC_ORIGIN
        delete process.env.PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN
        process.env.NODE_ENV = 'development'
        process.env.PLAYCANVAS_EDITOR_ALLOW_SAME_HOST_ORIGIN = 'true'
        const server = http.createServer(express())
        servers.push(server)
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async ({ collection, documentId }) => ({ collection, id: documentId, data: {}, version: 0 }),
                persistDocument: async () => undefined
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        process.env.PORT = String(address.port)
        const wsUrl = `ws://127.0.0.1:${address.port}/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/realtime`
        const socket = new WebSocket(wsUrl, { headers: { Origin: `http://localhost:${address.port}` } })
        await waitForEvent<void>(socket, 'open')
        socket.send(`auth${JSON.stringify({ accessToken: 'invalid-token' })}`)
        await expect(waitForEvent<number>(socket, 'close')).resolves.toBe(4401)
        await handle.close()
    })

    it('rejects same-host full-boot upgrades outside explicit development fallback mode', async () => {
        delete process.env.PLAYCANVAS_EDITOR_FULL_BOOT_WS_ORIGINS
        delete process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS
        delete process.env.PLAYCANVAS_EDITOR_ARTIFACT_PUBLIC_ORIGIN
        delete process.env.PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN
        delete process.env.PLAYCANVAS_EDITOR_ALLOW_SAME_HOST_ORIGIN
        for (const nodeEnv of ['staging', undefined]) {
            if (nodeEnv === undefined) delete process.env.NODE_ENV
            else process.env.NODE_ENV = nodeEnv
            const server = http.createServer(express())
            servers.push(server)
            const handle = attachPlayCanvasEditorFullBootRuntime({
                server,
                tokenService,
                documentPort: {
                    loadDocument: async ({ collection, documentId }) => ({ collection, id: documentId, data: {}, version: 0 }),
                    persistDocument: async () => undefined
                }
            })
            await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
            const address = server.address()
            if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
            const origin = `http://127.0.0.1:${address.port}`
            const realtime = new WebSocket(
                `ws://127.0.0.1:${address.port}/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/realtime`,
                { headers: { Origin: origin } }
            )
            await expect(
                new Promise<number>((resolve, reject) => {
                    realtime.once('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0))
                    realtime.once('open', () => reject(new Error(`Expected ${nodeEnv ?? 'unset'} empty origin allow-list to reject`)))
                    realtime.once('error', (error) => reject(error))
                })
            ).resolves.toBe(403)
            await handle.close()
        }
    })

    it('builds upstream-shaped full-boot config with enabled WebSocket URLs', () => {
        const accessToken = createFullBootToken()
        const config = createPlayCanvasEditorFullBootConfig({
            metahubId: 'metahub-1',
            projectId: uuid,
            sceneId,
            userId: 'user-1',
            projectName: 'PlayCanvas Project',
            accessToken,
            apiOrigin: 'http://127.0.0.1:3000',
            artifactBaseUrl: 'http://127.0.0.1:3000/editor/'
        })

        expect(config.mode).toBe('universo-full-upstream-ui')
        expect(config.project.id).toEqual(expect.any(Number))
        expect(config.project.permissions.read).toEqual([config.self.id])
        expect(config.project.permissions.write).toEqual([config.self.id])
        expect(config.project.permissions.admin).toEqual([])
        expect(config.project.settings.id).toEqual(expect.any(String))
        expect(config.project.settings.scripts).toEqual([])
        expect(config.project.settings.useLegacyScripts).toBe(false)
        expect(config.project.settings.engineV2).toBe(true)
        expect(config.scene.uniqueId).toEqual(expect.any(Number))
        expect(config.schema.version).toBe(1)
        expect(config.schema.documents.settings.properties.editor.properties.cameraClearColor).toMatchObject({
            type: 'array',
            default: [0.118, 0.118, 0.118, 1],
            'x-scope': 'projectUser'
        })
        expect(config.schema.assetData.material.properties).toMatchObject({
            diffuse: { type: 'array', default: [1, 1, 1] },
            opacity: { type: 'number', default: 1 },
            blendType: { type: 'number', default: 0 },
            depthWrite: { type: 'boolean', default: true },
            useFog: { type: 'boolean', default: true },
            shader: { type: 'string', default: 'blinn' }
        })
        expect(Object.keys(config.schema.documents)).toEqual(['asset', 'scene', 'settings'])
        expect(config.engineVersions.force.version).toBe('2.21.4')
        expect(config.engineVersions.current.version).toBe('2.21.4')
        expect(config.url.api).toBe('http://127.0.0.1:3000/api')
        expect(config.universoBridge).toMatchObject({
            compatibilityRestBaseUrl: `http://127.0.0.1:3000/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}`
        })
        expect(String((config.universoBridge as { tokenRefreshUrl?: string }).tokenRefreshUrl)).toContain(
            `http://127.0.0.1:3000/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/config`
        )
        expect(String((config.universoBridge as { tokenRefreshUrl?: string }).tokenRefreshUrl)).toContain(
            `artifactBaseUrl=${encodeURIComponent('http://127.0.0.1:3000/editor/')}`
        )
        expect(config.url.realtime.http).toContain('/realtime')
        expect(config.url.messenger.ws).toContain('/messenger')
        expect(config.url.relay.ws).toContain('/relay')
        expect(config.url.relay.ws).not.toContain('access_token=')
        expect(config.url.relay.ws).not.toContain(encodeURIComponent(accessToken))
        expect(JSON.stringify(config.url)).not.toContain('/disabled')
        expect(config.wasmModules).toEqual([])
    })

    it('marks deferred editor page variants unavailable and uses the safe launch placeholder per D4', () => {
        const config = createPlayCanvasEditorFullBootConfig({
            metahubId: 'metahub-1',
            projectId: uuid,
            sceneId,
            userId: 'user-1',
            projectName: 'PlayCanvas Project',
            accessToken: createFullBootToken(),
            apiOrigin: 'http://127.0.0.1:3000',
            artifactBaseUrl: 'http://127.0.0.1:3000/editor/'
        })

        expect(config.pages.fullEditor).toEqual({ kind: 'fullEditor' })
        expect(config.pages.codeEditor).toEqual({
            kind: 'unavailable',
            surface: 'codeEditor',
            reasonKey: PLAYCANVAS_EDITOR_PAGE_UNAVAILABLE_REASONS.codeEditor
        })
        expect(config.pages.launchPage).toEqual({
            kind: 'unavailable',
            surface: 'launchPage',
            reasonKey: PLAYCANVAS_EDITOR_PAGE_UNAVAILABLE_REASONS.launchPage
        })
        expect(config.pages.blankProjectPicker).toEqual({
            kind: 'unavailable',
            surface: 'blankProjectPicker',
            reasonKey: PLAYCANVAS_EDITOR_PAGE_UNAVAILABLE_REASONS.blankProjectPicker
        })
        expect(config.pages.fontImport).toEqual({
            kind: 'unavailable',
            surface: 'fontImport',
            reasonKey: PLAYCANVAS_EDITOR_PAGE_UNAVAILABLE_REASONS.fontImport
        })
        expect(config.url.launch).toBe(PLAYCANVAS_EDITOR_SURFACE_UNAVAILABLE_PATH)
        expect(config.url.launch).not.toContain('/disabled')
        expect(JSON.stringify(config.url)).not.toContain('/disabled')
    })

    it('omits artifactBaseUrl from full-boot token refresh URLs when the editor frontend is same-origin relative', () => {
        const config = createPlayCanvasEditorFullBootConfig({
            metahubId: 'metahub-1',
            projectId: uuid,
            sceneId,
            userId: 'user-1',
            projectName: 'PlayCanvas Project',
            accessToken: createFullBootToken(),
            apiOrigin: 'http://127.0.0.1:3000'
        })

        const tokenRefreshUrl = String((config.universoBridge as { tokenRefreshUrl?: string }).tokenRefreshUrl)
        expect(tokenRefreshUrl).toContain('mode=universo-full-upstream-ui')
        expect(tokenRefreshUrl).not.toContain('artifactBaseUrl=')
    })

    it('serves realtime auth, messenger welcome, and relay room join over WebSocket upgrade', async () => {
        const app = express()
        const server = http.createServer(app)
        servers.push(server)
        const persisted = new Map<string, Record<string, unknown>>()
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async ({ collection, documentId }) => ({
                    collection,
                    id: documentId,
                    data: persisted.get(`${collection}:${documentId}`) ?? {},
                    version: 0
                }),
                persistDocument: async ({ collection, documentId, data }) => {
                    persisted.set(`${collection}:${documentId}`, data)
                }
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const baseWs = `ws://127.0.0.1:${address.port}/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}`
        const token = createFullBootToken()
        const config = createPlayCanvasEditorFullBootConfig({
            metahubId: 'metahub-1',
            projectId: uuid,
            sceneId,
            userId: 'user-1',
            projectName: 'PlayCanvas Project',
            accessToken: token,
            apiOrigin: `http://127.0.0.1:${address.port}`
        })

        const wsOptions = { headers: { Origin: 'https://editor-assets.example.test' } }
        const realtime = new WebSocket(`${baseWs}/realtime`, wsOptions)
        await new Promise<void>((resolve) => realtime.once('open', resolve))
        realtime.send(`auth${JSON.stringify({ accessToken: token })}`)
        await expect(new Promise((resolve) => realtime.once('message', (data) => resolve(data.toString())))).resolves.toMatch(/^auth/)
        realtime.close()

        // The REST asset create can finish after the browser opens the socket
        // but before the authenticate frame is processed. The realtime layer
        // must retain that push and flush it after `welcome`.
        sendMessengerEvent('metahub-1', uuid, 'asset.new', { asset: { id: '699999', status: 'complete' } })
        const messenger = new WebSocket(`${baseWs}/messenger`, wsOptions)
        await new Promise<void>((resolve) => messenger.once('open', resolve))
        const queuedAssetPush = new Promise((resolve) => {
            const handleMessage = (data: { toString: () => string }) => {
                const message = JSON.parse(data.toString()) as { name?: string; data?: { asset?: { id?: string } } }
                if (message.name !== 'asset.new' || message.data?.asset?.id !== '699999') return
                messenger.off('message', handleMessage)
                resolve(message)
            }
            messenger.on('message', handleMessage)
        })
        messenger.send(JSON.stringify({ name: 'authenticate', token, type: 'designer' }))
        await expect(
            new Promise((resolve) => messenger.once('message', (data) => resolve(JSON.parse(data.toString()))))
        ).resolves.toMatchObject({
            name: 'welcome'
        })
        await expect(queuedAssetPush).resolves.toEqual({
            name: 'asset.new',
            data: { asset: { id: '699999', status: 'complete' } }
        })
        messenger.send(JSON.stringify('ping'))
        await expect(new Promise((resolve) => messenger.once('message', (data) => resolve(data.toString())))).resolves.toBe('pong')
        messenger.send(JSON.stringify({ name: 'project.watch', target: { type: 'general' }, env: ['*'], data: { id: 1 } }))
        await expect(
            new Promise((resolve) => messenger.once('message', (data) => resolve(JSON.parse(data.toString()))))
        ).resolves.toMatchObject({
            name: 'project.watch',
            ok: true
        })
        const messengerPush = new Promise((resolve) => messenger.once('message', (data) => resolve(JSON.parse(data.toString()))))
        grantRealtimeAssetDocuments('metahub-1', uuid, [700001])
        sendMessengerEvent('metahub-1', uuid, 'asset.new', { asset: { id: '700001', status: 'complete' } })
        await expect(messengerPush).resolves.toEqual({
            name: 'asset.new',
            data: { asset: { id: '700001', status: 'complete' } }
        })
        messenger.close()

        const noAuthRelay = new WebSocket(`${baseWs}/relay`, wsOptions)
        await new Promise<void>((resolve) => noAuthRelay.once('open', resolve))
        noAuthRelay.send(JSON.stringify({ t: 'room:join', name: 'project:1' }))
        await expect(
            Promise.race([
                new Promise((resolve) => noAuthRelay.once('message', (data) => resolve(JSON.parse(data.toString())))),
                new Promise((resolve) => setTimeout(() => resolve(null), 100))
            ])
        ).resolves.toBeNull()
        noAuthRelay.close()

        const relay = new WebSocket(config.url.relay.ws, wsOptions)
        const numericUserId = config.self.id
        const relayWelcome = new Promise((resolve) => relay.once('message', (data) => resolve(JSON.parse(data.toString()))))
        await new Promise<void>((resolve) => relay.once('open', resolve))
        relay.send(JSON.stringify({ t: 'authenticate', token }))
        await expect(relayWelcome).resolves.toMatchObject({
            t: 'welcome',
            userId: numericUserId
        })
        relay.send(JSON.stringify({ t: 'room:join', name: 'project:1', authentication: { type: 'project', id: 1 } }))
        await expect(
            new Promise((resolve) => relay.once('message', (data) => resolve(JSON.parse(data.toString()))))
        ).resolves.toMatchObject({
            t: 'room:join',
            name: 'project:1',
            users: [numericUserId]
        })
        relay.send(JSON.stringify('ping'))
        await expect(new Promise((resolve) => relay.once('message', (data) => resolve(data.toString())))).resolves.toBe('pong')
        relay.close()
        await handle.close()
    })

    it('reconciles authenticated asset scopes and emits new/delete messenger diffs', async () => {
        const server = http.createServer(express())
        servers.push(server)
        const initialDocument = {
            id: 2_100_001,
            branchId: 1_100_001,
            source: false,
            status: 'complete',
            type: 'script',
            sourceAssetId: '0',
            createdAt: '2026-08-28T00:00:00.000Z'
        }
        const addedDocument = {
            id: 2_100_002,
            branchId: 1_100_001,
            source: false,
            status: 'complete',
            type: 'script',
            sourceAssetId: '0',
            createdAt: '2026-08-28T00:01:00.000Z'
        }
        let currentDocuments = [initialDocument]
        let listCalls = 0
        const listAssetDocuments = vi.fn(async () => {
            listCalls += 1
            return listCalls === 1 ? [initialDocument] : currentDocuments
        })
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            assetReconciliationIntervalMs: 25,
            documentPort: {
                loadDocument: async ({ collection, documentId }) => ({ collection, id: documentId, data: {}, version: 0 }),
                persistDocument: async () => undefined,
                listAssetDocuments
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const baseWs = `ws://127.0.0.1:${address.port}/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}`
        const token = createFullBootToken()
        const messenger = new WebSocket(`${baseWs}/messenger`, { headers: { Origin: 'https://editor-assets.example.test' } })
        const receivedFrames: Record<string, unknown>[] = []
        messenger.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString())
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    receivedFrames.push(parsed as Record<string, unknown>)
                }
            } catch {
                // Ignore non-JSON protocol frames in the collector.
            }
        })
        const waitForCollectedFrame = (predicate: (frame: Record<string, unknown>) => boolean) =>
            vi.waitFor(() => {
                const frame = receivedFrames.find(predicate)
                expect(frame).toBeDefined()
                return frame
            })

        try {
            await waitForEvent<void>(messenger, 'open')
            const welcome = waitForJsonFrame(messenger, (frame) => frame.name === 'welcome')
            messenger.send(JSON.stringify({ name: 'authenticate', token, type: 'designer' }))
            await expect(welcome).resolves.toMatchObject({ name: 'welcome' })
            // The reconciliation interval is intentionally short in this test;
            // only assert that the initial poll completed, not an exact call
            // count that can race with the next interval tick.
            await vi.waitFor(() => expect(listAssetDocuments).toHaveBeenCalled())

            currentDocuments = [initialDocument, addedDocument]
            await expect(
                waitForCollectedFrame(
                    (frame) =>
                        frame.name === 'asset.new' && (frame.data as { asset?: { id?: string } })?.asset?.id === String(addedDocument.id)
                )
            ).resolves.toMatchObject({
                name: 'asset.new',
                data: { asset: { id: String(addedDocument.id), type: 'script', status: 'complete' } }
            })

            currentDocuments = [addedDocument]
            await expect(
                waitForCollectedFrame(
                    (frame) =>
                        frame.name === 'asset.delete' && (frame.data as { asset?: { id?: number } })?.asset?.id === initialDocument.id
                )
            ).resolves.toEqual({ name: 'asset.delete', data: { asset: { id: initialDocument.id } } })
        } finally {
            messenger.close()
            await handle.close()
        }
    })

    it('dispatches fs delete control frames and broadcasts the upstream asset.delete messenger frame', async () => {
        const server = http.createServer(express())
        servers.push(server)
        const deleteAssetId = 700101
        const deleteAssets = vi.fn(async () => ({ deletedDocumentIds: [deleteAssetId] }))
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async ({ collection, documentId }) => ({ collection, id: documentId, data: {}, version: 0 }),
                persistDocument: async () => undefined,
                deleteAssets
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const baseWs = `ws://127.0.0.1:${address.port}/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}`
        const token = createFullBootToken({ assetDocumentIds: [deleteAssetId] })
        const wsOptions = { headers: { Origin: 'https://editor-assets.example.test' } }
        const messenger = new WebSocket(`${baseWs}/messenger`, wsOptions)
        let realtime: WebSocket | null = null

        try {
            await waitForEvent<void>(messenger, 'open')
            const welcome = waitForJsonFrame(messenger, (frame) => frame.name === 'welcome')
            messenger.send(JSON.stringify({ name: 'authenticate', token, type: 'designer' }))
            await expect(welcome).resolves.toMatchObject({ name: 'welcome' })

            realtime = new WebSocket(`${baseWs}/realtime`, wsOptions)
            await waitForEvent<void>(realtime, 'open')
            const auth = waitForEvent<Buffer>(realtime, 'message').then((data) => data.toString())
            realtime.send(`auth${JSON.stringify({ accessToken: token })}`)
            await expect(auth).resolves.toMatch(/^auth/)

            const deleted = waitForJsonFrame(messenger, (frame) => frame.name === 'asset.delete')
            realtime.send(`fs${JSON.stringify({ op: 'delete', ids: [deleteAssetId] })}`)

            await expect(deleted).resolves.toEqual({ name: 'asset.delete', data: { asset: { id: deleteAssetId } } })
            expect(deleteAssets).toHaveBeenCalledWith({
                metahubId: 'metahub-1',
                projectId: uuid,
                sceneId,
                userId: 'user-1',
                documentIds: [deleteAssetId]
            })
        } finally {
            messenger.close()
            realtime?.close()
            await handle.close()
        }
    })

    it('rejects fs delete control frames for asset documents outside the signed allow-list', async () => {
        const server = http.createServer(express())
        servers.push(server)
        const deleteAssets = vi.fn(async () => ({ deletedDocumentIds: [700002] }))
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async ({ collection, documentId }) => ({ collection, id: documentId, data: {}, version: 0 }),
                persistDocument: async () => undefined,
                deleteAssets
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const baseWs = `ws://127.0.0.1:${address.port}/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}`
        const token = createFullBootToken({ assetDocumentIds: [700003] })
        const wsOptions = { headers: { Origin: 'https://editor-assets.example.test' } }
        const realtime = new WebSocket(`${baseWs}/realtime`, wsOptions)

        try {
            await waitForEvent<void>(realtime, 'open')
            const auth = waitForEvent<Buffer>(realtime, 'message').then((data) => data.toString())
            realtime.send(`auth${JSON.stringify({ accessToken: token })}`)
            await expect(auth).resolves.toMatch(/^auth/)

            const closed = waitForEvent<number>(realtime, 'close')
            realtime.send(`fs${JSON.stringify({ op: 'delete', ids: [700002] })}`)

            await expect(closed).resolves.toBe(1008)
            expect(deleteAssets).not.toHaveBeenCalled()
        } finally {
            realtime.close()
            await handle.close()
        }
    })

    it('dispatches script-attributes pipeline frames into ShareDB asset data and signals completion', async () => {
        const server = http.createServer(express())
        servers.push(server)
        const parsedAttributes = {
            attributes: [{ name: 'speed', type: 'number', default: 2 }],
            attributesOrder: ['speed'],
            attributesInvalid: false
        }
        const persistDocument = vi.fn(async () => undefined)
        const loadDocument = vi.fn(async ({ collection, documentId }) => ({
            collection,
            id: documentId,
            data:
                collection === 'assets' && documentId === '700003'
                    ? {
                          item_id: 700003,
                          name: 'Pilot',
                          type: 'script',
                          data: { scripts: {}, loading: true }
                      }
                    : {},
            version: 0
        }))
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument,
                persistDocument
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const baseWs = `ws://127.0.0.1:${address.port}/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}`
        const token = createFullBootToken({ assetDocumentIds: [700003] })
        const wsOptions = { headers: { Origin: 'https://editor-assets.example.test' } }
        const messenger = new WebSocket(`${baseWs}/messenger`, wsOptions)
        let realtime: WebSocket | null = null

        try {
            await waitForEvent<void>(messenger, 'open')
            const welcome = waitForJsonFrame(messenger, (frame) => frame.name === 'welcome')
            messenger.send(JSON.stringify({ name: 'authenticate', token, type: 'designer' }))
            await expect(welcome).resolves.toMatchObject({ name: 'welcome' })

            realtime = new WebSocket(`${baseWs}/realtime`, wsOptions)
            await waitForEvent<void>(realtime, 'open')
            const auth = waitForEvent<Buffer>(realtime, 'message').then((data) => data.toString())
            realtime.send(`auth${JSON.stringify({ accessToken: token })}`)
            await expect(auth).resolves.toMatch(/^auth/)

            const completion = waitForJsonFrame(messenger, (frame) => frame.name === 'scriptAttrsFinished:job-1')
            const pipelineFrame = {
                data: {
                    script_task_type: 'handle_parsed_script' as const,
                    job_id: 'job-1',
                    asset_id: 700003,
                    parse_result: { scripts: { Pilot: parsedAttributes } }
                }
            }
            realtime.send(`pipeline${JSON.stringify(pipelineFrame)}`)

            await expect(completion).resolves.toEqual({ name: 'scriptAttrsFinished:job-1', data: { ok: true } })
            const persistCallsAfterFirstPipeline = persistDocument.mock.calls.length
            const duplicateCompletion = waitForJsonFrame(messenger, (frame) => frame.name === 'scriptAttrsFinished:job-1')
            realtime.send(`pipeline${JSON.stringify(pipelineFrame)}`)
            await expect(duplicateCompletion).resolves.toEqual({ name: 'scriptAttrsFinished:job-1', data: { ok: true } })
            await new Promise((resolve) => setTimeout(resolve, 25))
            expect(persistDocument).toHaveBeenCalledTimes(persistCallsAfterFirstPipeline)
            expect(persistDocument).toHaveBeenCalledWith(
                expect.objectContaining({
                    collection: 'assets',
                    documentId: '700003',
                    data: expect.objectContaining({
                        data: {
                            scripts: { Pilot: parsedAttributes },
                            loading: false
                        }
                    })
                })
            )
            expect(loadDocument).toHaveBeenCalledWith(expect.objectContaining({ collection: 'assets', documentId: '700003' }))

            const failedCompletion = waitForJsonFrame(messenger, (frame) => frame.name === 'scriptAttrsFinished:job-2')
            realtime.send(
                `pipeline${JSON.stringify({
                    data: {
                        script_task_type: 'handle_parsed_script',
                        job_id: 'job-2',
                        asset_id: 700003,
                        parse_result: { scripts: 'malformed' }
                    }
                })}`
            )
            await expect(failedCompletion).resolves.toEqual({
                name: 'scriptAttrsFinished:job-2',
                data: { ok: false, code: 'invalidPipelineFrame' }
            })
        } finally {
            messenger.close()
            realtime?.close()
            await handle.close()
        }
    })

    it('matches full-boot WebSocket upgrade requests against a custom base path', async () => {
        const server = http.createServer(express())
        servers.push(server)
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            basePath: '/custom/metahub',
            tokenService,
            documentPort: {
                loadDocument: async ({ collection, documentId }) => ({ collection, id: documentId, data: {}, version: 0 }),
                persistDocument: async () => undefined
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')

        expect(
            isPlayCanvasEditorFullBootUpgradeRequest(
                {
                    url: `/custom/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/relay`
                } as http.IncomingMessage,
                '/custom/metahub'
            )
        ).toBe(true)
        expect(
            isPlayCanvasEditorFullBootUpgradeRequest({
                url: `/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/relay`
            } as http.IncomingMessage)
        ).toBe(true)

        const token = createFullBootToken()
        const relay = new WebSocket(
            `ws://127.0.0.1:${address.port}/custom/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/relay`,
            { headers: { Origin: 'https://editor-assets.example.test' } }
        )
        await new Promise<void>((resolve) => relay.once('open', resolve))
        const relayWelcome = new Promise((resolve) => relay.once('message', (data) => resolve(JSON.parse(data.toString()))))
        relay.send(JSON.stringify({ t: 'authenticate', token }))
        await expect(relayWelcome).resolves.toMatchObject({
            t: 'welcome'
        })
        relay.close()
        await handle.close()
    })

    it('serves a ShareDB scene document after full-boot realtime auth', async () => {
        const app = express()
        const server = http.createServer(app)
        servers.push(server)
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async () => null,
                persistDocument: async () => undefined
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const token = createFullBootToken()
        const config = createPlayCanvasEditorFullBootConfig({
            metahubId: 'metahub-1',
            projectId: uuid,
            sceneId,
            userId: 'user-1',
            projectName: 'PlayCanvas Project',
            accessToken: token,
            apiOrigin: `http://127.0.0.1:${address.port}`
        })
        const realtime = new WebSocket(config.url.realtime.http, { headers: { Origin: 'https://editor-assets.example.test' } })
        try {
            await new Promise<void>((resolve) => realtime.once('open', resolve))
            realtime.send(`auth${JSON.stringify({ accessToken: token })}`)
            await expect(new Promise((resolve) => realtime.once('message', (data) => resolve(data.toString())))).resolves.toMatch(/^auth/)

            realtime.send(JSON.stringify({ a: 's', c: 'scenes', d: String(config.scene.uniqueId), v: null }))
            await expect(
                new Promise((resolve) => realtime.once('message', (data) => resolve(JSON.parse(data.toString()))))
            ).resolves.toMatchObject({
                a: 's',
                c: 'scenes',
                d: String(config.scene.uniqueId),
                data: {
                    data: {
                        item_id: config.scene.id,
                        entities: {
                            root: {
                                resource_id: 'root',
                                children: []
                            }
                        }
                    }
                }
            })
            realtime.send(`close:scene:${config.scene.uniqueId}`)
            realtime.send('close:document:project_user_settings')
            realtime.send('selection{"ids":["root"]}')
            realtime.send('pipeline{"name":"noop"}')
            realtime.send(JSON.stringify({ a: 'pp' }))
            await expect(
                new Promise((resolve) => realtime.once('message', (data) => resolve(JSON.parse(data.toString()))))
            ).resolves.toMatchObject({
                a: 'pp'
            })
        } finally {
            realtime.close()
            await handle.close()
        }
    })

    it('keeps the realtime socket open for the upstream ShareDB client handshake and scene subscribe', async () => {
        const app = express()
        const server = http.createServer(app)
        servers.push(server)
        const persistDocument = vi.fn(async () => undefined)
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async () => null,
                persistDocument
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const token = createFullBootToken()
        const config = createPlayCanvasEditorFullBootConfig({
            metahubId: 'metahub-1',
            projectId: uuid,
            sceneId,
            userId: 'user-1',
            projectName: 'PlayCanvas Project',
            accessToken: token,
            apiOrigin: `http://127.0.0.1:${address.port}`
        })
        const realtime = new WebSocket(config.url.realtime.http, { headers: { Origin: 'https://editor-assets.example.test' } })
        try {
            const closed = vi.fn()
            realtime.on('close', closed)
            await waitForEvent<void>(realtime, 'open')
            realtime.send(`auth${JSON.stringify({ accessToken: token })}`)
            await expect(waitForEvent<Buffer>(realtime, 'message').then((data) => data.toString())).resolves.toMatch(/^auth/)

            const connection = new ShareDBClient.Connection(realtime)
            const doc = connection.get('scenes', String(config.scene.uniqueId))
            doc.subscribe()
            await waitForEvent<void>(doc, 'load')

            expect(doc.data).toMatchObject({
                item_id: config.scene.id,
                entities: {
                    root: {
                        resource_id: 'root',
                        children: []
                    }
                }
            })
            connection.ping()
            await new Promise((resolve) => setTimeout(resolve, 25))
            expect(closed).not.toHaveBeenCalled()
            expect(persistDocument).not.toHaveBeenCalled()
            connection.close()
        } finally {
            realtime.close()
            await handle.close()
        }
    })

    it('buffers ShareDB frames sent while realtime authentication is still hydrating documents', async () => {
        const app = express()
        const server = http.createServer(app)
        servers.push(server)
        let releaseHydration = () => undefined
        const hydration = new Promise<void>((resolve) => {
            releaseHydration = resolve
        })
        const loadDocument = vi.fn(async () => {
            await hydration
            return null
        })
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument,
                persistDocument: async () => undefined
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const token = createFullBootToken()
        const config = createPlayCanvasEditorFullBootConfig({
            metahubId: 'metahub-1',
            projectId: uuid,
            sceneId,
            userId: 'user-1',
            projectName: 'PlayCanvas Project',
            accessToken: token,
            apiOrigin: `http://127.0.0.1:${address.port}`
        })
        const realtime = new WebSocket(config.url.realtime.http, { headers: { Origin: 'https://editor-assets.example.test' } })
        try {
            await waitForEvent<void>(realtime, 'open')
            realtime.send(`auth${JSON.stringify({ accessToken: token })}`)
            await vi.waitFor(() => expect(loadDocument).toHaveBeenCalledWith(expect.objectContaining({ collection: 'scenes' })))

            const subscribed = waitForJsonFrame(
                realtime,
                (frame) => frame.a === 's' && frame.c === 'scenes' && frame.d === String(config.scene.uniqueId)
            )
            realtime.send(JSON.stringify({ a: 's', c: 'scenes', d: String(config.scene.uniqueId), v: null }))
            releaseHydration()

            await expect(subscribed).resolves.toMatchObject({
                a: 's',
                c: 'scenes',
                d: String(config.scene.uniqueId)
            })
        } finally {
            releaseHydration()
            realtime.close()
            await handle.close()
        }
    })

    it('closes a realtime socket when the pre-listen handshake buffer reaches its bounded limit', async () => {
        const app = express()
        const server = http.createServer(app)
        servers.push(server)
        let releaseHydration = () => undefined
        const hydration = new Promise<void>((resolve) => {
            releaseHydration = resolve
        })
        const loadDocument = vi.fn(async () => {
            await hydration
            return null
        })
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument,
                persistDocument: async () => undefined
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const token = createFullBootToken()
        const config = createPlayCanvasEditorFullBootConfig({
            metahubId: 'metahub-1',
            projectId: uuid,
            sceneId,
            userId: 'user-1',
            projectName: 'PlayCanvas Project',
            accessToken: token,
            apiOrigin: `http://127.0.0.1:${address.port}`
        })
        const realtime = new WebSocket(config.url.realtime.http, { headers: { Origin: 'https://editor-assets.example.test' } })
        try {
            await waitForEvent<void>(realtime, 'open')
            const closed = new Promise<{ code: number; reason: string }>((resolve) => {
                realtime.once('close', (code, reason) => resolve({ code, reason: reason.toString() }))
            })
            realtime.send(`auth${JSON.stringify({ accessToken: token })}`)
            await vi.waitFor(() => expect(loadDocument).toHaveBeenCalledWith(expect.objectContaining({ collection: 'scenes' })))

            for (let index = 0; index <= MAX_REALTIME_HANDSHAKE_BUFFER_MESSAGES; index += 1) {
                realtime.send(JSON.stringify({ a: 'p' }))
            }

            await expect(closed).resolves.toEqual({
                code: 1008,
                reason: 'playcanvasEditor.fullBoot.handshakeBufferExceeded'
            })
        } finally {
            releaseHydration()
            realtime.close()
            await handle.close()
        }
    }, 20_000)

    it('repairs empty settings snapshots for upstream nested JSON0 list operations', () => {
        const data: Record<string, unknown> = {}

        expect(repairSnapshotForJson0ListOperations(data, [{ p: ['editor', 'cameraClearColor', 0], li: 0.118 }])).toBe(1)
        expect(data).toEqual({ editor: { cameraClearColor: [] } })
    })

    it('traverses existing arrays without corrupting them while repairing nested JSON0 list operations', () => {
        const row = { values: undefined }
        const data: Record<string, unknown> = { rows: [row] }

        expect(repairSnapshotForJson0ListOperations(data, [{ p: ['rows', 0, 'values', 0], li: 'value' }])).toBe(1)
        expect(data).toEqual({ rows: [{ values: [] }] })
        expect((data.rows as unknown[])[0]).toBe(row)
    })

    it('does not mutate snapshots when JSON0 list-operation paths contain incompatible values', () => {
        const incompatibleParent: Record<string, unknown> = { editor: { cameraClearColor: 'black' } }
        const missingArrayEntry: Record<string, unknown> = { rows: [] }

        expect(repairSnapshotForJson0ListOperations(incompatibleParent, [{ p: ['editor', 'cameraClearColor', 0], li: 0.118 }])).toBe(0)
        expect(incompatibleParent).toEqual({ editor: { cameraClearColor: 'black' } })
        expect(repairSnapshotForJson0ListOperations(missingArrayEntry, [{ p: ['rows', 0, 'values', 0], li: 'value' }])).toBe(0)
        expect(missingArrayEntry).toEqual({ rows: [] })
    })

    it('rejects prototype-polluting JSON0 list paths before traversing or mutating snapshots', () => {
        const marker = '__playcanvas_json0_test_polluted__'
        const objectPrototype = Object.prototype as Record<string, unknown>
        const previousValue = objectPrototype[marker]
        const data: Record<string, unknown> = {}

        try {
            for (const path of [
                ['__proto__', marker, 0],
                ['constructor', 'prototype', marker, 0],
                ['prototype', marker, 0]
            ]) {
                expect(ensureArrayPathForJson0ListOperation(data, { p: path })).toBe(false)
            }
            expect(objectPrototype[marker]).toBe(previousValue)
            expect(data).toEqual({})
        } finally {
            if (previousValue === undefined) {
                delete objectPrototype[marker]
            } else {
                objectPrototype[marker] = previousValue
            }
        }
    })

    it('seeds signed full-boot asset documents before upstream Editor asset subscription', async () => {
        const app = express()
        const server = http.createServer(app)
        servers.push(server)
        const materialDocumentId = 123456
        const materialData = {
            item_id: materialDocumentId,
            name: 'Visual Linkup Core Material',
            type: 'material',
            file: null,
            path: [],
            tags: [],
            data: {
                diffuse: [1, 1, 1],
                opacity: 0.58,
                blendType: 2,
                depthWrite: false,
                useFog: true,
                shader: 'blinn'
            },
            meta: null,
            preload: true,
            source: false,
            branch_id: numericIds.sceneId,
            project: numericIds.projectId
        }
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async ({ collection, documentId }) => ({
                    collection,
                    id: documentId,
                    data: collection === 'assets' && documentId === String(materialDocumentId) ? materialData : {},
                    version: 0
                }),
                persistDocument: async () => undefined
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const token = createFullBootToken({ assetDocumentIds: [materialDocumentId] })
        const config = createPlayCanvasEditorFullBootConfig({
            metahubId: 'metahub-1',
            projectId: uuid,
            sceneId,
            userId: 'user-1',
            projectName: 'PlayCanvas Project',
            accessToken: token,
            apiOrigin: `http://127.0.0.1:${address.port}`
        })
        const realtime = new WebSocket(config.url.realtime.http, { headers: { Origin: 'https://editor-assets.example.test' } })
        try {
            await waitForEvent<void>(realtime, 'open')
            realtime.send(`auth${JSON.stringify({ accessToken: token })}`)
            await expect(waitForEvent<Buffer>(realtime, 'message').then((data) => data.toString())).resolves.toMatch(/^auth/)

            const connection = new ShareDBClient.Connection(realtime)
            const doc = connection.get('assets', String(materialDocumentId))
            doc.subscribe()
            await waitForEvent<void>(doc, 'load')

            expect(doc.data).toMatchObject(materialData)
            connection.close()
        } finally {
            realtime.close()
            await handle.close()
        }
    })

    it('extends a reused scoped realtime backend with signed asset documents from the next token', async () => {
        const app = express()
        const server = http.createServer(app)
        servers.push(server)
        const materialDocumentId = 654321
        const materialData = {
            item_id: materialDocumentId,
            name: 'Visual Linkup Reused Scope Material',
            type: 'material',
            file: null,
            path: [],
            tags: [],
            data: {
                diffuse: [0.3, 0.85, 1],
                opacity: 0.72,
                blendType: 2,
                depthWrite: false,
                useFog: true,
                shader: 'blinn'
            },
            meta: null,
            preload: true,
            source: false,
            branch_id: numericIds.sceneId,
            project: numericIds.projectId
        }
        const loadDocument = vi.fn(async ({ collection, documentId }) => ({
            collection,
            id: documentId,
            data: collection === 'assets' && documentId === String(materialDocumentId) ? materialData : {},
            version: 0
        }))
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument,
                persistDocument: async () => undefined
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const apiOrigin = `http://127.0.0.1:${address.port}`
        const openRealtime = async (token: string) => {
            const config = createPlayCanvasEditorFullBootConfig({
                metahubId: 'metahub-1',
                projectId: uuid,
                sceneId,
                userId: 'user-1',
                projectName: 'PlayCanvas Project',
                accessToken: token,
                apiOrigin
            })
            const realtime = new WebSocket(config.url.realtime.http, { headers: { Origin: 'https://editor-assets.example.test' } })
            await waitForEvent<void>(realtime, 'open')
            realtime.send(`auth${JSON.stringify({ accessToken: token })}`)
            await expect(waitForEvent<Buffer>(realtime, 'message').then((data) => data.toString())).resolves.toMatch(/^auth/)
            return realtime
        }
        try {
            const firstRealtime = await openRealtime(createFullBootToken())
            firstRealtime.close()
            await waitForEvent<void>(firstRealtime, 'close')

            const secondRealtime = await openRealtime(createFullBootToken({ assetDocumentIds: [materialDocumentId] }))
            try {
                const connection = new ShareDBClient.Connection(secondRealtime)
                const doc = connection.get('assets', String(materialDocumentId))
                doc.subscribe()
                await waitForEvent<void>(doc, 'load')

                expect(doc.data).toMatchObject(materialData)
                expect(loadDocument).toHaveBeenCalledWith(
                    expect.objectContaining({ collection: 'assets', documentId: String(materialDocumentId) })
                )
                connection.close()
            } finally {
                secondRealtime.close()
            }
        } finally {
            await handle.close()
        }
    })

    it('authenticates full-boot realtime before async signed asset documents finish seeding', async () => {
        const app = express()
        const server = http.createServer(app)
        servers.push(server)
        const materialDocumentIds = Array.from({ length: 4 }, (_, index) => 200_000 + index)
        let releaseAssetLoads: (() => void) | null = null
        const assetLoadsReleased = new Promise<void>((resolve) => {
            releaseAssetLoads = resolve
        })
        const loadDocument = vi.fn(async ({ collection, documentId }) => {
            if (collection === 'assets') {
                await assetLoadsReleased
                return {
                    collection,
                    id: documentId,
                    data: {
                        item_id: Number(documentId),
                        name: `Material ${documentId}`,
                        type: 'material',
                        data: { diffuse: [1, 1, 1], opacity: 0.5, blendType: 2, depthWrite: false, useFog: true },
                        project: numericIds.projectId
                    },
                    version: 0
                }
            }
            return {
                collection,
                id: documentId,
                data: {},
                version: 0
            }
        })
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument,
                persistDocument: async () => undefined
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const token = createFullBootToken({ assetDocumentIds: materialDocumentIds })
        const config = createPlayCanvasEditorFullBootConfig({
            metahubId: 'metahub-1',
            projectId: uuid,
            sceneId,
            userId: 'user-1',
            projectName: 'PlayCanvas Project',
            accessToken: token,
            apiOrigin: `http://127.0.0.1:${address.port}`
        })
        const realtime = new WebSocket(config.url.realtime.http, { headers: { Origin: 'https://editor-assets.example.test' } })
        try {
            await waitForEvent<void>(realtime, 'open')
            const authMessage = waitForEvent<Buffer>(realtime, 'message').then((data) => data.toString())
            realtime.send(`auth${JSON.stringify({ accessToken: token })}`)
            await vi.waitFor(() => expect(loadDocument).toHaveBeenCalledWith(expect.objectContaining({ collection: 'scenes' })))
            await expect(authMessage).resolves.toMatch(/^auth/)
            releaseAssetLoads?.()
            await vi.waitFor(() =>
                expect(loadDocument).toHaveBeenCalledWith(
                    expect.objectContaining({
                        collection: 'assets',
                        documentId: String(materialDocumentIds[materialDocumentIds.length - 1])
                    })
                )
            )
            expect(loadDocument).toHaveBeenCalledWith(
                expect.objectContaining({ collection: 'assets', documentId: String(materialDocumentIds[0]) })
            )
        } finally {
            releaseAssetLoads?.()
            realtime.close()
            await handle.close()
        }
    })

    it('rejects ShareDB submits outside the authenticated full-boot document allowlist', async () => {
        const server = http.createServer(express())
        servers.push(server)
        const persistDocument = vi.fn(async () => undefined)
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async () => null,
                persistDocument
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const token = createFullBootToken()
        const config = createPlayCanvasEditorFullBootConfig({
            metahubId: 'metahub-1',
            projectId: uuid,
            sceneId,
            userId: 'user-1',
            projectName: 'PlayCanvas Project',
            accessToken: token,
            apiOrigin: `http://127.0.0.1:${address.port}`
        })
        const realtime = new WebSocket(config.url.realtime.http, { headers: { Origin: 'https://editor-assets.example.test' } })
        try {
            await waitForEvent<void>(realtime, 'open')
            realtime.send(`auth${JSON.stringify({ accessToken: token })}`)
            await expect(waitForEvent<Buffer>(realtime, 'message').then((data) => data.toString())).resolves.toMatch(/^auth/)
            const connection = new ShareDBClient.Connection(realtime)
            const forbiddenDoc = connection.get('settings', 'project-private_999999')

            await expect(
                new Promise<void>((resolve, reject) => {
                    forbiddenDoc.create({ id: 'project-private_999999' }, (error) => (error ? reject(error) : resolve()))
                })
            ).rejects.toThrow(/documentNotAllowed/)
            expect(persistDocument).not.toHaveBeenCalled()
            connection.close()
        } finally {
            realtime.close()
            await handle.close()
        }
    })

    it('closes duplicate active full-boot realtime sessions for the same token surface', async () => {
        const server = http.createServer(express())
        servers.push(server)
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async () => null,
                persistDocument: async () => undefined
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const token = createFullBootToken({ sessionId: 'shared-session', nonce: 'shared-nonce' })
        const wsUrl = `ws://127.0.0.1:${address.port}/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/realtime`
        const options = { headers: { Origin: 'https://editor-assets.example.test' } }
        const first = new WebSocket(wsUrl, options)
        const openedSockets: WebSocket[] = [first]
        try {
            await waitForEvent<void>(first, 'open')
            first.send(`auth${JSON.stringify({ accessToken: token })}`)
            await expect(waitForEvent<Buffer>(first, 'message').then((data) => data.toString())).resolves.toMatch(/^auth/)
            const second = new WebSocket(wsUrl, options)
            openedSockets.push(second)
            await waitForEvent<void>(second, 'open')
            second.send(`auth${JSON.stringify({ accessToken: token })}`)
            await expect(waitForEvent<number>(second, 'close')).resolves.toBe(4401)
            expect(first.readyState).toBe(WebSocket.OPEN)
        } finally {
            for (const socket of openedSockets) {
                socket.close()
            }
            await handle.close()
        }
    })

    it('rejects excess unauthenticated full-boot WebSocket upgrades before auth timeout even when X-Forwarded-For changes', async () => {
        const server = http.createServer(express())
        servers.push(server)
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async () => null,
                persistDocument: async () => undefined
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const wsUrl = `ws://127.0.0.1:${address.port}/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/realtime`
        const pendingSockets: WebSocket[] = []

        try {
            for (let index = 0; index < 16; index += 1) {
                const socket = new WebSocket(wsUrl, {
                    headers: { Origin: 'https://editor-assets.example.test', 'X-Forwarded-For': `198.51.100.${index + 1}` }
                })
                pendingSockets.push(socket)
                await waitForEvent<void>(socket, 'open')
            }

            const rejected = new WebSocket(wsUrl, {
                headers: { Origin: 'https://editor-assets.example.test', 'X-Forwarded-For': '198.51.100.250' }
            })
            pendingSockets.push(rejected)
            await expect(
                new Promise<number>((resolve, reject) => {
                    rejected.once('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0))
                    rejected.once('open', () => reject(new Error('Expected the unauthenticated upgrade to be rejected')))
                    rejected.once('error', reject)
                })
            ).resolves.toBe(429)
        } finally {
            for (const socket of pendingSockets) {
                socket.close()
            }
            await handle.close()
        }
    })

    it('closes authenticated full-boot realtime sockets when the token expires', async () => {
        const server = http.createServer(express())
        servers.push(server)
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async () => null,
                persistDocument: async () => undefined
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const token = createFullBootToken({ now: Date.now() - PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_TTL_MS + 150 })
        const realtime = new WebSocket(
            `ws://127.0.0.1:${address.port}/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/realtime`,
            { headers: { Origin: 'https://editor-assets.example.test' } }
        )
        try {
            await waitForEvent<void>(realtime, 'open')
            realtime.send(`auth${JSON.stringify({ accessToken: token })}`)
            await expect(waitForEvent<Buffer>(realtime, 'message').then((data) => data.toString())).resolves.toMatch(/^auth/)
            await expect(waitForEvent<number>(realtime, 'close')).resolves.toBe(4401)
        } finally {
            realtime.close()
            await handle.close()
        }
    })

    it('does not leak unhandled rejections from queued ShareDB persistence failures', async () => {
        const app = express()
        const server = http.createServer(app)
        servers.push(server)
        const persistError = new Error('persist failed')
        const unhandled = vi.fn()
        const onUnhandled = (reason: unknown) => unhandled(reason)
        process.on('unhandledRejection', onUnhandled)
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async ({ collection, documentId }) => ({
                    collection,
                    id: documentId,
                    data: { item_id: 1, entities: { root: { resource_id: 'root', children: [] } } },
                    version: 0
                }),
                persistDocument: async () => {
                    throw persistError
                }
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const token = createFullBootToken()
        const config = createPlayCanvasEditorFullBootConfig({
            metahubId: 'metahub-1',
            projectId: uuid,
            sceneId,
            userId: 'user-1',
            projectName: 'PlayCanvas Project',
            accessToken: token,
            apiOrigin: `http://127.0.0.1:${address.port}`
        })
        const realtime = new WebSocket(config.url.realtime.http, { headers: { Origin: 'https://editor-assets.example.test' } })
        try {
            await waitForEvent<void>(realtime, 'open')
            realtime.send(`auth${JSON.stringify({ accessToken: token })}`)
            await expect(waitForEvent<Buffer>(realtime, 'message').then((data) => data.toString())).resolves.toMatch(/^auth/)

            const connection = new ShareDBClient.Connection(realtime)
            const doc = connection.get('scenes', String(config.scene.uniqueId))
            doc.subscribe()
            await waitForEvent<void>(doc, 'load')
            await expect(
                new Promise<void>((resolve, reject) => {
                    doc.submitOp([{ p: ['name'], oi: 'Updated Scene' }], (error) => (error ? reject(error) : resolve()))
                })
            ).rejects.toThrow(persistError.message)
            await new Promise((resolve) => setTimeout(resolve, 25))
            expect(unhandled).not.toHaveBeenCalled()
            connection.close()
        } finally {
            process.off('unhandledRejection', onUnhandled)
            realtime.close()
            await handle.close()
        }
    })

    it('closes ShareDB persistence connections when durable storage rejects', async () => {
        const backend = new ShareDB()
        const seedConnection = backend.connect()
        const seedDoc = seedConnection.get('scenes', 'scene-1')
        await new Promise<void>((resolve, reject) => {
            seedDoc.create({ item_id: 1, entities: { root: { resource_id: 'root', children: [] } } }, (error) =>
                error ? reject(error) : resolve()
            )
        })
        seedConnection.close()

        const originalConnect = backend.connect.bind(backend)
        const closeConnection = vi.fn()
        vi.spyOn(backend, 'connect').mockImplementation(() => {
            const connection = originalConnect()
            const originalClose = connection.close.bind(connection)
            connection.close = () => {
                closeConnection()
                return originalClose()
            }
            return connection
        })

        const persistError = new Error('durable storage rejected')
        await expect(
            persistShareDbSnapshot(
                backend,
                {
                    loadDocument: async () => null,
                    persistDocument: async () => {
                        throw persistError
                    }
                },
                {
                    metahubId: 'metahub-1',
                    projectId: uuid,
                    sceneId,
                    userId: 'user-1',
                    packageSlug: 'playcanvas-editor',
                    mode: 'universo-full-upstream-ui',
                    origin: 'https://editor-assets.example.test',
                    expiresAt: Date.now() + PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_TTL_MS
                },
                new Map(),
                'scenes',
                'scene-1'
            )
        ).rejects.toThrow(persistError.message)
        expect(closeConnection).toHaveBeenCalledTimes(1)
    })

    it('recovers ShareDB documents from durable storage after persistence checksum conflicts', async () => {
        const server = http.createServer(express())
        servers.push(server)
        const persistedScene = { item_id: 1, name: 'Durable Scene', entities: { root: { resource_id: 'root', children: [] } } }
        const persistError = Object.assign(new Error('PlayCanvas project file current checksum does not match'), { statusCode: 409 })
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async ({ collection, documentId }) => ({
                    collection,
                    id: documentId,
                    data: collection === 'scenes' ? persistedScene : {},
                    version: 0,
                    checksum: 'durable-checksum',
                    revision: 'durable-revision'
                }),
                persistDocument: async () => {
                    throw persistError
                }
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const token = createFullBootToken()
        const config = createPlayCanvasEditorFullBootConfig({
            metahubId: 'metahub-1',
            projectId: uuid,
            sceneId,
            userId: 'user-1',
            projectName: 'PlayCanvas Project',
            accessToken: token,
            apiOrigin: `http://127.0.0.1:${address.port}`
        })
        const realtime = new WebSocket(config.url.realtime.http, { headers: { Origin: 'https://editor-assets.example.test' } })
        try {
            await waitForEvent<void>(realtime, 'open')
            realtime.send(`auth${JSON.stringify({ accessToken: token })}`)
            await expect(waitForEvent<Buffer>(realtime, 'message').then((data) => data.toString())).resolves.toMatch(/^auth/)

            const connection = new ShareDBClient.Connection(realtime)
            const doc = connection.get('scenes', String(config.scene.uniqueId))
            doc.subscribe()
            await waitForEvent<void>(doc, 'load')
            await expect(
                new Promise<void>((resolve, reject) => {
                    doc.submitOp([{ p: ['name'], oi: 'Rejected Memory Scene', od: 'Durable Scene' }], (error) =>
                        error ? reject(error) : resolve()
                    )
                })
            ).rejects.toThrow(persistError.message)
            await expect.poll(() => doc.data?.name, { timeout: 5_000 }).toBe('Durable Scene')
            connection.close()
        } finally {
            realtime.close()
            await handle.close()
        }
    })

    it('reseeds ShareDB documents from durable storage after rejected persistence mutates memory', async () => {
        const server = http.createServer(express())
        servers.push(server)
        const persistedScene = { item_id: 1, name: 'Durable Scene', entities: { root: { resource_id: 'root', children: [] } } }
        const persistError = new Error('persist failed')
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async ({ collection, documentId }) => ({
                    collection,
                    id: documentId,
                    data: collection === 'scenes' ? persistedScene : {},
                    version: 0,
                    checksum: 'durable-checksum',
                    revision: 'durable-revision'
                }),
                persistDocument: async () => {
                    throw persistError
                }
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const token = createFullBootToken()
        const config = createPlayCanvasEditorFullBootConfig({
            metahubId: 'metahub-1',
            projectId: uuid,
            sceneId,
            userId: 'user-1',
            projectName: 'PlayCanvas Project',
            accessToken: token,
            apiOrigin: `http://127.0.0.1:${address.port}`
        })
        const openSceneDoc = async () => {
            const realtime = new WebSocket(config.url.realtime.http, { headers: { Origin: 'https://editor-assets.example.test' } })
            await waitForEvent<void>(realtime, 'open')
            realtime.send(`auth${JSON.stringify({ accessToken: token })}`)
            await expect(waitForEvent<Buffer>(realtime, 'message').then((data) => data.toString())).resolves.toMatch(/^auth/)
            const connection = new ShareDBClient.Connection(realtime)
            const doc = connection.get('scenes', String(config.scene.uniqueId))
            doc.subscribe()
            await waitForEvent<void>(doc, 'load')
            return { realtime, connection, doc }
        }

        const first = await openSceneDoc()
        try {
            await expect(
                new Promise<void>((resolve, reject) => {
                    first.doc.submitOp([{ p: ['name'], oi: 'Rejected Memory Scene', od: 'Durable Scene' }], (error) =>
                        error ? reject(error) : resolve()
                    )
                })
            ).rejects.toThrow(persistError.message)
            first.connection.close()
            first.realtime.close()
        } finally {
            first.connection.close()
            first.realtime.close()
        }

        const second = await openSceneDoc()
        try {
            expect(second.doc.data).toMatchObject({ name: 'Durable Scene' })
        } finally {
            second.connection.close()
            second.realtime.close()
            await handle.close()
        }
    })

    it('closes relay sockets when auth-pending messages exceed the bounded queue', async () => {
        const server = http.createServer(express())
        servers.push(server)
        let releaseAuthorize: (() => void) | null = null
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            authorize: () =>
                new Promise<void>((resolve) => {
                    releaseAuthorize = resolve
                }),
            documentPort: {
                loadDocument: async ({ collection, documentId }) => ({ collection, id: documentId, data: {}, version: 0 }),
                persistDocument: async () => undefined
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const token = createFullBootToken()
        const relay = new WebSocket(
            `ws://127.0.0.1:${address.port}/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/relay`,
            { headers: { Origin: 'https://editor-assets.example.test' } }
        )
        await waitForEvent<void>(relay, 'open')
        relay.send(JSON.stringify({ t: 'authenticate', token }))
        for (let index = 0; index <= MAX_REALTIME_RELAY_PENDING_MESSAGES; index += 1) {
            relay.send(JSON.stringify({ t: 'room:join', name: `project:${index}` }))
        }
        await expect(
            new Promise<{ code: number; reason: string }>((resolve) =>
                relay.once('close', (code, reason) => resolve({ code, reason: reason.toString() }))
            )
        ).resolves.toEqual({ code: 1008, reason: 'playcanvasEditor.fullBoot.relayPendingLimit' })
        releaseAuthorize?.()
        await handle.close()
    })

    it('closes relay sockets when auth-pending messages exceed the byte budget', async () => {
        const server = http.createServer(express())
        servers.push(server)
        let releaseAuthorize: (() => void) | null = null
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            authorize: () =>
                new Promise<void>((resolve) => {
                    releaseAuthorize = resolve
                }),
            documentPort: {
                loadDocument: async ({ collection, documentId }) => ({ collection, id: documentId, data: {}, version: 0 }),
                persistDocument: async () => undefined
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const token = createFullBootToken()
        const relay = new WebSocket(
            `ws://127.0.0.1:${address.port}/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/relay`,
            { headers: { Origin: 'https://editor-assets.example.test' } }
        )
        await waitForEvent<void>(relay, 'open')
        const closed = new Promise<{ code: number; reason: string }>((resolve) =>
            relay.once('close', (code, reason) => resolve({ code, reason: reason.toString() }))
        )
        relay.send(JSON.stringify({ t: 'authenticate', token }))

        const pendingName = 'x'.repeat(Math.floor(MAX_REALTIME_RELAY_PENDING_BYTES / 2))
        for (let index = 0; index < 2; index += 1) {
            relay.send(JSON.stringify({ t: 'room:join', name: `${pendingName}${index}` }))
        }

        await expect(closed).resolves.toEqual({ code: 1008, reason: 'playcanvasEditor.fullBoot.relayPendingBytesLimit' })
        releaseAuthorize?.()
        await handle.close()
    }, 20_000)

    it('accepts full-boot WebSocket auth when the browser Origin matches the artifact-origin token claim', async () => {
        const app = express()
        const server = http.createServer(app)
        servers.push(server)
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async ({ collection, documentId }) => ({ collection, id: documentId, data: {}, version: 0 }),
                persistDocument: async () => undefined
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const token = createFullBootTokenForArtifactOrigin('https://editor-assets.example.test')
        const realtime = new WebSocket(
            `ws://127.0.0.1:${address.port}/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/realtime`,
            { headers: { Origin: 'https://editor-assets.example.test' } }
        )
        await new Promise<void>((resolve) => realtime.once('open', resolve))
        realtime.send(`auth${JSON.stringify({ accessToken: token })}`)
        await expect(new Promise((resolve) => realtime.once('message', (data) => resolve(data.toString())))).resolves.toMatch(/^auth/)
        realtime.close()
        await handle.close()
    })

    it('rejects full-boot WebSocket auth when the browser Origin does not match the token claim', async () => {
        process.env.PLAYCANVAS_EDITOR_FULL_BOOT_WS_ORIGINS = 'https://editor-assets.example.test,https://attacker.example.test'
        const server = http.createServer(express())
        servers.push(server)
        const handle = attachPlayCanvasEditorFullBootRuntime({
            server,
            tokenService,
            documentPort: {
                loadDocument: async ({ collection, documentId }) => ({ collection, id: documentId, data: {}, version: 0 }),
                persistDocument: async () => undefined
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
        const realtime = new WebSocket(
            `ws://127.0.0.1:${address.port}/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${uuid}/realtime`,
            { headers: { Origin: 'https://attacker.example.test' } }
        )
        await new Promise<void>((resolve) => realtime.once('open', resolve))
        realtime.send(`auth${JSON.stringify({ accessToken: createFullBootTokenForArtifactOrigin('https://editor-assets.example.test') })}`)
        await expect(new Promise((resolve) => realtime.once('close', (code) => resolve(code)))).resolves.toBe(4401)
        await handle.close()
    })
})
