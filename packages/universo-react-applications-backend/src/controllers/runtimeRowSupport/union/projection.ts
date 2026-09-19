import type { DbExecutor } from '@universo-react/utils'
import type { RuntimeDatasourceFilter, RuntimeDatasourceSort, RecordsUnionDatasource } from '@universo-react/types'
import { resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'
import {
    IDENTIFIER_REGEX,
    quoteIdentifier,
    normalizeLocale,
    runtimeCodenameTextSql,
    resolveRuntimeCodenameText,
    resolvePresentationName,
    buildRuntimeActiveRowCondition,
    type RuntimeRefOption
} from '../../../shared/runtimeHelpers'
import {
    RUNTIME_OBJECT_FILTER_SQL,
    RUNTIME_UNION_PROJECTION_LABELS,
    isRuntimeEnumerationKind,
    isRuntimeObjectTargetKind,
    type RuntimeColumnDefinition,
    type RuntimeListComponent,
    type RuntimeObjectCollectionRow,
    type RuntimeReadableComponent,
    type RuntimeUnionProjectionSpec,
    type RuntimeUnionSystemProjectionField
} from '../contracts'
import { loadRuntimeReadableComponents, mapRuntimeComponentToColumnDefinition } from '../objects'
import { findRuntimeListComponent, isLocalizedRuntimeListString, normalizeRuntimeListFieldKey } from '../list'

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
