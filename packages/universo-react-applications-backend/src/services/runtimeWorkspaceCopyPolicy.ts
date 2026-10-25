import type { DbExecutor } from '@universo-react/utils'
import { qColumn, qSchemaTable } from '@universo-react/database'
import { generateChildTableName } from '@universo-react/schema-ddl'
import { entityRecordPolicySchema } from '@universo-react/types'
import { runtimeCodenameTextSql } from '../shared/runtimeHelpers'
import { resolveAccessLinkIntakePolicy, type AccessLinkIntakeFieldMetadata } from './guestAccessLinkIntakePolicy'

type WorkspaceCopyAccessLinkIntakeFieldRow = {
    tableName: string
    codename: string
    columnName: string
    dataType: string
    uiConfig: Record<string, unknown> | null
}

type WorkspaceCopyTemplateMaterialObjectRow = {
    objectId: string
    codename: string
    tableName: string
    recordPolicyPresent: boolean | string | null
    recordPolicyJson: string | null
}

type WorkspaceCopyTemplateMaterialComponentRow = {
    templateTableName: string
    tableComponentId: string
    materialRefColumnName: string
    materialTargetObjectId: string | null
}

type WorkspaceCopyMaterialInterpretationFieldRow = {
    materialTableName: string
    interpretationIdColumnName: string
    interpretationTableNames: string[] | null
}

export type WorkspaceCopyTemplateMaterialOwnerSource = {
    tableName: string
    ownerColumnName: string
    materialIncluded: boolean
}

/** Locate every Material provenance field so the copy can validate both included and excluded sides. */
export async function listWorkspaceCopyTemplateMaterialOwnerSources(
    executor: DbExecutor,
    schemaName: string,
    discoveredTables: string[],
    scopedTables: string[]
): Promise<WorkspaceCopyTemplateMaterialOwnerSource[]> {
    if (discoveredTables.length === 0) return []

    const rows = await executor.query<WorkspaceCopyTemplateMaterialOwnerSource>(
        `
        SELECT
            object_row.table_name AS "tableName",
            component.column_name AS "ownerColumnName",
            object_row.table_name = ANY($2::text[]) AS "materialIncluded"
        FROM ${qSchemaTable(schemaName, '_app_objects')} object_row
        INNER JOIN ${qSchemaTable(schemaName, '_app_components')} component
            ON component.object_id = object_row.id
           AND component.parent_component_id IS NULL
           AND LOWER(${runtimeCodenameTextSql('component.codename')}) = 'templateownerid'
           AND component.data_type = 'STRING'
           AND component.${qColumn('_upl_deleted')} = false
           AND component.${qColumn('_app_deleted')} = false
        WHERE LOWER(${runtimeCodenameTextSql('object_row.codename')}) = 'material'
          AND object_row.table_name = ANY($1::text[])
          AND object_row.${qColumn('_upl_deleted')} = false
          AND object_row.${qColumn('_app_deleted')} = false
        ORDER BY object_row.table_name ASC, component.id ASC
        `,
        [discoveredTables, scopedTables]
    )

    return rows
}

/** Locate excluded TableTemplate parent tables whose IDs must share the atomic copy snapshot. */
export async function listExcludedWorkspaceCopyTableTemplateNames(
    executor: DbExecutor,
    schemaName: string,
    discoveredTables: string[],
    scopedTables: string[]
): Promise<string[]> {
    if (discoveredTables.length === 0) return []

    const rows = await executor.query<{ tableName: string }>(
        `
        SELECT DISTINCT object_row.table_name AS "tableName"
        FROM ${qSchemaTable(schemaName, '_app_objects')} object_row
        WHERE LOWER(${runtimeCodenameTextSql('object_row.codename')}) = 'tabletemplate'
          AND object_row.table_name = ANY($1::text[])
          AND NOT (object_row.table_name = ANY($2::text[]))
          AND object_row.${qColumn('_upl_deleted')} = false
          AND object_row.${qColumn('_app_deleted')} = false
        ORDER BY object_row.table_name ASC
        `,
        [discoveredTables, scopedTables]
    )

    return rows.map(({ tableName }) => tableName)
}

/** Remap copied Materials' server-owned template provenance to the copied TableTemplate ID. */
export async function remapWorkspaceCopyTemplateMaterialOwners(
    executor: DbExecutor,
    schemaName: string,
    targetWorkspaceId: string
): Promise<void> {
    const ownerRows = await executor.query<{
        materialTableName: string
        ownerColumnName: string
        templateTableName: string
    }>(
        `
        SELECT
            material.table_name AS "materialTableName",
            owner_component.column_name AS "ownerColumnName",
            template.table_name AS "templateTableName"
        FROM ${qSchemaTable(schemaName, '_app_objects')} material
        INNER JOIN ${qSchemaTable(schemaName, '_app_components')} owner_component
            ON owner_component.object_id = material.id
           AND owner_component.parent_component_id IS NULL
           AND LOWER(${runtimeCodenameTextSql('owner_component.codename')}) = 'templateownerid'
           AND owner_component.data_type = 'STRING'
           AND owner_component.${qColumn('_upl_deleted')} = false
           AND owner_component.${qColumn('_app_deleted')} = false
        INNER JOIN ${qSchemaTable(schemaName, '_app_objects')} template
            ON LOWER(${runtimeCodenameTextSql('template.codename')}) = 'tabletemplate'
           AND template.${qColumn('_upl_deleted')} = false
           AND template.${qColumn('_app_deleted')} = false
        WHERE LOWER(${runtimeCodenameTextSql('material.codename')}) = 'material'
          AND material.${qColumn('_upl_deleted')} = false
          AND material.${qColumn('_app_deleted')} = false
        ORDER BY material.table_name ASC, owner_component.id ASC, template.table_name ASC
        `
    )

    const processedPairs = new Set<string>()
    for (const row of ownerRows) {
        const pair = `${row.materialTableName}\u0000${row.ownerColumnName}\u0000${row.templateTableName}`
        if (processedPairs.has(pair)) continue
        processedPairs.add(pair)

        await executor.query(
            `
            UPDATE ${qSchemaTable(schemaName, row.materialTableName)} material
            SET ${qColumn(row.ownerColumnName)} = id_map.new_id::text
            FROM workspace_copy_id_map id_map
            WHERE material.${qColumn('workspace_id')} = $1::uuid
              AND material.${qColumn(row.ownerColumnName)} IS NOT NULL
              AND LOWER(material.${qColumn(row.ownerColumnName)}) = LOWER(id_map.old_id::text)
              AND id_map.source_table_name = $2::text
            `,
            [targetWorkspaceId, row.templateTableName]
        )
    }
}

/** Remap server-owned Material.InterpretationId strings to the copied Interpretation rows. */
export async function remapWorkspaceCopyMaterialInterpretations(
    executor: DbExecutor,
    schemaName: string,
    targetWorkspaceId: string,
    createError: (code: 'WORKSPACE_COPY_REFERENCE_UNRESOLVED', message: string) => Error
): Promise<void> {
    const fields = await executor.query<WorkspaceCopyMaterialInterpretationFieldRow>(
        `
        SELECT
            material.table_name AS "materialTableName",
            interpretation_id_component.column_name AS "interpretationIdColumnName",
            COALESCE(
                ARRAY_AGG(DISTINCT interpretation.table_name ORDER BY interpretation.table_name)
                    FILTER (WHERE interpretation.table_name IS NOT NULL),
                ARRAY[]::text[]
            ) AS "interpretationTableNames"
        FROM ${qSchemaTable(schemaName, '_app_objects')} material
        INNER JOIN ${qSchemaTable(schemaName, '_app_components')} interpretation_id_component
            ON interpretation_id_component.object_id = material.id
           AND interpretation_id_component.parent_component_id IS NULL
           AND LOWER(${runtimeCodenameTextSql('interpretation_id_component.codename')}) = 'interpretationid'
           AND interpretation_id_component.data_type = 'STRING'
           AND interpretation_id_component.${qColumn('_upl_deleted')} = false
           AND interpretation_id_component.${qColumn('_app_deleted')} = false
        LEFT JOIN ${qSchemaTable(schemaName, '_app_objects')} interpretation
            ON LOWER(${runtimeCodenameTextSql('interpretation.codename')}) = 'interpretation'
           AND interpretation.${qColumn('_upl_deleted')} = false
           AND interpretation.${qColumn('_app_deleted')} = false
        WHERE LOWER(${runtimeCodenameTextSql('material.codename')}) = 'material'
          AND material.${qColumn('_upl_deleted')} = false
          AND material.${qColumn('_app_deleted')} = false
        GROUP BY material.table_name, interpretation_id_component.column_name
        ORDER BY material.table_name ASC, interpretation_id_component.column_name ASC
        `
    )

    for (const field of fields) {
        const materialTable = qSchemaTable(schemaName, field.materialTableName)
        const interpretationColumn = qColumn(field.interpretationIdColumnName)
        const interpretationTableNames = [...new Set(field.interpretationTableNames ?? [])].sort()

        if (interpretationTableNames.length !== 1) {
            const referenceRows = await executor.query<{ hasReferences: boolean | string }>(
                `
                SELECT EXISTS (
                    SELECT 1
                    FROM ${materialTable} material
                    WHERE material.${qColumn('workspace_id')} = $1::uuid
                      AND material.${qColumn('_upl_deleted')} = false
                      AND material.${qColumn('_app_deleted')} = false
                      AND NULLIF(BTRIM(material.${interpretationColumn}), '') IS NOT NULL
                ) AS "hasReferences"
                `,
                [targetWorkspaceId]
            )
            const hasReferences =
                referenceRows[0]?.hasReferences === true || String(referenceRows[0]?.hasReferences).toLowerCase() === 'true'
            if (hasReferences) {
                throw createError(
                    'WORKSPACE_COPY_REFERENCE_UNRESOLVED',
                    'Workspace copy contains a Material InterpretationId reference that cannot be resolved'
                )
            }
            continue
        }

        const [interpretationTableName] = interpretationTableNames
        await executor.query(
            `
            UPDATE ${materialTable} material
            SET ${interpretationColumn} = id_map.new_id::text
            FROM workspace_copy_id_map id_map
            WHERE material.${qColumn('workspace_id')} = $1::uuid
              AND material.${qColumn('_upl_deleted')} = false
              AND material.${qColumn('_app_deleted')} = false
              AND NULLIF(BTRIM(material.${interpretationColumn}), '') IS NOT NULL
              AND LOWER(BTRIM(material.${interpretationColumn})) = LOWER(id_map.old_id::text)
              AND id_map.source_table_name = $2::text
            `,
            [targetWorkspaceId, interpretationTableName]
        )

        const unresolvedRows = await executor.query<{ hasUnresolvedReferences: boolean | string }>(
            `
            SELECT EXISTS (
                SELECT 1
                FROM ${materialTable} material
                WHERE material.${qColumn('workspace_id')} = $1::uuid
                  AND material.${qColumn('_upl_deleted')} = false
                  AND material.${qColumn('_app_deleted')} = false
                  AND NULLIF(BTRIM(material.${interpretationColumn}), '') IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM workspace_copy_id_map id_map
                      WHERE id_map.source_table_name = $2::text
                        AND LOWER(id_map.new_id::text) = LOWER(BTRIM(material.${interpretationColumn}))
                  )
            ) AS "hasUnresolvedReferences"
            `,
            [targetWorkspaceId, interpretationTableName]
        )
        const hasUnresolvedReferences =
            unresolvedRows[0]?.hasUnresolvedReferences === true ||
            String(unresolvedRows[0]?.hasUnresolvedReferences).toLowerCase() === 'true'
        if (hasUnresolvedReferences) {
            throw createError(
                'WORKSPACE_COPY_REFERENCE_UNRESOLVED',
                'Workspace copy contains a Material InterpretationId reference that cannot be resolved'
            )
        }
    }
}

/** Detects a copied TableTemplate whose MaterialRef rows would be orphaned by Material's exclude policy. */
export async function hasWorkspaceCopyTemplateMaterialsExcluded(
    executor: DbExecutor,
    schemaName: string,
    workspaceId: string,
    discoveredTables: string[],
    scopedTables: string[]
): Promise<boolean> {
    if (discoveredTables.length === 0 || scopedTables.length === 0) return false

    const objectsQt = qSchemaTable(schemaName, '_app_objects')
    const objectRows = await executor.query<WorkspaceCopyTemplateMaterialObjectRow>(
        `
        SELECT
            object_row.id AS "objectId",
            LOWER(${runtimeCodenameTextSql('object_row.codename')}) AS codename,
            object_row.table_name AS "tableName",
            jsonb_exists(object_row.config, 'recordPolicy') AS "recordPolicyPresent",
            (object_row.config->'recordPolicy')::text AS "recordPolicyJson"
        FROM ${objectsQt} object_row
        WHERE object_row.table_name = ANY($1::text[])
          AND LOWER(${runtimeCodenameTextSql('object_row.codename')}) = ANY($2::text[])
          AND object_row.${qColumn('_upl_deleted')} = false
          AND object_row.${qColumn('_app_deleted')} = false
        `,
        [discoveredTables, ['material', 'tabletemplate']]
    )

    const scopedTableSet = new Set(scopedTables)
    const excludedMaterialObjectIds = new Set<string>()
    const templateTableNames = new Set<string>()
    for (const row of objectRows) {
        const policyPresent = row.recordPolicyPresent === true || String(row.recordPolicyPresent).toLowerCase() === 'true'
        let copyPolicy: 'include' | 'exclude' | undefined
        if (policyPresent) {
            let rawPolicy: unknown
            try {
                rawPolicy = JSON.parse(row.recordPolicyJson ?? 'null')
            } catch {
                throw new Error('Invalid EntityRecordPolicy metadata; workspace copy aborted')
            }
            const policy = entityRecordPolicySchema.safeParse(rawPolicy)
            if (!policy.success) throw new Error('Invalid EntityRecordPolicy metadata; workspace copy aborted')
            copyPolicy = policy.data.workspaceCopy
        }

        if (row.codename === 'tabletemplate') {
            if (scopedTableSet.has(row.tableName) && copyPolicy !== 'exclude') {
                templateTableNames.add(row.tableName)
            }
        }

        if (row.codename === 'material' && (!scopedTableSet.has(row.tableName) || copyPolicy === 'exclude')) {
            excludedMaterialObjectIds.add(row.objectId)
        }
    }

    const ownerRows = await executor.query<{
        hasTemplateOwnerReference: boolean | string
        hasIncludedMaterialExcludedTemplateReference: boolean | string
    }>(
        `
        SELECT
            EXISTS (
                SELECT 1
                FROM workspace_copy_template_material_owners material_owner
                INNER JOIN workspace_copy_source_rows template_row
                    ON LOWER(template_row.id::text) = LOWER(material_owner.template_owner_id)
                WHERE material_owner.workspace_id = $1::uuid
                  AND material_owner.material_included = false
                  AND template_row.source_table_name = ANY($2::text[])
            ) AS "hasTemplateOwnerReference",
            EXISTS (
                SELECT 1
                FROM workspace_copy_template_material_owners material_owner
                INNER JOIN workspace_copy_excluded_template_ids excluded_template
                    ON LOWER(excluded_template.template_id::text) = LOWER(material_owner.template_owner_id)
                WHERE material_owner.workspace_id = $1::uuid
                  AND material_owner.material_included = true
            ) AS "hasIncludedMaterialExcludedTemplateReference"
        `,
        [workspaceId, [...templateTableNames]]
    )
    const hasTemplateOwnerReference =
        ownerRows[0]?.hasTemplateOwnerReference === true || String(ownerRows[0]?.hasTemplateOwnerReference).toLowerCase() === 'true'
    const hasIncludedMaterialExcludedTemplateReference =
        ownerRows[0]?.hasIncludedMaterialExcludedTemplateReference === true ||
        String(ownerRows[0]?.hasIncludedMaterialExcludedTemplateReference).toLowerCase() === 'true'
    if (hasTemplateOwnerReference || hasIncludedMaterialExcludedTemplateReference) return true

    if (templateTableNames.size === 0) return false
    if (excludedMaterialObjectIds.size === 0) return false

    const componentRows = await executor.query<WorkspaceCopyTemplateMaterialComponentRow>(
        `
        SELECT
            object_row.table_name AS "templateTableName",
            table_component.id AS "tableComponentId",
            material_ref.column_name AS "materialRefColumnName",
            material_ref.target_object_id AS "materialTargetObjectId"
        FROM ${objectsQt} object_row
        INNER JOIN ${qSchemaTable(schemaName, '_app_components')} table_component
            ON table_component.object_id = object_row.id
           AND table_component.parent_component_id IS NULL
           AND table_component.data_type = 'TABLE'
           AND table_component.${qColumn('_upl_deleted')} = false
           AND table_component.${qColumn('_app_deleted')} = false
        INNER JOIN ${qSchemaTable(schemaName, '_app_components')} material_ref
            ON material_ref.object_id = object_row.id
           AND material_ref.parent_component_id = table_component.id
           AND LOWER(${runtimeCodenameTextSql('material_ref.codename')}) = 'materialref'
           AND material_ref.${qColumn('_upl_deleted')} = false
           AND material_ref.${qColumn('_app_deleted')} = false
        WHERE LOWER(${runtimeCodenameTextSql('object_row.codename')}) = 'tabletemplate'
          AND object_row.table_name = ANY($1::text[])
          AND object_row.${qColumn('_upl_deleted')} = false
          AND object_row.${qColumn('_app_deleted')} = false
        ORDER BY object_row.table_name ASC, table_component.id ASC
        `,
        [[...templateTableNames]]
    )

    for (const component of componentRows) {
        if (!component.materialTargetObjectId || !excludedMaterialObjectIds.has(component.materialTargetObjectId)) continue
        const childTableName = generateChildTableName(component.tableComponentId)
        if (!scopedTableSet.has(childTableName)) continue

        const referenceRows = await executor.query<{ hasMaterialReference: boolean | string }>(
            `
            SELECT EXISTS (
                SELECT 1
                FROM workspace_copy_source_rows template_row
                INNER JOIN workspace_copy_source_rows child_row
                    ON child_row.source_table_name = $3
                   AND child_row.workspace_id = template_row.workspace_id
                   AND child_row.row_data ->> '_tp_parent_id' = template_row.id::text
                WHERE template_row.source_table_name = $2
                  AND template_row.workspace_id = $1::uuid
                  AND child_row.row_data ->> $4::text IS NOT NULL
            ) AS "hasMaterialReference"
            `,
            [workspaceId, component.templateTableName, childTableName, component.materialRefColumnName]
        )
        const hasMaterialReference =
            referenceRows[0]?.hasMaterialReference === true || String(referenceRows[0]?.hasMaterialReference).toLowerCase() === 'true'
        if (hasMaterialReference) return true
    }

    return false
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
    resetDefaultsByTable: Map<string, Map<string, string>>,
    options: { sourceSnapshot?: boolean } = {}
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
        const sourceRows = options.sourceSnapshot
            ? (
                  await executor.query<{ rowData: Record<string, unknown> }>(
                      `
                      SELECT row_data AS "rowData"
                      FROM workspace_copy_source_rows
                      WHERE source_table_name = $1
                        AND workspace_id = $2::uuid
                      ORDER BY id ASC
                  `,
                      [tableName, workspaceId]
                  )
              ).map(({ rowData }) => rowData)
            : await executor.query<Record<string, unknown>>(
                  `
                  SELECT *
                  FROM ${qSchemaTable(schemaName, tableName)}
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
