import type { DbExecutor } from '@universo-react/utils'
import { createLocalizedContent } from '@universo-react/utils'
import { createPlayCanvasEditorNumericAssetId, createPlayCanvasEditorNumericIds } from '@universo-react/playcanvas-editor-backend'
import { MetahubValidationError } from '../../domains/shared/domainErrors'
import { PlayCanvasEditorBridgeSessionService } from '../../domains/playcanvas-projects/services/PlayCanvasEditorBridgeSessionService'
import { PlayCanvasProjectSnapshotService } from '../../domains/playcanvas-projects/services/PlayCanvasProjectSnapshotService'
import { PlayCanvasProjectsService } from '../../domains/playcanvas-projects/services/PlayCanvasProjectsService'

const TEST_SCHEMA = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
const PROJECT_ID = '019e8afa-0000-7000-8000-000000000001'
const SCENE_ID = '019e8afa-0000-7000-8000-000000000002'
const SECOND_SCENE_ID = '019e8afa-0000-7000-8000-000000000004'
const ASSET_ID = '019e8afa-0000-7000-8000-000000000003'

const makeSchemaService = () => ({
    ensureSchema: jest.fn(async () => TEST_SCHEMA)
})

const createProjectLookupExecutor = () =>
    ({
        query: jest.fn(async (sql: string) => {
            if (sql.includes('AS "sceneCount"') && sql.includes('_mhb_playcanvas_scenes')) {
                return [
                    {
                        sceneCount: '1',
                        assetCount: '0',
                        scriptCount: '0',
                        generatedArtifactCount: '0',
                        blockingCount: '0',
                        publishableSceneCount: '1'
                    }
                ]
            }
            if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                return [
                    {
                        id: PROJECT_ID,
                        codename: createLocalizedContent('en', 'playcanvas_project'),
                        displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                        description: null,
                        packageName: '@universo-react/playcanvas-editor-frontend',
                        packageVersion: '0.1.0',
                        compatibilityStatus: 'compatible',
                        compatibilityNotes: {},
                        schemaVersion: '1',
                        settings: {},
                        defaultSceneId: null,
                        publicationConfig: {},
                        version: 1
                    }
                ]
            }
            throw new Error(`Unexpected SQL: ${sql}`)
        })
    } as unknown as DbExecutor)

const createPublishExecutor = (options: { activeReplayClaims?: boolean | { metahubId: string; projectId: string } } = {}) =>
    ({
        query: jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                return [
                    {
                        id: PROJECT_ID,
                        codename: createLocalizedContent('en', 'playcanvas_project'),
                        displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                        description: null,
                        packageName: '@universo-react/playcanvas-editor-frontend',
                        packageVersion: '0.1.0',
                        compatibilityStatus: 'compatible',
                        compatibilityNotes: {},
                        schemaVersion: '1',
                        settings: {},
                        defaultSceneId: SCENE_ID,
                        publicationConfig: {},
                        version: 1
                    }
                ]
            }
            if (sql.includes("key LIKE 'pc.eb.replay.%'") && sql.includes('DELETE')) {
                return []
            }
            if (sql.includes("key LIKE 'pc.eb.replay.%'") && sql.includes('SELECT EXISTS')) {
                if (typeof options.activeReplayClaims === 'object') {
                    return [
                        {
                            exists:
                                params?.[1] === options.activeReplayClaims.metahubId && params?.[2] === options.activeReplayClaims.projectId
                        }
                    ]
                }
                return [{ exists: options.activeReplayClaims === true }]
            }
            throw new Error(`Unexpected SQL: ${sql}`)
        })
    } as unknown as DbExecutor)

describe('PlayCanvasProjectsService', () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('describes PlayCanvas Editor authoring as the explicit full upstream UI contract', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(service.describeEditorCompatibilityProtocol('metahub-1', PROJECT_ID, 'user-1')).resolves.toMatchObject({
            mode: 'universo-full-upstream-ui',
            endpoints: {
                rest: { status: 'enabled' },
                realtime: { status: 'enabled' },
                messenger: { status: 'enabled' },
                relay: { status: 'enabled' }
            },
            shareDb: {
                requiredCollections: ['scenes', 'assets', 'settings', 'user_data'],
                persisted: true,
                persistence: 'snapshot-port'
            },
            cloudOnly: {
                sourcefiles: { status: 'enabled', reason: 'universoDurableJavaScriptSourcefilesEnabled' },
                assetPipeline: { status: 'stubbed', reason: 'playcanvasCloudOnlySurfaceOutsideUniversoScope' },
                branchesCheckpoints: { status: 'stubbed', reason: 'playcanvasCloudOnlySurfaceOutsideUniversoScope' },
                usersCollaboration: { status: 'stubbed', reason: 'playcanvasCloudOnlySurfaceOutsideUniversoScope' }
            },
            documents: {
                codeEditorSourcefiles: { status: 'enabled', reason: 'universoDurableJavaScriptSourcefilesEnabled' }
            },
            numericIds: {
                projectId: expect.any(Number),
                sceneId: expect.any(Number),
                selfId: expect.any(Number)
            }
        })
    })

    it('blocks publishing while PlayCanvas Editor compatibility writes are still claimed', async () => {
        const exec = createPublishExecutor({ activeReplayClaims: true })
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const exportProjectSnapshot = jest.spyOn(PlayCanvasProjectSnapshotService.prototype, 'exportProjectSnapshot')

        await expect(service.publishProjectState('metahub-1', PROJECT_ID, 'user-1')).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.publish.pendingEditorWrites', projectId: PROJECT_ID })
        })
        expect(exportProjectSnapshot).not.toHaveBeenCalled()
    })

    it('does not block publishing for active PlayCanvas Editor writes from another project', async () => {
        const exec = createPublishExecutor({
            activeReplayClaims: { metahubId: 'metahub-1', projectId: '019e8afa-0000-7000-8000-000000000099' }
        })
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const exportProjectSnapshot = jest.spyOn(PlayCanvasProjectSnapshotService.prototype, 'exportProjectSnapshot').mockResolvedValue({
            runtimeManifests: []
        } as never)

        await expect(service.publishProjectState('metahub-1', PROJECT_ID, 'user-1')).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.publish.noRuntimeManifests', projectId: PROJECT_ID })
        })
        expect(exportProjectSnapshot).toHaveBeenCalledTimes(1)
        expect(exec.query).toHaveBeenCalledWith(
            expect.stringContaining("value->>'metahubId' = $2"),
            expect.arrayContaining([expect.any(Number), 'metahub-1', PROJECT_ID])
        )
    })

    it('blocks publishing when the snapshot has no runtime manifests', async () => {
        const exec = createPublishExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        jest.spyOn(PlayCanvasProjectSnapshotService.prototype, 'exportProjectSnapshot').mockResolvedValue({
            runtimeManifests: []
        } as never)

        await expect(service.publishProjectState('metahub-1', PROJECT_ID, 'user-1')).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.publish.noRuntimeManifests', projectId: PROJECT_ID })
        })
    })

    it('uses the metahub default branch schema for project CRUD so package default pointers resolve consistently', async () => {
        const schemaService = {
            ensureSchema: jest.fn(async (_metahubId: string, userId?: string) => (userId ? 'active_branch_schema' : TEST_SCHEMA))
        }
        const exec = {
            query: jest.fn(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('AS codename') && sql.includes('_mhb_playcanvas_projects')) {
                    expect(sql).toContain(`"${TEST_SCHEMA}"`)
                    expect(sql).not.toContain('active_branch_schema')
                    return []
                }
                if (sql.includes('SELECT EXISTS') && sql.includes('_mhb_playcanvas_projects')) {
                    expect(sql).toContain(`"${TEST_SCHEMA}"`)
                    expect(sql).not.toContain('active_branch_schema')
                    return [{ exists: false }]
                }
                if (sql.includes('INSERT INTO') && sql.includes('_mhb_playcanvas_projects')) {
                    expect(sql).toContain(`"${TEST_SCHEMA}"`)
                    expect(sql).not.toContain('active_branch_schema')
                    return [
                        {
                            id: PROJECT_ID,
                            codename: _params?.[0],
                            displayName: _params?.[1],
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('INSERT INTO') && sql.includes('_mhb_playcanvas_scenes')) {
                    expect(sql).toContain(`"${TEST_SCHEMA}"`)
                    expect(sql).not.toContain('active_branch_schema')
                    return [
                        {
                            id: _params?.[0],
                            projectId: PROJECT_ID,
                            codename: _params?.[2],
                            displayName: _params?.[3],
                            payloadSchemaVersion: _params?.[4],
                            payload: JSON.parse(String(_params?.[5])),
                            payloadFile: null,
                            checksum: null,
                            sortOrder: 0,
                            publish: true,
                            version: 1
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects')) {
                    expect(sql).toContain(`"${TEST_SCHEMA}"`)
                    expect(sql).not.toContain('active_branch_schema')
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'default_branch_project'),
                            displayName: createLocalizedContent('en', 'Default Branch Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: _params?.[2],
                            publicationConfig: {},
                            version: 2
                        }
                    ]
                }
                if (sql.includes('COUNT(*)::text')) {
                    expect(sql).toContain(`"${TEST_SCHEMA}"`)
                    expect(sql).not.toContain('active_branch_schema')
                    return [{ sceneCount: '1', assetCount: '0', scriptCount: '0', generatedArtifactCount: '0', blockingCount: '0' }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            }),
            transaction: jest.fn(async function (this: DbExecutor, callback: (executor: DbExecutor) => Promise<unknown>) {
                return callback(this)
            }),
            isReleased: jest.fn(() => false)
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, schemaService as never)

        await expect(
            service.createProject(
                'metahub-1',
                {
                    displayName: createLocalizedContent('en', 'Default Branch Project'),
                    description: null,
                    packageVersion: '0.1.0'
                },
                'user-1'
            )
        ).resolves.toMatchObject({ id: PROJECT_ID })

        expect(schemaService.ensureSchema).toHaveBeenCalledWith('metahub-1')
        expect(schemaService.ensureSchema).not.toHaveBeenCalledWith('metahub-1', 'user-1')
        expect(exec.transaction).toHaveBeenCalledTimes(1)
    })

    it('fails closed when an inline editor scene payload is not bridge-compatible', async () => {
        const exec = {
            query: jest.fn(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_scenes')) {
                    return [
                        {
                            id: SCENE_ID,
                            projectId: PROJECT_ID,
                            codename: createLocalizedContent('en', 'main_scene'),
                            displayName: createLocalizedContent('en', 'Main Scene'),
                            payloadSchemaVersion: 'legacy',
                            payload: { legacyScene: true },
                            payloadFile: null,
                            checksum: null,
                            sortOrder: 0,
                            publish: true,
                            version: 1
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(service.readEditorScene('metahub-1', PROJECT_ID, SCENE_ID, 'user-1')).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.editor.scenePayloadUnsupported' })
        })
    })

    it('fails closed when a file-backed editor scene payload contains malformed JSON', async () => {
        const exec = {
            query: jest.fn(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_scenes')) {
                    return [
                        {
                            id: SCENE_ID,
                            projectId: PROJECT_ID,
                            codename: createLocalizedContent('en', 'main_scene'),
                            displayName: createLocalizedContent('en', 'Main Scene'),
                            payloadSchemaVersion: '1',
                            payload: null,
                            payloadFile: {
                                provider: 'local',
                                root: 'playcanvas-projects',
                                path: `playcanvas-projects/${PROJECT_ID}/scenes/${SCENE_ID}.json`,
                                hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                                mime: 'application/json',
                                status: 'ready'
                            },
                            checksum: null,
                            sortOrder: 0,
                            publish: true,
                            version: 1
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const readProjectFile = jest.spyOn(service, 'readProjectFile').mockResolvedValue({
            sourcePath: `playcanvas-projects/${PROJECT_ID}/scenes/${SCENE_ID}.json`,
            checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            size: 12,
            contentBase64: Buffer.from('{"broken":').toString('base64')
        })

        await expect(service.readEditorScene('metahub-1', PROJECT_ID, SCENE_ID, 'user-1')).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.editor.scenePayloadUnsupported' })
        })

        readProjectFile.mockRestore()
    })

    it('stores user-scoped PlayCanvas Editor compatibility settings by document id', async () => {
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 7
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: params?.[2],
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 8
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const claimReplay = jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay').mockResolvedValue(true)
        const completeReplay = jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'completeReplay').mockResolvedValue(true)

        await expect(
            service.writeEditorCompatibilitySettings(
                'metahub-1',
                PROJECT_ID,
                'projectUser',
                {
                    requestId: '019e9147-27e7-7ad4-b4e4-02174d3bcfad',
                    data: { grid: { snap: true } }
                },
                'user-2'
            )
        ).resolves.toMatchObject({
            kind: 'projectUser',
            documentId: `project_${PROJECT_ID}_user-2`,
            revision: 'project-8'
        })

        const updateCall = jest.mocked(exec.query).mock.calls.find((call) => String(call[0]).includes('UPDATE'))
        const nextSettings = updateCall?.[1]?.[2] as {
            playCanvasEditorCompatibility?: {
                settingsDocuments?: Record<string, unknown>
            }
        }
        expect(nextSettings.playCanvasEditorCompatibility?.settingsDocuments).toHaveProperty(`project_${PROJECT_ID}_user-2`)
        expect(nextSettings.playCanvasEditorCompatibility?.settingsDocuments).not.toHaveProperty('projectUser')
        claimReplay.mockRestore()
        completeReplay.mockRestore()
    })

    it('loads new realtime settings documents with document-level revision zero', async () => {
        const exec = {
            query: jest.fn(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 7
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.loadEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'settings',
                documentId: 'project_123_456',
                numericProjectId: 123,
                numericSceneId: 456,
                numericUserId: 789
            })
        ).resolves.toMatchObject({
            collection: 'settings',
            id: 'project_123_456',
            data: {},
            version: 0,
            revision: '0'
        })

        await expect(
            service.loadEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'settings',
                documentId: 'project_123',
                numericProjectId: 123,
                numericSceneId: 456,
                numericUserId: 789
            })
        ).resolves.toMatchObject({
            collection: 'settings',
            id: 'project_123',
            data: {
                id: 'project_123',
                project: 123,
                scripts: [],
                useLegacyScripts: false,
                engineV2: true,
                width: 1280,
                height: 720
            },
            version: 0,
            revision: '0'
        })
    })

    it('frames renderable scene entities in a new realtime user data camera document', async () => {
        const numericIds = createPlayCanvasEditorNumericIds({
            metahubId: 'metahub-1',
            projectId: PROJECT_ID,
            sceneId: SCENE_ID,
            userId: 'user-2'
        })
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 7
                        }
                    ]
                }
                if (sql.includes('_mhb_playcanvas_scenes')) {
                    return [
                        {
                            id: SCENE_ID,
                            projectId: PROJECT_ID,
                            codename: createLocalizedContent('en', 'main_scene'),
                            displayName: createLocalizedContent('en', 'Main Scene'),
                            payloadSchemaVersion: '1',
                            payload: {
                                schemaVersion: '1',
                                settings: {},
                                entities: [
                                    {
                                        id: 'ship',
                                        name: 'MMOOMM Ship',
                                        parentId: null,
                                        enabled: true,
                                        position: [18, 3, -9],
                                        scale: [12, 4, 4],
                                        components: { render: { type: 'box' } },
                                        children: []
                                    },
                                    {
                                        id: 'station',
                                        name: 'MMOOMM Station',
                                        parentId: null,
                                        enabled: true,
                                        position: [72, 0, -48],
                                        scale: [48, 16, 16],
                                        components: { render: { type: 'box' } },
                                        children: []
                                    }
                                ]
                            },
                            payloadFile: null,
                            checksum: null,
                            sortOrder: 0,
                            publish: true,
                            version: 1
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.loadEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'user_data',
                documentId: `${numericIds.sceneId}_${numericIds.selfId}`,
                numericProjectId: numericIds.projectId,
                numericSceneId: numericIds.sceneId,
                numericUserId: numericIds.selfId
            })
        ).resolves.toMatchObject({
            collection: 'user_data',
            id: `${numericIds.sceneId}_${numericIds.selfId}`,
            data: {
                cameras: {
                    perspective: {
                        focus: [54, 0, -31.5],
                        rotation: [-25, 45, 0],
                        position: expect.not.arrayContaining([9.2, 6, 9])
                    }
                }
            },
            version: 0,
            revision: '0'
        })
    })

    it('rejects realtime user data documents for another scene or user', async () => {
        const service = new PlayCanvasProjectsService(createProjectLookupExecutor(), makeSchemaService() as never)

        await expect(
            service.loadEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'user_data',
                documentId: '456_790',
                numericProjectId: 123,
                numericSceneId: 456,
                numericUserId: 789
            })
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.editorRealtime.unsupportedUserDataDocument' })
        })
    })

    it('persists realtime user data separately from settings documents', async () => {
        const numericIds = createPlayCanvasEditorNumericIds({
            metahubId: 'metahub-1',
            projectId: PROJECT_ID,
            sceneId: SCENE_ID,
            userId: 'user-2'
        })
        const documentId = `${numericIds.sceneId}_${numericIds.selfId}`
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: { playCanvasEditorRealtime: { documents: { project_123: { data: {}, version: 1 } } } },
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 7
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects')) {
                    return [{ id: PROJECT_ID, settings: params?.[2], version: 8 }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const cameraData = {
            cameras: {
                perspective: {
                    position: [120, 80, 120],
                    rotation: [-25, 45, 0],
                    focus: [54, 0, -31.5]
                }
            }
        }

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'user_data',
                documentId,
                data: cameraData,
                version: 2,
                revision: '0'
            })
        ).resolves.toEqual({ revision: '2' })

        const updateCall = jest.mocked(exec.query).mock.calls.find((call) => String(call[0]).includes('UPDATE'))
        const nextSettings = updateCall?.[1]?.[2] as {
            playCanvasEditorRealtime?: {
                documents?: Record<string, unknown>
                userDataDocumentsByScene?: Record<string, Record<string, { data?: unknown; version?: number }>>
            }
        }
        expect(nextSettings.playCanvasEditorRealtime?.documents).toHaveProperty('project_123')
        expect(nextSettings.playCanvasEditorRealtime?.userDataDocumentsByScene?.[SCENE_ID]?.['user-2']).toEqual(
            expect.objectContaining({ data: cameraData, version: 2 })
        )
    })

    it('rejects malformed or oversized realtime user data camera payloads', async () => {
        const numericIds = createPlayCanvasEditorNumericIds({
            metahubId: 'metahub-1',
            projectId: PROJECT_ID,
            sceneId: SCENE_ID,
            userId: 'user-2'
        })
        const service = new PlayCanvasProjectsService(createProjectLookupExecutor(), makeSchemaService() as never)

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'user_data',
                documentId: `${numericIds.sceneId}_${numericIds.selfId}`,
                data: {
                    cameras: {
                        perspective: {
                            position: [Number.MAX_VALUE, 0, 0],
                            rotation: [-25, 45, 0],
                            focus: [0, 0, 0]
                        }
                    },
                    credentials: 'must-not-persist'
                },
                version: 1,
                revision: '0'
            })
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.editorRealtime.invalidUserDataDocument' })
        })
    })

    it('normalizes realtime scene documents with a root entity that can accept children operations', async () => {
        const exec = {
            query: jest.fn(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_scenes')) {
                    return [
                        {
                            id: SCENE_ID,
                            projectId: PROJECT_ID,
                            codename: createLocalizedContent('en', 'main_scene'),
                            displayName: createLocalizedContent('en', 'Main Scene'),
                            payloadSchemaVersion: '1',
                            payload: {
                                schemaVersion: '1',
                                entities: [
                                    {
                                        id: 'entity-1',
                                        name: 'Camera',
                                        parentId: null,
                                        enabled: true,
                                        components: {}
                                    }
                                ]
                            },
                            payloadFile: null,
                            checksum: null,
                            sortOrder: 0,
                            publish: true,
                            version: 1
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.loadEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'scenes',
                documentId: '456',
                numericProjectId: 123,
                numericSceneId: 456,
                numericUserId: 789
            })
        ).resolves.toMatchObject({
            collection: 'scenes',
            data: {
                settings: {
                    physics: {
                        gravity: [0, -9.81, 0]
                    },
                    render: expect.objectContaining({
                        global_ambient: [0.2, 0.2, 0.2]
                    })
                },
                entities: {
                    root: {
                        parent: null,
                        children: ['entity-1']
                    },
                    'entity-1': {
                        parent: 'root',
                        children: []
                    }
                }
            }
        })
    })

    it('loads realtime scene documents with persisted entity transforms for editor reload hydration', async () => {
        const exec = {
            query: jest.fn(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_scenes')) {
                    return [
                        {
                            id: SCENE_ID,
                            projectId: PROJECT_ID,
                            codename: createLocalizedContent('en', 'main_scene'),
                            displayName: createLocalizedContent('en', 'Main Scene'),
                            payloadSchemaVersion: '1',
                            payload: {
                                schemaVersion: '1',
                                entities: [
                                    {
                                        id: 'stable-ship',
                                        name: 'MMOOMM Ship',
                                        parentId: null,
                                        enabled: true,
                                        position: [18, 3, -9],
                                        rotation: [0, 45, 0],
                                        scale: [12, 4, 4],
                                        components: { render: { type: 'box' } },
                                        children: []
                                    }
                                ]
                            },
                            payloadFile: null,
                            checksum: null,
                            sortOrder: 0,
                            publish: true,
                            version: 1
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.loadEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'scenes',
                documentId: '456',
                numericProjectId: 123,
                numericSceneId: 456,
                numericUserId: 789
            })
        ).resolves.toMatchObject({
            collection: 'scenes',
            data: {
                entities: {
                    'stable-ship': {
                        name: 'MMOOMM Ship',
                        parent: 'root',
                        position: [18, 3, -9],
                        rotation: [0, 45, 0],
                        scale: [12, 4, 4],
                        components: { render: { type: 'box' } }
                    }
                }
            }
        })
    })

    it('loads realtime scene documents with scene metadata for full-boot editor serialization', async () => {
        const exec = {
            query: jest.fn(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_scenes')) {
                    return [
                        {
                            id: SCENE_ID,
                            projectId: PROJECT_ID,
                            codename: createLocalizedContent('en', 'visual_lab_scene'),
                            displayName: createLocalizedContent('en', 'Visual Lab Scene'),
                            payloadSchemaVersion: '1',
                            payload: {
                                schemaVersion: '1',
                                entities: [
                                    {
                                        id: 'lab-camera',
                                        name: 'MMOOMM Linkup Lab Camera',
                                        parentId: null,
                                        enabled: true,
                                        components: { camera: { clearColor: [0.03, 0.04, 0.07, 1] } },
                                        children: []
                                    }
                                ],
                                metadata: {
                                    savedBy: 'universo-playcanvas-editor-bridge',
                                    mmoomm: {
                                        visualLab: {
                                            version: 1,
                                            projectRole: 'visual-linkup-lab',
                                            variantCount: 16,
                                            objectTypes: ['ship', 'station', 'rockAsteroid', 'iceAsteroid']
                                        }
                                    }
                                }
                            },
                            payloadFile: null,
                            checksum: null,
                            sortOrder: 0,
                            publish: true,
                            version: 1
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.loadEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'scenes',
                documentId: '456',
                numericProjectId: 123,
                numericSceneId: 456,
                numericUserId: 789
            })
        ).resolves.toMatchObject({
            collection: 'scenes',
            data: {
                metadata: {
                    savedBy: 'universo-playcanvas-editor-bridge',
                    mmoomm: {
                        visualLab: {
                            projectRole: 'visual-linkup-lab',
                            variantCount: 16,
                            objectTypes: ['ship', 'station', 'rockAsteroid', 'iceAsteroid']
                        }
                    }
                }
            }
        })
    })

    it('rebuilds realtime scene children from parent references so upstream viewport renders root boxes', async () => {
        const exec = {
            query: jest.fn(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_scenes')) {
                    return [
                        {
                            id: SCENE_ID,
                            projectId: PROJECT_ID,
                            codename: createLocalizedContent('en', 'main_scene'),
                            displayName: createLocalizedContent('en', 'Main Scene'),
                            payloadSchemaVersion: '1',
                            payload: {
                                schemaVersion: '1',
                                entities: [
                                    {
                                        id: 'root',
                                        name: 'Root',
                                        parentId: null,
                                        enabled: true,
                                        components: {},
                                        children: []
                                    },
                                    {
                                        id: 'stable-ship',
                                        name: 'MMOOMM Ship',
                                        parentId: 'root',
                                        enabled: true,
                                        position: [18, 3, -9],
                                        rotation: [0, 45, 0],
                                        scale: [12, 4, 4],
                                        components: { render: { enabled: true, type: 'box' } },
                                        children: []
                                    },
                                    {
                                        id: 'stable-station',
                                        name: 'MMOOMM Station',
                                        parentId: 'root',
                                        enabled: true,
                                        position: [72, 0, -48],
                                        rotation: [0, 0, 0],
                                        scale: [48, 16, 16],
                                        components: { render: { enabled: true, type: 'box' } },
                                        children: []
                                    }
                                ]
                            },
                            payloadFile: null,
                            checksum: null,
                            sortOrder: 0,
                            publish: true,
                            version: 1
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.loadEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'scenes',
                documentId: '456',
                numericProjectId: 123,
                numericSceneId: 456,
                numericUserId: 789
            })
        ).resolves.toMatchObject({
            collection: 'scenes',
            data: {
                entities: {
                    root: {
                        parent: null,
                        children: ['stable-ship', 'stable-station']
                    },
                    'stable-ship': {
                        parent: 'root',
                        children: [],
                        components: { render: { enabled: true, type: 'box' } }
                    },
                    'stable-station': {
                        parent: 'root',
                        children: [],
                        components: { render: { enabled: true, type: 'box' } }
                    }
                }
            }
        })
    })

    it('removes stale root child references when a realtime entity belongs to another parent', async () => {
        const exec = {
            query: jest.fn(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_scenes')) {
                    return [
                        {
                            id: SCENE_ID,
                            projectId: PROJECT_ID,
                            codename: createLocalizedContent('en', 'main_scene'),
                            displayName: createLocalizedContent('en', 'Main Scene'),
                            payloadSchemaVersion: '1',
                            payload: {
                                schemaVersion: '1',
                                entities: [
                                    {
                                        id: 'root',
                                        name: 'Root',
                                        parentId: null,
                                        enabled: true,
                                        components: {},
                                        children: ['parent-1', 'child-1']
                                    },
                                    {
                                        id: 'parent-1',
                                        name: 'Parent',
                                        parentId: null,
                                        enabled: true,
                                        components: {},
                                        children: ['child-1']
                                    },
                                    {
                                        id: 'child-1',
                                        name: 'Child',
                                        parentId: 'parent-1',
                                        enabled: true,
                                        components: {},
                                        children: []
                                    }
                                ]
                            },
                            payloadFile: null,
                            checksum: null,
                            sortOrder: 0,
                            publish: true,
                            version: 1
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.loadEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'scenes',
                documentId: '456',
                numericProjectId: 123,
                numericSceneId: 456,
                numericUserId: 789
            })
        ).resolves.toMatchObject({
            collection: 'scenes',
            data: {
                entities: {
                    root: {
                        parent: null,
                        children: ['parent-1']
                    },
                    'parent-1': {
                        parent: 'root',
                        children: ['child-1']
                    },
                    'child-1': {
                        parent: 'parent-1',
                        children: []
                    }
                }
            }
        })
    })

    it('loads realtime asset documents from metahub PlayCanvas assets by editor document id', async () => {
        const editorDocumentId = createPlayCanvasEditorNumericAssetId(ASSET_ID)
        const exec = {
            query: jest.fn(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_scenes')) {
                    return []
                }
                if (sql.includes('_mhb_playcanvas_assets')) {
                    return [
                        {
                            id: ASSET_ID,
                            projectId: PROJECT_ID,
                            stableAssetId: 'asset-root',
                            type: 'json',
                            name: 'Root Asset',
                            virtualPath: ['root.json'],
                            file: {
                                provider: 'local',
                                root: 'playcanvas-projects',
                                path: `playcanvas-projects/${PROJECT_ID}/assets/root.json`,
                                mime: 'application/json',
                                hash: 'a'.repeat(64),
                                size: 42,
                                status: 'ready'
                            },
                            metadata: {},
                            publish: true,
                            version: 3
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.loadEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'assets',
                documentId: String(editorDocumentId),
                numericProjectId: 123,
                numericSceneId: 456,
                numericUserId: 789
            })
        ).resolves.toMatchObject({
            collection: 'assets',
            id: String(editorDocumentId),
            version: 3,
            data: {
                item_id: editorDocumentId,
                name: 'Root Asset',
                file: {
                    filename: 'root.json',
                    hash: 'a'.repeat(64),
                    size: 42
                }
            }
        })
    })

    it('loads realtime asset documents when asset metadata is missing', async () => {
        const editorDocumentId = createPlayCanvasEditorNumericAssetId(ASSET_ID)
        const exec = {
            query: jest.fn(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_scenes')) {
                    return []
                }
                if (sql.includes('_mhb_playcanvas_assets')) {
                    return [
                        {
                            id: ASSET_ID,
                            projectId: PROJECT_ID,
                            stableAssetId: 'asset-root',
                            type: 'json',
                            name: 'Root Asset',
                            virtualPath: ['root.json'],
                            file: null,
                            metadata: undefined,
                            publish: true,
                            version: 3
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.loadEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'assets',
                documentId: String(editorDocumentId),
                numericProjectId: 123,
                numericSceneId: 456,
                numericUserId: 789
            })
        ).resolves.toEqual({
            collection: 'assets',
            id: String(editorDocumentId),
            version: 3,
            data: {
                item_id: editorDocumentId,
                name: 'Root Asset',
                type: 'json',
                file: null,
                path: [],
                tags: [],
                data: null,
                meta: null,
                preload: true,
                source: false,
                branch_id: 456,
                project: 123
            }
        })
    })

    it('loads realtime material asset documents with PlayCanvas material data', async () => {
        const editorDocumentId = createPlayCanvasEditorNumericAssetId(ASSET_ID)
        const materialData = {
            diffuse: [1, 1, 1],
            opacity: 0.42,
            emissive: [0.15, 0.85, 1],
            emissiveIntensity: 2.4,
            blendType: 'additive',
            depthWrite: false,
            useFog: true,
            useLighting: true,
            useSkybox: false,
            shader: 'blinn'
        }
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_scenes')) {
                    return []
                }
                if (sql.includes('_mhb_playcanvas_assets')) {
                    return [
                        {
                            id: ASSET_ID,
                            projectId: PROJECT_ID,
                            stableAssetId: 'mmoomm-visual-linkup-material',
                            type: 'material',
                            name: 'Linkup Material',
                            virtualPath: ['materials', 'linkup.json'],
                            file: null,
                            metadata: {
                                data: materialData,
                                editorDocument: {
                                    data: materialData,
                                    tags: ['mmoomm', 'visual-linkup-lab'],
                                    preload: true,
                                    source: false
                                }
                            },
                            publish: true,
                            version: 3
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.loadEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'assets',
                documentId: String(editorDocumentId),
                numericProjectId: 123,
                numericSceneId: 456,
                numericUserId: 789
            })
        ).resolves.toMatchObject({
            collection: 'assets',
            id: String(editorDocumentId),
            version: 3,
            data: {
                item_id: editorDocumentId,
                name: 'Linkup Material',
                type: 'material',
                data: materialData,
                tags: ['mmoomm', 'visual-linkup-lab'],
                preload: true,
                source: false
            }
        })
    })

    it('loads realtime scene-local material asset documents by numeric editor id', async () => {
        const materialData = { diffuse: [1, 1, 1], opacity: 0.42, blendType: 2, depthWrite: false, useFog: true, shader: 'blinn' }
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        jest.spyOn(service, 'listAssets').mockResolvedValue([])
        jest.spyOn(service, 'listScenes').mockResolvedValue([
            {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'scene'),
                displayName: createLocalizedContent('en', 'Scene'),
                payloadSchemaVersion: '1',
                payload: null,
                payloadFile: null,
                checksum: null,
                sortOrder: 0,
                publish: true,
                version: 7
            }
        ])
        jest.spyOn(service, 'readEditorScene').mockResolvedValue({
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'scene'),
                displayName: createLocalizedContent('en', 'Scene'),
                payloadSchemaVersion: '1',
                payload: null,
                payloadFile: null,
                checksum: null,
                sortOrder: 0,
                publish: true,
                version: 7
            },
            payload: {
                schemaVersion: '1',
                entities: [],
                assets: [
                    {
                        id: '920000001',
                        stableAssetId: 'mmoomm-visual-linkup-920000001',
                        name: 'Scene Local Material',
                        type: 'material',
                        data: materialData,
                        metadata: { data: materialData }
                    }
                ]
            },
            checksum: null
        })

        await expect(
            service.loadEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'assets',
                documentId: '920000001',
                numericProjectId: 123,
                numericSceneId: 456,
                numericUserId: 789
            })
        ).resolves.toMatchObject({
            collection: 'assets',
            id: '920000001',
            version: 7,
            data: {
                item_id: 920000001,
                name: 'Scene Local Material',
                type: 'material',
                data: materialData
            }
        })
    })

    it('returns the persisted scene-local asset revision after a transient metadata update failure', async () => {
        const materialData = { diffuse: [1, 1, 1], opacity: 0.42, blendType: 2, depthWrite: false, useFog: true, shader: 'blinn' }
        const nextMaterialData = { ...materialData, opacity: 0.22 }
        const sceneBefore = {
            id: SCENE_ID,
            projectId: PROJECT_ID,
            codename: createLocalizedContent('en', 'scene'),
            displayName: createLocalizedContent('en', 'Scene'),
            payloadSchemaVersion: '1',
            payloadFile: null,
            checksum: 'a'.repeat(64),
            sortOrder: 0,
            publish: true,
            version: 7
        }
        const sceneAfter = { ...sceneBefore, checksum: 'b'.repeat(64), version: 8 }
        const sceneLocalMaterial = {
            id: '920000001',
            stableAssetId: 'mmoomm-visual-linkup-920000001',
            name: 'Scene Local Material',
            type: 'material',
            data: materialData,
            metadata: { data: materialData }
        }
        const sceneLocalMaterialAfter = {
            ...sceneLocalMaterial,
            data: nextMaterialData,
            metadata: { data: nextMaterialData, editorDocument: { data: nextMaterialData, tags: [], preload: true, source: false } }
        }
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        jest.spyOn(service, 'listAssets').mockResolvedValue([])
        jest.spyOn(service, 'listScenes').mockResolvedValue([sceneBefore])
        jest.spyOn(service, 'readEditorScene')
            .mockResolvedValueOnce({
                scene: sceneBefore,
                payload: { schemaVersion: '1', entities: [], assets: [sceneLocalMaterial] },
                checksum: sceneBefore.checksum
            })
            .mockResolvedValueOnce({
                scene: sceneBefore,
                payload: { schemaVersion: '1', entities: [], assets: [sceneLocalMaterial] },
                checksum: sceneBefore.checksum
            })
            .mockResolvedValueOnce({
                scene: sceneAfter,
                payload: { schemaVersion: '1', entities: [], assets: [sceneLocalMaterialAfter] },
                checksum: sceneAfter.checksum
            })
        const saveEditorScene = jest.spyOn(service, 'saveEditorScene').mockRejectedValueOnce(
            new MetahubValidationError('PlayCanvas project file metadata reference was not updated', {
                messageCode: 'playcanvas.files.metadataUpdateFailed',
                projectId: PROJECT_ID,
                sourcePath: `playcanvas-projects/${PROJECT_ID}/scenes/${SCENE_ID}.json`
            })
        )

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'assets',
                documentId: '920000001',
                data: {
                    item_id: 920000001,
                    name: 'Scene Local Material',
                    type: 'material',
                    file: null,
                    path: [],
                    tags: [],
                    data: nextMaterialData,
                    meta: null,
                    preload: true,
                    source: false
                },
                version: 8,
                revision: '7'
            })
        ).resolves.toEqual({ revision: '8' })

        expect(saveEditorScene).toHaveBeenCalledTimes(1)
        expect(saveEditorScene).toHaveBeenCalledWith(
            'metahub-1',
            PROJECT_ID,
            SCENE_ID,
            expect.objectContaining({
                expectedCurrentChecksum: sceneBefore.checksum,
                payload: expect.objectContaining({
                    assets: [
                        expect.objectContaining({
                            id: '920000001',
                            data: nextMaterialData,
                            metadata: expect.objectContaining({
                                editorDocument: expect.objectContaining({ data: nextMaterialData })
                            })
                        })
                    ]
                })
            }),
            'user-2'
        )
    })

    it('scopes duplicate scene-local material document ids to the owning scene', async () => {
        const firstMaterialData = { diffuse: [1, 1, 1], opacity: 0.42, useFog: true, shader: 'blinn' }
        const secondMaterialData = { diffuse: [0.25, 0.75, 1], opacity: 0.7, useFog: true, shader: 'blinn' }
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const firstScene = {
            id: SCENE_ID,
            projectId: PROJECT_ID,
            codename: createLocalizedContent('en', 'scene-one'),
            displayName: createLocalizedContent('en', 'Scene One'),
            payloadSchemaVersion: '1',
            payload: null,
            payloadFile: null,
            checksum: null,
            sortOrder: 0,
            publish: true,
            version: 7
        }
        const secondScene = {
            ...firstScene,
            id: SECOND_SCENE_ID,
            codename: createLocalizedContent('en', 'scene-two'),
            displayName: createLocalizedContent('en', 'Scene Two'),
            version: 11
        }
        jest.spyOn(service, 'listAssets').mockResolvedValue([])
        jest.spyOn(service, 'listScenes').mockResolvedValue([firstScene, secondScene])
        jest.spyOn(service, 'readEditorScene').mockImplementation(async (_metahubId, _projectId, sceneId) => {
            const isSecondScene = sceneId === SECOND_SCENE_ID
            const scene = isSecondScene ? secondScene : firstScene
            const materialData = isSecondScene ? secondMaterialData : firstMaterialData
            return {
                scene,
                payload: {
                    schemaVersion: '1',
                    entities: [],
                    assets: [
                        {
                            id: '920000001',
                            stableAssetId: isSecondScene ? 'scene-two-material' : 'scene-one-material',
                            name: isSecondScene ? 'Scene Two Material' : 'Scene One Material',
                            type: 'material',
                            data: materialData,
                            metadata: { data: materialData }
                        }
                    ]
                },
                checksum: null
            }
        })

        await expect(service.listEditorCompatibilityAssetSummaries('metahub-1', PROJECT_ID, 'user-2')).resolves.toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'Scene One Material', editorDocumentId: 920000001 }),
                expect.objectContaining({ name: 'Scene Two Material', editorDocumentId: 920000001 })
            ])
        )

        await expect(
            service.loadEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SECOND_SCENE_ID,
                userId: 'user-2',
                collection: 'assets',
                documentId: '920000001',
                numericProjectId: 123,
                numericSceneId: 456,
                numericUserId: 789
            })
        ).resolves.toMatchObject({
            collection: 'assets',
            id: '920000001',
            version: 11,
            data: {
                item_id: 920000001,
                name: 'Scene Two Material',
                type: 'material',
                data: secondMaterialData
            }
        })
    })

    it('rejects storage and scene-local asset document id collisions before Editor token signing', async () => {
        const materialData = { diffuse: [1, 1, 1], opacity: 0.42, blendType: 2, depthWrite: false, useFog: true, shader: 'blinn' }
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        jest.spyOn(service, 'listAssets').mockResolvedValue([
            {
                id: '920000001',
                projectId: PROJECT_ID,
                stableAssetId: 'storage-material',
                type: 'material',
                name: 'Storage Material',
                virtualPath: ['materials', 'storage.json'],
                file: null,
                metadata: {},
                publish: true,
                version: 3
            }
        ])
        jest.spyOn(service, 'listScenes').mockResolvedValue([
            {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'scene'),
                displayName: createLocalizedContent('en', 'Scene'),
                payloadSchemaVersion: '1',
                payload: null,
                payloadFile: null,
                checksum: null,
                sortOrder: 0,
                publish: true,
                version: 7
            }
        ])
        jest.spyOn(service, 'readEditorScene').mockResolvedValue({
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'scene'),
                displayName: createLocalizedContent('en', 'Scene'),
                payloadSchemaVersion: '1',
                payload: null,
                payloadFile: null,
                checksum: null,
                sortOrder: 0,
                publish: true,
                version: 7
            },
            payload: {
                schemaVersion: '1',
                entities: [],
                assets: [
                    {
                        id: '920000001',
                        stableAssetId: 'scene-local-material',
                        name: 'Scene Local Material',
                        type: 'material',
                        data: materialData,
                        metadata: { data: materialData }
                    }
                ]
            },
            checksum: null
        })

        await expect(service.listEditorCompatibilityAssetSummaries('metahub-1', PROJECT_ID, 'user-2')).rejects.toMatchObject({
            details: expect.objectContaining({
                messageCode: 'playcanvas.editorRealtime.assetDocumentIdCollision',
                documentId: '920000001',
                assetIds: ['920000001', '920000001']
            })
        })
    })

    it('rejects duplicate scene-local asset document ids before Editor token signing', async () => {
        const materialData = { diffuse: [1, 1, 1], opacity: 0.42, useFog: true, shader: 'blinn' }
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        jest.spyOn(service, 'listAssets').mockResolvedValue([])
        jest.spyOn(service, 'listScenes').mockResolvedValue([
            {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'scene'),
                displayName: createLocalizedContent('en', 'Scene'),
                payloadSchemaVersion: '1',
                payload: null,
                payloadFile: null,
                checksum: null,
                sortOrder: 0,
                publish: true,
                version: 7
            }
        ])
        jest.spyOn(service, 'readEditorScene').mockResolvedValue({
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'scene'),
                displayName: createLocalizedContent('en', 'Scene'),
                payloadSchemaVersion: '1',
                payload: null,
                payloadFile: null,
                checksum: null,
                sortOrder: 0,
                publish: true,
                version: 7
            },
            payload: {
                schemaVersion: '1',
                entities: [],
                assets: [
                    {
                        id: '920000001',
                        stableAssetId: 'scene-local-material-a',
                        name: 'Scene Local Material A',
                        type: 'material',
                        data: materialData,
                        metadata: { data: materialData }
                    },
                    {
                        id: '920000001',
                        stableAssetId: 'scene-local-material-b',
                        name: 'Scene Local Material B',
                        type: 'material',
                        data: materialData,
                        metadata: { data: materialData }
                    }
                ]
            },
            checksum: null
        })

        await expect(service.listEditorCompatibilityAssetSummaries('metahub-1', PROJECT_ID, 'user-2')).rejects.toMatchObject({
            details: expect.objectContaining({
                messageCode: 'playcanvas.editorRealtime.assetDocumentIdCollision',
                documentId: '920000001'
            })
        })
    })

    it('lists scene-local material assets as minimal Editor scene assets', async () => {
        const materialData = { diffuse: [1, 1, 1], opacity: 0.42, useFog: true, shader: 'blinn' }
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        jest.spyOn(service, 'listAssets').mockResolvedValue([])
        jest.spyOn(service, 'listScenes').mockResolvedValue([
            {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'scene'),
                displayName: createLocalizedContent('en', 'Scene'),
                payloadSchemaVersion: '1',
                payload: null,
                payloadFile: null,
                checksum: null,
                sortOrder: 0,
                publish: true,
                version: 7
            }
        ])
        jest.spyOn(service, 'readEditorScene').mockResolvedValue({
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'scene'),
                displayName: createLocalizedContent('en', 'Scene'),
                payloadSchemaVersion: '1',
                payload: null,
                payloadFile: null,
                checksum: null,
                sortOrder: 0,
                publish: true,
                version: 7
            },
            payload: {
                schemaVersion: '1',
                entities: [
                    {
                        id: 'entity-1',
                        name: 'Scene Local Material Owner',
                        parentId: null,
                        enabled: true,
                        components: { render: { materialAssets: [920000001] } },
                        children: []
                    }
                ],
                assets: [
                    {
                        id: '920000001',
                        stableAssetId: 'mmoomm-visual-linkup-920000001',
                        name: 'Scene Local Material',
                        type: 'material',
                        data: materialData,
                        metadata: { data: materialData }
                    }
                ]
            },
            checksum: null
        })

        await expect(service.listMinimalAssetsForEditorScene('metahub-1', PROJECT_ID, SCENE_ID, 'user-2')).resolves.toEqual([
            {
                id: '920000001',
                stableAssetId: 'mmoomm-visual-linkup-920000001',
                type: 'material',
                name: 'Scene Local Material',
                virtualPath: [],
                mime: null,
                hash: null,
                size: null
            }
        ])
    })

    it('persists realtime scene-local material asset documents back to the owning scene payload', async () => {
        const materialData = { diffuse: [1, 1, 1], opacity: 0.42, blendType: 2, depthWrite: false, useFog: true, shader: 'blinn' }
        const nextMaterialData = { diffuse: [0.7, 0.9, 1], opacity: 0.55, blendType: 1, depthWrite: false, useFog: true, shader: 'blinn' }
        const scene = {
            id: SCENE_ID,
            projectId: PROJECT_ID,
            codename: createLocalizedContent('en', 'scene'),
            displayName: createLocalizedContent('en', 'Scene'),
            payloadSchemaVersion: '1',
            payload: null,
            payloadFile: null,
            checksum: 'c'.repeat(64),
            sortOrder: 0,
            publish: true,
            version: 7
        }
        const scenePayload = {
            schemaVersion: '1',
            entities: [],
            assets: [
                {
                    id: '920000001',
                    stableAssetId: 'mmoomm-visual-linkup-920000001',
                    name: 'Scene Local Material',
                    type: 'material',
                    data: materialData,
                    metadata: { data: materialData }
                }
            ]
        }
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        jest.spyOn(service, 'listAssets').mockResolvedValue([])
        jest.spyOn(service, 'listScenes').mockResolvedValue([scene])
        jest.spyOn(service, 'readEditorScene').mockResolvedValue({
            scene,
            payload: scenePayload,
            checksum: 'c'.repeat(64)
        })
        const saveEditorScene = jest.spyOn(service, 'saveEditorScene').mockResolvedValue({
            scene: { ...scene, version: 8 },
            checksum: 'd'.repeat(64)
        })

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'assets',
                documentId: '920000001',
                data: {
                    item_id: 920000001,
                    name: 'Edited Scene Local Material',
                    type: 'material',
                    tags: ['mmoomm', 'edited'],
                    data: nextMaterialData,
                    meta: { edited: true },
                    preload: false,
                    source: false
                },
                version: 8,
                revision: '7'
            })
        ).resolves.toEqual({ revision: '8' })

        expect(saveEditorScene).toHaveBeenCalledWith(
            'metahub-1',
            PROJECT_ID,
            SCENE_ID,
            expect.objectContaining({
                expectedCurrentChecksum: 'c'.repeat(64),
                payload: expect.objectContaining({
                    assets: [
                        expect.objectContaining({
                            id: '920000001',
                            stableAssetId: 'mmoomm-visual-linkup-920000001',
                            name: 'Edited Scene Local Material',
                            type: 'material',
                            data: nextMaterialData,
                            meta: { edited: true },
                            metadata: expect.objectContaining({
                                data: nextMaterialData,
                                meta: { edited: true },
                                editorDocument: {
                                    data: nextMaterialData,
                                    meta: { edited: true },
                                    tags: ['mmoomm', 'edited'],
                                    preload: false,
                                    source: false,
                                    version: 8
                                }
                            })
                        })
                    ]
                })
            }),
            'user-2'
        )
    })

    it('skips unchanged realtime scene-local material asset documents with stale revisions', async () => {
        const materialData = { diffuse: [1, 1, 1], opacity: 0.42, blendType: 2, depthWrite: false, useFog: true, shader: 'blinn' }
        const scene = {
            id: SCENE_ID,
            projectId: PROJECT_ID,
            codename: createLocalizedContent('en', 'scene'),
            displayName: createLocalizedContent('en', 'Scene'),
            payloadSchemaVersion: '1',
            payload: null,
            payloadFile: null,
            checksum: 'c'.repeat(64),
            sortOrder: 0,
            publish: true,
            version: 9
        }
        const scenePayload = {
            schemaVersion: '1',
            entities: [],
            assets: [
                {
                    id: '920000001',
                    stableAssetId: 'mmoomm-visual-linkup-920000001',
                    name: 'Scene Local Material',
                    type: 'material',
                    data: materialData,
                    metadata: {
                        data: materialData,
                        editorDocument: {
                            data: materialData,
                            meta: null,
                            tags: ['mmoomm', 'visual-linkup-lab'],
                            preload: true,
                            source: false
                        }
                    }
                }
            ]
        }
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        jest.spyOn(service, 'listAssets').mockResolvedValue([])
        jest.spyOn(service, 'readEditorScene').mockResolvedValue({
            scene,
            payload: scenePayload,
            checksum: 'c'.repeat(64)
        })
        const saveEditorScene = jest.spyOn(service, 'saveEditorScene')

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'assets',
                documentId: '920000001',
                data: {
                    item_id: 920000001,
                    name: 'Scene Local Material',
                    type: 'material',
                    path: [],
                    tags: ['mmoomm', 'visual-linkup-lab'],
                    data: materialData,
                    meta: null,
                    preload: true,
                    source: false
                },
                version: 2,
                revision: '7'
            })
        ).resolves.toEqual({ revision: '9' })

        expect(saveEditorScene).not.toHaveBeenCalled()
    })

    it('persists realtime asset documents back to metahub PlayCanvas asset metadata', async () => {
        const editorDocumentId = createPlayCanvasEditorNumericAssetId(ASSET_ID)
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_assets')) {
                    return [
                        {
                            id: ASSET_ID,
                            projectId: PROJECT_ID,
                            stableAssetId: 'asset-root',
                            type: 'json',
                            name: 'Root Asset',
                            virtualPath: ['root.json'],
                            file: {
                                provider: 'local',
                                root: 'playcanvas-projects',
                                path: `playcanvas-projects/${PROJECT_ID}/assets/root.json`,
                                mime: 'application/json',
                                hash: 'a'.repeat(64),
                                size: 42,
                                status: 'ready'
                            },
                            metadata: { source: 'initial' },
                            publish: true,
                            version: 3
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_scenes')) {
                    return []
                }
                if (sql.includes('INSERT INTO') && sql.includes('_mhb_playcanvas_assets')) {
                    expect(params?.[4]).toBe('Renamed Asset')
                    expect(params?.[5]).toBe(JSON.stringify(['renamed', 'asset.json']))
                    expect(params?.[11]).toBe(
                        JSON.stringify({
                            source: 'initial',
                            editorDocument: {
                                data: { width: 32 },
                                meta: { imported: true },
                                tags: ['mmoomm'],
                                preload: false,
                                source: false,
                                version: 4
                            }
                        })
                    )
                    expect(params?.[15]).toBe(3)
                    return [
                        {
                            id: ASSET_ID,
                            projectId: PROJECT_ID,
                            stableAssetId: 'asset-root',
                            type: 'json',
                            name: 'Renamed Asset',
                            virtualPath: ['renamed', 'asset.json'],
                            file: {
                                provider: 'local',
                                root: 'playcanvas-projects',
                                path: `playcanvas-projects/${PROJECT_ID}/assets/root.json`,
                                mime: 'application/json',
                                hash: 'a'.repeat(64),
                                size: 42,
                                status: 'ready'
                            },
                            metadata: JSON.parse(String(params?.[11])),
                            publish: true,
                            version: 4
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'assets',
                documentId: String(editorDocumentId),
                data: {
                    item_id: editorDocumentId,
                    name: 'Renamed Asset',
                    type: 'json',
                    path: ['renamed', 'asset.json'],
                    tags: ['mmoomm'],
                    data: { width: 32 },
                    meta: { imported: true },
                    preload: false,
                    source: false
                },
                version: 4,
                revision: '3'
            })
        ).resolves.toEqual({ revision: '4' })
    })

    it('persists realtime scene documents without the synthetic ShareDB root entity', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        jest.spyOn(service, 'readEditorScene').mockResolvedValue({
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'main_scene'),
                displayName: createLocalizedContent('en', 'Main Scene'),
                payloadSchemaVersion: '1',
                payloadFile: null,
                checksum: 'b'.repeat(64),
                sortOrder: 0,
                publish: true,
                version: 1
            },
            payload: {
                schemaVersion: '1',
                settings: {},
                entities: []
            }
        })
        const saveEditorCompatibilityScene = jest.spyOn(service, 'saveEditorCompatibilityScene').mockResolvedValue({
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'main_scene'),
                displayName: createLocalizedContent('en', 'Main Scene'),
                payloadSchemaVersion: '1',
                payloadFile: null,
                checksum: 'c'.repeat(64),
                sortOrder: 0,
                publish: true,
                version: 2
            },
            payload: {
                schemaVersion: '1',
                settings: {},
                entities: [
                    {
                        id: 'entity-1',
                        name: 'Camera',
                        parentId: null,
                        enabled: true,
                        components: {},
                        children: []
                    }
                ]
            },
            checksum: 'c'.repeat(64)
        })

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'scenes',
                documentId: '456',
                data: {
                    settings: {
                        id: 'project_123',
                        width: 1280,
                        height: 720,
                        engineV2: true,
                        priority_scripts: ['boot.mjs'],
                        physics: { gravity: [0, -9.81, 0] },
                        render: { global_ambient: [0.2, 0.2, 0.2] }
                    },
                    entities: {
                        root: {
                            resource_id: 'root',
                            name: 'Root',
                            parent: null,
                            children: ['entity-1']
                        },
                        'entity-1': {
                            resource_id: 'stable-entity-1',
                            name: 'Camera',
                            parent: 'root',
                            enabled: true,
                            components: {},
                            children: ['root', 'entity-2']
                        },
                        'entity-2': {
                            resource_id: 'stable-entity-2',
                            name: 'Child',
                            parent: 'entity-1',
                            enabled: true,
                            components: {},
                            children: []
                        }
                    }
                },
                version: 2,
                checksum: 'b'.repeat(64),
                revision: '1'
            })
        ).resolves.toEqual({ checksum: 'c'.repeat(64) })

        expect(saveEditorCompatibilityScene).toHaveBeenCalledWith(
            'metahub-1',
            PROJECT_ID,
            SCENE_ID,
            expect.objectContaining({
                payload: expect.objectContaining({
                    entities: [
                        expect.objectContaining({
                            id: 'stable-entity-1',
                            parentId: null,
                            children: ['stable-entity-2']
                        }),
                        expect.objectContaining({
                            id: 'stable-entity-2',
                            parentId: 'stable-entity-1',
                            children: []
                        })
                    ]
                })
            }),
            'user-2'
        )
        const payload = saveEditorCompatibilityScene.mock.calls[0]?.[3].payload
        expect(payload.entities).toHaveLength(2)
        expect(payload.entities.some((entity) => entity.id === 'root')).toBe(false)
        expect(payload.entities.some((entity) => entity.id === 'entity-1')).toBe(false)
    })

    it('derives MMOOMM scene metadata from native renderable PlayCanvas Editor entities', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const saveEditorCompatibilityScene = jest.spyOn(service, 'saveEditorCompatibilityScene').mockResolvedValue({
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'main_scene'),
                displayName: createLocalizedContent('en', 'Main Scene'),
                payloadSchemaVersion: '1',
                payloadFile: null,
                checksum: 'e'.repeat(64),
                sortOrder: 0,
                publish: true,
                version: 3
            },
            payload: { schemaVersion: '1', settings: {}, entities: [] },
            checksum: 'e'.repeat(64)
        })
        jest.spyOn(service, 'readEditorScene').mockResolvedValue({
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'main_scene'),
                displayName: createLocalizedContent('en', 'Main Scene'),
                payloadSchemaVersion: '1',
                payloadFile: null,
                checksum: 'c'.repeat(64),
                sortOrder: 0,
                publish: true,
                version: 2
            },
            payload: { schemaVersion: '1', settings: {}, entities: [] }
        })

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'scenes',
                documentId: '456',
                data: {
                    settings: {
                        id: 'project_123',
                        width: 1280,
                        height: 720,
                        engineV2: true,
                        priority_scripts: ['boot.mjs'],
                        physics: { gravity: [0, -9.81, 0] },
                        render: { global_ambient: [0.2, 0.2, 0.2] }
                    },
                    entities: {
                        shipDoc: {
                            resource_id: 'stable-ship',
                            name: 'MMOOMM Ship',
                            parent: null,
                            enabled: true,
                            position: [0, 0, 0],
                            rotation: [0, 0, 0],
                            scale: [12, 4, 4],
                            components: { render: { enabled: true, type: 'box' } },
                            children: []
                        },
                        stationDoc: {
                            resource_id: 'stable-station',
                            name: 'MMOOMM Station',
                            parent: null,
                            enabled: true,
                            position: [72, 0, -48],
                            rotation: [0, 0, 0],
                            scale: [48, 16, 16],
                            components: { render: { enabled: true, type: 'box' } },
                            children: []
                        }
                    }
                },
                version: 2,
                checksum: 'c'.repeat(64),
                revision: '1'
            })
        ).resolves.toEqual({ checksum: 'e'.repeat(64) })

        const payload = saveEditorCompatibilityScene.mock.calls[0]?.[3].payload
        expect(payload.settings).toEqual(
            expect.objectContaining({
                physics: expect.objectContaining({ gravity: [0, -9.81, 0] }),
                render: expect.objectContaining({ global_ambient: [0.2, 0.2, 0.2] })
            })
        )
        expect(payload.settings).toEqual(expect.objectContaining({ priority_scripts: ['boot.mjs'] }))
        expect(payload.settings).not.toHaveProperty('id')
        expect(payload.settings).not.toHaveProperty('width')
        expect(payload.settings).not.toHaveProperty('height')
        expect(payload.settings).not.toHaveProperty('engineV2')
        expect(payload.metadata?.mmoomm?.scene).toEqual(
            expect.objectContaining({
                controlledObjectId: 'stable-ship',
                targetObjectId: 'stable-station',
                cruiseSpeed: 36,
                intentDistance: 720,
                objects: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'stable-ship',
                        position: { x: 0, y: 0, z: 0 },
                        scale: { x: 12, y: 4, z: 4 },
                        selectable: true
                    }),
                    expect.objectContaining({
                        id: 'stable-station',
                        position: { x: 72, y: 0, z: -48 },
                        scale: { x: 48, y: 16, z: 16 },
                        selectable: true,
                        guard: true
                    })
                ])
            })
        )
        expect(payload.metadata?.mmoomm?.provenance).toEqual(expect.objectContaining({ authoringFlow: 'playcanvas-editor-native-scene' }))
    })

    it('preserves MMOOMM projection transforms when persisting full realtime scene documents', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const saveEditorCompatibilityScene = jest.spyOn(service, 'saveEditorCompatibilityScene').mockResolvedValue({
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'main_scene'),
                displayName: createLocalizedContent('en', 'Main Scene'),
                payloadSchemaVersion: '1',
                payloadFile: null,
                checksum: 'd'.repeat(64),
                sortOrder: 0,
                publish: true,
                version: 3
            },
            payload: { schemaVersion: '1', settings: {}, entities: [] },
            checksum: 'd'.repeat(64)
        })
        jest.spyOn(service, 'readEditorScene').mockResolvedValue({
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'main_scene'),
                displayName: createLocalizedContent('en', 'Main Scene'),
                payloadSchemaVersion: '1',
                payloadFile: null,
                checksum: 'c'.repeat(64),
                sortOrder: 0,
                publish: true,
                version: 2
            },
            payload: {
                schemaVersion: '1',
                settings: {},
                metadata: {
                    mmoomm: {
                        scene: {
                            controlledObjectId: 'stable-ship',
                            targetObjectId: 'stable-station',
                            objects: [
                                { id: 'stable-ship', position: { x: 0, y: 0, z: 0 }, scale: { x: 12, y: 4, z: 4 } },
                                { id: 'stable-station', position: { x: 72, y: 0, z: -48 }, scale: { x: 48, y: 16, z: 16 } }
                            ]
                        }
                    }
                },
                entities: [
                    {
                        id: 'stable-ship',
                        name: 'MMOOMM Ship',
                        parentId: null,
                        enabled: true,
                        position: [0, 0, 0],
                        rotation: [0, 0, 0],
                        scale: [12, 4, 4],
                        components: { render: { type: 'box' } },
                        children: []
                    },
                    {
                        id: 'stable-station',
                        name: 'MMOOMM Station',
                        parentId: null,
                        enabled: true,
                        position: [72, 0, -48],
                        rotation: [0, 0, 0],
                        scale: [48, 16, 16],
                        components: { render: { type: 'box' } },
                        children: []
                    }
                ]
            }
        })

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'scenes',
                documentId: '456',
                data: {
                    settings: {},
                    entities: {
                        shipDoc: {
                            resource_id: 'stable-ship',
                            name: 'MMOOMM Ship',
                            parent: null,
                            enabled: true,
                            position: [1, 0, 0],
                            rotation: [0, 0, 0],
                            scale: [12, 4, 4],
                            components: { render: { type: 'box' } },
                            children: []
                        },
                        stationDoc: {
                            resource_id: 'stable-station',
                            name: 'MMOOMM Station',
                            parent: null,
                            enabled: true,
                            components: { render: { type: 'box' } },
                            children: []
                        }
                    }
                },
                version: 2,
                checksum: 'c'.repeat(64),
                revision: '1'
            })
        ).resolves.toEqual({ checksum: 'd'.repeat(64) })

        const payload = saveEditorCompatibilityScene.mock.calls[0]?.[3].payload
        expect(payload.entities).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'stable-ship',
                    name: 'MMOOMM Ship',
                    position: [1, 0, 0],
                    rotation: [0, 0, 0],
                    scale: [12, 4, 4]
                }),
                expect.objectContaining({
                    id: 'stable-station',
                    position: [72, 0, -48],
                    rotation: [0, 0, 0],
                    scale: [48, 16, 16]
                })
            ])
        )
        expect(payload.metadata?.mmoomm?.scene?.objects).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'stable-ship',
                    position: { x: 1, y: 0, z: 0 },
                    scale: { x: 12, y: 4, z: 4 }
                })
            ])
        )
        expect(payload.metadata?.mmoomm?.provenance).toEqual(expect.objectContaining({ authoringFlow: 'playcanvas-editor-native-scene' }))
    })

    it('derives MMOOMM runtime metadata from realtime entities with dotted render component paths', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        jest.spyOn(service, 'readEditorScene').mockResolvedValue({
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'main_scene'),
                displayName: createLocalizedContent('en', 'Main Scene'),
                payloadSchemaVersion: '1',
                payloadFile: null,
                checksum: 'c'.repeat(64),
                sortOrder: 0,
                publish: true,
                version: 2
            },
            payload: {
                schemaVersion: '1',
                settings: {},
                entities: []
            }
        })
        const saveEditorCompatibilityScene = jest.spyOn(service, 'saveEditorCompatibilityScene').mockResolvedValue({
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'main_scene'),
                displayName: createLocalizedContent('en', 'Main Scene'),
                payloadSchemaVersion: '1',
                payloadFile: null,
                checksum: 'd'.repeat(64),
                sortOrder: 0,
                publish: true,
                version: 3
            },
            payload: { schemaVersion: '1', settings: {}, entities: [] },
            checksum: 'd'.repeat(64)
        })

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'scenes',
                documentId: '456',
                data: {
                    settings: {},
                    entities: {
                        shipDoc: {
                            resource_id: 'stable-ship',
                            name: 'MMOOMM Ship',
                            parent: null,
                            enabled: true,
                            position: [0, 0, 0],
                            scale: [12, 4, 4],
                            components: {},
                            'components.render.enabled': true,
                            'components.render.type': 'box',
                            children: []
                        },
                        stationDoc: {
                            resource_id: 'stable-station',
                            name: 'MMOOMM Station',
                            parent: null,
                            enabled: true,
                            position: [72, 0, -48],
                            scale: [48, 16, 16],
                            'components.render.enabled': true,
                            'components.render.type': 'box',
                            children: []
                        }
                    }
                },
                version: 2,
                checksum: 'c'.repeat(64),
                revision: '1'
            })
        ).resolves.toEqual({ checksum: 'd'.repeat(64) })

        const payload = saveEditorCompatibilityScene.mock.calls[0]?.[3].payload
        expect(payload.entities).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'stable-ship', components: { render: { enabled: true, type: 'box' } } }),
                expect.objectContaining({ id: 'stable-station', components: { render: { enabled: true, type: 'box' } } })
            ])
        )
        expect(payload.metadata?.mmoomm?.scene).toEqual(
            expect.objectContaining({ controlledObjectId: 'stable-ship', targetObjectId: 'stable-station' })
        )
    })

    it('preserves scene-local material assets when realtime scene documents are saved', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const scene = {
            id: SCENE_ID,
            projectId: PROJECT_ID,
            codename: createLocalizedContent('en', 'main_scene'),
            displayName: createLocalizedContent('en', 'Main Scene'),
            payloadSchemaVersion: '1',
            payloadFile: null,
            checksum: 'c'.repeat(64),
            sortOrder: 0,
            publish: true,
            version: 2
        }
        const sceneLocalMaterial = {
            id: '920000001',
            stableAssetId: 'mmoomm-visual-linkup-920000001',
            name: 'White Link Halo Material',
            type: 'material',
            data: { diffuse: [1, 1, 1], opacity: 0.55, useFog: true },
            metadata: { data: { diffuse: [1, 1, 1], opacity: 0.55, useFog: true } }
        }
        jest.spyOn(service, 'readEditorScene').mockResolvedValue({
            scene,
            payload: {
                schemaVersion: '1',
                settings: {},
                assets: [sceneLocalMaterial],
                entities: [
                    {
                        id: 'stable-ship',
                        name: 'Linkup Lab 01 ship Core',
                        parentId: null,
                        enabled: true,
                        components: { render: { enabled: true, type: 'box', materialAssets: [920000001] } },
                        children: []
                    }
                ]
            }
        })
        const saveEditorCompatibilityScene = jest.spyOn(service, 'saveEditorCompatibilityScene').mockResolvedValue({
            scene: { ...scene, version: 3, checksum: 'd'.repeat(64) },
            payload: { schemaVersion: '1', settings: {}, assets: [sceneLocalMaterial], entities: [] },
            checksum: 'd'.repeat(64)
        })

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'scenes',
                documentId: '456',
                data: {
                    settings: {},
                    entities: {
                        shipDoc: {
                            resource_id: 'stable-ship',
                            name: 'Linkup Lab 01 ship Core Edited',
                            parent: null,
                            enabled: true,
                            components: { render: { enabled: true, type: 'box', materialAssets: [920000001] } },
                            children: []
                        }
                    }
                },
                version: 2,
                checksum: 'c'.repeat(64),
                revision: '1'
            })
        ).resolves.toEqual({ checksum: 'd'.repeat(64) })

        expect(saveEditorCompatibilityScene).toHaveBeenCalledWith(
            'metahub-1',
            PROJECT_ID,
            SCENE_ID,
            expect.objectContaining({
                payload: expect.objectContaining({
                    assets: [sceneLocalMaterial],
                    entities: [
                        expect.objectContaining({
                            id: 'stable-ship',
                            name: 'Linkup Lab 01 ship Core Edited',
                            components: { render: { enabled: true, type: 'box', materialAssets: [920000001] } }
                        })
                    ]
                })
            }),
            'user-2'
        )
    })

    it('rejects unsafe realtime dotted component paths before they can mutate object prototypes', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        jest.spyOn(service, 'readEditorScene').mockResolvedValue({
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'main_scene'),
                displayName: createLocalizedContent('en', 'Main Scene'),
                payloadSchemaVersion: '1',
                payloadFile: null,
                checksum: 'c'.repeat(64),
                sortOrder: 0,
                publish: true,
                version: 2
            },
            payload: {
                schemaVersion: '1',
                settings: {},
                entities: []
            }
        })
        const saveEditorCompatibilityScene = jest.spyOn(service, 'saveEditorCompatibilityScene')

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'scenes',
                documentId: '456',
                data: {
                    settings: {},
                    entities: {
                        shipDoc: {
                            resource_id: 'stable-ship',
                            name: 'MMOOMM Ship',
                            parent: null,
                            enabled: true,
                            components: {},
                            'components.__proto__.polluted': true,
                            children: []
                        }
                    }
                },
                version: 2,
                checksum: 'c'.repeat(64),
                revision: '1'
            })
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.editor.scenePayloadUnsafeComponentPath' })
        })

        expect(saveEditorCompatibilityScene).not.toHaveBeenCalled()
        expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    })

    it('fails realtime scene persistence closed on divergent compatibility checksum conflicts', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const conflict = new MetahubValidationError('Scene checksum mismatch', {
            messageCode: 'playcanvas.files.path.currentChecksumMismatch',
            actualCurrentChecksum: 'c'.repeat(64)
        })
        const saveEditorCompatibilityScene = jest.spyOn(service, 'saveEditorCompatibilityScene').mockRejectedValue(conflict)
        const readEditorScene = jest.spyOn(service, 'readEditorScene').mockResolvedValue({
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'main_scene'),
                displayName: createLocalizedContent('en', 'Main Scene'),
                payloadSchemaVersion: '1',
                payloadFile: null,
                checksum: 'c'.repeat(64),
                sortOrder: 0,
                publish: true,
                version: 3
            },
            payload: {
                schemaVersion: '1',
                settings: {},
                entities: [
                    {
                        id: 'entity-2',
                        name: 'Other',
                        parentId: null,
                        enabled: true,
                        components: {},
                        children: []
                    }
                ]
            }
        })

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'scenes',
                documentId: '456',
                data: {
                    settings: {},
                    entities: {
                        'entity-1': {
                            resource_id: 'entity-1',
                            name: 'Camera',
                            parent: null,
                            enabled: true,
                            components: {},
                            children: []
                        }
                    }
                },
                version: 2,
                checksum: 'b'.repeat(64),
                revision: '1'
            })
        ).rejects.toBe(conflict)

        expect(readEditorScene).toHaveBeenCalledTimes(2)
        expect(saveEditorCompatibilityScene).toHaveBeenCalledWith(
            'metahub-1',
            PROJECT_ID,
            SCENE_ID,
            expect.objectContaining({
                expectedCurrentChecksum: 'b'.repeat(64)
            }),
            'user-2'
        )
    })

    it('treats realtime scene checksum conflicts as idempotent when durable storage already has the same snapshot', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const conflict = new MetahubValidationError('Scene checksum mismatch', {
            messageCode: 'playcanvas.files.path.currentChecksumMismatch',
            actualCurrentChecksum: 'c'.repeat(64)
        })
        jest.spyOn(service, 'saveEditorCompatibilityScene').mockRejectedValue(conflict)
        jest.spyOn(service, 'readEditorScene').mockResolvedValue({
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'main_scene'),
                displayName: createLocalizedContent('en', 'Main Scene'),
                payloadSchemaVersion: '1',
                payloadFile: null,
                checksum: 'c'.repeat(64),
                sortOrder: 0,
                publish: true,
                version: 3
            },
            payload: {
                schemaVersion: '1',
                settings: {},
                entities: [
                    {
                        id: 'entity-1',
                        name: 'Camera',
                        parentId: null,
                        enabled: true,
                        components: {},
                        children: []
                    }
                ]
            }
        })

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'scenes',
                documentId: '456',
                data: {
                    settings: {},
                    entities: {
                        'entity-1': {
                            resource_id: 'entity-1',
                            name: 'Camera',
                            parent: null,
                            enabled: true,
                            components: {},
                            children: []
                        }
                    }
                },
                version: 2,
                checksum: 'b'.repeat(64),
                revision: '1'
            })
        ).resolves.toEqual({ checksum: 'c'.repeat(64) })
    })

    it('retries realtime scene persistence after transient metadata update failures with a fresh checksum', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const sceneBefore = {
            id: SCENE_ID,
            projectId: PROJECT_ID,
            codename: createLocalizedContent('en', 'main_scene'),
            displayName: createLocalizedContent('en', 'Main Scene'),
            payloadSchemaVersion: '1',
            payloadFile: null,
            checksum: 'b'.repeat(64),
            sortOrder: 0,
            publish: true,
            version: 2
        }
        const sceneAfterTransientFailure = {
            ...sceneBefore,
            checksum: 'c'.repeat(64),
            version: 3
        }
        const savedScene = {
            ...sceneAfterTransientFailure,
            checksum: 'd'.repeat(64),
            version: 4
        }
        const requestedSceneData = {
            settings: {},
            entities: {
                'entity-1': {
                    resource_id: 'entity-1',
                    name: 'Camera',
                    parent: null,
                    enabled: true,
                    components: {},
                    children: []
                }
            }
        }
        const readEditorScene = jest
            .spyOn(service, 'readEditorScene')
            .mockResolvedValueOnce({
                scene: sceneBefore,
                payload: { schemaVersion: '1', settings: {}, entities: [] },
                checksum: sceneBefore.checksum
            })
            .mockResolvedValueOnce({
                scene: sceneAfterTransientFailure,
                payload: { schemaVersion: '1', settings: {}, entities: [] },
                checksum: sceneAfterTransientFailure.checksum
            })
        const saveEditorCompatibilityScene = jest
            .spyOn(service, 'saveEditorCompatibilityScene')
            .mockRejectedValueOnce(
                new MetahubValidationError('PlayCanvas project file metadata reference was not updated', {
                    messageCode: 'playcanvas.files.metadataUpdateFailed',
                    projectId: PROJECT_ID,
                    sourcePath: `playcanvas-projects/${PROJECT_ID}/scenes/${SCENE_ID}.json`
                })
            )
            .mockResolvedValueOnce({
                scene: savedScene,
                payload: null,
                checksum: savedScene.checksum
            })

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'scenes',
                documentId: '456',
                data: requestedSceneData,
                version: 2,
                checksum: sceneBefore.checksum,
                revision: '1'
            })
        ).resolves.toEqual({ checksum: savedScene.checksum })

        expect(readEditorScene).toHaveBeenCalledTimes(2)
        expect(saveEditorCompatibilityScene).toHaveBeenCalledTimes(2)
        expect(saveEditorCompatibilityScene.mock.calls[0]?.[3]).toEqual(
            expect.objectContaining({
                expectedCurrentChecksum: sceneBefore.checksum
            })
        )
        expect(saveEditorCompatibilityScene.mock.calls[1]?.[3]).toEqual(
            expect.objectContaining({
                expectedCurrentChecksum: sceneAfterTransientFailure.checksum
            })
        )
    })

    it('persists realtime settings with document-level revision instead of project row version', async () => {
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 7
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: params?.[2],
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 8
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'settings',
                documentId: 'project_123',
                data: {
                    id: 'project_123',
                    project: 123,
                    scripts: [],
                    useLegacyScripts: false,
                    engineV2: true,
                    width: 1280,
                    height: 720
                },
                version: 2,
                revision: '0'
            })
        ).resolves.toEqual({ revision: '2' })

        const updateCall = jest.mocked(exec.query).mock.calls.find((call) => String(call[0]).includes('UPDATE'))
        const nextSettings = updateCall?.[1]?.[2] as {
            playCanvasEditorRealtime?: {
                documents?: Record<string, { version?: number }>
            }
        }
        expect(nextSettings.playCanvasEditorRealtime?.documents?.project_123?.version).toBe(2)
    })

    it('treats stale realtime settings snapshots as no-ops when a newer document version is already stored', async () => {
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {
                                playCanvasEditorRealtime: {
                                    documents: {
                                        project_123: {
                                            data: { id: 'project_123', project: 123, scripts: [] },
                                            version: 3
                                        }
                                    }
                                }
                            },
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 9
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'settings',
                documentId: 'project_123',
                data: { id: 'project_123', project: 123, scripts: [] },
                version: 2,
                revision: '1'
            })
        ).resolves.toEqual({ revision: '3' })

        expect(jest.mocked(exec.query).mock.calls.some((call) => String(call[0]).includes('UPDATE'))).toBe(false)
    })

    it('rejects stale realtime settings snapshots when durable settings diverged', async () => {
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {
                                playCanvasEditorRealtime: {
                                    documents: {
                                        project_123: {
                                            data: { id: 'project_123', project: 123, scripts: [], width: 1280 },
                                            version: 3
                                        }
                                    }
                                }
                            },
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 9
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.persistEditorRealtimeDocument({
                metahubId: 'metahub-1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                userId: 'user-2',
                collection: 'settings',
                documentId: 'project_123',
                data: { id: 'project_123', project: 123, scripts: [], width: 640 },
                version: 4,
                revision: '1'
            })
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.editorRealtime.settingsRevisionMismatch' })
        })

        expect(jest.mocked(exec.query).mock.calls.some((call) => String(call[0]).includes('UPDATE'))).toBe(false)
    })

    it('replays compatibility settings writes by request id without mutating project settings twice', async () => {
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 7
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: params?.[2],
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 8
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const response = {
            kind: 'projectUser' as const,
            documentId: `project_${PROJECT_ID}_user-2`,
            data: { grid: { snap: true } },
            revision: 'project-8'
        }
        const claimReplay = jest
            .spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay')
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false)
        const completeReplay = jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'completeReplay').mockResolvedValue(true)
        const readReplayResponse = jest
            .spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'readReplayResponse')
            .mockResolvedValue({ status: 'completed', response })
        const releaseReplay = jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'releaseReplay').mockResolvedValue(undefined)
        const input = {
            requestId: '019e9147-27e7-7ad4-b4e4-02174d3bcfad',
            expectedRevision: 'project-7',
            data: { grid: { snap: true } }
        }

        await expect(service.writeEditorCompatibilitySettings('metahub-1', PROJECT_ID, 'projectUser', input, 'user-2')).resolves.toEqual(
            response
        )
        await expect(service.writeEditorCompatibilitySettings('metahub-1', PROJECT_ID, 'projectUser', input, 'user-2')).resolves.toEqual(
            response
        )

        expect(jest.mocked(exec.query).mock.calls.filter((call) => String(call[0]).includes('UPDATE')).length).toBe(1)
        expect(completeReplay).toHaveBeenCalledTimes(1)
        expect(readReplayResponse).toHaveBeenCalledTimes(1)
        expect(releaseReplay).not.toHaveBeenCalled()
        expect(claimReplay).toHaveBeenNthCalledWith(
            1,
            exec,
            TEST_SCHEMA,
            expect.objectContaining({
                sessionId: `compatibility:metahub-1:${PROJECT_ID}:settings:projectUser:user-2`,
                requestId: input.requestId,
                commandType: 'compatibility.settings.write'
            })
        )
    })

    it('rejects compatibility settings replay when the same request id has a different fingerprint', async () => {
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 7
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects')) {
                    return [{ id: PROJECT_ID, settings: params?.[2], version: 8 }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay').mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'completeReplay').mockResolvedValue(true)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'readReplayResponse').mockResolvedValue(null)
        const input = {
            requestId: '019e9147-27e7-7ad4-b4e4-02174d3bcfad',
            expectedRevision: 'project-7',
            data: { grid: { snap: true } }
        }

        await expect(
            service.writeEditorCompatibilitySettings('metahub-1', PROJECT_ID, 'projectUser', input, 'user-2')
        ).resolves.toMatchObject({
            revision: 'project-8'
        })
        await expect(
            service.writeEditorCompatibilitySettings(
                'metahub-1',
                PROJECT_ID,
                'projectUser',
                { ...input, data: { grid: { snap: false } } },
                'user-2'
            )
        ).rejects.toMatchObject({ details: expect.objectContaining({ messageCode: 'playcanvas.editorCompatibility.replayRejected' }) })

        expect(jest.mocked(exec.query).mock.calls.filter((call) => String(call[0]).includes('UPDATE')).length).toBe(1)
    })

    it('keeps compatibility settings replay claims after committed writes when replay response persistence fails', async () => {
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 7
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: params?.[2],
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 8
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay').mockResolvedValue(true)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'completeReplay').mockResolvedValue(false)
        const releaseReplay = jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'releaseReplay').mockResolvedValue(undefined)

        await expect(
            service.writeEditorCompatibilitySettings(
                'metahub-1',
                PROJECT_ID,
                'projectUser',
                {
                    requestId: '019e9147-27e7-7ad4-b4e4-02174d3bcfad',
                    expectedRevision: 'project-7',
                    data: { grid: { snap: true } }
                },
                'user-2'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.editorCompatibility.replayCompletionFailed' })
        })

        expect(releaseReplay).not.toHaveBeenCalled()
    })

    it('replays compatibility scene saves by request id without mutating the scene twice', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const sceneSaveResult = {
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'main_scene'),
                displayName: createLocalizedContent('en', 'Main Scene'),
                payloadSchemaVersion: '1',
                payloadFile: null,
                checksum: 'b'.repeat(64),
                sortOrder: 0,
                publish: true,
                version: 2
            },
            payload: { schemaVersion: '1', entities: [{ id: 'entity-1', name: 'Entity' }] },
            checksum: 'b'.repeat(64)
        }
        const saveEditorScene = jest.spyOn(service, 'saveEditorScene').mockResolvedValue({
            scene: sceneSaveResult.scene,
            checksum: sceneSaveResult.checksum
        })
        jest.spyOn(service, 'readEditorScene').mockResolvedValue({
            scene: sceneSaveResult.scene,
            payload: sceneSaveResult.payload
        })
        const claimReplay = jest
            .spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay')
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false)
        const completeReplay = jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'completeReplay').mockResolvedValue(true)
        const readReplayResponse = jest
            .spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'readReplayResponse')
            .mockResolvedValue({ status: 'completed', response: sceneSaveResult })
        const releaseReplay = jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'releaseReplay').mockResolvedValue(undefined)
        const input = {
            requestId: '019e9147-27e7-7ad4-b4e4-02174d3bcfad',
            expectedCurrentChecksum: 'a'.repeat(64),
            payload: sceneSaveResult.payload
        }

        await expect(service.saveEditorCompatibilityScene('metahub-1', PROJECT_ID, SCENE_ID, input, 'user-1')).resolves.toEqual(
            sceneSaveResult
        )
        await expect(service.saveEditorCompatibilityScene('metahub-1', PROJECT_ID, SCENE_ID, input, 'user-1')).resolves.toEqual(
            sceneSaveResult
        )

        expect(saveEditorScene).toHaveBeenCalledTimes(1)
        expect(completeReplay).toHaveBeenCalledTimes(1)
        expect(readReplayResponse).toHaveBeenCalledTimes(1)
        expect(releaseReplay).not.toHaveBeenCalled()
        expect(claimReplay).toHaveBeenNthCalledWith(
            1,
            exec,
            TEST_SCHEMA,
            expect.objectContaining({
                sessionId: `compatibility:metahub-1:${PROJECT_ID}:${SCENE_ID}:user-1`,
                requestId: input.requestId,
                commandType: 'compatibility.scene.save'
            })
        )
    })

    it('synthesizes MMOOMM runtime metadata when saving direct compatibility scene payloads', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const scene = {
            id: SCENE_ID,
            projectId: PROJECT_ID,
            codename: createLocalizedContent('en', 'main_scene'),
            displayName: createLocalizedContent('en', 'Main Scene'),
            payloadSchemaVersion: '1',
            payloadFile: null,
            checksum: 'b'.repeat(64),
            sortOrder: 0,
            publish: true,
            version: 2
        }
        let persistedPayload: unknown
        const saveEditorScene = jest
            .spyOn(service, 'saveEditorScene')
            .mockImplementation(async (_metahubId, _projectId, _sceneId, input) => {
                persistedPayload = input.payload
                return {
                    scene,
                    checksum: 'b'.repeat(64)
                }
            })
        jest.spyOn(service, 'readEditorScene').mockImplementation(async () => ({
            scene,
            payload: persistedPayload as never
        }))
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay').mockResolvedValue(true)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'completeReplay').mockResolvedValue(true)

        await expect(
            service.saveEditorCompatibilityScene(
                'metahub-1',
                PROJECT_ID,
                SCENE_ID,
                {
                    requestId: '019e9147-27e7-7ad4-b4e4-02174d3bcfad',
                    expectedCurrentChecksum: 'a'.repeat(64),
                    payload: {
                        schemaVersion: '1',
                        settings: {},
                        metadata: { customMarker: true },
                        entities: [
                            {
                                id: 'root',
                                name: 'Root',
                                parentId: null,
                                enabled: true,
                                components: {},
                                children: ['stable-ship', 'stable-station']
                            },
                            {
                                id: 'stable-ship',
                                name: 'MMOOMM Ship',
                                parentId: 'root',
                                enabled: true,
                                position: [0, 0, 0],
                                rotation: [0, 0, 0],
                                scale: [12, 4, 4],
                                components: { render: { enabled: true, type: 'box' } },
                                children: []
                            },
                            {
                                id: 'stable-station',
                                name: 'MMOOMM Station',
                                parentId: 'root',
                                enabled: true,
                                position: [72, 0, -48],
                                rotation: [0, 0, 0],
                                scale: [48, 16, 16],
                                components: { render: { enabled: true, type: 'box' } },
                                children: []
                            }
                        ]
                    }
                },
                'user-1'
            )
        ).resolves.toMatchObject({ checksum: 'b'.repeat(64) })

        const payload = saveEditorScene.mock.calls[0]?.[3].payload
        expect(payload.metadata).toEqual(expect.objectContaining({ customMarker: true }))
        expect(payload.metadata?.mmoomm?.scene).toEqual(
            expect.objectContaining({
                controlledObjectId: 'stable-ship',
                targetObjectId: 'stable-station',
                cruiseSpeed: 36,
                intentDistance: 720,
                objects: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'stable-ship',
                        position: { x: 0, y: 0, z: 0 },
                        scale: { x: 12, y: 4, z: 4 },
                        selectable: true
                    }),
                    expect.objectContaining({
                        id: 'stable-station',
                        position: { x: 72, y: 0, z: -48 },
                        scale: { x: 48, y: 16, z: 16 },
                        selectable: true,
                        guard: true
                    })
                ])
            })
        )
        expect(payload.metadata?.mmoomm?.provenance).toEqual(expect.objectContaining({ authoringFlow: 'playcanvas-editor-native-scene' }))
    })

    it('removes stale MMOOMM runtime metadata when a required renderable entity is disabled', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const scene = {
            id: SCENE_ID,
            projectId: PROJECT_ID,
            codename: createLocalizedContent('en', 'main_scene'),
            displayName: createLocalizedContent('en', 'Main Scene'),
            payloadSchemaVersion: '1',
            payloadFile: null,
            checksum: 'b'.repeat(64),
            sortOrder: 0,
            publish: true,
            version: 2
        }
        let persistedPayload: PlayCanvasEditorScenePayload | null = null
        jest.spyOn(service, 'saveEditorScene').mockImplementation(async (_metahubId, _projectId, _sceneId, input) => {
            persistedPayload = input.payload
            return { scene, checksum: 'b'.repeat(64) }
        })
        jest.spyOn(service, 'readEditorScene').mockImplementation(async () => ({ scene, payload: persistedPayload }))
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay').mockResolvedValue(true)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'completeReplay').mockResolvedValue(true)

        await service.saveEditorCompatibilityScene(
            'metahub-1',
            PROJECT_ID,
            SCENE_ID,
            {
                requestId: '019e9147-27e7-7ad4-b4e4-02174d3bcfad',
                expectedCurrentChecksum: 'a'.repeat(64),
                payload: {
                    schemaVersion: '1',
                    settings: {},
                    metadata: {
                        customMarker: true,
                        mmoomm: {
                            scene: {
                                controlledObjectId: 'stable-ship',
                                targetObjectId: 'stable-station',
                                objects: [{ id: 'stable-ship' }, { id: 'stable-station' }]
                            },
                            provenance: { authoringFlow: 'playcanvas-editor-native-scene' }
                        }
                    },
                    entities: [
                        {
                            id: 'stable-ship',
                            name: 'MMOOMM Ship',
                            enabled: false,
                            components: { render: { enabled: true, type: 'box' } }
                        },
                        {
                            id: 'stable-station',
                            name: 'MMOOMM Station',
                            enabled: true,
                            components: { render: { enabled: true, type: 'box' } }
                        }
                    ]
                }
            },
            'user-1'
        )

        expect(persistedPayload?.metadata).toEqual({ customMarker: true })
    })

    it('synthesizes MMOOMM runtime metadata when saving through the bridge scene path', async () => {
        const payloadPath = `playcanvas-projects/${PROJECT_ID}/scenes/${SCENE_ID}.json`
        let sceneSelectCount = 0
        const fileService = {
            buildDefaultScenePath: jest.fn(() => payloadPath),
            stat: jest.fn(async () => ({ exists: false })),
            write: jest.fn(async () => ({
                sourcePath: payloadPath,
                checksum: 'b'.repeat(64),
                size: 42,
                mime: 'application/json'
            })),
            read: jest.fn(),
            deleteIfCurrentChecksum: jest.fn()
        }
        const scene = {
            id: SCENE_ID,
            projectId: PROJECT_ID,
            codename: createLocalizedContent('en', 'main_scene'),
            displayName: createLocalizedContent('en', 'Main Scene'),
            payloadSchemaVersion: '1',
            payload: null,
            payloadFile: {
                provider: 'local',
                root: 'playcanvas-projects',
                path: payloadPath,
                mime: 'application/json',
                hash: 'b'.repeat(64),
                size: 42,
                status: 'ready'
            },
            checksum: 'b'.repeat(64),
            sortOrder: 0,
            publish: true,
            version: 2
        }
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_scenes')) {
                    sceneSelectCount += 1
                    return sceneSelectCount === 1 ? [] : [scene]
                }
                if (sql.includes('INSERT INTO') && sql.includes('_mhb_playcanvas_scenes')) {
                    return [{ ...scene, payloadFile: { ...scene.payloadFile, status: 'missing' }, checksum: null, version: 1 }]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_scenes') && sql.includes("status = 'ready'")) {
                    return [{ id: SCENE_ID }]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_generated_artifacts')) {
                    return []
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles')) {
                    return []
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(
            service.saveEditorScene(
                'metahub-1',
                PROJECT_ID,
                SCENE_ID,
                {
                    expectedCurrentChecksum: null,
                    payload: {
                        schemaVersion: '1',
                        settings: {},
                        metadata: { savedBy: 'universo-playcanvas-editor-bridge' },
                        entities: [
                            {
                                id: 'stable-ship',
                                name: 'MMOOMM Ship',
                                enabled: true,
                                position: [18, 3, -9],
                                scale: [12, 4, 4],
                                components: { render: { enabled: true, type: 'box' } }
                            },
                            {
                                id: 'stable-station',
                                name: 'MMOOMM Station',
                                enabled: true,
                                position: [72, 0, -48],
                                scale: [48, 16, 16],
                                components: { render: { enabled: true, type: 'box' } }
                            }
                        ]
                    }
                },
                'user-1'
            )
        ).resolves.toEqual({ scene, checksum: 'b'.repeat(64) })

        const writtenPayload = JSON.parse(String(fileService.write.mock.calls[0]?.[2])) as {
            metadata?: { mmoomm?: { scene?: Record<string, unknown> } }
        }
        expect(writtenPayload.metadata?.mmoomm?.scene).toEqual(
            expect.objectContaining({
                controlledObjectId: 'stable-ship',
                targetObjectId: 'stable-station',
                objects: expect.arrayContaining([
                    expect.objectContaining({ id: 'stable-ship', position: { x: 18, y: 3, z: -9 } }),
                    expect.objectContaining({ id: 'stable-station', position: { x: 72, y: 0, z: -48 } })
                ])
            })
        )
    })

    it('rejects compatibility scene save replay when the same request id has a different fingerprint', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const saveEditorScene = jest.spyOn(service, 'saveEditorScene').mockResolvedValue({
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'main_scene'),
                displayName: createLocalizedContent('en', 'Main Scene'),
                payloadSchemaVersion: '1',
                payloadFile: null,
                checksum: 'b'.repeat(64),
                sortOrder: 0,
                publish: true,
                version: 2
            },
            checksum: 'b'.repeat(64)
        })
        jest.spyOn(service, 'readEditorScene').mockResolvedValue({
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'main_scene'),
                displayName: createLocalizedContent('en', 'Main Scene'),
                payloadSchemaVersion: '1',
                payloadFile: null,
                checksum: 'b'.repeat(64),
                sortOrder: 0,
                publish: true,
                version: 2
            },
            payload: { schemaVersion: '1', entities: [{ id: 'entity-1', name: 'Entity' }] }
        })
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay').mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'completeReplay').mockResolvedValue(true)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'readReplayResponse').mockResolvedValue(null)
        const input = {
            requestId: '019e9147-27e7-7ad4-b4e4-02174d3bcfad',
            expectedCurrentChecksum: 'a'.repeat(64),
            payload: { schemaVersion: '1', entities: [{ id: 'entity-1', name: 'Entity' }] }
        }

        await expect(service.saveEditorCompatibilityScene('metahub-1', PROJECT_ID, SCENE_ID, input, 'user-1')).resolves.toMatchObject({
            checksum: 'b'.repeat(64)
        })
        await expect(
            service.saveEditorCompatibilityScene(
                'metahub-1',
                PROJECT_ID,
                SCENE_ID,
                { ...input, payload: { schemaVersion: '1', entities: [{ id: 'entity-2', name: 'Entity 2' }] } },
                'user-1'
            )
        ).rejects.toMatchObject({ details: expect.objectContaining({ messageCode: 'playcanvas.editorCompatibility.replayRejected' }) })

        expect(saveEditorScene).toHaveBeenCalledTimes(1)
    })

    it('keeps compatibility scene save replay claims after committed saves when replay response persistence fails', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)
        const sceneSaveResult = {
            scene: {
                id: SCENE_ID,
                projectId: PROJECT_ID,
                codename: createLocalizedContent('en', 'main_scene'),
                displayName: createLocalizedContent('en', 'Main Scene'),
                payloadSchemaVersion: '1',
                payloadFile: null,
                checksum: 'b'.repeat(64),
                sortOrder: 0,
                publish: true,
                version: 2
            },
            payload: { schemaVersion: '1', entities: [{ id: 'entity-1', name: 'Entity' }] },
            checksum: 'b'.repeat(64)
        }
        jest.spyOn(service, 'saveEditorScene').mockResolvedValue({
            scene: sceneSaveResult.scene,
            checksum: sceneSaveResult.checksum
        })
        jest.spyOn(service, 'readEditorScene').mockResolvedValue({
            scene: sceneSaveResult.scene,
            payload: sceneSaveResult.payload
        })
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay').mockResolvedValue(true)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'completeReplay').mockResolvedValue(false)
        const releaseReplay = jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'releaseReplay').mockResolvedValue(undefined)

        await expect(
            service.saveEditorCompatibilityScene(
                'metahub-1',
                PROJECT_ID,
                SCENE_ID,
                {
                    requestId: '019e9147-27e7-7ad4-b4e4-02174d3bcfad',
                    expectedCurrentChecksum: 'a'.repeat(64),
                    payload: sceneSaveResult.payload
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.editorCompatibility.replayCompletionFailed' })
        })

        expect(releaseReplay).not.toHaveBeenCalled()
    })

    it('adds a suffix to auto-generated project codenames when the display name repeats', async () => {
        const exec = {
            query: jest.fn(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('AS codename') && sql.includes('_mhb_playcanvas_projects')) {
                    expect(_params?.[0]).toBe('flight_deck')
                    return [{ codename: 'flight_deck' }]
                }
                if (sql.includes('INSERT INTO') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: _params?.[0],
                            displayName: _params?.[1],
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('INSERT INTO') && sql.includes('_mhb_playcanvas_scenes')) {
                    return [
                        {
                            id: _params?.[0],
                            projectId: PROJECT_ID,
                            codename: _params?.[2],
                            displayName: _params?.[3],
                            payloadSchemaVersion: _params?.[4],
                            payload: JSON.parse(String(_params?.[5])),
                            payloadFile: null,
                            checksum: null,
                            sortOrder: 0,
                            publish: true,
                            version: 1
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'flight_deck-2'),
                            displayName: createLocalizedContent('en', 'Flight Deck'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: _params?.[2],
                            publicationConfig: {},
                            version: 2
                        }
                    ]
                }
                if (sql.includes('COUNT(*)::text')) {
                    return [{ sceneCount: '1', assetCount: '0', scriptCount: '0', generatedArtifactCount: '0', blockingCount: '0' }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            }),
            transaction: jest.fn(async function (this: DbExecutor, callback: (executor: DbExecutor) => Promise<unknown>) {
                return callback(this)
            }),
            isReleased: jest.fn(() => false)
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.createProject(
                'metahub-1',
                {
                    displayName: createLocalizedContent('en', 'Flight Deck'),
                    description: null,
                    packageVersion: '0.1.0'
                },
                'user-1'
            )
        ).resolves.toMatchObject({ id: PROJECT_ID })
        expect(exec.transaction).toHaveBeenCalledTimes(1)

        const insertCodename = jest.mocked(exec.query).mock.calls.find((call) => String(call[0]).includes('INSERT INTO'))?.[1]?.[0] as
            | { locales?: { en?: { content?: string } } }
            | undefined
        expect(insertCodename?.locales?.en?.content).toBe('flight_deck-2')
    })

    it('rejects a default scene that is not part of the project before updating project settings', async () => {
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('_mhb_playcanvas_scenes')) {
                    return []
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.updateProjectSettings(
                'metahub-1',
                PROJECT_ID,
                {
                    defaultSceneId: SCENE_ID,
                    expectedVersion: 1
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            message: 'PlayCanvas default scene was not found',
            details: {
                messageCode: 'playcanvas.project.defaultSceneNotFound',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID
            }
        })

        expect(exec.query).toHaveBeenCalledTimes(1)
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('_mhb_playcanvas_scenes')
    })

    it('requires optimistic versioning for public project settings updates', async () => {
        const exec = {
            query: jest.fn(async () => {
                throw new Error('Project settings update should fail before SQL execution')
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.updateProjectSettings(
                'metahub-1',
                PROJECT_ID,
                {
                    settings: { cameraClearColor: [0.1, 0.1, 0.1, 1] }
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.project.settingsExpectedVersionRequired' })
        })
        expect(exec.query).not.toHaveBeenCalled()
    })

    it('rejects public updates to reserved realtime project settings', async () => {
        const exec = {
            query: jest.fn(async () => {
                throw new Error('Reserved settings update should fail before SQL execution')
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.updateProjectSettings(
                'metahub-1',
                PROJECT_ID,
                {
                    expectedVersion: 7,
                    settings: {
                        playCanvasEditorRealtime: {
                            userDataDocumentsByScene: {
                                [SCENE_ID]: {
                                    'user-2': { data: { cameras: {} }, version: 1 }
                                }
                            }
                        }
                    }
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({
                messageCode: 'playcanvas.project.settingsReservedKey',
                settingsKey: 'playCanvasEditorRealtime'
            })
        })
        expect(exec.query).not.toHaveBeenCalled()
    })

    it('preserves reserved realtime project settings during normal public settings updates', async () => {
        const realtimeSettings = {
            documents: {
                project_123: { data: { useLegacyScripts: false }, version: 2 }
            },
            userDataDocumentsByScene: {
                [SCENE_ID]: {
                    'user-2': { data: { cameras: { perspective: { position: [1, 2, 3] } } }, version: 4 }
                }
            }
        }
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: { playCanvasEditorRealtime: realtimeSettings },
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 7
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: params?.[2],
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 8
                        }
                    ]
                }
                if (sql.includes('COUNT(*)::text')) {
                    return [{ sceneCount: '0', assetCount: '0', scriptCount: '0', generatedArtifactCount: '0', blockingCount: '0' }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.updateProjectSettings(
                'metahub-1',
                PROJECT_ID,
                {
                    expectedVersion: 7,
                    settings: { cameraClearColor: [0.1, 0.1, 0.1, 1] }
                },
                'user-1'
            )
        ).resolves.toMatchObject({ id: PROJECT_ID, version: 8 })

        const updateCall = jest.mocked(exec.query).mock.calls.find((call) => String(call[0]).includes('UPDATE'))
        expect(updateCall?.[1]?.[2]).toEqual({
            cameraClearColor: [0.1, 0.1, 0.1, 1],
            playCanvasEditorRealtime: realtimeSettings
        })
    })

    it('rejects unsafe scene metadata file references before persisting metadata', async () => {
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.writeScene(
                'metahub-1',
                PROJECT_ID,
                {
                    id: SCENE_ID,
                    codename: createLocalizedContent('en', 'scene_one'),
                    displayName: createLocalizedContent('en', 'Scene One'),
                    payloadSchemaVersion: '1',
                    payload: null,
                    payloadFile: {
                        provider: 'local',
                        root: 'playcanvas-projects',
                        path: `playcanvas-projects/${PROJECT_ID}/../evil.json`,
                        hash: null,
                        mime: 'application/json'
                    },
                    checksum: null,
                    sortOrder: 0,
                    publish: true
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.path.hiddenOrParentSegment' })
        })

        expect(exec.query).toHaveBeenCalledTimes(1)
    })

    it('prepares editor scene metadata before file writes and rolls it back when the guarded payload file write fails', async () => {
        const payloadPath = `playcanvas-projects/${PROJECT_ID}/scenes/${SCENE_ID}.json`
        const fileService = {
            buildDefaultScenePath: jest.fn(() => payloadPath),
            stat: jest.fn(async () => ({ exists: false })),
            write: jest.fn(async () => {
                throw new Error('checksum conflict')
            }),
            read: jest.fn(),
            deleteIfCurrentChecksum: jest.fn()
        }
        const exec = {
            query: jest.fn(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_scenes')) {
                    return []
                }
                if (sql.includes('INSERT INTO') && sql.includes('_mhb_playcanvas_scenes')) {
                    return [
                        {
                            id: SCENE_ID,
                            projectId: PROJECT_ID,
                            codename: createLocalizedContent('en', `scene-${SCENE_ID.slice(0, 8)}`),
                            displayName: createLocalizedContent('en', 'PlayCanvas Scene'),
                            payloadSchemaVersion: '1',
                            payload: null,
                            payloadFile: {
                                provider: 'local',
                                root: 'playcanvas-projects',
                                path: payloadPath,
                                mime: 'application/json',
                                hash: null,
                                size: null,
                                status: 'missing'
                            },
                            checksum: null,
                            sortOrder: 0,
                            publish: true,
                            version: 1
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_scenes') && sql.includes('_upl_deleted = true')) {
                    return [{ id: SCENE_ID }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(
            service.saveEditorScene(
                'metahub-1',
                PROJECT_ID,
                SCENE_ID,
                {
                    expectedCurrentChecksum: null,
                    payload: {
                        schemaVersion: '1',
                        entities: []
                    }
                },
                'user-1'
            )
        ).rejects.toThrow('checksum conflict')

        expect(fileService.write).toHaveBeenCalledTimes(1)
        expect(fileService.deleteIfCurrentChecksum).not.toHaveBeenCalled()
        expect(jest.mocked(exec.query).mock.calls.some((call) => String(call[0]).includes('INSERT INTO'))).toBe(true)
        expect(jest.mocked(exec.query).mock.calls.some((call) => String(call[0]).includes('_upl_deleted = true'))).toBe(true)
    })

    it('rolls back an editor scene payload file when final ready metadata cannot be persisted', async () => {
        const payloadPath = `playcanvas-projects/${PROJECT_ID}/scenes/${SCENE_ID}.json`
        const fileService = {
            buildDefaultScenePath: jest.fn(() => payloadPath),
            stat: jest.fn(async () => ({ exists: false })),
            write: jest.fn(async () => ({
                sourcePath: payloadPath,
                checksum: 'a'.repeat(64),
                size: 42,
                mime: 'application/json'
            })),
            read: jest.fn(),
            deleteIfCurrentChecksum: jest.fn(async () => true)
        }
        const exec = {
            query: jest.fn(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_scenes')) {
                    return []
                }
                if (sql.includes('INSERT INTO') && sql.includes('_mhb_playcanvas_scenes')) {
                    return [
                        {
                            id: SCENE_ID,
                            projectId: PROJECT_ID,
                            codename: createLocalizedContent('en', `scene-${SCENE_ID.slice(0, 8)}`),
                            displayName: createLocalizedContent('en', 'PlayCanvas Scene'),
                            payloadSchemaVersion: '1',
                            payload: null,
                            payloadFile: {
                                provider: 'local',
                                root: 'playcanvas-projects',
                                path: payloadPath,
                                mime: 'application/json',
                                hash: null,
                                size: null,
                                status: 'missing'
                            },
                            checksum: null,
                            sortOrder: 0,
                            publish: true,
                            version: 1
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_scenes') && sql.includes("status = 'ready'")) {
                    return []
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_generated_artifacts')) {
                    return []
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles')) {
                    return []
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_scenes') && sql.includes('_upl_deleted = true')) {
                    return [{ id: SCENE_ID }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(
            service.saveEditorScene(
                'metahub-1',
                PROJECT_ID,
                SCENE_ID,
                {
                    expectedCurrentChecksum: null,
                    payload: {
                        schemaVersion: '1',
                        entities: []
                    }
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.metadataUpdateFailed' })
        })

        expect(fileService.write).toHaveBeenCalledTimes(1)
        expect(fileService.deleteIfCurrentChecksum).toHaveBeenCalledWith(
            { metahubId: 'metahub-1', branchSlug: TEST_SCHEMA },
            payloadPath,
            'a'.repeat(64)
        )
        expect(jest.mocked(exec.query).mock.calls.some((call) => String(call[0]).includes('_upl_deleted = true'))).toBe(true)
    })

    it('rejects malformed existing editor scene payload file metadata before file writes', async () => {
        const payloadPath = `playcanvas-projects/${PROJECT_ID}/assets/not-a-scene.json`
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_scenes')) {
                    return [
                        {
                            id: SCENE_ID,
                            projectId: PROJECT_ID,
                            codename: createLocalizedContent('en', 'scene_one'),
                            displayName: createLocalizedContent('en', 'Scene One'),
                            payloadSchemaVersion: '1',
                            payload: null,
                            payloadFile: {
                                provider: 'local',
                                root: 'playcanvas-projects',
                                path: payloadPath,
                                mime: 'application/json',
                                hash: null,
                                size: null,
                                status: 'ready'
                            },
                            checksum: null,
                            sortOrder: 0,
                            publish: true,
                            version: 3
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            buildDefaultScenePath: jest.fn(),
            stat: jest.fn(),
            write: jest.fn(),
            deleteIfCurrentChecksum: jest.fn()
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(
            service.saveEditorScene(
                'metahub-1',
                PROJECT_ID,
                SCENE_ID,
                {
                    expectedCurrentChecksum: null,
                    payload: {
                        schemaVersion: '1',
                        entities: []
                    }
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.role.scenesPathMismatch' })
        })

        expect(fileService.stat).not.toHaveBeenCalled()
        expect(fileService.write).not.toHaveBeenCalled()
        expect(fileService.deleteIfCurrentChecksum).not.toHaveBeenCalled()
    })

    it('rejects existing editor scene payload paths owned by another scene before file writes', async () => {
        const otherSceneId = '019e8afa-0000-7000-8000-000000000099'
        const payloadPath = `playcanvas-projects/${PROJECT_ID}/scenes/${otherSceneId}.json`
        const defaultPayloadPath = `playcanvas-projects/${PROJECT_ID}/scenes/${SCENE_ID}.json`
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_scenes')) {
                    return [
                        {
                            id: SCENE_ID,
                            projectId: PROJECT_ID,
                            codename: createLocalizedContent('en', 'scene_one'),
                            displayName: createLocalizedContent('en', 'Scene One'),
                            payloadSchemaVersion: '1',
                            payload: null,
                            payloadFile: {
                                provider: 'local',
                                root: 'playcanvas-projects',
                                path: payloadPath,
                                mime: 'application/json',
                                hash: null,
                                size: null,
                                status: 'ready'
                            },
                            checksum: null,
                            sortOrder: 0,
                            publish: true,
                            version: 3
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            buildDefaultScenePath: jest.fn(() => defaultPayloadPath),
            stat: jest.fn(),
            write: jest.fn(),
            deleteIfCurrentChecksum: jest.fn()
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(
            service.saveEditorScene(
                'metahub-1',
                PROJECT_ID,
                SCENE_ID,
                {
                    expectedCurrentChecksum: null,
                    payload: {
                        schemaVersion: '1',
                        entities: []
                    }
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.editor.scenePayloadPathMismatch' })
        })

        expect(fileService.buildDefaultScenePath).toHaveBeenCalledWith(PROJECT_ID, SCENE_ID)
        expect(fileService.stat).not.toHaveBeenCalled()
        expect(fileService.write).not.toHaveBeenCalled()
        expect(fileService.deleteIfCurrentChecksum).not.toHaveBeenCalled()
    })

    it('rejects scene payload metadata file references that are not JSON before persisting metadata', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.writeScene(
                'metahub-1',
                PROJECT_ID,
                {
                    id: SCENE_ID,
                    codename: createLocalizedContent('en', 'scene_one'),
                    displayName: createLocalizedContent('en', 'Scene One'),
                    payloadSchemaVersion: '1',
                    payload: null,
                    payloadFile: {
                        provider: 'local',
                        root: 'playcanvas-projects',
                        path: `playcanvas-projects/${PROJECT_ID}/scenes/scene-one.mjs`,
                        hash: null,
                        mime: 'text/javascript'
                    },
                    checksum: null,
                    sortOrder: 0,
                    publish: true
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.role.scenePayloadMismatch' })
        })

        expect(exec.query).toHaveBeenCalledTimes(1)
    })

    it('rejects scene payload metadata file references outside the scenes directory', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.writeScene(
                'metahub-1',
                PROJECT_ID,
                {
                    id: SCENE_ID,
                    codename: createLocalizedContent('en', 'scene_one'),
                    displayName: createLocalizedContent('en', 'Scene One'),
                    payloadSchemaVersion: '1',
                    payload: null,
                    payloadFile: {
                        provider: 'local',
                        root: 'playcanvas-projects',
                        path: `playcanvas-projects/${PROJECT_ID}/assets/scene-one.json`,
                        hash: null,
                        mime: 'application/json'
                    },
                    checksum: null,
                    sortOrder: 0,
                    publish: true
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.role.scenesPathMismatch' })
        })

        expect(exec.query).toHaveBeenCalledTimes(1)
    })

    it('rejects script asset metadata file references that are not JavaScript before persisting metadata', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.writeAssetMetadata(
                'metahub-1',
                PROJECT_ID,
                {
                    id: ASSET_ID,
                    stableAssetId: 'flight_controller',
                    type: 'script',
                    name: 'Flight Controller',
                    virtualPath: ['scripts', 'flight-controller.json'],
                    file: {
                        provider: 'local',
                        root: 'playcanvas-projects',
                        path: `playcanvas-projects/${PROJECT_ID}/assets/flight-controller.json`,
                        hash: null,
                        mime: 'application/json'
                    },
                    metadata: {},
                    publish: true
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.role.assetScriptMismatch' })
        })

        expect(exec.query).toHaveBeenCalledTimes(1)
    })

    it('rejects asset metadata file references outside the assets directory', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.writeAssetMetadata(
                'metahub-1',
                PROJECT_ID,
                {
                    id: ASSET_ID,
                    stableAssetId: 'texture_json',
                    type: 'json',
                    name: 'Texture Metadata',
                    virtualPath: ['generated', 'texture.json'],
                    file: {
                        provider: 'local',
                        root: 'playcanvas-projects',
                        path: `playcanvas-projects/${PROJECT_ID}/generated/texture.json`,
                        hash: null,
                        mime: 'application/json'
                    },
                    metadata: {},
                    publish: true
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.role.assetsPathMismatch' })
        })

        expect(exec.query).toHaveBeenCalledTimes(1)
    })

    it('rejects generated artifact metadata file references that are not JavaScript before persisting metadata', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.upsertGeneratedArtifact(
                'metahub-1',
                PROJECT_ID,
                {
                    id: '019e8afa-0000-7000-8000-000000000004',
                    scriptAssetId: '019e8afa-0000-7000-8000-000000000005',
                    sourceModuleId: null,
                    sourceModuleCodename: null,
                    sourceModulePath: null,
                    sourceChecksum: 'a'.repeat(64),
                    outputFile: {
                        provider: 'local',
                        root: 'playcanvas-projects',
                        path: `playcanvas-projects/${PROJECT_ID}/generated/flight-controller.json`,
                        hash: null,
                        mime: 'application/json'
                    },
                    scriptName: 'FlightController',
                    moduleExportName: null,
                    scriptKind: 'esm',
                    parseStatus: 'ready',
                    generatedAt: null,
                    parsedAt: null
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.role.generatedArtifactMismatch' })
        })

        expect(exec.query).toHaveBeenCalledTimes(1)
    })

    it('rejects generated artifact metadata file references outside the generated directory', async () => {
        const exec = createProjectLookupExecutor()
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.upsertGeneratedArtifact(
                'metahub-1',
                PROJECT_ID,
                {
                    id: '019e8afa-0000-7000-8000-000000000004',
                    scriptAssetId: '019e8afa-0000-7000-8000-000000000005',
                    sourceModuleId: null,
                    sourceModuleCodename: null,
                    sourceModulePath: null,
                    sourceChecksum: 'a'.repeat(64),
                    outputFile: {
                        provider: 'local',
                        root: 'playcanvas-projects',
                        path: `playcanvas-projects/${PROJECT_ID}/scenes/flight-controller.mjs`,
                        hash: null,
                        mime: 'text/javascript'
                    },
                    scriptName: 'FlightController',
                    moduleExportName: null,
                    scriptKind: 'esm',
                    parseStatus: 'ready',
                    generatedAt: null,
                    parsedAt: null
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.role.generatedPathMismatch' })
        })

        expect(exec.query).toHaveBeenCalledTimes(1)
    })

    it('rejects role-specific metadata file references without an explicit MIME class', async () => {
        const sceneExec = createProjectLookupExecutor()
        const sceneService = new PlayCanvasProjectsService(sceneExec, makeSchemaService() as never)
        await expect(
            sceneService.writeScene(
                'metahub-1',
                PROJECT_ID,
                {
                    id: SCENE_ID,
                    codename: createLocalizedContent('en', 'scene_one'),
                    displayName: createLocalizedContent('en', 'Scene One'),
                    payloadSchemaVersion: '1',
                    payload: null,
                    payloadFile: {
                        provider: 'local',
                        root: 'playcanvas-projects',
                        path: `playcanvas-projects/${PROJECT_ID}/scenes/scene-one.json`,
                        hash: null,
                        mime: null
                    },
                    checksum: null,
                    sortOrder: 0,
                    publish: true
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.role.scenePayloadMismatch' })
        })

        const assetExec = createProjectLookupExecutor()
        const assetService = new PlayCanvasProjectsService(assetExec, makeSchemaService() as never)
        await expect(
            assetService.writeAssetMetadata(
                'metahub-1',
                PROJECT_ID,
                {
                    id: ASSET_ID,
                    stableAssetId: 'flight_controller',
                    type: 'script',
                    name: 'Flight Controller',
                    virtualPath: ['scripts', 'flight-controller.mjs'],
                    file: {
                        provider: 'local',
                        root: 'playcanvas-projects',
                        path: `playcanvas-projects/${PROJECT_ID}/assets/flight-controller.mjs`,
                        hash: null,
                        mime: null
                    },
                    metadata: {},
                    publish: true
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.role.assetScriptMismatch' })
        })

        const artifactExec = createProjectLookupExecutor()
        const artifactService = new PlayCanvasProjectsService(artifactExec, makeSchemaService() as never)
        await expect(
            artifactService.upsertGeneratedArtifact(
                'metahub-1',
                PROJECT_ID,
                {
                    id: '019e8afa-0000-7000-8000-000000000004',
                    scriptAssetId: '019e8afa-0000-7000-8000-000000000005',
                    sourceModuleId: null,
                    sourceModuleCodename: null,
                    sourceModulePath: null,
                    sourceChecksum: 'a'.repeat(64),
                    outputFile: {
                        provider: 'local',
                        root: 'playcanvas-projects',
                        path: `playcanvas-projects/${PROJECT_ID}/generated/flight-controller.mjs`,
                        hash: null,
                        mime: null
                    },
                    scriptName: 'FlightController',
                    moduleExportName: null,
                    scriptKind: 'esm',
                    parseStatus: 'ready',
                    generatedAt: null,
                    parsedAt: null
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.role.generatedArtifactMismatch' })
        })

        expect(sceneExec.query).toHaveBeenCalledTimes(1)
        expect(assetExec.query).toHaveBeenCalledTimes(1)
        expect(artifactExec.query).toHaveBeenCalledTimes(1)
    })

    it('persists canonical metadata file paths after role-specific validation', async () => {
        const capturedPaths: Record<string, string | undefined> = {}
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('INSERT INTO') && sql.includes('_mhb_playcanvas_scenes')) {
                    const payloadFile = JSON.parse(params?.[6] as string)
                    capturedPaths.scene = payloadFile.path
                    return [
                        {
                            id: SCENE_ID,
                            projectId: PROJECT_ID,
                            codename: params?.[2],
                            displayName: params?.[3],
                            payloadSchemaVersion: params?.[4],
                            payload: null,
                            payloadFile,
                            checksum: null,
                            sortOrder: params?.[8],
                            publish: params?.[9],
                            version: 1
                        }
                    ]
                }
                if (
                    sql.includes('INSERT INTO') &&
                    sql.includes('_mhb_playcanvas_assets') &&
                    !sql.includes('_mhb_playcanvas_generated_artifacts')
                ) {
                    const file = JSON.parse(params?.[6] as string)
                    capturedPaths.asset = file.path
                    return [
                        {
                            id: ASSET_ID,
                            projectId: PROJECT_ID,
                            stableAssetId: params?.[2],
                            type: params?.[3],
                            name: params?.[4],
                            virtualPath: JSON.parse(params?.[5] as string),
                            file,
                            metadata: JSON.parse(params?.[11] as string),
                            publish: params?.[12],
                            version: 1
                        }
                    ]
                }
                if (sql.includes('INSERT INTO') && sql.includes('_mhb_playcanvas_generated_artifacts')) {
                    const outputFile = JSON.parse(params?.[7] as string)
                    capturedPaths.generated = outputFile.path
                    return [
                        {
                            id: params?.[0],
                            scriptAssetId: params?.[2],
                            sourceModuleId: params?.[3],
                            sourceModuleCodename: params?.[4],
                            sourceModulePath: params?.[5],
                            sourceChecksum: params?.[6],
                            outputFile,
                            scriptName: params?.[11],
                            moduleExportName: params?.[12],
                            scriptKind: params?.[13],
                            parseStatus: params?.[14],
                            generatedAt: params?.[15],
                            parsedAt: params?.[16],
                            version: 1
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await service.writeScene(
            'metahub-1',
            PROJECT_ID,
            {
                id: SCENE_ID,
                codename: createLocalizedContent('en', 'scene_one'),
                displayName: createLocalizedContent('en', 'Scene One'),
                payloadSchemaVersion: '1',
                payload: null,
                payloadFile: {
                    provider: 'local',
                    root: 'playcanvas-projects',
                    path: `playcanvas-projects/${PROJECT_ID}/scenes/scene-one.json `,
                    hash: null,
                    mime: 'application/json'
                },
                checksum: null,
                sortOrder: 0,
                publish: true
            },
            'user-1'
        )
        await service.writeAssetMetadata(
            'metahub-1',
            PROJECT_ID,
            {
                id: ASSET_ID,
                stableAssetId: 'flight_controller',
                type: 'script',
                name: 'Flight Controller',
                virtualPath: ['scripts', 'flight-controller.mjs'],
                file: {
                    provider: 'local',
                    root: 'playcanvas-projects',
                    path: `playcanvas-projects/${PROJECT_ID}/assets/flight-controller.mjs `,
                    hash: null,
                    mime: 'text/javascript'
                },
                metadata: {},
                publish: true
            },
            'user-1'
        )
        await service.upsertGeneratedArtifact(
            'metahub-1',
            PROJECT_ID,
            {
                id: '019e8afa-0000-7000-8000-000000000004',
                scriptAssetId: '019e8afa-0000-7000-8000-000000000005',
                sourceModuleId: null,
                sourceModuleCodename: null,
                sourceModulePath: null,
                sourceChecksum: 'a'.repeat(64),
                outputFile: {
                    provider: 'local',
                    root: 'playcanvas-projects',
                    path: `playcanvas-projects/${PROJECT_ID}/generated/flight-controller.mjs `,
                    hash: null,
                    mime: 'text/javascript'
                },
                scriptName: 'FlightController',
                moduleExportName: null,
                scriptKind: 'esm',
                parseStatus: 'ready',
                generatedAt: null,
                parsedAt: null
            },
            'user-1'
        )

        expect(capturedPaths).toEqual({
            scene: `playcanvas-projects/${PROJECT_ID}/scenes/scene-one.json`,
            asset: `playcanvas-projects/${PROJECT_ID}/assets/flight-controller.mjs`,
            generated: `playcanvas-projects/${PROJECT_ID}/generated/flight-controller.mjs`
        })
    })

    it('allows clearing the default scene without a scene lookup', async () => {
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 2
                        }
                    ]
                }
                if (sql.includes('COUNT(*)::text')) {
                    return [{ sceneCount: '0', assetCount: '0', scriptCount: '0', generatedArtifactCount: '0', blockingCount: '0' }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.updateProjectSettings(
                'metahub-1',
                PROJECT_ID,
                {
                    defaultSceneId: null,
                    expectedVersion: 1
                },
                'user-1'
            )
        ).resolves.toMatchObject({
            id: PROJECT_ID,
            defaultSceneId: null
        })

        expect(exec.query).toHaveBeenCalledTimes(2)
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('UPDATE')
    })

    it('clears package default project pointers before deleting project files', async () => {
        const events: string[] = []
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects') && sql.includes('RETURNING')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 2
                        }
                    ]
                }
                if (sql.includes('rel_metahub_packages')) {
                    events.push('clear-pointer')
                    return []
                }
                if (sql.includes('COUNT(*)::text')) {
                    return [{ sceneCount: '0', assetCount: '0', scriptCount: '0', generatedArtifactCount: '0', blockingCount: '0' }]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_')) {
                    return []
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            deleteProjectTree: jest.fn(async () => {
                events.push('delete-files')
            })
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(service.deleteProject('metahub-1', PROJECT_ID, { expectedVersion: 1 }, 'user-1')).resolves.toMatchObject({
            id: PROJECT_ID
        })

        expect(events).toEqual(['clear-pointer', 'delete-files'])
    })

    it('accepts texture assets backed by supported image files', async () => {
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('INSERT INTO') && sql.includes('_mhb_playcanvas_assets')) {
                    expect(params?.[6]).toBe(
                        JSON.stringify({
                            provider: 'local',
                            root: 'playcanvas-projects',
                            path: `playcanvas-projects/${PROJECT_ID}/assets/crosshair.png`,
                            hash: 'a'.repeat(64),
                            mime: 'image/png',
                            size: 4,
                            status: 'ready'
                        })
                    )
                    return [
                        {
                            id: ASSET_ID,
                            projectId: PROJECT_ID,
                            stableAssetId: 'crosshair',
                            type: 'texture',
                            name: 'Crosshair',
                            virtualPath: ['assets', 'crosshair.png'],
                            file: JSON.parse(String(params?.[6])),
                            metadata: {},
                            publish: true,
                            version: 1
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(
            service.writeAssetMetadata(
                'metahub-1',
                PROJECT_ID,
                {
                    id: ASSET_ID,
                    stableAssetId: 'crosshair',
                    type: 'texture',
                    name: 'Crosshair',
                    virtualPath: ['assets', 'crosshair.png'],
                    file: {
                        provider: 'local',
                        root: 'playcanvas-projects',
                        path: `playcanvas-projects/${PROJECT_ID}/assets/crosshair.png`,
                        hash: 'a'.repeat(64),
                        mime: 'image/png',
                        size: 4,
                        status: 'ready'
                    },
                    metadata: {},
                    publish: true
                },
                'user-1'
            )
        ).resolves.toMatchObject({
            id: ASSET_ID,
            type: 'texture',
            file: { mime: 'image/png' }
        })
    })

    it('uses PlayCanvas-specific optimistic-lock diagnostics when deleting a stale project', async () => {
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects') && sql.includes('RETURNING')) {
                    return []
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

        await expect(service.deleteProject('metahub-1', PROJECT_ID, { expectedVersion: 9 }, 'user-1')).rejects.toMatchObject({
            conflict: {
                entityId: PROJECT_ID,
                entityType: 'playcanvasProject',
                expectedVersion: 9
            }
        })
    })

    it('rejects project-level file writes when no scene or generated artifact metadata owns the path', async () => {
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT EXISTS') && sql.includes('_mhb_playcanvas_generated_artifacts')) {
                    return [{ exists: false }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            write: jest.fn()
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(
            service.writeProjectFile(
                'metahub-1',
                PROJECT_ID,
                {
                    sourcePath: `playcanvas-projects/${PROJECT_ID}/scenes/orphan.json`,
                    contentBase64: Buffer.from('{}').toString('base64'),
                    expectedCurrentChecksum: null,
                    mime: 'application/json'
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.path.untracked' })
        })

        expect(fileService.write).not.toHaveBeenCalled()
    })

    it('rejects asset-owned paths on the project-level file endpoint so asset metadata is updated only through asset routes', async () => {
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/assets/texture.json`
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: null,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT EXISTS') && sql.includes('_mhb_playcanvas_generated_artifacts')) {
                    expect(sql).not.toContain("a.file_ref #>> '{path}' = $2")
                    return [{ exists: false }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            write: jest.fn()
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(
            service.writeProjectFile(
                'metahub-1',
                PROJECT_ID,
                {
                    sourcePath,
                    contentBase64: Buffer.from('{}').toString('base64'),
                    expectedCurrentChecksum: null,
                    mime: 'application/json'
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.path.untracked' })
        })

        expect(fileService.write).not.toHaveBeenCalled()
    })

    it('marks scene and generated artifact metadata missing after deleting an owned project file', async () => {
        const events: string[] = []
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/scenes/scene-one.json`
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT EXISTS') && sql.includes('_mhb_playcanvas_generated_artifacts')) {
                    return [{ exists: true }]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_scenes')) {
                    events.push('mark-scene-missing')
                    expect(sql).toContain("status = 'missing'")
                    expect(sql).toContain('payload_file = CASE')
                    return [{ id: SCENE_ID }]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_generated_artifacts')) {
                    events.push('mark-artifact-missing')
                    expect(sql).toContain("parse_status = 'missing'")
                    expect(sql).toContain('output_file = CASE')
                    return []
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles')) {
                    return []
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            stat: jest.fn(async () => ({ exists: false, checksum: null, size: null })),
            deleteIfCurrentChecksum: jest.fn(async () => {
                events.push('delete-file')
                return true
            })
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(service.deleteProjectFile('metahub-1', PROJECT_ID, sourcePath, 'd'.repeat(64), 'user-1')).resolves.toBeUndefined()

        expect(events).toEqual(['mark-scene-missing', 'mark-artifact-missing', 'delete-file'])
        expect(fileService.deleteIfCurrentChecksum).toHaveBeenCalledWith(
            { metahubId: 'metahub-1', branchSlug: TEST_SCHEMA },
            sourcePath,
            'd'.repeat(64)
        )
    })

    it('marks asset metadata missing after deleting an owned asset file', async () => {
        const events: string[] = []
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/assets/texture.json`
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_assets')) {
                    return [
                        {
                            id: ASSET_ID,
                            projectId: PROJECT_ID,
                            stableAssetId: 'texture_1',
                            type: 'texture',
                            name: 'Texture',
                            virtualPath: ['assets', 'texture.json'],
                            file: {
                                provider: 'local',
                                root: 'playcanvas-projects',
                                path: sourcePath,
                                hash: '0'.repeat(64),
                                mime: 'application/json',
                                status: 'ready'
                            },
                            metadata: {},
                            publish: true,
                            version: 1
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_assets')) {
                    events.push('mark-asset-missing')
                    expect(sql).toContain("status = 'missing'")
                    expect(sql).toContain('file_ref = CASE')
                    return [{ id: ASSET_ID }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            stat: jest.fn(async () => ({ exists: false, checksum: null, size: null })),
            deleteIfCurrentChecksum: jest.fn(async () => {
                events.push('delete-file')
                return true
            })
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(
            service.deleteAssetFile('metahub-1', PROJECT_ID, ASSET_ID, sourcePath, 'd'.repeat(64), 'user-1')
        ).resolves.toBeUndefined()

        expect(events).toEqual(['mark-asset-missing', 'delete-file'])
        expect(fileService.deleteIfCurrentChecksum).toHaveBeenCalledWith(
            { metahubId: 'metahub-1', branchSlug: TEST_SCHEMA },
            sourcePath,
            'd'.repeat(64)
        )
    })

    it('restores project file metadata when delete checksum is stale', async () => {
        const events: string[] = []
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/scenes/scene-one.json`
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT EXISTS') && sql.includes('_mhb_playcanvas_generated_artifacts')) {
                    return [{ exists: true }]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_scenes') && sql.includes("status = 'missing'")) {
                    events.push('mark-scene-missing')
                    return [{ id: SCENE_ID }]
                }
                if (
                    sql.includes('UPDATE') &&
                    sql.includes('_mhb_playcanvas_generated_artifacts') &&
                    sql.includes("parse_status = 'missing'")
                ) {
                    events.push('mark-artifact-missing')
                    return []
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes("status = 'missing'")) {
                    return []
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_scenes') && sql.includes("status = 'ready'")) {
                    events.push('restore-scene-ready')
                    return [{ id: SCENE_ID }]
                }
                if (
                    sql.includes('UPDATE') &&
                    sql.includes('_mhb_playcanvas_generated_artifacts') &&
                    sql.includes("parse_status = 'ready'")
                ) {
                    events.push('restore-artifact-ready')
                    return []
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes("status = 'ready'")) {
                    return []
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            stat: jest.fn(async () => ({ exists: true, checksum: 'e'.repeat(64), size: 2 })),
            read: jest.fn(async () => ({
                content: Buffer.from('{}'),
                checksum: 'e'.repeat(64),
                sourcePath,
                absolutePath: `/tmp/${sourcePath}`,
                size: 2
            })),
            deleteIfCurrentChecksum: jest.fn(async () => {
                events.push('delete-file-stale')
                return false
            })
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(service.deleteProjectFile('metahub-1', PROJECT_ID, sourcePath, 'd'.repeat(64), 'user-1')).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.path.currentChecksumMismatch' })
        })

        expect(events).toEqual([
            'mark-scene-missing',
            'mark-artifact-missing',
            'delete-file-stale',
            'restore-scene-ready',
            'restore-artifact-ready'
        ])
    })

    it('restores project file metadata when physical delete fails after marking the reference missing', async () => {
        const events: string[] = []
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/scenes/scene-one.json`
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT EXISTS') && sql.includes('_mhb_playcanvas_generated_artifacts')) {
                    return [{ exists: true }]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_scenes') && sql.includes("status = 'missing'")) {
                    events.push('mark-scene-missing')
                    return [{ id: SCENE_ID }]
                }
                if (
                    sql.includes('UPDATE') &&
                    sql.includes('_mhb_playcanvas_generated_artifacts') &&
                    sql.includes("parse_status = 'missing'")
                ) {
                    events.push('mark-artifact-missing')
                    return []
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes("status = 'missing'")) {
                    return []
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_scenes') && sql.includes("status = 'ready'")) {
                    events.push('restore-scene-ready')
                    return [{ id: SCENE_ID }]
                }
                if (
                    sql.includes('UPDATE') &&
                    sql.includes('_mhb_playcanvas_generated_artifacts') &&
                    sql.includes("parse_status = 'ready'")
                ) {
                    events.push('restore-artifact-ready')
                    return []
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes("status = 'ready'")) {
                    return []
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            stat: jest.fn(async () => ({ exists: true, checksum: 'd'.repeat(64), size: 2 })),
            read: jest.fn(async () => ({
                content: Buffer.from('{}'),
                checksum: 'd'.repeat(64),
                sourcePath,
                absolutePath: `/tmp/${sourcePath}`,
                size: 2
            })),
            deleteIfCurrentChecksum: jest.fn(async () => {
                events.push('delete-file')
                throw new Error('physical delete failed')
            })
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(service.deleteProjectFile('metahub-1', PROJECT_ID, sourcePath, 'd'.repeat(64), 'user-1')).rejects.toThrow(
            'physical delete failed'
        )

        expect(events).toEqual([
            'mark-scene-missing',
            'mark-artifact-missing',
            'delete-file',
            'restore-scene-ready',
            'restore-artifact-ready'
        ])
    })

    it('marks scene and generated artifact metadata ready after writing an owned project file', async () => {
        const events: string[] = []
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/scenes/scene-one.json`
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT EXISTS') && sql.includes('_mhb_playcanvas_generated_artifacts')) {
                    return [{ exists: true }]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_scenes')) {
                    events.push('mark-scene-ready')
                    expect(sql).toContain("status = 'ready'")
                    expect(sql).toContain("jsonb_build_object(\n                        'status', 'ready'")
                    return [{ id: SCENE_ID }]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_generated_artifacts')) {
                    events.push('mark-artifact-ready')
                    expect(sql).toContain("parse_status = 'ready'")
                    expect(sql).toContain('output_checksum = $3')
                    return []
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles')) {
                    return []
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            stat: jest.fn(async () => ({ exists: false, checksum: null, size: null })),
            write: jest.fn(async () => {
                events.push('write-file')
                return {
                    sourcePath,
                    checksum: 'a'.repeat(64),
                    size: 2,
                    mime: 'application/json'
                }
            })
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(
            service.writeProjectFile(
                'metahub-1',
                PROJECT_ID,
                {
                    sourcePath,
                    contentBase64: Buffer.from('{}').toString('base64'),
                    expectedCurrentChecksum: null,
                    mime: 'application/json'
                },
                'user-1'
            )
        ).resolves.toMatchObject({ checksum: 'a'.repeat(64), size: 2 })

        expect(events).toEqual(['write-file', 'mark-scene-ready', 'mark-artifact-ready'])
    })

    it('creates, lists, reads, and deletes editor sourcefiles through durable sourcefile metadata', async () => {
        const events: string[] = []
        const sourceFileId = 'main-script'
        const requestedSourceFileId = `${sourceFileId}.mjs`
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/sourcefiles/${sourceFileId}.mjs`
        const checksum = 'f'.repeat(64)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay').mockResolvedValue(true)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'completeReplay').mockResolvedValue(true)
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes('stable_sourcefile_id = $2')) {
                    expect(params?.[1]).toBe(sourceFileId)
                    return events.includes('sourcefile-created')
                        ? [
                              {
                                  id: '019e8afa-0000-7000-8000-000000000105',
                                  projectId: PROJECT_ID,
                                  stableSourceFileId: sourceFileId,
                                  name: `${sourceFileId}.mjs`,
                                  virtualPath: [`${sourceFileId}.mjs`],
                                  file: {
                                      provider: 'local',
                                      root: 'playcanvas-projects',
                                      path: sourcePath,
                                      hash: checksum,
                                      mime: 'text/javascript',
                                      size: 39,
                                      status: 'ready'
                                  },
                                  scriptKind: 'esm',
                                  checksum,
                                  parsedAttributes: {},
                                  parseStatus: 'ready',
                                  parseDiagnostics: null,
                                  publish: true,
                                  version: 2
                              }
                          ]
                        : []
                }
                if (sql.includes('INSERT INTO') && sql.includes('_mhb_playcanvas_sourcefiles')) {
                    const file = JSON.parse(params?.[5] as string)
                    if (params?.[17] === 1) {
                        events.push('sourcefile-ready')
                        expect(file.hash).toBe(checksum)
                        return [
                            {
                                id: params?.[0],
                                projectId: PROJECT_ID,
                                stableSourceFileId: params?.[2],
                                name: params?.[3],
                                virtualPath: JSON.parse(params?.[4] as string),
                                file,
                                scriptKind: params?.[10],
                                checksum: params?.[7],
                                parsedAttributes: JSON.parse(params?.[11] as string),
                                parseStatus: params?.[12],
                                parseDiagnostics: JSON.parse(params?.[13] as string),
                                publish: params?.[14],
                                version: 2
                            }
                        ]
                    }
                    events.push('sourcefile-created')
                    expect(params?.[2]).toBe(sourceFileId)
                    expect(file.path).toBe(sourcePath)
                    return [
                        {
                            id: params?.[0],
                            projectId: PROJECT_ID,
                            stableSourceFileId: params?.[2],
                            name: params?.[3],
                            virtualPath: JSON.parse(params?.[4] as string),
                            file,
                            scriptKind: params?.[10],
                            checksum: file.hash,
                            parsedAttributes: JSON.parse(params?.[11] as string),
                            parseStatus: params?.[12],
                            parseDiagnostics: JSON.parse(params?.[13] as string),
                            publish: params?.[14],
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_sourcefiles') && !sql.includes('stable_sourcefile_id = $2')) {
                    return [
                        {
                            id: '019e8afa-0000-7000-8000-000000000105',
                            projectId: PROJECT_ID,
                            stableSourceFileId: sourceFileId,
                            name: `${sourceFileId}.mjs`,
                            virtualPath: [`${sourceFileId}.mjs`],
                            file: {
                                provider: 'local',
                                root: 'playcanvas-projects',
                                path: sourcePath,
                                hash: checksum,
                                mime: 'text/javascript',
                                size: 39,
                                status: 'ready'
                            },
                            scriptKind: 'esm',
                            checksum,
                            parsedAttributes: {},
                            parseStatus: 'ready',
                            parseDiagnostics: null,
                            publish: true,
                            version: 2
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes("status = 'missing'")) {
                    events.push('sourcefile-missing')
                    return [{ id: '019e8afa-0000-7000-8000-000000000105' }]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes('stable_sourcefile_id = $2')) {
                    events.push('sourcefile-soft-deleted')
                    return [{ id: '019e8afa-0000-7000-8000-000000000105' }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            buildDefaultSourceFilePath: jest.fn(() => sourcePath),
            stat: jest.fn(async () => ({ exists: false, checksum: null, size: null })),
            write: jest.fn(async () => {
                events.push('write-file')
                return {
                    sourcePath,
                    checksum,
                    size: 39,
                    mime: 'text/javascript'
                }
            }),
            read: jest.fn(async () => ({
                content: Buffer.from('export default class MainScript {}'),
                checksum,
                sourcePath,
                absolutePath: `/tmp/${sourcePath}`,
                size: 34
            })),
            deleteIfCurrentChecksum: jest.fn(async () => {
                events.push('delete-file')
                return true
            })
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(
            service.writeEditorCompatibilitySourceFile(
                'metahub-1',
                PROJECT_ID,
                requestedSourceFileId,
                {
                    requestId: '019e8afa-0000-7000-8000-000000000201',
                    path: 'scripts/main-script.mjs',
                    content: 'export default class MainScript {}',
                    expectedCurrentChecksum: null
                },
                'user-1'
            )
        ).resolves.toMatchObject({ id: sourceFileId, path: sourcePath, hash: checksum })
        await expect(service.listEditorCompatibilitySourceFiles('metahub-1', PROJECT_ID, 'user-1')).resolves.toMatchObject([
            { id: sourceFileId, path: sourcePath, hash: checksum }
        ])
        await expect(
            service.readEditorCompatibilitySourceFile('metahub-1', PROJECT_ID, requestedSourceFileId, 'user-1')
        ).resolves.toMatchObject({
            id: sourceFileId,
            content: 'export default class MainScript {}'
        })
        await expect(
            service.deleteEditorCompatibilitySourceFile(
                'metahub-1',
                PROJECT_ID,
                requestedSourceFileId,
                { requestId: '019e8afa-0000-7000-8000-000000000202', expectedCurrentChecksum: checksum },
                'user-1'
            )
        ).resolves.toEqual({ id: sourceFileId, deleted: true })

        expect(events).toEqual(['sourcefile-created', 'write-file', 'sourcefile-ready', 'delete-file', 'sourcefile-soft-deleted'])
        expect(fileService.deleteIfCurrentChecksum).toHaveBeenCalledWith(
            { metahubId: 'metahub-1', branchSlug: TEST_SCHEMA },
            sourcePath,
            checksum
        )
    })

    it('replays compatibility sourcefile writes by request id without writing the file twice', async () => {
        const sourceFileId = 'main-script'
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/sourcefiles/${sourceFileId}.js`
        const checksum = 'f'.repeat(64)
        const response = {
            id: sourceFileId,
            path: sourcePath,
            name: `${sourceFileId}.js`,
            content: 'export default class MainScript {}',
            hash: checksum,
            size: 39,
            mime: 'text/javascript',
            updatedAt: null
        }
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay').mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'completeReplay').mockResolvedValue(true)
        const readReplayResponse = jest
            .spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'readReplayResponse')
            .mockResolvedValue({ status: 'completed', response })
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes('stable_sourcefile_id = $2')) {
                    return []
                }
                if (sql.includes('INSERT INTO') && sql.includes('_mhb_playcanvas_sourcefiles')) {
                    return [
                        {
                            id: params?.[0],
                            projectId: PROJECT_ID,
                            stableSourceFileId: params?.[2],
                            name: params?.[3],
                            virtualPath: JSON.parse(params?.[4] as string),
                            file: JSON.parse(params?.[5] as string),
                            scriptKind: params?.[10],
                            checksum: null,
                            parsedAttributes: {},
                            parseStatus: 'missing',
                            parseDiagnostics: null,
                            publish: true,
                            version: 1
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes("status = 'ready'")) {
                    return [{ id: '019e8afa-0000-7000-8000-000000000105' }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            buildDefaultSourceFilePath: jest.fn(() => sourcePath),
            stat: jest.fn(async () => ({ exists: false, checksum: null, size: null })),
            write: jest.fn(async () => ({ sourcePath, checksum, size: 39, mime: 'text/javascript' })),
            deleteIfCurrentChecksum: jest.fn(async () => true)
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)
        const input = {
            requestId: '019e8afa-0000-7000-8000-000000000205',
            path: 'scripts/main-script.js',
            content: response.content,
            expectedCurrentChecksum: null
        }

        await expect(service.writeEditorCompatibilitySourceFile('metahub-1', PROJECT_ID, sourceFileId, input, 'user-1')).resolves.toEqual(
            response
        )
        await expect(service.writeEditorCompatibilitySourceFile('metahub-1', PROJECT_ID, sourceFileId, input, 'user-1')).resolves.toEqual(
            response
        )

        expect(readReplayResponse).toHaveBeenCalledTimes(1)
        expect(fileService.write).toHaveBeenCalledTimes(1)
    })

    it('rejects compatibility sourcefile writes that try to move an existing sourcefile path', async () => {
        const sourceFileId = 'main-script'
        const existingSourcePath = `playcanvas-projects/${PROJECT_ID}/sourcefiles/${sourceFileId}.mjs`
        const nextSourcePath = `playcanvas-projects/${PROJECT_ID}/sourcefiles/${sourceFileId}.js`
        const checksum = 'f'.repeat(64)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay').mockResolvedValue(true)
        const releaseReplay = jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'releaseReplay').mockResolvedValue(true)
        const completeReplay = jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'completeReplay').mockResolvedValue(true)
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes('stable_sourcefile_id = $2')) {
                    return [
                        {
                            id: '019e8afa-0000-7000-8000-000000000105',
                            projectId: PROJECT_ID,
                            stableSourceFileId: sourceFileId,
                            name: `${sourceFileId}.mjs`,
                            virtualPath: [`${sourceFileId}.mjs`],
                            file: {
                                provider: 'local',
                                root: 'playcanvas-projects',
                                path: existingSourcePath,
                                hash: checksum,
                                mime: 'text/javascript',
                                size: 39,
                                status: 'ready'
                            },
                            scriptKind: 'esm',
                            checksum,
                            parsedAttributes: {},
                            parseStatus: 'ready',
                            parseDiagnostics: null,
                            publish: true,
                            version: 2
                        }
                    ]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            buildDefaultSourceFilePath: jest.fn((_projectId: string, _sourceFileId: string, extension: '.js' | '.mjs') =>
                extension === '.js' ? nextSourcePath : existingSourcePath
            ),
            stat: jest.fn(async () => ({ exists: false, checksum: null, size: null })),
            write: jest.fn(async () => ({ sourcePath: nextSourcePath, checksum, size: 39, mime: 'text/javascript' })),
            deleteIfCurrentChecksum: jest.fn(async () => true)
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(
            service.writeEditorCompatibilitySourceFile(
                'metahub-1',
                PROJECT_ID,
                sourceFileId,
                {
                    requestId: '019e8afa-0000-7000-8000-000000000215',
                    path: 'scripts/main-script.js',
                    content: 'export default class MainScript {}',
                    expectedCurrentChecksum: checksum
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({
                messageCode: 'playcanvas.files.sourcefile.pathChangeUnsupported',
                existingSourcePath,
                sourcePath: nextSourcePath
            })
        })

        expect(fileService.write).not.toHaveBeenCalled()
        expect(completeReplay).not.toHaveBeenCalled()
        expect(releaseReplay).toHaveBeenCalledTimes(1)
    })

    it('rejects compatibility sourcefile write replay when the same request id has a different fingerprint', async () => {
        const sourceFileId = 'main-script'
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/sourcefiles/${sourceFileId}.js`
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay').mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'completeReplay').mockResolvedValue(true)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'readReplayResponse').mockResolvedValue(null)
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes('stable_sourcefile_id = $2')) {
                    return []
                }
                if (sql.includes('INSERT INTO') && sql.includes('_mhb_playcanvas_sourcefiles')) {
                    return [
                        {
                            id: params?.[0],
                            projectId: PROJECT_ID,
                            stableSourceFileId: params?.[2],
                            name: params?.[3],
                            virtualPath: JSON.parse(params?.[4] as string),
                            file: JSON.parse(params?.[5] as string),
                            scriptKind: params?.[10],
                            checksum: null,
                            parsedAttributes: {},
                            parseStatus: 'missing',
                            parseDiagnostics: null,
                            publish: true,
                            version: 1
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes("status = 'ready'")) {
                    return [{ id: '019e8afa-0000-7000-8000-000000000105' }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            buildDefaultSourceFilePath: jest.fn(() => sourcePath),
            stat: jest.fn(async () => ({ exists: false, checksum: null, size: null })),
            write: jest.fn(async () => ({ sourcePath, checksum: 'f'.repeat(64), size: 39, mime: 'text/javascript' })),
            deleteIfCurrentChecksum: jest.fn(async () => true)
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)
        const input = {
            requestId: '019e8afa-0000-7000-8000-000000000206',
            path: 'scripts/main-script.js',
            content: 'export default class MainScript {}',
            expectedCurrentChecksum: null
        }

        await expect(
            service.writeEditorCompatibilitySourceFile('metahub-1', PROJECT_ID, sourceFileId, input, 'user-1')
        ).resolves.toMatchObject({
            id: sourceFileId
        })
        await expect(
            service.writeEditorCompatibilitySourceFile(
                'metahub-1',
                PROJECT_ID,
                sourceFileId,
                { ...input, content: 'export default class OtherScript {}' },
                'user-1'
            )
        ).rejects.toMatchObject({ details: expect.objectContaining({ messageCode: 'playcanvas.editorCompatibility.replayRejected' }) })
        expect(fileService.write).toHaveBeenCalledTimes(1)
    })

    it('replays compatibility sourcefile deletes by request id without deleting the file twice', async () => {
        const sourceFileId = 'main-script'
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/sourcefiles/${sourceFileId}.js`
        const checksum = 'f'.repeat(64)
        const response = { id: sourceFileId, deleted: true } as const
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay').mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'completeReplay').mockResolvedValue(true)
        const readReplayResponse = jest
            .spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'readReplayResponse')
            .mockResolvedValue({ status: 'completed', response })
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes('stable_sourcefile_id = $2')) {
                    return [
                        {
                            id: '019e8afa-0000-7000-8000-000000000105',
                            projectId: PROJECT_ID,
                            stableSourceFileId: sourceFileId,
                            name: `${sourceFileId}.js`,
                            virtualPath: [`${sourceFileId}.js`],
                            file: {
                                provider: 'local',
                                root: 'playcanvas-projects',
                                path: sourcePath,
                                hash: checksum,
                                mime: 'text/javascript',
                                size: 39,
                                status: 'ready'
                            },
                            scriptKind: 'esm',
                            checksum,
                            parsedAttributes: {},
                            parseStatus: 'ready',
                            parseDiagnostics: null,
                            publish: true,
                            version: 2
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes("status = 'missing'")) {
                    throw new Error('Sourcefile delete must not mark metadata missing before soft-delete')
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes('stable_sourcefile_id = $2')) {
                    expect(sql).toContain('_upl_version = $4')
                    expect(params).toEqual([PROJECT_ID, sourceFileId, 'user-1', 2])
                    return [{ id: '019e8afa-0000-7000-8000-000000000105' }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            stat: jest.fn(async () => ({ exists: true, checksum, sourcePath, absolutePath: `/tmp/${sourcePath}`, size: 39 })),
            read: jest.fn(async () => ({
                content: Buffer.from('export default class MainScript {}'),
                checksum,
                sourcePath,
                absolutePath: `/tmp/${sourcePath}`,
                size: 39
            })),
            deleteIfCurrentChecksum: jest.fn(async () => true)
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)
        const input = { requestId: '019e8afa-0000-7000-8000-000000000207', expectedCurrentChecksum: checksum }

        await expect(service.deleteEditorCompatibilitySourceFile('metahub-1', PROJECT_ID, sourceFileId, input, 'user-1')).resolves.toEqual(
            response
        )
        await expect(service.deleteEditorCompatibilitySourceFile('metahub-1', PROJECT_ID, sourceFileId, input, 'user-1')).resolves.toEqual(
            response
        )
        expect(readReplayResponse).toHaveBeenCalledTimes(1)
        expect(fileService.deleteIfCurrentChecksum).toHaveBeenCalledTimes(1)
    })

    it('rejects compatibility sourcefile delete replay when the same request id has a different fingerprint', async () => {
        const sourceFileId = 'main-script'
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/sourcefiles/${sourceFileId}.js`
        const checksum = 'f'.repeat(64)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay').mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'completeReplay').mockResolvedValue(true)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'readReplayResponse').mockResolvedValue(null)
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes('stable_sourcefile_id = $2')) {
                    return [
                        {
                            id: '019e8afa-0000-7000-8000-000000000105',
                            projectId: PROJECT_ID,
                            stableSourceFileId: sourceFileId,
                            name: `${sourceFileId}.js`,
                            virtualPath: [`${sourceFileId}.js`],
                            file: {
                                provider: 'local',
                                root: 'playcanvas-projects',
                                path: sourcePath,
                                hash: checksum,
                                mime: 'text/javascript',
                                size: 39,
                                status: 'ready'
                            },
                            scriptKind: 'esm',
                            checksum,
                            parsedAttributes: {},
                            parseStatus: 'ready',
                            parseDiagnostics: null,
                            publish: true,
                            version: 2
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes("status = 'missing'")) {
                    throw new Error('Sourcefile delete must not mark metadata missing before soft-delete')
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes('stable_sourcefile_id = $2')) {
                    expect(sql).toContain('_upl_version = $4')
                    expect(params).toEqual([PROJECT_ID, sourceFileId, 'user-1', 2])
                    return [{ id: '019e8afa-0000-7000-8000-000000000105' }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            stat: jest.fn(async () => ({ exists: true, checksum, sourcePath, absolutePath: `/tmp/${sourcePath}`, size: 39 })),
            read: jest.fn(async () => ({
                content: Buffer.from('export default class MainScript {}'),
                checksum,
                sourcePath,
                absolutePath: `/tmp/${sourcePath}`,
                size: 39
            })),
            deleteIfCurrentChecksum: jest.fn(async () => true)
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)
        const input = { requestId: '019e8afa-0000-7000-8000-000000000208', expectedCurrentChecksum: checksum }

        await expect(service.deleteEditorCompatibilitySourceFile('metahub-1', PROJECT_ID, sourceFileId, input, 'user-1')).resolves.toEqual({
            id: sourceFileId,
            deleted: true
        })
        await expect(
            service.deleteEditorCompatibilitySourceFile(
                'metahub-1',
                PROJECT_ID,
                sourceFileId,
                { ...input, expectedCurrentChecksum: 'e'.repeat(64) },
                'user-1'
            )
        ).rejects.toMatchObject({ details: expect.objectContaining({ messageCode: 'playcanvas.editorCompatibility.replayRejected' }) })
        expect(fileService.deleteIfCurrentChecksum).toHaveBeenCalledTimes(1)
    })

    it('soft-deletes newly created sourcefile metadata when the physical sourcefile write fails', async () => {
        const events: string[] = []
        const sourceFileId = 'main-script'
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/sourcefiles/${sourceFileId}.js`
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay').mockResolvedValue(true)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'releaseReplay').mockResolvedValue(undefined)
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes('stable_sourcefile_id = $2')) {
                    return []
                }
                if (sql.includes('INSERT INTO') && sql.includes('_mhb_playcanvas_sourcefiles')) {
                    events.push('sourcefile-created')
                    return [
                        {
                            id: params?.[0],
                            projectId: PROJECT_ID,
                            stableSourceFileId: params?.[2],
                            name: params?.[3],
                            virtualPath: JSON.parse(params?.[4] as string),
                            file: JSON.parse(params?.[5] as string),
                            scriptKind: params?.[10],
                            checksum: null,
                            parsedAttributes: {},
                            parseStatus: 'missing',
                            parseDiagnostics: null,
                            publish: true,
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT EXISTS') && sql.includes('_mhb_playcanvas_sourcefiles')) {
                    return [{ exists: true }]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes('stable_sourcefile_id = $2')) {
                    expect(sql).toContain('_upl_version = $4')
                    expect(params).toEqual([PROJECT_ID, sourceFileId, 'user-1', 1])
                    events.push('sourcefile-soft-deleted')
                    return [{ id: '019e8afa-0000-7000-8000-000000000105' }]
                }
                if (
                    sql.includes('UPDATE') &&
                    (sql.includes('_mhb_playcanvas_scenes') || sql.includes('_mhb_playcanvas_generated_artifacts'))
                ) {
                    return []
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            buildDefaultSourceFilePath: jest.fn(() => sourcePath),
            stat: jest.fn(async () => ({ exists: false, checksum: null, size: null })),
            write: jest.fn(async () => {
                events.push('write-file')
                throw new MetahubValidationError('Current file checksum does not match', {
                    messageCode: 'playcanvas.files.path.currentChecksumMismatch',
                    sourcePath
                })
            })
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(
            service.writeEditorCompatibilitySourceFile(
                'metahub-1',
                PROJECT_ID,
                sourceFileId,
                {
                    requestId: '019e8afa-0000-7000-8000-000000000203',
                    path: 'scripts/main-script.js',
                    content: 'export default class MainScript {}',
                    expectedCurrentChecksum: 'stale'
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.path.currentChecksumMismatch' })
        })
        expect(events).toEqual(['sourcefile-created', 'write-file', 'sourcefile-soft-deleted'])
    })

    it('does not resurrect existing sourcefile metadata when write rollback sees a stale version', async () => {
        const events: string[] = []
        const sourceFileId = 'main-script'
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/sourcefiles/${sourceFileId}.js`
        const existingChecksum = 'a'.repeat(64)
        const existingSourceFile = {
            id: '019e8afa-0000-7000-8000-000000000111',
            projectId: PROJECT_ID,
            stableSourceFileId: sourceFileId,
            name: 'main-script.js',
            virtualPath: ['main-script.js'],
            file: {
                provider: 'local',
                root: 'playcanvas-projects',
                path: sourcePath,
                hash: existingChecksum,
                size: 42,
                mime: 'text/javascript',
                status: 'ready'
            },
            scriptKind: 'esm',
            checksum: existingChecksum,
            parsedAttributes: {},
            parseStatus: 'ready',
            parseDiagnostics: null,
            publish: true,
            version: 7
        }
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay').mockResolvedValue(true)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'releaseReplay').mockResolvedValue(undefined)
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes('stable_sourcefile_id = $2')) {
                    return [existingSourceFile]
                }
                if (sql.includes('INSERT INTO') && sql.includes('_mhb_playcanvas_sourcefiles')) {
                    events.push(params?.[12] === 'missing' ? 'sourcefile-marked-missing' : 'sourcefile-rollback-restore')
                    expect(params?.[17]).toBe(events.length === 1 ? 7 : 8)
                    if (events.length === 1) {
                        return [{ ...existingSourceFile, file: JSON.parse(params?.[5] as string), parseStatus: 'missing', version: 8 }]
                    }
                    return []
                }
                if (sql.includes('SELECT EXISTS') && sql.includes('_mhb_playcanvas_sourcefiles')) {
                    return [{ exists: true }]
                }
                if (
                    sql.includes('UPDATE') &&
                    (sql.includes('_mhb_playcanvas_scenes') || sql.includes('_mhb_playcanvas_generated_artifacts'))
                ) {
                    return []
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            buildDefaultSourceFilePath: jest.fn(() => sourcePath),
            stat: jest.fn(async () => ({ exists: true, checksum: existingChecksum, size: 42 })),
            read: jest.fn(async () => ({
                sourcePath,
                contentBase64: Buffer.from('export default class ExistingScript {}', 'utf8').toString('base64'),
                checksum: existingChecksum,
                size: 42,
                mime: 'text/javascript'
            })),
            write: jest.fn(async () => {
                events.push('write-file')
                throw new MetahubValidationError('Current file checksum does not match', {
                    messageCode: 'playcanvas.files.path.currentChecksumMismatch',
                    sourcePath
                })
            })
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(
            service.writeEditorCompatibilitySourceFile(
                'metahub-1',
                PROJECT_ID,
                sourceFileId,
                {
                    requestId: '019e8afa-0000-7000-8000-000000000204',
                    path: 'scripts/main-script.js',
                    content: 'export default class MainScript {}',
                    expectedCurrentChecksum: existingChecksum
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.path.currentChecksumMismatch' })
        })
        expect(events).toEqual(['sourcefile-marked-missing', 'write-file', 'sourcefile-rollback-restore'])
    })

    it('fails closed when sourcefile metadata cannot be soft-deleted after the physical delete', async () => {
        const sourceFileId = 'main-script'
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/sourcefiles/${sourceFileId}.js`
        const checksum = 'f'.repeat(64)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'claimReplay').mockResolvedValue(true)
        jest.spyOn(PlayCanvasEditorBridgeSessionService.prototype, 'releaseReplay').mockResolvedValue(undefined)
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes('stable_sourcefile_id = $2')) {
                    return [
                        {
                            id: '019e8afa-0000-7000-8000-000000000105',
                            projectId: PROJECT_ID,
                            stableSourceFileId: sourceFileId,
                            name: `${sourceFileId}.js`,
                            virtualPath: [`${sourceFileId}.js`],
                            file: {
                                provider: 'local',
                                root: 'playcanvas-projects',
                                path: sourcePath,
                                hash: checksum,
                                mime: 'text/javascript',
                                size: 39,
                                status: 'ready'
                            },
                            scriptKind: 'esm',
                            checksum,
                            parsedAttributes: {},
                            parseStatus: 'ready',
                            parseDiagnostics: null,
                            publish: true,
                            version: 2
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes("status = 'missing'")) {
                    throw new Error('Sourcefile delete must not mark metadata missing before soft-delete')
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles') && sql.includes('stable_sourcefile_id = $2')) {
                    expect(sql).toContain('_upl_version = $4')
                    expect(params).toEqual([PROJECT_ID, sourceFileId, 'user-1', 2])
                    return []
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            stat: jest.fn(async () => ({
                exists: true,
                checksum,
                sourcePath,
                absolutePath: `/tmp/${sourcePath}`,
                size: 39
            })),
            read: jest.fn(async () => ({
                content: Buffer.from('export default class MainScript {}'),
                checksum,
                sourcePath,
                absolutePath: `/tmp/${sourcePath}`,
                size: 39
            })),
            deleteIfCurrentChecksum: jest.fn(async () => true),
            write: jest.fn(async () => ({
                content: Buffer.from('export default class MainScript {}'),
                checksum,
                sourcePath,
                absolutePath: `/tmp/${sourcePath}`,
                size: 39,
                mime: 'text/javascript'
            }))
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(
            service.deleteEditorCompatibilitySourceFile(
                'metahub-1',
                PROJECT_ID,
                sourceFileId,
                { requestId: '019e8afa-0000-7000-8000-000000000204', expectedCurrentChecksum: checksum },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.metadataUpdateFailed' })
        })
    })

    it('marks asset metadata ready after writing an owned asset file', async () => {
        const events: string[] = []
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/assets/texture.json`
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_assets')) {
                    return [
                        {
                            id: ASSET_ID,
                            projectId: PROJECT_ID,
                            stableAssetId: 'texture_1',
                            type: 'texture',
                            name: 'Texture',
                            virtualPath: ['assets', 'texture.json'],
                            file: {
                                provider: 'local',
                                root: 'playcanvas-projects',
                                path: sourcePath,
                                hash: null,
                                mime: 'application/json',
                                status: 'missing'
                            },
                            metadata: {},
                            publish: true,
                            version: 1
                        }
                    ]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_assets')) {
                    events.push('mark-asset-ready')
                    expect(sql).toContain("status = 'ready'")
                    expect(sql).toContain('file_hash = $4')
                    return [{ id: ASSET_ID }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            stat: jest.fn(async () => ({ exists: false, checksum: null, size: null })),
            write: jest.fn(async () => {
                events.push('write-file')
                return {
                    sourcePath,
                    checksum: 'b'.repeat(64),
                    size: 2,
                    mime: 'application/json'
                }
            })
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(
            service.writeAssetFile(
                'metahub-1',
                PROJECT_ID,
                ASSET_ID,
                {
                    sourcePath,
                    contentBase64: Buffer.from('{}').toString('base64'),
                    expectedCurrentChecksum: null,
                    mime: 'application/json'
                },
                'user-1'
            )
        ).resolves.toMatchObject({ checksum: 'b'.repeat(64), size: 2 })

        expect(events).toEqual(['write-file', 'mark-asset-ready'])
    })

    it('rolls back a project file write when ready metadata update fails', async () => {
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/scenes/scene-one.json`
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT EXISTS') && sql.includes('_mhb_playcanvas_generated_artifacts')) {
                    return [{ exists: true }]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_scenes')) {
                    throw new Error('metadata update failed')
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            stat: jest.fn(async () => ({ exists: false, checksum: null, size: null })),
            write: jest.fn(async () => ({
                sourcePath,
                checksum: 'c'.repeat(64),
                size: 2,
                mime: 'application/json'
            })),
            deleteIfCurrentChecksum: jest.fn(async () => true)
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(
            service.writeProjectFile(
                'metahub-1',
                PROJECT_ID,
                {
                    sourcePath,
                    contentBase64: Buffer.from('{}').toString('base64'),
                    expectedCurrentChecksum: null,
                    mime: 'application/json'
                },
                'user-1'
            )
        ).rejects.toThrow('metadata update failed')

        expect(fileService.deleteIfCurrentChecksum).toHaveBeenCalledWith(
            { metahubId: 'metahub-1', branchSlug: TEST_SCHEMA },
            sourcePath,
            'c'.repeat(64)
        )
    })

    it('rolls back a project file write when ready metadata update touches zero rows', async () => {
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/scenes/scene-one.json`
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT EXISTS') && sql.includes('_mhb_playcanvas_generated_artifacts')) {
                    return [{ exists: true }]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_scenes')) {
                    return []
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_generated_artifacts')) {
                    return []
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles')) {
                    return []
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            stat: jest.fn(async () => ({ exists: false, checksum: null, size: null })),
            write: jest.fn(async () => ({
                sourcePath,
                checksum: 'c'.repeat(64),
                size: 2,
                mime: 'application/json'
            })),
            deleteIfCurrentChecksum: jest.fn(async () => true)
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(
            service.writeProjectFile(
                'metahub-1',
                PROJECT_ID,
                {
                    sourcePath,
                    contentBase64: Buffer.from('{}').toString('base64'),
                    expectedCurrentChecksum: null,
                    mime: 'application/json'
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.metadataUpdateFailed' })
        })

        expect(fileService.deleteIfCurrentChecksum).toHaveBeenCalledWith(
            { metahubId: 'metahub-1', branchSlug: TEST_SCHEMA },
            sourcePath,
            'c'.repeat(64)
        )
    })

    it('does not physically delete a project file when missing metadata update touches zero rows', async () => {
        const sourcePath = `playcanvas-projects/${PROJECT_ID}/scenes/scene-one.json`
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 1
                        }
                    ]
                }
                if (sql.includes('SELECT EXISTS') && sql.includes('_mhb_playcanvas_generated_artifacts')) {
                    return [{ exists: true }]
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_scenes')) {
                    return []
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_generated_artifacts')) {
                    return []
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_sourcefiles')) {
                    return []
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            stat: jest.fn(async () => ({ exists: false, checksum: null, size: null })),
            deleteIfCurrentChecksum: jest.fn()
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(service.deleteProjectFile('metahub-1', PROJECT_ID, sourcePath, 'd'.repeat(64), 'user-1')).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.metadataUpdateFailed' })
        })

        expect(fileService.deleteIfCurrentChecksum).not.toHaveBeenCalled()
    })

    it('keeps package default project pointers cleared when project file cleanup fails', async () => {
        const previousConfig = { playcanvasProject: { defaultProjectId: PROJECT_ID } }
        let restorePointerCalls = 0
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects') && sql.includes('RETURNING')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 2
                        }
                    ]
                }
                if (sql.includes('WITH affected') && sql.includes('rel_metahub_packages')) {
                    return [{ id: 'attachment-1', config: previousConfig }]
                }
                if (sql.includes('UPDATE') && sql.includes('rel_metahub_packages')) {
                    restorePointerCalls += 1
                    return []
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_')) {
                    return []
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            deleteProjectTree: jest.fn(async () => {
                throw new Error('file cleanup failed')
            })
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(service.deleteProject('metahub-1', PROJECT_ID, { expectedVersion: 1 }, 'user-1')).rejects.toThrow(
            'file cleanup failed'
        )

        expect(jest.mocked(exec.query).mock.calls.some((call) => String(call[0]).includes('rel_metahub_packages'))).toBe(true)
        expect(restorePointerCalls).toBe(0)
        expect(
            jest
                .mocked(exec.query)
                .mock.calls.some(
                    (call) => String(call[0]).includes('_mhb_playcanvas_projects') && String(call[0]).includes('_upl_deleted_at = NULL')
                )
        ).toBe(false)
    })

    it('restores project metadata when clearing package default project pointers fails before file cleanup starts', async () => {
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects') && sql.includes('RETURNING')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: createLocalizedContent('en', 'playcanvas_project'),
                            displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: '0.1.0',
                            compatibilityStatus: 'compatible',
                            compatibilityNotes: {},
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: SCENE_ID,
                            publicationConfig: {},
                            version: 2
                        }
                    ]
                }
                if (sql.includes('WITH affected') && sql.includes('rel_metahub_packages')) {
                    throw new Error('pointer cleanup failed')
                }
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_')) {
                    return []
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            deleteProjectTree: jest.fn(async () => undefined)
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(service.deleteProject('metahub-1', PROJECT_ID, { expectedVersion: 1 }, 'user-1')).rejects.toThrow(
            'pointer cleanup failed'
        )

        expect(fileService.deleteProjectTree).not.toHaveBeenCalled()
        expect(
            jest
                .mocked(exec.query)
                .mock.calls.some(
                    (call) => String(call[0]).includes('_mhb_playcanvas_projects') && String(call[0]).includes('_upl_deleted_at = NULL')
                )
        ).toBe(true)
    })

    describe('deleteBoundProject (cascade from "Projects" entity instance)', () => {
        // Build a minimal project row that `findPlayCanvasProject` / `…ByCodename`
        // can return so deleteBoundProject locates the project and then proceeds
        // to the inner deleteProject pipeline.
        const projectRow = () => ({
            id: PROJECT_ID,
            codename: createLocalizedContent('en', 'mmoomm_world'),
            displayName: createLocalizedContent('en', 'MMOOMM World'),
            description: null,
            packageName: '@universo-react/playcanvas-editor-frontend',
            packageVersion: '0.1.0',
            compatibilityStatus: 'compatible',
            compatibilityNotes: {},
            schemaVersion: '1',
            settings: {},
            defaultSceneId: SCENE_ID,
            publicationConfig: {},
            version: 3
        })

        it('resolves by projectId first, then deletes via the project pipeline', async () => {
            // We track query order so we can confirm the SELECT (find) precedes
            // the UPDATE (soft-delete). Mock returns the project row for any
            // SELECT, and a non-empty row for the soft-delete UPDATE.
            const seenQueries: string[] = []
            const exec = {
                query: jest.fn(async (sql: string) => {
                    seenQueries.push(sql)
                    if (sql.startsWith('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                        return [projectRow()]
                    }
                    if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects') && sql.includes('RETURNING')) {
                        return [projectRow()]
                    }
                    if (sql.includes('rel_metahub_packages')) {
                        return []
                    }
                    if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_')) {
                        return []
                    }
                    return []
                })
            } as unknown as DbExecutor
            const fileService = {
                deleteProjectTree: jest.fn(async () => undefined)
            }
            const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

            await service.deleteBoundProject('metahub-1', { projectId: PROJECT_ID, projectCodename: 'mmoomm_world' }, 'user-1')

            // The inner deleteProject pipeline reached the file cleanup step.
            expect(fileService.deleteProjectTree).toHaveBeenCalledTimes(1)
            // The first query was a SELECT (the resolver), not a codename SELECT.
            // If the projectId SELECT was honored, the codename SELECT should
            // not have been issued.
            const projectIdLookups = seenQueries.filter((sql) => sql.includes('WHERE id = $1') && sql.includes('_mhb_playcanvas_projects'))
            const codenameLookups = seenQueries.filter((sql) => sql.startsWith('SELECT') && sql.includes('LEFT(codename_locale_text'))
            expect(projectIdLookups.length).toBeGreaterThanOrEqual(1)
            expect(codenameLookups.length).toBe(0)
        })

        it('falls back to projectCodename when projectId is missing and the lookup still finds the project', async () => {
            const exec = {
                query: jest.fn(async (sql: string) => {
                    if (sql.startsWith('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                        return [projectRow()]
                    }
                    if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects') && sql.includes('RETURNING')) {
                        return [projectRow()]
                    }
                    if (sql.includes('rel_metahub_packages')) {
                        return []
                    }
                    if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_')) {
                        return []
                    }
                    return []
                })
            } as unknown as DbExecutor
            const fileService = {
                deleteProjectTree: jest.fn(async () => undefined)
            }
            const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

            await service.deleteBoundProject('metahub-1', { projectId: null, projectCodename: 'mmoomm_world' }, 'user-1')

            // Cleanup must have run; the resolver path is confirmed by the inner
            // deleteProject pipeline completing without throwing.
            expect(fileService.deleteProjectTree).toHaveBeenCalledTimes(1)
        })

        it('is a no-op when the bound project is already soft-deleted (idempotent)', async () => {
            // `findPlayCanvasProject` returns the project row (so deleteBoundProject
            // proceeds to call deleteProject), but the inner soft-delete UPDATE
            // returns 0 rows because the project was already deleted. The inner
            // `deleteProject` throws OptimisticLockError, which the entity
            // CRUD handler catches and logs — the cascade is best-effort and
            // the user-facing 204 is preserved. This test confirms that
            // deleteBoundProject does not silently swallow the inner error
            // (the CRUD handler is the swallow point, not this service).
            const exec = {
                query: jest.fn(async (sql: string) => {
                    if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                        return [projectRow()]
                    }
                    if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects') && sql.includes('RETURNING')) {
                        return []
                    }
                    if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_')) {
                        return []
                    }
                    if (sql.includes('WITH affected') && sql.includes('rel_metahub_packages')) {
                        return []
                    }
                    return []
                })
            } as unknown as DbExecutor
            const fileService = {
                deleteProjectTree: jest.fn(async () => undefined)
            }
            const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

            await expect(
                service.deleteBoundProject('metahub-1', { projectId: PROJECT_ID, projectCodename: 'mmoomm_world' }, 'user-1')
            ).rejects.toBeInstanceOf(Error)
            expect(fileService.deleteProjectTree).not.toHaveBeenCalled()
        })

        it('is a no-op when both projectId and projectCodename are missing', async () => {
            const exec = {
                query: jest.fn()
            } as unknown as DbExecutor
            const fileService = {
                deleteProjectTree: jest.fn()
            }
            const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

            await expect(
                service.deleteBoundProject('metahub-1', { projectId: null, projectCodename: null }, 'user-1')
            ).resolves.toBeUndefined()
            expect(exec.query).not.toHaveBeenCalled()
            expect(fileService.deleteProjectTree).not.toHaveBeenCalled()
        })
    })

    describe('resolveBoundProjectByCodename (project-binding validation source of truth)', () => {
        it('returns the project id when the codename resolves in the project-store schema', async () => {
            const exec = {
                query: jest.fn(async (sql: string) => {
                    if (sql.startsWith('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                        return [{ id: PROJECT_ID }]
                    }
                    return []
                })
            } as unknown as DbExecutor
            const schemaService = makeSchemaService()
            const service = new PlayCanvasProjectsService(exec, schemaService as never)

            await expect(service.resolveBoundProjectByCodename('metahub-1', 'mmoomm_world')).resolves.toEqual({ id: PROJECT_ID })
            // Resolves against the default-branch project-store schema: no userId is
            // passed, so the binding cannot be validated against a user's active branch.
            expect(schemaService.ensureSchema).toHaveBeenCalledWith('metahub-1')
            expect(schemaService.ensureSchema).not.toHaveBeenCalledWith('metahub-1', expect.anything())
        })

        it('returns null when the codename does not resolve (missing or soft-deleted)', async () => {
            const exec = {
                query: jest.fn(async () => [])
            } as unknown as DbExecutor
            const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never)

            await expect(service.resolveBoundProjectByCodename('metahub-1', 'vanished')).resolves.toBeNull()
        })
    })
})
