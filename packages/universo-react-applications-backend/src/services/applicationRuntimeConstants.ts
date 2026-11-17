import type { DbExecutor } from '@universo-react/utils'
import { quoteSchemaName, resolveRuntimeCodenameText } from '../shared/runtimeHelpers'

export interface ApplicationRuntimeConstantDefinition {
    id: string
    groupId: string
    codename: unknown
    codenameText: string
    dataType: string
    value: unknown
    sortOrder: number
}

/**
 * Read Set fixed values materialized by `syncSetConstants` from `_app_constants`.
 * Fail-soft (empty list) so older application schemas without the table degrade
 * gracefully instead of breaking unrelated runtime flows.
 *
 * Lives in the services layer (not `routes/sync`) so runtime services can read
 * economy-style constants without an inverted services→routes import.
 */
export async function loadApplicationRuntimeConstants(
    exec: DbExecutor,
    schemaName: string
): Promise<ApplicationRuntimeConstantDefinition[]> {
    const schemaIdent = quoteSchemaName(schemaName)

    try {
        const rows = await exec.query<{
            id: string
            group_id: string
            codename: unknown
            data_type: string
            value_json: unknown
            sort_order: number
        }>(
            `
                SELECT id, group_id, codename, data_type, value_json, sort_order
                FROM ${schemaIdent}._app_constants
                WHERE _upl_deleted = false
                  AND _app_deleted = false
                ORDER BY group_id ASC, sort_order ASC, id ASC
            `
        )

        return rows.map((row) => ({
            id: row.id,
            groupId: row.group_id,
            codename: row.codename,
            codenameText: resolveRuntimeCodenameText(row.codename),
            dataType: row.data_type,
            value: row.value_json,
            sortOrder: row.sort_order
        }))
    } catch {
        return []
    }
}
