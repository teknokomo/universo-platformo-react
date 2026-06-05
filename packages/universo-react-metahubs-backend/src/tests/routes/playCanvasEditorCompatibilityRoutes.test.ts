import express from 'express'
import type { ErrorRequestHandler, RequestHandler } from 'express'
import { PLAYCANVAS_EDITOR_PACKAGE_NAME } from '@universo-react/types'
import { createPlayCanvasProjectsRoutes } from '../../domains/playcanvas-projects/routes/playCanvasProjectsRoutes'
import { PlayCanvasProjectsService } from '../../domains/playcanvas-projects/services/PlayCanvasProjectsService'

const request = require('supertest') as typeof import('supertest')

const projectId = '019e9146-fd1b-7d1d-a858-d1e96485d901'
const sceneId = '019e9147-16c4-738c-ab0f-b98c443ee676'
const requestId = '019e9147-27e7-7ad4-b4e4-02174d3bcfad'
const originalPlayCanvasEditorParentPublicOrigin = process.env.PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN
const originalPlayCanvasEditorTrustProxyHeaders = process.env.PLAYCANVAS_EDITOR_TRUST_PROXY_HEADERS

const readCompatibilityToken = async (app: ReturnType<typeof createApp>): Promise<string> => {
    jest.spyOn(PlayCanvasProjectsService.prototype, 'describeEditorCompatibilityProtocol').mockResolvedValue(createProtocol())
    const response = await request(app).get(`/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/config`)
    const token = response.body?.item?.auth?.accessToken
    if (typeof token !== 'string' || token.length === 0) {
        throw new Error('Compatibility token was not issued by test app')
    }
    return token
}

const createProtocol = () =>
    ({
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
            projectUser: `project_${projectId}_user-1`,
            projectPrivate: `project-private_${projectId}`
        }
    } as never)

const createApp = (role: 'admin' | 'member' = 'admin') => {
    const app = express()
    app.use(express.json())

    const ensureAuth: RequestHandler = (req, _res, next) => {
        req.user = { id: 'user-1' } as never
        next()
    }
    const limiter: RequestHandler = (_req, _res, next) => next()
    const csrfProtection: RequestHandler = (req, res, next) => {
        if (req.method === 'GET' || req.get('x-csrf-token') === 'test-csrf') return next()
        return res.status(403).json({ error: 'invalid csrf token' })
    }
    const exec = {
        query: jest.fn(async (sql: string) => {
            if (sql.includes('SELECT admin.is_superuser')) return [{ is_super: false }]
            if (sql.includes('FROM metahubs.rel_metahub_users')) {
                return [
                    {
                        id: '019e9147-ffff-7000-8000-000000000001',
                        metahubId: 'metahub-1',
                        userId: 'user-1',
                        activeBranchId: null,
                        role,
                        comment: null
                    }
                ]
            }
            throw new Error(`Unexpected SQL: ${sql}`)
        })
    }

    app.use(createPlayCanvasProjectsRoutes(ensureAuth, () => exec as never, limiter as never, limiter as never, csrfProtection))
    const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
        res.status(error.statusCode ?? error.status ?? 500).json({ error: error.message })
    }
    app.use(errorHandler)
    return app
}

afterEach(() => {
    jest.restoreAllMocks()
    if (originalPlayCanvasEditorParentPublicOrigin === undefined) {
        delete process.env.PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN
    } else {
        process.env.PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN = originalPlayCanvasEditorParentPublicOrigin
    }
    if (originalPlayCanvasEditorTrustProxyHeaders === undefined) {
        delete process.env.PLAYCANVAS_EDITOR_TRUST_PROXY_HEADERS
    } else {
        process.env.PLAYCANVAS_EDITOR_TRUST_PROXY_HEADERS = originalPlayCanvasEditorTrustProxyHeaders
    }
})

describe('PlayCanvas Editor compatibility routes', () => {
    it('serves the minimal compatibility config through the metahub access boundary', async () => {
        const describeEditorCompatibilityProtocol = jest
            .spyOn(PlayCanvasProjectsService.prototype, 'describeEditorCompatibilityProtocol')
            .mockResolvedValue(createProtocol())

        const response = await request(createApp()).get(`/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/config`)

        expect(response.status).toBe(200)
        expect(response.headers['cache-control']).toBe('no-store')
        expect(response.body.item).toMatchObject({
            mode: 'universo-compatibility-rest-minimal',
            projectId,
            defaultSceneId: sceneId,
            permissions: { read: true, write: true, admin: false },
            auth: {
                scheme: 'signed-header',
                headerName: 'X-PlayCanvas-Editor-Token',
                accessToken: expect.any(String),
                expiresAt: expect.any(String)
            },
            csrf: { tokenUrl: expect.stringMatching(/\/api\/v1\/auth\/csrf$/), headerName: 'X-CSRF-Token' }
        })
        expect(response.body.item.endpoints.scenes).toContain(`/projects/${projectId}/scenes`)
        expect(describeEditorCompatibilityProtocol).toHaveBeenCalledWith('metahub-1', projectId, 'user-1')
    })

    it('binds compatibility tokens to the artifact origin while keeping platform REST endpoints absolute', async () => {
        jest.spyOn(PlayCanvasProjectsService.prototype, 'describeEditorCompatibilityProtocol').mockResolvedValue(createProtocol())
        const saveEditorCompatibilityScene = jest
            .spyOn(PlayCanvasProjectsService.prototype, 'saveEditorCompatibilityScene')
            .mockResolvedValue({
                scene: {
                    id: sceneId,
                    projectId,
                    displayName: {},
                    codename: {},
                    payloadSchemaVersion: '1',
                    payloadFile: null,
                    checksum: 'a'.repeat(64),
                    sortOrder: 0,
                    publish: true,
                    version: 2
                },
                payload: { schemaVersion: '1', entities: [] },
                checksum: 'a'.repeat(64)
            })

        const app = createApp()
        const configResponse = await request(app)
            .get(`/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/config`)
            .set('referer', 'https://platform.example/metahub/metahub-1/resources/packages/playcanvas-editor/editor')
            .query({ artifactOrigin: 'https://artifact.example' })

        expect(configResponse.status).toBe(200)
        expect(configResponse.body.item.endpoints.scenes).toBe(
            `https://platform.example/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/scenes`
        )
        expect(configResponse.body.item.csrf.tokenUrl).toBe('https://platform.example/api/v1/auth/csrf')

        const token = configResponse.body.item.auth.accessToken as string
        const acceptedResponse = await request(app)
            .put(`/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/scenes/${sceneId}`)
            .set('origin', 'https://artifact.example')
            .set('x-playcanvas-editor-token', token)
            .set('x-csrf-token', 'test-csrf')
            .send({
                requestId,
                payload: {
                    schemaVersion: '1',
                    entities: []
                }
            })
        expect(acceptedResponse.status).toBe(200)

        const rejectedResponse = await request(app)
            .put(`/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/scenes/${sceneId}`)
            .set('origin', 'https://platform.example')
            .set('x-playcanvas-editor-token', token)
            .set('x-csrf-token', 'test-csrf')
            .send({
                requestId: '019e9147-27e7-7ad4-b4e4-02174d3bcfae',
                payload: {
                    schemaVersion: '1',
                    entities: []
                }
            })
        expect(rejectedResponse.status).toBe(401)
        expect(saveEditorCompatibilityScene).toHaveBeenCalledTimes(1)
    })

    it('keeps compatibility config endpoints on the platform origin when Referer is absent', async () => {
        process.env.PLAYCANVAS_EDITOR_TRUST_PROXY_HEADERS = 'true'
        jest.spyOn(PlayCanvasProjectsService.prototype, 'describeEditorCompatibilityProtocol').mockResolvedValue(createProtocol())

        const response = await request(createApp())
            .get(`/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/config`)
            .set('x-forwarded-proto', 'https')
            .set('x-forwarded-host', 'platform.example')
            .query({ artifactOrigin: 'https://artifact.example' })

        expect(response.status).toBe(200)
        expect(response.body.item.endpoints.scenes).toBe(
            `https://platform.example/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/scenes`
        )
        expect(response.body.item.csrf.tokenUrl).toBe('https://platform.example/api/v1/auth/csrf')
    })

    it('persists scene payloads through the metahub project service adapter', async () => {
        const saveEditorCompatibilityScene = jest
            .spyOn(PlayCanvasProjectsService.prototype, 'saveEditorCompatibilityScene')
            .mockResolvedValue({
                scene: {
                    id: sceneId,
                    projectId,
                    displayName: {},
                    codename: {},
                    payloadSchemaVersion: '1',
                    payloadFile: null,
                    checksum: 'a'.repeat(64),
                    sortOrder: 0,
                    publish: true,
                    version: 2
                },
                payload: { schemaVersion: '1', entities: [{ id: 'entity-1', name: 'Entity' }] },
                checksum: 'a'.repeat(64)
            })

        const app = createApp()
        const token = await readCompatibilityToken(app)
        const response = await request(app)
            .put(`/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/scenes/${sceneId}`)
            .set('x-playcanvas-editor-token', token)
            .set('x-csrf-token', 'test-csrf')
            .send({
                requestId,
                expectedCurrentChecksum: 'b'.repeat(64),
                payload: {
                    schemaVersion: '1',
                    entities: [{ id: 'entity-1', name: 'Entity' }]
                }
            })

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
            ok: true,
            requestId,
            item: {
                checksum: 'a'.repeat(64),
                payload: { entities: [{ id: 'entity-1', name: 'Entity' }] }
            }
        })
        expect(saveEditorCompatibilityScene).toHaveBeenCalledWith(
            'metahub-1',
            projectId,
            sceneId,
            expect.objectContaining({ requestId, expectedCurrentChecksum: 'b'.repeat(64) }),
            'user-1'
        )
    })

    it('fails closed on invalid compatibility writes before mutating project data', async () => {
        const saveEditorCompatibilityScene = jest
            .spyOn(PlayCanvasProjectsService.prototype, 'saveEditorCompatibilityScene')
            .mockResolvedValue({} as never)

        const app = createApp()
        const token = await readCompatibilityToken(app)
        const response = await request(app)
            .put(`/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/scenes/${sceneId}`)
            .set('x-playcanvas-editor-token', token)
            .set('x-csrf-token', 'test-csrf')
            .send({ payload: { schemaVersion: '1', entities: [] } })

        expect(response.status).toBe(400)
        expect(response.body).toMatchObject({
            ok: false,
            code: 'playcanvasEditor.compatibility.invalidRequest'
        })
        expect(saveEditorCompatibilityScene).not.toHaveBeenCalled()
    })

    it('lists root-level assets with an explicit compatibility virtual path', async () => {
        jest.spyOn(PlayCanvasProjectsService.prototype, 'listAssets').mockResolvedValue([
            {
                id: '019e9147-3333-7000-8000-000000000001',
                projectId,
                stableAssetId: 'asset-root',
                type: 'json',
                name: 'Root Asset',
                virtualPath: [],
                file: {
                    provider: 'local',
                    root: 'playcanvas-projects',
                    path: `playcanvas-projects/${projectId}/assets/root.json`,
                    mime: 'application/json',
                    hash: 'a'.repeat(64),
                    size: 42,
                    status: 'ready'
                },
                version: 1
            }
        ])

        const app = createApp()
        const token = await readCompatibilityToken(app)
        const response = await request(app)
            .get(`/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/assets`)
            .set('x-playcanvas-editor-token', token)

        expect(response.status).toBe(200)
        expect(response.body.items).toEqual([
            expect.objectContaining({
                id: '019e9147-3333-7000-8000-000000000001',
                stableAssetId: 'asset-root',
                virtualPath: '/'
            })
        ])
    })

    it('stores scoped settings documents with optimistic revisions', async () => {
        const readEditorCompatibilitySettings = jest
            .spyOn(PlayCanvasProjectsService.prototype, 'readEditorCompatibilitySettings')
            .mockResolvedValue({ kind: 'projectUser', documentId: `project_${projectId}_user-1`, data: {}, revision: 'project-1' })
        const writeEditorCompatibilitySettings = jest
            .spyOn(PlayCanvasProjectsService.prototype, 'writeEditorCompatibilitySettings')
            .mockResolvedValue({
                kind: 'projectUser',
                documentId: `project_${projectId}_user-1`,
                data: { grid: { snap: true } },
                revision: 'project-2'
            })

        const app = createApp()
        const token = await readCompatibilityToken(app)
        const readResponse = await request(app)
            .get(`/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/settings/projectUser`)
            .set('x-playcanvas-editor-token', token)
        expect(readResponse.status).toBe(200)
        expect(readResponse.body.item).toMatchObject({ kind: 'projectUser', revision: 'project-1' })

        const writeResponse = await request(app)
            .put(`/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/settings/projectUser`)
            .set('x-playcanvas-editor-token', token)
            .set('x-csrf-token', 'test-csrf')
            .send({ requestId, data: { grid: { snap: true } }, expectedRevision: 'project-1' })

        expect(writeResponse.status).toBe(200)
        expect(writeResponse.body).toMatchObject({ ok: true, item: { revision: 'project-2' } })
        expect(readEditorCompatibilitySettings).toHaveBeenCalledWith('metahub-1', projectId, 'projectUser', 'user-1')
        expect(writeEditorCompatibilitySettings).toHaveBeenCalledWith(
            'metahub-1',
            projectId,
            'projectUser',
            expect.objectContaining({ expectedRevision: 'project-1', requestId }),
            'user-1'
        )
    })

    it('validates project access before returning cloud-only compatibility no-op surfaces', async () => {
        const getProject = jest.spyOn(PlayCanvasProjectsService.prototype, 'getProject').mockResolvedValue({
            id: projectId,
            codename: {},
            displayName: {},
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
            publishable: true
        } as never)

        const app = createApp()
        const token = await readCompatibilityToken(app)
        const response = await request(app)
            .get(`/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/cloud-only/jobs`)
            .set('x-playcanvas-editor-token', token)

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({ ok: true, surface: 'jobs', status: 'stubbed' })
        expect(getProject).toHaveBeenCalledWith('metahub-1', projectId, 'user-1')
    })

    it('rejects compatibility REST access without a matching signed header token', async () => {
        const listScenes = jest.spyOn(PlayCanvasProjectsService.prototype, 'listScenes').mockResolvedValue([])

        const missing = await request(createApp()).get(`/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/scenes`)
        expect(missing.status).toBe(401)
        expect(listScenes).not.toHaveBeenCalled()

        const token = await readCompatibilityToken(createApp())
        const wrongProject = await request(createApp())
            .get('/metahub/metahub-1/playcanvas/editor-compatible/projects/019e9147-9999-7000-8000-000000000999/scenes')
            .set('x-playcanvas-editor-token', token)
        expect(wrongProject.status).toBe(401)
        expect(listScenes).not.toHaveBeenCalled()
    })

    it('rejects member writes and missing CSRF settings writes before service mutation', async () => {
        const writeEditorCompatibilitySettings = jest
            .spyOn(PlayCanvasProjectsService.prototype, 'writeEditorCompatibilitySettings')
            .mockResolvedValue({ kind: 'projectUser', documentId: `project_${projectId}_user-1`, data: {}, revision: 'project-2' })
        const token = await readCompatibilityToken(createApp())

        const memberWrite = await request(createApp('member'))
            .put(`/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/settings/projectUser`)
            .set('x-playcanvas-editor-token', token)
            .set('x-csrf-token', 'test-csrf')
            .send({ requestId, data: {} })
        expect(memberWrite.status).toBe(403)

        const csrfMissing = await request(createApp())
            .put(`/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/settings/projectUser`)
            .set('x-playcanvas-editor-token', token)
            .send({ requestId, data: {} })
        expect(csrfMissing.status).toBe(403)
        expect(writeEditorCompatibilitySettings).not.toHaveBeenCalled()
    })

    it('denies compatibility access to metahub members without manageMetahub permission', async () => {
        const describeEditorCompatibilityProtocol = jest
            .spyOn(PlayCanvasProjectsService.prototype, 'describeEditorCompatibilityProtocol')
            .mockResolvedValue(createProtocol())

        const response = await request(createApp('member')).get(
            `/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/config`
        )

        expect(response.status).toBe(403)
        expect(describeEditorCompatibilityProtocol).not.toHaveBeenCalled()
    })
})
