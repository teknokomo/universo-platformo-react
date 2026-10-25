import { z } from 'zod'
import { publicApplicationRouteResolutionSchema } from './applicationAliases'
import {
    detailsTableWidgetConfigSchema,
    detailsTabsWidgetConfigSchema,
    layoutInstanceKeySchema,
    menuWidgetConfigSchema
} from './applicationLayouts'
import { dashboardSideMenuConfigSchema } from './dashboardLayout'
import { interpretationNetworkCellStylePolicySchema, interpretationNetworkWorkspaceWidgetConfigSchema } from './interpretationNetworkLayout'
import { publicMarketingPageDataSchema } from './marketingPage'
import { runtimePageBlockSchema } from './pageBlocks'

/** Bound the anonymous runtime bootstrap response before buffering it in a browser. */
export const MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES = 4 * 1024 * 1024

const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

/** Public renderer identity is semantic and can never be a persisted UUID. */
export const publicApplicationInstanceKeySchema = layoutInstanceKeySchema.refine((value) => !uuidLike.test(value), {
    message: 'Public placement identity must be semantic.'
})

export const publicInterpretationNetworkHandleSchema = z
    .string()
    .trim()
    .min(24)
    .max(1024)
    .regex(/^pn1\.[A-Za-z0-9_-]+$/u)

const publicDashboardPlacementBaseShape = {
    instanceKey: publicApplicationInstanceKeySchema,
    zone: z.enum(['left', 'top', 'right', 'bottom', 'center']),
    sortOrder: z.number().int().min(0).max(100_000),
    parentInstanceKey: publicApplicationInstanceKeySchema.nullable(),
    slotKey: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .regex(/^[A-Za-z][A-Za-z0-9._:-]*$/u)
        .nullable()
}

const publicMenuTargetSchema = z
    .object({
        kind: z.enum(['hub', 'page', 'object']),
        codename: z
            .string()
            .trim()
            .min(1)
            .max(128)
            .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u)
    })
    .strict()

const hasUnsafeRelativePathCharacters = (value: string): boolean => {
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index)
        if (value[index] === '\\' || code < 0x20 || code === 0x7f) return true
    }
    return false
}

const publicMenuHrefSchema = z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .refine((value) => {
        if (value.startsWith('/') && !value.startsWith('//')) return !hasUnsafeRelativePathCharacters(value)
        try {
            const parsed = new URL(value)
            return parsed.protocol === 'https:' && !parsed.username && !parsed.password
        } catch {
            return false
        }
    }, 'Menu links must use a safe public URL.')

const publicMenuItemSchema = z
    .object({
        key: z
            .string()
            .trim()
            .min(1)
            .max(160)
            .regex(/^[A-Za-z][A-Za-z0-9._:-]*$/u),
        label: z.string().trim().min(1).max(160),
        icon: z.string().trim().max(64).nullable(),
        kind: z.enum(['group', 'section', 'link']),
        target: publicMenuTargetSchema.optional(),
        href: publicMenuHrefSchema.optional()
    })
    .strict()
    .superRefine((item, context) => {
        const validShape =
            (item.kind === 'group' && item.target?.kind === 'hub' && item.href === undefined) ||
            (item.kind === 'section' && (item.target?.kind === 'page' || item.target?.kind === 'object') && item.href === undefined) ||
            (item.kind === 'link' && item.target === undefined && typeof item.href === 'string')
        if (!validShape) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Public menu item shape is invalid.' })
    })

const publicMenuItemListSchema = (maxItems: number) =>
    z
        .array(publicMenuItemSchema)
        .max(maxItems)
        .superRefine((items, context) => {
            const keys = new Set<string>()
            items.forEach((item, index) => {
                if (keys.has(item.key))
                    context.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'key'], message: 'Menu keys must be unique.' })
                keys.add(item.key)
            })
        })

const publicDashboardNavigationTargetSchema = z
    .object({
        kind: z.enum(['page', 'object']),
        codename: publicMenuTargetSchema.shape.codename
    })
    .strict()

/** A single anonymous-safe route from the first page to the next configured section. */
export const publicDashboardNavigationActionSchema = z
    .object({
        label: z.string().trim().min(1).max(160),
        source: publicDashboardNavigationTargetSchema,
        target: publicDashboardNavigationTargetSchema
    })
    .strict()
    .superRefine((action, context) => {
        if (action.source.kind === action.target.kind && action.source.codename === action.target.codename) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['target'],
                message: 'The public navigation action must point to a different section.'
            })
        }
    })

export const publicDashboardMenuDataSchema = z
    .object({
        title: z.string().max(160),
        showTitle: z.boolean(),
        overflowLabel: z.string().trim().min(1).max(80),
        items: publicMenuItemListSchema(1),
        overflowItems: publicMenuItemListSchema(0),
        navigationAction: publicDashboardNavigationActionSchema.optional()
    })
    .strict()
    .superRefine((menu, context) => {
        const firstItem = menu.items[0]
        const actionSource = menu.navigationAction?.source
        if (
            firstItem?.kind === 'section' &&
            firstItem.target &&
            actionSource &&
            (firstItem.target.kind !== actionSource.kind || firstItem.target.codename !== actionSource.codename)
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['navigationAction', 'source'],
                message: 'The public navigation action must start from the first configured section.'
            })
        }
    })

const publicDashboardTablePayloadSchema = z
    .object({
        kind: z.literal('table'),
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
                        cells: z.array(z.object({ key: z.string().trim().min(1).max(64), value: z.string().max(2000) }).strict()).max(64)
                    })
                    .strict()
            )
            .max(1000),
        pagination: z
            .object({
                total: z.number().int().nonnegative(),
                limit: z.number().int().positive().max(1000),
                offset: z.number().int().nonnegative()
            })
            .strict()
            .optional()
    })
    .strict()
    .superRefine((table, context) => {
        const columnKeys = new Set<string>()
        table.columns.forEach((column, index) => {
            if (columnKeys.has(column.key)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['columns', index, 'key'],
                    message: 'Public table column keys must be unique.'
                })
            }
            columnKeys.add(column.key)
        })
        table.rows.forEach((row, rowIndex) => {
            const rowKeys = new Set<string>()
            row.cells.forEach((cell, cellIndex) => {
                if (!columnKeys.has(cell.key) || rowKeys.has(cell.key)) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['rows', rowIndex, 'cells', cellIndex, 'key'],
                        message: 'Public table cells must match one unique display column.'
                    })
                }
                rowKeys.add(cell.key)
            })
        })
    })

/** Public dashboard data deliberately excludes record handles and all mutation targets. */
export const publicDashboardReadOnlyDataSchema = z.union([
    publicDashboardTablePayloadSchema,
    z
        .object({
            kind: z.literal('record'),
            title: z.string().max(160),
            fields: z.array(z.object({ label: z.string().trim().min(1).max(120), value: z.string().max(2000) }).strict()).max(64)
        })
        .strict()
])

const publicDashboardDetailsTableConfigSchema = z.union([
    detailsTableWidgetConfigSchema.options[0].omit({
        createTargets: true,
        rowActions: true,
        restoreTarget: true,
        rowCountWarning: true,
        sequencePolicy: true,
        workflowActions: true,
        enableRowReordering: true
    }),
    detailsTableWidgetConfigSchema.options[1].omit({
        createTargets: true,
        rowActions: true,
        restoreTarget: true,
        rowCountWarning: true,
        enableRowReordering: true
    }),
    detailsTableWidgetConfigSchema.options[2]
])

const publicDashboardMenuRuntimeDataSchema = z.discriminatedUnion('status', [
    z.object({ status: z.literal('ready'), data: publicDashboardMenuDataSchema }).strict(),
    z.object({ status: z.literal('deferred') }).strict()
])

const publicDashboardReadOnlyRuntimeDataSchema = z.discriminatedUnion('status', [
    z.object({ status: z.literal('ready'), data: publicDashboardReadOnlyDataSchema }).strict(),
    z.object({ status: z.literal('empty') }).strict()
])

export const publicDashboardLayoutConfigSchema = z
    .object({
        sideMenu: dashboardSideMenuConfigSchema.optional()
    })
    .strict()
export type PublicDashboardLayoutConfig = z.infer<typeof publicDashboardLayoutConfigSchema>

const publicDashboardShellConfigSchema = z.object({}).strict()

export const publicInterpretationNetworkRendererConfigSchema = interpretationNetworkWorkspaceWidgetConfigSchema
    .innerType()
    .pick({
        structureMode: true,
        matrixMode: true,
        allowedMatrixViews: true,
        defaultMatrixView: true,
        tableProjection: true,
        breadcrumbDepth: true,
        toolbarLayout: true,
        showHierarchicalTableHeaders: true,
        showHierarchicalTableHeaderCard: true,
        showMatrixTreeTotalCells: true,
        colorBreadcrumbsByCell: true,
        cellStylePolicy: true,
        splitPane: true,
        templatePanel: true,
        hierarchyRowMode: true,
        positionNumbering: true,
        allowNewAxesInCellDialog: true
    })
    .strict()
    .superRefine((config, context) => {
        const matrixMode = config.matrixMode ?? 'hierarchicalCells'
        const allowedMatrixViews = config.allowedMatrixViews ?? (config.defaultMatrixView ? [config.defaultMatrixView] : ['table'])
        const uniqueViews = new Set(allowedMatrixViews)

        if (uniqueViews.size !== allowedMatrixViews.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['allowedMatrixViews'],
                message: 'Matrix views must be unique.'
            })
        }
        if (matrixMode === 'independentRows' && uniqueViews.has('verticalTree')) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['allowedMatrixViews'],
                message: 'Vertical tree view is available only for hierarchical matrix cells.'
            })
        }
        if (config.defaultMatrixView && !uniqueViews.has(config.defaultMatrixView)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['defaultMatrixView'],
                message: 'Default Matrix view must be allowed.'
            })
        }
        if (matrixMode === 'independentRows' && config.tableProjection === 'hierarchicalPath') {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['tableProjection'],
                message: 'Hierarchical table projection is available only for hierarchical matrix cells.'
            })
        }
    })

const publicDashboardPlacementSchemas = [
    z
        .object({
            ...publicDashboardPlacementBaseShape,
            widgetKey: z.literal('menuWidget'),
            config: menuWidgetConfigSchema,
            runtimeData: publicDashboardMenuRuntimeDataSchema
        })
        .strict(),
    ...(['appNavbar', 'header', 'languageSwitcher', 'colorModeSwitcher'] as const).map((widgetKey) =>
        z
            .object({ ...publicDashboardPlacementBaseShape, widgetKey: z.literal(widgetKey), config: publicDashboardShellConfigSchema })
            .strict()
    ),
    z
        .object({
            ...publicDashboardPlacementBaseShape,
            widgetKey: z.literal('detailsTabs'),
            config: detailsTabsWidgetConfigSchema
        })
        .strict(),
    z
        .object({
            ...publicDashboardPlacementBaseShape,
            widgetKey: z.literal('detailsTable'),
            config: publicDashboardDetailsTableConfigSchema,
            runtimeData: publicDashboardReadOnlyRuntimeDataSchema
        })
        .strict(),
    z
        .object({
            ...publicDashboardPlacementBaseShape,
            widgetKey: z.literal('interpretationNetworkWorkspace'),
            config: publicInterpretationNetworkRendererConfigSchema,
            runtimeData: z.object({ status: z.literal('deferred') }).strict()
        })
        .strict()
] as const

export const publicDashboardPlacementSchema = z
    .discriminatedUnion('widgetKey', publicDashboardPlacementSchemas)
    .superRefine((placement, context) => {
        if ((placement.parentInstanceKey === null) !== (placement.slotKey === null)) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: 'Parent and slot must either both be set or both be null.' })
        }
    })
export type PublicDashboardPlacement = z.infer<typeof publicDashboardPlacementSchema>

export const publicDashboardRuntimeSchema = z
    .object({
        locale: z.enum(['en', 'ru']),
        workspaceAvailability: z.enum(['available', 'none']),
        layoutConfig: publicDashboardLayoutConfigSchema.optional(),
        pageBlocks: z.array(runtimePageBlockSchema).max(500).optional(),
        placements: z.array(publicDashboardPlacementSchema).max(64)
    })
    .strict()
    .superRefine((dashboard, context) => {
        const placementsByKey = new Map<string, PublicDashboardPlacement>()
        dashboard.placements.forEach((placement, index) => {
            if (placementsByKey.has(placement.instanceKey)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['placements', index, 'instanceKey'],
                    message: 'Placement keys must be unique.'
                })
            }
            placementsByKey.set(placement.instanceKey, placement)
        })
        dashboard.placements.forEach((placement, index) => {
            if (placement.parentInstanceKey !== null && !placementsByKey.has(placement.parentInstanceKey)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['placements', index, 'parentInstanceKey'],
                    message: 'Placement parent is missing.'
                })
            }
        })
    })
export type PublicDashboardRuntime = z.infer<typeof publicDashboardRuntimeSchema>

export const publicInterpretationNetworkPageInfoSchema = z
    .object({
        offset: z.number().int().min(0).max(10_000),
        limit: z.number().int().positive().max(250),
        hasMore: z.boolean()
    })
    .strict()

const publicStructureSchema = z
    .object({
        handle: publicInterpretationNetworkHandleSchema,
        name: z.string().trim().min(1).max(255),
        description: z.string().max(2000).nullable()
    })
    .strict()

const publicInterpretationSchema = z
    .object({
        handle: publicInterpretationNetworkHandleSchema,
        title: z.string().trim().min(1).max(255)
    })
    .strict()

const publicCellStyleSchema = z
    .object({
        fillColor: z
            .string()
            .regex(/^#[0-9A-F]{6}$/u)
            .optional(),
        textColor: z
            .string()
            .regex(/^#[0-9A-F]{6}$/u)
            .optional(),
        borderTop: z
            .string()
            .regex(/^#[0-9A-F]{6}$/u)
            .optional(),
        borderRight: z
            .string()
            .regex(/^#[0-9A-F]{6}$/u)
            .optional(),
        borderBottom: z
            .string()
            .regex(/^#[0-9A-F]{6}$/u)
            .optional(),
        borderLeft: z
            .string()
            .regex(/^#[0-9A-F]{6}$/u)
            .optional()
    })
    .strict()

const publicMatrixCellSchema = z
    .object({
        handle: publicInterpretationNetworkHandleSchema,
        parentHandle: publicInterpretationNetworkHandleSchema.nullable(),
        rowHandle: publicInterpretationNetworkHandleSchema,
        rowLabel: z.string().max(255),
        columnHandle: publicInterpretationNetworkHandleSchema,
        columnLabel: z.string().max(255),
        value: z.string().max(2000),
        description: z.string().max(2000),
        sortOrder: z.number().int().min(0).max(2_147_483_647),
        style: publicCellStyleSchema
    })
    .strict()

const publicMaterialSchema = z
    .object({
        title: z.string().trim().min(1).max(255),
        description: z.string().max(2000).nullable(),
        bodyText: z.string().max(10_000),
        isPrimary: z.boolean()
    })
    .strict()

const publicInterpretationNetworkResponseBaseSchema = z.object({ locale: z.enum(['en', 'ru']) })

export const publicInterpretationNetworkReadResponseSchema = z.discriminatedUnion('view', [
    publicInterpretationNetworkResponseBaseSchema
        .extend({
            view: z.literal('structures'),
            items: z.array(publicStructureSchema).max(100),
            page: publicInterpretationNetworkPageInfoSchema
        })
        .strict(),
    publicInterpretationNetworkResponseBaseSchema
        .extend({
            view: z.literal('interpretations'),
            structure: publicStructureSchema,
            items: z.array(publicInterpretationSchema).max(100),
            page: publicInterpretationNetworkPageInfoSchema
        })
        .strict(),
    publicInterpretationNetworkResponseBaseSchema
        .extend({
            view: z.literal('matrix'),
            interpretation: publicInterpretationSchema,
            items: z.array(publicMatrixCellSchema).max(250),
            page: publicInterpretationNetworkPageInfoSchema
        })
        .strict(),
    publicInterpretationNetworkResponseBaseSchema
        .extend({
            view: z.literal('materials'),
            cellHandle: publicInterpretationNetworkHandleSchema,
            items: z.array(publicMaterialSchema).max(25),
            page: publicInterpretationNetworkPageInfoSchema
        })
        .strict()
])
export type PublicInterpretationNetworkReadResponse = z.infer<typeof publicInterpretationNetworkReadResponseSchema>

const publicMarketingApplicationRuntimeSchema = z
    .object({
        route: publicApplicationRouteResolutionSchema,
        templateKey: z.literal('marketing-page'),
        marketingPage: publicMarketingPageDataSchema
    })
    .strict()

const publicDashboardApplicationRuntimeSchema = z
    .object({
        route: publicApplicationRouteResolutionSchema,
        templateKey: z.literal('dashboard'),
        dashboard: publicDashboardRuntimeSchema
    })
    .strict()

/** Strict public application contract. Marketing retains its existing bounded projection. */
export const publicApplicationRuntimeSchema = z.discriminatedUnion('templateKey', [
    publicMarketingApplicationRuntimeSchema,
    publicDashboardApplicationRuntimeSchema
])
export type PublicApplicationRuntime = z.infer<typeof publicApplicationRuntimeSchema>

export type PublicInterpretationNetworkCellStylePolicy = z.infer<typeof interpretationNetworkCellStylePolicySchema>
