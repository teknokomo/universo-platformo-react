import type { DbExecutor } from '@universo-react/utils'
import { qColumn, qSchemaTable } from '@universo-react/database'
import { generateChildTableName } from '@universo-react/schema-ddl'
import { entityRecordPolicySchema, isWorkspaceSettingAllowed, parseUnifiedSettingValue } from '@universo-react/types'
import { withTransactionSavepoint } from '@universo-react/utils/database'
import { listWorkspaceScopedBusinessTables } from './applicationWorkspaces'
import { assertWorkspaceCopyResetOnCopyMetadata, hasValidWorkspaceCopyAccessLinkIntakePolicies } from './runtimeWorkspaceCopyPolicy'
import {
    assertWorkspaceCopyReferencesResolve,
    clearUnresolvedOptionalWorkspaceCopyReferences,
    loadWorkspaceCopyReferences
} from './runtimeWorkspaceCopyReferences'

const ACTIVE_ROW_SQL = '_upl_deleted = false AND _app_deleted = false'
export type RuntimeWorkspaceCopyInput = {
    schemaName: string
    sourceWorkspaceId: string
    name: unknown
    description: unknown
    userId: string
    applicationSettings?: Record<string, unknown> | null
    actorUserId?: string | null
}

type WorkspaceCreationInput = {
    schemaName: string
    name: unknown
    description: unknown
    userId: string
    actorUserId?: string | null
    seedElements?: boolean
}

export type RuntimeWorkspaceCopyErrorCode =
    | 'WORKSPACE_NOT_FOUND'
    | 'WORKSPACE_COPY_REFERENCE_UNRESOLVED'
    | 'WORKSPACE_COPY_ACCESS_LINK_INTAKE_INVALID'

export type RuntimeWorkspaceCopyDependencies = {
    createWorkspace: (executor: DbExecutor, input: WorkspaceCreationInput) => Promise<{ id: string }>
    createError: (code: RuntimeWorkspaceCopyErrorCode, message: string) => Error
}

type WorkspaceCopyObjectPolicyRow = {
    objectId: string
    tableName: string
    recordPolicyPresent: boolean | null
    recordPolicyJson: string | null
}

type WorkspaceCopyResetMetadataRow = {
    tableName: string
    parentComponentId: string | null
    columnName: string | null
    defaultValue: string | null
}

const WORKSPACE_SETTINGS_TABLE = '_app_workspace_settings'
const SYSTEM_COPY_COLUMN_EXPRESSIONS: Record<string, string> = {
    // A workspace copy is a new authored workspace. Preserve the stable seed
    // key so the next synchronization reconciles the copied row instead of
    // inserting a duplicate, but never carry source ownership across that
    // boundary.
    _seed_source_key: 'source."_seed_source_key"',
    _seed_source_owned: 'false',
    _upl_created_at: 'NOW()',
    _upl_updated_at: 'NOW()',
    _upl_version: '1',
    _upl_created_by: '$3::uuid',
    _upl_updated_by: '$3::uuid',
    _upl_deleted: 'false',
    _upl_deleted_at: 'NULL',
    _upl_deleted_by: 'NULL',
    _upl_purge_after: 'NULL',
    _upl_archived: 'false',
    _upl_archived_at: 'NULL',
    _upl_archived_by: 'NULL',
    _upl_locked: 'false',
    _upl_locked_at: 'NULL',
    _upl_locked_by: 'NULL',
    _upl_locked_reason: 'NULL',
    _app_deleted: 'false',
    _app_deleted_at: 'NULL',
    _app_deleted_by: 'NULL',
    _app_published: 'true',
    _app_published_at: 'NULL',
    _app_published_by: 'NULL',
    _app_archived: 'false',
    _app_archived_at: 'NULL',
    _app_archived_by: 'NULL',
    _app_record_number: 'NULL',
    _app_record_date: 'NULL',
    _app_record_state: "'draft'",
    _app_posted_at: 'NULL',
    _app_posted_by: 'NULL',
    _app_posting_batch_id: 'NULL',
    _app_posting_movements: 'NULL',
    _app_voided_at: 'NULL',
    _app_voided_by: 'NULL',
    _app_owner_id: '$3::uuid',
    _app_access_level: "'private'"
}
const SYSTEM_COPY_COLUMNS = new Set(Object.keys(SYSTEM_COPY_COLUMN_EXPRESSIONS))

async function lockWorkspaceForCopy(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
    },
    createError: RuntimeWorkspaceCopyDependencies['createError']
): Promise<void> {
    const workspacesQt = qSchemaTable(input.schemaName, '_app_workspaces')
    const rows = await executor.query<{ id: string }>(
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

    if (!rows[0]) {
        throw createError('WORKSPACE_NOT_FOUND', 'Workspace not found')
    }
}

/** Remove explicitly excluded objects and their TABLE child tables from a copy's data scope. */
async function excludeWorkspaceCopyTables(executor: DbExecutor, schemaName: string, scopedTables: string[]): Promise<string[]> {
    if (scopedTables.length === 0) {
        return []
    }

    const objectsQt = qSchemaTable(schemaName, '_app_objects')
    const componentsQt = qSchemaTable(schemaName, '_app_components')
    const objectPolicies = await executor.query<WorkspaceCopyObjectPolicyRow>(
        `
        SELECT
            object_row.id AS "objectId",
            object_row.table_name AS "tableName",
            jsonb_exists(object_row.config, 'recordPolicy') AS "recordPolicyPresent",
            (object_row.config->'recordPolicy')::text AS "recordPolicyJson"
        FROM ${objectsQt} object_row
        WHERE object_row.table_name = ANY($1::text[])
          AND object_row.${qColumn('_upl_deleted')} = false
          AND object_row.${qColumn('_app_deleted')} = false
        `,
        [scopedTables]
    )
    const excludedObjects = [] as WorkspaceCopyObjectPolicyRow[]
    for (const objectPolicy of objectPolicies) {
        if (!objectPolicy.recordPolicyPresent) {
            continue
        }

        let rawPolicy: unknown
        try {
            rawPolicy = JSON.parse(objectPolicy.recordPolicyJson ?? 'null')
        } catch {
            throw new Error('Invalid EntityRecordPolicy metadata; workspace copy aborted')
        }
        const policy = entityRecordPolicySchema.safeParse(rawPolicy)
        if (!policy.success) {
            throw new Error('Invalid EntityRecordPolicy metadata; workspace copy aborted')
        }
        if (policy.data.workspaceCopy === 'exclude') {
            excludedObjects.push(objectPolicy)
        }
    }

    if (excludedObjects.length === 0) {
        return scopedTables
    }

    const excludedObjectIds = excludedObjects.map((object) => object.objectId)
    const tableComponents = await executor.query<{ componentId: string }>(
        `
        SELECT component.id AS "componentId"
        FROM ${componentsQt} component
        WHERE component.object_id = ANY($1::uuid[])
          AND component.parent_component_id IS NULL
          AND component.data_type = 'TABLE'
          AND component.${qColumn('_upl_deleted')} = false
          AND component.${qColumn('_app_deleted')} = false
        `,
        [excludedObjectIds]
    )

    const excludedTableNames = new Set(excludedObjects.map((object) => object.tableName))
    for (const component of tableComponents) {
        excludedTableNames.add(generateChildTableName(component.componentId))
    }

    return scopedTables.filter((tableName) => !excludedTableNames.has(tableName))
}

/** Resolve resetOnCopy defaults for physical parent and TABLE child columns. */
async function loadWorkspaceCopyResetDefaults(
    executor: DbExecutor,
    schemaName: string,
    scopedTables: string[]
): Promise<Map<string, Map<string, string>>> {
    if (scopedTables.length === 0) {
        return new Map()
    }

    await assertWorkspaceCopyResetOnCopyMetadata(executor, schemaName, scopedTables)

    const objectsQt = qSchemaTable(schemaName, '_app_objects')
    const componentsQt = qSchemaTable(schemaName, '_app_components')
    const metadataRows = await executor.query<WorkspaceCopyResetMetadataRow>(
        `
        SELECT
            object_row.table_name AS "tableName",
            component.parent_component_id AS "parentComponentId",
            component.column_name AS "columnName",
            (component.ui_config->'defaultValue')::text AS "defaultValue"
        FROM ${componentsQt} component
        INNER JOIN ${objectsQt} object_row ON object_row.id = component.object_id
        WHERE object_row.table_name = ANY($1::text[])
          AND object_row.${qColumn('_upl_deleted')} = false
          AND object_row.${qColumn('_app_deleted')} = false
          AND component.${qColumn('_upl_deleted')} = false
          AND component.${qColumn('_app_deleted')} = false
          AND component.ui_config->'resetOnCopy' = 'true'::jsonb
        ORDER BY object_row.table_name ASC, component.parent_component_id ASC NULLS FIRST, component.column_name ASC, component.id ASC
        `,
        [scopedTables]
    )

    const defaultsByTable = new Map<string, Map<string, string>>()
    for (const row of metadataRows) {
        const tableName = row.parentComponentId ? generateChildTableName(row.parentComponentId) : row.tableName
        if (!row.columnName || !scopedTables.includes(tableName)) {
            continue
        }

        let defaultsByColumn = defaultsByTable.get(tableName)
        if (!defaultsByColumn) {
            defaultsByColumn = new Map<string, string>()
            defaultsByTable.set(tableName, defaultsByColumn)
        }
        // Keep PostgreSQL's exact JSONB text representation so large integers
        // and high-precision decimals never pass through JavaScript numbers.
        // Missing defaults intentionally become JSON null, then SQL NULL in
        // the copied physical column via jsonb_populate_record.
        defaultsByColumn.set(row.columnName, row.defaultValue ?? 'null')
    }

    return defaultsByTable
}

/** Execute the copy under a savepoint while delegating workspace creation and public error construction. */
export async function copyWorkspaceOperation(
    executor: DbExecutor,
    input: RuntimeWorkspaceCopyInput,
    dependencies: RuntimeWorkspaceCopyDependencies
): Promise<{ id: string }> {
    return withTransactionSavepoint(executor, async (tx) => {
        // Workspace deletion takes this same row lock before archiving its
        // scoped data. Holding it for the full copy transaction prevents a
        // concurrent delete from producing a successful partial copy.
        await lockWorkspaceForCopy(
            tx,
            {
                schemaName: input.schemaName,
                workspaceId: input.sourceWorkspaceId
            },
            dependencies.createError
        )
        const discoveredTables = await listWorkspaceScopedBusinessTables(tx, input.schemaName)
        const scopedTables = await excludeWorkspaceCopyTables(tx, input.schemaName, discoveredTables)
        const resetDefaultsByTable = await loadWorkspaceCopyResetDefaults(tx, input.schemaName, scopedTables)
        const accessLinkIntakeIsValid = await hasValidWorkspaceCopyAccessLinkIntakePolicies(
            tx,
            input.schemaName,
            input.sourceWorkspaceId,
            scopedTables,
            resetDefaultsByTable
        )
        if (!accessLinkIntakeIsValid) {
            throw dependencies.createError(
                'WORKSPACE_COPY_ACCESS_LINK_INTAKE_INVALID',
                'Workspace copy contains an invalid guest intake configuration'
            )
        }

        // Copying is owner-authorized workspace management, not a runtime row
        // mutation. Preserve protected seed Entities and their records in the
        // destination while ordinary runtime writes remain policy-gated.
        await tx.query(
            'CREATE TEMP TABLE workspace_copy_id_map (old_id UUID PRIMARY KEY, new_id UUID NOT NULL, source_table_name TEXT NOT NULL) ON COMMIT DROP'
        )
        for (const tableName of scopedTables) {
            const tableIdent = qSchemaTable(input.schemaName, tableName)
            await tx.query(
                `
                INSERT INTO workspace_copy_id_map (old_id, new_id, source_table_name)
                SELECT id, public.uuid_generate_v7(), $2::text
                FROM ${tableIdent}
                WHERE ${qColumn('workspace_id')} = $1
                  AND ${ACTIVE_ROW_SQL}
                ON CONFLICT (old_id) DO NOTHING
            `,
                [input.sourceWorkspaceId, tableName]
            )
        }

        const workspaceCopyReferences = await loadWorkspaceCopyReferences(tx, input.schemaName, scopedTables)
        await assertWorkspaceCopyReferencesResolve(
            tx,
            input.schemaName,
            input.sourceWorkspaceId,
            workspaceCopyReferences,
            dependencies.createError
        )
        const resetReferenceTargetTables = new Map(
            workspaceCopyReferences.flatMap(
                (reference): Array<[string, string]> =>
                    reference.isResetOnCopy && reference.targetTableName
                        ? [[`${reference.tableName}.${reference.columnName}`, reference.targetTableName]]
                        : []
            )
        )

        // Validate all required workspace-local references before creating the
        // target workspace. A failed copy therefore leaves no partially-created
        // workspace or membership row even when the caller retries.
        const created = await dependencies.createWorkspace(tx, {
            schemaName: input.schemaName,
            name: input.name,
            description: input.description,
            userId: input.userId,
            actorUserId: input.actorUserId,
            seedElements: false
        })

        for (const tableName of scopedTables) {
            const tableIdent = qSchemaTable(input.schemaName, tableName)
            const columns = await tx.query<{ column_name: string }>(
                `
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = $1
                  AND table_name = $2
                  AND column_name NOT IN ('id', 'workspace_id')
                ORDER BY ordinal_position ASC
            `,
                [input.schemaName, tableName]
            )
            const userColumnNames = columns.map((column) => column.column_name).filter((column) => !SYSTEM_COPY_COLUMNS.has(column))
            const systemColumnNames = columns.map((column) => column.column_name).filter((column) => SYSTEM_COPY_COLUMNS.has(column))
            const insertColumnNames = [...userColumnNames, ...systemColumnNames]
            const quotedColumns = insertColumnNames.map((column) => qColumn(column))
            const queryParameters: unknown[] = [input.sourceWorkspaceId, created.id]
            if (systemColumnNames.some((columnName) => SYSTEM_COPY_COLUMN_EXPRESSIONS[columnName].includes('$3'))) {
                queryParameters.push(input.actorUserId ?? null)
            }
            const resetDefaults = resetDefaultsByTable.get(tableName)
            const selectExpressions = [
                ...userColumnNames.map((column) => {
                    const defaultValueJson = resetDefaults?.get(column)
                    if (defaultValueJson === undefined) {
                        return `source.${qColumn(column)}`
                    }

                    const columnNameParameter = queryParameters.push(column)
                    const defaultValueParameter = queryParameters.push(defaultValueJson)
                    const resetReferenceTargetTable = resetReferenceTargetTables.get(`${tableName}.${column}`)
                    const resetReferenceTargetTableParameter = resetReferenceTargetTable
                        ? queryParameters.push(resetReferenceTargetTable)
                        : undefined
                    const defaultValueExpression = resetReferenceTargetTableParameter
                        ? `COALESCE(
                            (
                                SELECT to_jsonb(id_map.new_id::text)
                                FROM workspace_copy_id_map id_map
                                WHERE jsonb_typeof($${defaultValueParameter}::jsonb) = 'string'
                                  AND LOWER(id_map.old_id::text) = LOWER($${defaultValueParameter}::jsonb #>> '{}')
                                  AND id_map.source_table_name = $${resetReferenceTargetTableParameter}
                            ),
                            $${defaultValueParameter}::jsonb
                        )`
                        : `$${defaultValueParameter}::jsonb`
                    return `(jsonb_populate_record(NULL::${tableIdent}, jsonb_build_object($${columnNameParameter}::text, ${defaultValueExpression}))).${qColumn(
                        column
                    )}`
                }),
                ...systemColumnNames.map((column) => SYSTEM_COPY_COLUMN_EXPRESSIONS[column])
            ]
            // Keep ordinary copied-row UUID references during insertion.
            // Existing source rows satisfy non-deferrable FKs even when a
            // referenced table is copied later; reset REF defaults are already
            // mapped above, and ordinary references are remapped after every
            // table is present in the target workspace.
            await tx.query(
                `
                INSERT INTO ${tableIdent} (id, ${qColumn('workspace_id')}${quotedColumns.length > 0 ? `, ${quotedColumns.join(', ')}` : ''})
                SELECT id_map.new_id, $2::uuid${selectExpressions.length > 0 ? `, ${selectExpressions.join(', ')}` : ''}
                FROM ${tableIdent} source
                INNER JOIN workspace_copy_id_map id_map ON id_map.old_id = source.id
                WHERE source.${qColumn('workspace_id')} = $1
                  AND source.${qColumn('_upl_deleted')} = false
                  AND source.${qColumn('_app_deleted')} = false
            `,
                queryParameters
            )
        }

        for (const tableName of scopedTables) {
            const tableIdent = qSchemaTable(input.schemaName, tableName)
            const uuidColumns = await tx.query<{ column_name: string }>(
                `
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = $1
                  AND table_name = $2
                  AND udt_name = 'uuid'
                  AND column_name NOT IN (
                      'id',
                      'workspace_id',
                      '_upl_created_by',
                      '_upl_updated_by',
                      '_upl_deleted_by',
                      '_app_deleted_by',
                      '_app_owner_id'
                  )
                ORDER BY ordinal_position ASC
            `,
                [input.schemaName, tableName]
            )

            const resetColumns = resetDefaultsByTable.get(tableName)
            for (const column of uuidColumns.filter(({ column_name }) => !resetColumns?.has(column_name))) {
                const columnName = qColumn(column.column_name)
                await tx.query(
                    `
                    UPDATE ${tableIdent} target
                    SET ${columnName} = id_map.new_id
                    FROM workspace_copy_id_map id_map
                    WHERE target.${qColumn('workspace_id')} = $1
                      AND target.${columnName} = id_map.old_id
                      AND target.${qColumn('_upl_deleted')} = false
                      AND target.${qColumn('_app_deleted')} = false
                `,
                    [created.id]
                )
            }
        }

        await clearUnresolvedOptionalWorkspaceCopyReferences(tx, input.schemaName, created.id, workspaceCopyReferences)
        await assertWorkspaceCopyReferencesResolve(tx, input.schemaName, created.id, workspaceCopyReferences, dependencies.createError, {
            acceptMappedIds: true
        })

        await copyAllowedWorkspaceSettings(tx, {
            schemaName: input.schemaName,
            sourceWorkspaceId: input.sourceWorkspaceId,
            targetWorkspaceId: created.id,
            applicationSettings: input.applicationSettings,
            actorUserId: input.actorUserId
        })

        return created
    })
}

async function copyAllowedWorkspaceSettings(
    executor: DbExecutor,
    input: {
        schemaName: string
        sourceWorkspaceId: string
        targetWorkspaceId: string
        applicationSettings?: Record<string, unknown> | null
        actorUserId?: string | null
    }
): Promise<void> {
    const workspaceSettingsQt = qSchemaTable(input.schemaName, WORKSPACE_SETTINGS_TABLE)
    const sourceRows = await executor.query<{ key: string; value: unknown }>(
        `
        SELECT key, value
        FROM ${workspaceSettingsQt}
        WHERE workspace_id = $1
          AND ${ACTIVE_ROW_SQL}
        ORDER BY key ASC
        `,
        [input.sourceWorkspaceId]
    )

    for (const row of sourceRows) {
        if (!isWorkspaceSettingAllowed(input.applicationSettings ?? {}, row.key)) {
            continue
        }

        let normalizedValue: unknown
        try {
            normalizedValue = parseUnifiedSettingValue(row.key, row.value)
        } catch {
            continue
        }

        const [{ id }] = await executor.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
        await executor.query(
            `
            INSERT INTO ${workspaceSettingsQt} (
                id,
                workspace_id,
                key,
                value,
                ${qColumn('_upl_created_at')},
                ${qColumn('_upl_created_by')},
                ${qColumn('_upl_updated_at')},
                ${qColumn('_upl_updated_by')},
                ${qColumn('_upl_version')},
                ${qColumn('_upl_deleted')},
                ${qColumn('_app_deleted')},
                ${qColumn('_upl_locked')}
            )
            VALUES ($1, $2, $3, $4::jsonb, NOW(), $5, NOW(), $6, 1, false, false, false)
            `,
            [
                id,
                input.targetWorkspaceId,
                row.key,
                JSON.stringify(normalizedValue ?? null),
                input.actorUserId ?? null,
                input.actorUserId ?? null
            ]
        )
    }
}
