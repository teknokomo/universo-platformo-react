import type { DbExecutor } from '@universo-react/utils'
import type { RuntimeDatasourceSort, RecordsUnionDatasource } from '@universo-react/types'
import { normalizeObjectCollectionRuntimeViewConfig } from '@universo-react/utils'
import { normalizeRuntimeRecordBehavior } from '../../../services/runtimeRecordBehavior'
import { UpdateFailure, resolveRuntimeCodenameText, resolvePresentationName, resolveRuntimeSchema } from '../../../shared/runtimeHelpers'
import { createEmptyRuntimeZoneWidgets, resolveRuntimeStandardKind } from '../contracts'
import { loadRuntimeObjectCollections } from '../objects'
import { readConfiguredWorkflowActions } from '../workflow'

import { buildRuntimeUnionOrderBySql, mergeRuntimeUnionColumns, normalizeRuntimeUnionProjectionField } from './projection'
import {
    buildRuntimeUnionTargetQuery,
    buildRuntimeUnionTargetSelect,
    resolveRuntimeUnionTargetContext,
    type RuntimeUnionTargetPayload
} from './targetQuery'

const executeRuntimeUnionPage = async (params: {
    manager: DbExecutor
    unionSelects: string[]
    unionValues: unknown[]
    sort: RuntimeDatasourceSort[] | undefined
    targets: RecordsUnionDatasource['targets']
    limit: number
    offset: number
}): Promise<{ total: number; rows: Array<Record<string, unknown> & { id: string }> }> => {
    const unionSql = params.unionSelects.join('\nUNION ALL\n')
    const totalRows = (await params.manager.query(
        `
      SELECT COUNT(*)::int AS total
      FROM (${unionSql}) union_rows
    `,
        params.unionValues
    )) as Array<{ total: number }>
    const total = typeof totalRows[0]?.total === 'number' ? totalRows[0].total : Number(totalRows[0]?.total) || 0
    const pageRows = (await params.manager.query(
        `
      SELECT row_data AS row
      FROM (${unionSql}) union_rows
      ORDER BY ${buildRuntimeUnionOrderBySql(params.sort, params.targets)}
      LIMIT $${params.unionValues.length + 1} OFFSET $${params.unionValues.length + 2}
    `,
        [...params.unionValues, params.limit, params.offset]
    )) as Array<{ row: Record<string, unknown> | string }>
    const rows = pageRows.map((item) => {
        if (typeof item.row === 'string') {
            return JSON.parse(item.row) as Record<string, unknown> & { id: string }
        }
        return item.row as Record<string, unknown> & { id: string }
    })

    return { total, rows }
}

const assembleRuntimeUnionPayload = (params: {
    targetPayloads: RuntimeUnionTargetPayload[]
    runtimeContext: Exclude<Awaited<ReturnType<typeof resolveRuntimeSchema>>, null>
    locale: string
    rows: Array<Record<string, unknown> & { id: string }>
    total: number
    limit: number
    offset: number
}) => {
    const objectCollections = params.targetPayloads.map(({ objectCollection }) => ({
        id: objectCollection.id,
        kind: resolveRuntimeStandardKind(objectCollection.kind) ?? 'object',
        codename: resolveRuntimeCodenameText(objectCollection.codename),
        tableName: objectCollection.table_name,
        runtimeConfig: normalizeObjectCollectionRuntimeViewConfig(undefined),
        recordBehavior: normalizeRuntimeRecordBehavior(objectCollection.config),
        workflowActions: readConfiguredWorkflowActions(objectCollection.config),
        name: resolvePresentationName(objectCollection.presentation, params.locale, resolveRuntimeCodenameText(objectCollection.codename))
    }))
    const activeObjectCollection = objectCollections[0]

    return {
        section: activeObjectCollection,
        sections: objectCollections,
        activeSectionId: activeObjectCollection.id,
        objectCollection: activeObjectCollection,
        objectCollections,
        activeObjectCollectionId: activeObjectCollection.id,
        columns: mergeRuntimeUnionColumns(params.targetPayloads.map((payload) => payload.columns)),
        rows: params.rows,
        pagination: {
            total: params.total,
            limit: params.limit,
            offset: params.offset
        },
        settings: params.runtimeContext.applicationSettings,
        workspacesEnabled: params.runtimeContext.workspacesEnabled,
        currentWorkspaceId: params.runtimeContext.currentWorkspaceId,
        permissions: params.runtimeContext.permissions,
        workflowCapabilities: params.runtimeContext.workflowCapabilities,
        layoutConfig: {},
        zoneWidgets: createEmptyRuntimeZoneWidgets(),
        menus: [],
        activeMenuId: null
    }
}

export const executeRuntimeRecordsUnionDatasource = async (params: {
    runtimeContext: Exclude<Awaited<ReturnType<typeof resolveRuntimeSchema>>, null>
    applicationId: string
    datasource: RecordsUnionDatasource
    limit: number
    offset: number
    locale: string
}) => {
    const { runtimeContext, datasource, limit, offset, locale } = params
    const { manager, schemaIdent } = runtimeContext
    const runtimeObjects = await loadRuntimeObjectCollections(manager, schemaIdent)
    const queryConfig = datasource.query ?? {}
    const lifecycleState = queryConfig.lifecycleState ?? 'active'
    const libraryView = queryConfig.libraryView ?? 'all'
    const { search, sort, filters } = queryConfig
    const shouldProjectRecentAt =
        libraryView === 'recent' || Boolean(sort?.some((item) => normalizeRuntimeUnionProjectionField(item.field) === 'recentAt'))
    const shouldProjectSharedAt =
        libraryView === 'shared' || Boolean(sort?.some((item) => normalizeRuntimeUnionProjectionField(item.field) === 'sharedAt'))

    const targetPayloads: RuntimeUnionTargetPayload[] = []
    const unionSelects: string[] = []
    const unionValues: unknown[] = []

    for (const [targetIndex, target] of datasource.targets.entries()) {
        const targetContext = await resolveRuntimeUnionTargetContext({
            manager,
            schemaIdent,
            runtimeObjects,
            target,
            sort,
            filters,
            currentWorkspaceId: runtimeContext.currentWorkspaceId,
            projectedFields: datasource.projectedFields,
            locale
        })
        const targetQuery = await buildRuntimeUnionTargetQuery({
            manager,
            schemaIdent,
            applicationId: params.applicationId,
            runtimeContext,
            target,
            objectCollection: targetContext.objectCollection,
            components: targetContext.components,
            physicalComponents: targetContext.physicalComponents,
            targetSort: targetContext.targetSort,
            targetFilters: targetContext.targetFilters,
            enumOptionsMap: targetContext.enumOptionsMap,
            projectionSpecs: targetContext.projectionSpecs,
            locale,
            lifecycleState,
            libraryView,
            search,
            shouldProjectRecentAt,
            shouldProjectSharedAt
        })
        targetPayloads.push(
            buildRuntimeUnionTargetSelect({
                schemaIdent,
                objectCollection: targetContext.objectCollection,
                components: targetContext.components,
                physicalComponents: targetContext.physicalComponents,
                target,
                targetIndex,
                locale,
                dataTableIdent: targetQuery.dataTableIdent,
                activeObjectRowCondition: targetQuery.activeObjectRowCondition,
                runtimeListClauses: targetQuery.runtimeListClauses,
                recordAccessClause: targetQuery.recordAccessClause,
                libraryViewClause: targetQuery.libraryViewClause,
                effectiveProjectionSpecs: targetQuery.effectiveProjectionSpecs,
                runtimeStarredExistsClause: targetQuery.runtimeStarredExistsClause,
                runtimeSharedExistsClause: targetQuery.runtimeSharedExistsClause,
                unionValues,
                unionSelects,
                enumOptionsMap: targetContext.enumOptionsMap
            })
        )
    }

    const firstTarget = targetPayloads[0]
    if (!firstTarget || unionSelects.length === 0) {
        throw new UpdateFailure(400, { error: 'Records union datasource requires at least one target' })
    }

    const { total, rows } = await executeRuntimeUnionPage({
        manager,
        unionSelects,
        unionValues,
        sort,
        targets: datasource.targets,
        limit,
        offset
    })

    return assembleRuntimeUnionPayload({
        targetPayloads,
        runtimeContext,
        locale,
        rows,
        total,
        limit,
        offset
    })
}
