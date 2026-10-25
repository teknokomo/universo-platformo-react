import type { DbExecutor } from '@universo-react/utils'
import { qSchemaTable } from '@universo-react/database'
import { RUNTIME_WORKSPACE_ERROR_CODES, RuntimeWorkspaceError } from './runtimeWorkspaceContracts'

export const ACTIVE_ROW_SQL = '_upl_deleted = false AND _app_deleted = false'
export const toJsonbParam = (value: unknown): string => JSON.stringify(value ?? null)
export async function assertWorkspaceExists(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
    }
): Promise<void> {
    const workspacesQt = qSchemaTable(input.schemaName, '_app_workspaces')

    const rows = await executor.query<{ id: string }>(
        `
        SELECT id
        FROM ${workspacesQt}
        WHERE id = $1
          AND ${ACTIVE_ROW_SQL}
        LIMIT 1
    `,
        [input.workspaceId]
    )

    const workspace = rows[0]
    if (!workspace) {
        throw new RuntimeWorkspaceError(RUNTIME_WORKSPACE_ERROR_CODES.workspaceNotFound, 'Workspace not found')
    }
}
