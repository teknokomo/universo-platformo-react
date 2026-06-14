import express from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import http from 'node:http'
import type { Server } from 'node:http'
import ShareDB from 'sharedb'
import ShareDBClient from 'sharedb/lib/client'
import WebSocket from 'ws'
import {
    PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_TTL_MS,
    PLAYCANVAS_EDITOR_PACKAGE_NAME,
    type PlayCanvasEditorCompatibilityProtocolDescriptor,
    type PlayCanvasScene,
    type VersionedLocalizedContent
} from '@universo-react/types'
import {
    attachPlayCanvasEditorFullBootRuntime,
    createAllowedShareDbDocumentKeys,
    createDefaultRealtimeDocument,
    createPlayCanvasEditorCompatibilityConfig,
    createPlayCanvasEditorCompatibilityRoutes,
    createPlayCanvasEditorFullBootConfig,
    createPlayCanvasEditorNumericIds,
    createPlayCanvasEditorCompatibilityTokenService,
    isPlayCanvasEditorFullBootUpgradeRequest,
    persistShareDbSnapshot,
    repairSnapshotForJson0ListOperations
} from './index'

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
        minimumTag: 'v2.23.4'
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
const originalAllowedArtifactOrigins = process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS
const originalAllowedFullBootWsOrigins = process.env.PLAYCANVAS_EDITOR_FULL_BOOT_WS_ORIGINS
const originalCorsOrigins = process.env.CORS_ORIGINS
const originalNodeEnv = process.env.NODE_ENV
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

const createTokenHeader = (projectId = uuid, userId = 'user-1') => {
    const { token } = tokenService.create({
        metahubId: 'metahub-1',
        projectId,
        userId,
        packageSlug: 'playcanvas-editor',
        now: Date.now()
    })
    return token
}

const createFullBootToken = (input: { now?: number; sessionId?: string; nonce?: string } = {}) =>
    tokenService.create({
        metahubId: 'metahub-1',
        projectId: uuid,
        sceneId,
        userId: 'user-1',
        packageSlug: 'playcanvas-editor',
        mode: 'universo-full-upstream-ui',
        origin: 'https://editor-assets.example.test',
        sessionId: input.sessionId ?? `session-${Date.now()}-${Math.random()}`,
        nonce: input.nonce ?? `nonce-${Date.now()}-${Math.random()}`,
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

const createTestServer = async (
    descriptor: PlayCanvasEditorCompatibilityProtocolDescriptor = fullBootProtocol,
    options: { assets?: unknown[]; sourceFiles?: PlayCanvasEditorCompatibilitySourceFileSummary[] } = {}
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
    const app = express()
    app.use(express.json())
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
                listAssets: async () => options.assets ?? [],
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
    return { baseUrl: `http://127.0.0.1:${address.port}`, saveScene, writeSettings, writeSourceFile, deleteSourceFile }
}

beforeEach(() => {
    process.env.PLAYCANVAS_EDITOR_FULL_BOOT_WS_ORIGINS = 'https://editor-assets.example.test'
})

afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
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
        const { baseUrl } = await createTestServer()
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

    it('accepts same-host full-boot WebSocket upgrades and still rejects invalid realtime auth', async () => {
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

        await waitForEvent<void>(realtime, 'open')
        realtime.send(`auth${JSON.stringify({ accessToken: 'invalid-token' })}`)
        await expect(waitForEvent<number>(realtime, 'close')).resolves.toBe(4401)

        await handle.close()
    })

    it('accepts loopback sibling full-boot WebSocket upgrades and still rejects invalid realtime auth', async () => {
        delete process.env.PLAYCANVAS_EDITOR_FULL_BOOT_WS_ORIGINS
        delete process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS
        delete process.env.PLAYCANVAS_EDITOR_ARTIFACT_PUBLIC_ORIGIN
        delete process.env.PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN
        process.env.NODE_ENV = 'development'
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
        expect(config.schema.settings.editor.cameraClearColor).toMatchObject({
            $default: [0.118, 0.118, 0.118, 1],
            $scope: 'projectUser'
        })
        expect(config.engineVersions.force.version).toBe('2.19.5')
        expect(config.engineVersions.current.version).toBe('2.19.5')
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

        const messenger = new WebSocket(`${baseWs}/messenger`, wsOptions)
        await new Promise<void>((resolve) => messenger.once('open', resolve))
        messenger.send(JSON.stringify({ name: 'authenticate', token, type: 'designer' }))
        await expect(
            new Promise((resolve) => messenger.once('message', (data) => resolve(JSON.parse(data.toString()))))
        ).resolves.toMatchObject({
            name: 'welcome'
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
            ).resolves.toBeUndefined()
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
        for (let index = 0; index < 17; index += 1) {
            relay.send(JSON.stringify({ t: 'room:join', name: `project:${index}` }))
        }
        await expect(waitForEvent<number>(relay, 'close')).resolves.toBe(1008)
        releaseAuthorize?.()
        await handle.close()
    })

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
