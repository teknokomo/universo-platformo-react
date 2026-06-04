import type { DbExecutor } from '@universo-react/utils'
import { qSchemaTable } from '@universo-react/database'
import type {
    PlayCanvasAsset,
    PlayCanvasGeneratedArtifact,
    PlayCanvasProjectSummary,
    PlayCanvasRuntimeManifest,
    PlayCanvasScene,
    PlayCanvasSceneScriptBinding,
    PlayCanvasScriptAsset,
    VersionedLocalizedContent
} from '@universo-react/types'
import { codenamePrimaryTextSql } from '../../shared/codename'

export interface PlayCanvasProjectRow {
    id: string
    codename: VersionedLocalizedContent<string>
    displayName: VersionedLocalizedContent<string>
    description: VersionedLocalizedContent<string> | null
    packageName: string
    packageVersion: string | null
    compatibilityStatus: PlayCanvasProjectSummary['compatibilityStatus']
    compatibilityNotes: Record<string, unknown>
    schemaVersion: string
    settings: Record<string, unknown>
    defaultSceneId: string | null
    publicationConfig: Record<string, unknown>
    version: number
}

export interface CreatePlayCanvasProjectRowInput {
    id?: string
    codename: VersionedLocalizedContent<string>
    displayName: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    packageVersion?: string | null
    settings?: Record<string, unknown>
}

export interface UpdatePlayCanvasProjectRowInput {
    displayName?: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    settings?: Record<string, unknown>
    defaultSceneId?: string | null
    expectedVersion?: number
}

export type UpsertPlayCanvasSceneInput = Omit<PlayCanvasScene, 'projectId'> & { expectedVersion?: number }
export type UpsertPlayCanvasAssetInput = Omit<PlayCanvasAsset, 'projectId'> & { expectedVersion?: number }
export type UpsertPlayCanvasScriptAssetInput = PlayCanvasScriptAsset & { expectedVersion?: number }
export type UpsertPlayCanvasSceneScriptBindingInput = PlayCanvasSceneScriptBinding & { expectedVersion?: number }
export type UpsertPlayCanvasGeneratedArtifactInput = PlayCanvasGeneratedArtifact & { expectedVersion?: number }

export interface ReplacePlayCanvasPublicationManifestsInput {
    projectIds: readonly string[]
    manifests: readonly PlayCanvasRuntimeManifest[]
    userId: string
    replaceScope?: 'branch' | 'projects'
}

const projectSelect = `
    id,
    codename,
    display_name AS "displayName",
    description,
    package_name AS "packageName",
    package_version AS "packageVersion",
    compatibility_status AS "compatibilityStatus",
    compatibility_notes AS "compatibilityNotes",
    schema_version AS "schemaVersion",
    settings,
    default_scene_id AS "defaultSceneId",
    publication_config AS "publicationConfig",
    _upl_version AS "version"
`

const sceneSelect = `
    id,
    project_id AS "projectId",
    codename,
    display_name AS "displayName",
    payload_schema_version AS "payloadSchemaVersion",
    payload,
    payload_file AS "payloadFile",
    checksum,
    sort_order AS "sortOrder",
    publish,
    _upl_version AS "version"
`

const assetSelect = `
    id,
    project_id AS "projectId",
    stable_asset_id AS "stableAssetId",
    asset_type AS type,
    name,
    virtual_path AS "virtualPath",
    file_ref AS file,
    metadata,
    publish,
    _upl_version AS "version"
`

const scriptAssetSelect = `
    id,
    asset_id AS "assetId",
    module_id AS "moduleId",
    module_codename AS "moduleCodename",
    module_source_path AS "moduleSourcePath",
    script_name AS "scriptName",
    script_kind AS "scriptKind",
    parsed_attributes AS "parsedAttributes",
    parse_status AS "parseStatus",
    parse_diagnostics AS "parseDiagnostics",
    _upl_version AS "version"
`

const bindingSelect = `
    id,
    scene_id AS "sceneId",
    scene_entity_stable_id AS "sceneEntityStableId",
    script_asset_id AS "scriptAssetId",
    script_name AS "scriptName",
    attribute_values AS "attributeValues",
    binding_schema_version AS "bindingSchemaVersion",
    platformo_entity_id AS "platformoEntityId",
    sort_order AS "sortOrder",
    enabled,
    _upl_version AS "version"
`

const generatedArtifactSelect = `
    id,
    script_asset_id AS "scriptAssetId",
    source_module_id AS "sourceModuleId",
    source_module_codename AS "sourceModuleCodename",
    source_module_path AS "sourceModulePath",
    source_checksum AS "sourceChecksum",
    (
        COALESCE(output_file, '{}'::jsonb)
        || jsonb_strip_nulls(jsonb_build_object('path', output_path, 'hash', output_checksum, 'mime', output_mime))
    ) AS "outputFile",
    script_name AS "scriptName",
    module_export_name AS "moduleExportName",
    script_kind AS "scriptKind",
    parse_status AS "parseStatus",
    generated_at AS "generatedAt",
    parsed_at AS "parsedAt",
    _upl_version AS "version"
`

export async function listPlayCanvasProjects(exec: DbExecutor, schemaName: string): Promise<PlayCanvasProjectRow[]> {
    const rows = await exec.query<PlayCanvasProjectRow>(
        `SELECT ${projectSelect}
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_projects')}
          WHERE _upl_deleted = false AND _mhb_deleted = false
          ORDER BY _upl_updated_at DESC, id ASC`,
        []
    )
    return rows
}

export async function findPlayCanvasProject(exec: DbExecutor, schemaName: string, projectId: string): Promise<PlayCanvasProjectRow | null> {
    const rows = await exec.query<PlayCanvasProjectRow>(
        `SELECT ${projectSelect}
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_projects')}
          WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false
          LIMIT 1`,
        [projectId]
    )
    return rows[0] ?? null
}

export async function listPlayCanvasProjectCodenamesByPrefix(exec: DbExecutor, schemaName: string, prefix: string): Promise<string[]> {
    const codenameSql = codenamePrimaryTextSql('codename')
    const rows = await exec.query<{ codename: string | null }>(
        `SELECT ${codenameSql} AS codename
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_projects')}
          WHERE LEFT(${codenameSql}, LENGTH($1)) = $1
            AND _upl_deleted = false
            AND _mhb_deleted = false`,
        [prefix]
    )
    return rows.map((row) => row.codename).filter((codename): codename is string => typeof codename === 'string' && codename.length > 0)
}

export async function listPlayCanvasScenes(
    exec: DbExecutor,
    schemaName: string,
    projectId: string
): Promise<(PlayCanvasScene & { version: number })[]> {
    return exec.query<PlayCanvasScene & { version: number }>(
        `SELECT ${sceneSelect}
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')}
          WHERE project_id = $1 AND _upl_deleted = false AND _mhb_deleted = false
          ORDER BY sort_order ASC, id ASC`,
        [projectId]
    )
}

export async function findPlayCanvasScene(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    sceneId: string
): Promise<(PlayCanvasScene & { version: number }) | null> {
    const rows = await exec.query<PlayCanvasScene & { version: number }>(
        `SELECT ${sceneSelect}
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')}
          WHERE project_id = $1 AND id = $2 AND _upl_deleted = false AND _mhb_deleted = false
          LIMIT 1`,
        [projectId, sceneId]
    )
    return rows[0] ?? null
}

export async function softDeletePlayCanvasScene(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    sceneId: string,
    expectedVersion: number,
    userId: string
): Promise<boolean> {
    const rows = await exec.query<{ id: string }>(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')}
            SET _upl_deleted = true,
                _mhb_deleted = true,
                _upl_updated_at = NOW(),
                _upl_updated_by = $4,
                _upl_version = _upl_version + 1
          WHERE project_id = $1
            AND id = $2
            AND _upl_version = $3
            AND _upl_deleted = false
            AND _mhb_deleted = false
        RETURNING id`,
        [projectId, sceneId, expectedVersion, userId]
    )
    return rows.length > 0
}

export async function upsertPlayCanvasScene(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    input: UpsertPlayCanvasSceneInput,
    userId: string
): Promise<PlayCanvasScene & { version: number }> {
    const rows = await exec.query<PlayCanvasScene & { version: number }>(
        `INSERT INTO ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')}
            (id, project_id, codename, display_name, payload_schema_version, payload, payload_file, checksum,
             sort_order, publish, status, _upl_created_by, _upl_updated_by)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $12)
         ON CONFLICT (id)
         DO UPDATE SET
            codename = EXCLUDED.codename,
            display_name = EXCLUDED.display_name,
            payload_schema_version = EXCLUDED.payload_schema_version,
            payload = EXCLUDED.payload,
            payload_file = EXCLUDED.payload_file,
            checksum = EXCLUDED.checksum,
            sort_order = EXCLUDED.sort_order,
            publish = EXCLUDED.publish,
            status = EXCLUDED.status,
            _upl_updated_at = NOW(),
            _upl_updated_by = EXCLUDED._upl_updated_by,
            _upl_version = ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')}._upl_version + 1,
            _upl_deleted = false,
            _mhb_deleted = false
          WHERE ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')}.project_id = $2
            AND ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')}._upl_version = $13
         RETURNING ${sceneSelect}`,
        [
            input.id,
            projectId,
            input.codename,
            input.displayName,
            input.payloadSchemaVersion,
            JSON.stringify(input.payload ?? null),
            JSON.stringify(input.payloadFile ?? null),
            input.checksum ?? null,
            input.sortOrder,
            input.publish,
            input.payloadFile?.status ?? (input.payload ? 'ready' : 'missing'),
            userId,
            input.expectedVersion ?? null
        ]
    )
    return rows[0]
}

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
    return sceneRows.length + artifactRows.length > 0
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
    return sceneRows.length + artifactRows.length > 0
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
            metadata = EXCLUDED.metadata,
            publish = EXCLUDED.publish,
            status = EXCLUDED.status,
            _upl_updated_at = NOW(),
            _upl_updated_by = EXCLUDED._upl_updated_by,
            _upl_version = ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}._upl_version + 1,
            _upl_deleted = false,
            _mhb_deleted = false
          WHERE ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}.project_id = $2
            AND ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}._upl_version = $16
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
            JSON.stringify(input.metadata),
            input.publish,
            input.file?.status ?? 'missing',
            userId,
            input.expectedVersion ?? null
        ]
    )
    return rows[0]
}

export async function findPlayCanvasScriptAsset(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    scriptAssetId: string
): Promise<(PlayCanvasScriptAsset & { version: number }) | null> {
    const rows = await exec.query<PlayCanvasScriptAsset & { version: number }>(
        `SELECT ${scriptAssetSelect}
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa
           JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
          WHERE a.project_id = $1 AND sa.id = $2
            AND sa._upl_deleted = false AND sa._mhb_deleted = false
            AND a._upl_deleted = false AND a._mhb_deleted = false
          LIMIT 1`,
        [projectId, scriptAssetId]
    )
    return rows[0] ?? null
}

export async function upsertPlayCanvasScriptAsset(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    input: UpsertPlayCanvasScriptAssetInput,
    userId: string
): Promise<(PlayCanvasScriptAsset & { version: number }) | null> {
    const rows = await exec.query<PlayCanvasScriptAsset & { version: number }>(
        `INSERT INTO ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')}
            (id, asset_id, module_id, module_codename, module_source_path, script_name, script_kind,
             parsed_attributes, parse_status, parse_diagnostics, _upl_created_by, _upl_updated_by)
         SELECT $1, a.id, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11, $11
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a
          WHERE a.project_id = $2 AND a.id = $12 AND a._upl_deleted = false AND a._mhb_deleted = false
         ON CONFLICT (id)
         DO UPDATE SET
            asset_id = EXCLUDED.asset_id,
            module_id = EXCLUDED.module_id,
            module_codename = EXCLUDED.module_codename,
            module_source_path = EXCLUDED.module_source_path,
            script_name = EXCLUDED.script_name,
            script_kind = EXCLUDED.script_kind,
            parsed_attributes = EXCLUDED.parsed_attributes,
            parse_status = EXCLUDED.parse_status,
            parse_diagnostics = EXCLUDED.parse_diagnostics,
            _upl_updated_at = NOW(),
            _upl_updated_by = EXCLUDED._upl_updated_by,
            _upl_version = ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')}._upl_version + 1,
            _upl_deleted = false,
            _mhb_deleted = false
          WHERE ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')}._upl_version = $13
            AND EXISTS (
                SELECT 1
                  FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} current_asset
                 WHERE current_asset.id = ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')}.asset_id
                   AND current_asset.project_id = $2
                   AND current_asset._upl_deleted = false
                   AND current_asset._mhb_deleted = false
            )
         RETURNING ${scriptAssetSelect}`,
        [
            input.id,
            projectId,
            input.moduleId ?? null,
            input.moduleCodename ?? null,
            input.moduleSourcePath ?? null,
            input.scriptName,
            input.scriptKind,
            JSON.stringify(input.parsedAttributes),
            input.parseStatus,
            JSON.stringify(input.parseDiagnostics ?? null),
            userId,
            input.assetId,
            input.expectedVersion ?? null
        ]
    )
    return rows[0] ?? null
}

export async function upsertPlayCanvasSceneScriptBinding(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    input: UpsertPlayCanvasSceneScriptBindingInput,
    userId: string
): Promise<(PlayCanvasSceneScriptBinding & { version: number }) | null> {
    const rows = await exec.query<PlayCanvasSceneScriptBinding & { version: number }>(
        `INSERT INTO ${qSchemaTable(schemaName, '_mhb_playcanvas_scene_script_bindings')}
            (id, scene_id, scene_entity_stable_id, script_asset_id, script_name, attribute_values,
             binding_schema_version, platformo_entity_id, sort_order, enabled, _upl_created_by, _upl_updated_by)
         SELECT $1, s.id, $4, sa.id, $6, $7::jsonb, $8, $9, $10, $11, $12, $12
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')} s
           JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa ON sa.id = $5
           JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
          WHERE s.project_id = $2 AND s.id = $3 AND a.project_id = $2
            AND s._upl_deleted = false AND s._mhb_deleted = false
            AND sa._upl_deleted = false AND sa._mhb_deleted = false
            AND a._upl_deleted = false AND a._mhb_deleted = false
         ON CONFLICT (id)
         DO UPDATE SET
            scene_id = EXCLUDED.scene_id,
            scene_entity_stable_id = EXCLUDED.scene_entity_stable_id,
            script_asset_id = EXCLUDED.script_asset_id,
            script_name = EXCLUDED.script_name,
            attribute_values = EXCLUDED.attribute_values,
            binding_schema_version = EXCLUDED.binding_schema_version,
            platformo_entity_id = EXCLUDED.platformo_entity_id,
            sort_order = EXCLUDED.sort_order,
            enabled = EXCLUDED.enabled,
            _upl_updated_at = NOW(),
            _upl_updated_by = EXCLUDED._upl_updated_by,
            _upl_version = ${qSchemaTable(schemaName, '_mhb_playcanvas_scene_script_bindings')}._upl_version + 1,
            _upl_deleted = false,
            _mhb_deleted = false
          WHERE ${qSchemaTable(schemaName, '_mhb_playcanvas_scene_script_bindings')}._upl_version = $13
            AND EXISTS (
                SELECT 1
                  FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')} current_scene
                 WHERE current_scene.id = ${qSchemaTable(schemaName, '_mhb_playcanvas_scene_script_bindings')}.scene_id
                   AND current_scene.project_id = $2
                   AND current_scene._upl_deleted = false
                   AND current_scene._mhb_deleted = false
            )
            AND EXISTS (
                SELECT 1
                  FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} current_script
                  JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} current_asset ON current_asset.id = current_script.asset_id
                 WHERE current_script.id = ${qSchemaTable(schemaName, '_mhb_playcanvas_scene_script_bindings')}.script_asset_id
                   AND current_asset.project_id = $2
                   AND current_script._upl_deleted = false
                   AND current_script._mhb_deleted = false
                   AND current_asset._upl_deleted = false
                   AND current_asset._mhb_deleted = false
            )
         RETURNING ${bindingSelect}`,
        [
            input.id,
            projectId,
            input.sceneId,
            input.sceneEntityStableId,
            input.scriptAssetId,
            input.scriptName,
            JSON.stringify(input.attributeValues),
            input.bindingSchemaVersion,
            input.platformoEntityId ?? null,
            input.sortOrder,
            input.enabled,
            userId,
            input.expectedVersion ?? null
        ]
    )
    return rows[0] ?? null
}

export async function upsertPlayCanvasGeneratedArtifact(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    input: UpsertPlayCanvasGeneratedArtifactInput,
    userId: string
): Promise<(PlayCanvasGeneratedArtifact & { version: number }) | null> {
    const rows = await exec.query<PlayCanvasGeneratedArtifact & { version: number }>(
        `INSERT INTO ${qSchemaTable(schemaName, '_mhb_playcanvas_generated_artifacts')}
            (id, script_asset_id, source_module_id, source_module_codename, source_module_path, source_checksum,
             output_file, output_path, output_checksum, output_mime, script_name, module_export_name, script_kind,
             parse_status, generated_at, parsed_at, _upl_created_by, _upl_updated_by)
         SELECT $1, sa.id, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa
           JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
          WHERE a.project_id = $2 AND sa.id = $3
            AND sa._upl_deleted = false AND sa._mhb_deleted = false
            AND a._upl_deleted = false AND a._mhb_deleted = false
         ON CONFLICT (id)
         DO UPDATE SET
            script_asset_id = EXCLUDED.script_asset_id,
            source_module_id = EXCLUDED.source_module_id,
            source_module_codename = EXCLUDED.source_module_codename,
            source_module_path = EXCLUDED.source_module_path,
            source_checksum = EXCLUDED.source_checksum,
            output_file = EXCLUDED.output_file,
            output_path = EXCLUDED.output_path,
            output_checksum = EXCLUDED.output_checksum,
            output_mime = EXCLUDED.output_mime,
            script_name = EXCLUDED.script_name,
            module_export_name = EXCLUDED.module_export_name,
            script_kind = EXCLUDED.script_kind,
            parse_status = EXCLUDED.parse_status,
            generated_at = EXCLUDED.generated_at,
            parsed_at = EXCLUDED.parsed_at,
            _upl_updated_at = NOW(),
            _upl_updated_by = EXCLUDED._upl_updated_by,
            _upl_version = ${qSchemaTable(schemaName, '_mhb_playcanvas_generated_artifacts')}._upl_version + 1,
            _upl_deleted = false,
            _mhb_deleted = false
          WHERE ${qSchemaTable(schemaName, '_mhb_playcanvas_generated_artifacts')}._upl_version = $19
            AND EXISTS (
                SELECT 1
                  FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} current_script
                  JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} current_asset ON current_asset.id = current_script.asset_id
                 WHERE current_script.id = ${qSchemaTable(schemaName, '_mhb_playcanvas_generated_artifacts')}.script_asset_id
                   AND current_asset.project_id = $2
                   AND current_script._upl_deleted = false
                   AND current_script._mhb_deleted = false
                   AND current_asset._upl_deleted = false
                   AND current_asset._mhb_deleted = false
            )
         RETURNING ${generatedArtifactSelect}`,
        [
            input.id,
            projectId,
            input.scriptAssetId,
            input.sourceModuleId ?? null,
            input.sourceModuleCodename ?? null,
            input.sourceModulePath ?? null,
            input.sourceChecksum ?? null,
            JSON.stringify(input.outputFile),
            input.outputFile.path,
            input.outputFile.hash ?? null,
            input.outputFile.mime ?? null,
            input.scriptName,
            input.moduleExportName ?? null,
            input.scriptKind,
            input.outputFile.status ?? (input.parseStatus === 'ready' ? 'missing' : input.parseStatus),
            input.generatedAt ? new Date(input.generatedAt) : null,
            input.parsedAt ? new Date(input.parsedAt) : null,
            userId,
            input.expectedVersion ?? null
        ]
    )
    return rows[0] ?? null
}

export async function createPlayCanvasProject(
    exec: DbExecutor,
    schemaName: string,
    input: CreatePlayCanvasProjectRowInput,
    userId: string
): Promise<PlayCanvasProjectRow> {
    const rows = await exec.query<PlayCanvasProjectRow>(
        `INSERT INTO ${qSchemaTable(schemaName, '_mhb_playcanvas_projects')}
            (${input.id ? 'id, ' : ''}codename, display_name, description, package_version, settings, _upl_created_by, _upl_updated_by)
         VALUES (${input.id ? '$1, ' : ''}${input.id ? '$2, $3, $4, $5, $6, $7, $7' : '$1, $2, $3, $4, $5, $6, $6'})
         RETURNING ${projectSelect}`,
        input.id
            ? [
                  input.id,
                  input.codename,
                  input.displayName,
                  input.description ?? null,
                  input.packageVersion ?? null,
                  input.settings ?? {},
                  userId
              ]
            : [input.codename, input.displayName, input.description ?? null, input.packageVersion ?? null, input.settings ?? {}, userId]
    )
    return rows[0]
}

export async function updatePlayCanvasProject(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    input: UpdatePlayCanvasProjectRowInput,
    userId: string
): Promise<PlayCanvasProjectRow | null> {
    const patches: string[] = ['_upl_updated_at = NOW()', '_upl_updated_by = $2', '_upl_version = _upl_version + 1']
    const params: unknown[] = [projectId, userId]
    const addPatch = (column: string, value: unknown) => {
        params.push(value)
        patches.push(`${column} = $${params.length}`)
    }

    if (input.displayName !== undefined) addPatch('display_name', input.displayName)
    if (input.description !== undefined) addPatch('description', input.description)
    if (input.settings !== undefined) addPatch('settings', input.settings)
    if (input.defaultSceneId !== undefined) addPatch('default_scene_id', input.defaultSceneId)

    let versionGuard = ''
    if (input.expectedVersion !== undefined) {
        params.push(input.expectedVersion)
        versionGuard = ` AND _upl_version = $${params.length}`
    }

    const rows = await exec.query<PlayCanvasProjectRow>(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_projects')}
            SET ${patches.join(', ')}
          WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false${versionGuard}
          RETURNING ${projectSelect}`,
        params
    )
    return rows[0] ?? null
}

export async function softDeletePlayCanvasProject(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    userId: string,
    expectedVersion?: number
): Promise<(PlayCanvasProjectRow & { deletionToken: Date }) | null> {
    const deletionToken = new Date()
    const params: unknown[] = [projectId, userId, deletionToken]
    let versionGuard = ''
    if (expectedVersion !== undefined) {
        params.push(expectedVersion)
        versionGuard = ` AND _upl_version = $${params.length}`
    }
    const rows = await exec.query<PlayCanvasProjectRow>(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_projects')}
            SET _upl_deleted = true,
                _upl_deleted_at = $3,
                _upl_deleted_by = $2,
                _mhb_deleted = true,
                _mhb_deleted_at = $3,
                _mhb_deleted_by = $2,
                _upl_updated_at = NOW(),
                _upl_updated_by = $2,
                _upl_version = _upl_version + 1
          WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false${versionGuard}
          RETURNING ${projectSelect}`,
        params
    )
    const deleted = rows[0] ?? null
    if (!deleted) {
        return null
    }

    try {
        await softDeletePlayCanvasProjectChildren(exec, schemaName, projectId, userId, deletionToken)
    } catch (error) {
        await restoreSoftDeletedPlayCanvasProject(exec, schemaName, projectId, userId, deletionToken)
        throw error
    }
    return { ...deleted, deletionToken }
}

export async function clearPlayCanvasDefaultProjectPointers(
    exec: DbExecutor,
    metahubId: string,
    projectId: string,
    userId: string
): Promise<Array<{ id: string; config: Record<string, unknown> }>> {
    return exec.query<{ id: string; config: Record<string, unknown> }>(
        `WITH affected AS (
            SELECT id, config
              FROM ${qSchemaTable('metahubs', 'rel_metahub_packages')}
             WHERE metahub_id = $1
               AND is_active = true
               AND _upl_deleted = false
               AND _app_deleted = false
               AND config #>> '{playcanvasProject,defaultProjectId}' = $2
         ),
         updated AS (
            UPDATE ${qSchemaTable('metahubs', 'rel_metahub_packages')} target
               SET config = jsonb_set(target.config, '{playcanvasProject,defaultProjectId}', 'null'::jsonb, true),
                   _upl_updated_at = NOW(),
                   _upl_updated_by = $3,
                   _upl_version = target._upl_version + 1
              FROM affected
             WHERE target.id = affected.id
             RETURNING affected.id, affected.config
         )
         SELECT id, config FROM updated`,
        [metahubId, projectId, userId]
    )
}

export async function restorePlayCanvasDefaultProjectPointers(
    exec: DbExecutor,
    previousConfigs: Array<{ id: string; config: Record<string, unknown> }>,
    userId: string
): Promise<void> {
    for (const previous of previousConfigs) {
        await exec.query(
            `UPDATE ${qSchemaTable('metahubs', 'rel_metahub_packages')}
                SET config = $2::jsonb,
                    _upl_updated_at = NOW(),
                    _upl_updated_by = $3,
                    _upl_version = _upl_version + 1
              WHERE id = $1
                AND is_active = true
                AND _upl_deleted = false
                AND _app_deleted = false`,
            [previous.id, previous.config, userId]
        )
    }
}

export async function replacePlayCanvasPublicationManifests(
    exec: DbExecutor,
    schemaName: string,
    input: ReplacePlayCanvasPublicationManifestsInput
): Promise<void> {
    const projectIds = [...new Set(input.projectIds.map((id) => id.trim()).filter(Boolean))]
    if (projectIds.length === 0 && input.replaceScope !== 'branch') {
        return
    }

    const scopeFilter = input.replaceScope === 'branch' ? '' : `project_id::text = ANY($1::text[]) AND `

    await exec.query(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_publication_manifests')}
            SET _upl_deleted = true,
                _upl_deleted_at = NOW(),
                _upl_deleted_by = $2,
                _mhb_deleted = true,
                _mhb_deleted_at = NOW(),
                _mhb_deleted_by = $2,
                _upl_updated_at = NOW(),
                _upl_updated_by = $2,
                _upl_version = _upl_version + 1,
                published = false
          WHERE ${scopeFilter}_upl_deleted = false
            AND _mhb_deleted = false`,
        [projectIds, input.userId]
    )

    for (const manifest of input.manifests) {
        if (!projectIds.includes(manifest.projectId)) {
            continue
        }
        const sourceProjectChecksum =
            typeof manifest.metadata?.sourceProjectChecksum === 'string' ? manifest.metadata.sourceProjectChecksum : null

        await exec.query(
            `INSERT INTO ${qSchemaTable(schemaName, '_mhb_playcanvas_publication_manifests')}
                (project_id, selected_scene_id, manifest_schema_version, runtime_manifest, manifest_checksum,
                 source_project_checksum, published, _upl_created_by, _upl_updated_by)
             VALUES ($1, $2, $3, $4::jsonb, $5, $6, true, $7, $7)`,
            [
                manifest.projectId,
                manifest.sceneId ?? null,
                manifest.schemaVersion,
                JSON.stringify(manifest),
                manifest.checksum,
                sourceProjectChecksum,
                input.userId
            ]
        )
    }
}

export async function restoreSoftDeletedPlayCanvasProject(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    userId: string,
    deletionToken: Date
): Promise<void> {
    await restoreSoftDeletedPlayCanvasProjectRows(exec, schemaName, '_mhb_playcanvas_projects', 'project', projectId, userId, deletionToken)
    await restoreSoftDeletedPlayCanvasProjectRows(exec, schemaName, '_mhb_playcanvas_scenes', 'project', projectId, userId, deletionToken)
    await restoreSoftDeletedPlayCanvasProjectRows(exec, schemaName, '_mhb_playcanvas_assets', 'project', projectId, userId, deletionToken)
    await restoreSoftDeletedPlayCanvasProjectRows(
        exec,
        schemaName,
        '_mhb_playcanvas_script_assets',
        'scriptAsset',
        projectId,
        userId,
        deletionToken
    )
    await restoreSoftDeletedPlayCanvasProjectRows(
        exec,
        schemaName,
        '_mhb_playcanvas_scene_script_bindings',
        'binding',
        projectId,
        userId,
        deletionToken
    )
    await restoreSoftDeletedPlayCanvasProjectRows(
        exec,
        schemaName,
        '_mhb_playcanvas_generated_artifacts',
        'artifact',
        projectId,
        userId,
        deletionToken
    )
    await restoreSoftDeletedPlayCanvasProjectRows(
        exec,
        schemaName,
        '_mhb_playcanvas_publication_manifests',
        'project',
        projectId,
        userId,
        deletionToken
    )
    await restoreSoftDeletedPlayCanvasProjectRows(
        exec,
        schemaName,
        '_mhb_playcanvas_package_compatibility',
        'project',
        projectId,
        userId,
        deletionToken
    )
}

async function softDeletePlayCanvasProjectChildren(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    userId: string,
    deletionToken: Date
): Promise<void> {
    const deletedColumns = `
        _upl_deleted = true,
        _upl_deleted_at = $3,
        _upl_deleted_by = $2,
        _mhb_deleted = true,
        _mhb_deleted_at = $3,
        _mhb_deleted_by = $2,
        _upl_updated_at = NOW(),
        _upl_updated_by = $2,
        _upl_version = _upl_version + 1
    `

    await exec.query(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_scene_script_bindings')} b
            SET ${deletedColumns}
          WHERE b._upl_deleted = false
            AND b._mhb_deleted = false
            AND (
                b.scene_id IN (
                    SELECT s.id
                      FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')} s
                     WHERE s.project_id = $1
                )
                OR b.script_asset_id IN (
                    SELECT sa.id
                      FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa
                      JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
                     WHERE a.project_id = $1
                )
            )`,
        [projectId, userId, deletionToken]
    )
    await exec.query(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_generated_artifacts')} ga
            SET ${deletedColumns}
          WHERE ga._upl_deleted = false
            AND ga._mhb_deleted = false
            AND ga.script_asset_id IN (
                SELECT sa.id
                  FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa
                  JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
                 WHERE a.project_id = $1
            )`,
        [projectId, userId, deletionToken]
    )
    await exec.query(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa
            SET ${deletedColumns}
          WHERE sa._upl_deleted = false
            AND sa._mhb_deleted = false
            AND sa.asset_id IN (
                SELECT a.id
                  FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a
                 WHERE a.project_id = $1
            )`,
        [projectId, userId, deletionToken]
    )
    await exec.query(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_publication_manifests')}
            SET ${deletedColumns}
          WHERE project_id = $1
            AND _upl_deleted = false
            AND _mhb_deleted = false`,
        [projectId, userId, deletionToken]
    )
    await exec.query(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}
            SET ${deletedColumns}
          WHERE project_id = $1
            AND _upl_deleted = false
            AND _mhb_deleted = false`,
        [projectId, userId, deletionToken]
    )
    await exec.query(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')}
            SET ${deletedColumns}
          WHERE project_id = $1
            AND _upl_deleted = false
            AND _mhb_deleted = false`,
        [projectId, userId, deletionToken]
    )
    await exec.query(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_package_compatibility')}
            SET ${deletedColumns}
          WHERE project_id = $1
            AND _upl_deleted = false
            AND _mhb_deleted = false`,
        [projectId, userId, deletionToken]
    )
}

async function restoreSoftDeletedPlayCanvasProjectRows(
    exec: DbExecutor,
    schemaName: string,
    tableName: string,
    relation: 'project' | 'scriptAsset' | 'binding' | 'artifact',
    projectId: string,
    userId: string,
    deletionToken: Date
): Promise<void> {
    const restoredColumns = `
        _upl_deleted = false,
        _upl_deleted_at = NULL,
        _upl_deleted_by = NULL,
        _mhb_deleted = false,
        _mhb_deleted_at = NULL,
        _mhb_deleted_by = NULL,
        _upl_updated_at = NOW(),
        _upl_updated_by = $2,
        _upl_version = _upl_version + 1
    `
    const table = qSchemaTable(schemaName, tableName)
    const deletionGuard = `_upl_deleted = true AND _mhb_deleted = true AND _upl_deleted_by = $2 AND _mhb_deleted_by = $2 AND _upl_deleted_at = $3 AND _mhb_deleted_at = $3`
    const whereByRelation =
        relation === 'project'
            ? `project_id = $1`
            : relation === 'scriptAsset'
            ? `asset_id IN (SELECT a.id FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a WHERE a.project_id = $1)`
            : relation === 'binding'
            ? `(scene_id IN (SELECT s.id FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')} s WHERE s.project_id = $1)
                    OR script_asset_id IN (
                        SELECT sa.id
                          FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa
                          JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
                         WHERE a.project_id = $1
                    ))`
            : `script_asset_id IN (
                    SELECT sa.id
                      FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa
                      JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
                     WHERE a.project_id = $1
                )`
    const where = tableName === '_mhb_playcanvas_projects' ? `id = $1` : whereByRelation

    await exec.query(
        `UPDATE ${table}
            SET ${restoredColumns}
          WHERE ${where}
            AND ${deletionGuard}`,
        [projectId, userId, deletionToken]
    )
}

export async function summarizePlayCanvasProject(
    exec: DbExecutor,
    schemaName: string,
    project: PlayCanvasProjectRow
): Promise<PlayCanvasProjectSummary> {
    const rows = await exec.query<{
        sceneCount: string
        assetCount: string
        scriptCount: string
        generatedArtifactCount: string
        blockingCount: string
        publishableSceneCount: string
    }>(
        `SELECT
	            (SELECT COUNT(*)::text FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')}
	              WHERE project_id = $1 AND _upl_deleted = false AND _mhb_deleted = false) AS "sceneCount",
	            (SELECT COUNT(*)::text FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}
	              WHERE project_id = $1 AND _upl_deleted = false AND _mhb_deleted = false) AS "assetCount",
            (SELECT COUNT(*)::text FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa
              JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
             WHERE a.project_id = $1 AND sa._upl_deleted = false AND sa._mhb_deleted = false AND a._upl_deleted = false AND a._mhb_deleted = false) AS "scriptCount",
	            (SELECT COUNT(*)::text FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_generated_artifacts')} ga
	              JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa ON sa.id = ga.script_asset_id
	              JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
	             WHERE a.project_id = $1
                    AND ga._upl_deleted = false AND ga._mhb_deleted = false
                    AND sa._upl_deleted = false AND sa._mhb_deleted = false
                    AND a._upl_deleted = false AND a._mhb_deleted = false) AS "generatedArtifactCount",
	            (
	                (SELECT COUNT(*) FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')}
	                  WHERE project_id = $1
                    AND COALESCE(status, 'missing') <> 'ready'
	                    AND _upl_deleted = false
	                    AND _mhb_deleted = false)
	                +
                (SELECT COUNT(*) FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')}
                  WHERE project_id = $1
                    AND COALESCE(status, 'missing') <> 'ready'
                    AND file_ref IS NOT NULL
                    AND COALESCE(file_ref->>'path', '') <> ''
		                    AND _upl_deleted = false
		                    AND _mhb_deleted = false)
	                +
	                (SELECT COUNT(*) FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa
	                  JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
	                 WHERE a.project_id = $1
                   AND COALESCE(sa.parse_status, 'missing') <> 'ready'
	                   AND sa._upl_deleted = false
	                   AND sa._mhb_deleted = false
	                   AND a._upl_deleted = false
	                   AND a._mhb_deleted = false)
	                +
	                (SELECT COUNT(*) FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_generated_artifacts')} ga
	                  JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa ON sa.id = ga.script_asset_id
	                  JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
	                 WHERE a.project_id = $1
                   AND COALESCE(ga.parse_status, 'missing') <> 'ready'
	                   AND ga._upl_deleted = false
	                   AND ga._mhb_deleted = false
	                   AND sa._upl_deleted = false
	                   AND sa._mhb_deleted = false
	                   AND a._upl_deleted = false
	                   AND a._mhb_deleted = false)
	            )::text AS "blockingCount",
	            (SELECT COUNT(*)::text
	               FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')} s
	              WHERE s.project_id = $1
	                AND s.publish = true
                AND COALESCE(s.status, 'missing') = 'ready'
	                AND s.payload_file IS NOT NULL
	                AND s.payload_file->>'provider' = 'local'
	                AND COALESCE(s.payload_file->>'path', '') <> ''
	                AND COALESCE(s.payload_file->>'hash', '') <> ''
	                AND ($2::uuid IS NULL OR s.id = $2::uuid)
	                AND s._upl_deleted = false
	                AND s._mhb_deleted = false) AS "publishableSceneCount"`,
        [project.id, project.defaultSceneId ?? null]
    )
    const counts = rows[0]
    const blockingCount = Number(counts?.blockingCount ?? 0)
    const publishableSceneCount = Number(counts?.publishableSceneCount ?? 0)
    return {
        id: project.id,
        displayName: project.displayName,
        codename: project.codename,
        version: project.version,
        defaultSceneId: project.defaultSceneId,
        compatibilityStatus: project.compatibilityStatus,
        status: blockingCount > 0 || project.compatibilityStatus === 'blocked' ? 'publishBlocking' : 'ready',
        sceneCount: Number(counts?.sceneCount ?? 0),
        assetCount: Number(counts?.assetCount ?? 0),
        scriptCount: Number(counts?.scriptCount ?? 0),
        generatedArtifactCount: Number(counts?.generatedArtifactCount ?? 0),
        publishable: publishableSceneCount > 0 && blockingCount === 0 && project.compatibilityStatus === 'compatible'
    }
}
