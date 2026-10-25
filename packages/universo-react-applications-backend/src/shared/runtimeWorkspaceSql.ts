import { qColumn } from '@universo-react/database'

/** Appends active-row and optional Workspace predicates using caller-owned bind parameters. */
export const activeWorkspaceWhere = (workspaceId: string | null, params: unknown[], alias?: string): string => {
    const prefix = alias ? `${qColumn(alias)}.` : ''
    const conditions = [`${prefix}${qColumn('_upl_deleted')} = false`, `${prefix}${qColumn('_app_deleted')} = false`]
    if (workspaceId) {
        params.push(workspaceId)
        conditions.push(`${prefix}${qColumn('workspace_id')} = $${params.length}`)
    }
    return conditions.join(' AND ')
}
