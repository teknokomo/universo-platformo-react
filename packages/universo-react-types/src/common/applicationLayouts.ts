import { z } from 'zod'
import { APPLICATION_TEMPLATE_REGISTRY, layoutSemanticRegionSchema } from './applicationTemplates'
import { dashboardLayoutConfigSchema, dashboardSideMenuConfigSchema, type DashboardLayoutConfig } from './dashboardLayout'
import { getLayoutWidgetAllowedZones, getLayoutWidgetDefinition, getLayoutZoneDefinition } from './layoutWidgetDefinitions'
import { DASHBOARD_LAYOUT_WIDGETS, DASHBOARD_LAYOUT_ZONES, type MenuWidgetTarget } from './metahubs'
import { moduleBackedWidgetConfigSchema, sharedBehaviorSchema } from './moduleBackedWidgetConfig'
import { interpretationNetworkWorkspaceWidgetConfigSchema } from './interpretationNetworkLayout'
import {
    ledgerProjectionDatasourceSchema,
    recordsListDatasourceSchema,
    runtimeDatasourceDescriptorSchema,
    statCardMetricDatasourceSchema
} from './runtimeDataSources'
import { RESOURCE_TYPES, resourceSourceSchema } from './resourceSources'
import { sequencePolicySchema } from './sequenceCompletion'
import { reportDefinitionSchema } from './lmsPlatform'
import { workflowActionSchema } from './workflowActions'
import {
    applicationTemplateKeySchema,
    marketingCollectionWidgetConfigSchema,
    marketingFooterWidgetConfigSchema,
    marketingHeroWidgetConfigSchema,
    marketingLayoutZoneSchema,
    marketingNavigationWidgetConfigSchema,
    marketingPageConfigSchema,
    marketingPricingWidgetConfigSchema,
    marketingWidgetKeySchema,
    type ApplicationTemplateKey,
    type MarketingPageConfig
} from './marketingPage'
export * from './interpretationNetworkLayout'
export * from './interpretationNetworkColor'

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

/** UUID v7 is used only by the new target and neutral layout envelopes. */
export const uuidV7Schema = z
    .string()
    .uuid()
    .refine((value) => value[14]?.toLowerCase() === '7', 'UUID v7 is required')

export const runtimeLocaleSchema = z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z]{2,8}(?:[-_][A-Za-z0-9]{2,8})*$/u)

export const runtimeTargetThemeSchema = z.enum(['light', 'dark', 'system'])
export const runtimeEntityCodenameSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u)

const runtimeTargetCommon = {
    applicationId: uuidV7Schema,
    workspaceId: uuidV7Schema.optional(),
    locale: runtimeLocaleSchema,
    themeVariant: runtimeTargetThemeSchema.optional()
}

/** Target identity used to resolve a layout before selecting a renderer. */
export const runtimeTargetSchema = z.union([
    z
        .object({
            ...runtimeTargetCommon,
            targetKind: z.null(),
            entityTypeId: z.never().optional(),
            entityTypeCodename: z.never().optional()
        })
        .strict(),
    z
        .object({
            ...runtimeTargetCommon,
            targetKind: z.literal('page'),
            entityTypeId: uuidV7Schema,
            entityTypeCodename: z.never().optional()
        })
        .strict(),
    z
        .object({
            ...runtimeTargetCommon,
            targetKind: z.literal('page'),
            entityTypeId: z.never().optional(),
            entityTypeCodename: runtimeEntityCodenameSchema
        })
        .strict(),
    z
        .object({
            ...runtimeTargetCommon,
            targetKind: z.literal('object'),
            entityTypeId: uuidV7Schema,
            entityTypeCodename: z.never().optional()
        })
        .strict(),
    z
        .object({
            ...runtimeTargetCommon,
            targetKind: z.literal('object'),
            entityTypeId: z.never().optional(),
            entityTypeCodename: runtimeEntityCodenameSchema
        })
        .strict()
])
export type RuntimeTarget = z.infer<typeof runtimeTargetSchema>
export type RuntimeTargetInput = RuntimeTarget
export const RuntimeTargetSchema = runtimeTargetSchema

export const APPLICATION_LAYOUT_COMPOSITION_MODES = ['overlay', 'independent'] as const
export type ApplicationLayoutCompositionMode = (typeof APPLICATION_LAYOUT_COMPOSITION_MODES)[number]
export const applicationLayoutCompositionModeSchema = z.enum(APPLICATION_LAYOUT_COMPOSITION_MODES)

/** Scoped composition is explicit: overlays require a v7 base; independent layouts require null. */
export const applicationLayoutCompositionSchema = z.discriminatedUnion('compositionMode', [
    z
        .object({
            compositionMode: z.literal('overlay'),
            baseLayoutId: uuidV7Schema
        })
        .strict(),
    z
        .object({
            compositionMode: z.literal('independent'),
            baseLayoutId: z.null()
        })
        .strict()
])
export type ApplicationLayoutComposition = z.infer<typeof applicationLayoutCompositionSchema>
export type EffectiveLayoutCompositionMode = ApplicationLayoutCompositionMode
export type EffectiveLayoutScope = ApplicationLayoutScopeKind

const LAYOUT_HASH_PATTERN = /^[a-f0-9]{64}$/iu
export const layoutHashSchema = z.string().regex(LAYOUT_HASH_PATTERN, 'A layout hash must be a SHA-256 hex digest')
export const layoutInstanceKeySchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u)

export const LAYOUT_RUNTIME_ERROR_CODES = [
    'LAYOUT_REQUEST_INVALID',
    'LAYOUT_PAYLOAD_INVALID',
    'LAYOUT_CAPABILITY_UNSUPPORTED',
    'UNAUTHORIZED',
    'LAYOUT_TARGET_FORBIDDEN',
    'LAYOUT_TARGET_NOT_FOUND',
    'LAYOUT_DEFAULT_INVALID',
    'LAYOUT_PERSISTED_INVALID',
    'LAYOUT_CONFLICT',
    'LAYOUT_RUNTIME_QUERY_FAILED'
] as const
export type LayoutRuntimeErrorCode = (typeof LAYOUT_RUNTIME_ERROR_CODES)[number]
export const layoutRuntimeErrorCodeSchema = z.enum(LAYOUT_RUNTIME_ERROR_CODES)
export const LAYOUT_RUNTIME_ERROR_STATUS = {
    LAYOUT_REQUEST_INVALID: 400,
    LAYOUT_PAYLOAD_INVALID: 400,
    LAYOUT_CAPABILITY_UNSUPPORTED: 400,
    UNAUTHORIZED: 401,
    LAYOUT_TARGET_FORBIDDEN: 403,
    LAYOUT_TARGET_NOT_FOUND: 404,
    LAYOUT_DEFAULT_INVALID: 409,
    LAYOUT_PERSISTED_INVALID: 409,
    LAYOUT_CONFLICT: 409,
    LAYOUT_RUNTIME_QUERY_FAILED: 503
} as const satisfies Record<LayoutRuntimeErrorCode, 400 | 401 | 403 | 404 | 409 | 503>
export const EFFECTIVE_LAYOUT_ERROR_CODES = LAYOUT_RUNTIME_ERROR_CODES
export type EffectiveLayoutErrorCode = LayoutRuntimeErrorCode
export const EFFECTIVE_LAYOUT_ERROR_STATUS = LAYOUT_RUNTIME_ERROR_STATUS

export const layoutRuntimeErrorHttpStatusSchema = z.union([
    z.literal(400),
    z.literal(401),
    z.literal(403),
    z.literal(404),
    z.literal(409),
    z.literal(503)
])

export const layoutRuntimeErrorSchema = z
    .object({
        code: layoutRuntimeErrorCodeSchema,
        httpStatus: layoutRuntimeErrorHttpStatusSchema
    })
    .strict()
    .superRefine((error, ctx) => {
        if (LAYOUT_RUNTIME_ERROR_STATUS[error.code] !== error.httpStatus) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Layout runtime error status does not match its public code.',
                path: ['httpStatus']
            })
        }
    })
export type LayoutRuntimeError = z.infer<typeof layoutRuntimeErrorSchema>

export const LAYOUT_EFFECTIVE_PRECEDENCE = [
    'published-publication',
    'application-entity',
    'application-global',
    'metahub-provenance'
] as const
export type LayoutEffectivePrecedence = (typeof LAYOUT_EFFECTIVE_PRECEDENCE)[number]
export const layoutEffectivePrecedenceSchema = z.enum(LAYOUT_EFFECTIVE_PRECEDENCE)

export const applicationLayoutLocalizedContentSchema = z.record(z.string(), z.unknown()).default({})
const dashboardLayoutWidgetKeySchema = z.enum(DASHBOARD_LAYOUT_WIDGETS.map((widget) => widget.key) as [string, ...string[]])
const dashboardLayoutZoneSchema = z.enum(DASHBOARD_LAYOUT_ZONES)
export const applicationLayoutWidgetKeySchema = z.union([dashboardLayoutWidgetKeySchema, marketingWidgetKeySchema])
export const applicationLayoutZoneSchema = z.union([dashboardLayoutZoneSchema, marketingLayoutZoneSchema])
export type ApplicationLayoutWidgetKey = z.infer<typeof applicationLayoutWidgetKeySchema>
export type ApplicationLayoutZone = z.infer<typeof applicationLayoutZoneSchema>

/**
 * Layout configuration is template-owned. Keep the transport schema open so a
 * marketing config is not stripped by the dashboard-only Zod object; callers
 * validate it against the selected template before persisting or rendering.
 */
export type ApplicationLayoutConfig = (DashboardLayoutConfig | MarketingPageConfig) & Record<string, unknown>
export const applicationLayoutConfigSchema: z.ZodType<ApplicationLayoutConfig> = z.record(z.string(), z.unknown()).default({})

const isApplicationLayoutRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

const MARKETING_ONLY_LAYOUT_CONFIG_KEYS = new Set([
    'themeMode',
    'primaryColor',
    'accentColor',
    'brandLogo',
    'allowEmailActions',
    'allowTelephoneActions',
    'externalLinkTarget'
])

export const parseApplicationLayoutConfig = (templateKey: ApplicationTemplateKey | string, config: unknown): ApplicationLayoutConfig => {
    const key = applicationTemplateKeySchema.parse(templateKey)
    if (key === 'marketing-page') return marketingPageConfigSchema.parse(config ?? {}) as ApplicationLayoutConfig
    if (isApplicationLayoutRecord(config) && Object.keys(config).some((configKey) => MARKETING_ONLY_LAYOUT_CONFIG_KEYS.has(configKey))) {
        throw new Error('Dashboard layouts cannot contain marketing-page configuration keys.')
    }
    const dashboardConfig = dashboardLayoutConfigSchema.parse(config ?? {}) ?? {}
    return {
        ...(isApplicationLayoutRecord(config) ? config : {}),
        ...dashboardConfig
    } as ApplicationLayoutConfig
}

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
    interpretationNetworkWorkspace: interpretationNetworkWorkspaceWidgetConfigSchema,
    'marketing.navigation': marketingNavigationWidgetConfigSchema,
    'marketing.hero': marketingHeroWidgetConfigSchema,
    'marketing.collection': marketingCollectionWidgetConfigSchema,
    'marketing.pricing': marketingPricingWidgetConfigSchema,
    'marketing.footer': marketingFooterWidgetConfigSchema
} as const

export const applicationLayoutWidgetConfigSchema = genericWidgetConfigSchema

export const parseApplicationLayoutWidgetConfig = (widgetKey: string, config: unknown): Record<string, unknown> => {
    const schema = widgetConfigSchemaByKey[widgetKey as keyof typeof widgetConfigSchemaByKey] ?? applicationLayoutWidgetConfigSchema
    return schema.parse(config ?? {})
}

export const applicationLayoutScopeSchema = z.object({
    id: z.string(),
    scopeKind: applicationLayoutScopeKindSchema,
    scopeEntityId: uuidV7Schema.nullable(),
    scopeEntityKind: z.string().nullable().optional(),
    kind: z.string().nullable().optional(),
    tableName: z.string().nullable().optional(),
    codename: applicationLayoutLocalizedContentSchema.optional(),
    name: z.string()
})
export type ApplicationLayoutScope = z.infer<typeof applicationLayoutScopeSchema>

export const applicationLayoutWidgetSchema = z.object({
    id: uuidV7Schema,
    layoutId: uuidV7Schema,
    zone: applicationLayoutZoneSchema,
    widgetKey: applicationLayoutWidgetKeySchema,
    instanceKey: z.string().trim().min(1).optional(),
    sortOrder: z.number().int(),
    config: z.record(z.unknown()).default({}),
    sourceConfig: z.record(z.unknown()).nullable().default(null),
    sourceWidgetId: uuidV7Schema.nullable().optional(),
    sourceBaseWidgetId: uuidV7Schema.nullable().optional(),
    isCustomized: z.boolean().default(false),
    isActive: z.boolean(),
    version: z.number().int().positive()
})
export type ApplicationLayoutWidget = z.infer<typeof applicationLayoutWidgetSchema>

export const applicationLayoutSchema = z.object({
    id: uuidV7Schema,
    scopeId: z.string().nullable(),
    scopeKind: applicationLayoutScopeKindSchema,
    scopeEntityId: uuidV7Schema.nullable(),
    scopeEntityKind: z.string().nullable().optional(),
    templateKey: applicationTemplateKeySchema,
    name: applicationLayoutLocalizedContentSchema,
    description: applicationLayoutLocalizedContentSchema.nullable().optional(),
    config: applicationLayoutConfigSchema,
    compositionMode: applicationLayoutCompositionModeSchema.optional(),
    baseLayoutId: uuidV7Schema.nullable().optional(),
    isActive: z.boolean(),
    isDefault: z.boolean(),
    sortOrder: z.number().int(),
    sourceKind: applicationLayoutSourceKindSchema,
    sourceLayoutId: uuidV7Schema.nullable().optional(),
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

/** Lineage carried by the neutral layout envelope. */
export const applicationLayoutLineageSchema = z
    .object({
        sourceKind: applicationLayoutSourceKindSchema,
        sourceLayoutId: uuidV7Schema.nullable(),
        sourceSnapshotHash: layoutHashSchema.nullable().optional()
    })
    .strict()
export type ApplicationLayoutLineage = z.infer<typeof applicationLayoutLineageSchema>

/** A renderer-ready widget placement with explicit semantic placement. */
export const effectiveLayoutWidgetSchema = z
    .object({
        id: uuidV7Schema,
        layoutId: uuidV7Schema.optional(),
        zone: applicationLayoutZoneSchema,
        semanticRegion: layoutSemanticRegionSchema,
        widgetKey: applicationLayoutWidgetKeySchema,
        instanceKey: layoutInstanceKeySchema.optional(),
        // System widgets injected before user-configured items use reserved negative orders.
        sortOrder: z.number().int(),
        config: z.record(z.string(), z.unknown()).default({}),
        sourceConfig: z.record(z.string(), z.unknown()).nullable().optional(),
        sourceWidgetId: uuidV7Schema.nullable().optional(),
        sourceBaseWidgetId: uuidV7Schema.nullable().optional(),
        isCustomized: z.boolean().optional().default(false),
        isActive: z.boolean(),
        version: z.number().int().positive().optional()
    })
    .strict()
export type EffectiveWidget = z.infer<typeof effectiveLayoutWidgetSchema>

const validateEffectiveLayoutWidgets = (
    templateKey: ApplicationTemplateKey,
    widgets: readonly EffectiveWidget[],
    ctx: z.RefinementCtx
): void => {
    const seenInstanceKeys = new Set<string>()
    const seenSingleInstanceWidgetKeys = new Set<string>()

    widgets.forEach((widget, index) => {
        const definition = getLayoutWidgetDefinition(widget.widgetKey)
        const allowedZones = getLayoutWidgetAllowedZones(widget.widgetKey, templateKey)
        const zoneDefinition = getLayoutZoneDefinition(widget.zone, templateKey)

        if (!definition || !definition.supportedTemplates.includes(templateKey)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Widget is not supported by the selected layout template.',
                path: ['widgets', index, 'widgetKey']
            })
            return
        }

        if (!allowedZones?.includes(widget.zone)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Widget placement is not allowed for the selected layout template.',
                path: ['widgets', index, 'zone']
            })
        }

        if (!zoneDefinition || zoneDefinition.semanticRegion !== widget.semanticRegion) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Widget semantic region does not match its physical zone.',
                path: ['widgets', index, 'semanticRegion']
            })
        }

        if (widget.instanceKey) {
            if (seenInstanceKeys.has(widget.instanceKey)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Widget instance keys must be unique within a layout.',
                    path: ['widgets', index, 'instanceKey']
                })
            }
            seenInstanceKeys.add(widget.instanceKey)
        }

        if (!definition.multiInstance && seenSingleInstanceWidgetKeys.has(widget.widgetKey)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'The widget definition does not allow multiple instances.',
                path: ['widgets', index, 'widgetKey']
            })
        }
        if (!definition.multiInstance) seenSingleInstanceWidgetKeys.add(widget.widgetKey)

        const hostCapabilities = APPLICATION_TEMPLATE_REGISTRY[templateKey].hostCapabilities
        if (definition.requiredHostCapabilities.some((capability) => !hostCapabilities.includes(capability))) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'The selected layout host does not provide the widget capabilities.',
                path: ['widgets', index, 'widgetKey']
            })
        }
    })
}

const applicationLayoutContractBaseSchema = z
    .object({
        id: uuidV7Schema,
        templateKey: applicationTemplateKeySchema,
        scopeKind: applicationLayoutScopeKindSchema,
        scopeEntityId: z.union([uuidV7Schema, z.null()]),
        scopeEntityKind: z.string().trim().min(1).max(64).nullable().optional(),
        name: applicationLayoutLocalizedContentSchema.optional(),
        description: applicationLayoutLocalizedContentSchema.nullable().optional(),
        config: applicationLayoutConfigSchema.optional(),
        sourceKind: applicationLayoutSourceKindSchema,
        sourceLayoutId: uuidV7Schema.nullable(),
        sourceSnapshotHash: layoutHashSchema.nullable().optional(),
        sourceContentHash: layoutHashSchema.nullable().optional(),
        localContentHash: layoutHashSchema.nullable().optional(),
        syncState: applicationLayoutSyncStateSchema.optional(),
        isSourceExcluded: z.boolean().optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        sortOrder: z.number().int().nonnegative().optional(),
        version: z.number().int().positive().optional(),
        widgets: z.array(effectiveLayoutWidgetSchema)
    })
    .strict()

const globalApplicationLayoutContractSchema = applicationLayoutContractBaseSchema
    .extend({
        scopeKind: z.literal('global'),
        scopeEntityId: z.null(),
        compositionMode: z.literal('independent'),
        baseLayoutId: z.null()
    })
    .strict()

const scopedApplicationLayoutContractSchema = z.union([
    applicationLayoutContractBaseSchema
        .extend({
            scopeKind: z.literal('entity'),
            scopeEntityId: uuidV7Schema,
            compositionMode: z.literal('overlay'),
            baseLayoutId: uuidV7Schema
        })
        .strict(),
    applicationLayoutContractBaseSchema
        .extend({
            scopeKind: z.literal('entity'),
            scopeEntityId: uuidV7Schema,
            compositionMode: z.literal('independent'),
            baseLayoutId: z.null()
        })
        .strict()
])

const applicationLayoutContractUnionSchema = z.union([globalApplicationLayoutContractSchema, scopedApplicationLayoutContractSchema])

/** Strict per-layout envelope shared by snapshot, materialization, and runtime boundaries. */
export const applicationLayoutContractSchema = applicationLayoutContractUnionSchema.superRefine((layout, ctx) => {
    if (layout.compositionMode === 'independent') {
        layout.widgets.forEach((widget, index) => {
            if (widget.sourceBaseWidgetId !== undefined && widget.sourceBaseWidgetId !== null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Independent layouts cannot inherit a base widget.',
                    path: ['widgets', index, 'sourceBaseWidgetId']
                })
            }
        })
    }
    validateEffectiveLayoutWidgets(layout.templateKey, layout.widgets, ctx)
})
export type ApplicationLayoutContract = z.infer<typeof applicationLayoutContractSchema>

/** A snapshot may contain Dashboard and marketing layouts together. */
export const applicationLayoutSnapshotSchema = z
    .object({
        layouts: z.array(applicationLayoutContractSchema),
        scopedLayouts: z.array(applicationLayoutContractSchema).optional()
    })
    .strict()
    .superRefine((snapshot, ctx) => {
        const layoutEntries = [
            ...snapshot.layouts.map((layout, index) => ({ layout, path: ['layouts', index] as (string | number)[] })),
            ...(snapshot.scopedLayouts ?? []).map((layout, index) => ({ layout, path: ['scopedLayouts', index] as (string | number)[] }))
        ]
        snapshot.layouts.forEach((layout, index) => {
            if (layout.scopeKind !== 'global') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Snapshot layouts must use the global scope.',
                    path: ['layouts', index, 'scopeKind']
                })
            }
        })
        snapshot.scopedLayouts?.forEach((layout, index) => {
            if (layout.scopeKind !== 'entity') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Snapshot scopedLayouts must use the entity scope.',
                    path: ['scopedLayouts', index, 'scopeKind']
                })
            }
        })

        const layoutById = new Map<string, ApplicationLayoutContract>()

        layoutEntries.forEach(({ layout, path }) => {
            if (layoutById.has(layout.id)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Snapshot layout IDs must be unique.',
                    path: [...path, 'id']
                })
            }
            layoutById.set(layout.id, layout)
        })

        layoutEntries.forEach(({ layout, path }) => {
            if (layout.compositionMode !== 'overlay') return

            const baseLayout = layoutById.get(layout.baseLayoutId)
            if (!baseLayout) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Overlay layouts must reference a layout present in the snapshot.',
                    path: [...path, 'baseLayoutId']
                })
                return
            }
            if (baseLayout.scopeKind !== 'global' || baseLayout.templateKey !== layout.templateKey) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Overlay layouts must reference a global layout of the same template.',
                    path: [...path, 'baseLayoutId']
                })
            }
        })
    })
export type ApplicationLayoutSnapshot = z.infer<typeof applicationLayoutSnapshotSchema>

const effectiveLayoutMetadataBaseSchema = z
    .object({
        id: uuidV7Schema,
        templateKey: applicationTemplateKeySchema,
        sourceKind: applicationLayoutSourceKindSchema,
        sourceLayoutId: uuidV7Schema.nullable(),
        sourceSnapshotHash: layoutHashSchema.nullable().optional(),
        sourceContentHash: layoutHashSchema.nullable().optional(),
        localContentHash: layoutHashSchema.nullable().optional(),
        scopeKind: applicationLayoutScopeKindSchema.optional(),
        scopeEntityId: z.union([uuidV7Schema, z.null()]).optional(),
        name: applicationLayoutLocalizedContentSchema.optional(),
        description: applicationLayoutLocalizedContentSchema.nullable().optional(),
        config: applicationLayoutConfigSchema.optional(),
        syncState: applicationLayoutSyncStateSchema.optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        sortOrder: z.number().int().nonnegative().optional(),
        version: z.number().int().positive().optional()
    })
    .strict()

export const effectiveLayoutMetadataSchema = z.discriminatedUnion('compositionMode', [
    effectiveLayoutMetadataBaseSchema
        .extend({
            compositionMode: z.literal('overlay'),
            baseLayoutId: uuidV7Schema
        })
        .strict(),
    effectiveLayoutMetadataBaseSchema
        .extend({
            compositionMode: z.literal('independent'),
            baseLayoutId: z.null()
        })
        .strict()
])
export type EffectiveLayoutMetadata = z.infer<typeof effectiveLayoutMetadataSchema>

export const publicationIdentitySchema = z
    .object({
        publicationId: uuidV7Schema,
        publicationVersionId: uuidV7Schema,
        snapshotHash: layoutHashSchema
    })
    .strict()
export type PublicationIdentity = z.infer<typeof publicationIdentitySchema>

const effectiveLayoutSuccessSchema = z
    .object({
        status: z.literal('ok'),
        target: runtimeTargetSchema,
        resolvedEntityTypeId: uuidV7Schema.nullable().optional(),
        scope: applicationLayoutScopeKindSchema,
        layout: effectiveLayoutMetadataSchema,
        widgets: z.array(effectiveLayoutWidgetSchema),
        precedence: z.array(layoutEffectivePrecedenceSchema).min(1),
        publicationIdentity: publicationIdentitySchema.nullable(),
        materializationHash: layoutHashSchema.optional(),
        effectiveHash: layoutHashSchema
    })
    .strict()
    .superRefine((result, ctx) => {
        validateEffectiveLayoutWidgets(result.layout.templateKey, result.widgets, ctx)
        if (result.layout.scopeKind && result.layout.scopeKind !== result.scope) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Effective layout scope must match its selected layout.',
                path: ['layout', 'scopeKind']
            })
        }
    })

const effectiveLayoutFailureSchema = z
    .object({
        status: z.literal('failed'),
        error: layoutRuntimeErrorSchema
    })
    .strict()

/** Target-first effective-layout response; failures never degrade to an empty success. */
export const effectiveLayoutResultSchema = z.union([effectiveLayoutSuccessSchema, effectiveLayoutFailureSchema])
export const EffectiveLayoutResultSchema = effectiveLayoutResultSchema
export type EffectiveLayoutResult = z.infer<typeof effectiveLayoutResultSchema>

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

export const applicationLayoutMutationSchema = z
    .object({
        name: applicationLayoutLocalizedContentSchema.optional(),
        description: applicationLayoutLocalizedContentSchema.nullable().optional(),
        config: applicationLayoutConfigSchema.optional(),
        scopeEntityId: uuidV7Schema.nullable().optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()
export type ApplicationLayoutMutation = z.infer<typeof applicationLayoutMutationSchema>

const applicationLayoutExpectedVersionSchema = z.number().int().positive()

/** Layout scope is immutable after creation; updates can only change owned fields. */
export const applicationLayoutUpdateSchema = applicationLayoutMutationSchema
    .omit({ scopeEntityId: true })
    .extend({ expectedVersion: applicationLayoutExpectedVersionSchema })
export type ApplicationLayoutUpdate = z.infer<typeof applicationLayoutUpdateSchema>

/**
 * Reset an application-owned marketing appearance override to the template
 * defaults. The optimistic version is required so stale writes fail closed
 * for every caller, including direct API clients.
 */
export const applicationLayoutConfigResetMutationSchema = z
    .object({
        expectedVersion: z.number().int().positive()
    })
    .strict()
export type ApplicationLayoutConfigResetMutation = z.infer<typeof applicationLayoutConfigResetMutationSchema>

/**
 * Copying a layout reads both the source row and its widgets as one optimistic
 * snapshot. The source version is therefore required for every caller.
 */
export const applicationLayoutCopyMutationSchema = z
    .object({
        expectedVersion: z.number().int().positive()
    })
    .strict()
export type ApplicationLayoutCopyMutation = z.infer<typeof applicationLayoutCopyMutationSchema>

export const applicationLayoutCreateSchema = applicationLayoutMutationSchema.extend({
    templateKey: applicationTemplateKeySchema.default('dashboard'),
    name: applicationLayoutLocalizedContentSchema
})
export type ApplicationLayoutCreate = z.infer<typeof applicationLayoutCreateSchema>

export const applicationLayoutWidgetMutationSchema = z.object({
    zone: applicationLayoutZoneSchema,
    widgetKey: applicationLayoutWidgetKeySchema,
    sortOrder: z.number().int().optional(),
    config: z.record(z.unknown()).optional(),
    expectedVersion: applicationLayoutExpectedVersionSchema
})
export type ApplicationLayoutWidgetMutation = z.infer<typeof applicationLayoutWidgetMutationSchema>

export const applicationLayoutWidgetConfigMutationSchema = z.object({
    config: z.record(z.unknown()).default({}),
    expectedVersion: applicationLayoutExpectedVersionSchema
})
export type ApplicationLayoutWidgetConfigMutation = z.infer<typeof applicationLayoutWidgetConfigMutationSchema>

export const applicationLayoutWidgetConfigBatchMutationSchema = z.object({
    updates: z
        .array(
            applicationLayoutWidgetConfigMutationSchema.extend({
                layoutId: uuidV7Schema,
                widgetId: uuidV7Schema
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

export const applicationLayoutWidgetResetBatchMutationSchema = z
    .object({
        updates: z
            .array(
                z
                    .object({
                        layoutId: uuidV7Schema,
                        widgetId: uuidV7Schema,
                        expectedVersion: applicationLayoutExpectedVersionSchema
                    })
                    .strict()
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
    .strict()
export type ApplicationLayoutWidgetResetBatchMutation = z.infer<typeof applicationLayoutWidgetResetBatchMutationSchema>

export const applicationLayoutWidgetMoveMutationSchema = z.object({
    widgetId: uuidV7Schema,
    targetZone: applicationLayoutZoneSchema,
    targetIndex: z.number().int().nonnegative(),
    expectedVersion: applicationLayoutExpectedVersionSchema
})
export type ApplicationLayoutWidgetMoveMutation = z.infer<typeof applicationLayoutWidgetMoveMutationSchema>

export const applicationLayoutWidgetToggleMutationSchema = z.object({
    isActive: z.boolean(),
    expectedVersion: applicationLayoutExpectedVersionSchema
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
    sourceLayoutId: uuidV7Schema.nullable().optional(),
    applicationLayoutId: uuidV7Schema.nullable().optional(),
    sourceKind: applicationLayoutSourceKindSchema.optional(),
    currentSyncState: applicationLayoutSyncStateSchema.optional(),
    recommendedResolution: applicationLayoutSyncResolutionSchema.optional(),
    title: applicationLayoutLocalizedContentSchema.optional(),
    message: z.string().optional()
})
export type ApplicationLayoutChange = z.infer<typeof applicationLayoutChangeSchema>
