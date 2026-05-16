import { qColumn, qSchemaTable } from '@universo/database'
import {
    evaluateWorkflowActionAvailability,
    workflowActionSchema,
    type WorkflowAction,
    type WorkflowCapabilityMap,
    type WorkflowPostingCommand
} from '@universo/types'
import type { DbExecutor } from '@universo/utils'
import { UpdateFailure } from '../shared/runtimeHelpers'

export type ApplyWorkflowActionParams = {
    executor: DbExecutor
    schemaName: string
    tableName: string
    objectId: string
    rowId: string
    action: WorkflowAction
    capabilities: WorkflowCapabilityMap | null | undefined
    userId: string | null | undefined
    statusColumnName?: string
    expectedVersion: number
    workspaceId?: string | null
    hasWorkspaceColumn?: boolean
    auditMetadata?: Record<string, unknown>
}

export type ApplyWorkflowActionResult = {
    id: string
    actionCodename: string
    fromStatus: string
    toStatus: string
    version: number | null
    postingCommand: WorkflowPostingCommand | null
}

const assertSafeIdentifier = (value: string, fieldName: string): void => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
        throw new UpdateFailure(400, { error: `${fieldName} is invalid`, code: 'INVALID_IDENTIFIER' })
    }
}

const assertExpectedVersion = (expectedVersion: number): void => {
    if (!Number.isInteger(expectedVersion) || expectedVersion <= 0) {
        throw new UpdateFailure(409, {
            error: 'Workflow action requires a current row version',
            code: 'WORKFLOW_VERSION_REQUIRED'
        })
    }
}

const normalizeStatus = (value: unknown): string => (typeof value === 'string' ? value : '')

const appendWorkflowActionAuditFact = async (params: {
    executor: DbExecutor
    schemaName: string
    objectId: string
    tableName: string
    rowId: string
    workspaceId: string | null
    action: WorkflowAction
    fromStatus: string
    toStatus: string
    userId: string
    metadata: Record<string, unknown>
}): Promise<void> => {
    const auditTable = qSchemaTable(params.schemaName, '_app_workflow_action_audit')
    await params.executor.query(
        `
            INSERT INTO ${auditTable} (
                ${qColumn('object_id')},
                ${qColumn('table_name')},
                ${qColumn('row_id')},
                ${qColumn('workspace_id')},
                ${qColumn('action_codename')},
                ${qColumn('from_status')},
                ${qColumn('to_status')},
                ${qColumn('posting_command')},
                ${qColumn('metadata')},
                ${qColumn('_upl_created_by')},
                ${qColumn('_upl_updated_by')}
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $10)
        `,
        [
            params.objectId,
            params.tableName,
            params.rowId,
            params.workspaceId,
            params.action.codename,
            params.fromStatus,
            params.toStatus,
            params.action.postingCommand ?? null,
            JSON.stringify(params.metadata),
            params.userId
        ]
    )
}

export async function applyWorkflowAction(params: ApplyWorkflowActionParams): Promise<ApplyWorkflowActionResult> {
    const action = workflowActionSchema.parse(params.action)
    const statusColumnName = params.statusColumnName ?? action.statusColumnName ?? '_app_record_state'

    assertSafeIdentifier(params.tableName, 'tableName')
    assertSafeIdentifier(statusColumnName, 'statusColumnName')
    assertExpectedVersion(params.expectedVersion)

    if (!params.userId) {
        throw new UpdateFailure(401, { error: 'Workflow action requires a current user id', code: 'WORKFLOW_USER_REQUIRED' })
    }

    if (params.hasWorkspaceColumn && !params.workspaceId) {
        throw new UpdateFailure(409, {
            error: 'Workspace-scoped workflow action requires a workspace context',
            code: 'WORKFLOW_WORKSPACE_REQUIRED'
        })
    }

    const tableName = qSchemaTable(params.schemaName, params.tableName)
    const idColumn = qColumn('id')
    const statusColumn = qColumn(statusColumnName)
    const deletedColumn = qColumn('_upl_deleted')
    const appDeletedColumn = qColumn('_app_deleted')
    const lockedColumn = qColumn('_upl_locked')
    const versionColumn = qColumn('_upl_version')
    const updatedAtColumn = qColumn('_upl_updated_at')
    const updatedByColumn = qColumn('_upl_updated_by')
    const workspaceColumn = qColumn('workspace_id')

    const selectParams: unknown[] = [params.rowId]
    const workspaceClause = params.hasWorkspaceColumn ? `AND ${workspaceColumn} = $2` : ''
    if (params.hasWorkspaceColumn) selectParams.push(params.workspaceId)

    const rows = await params.executor.query<Record<string, unknown>>(
        `
            SELECT ${idColumn}, ${statusColumn}, ${versionColumn}, ${lockedColumn}
              FROM ${tableName}
             WHERE ${idColumn} = $1
               AND COALESCE(${deletedColumn}, false) = false
               AND COALESCE(${appDeletedColumn}, false) = false
               ${workspaceClause}
             FOR UPDATE
             LIMIT 1
        `,
        selectParams
    )
    const row = rows[0]
    if (!row?.id) {
        throw new UpdateFailure(404, { error: 'Workflow action row not found', code: 'WORKFLOW_ROW_NOT_FOUND' })
    }
    if (row._upl_locked === true) {
        throw new UpdateFailure(423, { error: 'Workflow action row is locked', code: 'WORKFLOW_ROW_LOCKED' })
    }

    const currentVersion = Number(row._upl_version ?? 1)
    if (currentVersion !== params.expectedVersion) {
        throw new UpdateFailure(409, {
            error: 'Workflow action version mismatch',
            code: 'WORKFLOW_VERSION_MISMATCH',
            expectedVersion: params.expectedVersion,
            actualVersion: currentVersion
        })
    }

    const fromStatus = normalizeStatus(row[statusColumnName])
    const availability = evaluateWorkflowActionAvailability({
        action,
        currentStatus: fromStatus,
        capabilities: params.capabilities
    })

    if (!availability.available) {
        throw new UpdateFailure(403, {
            error: 'Workflow action is not available',
            code: 'WORKFLOW_ACTION_UNAVAILABLE',
            reason: availability.reason,
            missingCapabilities: availability.missingCapabilities,
            unsupportedScopes: availability.unsupportedScopes
        })
    }

    const updateParams: unknown[] = [params.rowId, action.to, params.userId, params.expectedVersion]
    const updateWorkspaceClause = params.hasWorkspaceColumn ? `AND ${workspaceColumn} = $5` : ''
    if (params.hasWorkspaceColumn) updateParams.push(params.workspaceId)
    const allowedFromStatusesParam = updateParams.length + 1

    const updatedRows = await params.executor.query<Record<string, unknown>>(
        `
            UPDATE ${tableName}
               SET ${statusColumn} = $2,
                   ${updatedAtColumn} = NOW(),
                   ${updatedByColumn} = $3,
                   ${versionColumn} = COALESCE(${versionColumn}, 1) + 1
             WHERE ${idColumn} = $1
               AND ${statusColumn} = ANY($${allowedFromStatusesParam}::text[])
               AND COALESCE(${deletedColumn}, false) = false
               AND COALESCE(${appDeletedColumn}, false) = false
               AND COALESCE(${lockedColumn}, false) = false
               AND COALESCE(${versionColumn}, 1) = $4
               ${updateWorkspaceClause}
             RETURNING ${idColumn}, ${statusColumn}, ${versionColumn}
        `,
        [...updateParams, action.from]
    )

    const updatedRow = updatedRows[0]
    if (!updatedRow?.id) {
        throw new UpdateFailure(409, {
            error: 'Workflow action is not available for this row',
            code: 'WORKFLOW_ACTION_CONFLICT'
        })
    }

    await appendWorkflowActionAuditFact({
        executor: params.executor,
        schemaName: params.schemaName,
        objectId: params.objectId,
        tableName: params.tableName,
        rowId: params.rowId,
        workspaceId: params.workspaceId ?? null,
        action,
        fromStatus,
        toStatus: action.to,
        userId: params.userId,
        metadata: params.auditMetadata ?? {}
    })

    const nextVersion = Number(updatedRow._upl_version)

    return {
        id: String(updatedRow.id),
        actionCodename: action.codename,
        fromStatus,
        toStatus: action.to,
        version: Number.isFinite(nextVersion) ? nextVersion : null,
        postingCommand: action.postingCommand ?? null
    }
}
