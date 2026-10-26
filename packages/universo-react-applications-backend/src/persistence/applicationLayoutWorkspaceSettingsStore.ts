import { qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils'

interface WorkspaceSettingTombstoneRow {
    id: string
    target_owner_id: string
    _upl_deleted: boolean
    _app_deleted: boolean
}

/** Retire workspace overrides whose widget target belongs to a removed layout. */
export async function tombstoneApplicationLayoutWorkspaceSettings(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    userId: string | null,
    applicationDeleted: boolean
): Promise<void> {
    const workspaceSettingsTable = qSchemaTable(schemaName, '_app_workspace_settings')
    const tableRows = await executor.query<{ exists: boolean }>(
        `
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = $1
              AND table_name = $2
        ) AS exists
        `,
        [schemaName, '_app_workspace_settings']
    )
    const workspaceSettingsTableExists = tableRows[0]?.exists
    if (typeof workspaceSettingsTableExists !== 'boolean') {
        throw new Error('APPLICATION_LAYOUT_WORKSPACE_SETTINGS_SCHEMA_LOOKUP_FAILED')
    }
    if (!workspaceSettingsTableExists) return

    const rows = await executor.query<WorkspaceSettingTombstoneRow>(
        `
        UPDATE ${workspaceSettingsTable}
        SET _upl_deleted = true,
            _upl_deleted_at = NOW(),
            _upl_deleted_by = $2,
            _upl_updated_at = NOW(),
            _upl_updated_by = $2,
            _upl_version = COALESCE(_upl_version, 1) + 1,
            _app_deleted = $3,
            _app_deleted_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
            _app_deleted_by = CASE WHEN $3 THEN $2::uuid ELSE NULL::uuid END
        WHERE target_kind = 'widget'
          AND target_owner_id = $1
          AND _upl_deleted = false
          AND _app_deleted = false
        RETURNING id, target_owner_id, _upl_deleted, _app_deleted
        `,
        [layoutId, userId, applicationDeleted]
    )

    for (const row of rows) {
        if (row.target_owner_id !== layoutId || row._upl_deleted !== true || row._app_deleted !== applicationDeleted) {
            throw new Error('APPLICATION_LAYOUT_WORKSPACE_SETTING_TOMBSTONE_INVARIANT_VIOLATION')
        }
    }
}
