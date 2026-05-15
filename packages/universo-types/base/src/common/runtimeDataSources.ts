import { z } from 'zod'

export const RUNTIME_DATASOURCE_KINDS = ['records.list', 'ledger.facts', 'ledger.projection', 'metric'] as const
export type RuntimeDatasourceKind = (typeof RUNTIME_DATASOURCE_KINDS)[number]

export const runtimeDatasourceSortDirectionSchema = z.enum(['asc', 'desc'])
export type RuntimeDatasourceSortDirection = z.infer<typeof runtimeDatasourceSortDirectionSchema>

export const runtimeDatasourceSortSchema = z
    .object({
        field: z.string().min(1).max(128),
        direction: runtimeDatasourceSortDirectionSchema
    })
    .strict()
export type RuntimeDatasourceSort = z.infer<typeof runtimeDatasourceSortSchema>

export const runtimeDatasourceFilterOperatorSchema = z.enum([
    'contains',
    'equals',
    'startsWith',
    'endsWith',
    'isEmpty',
    'isNotEmpty',
    'greaterThan',
    'greaterThanOrEqual',
    'lessThan',
    'lessThanOrEqual'
])
export type RuntimeDatasourceFilterOperator = z.infer<typeof runtimeDatasourceFilterOperatorSchema>

export const runtimeDatasourceFilterSchema = z
    .object({
        field: z.string().min(1).max(128),
        operator: runtimeDatasourceFilterOperatorSchema,
        value: z.unknown().optional()
    })
    .strict()
export type RuntimeDatasourceFilter = z.infer<typeof runtimeDatasourceFilterSchema>

export const runtimeDatasourceListQuerySchema = z
    .object({
        search: z.string().trim().max(200).optional(),
        sort: z.array(runtimeDatasourceSortSchema).max(5).optional(),
        filters: z.array(runtimeDatasourceFilterSchema).max(20).optional()
    })
    .strict()
export type RuntimeDatasourceListQuery = z.infer<typeof runtimeDatasourceListQuerySchema>

const datasourceBaseSchema = z
    .object({
        id: z.string().min(1).max(128).optional(),
        title: z.record(z.string(), z.unknown()).optional()
    })
    .strict()

export const recordsListDatasourceSchema = datasourceBaseSchema
    .extend({
        kind: z.literal('records.list'),
        objectCollectionId: z.string().uuid().nullable().optional(),
        objectCollectionCodename: z.string().min(1).max(128).nullable().optional(),
        sectionId: z.string().uuid().nullable().optional(),
        sectionCodename: z.string().min(1).max(128).nullable().optional(),
        query: runtimeDatasourceListQuerySchema.optional()
    })
    .strict()

export const ledgerFactsDatasourceSchema = datasourceBaseSchema
    .extend({
        kind: z.literal('ledger.facts'),
        ledgerId: z.string().uuid().nullable().optional(),
        ledgerCodename: z.string().min(1).max(128).nullable().optional(),
        query: runtimeDatasourceListQuerySchema.optional()
    })
    .strict()

export const ledgerProjectionDatasourceSchema = datasourceBaseSchema
    .extend({
        kind: z.literal('ledger.projection'),
        ledgerId: z.string().uuid().nullable().optional(),
        ledgerCodename: z.string().min(1).max(128).nullable().optional(),
        projectionCodename: z.string().min(1).max(128),
        filters: z.record(z.unknown()).optional()
    })
    .strict()

export const metricDatasourceSchema = datasourceBaseSchema
    .extend({
        kind: z.literal('metric'),
        metricKey: z.string().min(1).max(128),
        params: z.record(z.unknown()).optional()
    })
    .strict()

export const recordsCountMetricDatasourceSchema = metricDatasourceSchema
    .extend({
        metricKey: z.literal('records.count'),
        params: z
            .object({
                objectCollectionId: z.string().uuid().optional(),
                objectCollectionCodename: z.string().min(1).max(128).optional(),
                sectionId: z.string().uuid().optional(),
                sectionCodename: z.string().min(1).max(128).optional(),
                search: z.string().trim().max(200).optional()
            })
            .strict()
            .optional()
    })
    .strict()
export type RecordsCountMetricDatasource = z.infer<typeof recordsCountMetricDatasourceSchema>

export const runtimeDatasourceDescriptorSchema = z.discriminatedUnion('kind', [
    recordsListDatasourceSchema,
    ledgerFactsDatasourceSchema,
    ledgerProjectionDatasourceSchema,
    metricDatasourceSchema
])
export type RuntimeDatasourceDescriptor = z.infer<typeof runtimeDatasourceDescriptorSchema>
