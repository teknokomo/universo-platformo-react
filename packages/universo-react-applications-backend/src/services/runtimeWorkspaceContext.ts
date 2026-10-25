import type { DbExecutor } from '@universo-react/utils'
import { qColumn, qSchemaTable } from '@universo-react/database'
import { acquireAdvisoryXactLock, acquireAdvisoryXactSharedLock } from '@universo-react/utils/database'

const WORKSPACES_TABLE = '_app_workspaces'
const ACTIVE_ROW_SQL = '_upl_deleted = false AND _app_deleted = false'

export async function acquireWorkspaceBaselineLock(executor: DbExecutor, schemaName: string, applicationId: string): Promise<void> {
    await acquireAdvisoryXactLock(executor, `workspace-baseline:${schemaName}:${applicationId}`)
}

export async function acquireWorkspaceBaselineSharedLock(executor: DbExecutor, schemaName: string, applicationId: string): Promise<void> {
    await acquireAdvisoryXactSharedLock(executor, `workspace-baseline:${schemaName}:${applicationId}`)
}

/**
 * Acquire the canonical schema → workspace-baseline order used by schema sync
 * and workspace copy. Copy routes call this during runtime resolution so
 * owner checks stay protected while the copy service waits for metadata locks.
 */
export async function acquireWorkspaceCopyLocks(executor: DbExecutor, schemaName: string, applicationId: string): Promise<void> {
    await acquireAdvisoryXactLock(executor, schemaName)
    await acquireWorkspaceBaselineSharedLock(executor, schemaName, applicationId)
}

/** Hold the caller's application membership stable until its runtime mutation commits. */
export async function lockApplicationMembershipForRuntimeMutation(
    executor: DbExecutor,
    applicationId: string,
    userId: string
): Promise<boolean> {
    const rows = await executor.query<{ id: string }>(
        `
        SELECT ${qColumn('id')}
        FROM ${qSchemaTable('applications', 'rel_application_users')}
        WHERE ${qColumn('application_id')} = $1
          AND ${qColumn('user_id')} = $2
          AND ${qColumn('_upl_deleted')} = false
          AND ${qColumn('_app_deleted')} = false
        LIMIT 1
        FOR SHARE
        `,
        [applicationId, userId]
    )

    return rows.length > 0
}

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

/**
 * Validate and bind an active workspace without retaining a row lock.
 * Lifecycle services use this before taking their own `FOR UPDATE` lock, which
 * avoids upgrading a request-held `FOR SHARE` lock under concurrent mutations.
 */
export async function validateActiveRuntimeWorkspaceContext(
    executor: DbExecutor,
    schemaName: string,
    workspaceId: string
): Promise<boolean> {
    const rows = await executor.query<{ id: string }>(
        `
        SELECT id
        FROM ${qSchemaTable(schemaName, WORKSPACES_TABLE)}
        WHERE id = $1
          AND COALESCE(status, 'active') = 'active'
          AND ${ACTIVE_ROW_SQL}
        LIMIT 1
        `,
        [workspaceId]
    )

    if (!rows[0]?.id) return false

    await setRuntimeWorkspaceContext(executor, workspaceId)
    return true
}
