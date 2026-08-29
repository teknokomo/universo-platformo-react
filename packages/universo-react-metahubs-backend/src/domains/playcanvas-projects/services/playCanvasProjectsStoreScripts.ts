import type { DbExecutor } from '@universo-react/utils'
import type { PlayCanvasGeneratedArtifact, PlayCanvasSceneScriptBinding, PlayCanvasScriptAsset } from '@universo-react/types'
import { playCanvasProjectMetadataSchema, playCanvasProjectParsedAttributesSchema } from '@universo-react/types'
import { qSchemaTable } from '@universo-react/database'
import {
    bindingSelect,
    generatedArtifactSelect,
    scriptAssetSelect,
    scriptAssetSelectWithAlias,
    scriptAssetSelectWithSource,
    type UpsertPlayCanvasGeneratedArtifactInput,
    type UpsertPlayCanvasSceneScriptBindingInput,
    type UpsertPlayCanvasScriptAssetInput
} from './playCanvasProjectsStoreShared'
export type PlayCanvasScriptAssetWithSource = PlayCanvasScriptAsset & {
    version: number
    assetFilePath: string | null
    assetFileHash: string | null
}

/** Lists every script asset of a project joined with its source asset file reference. */
export async function listPlayCanvasScriptAssetsWithSource(
    exec: DbExecutor,
    schemaName: string,
    projectId: string
): Promise<PlayCanvasScriptAssetWithSource[]> {
    return exec.query<PlayCanvasScriptAssetWithSource>(
        `SELECT ${scriptAssetSelectWithSource},
                a.file_ref #>> '{path}' AS "assetFilePath",
                a.file_hash AS "assetFileHash"
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa
           JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
          WHERE a.project_id = $1
            AND sa._upl_deleted = false
            AND sa._mhb_deleted = false
            AND a._upl_deleted = false
            AND a._mhb_deleted = false
          ORDER BY sa.id ASC`,
        [projectId]
    )
}

/** Script asset ids that already own a publication-ready artifact for the current source bytes. */
export async function listPlayCanvasReadyArtifactScriptIds(exec: DbExecutor, schemaName: string, projectId: string): Promise<Set<string>> {
    const rows = await exec.query<{ script_asset_id: string }>(
        `SELECT DISTINCT ga.script_asset_id
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_generated_artifacts')} ga
           JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa ON sa.id = ga.script_asset_id
           JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
          WHERE a.project_id = $1
            AND ga.parse_status = 'ready'
            AND ga.source_checksum IS NOT NULL
            AND ga.source_checksum = a.file_hash
            AND ga._upl_deleted = false
            AND ga._mhb_deleted = false
            AND sa._upl_deleted = false
            AND sa._mhb_deleted = false
            AND a._upl_deleted = false
            AND a._mhb_deleted = false`,
        [projectId]
    )
    return new Set(rows.map((row) => row.script_asset_id))
}

/** Marks artifacts compiled from a previous source checksum as unavailable. */
export async function markPlayCanvasGeneratedArtifactsStale(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    scriptAssetId: string,
    sourceChecksum: string,
    userId: string
): Promise<void> {
    await exec.query(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_generated_artifacts')} ga
            SET parse_status = 'missing',
                output_file = CASE
                    WHEN ga.output_file IS NULL THEN ga.output_file
                    ELSE jsonb_set(ga.output_file, '{status}', '"missing"', true)
                END,
                _upl_updated_at = NOW(),
                _upl_updated_by = $4::uuid,
                _upl_version = ga._upl_version + 1
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa
           JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
          WHERE ga.script_asset_id = sa.id
            AND a.project_id = $1
            AND sa.id = $2
            AND ga.source_checksum IS DISTINCT FROM $3::text
            AND ga._upl_deleted = false
            AND ga._mhb_deleted = false
            AND sa._upl_deleted = false
            AND sa._mhb_deleted = false
            AND a._upl_deleted = false
            AND a._mhb_deleted = false
        RETURNING ga.id`,
        [projectId, scriptAssetId, sourceChecksum, userId]
    )
}

export async function findPlayCanvasScriptAssetByAssetAndName(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    assetId: string,
    scriptName: string
): Promise<(PlayCanvasScriptAsset & { version: number }) | null> {
    const rows = await exec.query<PlayCanvasScriptAsset & { version: number }>(
        `SELECT ${scriptAssetSelectWithAlias}
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa
           JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
          WHERE a.project_id = $1 AND sa.asset_id = $2 AND sa.script_name = $3
            AND sa._upl_deleted = false AND sa._mhb_deleted = false
            AND a._upl_deleted = false AND a._mhb_deleted = false
          LIMIT 1`,
        [projectId, assetId, scriptName]
    )
    return rows[0] ?? null
}

export async function findPlayCanvasScriptAsset(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    scriptAssetId: string
): Promise<(PlayCanvasScriptAsset & { version: number }) | null> {
    const rows = await exec.query<PlayCanvasScriptAsset & { version: number }>(
        `SELECT ${scriptAssetSelectWithAlias}
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
    const parsedAttributes = playCanvasProjectParsedAttributesSchema.parse(input.parsedAttributes)
    const parseDiagnostics = input.parseDiagnostics == null ? null : playCanvasProjectMetadataSchema.parse(input.parseDiagnostics)
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
          WHERE (
                $13::integer IS NULL
                OR ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')}._upl_version = $13
            )
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
            JSON.stringify(parsedAttributes),
            input.parseStatus,
            JSON.stringify(parseDiagnostics),
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
          WHERE (
                $13::integer IS NULL
                OR ${qSchemaTable(schemaName, '_mhb_playcanvas_scene_script_bindings')}._upl_version = $13
            )
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
          WHERE (
                $19::integer IS NULL
                OR ${qSchemaTable(schemaName, '_mhb_playcanvas_generated_artifacts')}._upl_version = $19
            )
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
