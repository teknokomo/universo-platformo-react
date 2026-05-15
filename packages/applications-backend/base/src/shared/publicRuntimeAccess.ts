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
    settings: Record<string, unknown>
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
          AND ${ACTIVE_ROW_SQL}
        ORDER BY workspace_type ASC, _upl_created_at ASC, id ASC
        `,
        []
    )

    return rows.map((row) => row.id).filter((workspaceId) => UUID_REGEX.test(workspaceId))
}

/**
 * When workspaces are enabled, RLS policies on object tables require
 * workspace_id to match current_setting('app.current_workspace_id').
 * Public runtime must therefore bind itself to each candidate active workspace
 * while resolving an explicit access-link slug or guest session token.
 */
export const setPublicWorkspaceContext = async (executor: DbExecutor, schemaName: string, workspaceId: string | null): Promise<boolean> => {
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

export interface PublicRuntimeObjectComponent {
    id: string
    codename: unknown
    column_name: string
    data_type: string
    parent_component_id: string | null
    target_object_id?: string | null
    target_object_kind?: string | null
}

export interface PublicRuntimeObjectBinding {
    id: string
    codename: unknown
    kind: string
    tableName: string
    attrs: PublicRuntimeObjectComponent[]
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
        settings?: unknown
    }>(
        `
        SELECT id, schema_name AS "schemaName", is_public AS "isPublic",
               workspaces_enabled AS "workspacesEnabled",
               settings
        FROM applications.obj_applications
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
        settings:
            application.settings && typeof application.settings === 'object' && !Array.isArray(application.settings)
                ? (application.settings as Record<string, unknown>)
                : {},
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
    const attrsQt = qSchemaTable(schemaName, '_app_components')

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

    const attrs = await executor.query<PublicRuntimeObjectComponent>(
        `
        SELECT id, codename, column_name, data_type, parent_component_id, target_object_id, target_object_kind
        FROM ${attrsQt}
        WHERE object_id = $1
          AND ${ACTIVE_ROW_SQL}
        ORDER BY parent_component_id ASC NULLS FIRST, id ASC
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

export const resolveTopLevelComponents = (binding: PublicRuntimeObjectBinding): PublicRuntimeObjectComponent[] =>
    binding.attrs.filter((cmp) => cmp.parent_component_id === null)

export const resolveChildComponents = (binding: PublicRuntimeObjectBinding, parentComponentId: string): PublicRuntimeObjectComponent[] =>
    binding.attrs.filter((cmp) => cmp.parent_component_id === parentComponentId)

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
    const topLevelAttrs = resolveTopLevelComponents(binding)
    const selectColumns = [
        'id',
        ...topLevelAttrs
            .filter((cmp) => cmp.data_type !== 'TABLE' && IDENTIFIER_REGEX.test(cmp.column_name))
            .map((cmp) => quoteIdentifier(cmp.column_name))
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
    tableComponent: PublicRuntimeObjectComponent,
    childComponents: PublicRuntimeObjectComponent[],
    parentRecordId: string
): Promise<Array<Record<string, unknown>>> => {
    const tableName =
        typeof tableComponent.column_name === 'string' && IDENTIFIER_REGEX.test(tableComponent.column_name)
            ? tableComponent.column_name
            : generateChildTableName(tableComponent.id)

    if (!IDENTIFIER_REGEX.test(tableName) || !UUID_REGEX.test(parentRecordId)) {
        return []
    }

    const tableQt = qSchemaTable(schemaName, tableName)
    const selectColumns = [
        'id',
        ...childComponents.filter((cmp) => IDENTIFIER_REGEX.test(cmp.column_name)).map((cmp) => quoteIdentifier(cmp.column_name))
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
