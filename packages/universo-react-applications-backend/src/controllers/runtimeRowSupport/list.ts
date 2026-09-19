import { escapeLikeWildcards } from '@universo-react/utils'
import { type RuntimeDatasourceFilter, type RuntimeDatasourceSort } from '@universo-react/types'
import {
    IDENTIFIER_REGEX,
    quoteIdentifier,
    runtimeCodenameTextSql,
    resolveRuntimeCodenameText,
    type RuntimeDataType
} from '../../shared/runtimeHelpers'
import { RUNTIME_CURRENT_USER_ID_TOKEN, type RuntimeListComponent } from './contracts'
import { isRecordValue } from './access'

export const resolveRuntimeReorderField = (
    attrs: Array<{ codename: unknown; column_name: string; data_type: string }>,
    reorderPersistenceField: string | null
) => {
    if (!reorderPersistenceField) return null

    const target = reorderPersistenceField.trim().toLowerCase()
    if (!target) return null

    return (
        attrs.find(
            (cmp) =>
                cmp.data_type === 'NUMBER' &&
                IDENTIFIER_REGEX.test(cmp.column_name) &&
                (cmp.column_name.toLowerCase() === target || resolveRuntimeCodenameText(cmp.codename).trim().toLowerCase() === target)
        ) ?? null
    )
}

export const buildRuntimeRowsOrderBy = (reorderColumnName: string | null) => {
    if (!reorderColumnName || !IDENTIFIER_REGEX.test(reorderColumnName)) {
        return '_upl_created_at ASC NULLS LAST, id ASC'
    }

    return `${quoteIdentifier(reorderColumnName)} ASC NULLS LAST, _upl_created_at ASC NULLS LAST, id ASC`
}

export const normalizeRuntimeListFieldKey = (value: unknown) =>
    (typeof value === 'string' ? value : resolveRuntimeCodenameText(value)).trim().toLowerCase()

export const isLocalizedRuntimeListString = (cmp: RuntimeListComponent): boolean =>
    cmp.data_type === 'STRING' && Boolean(cmp.validation_rules?.versioned || cmp.validation_rules?.localized)

export const resolveRuntimeListColumnSql = (cmp: RuntimeListComponent): string => {
    const columnSql = quoteIdentifier(cmp.column_name)
    return isLocalizedRuntimeListString(cmp) ? runtimeCodenameTextSql(columnSql) : columnSql
}

export const findRuntimeListComponent = (attrs: RuntimeListComponent[], field: string) => {
    const target = normalizeRuntimeListFieldKey(field)
    if (!target) return null

    return attrs.find((cmp) => cmp.column_name.toLowerCase() === target || normalizeRuntimeListFieldKey(cmp.codename) === target) ?? null
}

export const buildRuntimeListSearchClause = (attrs: RuntimeListComponent[], search: string | undefined, values: unknown[]) => {
    const query = search?.trim()
    if (!query) return null

    const searchableAttrs = attrs.filter((cmp) => cmp.data_type !== 'TABLE' && cmp.data_type !== 'JSON')
    if (searchableAttrs.length === 0) return null

    values.push(`%${escapeLikeWildcards(query)}%`)
    const placeholder = `$${values.length}`
    return `(${searchableAttrs.map((cmp) => `${resolveRuntimeListColumnSql(cmp)}::text ILIKE ${placeholder} ESCAPE '\\'`).join(' OR ')})`
}

export const normalizeRuntimeFilterValue = (cmp: { data_type: RuntimeDataType }, rawValue: unknown): unknown => {
    if (rawValue === null || rawValue === undefined) return rawValue

    if (cmp.data_type === 'NUMBER') {
        const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue)
        return Number.isFinite(numeric) ? numeric : undefined
    }

    if (cmp.data_type === 'BOOLEAN') {
        if (typeof rawValue === 'boolean') return rawValue
        if (typeof rawValue === 'string') {
            const normalized = rawValue.trim().toLowerCase()
            if (normalized === 'true') return true
            if (normalized === 'false') return false
        }
        return undefined
    }

    return rawValue
}

export const resolveRuntimeFilterValue = (rawValue: unknown, context: { currentUserId?: string | null }): unknown => {
    if (typeof rawValue === 'string' && rawValue.trim() === RUNTIME_CURRENT_USER_ID_TOKEN) {
        return context.currentUserId ?? null
    }

    if (isRecordValue(rawValue) && rawValue.runtime === 'currentUserId') {
        return context.currentUserId ?? null
    }

    return rawValue
}

export const buildRuntimeListFilterClause = (
    cmp: RuntimeListComponent,
    filter: RuntimeDatasourceFilter,
    values: unknown[],
    context: { currentUserId?: string | null }
) => {
    const columnSql = resolveRuntimeListColumnSql(cmp)

    if (filter.operator === 'isEmpty') {
        return `(${columnSql} IS NULL OR ${columnSql}::text = '')`
    }
    if (filter.operator === 'isNotEmpty') {
        return `(${columnSql} IS NOT NULL AND ${columnSql}::text <> '')`
    }

    const normalizedValue = normalizeRuntimeFilterValue(cmp, resolveRuntimeFilterValue(filter.value, context))
    if (normalizedValue === undefined || normalizedValue === null || normalizedValue === '') {
        return null
    }

    const addValue = (value: unknown) => {
        values.push(value)
        return `$${values.length}`
    }

    if (filter.operator === 'contains') {
        return `${columnSql}::text ILIKE ${addValue(`%${escapeLikeWildcards(String(normalizedValue))}%`)} ESCAPE '\\'`
    }
    if (filter.operator === 'startsWith') {
        return `${columnSql}::text ILIKE ${addValue(`${escapeLikeWildcards(String(normalizedValue))}%`)} ESCAPE '\\'`
    }
    if (filter.operator === 'endsWith') {
        return `${columnSql}::text ILIKE ${addValue(`%${escapeLikeWildcards(String(normalizedValue))}`)} ESCAPE '\\'`
    }

    const comparableOperators: Record<RuntimeDatasourceFilter['operator'], string | undefined> = {
        contains: undefined,
        equals: '=',
        startsWith: undefined,
        endsWith: undefined,
        isEmpty: undefined,
        isNotEmpty: undefined,
        greaterThan: '>',
        greaterThanOrEqual: '>=',
        lessThan: '<',
        lessThanOrEqual: '<='
    }

    const sqlOperator = comparableOperators[filter.operator]
    if (!sqlOperator) return null

    return `${columnSql} ${sqlOperator} ${addValue(normalizedValue)}`
}

export const buildRuntimeListClauses = (params: {
    activeCondition: string
    attrs: RuntimeListComponent[]
    search?: string
    sort?: RuntimeDatasourceSort[]
    filters?: RuntimeDatasourceFilter[]
    fallbackOrderBy: string
    currentUserId?: string | null
}) => {
    const values: unknown[] = []
    const whereClauses = [params.activeCondition]
    const searchClause = buildRuntimeListSearchClause(params.attrs, params.search, values)
    if (searchClause) {
        whereClauses.push(searchClause)
    }

    for (const filter of params.filters ?? []) {
        const cmp = findRuntimeListComponent(params.attrs, filter.field)
        if (!cmp || cmp.data_type === 'TABLE' || cmp.data_type === 'JSON') {
            continue
        }
        const filterClause = buildRuntimeListFilterClause(cmp, filter, values, { currentUserId: params.currentUserId })
        if (filterClause) {
            whereClauses.push(filterClause)
        }
    }

    const orderClauses: string[] = []
    for (const sort of params.sort ?? []) {
        const cmp = findRuntimeListComponent(params.attrs, sort.field)
        if (!cmp || cmp.data_type === 'TABLE' || cmp.data_type === 'JSON') {
            continue
        }
        orderClauses.push(`${resolveRuntimeListColumnSql(cmp)} ${sort.direction.toUpperCase()} NULLS LAST`)
    }
    orderClauses.push(params.fallbackOrderBy)

    return {
        whereSql: whereClauses.join(' AND '),
        orderBySql: orderClauses.join(', '),
        values
    }
}

export const findUnsupportedRuntimeListFields = (
    attrs: RuntimeListComponent[],
    sort?: RuntimeDatasourceSort[],
    filters?: RuntimeDatasourceFilter[]
) => {
    const unsupported = new Set<string>()
    const isSupported = (field: string) => {
        const cmp = findRuntimeListComponent(attrs, field)
        return Boolean(cmp && cmp.data_type !== 'TABLE' && cmp.data_type !== 'JSON')
    }

    for (const sortItem of sort ?? []) {
        if (!isSupported(sortItem.field)) {
            unsupported.add(sortItem.field)
        }
    }
    for (const filterItem of filters ?? []) {
        if (!isSupported(filterItem.field)) {
            unsupported.add(filterItem.field)
        }
    }

    return Array.from(unsupported)
}
