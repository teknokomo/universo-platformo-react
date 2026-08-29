import type { DbExecutor } from '@universo-react/utils'
import type { PlayCanvasSourceFile } from '@universo-react/types'
import { playCanvasProjectMetadataSchema, playCanvasProjectParsedAttributesSchema } from '@universo-react/types'
import { qSchemaTable } from '@universo-react/database'
import { sourceFileSelect, type UpsertPlayCanvasSourceFileInput } from './playCanvasProjectsStoreShared'

export async function listPlayCanvasSourceFiles(
    exec: DbExecutor,
    schemaName: string,
    projectId: string
): Promise<(PlayCanvasSourceFile & { version: number })[]> {
    return exec.query<PlayCanvasSourceFile & { version: number }>(
        `SELECT ${sourceFileSelect}
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_sourcefiles')}
          WHERE project_id = $1 AND _upl_deleted = false AND _mhb_deleted = false
          ORDER BY virtual_path::text ASC, name ASC, id ASC`,
        [projectId]
    )
}

export async function findPlayCanvasSourceFileByStableId(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    stableSourceFileId: string
): Promise<(PlayCanvasSourceFile & { version: number }) | null> {
    const rows = await exec.query<PlayCanvasSourceFile & { version: number }>(
        `SELECT ${sourceFileSelect}
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_sourcefiles')}
          WHERE project_id = $1
            AND stable_sourcefile_id = $2
            AND _upl_deleted = false
            AND _mhb_deleted = false
          LIMIT 1`,
        [projectId, stableSourceFileId]
    )
    return rows[0] ?? null
}

/**
 * Reads a sourcefile row regardless of its soft-delete marker. This is used
 * only by replay recovery to prove that a previously committed delete is
 * durable before returning the idempotent success response.
 */
export async function findPlayCanvasSourceFileByStableIdIncludingDeleted(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    stableSourceFileId: string
): Promise<(PlayCanvasSourceFile & { version: number; isDeleted: boolean; isMetahubDeleted: boolean }) | null> {
    const rows = await exec.query<PlayCanvasSourceFile & { version: number; isDeleted: boolean; isMetahubDeleted: boolean }>(
        `SELECT ${sourceFileSelect},
                _upl_deleted AS "isDeleted",
                _mhb_deleted AS "isMetahubDeleted"
           FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_sourcefiles')}
          WHERE project_id = $1
            AND stable_sourcefile_id = $2
          ORDER BY _upl_version DESC, id DESC
          LIMIT 1`,
        [projectId, stableSourceFileId]
    )
    return rows[0] ?? null
}

export async function upsertPlayCanvasSourceFile(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    input: UpsertPlayCanvasSourceFileInput,
    userId: string
): Promise<(PlayCanvasSourceFile & { version: number }) | null> {
    const parsedAttributes = playCanvasProjectParsedAttributesSchema.parse(input.parsedAttributes)
    const parseDiagnostics = input.parseDiagnostics == null ? null : playCanvasProjectMetadataSchema.parse(input.parseDiagnostics)
    const rows = await exec.query<PlayCanvasSourceFile & { version: number }>(
        `INSERT INTO ${qSchemaTable(schemaName, '_mhb_playcanvas_sourcefiles')}
            (id, project_id, stable_sourcefile_id, name, virtual_path, file_ref, file_path, file_hash, file_mime,
             file_size, script_kind, parsed_attributes, parse_status, parse_diagnostics, publish, status,
             _upl_created_by, _upl_updated_by)
         SELECT $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12::jsonb, $13, $14::jsonb, $15, $16, $17, $17
          WHERE $18::integer IS NULL
             OR EXISTS (
                    SELECT 1
                      FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_sourcefiles')} current_sourcefile
                     WHERE current_sourcefile.id = $1
                       AND current_sourcefile.project_id = $2
                       AND current_sourcefile._upl_version = $18
                       AND current_sourcefile._upl_deleted = false
                       AND current_sourcefile._mhb_deleted = false
                )
         ON CONFLICT (id)
         DO UPDATE SET
            stable_sourcefile_id = EXCLUDED.stable_sourcefile_id,
            name = EXCLUDED.name,
            virtual_path = EXCLUDED.virtual_path,
            file_ref = EXCLUDED.file_ref,
            file_path = EXCLUDED.file_path,
            file_hash = EXCLUDED.file_hash,
            file_mime = EXCLUDED.file_mime,
            file_size = EXCLUDED.file_size,
            script_kind = EXCLUDED.script_kind,
            parsed_attributes = EXCLUDED.parsed_attributes,
            parse_status = EXCLUDED.parse_status,
            parse_diagnostics = EXCLUDED.parse_diagnostics,
            publish = EXCLUDED.publish,
            status = EXCLUDED.status,
            _upl_updated_at = NOW(),
            _upl_updated_by = EXCLUDED._upl_updated_by,
            _upl_version = ${qSchemaTable(schemaName, '_mhb_playcanvas_sourcefiles')}._upl_version + 1,
            _upl_deleted = false,
            _mhb_deleted = false
          WHERE ${qSchemaTable(schemaName, '_mhb_playcanvas_sourcefiles')}.project_id = $2
            AND (
                $18::integer IS NULL
                OR ${qSchemaTable(schemaName, '_mhb_playcanvas_sourcefiles')}._upl_version = $18
            )
         RETURNING ${sourceFileSelect}`,
        [
            input.id,
            projectId,
            input.stableSourceFileId,
            input.name,
            JSON.stringify(input.virtualPath),
            JSON.stringify(input.file),
            input.file.path,
            input.file.hash ?? input.checksum ?? null,
            input.file.mime ?? null,
            input.file.size ?? null,
            input.scriptKind,
            JSON.stringify(parsedAttributes),
            input.parseStatus,
            JSON.stringify(parseDiagnostics),
            input.publish,
            input.file.status ?? input.parseStatus,
            userId,
            input.expectedVersion ?? null
        ]
    )
    return rows[0] ?? null
}

export async function softDeletePlayCanvasSourceFileByStableId(
    exec: DbExecutor,
    schemaName: string,
    projectId: string,
    stableSourceFileId: string,
    userId: string,
    expectedVersion?: number
): Promise<boolean> {
    const params: unknown[] = [projectId, stableSourceFileId, userId]
    let versionGuard = ''
    if (expectedVersion !== undefined) {
        params.push(expectedVersion)
        versionGuard = ` AND _upl_version = $${params.length}`
    }
    const rows = await exec.query<{ id: string }>(
        `UPDATE ${qSchemaTable(schemaName, '_mhb_playcanvas_sourcefiles')}
            SET _upl_deleted = true,
                _mhb_deleted = true,
                _upl_updated_at = NOW(),
                _upl_updated_by = $3,
                _upl_version = _upl_version + 1
          WHERE project_id = $1
            AND stable_sourcefile_id = $2
            AND _upl_deleted = false
            AND _mhb_deleted = false${versionGuard}
        RETURNING id`,
        params
    )
    return rows.length > 0
}
