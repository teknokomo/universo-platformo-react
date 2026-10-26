import { acquireWorkspaceBaselineLock } from './runtimeWorkspaceContext'

import type { DbExecutor, SqlQueryable } from '@universo-react/utils'
import { acquireAdvisoryXactLock } from '@universo-react/utils/database'

import { qColumn, qSchemaTable } from '@universo-react/database'

import {
    RUNTIME_WORKSPACE_ERROR_CODES,
    RuntimeWorkspaceError,
    type RuntimeWorkspaceMember,
    type RuntimeWorkspaceMembership
} from './runtimeWorkspaceContracts'

import { ACTIVE_ROW_SQL, assertWorkspaceExists } from './runtimeWorkspaceShared'

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

/**
 * Fail-closed departure guard: rejects application leave/removal when the
 * departing user holds the only active `owner` row of any active shared
 * workspace. Member management is owner-gated, so losing that row would strand
 * the workspace without any manager. Another `owner` row only counts as a
 * protecting owner while its user is still an active application member —
 * stale rows of users who already left (or were removed) do not keep the
 * workspace manageable. No auto-transfer UX is introduced; the caller resolves
 * ownership (transfer or workspace deletion) first.
 */
export async function assertUserIsNotLastSharedWorkspaceOwner(
    executor: DbExecutor,
    input: {
        schemaName: string
        applicationId: string
        userId: string
    }
): Promise<void> {
    const workspacesQt = qSchemaTable(input.schemaName, '_app_workspaces')
    const workspaceUserRolesQt = qSchemaTable(input.schemaName, '_app_workspace_user_roles')
    const workspaceRolesQt = qSchemaTable(input.schemaName, '_app_workspace_roles')

    const rows = await executor.query<{ id: string }>(
        `
        SELECT w.id
        FROM ${workspacesQt} w
        WHERE w.workspace_type <> 'personal'
          AND w.personal_user_id IS NULL
          AND COALESCE(w.status, 'active') = 'active'
          AND ${ACTIVE_ROW_SQL}
          AND EXISTS (
              SELECT 1
              FROM ${workspaceUserRolesQt} wur
              INNER JOIN ${workspaceRolesQt} r ON r.id = wur.role_id
              WHERE wur.workspace_id = w.id
                AND wur.user_id = $1
                AND r.codename = 'owner'
                AND wur.${qColumn('_upl_deleted')} = false
                AND wur.${qColumn('_app_deleted')} = false
          )
          AND NOT EXISTS (
              SELECT 1
              FROM ${workspaceUserRolesQt} other
              INNER JOIN ${workspaceRolesQt} orRole ON orRole.id = other.role_id
              WHERE other.workspace_id = w.id
                AND other.user_id <> $1
                AND orRole.codename = 'owner'
                AND other.${qColumn('_upl_deleted')} = false
                AND other.${qColumn('_app_deleted')} = false
                AND EXISTS (
                    SELECT 1
                    FROM applications.rel_application_users au
                    WHERE au.user_id = other.user_id
                      AND au.application_id = $2
                      AND ${ACTIVE_ROW_SQL}
                )
          )
        ORDER BY w.id ASC
        LIMIT 1
        `,
        [input.userId, input.applicationId]
    )

    if (rows.length > 0) {
        throw new RuntimeWorkspaceError(
            RUNTIME_WORKSPACE_ERROR_CODES.memberWorkspaceOwnershipBlocked,
            'Transfer or delete your shared workspace before leaving the application'
        )
    }
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
        await acquireAdvisoryXactLock(tx, `personal-workspace:${input.schemaName}:${input.userId}`)

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

/**
 * Counts the *effective* owner rows of a workspace besides `userId`. A row
 * counts only while both relation rows stay active **and** its user is still
 * an active application member (when `applicationId` is provided) — stale rows
 * of users who already left or were removed do not keep a workspace
 * manageable.
 */
async function countOtherActiveOwnerRows(
    executor: SqlQueryable,
    input: {
        schemaName: string
        workspaceId: string
        userId: string
        applicationId: string
    }
): Promise<number> {
    const workspaceUserRolesQt = qSchemaTable(input.schemaName, '_app_workspace_user_roles')
    const workspaceRolesQt = qSchemaTable(input.schemaName, '_app_workspace_roles')

    const rows = await executor.query<{ id: string }>(
        `
        SELECT wur.id
        FROM ${workspaceUserRolesQt} wur
        INNER JOIN ${workspaceRolesQt} r ON r.id = wur.role_id
        WHERE wur.workspace_id = $1
          AND wur.user_id <> $2
          AND r.codename = 'owner'
          AND wur.${qColumn('_upl_deleted')} = false
          AND wur.${qColumn('_app_deleted')} = false
          AND EXISTS (
              SELECT 1
              FROM applications.rel_application_users au
              WHERE au.user_id = wur.user_id
                AND au.application_id = $3
                AND ${ACTIVE_ROW_SQL}
          )
        FOR UPDATE OF wur
        `,
        [input.workspaceId, input.userId, input.applicationId]
    )
    return rows.length
}

export async function addWorkspaceMember(
    executor: DbExecutor,
    input: {
        schemaName: string
        applicationId: string
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

        // Serialize the self-demotion guard below with application-level
        // membership mutations (leave/removal) through the workspace
        // lifecycle's canonical `workspace-baseline` advisory lock.
        await acquireWorkspaceBaselineLock(tx, input.schemaName, input.applicationId)

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

            // Self-demotion guard: demoting the last `owner` row of a
            // workspace would strand it without any owner able to manage
            // members. An invite-side flow first targets itself or a
            // co-owner, so both directions must fail-closed here.
            if (existing[0].role_codename === 'owner' && input.roleCodename !== 'owner') {
                const remainingOwnerRows = await countOtherActiveOwnerRows(tx, {
                    schemaName: input.schemaName,
                    workspaceId: input.workspaceId,
                    userId: input.userId,
                    applicationId: input.applicationId
                })
                if (remainingOwnerRows < 1) {
                    throw new RuntimeWorkspaceError(
                        RUNTIME_WORKSPACE_ERROR_CODES.lastOwnerRemovalBlocked,
                        'Cannot demote the last workspace owner'
                    )
                }
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
        applicationId: string
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

        // Serialize last-owner checks with application-level membership
        // mutations (leave/removal) through the same advisory lock the rest of
        // the workspace lifecycle uses (`workspace-baseline` first).
        await acquireWorkspaceBaselineLock(tx, input.schemaName, input.applicationId)

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
            const remainingOwnerRows = await countOtherActiveOwnerRows(tx, {
                schemaName: input.schemaName,
                workspaceId: input.workspaceId,
                userId: input.userId,
                applicationId: input.applicationId
            })

            if (remainingOwnerRows < 1) {
                throw new RuntimeWorkspaceError(
                    RUNTIME_WORKSPACE_ERROR_CODES.lastOwnerRemovalBlocked,
                    'Cannot remove the last workspace owner'
                )
            }
        }

        // Remove the remaining explicit role rows, but keep the baseline
        // `member` row of a user who is still an active application member:
        // shared workspaces are visible to every active application member
        // through that platform-owned row, so a workspace-scope removal must
        // not revoke it (otherwise the workspace disappears from their
        // switcher until an unrelated join/creation/conversion re-provisions
        // access). Application-level leave/removal still cleans it up.
        await tx.query(
            `
            UPDATE ${workspaceUserRolesQt} AS wur
            SET ${qColumn('_upl_deleted')} = true,
                ${qColumn('_upl_deleted_at')} = NOW(),
                ${qColumn('_upl_deleted_by')} = $3,
                ${qColumn('_upl_updated_at')} = NOW(),
                ${qColumn('_upl_updated_by')} = $3,
                ${qColumn('_upl_version')} = COALESCE(${qColumn('_upl_version')}, 1) + 1,
                ${qColumn('_app_deleted')} = true,
                ${qColumn('_app_deleted_at')} = NOW(),
                ${qColumn('_app_deleted_by')} = $3
            FROM ${workspaceRolesQt} AS r
            WHERE wur.${qColumn('role_id')} = r.id
              AND wur.workspace_id = $1
              AND wur.user_id = $2
              AND wur.${qColumn('_upl_deleted')} = false
              AND wur.${qColumn('_app_deleted')} = false
              AND NOT (
                  r.codename = 'member'
                  AND EXISTS (
                      SELECT 1
                      FROM applications.rel_application_users au
                      WHERE au.user_id = wur.user_id
                        AND au.application_id = $4
                        AND ${ACTIVE_ROW_SQL}
                  )
              )
        `,
            [input.workspaceId, input.userId, input.actorUserId ?? null, input.applicationId]
        )

        // A pure baseline member cannot be revoked at the workspace scope:
        // treat the request as a no-op instead of 404 so the caller-visible
        // membership list stays consistent with the platform contract.
    })
}

export async function getWorkspaceMembership(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        userId: string
        lockForMutation?: boolean
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
        ${input.lockForMutation ? 'FOR SHARE OF wur' : ''}
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

/**
 * Stabilize an owner's workspace membership before a controller delegates a
 * mutation to a service that may lock the workspace row. All membership
 * mutation services acquire the same baseline lock first.
 */
export async function lockWorkspaceMembershipForMutation(
    executor: DbExecutor,
    input: {
        schemaName: string
        applicationId: string
        workspaceId: string
        userId: string
    }
): Promise<RuntimeWorkspaceMembership | null> {
    return executor.transaction(async (tx) => {
        await acquireWorkspaceBaselineLock(tx, input.schemaName, input.applicationId)
        return getWorkspaceMembership(tx, { ...input, lockForMutation: true })
    })
}

export async function listWorkspaceMembers(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        limit: number
        offset: number
        search?: string
        canViewEmails: boolean
    }
): Promise<{ items: RuntimeWorkspaceMember[]; total: number }> {
    const workspaceUserRolesQt = qSchemaTable(input.schemaName, '_app_workspace_user_roles')
    const workspaceRolesQt = qSchemaTable(input.schemaName, '_app_workspace_roles')
    const searchPattern = input.search ? `%${input.search}%` : null
    const canViewEmails = input.canViewEmails === true
    // Keep email data out of the query for callers without an ownership or management grant.
    const emailSelection = canViewEmails ? 'u.email' : 'NULL::text'
    const emailSearchClause = canViewEmails ? 'OR u.email ILIKE $4' : ''
    const authUserJoin = canViewEmails ? 'LEFT JOIN auth.users u ON u.id = wur.user_id' : ''
    const memberOrder = canViewEmails ? 'COALESCE(email, nickname, user_id::text)' : 'COALESCE(nickname, user_id::text)'

    const rows = await executor.query<WorkspaceMemberRow>(
        `
        WITH memberships AS (
            SELECT
                wur.id,
                wur.user_id,
                wur.role_id,
                r.codename AS role_codename,
                wur.is_default_workspace,
                ${emailSelection} AS email,
                p.nickname,
                ROW_NUMBER() OVER (
                    PARTITION BY wur.user_id
                    ORDER BY wur.is_default_workspace DESC, wur.${qColumn('_upl_created_at')} ASC, wur.id ASC
                ) AS rn
            FROM ${workspaceUserRolesQt} wur
            INNER JOIN ${workspaceRolesQt} r ON r.id = wur.role_id
            ${authUserJoin}
            LEFT JOIN profiles.obj_profiles p ON p.user_id = wur.user_id
            WHERE wur.workspace_id = $1
              AND wur.${qColumn('_upl_deleted')} = false
              AND wur.${qColumn('_app_deleted')} = false
              AND (
                  $4::text IS NULL
                  OR p.nickname ILIKE $4
                  ${emailSearchClause}
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
        ORDER BY role_codename DESC, ${memberOrder} ASC, user_id ASC
        LIMIT $2 OFFSET $3
    `,
        [input.workspaceId, input.limit, input.offset, searchPattern]
    )

    const items = rows.map((row) => ({
        userId: row.user_id,
        roleCodename: row.role_codename,
        email: canViewEmails ? row.email : null,
        nickname: row.nickname,
        canRemove: row.can_remove
    }))
    const total = rows.length > 0 ? Number(rows[0].window_total) : 0

    return { items, total: Number.isFinite(total) ? total : 0 }
}
