import type { DbExecutor } from '@universo-react/utils'
import type {
    PlayCanvasPublishedRuntimeManifestSummary,
    PlayCanvasProjectSummary,
    PlayCanvasRuntimeManifest,
    PlayCanvasScene
} from '@universo-react/types'
import { playCanvasProjectPayloadSchema, playCanvasProjectSettingsSchema } from '@universo-react/types'
import { qSchemaTable } from '@universo-react/database'
import { codenamePrimaryTextSql } from '../../shared/codename'
import {
    projectSelect,
    sceneSelect,
    type CreatePlayCanvasProjectRowInput,
    type PlayCanvasProjectRow,
    type ReplacePlayCanvasPublicationManifestsInput,
    type UpdatePlayCanvasProjectRowInput,
    type UpsertPlayCanvasSceneInput
} from './playCanvasProjectsStoreShared'

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

export async function findPlayCanvasProjectByCodename(
    exec: DbExecutor,
    schemaName: string,
    codename: string
): Promise<PlayCanvasProjectRow | null> {
    const codenameSql = codenamePrimaryTextSql('codename')
    const rows = await exec.query<PlayCanvasProjectRow>(
        `SELECT ${projectSelect}
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_projects')}
          WHERE ${codenameSql} = $1 AND _upl_deleted = false AND _mhb_deleted = false
          LIMIT 1`,
        [codename]
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
    const payload = input.payload == null ? null : playCanvasProjectPayloadSchema.parse(input.payload)
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
            AND (
                $13::integer IS NULL
                OR ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')}._upl_version = $13
            )
         RETURNING ${sceneSelect}`,
        [
            input.id,
            projectId,
            input.codename,
            input.displayName,
            input.payloadSchemaVersion,
            JSON.stringify(payload),
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

export async function createPlayCanvasProject(
    exec: DbExecutor,
    schemaName: string,
    input: CreatePlayCanvasProjectRowInput,
    userId: string
): Promise<PlayCanvasProjectRow> {
    const settings = playCanvasProjectSettingsSchema.parse(input.settings ?? {})
    const rows = await exec.query<PlayCanvasProjectRow>(
        `INSERT INTO ${qSchemaTable(schemaName, '_mhb_playcanvas_projects')}
            (${input.id ? 'id, ' : ''}codename, display_name, description, package_version, settings, _upl_created_by, _upl_updated_by)
         VALUES (${input.id ? '$1, ' : ''}${input.id ? '$2, $3, $4, $5, $6, $7, $7' : '$1, $2, $3, $4, $5, $6, $6'})
         RETURNING ${projectSelect}`,
        input.id
            ? [input.id, input.codename, input.displayName, input.description ?? null, input.packageVersion ?? null, settings, userId]
            : [input.codename, input.displayName, input.description ?? null, input.packageVersion ?? null, settings, userId]
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
    if (input.settings !== undefined) addPatch('settings', playCanvasProjectSettingsSchema.parse(input.settings))
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

    const replaceWholeBranch = input.replaceScope === 'branch'
    const scopeFilter = replaceWholeBranch ? '' : `project_id::text = ANY($1::text[]) AND `
    const userIdParam = replaceWholeBranch ? '$1' : '$2'
    const deleteParams = replaceWholeBranch ? [input.userId] : [projectIds, input.userId]

    await exec.transaction(async (tx) => {
        await tx.query(
            `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_publication_manifests')}
            SET _upl_deleted = true,
                _upl_deleted_at = NOW(),
                _upl_deleted_by = ${userIdParam},
                _mhb_deleted = true,
                _mhb_deleted_at = NOW(),
                _mhb_deleted_by = ${userIdParam},
                _upl_updated_at = NOW(),
                _upl_updated_by = ${userIdParam},
                _upl_version = _upl_version + 1,
                published = false
          WHERE ${scopeFilter}_upl_deleted = false
            AND _mhb_deleted = false`,
            deleteParams
        )

        for (const manifest of input.manifests) {
            if (!projectIds.includes(manifest.projectId)) {
                continue
            }
            const sourceProjectChecksum =
                typeof manifest.metadata?.sourceProjectChecksum === 'string' ? manifest.metadata.sourceProjectChecksum : null

            await tx.query(
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
    })
}

export async function listPlayCanvasPublicationManifests(
    exec: DbExecutor,
    schemaName: string
): Promise<PlayCanvasPublishedRuntimeManifestSummary[]> {
    const rows = await exec.query<{
        projectId: string
        sceneId: string | null
        checksum: string
        runtimeManifest: PlayCanvasRuntimeManifest
        publishedAt: string | null
    }>(
        `SELECT project_id AS "projectId",
                selected_scene_id AS "sceneId",
                manifest_checksum AS checksum,
                runtime_manifest AS "runtimeManifest",
                _upl_created_at AS "publishedAt"
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_publication_manifests')}
          WHERE _upl_deleted = false
            AND _mhb_deleted = false
            AND published = true
          ORDER BY _upl_created_at DESC, project_id ASC`,
        []
    )

    return rows.map((row) => ({
        projectId: row.projectId,
        sceneId: row.sceneId,
        checksum: row.checksum,
        runtimeManifest: row.runtimeManifest,
        publishedAt: row.publishedAt
    }))
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
        '_mhb_playcanvas_sourcefiles',
        'project',
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
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_sourcefiles')}
            SET ${deletedColumns}
          WHERE project_id = $1
            AND _upl_deleted = false
            AND _mhb_deleted = false`,
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
