import { qColumn, qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils'
import { acquireAdvisoryXactLock } from '@universo-react/utils/database'

const WORKSPACE_SETTINGS_TABLE = '_app_workspace_settings'
const ACTIVE_ROW_SQL = '_upl_deleted = false AND _app_deleted = false'

export type WorkspaceSettingPersistenceAddress = {
    workspaceId: string
    key: string
    targetKind: 'global' | 'widget'
    targetOwnerId: string
    targetKey: string
}

export type ActiveWorkspaceSettingRow = {
    id: string
    version: string | number
}

export type WorkspaceSettingMutationRow = {
    key: string
    value: unknown
    version: string | number
}

const settingLockKey = (schemaName: string, address: WorkspaceSettingPersistenceAddress): string =>
    JSON.stringify([
        schemaName,
        'workspace-settings',
        address.workspaceId,
        address.targetKind,
        address.targetOwnerId,
        address.targetKey,
        address.key
    ])

const interpretationNetworkCellStylePolicyLockKey = (schemaName: string, workspaceId: string): string =>
    JSON.stringify([schemaName, 'workspace-settings-policy', workspaceId, 'interpretationNetwork.cellStylePolicy'])

/** Serialize policy reads used by Matrix writes with concurrent style-policy changes. */
export async function lockInterpretationNetworkCellStylePolicy(
    executor: DbExecutor,
    schemaName: string,
    workspaceId: string
): Promise<void> {
    await acquireAdvisoryXactLock(executor, interpretationNetworkCellStylePolicyLockKey(schemaName, workspaceId))
}

/** Serialize concurrent writes to the same workspace setting identity. */
export async function lockWorkspaceSetting(
    executor: DbExecutor,
    schemaName: string,
    address: WorkspaceSettingPersistenceAddress
): Promise<void> {
    await acquireAdvisoryXactLock(executor, settingLockKey(schemaName, address))
}

/** Lock and read the active override row for one resolved setting address. */
export async function findActiveWorkspaceSetting(
    executor: DbExecutor,
    schemaName: string,
    address: WorkspaceSettingPersistenceAddress
): Promise<ActiveWorkspaceSettingRow | null> {
    const rows = await executor.query<ActiveWorkspaceSettingRow>(
        `
        SELECT id, ${qColumn('_upl_version')} AS version
        FROM ${qSchemaTable(schemaName, WORKSPACE_SETTINGS_TABLE)}
        WHERE workspace_id = $1
          AND target_kind = $2
          AND target_owner_id = $3
          AND target_key = $4
          AND key = $5
          AND ${ACTIVE_ROW_SQL}
        LIMIT 1
        FOR UPDATE
        `,
        [address.workspaceId, address.targetKind, address.targetOwnerId, address.targetKey, address.key]
    )
    return rows[0] ?? null
}

/** Read the latest version, including retired rows, to preserve monotonic versions. */
export async function findLatestWorkspaceSettingVersion(
    executor: DbExecutor,
    schemaName: string,
    address: WorkspaceSettingPersistenceAddress
): Promise<string | number | null> {
    const rows = await executor.query<{ version: string | number }>(
        `
        SELECT COALESCE(MAX(${qColumn('_upl_version')}), 0) AS version
        FROM ${qSchemaTable(schemaName, WORKSPACE_SETTINGS_TABLE)}
        WHERE workspace_id = $1
          AND target_kind = $2
          AND target_owner_id = $3
          AND target_key = $4
          AND key = $5
        `,
        [address.workspaceId, address.targetKind, address.targetOwnerId, address.targetKey, address.key]
    )
    return rows[0]?.version ?? null
}

/** Allocate a time-ordered workspace setting identity through PostgreSQL. */
export async function allocateWorkspaceSettingId(executor: DbExecutor): Promise<string | null> {
    const rows = await executor.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
    return rows[0]?.id ?? null
}

/** Update an existing override with optimistic version matching. */
export async function updateWorkspaceSettingRow(
    executor: DbExecutor,
    input: {
        schemaName: string
        address: WorkspaceSettingPersistenceAddress
        id: string
        value: unknown
        actorUserId: string | null | undefined
        expectedVersion: number
    }
): Promise<WorkspaceSettingMutationRow | null> {
    const rows = await executor.query<WorkspaceSettingMutationRow>(
        `
        UPDATE ${qSchemaTable(input.schemaName, WORKSPACE_SETTINGS_TABLE)}
        SET value = $2::jsonb,
            ${qColumn('_upl_updated_at')} = NOW(),
            ${qColumn('_upl_updated_by')} = $3,
            ${qColumn('_upl_version')} = COALESCE(${qColumn('_upl_version')}, 1) + 1
        WHERE id = $1
          AND workspace_id = $4
          AND target_kind = $5
          AND target_owner_id = $6
          AND target_key = $7
          AND key = $8
          AND ${qColumn('_upl_version')} = $9
          AND ${ACTIVE_ROW_SQL}
        RETURNING key, value, ${qColumn('_upl_version')} AS version
        `,
        [
            input.id,
            JSON.stringify(input.value ?? null),
            input.actorUserId ?? null,
            input.address.workspaceId,
            input.address.targetKind,
            input.address.targetOwnerId,
            input.address.targetKey,
            input.address.key,
            input.expectedVersion
        ]
    )
    return rows[0] ?? null
}

/** Insert a new override row and return null if PostgreSQL produced no row. */
export async function insertWorkspaceSettingRow(
    executor: DbExecutor,
    input: {
        schemaName: string
        address: WorkspaceSettingPersistenceAddress
        id: string
        value: unknown
        version: number
        actorUserId: string | null | undefined
    }
): Promise<WorkspaceSettingMutationRow | null> {
    const rows = await executor.query<WorkspaceSettingMutationRow>(
        `
        INSERT INTO ${qSchemaTable(input.schemaName, WORKSPACE_SETTINGS_TABLE)} (
            id,
            workspace_id,
            target_kind,
            target_owner_id,
            target_key,
            key,
            value,
            ${qColumn('_upl_version')},
            ${qColumn('_upl_created_by')},
            ${qColumn('_upl_updated_by')}
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
        RETURNING key, value, ${qColumn('_upl_version')} AS version
        `,
        [
            input.id,
            input.address.workspaceId,
            input.address.targetKind,
            input.address.targetOwnerId,
            input.address.targetKey,
            input.address.key,
            JSON.stringify(input.value ?? null),
            input.version,
            input.actorUserId ?? null,
            input.actorUserId ?? null
        ]
    )
    return rows[0] ?? null
}

/** Soft-delete an override only when its full identity and expected version still match. */
export async function retireWorkspaceSettingRow(
    executor: DbExecutor,
    input: {
        schemaName: string
        address: WorkspaceSettingPersistenceAddress
        id: string
        actorUserId: string | null | undefined
        expectedVersion: number
    }
): Promise<boolean> {
    const rows = await executor.query<{ id: string }>(
        `
        UPDATE ${qSchemaTable(input.schemaName, WORKSPACE_SETTINGS_TABLE)}
        SET ${qColumn('_upl_deleted')} = true,
            ${qColumn('_upl_deleted_at')} = NOW(),
            ${qColumn('_upl_deleted_by')} = $2,
            ${qColumn('_upl_updated_at')} = NOW(),
            ${qColumn('_upl_updated_by')} = $2,
            ${qColumn('_upl_version')} = COALESCE(${qColumn('_upl_version')}, 1) + 1,
            ${qColumn('_app_deleted')} = true,
            ${qColumn('_app_deleted_at')} = NOW(),
            ${qColumn('_app_deleted_by')} = $2
        WHERE id = $1
          AND workspace_id = $3
          AND target_kind = $4
          AND target_owner_id = $5
          AND target_key = $6
          AND key = $7
          AND ${qColumn('_upl_version')} = $8
          AND ${ACTIVE_ROW_SQL}
        RETURNING id
        `,
        [
            input.id,
            input.actorUserId ?? null,
            input.address.workspaceId,
            input.address.targetKind,
            input.address.targetOwnerId,
            input.address.targetKey,
            input.address.key,
            input.expectedVersion
        ]
    )
    return rows.length > 0
}
