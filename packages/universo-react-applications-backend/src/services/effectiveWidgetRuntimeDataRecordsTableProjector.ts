import type { RecordsUnionDatasource } from '@universo-react/types'
import { isRuntimeSensitiveFieldName, isRuntimeTechnicalFieldName, isUuidV7, type DbExecutor } from '@universo-react/utils'
import { quoteIdentifier, resolvePresentationName, resolveRuntimeCodenameText, UpdateFailure } from '../shared/runtimeHelpers'
import { isRuntimeEnumerationKind, isRuntimeObjectTargetKind, type RuntimeReadableComponent } from './runtimeRowSupport/contracts'
import { loadRuntimeReadableComponents } from './runtimeRowSupport/runtimeObjectCatalog'
import { executeRuntimeRecordsUnionQuery } from './runtimeRowSupport/union/execution'
import {
    isRecord,
    positiveRuntimeRecordVersion,
    runtimeTableCellText,
    type PreparedWidget
} from './effectiveWidgetRuntimeDataProjectionShared'
import type { EffectiveWidgetRuntimeReadScope } from './effectiveWidgetRuntimeDataContracts'
import type { loadRuntimeWidgetBindingMetadata } from '../persistence/widgetBindingRuntimeStore'
import { issueRuntimeRecordHandle } from './runtimeRecordHandle'

const MAX_RECORDS_TABLE_COLUMNS = 32

const isSafeVisibleComponent = (component: RuntimeReadableComponent, locale: string): boolean => {
    const uiConfig = isRecord(component.ui_config) ? component.ui_config : {}
    if (
        uiConfig.hidden === true ||
        uiConfig.gridHidden === true ||
        uiConfig.formHidden === true ||
        uiConfig.serverOwned === true ||
        uiConfig.sensitive === true ||
        uiConfig.private === true
    ) {
        return false
    }
    if (component.data_type === 'JSON' || component.data_type === 'TABLE') return false
    const codename = resolveRuntimeCodenameText(component.codename)
    const label = resolvePresentationName(component.presentation, locale, codename)
    if (
        isRuntimeTechnicalFieldName(codename) ||
        isRuntimeTechnicalFieldName(label) ||
        isRuntimeSensitiveFieldName(codename) ||
        isRuntimeSensitiveFieldName(label)
    ) {
        return false
    }
    if (
        uiConfig.widget === 'resourceSource' ||
        uiConfig.widget === 'editorjsBlockContent' ||
        uiConfig.resourceSource === true ||
        uiConfig.resource === true
    ) {
        return false
    }
    if (component.data_type !== 'REF') return true
    return isRuntimeEnumerationKind(component.target_object_kind) || isRuntimeObjectTargetKind(component.target_object_kind)
}

const resolveVisibleComponents = (components: readonly RuntimeReadableComponent[], locale: string): RuntimeReadableComponent[] => {
    const visible = components.filter((component) => isSafeVisibleComponent(component, locale)).slice(0, MAX_RECORDS_TABLE_COLUMNS)
    if (visible.length === 0) {
        throw new UpdateFailure(409, { error: 'Entity-backed table has no safe display Components' })
    }
    return visible
}

const noRuntimePermissions = {
    manageMembers: false,
    manageApplication: false,
    createContent: false,
    editContent: false,
    deleteContent: false,
    readReports: false
} as const

/** Project a generic records table from the bound Entity schema without persisting field mappings in widget config. */
export const projectRecordsTable = async (
    executor: DbExecutor,
    scope: EffectiveWidgetRuntimeReadScope,
    widget: PreparedWidget,
    metadata: Awaited<ReturnType<typeof loadRuntimeWidgetBindingMetadata>>,
    locale: string,
    allowRowActions: boolean,
    allowRowReordering: boolean
): Promise<unknown> => {
    if (
        widget.candidate.widgetKey !== 'detailsTable' ||
        (widget.candidate.config.variant !== undefined && widget.candidate.config.variant !== 'records') ||
        !scope.applicationId
    ) {
        throw new UpdateFailure(400, { error: 'Records table runtime context is invalid' })
    }
    const applicationId = scope.applicationId

    const slot = widget.bindings.slots.find(({ slot: slotKey }) => slotKey === 'rows')
    const target = slot?.targets.length === 1 ? slot.targets[0] : undefined
    if (!target || target.entityKind !== 'object' || target.selector.kind !== 'record-set' || target.projection.length !== 0) {
        throw new UpdateFailure(400, { error: 'Records table requires one schema-driven Object source' })
    }

    const object = metadata.objectsByCodename.get(target.entityCodename)
    if (!object || object.kind !== 'object' || !isUuidV7(String(object.id))) {
        throw new UpdateFailure(404, { error: 'Records table source is unavailable' })
    }

    const schemaIdent = quoteIdentifier(scope.schemaName)
    const components = await loadRuntimeReadableComponents(executor, schemaIdent, String(object.id))
    const visibleComponents = resolveVisibleComponents(components, locale)
    const projectedFields = visibleComponents.map((component) => resolveRuntimeCodenameText(component.codename))
    if (projectedFields.some((field) => !field)) {
        throw new UpdateFailure(409, { error: 'Records table Component metadata is invalid' })
    }
    const valueTypeByField = new Map(
        visibleComponents.map((component, index) => [
            projectedFields[index],
            component.data_type === 'BOOLEAN'
                ? ('boolean' as const)
                : component.data_type === 'NUMBER'
                ? ('number' as const)
                : ('string' as const)
        ])
    )

    const datasource: RecordsUnionDatasource = {
        kind: 'records.union',
        targets: [{ objectCollectionCodename: target.entityCodename }],
        projectedFields
    }
    const slotDefinition = widget.slotByKey.get('rows')
    const registeredLimit = slotDefinition?.maxResolvedRecords ?? 100
    const configuredLimit = typeof widget.candidate.config.maxRows === 'number' ? widget.candidate.config.maxRows : registeredLimit
    const limit = Math.max(1, Math.min(configuredLimit, registeredLimit))
    const queryResult = await executeRuntimeRecordsUnionQuery({
        runtimeContext: {
            manager: executor,
            schemaIdent,
            userId: scope.currentUserId ?? null,
            role: scope.role ?? null,
            permissions: scope.permissions ?? noRuntimePermissions,
            currentWorkspaceId: scope.workspaceId
        },
        applicationId,
        datasource,
        limit,
        offset: 0,
        locale
    })

    const payload = queryResult.targetPayloads[0]
    if (!payload) throw new UpdateFailure(409, { error: 'Records table source metadata is unavailable' })
    const columnsByField = new Map(payload.columns.map((column) => [column.field, column]))
    const columns = projectedFields.flatMap((field) => {
        const column = columnsByField.get(field)
        const valueType = valueTypeByField.get(field)
        return column && valueType ? [{ key: field, label: column.headerName || field, valueType }] : []
    })
    if (columns.length === 0) throw new UpdateFailure(409, { error: 'Records table has no safe display columns' })

    const complete = queryResult.offset === 0 && queryResult.total === queryResult.rows.length
    const hasReorderAuthority =
        allowRowReordering && typeof payload.reorderFieldCodename === 'string' && payload.reorderFieldCodename.length > 0
    const rows = queryResult.rows.map((row, index) => {
        const entityCodename = typeof row.__runtimeObjectCollectionCodename === 'string' ? row.__runtimeObjectCollectionCodename : ''
        const recordId = typeof row.__runtimeSourceRowId === 'string' ? row.__runtimeSourceRowId : ''
        if (entityCodename !== target.entityCodename || !isUuidV7(recordId)) {
            throw new UpdateFailure(409, { error: 'Records table returned an invalid semantic row target' })
        }
        const version = positiveRuntimeRecordVersion(row._upl_version)
        const recordHandle = issueRuntimeRecordHandle({
            applicationId,
            workspaceId: scope.workspaceId,
            entityCodename,
            recordId
        })
        return {
            key: `row-${index + 1}`,
            ...(allowRowActions ? { actionTarget: { entityCodename, recordHandle } } : {}),
            ...(hasReorderAuthority && complete && version ? { mutationTarget: { entityCodename, recordHandle, version } } : {}),
            cells: columns.map(({ key }) => ({ key, value: runtimeTableCellText(row[key], locale) }))
        }
    })

    const hasCompleteMutationSet = hasReorderAuthority && complete && rows.every((row) => row.mutationTarget !== undefined)
    return {
        kind: 'table',
        ...(hasCompleteMutationSet ? { sourceEntityCodename: target.entityCodename } : {}),
        columns,
        rows,
        pagination: {
            total: queryResult.total,
            limit: queryResult.limit,
            offset: queryResult.offset,
            ...(hasCompleteMutationSet ? { complete: true as const } : {})
        }
    }
}
