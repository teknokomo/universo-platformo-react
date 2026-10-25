import { qColumn, qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils'

const WORKSPACE_SETTINGS_TABLE = '_app_workspace_settings'

export type WorkspaceSettingCopySourceRow = {
    key: string
    targetKind: string
    targetOwnerId: string
    targetKey: string
    value: unknown
}

export type WorkspaceSettingCopyRecord = {
    targetKind: 'global' | 'widget'
    targetOwnerId: string
    targetKey: string
    key: string
    value: unknown
}

export type WorkspaceSettingCopyLayoutWidget = {
    layoutId: string
    scopeEntityId: string | null
    instanceKey: string
}

/** Read workspace settings captured with the business-row source snapshot. */
export async function listWorkspaceSettingsSnapshotForCopy(
    executor: DbExecutor,
    sourceWorkspaceId: string
): Promise<WorkspaceSettingCopySourceRow[]> {
    return executor.query<WorkspaceSettingCopySourceRow>(
        `
        SELECT
            key,
            target_kind AS "targetKind",
            target_owner_id AS "targetOwnerId",
            target_key AS "targetKey",
            value
        FROM workspace_copy_source_settings
        WHERE workspace_id = $1
        ORDER BY target_kind ASC, target_owner_id ASC, target_key ASC, key ASC
        `,
        [sourceWorkspaceId]
    )
}

/** List active widgets in each active effective layout scope for workspace-copy remapping. */
export async function listActiveEffectiveWorkspaceSettingLayoutWidgetsForCopy(
    executor: DbExecutor,
    input: { schemaName: string }
): Promise<WorkspaceSettingCopyLayoutWidget[]> {
    return executor.query<WorkspaceSettingCopyLayoutWidget>(
        `
        SELECT
            layout_row.id AS "layoutId",
            layout_row.scope_entity_id AS "scopeEntityId",
            widget_row.instance_key AS "instanceKey"
        FROM ${qSchemaTable(input.schemaName, '_app_layouts')} layout_row
        INNER JOIN ${qSchemaTable(input.schemaName, '_app_widgets')} widget_row
            ON widget_row.layout_id = layout_row.id
           AND widget_row.is_active = true
           AND widget_row.${qColumn('_upl_deleted')} = false
           AND widget_row.${qColumn('_app_deleted')} = false
        WHERE layout_row.is_active = true
          AND layout_row.is_default = true
          AND layout_row.is_source_excluded IS DISTINCT FROM true
          AND layout_row.${qColumn('_upl_deleted')} = false
          AND layout_row.${qColumn('_app_deleted')} = false
        ORDER BY layout_row.scope_entity_id NULLS FIRST, layout_row.id ASC, widget_row.instance_key ASC
        FOR SHARE OF layout_row, widget_row
        `,
        []
    )
}

/** Insert validated settings in one statement, allocating each identity as UUID v7 in PostgreSQL. */
export async function insertWorkspaceSettingsForCopy(
    executor: DbExecutor,
    input: {
        schemaName: string
        targetWorkspaceId: string
        actorUserId: string | null | undefined
        settings: readonly WorkspaceSettingCopyRecord[]
    }
): Promise<void> {
    if (input.settings.length === 0) return

    const insertedRows = await executor.query<{ id: string }>(
        `
        INSERT INTO ${qSchemaTable(input.schemaName, WORKSPACE_SETTINGS_TABLE)} (
            id,
            workspace_id,
            target_kind,
            target_owner_id,
            target_key,
            key,
            value,
            ${qColumn('_upl_created_at')},
            ${qColumn('_upl_created_by')},
            ${qColumn('_upl_updated_at')},
            ${qColumn('_upl_updated_by')},
            ${qColumn('_upl_version')},
            ${qColumn('_upl_deleted')},
            ${qColumn('_app_deleted')}
        )
        SELECT
            public.uuid_generate_v7(),
            $2,
            setting.target_kind,
            setting.target_owner_id,
            setting.target_key,
            setting.key,
            setting.value,
            NOW(),
            $3,
            NOW(),
            $3,
            1,
            false,
            false
        FROM jsonb_to_recordset($1::jsonb) AS setting(
            target_kind text,
            target_owner_id uuid,
            target_key text,
            key text,
            value jsonb
        )
        RETURNING id
        `,
        [
            JSON.stringify(
                input.settings.map((setting) => ({
                    target_kind: setting.targetKind,
                    target_owner_id: setting.targetOwnerId,
                    target_key: setting.targetKey,
                    key: setting.key,
                    value: setting.value ?? null
                }))
            ),
            input.targetWorkspaceId,
            input.actorUserId ?? null
        ]
    )

    if (insertedRows.length !== input.settings.length) throw new Error('WORKSPACE_SETTING_COPY_INSERT_FAILED')
}
