import { z } from 'zod'
import { effectiveWidgetRuntimeDataSchema } from './effectiveWidgetRuntimeData'
import { APPLICATION_TEMPLATE_REGISTRY, layoutSemanticRegionSchema } from './applicationTemplates'
import { dashboardLayoutConfigSchema, type DashboardLayoutConfig } from './dashboardLayout'
import { getLayoutWidgetAllowedZones, getLayoutWidgetDefinition, getLayoutZoneDefinition } from './layoutWidgetDefinitions'
import { layoutLogicalPlacementSchema, layoutZoneSettingsSchema, persistedLayoutNeutralMetadataSchema } from './layoutEnvelope'
import { DASHBOARD_LAYOUT_WIDGETS, DASHBOARD_LAYOUT_ZONES } from './metahubs'
import {
    DASHBOARD_WIDGET_CONFIG_SCHEMAS,
    dashboardWidgetConfigSchemaByKey,
    effectiveLayoutParentageFieldsSchema,
    effectiveLayoutParentageSchema,
    persistedLayoutWidgetParentageSchema
} from './dashboardWidgetRegistry'
import {
    applicationTemplateKeySchema,
    marketingAuthWidgetConfigSchema,
    marketingBrandWidgetConfigSchema,
    marketingCollectionWidgetConfigSchema,
    marketingFooterWidgetConfigSchema,
    marketingHeroWidgetConfigSchema,
    marketingImageWidgetConfigSchema,
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
export const applicationLayoutConfigSchema = z
    .record(z.string(), z.unknown())
    .default({})
    .transform((config) => config as ApplicationLayoutConfig)

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
const RESERVED_LAYOUT_CONFIG_KEYS = new Set(['__layout', 'compositionMode', 'baseLayoutId'])

export const parseApplicationLayoutConfig = (templateKey: ApplicationTemplateKey | string, config: unknown): ApplicationLayoutConfig => {
    const key = applicationTemplateKeySchema.parse(templateKey)
    if (isApplicationLayoutRecord(config) && Object.keys(config).some((configKey) => RESERVED_LAYOUT_CONFIG_KEYS.has(configKey))) {
        throw new Error('Layout metadata must be decoded before renderer configuration is parsed.')
    }
    if (key === 'marketing-page') return marketingPageConfigSchema.parse(config ?? {}) as ApplicationLayoutConfig
    if (isApplicationLayoutRecord(config) && Object.keys(config).some((configKey) => MARKETING_ONLY_LAYOUT_CONFIG_KEYS.has(configKey))) {
        throw new Error('Dashboard layouts cannot contain marketing-page configuration keys.')
    }
    const dashboardConfig = dashboardLayoutConfigSchema.parse(config ?? {}) ?? {}
    return dashboardConfig as ApplicationLayoutConfig
}

const marketingStoredWidgetConfigSchemaByKey = {
    'marketing.brand': marketingBrandWidgetConfigSchema,
    'marketing.navigation': marketingNavigationWidgetConfigSchema,
    'marketing.auth': marketingAuthWidgetConfigSchema,
    'marketing.hero': marketingHeroWidgetConfigSchema,
    'marketing.image': marketingImageWidgetConfigSchema,
    'marketing.collection': marketingCollectionWidgetConfigSchema,
    'marketing.pricing': marketingPricingWidgetConfigSchema,
    'marketing.footer': marketingFooterWidgetConfigSchema
} as const

const widgetConfigSchemaByKey = {
    ...dashboardWidgetConfigSchemaByKey,
    ...marketingStoredWidgetConfigSchemaByKey
} as const

const allWidgetConfigSchemas = Object.values(widgetConfigSchemaByKey)
if (allWidgetConfigSchemas.length < 2) {
    throw new Error('Application layouts require at least two widget config schemas.')
}
const [firstWidgetConfigSchema, secondWidgetConfigSchema, ...remainingWidgetConfigSchemas] = allWidgetConfigSchemas
export const applicationLayoutWidgetConfigSchema = z.union([
    firstWidgetConfigSchema!,
    secondWidgetConfigSchema!,
    ...remainingWidgetConfigSchemas
])

const isStoredWidgetConfigValid = (widgetKey: string, config: unknown): boolean => {
    const schema = widgetConfigSchemaByKey[widgetKey as keyof typeof widgetConfigSchemaByKey]
    return Boolean(schema?.safeParse(config ?? {}).success)
}

/** Parse persisted renderer config using the exact strict schema for its widget key. */
export const parseApplicationLayoutWidgetConfig = (widgetKey: string, config: unknown): Record<string, unknown> => {
    const schema = widgetConfigSchemaByKey[widgetKey as keyof typeof widgetConfigSchemaByKey]
    if (!schema) throw new Error(`Unsupported layout widget key: ${widgetKey}`)
    return schema.parse(config ?? {}) as Record<string, unknown>
}

export const menuWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.menuWidget
export const columnsContainerWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.columnsContainer
export const detailsTabsWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.detailsTabs
export const quizWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.quizWidget
export const playcanvasCanvasWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.playcanvasCanvas
export const detailsTableWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.detailsTable
export const relationBuilderWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.relationBuilder
export const overviewCardsWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.overviewCards
export const recordsSeriesChartWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.sessionsChart
export const resourcePreviewWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.resourcePreview
export const learnerPlayerWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.learnerPlayer
export type DetailsTabsWidgetConfig = z.infer<typeof detailsTabsWidgetConfigSchema>
export type DetailsTableWidgetConfig = z.infer<typeof detailsTableWidgetConfigSchema>
export type RelationBuilderWidgetConfig = z.infer<typeof relationBuilderWidgetConfigSchema>
export type RecordsSeriesChartWidgetConfig = z.infer<typeof recordsSeriesChartWidgetConfigSchema>
export type ResourcePreviewWidgetConfig = z.infer<typeof resourcePreviewWidgetConfigSchema>
export type LearnerPlayerWidgetConfig = z.infer<typeof learnerPlayerWidgetConfigSchema>

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

export const applicationLayoutWidgetSchema = z
    .object({
        id: uuidV7Schema,
        layoutId: uuidV7Schema,
        zone: applicationLayoutZoneSchema,
        widgetKey: applicationLayoutWidgetKeySchema,
        instanceKey: layoutInstanceKeySchema,
        parentWidgetId: uuidV7Schema.nullable(),
        slotKey: z
            .string()
            .trim()
            .min(1)
            .max(64)
            .regex(/^[A-Za-z][A-Za-z0-9._:-]*$/u)
            .nullable(),
        sortOrder: z.number().int(),
        config: z.record(z.unknown()).default({}),
        sourceConfig: z.record(z.unknown()).nullable().default(null),
        sourceWidgetId: uuidV7Schema.nullable().optional(),
        sourceBaseWidgetId: uuidV7Schema.nullable().optional(),
        placement: layoutLogicalPlacementSchema.optional(),
        isCustomized: z.boolean().default(false),
        isActive: z.boolean(),
        version: z.number().int().positive()
    })
    .strict()
    .superRefine((widget, context) => {
        if (!persistedLayoutWidgetParentageSchema.safeParse({ parentWidgetId: widget.parentWidgetId, slotKey: widget.slotKey }).success) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['slotKey'],
                message: 'Root placements have no parent or slot; child placements require both.'
            })
        }
        if (!isStoredWidgetConfigValid(widget.widgetKey, widget.config)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['config'],
                message: 'Widget config does not match its strict registry contract.'
            })
        }
        if (widget.sourceConfig !== null && !isStoredWidgetConfigValid(widget.widgetKey, widget.sourceConfig)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['sourceConfig'],
                message: 'Source config does not match its strict registry contract.'
            })
        }
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
    /** Decoded neutral metadata; the renderer config above never contains __layout. */
    neutral: persistedLayoutNeutralMetadataSchema.optional(),
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
const effectiveLayoutWidgetObjectSchema = z
    .object({
        id: uuidV7Schema,
        layoutId: uuidV7Schema.optional(),
        zone: applicationLayoutZoneSchema,
        semanticRegion: layoutSemanticRegionSchema,
        widgetKey: applicationLayoutWidgetKeySchema,
        instanceKey: layoutInstanceKeySchema,
        ...effectiveLayoutParentageFieldsSchema.shape,
        // System widgets injected before user-configured items use reserved negative orders.
        sortOrder: z.number().int(),
        config: z.record(z.string(), z.unknown()).default({}),
        sourceConfig: z.record(z.string(), z.unknown()).nullable().optional(),
        sourceWidgetId: uuidV7Schema.nullable().optional(),
        sourceBaseWidgetId: uuidV7Schema.nullable().optional(),
        placement: layoutLogicalPlacementSchema.optional(),
        isCustomized: z.boolean().optional().default(false),
        isActive: z.boolean(),
        version: z.number().int().positive().optional()
    })
    .strict()

const validateEffectiveLayoutWidget = (widget: z.infer<typeof effectiveLayoutWidgetObjectSchema>, context: z.RefinementCtx): void => {
    if (!effectiveLayoutParentageSchema.safeParse({ parentInstanceKey: widget.parentInstanceKey, slotKey: widget.slotKey }).success) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['slotKey'],
            message: 'Root placements have no parent or slot; child placements require both.'
        })
    }
    if (!isStoredWidgetConfigValid(widget.widgetKey, widget.config)) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['config'],
            message: 'Widget config does not match its strict registry contract.'
        })
    }
    if (
        widget.sourceConfig !== undefined &&
        widget.sourceConfig !== null &&
        !isStoredWidgetConfigValid(widget.widgetKey, widget.sourceConfig)
    ) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['sourceConfig'],
            message: 'Source config does not match its strict registry contract.'
        })
    }
}

export const effectiveLayoutWidgetSchema = effectiveLayoutWidgetObjectSchema.superRefine(validateEffectiveLayoutWidget)
export type EffectiveLayoutWidget = z.infer<typeof effectiveLayoutWidgetSchema>

/** Runtime-only API projection. Bound content is never persisted in layout snapshots. */
export const effectiveLayoutRuntimeWidgetSchema = effectiveLayoutWidgetObjectSchema
    .extend({ runtimeData: effectiveWidgetRuntimeDataSchema.optional() })
    .strict()
    .superRefine(validateEffectiveLayoutWidget)
export type EffectiveLayoutRuntimeWidget = z.infer<typeof effectiveLayoutRuntimeWidgetSchema>

const validateEffectiveLayoutWidgets = (
    templateKey: ApplicationTemplateKey,
    widgets: readonly EffectiveLayoutWidget[],
    ctx: z.RefinementCtx
): void => {
    const seenInstanceKeys = new Set<string>()
    const seenSingleInstanceWidgetKeys = new Set<string>()

    widgets.forEach((widget, index) => {
        const definition = getLayoutWidgetDefinition(widget.widgetKey, widget.config)
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

        if (seenInstanceKeys.has(widget.instanceKey)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Widget instance keys must be unique within a layout.',
                path: ['widgets', index, 'instanceKey']
            })
        }
        seenInstanceKeys.add(widget.instanceKey)

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

    const indexByInstanceKey = new Map<string, number>()
    widgets.forEach((widget, index) => {
        if (!indexByInstanceKey.has(widget.instanceKey)) indexByInstanceKey.set(widget.instanceKey, index)
    })

    widgets.forEach((widget, index) => {
        if (widget.parentInstanceKey === null) return

        const parentIndex = indexByInstanceKey.get(widget.parentInstanceKey)
        if (parentIndex === undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Placement parent is unavailable.',
                path: ['widgets', index, 'parentInstanceKey']
            })
            return
        }

        const parent = widgets[parentIndex]
        const parentDefinition = getLayoutWidgetDefinition(parent.widgetKey, parent.config)
        const childDefinition = getLayoutWidgetDefinition(widget.widgetKey, widget.config)
        const container = parentDefinition?.composition?.container
        const declaredContainerSlot = container?.slots.find((slot) => {
            if (!widget.slotKey?.startsWith(slot.slotPrefix)) return false
            return new RegExp(slot.slotKeyPattern, 'u').test(widget.slotKey.slice(slot.slotPrefix.length))
        })
        const slotDescriptors = container ? parent.config[container.kind === 'columns' ? 'columns' : 'tabs'] : undefined
        const slotIsConfigured =
            Array.isArray(slotDescriptors) &&
            slotDescriptors.some(
                (descriptor) =>
                    descriptor !== null &&
                    typeof descriptor === 'object' &&
                    !Array.isArray(descriptor) &&
                    (descriptor as { slotKey?: unknown }).slotKey === widget.slotKey
            )
        const childCapabilityIsAllowed = (childDefinition?.capabilities ?? []).some((capability) =>
            (declaredContainerSlot?.allowedChildCapabilities ?? []).includes(capability)
        )

        if (
            parent.zone !== widget.zone ||
            childDefinition?.placementPolicy.parent !== 'root-or-compatible-container-slot' ||
            !declaredContainerSlot ||
            !slotIsConfigured ||
            !childCapabilityIsAllowed
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Placement parent or slot is incompatible.',
                path: ['widgets', index, 'parentInstanceKey']
            })
        }

        const visited = new Set<string>([widget.instanceKey])
        let current: EffectiveLayoutWidget | undefined = parent
        while (current) {
            if (visited.has(current.instanceKey)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Placement graph cannot contain cycles.',
                    path: ['widgets', index, 'parentInstanceKey']
                })
                break
            }
            visited.add(current.instanceKey)
            const ancestorIndex: number | undefined =
                current.parentInstanceKey === null ? undefined : indexByInstanceKey.get(current.parentInstanceKey)
            current = ancestorIndex === undefined ? undefined : widgets[ancestorIndex]
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
        /** Effective zone settings are decoded, descriptor-backed metadata, separate from renderer config. */
        zoneSettings: layoutZoneSettingsSchema.optional(),
        syncState: applicationLayoutSyncStateSchema.optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        sortOrder: z.number().int().nonnegative().optional(),
        version: z.number().int().positive().optional()
    })
    .strict()

export const effectiveLayoutMetadataSchema = z
    .discriminatedUnion('compositionMode', [
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
    .superRefine((value, context) => {
        for (const [zone, values] of Object.entries(value.zoneSettings ?? {})) {
            const zoneDefinition = getLayoutZoneDefinition(zone, value.templateKey)
            if (!zoneDefinition) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['zoneSettings', zone],
                    message: 'Effective zone settings must use a registered zone for the layout template.'
                })
                continue
            }
            for (const [settingKey, settingValue] of Object.entries(values)) {
                const setting = zoneDefinition.settings.find((candidate) => candidate.key === settingKey)
                if (!setting || typeof settingValue !== 'string' || !setting.options.includes(settingValue)) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['zoneSettings', zone, settingKey],
                        message: 'Effective zone setting is not declared by the layout registry.'
                    })
                }
            }
        }
    })
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
        widgets: z.array(effectiveLayoutRuntimeWidgetSchema),
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
    copyAsApplicationUnavailable: z.boolean().optional(),
    title: applicationLayoutLocalizedContentSchema.optional(),
    message: z.string().optional()
})
export type ApplicationLayoutChange = z.infer<typeof applicationLayoutChangeSchema>
