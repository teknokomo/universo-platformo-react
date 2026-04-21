import type { Response } from 'express'
import type { DbExecutor } from '@universo/utils'
import { qSchemaTable } from '@universo/database'
import { generateChildTableName } from '@universo/schema-ddl'
import { IDENTIFIER_REGEX, UUID_REGEX, quoteIdentifier, runtimeCodenameTextSql } from './runtimeHelpers'

const ACTIVE_ROW_SQL = '_upl_deleted = false AND _app_deleted = false'

export interface PublicRuntimeSchemaContext {
    applicationId: string
    schemaName: string
    schemaIdent: string
    manager: DbExecutor
    workspacesEnabled: boolean
    currentWorkspaceId: string | null
}

export const listActivePublicWorkspaceIds = async (executor: DbExecutor, schemaName: string): Promise<string[]> => {
    const workspacesQt = qSchemaTable(schemaName, '_app_workspaces')
    const rows = await executor.query<{ id: string }>(
        `
        SELECT id
        FROM ${workspacesQt}
        WHERE COALESCE(status, 'active') = 'active'
                    AND workspace_type = 'shared'
          AND ${ACTIVE_ROW_SQL}
                ORDER BY _upl_created_at ASC
        `
    )

    return rows.map((row) => row.id).filter((workspaceId) => UUID_REGEX.test(workspaceId))
}

/**
 * When workspaces are enabled, RLS policies on catalog tables require
 * workspace_id to match current_setting('app.current_workspace_id').
 * Public runtime must therefore bind itself to a specific resolved workspace
 * instead of using a global first-workspace fallback.
 */
export const setPublicWorkspaceContext = async (
    executor: DbExecutor,
    schemaName: string,
    workspaceId: string | null
): Promise<boolean> => {
    if (!workspaceId) {
        await executor.query(`SELECT set_config('app.current_workspace_id', $1::text, true)`, [''])
        return true
    }

    const workspacesQt = qSchemaTable(schemaName, '_app_workspaces')
    const rows = await executor.query<{ id: string }>(
        `
        SELECT id
        FROM ${workspacesQt}
        WHERE id = $1
          AND COALESCE(status, 'active') = 'active'
          AND ${ACTIVE_ROW_SQL}
        LIMIT 1
        `,
        [workspaceId]
    )

    if (!rows[0]?.id) {
        return false
    }

    await executor.query(`SELECT set_config('app.current_workspace_id', $1::text, true)`, [workspaceId])
    return true
}

export interface ResolvePublicRuntimeSchemaOptions {
    workspaceId?: string | null
    requireResolvedWorkspace?: boolean
}

export interface PublicRuntimeObjectAttribute {
    id: string
    codename: unknown
    column_name: string
    data_type: string
    parent_attribute_id: string | null
    target_object_id?: string | null
    target_object_kind?: string | null
}

export interface PublicRuntimeObjectBinding {
    id: string
    codename: unknown
    kind: string
    tableName: string
    attrs: PublicRuntimeObjectAttribute[]
}

export const resolvePublicRuntimeSchema = async (
    getDbExecutor: () => DbExecutor,
    applicationId: string,
    res?: Response,
    options: ResolvePublicRuntimeSchemaOptions = {}
): Promise<PublicRuntimeSchemaContext | null> => {
    if (!UUID_REGEX.test(applicationId)) {
        res?.status(400).json({ error: 'Invalid application ID format' })
        return null
    }

    const executor = getDbExecutor()
    const rows = await executor.query<{
        id: string
        schemaName: string | null
        isPublic: boolean
        workspacesEnabled: boolean
    }>(
        `
        SELECT id, schema_name AS "schemaName", is_public AS "isPublic",
               workspaces_enabled AS "workspacesEnabled"
        FROM applications.cat_applications
        WHERE id = $1
          AND ${ACTIVE_ROW_SQL}
        LIMIT 1
        `,
        [applicationId]
    )

    const application = rows[0]
    if (!application) {
        res?.status(404).json({ error: 'Application not found' })
        return null
    }
    if (application.isPublic !== true) {
        res?.status(403).json({ error: 'Application does not allow public runtime access' })
        return null
    }
    if (!application.schemaName || !IDENTIFIER_REGEX.test(application.schemaName)) {
        res?.status(400).json({ error: 'Application schema is not configured' })
        return null
    }

    let currentWorkspaceId: string | null = null
    if (application.workspacesEnabled) {
        if (typeof options.workspaceId === 'string' && options.workspaceId.length > 0) {
            const hasWorkspace = await setPublicWorkspaceContext(executor, application.schemaName, options.workspaceId)
            if (!hasWorkspace) {
                res?.status(403).json({ error: 'Resolved public workspace is not available' })
                return null
            }
            currentWorkspaceId = options.workspaceId
        } else if (options.requireResolvedWorkspace) {
            res?.status(403).json({ error: 'No public workspace has been resolved for this request' })
            return null
        } else {
            await setPublicWorkspaceContext(executor, application.schemaName, null)
        }
    } else {
        await setPublicWorkspaceContext(executor, application.schemaName, null)
    }

    return {
        applicationId,
        schemaName: application.schemaName,
        schemaIdent: quoteIdentifier(application.schemaName),
        manager: executor,
        workspacesEnabled: application.workspacesEnabled,
        currentWorkspaceId
    }
}

export const resolvePublicRuntimeObject = async (
    executor: DbExecutor,
    schemaName: string,
    objectCodename: string
): Promise<PublicRuntimeObjectBinding | null> => {
    const objectsQt = qSchemaTable(schemaName, '_app_objects')
    const attrsQt = qSchemaTable(schemaName, '_app_attributes')

    const objectRows = await executor.query<{
        id: string
        codename: unknown
        kind: string
        table_name: string
    }>(
        `
        SELECT id, codename, kind, table_name
        FROM ${objectsQt}
        WHERE ${runtimeCodenameTextSql('codename')} = $1
          AND ${ACTIVE_ROW_SQL}
        LIMIT 1
        `,
        [objectCodename]
    )

    const object = objectRows[0]
    if (!object || !IDENTIFIER_REGEX.test(object.table_name)) {
        return null
    }

    const attrs = await executor.query<PublicRuntimeObjectAttribute>(
        `
        SELECT id, codename, column_name, data_type, parent_attribute_id, target_object_id, target_object_kind
        FROM ${attrsQt}
        WHERE object_id = $1
          AND ${ACTIVE_ROW_SQL}
        ORDER BY parent_attribute_id ASC NULLS FIRST, id ASC
        `,
        [object.id]
    )

    return {
        id: object.id,
        codename: object.codename,
        kind: object.kind,
        tableName: object.table_name,
        attrs
    }
}

export const resolveTopLevelAttributes = (binding: PublicRuntimeObjectBinding): PublicRuntimeObjectAttribute[] =>
    binding.attrs.filter((attr) => attr.parent_attribute_id === null)

export const resolveChildAttributes = (binding: PublicRuntimeObjectBinding, parentAttributeId: string): PublicRuntimeObjectAttribute[] =>
    binding.attrs.filter((attr) => attr.parent_attribute_id === parentAttributeId)

export const loadPublicRuntimeRecord = async (
    executor: DbExecutor,
    schemaName: string,
    binding: PublicRuntimeObjectBinding,
    recordId: string
): Promise<Record<string, unknown> | null> => {
    if (!UUID_REGEX.test(recordId)) {
        return null
    }

    const tableQt = qSchemaTable(schemaName, binding.tableName)
    const topLevelAttrs = resolveTopLevelAttributes(binding)
    const selectColumns = [
        'id',
        ...topLevelAttrs
            .filter((attr) => attr.data_type !== 'TABLE' && IDENTIFIER_REGEX.test(attr.column_name))
            .map((attr) => quoteIdentifier(attr.column_name))
    ]

    const rows = await executor.query<Record<string, unknown>>(
        `
        SELECT ${selectColumns.join(', ')}
        FROM ${tableQt}
        WHERE id = $1
          AND ${ACTIVE_ROW_SQL}
        LIMIT 1
        `,
        [recordId]
    )

    return rows[0] ?? null
}

export const loadPublicTableRows = async (
    executor: DbExecutor,
    schemaName: string,
    tableAttribute: PublicRuntimeObjectAttribute,
    childAttributes: PublicRuntimeObjectAttribute[],
    parentRecordId: string
): Promise<Array<Record<string, unknown>>> => {
    const tableName =
        typeof tableAttribute.column_name === 'string' && IDENTIFIER_REGEX.test(tableAttribute.column_name)
            ? tableAttribute.column_name
            : generateChildTableName(tableAttribute.id)

    if (!IDENTIFIER_REGEX.test(tableName) || !UUID_REGEX.test(parentRecordId)) {
        return []
    }

    const tableQt = qSchemaTable(schemaName, tableName)
    const selectColumns = [
        'id',
        ...childAttributes.filter((attr) => IDENTIFIER_REGEX.test(attr.column_name)).map((attr) => quoteIdentifier(attr.column_name))
    ]

    return executor.query<Record<string, unknown>>(
        `
        SELECT ${selectColumns.join(', ')}
        FROM ${tableQt}
        WHERE _tp_parent_id = $1
          AND ${ACTIVE_ROW_SQL}
        ORDER BY COALESCE("_tp_sort_order", 0) ASC, id ASC
        `,
        [parentRecordId]
    )
}
