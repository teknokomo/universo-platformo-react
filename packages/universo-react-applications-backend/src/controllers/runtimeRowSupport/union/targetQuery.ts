import type { DbExecutor } from '@universo-react/utils'
import type { RuntimeDatasourceFilter, RuntimeDatasourceSort, RecordsUnionDatasource } from '@universo-react/types'
import { generateChildTableName } from '@universo-react/schema-ddl'
import { isRuntimeRecordBehaviorEnabled, normalizeRuntimeRecordBehavior } from '../../../services/runtimeRecordBehavior'
import {
    UpdateFailure,
    IDENTIFIER_REGEX,
    quoteIdentifier,
    resolveRuntimeCodenameText,
    resolvePresentationName,
    buildRuntimeActiveRowCondition,
    buildRuntimeDeletedRowCondition,
    resolveRuntimeSchema,
    type RuntimeRefOption
} from '../../../shared/runtimeHelpers'
import {
    RUNTIME_RECORD_SYSTEM_FIELDS,
    resolveRuntimeStandardKind,
    type RuntimeColumnDefinition,
    type RuntimeObjectCollectionRow,
    type RuntimeReadableComponent,
    type RuntimeRelationBinding,
    type RuntimeUnionProjectionSpec
} from '../contracts'
import {
    loadRuntimeEnumOptionsMap,
    loadRuntimeReadableComponents,
    mapRuntimeComponentToColumnDefinition,
    resolveRuntimeObjectCollectionConfig
} from '../objects'
import { buildRuntimeListClauses, buildRuntimeRowsOrderBy, findUnsupportedRuntimeListFields, resolveRuntimeReorderField } from '../list'
import {
    buildRuntimeLibraryViewClause,
    buildRuntimeRecordAccessClause,
    buildRuntimeRelationExistsClause,
    buildRuntimeRelationTimestampValueSql,
    buildRuntimeSharedRelationTimestampValueSql,
    readRuntimeAccessEntryConfig,
    readRuntimeLibraryConfig,
    resolveRuntimeRelationBinding
} from '../access'

import {
    buildRuntimeComponentJsonValueSql,
    buildRuntimeUnionProjectionSpecs,
    buildRuntimeUnionRecentAtProjectionSpec,
    buildRuntimeUnionSharedAtProjectionSpec,
    isRuntimeUnionProjectedSourceComponent,
    quoteSqlLiteral,
    remapRuntimeUnionSqlPlaceholders,
    resolveRecordsUnionTargetObject,
    translateRuntimeUnionTargetFilters,
    translateRuntimeUnionTargetSort
} from './projection'

export type RuntimeUnionTargetPayload = {
    objectCollection: RuntimeObjectCollectionRow
    columns: RuntimeColumnDefinition[]
}

export const resolveRuntimeUnionTargetContext = async (params: {
    manager: DbExecutor
    schemaIdent: string
    runtimeObjects: RuntimeObjectCollectionRow[]
    target: RecordsUnionDatasource['targets'][number]
    sort: RuntimeDatasourceSort[] | undefined
    filters: RuntimeDatasourceFilter[] | undefined
    currentWorkspaceId: string | null
    projectedFields: string[] | undefined
    locale: string
}): Promise<{
    objectCollection: RuntimeObjectCollectionRow
    components: RuntimeReadableComponent[]
    physicalComponents: RuntimeReadableComponent[]
    targetSort: RuntimeDatasourceSort[] | undefined
    targetFilters: RuntimeDatasourceFilter[] | undefined
    enumOptionsMap: Map<string, RuntimeRefOption[]>
    projectionSpecs: RuntimeUnionProjectionSpec[]
}> => {
    const objectCollection = resolveRecordsUnionTargetObject(params.runtimeObjects, params.target)
    if (!objectCollection) {
        throw new UpdateFailure(404, {
            error: 'Records union datasource target was not found',
            target: params.target
        })
    }

    const objectKind = resolveRuntimeStandardKind(objectCollection.kind)
    if (objectKind === 'page' || !IDENTIFIER_REGEX.test(objectCollection.table_name ?? '')) {
        throw new UpdateFailure(400, {
            error: 'Records union datasource targets must be runtime object collections',
            target: params.target
        })
    }
    if (readRuntimeAccessEntryConfig(objectCollection.config)) {
        throw new UpdateFailure(403, {
            error: 'Records union datasource target is restricted',
            target: resolveRuntimeCodenameText(objectCollection.codename)
        })
    }

    const components = (await loadRuntimeReadableComponents(params.manager, params.schemaIdent, objectCollection.id)).filter((cmp) =>
        IDENTIFIER_REGEX.test(cmp.column_name)
    )
    const physicalComponents = components.filter((cmp) => cmp.data_type !== 'TABLE')
    const targetSort = translateRuntimeUnionTargetSort(params.target, params.sort)
    const targetFilters = translateRuntimeUnionTargetFilters(params.target, params.filters)
    const unsupportedListFields = findUnsupportedRuntimeListFields(physicalComponents, targetSort, targetFilters)
    if (unsupportedListFields.length > 0) {
        throw new UpdateFailure(400, {
            error: 'Runtime list query references unknown or unsupported fields',
            fields: unsupportedListFields,
            target: resolveRuntimeCodenameText(objectCollection.codename)
        })
    }
    const enumOptionsMap = await loadRuntimeEnumOptionsMap({
        manager: params.manager,
        schemaIdent: params.schemaIdent,
        components,
        locale: params.locale
    })
    const projectionSpecs = await buildRuntimeUnionProjectionSpecs({
        manager: params.manager,
        schemaIdent: params.schemaIdent,
        currentWorkspaceId: params.currentWorkspaceId,
        target: params.target,
        projectedFields: params.projectedFields,
        objectCollection,
        physicalComponents,
        enumOptionsMap,
        locale: params.locale
    })

    return {
        objectCollection,
        components,
        physicalComponents,
        targetSort,
        targetFilters,
        enumOptionsMap,
        projectionSpecs
    }
}

export const buildRuntimeUnionTargetQuery = async (params: {
    manager: DbExecutor
    schemaIdent: string
    applicationId: string
    runtimeContext: Exclude<Awaited<ReturnType<typeof resolveRuntimeSchema>>, null>
    target: RecordsUnionDatasource['targets'][number]
    objectCollection: RuntimeObjectCollectionRow
    components: RuntimeReadableComponent[]
    physicalComponents: RuntimeReadableComponent[]
    targetSort: RuntimeDatasourceSort[] | undefined
    targetFilters: RuntimeDatasourceFilter[] | undefined
    enumOptionsMap: Map<string, RuntimeRefOption[]>
    projectionSpecs: RuntimeUnionProjectionSpec[]
    locale: string
    lifecycleState: 'active' | 'deleted'
    libraryView: 'all' | 'recent' | 'starred' | 'shared'
    search: string | undefined
    shouldProjectRecentAt: boolean
    shouldProjectSharedAt: boolean
}): Promise<{
    dataTableIdent: string
    activeObjectRowCondition: string
    runtimeListClauses: ReturnType<typeof buildRuntimeListClauses>
    recordAccessClause: string | null
    libraryViewClause: string | null
    effectiveProjectionSpecs: RuntimeUnionProjectionSpec[]
    runtimeStarredExistsClause: string | null
    runtimeSharedExistsClause: string | null
}> => {
    const currentWorkspaceId = params.runtimeContext.currentWorkspaceId
    const { manager, schemaIdent } = params
    const { objectCollection } = params
    const { runtimeConfig } = await resolveRuntimeObjectCollectionConfig({
        manager,
        applicationId: params.applicationId,
        userId: params.runtimeContext.userId,
        role: params.runtimeContext.role,
        workspaceId: currentWorkspaceId,
        // Layout selection does not depend on the record projection locale.
        // Keep the trusted resolver input on its canonical default so an
        // arbitrary display-locale string cannot turn into a layout request.
        locale: 'en',
        objectCollectionId: objectCollection.id
    })
    const reorderFieldAttr = resolveRuntimeReorderField(
        params.components,
        runtimeConfig.enableRowReordering ? runtimeConfig.reorderPersistenceField : null
    )
    const dataTableIdent = `${schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
    const activeObjectRowCondition =
        params.lifecycleState === 'deleted'
            ? buildRuntimeDeletedRowCondition(objectCollection.lifecycleContract, objectCollection.config, undefined, currentWorkspaceId)
            : buildRuntimeActiveRowCondition(objectCollection.lifecycleContract, objectCollection.config, undefined, currentWorkspaceId)
    const runtimeListClauses = buildRuntimeListClauses({
        activeCondition: activeObjectRowCondition,
        attrs: params.physicalComponents,
        search: params.search,
        sort: params.targetSort,
        filters: params.targetFilters,
        fallbackOrderBy: buildRuntimeRowsOrderBy(reorderFieldAttr?.column_name ?? null),
        currentUserId: params.runtimeContext.userId
    })
    const objectCodename = resolveRuntimeCodenameText(objectCollection.codename)
    const recordAccessClause = await buildRuntimeRecordAccessClause({
        manager,
        schemaIdent,
        currentWorkspaceId,
        currentUserId: params.runtimeContext.userId,
        permissions: params.runtimeContext.permissions,
        objectCodename,
        attrs: params.components,
        config: objectCollection.config,
        outerRowIdSql: `${dataTableIdent}.id`,
        values: runtimeListClauses.values
    })
    const libraryViewClause = await buildRuntimeLibraryViewClause({
        manager,
        schemaIdent,
        currentWorkspaceId,
        currentUserId: params.runtimeContext.userId,
        objectCodename,
        config: objectCollection.config,
        libraryView: params.libraryView,
        outerRowIdSql: `${dataTableIdent}.id`,
        values: runtimeListClauses.values
    })
    let runtimeStarredExistsClause: string | null = null
    let runtimeSharedExistsClause: string | null = null
    let runtimeRecentAtValueSql: string | null = null
    let runtimeSharedAtValueSql: string | null = null
    const runtimeLibraryConfig = readRuntimeLibraryConfig(objectCollection.config)
    const starredRelation = runtimeLibraryConfig?.starred
    if (starredRelation && params.runtimeContext.userId) {
        const starredBinding = await resolveRuntimeRelationBinding({
            manager,
            schemaIdent,
            currentWorkspaceId,
            relation: starredRelation
        })
        if (starredBinding?.actorColumnName) {
            runtimeStarredExistsClause = buildRuntimeRelationExistsClause({
                binding: starredBinding,
                currentObjectCodename: objectCodename,
                currentUserId: params.runtimeContext.userId,
                outerRowIdSql: `${dataTableIdent}.id`,
                values: runtimeListClauses.values,
                kind: 'starred'
            })
        }
    }
    const sharedRelation = runtimeLibraryConfig?.shared
    let sharedBinding: RuntimeRelationBinding | null = null
    if (sharedRelation && params.runtimeContext.userId) {
        sharedBinding = await resolveRuntimeRelationBinding({
            manager,
            schemaIdent,
            currentWorkspaceId,
            relation: sharedRelation
        })
        if (sharedBinding?.principalTypeColumnName && sharedBinding.principalIdColumnName) {
            runtimeSharedExistsClause = buildRuntimeRelationExistsClause({
                binding: sharedBinding,
                currentObjectCodename: objectCodename,
                currentUserId: params.runtimeContext.userId,
                outerRowIdSql: `${dataTableIdent}.id`,
                values: runtimeListClauses.values,
                kind: 'shared'
            })
        }
        if (params.shouldProjectSharedAt && sharedBinding?.timestampColumnName) {
            runtimeSharedAtValueSql = buildRuntimeSharedRelationTimestampValueSql({
                binding: sharedBinding,
                currentObjectCodename: objectCodename,
                currentUserId: params.runtimeContext.userId,
                outerRowIdSql: `${dataTableIdent}.id`,
                values: runtimeListClauses.values
            })
        }
    }
    const recentRelation = runtimeLibraryConfig?.recent
    if (params.shouldProjectRecentAt && recentRelation && params.runtimeContext.userId) {
        const recentBinding = await resolveRuntimeRelationBinding({
            manager,
            schemaIdent,
            currentWorkspaceId,
            relation: recentRelation
        })
        if (recentBinding?.actorColumnName && recentBinding.timestampColumnName) {
            runtimeRecentAtValueSql = buildRuntimeRelationTimestampValueSql({
                binding: recentBinding,
                currentObjectCodename: objectCodename,
                currentUserId: params.runtimeContext.userId,
                outerRowIdSql: `${dataTableIdent}.id`,
                values: runtimeListClauses.values
            })
        }
    }
    const effectiveProjectionSpecs = [
        ...params.projectionSpecs,
        ...(runtimeRecentAtValueSql
            ? [buildRuntimeUnionRecentAtProjectionSpec(objectCollection.id, params.locale, runtimeRecentAtValueSql)]
            : []),
        ...(runtimeSharedAtValueSql
            ? [buildRuntimeUnionSharedAtProjectionSpec(objectCollection.id, params.locale, runtimeSharedAtValueSql)]
            : [])
    ]

    return {
        dataTableIdent,
        activeObjectRowCondition,
        runtimeListClauses,
        recordAccessClause,
        libraryViewClause,
        effectiveProjectionSpecs,
        runtimeStarredExistsClause,
        runtimeSharedExistsClause
    }
}

export const buildRuntimeUnionTargetSelect = (params: {
    schemaIdent: string
    objectCollection: RuntimeObjectCollectionRow
    components: RuntimeReadableComponent[]
    physicalComponents: RuntimeReadableComponent[]
    target: RecordsUnionDatasource['targets'][number]
    targetIndex: number
    locale: string
    dataTableIdent: string
    activeObjectRowCondition: string
    runtimeListClauses: ReturnType<typeof buildRuntimeListClauses>
    recordAccessClause: string | null
    libraryViewClause: string | null
    effectiveProjectionSpecs: RuntimeUnionProjectionSpec[]
    runtimeStarredExistsClause: string | null
    runtimeSharedExistsClause: string | null
    enumOptionsMap: Map<string, RuntimeRefOption[]>
    unionValues: unknown[]
    unionSelects: string[]
}): RuntimeUnionTargetPayload => {
    const { schemaIdent, objectCollection, components, physicalComponents, target, locale } = params
    const { dataTableIdent, activeObjectRowCondition, runtimeListClauses, effectiveProjectionSpecs } = params
    const valueOffset = params.unionValues.length
    params.unionValues.push(...runtimeListClauses.values)
    const runtimeListWhereSql = [runtimeListClauses.whereSql, params.recordAccessClause, params.libraryViewClause]
        .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
        .map((clause) => remapRuntimeUnionSqlPlaceholders(clause, valueOffset))
        .join(' AND ')
    const recordBehavior = normalizeRuntimeRecordBehavior(objectCollection.config)
    const recordBehaviorEnabled = isRuntimeRecordBehaviorEnabled(recordBehavior)
    const includeRuntimeRowVersion = true
    const objectCodename = resolveRuntimeCodenameText(objectCollection.codename)
    const jsonPairs = [
        `${quoteSqlLiteral('id')}, ${quoteSqlLiteral(`${objectCollection.id}:`)} || id::text`,
        `${quoteSqlLiteral('__runtimeObjectCollectionId')}, ${quoteSqlLiteral(objectCollection.id)}`,
        `${quoteSqlLiteral('__runtimeObjectCollectionCodename')}, ${quoteSqlLiteral(objectCodename)}`,
        `${quoteSqlLiteral('__runtimeSourceRowId')}, id::text`,
        `${quoteSqlLiteral('__runtimeStarred')}, ${
            params.runtimeStarredExistsClause
                ? `to_jsonb(${remapRuntimeUnionSqlPlaceholders(params.runtimeStarredExistsClause, valueOffset)})`
                : 'to_jsonb(false)'
        }`,
        `${quoteSqlLiteral('__runtimeShared')}, ${
            params.runtimeSharedExistsClause
                ? `to_jsonb(${remapRuntimeUnionSqlPlaceholders(params.runtimeSharedExistsClause, valueOffset)})`
                : 'to_jsonb(false)'
        }`,
        `${quoteSqlLiteral('__runtimeDisplayType')}, ${quoteSqlLiteral(
            target.displayType ?? resolvePresentationName(objectCollection.presentation, locale, objectCodename)
        )}`
    ]
    for (const spec of effectiveProjectionSpecs) {
        jsonPairs.push(
            `${quoteSqlLiteral(spec.field)}, ${
                spec.valueSql.includes('$') ? remapRuntimeUnionSqlPlaceholders(spec.valueSql, valueOffset) : spec.valueSql
            }`
        )
    }

    if (recordBehaviorEnabled) {
        for (const field of RUNTIME_RECORD_SYSTEM_FIELDS) {
            jsonPairs.push(`${quoteSqlLiteral(field)}, ${quoteIdentifier(field)}`)
        }
    }
    if (includeRuntimeRowVersion) {
        jsonPairs.push(`${quoteSqlLiteral('_upl_version')}, ${quoteIdentifier('_upl_version')}`)
    }

    for (const component of physicalComponents) {
        jsonPairs.push(`${quoteSqlLiteral(component.column_name)}, ${buildRuntimeComponentJsonValueSql(component, locale)}`)
    }

    for (const tableComponent of components.filter((cmp) => cmp.data_type === 'TABLE')) {
        const fallbackTabTableName = generateChildTableName(tableComponent.id)
        const tabTableName =
            typeof tableComponent.column_name === 'string' && IDENTIFIER_REGEX.test(tableComponent.column_name)
                ? tableComponent.column_name
                : fallbackTabTableName
        if (!IDENTIFIER_REGEX.test(tabTableName)) continue
        const tabTableIdent = `${schemaIdent}.${quoteIdentifier(tabTableName)}`
        jsonPairs.push(
            `${quoteSqlLiteral(
                tableComponent.column_name
            )}, (SELECT COUNT(*)::int FROM ${tabTableIdent} WHERE _tp_parent_id = ${dataTableIdent}.id AND ${activeObjectRowCondition})`
        )
    }

    params.unionSelects.push(`
      SELECT
        jsonb_build_object(${jsonPairs.join(', ')}) AS row_data,
        ${params.targetIndex} AS target_order,
        row_number() OVER (ORDER BY ${runtimeListClauses.orderBySql}) AS row_order
      FROM ${dataTableIdent}
      WHERE ${runtimeListWhereSql}
    `)

    const columns = [
        ...effectiveProjectionSpecs.map((spec) => spec.column),
        ...components
            .filter((component) => !isRuntimeUnionProjectedSourceComponent(component, effectiveProjectionSpecs))
            .map((component) => mapRuntimeComponentToColumnDefinition({ component, enumOptionsMap: params.enumOptionsMap, locale }))
    ]

    return {
        objectCollection,
        columns
    }
}
