import { z } from 'zod'
import { dashboardLayoutConfigSchema, dashboardSideMenuConfigSchema } from './dashboardLayout'
import { DASHBOARD_LAYOUT_WIDGETS, DASHBOARD_LAYOUT_ZONES, type MenuWidgetTarget } from './metahubs'
import {
    ledgerProjectionDatasourceSchema,
    recordsListDatasourceSchema,
    runtimeDatasourceDescriptorSchema,
    statCardMetricDatasourceSchema
} from './runtimeDataSources'
import { RESOURCE_TYPES, resourceSourceSchema } from './resourceSources'
import { MODULE_ATTACHMENT_KIND_PATTERN } from './modules'
import { sequencePolicySchema } from './sequenceCompletion'
import { reportDefinitionSchema } from './lmsPlatform'
import { workflowActionSchema } from './workflowActions'

export const APPLICATION_LAYOUT_SOURCE_KINDS = ['metahub', 'application'] as const
export type ApplicationLayoutSourceKind = (typeof APPLICATION_LAYOUT_SOURCE_KINDS)[number]

export const APPLICATION_LAYOUT_SYNC_STATES = [
    'clean',
    'local_modified',
    'source_updated',
    'conflict',
    'source_removed',
    'source_excluded'
] as const
export type ApplicationLayoutSyncState = (typeof APPLICATION_LAYOUT_SYNC_STATES)[number]

export const APPLICATION_LAYOUT_SYNC_RESOLUTIONS = ['overwrite_local', 'keep_local', 'copy_source_as_application', 'skip_source'] as const
export type ApplicationLayoutSyncResolution = (typeof APPLICATION_LAYOUT_SYNC_RESOLUTIONS)[number]

export const APPLICATION_LAYOUT_SCOPE_KINDS = ['global', 'entity'] as const
export type ApplicationLayoutScopeKind = (typeof APPLICATION_LAYOUT_SCOPE_KINDS)[number]

export const applicationLayoutSourceKindSchema = z.enum(APPLICATION_LAYOUT_SOURCE_KINDS)
export const applicationLayoutSyncStateSchema = z.enum(APPLICATION_LAYOUT_SYNC_STATES)
export const applicationLayoutSyncResolutionSchema = z.enum(APPLICATION_LAYOUT_SYNC_RESOLUTIONS)
export const applicationLayoutScopeKindSchema = z.enum(APPLICATION_LAYOUT_SCOPE_KINDS)

export const applicationLayoutLocalizedContentSchema = z.record(z.string(), z.unknown()).default({})
export const applicationLayoutWidgetKeySchema = z.enum(DASHBOARD_LAYOUT_WIDGETS.map((widget) => widget.key) as [string, ...string[]])
export const applicationLayoutZoneSchema = z.enum(DASHBOARD_LAYOUT_ZONES)

const sharedBehaviorSchema = z
    .object({
        canDeactivate: z.boolean().optional(),
        canExclude: z.boolean().optional(),
        positionLocked: z.boolean().optional()
    })
    .strict()

const widgetVisibilitySchema = z
    .object({
        sectionIds: z.array(z.string().trim().min(1).max(128)).min(1).max(32).optional(),
        sectionCodenames: z.array(z.string().trim().min(1).max(128)).min(1).max(32).optional(),
        objectCollectionIds: z.array(z.string().trim().min(1).max(128)).min(1).max(32).optional(),
        objectCollectionCodenames: z.array(z.string().trim().min(1).max(128)).min(1).max(32).optional()
    })
    .strict()

const moduleAttachmentKindSchema = z.string().trim().regex(MODULE_ATTACHMENT_KIND_PATTERN).nullable().optional()

const genericWidgetConfigSchema = z.record(z.unknown()).default({})
const localizedWidgetTextSchema = z.union([z.string().min(1).max(160), applicationLayoutLocalizedContentSchema])
const rowCountWarningSchema = z
    .object({
        threshold: z.number().int().min(1).max(100_000),
        message: localizedWidgetTextSchema
    })
    .strict()

const normalizeCreateDefaultFieldKey = (value: string): string =>
    value
        .trim()
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase()

const forbiddenCreateDefaultFieldKeys = new Set([
    'id',
    'workspaceid',
    'workspace',
    'ownerid',
    'owneruserid',
    'owner',
    'userid',
    'user',
    'assigneduserid',
    'createdby',
    'updatedby',
    'deletedby',
    'progress',
    'progresspercent',
    'progressstatus',
    'lifecyclestate',
    'lifecycle',
    'targetrecordid',
    'targetobjectcodename',
    'targetobjectid',
    'sourceobjectcodename',
    'sourcerowid',
    'sourcelineid',
    'principalid',
    'apprecordstate',
    'appdeleted'
])

const isUnsafeCreateDefaultFieldCodename = (fieldCodename: string): boolean => {
    const normalized = normalizeCreateDefaultFieldKey(fieldCodename)
    return normalized.startsWith('upl') || normalized.startsWith('_upl') || forbiddenCreateDefaultFieldKeys.has(normalized)
}

const forbiddenCreateDefaultContextPathSegments = new Set(['__proto__', 'prototype', 'constructor'])

const createDefaultContextPathSchema = z
    .string()
    .trim()
    .min(1)
    .max(256)
    .refine(
        (value) =>
            value.split('.').every((segment) => {
                const normalized = segment.toLowerCase()
                return /^[A-Za-z0-9_-]+$/.test(segment) && !forbiddenCreateDefaultContextPathSegments.has(normalized)
            }),
        'Create target default context paths must use safe dot-separated identifiers.'
    )

const createTargetDefaultSchema = z
    .object({
        fieldCodename: z.string().trim().min(1).max(128),
        value: z.union([z.string().max(2048), z.number().finite(), z.boolean(), z.null()]).optional(),
        enumCodename: z.string().trim().min(1).max(128).optional(),
        resourceSourceType: z.enum(RESOURCE_TYPES).optional(),
        contextPath: createDefaultContextPathSchema.optional()
    })
    .strict()
    .superRefine((value, ctx) => {
        if (isUnsafeCreateDefaultFieldCodename(value.fieldCodename)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Create target defaults cannot target system-owned fields.',
                path: ['fieldCodename']
            })
        }

        const defaultKinds = [
            Object.prototype.hasOwnProperty.call(value, 'value'),
            typeof value.enumCodename === 'string',
            typeof value.resourceSourceType === 'string',
            typeof value.contextPath === 'string'
        ].filter(Boolean).length

        if (defaultKinds !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Create target default must define exactly one default value source.'
            })
        }
    })

export type CreateTargetDefault = z.infer<typeof createTargetDefaultSchema>

const menuWidgetItemSchema = z
    .object({
        id: z.string().min(1),
        kind: z.enum(['section', 'hub', 'link']),
        title: applicationLayoutLocalizedContentSchema,
        icon: z.string().nullable().optional(),
        href: z.string().nullable().optional(),
        objectCollectionId: z.string().nullable().optional(),
        sectionId: z.string().nullable().optional(),
        hubId: z.string().nullable().optional(),
        treeEntityId: z.string().nullable().optional(),
        sortOrder: z.number().int(),
        isActive: z.boolean()
    })
    .strict()

const menuWidgetTargetSchema: z.ZodType<MenuWidgetTarget> = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('section'), sectionId: z.string().min(1) }).strict(),
    z.object({ kind: z.literal('objectCollection'), objectCollectionId: z.string().min(1) }).strict(),
    z.object({ kind: z.literal('hub'), hubId: z.string().min(1) }).strict(),
    z.object({ kind: z.literal('treeEntity'), treeEntityId: z.string().min(1) }).strict(),
    z.object({ kind: z.literal('menuItem'), menuItemId: z.string().min(1) }).strict()
])

export const menuWidgetConfigSchema = z
    .object({
        boundHubId: z.string().nullable().optional(),
        boundTreeEntityId: z.string().nullable().optional(),
        bindToHub: z.boolean().optional(),
        showTitle: z.boolean().optional(),
        title: applicationLayoutLocalizedContentSchema.optional(),
        autoShowAllSections: z.boolean().optional(),
        maxPrimaryItems: z.number().int().min(1).max(12).optional(),
        overflowLabelKey: z.string().nullable().optional(),
        startPage: z.string().nullable().optional(),
        startTarget: menuWidgetTargetSchema.nullable().optional(),
        workspacePlacement: z.enum(['primary', 'overflow', 'hidden']).optional(),
        sideMenu: dashboardSideMenuConfigSchema.optional(),
        items: z.array(menuWidgetItemSchema),
        sharedBehavior: sharedBehaviorSchema.optional()
    })
    .strict()

const nestedColumnsContainerWidgetKeySchema = z
    .string()
    .refine(
        (value) => DASHBOARD_LAYOUT_WIDGETS.some((widget) => widget.key === value) && value !== 'columnsContainer',
        'Nested columnsContainer widgets are not allowed'
    )

const nestedDetailsTabsWidgetKeySchema = z
    .string()
    .refine(
        (value) => DASHBOARD_LAYOUT_WIDGETS.some((widget) => widget.key === value) && value !== 'detailsTabs',
        'Nested detailsTabs widgets are not allowed'
    )

const dashboardNestedWidgetSchema = (widgetKeySchema: z.ZodType<string>) =>
    z
        .object({
            id: z.string().min(1).optional(),
            widgetKey: widgetKeySchema,
            sortOrder: z.number().int().optional(),
            isActive: z.boolean().optional(),
            config: z.record(z.unknown()).optional()
        })
        .strict()

const columnsContainerNestedWidgetSchema = dashboardNestedWidgetSchema(nestedColumnsContainerWidgetKeySchema)

const detailsTabsNestedWidgetSchema = dashboardNestedWidgetSchema(nestedDetailsTabsWidgetKeySchema)

const detailsTabsTabSchema = z
    .object({
        id: z.string().min(1),
        label: localizedWidgetTextSchema.optional(),
        isActive: z.boolean().optional(),
        widgets: z.array(detailsTabsNestedWidgetSchema)
    })
    .strict()

const columnsContainerColumnSchema = z
    .object({
        id: z.string().min(1),
        width: z.number().int().min(1).max(12),
        widgets: z.array(columnsContainerNestedWidgetSchema)
    })
    .strict()

export const columnsContainerWidgetConfigSchema = z
    .object({
        columns: z.array(columnsContainerColumnSchema),
        sharedBehavior: sharedBehaviorSchema.optional()
    })
    .strict()

export const detailsTabsWidgetConfigSchema = z
    .object({
        tabs: z.array(detailsTabsTabSchema).min(1).max(8),
        sharedBehavior: sharedBehaviorSchema.optional()
    })
    .strict()

export type DetailsTabsWidgetConfig = z.infer<typeof detailsTabsWidgetConfigSchema>

const moduleBackedWidgetConfigSchema = z
    .object({
        moduleCodename: z.string().nullable().optional(),
        attachedToKind: moduleAttachmentKindSchema,
        mountMethodName: z.string().nullable().optional(),
        emptyStateTitle: z.string().nullable().optional(),
        emptyStateDescription: z.string().nullable().optional(),
        serverModuleCodename: z.string().trim().min(1).max(128).nullable().optional(),
        visibleFor: widgetVisibilitySchema.optional(),
        sharedBehavior: sharedBehaviorSchema.optional()
    })
    .strict()

export const quizWidgetConfigSchema = moduleBackedWidgetConfigSchema
    .extend({
        quizId: z.string().nullable().optional(),
        submitMethodName: z.string().nullable().optional(),
        title: z.string().nullable().optional(),
        description: z.string().nullable().optional()
    })
    .strict()

const playcanvasVector3Schema = z
    .object({
        x: z.number().finite(),
        y: z.number().finite(),
        z: z.number().finite()
    })
    .strict()

const playcanvasObjectSchema = z
    .object({
        id: z.string().trim().min(1).max(128),
        label: localizedWidgetTextSchema.optional(),
        position: playcanvasVector3Schema,
        scale: playcanvasVector3Schema,
        selectable: z.boolean().optional(),
        guard: z.boolean().optional()
    })
    .strict()

const playcanvasRuntimeManifestBindingSchema = z
    .object({
        source: z.literal('publishedManifest'),
        projectId: z.string().uuid(),
        sceneId: z.string().uuid().nullable().optional(),
        checksum: z.string().regex(/^[a-f0-9]{64}$/i),
        failClosed: z.boolean().default(true)
    })
    .strict()

export const playcanvasCanvasWidgetConfigSchema = moduleBackedWidgetConfigSchema
    .extend({
        title: localizedWidgetTextSchema.optional(),
        runtimeManifest: playcanvasRuntimeManifestBindingSchema.optional(),
        minHeight: z.number().int().min(320).max(1200).optional(),
        heightMode: z.enum(['fixed', 'fitViewport']).optional(),
        camera: z
            .object({
                distance: z.number().min(1).max(1000).optional(),
                minDistance: z.number().min(1).max(1000).optional(),
                maxDistance: z.number().min(1).max(2000).optional()
            })
            .strict()
            .optional(),
        scene: z
            .object({
                background: z.string().trim().min(1).max(32).optional(),
                objects: z.array(playcanvasObjectSchema).min(1).max(64).optional(),
                controlledObjectId: z.string().trim().min(1).max(128).optional(),
                targetObjectId: z.string().trim().min(1).max(128).optional(),
                cruiseSpeed: z.number().min(1).max(1000).optional(),
                intentDistance: z.number().min(10).max(10_000).optional()
            })
            .strict()
            .superRefine((scene, ctx) => {
                if (!scene.objects?.length) {
                    return
                }

                const objectIds = new Set<string>()
                for (const [index, object] of scene.objects.entries()) {
                    if (objectIds.has(object.id)) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: ['objects', index, 'id'],
                            message: 'Scene object ids must be unique.'
                        })
                    }
                    objectIds.add(object.id)
                }
                if (scene.controlledObjectId && !objectIds.has(scene.controlledObjectId)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['controlledObjectId'],
                        message: 'Controlled object must reference an object in the scene.'
                    })
                }
                if (scene.targetObjectId && !objectIds.has(scene.targetObjectId)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['targetObjectId'],
                        message: 'Target object must reference an object in the scene.'
                    })
                }
            })
            .optional()
    })
    .strict()

const targetPickerConfigObjectSchema = z
    .object({
        targetSectionId: z.string().trim().min(1).max(128).optional(),
        targetSectionCodename: z.string().trim().min(1).max(128).optional(),
        targetObjectCollectionId: z.string().trim().min(1).max(128).optional(),
        targetObjectCollectionCodename: z.string().trim().min(1).max(128).optional(),
        parentFieldCodename: z.string().trim().min(1).max(128).optional(),
        labelFields: z.array(z.string().trim().min(1).max(128)).min(1).max(8).optional(),
        dialogTitle: localizedWidgetTextSchema.optional(),
        targetLabel: localizedWidgetTextSchema.optional()
    })
    .strict()

const requireTargetPickerReference = (value: z.infer<typeof targetPickerConfigObjectSchema>, ctx: z.RefinementCtx) => {
    if (
        !value.targetSectionId &&
        !value.targetSectionCodename &&
        !value.targetObjectCollectionId &&
        !value.targetObjectCollectionCodename
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Target picker must reference a section or object collection.'
        })
    }
}

const restoreTargetConfigSchema = targetPickerConfigObjectSchema.superRefine((value, ctx) => {
    if (
        !value.targetSectionId &&
        !value.targetSectionCodename &&
        !value.targetObjectCollectionId &&
        !value.targetObjectCollectionCodename
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Restore target must reference a section or object collection.'
        })
    }
})

const recordsUnionTargetFilterSchema = z
    .object({
        id: z.string().trim().min(1).max(64),
        label: localizedWidgetTextSchema,
        targetDisplayTypes: z.array(z.string().trim().min(1).max(64)).min(1).max(16).optional(),
        targetSectionCodenames: z.array(z.string().trim().min(1).max(128)).min(1).max(16).optional(),
        targetObjectCollectionCodenames: z.array(z.string().trim().min(1).max(128)).min(1).max(16).optional(),
        targetSectionIds: z.array(z.string().trim().min(1).max(128)).min(1).max(16).optional(),
        targetObjectCollectionIds: z.array(z.string().trim().min(1).max(128)).min(1).max(16).optional()
    })
    .strict()
    .superRefine((value, ctx) => {
        const hasCriteria = [
            value.targetDisplayTypes,
            value.targetSectionCodenames,
            value.targetObjectCollectionCodenames,
            value.targetSectionIds,
            value.targetObjectCollectionIds
        ].some((items) => Array.isArray(items) && items.length > 0)

        if (!hasCriteria) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Records union target filters must reference at least one target criterion.'
            })
        }
    })

export const detailsTableWidgetConfigSchema = z
    .object({
        datasource: runtimeDatasourceDescriptorSchema.optional(),
        enableRowReordering: z.boolean().optional(),
        showViewToggle: z.boolean().optional(),
        showSearch: z.boolean().optional(),
        targetFilters: z.array(recordsUnionTargetFilterSchema).max(16).optional(),
        createTargets: z
            .array(
                z
                    .object({
                        id: z.string().trim().min(1).max(64),
                        label: localizedWidgetTextSchema,
                        sectionId: z.string().trim().min(1).max(128).optional(),
                        sectionCodename: z.string().trim().min(1).max(128).optional(),
                        objectCollectionId: z.string().trim().min(1).max(128).optional(),
                        objectCollectionCodename: z.string().trim().min(1).max(128).optional(),
                        icon: z.string().trim().min(1).max(64).nullable().optional(),
                        surface: z.enum(['dialog', 'page']).optional(),
                        disabled: z.boolean().optional(),
                        disabledReason: localizedWidgetTextSchema.optional(),
                        createDefaults: z.array(createTargetDefaultSchema).max(12).optional()
                    })
                    .strict()
                    .superRefine((value, ctx) => {
                        if (!value.sectionId && !value.sectionCodename && !value.objectCollectionId && !value.objectCollectionCodename) {
                            ctx.addIssue({
                                code: z.ZodIssueCode.custom,
                                message: 'Create target must reference a section or object collection.'
                            })
                        }
                    })
            )
            .max(16)
            .optional(),
        rowActions: z
            .array(
                z.union([
                    z
                        .object({
                            id: z.string().trim().min(1).max(64),
                            kind: z.literal('library.toggle'),
                            libraryView: z.enum(['starred', 'shared']),
                            label: localizedWidgetTextSchema.optional(),
                            activeLabel: localizedWidgetTextSchema.optional(),
                            icon: z.enum(['star', 'share']).optional(),
                            principalTarget: z.enum(['currentUser', 'workspaceMember']).optional(),
                            dialogTitle: localizedWidgetTextSchema.optional(),
                            targetLabel: localizedWidgetTextSchema.optional()
                        })
                        .strict(),
                    targetPickerConfigObjectSchema
                        .extend({
                            id: z.string().trim().min(1).max(64),
                            kind: z.literal('field.updateWithTarget'),
                            fieldCodename: z.string().trim().min(1).max(128),
                            label: localizedWidgetTextSchema.optional(),
                            icon: z.enum(['move']).optional()
                        })
                        .strict()
                        .superRefine(requireTargetPickerReference)
                ])
            )
            .max(8)
            .optional(),
        restoreTarget: restoreTargetConfigSchema.optional(),
        rowCountWarning: rowCountWarningSchema.optional(),
        sequencePolicy: sequencePolicySchema.optional(),
        reportCodename: z.string().trim().min(1).max(128).optional(),
        reportDefinition: reportDefinitionSchema.optional(),
        workflowActions: z.array(workflowActionSchema).max(16).optional(),
        sharedBehavior: sharedBehaviorSchema.optional()
    })
    .strict()

export type DetailsTableWidgetConfig = z.infer<typeof detailsTableWidgetConfigSchema>

const relationBuilderPanelSchema = z
    .object({
        id: z.string().min(1),
        title: localizedWidgetTextSchema,
        width: z.number().int().min(1).max(12).optional(),
        datasource: recordsListDatasourceSchema,
        parentFieldCodename: z.string().trim().min(1).max(128),
        sortOrderFieldCodename: z.string().trim().min(1).max(128).optional(),
        enableRowReordering: z.boolean().optional(),
        createDefaults: z.record(z.unknown()).optional(),
        createWizard: z
            .object({
                steps: z
                    .array(
                        z
                            .object({
                                id: z.string().trim().min(1).max(64),
                                label: localizedWidgetTextSchema,
                                helperText: localizedWidgetTextSchema.optional(),
                                fieldCodenames: z.array(z.string().trim().min(1).max(128)).min(1).max(12)
                            })
                            .strict()
                    )
                    .min(1)
                    .max(6)
            })
            .strict()
            .optional(),
        rowCountWarning: rowCountWarningSchema.optional()
    })
    .strict()

export const relationBuilderWidgetConfigSchema = z
    .object({
        parentDatasource: recordsListDatasourceSchema.optional(),
        parentLabel: localizedWidgetTextSchema.optional(),
        parentTitleFieldCodename: z.string().trim().min(1).max(128).optional(),
        emptyParentMessage: localizedWidgetTextSchema.optional(),
        panels: z.array(relationBuilderPanelSchema).min(1).max(4),
        sharedBehavior: sharedBehaviorSchema.optional()
    })
    .strict()

export type RelationBuilderWidgetConfig = z.infer<typeof relationBuilderWidgetConfigSchema>
export type RelationBuilderPanelConfig = z.infer<typeof relationBuilderPanelSchema>

export const statCardWidgetConfigSchema = z
    .object({
        title: localizedWidgetTextSchema.optional(),
        value: z.string().max(80).optional(),
        interval: localizedWidgetTextSchema.optional(),
        trend: z.enum(['up', 'down', 'neutral']).optional(),
        data: z.array(z.number()).max(120).optional(),
        datasource: statCardMetricDatasourceSchema.optional()
    })
    .strict()

export type StatCardWidgetConfig = z.infer<typeof statCardWidgetConfigSchema>

export const overviewCardsWidgetConfigSchema = z
    .object({
        cards: z.array(statCardWidgetConfigSchema).max(8).optional(),
        sharedBehavior: sharedBehaviorSchema.optional()
    })
    .strict()

export type OverviewCardsWidgetConfig = z.infer<typeof overviewCardsWidgetConfigSchema>

const chartSeriesDefinitionSchema = z
    .object({
        id: z.string().min(1).max(128).optional(),
        label: localizedWidgetTextSchema.optional(),
        field: z.string().min(1).max(128),
        stack: z.string().min(1).max(128).optional(),
        area: z.boolean().optional()
    })
    .strict()

export const recordsSeriesChartWidgetConfigSchema = z
    .object({
        title: localizedWidgetTextSchema.optional(),
        value: z.string().max(80).optional(),
        interval: localizedWidgetTextSchema.optional(),
        trend: z.enum(['up', 'down', 'neutral']).optional(),
        datasource: z.union([recordsListDatasourceSchema, ledgerProjectionDatasourceSchema]).optional(),
        xField: z.string().min(1).max(128).optional(),
        maxRows: z.number().int().min(1).max(100).optional(),
        series: z.array(chartSeriesDefinitionSchema).min(1).max(8).optional(),
        sharedBehavior: sharedBehaviorSchema.optional()
    })
    .strict()

export type RecordsSeriesChartWidgetConfig = z.infer<typeof recordsSeriesChartWidgetConfigSchema>

export const resourcePreviewWidgetConfigSchema = z
    .object({
        title: localizedWidgetTextSchema.optional(),
        description: localizedWidgetTextSchema.optional(),
        source: resourceSourceSchema.optional(),
        sharedBehavior: sharedBehaviorSchema.optional()
    })
    .strict()

export type ResourcePreviewWidgetConfig = z.infer<typeof resourcePreviewWidgetConfigSchema>

const learnerPlayerTargetContentSchema = z
    .object({
        titleFieldCodename: z.string().trim().min(1).max(128).optional(),
        descriptionFieldCodename: z.string().trim().min(1).max(128).optional(),
        sourceFieldCodename: z.string().trim().min(1).max(128).optional(),
        bodyFieldCodename: z.string().trim().min(1).max(128).optional()
    })
    .strict()

export const learnerPlayerWidgetConfigSchema = z
    .object({
        parentDatasource: recordsListDatasourceSchema.optional(),
        itemsDatasource: recordsListDatasourceSchema.optional(),
        parentLabel: localizedWidgetTextSchema.optional(),
        parentFieldCodename: z.string().trim().min(1).max(128).optional(),
        itemTitleFieldCodename: z.string().trim().min(1).max(128).optional(),
        targetObjectCodenameField: z.string().trim().min(1).max(128).optional(),
        targetObjectCodename: z.string().trim().min(1).max(128).optional(),
        targetRecordIdField: z.string().trim().min(1).max(128).optional(),
        completionTargetObjectCodename: z.string().trim().min(1).max(128).optional(),
        sequencePolicy: sequencePolicySchema.optional(),
        targetContent: learnerPlayerTargetContentSchema.optional(),
        sharedBehavior: sharedBehaviorSchema.optional()
    })
    .strict()

export type LearnerPlayerWidgetConfig = z.infer<typeof learnerPlayerWidgetConfigSchema>

export const interpretationNetworkMatrixModes = ['hierarchicalCells', 'independentRows'] as const
export type InterpretationNetworkMatrixMode = (typeof interpretationNetworkMatrixModes)[number]

export const interpretationNetworkMatrixViews = ['table', 'horizontalRows', 'verticalTree'] as const
export type InterpretationNetworkMatrixView = (typeof interpretationNetworkMatrixViews)[number]

export interface InterpretationNetworkMatrixViewSettings {
    allowedMatrixViews: InterpretationNetworkMatrixView[]
    defaultMatrixView: InterpretationNetworkMatrixView
}

export const normalizeInterpretationNetworkMatrixViewSettings = (
    matrixMode: InterpretationNetworkMatrixMode,
    allowedMatrixViews: readonly unknown[] | undefined,
    defaultMatrixView: unknown
): InterpretationNetworkMatrixViewSettings => {
    const fallbackView: InterpretationNetworkMatrixView = 'horizontalRows'
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

export const interpretationNetworkHierarchyLayouts = ['horizontalRows', 'verticalTree'] as const
export type InterpretationNetworkHierarchyLayout = (typeof interpretationNetworkHierarchyLayouts)[number]

export const interpretationNetworkHierarchyRowModes = ['focusedPath', 'allNodes'] as const
export type InterpretationNetworkHierarchyRowMode = (typeof interpretationNetworkHierarchyRowModes)[number]

export const interpretationNetworkPositionNumberingSchema = z
    .object({
        enabled: z.boolean().optional(),
        includeRoot: z.boolean().optional(),
        startIndex: z.number().int().min(0).max(999).optional()
    })
    .strict()

const migrateDeprecatedInterpretationNetworkConfigKeys = (value: unknown): unknown => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return value
    }

    const { hierarchyLayout, ...config } = value as Record<string, unknown>
    if (!interpretationNetworkHierarchyLayouts.includes(hierarchyLayout as InterpretationNetworkHierarchyLayout)) {
        return config
    }
    if (Array.isArray(config.allowedMatrixViews) || config.defaultMatrixView !== undefined) {
        return config
    }

    const legacyView = hierarchyLayout as InterpretationNetworkHierarchyLayout
    const matrixMode = config.matrixMode === 'independentRows' ? 'independentRows' : 'hierarchicalCells'
    const allowedMatrixViews = matrixMode === 'hierarchicalCells' ? ['horizontalRows', legacyView] : ['horizontalRows']

    return {
        ...config,
        allowedMatrixViews: Array.from(new Set(allowedMatrixViews)),
        defaultMatrixView: matrixMode === 'hierarchicalCells' ? legacyView : 'horizontalRows'
    }
}

const interpretationNetworkWorkspaceWidgetConfigObjectSchema = moduleBackedWidgetConfigSchema
    .extend({
        matrixMode: z.enum(interpretationNetworkMatrixModes).optional(),
        allowedMatrixViews: z.array(z.enum(interpretationNetworkMatrixViews)).min(1).max(3).optional(),
        defaultMatrixView: z.enum(interpretationNetworkMatrixViews).optional(),
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
        const allowedMatrixViews = config.allowedMatrixViews ?? ['horizontalRows']
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
    })

export const interpretationNetworkWorkspaceWidgetConfigSchema = z.preprocess(
    migrateDeprecatedInterpretationNetworkConfigKeys,
    interpretationNetworkWorkspaceWidgetConfigObjectSchema
)

export type InterpretationNetworkWorkspaceWidgetConfig = z.infer<typeof interpretationNetworkWorkspaceWidgetConfigSchema>

const widgetConfigSchemaByKey = {
    menuWidget: menuWidgetConfigSchema,
    columnsContainer: columnsContainerWidgetConfigSchema,
    quizWidget: quizWidgetConfigSchema,
    playcanvasCanvas: playcanvasCanvasWidgetConfigSchema,
    detailsTable: detailsTableWidgetConfigSchema,
    relationBuilder: relationBuilderWidgetConfigSchema,
    overviewCards: overviewCardsWidgetConfigSchema,
    sessionsChart: recordsSeriesChartWidgetConfigSchema,
    pageViewsChart: recordsSeriesChartWidgetConfigSchema,
    detailsTabs: detailsTabsWidgetConfigSchema,
    resourcePreview: resourcePreviewWidgetConfigSchema,
    learnerPlayer: learnerPlayerWidgetConfigSchema,
    interpretationNetworkWorkspace: interpretationNetworkWorkspaceWidgetConfigSchema
} as const

export const applicationLayoutWidgetConfigSchema = genericWidgetConfigSchema

export const parseApplicationLayoutWidgetConfig = (widgetKey: string, config: unknown): Record<string, unknown> => {
    const schema = widgetConfigSchemaByKey[widgetKey as keyof typeof widgetConfigSchemaByKey] ?? applicationLayoutWidgetConfigSchema
    return schema.parse(config ?? {})
}

export const applicationLayoutScopeSchema = z.object({
    id: z.string(),
    scopeKind: applicationLayoutScopeKindSchema,
    scopeEntityId: z.string().nullable(),
    scopeEntityKind: z.string().nullable().optional(),
    kind: z.string().nullable().optional(),
    tableName: z.string().nullable().optional(),
    codename: applicationLayoutLocalizedContentSchema.optional(),
    name: z.string()
})
export type ApplicationLayoutScope = z.infer<typeof applicationLayoutScopeSchema>

export const applicationLayoutWidgetSchema = z.object({
    id: z.string(),
    layoutId: z.string(),
    zone: applicationLayoutZoneSchema,
    widgetKey: applicationLayoutWidgetKeySchema,
    sortOrder: z.number().int(),
    config: z.record(z.unknown()).default({}),
    isActive: z.boolean(),
    version: z.number().int().positive().optional()
})
export type ApplicationLayoutWidget = z.infer<typeof applicationLayoutWidgetSchema>

export const applicationLayoutSchema = z.object({
    id: z.string(),
    scopeId: z.string().nullable(),
    scopeKind: applicationLayoutScopeKindSchema,
    scopeEntityId: z.string().nullable(),
    scopeEntityKind: z.string().nullable().optional(),
    templateKey: z.string(),
    name: applicationLayoutLocalizedContentSchema,
    description: applicationLayoutLocalizedContentSchema.nullable().optional(),
    config: dashboardLayoutConfigSchema.default({}),
    isActive: z.boolean(),
    isDefault: z.boolean(),
    sortOrder: z.number().int(),
    sourceKind: applicationLayoutSourceKindSchema,
    sourceLayoutId: z.string().nullable().optional(),
    sourceSnapshotHash: z.string().nullable().optional(),
    sourceContentHash: z.string().nullable().optional(),
    localContentHash: z.string().nullable().optional(),
    syncState: applicationLayoutSyncStateSchema,
    isSourceExcluded: z.boolean(),
    sourceDeletedAt: z.string().nullable().optional(),
    sourceDeletedBy: z.string().nullable().optional(),
    version: z.number().int().positive()
})
export type ApplicationLayout = z.infer<typeof applicationLayoutSchema>

export const applicationLayoutsListResponseSchema = z.object({
    items: z.array(applicationLayoutSchema),
    total: z.number().int().nonnegative()
})
export type ApplicationLayoutsListResponse = z.infer<typeof applicationLayoutsListResponseSchema>

export const applicationLayoutDetailResponseSchema = z.object({
    item: applicationLayoutSchema,
    widgets: z.array(applicationLayoutWidgetSchema).default([])
})
export type ApplicationLayoutDetailResponse = z.infer<typeof applicationLayoutDetailResponseSchema>

export const applicationLayoutMutationSchema = z.object({
    name: applicationLayoutLocalizedContentSchema.optional(),
    description: applicationLayoutLocalizedContentSchema.nullable().optional(),
    config: dashboardLayoutConfigSchema.optional(),
    scopeEntityId: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    expectedVersion: z.number().int().positive().optional()
})
export type ApplicationLayoutMutation = z.infer<typeof applicationLayoutMutationSchema>

export const applicationLayoutCreateSchema = applicationLayoutMutationSchema.extend({
    templateKey: z.string().min(1).max(100).default('dashboard'),
    name: applicationLayoutLocalizedContentSchema
})
export type ApplicationLayoutCreate = z.infer<typeof applicationLayoutCreateSchema>

export const applicationLayoutWidgetMutationSchema = z.object({
    zone: applicationLayoutZoneSchema,
    widgetKey: applicationLayoutWidgetKeySchema,
    sortOrder: z.number().int().optional(),
    config: z.record(z.unknown()).optional(),
    expectedVersion: z.number().int().positive().optional()
})
export type ApplicationLayoutWidgetMutation = z.infer<typeof applicationLayoutWidgetMutationSchema>

export const applicationLayoutWidgetConfigMutationSchema = z.object({
    config: z.record(z.unknown()).default({}),
    expectedVersion: z.number().int().positive().optional()
})
export type ApplicationLayoutWidgetConfigMutation = z.infer<typeof applicationLayoutWidgetConfigMutationSchema>

export const applicationLayoutWidgetConfigBatchMutationSchema = z.object({
    updates: z
        .array(
            applicationLayoutWidgetConfigMutationSchema.extend({
                layoutId: z.string().uuid(),
                widgetId: z.string().uuid()
            })
        )
        .min(1)
        .max(100)
        .superRefine((updates, ctx) => {
            const seen = new Set<string>()
            updates.forEach((update, index) => {
                if (seen.has(update.widgetId)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Duplicate widgetId',
                        path: [index, 'widgetId']
                    })
                }
                seen.add(update.widgetId)
            })
        })
})
export type ApplicationLayoutWidgetConfigBatchMutation = z.infer<typeof applicationLayoutWidgetConfigBatchMutationSchema>

export const applicationLayoutWidgetMoveMutationSchema = z.object({
    widgetId: z.string(),
    targetZone: applicationLayoutZoneSchema,
    targetIndex: z.number().int().nonnegative(),
    expectedVersion: z.number().int().positive().optional()
})
export type ApplicationLayoutWidgetMoveMutation = z.infer<typeof applicationLayoutWidgetMoveMutationSchema>

export const applicationLayoutWidgetToggleMutationSchema = z.object({
    isActive: z.boolean(),
    expectedVersion: z.number().int().positive().optional()
})
export type ApplicationLayoutWidgetToggleMutation = z.infer<typeof applicationLayoutWidgetToggleMutationSchema>

export const applicationLayoutSyncPolicySchema = z.object({
    default: applicationLayoutSyncResolutionSchema.optional(),
    bySourceLayoutId: z.record(applicationLayoutSyncResolutionSchema).optional()
})
export type ApplicationLayoutSyncPolicy = z.infer<typeof applicationLayoutSyncPolicySchema>

export const applicationLayoutChangeSchema = z.object({
    type: z.enum(['LAYOUT_CONFLICT', 'LAYOUT_SOURCE_UPDATED', 'LAYOUT_SOURCE_REMOVED', 'LAYOUT_DEFAULT_COLLISION', 'LAYOUT_WARNING']),
    scope: z.string(),
    sourceLayoutId: z.string().nullable().optional(),
    applicationLayoutId: z.string().nullable().optional(),
    sourceKind: applicationLayoutSourceKindSchema.optional(),
    currentSyncState: applicationLayoutSyncStateSchema.optional(),
    recommendedResolution: applicationLayoutSyncResolutionSchema.optional(),
    title: applicationLayoutLocalizedContentSchema.optional(),
    message: z.string().optional()
})
export type ApplicationLayoutChange = z.infer<typeof applicationLayoutChangeSchema>
