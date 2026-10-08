import { z } from 'zod'
import { runtimePageBlockSchema } from './pageBlocks'
import { resourceSourceSchema } from './resourceSources'

const metricCardSchema = z
    .object({
        label: z.string().trim().min(1).max(120),
        value: z.string().max(80),
        trend: z.enum(['up', 'down', 'neutral']).optional(),
        trendLabel: z.string().trim().max(80).optional(),
        sparkline: z.array(z.number().finite()).max(120).optional()
    })
    .strict()

const rowFieldSchema = z.object({ label: z.string().trim().min(1).max(120), value: z.string().max(2000) }).strict()

export const runtimeRecordHandleSchema = z
    .string()
    .trim()
    .min(24)
    .max(1024)
    .regex(/^rh1\.[A-Za-z0-9_-]+$/u)

const runtimeRecordTargetSchema = z
    .object({
        entityCodename: z
            .string()
            .trim()
            .min(1)
            .max(128)
            .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u),
        recordHandle: runtimeRecordHandleSchema,
        version: z.number().int().positive().optional()
    })
    .strict()

const relationRowTargetSchema = runtimeRecordTargetSchema.extend({ version: z.number().int().positive() }).strict()

const relationDisplayKeySchema = z.string().regex(/^display[1-8]$/u)
const isUuidText = (value: string): boolean =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value.trim())
const isJsonContainerText = (value: string): boolean => {
    const trimmed = value.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false
    try {
        const parsed: unknown = JSON.parse(trimmed)
        return Boolean(parsed && typeof parsed === 'object')
    } catch {
        return false
    }
}
const relationDisplayTextSchema = z
    .string()
    .max(240)
    .refine((value) => !isUuidText(value) && !isJsonContainerText(value), 'Relation display values must be bounded semantic text.')

const relationDisplayColumnSchema = z.object({ key: relationDisplayKeySchema, label: z.string().trim().min(1).max(120) }).strict()
const relationDisplayCellSchema = z.object({ key: relationDisplayKeySchema, value: relationDisplayTextSchema }).strict()

const tableMutationTargetSchema = z
    .object({
        recordHandle: runtimeRecordHandleSchema,
        entityCodename: z
            .string()
            .trim()
            .min(1)
            .max(128)
            .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u),
        version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
    })
    .strict()

const tableRowActionTargetSchema = z
    .object({
        recordHandle: runtimeRecordHandleSchema,
        entityCodename: z
            .string()
            .trim()
            .min(1)
            .max(128)
            .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u)
    })
    .strict()

const relationPanelSchema = z
    .object({
        slotKey: z
            .string()
            .trim()
            .min(1)
            .max(128)
            .regex(/^panel:[A-Za-z][A-Za-z0-9._-]{0,63}$/u),
        title: z.string().max(160),
        targetEntityCodename: z
            .string()
            .trim()
            .min(1)
            .max(128)
            .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u),
        parentFieldCodename: z
            .string()
            .trim()
            .min(1)
            .max(128)
            .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u),
        displayColumns: z.array(relationDisplayColumnSchema).max(8).optional(),
        rows: z
            .array(
                z
                    .object({
                        key: z.string().trim().min(1).max(128),
                        parentKey: z.string().trim().min(1).max(128),
                        label: z.string().trim().min(1).max(160),
                        target: relationRowTargetSchema,
                        cells: z.array(relationDisplayCellSchema).max(8).optional()
                    })
                    .strict()
            )
            .max(1000)
    })
    .strict()
    .superRefine((panel, context) => {
        const columnKeys = (panel.displayColumns ?? []).map(({ key }) => key)
        if (new Set(columnKeys).size !== columnKeys.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['displayColumns'],
                message: 'Relation display column keys must be unique.'
            })
        }
        panel.rows.forEach((row, index) => {
            const cellKeys = row.cells?.map(({ key }) => key) ?? []
            const cellsMatchColumns =
                cellKeys.length === columnKeys.length && cellKeys.every((key, cellIndex) => key === columnKeys[cellIndex])
            if ((columnKeys.length > 0 && !cellsMatchColumns) || (columnKeys.length === 0 && row.cells !== undefined)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['rows', index, 'cells'],
                    message: 'Relation row display cells must match the panel display columns.'
                })
            }
        })
    })

const menuTargetSchema = z.discriminatedUnion('kind', [
    z
        .object({
            kind: z.literal('hub'),
            codename: z
                .string()
                .trim()
                .min(1)
                .max(128)
                .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u)
        })
        .strict(),
    z
        .object({
            kind: z.literal('page'),
            codename: z
                .string()
                .trim()
                .min(1)
                .max(128)
                .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u)
        })
        .strict(),
    z
        .object({
            kind: z.literal('object'),
            codename: z
                .string()
                .trim()
                .min(1)
                .max(128)
                .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u)
        })
        .strict()
])

const menuItemSchema = z
    .object({
        key: z
            .string()
            .trim()
            .min(1)
            .max(160)
            .regex(/^[A-Za-z][A-Za-z0-9._:-]*$/u),
        label: z.string().trim().min(1).max(160),
        icon: z.string().trim().max(64).nullable(),
        kind: z.enum(['group', 'section', 'link', 'workspaces']),
        target: menuTargetSchema.optional(),
        href: z.string().trim().min(1).max(2048).optional()
    })
    .strict()
    .superRefine((item, context) => {
        const validShape =
            (item.kind === 'group' && item.target?.kind === 'hub' && item.href === undefined) ||
            (item.kind === 'section' && (item.target?.kind === 'page' || item.target?.kind === 'object') && item.href === undefined) ||
            (item.kind === 'link' && item.target === undefined && typeof item.href === 'string') ||
            (item.kind === 'workspaces' && item.target === undefined && item.href === undefined)
        if (!validShape) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: 'Menu item target does not match its semantic kind.' })
        }
    })

const menuItemListSchema = z
    .array(menuItemSchema)
    .max(100)
    .superRefine((items, context) => {
        const keys = new Set<string>()
        items.forEach(({ key }, index) => {
            if (keys.has(key)) {
                context.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'key'], message: 'Menu item keys must be unique.' })
            }
            keys.add(key)
        })
    })

export const effectiveWidgetRuntimePayloadSchema = z.union([
    z
        .object({
            kind: z.literal('report'),
            codename: z
                .string()
                .trim()
                .min(1)
                .max(128)
                .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u),
            title: z.string().trim().min(1).max(160)
        })
        .strict(),
    z
        .object({
            kind: z.literal('menu'),
            title: z.string().max(160),
            showTitle: z.boolean(),
            overflowLabel: z.string().trim().min(1).max(80),
            items: menuItemListSchema,
            overflowItems: menuItemListSchema
        })
        .strict(),
    z.object({ kind: z.literal('info-card'), title: z.string().max(160), body: z.string().max(2000) }).strict(),
    z.object({ kind: z.literal('title'), text: z.string().max(160) }).strict(),
    z.object({ kind: z.literal('metrics'), cards: z.array(metricCardSchema).max(8) }).strict(),
    z.object({ kind: z.literal('record'), title: z.string().max(160), fields: z.array(rowFieldSchema).max(64) }).strict(),
    z
        .object({
            kind: z.literal('relation'),
            parents: z
                .array(
                    z
                        .object({
                            key: z.string().trim().min(1).max(128),
                            label: z.string().trim().min(1).max(160),
                            target: runtimeRecordTargetSchema
                        })
                        .strict()
                )
                .max(100),
            panels: z.array(relationPanelSchema).max(32)
        })
        .strict(),
    z.object({ kind: z.literal('resource'), title: z.string().max(160), source: resourceSourceSchema }).strict(),
    z
        .object({
            kind: z.literal('learner-player'),
            parents: z
                .array(
                    z
                        .object({
                            key: z.string().trim().min(1).max(128),
                            label: z.string().trim().min(1).max(160),
                            target: runtimeRecordTargetSchema
                        })
                        .strict()
                )
                .max(100),
            items: z
                .array(
                    z
                        .object({
                            key: z
                                .string()
                                .trim()
                                .min(1)
                                .max(128)
                                .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u),
                            parentKey: z.string().trim().min(1).max(128),
                            title: z.string().trim().min(1).max(160),
                            blocks: z.array(runtimePageBlockSchema).max(256),
                            progressTarget: z
                                .object({
                                    objectCodename: z
                                        .string()
                                        .trim()
                                        .min(1)
                                        .max(128)
                                        .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u),
                                    recordHandle: runtimeRecordHandleSchema
                                })
                                .strict(),
                            availability: z.enum(['available', 'locked', 'completed']).optional(),
                            progressPercent: z.number().int().min(0).max(100).optional()
                        })
                        .strict()
                )
                .max(100)
        })
        .strict()
        .superRefine((payload, context) => {
            const parentKeys = new Set<string>()
            payload.parents.forEach((parent, index) => {
                if (parentKeys.has(parent.key)) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['parents', index, 'key'],
                        message: 'Learner-player parent keys must be unique.'
                    })
                }
                parentKeys.add(parent.key)
            })
            payload.items.forEach((item, index) => {
                if (!parentKeys.has(item.parentKey)) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['items', index, 'parentKey'],
                        message: 'Learner-player items must reference a projected parent.'
                    })
                }
            })
        }),
    z
        .object({
            kind: z.literal('table'),
            sourceEntityCodename: z
                .string()
                .trim()
                .min(1)
                .max(128)
                .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u)
                .optional(),
            columns: z
                .array(
                    z
                        .object({
                            key: z.string().trim().min(1).max(64),
                            label: z.string().trim().min(1).max(120),
                            valueType: z.enum(['string', 'number', 'boolean']).optional()
                        })
                        .strict()
                )
                .min(1)
                .max(64),
            rows: z
                .array(
                    z
                        .object({
                            key: z
                                .string()
                                .trim()
                                .min(1)
                                .max(128)
                                .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u),
                            mutationTarget: tableMutationTargetSchema.optional(),
                            actionTarget: tableRowActionTargetSchema.optional(),
                            target: runtimeRecordTargetSchema
                                .extend({
                                    displayType: z.string().trim().min(1).max(64),
                                    starred: z.boolean(),
                                    shared: z.boolean()
                                })
                                .strict()
                                .optional(),
                            cells: z
                                .array(z.object({ key: z.string().trim().min(1).max(64), value: z.string().max(2000) }).strict())
                                .max(64)
                        })
                        .strict()
                )
                .max(1000),
            pagination: z
                .object({
                    total: z.number().int().nonnegative(),
                    limit: z.number().int().positive().max(1000),
                    offset: z.number().int().nonnegative(),
                    complete: z.literal(true).optional()
                })
                .strict()
                .optional()
        })
        .strict()
        .superRefine((table, context) => {
            const columnKeys = new Set<string>()
            table.columns.forEach(({ key }, index) => {
                if (columnKeys.has(key)) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['columns', index, 'key'],
                        message: 'Duplicate table column key.'
                    })
                }
                columnKeys.add(key)
            })
            table.rows.forEach((row, rowIndex) => {
                const rowKeys = new Set<string>()
                row.cells.forEach((cell, cellIndex) => {
                    if (!columnKeys.has(cell.key) || rowKeys.has(cell.key)) {
                        context.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: ['rows', rowIndex, 'cells', cellIndex, 'key'],
                            message: 'Table cell does not match one unique display column.'
                        })
                    }
                    rowKeys.add(cell.key)
                })
                if (row.mutationTarget && table.pagination?.complete !== true) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['rows', rowIndex, 'mutationTarget'],
                        message: 'Table mutation targets require a complete record set.'
                    })
                }
            })
            if (table.sourceEntityCodename !== undefined && table.pagination?.complete !== true) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['sourceEntityCodename'],
                    message: 'A semantic table source requires complete-set pagination metadata.'
                })
            }
            if (
                table.pagination?.complete === true &&
                (!table.sourceEntityCodename || table.rows.some((row) => row.mutationTarget === undefined))
            ) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['pagination', 'complete'],
                    message: 'Complete reorder metadata requires one semantic source and a mutation target for every row.'
                })
            }
        }),
    z
        .object({
            kind: z.literal('series'),
            title: z.string().max(160),
            labels: z.array(z.string().max(120)).max(366),
            series: z
                .array(
                    z
                        .object({
                            id: z.string().trim().min(1).max(64),
                            label: z.string().trim().min(1).max(120),
                            values: z.array(z.number().finite()).max(366)
                        })
                        .strict()
                )
                .max(8)
        })
        .strict()
        .superRefine((series, context) => {
            series.series.forEach((item, index) => {
                if (series.labels.length !== item.values.length) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['series', index, 'values'],
                        message: 'Series labels and values must have matching lengths.'
                    })
                }
            })
        })
])

export const effectiveWidgetRuntimeDataSchema = z.discriminatedUnion('status', [
    z.object({ status: z.literal('loading') }).strict(),
    z.object({ status: z.literal('optional-unbound') }).strict(),
    z.object({ status: z.literal('required-missing') }).strict(),
    z.object({ status: z.literal('stale-source') }).strict(),
    z.object({ status: z.literal('permission-denied') }).strict(),
    z.object({ status: z.literal('malformed-config') }).strict(),
    z.object({ status: z.literal('network-error') }).strict(),
    z.object({ status: z.literal('server-error') }).strict(),
    z.object({ status: z.literal('empty') }).strict(),
    z.object({ status: z.literal('ready'), data: effectiveWidgetRuntimePayloadSchema }).strict()
])

export type EffectiveWidgetRuntimeData = z.infer<typeof effectiveWidgetRuntimeDataSchema>
