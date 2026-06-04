import { createHash } from 'crypto'
import stableStringify from 'json-stable-stringify'
import { createKnexExecutor, qSchemaTable } from '@universo-react/database'
import { playCanvasRuntimeManifestSchema, type PlayCanvasRuntimeManifest } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import { type ApplicationSyncTransaction, getApplicationSyncDdlServices, getApplicationSyncKnex } from '../../ddl'

type PersistedPlayCanvasManifestRowDb = {
    publication_id: string | null
    source_metahub_id: string | null
    source_project_id: string
    source_scene_id: string | null
    manifest_schema_version: string
    manifest_checksum: string
    runtime_manifest: unknown
    asset_count: number
    script_count: number
    artifact_count: number
}

interface NormalizedPlayCanvasManifestRow {
    publicationId: string | null
    sourceMetahubId: string | null
    sourceProjectId: string
    sourceSceneId: string | null
    manifestSchemaVersion: string
    manifestChecksum: string
    runtimeManifest: PlayCanvasRuntimeManifest
    assetCount: number
    scriptCount: number
    artifactCount: number
}

const createSyncExecutor = (trx?: ApplicationSyncTransaction): DbExecutor => createKnexExecutor(trx ?? getApplicationSyncKnex())
const getPlayCanvasManifestsTable = (schemaName: string): string => qSchemaTable(schemaName, '_app_playcanvas_manifests')
const createRuntimeManifestChecksum = (manifest: Omit<PlayCanvasRuntimeManifest, 'checksum'>): string => {
    return createHash('sha256')
        .update(stableStringify(manifest) ?? '')
        .digest('hex')
}

const normalizeSnapshotManifests = (
    snapshot: PublishedApplicationSnapshot,
    options: { publicationId?: string | null; sourceMetahubId?: string | null } = {}
): NormalizedPlayCanvasManifestRow[] => {
    const raw = Array.isArray(snapshot.playcanvasRuntimeManifests) ? snapshot.playcanvasRuntimeManifests : []
    const seenProjectIds = new Set<string>()

    return raw
        .map((item) => {
            if (!item || typeof item !== 'object') {
                throw new Error('[SchemaSync] PlayCanvas runtime manifest must be an object')
            }
            const parsed = playCanvasRuntimeManifestSchema.safeParse(item)
            if (!parsed.success) {
                throw new Error('[SchemaSync] PlayCanvas runtime manifest is invalid')
            }
            const manifest = parsed.data
            const { checksum, ...manifestWithoutChecksum } = manifest
            const actualChecksum = createRuntimeManifestChecksum(manifestWithoutChecksum)
            if (checksum !== actualChecksum) {
                throw new Error(`[SchemaSync] PlayCanvas runtime manifest ${manifest.projectId} checksum mismatch`)
            }
            if (seenProjectIds.has(manifest.projectId)) {
                throw new Error(`[SchemaSync] Duplicate PlayCanvas runtime manifest for project ${manifest.projectId}`)
            }
            seenProjectIds.add(manifest.projectId)

            return {
                publicationId: options.publicationId ?? null,
                sourceMetahubId: options.sourceMetahubId ?? null,
                sourceProjectId: manifest.projectId,
                sourceSceneId: manifest.sceneId ?? null,
                manifestSchemaVersion: manifest.schemaVersion ?? '1',
                manifestChecksum: actualChecksum,
                runtimeManifest: manifest,
                assetCount: Array.isArray(manifest.assets) ? manifest.assets.length : 0,
                scriptCount: Array.isArray(manifest.scripts) ? manifest.scripts.length : 0,
                artifactCount: Array.isArray(manifest.scripts)
                    ? manifest.scripts.filter((script) => typeof script.artifactHash === 'string' && script.artifactHash.length > 0).length
                    : 0
            }
        })
        .sort((left, right) => left.sourceProjectId.localeCompare(right.sourceProjectId))
}

const normalizePersistedManifests = (rows: PersistedPlayCanvasManifestRowDb[]): NormalizedPlayCanvasManifestRow[] =>
    rows
        .map((row) => ({
            publicationId: row.publication_id ?? null,
            sourceMetahubId: row.source_metahub_id ?? null,
            sourceProjectId: row.source_project_id,
            sourceSceneId: row.source_scene_id,
            manifestSchemaVersion: row.manifest_schema_version,
            manifestChecksum: row.manifest_checksum,
            runtimeManifest: row.runtime_manifest as PlayCanvasRuntimeManifest,
            assetCount: Number(row.asset_count ?? 0),
            scriptCount: Number(row.script_count ?? 0),
            artifactCount: Number(row.artifact_count ?? 0)
        }))
        .sort((left, right) => left.sourceProjectId.localeCompare(right.sourceProjectId))

const normalizeManifestRowsForChangeDetection = (rows: NormalizedPlayCanvasManifestRow[]): NormalizedPlayCanvasManifestRow[] =>
    rows.map((row) => ({
        ...row,
        publicationId: null,
        sourceMetahubId: null
    }))

const ensurePlayCanvasManifestsTable = async (exec: DbExecutor, schemaName: string): Promise<void> => {
    const rows = await exec.query<{ exists: boolean }>(
        `SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = $1
              AND table_name = '_app_playcanvas_manifests'
        ) AS "exists"`,
        [schemaName]
    )

    if (!rows[0]?.exists) {
        throw new Error('Runtime PlayCanvas manifests table is unavailable after system table bootstrap')
    }
}

export async function persistPublishedPlayCanvasManifests(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
    publicationId?: string | null
    sourceMetahubId?: string | null
    userId?: string | null
    trx?: ApplicationSyncTransaction
}): Promise<void> {
    const { schemaName, snapshot, publicationId, sourceMetahubId, userId, trx } = options
    const knex = getApplicationSyncKnex()
    const nextRows = normalizeSnapshotManifests(snapshot, { publicationId, sourceMetahubId })

    const { generator } = getApplicationSyncDdlServices()
    await generator.ensureSystemTables(schemaName, trx)

    const now = new Date()

    const applyPersist = async (activeTrx: ApplicationSyncTransaction) => {
        const exec = createSyncExecutor(activeTrx)
        const table = getPlayCanvasManifestsTable(schemaName)
        await ensurePlayCanvasManifestsTable(exec, schemaName)

        if (nextRows.length === 0) {
            await exec.query(
                `UPDATE ${table}
                 SET _upl_deleted = true,
                     _upl_deleted_at = $1,
                     _upl_deleted_by = $2,
                     _app_deleted = true,
                     _app_deleted_at = $1,
                     _app_deleted_by = $2,
                     _upl_updated_at = $1,
                     _upl_updated_by = $2,
                     _upl_version = _upl_version + 1
                 WHERE _upl_deleted = false
                   AND _app_deleted = false`,
                [now, userId ?? null]
            )
        } else {
            await exec.query(
                `UPDATE ${table}
                 SET _upl_deleted = true,
                     _upl_deleted_at = $1,
                     _upl_deleted_by = $2,
                     _app_deleted = true,
                     _app_deleted_at = $1,
                     _app_deleted_by = $2,
                     _upl_updated_at = $1,
                     _upl_updated_by = $2,
                     _upl_version = _upl_version + 1
                 WHERE _upl_deleted = false
                   AND _app_deleted = false
                   AND NOT (source_project_id = ANY($3::uuid[]))`,
                [now, userId ?? null, nextRows.map((row) => row.sourceProjectId)]
            )
        }

        for (const row of nextRows) {
            const rows = await exec.query<{ id: string }>(
                `INSERT INTO ${table}
                    (publication_id, source_metahub_id, source_project_id, source_scene_id, manifest_schema_version, manifest_checksum,
                     runtime_manifest, asset_count, script_count, artifact_count,
                     _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                     _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                     _app_published, _app_archived, _app_deleted)
                 VALUES
                    ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10,
                     $11, $12, $11, $12,
                     1, false, false, false,
                     true, false, false)
                 ON CONFLICT (source_project_id) WHERE _upl_deleted = false AND _app_deleted = false
                 DO UPDATE SET
                    publication_id = EXCLUDED.publication_id,
                    source_metahub_id = EXCLUDED.source_metahub_id,
                    source_scene_id = EXCLUDED.source_scene_id,
                    manifest_schema_version = EXCLUDED.manifest_schema_version,
                    manifest_checksum = EXCLUDED.manifest_checksum,
                    runtime_manifest = EXCLUDED.runtime_manifest,
                    asset_count = EXCLUDED.asset_count,
                    script_count = EXCLUDED.script_count,
                    artifact_count = EXCLUDED.artifact_count,
                    _upl_updated_at = EXCLUDED._upl_updated_at,
                    _upl_updated_by = EXCLUDED._upl_updated_by,
                    _upl_version = ${table}._upl_version + 1,
                    _upl_deleted = false,
                    _app_deleted = false
                 RETURNING id`,
                [
                    row.publicationId,
                    row.sourceMetahubId,
                    row.sourceProjectId,
                    row.sourceSceneId,
                    row.manifestSchemaVersion,
                    row.manifestChecksum,
                    JSON.stringify(row.runtimeManifest),
                    row.assetCount,
                    row.scriptCount,
                    row.artifactCount,
                    now,
                    userId ?? null
                ]
            )
            if (rows.length === 0) {
                throw new Error(`[SchemaSync] Failed to persist PlayCanvas runtime manifest ${row.sourceProjectId}`)
            }
        }
    }

    if (trx) {
        await applyPersist(trx)
    } else {
        await knex.transaction(applyPersist)
    }
}

export async function hasPublishedPlayCanvasManifestChanges(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
}): Promise<boolean> {
    const { schemaName, snapshot } = options
    const exec = createSyncExecutor()
    const nextRows = normalizeSnapshotManifests(snapshot)
    const hasTableRows = await exec.query<{ exists: boolean }>(
        `SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = $1
              AND table_name = '_app_playcanvas_manifests'
        ) AS "exists"`,
        [schemaName]
    )
    if (hasTableRows[0]?.exists !== true) {
        return nextRows.length > 0
    }

    const persistedRows = await exec.query<PersistedPlayCanvasManifestRowDb>(
        `SELECT publication_id, source_metahub_id, source_project_id, source_scene_id, manifest_schema_version, manifest_checksum,
                runtime_manifest, asset_count, script_count, artifact_count
           FROM ${getPlayCanvasManifestsTable(schemaName)}
          WHERE _upl_deleted = false
            AND _app_deleted = false`
    )

    return (
        stableStringify(normalizeManifestRowsForChangeDetection(normalizePersistedManifests(persistedRows))) !==
        stableStringify(normalizeManifestRowsForChangeDetection(nextRows))
    )
}
