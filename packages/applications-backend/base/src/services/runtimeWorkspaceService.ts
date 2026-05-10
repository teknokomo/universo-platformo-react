import type { DbExecutor } from '@universo/utils'
import { qColumn, qSchemaTable } from '@universo/database'
import { archiveWorkspaceScopedBusinessRows } from './applicationWorkspaces'

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

type WorkspaceMemberRow = {
    id: string
    user_id: string
    role_id: string
    role_codename: string
    is_default_workspace: boolean
    email: string | null
    nickname: string | null
    can_remove: boolean
    window_total: string
}

type WorkspaceMembershipRow = {
    id: string
    role_id: string
    role_codename: string
    is_default_workspace: boolean
    workspace_type?: string
    personal_user_id?: string | null
}

const ACTIVE_ROW_SQL = '_upl_deleted = false AND _app_deleted = false'
const SYSTEM_COPY_COLUMN_EXPRESSIONS: Record<string, string> = {
    _upl_created_at: 'NOW()',
    _upl_updated_at: 'NOW()',
    _upl_version: '1',
    _upl_created_by: '$3::uuid',
    _upl_updated_by: '$3::uuid',
    _upl_deleted: 'false',
    _upl_deleted_at: 'NULL',
    _upl_deleted_by: 'NULL',
    _app_deleted: 'false',
    _app_deleted_at: 'NULL',
    _app_deleted_by: 'NULL',
    _upl_locked: 'false'
}
const SYSTEM_COPY_COLUMNS = new Set(Object.keys(SYSTEM_COPY_COLUMN_EXPRESSIONS))

const toJsonbParam = (value: unknown): string => JSON.stringify(value ?? null)

export const RUNTIME_WORKSPACE_ERROR_CODES = {
    workspaceNotFound: 'WORKSPACE_NOT_FOUND',
    userNotMember: 'USER_NOT_MEMBER',
    roleNotFound: 'WORKSPACE_ROLE_NOT_FOUND',
    memberNotFound: 'WORKSPACE_MEMBER_NOT_FOUND',
    personalWorkspaceMutationBlocked: 'PERSONAL_WORKSPACE_MUTATION_BLOCKED',
    lastOwnerRemovalBlocked: 'LAST_WORKSPACE_OWNER_REMOVAL_BLOCKED'
} as const

export type RuntimeWorkspaceErrorCode = (typeof RUNTIME_WORKSPACE_ERROR_CODES)[keyof typeof RUNTIME_WORKSPACE_ERROR_CODES]

export class RuntimeWorkspaceError extends Error {
    code: RuntimeWorkspaceErrorCode

    constructor(code: RuntimeWorkspaceErrorCode, message: string) {
        super(message)
        this.name = 'RuntimeWorkspaceError'
        this.code = code
    }
}

export type RuntimeWorkspace = {
    id: string
    name: unknown
    description: unknown
    workspaceType: string
    personalUserId: string | null
    status: string
    isDefault: boolean
    roleCodename: string
}

export type RuntimeWorkspaceMember = {
    userId: string
    roleCodename: string
    email: string | null
    nickname: string | null
    canRemove: boolean
}

export type RuntimeWorkspaceMembership = {
    id: string
    userId: string
    workspaceId: string
    roleCodename: string
    isDefault: boolean
    workspaceType: string | null
    personalUserId: string | null
}

async function assertWorkspaceExists(
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

export async function listUserWorkspaces(
    executor: DbExecutor,
    input: {
        schemaName: string
        userId: string
        limit: number
        offset: number
        search?: string
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
                wur.is_default_workspace,
                r.codename AS role_codename,
                ROW_NUMBER() OVER (
                    PARTITION BY w.id
                    ORDER BY wur.is_default_workspace DESC, wur.${qColumn('_upl_created_at')} ASC, wur.id ASC
                ) AS rn
            FROM ${workspaceUserRolesQt} wur
            INNER JOIN ${workspacesQt} w ON w.id = wur.workspace_id
            INNER JOIN ${workspaceRolesQt} r ON r.id = wur.role_id
            WHERE wur.user_id = $1
              AND wur.${qColumn('_upl_deleted')} = false
              AND wur.${qColumn('_app_deleted')} = false
              AND w.${qColumn('_upl_deleted')} = false
              AND w.${qColumn('_app_deleted')} = false
              AND COALESCE(w.status, 'active') = 'active'
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
        [input.userId, input.limit, input.offset, searchPattern]
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
            wur.is_default_workspace,
            r.codename AS role_codename,
            1::text AS window_total
        FROM ${workspaceUserRolesQt} wur
        INNER JOIN ${workspacesQt} w ON w.id = wur.workspace_id
        INNER JOIN ${workspaceRolesQt} r ON r.id = wur.role_id
        WHERE wur.user_id = $1
          AND w.id = $2
          AND wur.${qColumn('_upl_deleted')} = false
          AND wur.${qColumn('_app_deleted')} = false
          AND w.${qColumn('_upl_deleted')} = false
          AND w.${qColumn('_app_deleted')} = false
          AND COALESCE(w.status, 'active') = 'active'
        ORDER BY wur.is_default_workspace DESC, wur.${qColumn('_upl_created_at')} ASC, wur.id ASC
        LIMIT 1
    `,
        [input.userId, input.workspaceId]
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

export async function createSharedWorkspace(
    executor: DbExecutor,
    input: {
        schemaName: string
        name: unknown
        description: unknown
        userId: string
        actorUserId?: string | null
    }
): Promise<{ id: string }> {
    return executor.transaction(async (tx) => {
        const workspacesQt = qSchemaTable(input.schemaName, '_app_workspaces')
        const workspaceUserRolesQt = qSchemaTable(input.schemaName, '_app_workspace_user_roles')
        const workspaceRolesQt = qSchemaTable(input.schemaName, '_app_workspace_roles')

        const [{ id: workspaceId }] = await tx.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')

        await tx.query(
            `
                INSERT INTO ${workspacesQt} (
                    id, name, description, workspace_type, status,
                    ${qColumn('_upl_created_by')}, ${qColumn('_upl_updated_by')}
                )
                VALUES ($1, $2::jsonb, $3::jsonb, 'shared', 'active', $4, $5)
            `,
            [workspaceId, toJsonbParam(input.name), toJsonbParam(input.description), input.actorUserId ?? null, input.actorUserId ?? null]
        )

        const ownerRoleRows = await tx.query<{ id: string }>(`
            SELECT id FROM ${workspaceRolesQt}
            WHERE codename = 'owner' AND ${ACTIVE_ROW_SQL}
            LIMIT 1
        `)
        const ownerRoleId = ownerRoleRows[0]?.id
        if (!ownerRoleId) {
            throw new Error('Owner role not found in workspace schema')
        }

        await tx.query(
            `
            UPDATE ${workspaceUserRolesQt}
            SET is_default_workspace = false,
                ${qColumn('_upl_updated_at')} = NOW(),
                ${qColumn('_upl_updated_by')} = $2
            WHERE user_id = $1
              AND is_default_workspace = true
              AND ${ACTIVE_ROW_SQL}
        `,
            [input.userId, input.actorUserId ?? null]
        )

        const [{ id: relationId }] = await tx.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
        await tx.query(
            `
            INSERT INTO ${workspaceUserRolesQt} (
                id, workspace_id, user_id, role_id, is_default_workspace,
                ${qColumn('_upl_created_by')}, ${qColumn('_upl_updated_by')}
            )
            VALUES ($1, $2, $3, $4, true, $5, $6)
        `,
            [relationId, workspaceId, input.userId, ownerRoleId, input.actorUserId ?? null, input.actorUserId ?? null]
        )

        return { id: workspaceId }
    })
}

export async function updateWorkspace(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        name?: unknown
        description?: unknown
        actorUserId?: string | null
    }
): Promise<void> {
    await executor.transaction(async (tx) => {
        const workspacesQt = qSchemaTable(input.schemaName, '_app_workspaces')
        const workspaceRows = await tx.query<{ id: string }>(
            `
            SELECT id
            FROM ${workspacesQt}
            WHERE id = $1
              AND ${ACTIVE_ROW_SQL}
            LIMIT 1
            FOR UPDATE
        `,
            [input.workspaceId]
        )

        const workspace = workspaceRows[0]
        if (!workspace) {
            throw new RuntimeWorkspaceError(RUNTIME_WORKSPACE_ERROR_CODES.workspaceNotFound, 'Workspace not found')
        }

        const assignments: string[] = []
        const params: unknown[] = [input.workspaceId]
        let nextParam = 2
        if (input.name !== undefined) {
            assignments.push(`name = $${nextParam}::jsonb`)
            params.push(toJsonbParam(input.name))
            nextParam += 1
        }
        if (input.description !== undefined) {
            assignments.push(`description = $${nextParam}::jsonb`)
            params.push(toJsonbParam(input.description))
            nextParam += 1
        }

        if (assignments.length === 0) {
            return
        }

        const actorParam = nextParam
        params.push(input.actorUserId ?? null)
        const updatedRows = await tx.query<{ id: string }>(
            `
            UPDATE ${workspacesQt}
            SET ${assignments.join(', ')},
                ${qColumn('_upl_updated_at')} = NOW(),
                ${qColumn('_upl_updated_by')} = $${actorParam},
                ${qColumn('_upl_version')} = COALESCE(${qColumn('_upl_version')}, 1) + 1
            WHERE id = $1
              AND ${ACTIVE_ROW_SQL}
            RETURNING id
        `,
            params
        )

        if (updatedRows.length === 0) {
            throw new RuntimeWorkspaceError(RUNTIME_WORKSPACE_ERROR_CODES.workspaceNotFound, 'Workspace not found')
        }
    })
}

export async function deleteSharedWorkspace(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        actorUserId?: string | null
    }
): Promise<void> {
    await executor.transaction(async (tx) => {
        const workspacesQt = qSchemaTable(input.schemaName, '_app_workspaces')
        const workspaceUserRolesQt = qSchemaTable(input.schemaName, '_app_workspace_user_roles')

        const workspaceRows = await tx.query<{ id: string; workspace_type: string }>(
            `
            SELECT id, workspace_type
            FROM ${workspacesQt}
            WHERE id = $1
              AND ${ACTIVE_ROW_SQL}
            LIMIT 1
            FOR UPDATE
        `,
            [input.workspaceId]
        )

        const workspace = workspaceRows[0]
        if (!workspace) {
            throw new RuntimeWorkspaceError(RUNTIME_WORKSPACE_ERROR_CODES.workspaceNotFound, 'Workspace not found')
        }
        if (workspace.workspace_type !== 'shared') {
            throw new RuntimeWorkspaceError(
                RUNTIME_WORKSPACE_ERROR_CODES.personalWorkspaceMutationBlocked,
                'Personal workspace cannot be deleted'
            )
        }

        await archiveWorkspaceScopedBusinessRows(tx, {
            schemaName: input.schemaName,
            workspaceIds: [input.workspaceId],
            actorUserId: input.actorUserId
        })

        await tx.query(
            `
            UPDATE ${workspaceUserRolesQt}
            SET ${qColumn('_upl_deleted')} = true,
                ${qColumn('_upl_deleted_at')} = NOW(),
                ${qColumn('_upl_deleted_by')} = $2,
                ${qColumn('_upl_updated_at')} = NOW(),
                ${qColumn('_upl_updated_by')} = $2,
                ${qColumn('_upl_version')} = COALESCE(${qColumn('_upl_version')}, 1) + 1,
                ${qColumn('_app_deleted')} = true,
                ${qColumn('_app_deleted_at')} = NOW(),
                ${qColumn('_app_deleted_by')} = $2
            WHERE workspace_id = $1
              AND ${ACTIVE_ROW_SQL}
        `,
            [input.workspaceId, input.actorUserId ?? null]
        )

        const deletedRows = await tx.query<{ id: string }>(
            `
            UPDATE ${workspacesQt}
            SET status = 'archived',
                ${qColumn('_upl_deleted')} = true,
                ${qColumn('_upl_deleted_at')} = NOW(),
                ${qColumn('_upl_deleted_by')} = $2,
                ${qColumn('_upl_updated_at')} = NOW(),
                ${qColumn('_upl_updated_by')} = $2,
                ${qColumn('_upl_version')} = COALESCE(${qColumn('_upl_version')}, 1) + 1,
                ${qColumn('_app_deleted')} = true,
                ${qColumn('_app_deleted_at')} = NOW(),
                ${qColumn('_app_deleted_by')} = $2
            WHERE id = $1
              AND ${ACTIVE_ROW_SQL}
            RETURNING id
        `,
            [input.workspaceId, input.actorUserId ?? null]
        )

        if (deletedRows.length === 0) {
            throw new RuntimeWorkspaceError(RUNTIME_WORKSPACE_ERROR_CODES.workspaceNotFound, 'Workspace not found')
        }
    })
}

export async function copyWorkspace(
    executor: DbExecutor,
    input: {
        schemaName: string
        sourceWorkspaceId: string
        name: unknown
        description: unknown
        userId: string
        actorUserId?: string | null
    }
): Promise<{ id: string }> {
    return executor.transaction(async (tx) => {
        await assertWorkspaceExists(tx, {
            schemaName: input.schemaName,
            workspaceId: input.sourceWorkspaceId
        })

        const created = await createSharedWorkspace(tx, {
            schemaName: input.schemaName,
            name: input.name,
            description: input.description,
            userId: input.userId,
            actorUserId: input.actorUserId
        })

        const objectsTable = qSchemaTable(input.schemaName, '_app_objects')
        const scopedTables = await tx.query<{ table_name: string }>(
            `
            SELECT DISTINCT c.table_name
            FROM information_schema.columns c
            INNER JOIN ${objectsTable} o ON o.table_name = c.table_name
            WHERE c.table_schema = $1
              AND c.column_name = 'workspace_id'
              AND o.table_name IS NOT NULL
              AND o._upl_deleted = false
              AND o._app_deleted = false
            ORDER BY c.table_name ASC
        `,
            [input.schemaName]
        )

        await tx.query('CREATE TEMP TABLE workspace_copy_id_map (old_id UUID PRIMARY KEY, new_id UUID NOT NULL) ON COMMIT DROP')
        for (const table of scopedTables) {
            const tableIdent = qSchemaTable(input.schemaName, table.table_name)
            await tx.query(
                `
                INSERT INTO workspace_copy_id_map (old_id, new_id)
                SELECT id, public.uuid_generate_v7()
                FROM ${tableIdent}
                WHERE ${qColumn('workspace_id')} = $1
                  AND ${ACTIVE_ROW_SQL}
                ON CONFLICT (old_id) DO NOTHING
            `,
                [input.sourceWorkspaceId]
            )
        }

        for (const table of scopedTables) {
            const tableIdent = qSchemaTable(input.schemaName, table.table_name)
            const columns = await tx.query<{ column_name: string }>(
                `
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = $1
                  AND table_name = $2
                  AND column_name NOT IN ('id', 'workspace_id')
                ORDER BY ordinal_position ASC
            `,
                [input.schemaName, table.table_name]
            )
            const userColumnNames = columns.map((column) => column.column_name).filter((column) => !SYSTEM_COPY_COLUMNS.has(column))
            const systemColumnNames = columns.map((column) => column.column_name).filter((column) => SYSTEM_COPY_COLUMNS.has(column))
            const insertColumnNames = [...userColumnNames, ...systemColumnNames]
            const quotedColumns = insertColumnNames.map((column) => qColumn(column))
            const selectExpressions = [
                ...userColumnNames.map((column) => `source.${qColumn(column)}`),
                ...systemColumnNames.map((column) => SYSTEM_COPY_COLUMN_EXPRESSIONS[column])
            ]
            await tx.query(
                `
                INSERT INTO ${tableIdent} (id, ${qColumn('workspace_id')}${quotedColumns.length > 0 ? `, ${quotedColumns.join(', ')}` : ''})
                SELECT id_map.new_id, $2::uuid${selectExpressions.length > 0 ? `, ${selectExpressions.join(', ')}` : ''}
                FROM ${tableIdent} source
                INNER JOIN workspace_copy_id_map id_map ON id_map.old_id = source.id
                WHERE source.${qColumn('workspace_id')} = $1
                  AND source.${qColumn('_upl_deleted')} = false
                  AND source.${qColumn('_app_deleted')} = false
            `,
                [input.sourceWorkspaceId, created.id, input.actorUserId ?? null]
            )
        }

        for (const table of scopedTables) {
            const tableIdent = qSchemaTable(input.schemaName, table.table_name)
            const uuidColumns = await tx.query<{ column_name: string }>(
                `
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = $1
                  AND table_name = $2
                  AND udt_name = 'uuid'
                  AND column_name NOT IN (
                      'id',
                      'workspace_id',
                      '_upl_created_by',
                      '_upl_updated_by',
                      '_upl_deleted_by',
                      '_app_deleted_by'
                  )
                ORDER BY ordinal_position ASC
            `,
                [input.schemaName, table.table_name]
            )

            for (const column of uuidColumns) {
                const columnName = qColumn(column.column_name)
                await tx.query(
                    `
                    UPDATE ${tableIdent} target
                    SET ${columnName} = id_map.new_id
                    FROM workspace_copy_id_map id_map
                    WHERE target.${qColumn('workspace_id')} = $1
                      AND target.${columnName} = id_map.old_id
                      AND target.${qColumn('_upl_deleted')} = false
                      AND target.${qColumn('_app_deleted')} = false
                `,
                    [created.id]
                )
            }
        }

        return created
    })
}

export async function setDefaultWorkspace(
    executor: DbExecutor,
    input: {
        schemaName: string
        userId: string
        workspaceId: string
        actorUserId?: string | null
    }
): Promise<void> {
    await executor.transaction(async (tx) => {
        const workspaceUserRolesQt = qSchemaTable(input.schemaName, '_app_workspace_user_roles')

        const existing = await tx.query<{ workspace_id: string }>(
            `
            SELECT workspace_id FROM ${workspaceUserRolesQt}
            WHERE user_id = $1
              AND workspace_id = $2
              AND ${ACTIVE_ROW_SQL}
            LIMIT 1
            FOR UPDATE
        `,
            [input.userId, input.workspaceId]
        )

        if (existing.length === 0) {
            throw new RuntimeWorkspaceError(RUNTIME_WORKSPACE_ERROR_CODES.userNotMember, 'User is not a member of this workspace')
        }

        await tx.query(
            `
            UPDATE ${workspaceUserRolesQt}
            SET is_default_workspace = false,
                ${qColumn('_upl_updated_at')} = NOW(),
                ${qColumn('_upl_updated_by')} = $2
            WHERE user_id = $1
              AND is_default_workspace = true
              AND ${ACTIVE_ROW_SQL}
        `,
            [input.userId, input.actorUserId ?? null]
        )

        const updatedRows = await tx.query<{ id: string }>(
            `
            UPDATE ${workspaceUserRolesQt}
            SET is_default_workspace = true,
                ${qColumn('_upl_updated_at')} = NOW(),
                ${qColumn('_upl_updated_by')} = $3
            WHERE workspace_id = $1
              AND user_id = $2
              AND ${ACTIVE_ROW_SQL}
            RETURNING id
        `,
            [input.workspaceId, input.userId, input.actorUserId ?? null]
        )

        if (updatedRows.length === 0) {
            throw new RuntimeWorkspaceError(RUNTIME_WORKSPACE_ERROR_CODES.userNotMember, 'User is not a member of this workspace')
        }
    })
}

export async function addWorkspaceMember(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        userId: string
        roleCodename: string
        actorUserId?: string | null
    }
): Promise<void> {
    await executor.transaction(async (tx) => {
        await assertWorkspaceExists(tx, {
            schemaName: input.schemaName,
            workspaceId: input.workspaceId
        })

        const workspaceUserRolesQt = qSchemaTable(input.schemaName, '_app_workspace_user_roles')
        const workspaceRolesQt = qSchemaTable(input.schemaName, '_app_workspace_roles')

        const roleRows = await tx.query<{ id: string }>(
            `
            SELECT id FROM ${workspaceRolesQt}
            WHERE codename = $1 AND ${ACTIVE_ROW_SQL}
            LIMIT 1
        `,
            [input.roleCodename]
        )

        const roleId = roleRows[0]?.id
        if (!roleId) {
            throw new RuntimeWorkspaceError(RUNTIME_WORKSPACE_ERROR_CODES.roleNotFound, `Role "${input.roleCodename}" not found`)
        }

        const existing = await tx.query<WorkspaceMembershipRow>(
            `
            SELECT
                wur.id,
                wur.role_id,
                wur.is_default_workspace,
                r.codename AS role_codename
            FROM ${workspaceUserRolesQt} wur
            INNER JOIN ${workspaceRolesQt} r ON r.id = wur.role_id
            WHERE workspace_id = $1
              AND user_id = $2
              AND wur.${qColumn('_upl_deleted')} = false
              AND wur.${qColumn('_app_deleted')} = false
            ORDER BY wur.is_default_workspace DESC, wur.${'"_upl_created_at"'} ASC, wur.id ASC
        `,
            [input.workspaceId, input.userId]
        )

        if (existing.length > 0) {
            const canonicalMembershipId = existing[0].id
            const duplicateMembershipIds = existing.slice(1).map((row) => row.id)

            if (duplicateMembershipIds.length > 0) {
                await tx.query(
                    `
                    UPDATE ${workspaceUserRolesQt}
                    SET ${qColumn('_upl_deleted')} = true,
                        ${qColumn('_upl_deleted_at')} = NOW(),
                        ${qColumn('_upl_deleted_by')} = $2,
                        ${qColumn('_upl_updated_at')} = NOW(),
                        ${qColumn('_upl_updated_by')} = $2,
                        ${qColumn('_upl_version')} = COALESCE(${qColumn('_upl_version')}, 1) + 1,
                        ${qColumn('_app_deleted')} = true,
                        ${qColumn('_app_deleted_at')} = NOW(),
                        ${qColumn('_app_deleted_by')} = $2
                    WHERE id = ANY($1::uuid[])
                `,
                    [duplicateMembershipIds, input.actorUserId ?? null]
                )
            }

            if (existing[0].role_id === roleId) {
                return
            }

            await tx.query(
                `
                UPDATE ${workspaceUserRolesQt}
                SET role_id = $1,
                    ${qColumn('_upl_updated_at')} = NOW(),
                    ${qColumn('_upl_updated_by')} = $3
                WHERE id = $2
                  AND ${ACTIVE_ROW_SQL}
            `,
                [roleId, canonicalMembershipId, input.actorUserId ?? null]
            )
            return
        }

        const [{ id: relationId }] = await tx.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
        await tx.query(
            `
            INSERT INTO ${workspaceUserRolesQt} (
                id, workspace_id, user_id, role_id, is_default_workspace,
                ${qColumn('_upl_created_by')}, ${qColumn('_upl_updated_by')}
            )
            VALUES ($1, $2, $3, $4, false, $5, $6)
        `,
            [relationId, input.workspaceId, input.userId, roleId, input.actorUserId ?? null, input.actorUserId ?? null]
        )
    })
}

export async function removeWorkspaceMember(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        userId: string
        actorUserId?: string | null
    }
): Promise<void> {
    await executor.transaction(async (tx) => {
        await assertWorkspaceExists(tx, {
            schemaName: input.schemaName,
            workspaceId: input.workspaceId
        })

        const workspaceUserRolesQt = qSchemaTable(input.schemaName, '_app_workspace_user_roles')
        const workspaceRolesQt = qSchemaTable(input.schemaName, '_app_workspace_roles')

        const membershipRows = await tx.query<WorkspaceMembershipRow>(
            `
            SELECT
                wur.id,
                wur.role_id,
                wur.is_default_workspace,
                r.codename AS role_codename
            FROM ${workspaceUserRolesQt} wur
            INNER JOIN ${workspaceRolesQt} r ON r.id = wur.role_id
            WHERE wur.workspace_id = $1
              AND wur.user_id = $2
              AND wur.${qColumn('_upl_deleted')} = false
              AND wur.${qColumn('_app_deleted')} = false
            ORDER BY wur.is_default_workspace DESC, wur.${qColumn('_upl_created_at')} ASC, wur.id ASC
            FOR UPDATE OF wur
        `,
            [input.workspaceId, input.userId]
        )

        if (membershipRows.length === 0) {
            throw new RuntimeWorkspaceError(RUNTIME_WORKSPACE_ERROR_CODES.memberNotFound, 'Workspace member not found')
        }

        if (membershipRows.some((row) => row.role_codename === 'owner')) {
            const remainingOwnerRows = await tx.query<{ id: string }>(
                `
                SELECT wur.id
                FROM ${workspaceUserRolesQt} wur
                INNER JOIN ${workspaceRolesQt} r ON r.id = wur.role_id
                WHERE wur.workspace_id = $1
                  AND wur.user_id <> $2
                  AND r.codename = 'owner'
                  AND wur.${qColumn('_upl_deleted')} = false
                  AND wur.${qColumn('_app_deleted')} = false
                FOR UPDATE OF wur
            `,
                [input.workspaceId, input.userId]
            )

            if (remainingOwnerRows.length < 1) {
                throw new RuntimeWorkspaceError(
                    RUNTIME_WORKSPACE_ERROR_CODES.lastOwnerRemovalBlocked,
                    'Cannot remove the last workspace owner'
                )
            }
        }

        const deletedRows = await tx.query<{ id: string }>(
            `
            UPDATE ${workspaceUserRolesQt}
            SET ${qColumn('_upl_deleted')} = true,
                ${qColumn('_upl_deleted_at')} = NOW(),
                ${qColumn('_upl_deleted_by')} = $3,
                ${qColumn('_upl_updated_at')} = NOW(),
                ${qColumn('_upl_updated_by')} = $3,
                ${qColumn('_upl_version')} = COALESCE(${qColumn('_upl_version')}, 1) + 1,
                ${qColumn('_app_deleted')} = true,
                ${qColumn('_app_deleted_at')} = NOW(),
                ${qColumn('_app_deleted_by')} = $3
            WHERE workspace_id = $1
              AND user_id = $2
              AND ${ACTIVE_ROW_SQL}
            RETURNING id
        `,
            [input.workspaceId, input.userId, input.actorUserId ?? null]
        )

        if (deletedRows.length === 0) {
            throw new RuntimeWorkspaceError(RUNTIME_WORKSPACE_ERROR_CODES.memberNotFound, 'Workspace member not found')
        }
    })
}

export async function getWorkspaceMembership(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        userId: string
    }
): Promise<RuntimeWorkspaceMembership | null> {
    const workspaceUserRolesQt = qSchemaTable(input.schemaName, '_app_workspace_user_roles')
    const workspaceRolesQt = qSchemaTable(input.schemaName, '_app_workspace_roles')
    const workspacesQt = qSchemaTable(input.schemaName, '_app_workspaces')

    const rows = await executor.query<WorkspaceMembershipRow>(
        `
        SELECT
            wur.id,
            wur.role_id,
            wur.is_default_workspace,
            r.codename AS role_codename,
            w.workspace_type,
            w.personal_user_id
        FROM ${workspaceUserRolesQt} wur
        INNER JOIN ${workspaceRolesQt} r ON r.id = wur.role_id
        INNER JOIN ${workspacesQt} w ON w.id = wur.workspace_id
        WHERE wur.workspace_id = $1
          AND wur.user_id = $2
          AND wur.${'"_upl_deleted"'} = false
          AND wur.${'"_app_deleted"'} = false
          AND w.${'"_upl_deleted"'} = false
          AND w.${'"_app_deleted"'} = false
        ORDER BY wur.is_default_workspace DESC, wur.${'"_upl_created_at"'} ASC, wur.id ASC
        LIMIT 1
    `,
        [input.workspaceId, input.userId]
    )

    const row = rows[0]
    if (!row) {
        return null
    }

    return {
        id: row.id,
        userId: input.userId,
        workspaceId: input.workspaceId,
        roleCodename: row.role_codename,
        isDefault: row.is_default_workspace,
        workspaceType: typeof row.workspace_type === 'string' ? row.workspace_type : null,
        personalUserId: typeof row.personal_user_id === 'string' ? row.personal_user_id : null
    }
}

export async function listWorkspaceMembers(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        limit: number
        offset: number
        search?: string
    }
): Promise<{ items: RuntimeWorkspaceMember[]; total: number }> {
    const workspaceUserRolesQt = qSchemaTable(input.schemaName, '_app_workspace_user_roles')
    const workspaceRolesQt = qSchemaTable(input.schemaName, '_app_workspace_roles')
    const searchPattern = input.search ? `%${input.search}%` : null

    const rows = await executor.query<WorkspaceMemberRow>(
        `
        WITH memberships AS (
            SELECT
                wur.id,
                wur.user_id,
                wur.role_id,
                r.codename AS role_codename,
                wur.is_default_workspace,
                u.email,
                p.nickname,
                ROW_NUMBER() OVER (
                    PARTITION BY wur.user_id
                    ORDER BY wur.is_default_workspace DESC, wur.${qColumn('_upl_created_at')} ASC, wur.id ASC
                ) AS rn
            FROM ${workspaceUserRolesQt} wur
            INNER JOIN ${workspaceRolesQt} r ON r.id = wur.role_id
            LEFT JOIN auth.users u ON u.id = wur.user_id
            LEFT JOIN profiles.cat_profiles p ON p.user_id = wur.user_id
            WHERE wur.workspace_id = $1
              AND wur.${qColumn('_upl_deleted')} = false
              AND wur.${qColumn('_app_deleted')} = false
              AND (
                  $4::text IS NULL
                  OR u.email ILIKE $4
                  OR p.nickname ILIKE $4
              )
        ),
        filtered AS (
            SELECT *
            FROM memberships
            WHERE rn = 1
        ),
        owner_totals AS (
            SELECT COUNT(*) FILTER (WHERE role_codename = 'owner') AS owner_count
            FROM filtered
        )
        SELECT
            filtered.id,
            filtered.user_id,
            filtered.role_id,
            filtered.role_codename,
            filtered.is_default_workspace,
            filtered.email,
            filtered.nickname,
            NOT (filtered.role_codename = 'owner' AND owner_totals.owner_count <= 1) AS can_remove,
            COUNT(*) OVER() AS window_total
        FROM filtered
        CROSS JOIN owner_totals
        ORDER BY role_codename DESC, COALESCE(email, nickname, user_id::text) ASC, user_id ASC
        LIMIT $2 OFFSET $3
    `,
        [input.workspaceId, input.limit, input.offset, searchPattern]
    )

    const items = rows.map((row) => ({
        userId: row.user_id,
        roleCodename: row.role_codename,
        email: row.email,
        nickname: row.nickname,
        canRemove: row.can_remove
    }))
    const total = rows.length > 0 ? Number(rows[0].window_total) : 0

    return { items, total: Number.isFinite(total) ? total : 0 }
}
