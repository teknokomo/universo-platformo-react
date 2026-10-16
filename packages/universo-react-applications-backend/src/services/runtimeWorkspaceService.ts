import { acquireAdvisoryXactLock } from '@universo-react/utils/database'
import type { DbExecutor, SqlQueryable } from '@universo-react/utils'
import { copyWorkspaceOperation, type RuntimeWorkspaceCopyInput } from './runtimeWorkspaceCopyService'
import { qColumn, qSchemaTable } from '@universo-react/database'
import { releaseActiveGlobalShortLinksForWorkspace } from '../persistence/globalShortLinksStore'
import {
    archiveWorkspaceScopedBusinessRows,
    ensureSharedWorkspaceBaselineMembership,
    recordWorkspaceOperationAudit,
    syncWorkspaceSeededElements
} from './applicationWorkspaces'
import { revokeGuestAssessmentAttemptsForWorkspace, revokeGuestSessionSecretsForWorkspace } from './guestAssessmentApplicationRevocation'

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
const toJsonbParam = (value: unknown): string => JSON.stringify(value ?? null)

export const RUNTIME_WORKSPACE_ERROR_CODES = {
    workspaceNotFound: 'WORKSPACE_NOT_FOUND',
    userNotMember: 'USER_NOT_MEMBER',
    roleNotFound: 'WORKSPACE_ROLE_NOT_FOUND',
    memberNotFound: 'WORKSPACE_MEMBER_NOT_FOUND',
    personalWorkspaceMutationBlocked: 'PERSONAL_WORKSPACE_MUTATION_BLOCKED',
    workspaceConversionBlocked: 'WORKSPACE_CONVERSION_BLOCKED',
    memberWorkspaceOwnershipBlocked: 'APPLICATION_MEMBER_WORKSPACE_OWNERSHIP_REQUIRED',
    lastOwnerRemovalBlocked: 'LAST_WORKSPACE_OWNER_REMOVAL_BLOCKED',
    workspaceCopyReferenceUnresolved: 'WORKSPACE_COPY_REFERENCE_UNRESOLVED',
    workspaceCopyAccessLinkIntakeInvalid: 'WORKSPACE_COPY_ACCESS_LINK_INTAKE_INVALID'
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

export async function createSharedWorkspace(
    executor: DbExecutor,
    input: {
        schemaName: string
        /** Required: baseline membership enrollment needs the application member set. */
        applicationId: string
        name: unknown
        description: unknown
        userId: string
        actorUserId?: string | null
        seedElements?: boolean
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

        if (input.seedElements !== false) {
            await syncWorkspaceSeededElements(tx, {
                schemaName: input.schemaName,
                workspaceId,
                actorUserId: input.actorUserId,
                currentUserId: input.userId
            })
        }

        // Two-tier access model: every active application member gets baseline
        // `member` access to the new shared workspace in the same transaction.
        await ensureSharedWorkspaceBaselineMembership(tx, {
            schemaName: input.schemaName,
            applicationId: input.applicationId,
            actorUserId: input.actorUserId
        })

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

/**
 * One-way, in-place `personal` → `shared` conversion for the caller-owned
 * workspace. Preserves the workspace `id`, all business rows, references,
 * `_seed_source_*` metadata, settings overrides, and membership rows; only the
 * `workspace_type` / `personal_user_id` / `converted_from_user_id` triplet
 * changes. Fail-closed: any zero-row mutation aborts the transaction.
 */
export async function convertPersonalWorkspaceToShared(
    executor: DbExecutor,
    input: {
        schemaName: string
        applicationId: string
        workspaceId: string
        userId: string
        actorUserId?: string | null
    }
): Promise<{ id: string }> {
    return executor.transaction(async (tx) => {
        const workspacesQt = qSchemaTable(input.schemaName, '_app_workspaces')

        // Canonical lock order across the workspace lifecycle:
        // `workspace-baseline` (application scope) first, then
        // `personal-workspace` (user scope below) to serialize with the
        // provisioning path and to prevent lock-order deadlocks with
        // application leave/removal (which takes the baseline lock first too).
        // Advisory locks are re-entrant within the transaction, so the
        // baseline enrollment below re-acquiress safely.
        await acquireAdvisoryXactLock(tx, `workspace-baseline:${input.schemaName}:${input.applicationId}`)

        // Serialize with ensurePersonalWorkspaceForUser: without this lock,
        // a runtime request racing the conversion could still re-provision a
        // duplicate `Main` personal workspace for the same user.
        await acquireAdvisoryXactLock(tx, `personal-workspace:${input.schemaName}:${input.userId}`)

        const workspaceRows = await tx.query<{ id: string; workspace_type: string; personal_user_id: string | null }>(
            `
            SELECT id, workspace_type, personal_user_id
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
        if (workspace.workspace_type !== 'personal' || workspace.personal_user_id !== input.userId) {
            throw new RuntimeWorkspaceError(
                RUNTIME_WORKSPACE_ERROR_CODES.workspaceConversionBlocked,
                'Only the caller-owned personal workspace can be converted to shared'
            )
        }

        const updatedRows = await tx.query<{ id: string }>(
            `
            UPDATE ${workspacesQt}
            SET workspace_type = 'shared',
                personal_user_id = NULL,
                converted_from_user_id = $2,
                ${qColumn('_upl_updated_at')} = NOW(),
                ${qColumn('_upl_updated_by')} = $3,
                ${qColumn('_upl_version')} = COALESCE(${qColumn('_upl_version')}, 1) + 1
            WHERE id = $1
              AND workspace_type = 'personal'
              AND personal_user_id = $2
              AND ${ACTIVE_ROW_SQL}
            RETURNING id
            `,
            [input.workspaceId, input.userId, input.actorUserId ?? input.userId]
        )
        if (updatedRows.length === 0) {
            throw new RuntimeWorkspaceError(
                RUNTIME_WORKSPACE_ERROR_CODES.workspaceConversionBlocked,
                'Workspace conversion raced with another mutation; retry'
            )
        }

        const baselineRows = await ensureSharedWorkspaceBaselineMembership(tx, {
            schemaName: input.schemaName,
            applicationId: input.applicationId,
            actorUserId: input.actorUserId ?? input.userId
        })

        await recordWorkspaceOperationAudit(tx, {
            schemaName: input.schemaName,
            workspaceId: input.workspaceId,
            operationKind: 'personal_to_shared_conversion',
            affectedRows: baselineRows,
            actorUserId: input.actorUserId ?? input.userId,
            sourceKey: input.workspaceId
        })

        return { id: updatedRows[0].id }
    })
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

export async function deleteSharedWorkspace(
    executor: DbExecutor,
    input: {
        schemaName: string
        applicationId: string
        workspaceId: string
        applicationSettings?: Record<string, unknown> | null
        actorUserId: string
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

        await revokeGuestSessionSecretsForWorkspace(tx, input.schemaName, input.applicationId, input.applicationSettings, input.workspaceId)
        await revokeGuestAssessmentAttemptsForWorkspace(tx, input.schemaName, input.applicationSettings, input.workspaceId)
        await releaseActiveGlobalShortLinksForWorkspace(tx, input.applicationId, input.workspaceId, input.actorUserId)

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
                ${qColumn('is_public_entry')} = false,
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

export async function copyWorkspace(executor: DbExecutor, input: RuntimeWorkspaceCopyInput): Promise<{ id: string }> {
    return copyWorkspaceOperation(executor, input, {
        createWorkspace: createSharedWorkspace,
        createError: (code, message) => new RuntimeWorkspaceError(code, message)
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
        await acquireAdvisoryXactLock(tx, `workspace-baseline:${input.schemaName}:${input.applicationId}`)

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
        await acquireAdvisoryXactLock(tx, `workspace-baseline:${input.schemaName}:${input.applicationId}`)

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
        const deletedRows = await tx.query<{ id: string }>(
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
            RETURNING wur.id
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
            LEFT JOIN profiles.obj_profiles p ON p.user_id = wur.user_id
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
