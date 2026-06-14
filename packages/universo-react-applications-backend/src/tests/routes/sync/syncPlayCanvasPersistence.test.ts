import { createHash } from 'crypto'
import stableStringify from 'json-stable-stringify'

const mockExec = {
    query: jest.fn(async () => [])
}

const mockTrx = {
    raw: jest.fn(async () => ({ rows: [] }))
}
const mockTransaction = jest.fn(async (callback: (trx: unknown) => Promise<void>) => callback(mockTrx))
const mockEnsureSystemTables = jest.fn(async () => undefined)
const TEST_SCHEMA = 'app_018f8a787b8f7c1da111222233334444'
const PROJECT_ID = '018f8a78-7b8f-7c1d-a111-222233334444'
const SCENE_ID = '018f8a78-7b8f-7c1d-a111-222233334445'
const SECOND_SCENE_ID = '018f8a78-7b8f-7c1d-a111-222233334448'
const PUBLICATION_ID = '018f8a78-7b8f-7c1d-a111-222233334446'
const METAHUB_ID = '018f8a78-7b8f-7c1d-a111-222233334447'
const ASSET_HASH = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const ARTIFACT_HASH = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

jest.mock('@universo-react/database', () => ({
    __esModule: true,
    createKnexExecutor: () => mockExec,
    qTable: jest.requireActual('@universo-react/database').qTable,
    qSchemaTable: jest.requireActual('@universo-react/database').qSchemaTable
}))

jest.mock('../../../ddl', () => ({
    __esModule: true,
    getApplicationSyncKnex: () => ({ transaction: mockTransaction }),
    getApplicationSyncDdlServices: () => ({
        generator: { ensureSystemTables: mockEnsureSystemTables }
    })
}))

import type { PublishedApplicationSnapshot } from '../../../services/applicationSyncContracts'
import { hasPublishedPlayCanvasManifestChanges, persistPublishedPlayCanvasManifests } from '../../../routes/sync/syncPlayCanvasPersistence'

const checksumManifest = (manifest: Record<string, unknown>) => createHash('sha256').update(stableStringify(manifest)).digest('hex')

const createManifest = (sceneId: string, checksumOverride?: string) => {
    const manifestWithoutChecksum = {
        schemaVersion: '1',
        projectId: PROJECT_ID,
        sceneId,
        assets: [{ id: `asset-${sceneId}`, type: 'scene', name: `Scene ${sceneId}`, hash: ASSET_HASH }],
        scripts: [{ id: `script-${sceneId}`, scriptName: 'Ship', scriptKind: 'esm', artifactHash: ARTIFACT_HASH, attributes: {} }]
    }
    return {
        ...manifestWithoutChecksum,
        checksum: checksumOverride ?? checksumManifest(manifestWithoutChecksum)
    }
}

const snapshotWithManifest = (checksumOverride?: string): PublishedApplicationSnapshot => {
    return {
        playcanvasRuntimeManifests: [createManifest(SCENE_ID, checksumOverride)]
    } as unknown as PublishedApplicationSnapshot
}

const snapshotWithTwoScenes = (): PublishedApplicationSnapshot => {
    return {
        playcanvasRuntimeManifests: [createManifest(SCENE_ID), createManifest(SECOND_SCENE_ID)]
    } as unknown as PublishedApplicationSnapshot
}

const expectedSingleManifestChecksum = () =>
    checksumManifest({
        schemaVersion: '1',
        projectId: PROJECT_ID,
        sceneId: SCENE_ID,
        assets: [{ id: `asset-${SCENE_ID}`, type: 'scene', name: `Scene ${SCENE_ID}`, hash: ASSET_HASH }],
        scripts: [{ id: `script-${SCENE_ID}`, scriptName: 'Ship', scriptKind: 'esm', artifactHash: ARTIFACT_HASH, attributes: {} }]
    })

const persistedRowForScene = (sceneId: string) => {
    const manifest = createManifest(sceneId)
    return {
        publication_id: PUBLICATION_ID,
        source_metahub_id: METAHUB_ID,
        source_project_id: PROJECT_ID,
        source_scene_id: sceneId,
        manifest_schema_version: '1',
        manifest_checksum: manifest.checksum,
        runtime_manifest: manifest,
        asset_count: 1,
        script_count: 1,
        artifact_count: 1
    }
}

describe('syncPlayCanvasPersistence', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockExec.query.mockImplementation(async () => [])
        mockTrx.raw.mockResolvedValue({ rows: [] })
        mockTransaction.mockImplementation(async (callback: (trx: unknown) => Promise<void>) => callback(mockTrx))
        mockEnsureSystemTables.mockResolvedValue(undefined)
    })

    it('detects manifest changes when the runtime table is missing or persisted checksum differs', async () => {
        mockExec.query.mockResolvedValueOnce([{ exists: false }])
        await expect(hasPublishedPlayCanvasManifestChanges({ schemaName: TEST_SCHEMA, snapshot: snapshotWithManifest() })).resolves.toBe(
            true
        )

        mockExec.query.mockResolvedValueOnce([{ exists: true }]).mockResolvedValueOnce([
            {
                source_project_id: PROJECT_ID,
                source_scene_id: SCENE_ID,
                manifest_schema_version: '1',
                manifest_checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                runtime_manifest: snapshotWithManifest().playcanvasRuntimeManifests?.[0],
                asset_count: 1,
                script_count: 1,
                artifact_count: 1
            }
        ])

        await expect(hasPublishedPlayCanvasManifestChanges({ schemaName: TEST_SCHEMA, snapshot: snapshotWithManifest() })).resolves.toBe(
            true
        )
    })

    it('persists normalized PlayCanvas runtime manifests after ensuring application system tables', async () => {
        mockExec.query
            .mockResolvedValueOnce([{ exists: true }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 'manifest-row-1' }])

        await persistPublishedPlayCanvasManifests({
            schemaName: TEST_SCHEMA,
            snapshot: snapshotWithManifest(),
            publicationId: PUBLICATION_ID,
            sourceMetahubId: METAHUB_ID,
            userId: 'user-1'
        })

        expect(mockEnsureSystemTables).toHaveBeenCalledWith(TEST_SCHEMA, undefined)
        expect(mockTrx.raw).toHaveBeenCalledWith(expect.stringContaining('FROM pg_indexes'), [
            TEST_SCHEMA,
            'idx_app_playcanvas_manifests_project_scene_active'
        ])
        expect(mockTrx.raw).toHaveBeenCalledWith(
            expect.stringContaining(`DROP INDEX IF EXISTS "${TEST_SCHEMA}"."idx_app_playcanvas_manifests_project_scene_active"`)
        )
        expect(mockTrx.raw).toHaveBeenCalledWith(
            expect.stringContaining(`DROP INDEX IF EXISTS "${TEST_SCHEMA}"."idx_app_playcanvas_manifests_project_active"`)
        )
        expect(mockTrx.raw).toHaveBeenCalledWith(
            expect.stringContaining('CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_playcanvas_manifests_project_scene_active"')
        )
        expect(mockExec.query).toHaveBeenNthCalledWith(2, expect.stringContaining(`UPDATE "${TEST_SCHEMA}"."_app_playcanvas_manifests"`), [
            expect.any(Date),
            'user-1',
            [`${PROJECT_ID}:${SCENE_ID}`],
            '00000000-0000-0000-0000-000000000000'
        ])
        const insertCall = mockExec.query.mock.calls[2]
        expect(insertCall?.[0]).toEqual(expect.stringContaining(`INSERT INTO "${TEST_SCHEMA}"."_app_playcanvas_manifests"`))
        expect(insertCall?.[0]).toEqual(
            expect.stringContaining(
                "ON CONFLICT (\n                    source_project_id,\n                    (COALESCE(source_scene_id, '00000000-0000-0000-0000-000000000000'::uuid))\n                 ) WHERE _upl_deleted = false AND _app_deleted = false"
            )
        )
        const insertParams = insertCall?.[1] as unknown[]
        expect(insertParams.slice(0, 6)).toEqual([PUBLICATION_ID, METAHUB_ID, PROJECT_ID, SCENE_ID, '1', expectedSingleManifestChecksum()])
        expect(JSON.parse(insertParams[6] as string)).toEqual(snapshotWithManifest().playcanvasRuntimeManifests?.[0])
        expect(insertParams.slice(7)).toEqual([1, 1, 1, expect.any(Date), 'user-1'])
    })

    it('keeps an existing project-scene unique index when the shape already matches the upsert target', async () => {
        mockTrx.raw.mockResolvedValueOnce({
            rows: [
                {
                    indexdef:
                        "CREATE UNIQUE INDEX idx_app_playcanvas_manifests_project_scene_active ON _app_playcanvas_manifests (source_project_id, COALESCE(source_scene_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE ((_upl_deleted = false) AND (_app_deleted = false))"
                }
            ]
        })
        mockExec.query
            .mockResolvedValueOnce([{ exists: true }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 'manifest-row-1' }])

        await persistPublishedPlayCanvasManifests({
            schemaName: TEST_SCHEMA,
            snapshot: snapshotWithManifest(),
            publicationId: PUBLICATION_ID,
            sourceMetahubId: METAHUB_ID,
            userId: 'user-1'
        })

        expect(mockTrx.raw).toHaveBeenCalledTimes(2)
        expect(mockTrx.raw).toHaveBeenCalledWith(expect.stringContaining('FROM pg_indexes'), [
            TEST_SCHEMA,
            'idx_app_playcanvas_manifests_project_scene_active'
        ])
        expect(mockTrx.raw).toHaveBeenCalledWith(
            expect.stringContaining(`DROP INDEX IF EXISTS "${TEST_SCHEMA}"."idx_app_playcanvas_manifests_project_active"`)
        )
    })

    it('persists two runtime manifests for the same project when scene ids differ', async () => {
        mockExec.query
            .mockResolvedValueOnce([{ exists: true }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 'manifest-row-1' }])
            .mockResolvedValueOnce([{ id: 'manifest-row-2' }])

        await persistPublishedPlayCanvasManifests({
            schemaName: TEST_SCHEMA,
            snapshot: snapshotWithTwoScenes(),
            publicationId: PUBLICATION_ID,
            sourceMetahubId: METAHUB_ID,
            userId: 'user-1'
        })

        expect(mockExec.query).toHaveBeenNthCalledWith(2, expect.any(String), [
            expect.any(Date),
            'user-1',
            [`${PROJECT_ID}:${SCENE_ID}`, `${PROJECT_ID}:${SECOND_SCENE_ID}`],
            '00000000-0000-0000-0000-000000000000'
        ])
        const firstInsertParams = mockExec.query.mock.calls[2]?.[1] as unknown[]
        const secondInsertParams = mockExec.query.mock.calls[3]?.[1] as unknown[]
        expect(firstInsertParams[3]).toBe(SCENE_ID)
        expect(secondInsertParams[3]).toBe(SECOND_SCENE_ID)
    })

    it('does not report manifest changes after the same manifest was persisted with publication metadata', async () => {
        mockExec.query.mockResolvedValueOnce([{ exists: true }]).mockResolvedValueOnce([persistedRowForScene(SCENE_ID)])

        await expect(hasPublishedPlayCanvasManifestChanges({ schemaName: TEST_SCHEMA, snapshot: snapshotWithManifest() })).resolves.toBe(
            false
        )
    })

    it('does not collapse persisted manifests that share a project but differ by scene id', async () => {
        mockExec.query
            .mockResolvedValueOnce([{ exists: true }])
            .mockResolvedValueOnce([persistedRowForScene(SCENE_ID), persistedRowForScene(SECOND_SCENE_ID)])

        await expect(hasPublishedPlayCanvasManifestChanges({ schemaName: TEST_SCHEMA, snapshot: snapshotWithTwoScenes() })).resolves.toBe(
            false
        )
    })

    it('soft-deletes stale runtime manifests when the snapshot has no PlayCanvas projects', async () => {
        mockExec.query.mockResolvedValueOnce([{ exists: true }]).mockResolvedValueOnce([])

        await persistPublishedPlayCanvasManifests({
            schemaName: TEST_SCHEMA,
            snapshot: {} as PublishedApplicationSnapshot,
            userId: 'user-1'
        })

        expect(mockExec.query).toHaveBeenNthCalledWith(2, expect.not.stringContaining('ANY('), [expect.any(Date), 'user-1'])
        expect(mockExec.query).toHaveBeenCalledTimes(2)
    })
})
