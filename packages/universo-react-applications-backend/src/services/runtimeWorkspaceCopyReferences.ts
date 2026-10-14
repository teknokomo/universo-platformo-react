import type { DbExecutor } from '@universo-react/utils'
import { qColumn, qSchemaTable } from '@universo-react/database'
import { generateChildTableName } from '@universo-react/schema-ddl'

type WorkspaceCopyReferenceErrorFactory = (code: 'WORKSPACE_COPY_REFERENCE_UNRESOLVED', message: string) => Error

type WorkspaceCopyReferenceMetadataRow = {
    sourceTableName: string | null
    parentComponentId: string | null
    columnName: string
    targetTableName: string | null
    isRequired: boolean | string | null
    isResetOnCopy: boolean | string | null
    defaultValueJson: string | null
}

export type WorkspaceCopyReference = {
    tableName: string
    columnName: string
    isRequired: boolean
    targetTableName?: string
    isResetOnCopy?: boolean
    defaultValueJson?: string | null
}

type WorkspaceCopyPhysicalColumnRow = {
    tableName: string
    columnName: string
    udtName: string
    isNullable?: string | null
}

/**
 * Return REF fields whose target is another workspace-scoped runtime table.
 *
 * References to global metadata (for example enumeration values and set
 * constants) are deliberately excluded: those rows are shared by all
 * workspaces and must keep their identity. Runtime REF metadata is used to
 * distinguish those values from row references instead of treating every UUID
 * column as a business relation (user/audit IDs are not business relations).
 */
export async function loadWorkspaceCopyReferences(
    executor: DbExecutor,
    schemaName: string,
    scopedTables: string[]
): Promise<WorkspaceCopyReference[]> {
    if (scopedTables.length === 0) {
        return []
    }

    const objectsQt = qSchemaTable(schemaName, '_app_objects')
    const componentsQt = qSchemaTable(schemaName, '_app_components')
    const metadataRows = await executor.query<WorkspaceCopyReferenceMetadataRow>(
        `
        SELECT
            source_object.table_name AS "sourceTableName",
            component.parent_component_id AS "parentComponentId",
            component.column_name AS "columnName",
            target_object.table_name AS "targetTableName",
            component.is_required AS "isRequired",
            component.ui_config->'resetOnCopy' = 'true'::jsonb AS "isResetOnCopy",
            (component.ui_config->'defaultValue')::text AS "defaultValueJson"
        FROM ${componentsQt} component
        INNER JOIN ${objectsQt} source_object ON source_object.id = component.object_id
        LEFT JOIN ${objectsQt} target_object ON target_object.id = component.target_object_id
        WHERE component.data_type = 'REF'
          AND component.${qColumn('_upl_deleted')} = false
          AND component.${qColumn('_app_deleted')} = false
          AND source_object.${qColumn('_upl_deleted')} = false
          AND source_object.${qColumn('_app_deleted')} = false
          AND source_object.table_name = ANY($1::text[])
        ORDER BY source_object.table_name ASC, component.column_name ASC, component.id ASC
        `,
        [scopedTables]
    )

    const sourceTableNames = Array.from(
        new Set(
            [
                ...scopedTables,
                ...metadataRows.map((row) => (row.parentComponentId ? generateChildTableName(row.parentComponentId) : row.sourceTableName))
            ].filter((tableName): tableName is string => typeof tableName === 'string' && scopedTables.includes(tableName))
        )
    )
    if (sourceTableNames.length === 0) {
        return []
    }

    const targetTableNames = Array.from(
        new Set(
            metadataRows
                .map((row) => row.targetTableName)
                .filter((tableName): tableName is string => typeof tableName === 'string' && tableName.length > 0)
        )
    )
    const physicalTableNames = Array.from(new Set([...sourceTableNames, ...targetTableNames]))

    const physicalColumns = await executor.query<WorkspaceCopyPhysicalColumnRow>(
        `
        SELECT
            table_name AS "tableName",
            column_name AS "columnName",
            udt_name AS "udtName",
            is_nullable AS "isNullable"
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = ANY($2::text[])
        `,
        [schemaName, physicalTableNames]
    )
    const physicalUuidColumns = new Set(
        physicalColumns.filter((column) => column.udtName === 'uuid').map((column) => `${column.tableName}.${column.columnName}`)
    )
    const physicalTablesWithColumns = new Set(physicalColumns.map((column) => column.tableName))
    const workspaceScopedPhysicalTables = new Set(
        physicalColumns.filter((column) => column.columnName === 'workspace_id').map((column) => column.tableName)
    )

    const metadataReferences: WorkspaceCopyReference[] = metadataRows.flatMap((row) => {
        const tableName = row.parentComponentId ? generateChildTableName(row.parentComponentId) : row.sourceTableName
        // A target with a physical workspace_id is workspace-scoped even when
        // its metadata is archived and therefore absent from scopedTables.
        // Such rows are intentionally not copied, so retaining their source ID
        // would leak a stale workspace reference. A target object whose
        // physical table is missing is treated as workspace-local as well: a
        // required reference must fail closed and an optional one is cleared,
        // never preserved as a source-workspace UUID. Existing tables without
        // workspace_id remain shared/external references and keep their identity.
        const targetIsMissingPhysicalTable = !physicalTablesWithColumns.has(row.targetTableName ?? '')
        const targetIsWorkspaceScoped = workspaceScopedPhysicalTables.has(row.targetTableName ?? '') || targetIsMissingPhysicalTable
        if (
            !tableName ||
            !row.targetTableName ||
            !scopedTables.includes(tableName) ||
            !targetIsWorkspaceScoped ||
            !physicalUuidColumns.has(`${tableName}.${row.columnName}`)
        ) {
            return []
        }

        const metadataRequired = row.isRequired === true || ['true', 't', '1'].includes(String(row.isRequired).toLowerCase())
        const isResetOnCopy = row.isResetOnCopy === true || ['true', 't', '1'].includes(String(row.isResetOnCopy).toLowerCase())
        const physicalRequired = physicalColumns.some(
            (column) => column.tableName === tableName && column.columnName === row.columnName && column.isNullable === 'NO'
        )

        return [
            {
                tableName,
                columnName: row.columnName,
                isRequired: metadataRequired || physicalRequired,
                targetTableName: row.targetTableName,
                isResetOnCopy,
                defaultValueJson: isResetOnCopy ? row.defaultValueJson : null
            }
        ]
    })

    // These system-owned links are not represented by REF components. Child
    // rows have a required parent FK; ledger reversal links are nullable. Both
    // need the same copy-map policy so a stale source-workspace ID can never
    // survive a successful copy.
    const systemReferences: WorkspaceCopyReference[] = physicalColumns
        .filter(
            (column) =>
                column.udtName === 'uuid' &&
                ['_tp_parent_id', '_app_reversal_of_fact_id'].includes(column.columnName) &&
                scopedTables.includes(column.tableName)
        )
        .map((column) => ({
            tableName: column.tableName,
            columnName: column.columnName,
            isRequired: column.columnName === '_tp_parent_id'
        }))

    const referencesByColumn = new Map<string, WorkspaceCopyReference>()
    for (const reference of [...metadataReferences, ...systemReferences]) {
        const key = `${reference.tableName}.${reference.columnName}`
        const existing = referencesByColumn.get(key)
        referencesByColumn.set(
            key,
            existing
                ? {
                      ...existing,
                      isRequired: existing.isRequired || reference.isRequired,
                      targetTableName: reference.targetTableName ?? existing.targetTableName,
                      isResetOnCopy: existing.isResetOnCopy || reference.isResetOnCopy,
                      defaultValueJson: reference.isResetOnCopy ? reference.defaultValueJson : existing.defaultValueJson
                  }
                : reference
        )
    }

    return Array.from(referencesByColumn.values())
}

/**
 * Required workspace-local references must resolve to a copied row. Running
 * this check both before and after inserts keeps copy fail-closed if source
 * data changes between the map build and the row insert statements.
 */
export async function assertWorkspaceCopyReferencesResolve(
    executor: DbExecutor,
    schemaName: string,
    workspaceId: string,
    references: WorkspaceCopyReference[],
    createError: WorkspaceCopyReferenceErrorFactory,
    options: { acceptMappedIds?: boolean } = {}
): Promise<void> {
    for (const reference of references) {
        if (!reference.isRequired) {
            continue
        }

        if (reference.isResetOnCopy && !options.acceptMappedIds) {
            const targetTableName = reference.targetTableName
            let defaultValue: unknown
            try {
                defaultValue = JSON.parse(reference.defaultValueJson ?? 'null')
            } catch {
                defaultValue = null
            }
            if (typeof defaultValue !== 'string' || defaultValue.length === 0 || !targetTableName) {
                throw createError(
                    'WORKSPACE_COPY_REFERENCE_UNRESOLVED',
                    'Workspace copy contains a required reference to a row that was not copied'
                )
            }

            const rows = await executor.query<{ unresolvedCount: string | number }>(
                `
                SELECT COUNT(*)::text AS "unresolvedCount"
                FROM (SELECT $1::text AS default_id) configured_default
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM workspace_copy_id_map id_map
                    WHERE LOWER(id_map.old_id::text) = LOWER(configured_default.default_id)
                      AND id_map.source_table_name = $2
                )
                `,
                [defaultValue, targetTableName]
            )
            const unresolvedCount = Number(rows[0]?.unresolvedCount)
            if (!Number.isFinite(unresolvedCount) || unresolvedCount < 0) {
                throw createError('WORKSPACE_COPY_REFERENCE_UNRESOLVED', 'Workspace copy reference validation returned an invalid result')
            }
            if (unresolvedCount > 0) {
                throw createError(
                    'WORKSPACE_COPY_REFERENCE_UNRESOLVED',
                    'Workspace copy contains a required reference to a row that was not copied'
                )
            }
            continue
        }

        const tableIdent = qSchemaTable(schemaName, reference.tableName)
        const columnIdent = qColumn(reference.columnName)
        const mapMatchSql = options.acceptMappedIds
            ? reference.isResetOnCopy
                ? `id_map.new_id = source.${columnIdent} AND id_map.source_table_name = $2`
                : `(id_map.old_id = source.${columnIdent} OR id_map.new_id = source.${columnIdent})`
            : `id_map.old_id = source.${columnIdent}`
        const rows = await executor.query<{ unresolvedCount: string | number }>(
            `
            SELECT COUNT(*)::text AS "unresolvedCount"
            FROM ${tableIdent} source
            WHERE source.${qColumn('workspace_id')} = $1
              AND source.${qColumn('_upl_deleted')} = false
              AND source.${qColumn('_app_deleted')} = false
              AND (
                  source.${columnIdent} IS NULL
                  OR NOT EXISTS (
                      SELECT 1
                      FROM workspace_copy_id_map id_map
                      WHERE ${mapMatchSql}
                  )
              )
            `,
            options.acceptMappedIds && reference.isResetOnCopy ? [workspaceId, reference.targetTableName] : [workspaceId]
        )
        const unresolvedCount = Number(rows[0]?.unresolvedCount)
        if (!Number.isFinite(unresolvedCount) || unresolvedCount < 0) {
            throw createError('WORKSPACE_COPY_REFERENCE_UNRESOLVED', 'Workspace copy reference validation returned an invalid result')
        }
        if (unresolvedCount > 0) {
            throw createError(
                'WORKSPACE_COPY_REFERENCE_UNRESOLVED',
                'Workspace copy contains a required reference to a row that was not copied'
            )
        }
    }
}

/**
 * Optional workspace-local references to rows omitted from the map become
 * NULL. This prevents copied rows from retaining source-workspace IDs while
 * preserving global/external references that are intentionally not copied.
 */
export async function clearUnresolvedOptionalWorkspaceCopyReferences(
    executor: DbExecutor,
    schemaName: string,
    workspaceId: string,
    references: WorkspaceCopyReference[]
): Promise<void> {
    for (const reference of references) {
        if (reference.isRequired) {
            continue
        }

        const tableIdent = qSchemaTable(schemaName, reference.tableName)
        const columnIdent = qColumn(reference.columnName)
        const targetTablePredicate = reference.isResetOnCopy ? 'AND id_map.source_table_name = $2' : ''
        await executor.query(
            `
            UPDATE ${tableIdent} target
            SET ${columnIdent} = NULL
            WHERE target.${qColumn('workspace_id')} = $1
              AND target.${qColumn('_upl_deleted')} = false
              AND target.${qColumn('_app_deleted')} = false
              AND target.${columnIdent} IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM workspace_copy_id_map id_map
                WHERE (id_map.old_id = target.${columnIdent}
                   OR id_map.new_id = target.${columnIdent})
                  ${targetTablePredicate}
            )
            `,
            reference.isResetOnCopy ? [workspaceId, reference.targetTableName] : [workspaceId]
        )
    }
}
