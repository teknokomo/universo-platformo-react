import { qColumn, qSchemaTable } from '@universo-react/database'
import {
    readLocalizedTextValue,
    reportDefinitionSchema,
    type ReportDefinition,
    type ReportFilter,
    type RuntimeDatasourceSort
} from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { UpdateFailure } from '../shared/runtimeHelpers'

type ReportFieldDataType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'REF' | 'JSON' | 'TABLE'

export interface RuntimeReportFieldMetadata {
    codename: string
    columnName: string
    dataType: ReportFieldDataType
    refTargetObjectId?: string | null
    refTargetObjectKind?: string | null
    referenceLabel?: {
        tableName: string
        columnName: string
        dataType: ReportFieldDataType
        activeCondition?: string
        accessCondition?: string
        accessConditionValues?: unknown[]
    } | null
}

export interface RuntimeReportRecordsListParams {
    executor: DbExecutor
    schemaName: string
    tableName: string
    fields: RuntimeReportFieldMetadata[]
    definition: unknown
    permissions: { readReports?: boolean }
    locale?: string
    activeCondition?: string
    accessCondition?: string
    accessConditionValues?: unknown[]
    limit?: number
    offset?: number
    maxLimit?: number
    defaultLimit?: number
    filters?: ReportFilter[]
    sort?: RuntimeDatasourceSort[]
}

export interface RuntimeReportRecordsListResult {
    rows: Array<Record<string, unknown>>
    total: number
    aggregations: Record<string, unknown>
    definition: ReportDefinition
}

const REPORT_FILTER_OPERATORS: Record<ReportFilter['operator'], string | null> = {
    contains: null,
    equals: '=',
    startsWith: null,
    endsWith: null,
    isEmpty: null,
    isNotEmpty: null,
    greaterThan: '>',
    greaterThanOrEqual: '>=',
    lessThan: '<',
    lessThanOrEqual: '<='
}

const resolveReportField = (fields: RuntimeReportFieldMetadata[], codename: string): RuntimeReportFieldMetadata => {
    const field = fields.find((candidate) => candidate.codename === codename)
    if (!field || field.dataType === 'JSON' || field.dataType === 'TABLE') {
        throw new UpdateFailure(400, {
            error: 'Report field is not available',
            code: 'REPORT_FIELD_NOT_AVAILABLE',
            field: codename
        })
    }
    return field
}

const assertRequestedReportFields = (definition: ReportDefinition, filters: ReportFilter[], sort: RuntimeDatasourceSort[]): void => {
    const allowedFields = new Set(definition.columns.map((column) => column.field))
    const invalidField = [...filters.map((filter) => filter.field), ...sort.map((item) => item.field)].find(
        (field) => !allowedFields.has(field)
    )
    if (invalidField) {
        throw new UpdateFailure(400, {
            error: 'Report filters and sorting must use configured columns',
            code: 'REPORT_FIELD_NOT_CONFIGURED',
            field: invalidField
        })
    }
}

const validateRequestedSort = (sort: RuntimeDatasourceSort[] | undefined): RuntimeDatasourceSort[] | undefined => {
    if (sort === undefined) return undefined
    if (!Array.isArray(sort) || sort.length > 5) {
        throw new UpdateFailure(400, {
            error: 'Invalid report sort configuration',
            code: 'REPORT_SORT_INVALID'
        })
    }

    const fields = new Set<string>()
    for (const item of sort) {
        if (
            !item ||
            typeof item.field !== 'string' ||
            item.field.length === 0 ||
            item.field.length > 128 ||
            (item.direction !== 'asc' && item.direction !== 'desc') ||
            fields.has(item.field)
        ) {
            throw new UpdateFailure(400, {
                error: 'Invalid report sort configuration',
                code: 'REPORT_SORT_INVALID'
            })
        }
        fields.add(item.field)
    }
    return sort
}

const normalizeDateFilterValue = (rawValue: unknown): string | undefined => {
    if (rawValue instanceof Date) {
        return Number.isFinite(rawValue.getTime()) ? rawValue.toISOString() : undefined
    }
    if (
        typeof rawValue !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/iu.test(rawValue)
    ) {
        return undefined
    }
    const [year, month, day] = rawValue.slice(0, 10).split('-').map(Number)
    const calendarDate = new Date(Date.UTC(year, month - 1, day))
    if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) {
        return undefined
    }
    const timestamp = Date.parse(rawValue)
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined
}

const normalizeFilterValue = (field: RuntimeReportFieldMetadata, rawValue: unknown): unknown => {
    if (rawValue === null || rawValue === undefined) return rawValue

    if (field.dataType === 'NUMBER') {
        const value = typeof rawValue === 'number' ? rawValue : Number(rawValue)
        return Number.isFinite(value) ? value : undefined
    }

    if (field.dataType === 'BOOLEAN') {
        if (typeof rawValue === 'boolean') return rawValue
        if (typeof rawValue === 'string') {
            const normalized = rawValue.trim().toLowerCase()
            if (normalized === 'true') return true
            if (normalized === 'false') return false
        }
        return undefined
    }

    if (field.dataType === 'DATE') {
        const normalized = normalizeDateFilterValue(rawValue)
        if (normalized) return normalized
        if (typeof rawValue === 'string' && rawValue.trim().length === 0) return undefined
        throw new UpdateFailure(400, {
            error: 'Report date filter must be a valid ISO date or timestamp',
            code: 'REPORT_FILTER_VALUE_INVALID',
            field: field.codename
        })
    }

    return rawValue
}

const normalizeReportLocale = (locale: string | undefined): string => locale?.split(/[-_]/u)[0]?.trim().toLowerCase() || 'en'

const localizedJsonTextSql = (sourceSql: string, keySql: string): string => {
    const localeValueSql = `${sourceSql} -> ${keySql}`
    const contentValueSql = `${localeValueSql} -> 'content'`
    const contentTextSql = `${localeValueSql} ->> 'content'`
    const localeTextSql = `${sourceSql} ->> ${keySql}`
    return `COALESCE(
        NULLIF(BTRIM(CASE WHEN jsonb_typeof(${contentValueSql}) = 'string' THEN ${contentTextSql} END), ''),
        NULLIF(BTRIM(CASE WHEN jsonb_typeof(${localeValueSql}) = 'string' THEN ${localeTextSql} END), '')
    )`
}

const buildLocalizedReferenceSortExpression = (referenceAlias: string, localePlaceholder: string): string => {
    const labelSql = `to_jsonb(${qColumn(referenceAlias)}.label_value)`
    const localesSql = `${labelSql} -> 'locales'`
    const requestedLocaleSql = `${localePlaceholder}::text`
    const primaryLocaleSql = `split_part(replace(lower(COALESCE(${labelSql} ->> '_primary', 'en')), '_', '-'), '-', 1)`
    const candidates = [
        localizedJsonTextSql(localesSql, requestedLocaleSql),
        localizedJsonTextSql(localesSql, primaryLocaleSql),
        localizedJsonTextSql(localesSql, "'en'"),
        localizedJsonTextSql(localesSql, "'ru'"),
        localizedJsonTextSql(labelSql, requestedLocaleSql),
        localizedJsonTextSql(labelSql, primaryLocaleSql),
        localizedJsonTextSql(labelSql, "'en'"),
        localizedJsonTextSql(labelSql, "'ru'")
    ]
    const scalarLabelSql = `CASE WHEN jsonb_typeof(${labelSql}) = 'string' THEN ${labelSql} #>> '{}' END`

    return `COALESCE(${candidates.join(', ')}, ${scalarLabelSql})`
}

const escapeLikeWildcards = (value: string): string => value.replace(/[\\%_]/g, (match) => `\\${match}`)

const buildReportFilterTextExpression = (field: RuntimeReportFieldMetadata, referenceAlias?: string | null): string => {
    const columnSql = qColumn(field.columnName)
    if (!referenceAlias) return `${columnSql}::text`

    const referenceLabelSql = `${qColumn(referenceAlias)}.label_value`
    return `COALESCE(${referenceLabelSql}::text, ${columnSql}::text)`
}

const buildReportFilterEqualityExpression = (
    field: RuntimeReportFieldMetadata,
    placeholder: string,
    referenceAlias?: string | null
): string => {
    const columnSql = qColumn(field.columnName)
    if (!referenceAlias) return `${columnSql} = ${placeholder}`

    const referenceLabelSql = `${qColumn(referenceAlias)}.label_value`
    return `(${columnSql}::text = ${placeholder} OR ${referenceLabelSql}::text = ${placeholder})`
}

const buildReportFilterClause = (
    field: RuntimeReportFieldMetadata,
    filter: ReportFilter,
    values: unknown[],
    referenceAlias?: string | null
): string | null => {
    const columnSql = qColumn(field.columnName)
    const textExpressionSql = buildReportFilterTextExpression(field, referenceAlias)

    if (filter.operator === 'isEmpty') {
        return `(${columnSql} IS NULL OR ${columnSql}::text = '')`
    }
    if (filter.operator === 'isNotEmpty') {
        return `(${columnSql} IS NOT NULL AND ${columnSql}::text <> '')`
    }

    const normalizedValue = normalizeFilterValue(field, filter.value)
    if (normalizedValue === undefined || normalizedValue === null || normalizedValue === '') {
        return null
    }

    const addValue = (value: unknown) => {
        values.push(value)
        return `$${values.length}`
    }

    if (filter.operator === 'contains') {
        return `${textExpressionSql} ILIKE ${addValue(`%${escapeLikeWildcards(String(normalizedValue))}%`)} ESCAPE '\\'`
    }
    if (filter.operator === 'startsWith') {
        return `${textExpressionSql} ILIKE ${addValue(`${escapeLikeWildcards(String(normalizedValue))}%`)} ESCAPE '\\'`
    }
    if (filter.operator === 'endsWith') {
        return `${textExpressionSql} ILIKE ${addValue(`%${escapeLikeWildcards(String(normalizedValue))}`)} ESCAPE '\\'`
    }
    if (filter.operator === 'equals') {
        if (field.dataType === 'DATE' && typeof normalizedValue === 'string') {
            const start = new Date(normalizedValue)
            const dateOnly = typeof filter.value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(filter.value)
            if (dateOnly) start.setUTCHours(0, 0, 0, 0)
            else start.setUTCSeconds(0, 0)
            const end = new Date(start.getTime() + (dateOnly ? 86_400_000 : 60_000))
            values.push(start.toISOString(), end.toISOString())
            const startPlaceholder = `$${values.length - 1}`
            const endPlaceholder = `$${values.length}`
            return `(${columnSql} >= ${startPlaceholder} AND ${columnSql} < ${endPlaceholder})`
        }
        return buildReportFilterEqualityExpression(field, addValue(normalizedValue), referenceAlias)
    }

    const operator = REPORT_FILTER_OPERATORS[filter.operator]
    if (!operator) return null

    return `${columnSql} ${operator} ${addValue(normalizedValue)}`
}

const buildReferenceLabelAlias = (index: number): string => `report_ref_label_${index + 1}`

const buildReportFieldAlias = (index: number): string => `report_field_${index + 1}`

const shiftSqlPlaceholders = (sql: string, offset: number): string => {
    let result = ''
    let index = 0
    let inSingleQuotedString = false

    while (index < sql.length) {
        const char = sql[index]
        const nextChar = sql[index + 1]

        if (char === "'") {
            result += char
            if (inSingleQuotedString && nextChar === "'") {
                result += nextChar
                index += 2
                continue
            }
            inSingleQuotedString = !inSingleQuotedString
            index += 1
            continue
        }

        if (!inSingleQuotedString && char === '$') {
            const match = sql.slice(index + 1).match(/^\d+/)
            if (match) {
                result += `$${Number(match[0]) + offset}`
                index += match[0].length + 1
                continue
            }
        }

        result += char
        index += 1
    }

    return result
}

const buildReferenceLabelJoin = (params: {
    schemaName: string
    field: RuntimeReportFieldMetadata
    alias: string
    values: unknown[]
}): string | null => {
    const referenceLabel = params.field.referenceLabel
    if (!referenceLabel) return null

    const targetTableSql = qSchemaTable(params.schemaName, referenceLabel.tableName)
    const labelColumnSql = qColumn(referenceLabel.columnName)
    const activeCondition = referenceLabel.activeCondition?.trim() || '_upl_deleted = false AND _app_deleted = false'
    const accessCondition = referenceLabel.accessCondition?.trim()
    const accessConditionSql =
        accessCondition && accessCondition.length > 0 ? shiftSqlPlaceholders(accessCondition, params.values.length) : null
    if (referenceLabel.accessConditionValues?.length) {
        params.values.push(...referenceLabel.accessConditionValues)
    }
    const whereSql = [activeCondition, accessConditionSql].filter(Boolean).join(' AND ')

    return `
            LEFT JOIN (
                SELECT id AS ref_id, ${labelColumnSql} AS label_value
                FROM ${targetTableSql}
                WHERE ${whereSql}
            ) ${qColumn(params.alias)} ON ${qColumn(params.field.columnName)} = ${qColumn(params.alias)}.ref_id
        `
}

const buildReferenceLabelJoins = (params: {
    schemaName: string
    specs: Array<{ field: RuntimeReportFieldMetadata; alias: string }>
    aliases: Set<string>
    values: unknown[]
}): string[] =>
    params.specs
        .filter((spec) => params.aliases.has(spec.alias))
        .map((spec) =>
            buildReferenceLabelJoin({ schemaName: params.schemaName, field: spec.field, alias: spec.alias, values: params.values })
        )
        .filter((join): join is string => Boolean(join))

const shouldUseReferenceLabelFilter = (field: RuntimeReportFieldMetadata, filter: ReportFilter): boolean =>
    field.dataType === 'REF' &&
    Boolean(field.referenceLabel) &&
    (filter.operator === 'contains' || filter.operator === 'startsWith' || filter.operator === 'endsWith' || filter.operator === 'equals')

const buildSelectedReportFieldSql = (params: {
    field: RuntimeReportFieldMetadata
    outputAlias: string
    referenceAlias?: string | null
}): string => {
    const columnSql = qColumn(params.field.columnName)
    const outputAliasSql = qColumn(params.outputAlias)

    if (!params.referenceAlias) {
        return `${columnSql} AS ${outputAliasSql}`
    }

    const referenceAliasSql = qColumn(params.referenceAlias)
    return `
                CASE
                    WHEN ${columnSql} IS NULL THEN NULL::jsonb
                    WHEN ${referenceAliasSql}.ref_id IS NOT NULL THEN jsonb_build_object(
                        'id', ${referenceAliasSql}.ref_id::text,
                        'label', ${referenceAliasSql}.label_value
                    )
                    ELSE jsonb_build_object(
                        'id', ${columnSql}::text,
                        'label', NULL
                    )
                END AS ${outputAliasSql}
            `
}

const REPORT_AGGREGATION_SQL: Record<ReportDefinition['aggregations'][number]['function'], string> = {
    avg: 'AVG',
    count: 'COUNT',
    max: 'MAX',
    min: 'MIN',
    sum: 'SUM'
}

const UUID_VALUE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const normalizeAggregationValue = (value: unknown): unknown => {
    if (typeof value !== 'string') return value
    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? numericValue : value
}

const buildAggregationAlias = (aggregation: ReportDefinition['aggregations'][number]): string =>
    aggregation.alias ?? `${aggregation.function}_${aggregation.field}`

const buildAggregationSqlAlias = (alias: string, index: number): string => {
    const normalized = alias
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .toLowerCase()
        .replace(/^_+|_+$/g, '')
    return /^[a-z_][a-z0-9_]*$/.test(normalized) ? normalized : `aggregation_${index + 1}`
}

const assertUniqueAggregationAlias = (seenAliases: Set<string>, alias: string, code: string, field: string): void => {
    if (!seenAliases.has(alias)) {
        seenAliases.add(alias)
        return
    }

    throw new UpdateFailure(400, {
        error: 'Report aggregation alias must be unique',
        code,
        alias,
        field
    })
}

const normalizeLimit = (value: unknown, fallback: number, maxLimit: number): number => {
    const numericValue = typeof value === 'number' ? value : Number(value)
    const candidate = Number.isFinite(numericValue) ? numericValue : fallback
    return Math.max(1, Math.min(maxLimit, Math.trunc(candidate)))
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isReportTechnicalFieldName = (field: string | undefined): boolean => {
    const normalized =
        field
            ?.trim()
            .replace(/[-_\s]+/g, '')
            .toLowerCase() ?? ''
    if (!normalized) return false
    return normalized.endsWith('id')
}

const isPrimitiveReportValue = (value: unknown): boolean =>
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'

const shouldSuppressPrimitiveReportValue = (value: unknown, field?: string): boolean => {
    if (!isPrimitiveReportValue(value)) return false
    if (isReportTechnicalFieldName(field)) return true
    return typeof value === 'string' && UUID_VALUE_PATTERN.test(value.trim())
}

const readReportObjectLabel = (value: Record<string, unknown>, locale: string): string | null => {
    const candidates = ['displayName', 'name', 'title', 'label', 'caption', 'email']
    for (const key of candidates) {
        const candidate = value[key]
        const localizedText = readLocalizedTextValue(candidate, locale)
        if (localizedText?.trim()) return localizedText.trim()
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
        if (typeof candidate === 'number' || typeof candidate === 'boolean' || typeof candidate === 'bigint') return String(candidate)
    }
    return null
}

const stringifyCsvValue = (value: unknown, locale: string, field?: string): string => {
    if (value === null || value === undefined) return ''
    if (shouldSuppressPrimitiveReportValue(value, field)) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
    const localizedText = readLocalizedTextValue(value, locale)
    if (localizedText) return localizedText
    if (Array.isArray(value)) {
        return value
            .map((item) => stringifyCsvValue(item, locale, field))
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
            .join('; ')
    }
    if (value instanceof Date) return value.toISOString()
    if (isRecord(value)) return readReportObjectLabel(value, locale) ?? ''
    return ''
}

const escapeCsvValue = (value: unknown, locale: string, field?: string): string => {
    const text = stringifyCsvValue(value, locale, field)
    if (!/[",\r\n]/.test(text)) return text
    return `"${text.replace(/"/g, '""')}"`
}

export const serializeRuntimeReportCsv = (result: RuntimeReportRecordsListResult, locale = 'en'): string => {
    const headers = result.definition.columns.map((column) => readLocalizedTextValue(column.label, locale) ?? column.field)
    const lines = [
        headers.map((header) => escapeCsvValue(header, locale)).join(','),
        ...result.rows.map((row) =>
            result.definition.columns.map((column) => escapeCsvValue(row[column.field], locale, column.field)).join(',')
        )
    ]
    return `${lines.join('\r\n')}\r\n`
}

export class RuntimeReportsService {
    async runRecordsListReport(params: RuntimeReportRecordsListParams): Promise<RuntimeReportRecordsListResult> {
        if (params.permissions.readReports !== true) {
            throw new UpdateFailure(403, {
                error: 'Insufficient permissions for this report',
                code: 'REPORT_PERMISSION_DENIED'
            })
        }

        const definition = reportDefinitionSchema.parse(params.definition)
        if (definition.datasource.kind !== 'records.list') {
            throw new UpdateFailure(400, {
                error: 'Only records.list report datasources are supported',
                code: 'REPORT_DATASOURCE_UNSUPPORTED',
                kind: definition.datasource.kind
            })
        }

        const tableSql = qSchemaTable(params.schemaName, params.tableName)
        const values: unknown[] = [...(params.accessConditionValues ?? [])]
        const whereClauses = [
            params.activeCondition?.trim() || '_upl_deleted = false AND _app_deleted = false',
            ...(params.accessCondition?.trim() ? [params.accessCondition.trim()] : [])
        ]

        const requestFilters = params.filters ?? []
        const requestSort = validateRequestedSort(params.sort)
        assertRequestedReportFields(definition, requestFilters, requestSort ?? [])
        const filters = [...(definition.datasource.query?.filters ?? []), ...definition.filters, ...requestFilters]
        const resolvedFilters = filters.map((filter) => ({ filter, field: resolveReportField(params.fields, filter.field) }))

        const selectedFields = definition.columns.map((column) => {
            const field = resolveReportField(params.fields, column.field)
            return { reportField: column.field, field }
        })

        const referenceAliasByField = new Map<string, string>()
        const referenceJoinSpecs: Array<{ field: RuntimeReportFieldMetadata; alias: string }> = []
        const selectedReferenceAliases = new Set<string>()
        const filterReferenceAliases = new Set<string>()
        const sortReferenceAliases = new Set<string>()
        const ensureReferenceAlias = (field: RuntimeReportFieldMetadata): string | null => {
            if (!field.referenceLabel) return null

            const existingAlias = referenceAliasByField.get(field.codename)
            if (existingAlias) return existingAlias

            const alias = buildReferenceLabelAlias(referenceAliasByField.size)
            referenceAliasByField.set(field.codename, alias)
            referenceJoinSpecs.push({ field, alias })
            return alias
        }

        for (const { filter, field } of resolvedFilters) {
            const referenceAlias = shouldUseReferenceLabelFilter(field, filter) ? ensureReferenceAlias(field) : null
            if (referenceAlias) {
                filterReferenceAliases.add(referenceAlias)
            }

            const clause = buildReportFilterClause(field, filter, values, referenceAlias)
            if (clause) {
                whereClauses.push(clause)
            }
        }

        const selectedColumns = selectedFields.map((field, index) => {
            const referenceAlias = ensureReferenceAlias(field.field)
            if (referenceAlias && field.field.referenceLabel) {
                selectedReferenceAliases.add(referenceAlias)
            }

            const outputAlias = buildReportFieldAlias(index)
            return {
                reportField: field.reportField,
                outputAlias,
                sql: buildSelectedReportFieldSql({
                    field: field.field,
                    outputAlias,
                    referenceAlias
                })
            }
        })
        const configuredSort = definition.datasource.query?.sort ?? []
        const effectiveSort = requestSort ?? configuredSort
        const resolvedSort = effectiveSort.map((item) => {
            if (item.direction !== 'asc' && item.direction !== 'desc') {
                throw new UpdateFailure(400, { error: 'Invalid report sort direction', code: 'REPORT_SORT_INVALID' })
            }
            const field = resolveReportField(params.fields, item.field)
            const referenceAlias = ensureReferenceAlias(field)
            if (referenceAlias && field.referenceLabel) sortReferenceAliases.add(referenceAlias)
            return { item, field, referenceAlias }
        })
        const selectReferenceAliases = new Set([...filterReferenceAliases, ...selectedReferenceAliases, ...sortReferenceAliases])

        const outputAliases = new Set<string>()
        const sqlAliases = new Set<string>()
        const aggregationSpecs = definition.aggregations.map((aggregation, index) => {
            const field = resolveReportField(params.fields, aggregation.field)
            if ((aggregation.function === 'sum' || aggregation.function === 'avg') && field.dataType !== 'NUMBER') {
                throw new UpdateFailure(400, {
                    error: 'Report aggregation requires a numeric field',
                    code: 'REPORT_AGGREGATION_FIELD_TYPE_INVALID',
                    field: aggregation.field,
                    function: aggregation.function
                })
            }

            const outputAlias = buildAggregationAlias(aggregation)
            const sqlAlias = buildAggregationSqlAlias(outputAlias, index)
            assertUniqueAggregationAlias(outputAliases, outputAlias, 'REPORT_AGGREGATION_ALIAS_DUPLICATE', aggregation.field)
            assertUniqueAggregationAlias(sqlAliases, sqlAlias, 'REPORT_AGGREGATION_SQL_ALIAS_DUPLICATE', aggregation.field)
            return {
                outputAlias,
                sqlAlias,
                sql: `${REPORT_AGGREGATION_SQL[aggregation.function]}(${qColumn(field.columnName)}) AS ${qColumn(sqlAlias)}`
            }
        })

        const maxLimit = normalizeLimit(params.maxLimit, 500, 5000)
        const defaultLimit = normalizeLimit(params.defaultLimit, 100, maxLimit)
        const limit = normalizeLimit(params.limit, defaultLimit, maxLimit)
        const offset = Math.max(0, Math.trunc(params.offset ?? 0))

        const whereSql = whereClauses.join(' AND ')
        const selectValues = [...values]
        const selectReferenceJoins = buildReferenceLabelJoins({
            schemaName: params.schemaName,
            specs: referenceJoinSpecs,
            aliases: selectReferenceAliases,
            values: selectValues
        })
        const orderClauses = resolvedSort.map(({ item, field, referenceAlias }) => {
            const columnSql = qColumn(field.columnName)
            let orderExpression = columnSql
            if (referenceAlias && field.referenceLabel) {
                const localePlaceholder = `$${selectValues.length + 1}`
                selectValues.push(normalizeReportLocale(params.locale))
                orderExpression = `COALESCE(${buildLocalizedReferenceSortExpression(
                    referenceAlias,
                    localePlaceholder
                )}, ${columnSql}::text)`
            }
            return `${orderExpression} ${item.direction.toUpperCase()} NULLS LAST`
        })
        if (effectiveSort.length === 0 && requestSort === undefined) orderClauses.push('_upl_created_at DESC')
        orderClauses.push('id ASC')
        const limitPlaceholder = `$${selectValues.length + 1}`
        const offsetPlaceholder = `$${selectValues.length + 2}`
        const rawRows = await params.executor.query<Record<string, unknown>>(
            `
            SELECT ${selectedColumns.map((field) => field.sql).join(', ')}
            FROM ${tableSql}
            ${selectReferenceJoins.join('\n')}
            WHERE ${whereSql}
            ORDER BY ${orderClauses.join(', ')}
            LIMIT ${limitPlaceholder}
            OFFSET ${offsetPlaceholder}
            `,
            [...selectValues, limit, offset]
        )

        const totalValues = [...values]
        const filterReferenceJoins = buildReferenceLabelJoins({
            schemaName: params.schemaName,
            specs: referenceJoinSpecs,
            aliases: filterReferenceAliases,
            values: totalValues
        })
        const totalRows = await params.executor.query<{ total: string | number }>(
            `
            SELECT count(*) AS total
            FROM ${tableSql}
            ${filterReferenceJoins.join('\n')}
            WHERE ${whereSql}
            `,
            totalValues
        )

        const rawTotal = totalRows[0]?.total ?? 0
        const total = typeof rawTotal === 'number' ? rawTotal : Number(rawTotal)
        let aggregations: Record<string, unknown> = {}

        if (aggregationSpecs.length > 0) {
            const aggregationValues = [...values]
            const aggregationReferenceJoins = buildReferenceLabelJoins({
                schemaName: params.schemaName,
                specs: referenceJoinSpecs,
                aliases: filterReferenceAliases,
                values: aggregationValues
            })
            const aggregationRows = await params.executor.query<Record<string, unknown>>(
                `
                SELECT ${aggregationSpecs.map((aggregation) => aggregation.sql).join(', ')}
                FROM ${tableSql}
                ${aggregationReferenceJoins.join('\n')}
                WHERE ${whereSql}
                `,
                aggregationValues
            )
            const aggregationRow = aggregationRows[0] ?? {}
            aggregations = Object.fromEntries(
                aggregationSpecs.map((aggregation) => [
                    aggregation.outputAlias,
                    normalizeAggregationValue(aggregationRow[aggregation.sqlAlias])
                ])
            )
        }

        return {
            rows: rawRows.map((row) => Object.fromEntries(selectedColumns.map((field) => [field.reportField, row[field.outputAlias]]))),
            total: Number.isFinite(total) ? total : 0,
            aggregations,
            definition
        }
    }
}
