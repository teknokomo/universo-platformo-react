import type { DbExecutor } from '@universo-react/utils'
import { qColumn, qSchemaTable } from '@universo-react/database'
import { runtimeCodenameTextSql } from '../shared/runtimeHelpers'
import { resolveAccessLinkIntakePolicy, type AccessLinkIntakeFieldMetadata } from './guestAccessLinkIntakePolicy'

type WorkspaceCopyAccessLinkIntakeFieldRow = {
    tableName: string
    codename: string
    columnName: string
    dataType: string
    uiConfig: Record<string, unknown> | null
}

/** Reject malformed resetOnCopy metadata before it can silently change copy behavior. */
export async function assertWorkspaceCopyResetOnCopyMetadata(
    executor: DbExecutor,
    schemaName: string,
    scopedTables: string[]
): Promise<void> {
    if (scopedTables.length === 0) return

    const objectsQt = qSchemaTable(schemaName, '_app_objects')
    const componentsQt = qSchemaTable(schemaName, '_app_components')
    const invalidRows = await executor.query<{ tableName: string; columnName: string | null; valueType: string | null }>(
        `
        SELECT
            object_row.table_name AS "tableName",
            component.column_name AS "columnName",
            jsonb_typeof(component.ui_config->'resetOnCopy') AS "valueType"
        FROM ${componentsQt} component
        INNER JOIN ${objectsQt} object_row ON object_row.id = component.object_id
        WHERE object_row.table_name = ANY($1::text[])
          AND jsonb_exists(component.ui_config, 'resetOnCopy')
          AND jsonb_typeof(component.ui_config->'resetOnCopy') IS DISTINCT FROM 'boolean'
          AND object_row.${qColumn('_upl_deleted')} = false
          AND object_row.${qColumn('_app_deleted')} = false
          AND component.${qColumn('_upl_deleted')} = false
          AND component.${qColumn('_app_deleted')} = false
        LIMIT 1
        `,
        [scopedTables]
    )

    if (invalidRows.length > 0) {
        throw new Error('Invalid resetOnCopy metadata; workspace copy aborted')
    }
}

/** Validate AccessLinks intake both as stored and after applying copy-reset defaults. */
export async function hasValidWorkspaceCopyAccessLinkIntakePolicies(
    executor: DbExecutor,
    schemaName: string,
    workspaceId: string,
    scopedTables: string[],
    resetDefaultsByTable: Map<string, Map<string, string>>
): Promise<boolean> {
    if (scopedTables.length === 0) return true

    const objectsQt = qSchemaTable(schemaName, '_app_objects')
    const componentsQt = qSchemaTable(schemaName, '_app_components')
    const rows = await executor.query<WorkspaceCopyAccessLinkIntakeFieldRow>(
        `
        SELECT
            object_row.table_name AS "tableName",
            ${runtimeCodenameTextSql('component.codename')} AS codename,
            component.column_name AS "columnName",
            component.data_type AS "dataType",
            component.ui_config AS "uiConfig"
        FROM ${componentsQt} component
        INNER JOIN ${objectsQt} object_row ON object_row.id = component.object_id
        WHERE LOWER(${runtimeCodenameTextSql('object_row.codename')}) = 'accesslinks'
          AND object_row.table_name = ANY($1::text[])
          AND object_row.${qColumn('_upl_deleted')} = false
          AND object_row.${qColumn('_app_deleted')} = false
          AND component.${qColumn('_upl_deleted')} = false
          AND component.${qColumn('_app_deleted')} = false
        ORDER BY object_row.table_name ASC, component.sort_order ASC, component.id ASC
        `,
        [scopedTables]
    )

    const fieldsByTable = new Map<string, AccessLinkIntakeFieldMetadata[]>()
    for (const row of rows) {
        const fields = fieldsByTable.get(row.tableName) ?? []
        fields.push({
            codename: row.codename,
            columnName: row.columnName,
            dataType: row.dataType,
            defaultValue: row.uiConfig?.defaultValue
        })
        fieldsByTable.set(row.tableName, fields)
    }

    for (const [tableName, fields] of fieldsByTable) {
        const tableQt = qSchemaTable(schemaName, tableName)
        const sourceRows = await executor.query<Record<string, unknown>>(
            `
            SELECT *
            FROM ${tableQt}
            WHERE ${qColumn('workspace_id')} = $1
              AND ${qColumn('_upl_deleted')} = false
              AND ${qColumn('_app_deleted')} = false
            `,
            [workspaceId]
        )
        for (const row of sourceRows) {
            const copiedRow = { ...row }
            for (const field of fields) {
                const resetDefaultJson = resetDefaultsByTable.get(tableName)?.get(field.columnName)
                if (resetDefaultJson === undefined) continue
                try {
                    copiedRow[field.columnName] = JSON.parse(resetDefaultJson)
                } catch {
                    return false
                }
            }
            const resolution = resolveAccessLinkIntakePolicy({
                objectCodename: 'AccessLinks',
                fields,
                row: copiedRow,
                applyDefaults: false
            })
            if (!resolution.valid) return false
        }
    }

    return true
}
