import { qColumn, qSchema, qSchemaTable } from '@universo-react/database'
import { normalizeWidgetBindingDataType, reportDefinitionSchema, type ReportDefinition } from '@universo-react/types'
import { isUuidV7, resolveApplicationLifecycleContractFromConfig, type DbExecutor } from '@universo-react/utils'
import { buildRuntimeActiveRowCondition } from '../shared/runtimeHelpers'
import { buildRuntimeRecordAccessClause } from '../services/runtimeRowSupport/access'
import type { RuntimeObjectCollectionAttr } from '../services/runtimeRowSupport/contracts'
import type { RolePermission } from '../routes/guards'
import { loadRuntimeWidgetBindingMetadata } from './widgetBindingRuntimeStore'

export class SavedRuntimeReportSourceError extends Error {
    constructor(public readonly reason: 'permission-denied' | 'stale-source' | 'malformed-config') {
        super('The saved report source is unavailable')
        this.name = 'SavedRuntimeReportSourceError'
    }
}

export interface SavedRuntimeReportReadScope {
    readonly schemaName: string
    readonly workspaceId: string | null
    readonly workspacesEnabled: boolean
    readonly currentUserId?: string | null
    readonly permissions?: Record<RolePermission, boolean>
}

type SavedRuntimeReportReference = { readonly kind: 'codename'; readonly value: string } | { readonly kind: 'id'; readonly value: string }

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const loadSavedRuntimeReportSourceByReference = async (
    executor: DbExecutor,
    scope: SavedRuntimeReportReadScope,
    reference: SavedRuntimeReportReference
): Promise<ReportDefinition> => {
    if (!scope.currentUserId || scope.permissions?.readReports !== true) {
        throw new SavedRuntimeReportSourceError('permission-denied')
    }
    if (
        (scope.workspacesEnabled && (!scope.workspaceId || !isUuidV7(scope.workspaceId))) ||
        (!scope.workspacesEnabled && scope.workspaceId !== null)
    ) {
        throw new SavedRuntimeReportSourceError('permission-denied')
    }
    if (reference.kind === 'id' ? !isUuidV7(reference.value) : !/^[A-Za-z][A-Za-z0-9._-]{0,127}$/u.test(reference.value)) {
        throw new SavedRuntimeReportSourceError('malformed-config')
    }

    const metadata = await loadRuntimeWidgetBindingMetadata(executor, scope.schemaName, new Map([['Reports', ['Definition']]]))
    const source = metadata.objectsByCodename.get('Reports')
    const components = source ? metadata.componentsByObjectId.get(String(source.id)) ?? [] : []
    const definitionComponent = components.find(({ codename }) => codename === 'Definition')
    if (
        !source ||
        source.kind !== 'object' ||
        typeof source.tableName !== 'string' ||
        !definitionComponent ||
        normalizeWidgetBindingDataType(definitionComponent.dataType) !== 'JSON' ||
        typeof definitionComponent.columnName !== 'string'
    ) {
        throw new SavedRuntimeReportSourceError('stale-source')
    }

    const sourceConfig = isRecord(source.config) ? source.config : null
    const tableSql = qSchemaTable(scope.schemaName, source.tableName)
    const definitionColumnSql = qColumn(definitionComponent.columnName)
    const activeCondition = buildRuntimeActiveRowCondition(
        resolveApplicationLifecycleContractFromConfig(sourceConfig),
        sourceConfig,
        undefined,
        scope.workspaceId
    )
    const attrs: RuntimeObjectCollectionAttr[] = components.map((component) => ({
        id: String(component.id ?? ''),
        codename: component.codename,
        column_name: String(component.columnName ?? ''),
        data_type: String(component.dataType ?? ''),
        is_required: component.isRequired === true,
        validation_rules: isRecord(component.validationRules) ? component.validationRules : undefined,
        target_object_id: typeof component.targetObjectId === 'string' ? component.targetObjectId : null,
        target_object_kind: typeof component.targetObjectKind === 'string' ? component.targetObjectKind : null,
        ui_config: isRecord(component.uiConfig) ? component.uiConfig : undefined
    }))
    const values: unknown[] = []
    const accessClause = await buildRuntimeRecordAccessClause({
        manager: executor,
        schemaIdent: qSchema(scope.schemaName),
        currentWorkspaceId: scope.workspaceId,
        currentUserId: scope.currentUserId,
        permissions: scope.permissions,
        objectCodename: 'Reports',
        attrs,
        config: sourceConfig,
        outerRowIdSql: `${qColumn('report_record')}.${qColumn('id')}`,
        values
    })
    values.push(reference.value)
    const referenceCondition =
        reference.kind === 'id'
            ? `${qColumn('report_record')}.${qColumn('id')}::text = $${values.length}`
            : `${definitionColumnSql}->>'codename' = $${values.length}`
    const rowLimit = reference.kind === 'id' ? 1 : 2
    const rows = await executor.query<{ definition: unknown }>(
        `SELECT ${definitionColumnSql} AS ${qColumn('definition')}
         FROM ${tableSql} AS ${qColumn('report_record')}
         WHERE (${activeCondition})${accessClause ? ` AND (${accessClause})` : ''}
           AND (${referenceCondition})
         ORDER BY ${qColumn('id')} ASC
         LIMIT ${rowLimit}`,
        values
    )
    if (rows.length === 0) throw new SavedRuntimeReportSourceError('stale-source')
    if (rows.length !== 1) throw new SavedRuntimeReportSourceError('malformed-config')
    let storedDefinition = rows[0].definition
    if (typeof storedDefinition === 'string') {
        try {
            storedDefinition = JSON.parse(storedDefinition)
        } catch {
            throw new SavedRuntimeReportSourceError('malformed-config')
        }
    }
    const parsed = reportDefinitionSchema.safeParse(storedDefinition)
    if (!parsed.success || (reference.kind === 'codename' && parsed.data.codename !== reference.value)) {
        throw new SavedRuntimeReportSourceError('malformed-config')
    }
    return parsed.data
}

/** Resolve a canonical saved report by codename without exposing storage or datasource metadata to a widget. */
export const loadSavedRuntimeReportSource = async (
    executor: DbExecutor,
    scope: SavedRuntimeReportReadScope,
    reportCodename: string
): Promise<ReportDefinition> => loadSavedRuntimeReportSourceByReference(executor, scope, { kind: 'codename', value: reportCodename })

/** Resolve a saved report by its record identity using the same scoped ACL as readiness and codename reads. */
export const loadSavedRuntimeReportSourceById = async (
    executor: DbExecutor,
    scope: SavedRuntimeReportReadScope,
    reportId: string
): Promise<ReportDefinition> => loadSavedRuntimeReportSourceByReference(executor, scope, { kind: 'id', value: reportId })
