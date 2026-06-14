import { createLocalizedContent } from '@universo-react/utils'
import { createPlayCanvasProjectsController } from '../../domains/playcanvas-projects/controllers/playCanvasProjectsController'
import { MetahubValidationError } from '../../domains/shared/domainErrors'
import { PlayCanvasProjectsService } from '../../domains/playcanvas-projects/services/PlayCanvasProjectsService'
import { PlayCanvasEditorBridgeSessionService } from '../../domains/playcanvas-projects/services/PlayCanvasEditorBridgeSessionService'

const TEST_SCHEMA = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
const editorPackageName = `@universo-react/${'playcanvas-editor-frontend'}`

const bridgeManagerAccessRows = (sql: string): unknown[] | null => {
    if (sql.includes('SELECT admin.is_superuser')) {
        return [{ is_super: false }]
    }
    if (sql.includes('FROM metahubs.rel_metahub_users')) {
        return [
            {
                id: '019e8afa-0000-7000-8000-000000000099',
                metahubId: 'metahub-1',
                userId: 'user-1',
                activeBranchId: null,
                role: 'admin',
                comment: null
            }
        ]
    }
    return null
}

describe('createPlayCanvasProjectsController permissions', () => {
    it('protects PlayCanvas authoring metadata, files, and snapshots with manageMetahub', () => {
        const registrations: Array<{ returned: jest.Mock; permission?: string }> = []
        const createHandler = jest.fn((_handler: unknown, options?: { permission?: string }) => {
            const returned = jest.fn()
            registrations.push({ returned, permission: options?.permission })
            return returned
        })

        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const permissionFor = (handler: unknown): string | undefined =>
            registrations.find((registration) => registration.returned === handler)?.permission

        expect(permissionFor(ctrl.list)).toBe('manageMetahub')
        expect(permissionFor(ctrl.getById)).toBe('manageMetahub')
        expect(permissionFor(ctrl.create)).toBe('manageMetahub')
        expect(permissionFor(ctrl.update)).toBe('manageMetahub')
        expect(permissionFor(ctrl.remove)).toBe('manageMetahub')
        expect(permissionFor(ctrl.listScenes)).toBe('manageMetahub')
        expect(permissionFor(ctrl.getScene)).toBe('manageMetahub')
        expect(permissionFor(ctrl.writeScene)).toBe('manageMetahub')
        expect(permissionFor(ctrl.listAssets)).toBe('manageMetahub')
        expect(permissionFor(ctrl.getAsset)).toBe('manageMetahub')
        expect(permissionFor(ctrl.writeAsset)).toBe('manageMetahub')
        expect(permissionFor(ctrl.writeScriptAsset)).toBe('manageMetahub')
        expect(permissionFor(ctrl.writeBinding)).toBe('manageMetahub')
        expect(permissionFor(ctrl.writeGeneratedArtifact)).toBe('manageMetahub')
        expect(permissionFor(ctrl.publishProjectState)).toBe('manageMetahub')
        expect(permissionFor(ctrl.exportProjectState)).toBe('manageMetahub')
        expect(permissionFor(ctrl.editorBridgeCommand)).toBeUndefined()
        expect(permissionFor(ctrl.readFile)).toBe('manageMetahub')
        expect(permissionFor(ctrl.writeFile)).toBe('manageMetahub')
        expect(permissionFor(ctrl.deleteFile)).toBe('manageMetahub')
    })

    it('rejects PlayCanvas file writes without an optimistic current checksum guard', async () => {
        const writeProjectFile = jest.spyOn(PlayCanvasProjectsService.prototype, 'writeProjectFile').mockResolvedValue({
            sourcePath: 'playcanvas-projects/018f8a78-7b8f-7c1d-a111-222233334444/scenes/scene.json',
            checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            size: 2,
            mime: 'application/json'
        })
        const createHandler = jest.fn((handler: unknown) => handler)
        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const res = {
            setHeader: jest.fn(),
            status: jest.fn(function status() {
                return res
            }),
            json: jest.fn()
        }

        await ctrl.writeFile({
            req: {
                params: {
                    projectId: '018f8a78-7b8f-7c1d-a111-222233334444'
                },
                body: {
                    sourcePath: 'playcanvas-projects/018f8a78-7b8f-7c1d-a111-222233334444/scenes/scene.json',
                    contentBase64: Buffer.from('{}').toString('base64'),
                    expectedChecksum: null,
                    mime: 'application/json'
                }
            },
            res,
            metahubId: 'metahub-1',
            userId: 'user-1',
            exec: {},
            schemaService: { ensureSchema: jest.fn(async () => TEST_SCHEMA) }
        } as never)

        expect(writeProjectFile).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Invalid input'
            })
        )

        writeProjectFile.mockRestore()
    })

    it('rejects PlayCanvas file deletes without an optimistic current checksum guard', async () => {
        const deleteProjectFile = jest.spyOn(PlayCanvasProjectsService.prototype, 'deleteProjectFile').mockResolvedValue()
        const createHandler = jest.fn((handler: unknown) => handler)
        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const res = {
            setHeader: jest.fn(),
            status: jest.fn(function status() {
                return res
            }),
            json: jest.fn()
        }

        await ctrl.deleteFile({
            req: {
                params: {
                    projectId: '018f8a78-7b8f-7c1d-a111-222233334444'
                },
                query: {
                    sourcePath: 'playcanvas-projects/018f8a78-7b8f-7c1d-a111-222233334444/scenes/scene.json'
                }
            },
            res,
            metahubId: 'metahub-1',
            userId: 'user-1',
            exec: {},
            schemaService: { ensureSchema: jest.fn(async () => TEST_SCHEMA) }
        } as never)

        expect(deleteProjectFile).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid query' }))

        deleteProjectFile.mockRestore()
    })

    it('passes the optimistic current checksum guard to PlayCanvas file deletes', async () => {
        const deleteProjectFile = jest.spyOn(PlayCanvasProjectsService.prototype, 'deleteProjectFile').mockResolvedValue()
        const createHandler = jest.fn((handler: unknown) => handler)
        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const res = {
            setHeader: jest.fn(),
            status: jest.fn(function status() {
                return res
            }),
            send: jest.fn()
        }
        const projectId = '018f8a78-7b8f-7c1d-a111-222233334444'
        const sourcePath = `playcanvas-projects/${projectId}/scenes/scene.json`
        const expectedCurrentChecksum = 'a'.repeat(64)

        await ctrl.deleteFile({
            req: {
                params: {
                    projectId
                },
                query: {
                    sourcePath,
                    expectedCurrentChecksum
                }
            },
            res,
            metahubId: 'metahub-1',
            userId: 'user-1',
            exec: {},
            schemaService: { ensureSchema: jest.fn(async () => TEST_SCHEMA) }
        } as never)

        expect(deleteProjectFile).toHaveBeenCalledWith('metahub-1', projectId, sourcePath, expectedCurrentChecksum, 'user-1')
        expect(res.status).toHaveBeenCalledWith(204)
        expect(res.send).toHaveBeenCalled()

        deleteProjectFile.mockRestore()
    })

    it('rejects stale bridge sessions when the PlayCanvas Editor package is no longer enabled', async () => {
        const projectId = '019e8afa-0000-7000-8000-000000000001'
        const sceneId = '019e8afa-0000-7000-8000-000000000002'
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const session = sessionService.create({
            metahubId: 'metahub-1',
            packageSlug: 'playcanvas-editor',
            projectId,
            defaultSceneId: sceneId,
            userId: 'user-1',
            capabilities: ['scene.save']
        })
        const saveEditorScene = jest.spyOn(PlayCanvasProjectsService.prototype, 'saveEditorScene').mockResolvedValue({} as never)
        const createHandler = jest.fn((handler: unknown) => handler)
        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const res = {
            setHeader: jest.fn(),
            status: jest.fn(),
            json: jest.fn()
        }
        res.status.mockReturnValue(res)
        const exec = {
            query: jest.fn(async (sql: string) => {
                const accessRows = bridgeManagerAccessRows(sql)
                if (accessRows) return accessRows
                if (sql.includes('FROM "metahubs"."rel_metahub_packages"')) {
                    return [
                        {
                            id: '019e8afa-0000-7000-8000-000000000003',
                            metahubId: 'metahub-1',
                            packageId: '019e8afa-0000-7000-8000-000000000004',
                            packageName: editorPackageName,
                            version: '0.1.0',
                            displayName: createLocalizedContent('en', 'PlayCanvas Editor'),
                            description: null,
                            source: { kind: 'workspace', packageName: editorPackageName },
                            authoringSurface: {
                                schemaVersion: '1',
                                kind: 'playcanvasEditor',
                                packageSlug: 'playcanvas-editor',
                                supportedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately'],
                                defaultConfig: {
                                    schemaVersion: '1',
                                    kind: 'display',
                                    display: {
                                        mode: 'embeddedIframe',
                                        developmentUrl: null,
                                        showArtifactOnlyNotice: false
                                    },
                                    playcanvasProject: {
                                        defaultProjectId: null
                                    }
                                },
                                artifact: {
                                    packageName: editorPackageName,
                                    manifestFileName: 'universo-artifact-manifest.json',
                                    outputRoot: 'dist/editor',
                                    smokeMode: 'universo-full-upstream-ui'
                                }
                            },
                            config: {
                                schemaVersion: '1',
                                kind: 'display',
                                display: {
                                    mode: 'disabled',
                                    developmentUrl: null,
                                    showArtifactOnlyNotice: false
                                },
                                playcanvasProject: {
                                    defaultProjectId: projectId
                                }
                            },
                            attachedAt: new Date(),
                            isActive: true
                        }
                    ]
                }
                if (sql.includes('DELETE FROM') && sql.includes('_app_settings')) return []
                if (sql.includes('INSERT INTO') && sql.includes('_app_settings')) {
                    return [{ id: '019e8afa-0000-7000-8000-000000000006' }]
                }
                if (sql.includes('UPDATE') && sql.includes('_app_settings')) {
                    return [{ id: '019e8afa-0000-7000-8000-000000000006' }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        }

        await ctrl.editorBridgeCommand({
            req: {
                body: {
                    sessionToken: session.token,
                    command: {
                        type: 'scene.save',
                        requestId: session.payload.sessionId,
                        sessionId: session.payload.sessionId,
                        nonce: session.payload.nonce,
                        projectId,
                        sceneId,
                        expectedCurrentChecksum: null,
                        payload: {
                            schemaVersion: '1',
                            entities: []
                        }
                    }
                }
            },
            res,
            metahubId: 'metahub-1',
            userId: 'user-1',
            exec,
            schemaService: { ensureSchema: jest.fn(async () => TEST_SCHEMA) }
        } as never)

        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                ok: false,
                code: 'artifactUnavailable',
                requestId: session.payload.sessionId
            })
        )
        expect(saveEditorScene).not.toHaveBeenCalled()

        saveEditorScene.mockRestore()
    })

    it('loads the selected editor project through the mutation-safe default scene initializer', async () => {
        const projectId = '019e8afa-0000-7000-8000-000000000001'
        const requestId = '019e8afa-0000-7000-8000-000000000002'
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const session = sessionService.create({
            metahubId: 'metahub-1',
            packageSlug: 'playcanvas-editor',
            projectId,
            userId: 'user-1',
            capabilities: ['project.loadSelected']
        })
        const loadSelectedProjectForEditor = jest
            .spyOn(PlayCanvasProjectsService.prototype, 'loadSelectedProjectForEditor')
            .mockResolvedValue({
                id: projectId,
                defaultSceneId: projectId
            } as never)
        const createHandler = jest.fn((handler: unknown) => handler)
        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const res = {
            setHeader: jest.fn(),
            status: jest.fn(),
            json: jest.fn()
        }
        res.status.mockReturnValue(res)
        const exec = {
            query: jest.fn(async (sql: string) => {
                const accessRows = bridgeManagerAccessRows(sql)
                if (accessRows) return accessRows
                if (sql.includes('FROM "metahubs"."rel_metahub_packages"')) {
                    return [
                        {
                            id: '019e8afa-0000-7000-8000-000000000003',
                            metahubId: 'metahub-1',
                            packageId: '019e8afa-0000-7000-8000-000000000004',
                            packageName: editorPackageName,
                            version: '0.1.0',
                            displayName: createLocalizedContent('en', 'PlayCanvas Editor'),
                            description: null,
                            source: { kind: 'workspace', packageName: editorPackageName },
                            authoringSurface: {
                                schemaVersion: '1',
                                kind: 'playcanvasEditor',
                                packageSlug: 'playcanvas-editor',
                                supportedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately'],
                                defaultConfig: {
                                    schemaVersion: '1',
                                    kind: 'display',
                                    display: {
                                        mode: 'embeddedIframe',
                                        developmentUrl: null,
                                        showArtifactOnlyNotice: false
                                    },
                                    playcanvasProject: {
                                        defaultProjectId: null
                                    }
                                },
                                artifact: {
                                    packageName: editorPackageName,
                                    manifestFileName: 'universo-artifact-manifest.json',
                                    outputRoot: 'dist/editor',
                                    smokeMode: 'universo-full-upstream-ui'
                                }
                            },
                            config: {
                                schemaVersion: '1',
                                kind: 'display',
                                display: {
                                    mode: 'embeddedIframe',
                                    developmentUrl: null,
                                    showArtifactOnlyNotice: false
                                },
                                playcanvasProject: {
                                    defaultProjectId: projectId
                                }
                            },
                            attachedAt: new Date(),
                            isActive: true
                        }
                    ]
                }
                if (sql.includes('DELETE FROM') && sql.includes('_app_settings')) return []
                if (sql.includes('INSERT INTO') && sql.includes('_app_settings')) {
                    return [{ id: '019e8afa-0000-7000-8000-000000000006' }]
                }
                if (sql.includes('UPDATE') && sql.includes('_app_settings')) {
                    return [{ id: '019e8afa-0000-7000-8000-000000000006' }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        }

        await ctrl.editorBridgeCommand({
            req: {
                body: {
                    sessionToken: session.token,
                    command: {
                        type: 'project.loadSelected',
                        requestId,
                        sessionId: session.payload.sessionId,
                        nonce: session.payload.nonce
                    }
                }
            },
            res,
            metahubId: 'metahub-1',
            userId: 'user-1',
            exec,
            schemaService: { ensureSchema: jest.fn(async () => TEST_SCHEMA) }
        } as never)

        expect(loadSelectedProjectForEditor).toHaveBeenCalledWith('metahub-1', projectId, 'user-1')
        expect(res.json).toHaveBeenCalledWith({
            ok: true,
            requestId,
            data: {
                project: {
                    id: projectId,
                    defaultSceneId: projectId
                }
            }
        })

        loadSelectedProjectForEditor.mockRestore()
    })

    it('returns the minimal compatibility protocol descriptor through the existing bridge boundary', async () => {
        const projectId = '019e8afa-0000-7000-8000-000000000001'
        const requestId = '019e8afa-0000-7000-8000-000000000002'
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const session = sessionService.create({
            metahubId: 'metahub-1',
            packageSlug: 'playcanvas-editor',
            projectId,
            userId: 'user-1',
            capabilities: ['protocol.describe']
        })
        const describeEditorCompatibilityProtocol = jest
            .spyOn(PlayCanvasProjectsService.prototype, 'describeEditorCompatibilityProtocol')
            .mockResolvedValue({
                schemaVersion: '1',
                mode: 'universo-bridge-minimal',
                upstream: {
                    repository: 'https://github.com/playcanvas/editor',
                    minimumTag: 'v2.23.4'
                },
                project: { id: projectId, defaultSceneId: projectId },
                defaultSceneId: projectId,
                identity: {
                    self: { id: 'user-1', role: 'designer' },
                    owner: { id: 'metahub-1', type: 'metahub' },
                    permissions: { read: true, write: true, admin: false },
                    branch: { id: projectId, name: 'Main', active: true },
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
                    projectUser: `project_${projectId}_user-1`,
                    projectPrivate: `project-private_${projectId}`
                }
            } as never)
        const createHandler = jest.fn((handler: unknown) => handler)
        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const res = {
            setHeader: jest.fn(),
            status: jest.fn(),
            json: jest.fn()
        }
        res.status.mockReturnValue(res)
        const exec = {
            query: jest.fn(async (sql: string) => {
                const accessRows = bridgeManagerAccessRows(sql)
                if (accessRows) return accessRows
                if (sql.includes('FROM "metahubs"."rel_metahub_packages"')) {
                    return [
                        {
                            id: '019e8afa-0000-7000-8000-000000000003',
                            metahubId: 'metahub-1',
                            packageId: '019e8afa-0000-7000-8000-000000000004',
                            packageName: editorPackageName,
                            version: '0.1.0',
                            displayName: createLocalizedContent('en', 'PlayCanvas Editor'),
                            description: null,
                            source: { kind: 'workspace', packageName: editorPackageName },
                            authoringSurface: {
                                schemaVersion: '1',
                                kind: 'playcanvasEditor',
                                packageSlug: 'playcanvas-editor',
                                supportedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately'],
                                defaultConfig: {
                                    schemaVersion: '1',
                                    kind: 'display',
                                    display: {
                                        mode: 'embeddedIframe',
                                        developmentUrl: null,
                                        showArtifactOnlyNotice: false
                                    },
                                    playcanvasProject: {
                                        defaultProjectId: null
                                    }
                                },
                                artifact: {
                                    packageName: editorPackageName,
                                    manifestFileName: 'universo-artifact-manifest.json',
                                    outputRoot: 'dist/editor',
                                    smokeMode: 'universo-full-upstream-ui'
                                }
                            },
                            config: {
                                schemaVersion: '1',
                                kind: 'display',
                                display: {
                                    mode: 'embeddedIframe',
                                    developmentUrl: null,
                                    showArtifactOnlyNotice: false
                                },
                                playcanvasProject: {
                                    defaultProjectId: projectId
                                }
                            },
                            attachedAt: new Date(),
                            isActive: true
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        }

        await ctrl.editorBridgeCommand({
            req: {
                body: {
                    sessionToken: session.token,
                    command: {
                        type: 'protocol.describe',
                        requestId,
                        sessionId: session.payload.sessionId,
                        nonce: session.payload.nonce
                    }
                }
            },
            res,
            metahubId: 'metahub-1',
            userId: 'user-1',
            exec,
            schemaService: { ensureSchema: jest.fn(async () => TEST_SCHEMA) }
        } as never)

        expect(describeEditorCompatibilityProtocol).toHaveBeenCalledWith('metahub-1', projectId, 'user-1')
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                ok: true,
                requestId,
                data: {
                    protocol: expect.objectContaining({
                        mode: 'universo-bridge-minimal',
                        defaultSceneId: projectId
                    })
                }
            })
        )

        describeEditorCompatibilityProtocol.mockRestore()
    })

    it('exposes a read-only editor-compatible protocol namespace without bridge session tokens', async () => {
        const projectId = '019e8afa-0000-7000-8000-000000000001'
        const describeEditorCompatibilityProtocol = jest
            .spyOn(PlayCanvasProjectsService.prototype, 'describeEditorCompatibilityProtocol')
            .mockResolvedValue({
                schemaVersion: '1',
                mode: 'universo-bridge-minimal',
                upstream: {
                    repository: 'https://github.com/playcanvas/editor',
                    minimumTag: 'v2.23.4'
                },
                project: null,
                defaultSceneId: null,
                identity: {
                    self: { id: 'user-1', role: 'designer' },
                    owner: { id: 'metahub-1', type: 'metahub' },
                    permissions: { read: true, write: true, admin: false },
                    branch: { id: projectId, name: 'Main', active: true },
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
                    projectUser: `project_${projectId}_user-1`,
                    projectPrivate: `project-private_${projectId}`
                }
            } as never)
        const createHandler = jest.fn((handler: unknown) => handler)
        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const res = {
            setHeader: jest.fn(),
            json: jest.fn()
        }

        await ctrl.editorCompatibleProtocol({
            req: {
                params: { projectId }
            },
            res,
            metahubId: 'metahub-1',
            userId: 'user-1',
            exec: { query: jest.fn() },
            schemaService: { ensureSchema: jest.fn(async () => TEST_SCHEMA) }
        } as never)

        expect(describeEditorCompatibilityProtocol).toHaveBeenCalledWith('metahub-1', projectId, 'user-1')
        expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                item: expect.objectContaining({
                    mode: 'universo-bridge-minimal',
                    endpoints: expect.objectContaining({
                        realtime: expect.objectContaining({ status: 'disabled' })
                    })
                })
            })
        )

        describeEditorCompatibilityProtocol.mockRestore()
    })

    it('returns a stored successful bridge save response for duplicate retries', async () => {
        const projectId = '019e8afa-0000-7000-8000-000000000001'
        const sceneId = '019e8afa-0000-7000-8000-000000000002'
        const requestId = '019e8afa-0000-7000-8000-000000000005'
        const storedResponse = {
            ok: true,
            requestId,
            data: {
                checksum: 'a'.repeat(64),
                scene: {
                    id: sceneId,
                    checksum: 'a'.repeat(64)
                }
            }
        }
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const session = sessionService.create({
            metahubId: 'metahub-1',
            packageSlug: 'playcanvas-editor',
            projectId,
            defaultSceneId: sceneId,
            userId: 'user-1',
            capabilities: ['scene.save']
        })
        const saveEditorScene = jest.spyOn(PlayCanvasProjectsService.prototype, 'saveEditorScene').mockResolvedValue({} as never)
        const createHandler = jest.fn((handler: unknown) => handler)
        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const res = {
            setHeader: jest.fn(),
            status: jest.fn(),
            json: jest.fn()
        }
        res.status.mockReturnValue(res)
        const exec = {
            query: jest.fn(async (sql: string) => {
                const accessRows = bridgeManagerAccessRows(sql)
                if (accessRows) return accessRows
                if (sql.includes('FROM "metahubs"."rel_metahub_packages"')) {
                    return [
                        {
                            id: '019e8afa-0000-7000-8000-000000000003',
                            metahubId: 'metahub-1',
                            packageId: '019e8afa-0000-7000-8000-000000000004',
                            packageName: editorPackageName,
                            version: '0.1.0',
                            displayName: createLocalizedContent('en', 'PlayCanvas Editor'),
                            description: null,
                            source: { kind: 'workspace', packageName: editorPackageName },
                            authoringSurface: {
                                schemaVersion: '1',
                                kind: 'playcanvasEditor',
                                packageSlug: 'playcanvas-editor',
                                supportedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately'],
                                defaultConfig: {
                                    schemaVersion: '1',
                                    kind: 'display',
                                    display: {
                                        mode: 'embeddedIframe',
                                        developmentUrl: null,
                                        showArtifactOnlyNotice: false
                                    },
                                    playcanvasProject: {
                                        defaultProjectId: null
                                    }
                                },
                                artifact: {
                                    packageName: editorPackageName,
                                    manifestFileName: 'universo-artifact-manifest.json',
                                    outputRoot: 'dist/editor',
                                    smokeMode: 'universo-full-upstream-ui'
                                }
                            },
                            config: {
                                schemaVersion: '1',
                                kind: 'display',
                                display: {
                                    mode: 'embeddedIframe',
                                    developmentUrl: null,
                                    showArtifactOnlyNotice: false
                                },
                                playcanvasProject: {
                                    defaultProjectId: projectId
                                }
                            },
                            attachedAt: new Date(),
                            isActive: true
                        }
                    ]
                }
                if (sql.includes('DELETE FROM') && sql.includes('_app_settings')) return []
                if (sql.includes('INSERT INTO') && sql.includes('_app_settings')) return []
                if (sql.includes('SELECT') && sql.includes('_app_settings'))
                    return [{ value: { status: 'completed', response: storedResponse } }]
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        }

        await ctrl.editorBridgeCommand({
            req: {
                body: {
                    sessionToken: session.token,
                    command: {
                        type: 'scene.save',
                        requestId,
                        sessionId: session.payload.sessionId,
                        nonce: session.payload.nonce,
                        projectId,
                        sceneId,
                        expectedCurrentChecksum: 'a'.repeat(64),
                        payload: {
                            schemaVersion: '1',
                            entities: []
                        }
                    }
                }
            },
            res,
            metahubId: 'metahub-1',
            userId: 'user-1',
            exec,
            schemaService: { ensureSchema: jest.fn(async () => TEST_SCHEMA) }
        } as never)

        expect(saveEditorScene).not.toHaveBeenCalled()
        expect(res.status).not.toHaveBeenCalledWith(409)
        expect(res.json).toHaveBeenCalledWith(storedResponse)

        saveEditorScene.mockRestore()
    })

    it('returns stored bridge save responses when retry payload keys are ordered differently', async () => {
        const projectId = '019e8afa-0000-7000-8000-000000000001'
        const sceneId = '019e8afa-0000-7000-8000-000000000002'
        const requestId = '019e8afa-0000-7000-8000-000000000005'
        const saveResult = {
            checksum: 'b'.repeat(64),
            scene: {
                id: sceneId,
                checksum: 'b'.repeat(64)
            }
        }
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const session = sessionService.create({
            metahubId: 'metahub-1',
            packageSlug: 'playcanvas-editor',
            projectId,
            defaultSceneId: sceneId,
            userId: 'user-1',
            capabilities: ['scene.save']
        })
        const saveEditorScene = jest.spyOn(PlayCanvasProjectsService.prototype, 'saveEditorScene').mockResolvedValue(saveResult as never)
        const createHandler = jest.fn((handler: unknown) => handler)
        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const firstRes = {
            setHeader: jest.fn(),
            status: jest.fn(),
            json: jest.fn()
        }
        firstRes.status.mockReturnValue(firstRes)
        const retryRes = {
            setHeader: jest.fn(),
            status: jest.fn(),
            json: jest.fn()
        }
        retryRes.status.mockReturnValue(retryRes)
        const replayRows = new Map<string, { value: unknown }>()
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                const accessRows = bridgeManagerAccessRows(sql)
                if (accessRows) return accessRows
                if (sql.includes('FROM "metahubs"."rel_metahub_packages"')) {
                    return [
                        {
                            id: '019e8afa-0000-7000-8000-000000000003',
                            metahubId: 'metahub-1',
                            packageId: '019e8afa-0000-7000-8000-000000000004',
                            packageName: editorPackageName,
                            version: '0.1.0',
                            displayName: createLocalizedContent('en', 'PlayCanvas Editor'),
                            description: null,
                            source: { kind: 'workspace', packageName: editorPackageName },
                            authoringSurface: {
                                schemaVersion: '1',
                                kind: 'playcanvasEditor',
                                packageSlug: 'playcanvas-editor',
                                supportedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately'],
                                defaultConfig: {
                                    schemaVersion: '1',
                                    kind: 'display',
                                    display: {
                                        mode: 'embeddedIframe',
                                        developmentUrl: null,
                                        showArtifactOnlyNotice: false
                                    },
                                    playcanvasProject: {
                                        defaultProjectId: null
                                    }
                                },
                                artifact: {
                                    packageName: editorPackageName,
                                    manifestFileName: 'universo-artifact-manifest.json',
                                    outputRoot: 'dist/editor',
                                    smokeMode: 'universo-full-upstream-ui'
                                }
                            },
                            config: {
                                schemaVersion: '1',
                                kind: 'display',
                                display: {
                                    mode: 'embeddedIframe',
                                    developmentUrl: null,
                                    showArtifactOnlyNotice: false
                                },
                                playcanvasProject: {
                                    defaultProjectId: projectId
                                }
                            },
                            attachedAt: new Date(),
                            isActive: true
                        }
                    ]
                }
                if (sql.includes('DELETE FROM') && sql.includes('_app_settings')) return []
                if (sql.includes('INSERT INTO') && sql.includes('_app_settings')) {
                    const key = String(params?.[1] ?? '')
                    if (replayRows.has(key)) {
                        return []
                    }
                    replayRows.set(key, { value: JSON.parse(String(params?.[2])) })
                    return [{ id: '019e8afa-0000-7000-8000-000000000006' }]
                }
                if (sql.includes('UPDATE') && sql.includes('_app_settings')) {
                    const [key, sessionId, storedRequestId, commandType, fingerprint, response] = params ?? []
                    const current = replayRows.get(String(key))?.value as
                        | {
                              sessionId?: string
                              requestId?: string
                              commandType?: string
                              fingerprint?: string
                          }
                        | undefined
                    if (
                        current?.sessionId === sessionId &&
                        current.requestId === storedRequestId &&
                        current.commandType === commandType &&
                        current.fingerprint === fingerprint
                    ) {
                        replayRows.set(String(key), {
                            value: {
                                ...current,
                                status: 'completed',
                                response: JSON.parse(String(response))
                            }
                        })
                        return [{ id: '019e8afa-0000-7000-8000-000000000006' }]
                    }
                    return []
                }
                if (sql.includes('SELECT') && sql.includes('_app_settings')) {
                    const [key, sessionId, storedRequestId, commandType, fingerprint] = params ?? []
                    const row = replayRows.get(String(key))
                    const value = row?.value as
                        | {
                              sessionId?: string
                              requestId?: string
                              commandType?: string
                              fingerprint?: string
                          }
                        | undefined
                    if (
                        value?.sessionId === sessionId &&
                        value.requestId === storedRequestId &&
                        value.commandType === commandType &&
                        value.fingerprint === fingerprint
                    ) {
                        return [row]
                    }
                    return []
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        }
        const firstCommand = {
            type: 'scene.save',
            requestId,
            sessionId: session.payload.sessionId,
            nonce: session.payload.nonce,
            projectId,
            sceneId,
            expectedCurrentChecksum: 'a'.repeat(64),
            payload: {
                schemaVersion: '1',
                metadata: {
                    alpha: 1,
                    beta: 2
                },
                entities: [
                    {
                        id: 'entity-1',
                        components: {
                            render: { enabled: true, type: 'box' },
                            script: { order: 1 }
                        }
                    }
                ]
            }
        }
        const retriedCommand = {
            type: 'scene.save',
            requestId,
            sessionId: session.payload.sessionId,
            nonce: session.payload.nonce,
            projectId,
            sceneId,
            expectedCurrentChecksum: 'a'.repeat(64),
            payload: {
                entities: [
                    {
                        components: {
                            script: { order: 1 },
                            render: { type: 'box', enabled: true }
                        },
                        id: 'entity-1'
                    }
                ],
                metadata: {
                    beta: 2,
                    alpha: 1
                },
                schemaVersion: '1'
            }
        }

        await ctrl.editorBridgeCommand({
            req: {
                body: {
                    sessionToken: session.token,
                    command: firstCommand
                }
            },
            res: firstRes,
            metahubId: 'metahub-1',
            userId: 'user-1',
            exec,
            schemaService: { ensureSchema: jest.fn(async () => TEST_SCHEMA) }
        } as never)
        await ctrl.editorBridgeCommand({
            req: {
                body: {
                    sessionToken: session.token,
                    command: retriedCommand
                }
            },
            res: retryRes,
            metahubId: 'metahub-1',
            userId: 'user-1',
            exec,
            schemaService: { ensureSchema: jest.fn(async () => TEST_SCHEMA) }
        } as never)

        expect(saveEditorScene).toHaveBeenCalledTimes(1)
        expect(firstRes.status).not.toHaveBeenCalledWith(409)
        expect(firstRes.json).toHaveBeenCalledWith({
            ok: true,
            requestId,
            data: saveResult
        })
        expect(retryRes.status).not.toHaveBeenCalledWith(409)
        expect(retryRes.json).toHaveBeenCalledWith({
            ok: true,
            requestId,
            data: saveResult
        })

        saveEditorScene.mockRestore()
    })

    it('returns a typed bridge forbidden envelope when the session user no longer has manage access', async () => {
        const projectId = '019e8afa-0000-7000-8000-000000000001'
        const sceneId = '019e8afa-0000-7000-8000-000000000002'
        const requestId = '019e8afa-0000-7000-8000-000000000005'
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const session = sessionService.create({
            metahubId: 'metahub-1',
            packageSlug: 'playcanvas-editor',
            projectId,
            defaultSceneId: sceneId,
            userId: 'user-1',
            capabilities: ['scene.save']
        })
        const saveEditorScene = jest.spyOn(PlayCanvasProjectsService.prototype, 'saveEditorScene').mockResolvedValue({} as never)
        const createHandler = jest.fn((handler: unknown) => handler)
        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const res = {
            setHeader: jest.fn(),
            status: jest.fn(),
            json: jest.fn()
        }
        res.status.mockReturnValue(res)
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT admin.is_superuser')) {
                    return [{ is_super: false }]
                }
                if (sql.includes('FROM metahubs.rel_metahub_users')) {
                    return [
                        {
                            id: '019e8afa-0000-7000-8000-000000000099',
                            metahubId: 'metahub-1',
                            userId: 'user-1',
                            activeBranchId: null,
                            role: 'member',
                            comment: null
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        }

        await ctrl.editorBridgeCommand({
            req: {
                body: {
                    sessionToken: session.token,
                    command: {
                        type: 'scene.save',
                        requestId,
                        sessionId: session.payload.sessionId,
                        nonce: session.payload.nonce,
                        projectId,
                        sceneId,
                        expectedCurrentChecksum: 'a'.repeat(64),
                        payload: {
                            schemaVersion: '1',
                            entities: []
                        }
                    }
                }
            },
            res,
            metahubId: 'metahub-1',
            userId: 'user-1',
            exec,
            schemaService: { ensureSchema: jest.fn(async () => TEST_SCHEMA) }
        } as never)

        expect(saveEditorScene).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(403)
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false, requestId, code: 'forbidden', status: 403 }))

        saveEditorScene.mockRestore()
    })

    it('fails closed without releasing a replay claim when completion storage fails after a successful bridge save', async () => {
        const projectId = '019e8afa-0000-7000-8000-000000000001'
        const sceneId = '019e8afa-0000-7000-8000-000000000002'
        const requestId = '019e8afa-0000-7000-8000-000000000005'
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const session = sessionService.create({
            metahubId: 'metahub-1',
            packageSlug: 'playcanvas-editor',
            projectId,
            defaultSceneId: sceneId,
            userId: 'user-1',
            capabilities: ['scene.save']
        })
        const saveResult = {
            checksum: 'b'.repeat(64),
            scene: {
                id: sceneId,
                checksum: 'b'.repeat(64)
            }
        }
        const saveEditorScene = jest.spyOn(PlayCanvasProjectsService.prototype, 'saveEditorScene').mockResolvedValue(saveResult as never)
        const createHandler = jest.fn((handler: unknown) => handler)
        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const res = {
            setHeader: jest.fn(),
            status: jest.fn(),
            json: jest.fn()
        }
        res.status.mockReturnValue(res)
        const exec = {
            query: jest.fn(async (sql: string) => {
                const accessRows = bridgeManagerAccessRows(sql)
                if (accessRows) return accessRows
                if (sql.includes('FROM "metahubs"."rel_metahub_packages"')) {
                    return [
                        {
                            id: '019e8afa-0000-7000-8000-000000000003',
                            metahubId: 'metahub-1',
                            packageId: '019e8afa-0000-7000-8000-000000000004',
                            packageName: editorPackageName,
                            version: '0.1.0',
                            displayName: createLocalizedContent('en', 'PlayCanvas Editor'),
                            description: null,
                            source: { kind: 'workspace', packageName: editorPackageName },
                            authoringSurface: {
                                schemaVersion: '1',
                                kind: 'playcanvasEditor',
                                packageSlug: 'playcanvas-editor',
                                supportedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately'],
                                defaultConfig: {
                                    schemaVersion: '1',
                                    kind: 'display',
                                    display: {
                                        mode: 'embeddedIframe',
                                        developmentUrl: null,
                                        showArtifactOnlyNotice: false
                                    },
                                    playcanvasProject: {
                                        defaultProjectId: null
                                    }
                                },
                                artifact: {
                                    packageName: editorPackageName,
                                    manifestFileName: 'universo-artifact-manifest.json',
                                    outputRoot: 'dist/editor',
                                    smokeMode: 'universo-full-upstream-ui'
                                }
                            },
                            config: {
                                schemaVersion: '1',
                                kind: 'display',
                                display: {
                                    mode: 'embeddedIframe',
                                    developmentUrl: null,
                                    showArtifactOnlyNotice: false
                                },
                                playcanvasProject: {
                                    defaultProjectId: projectId
                                }
                            },
                            attachedAt: new Date(),
                            isActive: true
                        }
                    ]
                }
                if (sql.includes('DELETE FROM') && sql.includes('_app_settings')) return []
                if (sql.includes('INSERT INTO') && sql.includes('_app_settings')) return [{ id: '019e8afa-0000-7000-8000-000000000006' }]
                if (sql.includes('UPDATE') && sql.includes('_app_settings')) throw new Error('replay completion failed')
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        }

        await ctrl.editorBridgeCommand({
            req: {
                body: {
                    sessionToken: session.token,
                    command: {
                        type: 'scene.save',
                        requestId,
                        sessionId: session.payload.sessionId,
                        nonce: session.payload.nonce,
                        projectId,
                        sceneId,
                        expectedCurrentChecksum: 'a'.repeat(64),
                        payload: {
                            schemaVersion: '1',
                            entities: []
                        }
                    }
                }
            },
            res,
            metahubId: 'metahub-1',
            userId: 'user-1',
            exec,
            schemaService: { ensureSchema: jest.fn(async () => TEST_SCHEMA) }
        } as never)

        expect(saveEditorScene).toHaveBeenCalledTimes(1)
        expect(res.status).toHaveBeenCalledWith(503)
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false, requestId, code: 'storageUnavailable', status: 503 }))
        expect(jest.mocked(exec.query).mock.calls.filter((call) => String(call[0]).includes('DELETE FROM'))).toHaveLength(1)

        saveEditorScene.mockRestore()
    })

    it('releases replay claims when editor scene saves are outside the session default scene', async () => {
        const projectId = '019e8afa-0000-7000-8000-000000000001'
        const sceneId = '019e8afa-0000-7000-8000-000000000002'
        const otherSceneId = '019e8afa-0000-7000-8000-000000000007'
        const requestId = '019e8afa-0000-7000-8000-000000000005'
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const session = sessionService.create({
            metahubId: 'metahub-1',
            packageSlug: 'playcanvas-editor',
            projectId,
            defaultSceneId: sceneId,
            userId: 'user-1',
            capabilities: ['scene.save']
        })
        const saveEditorScene = jest.spyOn(PlayCanvasProjectsService.prototype, 'saveEditorScene').mockResolvedValue({} as never)
        const createHandler = jest.fn((handler: unknown) => handler)
        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const res = {
            setHeader: jest.fn(),
            status: jest.fn(),
            json: jest.fn()
        }
        res.status.mockReturnValue(res)
        const exec = {
            query: jest.fn(async (sql: string) => {
                const accessRows = bridgeManagerAccessRows(sql)
                if (accessRows) return accessRows
                if (sql.includes('FROM "metahubs"."rel_metahub_packages"')) {
                    return [
                        {
                            id: '019e8afa-0000-7000-8000-000000000003',
                            metahubId: 'metahub-1',
                            packageId: '019e8afa-0000-7000-8000-000000000004',
                            packageName: editorPackageName,
                            version: '0.1.0',
                            displayName: createLocalizedContent('en', 'PlayCanvas Editor'),
                            description: null,
                            source: { kind: 'workspace', packageName: editorPackageName },
                            authoringSurface: {
                                schemaVersion: '1',
                                kind: 'playcanvasEditor',
                                packageSlug: 'playcanvas-editor',
                                supportedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately'],
                                defaultConfig: {
                                    schemaVersion: '1',
                                    kind: 'display',
                                    display: {
                                        mode: 'embeddedIframe',
                                        developmentUrl: null,
                                        showArtifactOnlyNotice: false
                                    },
                                    playcanvasProject: {
                                        defaultProjectId: null
                                    }
                                },
                                artifact: {
                                    packageName: editorPackageName,
                                    manifestFileName: 'universo-artifact-manifest.json',
                                    outputRoot: 'dist/editor',
                                    smokeMode: 'universo-full-upstream-ui'
                                }
                            },
                            config: {
                                schemaVersion: '1',
                                kind: 'display',
                                display: {
                                    mode: 'embeddedIframe',
                                    developmentUrl: null,
                                    showArtifactOnlyNotice: false
                                },
                                playcanvasProject: {
                                    defaultProjectId: projectId
                                }
                            },
                            attachedAt: new Date(),
                            isActive: true
                        }
                    ]
                }
                if (sql.includes('DELETE FROM') && sql.includes('_app_settings')) return []
                if (sql.includes('INSERT INTO') && sql.includes('_app_settings')) return [{ id: '019e8afa-0000-7000-8000-000000000006' }]
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        }

        const invalidSaveRequest = {
            req: {
                body: {
                    sessionToken: session.token,
                    command: {
                        type: 'scene.save',
                        requestId,
                        sessionId: session.payload.sessionId,
                        nonce: session.payload.nonce,
                        projectId,
                        sceneId: otherSceneId,
                        expectedCurrentChecksum: null,
                        payload: {
                            schemaVersion: '1',
                            entities: []
                        }
                    }
                }
            },
            res,
            metahubId: 'metahub-1',
            userId: 'user-1',
            exec,
            schemaService: { ensureSchema: jest.fn(async () => TEST_SCHEMA) }
        } as never

        await ctrl.editorBridgeCommand(invalidSaveRequest)
        await ctrl.editorBridgeCommand(invalidSaveRequest)

        expect(saveEditorScene).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledTimes(2)
        expect(res.status).toHaveBeenNthCalledWith(1, 403)
        expect(res.status).toHaveBeenNthCalledWith(2, 403)
        expect(res.status).not.toHaveBeenCalledWith(409)
        expect(res.json).toHaveBeenCalledTimes(2)
        expect(res.json).toHaveBeenNthCalledWith(1, expect.objectContaining({ ok: false, code: 'unsupportedCapability', requestId }))
        expect(res.json).toHaveBeenNthCalledWith(2, expect.objectContaining({ ok: false, code: 'unsupportedCapability', requestId }))
        expect(
            jest
                .mocked(exec.query)
                .mock.calls.filter((call) => String(call[0]).includes('DELETE FROM') && String(call[0]).includes('_app_settings'))
        ).toHaveLength(4)

        saveEditorScene.mockRestore()
    })

    it('maps editor scene save checksum mismatches to bridge save conflicts', async () => {
        const projectId = '019e8afa-0000-7000-8000-000000000001'
        const sceneId = '019e8afa-0000-7000-8000-000000000002'
        const requestId = '019e8afa-0000-7000-8000-000000000005'
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const session = sessionService.create({
            metahubId: 'metahub-1',
            packageSlug: 'playcanvas-editor',
            projectId,
            defaultSceneId: sceneId,
            userId: 'user-1',
            capabilities: ['scene.save']
        })
        const saveEditorScene = jest.spyOn(PlayCanvasProjectsService.prototype, 'saveEditorScene').mockRejectedValue(
            new MetahubValidationError('Current file checksum does not match', {
                messageCode: 'playcanvas.files.path.currentChecksumMismatch'
            })
        )
        const createHandler = jest.fn((handler: unknown) => handler)
        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const res = {
            setHeader: jest.fn(),
            status: jest.fn(),
            json: jest.fn()
        }
        res.status.mockReturnValue(res)
        const exec = {
            query: jest.fn(async (sql: string) => {
                const accessRows = bridgeManagerAccessRows(sql)
                if (accessRows) return accessRows
                if (sql.includes('FROM "metahubs"."rel_metahub_packages"')) {
                    return [
                        {
                            id: '019e8afa-0000-7000-8000-000000000003',
                            metahubId: 'metahub-1',
                            packageId: '019e8afa-0000-7000-8000-000000000004',
                            packageName: editorPackageName,
                            version: '0.1.0',
                            displayName: createLocalizedContent('en', 'PlayCanvas Editor'),
                            description: null,
                            source: { kind: 'workspace', packageName: editorPackageName },
                            authoringSurface: {
                                schemaVersion: '1',
                                kind: 'playcanvasEditor',
                                packageSlug: 'playcanvas-editor',
                                supportedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately'],
                                defaultConfig: {
                                    schemaVersion: '1',
                                    kind: 'display',
                                    display: {
                                        mode: 'embeddedIframe',
                                        developmentUrl: null,
                                        showArtifactOnlyNotice: false
                                    },
                                    playcanvasProject: {
                                        defaultProjectId: null
                                    }
                                },
                                artifact: {
                                    packageName: editorPackageName,
                                    manifestFileName: 'universo-artifact-manifest.json',
                                    outputRoot: 'dist/editor',
                                    smokeMode: 'universo-full-upstream-ui'
                                }
                            },
                            config: {
                                schemaVersion: '1',
                                kind: 'display',
                                display: {
                                    mode: 'embeddedIframe',
                                    developmentUrl: null,
                                    showArtifactOnlyNotice: false
                                },
                                playcanvasProject: {
                                    defaultProjectId: projectId
                                }
                            },
                            attachedAt: new Date(),
                            isActive: true
                        }
                    ]
                }
                if (sql.includes('DELETE FROM') && sql.includes('_app_settings')) return []
                if (sql.includes('INSERT INTO') && sql.includes('_app_settings')) {
                    return [{ id: '019e8afa-0000-7000-8000-000000000006' }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        }

        await ctrl.editorBridgeCommand({
            req: {
                body: {
                    sessionToken: session.token,
                    command: {
                        type: 'scene.save',
                        requestId,
                        sessionId: session.payload.sessionId,
                        nonce: session.payload.nonce,
                        projectId,
                        sceneId,
                        expectedCurrentChecksum: 'a'.repeat(64),
                        payload: {
                            schemaVersion: '1',
                            entities: []
                        }
                    }
                }
            },
            res,
            metahubId: 'metahub-1',
            userId: 'user-1',
            exec,
            schemaService: { ensureSchema: jest.fn(async () => TEST_SCHEMA) }
        } as never)

        expect(saveEditorScene).toHaveBeenCalled()
        expect(
            jest
                .mocked(exec.query)
                .mock.calls.filter((call) => String(call[0]).includes('DELETE FROM') && String(call[0]).includes('_app_settings'))
        ).toHaveLength(2)
        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                ok: false,
                code: 'saveConflict',
                requestId
            })
        )

        saveEditorScene.mockRestore()
    })

    it('accepts first-time PlayCanvas metadata upserts without expectedVersion', async () => {
        const projectId = '018f8a78-7b8f-7c1d-a111-222233334444'
        const sceneId = '018f8a78-7b8f-7c1d-a111-222233334445'
        const assetId = '018f8a78-7b8f-7c1d-a111-222233334446'
        const scriptAssetId = '018f8a78-7b8f-7c1d-a111-222233334447'
        const bindingId = '018f8a78-7b8f-7c1d-a111-222233334448'
        const artifactId = '018f8a78-7b8f-7c1d-a111-222233334449'
        const sceneBody = {
            codename: createLocalizedContent('en', 'main_scene'),
            displayName: createLocalizedContent('en', 'Main Scene'),
            payloadSchemaVersion: '1',
            payload: null,
            payloadFile: {
                provider: 'local',
                root: 'playcanvas-projects',
                path: `playcanvas-projects/${projectId}/scenes/main.json`,
                hash: null,
                mime: 'application/json',
                status: 'missing'
            },
            checksum: null,
            sortOrder: 0,
            publish: true
        }
        const assetBody = {
            stableAssetId: 'texture-1',
            type: 'texture',
            name: 'Texture',
            virtualPath: ['assets', 'texture.json'],
            file: {
                provider: 'local',
                root: 'playcanvas-projects',
                path: `playcanvas-projects/${projectId}/assets/texture.json`,
                hash: null,
                mime: 'application/json',
                status: 'missing'
            },
            metadata: {},
            publish: true
        }
        const scriptBody = {
            assetId,
            moduleId: null,
            moduleCodename: null,
            moduleSourcePath: null,
            scriptName: 'ShipController',
            scriptKind: 'esm',
            parsedAttributes: {},
            parseStatus: 'missing',
            parseDiagnostics: null
        }
        const bindingBody = {
            sceneId,
            sceneEntityStableId: 'ship-1',
            scriptAssetId,
            scriptName: 'ShipController',
            attributeValues: {},
            bindingSchemaVersion: '1',
            platformoEntityId: null,
            sortOrder: 0,
            enabled: true
        }
        const artifactBody = {
            scriptAssetId,
            sourceModuleId: null,
            sourceModuleCodename: null,
            sourceModulePath: null,
            sourceChecksum: null,
            outputFile: {
                provider: 'local',
                root: 'playcanvas-projects',
                path: `playcanvas-projects/${projectId}/generated/ship.mjs`,
                hash: null,
                mime: 'text/javascript',
                status: 'missing'
            },
            scriptName: 'ShipController',
            moduleExportName: null,
            scriptKind: 'esm',
            parseStatus: 'missing',
            generatedAt: null,
            parsedAt: null
        }
        const writeScene = jest.spyOn(PlayCanvasProjectsService.prototype, 'writeScene').mockResolvedValue({
            ...sceneBody,
            id: sceneId,
            projectId,
            version: 1
        } as never)
        const writeAssetMetadata = jest.spyOn(PlayCanvasProjectsService.prototype, 'writeAssetMetadata').mockResolvedValue({
            ...assetBody,
            id: assetId,
            projectId,
            version: 1
        } as never)
        const resolveScriptAsset = jest.spyOn(PlayCanvasProjectsService.prototype, 'resolveScriptAsset').mockResolvedValue({
            ...scriptBody,
            id: scriptAssetId,
            version: 1
        } as never)
        const writeSceneScriptBinding = jest.spyOn(PlayCanvasProjectsService.prototype, 'writeSceneScriptBinding').mockResolvedValue({
            ...bindingBody,
            id: bindingId,
            version: 1
        } as never)
        const upsertGeneratedArtifact = jest.spyOn(PlayCanvasProjectsService.prototype, 'upsertGeneratedArtifact').mockResolvedValue({
            ...artifactBody,
            id: artifactId,
            version: 1
        } as never)
        const createHandler = jest.fn((handler: unknown) => handler)
        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const makeRes = () => {
            const res = {
                setHeader: jest.fn(),
                status: jest.fn(),
                json: jest.fn()
            }
            res.status.mockReturnValue(res)
            return res
        }
        const baseContext = {
            metahubId: 'metahub-1',
            userId: 'user-1',
            exec: {},
            schemaService: {}
        }

        const calls = [
            {
                handler: ctrl.writeScene,
                params: { projectId, sceneId },
                body: sceneBody,
                spy: writeScene
            },
            {
                handler: ctrl.writeAsset,
                params: { projectId, assetId },
                body: assetBody,
                spy: writeAssetMetadata
            },
            {
                handler: ctrl.writeScriptAsset,
                params: { projectId, scriptAssetId },
                body: scriptBody,
                spy: resolveScriptAsset
            },
            {
                handler: ctrl.writeBinding,
                params: { projectId, bindingId },
                body: bindingBody,
                spy: writeSceneScriptBinding
            },
            {
                handler: ctrl.writeGeneratedArtifact,
                params: { projectId, artifactId },
                body: artifactBody,
                spy: upsertGeneratedArtifact
            }
        ]

        for (const call of calls) {
            const res = makeRes()
            await call.handler({
                ...baseContext,
                req: { params: call.params, body: call.body },
                res
            } as never)
            expect(res.status).not.toHaveBeenCalledWith(400)
            expect(call.spy).toHaveBeenCalledWith('metahub-1', projectId, expect.any(Object), 'user-1')
            expect(call.spy.mock.calls.at(-1)?.[2]).not.toHaveProperty('expectedVersion')
        }

        writeScene.mockRestore()
        writeAssetMetadata.mockRestore()
        resolveScriptAsset.mockRestore()
        writeSceneScriptBinding.mockRestore()
        upsertGeneratedArtifact.mockRestore()
    })
})
