import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import type { DbExecutor } from '@universo-react/utils'
import { createLocalizedContent } from '@universo-react/utils'
import {
    PLAYCANVAS_EDITOR_PACKAGE_NAME,
    PLAYCANVAS_PROJECT_FILE_ROOT,
    PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION,
    type PlayCanvasProjectSnapshotSection
} from '@universo-react/types'
import {
    computePlayCanvasProjectFileChecksum,
    PlayCanvasProjectFileService
} from '../../domains/playcanvas-projects/services/PlayCanvasProjectFileService'
import { PlayCanvasProjectSnapshotService } from '../../domains/playcanvas-projects/services/PlayCanvasProjectSnapshotService'

const makeExec = (responses: Record<string, unknown[]>): DbExecutor =>
    ({
        query: jest.fn(async (sql: string) => {
            if (sql.includes('information_schema.tables')) return responses.storageTables ?? [{ exists: true }]
            if (sql.includes('_mhb_playcanvas_scene_script_bindings')) return responses.bindings ?? []
            if (sql.includes('_mhb_playcanvas_generated_artifacts')) return responses.generatedArtifacts ?? []
            if (sql.includes('_mhb_playcanvas_script_assets')) return responses.scriptAssets ?? []
            if (sql.includes('_mhb_playcanvas_assets')) return responses.assets ?? []
            if (sql.includes('_mhb_playcanvas_scenes')) return responses.scenes ?? []
            if (sql.includes('_mhb_playcanvas_publication_manifests')) return responses.manifests ?? []
            if (sql.includes('_mhb_playcanvas_sourcefiles')) return responses.sourceFiles ?? []
            if (sql.includes('_mhb_playcanvas_projects')) return responses.projects ?? []
            return []
        })
    } as unknown as DbExecutor)

const TEST_SCHEMA = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'

const makeSchemaService = () => ({ ensureSchema: jest.fn(async () => TEST_SCHEMA) })

describe('PlayCanvasProjectSnapshotService', () => {
    it('treats missing PlayCanvas storage tables as an empty export section', async () => {
        const exec = makeExec({ storageTables: [{ exists: false }] })
        const service = new PlayCanvasProjectSnapshotService(exec, makeSchemaService() as never)

        await expect(service.exportSnapshotFromSchema('metahub-1', TEST_SCHEMA)).resolves.toBeUndefined()

        expect(jest.mocked(exec.query)).toHaveBeenCalledTimes(1)
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('information_schema.tables')
    })

    it('exports PlayCanvas project metadata with local file payloads', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-snapshot-'))
        const fileService = new PlayCanvasProjectFileService(root)
        const scenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/scene-1.json`
        const assetPath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/assets/ship.mjs`
        const artifactPath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/generated/artifact-1.mjs`
        const writtenScene = await fileService.write({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, scenePath, '{"entities":[]}')
        const writtenAsset = await fileService.write({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, assetPath, 'export class Ship {}')
        await fileService.write({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, artifactPath, 'export default class Ship {}')

        const service = new PlayCanvasProjectSnapshotService(
            makeExec({
                projects: [
                    {
                        id: 'project-1',
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        compatibilityStatus: 'compatible',
                        schemaVersion: '1',
                        settings: {},
                        publicationConfig: {}
                    }
                ],
                scenes: [
                    {
                        id: 'scene-1',
                        projectId: 'project-1',
                        codename: createLocalizedContent('en', 'scene_one'),
                        displayName: createLocalizedContent('en', 'Scene One'),
                        payloadSchemaVersion: '1',
                        payloadFile: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: scenePath,
                            hash: writtenScene.checksum
                        },
                        sortOrder: 0,
                        publish: true
                    }
                ],
                assets: [
                    {
                        id: 'asset-1',
                        projectId: 'project-1',
                        stableAssetId: 'script-asset-1',
                        type: 'script',
                        name: 'Ship',
                        virtualPath: ['scripts'],
                        file: { provider: 'local', root: PLAYCANVAS_PROJECT_FILE_ROOT, path: assetPath, hash: writtenAsset.checksum },
                        metadata: {},
                        publish: true
                    }
                ],
                scriptAssets: [
                    {
                        id: 'script-1',
                        assetId: 'asset-1',
                        scriptName: 'Ship',
                        scriptKind: 'esm',
                        parsedAttributes: {},
                        parseStatus: 'ready'
                    }
                ],
                bindings: [],
                generatedArtifacts: [
                    {
                        id: 'artifact-1',
                        scriptAssetId: 'script-1',
                        outputFile: { provider: 'local', root: PLAYCANVAS_PROJECT_FILE_ROOT, path: artifactPath },
                        scriptName: 'Ship',
                        scriptKind: 'esm',
                        parseStatus: 'ready'
                    }
                ],
                manifests: [
                    {
                        runtimeManifest: {
                            schemaVersion: 1,
                            projectId: 'stale-project',
                            sceneId: null,
                            checksum: 'stale',
                            assets: [],
                            scripts: []
                        }
                    }
                ]
            }),
            makeSchemaService() as never,
            fileService
        )

        const snapshot = await service.exportSnapshot('metahub-1', { includeRuntimeManifests: true })

        expect(snapshot?.schemaVersion).toBe(PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION)
        expect(snapshot?.projects).toHaveLength(1)
        expect(snapshot?.scenes[0].payload).toEqual({ entities: [] })
        expect(snapshot?.scenes[0].payloadFile?.hash).toBe(writtenScene.checksum)
        expect(snapshot?.scenes[0].payloadFile?.snapshotContentBase64).toBe(Buffer.from('{"entities":[]}').toString('base64'))
        expect(snapshot?.generatedArtifacts[0].outputFile.snapshotContentBase64).toBe(
            Buffer.from('export default class Ship {}').toString('base64')
        )
        expect(snapshot?.runtimeManifests).toHaveLength(1)
        expect(snapshot?.runtimeManifests?.[0].projectId).toBe('project-1')
        expect(snapshot?.runtimeManifests?.[0].sceneId).toBe('scene-1')
        expect(snapshot?.runtimeManifests?.[0].assets).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'scene:scene-1',
                    type: 'scene',
                    url: `data:application/octet-stream;base64,${Buffer.from('{"entities":[]}').toString('base64')}`,
                    hash: writtenScene.checksum
                }),
                expect.objectContaining({
                    id: 'script-asset-1',
                    type: 'script',
                    url: `data:application/octet-stream;base64,${Buffer.from('export class Ship {}').toString('base64')}`,
                    hash: writtenAsset.checksum
                })
            ])
        )
        expect(snapshot?.runtimeManifests?.[0].scripts[0].scriptName).toBe('Ship')
        expect(snapshot?.runtimeManifests?.[0].scripts[0].artifactUrl).toBe(
            `data:application/octet-stream;base64,${Buffer.from('export default class Ship {}').toString('base64')}`
        )

        await fs.rm(root, { recursive: true, force: true })
    })

    it('strips private PlayCanvas Editor user data from exported project settings', async () => {
        const service = new PlayCanvasProjectSnapshotService(
            makeExec({
                projects: [
                    {
                        id: 'project-1',
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        compatibilityStatus: 'compatible',
                        schemaVersion: '1',
                        settings: {
                            playCanvasEditorRealtime: {
                                documents: { project_123: { data: { width: 1280 }, version: 1 } },
                                userDataDocuments: { legacy: { data: { cameras: {} }, version: 1 } },
                                userDataDocumentsByScene: { 'scene-1': { 'user-1': { data: { cameras: {} }, version: 2 } } }
                            }
                        },
                        publicationConfig: {}
                    }
                ]
            }),
            makeSchemaService() as never
        )

        const snapshot = await service.exportSnapshotFromSchema('metahub-1', TEST_SCHEMA)
        expect(snapshot?.projects[0]?.settings).toEqual({
            playCanvasEditorRealtime: {
                documents: { project_123: { data: { width: 1280 }, version: 1 } }
            }
        })
    })

    it('exports a single project snapshot before runtime manifest generation so broken sibling projects do not block it', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-snapshot-scoped-'))
        const fileService = new PlayCanvasProjectFileService(root)
        const healthyScenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/scene-1.json`
        const brokenScenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-2/scenes/broken.json`
        const writtenHealthyScene = await fileService.write(
            { metahubId: 'metahub-1', branchSlug: TEST_SCHEMA },
            healthyScenePath,
            '{"entities":[]}'
        )
        const rows = {
            projects: [
                {
                    id: 'project-1',
                    codename: createLocalizedContent('en', 'project_one'),
                    displayName: createLocalizedContent('en', 'Project One'),
                    packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                    compatibilityStatus: 'compatible',
                    schemaVersion: '1',
                    settings: {},
                    defaultSceneId: 'scene-1',
                    publicationConfig: {}
                },
                {
                    id: 'project-2',
                    codename: createLocalizedContent('en', 'project_two'),
                    displayName: createLocalizedContent('en', 'Project Two'),
                    packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                    compatibilityStatus: 'compatible',
                    schemaVersion: '1',
                    settings: {},
                    defaultSceneId: 'broken-scene',
                    publicationConfig: {}
                }
            ],
            scenes: [
                {
                    id: 'scene-1',
                    projectId: 'project-1',
                    codename: createLocalizedContent('en', 'scene_one'),
                    displayName: createLocalizedContent('en', 'Scene One'),
                    payloadSchemaVersion: '1',
                    payloadFile: {
                        provider: 'local',
                        root: PLAYCANVAS_PROJECT_FILE_ROOT,
                        path: healthyScenePath,
                        hash: writtenHealthyScene.checksum
                    },
                    sortOrder: 0,
                    publish: true
                },
                {
                    id: 'broken-scene',
                    projectId: 'project-2',
                    codename: createLocalizedContent('en', 'broken_scene'),
                    displayName: createLocalizedContent('en', 'Broken Scene'),
                    payloadSchemaVersion: '1',
                    payloadFile: {
                        provider: 'local',
                        root: PLAYCANVAS_PROJECT_FILE_ROOT,
                        path: brokenScenePath,
                        hash: computePlayCanvasProjectFileChecksum('{"missing":true}'),
                        status: 'processing'
                    },
                    sortOrder: 0,
                    publish: true
                }
            ],
            assets: [],
            scriptAssets: [],
            bindings: [],
            generatedArtifacts: []
        }
        const scopedExec = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('information_schema.tables')) return [{ exists: true }]
                const scopedProjectIds = Array.isArray(params?.[0]) ? new Set(params[0] as string[]) : null
                const byProject = <T extends { projectId?: string; id?: string }>(items: T[]) => {
                    if (!scopedProjectIds) return items
                    return items.filter((item) => scopedProjectIds.has(item.projectId ?? item.id ?? ''))
                }
                if (sql.includes('_mhb_playcanvas_scene_script_bindings')) return rows.bindings
                if (sql.includes('_mhb_playcanvas_generated_artifacts')) return rows.generatedArtifacts
                if (sql.includes('_mhb_playcanvas_script_assets')) return rows.scriptAssets
                if (sql.includes('_mhb_playcanvas_assets')) return byProject(rows.assets)
                if (sql.includes('_mhb_playcanvas_scenes')) return byProject(rows.scenes)
                if (sql.includes('_mhb_playcanvas_sourcefiles')) return []
                if (sql.includes('_mhb_playcanvas_projects')) return byProject(rows.projects)
                return []
            })
        } as unknown as DbExecutor
        const service = new PlayCanvasProjectSnapshotService(scopedExec, makeSchemaService() as never, fileService)

        const snapshot = await service.exportProjectSnapshot('metahub-1', 'project-1')

        expect(snapshot?.projects).toHaveLength(1)
        expect(snapshot?.projects[0].id).toBe('project-1')
        expect(snapshot?.scenes.map((scene) => scene.id)).toEqual(['scene-1'])
        expect(snapshot?.runtimeManifests).toHaveLength(1)
        expect(snapshot?.runtimeManifests?.[0].projectId).toBe('project-1')
        expect(jest.mocked(scopedExec.query).mock.calls.some((call) => String(call[0]).includes('p.id::text = ANY($1::text[])'))).toBe(true)
        expect(
            jest
                .mocked(scopedExec.query)
                .mock.calls.filter((call) => !String(call[0]).includes('information_schema.tables'))
                .every((call) => (call[1]?.[0] as string[] | undefined)?.[0] === 'project-1')
        ).toBe(true)

        await fs.rm(root, { recursive: true, force: true })
    })

    it('preserves not-ready PlayCanvas projects in authoring snapshots without generating runtime manifests', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-snapshot-authoring-not-ready-'))
        const fileService = new PlayCanvasProjectFileService(root)
        const scenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/draft.json`
        const writtenScene = await fileService.write({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, scenePath, '{"draft":true}')
        const service = new PlayCanvasProjectSnapshotService(
            makeExec({
                projects: [
                    {
                        id: 'project-1',
                        codename: createLocalizedContent('en', 'draft_project'),
                        displayName: createLocalizedContent('en', 'Draft Project'),
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        compatibilityStatus: 'compatible',
                        schemaVersion: '1',
                        settings: {},
                        defaultSceneId: 'scene-draft',
                        publicationConfig: {}
                    }
                ],
                scenes: [
                    {
                        id: 'scene-draft',
                        projectId: 'project-1',
                        codename: createLocalizedContent('en', 'draft_scene'),
                        displayName: createLocalizedContent('en', 'Draft Scene'),
                        payloadSchemaVersion: '1',
                        payloadFile: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: scenePath,
                            hash: writtenScene.checksum,
                            status: 'processing'
                        },
                        sortOrder: 0,
                        publish: true
                    }
                ]
            }),
            makeSchemaService() as never,
            fileService
        )

        const snapshot = await service.exportSnapshot('metahub-1')

        expect(snapshot?.projects).toHaveLength(1)
        expect(snapshot?.scenes[0].payloadFile?.status).toBe('processing')
        expect(snapshot?.scenes[0].payloadFile?.snapshotContentBase64).toBe(Buffer.from('{"draft":true}').toString('base64'))
        expect(snapshot?.runtimeManifests).toBeUndefined()

        await fs.rm(root, { recursive: true, force: true })
    })

    it('rejects runtime publication for a selected PlayCanvas project without a publishable scene', async () => {
        const service = new PlayCanvasProjectSnapshotService(
            makeExec({
                projects: [
                    {
                        id: 'project-1',
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        compatibilityStatus: 'compatible',
                        schemaVersion: '1',
                        settings: {},
                        defaultSceneId: null,
                        publicationConfig: {}
                    }
                ],
                scenes: []
            }),
            makeSchemaService() as never
        )

        await expect(service.exportProjectSnapshot('metahub-1', 'project-1')).rejects.toMatchObject({
            details: expect.objectContaining({
                messageCode: 'playcanvas.runtime.publishableSceneRequired',
                projectId: 'project-1'
            })
        })
    })

    it('persists generated runtime manifests when publishing PlayCanvas project snapshots', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-snapshot-published-manifest-'))
        const fileService = new PlayCanvasProjectFileService(root)
        const scenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/scene.json`
        const scenePayload = {
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
            entities: []
        }
        const writtenScene = await fileService.write(
            { metahubId: 'metahub-1', branchSlug: TEST_SCHEMA },
            scenePath,
            JSON.stringify(scenePayload)
        )
        const exec = makeExec({
            projects: [
                {
                    id: 'project-1',
                    codename: createLocalizedContent('en', 'project_one'),
                    displayName: createLocalizedContent('en', 'Project One'),
                    packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                    compatibilityStatus: 'compatible',
                    schemaVersion: '1',
                    settings: {},
                    defaultSceneId: 'scene-1',
                    publicationConfig: {}
                }
            ],
            scenes: [
                {
                    id: 'scene-1',
                    projectId: 'project-1',
                    codename: createLocalizedContent('en', 'scene_one'),
                    displayName: createLocalizedContent('en', 'Scene One'),
                    payloadSchemaVersion: '1',
                    payloadFile: {
                        provider: 'local',
                        root: PLAYCANVAS_PROJECT_FILE_ROOT,
                        path: scenePath,
                        hash: writtenScene.checksum
                    },
                    sortOrder: 0,
                    publish: true
                }
            ],
            assets: []
        })
        const service = new PlayCanvasProjectSnapshotService(exec, makeSchemaService() as never, fileService)

        const snapshot = await service.exportSnapshotFromSchema('metahub-1', TEST_SCHEMA, {
            includeRuntimeManifests: true,
            projectIds: ['project-1']
        })

        expect(snapshot?.runtimeManifests).toHaveLength(1)
        expect(snapshot?.runtimeManifests?.[0].metadata?.mmoomm?.scene).toEqual(scenePayload.metadata.mmoomm.scene)
        const manifestCalls = jest
            .mocked(exec.query)
            .mock.calls.filter(([sql]) => String(sql).includes('_mhb_playcanvas_publication_manifests'))
        expect(manifestCalls).toHaveLength(0)

        await fs.rm(root, { recursive: true, force: true })
    })

    it('fails closed when a requested PlayCanvas project id is missing during snapshot export', async () => {
        const service = new PlayCanvasProjectSnapshotService(
            makeExec({
                projects: [
                    {
                        id: 'project-1',
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        packageVersion: '0.1.0',
                        compatibilityStatus: 'compatible',
                        compatibilityNotes: {},
                        schemaVersion: '1',
                        settings: {},
                        defaultSceneId: null,
                        publicationConfig: {}
                    }
                ]
            }),
            makeSchemaService() as never
        )

        await expect(
            service.exportSnapshotFromSchema('metahub-1', TEST_SCHEMA, {
                includeRuntimeManifests: true,
                projectIds: ['project-1', 'missing-project']
            })
        ).rejects.toMatchObject({
            details: expect.objectContaining({
                messageCode: 'playcanvas.snapshot.projectNotFound',
                projectIds: ['missing-project']
            })
        })
    })

    it('does not let unpublished draft files block runtime manifest export', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-snapshot-unpublished-draft-'))
        const fileService = new PlayCanvasProjectFileService(root)
        const publishedScenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/published.json`
        const unpublishedScenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/draft-missing.json`
        const writtenScene = await fileService.write(
            { metahubId: 'metahub-1', branchSlug: TEST_SCHEMA },
            publishedScenePath,
            '{"published":true}'
        )
        const service = new PlayCanvasProjectSnapshotService(
            makeExec({
                projects: [
                    {
                        id: 'project-1',
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        compatibilityStatus: 'compatible',
                        schemaVersion: '1',
                        settings: {},
                        defaultSceneId: 'scene-published',
                        publicationConfig: {}
                    }
                ],
                scenes: [
                    {
                        id: 'scene-published',
                        projectId: 'project-1',
                        codename: createLocalizedContent('en', 'published_scene'),
                        displayName: createLocalizedContent('en', 'Published Scene'),
                        payloadSchemaVersion: '1',
                        payloadFile: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: publishedScenePath,
                            hash: writtenScene.checksum
                        },
                        sortOrder: 0,
                        publish: true
                    },
                    {
                        id: 'scene-draft',
                        projectId: 'project-1',
                        codename: createLocalizedContent('en', 'draft_scene'),
                        displayName: createLocalizedContent('en', 'Draft Scene'),
                        payloadSchemaVersion: '1',
                        payloadFile: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: unpublishedScenePath,
                            hash: computePlayCanvasProjectFileChecksum('{"missing":true}')
                        },
                        sortOrder: 1,
                        publish: false
                    }
                ]
            }),
            makeSchemaService() as never,
            fileService
        )

        const snapshot = await service.exportProjectSnapshot('metahub-1', 'project-1')

        expect(snapshot?.scenes.map((scene) => scene.id)).toEqual(['scene-published', 'scene-draft'])
        expect(snapshot?.runtimeManifests?.[0].sceneId).toBe('scene-published')
        expect(snapshot?.runtimeManifests?.[0].assets.map((asset) => asset.id)).toContain('scene:scene-published')
        expect(snapshot?.runtimeManifests?.[0].assets.map((asset) => asset.id)).not.toContain('scene:scene-draft')

        await fs.rm(root, { recursive: true, force: true })
    })

    it('skips publishable metadata-only assets that do not have resolved runtime files', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-snapshot-metadata-asset-'))
        const fileService = new PlayCanvasProjectFileService(root)
        const scenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/scene.json`
        const writtenScene = await fileService.write({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, scenePath, '{"scene":true}')
        const service = new PlayCanvasProjectSnapshotService(
            makeExec({
                projects: [
                    {
                        id: 'project-1',
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        compatibilityStatus: 'compatible',
                        schemaVersion: '1',
                        settings: {},
                        defaultSceneId: 'scene-1',
                        publicationConfig: {}
                    }
                ],
                scenes: [
                    {
                        id: 'scene-1',
                        projectId: 'project-1',
                        codename: createLocalizedContent('en', 'scene_one'),
                        displayName: createLocalizedContent('en', 'Scene One'),
                        payloadSchemaVersion: '1',
                        payloadFile: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: scenePath,
                            hash: writtenScene.checksum
                        },
                        sortOrder: 0,
                        publish: true
                    }
                ],
                assets: [
                    {
                        id: 'asset-placeholder',
                        projectId: 'project-1',
                        stableAssetId: 'texture-placeholder',
                        type: 'texture',
                        name: 'Texture Placeholder',
                        virtualPath: ['textures'],
                        file: null,
                        metadata: {},
                        publish: true
                    }
                ]
            }),
            makeSchemaService() as never,
            fileService
        )

        const snapshot = await service.exportProjectSnapshot('metahub-1', 'project-1')

        expect(snapshot?.runtimeManifests?.[0].assets.map((asset) => asset.id)).toEqual(['scene:scene-1'])

        await fs.rm(root, { recursive: true, force: true })
    })

    it('rejects exported script rows whose asset owner is outside the exported project set', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-snapshot-orphan-script-'))
        const fileService = new PlayCanvasProjectFileService(root)
        const scenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/scene.json`
        const writtenScene = await fileService.write({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, scenePath, '{"scene":true}')
        const service = new PlayCanvasProjectSnapshotService(
            makeExec({
                projects: [
                    {
                        id: 'project-1',
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        compatibilityStatus: 'compatible',
                        schemaVersion: '1',
                        settings: {},
                        defaultSceneId: 'scene-1',
                        publicationConfig: {}
                    }
                ],
                scenes: [
                    {
                        id: 'scene-1',
                        projectId: 'project-1',
                        codename: createLocalizedContent('en', 'scene_one'),
                        displayName: createLocalizedContent('en', 'Scene One'),
                        payloadSchemaVersion: '1',
                        payloadFile: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: scenePath,
                            hash: writtenScene.checksum
                        },
                        sortOrder: 0,
                        publish: true
                    }
                ],
                scriptAssets: [
                    {
                        id: 'script-orphan',
                        assetId: 'asset-outside-export',
                        scriptName: 'Orphan',
                        scriptKind: 'esm',
                        parsedAttributes: {},
                        parseStatus: 'ready'
                    }
                ]
            }),
            makeSchemaService() as never,
            fileService
        )

        await expect(service.exportSnapshot('metahub-1')).rejects.toMatchObject({
            details: expect.objectContaining({
                messageCode: 'playcanvas.snapshot.missingAssetReference',
                sourceId: 'asset-outside-export'
            })
        })

        await fs.rm(root, { recursive: true, force: true })
    })

    it('fails runtime manifest generation when the default scene file is not ready instead of selecting another scene', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-snapshot-default-scene-not-ready-'))
        const fileService = new PlayCanvasProjectFileService(root)
        const defaultScenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/default.json`
        const fallbackScenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/fallback.json`
        const writtenDefaultScene = await fileService.write(
            { metahubId: 'metahub-1', branchSlug: TEST_SCHEMA },
            defaultScenePath,
            '{"name":"default"}'
        )
        const writtenFallbackScene = await fileService.write(
            { metahubId: 'metahub-1', branchSlug: TEST_SCHEMA },
            fallbackScenePath,
            '{"name":"fallback"}'
        )
        const service = new PlayCanvasProjectSnapshotService(
            makeExec({
                projects: [
                    {
                        id: 'project-1',
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        compatibilityStatus: 'compatible',
                        schemaVersion: '1',
                        settings: {},
                        defaultSceneId: 'scene-default',
                        publicationConfig: {}
                    }
                ],
                scenes: [
                    {
                        id: 'scene-default',
                        projectId: 'project-1',
                        codename: createLocalizedContent('en', 'default_scene'),
                        displayName: createLocalizedContent('en', 'Default Scene'),
                        payloadSchemaVersion: '1',
                        payloadFile: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: defaultScenePath,
                            hash: writtenDefaultScene.checksum
                        },
                        sortOrder: 0,
                        publish: true,
                        status: 'processing'
                    },
                    {
                        id: 'scene-fallback',
                        projectId: 'project-1',
                        codename: createLocalizedContent('en', 'fallback_scene'),
                        displayName: createLocalizedContent('en', 'Fallback Scene'),
                        payloadSchemaVersion: '1',
                        payloadFile: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: fallbackScenePath,
                            hash: writtenFallbackScene.checksum
                        },
                        sortOrder: 1,
                        publish: true
                    }
                ]
            }),
            makeSchemaService() as never,
            fileService
        )

        await expect(service.exportSnapshot('metahub-1', { includeRuntimeManifests: true })).rejects.toMatchObject({
            details: expect.objectContaining({
                messageCode: 'playcanvas.runtime.sceneFileNotReady',
                sceneId: 'scene-default'
            })
        })

        await fs.rm(root, { recursive: true, force: true })
    })

    it('selects the first runtime-ready publishable scene when no default scene is configured', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-snapshot-runtime-ready-fallback-'))
        const fileService = new PlayCanvasProjectFileService(root)
        const draftScenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/draft.json`
        const readyScenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/ready.json`
        const writtenDraftScene = await fileService.write(
            { metahubId: 'metahub-1', branchSlug: TEST_SCHEMA },
            draftScenePath,
            '{"name":"draft"}'
        )
        const writtenReadyScene = await fileService.write(
            { metahubId: 'metahub-1', branchSlug: TEST_SCHEMA },
            readyScenePath,
            '{"name":"ready"}'
        )
        const service = new PlayCanvasProjectSnapshotService(
            makeExec({
                projects: [
                    {
                        id: 'project-1',
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        compatibilityStatus: 'compatible',
                        schemaVersion: '1',
                        settings: {},
                        defaultSceneId: null,
                        publicationConfig: {}
                    }
                ],
                scenes: [
                    {
                        id: 'scene-draft',
                        projectId: 'project-1',
                        codename: createLocalizedContent('en', 'draft_scene'),
                        displayName: createLocalizedContent('en', 'Draft Scene'),
                        payloadSchemaVersion: '1',
                        payloadFile: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: draftScenePath,
                            hash: writtenDraftScene.checksum
                        },
                        sortOrder: 0,
                        publish: true,
                        status: 'processing'
                    },
                    {
                        id: 'scene-ready',
                        projectId: 'project-1',
                        codename: createLocalizedContent('en', 'ready_scene'),
                        displayName: createLocalizedContent('en', 'Ready Scene'),
                        payloadSchemaVersion: '1',
                        payloadFile: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: readyScenePath,
                            hash: writtenReadyScene.checksum
                        },
                        sortOrder: 1,
                        publish: true,
                        status: 'ready'
                    }
                ]
            }),
            makeSchemaService() as never,
            fileService
        )

        const snapshot = await service.exportSnapshot('metahub-1', { includeRuntimeManifests: true })

        expect(snapshot?.runtimeManifests?.[0]?.sceneId).toBe('scene-ready')

        await fs.rm(root, { recursive: true, force: true })
    })

    it('fails runtime manifest generation when the selected publishable scene has no resolved file', async () => {
        const service = new PlayCanvasProjectSnapshotService(
            makeExec({
                projects: [
                    {
                        id: 'project-1',
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        compatibilityStatus: 'compatible',
                        schemaVersion: '1',
                        settings: {},
                        defaultSceneId: 'scene-1',
                        publicationConfig: {}
                    }
                ],
                scenes: [
                    {
                        id: 'scene-1',
                        projectId: 'project-1',
                        codename: createLocalizedContent('en', 'scene_one'),
                        displayName: createLocalizedContent('en', 'Scene One'),
                        payloadSchemaVersion: '1',
                        payloadFile: null,
                        sortOrder: 0,
                        publish: true
                    }
                ]
            }),
            makeSchemaService() as never
        )

        await expect(service.exportSnapshot('metahub-1', { includeRuntimeManifests: true })).rejects.toMatchObject({
            details: expect.objectContaining({
                messageCode: 'playcanvas.runtime.sceneFileNotReady',
                sceneId: 'scene-1'
            })
        })
    })

    it('fails runtime manifest generation when a publishable asset file is not ready', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-snapshot-asset-not-ready-'))
        const fileService = new PlayCanvasProjectFileService(root)
        const scenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/scene.json`
        const assetPath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/assets/texture.json`
        const writtenScene = await fileService.write({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, scenePath, '{"entities":[]}')
        const writtenAsset = await fileService.write({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, assetPath, '{"texture":true}')
        const service = new PlayCanvasProjectSnapshotService(
            makeExec({
                projects: [
                    {
                        id: 'project-1',
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        compatibilityStatus: 'compatible',
                        schemaVersion: '1',
                        settings: {},
                        defaultSceneId: 'scene-1',
                        publicationConfig: {}
                    }
                ],
                scenes: [
                    {
                        id: 'scene-1',
                        projectId: 'project-1',
                        codename: createLocalizedContent('en', 'scene_one'),
                        displayName: createLocalizedContent('en', 'Scene One'),
                        payloadSchemaVersion: '1',
                        payloadFile: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: scenePath,
                            hash: writtenScene.checksum
                        },
                        sortOrder: 0,
                        publish: true
                    }
                ],
                assets: [
                    {
                        id: 'asset-1',
                        projectId: 'project-1',
                        stableAssetId: 'texture-1',
                        type: 'texture',
                        name: 'Texture',
                        virtualPath: ['textures'],
                        file: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: assetPath,
                            hash: writtenAsset.checksum
                        },
                        metadata: {},
                        publish: true,
                        status: 'processing'
                    }
                ]
            }),
            makeSchemaService() as never,
            fileService
        )

        await expect(service.exportSnapshot('metahub-1', { includeRuntimeManifests: true })).rejects.toMatchObject({
            details: expect.objectContaining({
                messageCode: 'playcanvas.runtime.assetFileNotReady',
                assetId: 'asset-1'
            })
        })

        await fs.rm(root, { recursive: true, force: true })
    })

    it('fails runtime manifest generation when a script artifact file is not ready', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-snapshot-script-artifact-not-ready-'))
        const fileService = new PlayCanvasProjectFileService(root)
        const scenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/scene.json`
        const assetPath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/assets/ship.mjs`
        const artifactPath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/generated/ship.mjs`
        const writtenScene = await fileService.write({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, scenePath, '{"entities":[]}')
        const writtenAsset = await fileService.write({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, assetPath, 'export class Ship {}')
        const writtenArtifact = await fileService.write(
            { metahubId: 'metahub-1', branchSlug: TEST_SCHEMA },
            artifactPath,
            'export default class Ship {}'
        )
        const service = new PlayCanvasProjectSnapshotService(
            makeExec({
                projects: [
                    {
                        id: 'project-1',
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        compatibilityStatus: 'compatible',
                        schemaVersion: '1',
                        settings: {},
                        defaultSceneId: 'scene-1',
                        publicationConfig: {}
                    }
                ],
                scenes: [
                    {
                        id: 'scene-1',
                        projectId: 'project-1',
                        codename: createLocalizedContent('en', 'scene_one'),
                        displayName: createLocalizedContent('en', 'Scene One'),
                        payloadSchemaVersion: '1',
                        payloadFile: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: scenePath,
                            hash: writtenScene.checksum
                        },
                        sortOrder: 0,
                        publish: true
                    }
                ],
                assets: [
                    {
                        id: 'asset-1',
                        projectId: 'project-1',
                        stableAssetId: 'script-asset-1',
                        type: 'script',
                        name: 'Ship',
                        virtualPath: ['scripts'],
                        file: { provider: 'local', root: PLAYCANVAS_PROJECT_FILE_ROOT, path: assetPath, hash: writtenAsset.checksum },
                        metadata: {},
                        publish: true
                    }
                ],
                scriptAssets: [
                    {
                        id: 'script-1',
                        assetId: 'asset-1',
                        scriptName: 'Ship',
                        scriptKind: 'esm',
                        parsedAttributes: {},
                        parseStatus: 'ready'
                    }
                ],
                generatedArtifacts: [
                    {
                        id: 'artifact-1',
                        scriptAssetId: 'script-1',
                        outputFile: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: artifactPath,
                            hash: writtenArtifact.checksum,
                            status: 'processing'
                        },
                        scriptName: 'Ship',
                        scriptKind: 'esm',
                        parseStatus: 'ready'
                    }
                ]
            }),
            makeSchemaService() as never,
            fileService
        )

        await expect(service.exportSnapshot('metahub-1', { includeRuntimeManifests: true })).rejects.toMatchObject({
            details: expect.objectContaining({
                messageCode: 'playcanvas.runtime.scriptArtifactFileNotReady',
                artifactId: 'artifact-1'
            })
        })

        await fs.rm(root, { recursive: true, force: true })
    })

    it('fails snapshot export when a local file checksum drifts from stored metadata', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-snapshot-drift-'))
        const fileService = new PlayCanvasProjectFileService(root)
        const scenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/scene-1.json`
        await fileService.write({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, scenePath, '{"changed":true}')

        const service = new PlayCanvasProjectSnapshotService(
            makeExec({
                projects: [
                    {
                        id: 'project-1',
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        compatibilityStatus: 'compatible',
                        schemaVersion: '1',
                        settings: {},
                        publicationConfig: {}
                    }
                ],
                scenes: [
                    {
                        id: 'scene-1',
                        projectId: 'project-1',
                        codename: createLocalizedContent('en', 'scene_one'),
                        displayName: createLocalizedContent('en', 'Scene One'),
                        payloadSchemaVersion: '1',
                        payloadFile: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: scenePath,
                            hash: computePlayCanvasProjectFileChecksum('{"expected":true}')
                        },
                        sortOrder: 0,
                        publish: true
                    }
                ]
            }),
            makeSchemaService() as never,
            fileService
        )

        await expect(service.exportSnapshot('metahub-1')).rejects.toMatchObject({
            details: expect.objectContaining({
                messageCode: 'playcanvas.files.path.checksumMismatch',
                expectedChecksum: computePlayCanvasProjectFileChecksum('{"expected":true}')
            })
        })

        await fs.rm(root, { recursive: true, force: true })
    })

    it('preserves missing local file references in authoring snapshots without requiring bundled content', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-snapshot-recovery-missing-'))
        const fileService = new PlayCanvasProjectFileService(root)
        const scenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/missing.json`
        const service = new PlayCanvasProjectSnapshotService(
            makeExec({
                projects: [
                    {
                        id: 'project-1',
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        compatibilityStatus: 'compatible',
                        schemaVersion: '1',
                        settings: {},
                        publicationConfig: {}
                    }
                ],
                scenes: [
                    {
                        id: 'scene-1',
                        projectId: 'project-1',
                        codename: createLocalizedContent('en', 'scene_one'),
                        displayName: createLocalizedContent('en', 'Scene One'),
                        payloadSchemaVersion: '1',
                        payloadFile: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: scenePath,
                            hash: null,
                            status: 'missing'
                        },
                        sortOrder: 0,
                        publish: true
                    }
                ]
            }),
            makeSchemaService() as never,
            fileService
        )

        const snapshot = await service.exportSnapshot('metahub-1')

        expect(snapshot?.scenes[0].payloadFile).toMatchObject({
            path: scenePath,
            status: 'missing',
            snapshotContentBase64: null
        })

        await fs.rm(root, { recursive: true, force: true })
    })

    it('fails snapshot export when a referenced local file is missing', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-snapshot-missing-'))
        const fileService = new PlayCanvasProjectFileService(root)
        const scenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/missing.json`
        const service = new PlayCanvasProjectSnapshotService(
            makeExec({
                projects: [
                    {
                        id: 'project-1',
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        compatibilityStatus: 'compatible',
                        schemaVersion: '1',
                        settings: {},
                        publicationConfig: {}
                    }
                ],
                scenes: [
                    {
                        id: 'scene-1',
                        projectId: 'project-1',
                        codename: createLocalizedContent('en', 'scene_one'),
                        displayName: createLocalizedContent('en', 'Scene One'),
                        payloadSchemaVersion: '1',
                        payloadFile: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: scenePath,
                            hash: null
                        },
                        sortOrder: 0,
                        publish: true
                    }
                ]
            }),
            makeSchemaService() as never,
            fileService
        )

        await expect(service.exportSnapshot('metahub-1')).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.path.missing', sourcePath: scenePath })
        })

        await fs.rm(root, { recursive: true, force: true })
    })

    it('collects local file candidates for stale cleanup before snapshot restore replaces rows', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-snapshot-stale-'))
        const fileService = new PlayCanvasProjectFileService(root)
        const scenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/project-1/scenes/scene-1.json`
        await fileService.write({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, scenePath, '{"stale":true}')

        const service = new PlayCanvasProjectSnapshotService(
            {
                query: jest.fn(async () => [
                    {
                        fileRef: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: scenePath
                        }
                    }
                ])
            } as unknown as DbExecutor,
            makeSchemaService() as never,
            fileService
        )

        const candidates = await service.collectStoredLocalFileCandidates('metahub-1', TEST_SCHEMA)

        expect(candidates.get(scenePath)?.checksum).toBeTruthy()

        await fs.rm(root, { recursive: true, force: true })
    })

    it('rejects unsupported future snapshot section versions before restore writes rows', async () => {
        const insert = jest.fn()
        const del = jest.fn()
        const trx = {
            withSchema: jest.fn(() => ({
                from: jest.fn(() => ({ del })),
                into: jest.fn(() => ({ insert }))
            }))
        }
        const service = new PlayCanvasProjectSnapshotService(makeExec({}), makeSchemaService() as never)
        const snapshot = {
            schemaVersion: 999,
            projects: [],
            scenes: [],
            assets: [],
            scriptAssets: [],
            sceneScriptBindings: [],
            generatedArtifacts: []
        } as unknown as PlayCanvasProjectSnapshotSection

        await expect(
            service.restoreSnapshot({
                trx: trx as never,
                metahubId: 'metahub-1',
                schemaName: TEST_SCHEMA,
                snapshot,
                moduleIdMap: new Map(),
                entityIdMap: new Map(),
                userId: 'user-1'
            })
        ).rejects.toMatchObject({ details: expect.objectContaining({ messageCode: 'playcanvas.snapshot.unsupportedVersion' }) })
        expect(insert).not.toHaveBeenCalled()
        expect(del).not.toHaveBeenCalled()
    })

    it('skips restore cleanup when the PlayCanvas snapshot section is absent', async () => {
        const del = jest.fn()
        const trx = {
            withSchema: jest.fn(() => ({
                from: jest.fn(() => ({ del }))
            }))
        }
        const service = new PlayCanvasProjectSnapshotService(makeExec({}), makeSchemaService() as never)

        await expect(
            service.restoreSnapshot({
                trx: trx as never,
                metahubId: 'metahub-1',
                schemaName: TEST_SCHEMA,
                snapshot: undefined,
                moduleIdMap: new Map(),
                entityIdMap: new Map(),
                userId: 'user-1'
            })
        ).resolves.toEqual({ projectIdMap: new Map(), sceneIdMap: new Map(), runtimeManifestChecksumMap: new Map() })
        expect(trx.withSchema).not.toHaveBeenCalled()
        expect(del).not.toHaveBeenCalled()
    })

    it('tracks restored local file backups for transaction rollback cleanup', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-snapshot-restore-'))
        const fileService = new PlayCanvasProjectFileService(root)
        const projectId = '019e8afa-0000-7000-8000-000000000001'
        const sceneId = '019e8afa-0000-7000-8000-000000000002'
        const scenePath = `${PLAYCANVAS_PROJECT_FILE_ROOT}/${projectId}/scenes/${sceneId}.json`
        await fileService.write({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, scenePath, '{"previous":true}')
        const insert = jest.fn(async () => undefined)
        const trx = {
            withSchema: jest.fn(() => ({
                from: jest.fn(() => ({ del: jest.fn(async () => undefined) })),
                into: jest.fn(() => ({ insert }))
            }))
        }
        const backups: Array<{
            sourcePath: string
            previousContent: Buffer | null
            writtenChecksum: string
            mime: string | null
        }> = []
        const service = new PlayCanvasProjectSnapshotService(makeExec({}), makeSchemaService() as never, fileService)
        const nextContent = '{"previous":false}'
        const nextChecksum = computePlayCanvasProjectFileChecksum(nextContent)

        await service.restoreSnapshot({
            trx: trx as never,
            metahubId: 'metahub-1',
            schemaName: TEST_SCHEMA,
            snapshot: {
                schemaVersion: PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION,
                projects: [
                    {
                        id: projectId,
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageRef: {
                            packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                            version: '0.1.0',
                            compatibilityStatus: 'compatible'
                        },
                        schemaVersion: '1',
                        settings: {},
                        defaultSceneId: sceneId,
                        publicationConfig: {}
                    }
                ],
                scenes: [
                    {
                        id: sceneId,
                        projectId,
                        codename: createLocalizedContent('en', 'scene_one'),
                        displayName: createLocalizedContent('en', 'Scene One'),
                        payloadSchemaVersion: '1',
                        payload: {},
                        payloadFile: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: scenePath,
                            hash: nextChecksum,
                            mime: 'application/json',
                            snapshotContentBase64: Buffer.from(nextContent).toString('base64')
                        },
                        checksum: null,
                        sortOrder: 0,
                        publish: true
                    }
                ],
                assets: [],
                scriptAssets: [],
                sceneScriptBindings: [],
                generatedArtifacts: [],
                runtimeManifests: []
            },
            moduleIdMap: new Map(),
            entityIdMap: new Map(),
            userId: 'user-1',
            restoredFileBackups: backups
        })

        expect(backups).toHaveLength(1)
        expect(backups[0].sourcePath).not.toBe(scenePath)
        expect(backups[0].sourcePath).toMatch(/^playcanvas-projects\/[0-9a-f-]+\/scenes\//)
        const restoredSceneRow = insert.mock.calls
            .map((call) => call[0] as { id?: string; project_id?: string; payload_file?: { path?: string } })
            .find((row) => row.payload_file?.path)
        expect(restoredSceneRow?.payload_file?.path).toBe(
            `${PLAYCANVAS_PROJECT_FILE_ROOT}/${restoredSceneRow?.project_id}/scenes/${restoredSceneRow?.id}.json`
        )
        expect(backups[0].sourcePath).toBe(restoredSceneRow?.payload_file?.path)
        expect(backups[0].previousContent).toBeNull()
        expect(
            (await fileService.read({ metahubId: 'metahub-1', branchSlug: TEST_SCHEMA }, backups[0].sourcePath)).content.toString('utf8')
        ).toBe(nextContent)

        await fs.rm(root, { recursive: true, force: true })
    })

    it('restores missing local file references without bundled snapshot content', async () => {
        const projectId = '019e8afa-0000-7000-8000-000000000031'
        const sceneId = '019e8afa-0000-7000-8000-000000000032'
        const insert = jest.fn(async () => undefined)
        const trx = {
            withSchema: jest.fn(() => ({
                from: jest.fn(() => ({ del: jest.fn(async () => undefined) })),
                into: jest.fn(() => ({ insert }))
            }))
        }
        const service = new PlayCanvasProjectSnapshotService(makeExec({}), makeSchemaService() as never)

        await expect(
            service.restoreSnapshot({
                trx: trx as never,
                metahubId: 'metahub-1',
                schemaName: TEST_SCHEMA,
                snapshot: {
                    schemaVersion: PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION,
                    projects: [
                        {
                            id: projectId,
                            codename: createLocalizedContent('en', 'project_one'),
                            displayName: createLocalizedContent('en', 'Project One'),
                            packageRef: {
                                packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                                version: '0.1.0',
                                compatibilityStatus: 'compatible'
                            },
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: sceneId,
                            publicationConfig: {}
                        }
                    ],
                    scenes: [
                        {
                            id: sceneId,
                            projectId,
                            codename: createLocalizedContent('en', 'scene_one'),
                            displayName: createLocalizedContent('en', 'Scene One'),
                            payloadSchemaVersion: '1',
                            payload: {},
                            payloadFile: {
                                provider: 'local',
                                root: PLAYCANVAS_PROJECT_FILE_ROOT,
                                path: `${PLAYCANVAS_PROJECT_FILE_ROOT}/${projectId}/scenes/missing.json`,
                                hash: null,
                                status: 'missing',
                                snapshotContentBase64: null
                            },
                            checksum: null,
                            sortOrder: 0,
                            publish: true
                        }
                    ],
                    assets: [],
                    scriptAssets: [],
                    sceneScriptBindings: [],
                    generatedArtifacts: [],
                    runtimeManifests: []
                },
                moduleIdMap: new Map(),
                entityIdMap: new Map(),
                userId: 'user-1'
            })
        ).resolves.toEqual({
            projectIdMap: expect.any(Map),
            sceneIdMap: expect.any(Map),
            runtimeManifestChecksumMap: expect.any(Map)
        })

        expect(insert).toHaveBeenCalled()
    })

    it('rejects restored local file references without bundled snapshot content', async () => {
        const projectId = '019e8afa-0000-7000-8000-000000000021'
        const sceneId = '019e8afa-0000-7000-8000-000000000022'
        const trx = {
            withSchema: jest.fn(() => ({
                from: jest.fn(() => ({ del: jest.fn(async () => undefined) })),
                into: jest.fn(() => ({ insert: jest.fn(async () => undefined) }))
            }))
        }
        const service = new PlayCanvasProjectSnapshotService(makeExec({}), makeSchemaService() as never)

        await expect(
            service.restoreSnapshot({
                trx: trx as never,
                metahubId: 'metahub-1',
                schemaName: TEST_SCHEMA,
                snapshot: {
                    schemaVersion: PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION,
                    projects: [
                        {
                            id: projectId,
                            codename: createLocalizedContent('en', 'project_one'),
                            displayName: createLocalizedContent('en', 'Project One'),
                            packageRef: {
                                packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                                version: '0.1.0',
                                compatibilityStatus: 'compatible'
                            },
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: sceneId,
                            publicationConfig: {}
                        }
                    ],
                    scenes: [
                        {
                            id: sceneId,
                            projectId,
                            codename: createLocalizedContent('en', 'scene_one'),
                            displayName: createLocalizedContent('en', 'Scene One'),
                            payloadSchemaVersion: '1',
                            payload: {},
                            payloadFile: {
                                provider: 'local',
                                root: PLAYCANVAS_PROJECT_FILE_ROOT,
                                path: `${PLAYCANVAS_PROJECT_FILE_ROOT}/${projectId}/scenes/${sceneId}.json`,
                                hash: computePlayCanvasProjectFileChecksum('{}'),
                                mime: 'application/json'
                            },
                            checksum: null,
                            sortOrder: 0,
                            publish: true
                        }
                    ],
                    assets: [],
                    scriptAssets: [],
                    sceneScriptBindings: [],
                    generatedArtifacts: [],
                    runtimeManifests: []
                },
                moduleIdMap: new Map(),
                entityIdMap: new Map(),
                userId: 'user-1'
            })
        ).rejects.toMatchObject({
            details: expect.objectContaining({
                messageCode: 'playcanvas.snapshot.fileContentRequired'
            })
        })
    })

    it('runs restore preflight before deleting existing rows', async () => {
        const projectId = '019e8afa-0000-7000-8000-000000000031'
        const sceneId = '019e8afa-0000-7000-8000-000000000032'
        const del = jest.fn(async () => undefined)
        const insert = jest.fn(async () => undefined)
        const trx = {
            withSchema: jest.fn(() => ({
                from: jest.fn(() => ({ del })),
                into: jest.fn(() => ({ insert }))
            }))
        }
        const service = new PlayCanvasProjectSnapshotService(makeExec({}), makeSchemaService() as never)

        await expect(
            service.restoreSnapshot({
                trx: trx as never,
                metahubId: 'metahub-1',
                schemaName: TEST_SCHEMA,
                snapshot: {
                    schemaVersion: PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION,
                    projects: [
                        {
                            id: projectId,
                            codename: createLocalizedContent('en', 'project_one'),
                            displayName: createLocalizedContent('en', 'Project One'),
                            packageRef: {
                                packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                                version: '0.1.0',
                                compatibilityStatus: 'compatible'
                            },
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: sceneId,
                            publicationConfig: {}
                        },
                        {
                            id: projectId,
                            codename: createLocalizedContent('en', 'project_duplicate'),
                            displayName: createLocalizedContent('en', 'Project Duplicate'),
                            packageRef: {
                                packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                                version: '0.1.0',
                                compatibilityStatus: 'compatible'
                            },
                            schemaVersion: '1',
                            settings: {},
                            defaultSceneId: sceneId,
                            publicationConfig: {}
                        }
                    ],
                    scenes: [
                        {
                            id: sceneId,
                            projectId,
                            codename: createLocalizedContent('en', 'scene_one'),
                            displayName: createLocalizedContent('en', 'Scene One'),
                            payloadSchemaVersion: '1',
                            payload: {},
                            payloadFile: null,
                            checksum: null,
                            sortOrder: 0,
                            publish: true
                        }
                    ],
                    assets: [],
                    scriptAssets: [],
                    sceneScriptBindings: [],
                    generatedArtifacts: [],
                    runtimeManifests: []
                },
                moduleIdMap: new Map(),
                entityIdMap: new Map(),
                userId: 'user-1'
            })
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.snapshot.duplicateId' })
        })
        expect(del).not.toHaveBeenCalled()
        expect(insert).not.toHaveBeenCalled()
    })

    it('remaps project and module IDs inside restored runtime manifests', async () => {
        const insertedRows: Record<string, unknown>[] = []
        const projectId = '019e8afa-0000-7000-8000-000000000011'
        const sceneId = '019e8afa-0000-7000-8000-000000000012'
        const oldModuleId = '019e8afa-0000-7000-8000-000000000013'
        const newModuleId = '019e8afa-0000-7000-8000-000000000014'
        const assetId = '019e8afa-0000-7000-8000-000000000015'
        const scriptAssetId = '019e8afa-0000-7000-8000-000000000016'
        const trx = {
            withSchema: jest.fn(() => ({
                from: jest.fn(() => ({ del: jest.fn(async () => undefined) })),
                into: jest.fn(() => ({
                    insert: jest.fn(async (row: Record<string, unknown>) => {
                        insertedRows.push(row)
                    })
                }))
            }))
        }
        const service = new PlayCanvasProjectSnapshotService(makeExec({}), makeSchemaService() as never)

        await service.restoreSnapshot({
            trx: trx as never,
            metahubId: 'metahub-1',
            schemaName: TEST_SCHEMA,
            snapshot: {
                schemaVersion: PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION,
                projects: [
                    {
                        id: projectId,
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageRef: {
                            packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                            version: '0.1.0',
                            compatibilityStatus: 'compatible'
                        },
                        schemaVersion: '1',
                        settings: {},
                        defaultSceneId: sceneId,
                        publicationConfig: {}
                    }
                ],
                scenes: [
                    {
                        id: sceneId,
                        projectId,
                        codename: createLocalizedContent('en', 'scene_one'),
                        displayName: createLocalizedContent('en', 'Scene One'),
                        payloadSchemaVersion: '1',
                        payload: {},
                        payloadFile: null,
                        checksum: null,
                        sortOrder: 0,
                        publish: true
                    }
                ],
                assets: [
                    {
                        id: assetId,
                        projectId,
                        stableAssetId: 'ship-script',
                        type: 'script',
                        name: 'Ship',
                        virtualPath: ['scripts', 'ship.mjs'],
                        file: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: `${PLAYCANVAS_PROJECT_FILE_ROOT}/${projectId}/scripts/ship.mjs`,
                            hash: computePlayCanvasProjectFileChecksum('export class Ship {}'),
                            mime: 'text/javascript',
                            snapshotContentBase64: Buffer.from('export class Ship {}').toString('base64')
                        },
                        metadata: {},
                        publish: true
                    }
                ],
                scriptAssets: [
                    {
                        id: scriptAssetId,
                        assetId,
                        moduleId: oldModuleId,
                        moduleCodename: 'ship',
                        moduleSourcePath: `${PLAYCANVAS_PROJECT_FILE_ROOT}/${projectId}/scripts/ship.mjs`,
                        scriptName: 'Ship',
                        scriptKind: 'esm',
                        parsedAttributes: {},
                        parseStatus: 'ready'
                    }
                ],
                sceneScriptBindings: [],
                generatedArtifacts: [],
                runtimeManifests: [
                    {
                        schemaVersion: '1',
                        projectId,
                        sceneId,
                        checksum: 'old-checksum',
                        assets: [
                            {
                                id: 'ship-script',
                                type: 'script',
                                name: 'Ship',
                                url: `${PLAYCANVAS_PROJECT_FILE_ROOT}/${projectId}/scripts/ship.mjs`
                            }
                        ],
                        scripts: [
                            {
                                id: scriptAssetId,
                                scriptName: 'Ship',
                                scriptKind: 'esm',
                                artifactUrl: `${PLAYCANVAS_PROJECT_FILE_ROOT}/${projectId}/generated/ship.mjs`,
                                moduleId: oldModuleId,
                                attributes: {}
                            }
                        ]
                    }
                ]
            },
            moduleIdMap: new Map([[oldModuleId, newModuleId]]),
            entityIdMap: new Map(),
            userId: 'user-1'
        })

        const manifestRow = insertedRows.find((row) => row.runtime_manifest)
        const runtimeManifest = manifestRow?.runtime_manifest as {
            checksum: string
            projectId: string
            assets: Array<{ url: string | null }>
            scripts: Array<{ id: string; artifactUrl: string | null; moduleId: string | null }>
        }
        expect(manifestRow?.project_id).toBe(runtimeManifest.projectId)
        expect(runtimeManifest.projectId).not.toBe(projectId)
        expect(runtimeManifest.scripts[0].moduleId).toBe(newModuleId)
        expect(runtimeManifest.scripts[0].id).not.toBe(scriptAssetId)
        expect(runtimeManifest.assets[0].url).toBeNull()
        expect(runtimeManifest.scripts[0].artifactUrl).toBeNull()
        expect(runtimeManifest.checksum).not.toBe('old-checksum')
        expect(manifestRow?.manifest_checksum).toBe(runtimeManifest.checksum)
    })

    it('filters user-scoped PlayCanvas Editor compatibility settings and remaps project-private ids during restore', async () => {
        const insertedRows: Record<string, unknown>[] = []
        const oldProjectId = '019e8afa-0000-7000-8000-000000000021'
        const sceneId = '019e8afa-0000-7000-8000-000000000022'
        const trx = {
            withSchema: jest.fn(() => ({
                from: jest.fn(() => ({ del: jest.fn(async () => undefined) })),
                into: jest.fn(() => ({
                    insert: jest.fn(async (row: Record<string, unknown>) => {
                        insertedRows.push(row)
                    })
                }))
            }))
        }
        const service = new PlayCanvasProjectSnapshotService(makeExec({}), makeSchemaService() as never)

        await service.restoreSnapshot({
            trx: trx as never,
            metahubId: 'metahub-1',
            schemaName: TEST_SCHEMA,
            snapshot: {
                schemaVersion: PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION,
                projects: [
                    {
                        id: oldProjectId,
                        codename: createLocalizedContent('en', 'project_one'),
                        displayName: createLocalizedContent('en', 'Project One'),
                        packageRef: {
                            packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                            version: '0.1.0',
                            compatibilityStatus: 'compatible'
                        },
                        schemaVersion: '1',
                        settings: {
                            playCanvasEditorCompatibility: {
                                settingsDocuments: {
                                    [`project_${oldProjectId}_user-1`]: {
                                        kind: 'projectUser',
                                        documentId: `project_${oldProjectId}_user-1`,
                                        data: { grid: { snap: true } },
                                        revision: 'project-3'
                                    },
                                    [`project-private_${oldProjectId}`]: {
                                        kind: 'projectPrivate',
                                        documentId: `project-private_${oldProjectId}`,
                                        data: { panels: { hierarchy: true } },
                                        revision: 'project-3'
                                    },
                                    'user_user-1': {
                                        kind: 'user',
                                        documentId: 'user_user-1',
                                        data: { theme: 'dark' },
                                        revision: 'project-3'
                                    }
                                }
                            }
                        },
                        defaultSceneId: sceneId,
                        publicationConfig: {}
                    }
                ],
                scenes: [
                    {
                        id: sceneId,
                        projectId: oldProjectId,
                        codename: createLocalizedContent('en', 'scene_one'),
                        displayName: createLocalizedContent('en', 'Scene One'),
                        payloadSchemaVersion: '1',
                        payload: {},
                        payloadFile: null,
                        checksum: null,
                        sortOrder: 0,
                        publish: true
                    }
                ],
                assets: [],
                scriptAssets: [],
                sceneScriptBindings: [],
                generatedArtifacts: []
            },
            moduleIdMap: new Map(),
            entityIdMap: new Map(),
            userId: 'user-1'
        })

        const projectRow = insertedRows.find((row) => 'settings' in row)
        const restoredProjectId = projectRow?.id as string
        const settings = projectRow?.settings as {
            playCanvasEditorCompatibility?: {
                settingsDocuments?: Record<string, { documentId?: string }>
            }
        }
        const documents = settings.playCanvasEditorCompatibility?.settingsDocuments

        expect(restoredProjectId).toBeTruthy()
        expect(restoredProjectId).not.toBe(oldProjectId)
        expect(documents).toHaveProperty(`project-private_${restoredProjectId}`)
        expect(documents).not.toHaveProperty('user_user-1')
        expect(documents).not.toHaveProperty(`project_${restoredProjectId}_user-1`)
        expect(documents).not.toHaveProperty(`project_${oldProjectId}_user-1`)
        expect(documents).not.toHaveProperty(`project-private_${oldProjectId}`)
        expect(documents?.[`project-private_${restoredProjectId}`]?.documentId).toBe(`project-private_${restoredProjectId}`)
    })
})
