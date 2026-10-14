import type { DbExecutor } from '@universo-react/utils'
import { qSchemaTable } from '@universo-react/database'

const WORKSPACES_TABLE = '_app_workspaces'
const ACTIVE_ROW_SQL = '_upl_deleted = false AND _app_deleted = false'

export async function setRuntimeWorkspaceContext(executor: DbExecutor, workspaceId: string | null): Promise<void> {
    await executor.query(`SELECT set_config('app.current_workspace_id', $1::text, true)`, [workspaceId ?? ''])
}

export async function lockActiveRuntimeWorkspaceContext(executor: DbExecutor, schemaName: string, workspaceId: string): Promise<boolean> {
    const rows = await executor.query<{ id: string }>(
        `
        SELECT id
        FROM ${qSchemaTable(schemaName, WORKSPACES_TABLE)}
        WHERE id = $1
          AND COALESCE(status, 'active') = 'active'
          AND ${ACTIVE_ROW_SQL}
        LIMIT 1
        FOR SHARE
        `,
        [workspaceId]
    )

    if (!rows[0]?.id) return false

    await setRuntimeWorkspaceContext(executor, workspaceId)
    return true
}
