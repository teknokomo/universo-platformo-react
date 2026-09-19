import { type DbExecutor } from '@universo-react/utils'
import { workflowActionSchema, type WorkflowAction } from '@universo-react/types'
import { type WorkflowStatusValueMap } from '../../services/runtimeWorkflowActions'
import { UpdateFailure, resolveRuntimeCodenameText } from '../../shared/runtimeHelpers'
import { isRuntimeEnumerationKind } from './contracts'

export const readConfiguredWorkflowActions = (config: Record<string, unknown> | null | undefined): WorkflowAction[] => {
    const rawActions = Array.isArray(config?.workflowActions) ? config.workflowActions : []
    return rawActions.flatMap((rawAction) => {
        const parsed = workflowActionSchema.safeParse(rawAction)
        return parsed.success ? [parsed.data] : []
    })
}

export const resolveWorkflowStatusColumnName = (
    action: WorkflowAction,
    attrs: Array<{ codename: unknown; column_name: string }>
): string | null => {
    if (action.statusColumnName) return action.statusColumnName
    if (!action.statusFieldCodename) return '_app_record_state'

    const target = action.statusFieldCodename.trim()
    const attr = attrs.find((candidate) => candidate.column_name === target || resolveRuntimeCodenameText(candidate.codename) === target)
    return attr?.column_name ?? null
}

export const normalizeWorkflowStatusKey = (value: unknown): string => (typeof value === 'string' ? value.trim().toLowerCase() : '')

export const buildWorkflowEnumStatusValueMap = async (
    manager: DbExecutor,
    schemaIdent: string,
    statusAttr:
        | {
              data_type: string
              target_object_id?: string | null
              target_object_kind?: string | null
          }
        | undefined
): Promise<WorkflowStatusValueMap | null> => {
    if (
        !statusAttr ||
        statusAttr.data_type !== 'REF' ||
        !isRuntimeEnumerationKind(statusAttr.target_object_kind) ||
        typeof statusAttr.target_object_id !== 'string'
    ) {
        return null
    }

    const rows = (await manager.query(
        `
      SELECT id, codename
      FROM ${schemaIdent}._app_values
      WHERE object_id = $1
        AND _upl_deleted = false
        AND _app_deleted = false
    `,
        [statusAttr.target_object_id]
    )) as Array<{ id: string; codename: string }>

    const statusByStoredValue: Record<string, string> = {}
    const storedValueByStatus: Record<string, string> = {}

    for (const row of rows) {
        const storedKey = normalizeWorkflowStatusKey(row.id)
        const statusKey = normalizeWorkflowStatusKey(row.codename)
        if (!storedKey || !statusKey) continue
        statusByStoredValue[storedKey] = row.codename
        storedValueByStatus[statusKey] = row.id
    }

    return { statusByStoredValue, storedValueByStatus }
}

export const ensureWorkflowEnumStatusesConfigured = (action: WorkflowAction, statusValueMap: WorkflowStatusValueMap | null): void => {
    if (!statusValueMap) return

    const missingStatuses = [...action.from, action.to].filter(
        (status) => !statusValueMap.storedValueByStatus[normalizeWorkflowStatusKey(status)]
    )
    if (missingStatuses.length === 0) return

    throw new UpdateFailure(400, {
        error: 'Workflow action references status values that are not configured for the target enumeration',
        code: 'WORKFLOW_STATUS_VALUE_NOT_CONFIGURED',
        missingStatuses
    })
}
