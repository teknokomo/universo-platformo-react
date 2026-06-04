import { createHash } from 'crypto'
import stableStringify from 'json-stable-stringify'

const mockExec = {
    query: jest.fn(async () => [])
}

const mockTransaction = jest.fn(async (callback: (trx: unknown) => Promise<void>) => callback({}))
const mockEnsureSystemTables = jest.fn(async () => undefined)
const TEST_SCHEMA = 'app_018f8a787b8f7c1da111222233334444'
const PROJECT_ID = '018f8a78-7b8f-7c1d-a111-222233334444'
const SCENE_ID = '018f8a78-7b8f-7c1d-a111-222233334445'
const PUBLICATION_ID = '018f8a78-7b8f-7c1d-a111-222233334446'
const METAHUB_ID = '018f8a78-7b8f-7c1d-a111-222233334447'
const ASSET_HASH = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const ARTIFACT_HASH = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

jest.mock('@universo-react/database', () => ({
    __esModule: true,
    createKnexExecutor: () => mockExec,
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

const snapshotWithManifest = (checksumOverride?: string): PublishedApplicationSnapshot => {
    const manifestWithoutChecksum = {
        schemaVersion: '1',
        projectId: PROJECT_ID,
        sceneId: SCENE_ID,
        assets: [{ id: 'asset-1', type: 'scene', name: 'Scene', hash: ASSET_HASH }],
        scripts: [{ id: 'script-1', scriptName: 'Ship', scriptKind: 'esm', artifactHash: ARTIFACT_HASH, attributes: {} }]
    }
    return {
        playcanvasRuntimeManifests: [
            {
                ...manifestWithoutChecksum,
                checksum: checksumOverride ?? checksumManifest(manifestWithoutChecksum)
            }
        ]
    } as unknown as PublishedApplicationSnapshot
}

describe('syncPlayCanvasPersistence', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockTransaction.mockImplementation(async (callback: (trx: unknown) => Promise<void>) => callback({}))
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
        expect(mockExec.query).toHaveBeenNthCalledWith(2, expect.stringContaining(`UPDATE "${TEST_SCHEMA}"."_app_playcanvas_manifests"`), [
            expect.any(Date),
            'user-1',
            [PROJECT_ID]
        ])
        const insertCall = mockExec.query.mock.calls[2]
        expect(insertCall?.[0]).toEqual(expect.stringContaining(`INSERT INTO "${TEST_SCHEMA}"."_app_playcanvas_manifests"`))
        expect(insertCall?.[0]).toEqual(
            expect.stringContaining('ON CONFLICT (source_project_id) WHERE _upl_deleted = false AND _app_deleted = false')
        )
        const insertParams = insertCall?.[1] as unknown[]
        expect(insertParams.slice(0, 6)).toEqual([
            PUBLICATION_ID,
            METAHUB_ID,
            PROJECT_ID,
            SCENE_ID,
            '1',
            checksumManifest({
                schemaVersion: '1',
                projectId: PROJECT_ID,
                sceneId: SCENE_ID,
                assets: [{ id: 'asset-1', type: 'scene', name: 'Scene', hash: ASSET_HASH }],
                scripts: [{ id: 'script-1', scriptName: 'Ship', scriptKind: 'esm', artifactHash: ARTIFACT_HASH, attributes: {} }]
            })
        ])
        expect(JSON.parse(insertParams[6] as string)).toEqual(snapshotWithManifest().playcanvasRuntimeManifests?.[0])
        expect(insertParams.slice(7)).toEqual([1, 1, 1, expect.any(Date), 'user-1'])
    })

    it('does not report manifest changes after the same manifest was persisted with publication metadata', async () => {
        mockExec.query.mockResolvedValueOnce([{ exists: true }]).mockResolvedValueOnce([
            {
                publication_id: PUBLICATION_ID,
                source_metahub_id: METAHUB_ID,
                source_project_id: PROJECT_ID,
                source_scene_id: SCENE_ID,
                manifest_schema_version: '1',
                manifest_checksum: checksumManifest({
                    schemaVersion: '1',
                    projectId: PROJECT_ID,
                    sceneId: SCENE_ID,
                    assets: [{ id: 'asset-1', type: 'scene', name: 'Scene', hash: ASSET_HASH }],
                    scripts: [{ id: 'script-1', scriptName: 'Ship', scriptKind: 'esm', artifactHash: ARTIFACT_HASH, attributes: {} }]
                }),
                runtime_manifest: snapshotWithManifest().playcanvasRuntimeManifests?.[0],
                asset_count: 1,
                script_count: 1,
                artifact_count: 1
            }
        ])

        await expect(hasPublishedPlayCanvasManifestChanges({ schemaName: TEST_SCHEMA, snapshot: snapshotWithManifest() })).resolves.toBe(
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
