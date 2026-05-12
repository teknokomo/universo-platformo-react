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
    runtimeCatalogFilterSql,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema,
    runtimeCodenameTextSql,
    UpdateFailure
} from '../shared/runtimeHelpers'
import { RuntimeReportsService, type RuntimeReportFieldMetadata } from '../services/runtimeReportsService'

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

type RuntimeReportTarget = {
    id: string
    tableName: string
    config?: Record<string, unknown> | null
    fields: RuntimeReportFieldMetadata[]
}

type RuntimeReportCatalogTarget = RuntimeReportTarget & {
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
        datasource.linkedCollectionId?.trim() ||
        datasource.sectionCodename?.trim() ||
        datasource.linkedCollectionCodename?.trim() ||
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
          AND ${runtimeCatalogFilterSql('kind', 'config')}
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
        FROM ${params.schemaIdent}._app_attributes
        WHERE object_id = $1
          AND parent_attribute_id IS NULL
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

const resolveReportsCatalogTarget = async (params: { executor: DbExecutor; schemaIdent: string }): Promise<RuntimeReportCatalogTarget> => {
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
          AND ${runtimeCatalogFilterSql('kind', 'config')}
          AND ${runtimeCodenameTextSql('codename')} = $1
        ORDER BY id ASC
        LIMIT 1
        `,
        ['Reports']
    )

    const target = targets[0]
    if (!target) {
        throw new UpdateFailure(404, {
            error: 'Reports catalog was not found in the published application',
            code: 'REPORTS_CATALOG_NOT_FOUND'
        })
    }
    if (!target.table_name || !IDENTIFIER_REGEX.test(target.table_name)) {
        throw new UpdateFailure(400, {
            error: 'Reports catalog table is invalid',
            code: 'REPORTS_CATALOG_TABLE_INVALID'
        })
    }

    const rawFields = await params.executor.query<{
        codename: unknown
        column_name: string
        data_type: RuntimeReportFieldMetadata['dataType']
    }>(
        `
        SELECT codename, column_name, data_type
        FROM ${params.schemaIdent}._app_attributes
        WHERE object_id = $1
          AND parent_attribute_id IS NULL
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
            error: 'Reports catalog does not expose a JSON Definition field',
            code: 'REPORTS_CATALOG_DEFINITION_FIELD_MISSING'
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
    reportCatalog: RuntimeReportCatalogTarget
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

    const tableSql = qSchemaTable(params.schemaName, params.reportCatalog.tableName)
    const definitionColumnSql = qColumn(params.reportCatalog.definitionColumnName)
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

export function createRuntimeReportsController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)
    const service = new RuntimeReportsService()

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
            const reportsCatalog = await resolveReportsCatalogTarget({
                executor: ctx.manager,
                schemaIdent: ctx.schemaIdent
            })
            const reportsLifecycleContract = resolveApplicationLifecycleContractFromConfig(reportsCatalog.config)
            const definition = await loadSavedReportDefinition({
                executor: ctx.manager,
                schemaName: ctx.schemaName,
                reportCatalog: reportsCatalog,
                reportId: parsed.data.reportId,
                reportCodename: parsed.data.reportCodename,
                activeCondition: buildRuntimeActiveRowCondition(
                    reportsLifecycleContract,
                    reportsCatalog.config,
                    undefined,
                    ctx.currentWorkspaceId
                )
            })
            const target = await resolveReportTarget({
                executor: ctx.manager,
                schemaIdent: ctx.schemaIdent,
                definition
            })
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

    return {
        runReport
    }
}
