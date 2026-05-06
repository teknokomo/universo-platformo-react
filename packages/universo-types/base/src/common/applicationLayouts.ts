import { z } from 'zod'
import { dashboardLayoutConfigSchema } from './dashboardLayout'
import { DASHBOARD_LAYOUT_WIDGETS, DASHBOARD_LAYOUT_ZONES } from './metahubs'
import { SCRIPT_ATTACHMENT_KIND_PATTERN } from './scripts'

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

const scriptAttachmentKindSchema = z.string().trim().regex(SCRIPT_ATTACHMENT_KIND_PATTERN).nullable().optional()

const genericWidgetConfigSchema = z.record(z.unknown()).default({})

const menuWidgetItemSchema = z
    .object({
        id: z.string().min(1),
        kind: z.string().min(1),
        title: applicationLayoutLocalizedContentSchema,
        icon: z.string().nullable().optional(),
        href: z.string().nullable().optional(),
        catalogId: z.string().nullable().optional(),
        linkedCollectionId: z.string().nullable().optional(),
        sectionId: z.string().nullable().optional(),
        hubId: z.string().nullable().optional(),
        treeEntityId: z.string().nullable().optional(),
        sortOrder: z.number().int(),
        isActive: z.boolean()
    })
    .strict()

export const menuWidgetConfigSchema = z
    .object({
        boundCatalogId: z.string().nullable().optional(),
        boundHubId: z.string().nullable().optional(),
        boundTreeEntityId: z.string().nullable().optional(),
        bindToHub: z.boolean().optional(),
        showTitle: z.boolean().optional(),
        title: applicationLayoutLocalizedContentSchema.optional(),
        autoShowAllCatalogs: z.boolean().optional(),
        maxPrimaryItems: z.number().int().min(1).max(12).optional(),
        overflowLabelKey: z.string().nullable().optional(),
        startPage: z.string().nullable().optional(),
        workspacePlacement: z.enum(['primary', 'overflow', 'hidden']).optional(),
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

const columnsContainerNestedWidgetSchema = z
    .object({
        id: z.string().min(1).optional(),
        widgetKey: nestedColumnsContainerWidgetKeySchema,
        sortOrder: z.number().int().optional(),
        config: z.record(z.unknown()).optional()
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

const scriptBackedWidgetConfigSchema = z
    .object({
        scriptCodename: z.string().nullable().optional(),
        attachedToKind: scriptAttachmentKindSchema,
        mountMethodName: z.string().nullable().optional(),
        emptyStateTitle: z.string().nullable().optional(),
        emptyStateDescription: z.string().nullable().optional(),
        sharedBehavior: sharedBehaviorSchema.optional()
    })
    .strict()

export const quizWidgetConfigSchema = scriptBackedWidgetConfigSchema
    .extend({
        quizId: z.string().nullable().optional(),
        submitMethodName: z.string().nullable().optional(),
        title: z.string().nullable().optional(),
        description: z.string().nullable().optional()
    })
    .strict()

export const detailsTableWidgetConfigSchema = z
    .object({
        enableRowReordering: z.boolean().optional(),
        showViewToggle: z.boolean().optional(),
        sharedBehavior: sharedBehaviorSchema.optional()
    })
    .strict()

const widgetConfigSchemaByKey = {
    menuWidget: menuWidgetConfigSchema,
    columnsContainer: columnsContainerWidgetConfigSchema,
    quizWidget: quizWidgetConfigSchema,
    detailsTable: detailsTableWidgetConfigSchema
} as const

export const applicationLayoutWidgetConfigSchema = genericWidgetConfigSchema

export const parseApplicationLayoutWidgetConfig = (widgetKey: string, config: unknown): Record<string, unknown> => {
    const schema = widgetConfigSchemaByKey[widgetKey as keyof typeof widgetConfigSchemaByKey] ?? applicationLayoutWidgetConfigSchema
    return schema.parse(config ?? {})
}

export const applicationLayoutScopeSchema = z.object({
    id: z.string(),
    scopeKind: applicationLayoutScopeKindSchema,
    linkedCollectionId: z.string().nullable(),
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
    linkedCollectionId: z.string().nullable(),
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
    linkedCollectionId: z.string().nullable().optional(),
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
