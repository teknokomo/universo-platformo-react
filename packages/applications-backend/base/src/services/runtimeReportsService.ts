import { qColumn, qSchemaTable } from '@universo/database'
import { readLocalizedTextValue, reportDefinitionSchema, type ReportDefinition, type ReportFilter } from '@universo/types'
import type { DbExecutor } from '@universo/utils'
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
    activeCondition?: string
    accessCondition?: string
    accessConditionValues?: unknown[]
    limit?: number
    offset?: number
    maxLimit?: number
    defaultLimit?: number
    filters?: ReportFilter[]
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
        return buildReportFilterEqualityExpression(field, addValue(normalizedValue), referenceAlias)
    }

    const operator = REPORT_FILTER_OPERATORS[filter.operator]
    if (!operator) return null

    return `${columnSql} ${operator} ${addValue(normalizedValue)}`
}

const buildReferenceLabelAlias = (index: number): string => `report_ref_label_${index + 1}`

const buildReportFieldAlias = (index: number): string => `report_field_${index + 1}`

const shiftSqlPlaceholders = (sql: string, offset: number): string => sql.replace(/\$(\d+)/g, (_, index) => `$${Number(index) + offset}`)

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

const UUID_SUBSTRING_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i

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
    return typeof value === 'string' && UUID_SUBSTRING_PATTERN.test(value)
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

        const filters = [...(definition.datasource.query?.filters ?? []), ...definition.filters, ...(params.filters ?? [])]
        const resolvedFilters = filters.map((filter) => ({ filter, field: resolveReportField(params.fields, filter.field) }))

        const selectedFields = definition.columns.map((column) => {
            const field = resolveReportField(params.fields, column.field)
            return { reportField: column.field, field }
        })

        const referenceAliasByField = new Map<string, string>()
        const referenceJoinSpecs: Array<{ field: RuntimeReportFieldMetadata; alias: string }> = []
        const selectedReferenceAliases = new Set<string>()
        const filterReferenceAliases = new Set<string>()
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
        const selectReferenceAliases = new Set([...filterReferenceAliases, ...selectedReferenceAliases])
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

        const whereSql = whereClauses.join(' AND ')
        const selectValues = [...values]
        const selectReferenceJoins = buildReferenceLabelJoins({
            schemaName: params.schemaName,
            specs: referenceJoinSpecs,
            aliases: selectReferenceAliases,
            values: selectValues
        })
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
