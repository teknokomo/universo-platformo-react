import type { DbExecutor } from '@universo-react/utils'
import {
    clearPlayCanvasDefaultProjectPointers,
    markPlayCanvasAssetFileReferenceReady,
    markPlayCanvasAssetFileReferenceMissing,
    markPlayCanvasProjectFileReferenceReady,
    playCanvasProjectFileReferenceExists,
    playCanvasProjectMetadataFileReferenceExists,
    replacePlayCanvasPublicationManifests,
    restoreSoftDeletedPlayCanvasProject,
    softDeletePlayCanvasProject,
    summarizePlayCanvasProject,
    upsertPlayCanvasAsset,
    upsertPlayCanvasGeneratedArtifact,
    upsertPlayCanvasScene,
    upsertPlayCanvasSceneScriptBinding,
    upsertPlayCanvasScriptAsset
} from '../../domains/playcanvas-projects/services/playCanvasProjectsStore'

const makeExec = (responses: unknown[][] = []): DbExecutor => {
    const query = jest.fn(async () => responses.shift() ?? [])
    return { query } as unknown as DbExecutor
}

describe('playCanvasProjectsStore', () => {
    it('soft-deletes a project and its dependent PlayCanvas rows', async () => {
        const exec = makeExec([
            [
                {
                    id: 'project-1',
                    codename: {},
                    displayName: {},
                    description: null,
                    packageName: '@universo-react/playcanvas-editor-frontend',
                    packageVersion: null,
                    compatibilityStatus: 'compatible',
                    compatibilityNotes: {},
                    schemaVersion: '1',
                    settings: {},
                    defaultSceneId: null,
                    publicationConfig: {},
                    version: 2
                }
            ]
        ])

        const deleted = await softDeletePlayCanvasProject(exec, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1', 'project-1', 'user-1')

        expect(deleted?.id).toBe('project-1')
        const sqlCalls = jest.mocked(exec.query).mock.calls.map(([sql]) => String(sql))
        expect(sqlCalls.some((sql) => sql.includes('_mhb_playcanvas_scene_script_bindings'))).toBe(true)
        expect(sqlCalls.some((sql) => sql.includes('_mhb_playcanvas_generated_artifacts'))).toBe(true)
        expect(sqlCalls.some((sql) => sql.includes('_mhb_playcanvas_script_assets'))).toBe(true)
        expect(sqlCalls.some((sql) => sql.includes('_mhb_playcanvas_publication_manifests'))).toBe(true)
        expect(sqlCalls.some((sql) => sql.includes('_mhb_playcanvas_assets'))).toBe(true)
        expect(sqlCalls.some((sql) => sql.includes('_mhb_playcanvas_scenes'))).toBe(true)
        expect(sqlCalls.some((sql) => sql.includes('_mhb_playcanvas_package_compatibility'))).toBe(true)
    })

    it('restores the parent project when a child soft-delete update fails', async () => {
        const exec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('UPDATE') && sql.includes('_mhb_playcanvas_projects') && sql.includes('RETURNING')) {
                    return [
                        {
                            id: 'project-1',
                            codename: {},
                            displayName: {},
                            description: null,
                            packageName: '@universo-react/playcanvas-editor-frontend',
                            packageVersion: null,
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
                if (sql.includes('_mhb_playcanvas_scene_script_bindings') && sql.includes('_upl_deleted = true')) {
                    throw new Error('child update failed')
                }
                return []
            })
        } as unknown as DbExecutor

        await expect(softDeletePlayCanvasProject(exec, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1', 'project-1', 'user-1')).rejects.toThrow(
            'child update failed'
        )

        const sqlCalls = jest.mocked(exec.query).mock.calls.map(([sql]) => String(sql))
        expect(sqlCalls.some((sql) => sql.includes('_upl_deleted = false') && sql.includes('_mhb_playcanvas_projects'))).toBe(true)
    })

    it('replaces branch PlayCanvas publication manifests and marks stale rows deleted', async () => {
        const exec = makeExec()

        await replacePlayCanvasPublicationManifests(exec, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1', {
            projectIds: ['019e8afa-0000-7000-8000-000000000001'],
            manifests: [
                {
                    schemaVersion: '1',
                    projectId: '019e8afa-0000-7000-8000-000000000001',
                    sceneId: '019e8afa-0000-7000-8000-000000000002',
                    checksum: 'manifest-checksum',
                    assets: [],
                    scripts: [],
                    metadata: { sourceProjectChecksum: 'source-checksum' }
                }
            ],
            userId: 'user-1',
            replaceScope: 'branch'
        })

        const calls = jest.mocked(exec.query).mock.calls
        expect(calls).toHaveLength(2)
        expect(String(calls[0]?.[0])).toContain('UPDATE "mhb_a1b2c3d4e5f67890abcdef1234567890_b1"."_mhb_playcanvas_publication_manifests"')
        expect(String(calls[0]?.[0])).toContain('published = false')
        expect(String(calls[0]?.[0])).not.toContain('project_id::text = ANY')
        expect(calls[0]?.[1]).toEqual([['019e8afa-0000-7000-8000-000000000001'], 'user-1'])
        expect(String(calls[1]?.[0])).toContain(
            'INSERT INTO "mhb_a1b2c3d4e5f67890abcdef1234567890_b1"."_mhb_playcanvas_publication_manifests"'
        )
        expect(calls[1]?.[1]).toEqual([
            '019e8afa-0000-7000-8000-000000000001',
            '019e8afa-0000-7000-8000-000000000002',
            '1',
            JSON.stringify({
                schemaVersion: '1',
                projectId: '019e8afa-0000-7000-8000-000000000001',
                sceneId: '019e8afa-0000-7000-8000-000000000002',
                checksum: 'manifest-checksum',
                assets: [],
                scripts: [],
                metadata: { sourceProjectChecksum: 'source-checksum' }
            }),
            'manifest-checksum',
            'source-checksum',
            'user-1'
        ])
    })

    it('clears package config default project pointers when the referenced project is deleted', async () => {
        const exec = makeExec()

        await clearPlayCanvasDefaultProjectPointers(exec, 'metahub-1', 'project-1', 'user-1')

        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('"metahubs"."rel_metahub_packages"')
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain("config #>> '{playcanvasProject,defaultProjectId}' = $2")
        expect(jest.mocked(exec.query).mock.calls[0]?.[1]).toEqual(['metahub-1', 'project-1', 'user-1'])
    })

    it('can restore soft-deleted project metadata when file cleanup fails', async () => {
        const exec = makeExec()
        const deletionToken = new Date('2026-06-03T00:00:00.000Z')

        await restoreSoftDeletedPlayCanvasProject(exec, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1', 'project-1', 'user-1', deletionToken)

        const sqlCalls = jest.mocked(exec.query).mock.calls.map(([sql]) => String(sql))
        expect(sqlCalls).toHaveLength(8)
        expect(sqlCalls[0]).toContain('_mhb_playcanvas_projects')
        expect(sqlCalls[0]).toContain('_upl_deleted = false')
        expect(sqlCalls.every((sql) => sql.includes('_upl_deleted_by = $2'))).toBe(true)
        expect(sqlCalls.every((sql) => sql.includes('_upl_deleted_at = $3'))).toBe(true)
        expect(jest.mocked(exec.query).mock.calls.every((call) => call[1]?.[2] === deletionToken)).toBe(true)
    })

    it('checks project-level file references against scene, asset, and generated artifact metadata', async () => {
        const exec = makeExec([[{ exists: 't' }]])

        await expect(
            playCanvasProjectFileReferenceExists(
                exec,
                'mhb_a1b2c3d4e5f67890abcdef1234567890_b1',
                'project-1',
                'playcanvas-projects/project-1/scenes/main.json'
            )
        ).resolves.toBe(true)

        const sql = String(jest.mocked(exec.query).mock.calls[0]?.[0])
        expect(sql).toContain('_mhb_playcanvas_scenes')
        expect(sql).toContain("s.payload_file #>> '{path}' = $2")
        expect(sql).toContain('_mhb_playcanvas_assets')
        expect(sql).toContain("a.file_ref #>> '{path}' = $2")
        expect(sql).toContain('_mhb_playcanvas_generated_artifacts')
        expect(sql).toContain("ga.output_file #>> '{path}' = $2")
    })

    it('checks project metadata file references without treating asset files as project-level owners', async () => {
        const exec = makeExec([[{ exists: false }]])

        await expect(
            playCanvasProjectMetadataFileReferenceExists(
                exec,
                'mhb_a1b2c3d4e5f67890abcdef1234567890_b1',
                'project-1',
                'playcanvas-projects/project-1/assets/texture.png'
            )
        ).resolves.toBe(false)

        const sql = String(jest.mocked(exec.query).mock.calls[0]?.[0])
        expect(sql).toContain('_mhb_playcanvas_scenes')
        expect(sql).toContain('_mhb_playcanvas_generated_artifacts')
        expect(sql).toContain('_mhb_playcanvas_assets')
        expect(sql).toContain('JOIN')
        expect(sql).not.toContain("a.file_ref #>> '{path}' = $2")
    })

    it('keeps generated artifact output checksum nullable until a file write supplies a hash', async () => {
        const exec = makeExec([
            [
                {
                    id: 'artifact-1',
                    scriptAssetId: 'script-1',
                    sourceModuleId: null,
                    sourceModuleCodename: null,
                    sourceModulePath: null,
                    sourceChecksum: null,
                    outputFile: {
                        provider: 'local',
                        root: 'playcanvas-projects',
                        path: 'playcanvas-projects/project-1/generated/script.mjs',
                        mime: 'text/javascript',
                        status: 'missing'
                    },
                    scriptName: 'FlightController',
                    moduleExportName: null,
                    scriptKind: 'esm',
                    parseStatus: 'missing',
                    generatedAt: null,
                    parsedAt: null,
                    version: 1
                }
            ]
        ])

        await upsertPlayCanvasGeneratedArtifact(
            exec,
            'mhb_a1b2c3d4e5f67890abcdef1234567890_b1',
            'project-1',
            {
                id: 'artifact-1',
                scriptAssetId: 'script-1',
                sourceModuleId: null,
                sourceModuleCodename: null,
                sourceModulePath: null,
                sourceChecksum: null,
                outputFile: {
                    provider: 'local',
                    root: 'playcanvas-projects',
                    path: 'playcanvas-projects/project-1/generated/script.mjs',
                    hash: null,
                    mime: 'text/javascript',
                    status: 'missing'
                },
                scriptName: 'FlightController',
                moduleExportName: null,
                scriptKind: 'esm',
                parseStatus: 'missing',
                generatedAt: null,
                parsedAt: null
            },
            'user-1'
        )

        expect(jest.mocked(exec.query).mock.calls[0]?.[1]?.[9]).toBeNull()
    })

    it('reports whether project file metadata ready markers touched any rows', async () => {
        const exec = makeExec([[{ id: 'scene-1' }], []])

        await expect(
            markPlayCanvasProjectFileReferenceReady(
                exec,
                'mhb_a1b2c3d4e5f67890abcdef1234567890_b1',
                'project-1',
                'playcanvas-projects/project-1/scenes/main.json',
                { checksum: 'a'.repeat(64), size: 2, mime: 'application/json' },
                'user-1'
            )
        ).resolves.toBe(true)

        const sqlCalls = jest.mocked(exec.query).mock.calls.map(([sql]) => String(sql))
        expect(sqlCalls[0]).toContain('RETURNING id')
        expect(sqlCalls[1]).toContain('RETURNING ga.id')
        expect(sqlCalls[0]).toContain("'hash', $3::text")
        expect(sqlCalls[0]).toContain("'size', $4::integer")
        expect(sqlCalls[0]).toContain("'mime', $5::text")
        expect(sqlCalls[0]).toContain('checksum = $3::text')
        expect(sqlCalls[0]).toContain('_upl_updated_by = $6::uuid')
        expect(sqlCalls[1]).toContain("'hash', $3::text")
        expect(sqlCalls[1]).toContain("'size', $4::integer")
        expect(sqlCalls[1]).toContain("'mime', $5::text")
        expect(sqlCalls[1]).toContain('output_checksum = $3::text')
        expect(sqlCalls[1]).toContain('_upl_updated_by = $6::uuid')
    })

    it('reports false when asset file metadata missing markers touch no rows', async () => {
        const exec = makeExec([[]])

        await expect(
            markPlayCanvasAssetFileReferenceMissing(
                exec,
                'mhb_a1b2c3d4e5f67890abcdef1234567890_b1',
                'project-1',
                'asset-1',
                'playcanvas-projects/project-1/assets/texture.png',
                'user-1'
            )
        ).resolves.toBe(false)

        expect(String(jest.mocked(exec.query).mock.calls[0]?.[0])).toContain('RETURNING id')
    })

    it('casts asset file ready marker parameters for nullable MIME updates', async () => {
        const exec = makeExec([[{ id: 'asset-1' }]])

        await expect(
            markPlayCanvasAssetFileReferenceReady(
                exec,
                'mhb_a1b2c3d4e5f67890abcdef1234567890_b1',
                'project-1',
                'asset-1',
                'playcanvas-projects/project-1/assets/data.json',
                { checksum: 'b'.repeat(64), size: 12, mime: null },
                'user-1'
            )
        ).resolves.toBe(true)

        const sql = String(jest.mocked(exec.query).mock.calls[0]?.[0])
        expect(sql).toContain("'hash', $4::text")
        expect(sql).toContain("'size', $5::integer")
        expect(sql).toContain("'mime', $6::text")
        expect(sql).toContain('file_hash = $4::text')
        expect(sql).toContain('mime = $6::text')
        expect(sql).toContain('_upl_updated_by = $7::uuid')
    })

    it('summarizes PlayCanvas project health across scene, asset, script, and generated artifact blockers', async () => {
        const exec = makeExec([[{ sceneCount: '1', assetCount: '1', scriptCount: '1', generatedArtifactCount: '1', blockingCount: '3' }]])

        const summary = await summarizePlayCanvasProject(exec, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1', {
            id: 'project-1',
            codename: {},
            displayName: {},
            description: null,
            packageName: '@universo-react/playcanvas-editor-frontend',
            packageVersion: null,
            compatibilityStatus: 'compatible',
            compatibilityNotes: {},
            schemaVersion: '1',
            settings: {},
            defaultSceneId: null,
            publicationConfig: {},
            version: 1
        })

        expect(summary.status).toBe('publishBlocking')
        expect(summary.publishable).toBe(false)
        const sql = String(jest.mocked(exec.query).mock.calls[0]?.[0])
        expect(sql).toContain("COALESCE(status, 'missing') <> 'ready'")
        expect(sql).toContain('file_ref IS NOT NULL')
        expect(sql).toContain("COALESCE(file_ref->>'path', '') <> ''")
        expect(sql).toContain("COALESCE(sa.parse_status, 'missing') <> 'ready'")
        expect(sql).toContain("COALESCE(ga.parse_status, 'missing') <> 'ready'")
        expect(sql).toContain('"publishableSceneCount"')
        expect(sql).toContain("s.payload_file->>'provider' = 'local'")
    })

    it('marks a project publishable only when a ready publishable scene can be exported', async () => {
        const exec = makeExec([
            [
                {
                    sceneCount: '1',
                    assetCount: '0',
                    scriptCount: '0',
                    generatedArtifactCount: '0',
                    blockingCount: '0',
                    publishableSceneCount: '1'
                }
            ]
        ])

        const summary = await summarizePlayCanvasProject(exec, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1', {
            id: 'project-1',
            codename: {},
            displayName: {},
            description: null,
            packageName: '@universo-react/playcanvas-editor-frontend',
            packageVersion: null,
            compatibilityStatus: 'compatible',
            compatibilityNotes: {},
            schemaVersion: '1',
            settings: {},
            defaultSceneId: '018f8a78-7b8f-7c1d-a111-222233334445',
            publicationConfig: {},
            version: 1
        })

        expect(summary.status).toBe('ready')
        expect(summary.publishable).toBe(true)
        expect(jest.mocked(exec.query).mock.calls[0]?.[1]).toEqual(['project-1', '018f8a78-7b8f-7c1d-a111-222233334445'])
    })

    it('guards child PlayCanvas upserts against cross-project conflict ownership changes', async () => {
        const exec = makeExec()
        const schema = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'

        await upsertPlayCanvasScriptAsset(
            exec,
            schema,
            'project-1',
            {
                id: 'script-1',
                assetId: 'asset-1',
                moduleId: null,
                moduleCodename: null,
                moduleSourcePath: null,
                scriptName: 'Ship',
                scriptKind: 'esm',
                parsedAttributes: {},
                parseStatus: 'ready',
                parseDiagnostics: null
            },
            'user-1'
        )
        await upsertPlayCanvasSceneScriptBinding(
            exec,
            schema,
            'project-1',
            {
                id: 'binding-1',
                sceneId: 'scene-1',
                sceneEntityStableId: 'entity-1',
                scriptAssetId: 'script-1',
                scriptName: 'Ship',
                attributeValues: {},
                bindingSchemaVersion: '1',
                platformoEntityId: null,
                sortOrder: 0,
                enabled: true
            },
            'user-1'
        )
        await upsertPlayCanvasGeneratedArtifact(
            exec,
            schema,
            'project-1',
            {
                id: 'artifact-1',
                scriptAssetId: 'script-1',
                sourceModuleId: null,
                sourceModuleCodename: null,
                sourceModulePath: null,
                sourceChecksum: null,
                outputFile: {
                    provider: 'local',
                    root: 'playcanvas-projects',
                    path: 'playcanvas-projects/project-1/generated/ship.mjs',
                    hash: null,
                    mime: 'text/javascript'
                },
                scriptName: 'Ship',
                moduleExportName: null,
                scriptKind: 'esm',
                parseStatus: 'ready',
                generatedAt: null,
                parsedAt: null
            },
            'user-1'
        )

        const sqlCalls = jest.mocked(exec.query).mock.calls.map(([sql]) => String(sql))
        expect(sqlCalls[0]).toContain('current_asset.project_id = $2')
        expect(sqlCalls[1]).toContain('current_scene.project_id = $2')
        expect(sqlCalls[1]).toContain('current_asset.project_id = $2')
        expect(sqlCalls[2]).toContain('current_asset.project_id = $2')
        expect(sqlCalls.every((sql) => !sql.includes('OR $13 IS NULL') && !sql.includes('OR $19 IS NULL'))).toBe(true)
        expect(sqlCalls[2]).toContain("jsonb_build_object('path', output_path, 'hash', output_checksum, 'mime', output_mime)")
        expect(jest.mocked(exec.query).mock.calls[2]?.[1]?.slice(8, 11)).toEqual([
            'playcanvas-projects/project-1/generated/ship.mjs',
            null,
            'text/javascript'
        ])
        expect(jest.mocked(exec.query).mock.calls[2]?.[1]?.[14]).toBe('missing')
    })

    it('defaults new local scene and asset file references to missing until file storage confirms readiness', async () => {
        const exec = makeExec([
            [
                {
                    id: 'scene-1',
                    projectId: 'project-1',
                    codename: {},
                    displayName: {},
                    payloadSchemaVersion: '1',
                    payload: null,
                    payloadFile: null,
                    checksum: null,
                    sortOrder: 0,
                    publish: true,
                    version: 1
                }
            ],
            [
                {
                    id: 'asset-1',
                    projectId: 'project-1',
                    stableAssetId: 'asset-1',
                    type: 'texture',
                    name: 'Texture',
                    virtualPath: ['assets', 'texture.json'],
                    file: null,
                    metadata: {},
                    publish: true,
                    version: 1
                }
            ]
        ])
        const schema = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'

        await upsertPlayCanvasScene(
            exec,
            schema,
            'project-1',
            {
                id: 'scene-1',
                codename: {},
                displayName: {},
                payloadSchemaVersion: '1',
                payload: null,
                payloadFile: {
                    provider: 'local',
                    root: 'playcanvas-projects',
                    path: 'playcanvas-projects/project-1/scenes/main.json',
                    hash: null,
                    mime: 'application/json'
                },
                checksum: null,
                sortOrder: 0,
                publish: true
            },
            'user-1'
        )
        await upsertPlayCanvasAsset(
            exec,
            schema,
            'project-1',
            {
                id: 'asset-1',
                stableAssetId: 'asset-1',
                type: 'texture',
                name: 'Texture',
                virtualPath: ['assets', 'texture.json'],
                file: {
                    provider: 'local',
                    root: 'playcanvas-projects',
                    path: 'playcanvas-projects/project-1/assets/texture.json',
                    hash: null,
                    mime: 'application/json'
                },
                metadata: {},
                publish: true
            },
            'user-1'
        )

        expect(jest.mocked(exec.query).mock.calls[0]?.[1]?.[10]).toBe('missing')
        expect(jest.mocked(exec.query).mock.calls[1]?.[1]?.[13]).toBe('missing')
    })
})
