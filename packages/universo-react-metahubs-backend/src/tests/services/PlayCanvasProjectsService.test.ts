import type { DbExecutor } from '@universo-react/utils'
import { createLocalizedContent } from '@universo-react/utils'
import { PlayCanvasProjectsService } from '../../domains/playcanvas-projects/services/PlayCanvasProjectsService'

const TEST_SCHEMA = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
const PROJECT_ID = '019e8afa-0000-7000-8000-000000000001'
const SCENE_ID = '019e8afa-0000-7000-8000-000000000002'
const ASSET_ID = '019e8afa-0000-7000-8000-000000000003'

const makeSchemaService = () => ({
    ensureSchema: jest.fn(async () => TEST_SCHEMA)
})

const createProjectLookupExecutor = () =>
    ({
        query: jest.fn(async (sql: string) => {
            if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
                return [
                    {
                        id: PROJECT_ID,
                        codename: createLocalizedContent('en', 'playcanvas_project'),
                        displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                        description: null,
                        packageName: '@universo-react/playcanvas-editor',
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

describe('PlayCanvasProjectsService', () => {
    it('uses the metahub default branch schema for project CRUD so package default pointers resolve consistently', async () => {
        const schemaService = {
            ensureSchema: jest.fn(async (_metahubId: string, userId?: string) => (userId ? 'active_branch_schema' : TEST_SCHEMA))
        }
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
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
                            codename: params?.[0],
                            displayName: params?.[1],
                            description: null,
                            packageName: '@universo-react/playcanvas-editor',
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
                if (sql.includes('COUNT(*)::text')) {
                    expect(sql).toContain(`"${TEST_SCHEMA}"`)
                    expect(sql).not.toContain('active_branch_schema')
                    return [{ sceneCount: '0', assetCount: '0', scriptCount: '0', generatedArtifactCount: '0', blockingCount: '0' }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
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
    })

    it('adds a suffix to auto-generated project codenames when the display name repeats', async () => {
        const codenameExistsResults = [true, false]
        const exec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT EXISTS') && sql.includes('_mhb_playcanvas_projects')) {
                    return [{ exists: codenameExistsResults.shift() ?? false }]
                }
                if (sql.includes('INSERT INTO') && sql.includes('_mhb_playcanvas_projects')) {
                    return [
                        {
                            id: PROJECT_ID,
                            codename: params?.[0],
                            displayName: params?.[1],
                            description: null,
                            packageName: '@universo-react/playcanvas-editor',
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
                if (sql.includes('COUNT(*)::text')) {
                    return [{ sceneCount: '0', assetCount: '0', scriptCount: '0', generatedArtifactCount: '0', blockingCount: '0' }]
                }
                throw new Error(`Unexpected SQL: ${sql}`)
            })
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
                            packageName: '@universo-react/playcanvas-editor',
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
                            packageName: '@universo-react/playcanvas-editor',
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
                            packageName: '@universo-react/playcanvas-editor',
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
                            packageName: '@universo-react/playcanvas-editor',
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
                            packageName: '@universo-react/playcanvas-editor',
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
                            packageName: '@universo-react/playcanvas-editor',
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
                            packageName: '@universo-react/playcanvas-editor',
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
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            stat: jest.fn(async () => ({ exists: false, checksum: null, size: null })),
            delete: jest.fn(async () => {
                events.push('delete-file')
            })
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(service.deleteProjectFile('metahub-1', PROJECT_ID, sourcePath, 'user-1')).resolves.toBeUndefined()

        expect(events).toEqual(['mark-scene-missing', 'mark-artifact-missing', 'delete-file'])
        expect(fileService.delete).toHaveBeenCalledWith({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, sourcePath)
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
                            packageName: '@universo-react/playcanvas-editor',
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
            delete: jest.fn(async () => {
                events.push('delete-file')
            })
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(service.deleteAssetFile('metahub-1', PROJECT_ID, ASSET_ID, sourcePath, 'user-1')).resolves.toBeUndefined()

        expect(events).toEqual(['mark-asset-missing', 'delete-file'])
        expect(fileService.delete).toHaveBeenCalledWith({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, sourcePath)
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
                            packageName: '@universo-react/playcanvas-editor',
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
            delete: jest.fn(async () => {
                events.push('delete-file')
                throw new Error('physical delete failed')
            })
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(service.deleteProjectFile('metahub-1', PROJECT_ID, sourcePath, 'user-1')).rejects.toThrow('physical delete failed')

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
                            packageName: '@universo-react/playcanvas-editor',
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
                            packageName: '@universo-react/playcanvas-editor',
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
                            packageName: '@universo-react/playcanvas-editor',
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
            delete: jest.fn(async () => undefined)
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

        expect(fileService.delete).toHaveBeenCalledWith({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, sourcePath)
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
                            packageName: '@universo-react/playcanvas-editor',
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
            delete: jest.fn(async () => undefined)
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

        expect(fileService.delete).toHaveBeenCalledWith({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, sourcePath)
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
                            packageName: '@universo-react/playcanvas-editor',
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
                throw new Error(`Unexpected SQL: ${sql}`)
            })
        } as unknown as DbExecutor
        const fileService = {
            stat: jest.fn(async () => ({ exists: false, checksum: null, size: null })),
            delete: jest.fn()
        }
        const service = new PlayCanvasProjectsService(exec, makeSchemaService() as never, fileService as never)

        await expect(service.deleteProjectFile('metahub-1', PROJECT_ID, sourcePath, 'user-1')).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.metadataUpdateFailed' })
        })

        expect(fileService.delete).not.toHaveBeenCalled()
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
                            packageName: '@universo-react/playcanvas-editor',
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
                            packageName: '@universo-react/playcanvas-editor',
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
})
