import express from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Server } from 'node:http'
import {
    PLAYCANVAS_EDITOR_PACKAGE_NAME,
    type PlayCanvasEditorCompatibilityProtocolDescriptor,
    type PlayCanvasScene,
    type VersionedLocalizedContent
} from '@universo-react/types'
import {
    createPlayCanvasEditorCompatibilityConfig,
    createPlayCanvasEditorCompatibilityRoutes,
    createPlayCanvasEditorCompatibilityTokenService
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
        requiredCollections: ['scenes', 'assets', 'settings'],
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

const servers: Server[] = []
const tokenService = createPlayCanvasEditorCompatibilityTokenService()

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

const createTestServer = async () => {
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
                describeProtocol: async () => protocol,
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
                listAssets: async () => [],
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
    return { baseUrl: `http://127.0.0.1:${address.port}`, saveScene, writeSettings }
}

afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
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
})
