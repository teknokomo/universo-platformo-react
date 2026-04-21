import type { DbExecutor } from '@universo/utils'
import { qColumn, qSchemaTable } from '@universo/database'

type WorkspaceRow = {
    id: string
    codename: string
    name: unknown
    workspace_type: string
    personal_user_id: string | null
    status: string
    is_default_workspace: boolean
    role_codename: string
}

type WorkspaceMemberRow = {
    id: string
    user_id: string
    role_id: string
    role_codename: string
    is_default_workspace: boolean
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

export type RuntimeWorkspace = {
    id: string
    codename: string
    name: unknown
    workspaceType: string
    personalUserId: string | null
    status: string
    isDefault: boolean
    roleCodename: string
}

export type RuntimeWorkspaceMember = {
    userId: string
    roleCodename: string
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

async function assertWorkspaceAllowsMemberManagement(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
    }
): Promise<void> {
    const workspacesQt = qSchemaTable(input.schemaName, '_app_workspaces')

    const rows = await executor.query<{ workspace_type: string; personal_user_id: string | null }>(
        `
        SELECT workspace_type, personal_user_id
        FROM ${workspacesQt}
        WHERE id = $1
          AND ${ACTIVE_ROW_SQL}
        LIMIT 1
    `,
        [input.workspaceId]
    )

    const workspace = rows[0]
    if (!workspace) {
        throw new Error('Workspace not found')
    }

    if (workspace.workspace_type === 'personal') {
        throw new Error('Personal workspaces do not support member management')
    }
}

export async function listUserWorkspaces(executor: DbExecutor, input: { schemaName: string; userId: string }): Promise<RuntimeWorkspace[]> {
    const workspacesQt = qSchemaTable(input.schemaName, '_app_workspaces')
    const workspaceUserRolesQt = qSchemaTable(input.schemaName, '_app_workspace_user_roles')
    const workspaceRolesQt = qSchemaTable(input.schemaName, '_app_workspace_roles')

    const rows = await executor.query<WorkspaceRow>(
        `
        SELECT
            w.id,
            w.codename,
            w.name,
            w.workspace_type,
            w.personal_user_id,
            w.status,
            wur.is_default_workspace,
            r.codename AS role_codename
        FROM ${workspaceUserRolesQt} wur
        INNER JOIN ${workspacesQt} w ON w.id = wur.workspace_id
        INNER JOIN ${workspaceRolesQt} r ON r.id = wur.role_id
        WHERE wur.user_id = $1
          AND wur.${'"_upl_deleted"'} = false
          AND wur.${'"_app_deleted"'} = false
          AND w.${'"_upl_deleted"'} = false
          AND w.${'"_app_deleted"'} = false
          AND COALESCE(w.status, 'active') = 'active'
        ORDER BY wur.is_default_workspace DESC, w.${'"_upl_created_at"'} ASC, w.id ASC
    `,
        [input.userId]
    )

    const seenWorkspaceIds = new Set<string>()
    return rows
        .filter((row) => {
            if (seenWorkspaceIds.has(row.id)) {
                return false
            }
            seenWorkspaceIds.add(row.id)
            return true
        })
        .map((row) => ({
            id: row.id,
            codename: row.codename,
            name: row.name,
            workspaceType: row.workspace_type,
            personalUserId: row.personal_user_id,
            status: row.status,
            isDefault: row.is_default_workspace,
            roleCodename: row.role_codename
        }))
}

export async function createSharedWorkspace(
    executor: DbExecutor,
    input: {
        schemaName: string
        codename: string
        name: unknown
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
                id, codename, name, workspace_type, status,
                ${qColumn('_upl_created_by')}, ${qColumn('_upl_updated_by')}
            )
            VALUES ($1, $2, $3::jsonb, 'shared', 'active', $4, $5)
        `,
            [
                workspaceId,
                input.codename,
                typeof input.name === 'string' ? JSON.stringify(input.name) : input.name,
                input.actorUserId ?? null,
                input.actorUserId ?? null
            ]
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

export async function setDefaultWorkspace(
    executor: DbExecutor,
    input: {
        schemaName: string
        userId: string
        workspaceId: string
        actorUserId?: string | null
    }
): Promise<void> {
    const workspaceUserRolesQt = qSchemaTable(input.schemaName, '_app_workspace_user_roles')

    const existing = await executor.query<{ workspace_id: string }>(
        `
        SELECT workspace_id FROM ${workspaceUserRolesQt}
        WHERE user_id = $1
          AND workspace_id = $2
          AND ${ACTIVE_ROW_SQL}
        LIMIT 1
    `,
        [input.userId, input.workspaceId]
    )

    if (existing.length === 0) {
        throw new Error('User is not a member of this workspace')
    }

    await executor.query(
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

    await executor.query(
        `
        UPDATE ${workspaceUserRolesQt}
        SET is_default_workspace = true,
            ${qColumn('_upl_updated_at')} = NOW(),
            ${qColumn('_upl_updated_by')} = $3
        WHERE workspace_id = $1
          AND user_id = $2
          AND ${ACTIVE_ROW_SQL}
    `,
        [input.workspaceId, input.userId, input.actorUserId ?? null]
    )
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
        await assertWorkspaceAllowsMemberManagement(tx, {
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
            throw new Error(`Role "${input.roleCodename}" not found`)
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
              AND ${ACTIVE_ROW_SQL}
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
    await assertWorkspaceAllowsMemberManagement(executor, {
        schemaName: input.schemaName,
        workspaceId: input.workspaceId
    })

    const workspaceUserRolesQt = qSchemaTable(input.schemaName, '_app_workspace_user_roles')
    const workspaceRolesQt = qSchemaTable(input.schemaName, '_app_workspace_roles')

    const membershipRows = await executor.query<WorkspaceMembershipRow>(
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
          AND wur.${'"_upl_deleted"'} = false
          AND wur.${'"_app_deleted"'} = false
        ORDER BY wur.is_default_workspace DESC, wur.${'"_upl_created_at"'} ASC, wur.id ASC
    `,
        [input.workspaceId, input.userId]
    )

    if (membershipRows.length === 0) {
        throw new Error('Workspace member not found')
    }

    if (membershipRows.some((row) => row.role_codename === 'owner')) {
        const remainingOwnerRows = await executor.query<{ total: number | string }>(
            `
            SELECT COUNT(*) AS total
            FROM ${workspaceUserRolesQt} wur
            INNER JOIN ${workspaceRolesQt} r ON r.id = wur.role_id
            WHERE wur.workspace_id = $1
              AND wur.user_id <> $2
              AND r.codename = 'owner'
              AND wur.${'"_upl_deleted"'} = false
              AND wur.${'"_app_deleted"'} = false
        `,
            [input.workspaceId, input.userId]
        )

        const remainingOwnersRaw = remainingOwnerRows[0]?.total
        const remainingOwners =
            typeof remainingOwnersRaw === 'number'
                ? remainingOwnersRaw
                : typeof remainingOwnersRaw === 'string'
                ? Number(remainingOwnersRaw)
                : 0

        if (!Number.isFinite(remainingOwners) || remainingOwners < 1) {
            throw new Error('Cannot remove the last workspace owner')
        }
    }

    await executor.query(
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
    `,
        [input.workspaceId, input.userId, input.actorUserId ?? null]
    )
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
    }
): Promise<RuntimeWorkspaceMember[]> {
    const workspaceUserRolesQt = qSchemaTable(input.schemaName, '_app_workspace_user_roles')
    const workspaceRolesQt = qSchemaTable(input.schemaName, '_app_workspace_roles')

    const rows = await executor.query<WorkspaceMemberRow>(
        `
        SELECT
            wur.id,
            wur.user_id,
            wur.role_id,
            r.codename AS role_codename,
            wur.is_default_workspace
        FROM ${workspaceUserRolesQt} wur
        INNER JOIN ${workspaceRolesQt} r ON r.id = wur.role_id
        WHERE wur.workspace_id = $1
          AND wur.${'"_upl_deleted"'} = false
          AND wur.${'"_app_deleted"'} = false
        ORDER BY wur.${'"_upl_created_at"'} ASC, wur.user_id ASC
    `,
        [input.workspaceId]
    )

    const seenUserIds = new Set<string>()
    return rows
        .filter((row) => {
            if (seenUserIds.has(row.user_id)) {
                return false
            }
            seenUserIds.add(row.user_id)
            return true
        })
        .map((row) => ({
            userId: row.user_id,
            roleCodename: row.role_codename
        }))
}
