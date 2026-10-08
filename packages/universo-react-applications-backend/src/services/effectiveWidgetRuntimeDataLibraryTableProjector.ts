import { isUuidV7, type DbExecutor } from '@universo-react/utils'
import type { RecordsUnionDatasource } from '@universo-react/types'
import { executeRuntimeRecordsUnionQuery } from './runtimeRowSupport/union/execution'
import { readRuntimeLibraryConfig } from './runtimeRowSupport/access'
import {
    fieldLabel,
    isRecord,
    positiveRuntimeRecordVersion,
    runtimeTableCellText,
    type PreparedWidget
} from './effectiveWidgetRuntimeDataProjectionShared'
import type { EffectiveWidgetRuntimeReadScope } from './effectiveWidgetRuntimeDataContracts'
import { loadRuntimeWidgetBindingMetadata } from '../persistence/widgetBindingRuntimeStore'
import { quoteIdentifier, UpdateFailure } from '../shared/runtimeHelpers'
import { issueRuntimeRecordHandle } from './runtimeRecordHandle'

export const projectLibraryTable = async (
    executor: DbExecutor,
    scope: EffectiveWidgetRuntimeReadScope,
    widget: PreparedWidget,
    metadata: Awaited<ReturnType<typeof loadRuntimeWidgetBindingMetadata>>,
    locale: string
): Promise<unknown> => {
    if (
        widget.candidate.widgetKey !== 'detailsTable' ||
        widget.candidate.config.variant !== 'library' ||
        !scope.applicationId ||
        !scope.currentUserId ||
        !scope.role
    ) {
        throw new UpdateFailure(403, { error: 'Library table runtime requires an authenticated application context' })
    }
    const applicationId = scope.applicationId
    const boundTargets = widget.bindings.slots.find(({ slot }) => slot === 'rows')?.targets ?? []
    if (boundTargets.length === 0) throw new UpdateFailure(400, { error: 'Library table requires at least one bound Entity source' })

    const datasourceTargets: RecordsUnionDatasource['targets'] = []
    const projectedFields = new Set<string>()
    for (const target of boundTargets) {
        if (target.entityKind !== 'object') throw new UpdateFailure(400, { error: 'Library table targets must be Object entities' })
        const object = metadata.objectsByCodename.get(target.entityCodename)
        const config = isRecord(object?.config) ? object.config : null
        const projection = readRuntimeLibraryConfig(config)?.projection
        if (!object || !projection) {
            throw new UpdateFailure(409, { error: 'Library table target does not declare a runtime projection' })
        }
        for (const field of projection.projectedFieldCodenames) projectedFields.add(field)
        datasourceTargets.push({
            objectCollectionCodename: target.entityCodename,
            displayType: projection.displayType,
            titleField: projection.titleFieldCodename,
            ...(projection.statusFieldCodename ? { statusField: projection.statusFieldCodename } : {}),
            ...(projection.projectFieldCodename ? { projectField: projection.projectFieldCodename } : {}),
            ...(projection.updatedAtFieldCodename ? { updatedAtField: projection.updatedAtFieldCodename } : {})
        })
    }

    const libraryView = widget.candidate.config.libraryView
    const lifecycleState = widget.candidate.config.lifecycleState
    if (!['all', 'recent', 'starred', 'shared'].includes(String(libraryView))) {
        throw new UpdateFailure(400, { error: 'Library table view is invalid' })
    }
    if (lifecycleState !== 'active' && lifecycleState !== 'deleted') {
        throw new UpdateFailure(400, { error: 'Library table lifecycle state is invalid' })
    }
    const sort =
        libraryView === 'recent'
            ? [{ field: 'recentAt', direction: 'desc' as const }]
            : libraryView === 'shared'
            ? [{ field: 'sharedAt', direction: 'desc' as const }]
            : [{ field: 'title', direction: 'asc' as const }]
    const datasource: RecordsUnionDatasource = {
        kind: 'records.union',
        targets: datasourceTargets,
        ...(projectedFields.size > 0 ? { projectedFields: [...projectedFields] } : {}),
        query: { lifecycleState, libraryView: libraryView as 'all' | 'recent' | 'starred' | 'shared', sort }
    }
    const limit = Math.min(typeof widget.candidate.config.maxRows === 'number' ? widget.candidate.config.maxRows : 500, 500)
    const runtimeContext = {
        manager: executor,
        schemaIdent: quoteIdentifier(scope.schemaName),
        userId: scope.currentUserId,
        role: scope.role,
        permissions: scope.permissions ?? {
            manageMembers: false,
            manageApplication: false,
            createContent: false,
            editContent: false,
            deleteContent: false,
            readReports: false
        },
        currentWorkspaceId: scope.workspaceId
    }
    const queryResult = await executeRuntimeRecordsUnionQuery({
        runtimeContext,
        applicationId: scope.applicationId,
        datasource,
        limit,
        offset: 0,
        locale
    })

    const visibleFieldOrder = [
        'type',
        'title',
        'status',
        'project',
        ...projectedFields,
        ...(libraryView === 'recent' ? ['recentAt'] : []),
        ...(libraryView === 'shared' ? ['sharedAt'] : [])
    ]
    const columnsByField = new Map<string, { key: string; label: string }>()
    for (const field of visibleFieldOrder) {
        for (const targetPayload of queryResult.targetPayloads) {
            const column = targetPayload.columns.find((candidate) => candidate.field === field)
            if (column && !columnsByField.has(field)) {
                columnsByField.set(field, { key: field, label: column.headerName || fieldLabel(field) })
                break
            }
        }
    }
    const columns = [...columnsByField.values()]
    if (columns.length === 0) throw new UpdateFailure(409, { error: 'Library table has no safe display columns' })

    const rows = queryResult.rows.map((row, index) => {
        const entityCodename = typeof row.__runtimeObjectCollectionCodename === 'string' ? row.__runtimeObjectCollectionCodename : ''
        const recordId = typeof row.__runtimeSourceRowId === 'string' ? row.__runtimeSourceRowId : ''
        const displayType = typeof row.__runtimeDisplayType === 'string' ? row.__runtimeDisplayType : ''
        if (!entityCodename || !isUuidV7(recordId) || !displayType) {
            throw new UpdateFailure(409, { error: 'Library table returned an invalid semantic row target' })
        }
        const rawVersion = row._upl_version
        const version = rawVersion === null || rawVersion === undefined ? 1 : positiveRuntimeRecordVersion(rawVersion)
        return {
            key: `row-${index + 1}`,
            target: {
                entityCodename,
                recordHandle: issueRuntimeRecordHandle({
                    applicationId,
                    workspaceId: scope.workspaceId,
                    entityCodename,
                    recordId
                }),
                ...(version === undefined ? {} : { version }),
                displayType,
                starred: row.__runtimeStarred === true,
                shared: row.__runtimeShared === true
            },
            cells: columns.map(({ key }) => ({ key, value: runtimeTableCellText(row[key], locale) }))
        }
    })
    return {
        kind: 'table',
        columns,
        rows,
        pagination: { total: queryResult.total, limit: queryResult.limit, offset: queryResult.offset }
    }
}
