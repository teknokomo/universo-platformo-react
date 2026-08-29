import { OptimisticLockError, type DbExecutor } from '@universo-react/utils'
import type { PlayCanvasAsset } from '@universo-react/types'
import { qSchemaTable } from '@universo-react/database'
import { assetSelect, normalizePlayCanvasAssetMetadata, type UpsertPlayCanvasAssetInput } from './playCanvasProjectsStoreShared'

export async function listPlayCanvasAssets(
    exec: DbExecutor,
    schemaName: string,
    projectId: string
): Promise<(PlayCanvasAsset & { version: number })[]> {
    return exec.query<PlayCanvasAsset & { version: number }>(
        `SELECT ${assetSelect}
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}
          WHERE project_id = $1 AND _upl_deleted = false AND _mhb_deleted = false
          ORDER BY name ASC, id ASC`,
        [projectId]
    )
}

/**
 * Returns every editor document id ever persisted for a project, including
 * soft-deleted assets. Numeric editor ids are part of the ShareDB identity and
 * must never be recycled: an old full-boot token must not become authorized for
 * a different asset after a delete/create cycle.
 */
export async function listPlayCanvasEditorDocumentIds(exec: DbExecutor, schemaName: string, projectId: string): Promise<number[]> {
    const rows = await exec.query<{ documentId: number | null }>(
        `SELECT DISTINCT CASE
                    WHEN metadata->>'editorDocumentId' ~ '^[1-9][0-9]{0,9}$'
                     AND (length(metadata->>'editorDocumentId') < 10
                          OR metadata->>'editorDocumentId' <= '2147483647')
                    THEN (metadata->>'editorDocumentId')::integer
                    ELSE NULL
                END AS "documentId"
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}
          WHERE project_id = $1`,
        [projectId]
    )
    return rows
        .map((row) => row.documentId)
        .filter(
            (documentId): documentId is number =>
                typeof documentId === 'number' && Number.isSafeInteger(documentId) && documentId > 0 && documentId <= 2_147_483_647
        )
}

export async function findPlayCanvasAsset(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    assetId: string
): Promise<(PlayCanvasAsset & { version: number }) | null> {
    const rows = await exec.query<PlayCanvasAsset & { version: number }>(
        `SELECT ${assetSelect}
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}
          WHERE project_id = $1 AND id = $2 AND _upl_deleted = false AND _mhb_deleted = false
          LIMIT 1`,
        [projectId, assetId]
    )
    return rows[0] ?? null
}

export async function playCanvasProjectFileReferenceExists(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    sourcePath: string
): Promise<boolean> {
    const rows = await exec.query<{ exists: boolean | string | number }>(
        `SELECT EXISTS (
            SELECT 1
              FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')} s
             WHERE s.project_id = $1
               AND s.payload_file #>> '{path}' = $2
               AND s._upl_deleted = false
               AND s._mhb_deleted = false
            UNION ALL
            SELECT 1
              FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a
             WHERE a.project_id = $1
               AND a.file_ref #>> '{path}' = $2
               AND a._upl_deleted = false
               AND a._mhb_deleted = false
            UNION ALL
            SELECT 1
              FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_sourcefiles')} sf
             WHERE sf.project_id = $1
               AND sf.file_ref #>> '{path}' = $2
               AND sf._upl_deleted = false
               AND sf._mhb_deleted = false
            UNION ALL
            SELECT 1
              FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_generated_artifacts')} ga
              JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa ON sa.id = ga.script_asset_id
              JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
             WHERE a.project_id = $1
               AND ga.output_file #>> '{path}' = $2
               AND ga._upl_deleted = false
               AND ga._mhb_deleted = false
               AND sa._upl_deleted = false
               AND sa._mhb_deleted = false
               AND a._upl_deleted = false
               AND a._mhb_deleted = false
         ) AS "exists"`,
        [projectId, sourcePath]
    )
    const exists = rows[0]?.exists
    return exists === true || exists === 't' || exists === 'true' || exists === 1
}

export async function playCanvasProjectMetadataFileReferenceExists(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    sourcePath: string
): Promise<boolean> {
    const rows = await exec.query<{ exists: boolean | string | number }>(
        `SELECT EXISTS (
            SELECT 1
              FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')} s
             WHERE s.project_id = $1
               AND s.payload_file #>> '{path}' = $2
               AND s._upl_deleted = false
               AND s._mhb_deleted = false
            UNION ALL
            SELECT 1
              FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_sourcefiles')} sf
             WHERE sf.project_id = $1
               AND sf.file_ref #>> '{path}' = $2
               AND sf._upl_deleted = false
               AND sf._mhb_deleted = false
            UNION ALL
            SELECT 1
              FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_generated_artifacts')} ga
              JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa ON sa.id = ga.script_asset_id
              JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
             WHERE a.project_id = $1
               AND ga.output_file #>> '{path}' = $2
               AND ga._upl_deleted = false
               AND ga._mhb_deleted = false
               AND sa._upl_deleted = false
               AND sa._mhb_deleted = false
               AND a._upl_deleted = false
               AND a._mhb_deleted = false
         ) AS "exists"`,
        [projectId, sourcePath]
    )
    const exists = rows[0]?.exists
    return exists === true || exists === 't' || exists === 'true' || exists === 1
}

export async function markPlayCanvasProjectFileReferenceMissing(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    sourcePath: string,
    userId: string
): Promise<boolean> {
    const sceneRows = await exec.query<{ id: string }>(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')}
            SET status = 'missing',
                payload_file = CASE
                    WHEN payload_file IS NULL THEN payload_file
                    ELSE jsonb_set(payload_file, '{status}', '"missing"', true)
                END,
                _upl_updated_at = NOW(),
                _upl_updated_by = $3,
                _upl_version = _upl_version + 1
          WHERE project_id = $1
            AND payload_file #>> '{path}' = $2
            AND _upl_deleted = false
            AND _mhb_deleted = false
        RETURNING id`,
        [projectId, sourcePath, userId]
    )
    const artifactRows = await exec.query<{ id: string }>(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_generated_artifacts')} ga
            SET parse_status = 'missing',
                output_file = CASE
                    WHEN ga.output_file IS NULL THEN ga.output_file
                    ELSE jsonb_set(ga.output_file, '{status}', '"missing"', true)
                END,
                _upl_updated_at = NOW(),
                _upl_updated_by = $3,
                _upl_version = ga._upl_version + 1
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa
           JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
          WHERE ga.script_asset_id = sa.id
            AND a.project_id = $1
            AND ga.output_file #>> '{path}' = $2
            AND ga._upl_deleted = false
            AND ga._mhb_deleted = false
            AND sa._upl_deleted = false
            AND sa._mhb_deleted = false
            AND a._upl_deleted = false
            AND a._mhb_deleted = false
        RETURNING ga.id`,
        [projectId, sourcePath, userId]
    )
    const sourceFileRows = await exec.query<{ id: string }>(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_sourcefiles')}
            SET status = 'missing',
                parse_status = 'missing',
                file_ref = CASE
                    WHEN file_ref IS NULL THEN file_ref
                    ELSE jsonb_set(file_ref, '{status}', '"missing"', true)
                END,
                _upl_updated_at = NOW(),
                _upl_updated_by = $3,
                _upl_version = _upl_version + 1
          WHERE project_id = $1
            AND file_ref #>> '{path}' = $2
            AND _upl_deleted = false
            AND _mhb_deleted = false
        RETURNING id`,
        [projectId, sourcePath, userId]
    )
    return sceneRows.length + artifactRows.length + sourceFileRows.length > 0
}

export async function markPlayCanvasProjectFileReferenceReady(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    sourcePath: string,
    file: { checksum: string; size: number; mime: string | null },
    userId: string
): Promise<boolean> {
    const sceneRows = await exec.query<{ id: string }>(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')}
            SET status = 'ready',
                payload_file = CASE
                    WHEN payload_file IS NULL THEN payload_file
                    ELSE payload_file || jsonb_strip_nulls(jsonb_build_object(
                        'status', 'ready',
                        'hash', $3::text,
                        'size', $4::integer,
                        'mime', $5::text
                    ))
                END,
                checksum = $3::text,
                _upl_updated_at = NOW(),
                _upl_updated_by = $6::uuid,
                _upl_version = _upl_version + 1
          WHERE project_id = $1
            AND payload_file #>> '{path}' = $2
            AND _upl_deleted = false
            AND _mhb_deleted = false
        RETURNING id`,
        [projectId, sourcePath, file.checksum, file.size, file.mime, userId]
    )
    const artifactRows = await exec.query<{ id: string }>(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_generated_artifacts')} ga
            SET parse_status = 'ready',
                output_file = CASE
                    WHEN ga.output_file IS NULL THEN ga.output_file
                    ELSE ga.output_file || jsonb_strip_nulls(jsonb_build_object(
                        'status', 'ready',
                        'hash', $3::text,
                        'size', $4::integer,
                        'mime', $5::text
                    ))
                END,
                output_checksum = $3::text,
                output_mime = $5::text,
                _upl_updated_at = NOW(),
                _upl_updated_by = $6::uuid,
                _upl_version = ga._upl_version + 1
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa
           JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
          WHERE ga.script_asset_id = sa.id
            AND a.project_id = $1
            AND ga.output_file #>> '{path}' = $2
            AND ga._upl_deleted = false
            AND ga._mhb_deleted = false
            AND sa._upl_deleted = false
            AND sa._mhb_deleted = false
            AND a._upl_deleted = false
            AND a._mhb_deleted = false
        RETURNING ga.id`,
        [projectId, sourcePath, file.checksum, file.size, file.mime, userId]
    )
    const sourceFileRows = await exec.query<{ id: string }>(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_sourcefiles')}
            SET status = 'ready',
                parse_status = 'ready',
                file_ref = CASE
                    WHEN file_ref IS NULL THEN file_ref
                    ELSE file_ref || jsonb_strip_nulls(jsonb_build_object(
                        'status', 'ready',
                        'hash', $3::text,
                        'size', $4::integer,
                        'mime', $5::text
                    ))
                END,
                file_hash = $3::text,
                file_size = $4::integer,
                file_mime = $5::text,
                _upl_updated_at = NOW(),
                _upl_updated_by = $6::uuid,
                _upl_version = _upl_version + 1
          WHERE project_id = $1
            AND file_ref #>> '{path}' = $2
            AND _upl_deleted = false
            AND _mhb_deleted = false
        RETURNING id`,
        [projectId, sourcePath, file.checksum, file.size, file.mime, userId]
    )
    return sceneRows.length + artifactRows.length + sourceFileRows.length > 0
}

export async function markPlayCanvasAssetFileReferenceMissing(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    assetId: string,
    sourcePath: string,
    userId: string
): Promise<boolean> {
    const rows = await exec.query<{ id: string }>(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}
            SET status = 'missing',
                file_ref = CASE
                    WHEN file_ref IS NULL THEN file_ref
                    ELSE jsonb_set(file_ref, '{status}', '"missing"', true)
                END,
                _upl_updated_at = NOW(),
                _upl_updated_by = $4,
                _upl_version = _upl_version + 1
          WHERE project_id = $1
            AND id = $2
            AND file_ref #>> '{path}' = $3
            AND _upl_deleted = false
            AND _mhb_deleted = false
        RETURNING id`,
        [projectId, assetId, sourcePath, userId]
    )
    return rows.length > 0
}

export async function markPlayCanvasAssetFileReferenceReady(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    assetId: string,
    sourcePath: string,
    file: { checksum: string; size: number; mime: string | null },
    userId: string
): Promise<boolean> {
    const rows = await exec.query<{ id: string }>(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}
            SET status = 'ready',
                file_ref = CASE
                    WHEN file_ref IS NULL THEN file_ref
                    ELSE file_ref || jsonb_strip_nulls(jsonb_build_object(
                        'status', 'ready',
                        'hash', $4::text,
                        'size', $5::integer,
                        'mime', $6::text
                    ))
                END,
                file_hash = $4::text,
                size = $5::integer,
                mime = $6::text,
                provider = 'local',
                _upl_updated_at = NOW(),
                _upl_updated_by = $7::uuid,
                _upl_version = _upl_version + 1
          WHERE project_id = $1
            AND id = $2
            AND file_ref #>> '{path}' = $3
            AND _upl_deleted = false
            AND _mhb_deleted = false
        RETURNING id`,
        [projectId, assetId, sourcePath, file.checksum, file.size, file.mime, userId]
    )
    return rows.length > 0
}

export async function upsertPlayCanvasAsset(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    input: UpsertPlayCanvasAssetInput,
    userId: string
): Promise<PlayCanvasAsset & { version: number }> {
    const metadata = normalizePlayCanvasAssetMetadata(input)
    const rows = await exec.query<PlayCanvasAsset & { version: number }>(
        `INSERT INTO ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}
            (id, project_id, stable_asset_id, asset_type, name, virtual_path, file_ref, file_hash, mime, size, provider,
             metadata, publish, status, _upl_created_by, _upl_updated_by)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $15)
         ON CONFLICT (id)
         DO UPDATE SET
            stable_asset_id = EXCLUDED.stable_asset_id,
            asset_type = EXCLUDED.asset_type,
            name = EXCLUDED.name,
            virtual_path = EXCLUDED.virtual_path,
            file_ref = EXCLUDED.file_ref,
            file_hash = EXCLUDED.file_hash,
            mime = EXCLUDED.mime,
            size = EXCLUDED.size,
            provider = EXCLUDED.provider,
            metadata = EXCLUDED.metadata
                || CASE
                    WHEN jsonb_exists(
                        ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}.metadata,
                        'editorDocumentId'
                    )
                    THEN jsonb_build_object(
                        'editorDocumentId',
                        ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}.metadata->'editorDocumentId'
                    )
                    ELSE '{}'::jsonb
                END
                || CASE
                    WHEN jsonb_exists(
                        ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}.metadata,
                        'editorDocumentKey'
                    )
                    THEN jsonb_build_object(
                        'editorDocumentKey',
                        ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}.metadata->'editorDocumentKey'
                    )
                    ELSE '{}'::jsonb
                END,
            publish = EXCLUDED.publish,
            status = EXCLUDED.status,
            _upl_updated_at = NOW(),
            _upl_updated_by = EXCLUDED._upl_updated_by,
            _upl_version = ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}._upl_version + 1,
            _upl_deleted = false,
            _mhb_deleted = false
          WHERE ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}.project_id = $2
            AND (
                $16::integer IS NULL
                OR ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}._upl_version = $16
            )
         RETURNING ${assetSelect}`,
        [
            input.id,
            projectId,
            input.stableAssetId,
            input.type,
            input.name,
            JSON.stringify(input.virtualPath),
            JSON.stringify(input.file ?? null),
            input.file?.hash ?? null,
            input.file?.mime ?? null,
            input.file?.size ?? null,
            input.file?.provider ?? 'local',
            JSON.stringify(metadata),
            input.publish,
            input.file?.status ?? 'missing',
            userId,
            input.expectedVersion ?? null
        ]
    )
    return rows[0]
}

export async function updatePlayCanvasAssetMetadata(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    assetId: string,
    input: {
        name: string
        virtualPath: string[]
        file: PlayCanvasAsset['file']
        expectedVersion: number
    },
    userId: string
): Promise<(PlayCanvasAsset & { version: number }) | null> {
    const rows = await exec.query<PlayCanvasAsset & { version: number }>(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}
            SET name = $3,
                virtual_path = $4::jsonb,
                file_ref = $5::jsonb,
                file_hash = $6,
                mime = $7,
                size = $8,
                provider = $9,
                _upl_updated_at = NOW(),
                _upl_updated_by = $10::uuid,
                _upl_version = _upl_version + 1
          WHERE project_id = $1
            AND id = $2
            AND _upl_deleted = false
            AND _mhb_deleted = false
            AND _upl_version = $11
        RETURNING ${assetSelect}`,
        [
            projectId,
            assetId,
            input.name,
            JSON.stringify(input.virtualPath),
            JSON.stringify(input.file ?? null),
            input.file?.hash ?? null,
            input.file?.mime ?? null,
            input.file?.size ?? null,
            input.file?.provider ?? 'local',
            userId,
            input.expectedVersion
        ]
    )
    return rows[0] ?? null
}

/**
 * Persists the numeric document id assigned to an editor asset in its metadata.
 * This deliberately uses the existing JSONB metadata column instead of a schema
 * change: the upstream editor document identity must survive later asset
 * additions/removals and hash collisions.
 */
export async function persistPlayCanvasAssetEditorDocumentId(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    assetId: string,
    documentId: number,
    expectedVersion: number,
    userId: string
): Promise<boolean> {
    const rows = await exec.query<{ id: string }>(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}
            SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('editorDocumentId', $3::integer),
                _upl_updated_at = NOW(),
                _upl_updated_by = $4::uuid,
                _upl_version = _upl_version + 1
          WHERE project_id = $1
            AND id = $2
            AND _upl_deleted = false
            AND _mhb_deleted = false
            AND _upl_version = $5
        RETURNING id`,
        [projectId, assetId, documentId, userId, expectedVersion]
    )
    return rows.length > 0
}

/**
 * Updates a folder and all of its descendants in one database transaction.
 * The caller has already moved physical files and supplies optimistic versions
 * for every affected row, so a concurrent edit cannot leave a half-moved tree.
 */
export async function updatePlayCanvasAssetTreeMetadata(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    inputs: readonly {
        id: string
        name: string
        virtualPath: string[]
        file: PlayCanvasAsset['file']
        expectedVersion: number
    }[],
    userId: string
): Promise<Array<PlayCanvasAsset & { version: number }>> {
    if (inputs.length === 0) return []
    return exec.transaction(async (tx) => {
        const updated: Array<PlayCanvasAsset & { version: number }> = []
        for (const input of inputs) {
            const row = await updatePlayCanvasAssetMetadata(tx, schemaName, projectId, input.id, input, userId)
            if (!row) {
                throw new OptimisticLockError({
                    entityId: input.id,
                    entityType: 'playcanvasProject',
                    expectedVersion: input.expectedVersion,
                    actualVersion: 0,
                    updatedAt: new Date(0),
                    updatedBy: null
                })
            }
            updated.push(row)
        }
        return updated
    })
}

export async function deletePlayCanvasAssetsByIds(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    assetIds: readonly string[],
    userId: string,
    expectedVersions?: readonly { id: string; version: number }[]
): Promise<Array<{ id: string; file_ref: PlayCanvasAsset['file'] }>> {
    if (assetIds.length === 0) return []
    if (expectedVersions && expectedVersions.length !== assetIds.length) {
        throw new Error('PlayCanvas asset delete expectations must cover every asset id')
    }
    const expectedVersionClause = expectedVersions
        ? `
            AND EXISTS (
                SELECT 1
                  FROM jsonb_to_recordset($4::jsonb) AS expected(id uuid, version integer)
                 WHERE expected.id = asset.id
                   AND expected.version = asset._upl_version
            )`
        : ''
    return exec.query<{ id: string; file_ref: PlayCanvasAsset['file'] }>(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} AS asset
            SET _upl_deleted = true,
                _mhb_deleted = true,
                _upl_updated_at = NOW(),
                _upl_updated_by = $3,
                _upl_version = _upl_version + 1
          WHERE project_id = $1
            AND id = ANY($2::uuid[])
            AND _upl_deleted = false
            AND _mhb_deleted = false
            ${expectedVersionClause}
          RETURNING id, file_ref`,
        expectedVersions ? [projectId, [...assetIds], userId, JSON.stringify(expectedVersions)] : [projectId, [...assetIds], userId]
    )
}
