import { z } from 'zod'
import { moduleBackedWidgetConfigSchema } from './moduleBackedWidgetConfig'

export const INTERPRETATION_NETWORK_SPLIT_PANE_DEFAULT = 50
export const INTERPRETATION_NETWORK_SPLIT_PANE_MIN_PERCENT = 25
export const INTERPRETATION_NETWORK_SPLIT_PANE_MAX_PERCENT = 75

export const interpretationNetworkMatrixModes = ['hierarchicalCells', 'independentRows'] as const
export type InterpretationNetworkMatrixMode = (typeof interpretationNetworkMatrixModes)[number]

export const interpretationNetworkMatrixViews = ['table', 'horizontalRows', 'verticalTree'] as const
export type InterpretationNetworkMatrixView = (typeof interpretationNetworkMatrixViews)[number]

export const interpretationNetworkTableProjections = ['hierarchicalPath', 'independentAxes'] as const
export type InterpretationNetworkTableProjection = (typeof interpretationNetworkTableProjections)[number]

export const interpretationNetworkToolbarLayouts = ['horizontal', 'vertical'] as const
export type InterpretationNetworkToolbarLayout = (typeof interpretationNetworkToolbarLayouts)[number]

export const interpretationNetworkBreadcrumbDepthCounts = [1, 2, 3, 4, 5, 6, 8, 10, 12] as const
export type InterpretationNetworkBreadcrumbDepthCount = (typeof interpretationNetworkBreadcrumbDepthCounts)[number]

export const interpretationNetworkBreadcrumbDepthSchema = z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('full') }).strict(),
    z
        .object({
            mode: z.literal('last'),
            count: z.union([
                z.literal(1),
                z.literal(2),
                z.literal(3),
                z.literal(4),
                z.literal(5),
                z.literal(6),
                z.literal(8),
                z.literal(10),
                z.literal(12)
            ])
        })
        .strict()
])
export type InterpretationNetworkBreadcrumbDepth = z.infer<typeof interpretationNetworkBreadcrumbDepthSchema>

export interface InterpretationNetworkMatrixViewSettings {
    allowedMatrixViews: InterpretationNetworkMatrixView[]
    defaultMatrixView: InterpretationNetworkMatrixView
}

export interface InterpretationNetworkTableSettings {
    tableProjection: InterpretationNetworkTableProjection
    breadcrumbDepth: InterpretationNetworkBreadcrumbDepth
    toolbarLayout: InterpretationNetworkToolbarLayout
    showHierarchicalTableHeaders: boolean
    showHierarchicalTableHeaderCard: boolean
    showMatrixTreeTotalCells: boolean
    colorBreadcrumbsByCell: boolean
}

export interface InterpretationNetworkSplitPaneSettings {
    enabled: boolean
}

export const interpretationNetworkSplitPaneSettingsSchema = z
    .object({
        enabled: z.boolean()
    })
    .strict()

export const normalizeInterpretationNetworkSplitPaneSettings = (value: unknown): InterpretationNetworkSplitPaneSettings => {
    const parsed = interpretationNetworkSplitPaneSettingsSchema.safeParse(value)
    return parsed.success ? parsed.data : { enabled: true }
}

export const normalizeInterpretationNetworkMatrixViewSettings = (
    matrixMode: InterpretationNetworkMatrixMode,
    allowedMatrixViews: readonly unknown[] | undefined,
    defaultMatrixView: unknown
): InterpretationNetworkMatrixViewSettings => {
    const fallbackView: InterpretationNetworkMatrixView = 'table'
    const requestedViews = allowedMatrixViews ?? [fallbackView]
    const allowedViews = interpretationNetworkMatrixViews.filter(
        (view) => requestedViews.includes(view) && (matrixMode === 'hierarchicalCells' || view !== 'verticalTree')
    )
    const normalizedAllowedViews: InterpretationNetworkMatrixView[] = allowedViews.length > 0 ? allowedViews : [fallbackView]
    const normalizedDefaultView =
        interpretationNetworkMatrixViews.includes(defaultMatrixView as InterpretationNetworkMatrixView) &&
        normalizedAllowedViews.includes(defaultMatrixView as InterpretationNetworkMatrixView)
            ? (defaultMatrixView as InterpretationNetworkMatrixView)
            : normalizedAllowedViews[0]

    return {
        allowedMatrixViews: normalizedAllowedViews,
        defaultMatrixView: normalizedDefaultView
    }
}

export const normalizeInterpretationNetworkTableSettings = (
    matrixMode: InterpretationNetworkMatrixMode,
    tableProjection: unknown,
    breadcrumbDepth: unknown,
    toolbarLayout: unknown,
    showHierarchicalTableHeaders: unknown = false,
    showHierarchicalTableHeaderCard: unknown = true,
    showMatrixTreeTotalCells: unknown = true,
    colorBreadcrumbsByCell: unknown = true
): InterpretationNetworkTableSettings => {
    const normalizedProjection: InterpretationNetworkTableProjection =
        matrixMode === 'independentRows'
            ? 'independentAxes'
            : tableProjection === 'independentAxes'
            ? 'independentAxes'
            : 'hierarchicalPath'
    const parsedBreadcrumbDepth = interpretationNetworkBreadcrumbDepthSchema.safeParse(breadcrumbDepth)

    return {
        tableProjection: normalizedProjection,
        breadcrumbDepth: parsedBreadcrumbDepth.success ? parsedBreadcrumbDepth.data : { mode: 'full' },
        toolbarLayout: toolbarLayout === 'vertical' ? 'vertical' : 'horizontal',
        showHierarchicalTableHeaders: showHierarchicalTableHeaders === true,
        showHierarchicalTableHeaderCard: showHierarchicalTableHeaderCard !== false,
        showMatrixTreeTotalCells: showMatrixTreeTotalCells !== false,
        colorBreadcrumbsByCell: colorBreadcrumbsByCell !== false
    }
}

export const interpretationNetworkHierarchyRowModes = ['focusedPath', 'allNodes'] as const
export type InterpretationNetworkHierarchyRowMode = (typeof interpretationNetworkHierarchyRowModes)[number]

export const interpretationNetworkPositionNumberingSchema = z
    .object({
        enabled: z.boolean().optional(),
        includeRoot: z.boolean().optional(),
        startIndex: z.number().int().min(0).max(999).optional()
    })
    .strict()

const interpretationNetworkWorkspaceWidgetConfigObjectSchema = moduleBackedWidgetConfigSchema
    .extend({
        matrixMode: z.enum(interpretationNetworkMatrixModes).optional(),
        allowedMatrixViews: z.array(z.enum(interpretationNetworkMatrixViews)).min(1).max(3).optional(),
        defaultMatrixView: z.enum(interpretationNetworkMatrixViews).optional(),
        tableProjection: z.enum(interpretationNetworkTableProjections).optional(),
        breadcrumbDepth: interpretationNetworkBreadcrumbDepthSchema.optional(),
        toolbarLayout: z.enum(interpretationNetworkToolbarLayouts).optional(),
        showHierarchicalTableHeaders: z.boolean().optional(),
        showHierarchicalTableHeaderCard: z.boolean().optional(),
        showMatrixTreeTotalCells: z.boolean().optional(),
        colorBreadcrumbsByCell: z.boolean().optional(),
        splitPane: interpretationNetworkSplitPaneSettingsSchema.optional(),
        hierarchyRowMode: z.enum(interpretationNetworkHierarchyRowModes).optional(),
        positionNumbering: interpretationNetworkPositionNumberingSchema.optional(),
        allowNewAxesInCellDialog: z.boolean().optional(),
        conceptCodename: z.string().trim().min(1).max(128).optional(),
        conceptNameField: z.string().trim().min(1).max(128).optional(),
        conceptDescriptionField: z.string().trim().min(1).max(128).optional(),
        interpretationCodename: z.string().trim().min(1).max(128).optional(),
        interpretationParentField: z.string().trim().min(1).max(128).optional(),
        matrixField: z.string().trim().min(1).max(128).optional(),
        relationCodename: z.string().trim().min(1).max(128).optional(),
        materialCodename: z.string().trim().min(1).max(128).optional(),
        materialTitleField: z.string().trim().min(1).max(128).optional(),
        interpretationTitleField: z.string().trim().min(1).max(128).optional(),
        tableTemplateCodename: z.string().trim().min(1).max(128).optional(),
        tableTemplateNameField: z.string().trim().min(1).max(128).optional(),
        tableTemplateDescriptionField: z.string().trim().min(1).max(128).optional(),
        tableTemplateMatrixField: z.string().trim().min(1).max(128).optional()
    })
    .strict()
    .superRefine((config, ctx) => {
        const matrixMode = config.matrixMode ?? 'hierarchicalCells'
        const allowedMatrixViews = config.allowedMatrixViews ?? (config.defaultMatrixView ? [config.defaultMatrixView] : ['table'])
        const uniqueViews = new Set(allowedMatrixViews)

        if (uniqueViews.size !== allowedMatrixViews.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['allowedMatrixViews'],
                message: 'Matrix views must be unique'
            })
        }
        if (matrixMode === 'independentRows' && uniqueViews.has('verticalTree')) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['allowedMatrixViews'],
                message: 'Vertical tree view is available only for hierarchical matrix cells'
            })
        }
        if (config.defaultMatrixView && !uniqueViews.has(config.defaultMatrixView)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['defaultMatrixView'],
                message: 'Default Matrix view must be allowed'
            })
        }
        if (matrixMode === 'independentRows' && config.tableProjection === 'hierarchicalPath') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['tableProjection'],
                message: 'Hierarchical table projection is available only for hierarchical matrix cells'
            })
        }
    })

export const interpretationNetworkWorkspaceWidgetConfigSchema = interpretationNetworkWorkspaceWidgetConfigObjectSchema

export type InterpretationNetworkWorkspaceWidgetConfig = z.infer<typeof interpretationNetworkWorkspaceWidgetConfigSchema>
