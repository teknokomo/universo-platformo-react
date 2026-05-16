import type { Request, Response } from 'express'
import { z } from 'zod'
import { reportDefinitionSchema } from '@universo/types'
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

const reportRunBodySchema = z
    .object({
        reportId: z.string().trim().min(1).max(128).optional(),
        reportCodename: z.string().trim().min(1).max(128).optional(),
        limit: z.coerce.number().int().positive().max(500).optional(),
        offset: z.coerce.number().int().min(0).optional()
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
    tableName: string
    config?: Record<string, unknown> | null
    fields: RuntimeReportFieldMetadata[]
}

type RuntimeReportObjectTarget = RuntimeReportTarget & {
    definitionColumnName: string
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
    }>
): RuntimeReportFieldMetadata[] =>
    rawFields
        .filter((field) => IDENTIFIER_REGEX.test(field.column_name))
        .map((field) => ({
            codename: resolveRuntimeCodenameText(field.codename) || field.column_name,
            columnName: field.column_name,
            dataType: field.data_type
        }))

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

const resolveReportTarget = async (params: {
    executor: DbExecutor
    schemaIdent: string
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

    return {
        id: target.id,
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
        const target = await resolveReportTarget({
            executor: ctx.manager,
            schemaIdent: ctx.schemaIdent,
            definition
        })

        return { definition, target }
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
            const lifecycleContract = resolveApplicationLifecycleContractFromConfig(target.config)
            const result = await service.runRecordsListReport({
                executor: ctx.manager,
                schemaName: ctx.schemaName,
                tableName: target.tableName,
                fields: target.fields,
                definition,
                permissions: ctx.permissions,
                activeCondition: buildRuntimeActiveRowCondition(lifecycleContract, target.config, undefined, ctx.currentWorkspaceId),
                limit: parsed.data.limit,
                offset: parsed.data.offset
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
            const lifecycleContract = resolveApplicationLifecycleContractFromConfig(target.config)
            const result = await service.runRecordsListReport({
                executor: ctx.manager,
                schemaName: ctx.schemaName,
                tableName: target.tableName,
                fields: target.fields,
                definition,
                permissions: ctx.permissions,
                activeCondition: buildRuntimeActiveRowCondition(lifecycleContract, target.config, undefined, ctx.currentWorkspaceId),
                limit: parsed.data.limit,
                offset: parsed.data.offset,
                maxLimit: 5000,
                defaultLimit: 5000
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
