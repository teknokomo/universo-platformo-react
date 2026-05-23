import type { Request, Response } from 'express'
import { z } from 'zod'
import { reportDefinitionSchema, reportFilterSchema } from '@universo/types'
import type { ReportDefinition } from '@universo/types'
import type { DbExecutor } from '@universo/utils'
import { resolveApplicationLifecycleContractFromConfig } from '@universo/utils'
import { qColumn, qSchemaTable } from '@universo/database'
import {
    buildRuntimeActiveRowCondition,
    createQueryHelper,
    ensureRuntimePermission,
    IDENTIFIER_REGEX,
    runtimeObjectFilterSql,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema,
    runtimeCodenameTextSql,
    UpdateFailure
} from '../shared/runtimeHelpers'
import { RuntimeReportsService, serializeRuntimeReportCsv, type RuntimeReportFieldMetadata } from '../services/runtimeReportsService'
import { buildRuntimeRecordAccessClause, executeRuntimeRecordsUnionDatasource, loadRuntimeObjectAttrs } from './runtimeRowsController'
import type { RolePermission } from '../routes/guards'

const reportRunBodySchema = z
    .object({
        reportId: z.string().trim().min(1).max(128).optional(),
        reportCodename: z.string().trim().min(1).max(128).optional(),
        limit: z.coerce.number().int().positive().max(500).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        filters: z.array(reportFilterSchema).max(32).optional().default([])
    })
    .strict()
    .superRefine((value, ctx) => {
        const references = [value.reportId, value.reportCodename].filter((item) => typeof item === 'string' && item.trim().length > 0)
        if (references.length !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Provide exactly one report reference',
                path: ['reportId']
            })
        }
    })

const reportExportBodySchema = z
    .object({
        reportId: z.string().trim().min(1).max(128).optional(),
        reportCodename: z.string().trim().min(1).max(128).optional(),
        limit: z.coerce.number().int().positive().max(5000).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        filters: z.array(reportFilterSchema).max(32).optional().default([]),
        locale: z.string().trim().min(2).max(16).optional().default('en')
    })
    .strict()
    .superRefine((value, ctx) => {
        const references = [value.reportId, value.reportCodename].filter((item) => typeof item === 'string' && item.trim().length > 0)
        if (references.length !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Provide exactly one report reference',
                path: ['reportId']
            })
        }
    })

type RuntimeSchemaContext = NonNullable<Awaited<ReturnType<typeof resolveRuntimeSchema>>>

type RuntimeReportTarget = {
    id: string
    codename: string
    tableName: string
    config?: Record<string, unknown> | null
    fields: RuntimeReportFieldMetadata[]
}

type RuntimeReportObjectTarget = RuntimeReportTarget & {
    definitionColumnName: string
}

type RuntimeReportExecutionResult = {
    rows: Array<Record<string, unknown>>
    total: number
    aggregations: Record<string, unknown>
    definition: ReportDefinition
}

const parseStoredReportDefinition = (value: unknown) => {
    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as unknown
        } catch {
            return value
        }
    }
    return value
}

const mapRuntimeReportFields = (
    rawFields: Array<{
        codename: unknown
        column_name: string
        data_type: RuntimeReportFieldMetadata['dataType']
        target_object_id?: string | null
        target_object_kind?: string | null
    }>
): RuntimeReportFieldMetadata[] =>
    rawFields
        .filter((field) => IDENTIFIER_REGEX.test(field.column_name))
        .map((field) => ({
            codename: resolveRuntimeCodenameText(field.codename) || field.column_name,
            columnName: field.column_name,
            dataType: field.data_type,
            refTargetObjectId: field.target_object_id ?? null,
            refTargetObjectKind: field.target_object_kind ?? null
        }))

const isRuntimeObjectReferenceKind = (value: string | null | undefined): boolean => value === 'object'

const attachReferenceLabelMetadata = async (params: {
    executor: DbExecutor
    schemaIdent: string
    currentWorkspaceId?: string | null
    currentUserId?: string | null
    permissions: Record<RolePermission, boolean>
    fields: RuntimeReportFieldMetadata[]
}): Promise<RuntimeReportFieldMetadata[]> => {
    const targetObjectIds = Array.from(
        new Set(
            params.fields
                .filter(
                    (field) =>
                        field.dataType === 'REF' &&
                        isRuntimeObjectReferenceKind(field.refTargetObjectKind) &&
                        typeof field.refTargetObjectId === 'string' &&
                        field.refTargetObjectId.trim().length > 0
                )
                .map((field) => field.refTargetObjectId as string)
        )
    )

    if (targetObjectIds.length === 0) return params.fields

    const targetObjects = await params.executor.query<{
        id: string
        codename: unknown
        table_name: string | null
        config?: Record<string, unknown> | null
    }>(
        `
        SELECT id, codename, table_name, config
        FROM ${params.schemaIdent}._app_objects
        WHERE id = ANY($1::uuid[])
          AND _upl_deleted = false
          AND _app_deleted = false
          AND ${runtimeObjectFilterSql('kind', 'config')}
        `,
        [targetObjectIds]
    )

    const targetComponents = await params.executor.query<{
        id: string
        object_id: string
        codename: unknown
        column_name: string
        data_type: RuntimeReportFieldMetadata['dataType']
        is_required: boolean
        validation_rules?: Record<string, unknown>
        target_object_id?: string | null
        target_object_kind?: string | null
        ui_config?: Record<string, unknown>
        is_display_component: boolean
        sort_order?: number | null
    }>(
        `
        SELECT id, object_id, codename, column_name, data_type, is_required, validation_rules, target_object_id, target_object_kind, ui_config, is_display_component, sort_order
        FROM ${params.schemaIdent}._app_components
        WHERE object_id = ANY($1::uuid[])
          AND parent_component_id IS NULL
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY object_id ASC, is_display_component DESC, sort_order ASC NULLS LAST, codename ASC
        `,
        [targetObjectIds]
    )

    const componentsByObjectId = new Map<string, typeof targetComponents>()
    for (const component of targetComponents) {
        const list = componentsByObjectId.get(component.object_id) ?? []
        list.push(component)
        componentsByObjectId.set(component.object_id, list)
    }

    const labelsByObjectId = new Map<string, NonNullable<RuntimeReportFieldMetadata['referenceLabel']>>()
    for (const targetObject of targetObjects) {
        if (!targetObject.table_name || !IDENTIFIER_REGEX.test(targetObject.table_name)) continue

        const components = componentsByObjectId.get(targetObject.id) ?? []
        const preferredDisplayComponent =
            components.find((component) => component.is_display_component === true && IDENTIFIER_REGEX.test(component.column_name)) ??
            components.find((component) => component.data_type === 'STRING' && IDENTIFIER_REGEX.test(component.column_name)) ??
            components.find((component) => IDENTIFIER_REGEX.test(component.column_name))

        if (!preferredDisplayComponent) continue

        const targetTableSql = `${params.schemaIdent}.${qColumn(targetObject.table_name)}`
        const accessConditionValues: unknown[] = []
        const accessCondition = await buildRuntimeRecordAccessClause({
            manager: params.executor,
            schemaIdent: params.schemaIdent,
            currentWorkspaceId: params.currentWorkspaceId ?? null,
            currentUserId: params.currentUserId ?? null,
            permissions: params.permissions,
            objectCodename: resolveRuntimeCodenameText(targetObject.codename),
            attrs: components,
            config: targetObject.config,
            outerRowIdSql: `${targetTableSql}.id`,
            values: accessConditionValues
        })

        labelsByObjectId.set(targetObject.id, {
            tableName: targetObject.table_name,
            columnName: preferredDisplayComponent.column_name,
            dataType: preferredDisplayComponent.data_type,
            activeCondition: buildRuntimeActiveRowCondition(
                resolveApplicationLifecycleContractFromConfig(targetObject.config),
                targetObject.config,
                undefined,
                params.currentWorkspaceId
            ),
            accessCondition: accessCondition ?? undefined,
            accessConditionValues
        })
    }

    return params.fields.map((field) => ({
        ...field,
        referenceLabel:
            field.dataType === 'REF' && typeof field.refTargetObjectId === 'string'
                ? labelsByObjectId.get(field.refTargetObjectId) ?? null
                : null
    }))
}

const resolveReportTargetToken = (definition: z.infer<typeof reportDefinitionSchema>): string | null => {
    const datasource = definition.datasource
    if (datasource.kind !== 'records.list') {
        throw new UpdateFailure(400, {
            error: 'Only records.list report datasources are supported',
            code: 'REPORT_DATASOURCE_UNSUPPORTED',
            kind: datasource.kind
        })
    }

    return (
        datasource.sectionId?.trim() ||
        datasource.objectCollectionId?.trim() ||
        datasource.sectionCodename?.trim() ||
        datasource.objectCollectionCodename?.trim() ||
        null
    )
}

const resolveRecordsUnionReportValue = (value: unknown): unknown => {
    if (value && typeof value === 'object' && !Array.isArray(value) && 'label' in value) {
        const label = (value as { label?: unknown }).label
        return label ?? null
    }
    return value
}

const pickRecordsUnionReportRows = (rows: Array<Record<string, unknown>>, definition: ReportDefinition): Array<Record<string, unknown>> => {
    const fields = definition.columns.map((column) => column.field)
    return rows.map((row) => Object.fromEntries(fields.map((field) => [field, resolveRecordsUnionReportValue(row[field])])))
}

const assertReportColumnsAvailable = (definition: ReportDefinition, availableFields: Iterable<string>): void => {
    const available = new Set(availableFields)
    const missing = definition.columns.map((column) => column.field).filter((field) => !available.has(field))
    if (missing.length > 0) {
        throw new UpdateFailure(400, {
            error: 'Report columns are not available for this datasource',
            code: 'REPORT_COLUMNS_NOT_AVAILABLE',
            fields: missing
        })
    }
}

const resolveReportTarget = async (params: {
    executor: DbExecutor
    schemaIdent: string
    currentWorkspaceId?: string | null
    currentUserId?: string | null
    permissions: Record<RolePermission, boolean>
    definition: z.infer<typeof reportDefinitionSchema>
}): Promise<RuntimeReportTarget> => {
    const targetToken = resolveReportTargetToken(params.definition)
    if (!targetToken) {
        throw new UpdateFailure(400, {
            error: 'Report datasource requires a section target',
            code: 'REPORT_DATASOURCE_TARGET_REQUIRED'
        })
    }

    const targets = await params.executor.query<{
        id: string
        codename: unknown
        table_name: string | null
        config?: Record<string, unknown> | null
    }>(
        `
        SELECT id, codename, table_name, config
        FROM ${params.schemaIdent}._app_objects
        WHERE _upl_deleted = false
          AND _app_deleted = false
          AND ${runtimeObjectFilterSql('kind', 'config')}
          AND (id::text = $1 OR ${runtimeCodenameTextSql('codename')} = $1)
        ORDER BY CASE WHEN id::text = $1 THEN 0 ELSE 1 END, ${runtimeCodenameTextSql('codename')} ASC, id ASC
        LIMIT 1
        `,
        [targetToken]
    )

    const target = targets[0]
    if (!target) {
        throw new UpdateFailure(404, {
            error: 'Report datasource target was not found',
            code: 'REPORT_DATASOURCE_TARGET_NOT_FOUND'
        })
    }
    if (!target.table_name || !IDENTIFIER_REGEX.test(target.table_name)) {
        throw new UpdateFailure(400, {
            error: 'Report datasource target table is invalid',
            code: 'REPORT_DATASOURCE_TABLE_INVALID'
        })
    }

    const rawFields = await params.executor.query<{
        codename: unknown
        column_name: string
        data_type: RuntimeReportFieldMetadata['dataType']
        target_object_id?: string | null
        target_object_kind?: string | null
    }>(
        `
        SELECT codename, column_name, data_type, target_object_id, target_object_kind
        FROM ${params.schemaIdent}._app_components
        WHERE object_id = $1
          AND parent_component_id IS NULL
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST, id ASC
        `,
        [target.id]
    )

    const fields = await attachReferenceLabelMetadata({
        executor: params.executor,
        schemaIdent: params.schemaIdent,
        currentWorkspaceId: params.currentWorkspaceId,
        currentUserId: params.currentUserId,
        permissions: params.permissions,
        fields: mapRuntimeReportFields(rawFields)
    })

    return {
        id: target.id,
        codename: resolveRuntimeCodenameText(target.codename),
        tableName: target.table_name,
        config: target.config,
        fields
    }
}

const resolveReportsObjectTarget = async (params: { executor: DbExecutor; schemaIdent: string }): Promise<RuntimeReportObjectTarget> => {
    const targets = await params.executor.query<{
        id: string
        codename: unknown
        table_name: string | null
        config?: Record<string, unknown> | null
    }>(
        `
        SELECT id, codename, table_name, config
        FROM ${params.schemaIdent}._app_objects
        WHERE _upl_deleted = false
          AND _app_deleted = false
          AND ${runtimeObjectFilterSql('kind', 'config')}
          AND ${runtimeCodenameTextSql('codename')} = $1
        ORDER BY id ASC
        LIMIT 1
        `,
        ['Reports']
    )

    const target = targets[0]
    if (!target) {
        throw new UpdateFailure(404, {
            error: 'Reports object was not found in the published application',
            code: 'REPORTS_OBJECT_NOT_FOUND'
        })
    }
    if (!target.table_name || !IDENTIFIER_REGEX.test(target.table_name)) {
        throw new UpdateFailure(400, {
            error: 'Reports object table is invalid',
            code: 'REPORTS_OBJECT_TABLE_INVALID'
        })
    }

    const rawFields = await params.executor.query<{
        codename: unknown
        column_name: string
        data_type: RuntimeReportFieldMetadata['dataType']
    }>(
        `
        SELECT codename, column_name, data_type
        FROM ${params.schemaIdent}._app_components
        WHERE object_id = $1
          AND parent_component_id IS NULL
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST, id ASC
        `,
        [target.id]
    )

    const fields = mapRuntimeReportFields(rawFields)
    const definitionField = fields.find((field) => field.codename === 'Definition' && field.dataType === 'JSON')
    if (!definitionField) {
        throw new UpdateFailure(400, {
            error: 'Reports object does not expose a JSON Definition field',
            code: 'REPORTS_OBJECT_DEFINITION_FIELD_MISSING'
        })
    }

    return {
        id: target.id,
        codename: resolveRuntimeCodenameText(target.codename),
        tableName: target.table_name,
        config: target.config,
        fields,
        definitionColumnName: definitionField.columnName
    }
}

const loadSavedReportDefinition = async (params: {
    executor: DbExecutor
    schemaName: string
    reportObject: RuntimeReportObjectTarget
    reportId?: string
    reportCodename?: string
    activeCondition?: string
}) => {
    const reportReference = params.reportId?.trim() || params.reportCodename?.trim()
    if (!reportReference) {
        throw new UpdateFailure(400, {
            error: 'Report reference is required',
            code: 'REPORT_REFERENCE_REQUIRED'
        })
    }

    const tableSql = qSchemaTable(params.schemaName, params.reportObject.tableName)
    const definitionColumnSql = qColumn(params.reportObject.definitionColumnName)
    const rows = await params.executor.query<{ definition: unknown }>(
        `
        SELECT ${definitionColumnSql} AS definition
        FROM ${tableSql}
        WHERE ${params.activeCondition?.trim() || '_upl_deleted = false AND _app_deleted = false'}
          AND (id::text = $1 OR ${definitionColumnSql}->>'codename' = $1)
        ORDER BY CASE WHEN id::text = $1 THEN 0 ELSE 1 END, id ASC
        LIMIT 1
        `,
        [reportReference]
    )

    const saved = rows[0]
    if (!saved) {
        throw new UpdateFailure(404, {
            error: 'Saved report was not found',
            code: 'REPORT_NOT_FOUND'
        })
    }

    const parsed = reportDefinitionSchema.safeParse(parseStoredReportDefinition(saved.definition))
    if (!parsed.success) {
        throw new UpdateFailure(400, {
            error: 'Saved report definition is invalid',
            code: 'REPORT_DEFINITION_INVALID',
            details: parsed.error.flatten()
        })
    }

    return parsed.data
}

const buildCsvAttachmentFilename = (codename: string): string => {
    const normalized = codename
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
    return `${normalized || 'runtime-report'}.csv`
}

export function createRuntimeReportsController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)
    const service = new RuntimeReportsService()

    const resolveSavedReportExecution = async (ctx: RuntimeSchemaContext, reference: { reportId?: string; reportCodename?: string }) => {
        const reportsObject = await resolveReportsObjectTarget({
            executor: ctx.manager,
            schemaIdent: ctx.schemaIdent
        })
        const reportsLifecycleContract = resolveApplicationLifecycleContractFromConfig(reportsObject.config)
        const definition = await loadSavedReportDefinition({
            executor: ctx.manager,
            schemaName: ctx.schemaName,
            reportObject: reportsObject,
            reportId: reference.reportId,
            reportCodename: reference.reportCodename,
            activeCondition: buildRuntimeActiveRowCondition(
                reportsLifecycleContract,
                reportsObject.config,
                undefined,
                ctx.currentWorkspaceId
            )
        })
        const target =
            definition.datasource.kind === 'records.list'
                ? await resolveReportTarget({
                      executor: ctx.manager,
                      schemaIdent: ctx.schemaIdent,
                      currentWorkspaceId: ctx.currentWorkspaceId,
                      currentUserId: ctx.userId,
                      permissions: ctx.permissions,
                      definition
                  })
                : undefined

        return { definition, target }
    }

    const runResolvedReport = async (params: {
        ctx: RuntimeSchemaContext
        definition: ReportDefinition
        target?: RuntimeReportTarget
        limit?: number
        offset?: number
        maxLimit?: number
        defaultLimit?: number
        locale?: string
        filters?: ReportDefinition['filters']
    }): Promise<RuntimeReportExecutionResult> => {
        const requestFilters = params.filters ?? []
        const unionDatasource =
            params.definition.datasource.kind === 'records.union' && (params.definition.filters.length > 0 || requestFilters.length > 0)
                ? {
                      ...params.definition.datasource,
                      query: {
                          ...(params.definition.datasource.query ?? {}),
                          filters: [...(params.definition.datasource.query?.filters ?? []), ...params.definition.filters, ...requestFilters]
                      }
                  }
                : params.definition.datasource

        if (unionDatasource.kind === 'records.union') {
            if (params.definition.aggregations.length > 0) {
                throw new UpdateFailure(400, {
                    error: 'Records union report aggregations are not supported',
                    code: 'REPORT_UNION_AGGREGATIONS_UNSUPPORTED'
                })
            }

            const limit = Math.max(1, Math.min(params.maxLimit ?? 500, Math.trunc(params.limit ?? params.defaultLimit ?? 100)))
            const offset = Math.max(0, Math.trunc(params.offset ?? 0))
            const payload = await executeRuntimeRecordsUnionDatasource({
                runtimeContext: params.ctx,
                datasource: unionDatasource,
                limit,
                offset,
                locale: params.locale ?? 'en'
            })
            assertReportColumnsAvailable(
                params.definition,
                payload.columns.map((column: { field: string }) => column.field)
            )

            return {
                rows: pickRecordsUnionReportRows(payload.rows, params.definition),
                total: payload.pagination.total,
                aggregations: {},
                definition: params.definition
            }
        }

        if (params.definition.datasource.kind !== 'records.list') {
            throw new UpdateFailure(400, {
                error: 'Report datasource is not supported',
                code: 'REPORT_DATASOURCE_UNSUPPORTED',
                kind: params.definition.datasource.kind
            })
        }

        if (!params.target) {
            throw new UpdateFailure(400, {
                error: 'Report datasource requires a section target',
                code: 'REPORT_DATASOURCE_TARGET_REQUIRED'
            })
        }

        const lifecycleContract = resolveApplicationLifecycleContractFromConfig(params.target.config)
        const targetAttrs = await loadRuntimeObjectAttrs(params.ctx.manager, params.ctx.schemaIdent, params.target.id)
        const accessConditionValues: unknown[] = []
        const targetTableSql = qSchemaTable(params.ctx.schemaName, params.target.tableName)
        const accessCondition = await buildRuntimeRecordAccessClause({
            manager: params.ctx.manager,
            schemaIdent: params.ctx.schemaIdent,
            currentWorkspaceId: params.ctx.currentWorkspaceId,
            currentUserId: params.ctx.userId,
            permissions: params.ctx.permissions,
            objectCodename: params.target.codename,
            attrs: targetAttrs,
            config: params.target.config,
            outerRowIdSql: `${targetTableSql}.id`,
            values: accessConditionValues
        })
        return service.runRecordsListReport({
            executor: params.ctx.manager,
            schemaName: params.ctx.schemaName,
            tableName: params.target.tableName,
            fields: params.target.fields,
            definition: params.definition,
            permissions: params.ctx.permissions,
            activeCondition: buildRuntimeActiveRowCondition(
                lifecycleContract,
                params.target.config,
                undefined,
                params.ctx.currentWorkspaceId
            ),
            accessCondition: accessCondition ?? undefined,
            accessConditionValues,
            limit: params.limit,
            offset: params.offset,
            maxLimit: params.maxLimit,
            defaultLimit: params.defaultLimit,
            filters: requestFilters
        })
    }

    const runReport = async (req: Request, res: Response) => {
        const parsed = reportRunBodySchema.safeParse(req.body ?? {})
        if (!parsed.success) {
            res.status(400).json({ error: 'Invalid report payload', details: parsed.error.flatten() })
            return
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, req.params.applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'readReports')) return

        try {
            const { definition, target } = await resolveSavedReportExecution(ctx, parsed.data)
            const result = await runResolvedReport({
                ctx,
                definition,
                target,
                limit: parsed.data.limit,
                offset: parsed.data.offset,
                filters: parsed.data.filters
            })

            res.json(result)
        } catch (error) {
            if (error instanceof UpdateFailure) {
                res.status(error.statusCode).json(error.body)
                return
            }
            throw error
        }
    }

    const exportReport = async (req: Request, res: Response) => {
        const parsed = reportExportBodySchema.safeParse(req.body ?? {})
        if (!parsed.success) {
            res.status(400).json({ error: 'Invalid report export payload', details: parsed.error.flatten() })
            return
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, req.params.applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'readReports')) return

        try {
            const { definition, target } = await resolveSavedReportExecution(ctx, parsed.data)
            const result = await runResolvedReport({
                ctx,
                definition,
                target,
                limit: parsed.data.limit,
                offset: parsed.data.offset,
                maxLimit: 5000,
                defaultLimit: 5000,
                locale: parsed.data.locale,
                filters: parsed.data.filters
            })
            const csv = serializeRuntimeReportCsv(result, parsed.data.locale)
            const filename = buildCsvAttachmentFilename(definition.codename)

            res.setHeader('Content-Type', 'text/csv; charset=utf-8')
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
            res.status(200).send(csv)
        } catch (error) {
            if (error instanceof UpdateFailure) {
                res.status(error.statusCode).json(error.body)
                return
            }
            throw error
        }
    }

    return {
        runReport,
        exportReport
    }
}
