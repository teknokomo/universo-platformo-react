import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { MetahubPackageAttachment } from '@universo-react/types'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

const mockResolveUserId = jest.fn<() => string | undefined>()
const mockEnsureMetahubAccess = jest.fn()
const mockListMetahubPackages = jest.fn()
const mockListPackageCatalog = jest.fn()
const mockUpdateMetahubPackageConfig = jest.fn()
const mockChangeMetahubPackageVersion = jest.fn()
const mockFindMetahubByIdNotDeleted = jest.fn()
const mockFindBranchByIdAndMetahub = jest.fn()
const mockAccess = jest.fn()
const mockRealpath = jest.fn()
const mockReadFile = jest.fn()
const mockEnsureSchema = jest.fn()
const mockFindPlayCanvasProject = jest.fn()
const mockSummarizePlayCanvasProject = jest.fn()
const mockUpdatePlayCanvasProject = jest.fn()
const mockUpsertPlayCanvasScene = jest.fn()

const mockDbSession = { isReleased: () => false }
const editorPackageName = `@universo-react/${'playcanvas-editor-frontend'}`
const decodeEditorArtifactToken = (artifactPath: string): { parentOrigin?: unknown } => {
    const token = artifactPath.match(/editor-artifact-token\/([^/]+)/)?.[1]
    if (!token) return {}
    const encodedPayload = decodeURIComponent(token).split('.')[0]
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as { parentOrigin?: unknown }
}

jest.mock('node:fs/promises', () => ({
    __esModule: true,
    default: {
        access: (...args: unknown[]) => mockAccess(...args),
        realpath: (...args: unknown[]) => mockRealpath(...args),
        readFile: (...args: unknown[]) => mockReadFile(...args)
    },
    access: (...args: unknown[]) => mockAccess(...args),
    realpath: (...args: unknown[]) => mockRealpath(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args)
}))

jest.mock('../../utils', () => ({
    __esModule: true,
    getRequestDbExecutor: (_req: unknown, fallback: unknown) => fallback
}))

jest.mock('@universo-react/utils/database', () => ({
    __esModule: true,
    getRequestDbSession: () => mockDbSession
}))

jest.mock('../../domains/shared/routeAuth', () => ({
    __esModule: true,
    resolveUserId: (...args: unknown[]) => mockResolveUserId(...args)
}))

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn().mockImplementation(() => ({
        ensureSchema: (...args: unknown[]) => mockEnsureSchema(...args)
    }))
}))

jest.mock('../../domains/playcanvas-projects/services/playCanvasProjectsStore', () => ({
    __esModule: true,
    findPlayCanvasProject: (...args: unknown[]) => mockFindPlayCanvasProject(...args),
    summarizePlayCanvasProject: (...args: unknown[]) => mockSummarizePlayCanvasProject(...args),
    updatePlayCanvasProject: (...args: unknown[]) => mockUpdatePlayCanvasProject(...args),
    upsertPlayCanvasScene: (...args: unknown[]) => mockUpsertPlayCanvasScene(...args)
}))

jest.mock('../../persistence', () => ({
    __esModule: true,
    attachMetahubPackage: jest.fn(),
    changeMetahubPackageVersion: (...args: unknown[]) => mockChangeMetahubPackageVersion(...args),
    detachMetahubPackage: jest.fn(),
    findBranchByIdAndMetahub: (...args: unknown[]) => mockFindBranchByIdAndMetahub(...args),
    findMetahubByIdNotDeleted: (...args: unknown[]) => mockFindMetahubByIdNotDeleted(...args),
    listMetahubPackages: (...args: unknown[]) => mockListMetahubPackages(...args),
    listPackageCatalog: (...args: unknown[]) => mockListPackageCatalog(...args),
    updateMetahubPackageConfig: (...args: unknown[]) => mockUpdateMetahubPackageConfig(...args)
}))

import { createPackagesRoutes } from '../../domains/packages/routes/packagesRoutes'

const displayConfig = {
    schemaVersion: '1' as const,
    kind: 'display' as const,
    display: {
        mode: 'embeddedIframe' as const,
        developmentUrl: null,
        showArtifactOnlyNotice: true
    }
}

const playCanvasAttachment: MetahubPackageAttachment = {
    id: 'attach-playcanvas',
    metahubId: 'metahub-1',
    packageId: 'pkg-playcanvas',
    packageName: editorPackageName,
    version: '0.1.0',
    displayName: {
        _schema: '1',
        _primary: 'en',
        locales: { en: { content: 'PlayCanvas Editor', version: 1, isActive: true } }
    },
    description: null,
    source: {
        kind: 'workspace',
        packageName: editorPackageName,
        importName: editorPackageName,
        upstreamPackageName: 'playcanvas-editor',
        upstreamVersion: '2026.05.30',
        runtimeTargets: []
    },
    authoringSurface: {
        schemaVersion: '1',
        kind: 'playcanvasEditor',
        packageSlug: 'playcanvas-editor',
        supportedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately', 'developmentUrl'],
        defaultConfig: displayConfig,
        artifact: {
            packageName: editorPackageName,
            manifestFileName: 'universo-artifact-manifest.json',
            outputRoot: 'dist/editor',
            smokeMode: 'universo-hosted'
        }
    },
    config: displayConfig,
    attachedAt: '2026-06-01T00:00:00.000Z',
    isActive: true
}

const noneAttachment: MetahubPackageAttachment = {
    ...playCanvasAttachment,
    id: 'attach-engine',
    packageId: 'pkg-engine',
    packageName: '@universo-react/playcanvas-engine',
    authoringSurface: {
        schemaVersion: '1',
        kind: 'none',
        supportedDisplayModes: [],
        defaultConfig: { schemaVersion: '1', kind: 'none' }
    },
    config: { schemaVersion: '1', kind: 'none' }
}

describe('Packages Routes', () => {
    const ensureAuth = (_req: Request, _res: Response, next: NextFunction) => next()
    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) =>
        next()) as RateLimitRequestHandler
    const mockExec = { query: jest.fn(), isReleased: jest.fn(() => false) }

    const buildApp = (auth: RequestHandler = ensureAuth) => {
        const app = express()
        app.response.sendFile = function sendFileStub(filePath: string) {
            this.setHeader('X-Test-SendFile', filePath)
            return this.send('artifact')
        } as never
        app.use(express.json())
        app.use(createPackagesRoutes(auth, () => mockExec as never, mockRateLimiter, mockRateLimiter))
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveUserId.mockReturnValue('user-1')
        mockEnsureMetahubAccess.mockResolvedValue(undefined)
        mockAccess.mockResolvedValue(undefined)
        mockRealpath.mockImplementation(async (filePath: string) => filePath)
        mockReadFile.mockResolvedValue(
            JSON.stringify({
                mode: 'universo-hosted',
                smokeMode: 'universo-hosted',
                bridgeBootstrap: 'universo-bridge-bootstrap.js'
            })
        )
        mockEnsureSchema.mockResolvedValue('mhb_schema')
        mockFindMetahubByIdNotDeleted.mockResolvedValue({ id: 'metahub-1', defaultBranchId: 'branch-default' })
        mockFindBranchByIdAndMetahub.mockResolvedValue({ id: 'branch-default', metahubId: 'metahub-1', schemaName: 'mhb_default_schema' })
        mockFindPlayCanvasProject.mockResolvedValue({ id: '019e8afa-0000-7000-8000-000000000001', version: 1 })
        mockSummarizePlayCanvasProject.mockResolvedValue({
            id: '019e8afa-0000-7000-8000-000000000001',
            defaultSceneId: '019e8afa-0000-7000-8000-000000000002'
        })
        mockUpsertPlayCanvasScene.mockResolvedValue({ id: '019e8afa-0000-7000-8000-000000000002' })
        mockUpdatePlayCanvasProject.mockResolvedValue({
            id: '019e8afa-0000-7000-8000-000000000001',
            defaultSceneId: '019e8afa-0000-7000-8000-000000000002',
            version: 2
        })
        mockListMetahubPackages.mockResolvedValue([playCanvasAttachment, noneAttachment])
        mockListPackageCatalog.mockResolvedValue([])
        mockUpdateMetahubPackageConfig.mockImplementation(async (_exec, input) => ({
            ...playCanvasAttachment,
            id: input.attachmentId,
            config: input.config
        }))
        mockChangeMetahubPackageVersion.mockImplementation(async (_exec, input) => ({
            ...playCanvasAttachment,
            id: input.attachmentId,
            version: input.version
        }))
        delete process.env.PLAYCANVAS_EDITOR_ARTIFACT_PUBLIC_ORIGIN
        delete process.env.PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN
        delete process.env.PLAYCANVAS_EDITOR_TRUST_PROXY_HEADERS
        delete process.env.PLAYCANVAS_EDITOR_DEVELOPMENT_URLS
    })

    it('requires manageMetahub permission before returning the authoring host descriptor', async () => {
        const response = await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/authoring-host').expect(200)

        expect(response.body.artifactStatus).toBe('available')
        expect(response.body.allowedDisplayModes).toEqual(['disabled', 'embeddedIframe', 'openSeparately'])
        const artifactUrl = new URL(String(response.body.artifactUrl))
        expect(artifactUrl.hostname).toBe('localhost')
        expect(artifactUrl.pathname).toMatch(
            /^\/api\/v1\/metahub\/metahub-1\/packages\/playcanvas-editor\/editor-artifact-token\/[^/]+\/index\.html$/
        )
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
        expect(mockAccess).toHaveBeenCalledTimes(3)
    })

    it('ignores untrusted forwarded origin headers when deriving tokenized artifact URLs', async () => {
        const response = await request(buildApp())
            .get('/metahub/metahub-1/packages/playcanvas-editor/authoring-host')
            .set('x-forwarded-host', 'spoofed.example.test')
            .set('x-forwarded-proto', 'https')
            .expect(200)

        const artifactUrl = new URL(String(response.body.artifactUrl))
        expect(artifactUrl.hostname).toBe('localhost')
        expect(String(response.body.artifactUrl)).not.toContain('spoofed.example.test')
    })

    it('uses an explicit parent public origin when configured for proxied deployments', async () => {
        process.env.PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN = 'https://platform.example.test/app'
        process.env.PLAYCANVAS_EDITOR_ARTIFACT_PUBLIC_ORIGIN = 'https://editor-assets.example.test'

        const response = await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/authoring-host').expect(200)

        const artifactUrl = new URL(String(response.body.artifactUrl))
        expect(artifactUrl.origin).toBe('https://editor-assets.example.test')
        const decodedToken = decodeEditorArtifactToken(artifactUrl.pathname)
        expect(decodedToken.parentOrigin).toBe('https://platform.example.test')
    })

    it('marks authoring host bridge session descriptors as no-store', async () => {
        mockListMetahubPackages.mockResolvedValueOnce([
            {
                ...playCanvasAttachment,
                config: {
                    ...displayConfig,
                    playcanvasProject: { defaultProjectId: '019e8afa-0000-7000-8000-000000000001' }
                }
            }
        ])

        const response = await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/authoring-host').expect(200)

        expect(response.body.playcanvasEditor?.bridge?.sessionToken).toEqual(expect.any(String))
        expect(response.headers['cache-control']).toBe('no-store')
    })

    it('returns a bridge-ready descriptor for a legacy PlayCanvas project without mutating it from GET', async () => {
        mockListMetahubPackages.mockResolvedValueOnce([
            {
                ...playCanvasAttachment,
                config: {
                    ...displayConfig,
                    playcanvasProject: { defaultProjectId: '019e8afa-0000-7000-8000-000000000001' }
                }
            }
        ])
        mockSummarizePlayCanvasProject.mockResolvedValueOnce({
            id: '019e8afa-0000-7000-8000-000000000001',
            defaultSceneId: null
        })

        const response = await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/authoring-host').expect(200)

        expect(mockUpsertPlayCanvasScene).not.toHaveBeenCalled()
        expect(mockUpdatePlayCanvasProject).not.toHaveBeenCalled()
        expect(response.body.playcanvasEditor?.bridge?.sessionToken).toEqual(expect.any(String))
        expect(response.body.playcanvasEditor?.selectedProject?.defaultSceneId).toBeNull()
        expect(response.body.playcanvasEditor?.compatibilityStatus).toBe('ready')
        expect(response.headers['cache-control']).toBe('no-store')
    })

    it('does not expose a hosted bridge artifact when the configured default project is stale', async () => {
        mockListMetahubPackages.mockResolvedValueOnce([
            {
                ...playCanvasAttachment,
                config: {
                    ...displayConfig,
                    playcanvasProject: { defaultProjectId: '019e8afa-0000-7000-8000-000000000001' }
                }
            }
        ])
        mockFindPlayCanvasProject.mockResolvedValueOnce(null)

        const response = await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/authoring-host').expect(200)

        expect(response.body.artifactStatus).toBe('blocked')
        expect(response.body.artifactUrl).toBeNull()
        expect(response.body.playcanvasEditor).toBeNull()
        expect(mockSummarizePlayCanvasProject).not.toHaveBeenCalled()
        expect(mockUpsertPlayCanvasScene).not.toHaveBeenCalled()
        expect(response.headers['cache-control']).toBeUndefined()
    })

    it('does not expose artifact-only PlayCanvas fallback builds for an expected hosted package', async () => {
        mockListMetahubPackages.mockResolvedValueOnce([
            {
                ...playCanvasAttachment,
                config: {
                    ...displayConfig,
                    playcanvasProject: { defaultProjectId: '019e8afa-0000-7000-8000-000000000001' }
                }
            }
        ])
        mockReadFile.mockResolvedValueOnce(
            JSON.stringify({
                mode: 'artifact-only',
                smokeMode: 'artifact-only'
            })
        )

        const response = await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/authoring-host').expect(200)

        expect(response.body.artifactStatus).toBe('missing')
        expect(response.body.artifactUrl).toBeNull()
        expect(response.body.playcanvasEditor).toBeNull()
        expect(mockFindPlayCanvasProject).not.toHaveBeenCalled()
    })

    it('does not expose hosted PlayCanvas artifacts when the bridge bootstrap file is missing', async () => {
        mockListMetahubPackages.mockResolvedValueOnce([
            {
                ...playCanvasAttachment,
                config: {
                    ...displayConfig,
                    playcanvasProject: { defaultProjectId: '019e8afa-0000-7000-8000-000000000001' }
                }
            }
        ])
        mockAccess.mockImplementation(async (filePath: string) => {
            if (filePath.endsWith('universo-bridge-bootstrap.js')) {
                throw new Error('missing bootstrap')
            }
        })

        const response = await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/authoring-host').expect(200)

        expect(response.body.artifactStatus).toBe('missing')
        expect(response.body.artifactUrl).toBeNull()
        expect(response.body.playcanvasEditor).toBeNull()
        expect(mockFindPlayCanvasProject).not.toHaveBeenCalled()
    })

    it('redacts saved development URLs from the read-level attached packages list', async () => {
        mockListMetahubPackages.mockResolvedValueOnce([
            {
                ...playCanvasAttachment,
                config: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: {
                        mode: 'developmentUrl',
                        developmentUrl: 'http://localhost:5100/editor',
                        showArtifactOnlyNotice: true
                    }
                }
            }
        ])

        const response = await request(buildApp()).get('/metahub/metahub-1/packages').expect(200)

        expect(response.body.items[0].config).toEqual({
            schemaVersion: '1',
            kind: 'display',
            display: {
                mode: 'developmentUrl',
                developmentUrl: null,
                showArtifactOnlyNotice: true
            }
        })
        expect(JSON.stringify(response.body)).not.toContain('http://localhost:5100/editor')
        expect(JSON.stringify(response.body)).not.toContain('dist/editor')
        expect(JSON.stringify(response.body)).not.toContain('universo-artifact-manifest.json')
    })

    it('redacts artifact internals from the read-level catalog list', async () => {
        mockListPackageCatalog.mockResolvedValueOnce([
            {
                id: playCanvasAttachment.packageId,
                packageName: playCanvasAttachment.packageName,
                version: playCanvasAttachment.version,
                displayName: playCanvasAttachment.displayName,
                description: playCanvasAttachment.description,
                source: playCanvasAttachment.source,
                authoringSurface: playCanvasAttachment.authoringSurface,
                isActive: true,
                attached: true,
                attachmentId: playCanvasAttachment.id,
                attachedPackageId: playCanvasAttachment.packageId,
                attachedVersion: playCanvasAttachment.version
            }
        ])

        const response = await request(buildApp()).get('/metahub/metahub-1/packages/catalog').expect(200)

        expect(response.body.items[0].authoringSurface.kind).toBe('playcanvasEditor')
        expect(response.body.items[0].authoringSurface.artifact).toBeUndefined()
        expect(JSON.stringify(response.body)).not.toContain('dist/editor')
        expect(JSON.stringify(response.body)).not.toContain('universo-artifact-manifest.json')
    })

    it('blocks stale saved development URLs that are no longer allowlisted when returning the authoring host descriptor', async () => {
        mockListMetahubPackages.mockResolvedValueOnce([
            {
                ...playCanvasAttachment,
                config: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: {
                        mode: 'developmentUrl',
                        developmentUrl: 'http://localhost:5100/editor',
                        showArtifactOnlyNotice: true
                    }
                }
            },
            noneAttachment
        ])

        const response = await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/authoring-host').expect(200)

        expect(response.body.artifactStatus).toBe('blocked')
        expect(response.body.artifactUrl).toBeNull()
        expect(response.body.attachmentConfig).toEqual(displayConfig)
        expect(JSON.stringify(response.body)).not.toContain('http://localhost:5100/editor')
    })

    it('rejects duplicate authoring package slugs instead of selecting an arbitrary package', async () => {
        mockListMetahubPackages.mockResolvedValueOnce([
            playCanvasAttachment,
            {
                ...playCanvasAttachment,
                id: 'attach-playcanvas-fork',
                packageId: 'pkg-playcanvas-fork',
                packageName: `@universo-react/${'playcanvas-editor-frontend'}-fork`
            }
        ])

        await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/authoring-host').expect(400)
    })

    it('serves editor artifacts with defensive headers and a root-contained file path', async () => {
        const response = await request(buildApp())
            .get('/metahub/metahub-1/packages/playcanvas-editor/editor-artifact/assets/editor.js')
            .expect(200)

        expect(response.text).toBe('artifact')
        expect(response.headers['x-content-type-options']).toBe('nosniff')
        expect(response.headers['cache-control']).toBe('private, max-age=300')
        expect(response.headers['content-security-policy']).toContain('sandbox allow-scripts')
        expect(response.headers['content-security-policy']).toContain("'unsafe-inline'")
        expect(response.headers['content-security-policy']).toContain("frame-ancestors 'self'")
        expect(response.headers['content-type']).toContain('application/javascript')
        expect(response.headers['x-test-sendfile']).toContain('/assets/editor.js')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
    })

    it('does not serve the editor artifact entrypoint through the same-origin authenticated route', async () => {
        await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/editor-artifact/index.html').expect(404)
    })

    it('serves tokenized editor artifact assets without session cookies for sandboxed subresources', async () => {
        const hostResponse = await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/authoring-host').expect(200)
        const assetUrl = new URL(String(hostResponse.body.artifactUrl)).pathname
            .replace(/^\/api\/v1/, '')
            .replace('/index.html', '/assets/editor.js')
        const rejectingAuth: RequestHandler = (_req, res) => res.status(401).json({ error: 'Unauthorized' })

        const response = await request(buildApp(rejectingAuth)).get(assetUrl).expect(200)

        expect(response.text).toBe('artifact')
        expect(response.headers['cache-control']).toBe('private, max-age=300')
        expect(response.headers['access-control-allow-origin']).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
        expect(response.headers.vary).toContain('Origin')
        expect(response.headers['x-test-sendfile']).toContain('/assets/editor.js')
        expect(mockEnsureMetahubAccess).toHaveBeenLastCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub')
        expect(mockListMetahubPackages).toHaveBeenCalledTimes(2)
    })

    it('rejects tokenized editor artifact CORS requests from origins outside the issued parent origin', async () => {
        const hostResponse = await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/authoring-host').expect(200)
        const assetUrl = new URL(String(hostResponse.body.artifactUrl)).pathname
            .replace(/^\/api\/v1/, '')
            .replace('/index.html', '/assets/editor.js')
        const rejectingAuth: RequestHandler = (_req, res) => res.status(401).json({ error: 'Unauthorized' })

        await request(buildApp(rejectingAuth)).get(assetUrl).set('Origin', 'https://evil.example.test').expect(403)

        expect(mockEnsureMetahubAccess).toHaveBeenLastCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub')
        expect(mockListMetahubPackages).toHaveBeenCalledTimes(2)
    })

    it('rejects tokenized editor artifact URLs when the issuing user no longer manages the metahub', async () => {
        const hostResponse = await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/authoring-host').expect(200)
        const assetUrl = new URL(String(hostResponse.body.artifactUrl)).pathname
            .replace(/^\/api\/v1/, '')
            .replace('/index.html', '/assets/editor.js')
        const rejectingAuth: RequestHandler = (_req, res) => res.status(401).json({ error: 'Unauthorized' })

        mockEnsureMetahubAccess.mockRejectedValueOnce(new Error('revoked'))

        await request(buildApp(rejectingAuth)).get(assetUrl).expect(404)
        expect(mockListMetahubPackages).toHaveBeenCalledTimes(1)
    })

    it('rejects tokenized editor artifact URLs when the package display mode changes after token issue', async () => {
        const hostResponse = await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/authoring-host').expect(200)
        const assetUrl = new URL(String(hostResponse.body.artifactUrl)).pathname
            .replace(/^\/api\/v1/, '')
            .replace('/index.html', '/assets/editor.js')
        const rejectingAuth: RequestHandler = (_req, res) => res.status(401).json({ error: 'Unauthorized' })

        mockListMetahubPackages.mockResolvedValueOnce([
            {
                ...playCanvasAttachment,
                config: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: {
                        mode: 'disabled',
                        developmentUrl: null,
                        showArtifactOnlyNotice: true
                    }
                }
            }
        ])

        await request(buildApp(rejectingAuth)).get(assetUrl).expect(404)
        expect(mockListMetahubPackages).toHaveBeenCalledTimes(2)
    })

    it('rejects invalid tokenized editor artifact URLs before the authenticated package routes', async () => {
        const rejectingAuth: RequestHandler = (_req, res) => res.status(401).json({ error: 'Unauthorized' })

        await request(buildApp(rejectingAuth))
            .get('/metahub/metahub-1/packages/playcanvas-editor/editor-artifact-token/not-a-token/assets/editor.js')
            .expect(404)

        expect(mockEnsureMetahubAccess).not.toHaveBeenCalled()
    })

    it('passes explicit config reset intent when changing package versions', async () => {
        await request(buildApp())
            .patch('/metahub/metahub-1/package/attach-playcanvas')
            .send({ version: '0.2.0', resetConfig: true })
            .expect(200)

        expect(mockChangeMetahubPackageVersion).toHaveBeenCalledWith(mockExec, {
            metahubId: 'metahub-1',
            attachmentId: 'attach-playcanvas',
            version: '0.2.0',
            resetConfig: true,
            userId: 'user-1'
        })
    })

    it('does not serve editor artifacts when the package display mode is disabled', async () => {
        mockListMetahubPackages.mockResolvedValueOnce([
            {
                ...playCanvasAttachment,
                config: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: {
                        mode: 'disabled',
                        developmentUrl: null,
                        showArtifactOnlyNotice: true
                    }
                }
            }
        ])

        await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/editor-artifact/index.html').expect(404)
        expect(mockAccess).not.toHaveBeenCalled()
    })

    it('does not serve editor artifacts when the package uses a development URL', async () => {
        process.env.PLAYCANVAS_EDITOR_DEVELOPMENT_URLS = 'http://localhost:5100'
        mockListMetahubPackages.mockResolvedValueOnce([
            {
                ...playCanvasAttachment,
                config: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: {
                        mode: 'developmentUrl',
                        developmentUrl: 'http://localhost:5100/editor',
                        showArtifactOnlyNotice: true
                    }
                }
            }
        ])

        await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/editor-artifact/index.html').expect(404)
        expect(mockAccess).not.toHaveBeenCalled()
    })

    it('does not serve editor artifacts when saved development URL settings are stale', async () => {
        mockListMetahubPackages.mockResolvedValueOnce([
            {
                ...playCanvasAttachment,
                config: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: {
                        mode: 'developmentUrl',
                        developmentUrl: 'http://localhost:5100/editor',
                        showArtifactOnlyNotice: true
                    }
                }
            }
        ])

        await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/editor-artifact/index.html').expect(400)
        expect(mockAccess).not.toHaveBeenCalled()
    })

    it('rejects traversal and symlink escapes for editor artifact files', async () => {
        await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/editor-artifact/%2e%2e/secret.txt').expect(400)

        mockRealpath.mockImplementation(async (filePath: string) =>
            filePath.endsWith('/leak.js') ? '/tmp/playcanvas-editor-leak.js' : filePath
        )

        await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/editor-artifact/leak.js').expect(404)
    })

    it('requires the manifest and requested artifact file before serving an editor artifact', async () => {
        mockAccess.mockRejectedValueOnce(new Error('missing manifest')).mockResolvedValue(undefined)

        await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/editor-artifact/index.html').expect(404)
    })

    it('rejects display settings for packages without an authoring surface', async () => {
        await request(buildApp()).patch('/metahub/metahub-1/package/attach-engine/config').send({ config: displayConfig }).expect(400)

        expect(mockUpdateMetahubPackageConfig).not.toHaveBeenCalled()
    })

    it('rejects unallowlisted development URLs before saving config', async () => {
        await request(buildApp())
            .patch('/metahub/metahub-1/package/attach-playcanvas/config')
            .send({
                config: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: {
                        mode: 'developmentUrl',
                        developmentUrl: 'http://localhost:5100/editor',
                        showArtifactOnlyNotice: true
                    }
                }
            })
            .expect(400)

        expect(mockUpdateMetahubPackageConfig).not.toHaveBeenCalled()
    })

    it('rejects malformed development URLs with a validation error before saving config', async () => {
        process.env.PLAYCANVAS_EDITOR_DEVELOPMENT_URLS = 'http://localhost:5100'

        await request(buildApp())
            .patch('/metahub/metahub-1/package/attach-playcanvas/config')
            .send({
                config: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: {
                        mode: 'developmentUrl',
                        developmentUrl: 'not a url',
                        showArtifactOnlyNotice: true
                    }
                }
            })
            .expect(400)

        expect(mockUpdateMetahubPackageConfig).not.toHaveBeenCalled()
    })

    it('rejects non-http development URLs even when their origin is allowlisted', async () => {
        process.env.PLAYCANVAS_EDITOR_DEVELOPMENT_URLS = 'ftp://localhost:5100'

        await request(buildApp())
            .patch('/metahub/metahub-1/package/attach-playcanvas/config')
            .send({
                config: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: {
                        mode: 'developmentUrl',
                        developmentUrl: 'ftp://localhost:5100/editor',
                        showArtifactOnlyNotice: true
                    }
                }
            })
            .expect(400)

        expect(mockUpdateMetahubPackageConfig).not.toHaveBeenCalled()
    })

    it('rejects development URLs with embedded credentials', async () => {
        process.env.PLAYCANVAS_EDITOR_DEVELOPMENT_URLS = 'http://localhost:5100'

        await request(buildApp())
            .patch('/metahub/metahub-1/package/attach-playcanvas/config')
            .send({
                config: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: {
                        mode: 'developmentUrl',
                        developmentUrl: 'http://user:pass@localhost:5100/editor',
                        showArtifactOnlyNotice: true
                    }
                }
            })
            .expect(400)

        expect(mockUpdateMetahubPackageConfig).not.toHaveBeenCalled()
    })

    it('returns allowlisted development URL settings through the manager-only authoring host', async () => {
        process.env.PLAYCANVAS_EDITOR_DEVELOPMENT_URLS = 'http://localhost:5100/, https://editor.example.test/path'
        mockListMetahubPackages.mockResolvedValueOnce([
            {
                ...playCanvasAttachment,
                config: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: {
                        mode: 'developmentUrl',
                        developmentUrl: 'http://localhost:5100/editor',
                        showArtifactOnlyNotice: true
                    }
                }
            }
        ])

        const response = await request(buildApp()).get('/metahub/metahub-1/packages/playcanvas-editor/authoring-host').expect(200)

        expect(response.body.allowedDisplayModes).toEqual(['disabled', 'embeddedIframe', 'openSeparately', 'developmentUrl'])
        expect(response.body.artifactStatus).toBe('available')
        expect(response.body.artifactUrl).toBeNull()
        expect(response.body.attachmentConfig.display).toEqual({
            mode: 'developmentUrl',
            developmentUrl: 'http://localhost:5100/editor',
            showArtifactOnlyNotice: true
        })
    })

    it('normalizes and saves allowlisted development URL settings', async () => {
        process.env.PLAYCANVAS_EDITOR_DEVELOPMENT_URLS = 'http://localhost:5100/, https://editor.example.test/path'

        await request(buildApp())
            .patch('/metahub/metahub-1/package/attach-playcanvas/config')
            .send({
                config: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: {
                        mode: 'developmentUrl',
                        developmentUrl: 'http://localhost:5100/editor',
                        showArtifactOnlyNotice: false
                    }
                }
            })
            .expect(200)

        expect(mockUpdateMetahubPackageConfig).toHaveBeenCalledWith(mockExec, {
            metahubId: 'metahub-1',
            attachmentId: 'attach-playcanvas',
            config: {
                schemaVersion: '1',
                kind: 'display',
                display: {
                    mode: 'developmentUrl',
                    developmentUrl: 'http://localhost:5100/editor',
                    showArtifactOnlyNotice: false
                }
            },
            userId: 'user-1',
            expectedPackageId: 'pkg-playcanvas'
        })
    })

    it('validates PlayCanvas default project pointer before saving package config', async () => {
        await request(buildApp())
            .patch('/metahub/metahub-1/package/attach-playcanvas/config')
            .send({
                config: {
                    ...displayConfig,
                    playcanvasProject: {
                        defaultProjectId: '019e8afa-0000-7000-8000-000000000001'
                    }
                }
            })
            .expect(200)

        expect(mockEnsureSchema).not.toHaveBeenCalled()
        expect(mockFindMetahubByIdNotDeleted).toHaveBeenCalledWith(mockExec, 'metahub-1')
        expect(mockFindBranchByIdAndMetahub).toHaveBeenCalledWith(mockExec, 'branch-default', 'metahub-1')
        expect(mockFindPlayCanvasProject).toHaveBeenCalledWith(mockExec, 'mhb_default_schema', '019e8afa-0000-7000-8000-000000000001')
        expect(mockUpdateMetahubPackageConfig).toHaveBeenCalledWith(mockExec, {
            metahubId: 'metahub-1',
            attachmentId: 'attach-playcanvas',
            config: {
                ...displayConfig,
                playcanvasProject: {
                    defaultProjectId: '019e8afa-0000-7000-8000-000000000001'
                }
            },
            userId: 'user-1',
            expectedPackageId: 'pkg-playcanvas'
        })
    })

    it('rejects stale PlayCanvas default project pointers before saving package config', async () => {
        mockFindPlayCanvasProject.mockResolvedValueOnce(null)

        await request(buildApp())
            .patch('/metahub/metahub-1/package/attach-playcanvas/config')
            .send({
                config: {
                    ...displayConfig,
                    playcanvasProject: {
                        defaultProjectId: '019e8afa-0000-7000-8000-000000000001'
                    }
                }
            })
            .expect(400)

        expect(mockUpdateMetahubPackageConfig).not.toHaveBeenCalled()
    })
})
