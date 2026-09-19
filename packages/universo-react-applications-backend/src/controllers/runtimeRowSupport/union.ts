import { type DbExecutor } from '@universo-react/utils'
import { type RuntimeDatasourceFilter, type RuntimeDatasourceSort, type RecordsUnionDatasource } from '@universo-react/types'
import { normalizeObjectCollectionRuntimeViewConfig, resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'
import { generateChildTableName } from '@universo-react/schema-ddl'
import { isRuntimeRecordBehaviorEnabled, normalizeRuntimeRecordBehavior } from '../../services/runtimeRecordBehavior'
import {
    UpdateFailure,
    IDENTIFIER_REGEX,
    quoteIdentifier,
    normalizeLocale,
    runtimeCodenameTextSql,
    resolveRuntimeCodenameText,
    resolvePresentationName,
    buildRuntimeActiveRowCondition,
    buildRuntimeDeletedRowCondition,
    resolveRuntimeSchema,
    type RuntimeRefOption
} from '../../shared/runtimeHelpers'
import {
    RUNTIME_OBJECT_FILTER_SQL,
    RUNTIME_RECORD_SYSTEM_FIELDS,
    RUNTIME_UNION_PROJECTION_LABELS,
    createEmptyRuntimeZoneWidgets,
    isRuntimeEnumerationKind,
    isRuntimeObjectTargetKind,
    resolveRuntimeStandardKind,
    type RuntimeColumnDefinition,
    type RuntimeListComponent,
    type RuntimeObjectCollectionRow,
    type RuntimeReadableComponent,
    type RuntimeRelationBinding,
    type RuntimeUnionProjectionSpec,
    type RuntimeUnionSystemProjectionField
} from './contracts'
import {
    loadRuntimeEnumOptionsMap,
    loadRuntimeObjectCollections,
    loadRuntimeReadableComponents,
    mapRuntimeComponentToColumnDefinition,
    resolveRuntimeObjectCollectionConfig
} from './objects'
import { readConfiguredWorkflowActions } from './workflow'
import {
    buildRuntimeListClauses,
    buildRuntimeRowsOrderBy,
    findRuntimeListComponent,
    findUnsupportedRuntimeListFields,
    isLocalizedRuntimeListString,
    normalizeRuntimeListFieldKey,
    resolveRuntimeReorderField
} from './list'
import {
    buildRuntimeLibraryViewClause,
    buildRuntimeRecordAccessClause,
    buildRuntimeRelationExistsClause,
    buildRuntimeRelationTimestampValueSql,
    buildRuntimeSharedRelationTimestampValueSql,
    readRuntimeAccessEntryConfig,
    readRuntimeLibraryConfig,
    resolveRuntimeRelationBinding
} from './access'

export const resolveRuntimeUnionProjectionLabel = (field: RuntimeUnionSystemProjectionField, locale: string): string =>
    locale.toLowerCase().startsWith('ru') ? RUNTIME_UNION_PROJECTION_LABELS[field].ru : RUNTIME_UNION_PROJECTION_LABELS[field].en

export const quoteSqlLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`

export const runtimeLocalizedTextSql = (columnRef: string, locale: string): string => {
    const localeKey = normalizeLocale(locale) || 'en'
    return `COALESCE(${columnRef}->'locales'->${quoteSqlLiteral(localeKey)}->>'content', ${runtimeCodenameTextSql(columnRef)})`
}

export const buildRuntimeComponentJsonValueSql = (component: RuntimeListComponent, locale = 'en'): string =>
    component.data_type === 'STRING'
        ? isLocalizedRuntimeListString(component)
            ? runtimeLocalizedTextSql(quoteIdentifier(component.column_name), locale)
            : quoteIdentifier(component.column_name)
        : component.data_type === 'NUMBER'
        ? `to_jsonb(${quoteIdentifier(component.column_name)})`
        : quoteIdentifier(component.column_name)

export const buildRuntimeUnionEnumRefLabelSql = (
    component: RuntimeReadableComponent,
    enumOptionsMap: Map<string, RuntimeRefOption[]>
): string | null => {
    if (
        component.data_type !== 'REF' ||
        !isRuntimeEnumerationKind(component.target_object_kind) ||
        !component.target_object_id ||
        !IDENTIFIER_REGEX.test(component.column_name)
    ) {
        return null
    }

    const options = enumOptionsMap.get(component.target_object_id)
    if (!options || options.length === 0) {
        return null
    }

    const optionRowsSql = options.map((option) => `(${quoteSqlLiteral(option.id)}, ${quoteSqlLiteral(option.label)})`).join(', ')

    return `
        COALESCE(
          (
            SELECT runtime_enum_option.label
            FROM (VALUES ${optionRowsSql}) AS runtime_enum_option(id, label)
            WHERE runtime_enum_option.id = ${quoteIdentifier(component.column_name)}::text
            LIMIT 1
          ),
          ${quoteIdentifier(component.column_name)}::text
        )
    `
}

export const buildRuntimeUnionComponentProjectionSql = (
    component: RuntimeReadableComponent,
    enumOptionsMap: Map<string, RuntimeRefOption[]>,
    locale: string
): string => buildRuntimeUnionEnumRefLabelSql(component, enumOptionsMap) ?? buildRuntimeComponentJsonValueSql(component, locale)

export const findRuntimeComponentByFieldKey = (components: RuntimeListComponent[], fieldKey: string | null | undefined) => {
    const normalizedFieldKey = typeof fieldKey === 'string' ? fieldKey.trim() : ''
    if (!normalizedFieldKey) return null
    return findRuntimeListComponent(components, normalizedFieldKey) as RuntimeReadableComponent | null
}

export const buildRuntimeObjectRefLabelProjectionSql = async (params: {
    manager: DbExecutor
    schemaIdent: string
    sourceTableIdent: string
    currentWorkspaceId: string | null
    component: RuntimeReadableComponent
    locale: string
}): Promise<string | null> => {
    const targetObjectId = params.component.target_object_id
    if (
        params.component.data_type !== 'REF' ||
        !targetObjectId ||
        !isRuntimeObjectTargetKind(params.component.target_object_kind) ||
        !IDENTIFIER_REGEX.test(params.component.column_name)
    ) {
        return null
    }

    const targetObjectRows = (await params.manager.query(
        `
      SELECT id, table_name, config
      FROM ${params.schemaIdent}._app_objects
      WHERE id = $1
        AND ${RUNTIME_OBJECT_FILTER_SQL}
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
        [targetObjectId]
    )) as Array<{ id: string; table_name: string; config?: Record<string, unknown> | null }>
    const targetObject = targetObjectRows[0]
    if (!targetObject || !IDENTIFIER_REGEX.test(targetObject.table_name)) return null

    const targetComponents = await loadRuntimeReadableComponents(params.manager, params.schemaIdent, targetObject.id)
    const labelComponent =
        targetComponents.find((component) => component.is_display_component && IDENTIFIER_REGEX.test(component.column_name)) ??
        targetComponents.find((component) => component.data_type === 'STRING' && IDENTIFIER_REGEX.test(component.column_name)) ??
        targetComponents.find((component) => IDENTIFIER_REGEX.test(component.column_name))
    if (!labelComponent) return null

    const targetLifecycleContract = resolveApplicationLifecycleContractFromConfig(targetObject.config)
    const targetActiveCondition = buildRuntimeActiveRowCondition(
        targetLifecycleContract,
        targetObject.config,
        'ref',
        params.currentWorkspaceId
    )
    const sourceColumnSql = `${params.sourceTableIdent}.${quoteIdentifier(params.component.column_name)}`
    const labelColumnSql = `ref.${quoteIdentifier(labelComponent.column_name)}`
    const labelSql =
        labelComponent.data_type === 'STRING'
            ? isLocalizedRuntimeListString(labelComponent)
                ? runtimeLocalizedTextSql(labelColumnSql, params.locale)
                : labelColumnSql
            : `to_jsonb(${labelColumnSql})`

    return `
        CASE
          WHEN ${sourceColumnSql} IS NULL THEN NULL
          ELSE (
            SELECT jsonb_build_object('id', ref.id::text, 'label', ${labelSql})
            FROM ${params.schemaIdent}.${quoteIdentifier(targetObject.table_name)} ref
            WHERE ref.id::text = ${sourceColumnSql}::text
              AND ${targetActiveCondition}
            LIMIT 1
          )
        END
    `
}

export const buildRuntimeUnionProjectionSpecs = async (params: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId: string | null
    target: RecordsUnionDatasource['targets'][number]
    projectedFields?: string[]
    objectCollection: RuntimeObjectCollectionRow
    physicalComponents: RuntimeReadableComponent[]
    enumOptionsMap: Map<string, RuntimeRefOption[]>
    locale: string
}): Promise<RuntimeUnionProjectionSpec[]> => {
    const { target, objectCollection, physicalComponents, enumOptionsMap, locale } = params
    const specs: RuntimeUnionProjectionSpec[] = [
        {
            field: 'type',
            sourceColumnName: null,
            valueSql: quoteSqlLiteral(
                resolvePresentationName(objectCollection.presentation, locale, resolveRuntimeCodenameText(objectCollection.codename))
            ),
            column: {
                id: `${objectCollection.id}:__runtimeUnionType`,
                codename: 'Type',
                field: 'type',
                dataType: 'STRING',
                headerName: resolveRuntimeUnionProjectionLabel('type', locale),
                isDisplayComponent: false,
                isRequired: false,
                validationRules: {},
                uiConfig: {
                    gridSortable: false,
                    gridFilterable: false
                },
                refTargetEntityId: null,
                refTargetEntityKind: null,
                refTargetConstantId: null
            }
        }
    ]

    const addComponentProjection = (field: RuntimeUnionSystemProjectionField, sourceField: string | undefined) => {
        const component = findRuntimeComponentByFieldKey(physicalComponents, sourceField)
        if (!component || component.data_type === 'JSON' || component.data_type === 'TABLE') return

        const sourceColumn = mapRuntimeComponentToColumnDefinition({ component, enumOptionsMap, locale })
        specs.push({
            field,
            sourceColumnName: component.column_name,
            valueSql: buildRuntimeUnionComponentProjectionSql(component, enumOptionsMap, locale),
            column: {
                ...sourceColumn,
                id: `${objectCollection.id}:__runtimeUnion${field[0].toUpperCase()}${field.slice(1)}`,
                codename: field === 'updatedAt' ? 'UpdatedAt' : field[0].toUpperCase() + field.slice(1),
                field,
                headerName: resolveRuntimeUnionProjectionLabel(field, locale),
                uiConfig: {
                    ...(sourceColumn.uiConfig ?? {}),
                    ...(field === 'updatedAt' ? { gridFilterable: false } : {})
                }
            }
        })
    }

    const addConfiguredProjection = (field: string) => {
        const normalizedField = field.trim()
        const component = findRuntimeComponentByFieldKey(physicalComponents, normalizedField)
        if (!normalizedField || !component || component.data_type === 'JSON' || component.data_type === 'TABLE') return

        const sourceColumn = mapRuntimeComponentToColumnDefinition({ component, enumOptionsMap, locale })
        specs.push({
            field: normalizedField,
            sourceColumnName: component.column_name,
            valueSql: buildRuntimeUnionComponentProjectionSql(component, enumOptionsMap, locale),
            column: {
                ...sourceColumn,
                id: `${objectCollection.id}:__runtimeUnion${normalizedField}`,
                field: normalizedField
            }
        })
    }

    addComponentProjection('title', target.titleField)
    addComponentProjection('status', target.statusField)
    const projectComponent = findRuntimeComponentByFieldKey(physicalComponents, target.projectField)
    if (projectComponent) {
        const projectLabelSql = await buildRuntimeObjectRefLabelProjectionSql({
            manager: params.manager,
            schemaIdent: params.schemaIdent,
            sourceTableIdent: `${params.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`,
            currentWorkspaceId: params.currentWorkspaceId,
            component: projectComponent,
            locale
        })
        if (projectLabelSql) {
            specs.push({
                field: 'project',
                sourceColumnName: projectComponent.column_name,
                valueSql: projectLabelSql,
                column: {
                    id: `${objectCollection.id}:__runtimeUnionProject`,
                    codename: 'Project',
                    field: 'project',
                    dataType: 'STRING',
                    headerName: resolveRuntimeUnionProjectionLabel('project', locale),
                    isDisplayComponent: false,
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {
                        gridSortable: false,
                        gridFilterable: false
                    },
                    refTargetEntityId: null,
                    refTargetEntityKind: null,
                    refTargetConstantId: null
                }
            })
        }
    }
    addComponentProjection('updatedAt', target.updatedAtField)
    for (const projectedField of params.projectedFields ?? []) {
        addConfiguredProjection(projectedField)
    }

    return specs
}

export const buildRuntimeUnionRecentAtProjectionSpec = (
    objectCollectionId: string,
    locale: string,
    valueSql: string
): RuntimeUnionProjectionSpec => ({
    field: 'recentAt',
    sourceColumnName: null,
    valueSql,
    column: {
        id: `${objectCollectionId}:__runtimeUnionRecentAt`,
        codename: 'RecentAt',
        field: 'recentAt',
        dataType: 'DATE',
        headerName: resolveRuntimeUnionProjectionLabel('recentAt', locale),
        isDisplayComponent: false,
        isRequired: false,
        validationRules: {},
        uiConfig: {
            gridFilterable: false
        },
        refTargetEntityId: null,
        refTargetEntityKind: null,
        refTargetConstantId: null
    }
})

export const buildRuntimeUnionSharedAtProjectionSpec = (
    objectCollectionId: string,
    locale: string,
    valueSql: string
): RuntimeUnionProjectionSpec => ({
    field: 'sharedAt',
    sourceColumnName: null,
    valueSql,
    column: {
        id: `${objectCollectionId}:__runtimeUnionSharedAt`,
        codename: 'SharedAt',
        field: 'sharedAt',
        dataType: 'DATE',
        headerName: resolveRuntimeUnionProjectionLabel('sharedAt', locale),
        isDisplayComponent: false,
        isRequired: false,
        validationRules: {},
        uiConfig: {
            gridFilterable: false
        },
        refTargetEntityId: null,
        refTargetEntityKind: null,
        refTargetConstantId: null
    }
})

export const isRuntimeUnionProjectedSourceComponent = (
    component: RuntimeReadableComponent,
    projectionSpecs: RuntimeUnionProjectionSpec[]
): boolean => {
    const sourceKeys = new Set(
        projectionSpecs
            .map((spec) => spec.sourceColumnName)
            .filter((value): value is string => Boolean(value))
            .map((value) => normalizeRuntimeListFieldKey(value))
    )
    if (sourceKeys.size === 0) return false

    return (
        sourceKeys.has(normalizeRuntimeListFieldKey(component.column_name)) ||
        sourceKeys.has(normalizeRuntimeListFieldKey(resolveRuntimeCodenameText(component.codename)))
    )
}

export const mergeRuntimeUnionColumns = (columnGroups: RuntimeColumnDefinition[][]): RuntimeColumnDefinition[] => {
    const columnsByField = new Map<string, RuntimeColumnDefinition>()

    const mergeOptions = (left: RuntimeRefOption[] | undefined, right: RuntimeRefOption[] | undefined): RuntimeRefOption[] | undefined => {
        const options = [...(left ?? []), ...(right ?? [])]
        if (options.length === 0) return undefined
        return Array.from(new Map(options.map((option) => [option.id, option])).values())
    }

    for (const columns of columnGroups) {
        for (const column of columns) {
            const existing = columnsByField.get(column.field)
            if (!existing) {
                columnsByField.set(column.field, column)
                continue
            }

            columnsByField.set(column.field, {
                ...existing,
                refOptions: mergeOptions(existing.refOptions, column.refOptions),
                enumOptions: mergeOptions(existing.enumOptions, column.enumOptions),
                childColumns: existing.childColumns ?? column.childColumns
            })
        }
    }

    return Array.from(columnsByField.values())
}

export const resolveRecordsUnionTargetObject = (
    runtimeObjects: RuntimeObjectCollectionRow[],
    target: RecordsUnionDatasource['targets'][number]
): RuntimeObjectCollectionRow | null => {
    const targetId = target.sectionId ?? target.objectCollectionId ?? null
    if (targetId) {
        return runtimeObjects.find((objectRow) => objectRow.id === targetId) ?? null
    }

    const targetCodename = (target.sectionCodename ?? target.objectCollectionCodename ?? '').trim().toLowerCase()
    if (!targetCodename) return null
    return (
        runtimeObjects.find((objectRow) => resolveRuntimeCodenameText(objectRow.codename).trim().toLowerCase() === targetCodename) ?? null
    )
}

export const remapRuntimeUnionSqlPlaceholders = (sql: string, offset: number): string =>
    sql.replace(/\$(\d+)/g, (_match, index: string) => `$${Number(index) + offset}`)

export const normalizeRuntimeUnionProjectionField = (field: string): RuntimeUnionSystemProjectionField | null => {
    const normalized = normalizeRuntimeListFieldKey(field)
    if (normalized === 'type') return 'type'
    if (normalized === 'title') return 'title'
    if (normalized === 'status') return 'status'
    if (normalized === 'updatedat' || normalized === 'updated_at' || normalized === 'updated') return 'updatedAt'
    if (normalized === 'recentat' || normalized === 'recent_at' || normalized === 'viewed' || normalized === 'viewedat') return 'recentAt'
    if (normalized === 'sharedat' || normalized === 'shared_at' || normalized === 'shared') return 'sharedAt'
    return null
}

export const resolveRuntimeUnionTargetQueryField = (target: RecordsUnionDatasource['targets'][number], field: string): string | null => {
    const projectionField = normalizeRuntimeUnionProjectionField(field)
    if (projectionField === 'title' && target.titleField) return target.titleField
    if (projectionField === 'status' && target.statusField) return target.statusField
    if (projectionField === 'updatedAt' && target.updatedAtField) return target.updatedAtField
    if (projectionField) return null
    return field
}

export const translateRuntimeUnionTargetSort = (
    target: RecordsUnionDatasource['targets'][number],
    sort: RuntimeDatasourceSort[] | undefined
): RuntimeDatasourceSort[] | undefined =>
    sort?.flatMap((item) => {
        const field = resolveRuntimeUnionTargetQueryField(target, item.field)
        return field ? [{ ...item, field }] : []
    })

export const translateRuntimeUnionTargetFilters = (
    target: RecordsUnionDatasource['targets'][number],
    filters: RuntimeDatasourceFilter[] | undefined
): RuntimeDatasourceFilter[] | undefined =>
    filters?.map((item) => ({
        ...item,
        field: resolveRuntimeUnionTargetQueryField(target, item.field) ?? item.field
    }))

export const resolveRuntimeUnionOutputSortField = (sortField: string, targets: RecordsUnionDatasource['targets']): string => {
    const projectionField = normalizeRuntimeUnionProjectionField(sortField)
    if (projectionField) return projectionField

    const normalized = normalizeRuntimeListFieldKey(sortField)
    if (targets.some((target) => target.titleField && normalizeRuntimeListFieldKey(target.titleField) === normalized)) return 'title'
    if (targets.some((target) => target.statusField && normalizeRuntimeListFieldKey(target.statusField) === normalized)) return 'status'
    if (targets.some((target) => target.updatedAtField && normalizeRuntimeListFieldKey(target.updatedAtField) === normalized))
        return 'updatedAt'

    return sortField
}

export const buildRuntimeUnionOrderBySql = (
    sort: RuntimeDatasourceSort[] | undefined,
    targets: RecordsUnionDatasource['targets']
): string => {
    if (!sort?.length) return 'target_order ASC, row_order ASC'

    return [
        ...sort.map((sortItem) => {
            const direction = sortItem.direction === 'desc' ? 'DESC' : 'ASC'
            return `row_data ->> ${quoteSqlLiteral(resolveRuntimeUnionOutputSortField(sortItem.field, targets))} ${direction} NULLS LAST`
        }),
        `row_data ->> 'id' ASC`
    ].join(', ')
}

type RuntimeUnionTargetPayload = {
    objectCollection: RuntimeObjectCollectionRow
    columns: RuntimeColumnDefinition[]
}

const resolveRuntimeUnionTargetContext = async (params: {
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

const buildRuntimeUnionTargetQuery = async (params: {
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

const buildRuntimeUnionTargetSelect = (params: {
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
