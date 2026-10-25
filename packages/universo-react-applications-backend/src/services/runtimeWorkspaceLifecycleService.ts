import type { DbExecutor } from '@universo-react/utils'

import { acquireAdvisoryXactLock } from '@universo-react/utils/database'
import { acquireWorkspaceBaselineLock } from './runtimeWorkspaceContext'

import { copyWorkspaceOperation, type RuntimeWorkspaceCopyInput } from './runtimeWorkspaceCopyService'

import { qColumn, qSchemaTable } from '@universo-react/database'

import { releaseActiveGlobalShortLinksForWorkspace } from '../persistence/globalShortLinksStore'

import {
    archiveWorkspaceScopedBusinessRows,
    ensureSharedWorkspaceBaselineMembershipUnderHeldBaselineLock,
    recordWorkspaceOperationAudit,
    syncWorkspaceSeededElements
} from './applicationWorkspaces'

import { revokeGuestAssessmentAttemptsForWorkspace, revokeGuestSessionSecretsForWorkspace } from './guestAssessmentApplicationRevocation'

import { RUNTIME_WORKSPACE_ERROR_CODES, RuntimeWorkspaceError } from './runtimeWorkspaceContracts'

import { ACTIVE_ROW_SQL, toJsonbParam } from './runtimeWorkspaceShared'

type SharedWorkspaceCreationInput = {
    schemaName: string
    /** Required: baseline membership enrollment needs the application member set. */
    applicationId: string
    name: unknown
    description: unknown
    userId: string
    actorUserId?: string | null
    seedElements?: boolean
}

export async function createSharedWorkspace(executor: DbExecutor, input: SharedWorkspaceCreationInput): Promise<{ id: string }> {
    return createSharedWorkspaceWithBaselineLock(executor, input, true)
}

/** Copy-only path. The caller must already hold the application baseline shared lock. */
async function createSharedWorkspaceForCopy(executor: DbExecutor, input: SharedWorkspaceCreationInput): Promise<{ id: string }> {
    return createSharedWorkspaceWithBaselineLock(executor, input, false)
}

async function createSharedWorkspaceWithBaselineLock(
    executor: DbExecutor,
    input: SharedWorkspaceCreationInput,
    acquireBaselineLock: boolean
): Promise<{ id: string }> {
    return executor.transaction(async (tx) => {
        // Normal creation excludes concurrent application membership removal.
        // Copy callers instead hold the baseline shared lock for the full copy.
        if (acquireBaselineLock) {
            await acquireWorkspaceBaselineLock(tx, input.schemaName, input.applicationId)
            await acquireAdvisoryXactLock(tx, `personal-workspace:${input.schemaName}:${input.userId}`)
        }

        const activeMemberRows = await tx.query<{ user_id: string }>(
            `
                SELECT user_id
                FROM ${qSchemaTable('applications', 'rel_application_users')}
                WHERE application_id = $1
                  AND user_id = $2
                  AND ${ACTIVE_ROW_SQL}
                LIMIT 1
                FOR SHARE
            `,
            [input.applicationId, input.userId]
        )
        if (!activeMemberRows[0]?.user_id) {
            throw new RuntimeWorkspaceError(
                RUNTIME_WORKSPACE_ERROR_CODES.userNotMember,
                'An active application membership is required to create a workspace'
            )
        }

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
        await ensureSharedWorkspaceBaselineMembershipUnderHeldBaselineLock(tx, {
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
        applicationId: string
        workspaceId: string
        name?: unknown
        description?: unknown
        actorUserId?: string | null
    }
): Promise<void> {
    await executor.transaction(async (tx) => {
        await acquireWorkspaceBaselineLock(tx, input.schemaName, input.applicationId)
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
        // Hold the baseline lock while converting the workspace and enrolling
        // every active application member.
        await acquireWorkspaceBaselineLock(tx, input.schemaName, input.applicationId)

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

        const baselineRows = await ensureSharedWorkspaceBaselineMembershipUnderHeldBaselineLock(tx, {
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
        await acquireWorkspaceBaselineLock(tx, input.schemaName, input.applicationId)
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
        createWorkspace: createSharedWorkspaceForCopy,
        createError: (code, message) => new RuntimeWorkspaceError(code, message)
    })
}
