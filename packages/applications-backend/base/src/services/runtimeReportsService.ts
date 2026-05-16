import { qColumn, qSchemaTable } from '@universo/database'
import { readLocalizedTextValue, reportDefinitionSchema, type ReportDefinition, type ReportFilter } from '@universo/types'
import type { DbExecutor } from '@universo/utils'
import { UpdateFailure } from '../shared/runtimeHelpers'

type ReportFieldDataType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'REF' | 'JSON' | 'TABLE'

export interface RuntimeReportFieldMetadata {
    codename: string
    columnName: string
    dataType: ReportFieldDataType
}

export interface RuntimeReportRecordsListParams {
    executor: DbExecutor
    schemaName: string
    tableName: string
    fields: RuntimeReportFieldMetadata[]
    definition: unknown
    permissions: { readReports?: boolean }
    activeCondition?: string
    limit?: number
    offset?: number
    maxLimit?: number
    defaultLimit?: number
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

    return rawValue
}

const escapeLikeWildcards = (value: string): string => value.replace(/[\\%_]/g, (match) => `\\${match}`)

const buildReportFilterClause = (field: RuntimeReportFieldMetadata, filter: ReportFilter, values: unknown[]): string | null => {
    const columnSql = qColumn(field.columnName)

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
        return `${columnSql}::text ILIKE ${addValue(`%${escapeLikeWildcards(String(normalizedValue))}%`)} ESCAPE '\\'`
    }
    if (filter.operator === 'startsWith') {
        return `${columnSql}::text ILIKE ${addValue(`${escapeLikeWildcards(String(normalizedValue))}%`)} ESCAPE '\\'`
    }
    if (filter.operator === 'endsWith') {
        return `${columnSql}::text ILIKE ${addValue(`%${escapeLikeWildcards(String(normalizedValue))}`)} ESCAPE '\\'`
    }

    const operator = REPORT_FILTER_OPERATORS[filter.operator]
    if (!operator) return null

    return `${columnSql} ${operator} ${addValue(normalizedValue)}`
}

const REPORT_AGGREGATION_SQL: Record<ReportDefinition['aggregations'][number]['function'], string> = {
    avg: 'AVG',
    count: 'COUNT',
    max: 'MAX',
    min: 'MIN',
    sum: 'SUM'
}

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

const stringifyCsvValue = (value: unknown, locale: string): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
    const localizedText = readLocalizedTextValue(value, locale)
    if (localizedText) return localizedText
    return JSON.stringify(value) ?? String(value)
}

const escapeCsvValue = (value: unknown, locale: string): string => {
    const text = stringifyCsvValue(value, locale)
    if (!/[",\r\n]/.test(text)) return text
    return `"${text.replace(/"/g, '""')}"`
}

export const serializeRuntimeReportCsv = (result: RuntimeReportRecordsListResult, locale = 'en'): string => {
    const headers = result.definition.columns.map((column) => readLocalizedTextValue(column.label, locale) ?? column.field)
    const lines = [
        headers.map((header) => escapeCsvValue(header, locale)).join(','),
        ...result.rows.map((row) => result.definition.columns.map((column) => escapeCsvValue(row[column.field], locale)).join(','))
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
        const values: unknown[] = []
        const whereClauses = [params.activeCondition?.trim() || '_upl_deleted = false AND _app_deleted = false']

        const filters = [...(definition.datasource.query?.filters ?? []), ...definition.filters]
        for (const filter of filters) {
            const field = resolveReportField(params.fields, filter.field)
            const clause = buildReportFilterClause(field, filter, values)
            if (clause) {
                whereClauses.push(clause)
            }
        }

        const selectedFields = definition.columns.map((column) => {
            const field = resolveReportField(params.fields, column.field)
            return { reportField: column.field, columnName: field.columnName }
        })
        const selectedColumns = selectedFields.map((field) => qColumn(field.columnName))

        const orderClauses = (definition.datasource.query?.sort ?? []).map((sort) => {
            const field = resolveReportField(params.fields, sort.field)
            return `${qColumn(field.columnName)} ${sort.direction.toUpperCase()} NULLS LAST`
        })
        orderClauses.push('_upl_created_at DESC', 'id ASC')

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
        const limitPlaceholder = `$${values.length + 1}`
        const offsetPlaceholder = `$${values.length + 2}`

        const whereSql = whereClauses.join(' AND ')
        const rawRows = await params.executor.query<Record<string, unknown>>(
            `
            SELECT ${selectedColumns.join(', ')}
            FROM ${tableSql}
            WHERE ${whereSql}
            ORDER BY ${orderClauses.join(', ')}
            LIMIT ${limitPlaceholder}
            OFFSET ${offsetPlaceholder}
            `,
            [...values, limit, offset]
        )

        const totalRows = await params.executor.query<{ total: string | number }>(
            `
            SELECT count(*) AS total
            FROM ${tableSql}
            WHERE ${whereSql}
            `,
            values
        )

        const rawTotal = totalRows[0]?.total ?? 0
        const total = typeof rawTotal === 'number' ? rawTotal : Number(rawTotal)
        let aggregations: Record<string, unknown> = {}

        if (aggregationSpecs.length > 0) {
            const aggregationRows = await params.executor.query<Record<string, unknown>>(
                `
                SELECT ${aggregationSpecs.map((aggregation) => aggregation.sql).join(', ')}
                FROM ${tableSql}
                WHERE ${whereSql}
                `,
                values
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
            rows: rawRows.map((row) => Object.fromEntries(selectedFields.map((field) => [field.reportField, row[field.columnName]]))),
            total: Number.isFinite(total) ? total : 0,
            aggregations,
            definition
        }
    }
}
