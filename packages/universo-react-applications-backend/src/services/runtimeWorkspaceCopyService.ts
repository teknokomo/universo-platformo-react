import type { DbExecutor } from '@universo-react/utils'
import { qColumn, qSchemaTable } from '@universo-react/database'
import { generateChildTableName } from '@universo-react/schema-ddl'
import { entityRecordPolicySchema, layoutInstanceKeySchema } from '@universo-react/types'
import { acquireAdvisoryXactLock, withTransactionSavepoint } from '@universo-react/utils/database'
import { acquireWorkspaceCopyLocks, setRuntimeWorkspaceContext } from './runtimeWorkspaceContext'
import { listWorkspaceScopedBusinessTables } from './applicationWorkspaces'
import {
    assertWorkspaceCopyResetOnCopyMetadata,
    listExcludedWorkspaceCopyTableTemplateNames,
    listWorkspaceCopyTemplateMaterialOwnerSources,
    hasValidWorkspaceCopyAccessLinkIntakePolicies,
    hasWorkspaceCopyTemplateMaterialsExcluded,
    remapWorkspaceCopyMaterialInterpretations,
    remapWorkspaceCopyTemplateMaterialOwners,
    type WorkspaceCopyTemplateMaterialOwnerSource
} from './runtimeWorkspaceCopyPolicy'
import { parseWorkspaceSettingValue, type WorkspaceSettingAddress } from './workspaceSettingsService'
import { isWorkspaceSettingAddressAllowed } from '../shared/workspaceSettingsContracts'
import {
    insertWorkspaceSettingsForCopy,
    listActiveEffectiveWorkspaceSettingLayoutWidgetsForCopy,
    listWorkspaceSettingsSnapshotForCopy,
    type WorkspaceSettingCopyLayoutWidget,
    type WorkspaceSettingCopyRecord
} from '../persistence/workspaceSettingsCopyStore'
import {
    assertWorkspaceCopyReferencesResolve,
    clearUnresolvedOptionalWorkspaceCopyReferences,
    loadWorkspaceCopyReferences
} from './runtimeWorkspaceCopyReferences'

const ACTIVE_ROW_SQL = '_upl_deleted = false AND _app_deleted = false'
export type RuntimeWorkspaceCopyInput = {
    schemaName: string
    applicationId: string
    sourceWorkspaceId: string
    name: unknown
    description: unknown
    userId: string
    applicationSettings?: Record<string, unknown> | null
    actorUserId?: string | null
}

type WorkspaceCreationInput = {
    schemaName: string
    applicationId: string
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
    | 'WORKSPACE_COPY_TEMPLATE_MATERIALS_EXCLUDED'

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
    _upl_created_by: '$4::uuid',
    _upl_updated_by: '$4::uuid',
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
    _app_owner_id: '$4::uuid',
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
          AND COALESCE(status, 'active') = 'active'
          AND ${ACTIVE_ROW_SQL}
        LIMIT 1
        FOR SHARE
    `,
        [input.workspaceId]
    )

    if (!rows[0]) {
        throw createError('WORKSPACE_NOT_FOUND', 'Workspace not found')
    }
}

/** Materialize active source rows in one statement snapshot without blocking writers. */
export async function materializeWorkspaceCopySourceSnapshot(
    executor: DbExecutor,
    schemaName: string,
    workspaceId: string,
    tableNames: readonly string[],
    templateMaterialOwnerSources: readonly WorkspaceCopyTemplateMaterialOwnerSource[] = [],
    excludedTableTemplateNames: readonly string[] = []
): Promise<void> {
    const orderedTableNames = [...new Set(tableNames)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    await executor.query(`
        CREATE TEMP TABLE workspace_copy_source_rows (
            source_table_name TEXT NOT NULL,
            workspace_id UUID NOT NULL,
            id UUID NOT NULL,
            row_data JSONB NOT NULL,
            PRIMARY KEY (source_table_name, id)
        ) ON COMMIT DROP
    `)
    await executor.query(`
        CREATE TEMP TABLE workspace_copy_source_settings (
            id UUID PRIMARY KEY,
            workspace_id UUID NOT NULL,
            target_kind TEXT NOT NULL,
            target_owner_id UUID NOT NULL,
            target_key TEXT NOT NULL,
            key TEXT NOT NULL,
            value JSONB NULL
        ) ON COMMIT DROP
    `)
    await executor.query(`
        CREATE TEMP TABLE workspace_copy_template_material_owners (
            workspace_id UUID NOT NULL,
            template_owner_id TEXT NOT NULL,
            material_included BOOLEAN NOT NULL
        ) ON COMMIT DROP
    `)
    await executor.query(`
        CREATE TEMP TABLE workspace_copy_excluded_template_ids (
            workspace_id UUID NOT NULL,
            template_id UUID NOT NULL,
            PRIMARY KEY (workspace_id, template_id)
        ) ON COMMIT DROP
    `)

    const sourceSelects = orderedTableNames.map(
        (tableName, index) => `
            SELECT
                $${index + 2}::text AS source_table_name,
                source.${qColumn('workspace_id')} AS workspace_id,
                source.id,
                to_jsonb(source) AS row_data
            FROM ${qSchemaTable(schemaName, tableName)} source
            WHERE source.${qColumn('workspace_id')} = $1::uuid
              AND source.${qColumn('_upl_deleted')} = false
              AND source.${qColumn('_app_deleted')} = false
        `
    )
    const sourceRowsSql =
        sourceSelects.length > 0
            ? sourceSelects.join('\nUNION ALL\n')
            : `SELECT NULL::text AS source_table_name, NULL::uuid AS workspace_id, NULL::uuid AS id, NULL::jsonb AS row_data WHERE false`
    const ownerSourceSelects = templateMaterialOwnerSources.map(
        ({ tableName, ownerColumnName, materialIncluded }) => `
            SELECT
                source.${qColumn('workspace_id')} AS workspace_id,
                source.${qColumn(ownerColumnName)}::text AS template_owner_id,
                ${materialIncluded ? 'TRUE' : 'FALSE'} AS material_included
            FROM ${qSchemaTable(schemaName, tableName)} source
            WHERE source.${qColumn('workspace_id')} = $1::uuid
              AND source.${qColumn('_upl_deleted')} = false
              AND source.${qColumn('_app_deleted')} = false
              AND source.${qColumn(ownerColumnName)} IS NOT NULL
        `
    )
    const ownerSourceRowsSql =
        ownerSourceSelects.length > 0
            ? ownerSourceSelects.join('\nUNION ALL\n')
            : `SELECT NULL::uuid AS workspace_id, NULL::text AS template_owner_id, false AS material_included WHERE false`
    const excludedTemplateSelects = [...new Set(excludedTableTemplateNames)].map(
        (tableName) => `
            SELECT source.${qColumn('workspace_id')} AS workspace_id, source.id AS template_id
            FROM ${qSchemaTable(schemaName, tableName)} source
            WHERE source.${qColumn('workspace_id')} = $1::uuid
              AND source.${qColumn('_upl_deleted')} = false
              AND source.${qColumn('_app_deleted')} = false
        `
    )
    const excludedTemplateRowsSql =
        excludedTemplateSelects.length > 0
            ? excludedTemplateSelects.join('\nUNION ALL\n')
            : `SELECT NULL::uuid AS workspace_id, NULL::uuid AS template_id WHERE false`
    await executor.query(
        `
        WITH source_rows AS MATERIALIZED (
            ${sourceRowsSql}
        ),
        owner_source_rows AS MATERIALIZED (
            ${ownerSourceRowsSql}
        ),
        excluded_template_rows AS MATERIALIZED (
            ${excludedTemplateRowsSql}
        ),
        business_snapshot AS (
            INSERT INTO workspace_copy_source_rows (source_table_name, workspace_id, id, row_data)
            SELECT source_table_name, workspace_id, id, row_data
            FROM source_rows
            ORDER BY source_table_name ASC, id ASC
            RETURNING 1
        ),
        settings_snapshot AS (
            INSERT INTO workspace_copy_source_settings (
                id,
                workspace_id,
                target_kind,
                target_owner_id,
                target_key,
                key,
                value
            )
            SELECT
                setting.id,
                setting.workspace_id,
                setting.target_kind,
                setting.target_owner_id,
                setting.target_key,
                setting.key,
                setting.value
            FROM ${qSchemaTable(schemaName, '_app_workspace_settings')} setting
            WHERE setting.workspace_id = $1::uuid
              AND setting.${qColumn('_upl_deleted')} = false
              AND setting.${qColumn('_app_deleted')} = false
              AND (SELECT COUNT(*) FROM business_snapshot) >= 0
            ORDER BY setting.target_kind ASC, setting.target_owner_id ASC, setting.target_key ASC, setting.key ASC
            RETURNING 1
        ),
        template_owner_snapshot AS (
            INSERT INTO workspace_copy_template_material_owners (workspace_id, template_owner_id, material_included)
            SELECT workspace_id, template_owner_id, material_included
            FROM owner_source_rows
            WHERE (SELECT COUNT(*) FROM business_snapshot) >= 0
            ORDER BY workspace_id ASC, template_owner_id ASC, material_included ASC
            RETURNING 1
        ),
        excluded_template_snapshot AS (
            INSERT INTO workspace_copy_excluded_template_ids (workspace_id, template_id)
            SELECT workspace_id, template_id
            FROM excluded_template_rows
            WHERE (SELECT COUNT(*) FROM business_snapshot) >= 0
            ORDER BY workspace_id ASC, template_id ASC
            RETURNING 1
        )
        SELECT
            (SELECT COUNT(*) FROM business_snapshot) AS business_row_count,
            (SELECT COUNT(*) FROM settings_snapshot) AS settings_row_count,
            (SELECT COUNT(*) FROM template_owner_snapshot) AS template_owner_count,
            (SELECT COUNT(*) FROM excluded_template_snapshot) AS excluded_template_count
    `,
        [workspaceId, ...orderedTableNames]
    )
}

/** Resolve each TABLE child relation to its physical parent table. */
async function loadWorkspaceCopyTabularParentTables(
    executor: DbExecutor,
    schemaName: string,
    scopedTables: readonly string[]
): Promise<Map<string, string>> {
    if (scopedTables.length === 0) return new Map()

    const rows = await executor.query<{ componentId: string; parentTableName: string }>(
        `
        SELECT
            component.id AS "componentId",
            object_row.table_name AS "parentTableName"
        FROM ${qSchemaTable(schemaName, '_app_components')} component
        INNER JOIN ${qSchemaTable(schemaName, '_app_objects')} object_row
            ON object_row.id = component.object_id
        WHERE component.parent_component_id IS NULL
          AND component.data_type = 'TABLE'
          AND component.${qColumn('_upl_deleted')} = false
          AND component.${qColumn('_app_deleted')} = false
          AND object_row.${qColumn('_upl_deleted')} = false
          AND object_row.${qColumn('_app_deleted')} = false
          AND object_row.table_name = ANY($1::text[])
        ORDER BY object_row.table_name ASC, component.id ASC
        `,
        [scopedTables]
    )

    const scopedTableSet = new Set(scopedTables)
    const parentTablesByChildTable = new Map<string, string>()
    for (const row of rows) {
        const childTableName = generateChildTableName(row.componentId)
        if (scopedTableSet.has(childTableName)) {
            parentTablesByChildTable.set(childTableName, row.parentTableName)
        }
    }

    return parentTablesByChildTable
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
        // Match SchemaMigrator's schema → baseline order. Taking the baseline
        // first here can deadlock with a schema sync holding the schema lock
        // while waiting to enroll shared-workspace members.
        await acquireWorkspaceCopyLocks(tx, input.schemaName, input.applicationId)

        // Serialize the actor's default-workspace changes before taking any
        // source row lock. Personal workspace archival uses this same key and
        // then locks rows, so acquiring it first avoids an inversion.
        await acquireAdvisoryXactLock(tx, `personal-workspace:${input.schemaName}:${input.userId}`)

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
        await setRuntimeWorkspaceContext(tx, input.sourceWorkspaceId)
        const discoveredTables = await listWorkspaceScopedBusinessTables(tx, input.schemaName)
        const scopedTables = await excludeWorkspaceCopyTables(tx, input.schemaName, discoveredTables)
        const parentTablesByChildTable = await loadWorkspaceCopyTabularParentTables(tx, input.schemaName, scopedTables)
        const copyTableOrder = [
            ...scopedTables.filter((tableName) => !parentTablesByChildTable.has(tableName)),
            ...scopedTables.filter((tableName) => parentTablesByChildTable.has(tableName))
        ]
        // One statement captures every source table and workspace setting at
        // the same READ COMMITTED snapshot. The temporary copy leaves ordinary
        // concurrent workspace writers unblocked.
        const templateMaterialOwnerSources = await listWorkspaceCopyTemplateMaterialOwnerSources(
            tx,
            input.schemaName,
            discoveredTables,
            scopedTables
        )
        const excludedTableTemplateNames = await listExcludedWorkspaceCopyTableTemplateNames(
            tx,
            input.schemaName,
            discoveredTables,
            scopedTables
        )
        await materializeWorkspaceCopySourceSnapshot(
            tx,
            input.schemaName,
            input.sourceWorkspaceId,
            scopedTables,
            templateMaterialOwnerSources,
            excludedTableTemplateNames
        )
        const templateMaterialsExcluded = await hasWorkspaceCopyTemplateMaterialsExcluded(
            tx,
            input.schemaName,
            input.sourceWorkspaceId,
            discoveredTables,
            scopedTables
        )
        if (templateMaterialsExcluded) {
            throw dependencies.createError(
                'WORKSPACE_COPY_TEMPLATE_MATERIALS_EXCLUDED',
                'Workspace copy cannot preserve TableTemplate Material relationships across excluded records'
            )
        }
        const resetDefaultsByTable = await loadWorkspaceCopyResetDefaults(tx, input.schemaName, scopedTables)
        const accessLinkIntakeIsValid = await hasValidWorkspaceCopyAccessLinkIntakePolicies(
            tx,
            input.schemaName,
            input.sourceWorkspaceId,
            scopedTables,
            resetDefaultsByTable,
            { sourceSnapshot: true }
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
            `CREATE TEMP TABLE workspace_copy_id_map (
                source_table_name TEXT NOT NULL,
                old_id UUID NOT NULL,
                new_id UUID NOT NULL UNIQUE,
                PRIMARY KEY (source_table_name, old_id)
            ) ON COMMIT DROP`
        )
        await tx.query(`
            INSERT INTO workspace_copy_id_map (source_table_name, old_id, new_id)
            SELECT source_table_name, id, public.uuid_generate_v7()
            FROM workspace_copy_source_rows
            ORDER BY source_table_name ASC, id ASC
        `)

        const workspaceCopyReferences = await loadWorkspaceCopyReferences(tx, input.schemaName, scopedTables, parentTablesByChildTable)
        await assertWorkspaceCopyReferencesResolve(
            tx,
            input.schemaName,
            input.sourceWorkspaceId,
            workspaceCopyReferences,
            dependencies.createError,
            { sourceSnapshot: true }
        )
        const resetReferenceTargetTables = new Map(
            workspaceCopyReferences.flatMap(
                (reference): Array<[string, string]> =>
                    reference.isResetOnCopy && reference.isWorkspaceLocal !== false && reference.targetTableName
                        ? [[`${reference.tableName}.${reference.columnName}`, reference.targetTableName]]
                        : []
            )
        )

        // Validate all required workspace-local references before creating the
        // target workspace. A failed copy therefore leaves no partially-created
        // workspace or membership row even when the caller retries.
        const created = await dependencies.createWorkspace(tx, {
            schemaName: input.schemaName,
            applicationId: input.applicationId,
            name: input.name,
            description: input.description,
            userId: input.userId,
            actorUserId: input.actorUserId,
            seedElements: false
        })
        await setRuntimeWorkspaceContext(tx, created.id)

        for (const tableName of copyTableOrder) {
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
            const queryParameters: unknown[] = [input.sourceWorkspaceId, created.id, tableName]
            if (systemColumnNames.some((columnName) => SYSTEM_COPY_COLUMN_EXPRESSIONS[columnName].includes('$4'))) {
                queryParameters.push(input.actorUserId ?? null)
            }
            const resetDefaults = resetDefaultsByTable.get(tableName)
            const selectExpressions = [
                ...userColumnNames.map((column) => {
                    if (column === '_tp_parent_id') {
                        const parentTableName = parentTablesByChildTable.get(tableName)
                        if (parentTableName) {
                            const parentTableParameter = queryParameters.push(parentTableName)
                            return `(SELECT id_map.new_id
                                FROM workspace_copy_id_map id_map
                                WHERE id_map.old_id = source.${qColumn(column)}
                                  AND id_map.source_table_name = $${parentTableParameter})`
                        }
                    }

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
                        ? `CASE
                            WHEN EXISTS (
                                SELECT 1
                                FROM workspace_copy_id_map id_map
                                WHERE jsonb_typeof($${defaultValueParameter}::jsonb) = 'string'
                                  AND LOWER(id_map.old_id::text) = LOWER($${defaultValueParameter}::jsonb #>> '{}')
                                  AND id_map.source_table_name = $${resetReferenceTargetTableParameter}
                            ) THEN $${defaultValueParameter}::jsonb
                            ELSE 'null'::jsonb
                        END`
                        : `$${defaultValueParameter}::jsonb`
                    return `(jsonb_populate_record(NULL::${tableIdent}, jsonb_build_object($${columnNameParameter}::text, ${defaultValueExpression}))).${qColumn(
                        column
                    )}`
                }),
                ...systemColumnNames.map((column) => SYSTEM_COPY_COLUMN_EXPRESSIONS[column])
            ]
            // Keep source UUID references during insertion so non-deferrable
            // foreign keys remain valid while a target table is copied later.
            // All workspace-local references are remapped after every copied
            // table is present in the destination.
            await tx.query(
                `
                INSERT INTO ${tableIdent} (id, ${qColumn('workspace_id')}${quotedColumns.length > 0 ? `, ${quotedColumns.join(', ')}` : ''})
                SELECT id_map.new_id, $2::uuid${selectExpressions.length > 0 ? `, ${selectExpressions.join(', ')}` : ''}
                FROM workspace_copy_source_rows source_snapshot
                INNER JOIN workspace_copy_id_map id_map
                    ON id_map.old_id = source_snapshot.id
                   AND id_map.source_table_name = source_snapshot.source_table_name
                CROSS JOIN LATERAL jsonb_populate_record(NULL::${tableIdent}, source_snapshot.row_data) AS source
                WHERE source_snapshot.source_table_name = $3
                  AND source_snapshot.workspace_id = $1::uuid
            `,
                queryParameters
            )
        }

        await remapWorkspaceCopyTemplateMaterialOwners(tx, input.schemaName, created.id)
        await remapWorkspaceCopyMaterialInterpretations(tx, input.schemaName, created.id, dependencies.createError)

        await tx.query('DROP TABLE workspace_copy_source_rows')

        const workspaceCopyReferencesByColumn = new Map(
            workspaceCopyReferences.map((reference) => [`${reference.tableName}.${reference.columnName}`, reference])
        )
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
            for (const column of uuidColumns.filter(({ column_name }) => {
                const isResetReference = resetReferenceTargetTables.has(`${tableName}.${column_name}`)
                return column_name !== '_tp_parent_id' && (!resetColumns?.has(column_name) || isResetReference)
            })) {
                const columnName = qColumn(column.column_name)
                const reference = workspaceCopyReferencesByColumn.get(`${tableName}.${column.column_name}`)
                if (reference?.isWorkspaceLocal === false) {
                    continue
                }
                const targetTableName = reference?.targetTableName
                if (!targetTableName) {
                    const ambiguousReferenceRows = await tx.query<{ ambiguous: boolean | string }>(
                        `
                        SELECT EXISTS (
                            SELECT 1
                            FROM ${tableIdent} target
                            INNER JOIN workspace_copy_id_map id_map
                                ON id_map.old_id = target.${columnName}
                            WHERE target.${qColumn('workspace_id')} = $1
                              AND target.${qColumn('_upl_deleted')} = false
                              AND target.${qColumn('_app_deleted')} = false
                            GROUP BY target.${qColumn('id')}
                            HAVING COUNT(*) > 1
                        ) AS ambiguous
                    `,
                        [created.id]
                    )
                    const hasAmbiguousReference =
                        ambiguousReferenceRows[0]?.ambiguous === true ||
                        String(ambiguousReferenceRows[0]?.ambiguous).toLowerCase() === 'true'
                    if (hasAmbiguousReference) {
                        throw dependencies.createError(
                            'WORKSPACE_COPY_REFERENCE_UNRESOLVED',
                            'Workspace copy contains an ambiguous UUID reference without target metadata'
                        )
                    }
                }
                const targetTablePredicate = targetTableName
                    ? 'AND id_map.source_table_name = $2'
                    : `AND (
                        SELECT COUNT(*)
                        FROM workspace_copy_id_map candidate
                        WHERE candidate.old_id = target.${columnName}
                    ) = 1`
                await tx.query(
                    `
                    UPDATE ${tableIdent} target
                    SET ${columnName} = id_map.new_id
                    FROM workspace_copy_id_map id_map
                    WHERE target.${qColumn('workspace_id')} = $1
                      AND target.${columnName} = id_map.old_id
                      ${targetTablePredicate}
                      AND target.${qColumn('_upl_deleted')} = false
                      AND target.${qColumn('_app_deleted')} = false
                `,
                    targetTableName ? [created.id, targetTableName] : [created.id]
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
    const sourceRows = await listWorkspaceSettingsSnapshotForCopy(executor, input.sourceWorkspaceId)
    const globalCandidates: Array<{ key: string; value: unknown }> = []
    const widgetCandidates: Array<{
        sourceTargetOwnerId: string
        key: string
        instanceKey: string
        value: unknown
    }> = []

    for (const row of sourceRows) {
        if (row.targetKind === 'global') {
            if (row.targetOwnerId !== input.sourceWorkspaceId || row.targetKey !== '') continue
            const address: WorkspaceSettingAddress = { key: row.key, target: { kind: 'global' } }
            if (!isWorkspaceSettingAddressAllowed(input.applicationSettings ?? {}, address)) continue
            try {
                globalCandidates.push({ key: row.key, value: parseWorkspaceSettingValue(address, row.value) })
            } catch {
                continue
            }
        } else if (row.targetKind === 'widget') {
            const instanceKey = layoutInstanceKeySchema.safeParse(row.targetKey)
            if (!instanceKey.success) continue
            const address: WorkspaceSettingAddress = { key: row.key, target: { kind: 'widget', instanceKey: instanceKey.data } }
            if (!isWorkspaceSettingAddressAllowed(input.applicationSettings ?? {}, address)) continue
            try {
                widgetCandidates.push({
                    sourceTargetOwnerId: row.targetOwnerId,
                    key: row.key,
                    instanceKey: instanceKey.data,
                    value: parseWorkspaceSettingValue(address, row.value)
                })
            } catch {
                continue
            }
        } else {
            continue
        }
    }

    if (globalCandidates.length === 0 && widgetCandidates.length === 0) return

    const settingsToCopy: WorkspaceSettingCopyRecord[] = globalCandidates.map((candidate) => ({
        targetKind: 'global',
        targetOwnerId: input.targetWorkspaceId,
        targetKey: '',
        key: candidate.key,
        value: candidate.value
    }))

    if (widgetCandidates.length > 0) {
        // Workspaces within one application share its active layout records.
        // Resolve that app-level layout snapshot once; a second identical query
        // cannot represent a different target workspace layout.
        const activeLayoutWidgets = await listActiveEffectiveWorkspaceSettingLayoutWidgetsForCopy(executor, {
            schemaName: input.schemaName
        })
        const indexLayoutsByScope = (rows: WorkspaceSettingCopyLayoutWidget[]) => {
            const layoutsById = new Map<string, { layoutId: string; scopeEntityId: string | null; instanceKeys: Set<string> }>()
            for (const row of rows) {
                const layout = layoutsById.get(row.layoutId) ?? {
                    layoutId: row.layoutId,
                    scopeEntityId: row.scopeEntityId,
                    instanceKeys: new Set<string>()
                }
                layout.instanceKeys.add(row.instanceKey)
                layoutsById.set(row.layoutId, layout)
            }

            const layoutsByScope = new Map<
                string | null,
                { layoutId: string; scopeEntityId: string | null; instanceKeys: Set<string> } | null
            >()
            for (const layout of layoutsById.values()) {
                if (layoutsByScope.has(layout.scopeEntityId)) {
                    layoutsByScope.set(layout.scopeEntityId, null)
                } else {
                    layoutsByScope.set(layout.scopeEntityId, layout)
                }
            }
            return { layoutsById, layoutsByScope }
        }

        const activeLayouts = indexLayoutsByScope(activeLayoutWidgets)
        for (const candidate of widgetCandidates) {
            const activeLayout = activeLayouts.layoutsById.get(candidate.sourceTargetOwnerId)
            if (!activeLayout || !activeLayout.instanceKeys.has(candidate.instanceKey)) continue
            if (activeLayouts.layoutsByScope.get(activeLayout.scopeEntityId)?.layoutId !== activeLayout.layoutId) continue
            settingsToCopy.push({
                targetKind: 'widget',
                targetOwnerId: activeLayout.layoutId,
                targetKey: candidate.instanceKey,
                key: candidate.key,
                value: candidate.value
            })
        }
    }

    await insertWorkspaceSettingsForCopy(executor, {
        schemaName: input.schemaName,
        targetWorkspaceId: input.targetWorkspaceId,
        actorUserId: input.actorUserId,
        settings: settingsToCopy
    })
}
