import type { DbExecutor } from '@universo-react/utils'

import { qColumn, qSchemaTable } from '@universo-react/database'

import type { RuntimeWorkspace } from './runtimeWorkspaceContracts'

import { assertWorkspaceExists } from './runtimeWorkspaceShared'

type WorkspaceRow = {
    id: string
    name: unknown
    description: unknown
    workspace_type: string
    personal_user_id: string | null
    status: string
    is_default_workspace: boolean
    role_codename: string
    window_total: string
}

export async function assertRuntimeWorkspaceExists(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
    }
): Promise<void> {
    await assertWorkspaceExists(executor, input)
}

export async function listUserWorkspaces(
    executor: DbExecutor,
    input: {
        schemaName: string
        userId: string
        limit: number
        offset: number
        search?: string
        includeUnassigned?: boolean
    }
): Promise<{ items: RuntimeWorkspace[]; total: number }> {
    const workspacesQt = qSchemaTable(input.schemaName, '_app_workspaces')
    const workspaceUserRolesQt = qSchemaTable(input.schemaName, '_app_workspace_user_roles')
    const workspaceRolesQt = qSchemaTable(input.schemaName, '_app_workspace_roles')
    const searchPattern = input.search ? `%${input.search}%` : null

    const rows = await executor.query<WorkspaceRow>(
        `
        WITH memberships AS (
            SELECT
                w.id,
                w.name,
                w.description,
                w.workspace_type,
                w.personal_user_id,
                w.status,
                COALESCE(wur.is_default_workspace, false) AS is_default_workspace,
                COALESCE(r.codename, 'admin') AS role_codename,
                ROW_NUMBER() OVER (
                    PARTITION BY w.id
                    ORDER BY COALESCE(wur.is_default_workspace, false) DESC, w.${qColumn('_upl_created_at')} ASC, w.id ASC
                ) AS rn
            FROM ${workspacesQt} w
            LEFT JOIN ${workspaceUserRolesQt} wur
              ON wur.workspace_id = w.id
             AND wur.user_id = $1
             AND wur.${qColumn('_upl_deleted')} = false
             AND wur.${qColumn('_app_deleted')} = false
            LEFT JOIN ${workspaceRolesQt} r ON r.id = wur.role_id
            WHERE w.${qColumn('_upl_deleted')} = false
              AND w.${qColumn('_app_deleted')} = false
              AND COALESCE(w.status, 'active') = 'active'
              AND (
                  wur.id IS NOT NULL
                  OR ($5::boolean = true AND w.workspace_type <> 'personal' AND w.personal_user_id IS NULL)
              )
              AND (
                  $4::text IS NULL
                  OR w.name::text ILIKE $4
                  OR w.description::text ILIKE $4
              )
        ),
        filtered AS (
            SELECT *
            FROM memberships
            WHERE rn = 1
        )
        SELECT
            id,
            name,
            description,
            workspace_type,
            personal_user_id,
            status,
            is_default_workspace,
            role_codename,
            COUNT(*) OVER() AS window_total
        FROM filtered
        ORDER BY is_default_workspace DESC, id ASC
        LIMIT $2 OFFSET $3
    `,
        [input.userId, input.limit, input.offset, searchPattern, input.includeUnassigned === true]
    )

    const items = rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        workspaceType: row.workspace_type,
        personalUserId: row.personal_user_id,
        status: row.status,
        isDefault: row.is_default_workspace,
        roleCodename: row.role_codename
    }))
    const total = rows.length > 0 ? Number(rows[0].window_total) : 0

    return { items, total: Number.isFinite(total) ? total : 0 }
}

export async function getUserWorkspace(
    executor: DbExecutor,
    input: {
        schemaName: string
        userId: string
        workspaceId: string
        /**
         * Application administrators may inspect an unassigned shared
         * workspace. A `personal` workspace of another user stays invisible
         * regardless of this flag unless the admin explicitly holds an active
         * membership row in it.
         */
        allowUnassigned?: boolean
    }
): Promise<RuntimeWorkspace | null> {
    const workspacesQt = qSchemaTable(input.schemaName, '_app_workspaces')
    const workspaceUserRolesQt = qSchemaTable(input.schemaName, '_app_workspace_user_roles')
    const workspaceRolesQt = qSchemaTable(input.schemaName, '_app_workspace_roles')

    const rows = await executor.query<WorkspaceRow>(
        `
        SELECT
            w.id,
            w.name,
            w.description,
            w.workspace_type,
            w.personal_user_id,
            w.status,
            COALESCE(wur.is_default_workspace, false) AS is_default_workspace,
            COALESCE(r.codename, 'admin') AS role_codename,
            1::text AS window_total
        FROM ${workspacesQt} w
        LEFT JOIN ${workspaceUserRolesQt} wur
          ON wur.workspace_id = w.id
         AND wur.user_id = $1
         AND wur.${qColumn('_upl_deleted')} = false
         AND wur.${qColumn('_app_deleted')} = false
        LEFT JOIN ${workspaceRolesQt} r ON r.id = wur.role_id
        WHERE w.id = $2
          AND (
              wur.id IS NOT NULL
              OR ($3::boolean = true AND w.workspace_type <> 'personal' AND w.personal_user_id IS NULL)
          )
          AND w.${qColumn('_upl_deleted')} = false
          AND w.${qColumn('_app_deleted')} = false
          AND COALESCE(w.status, 'active') = 'active'
        ORDER BY wur.is_default_workspace DESC, wur.${qColumn('_upl_created_at')} ASC, wur.id ASC
        LIMIT 1
    `,
        [input.userId, input.workspaceId, input.allowUnassigned === true]
    )

    const row = rows[0]
    if (!row) {
        return null
    }

    return {
        id: row.id,
        name: row.name,
        description: row.description,
        workspaceType: row.workspace_type,
        personalUserId: row.personal_user_id,
        status: row.status,
        isDefault: row.is_default_workspace,
        roleCodename: row.role_codename
    }
}
