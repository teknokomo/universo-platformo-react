import { z } from 'zod'

import { applicationTemplateHostCapabilitySchema, type ApplicationTemplateHostCapability } from './applicationTemplates'
import {
    layoutWidgetAuthoringCapabilitiesSchema,
    layoutWidgetPresentationFieldSchema,
    widgetBindingSlotDefinitionSchema
} from './widgetBindings'

export const DASHBOARD_LAYOUT_ZONES = ['left', 'top', 'right', 'bottom', 'center'] as const
export type DashboardLayoutZone = (typeof DASHBOARD_LAYOUT_ZONES)[number]

export const DASHBOARD_LAYOUT_ZONE_SEMANTICS = {
    left: 'sidebar',
    top: 'header',
    right: 'auxiliary',
    bottom: 'footer',
    center: 'main'
} as const

export const DASHBOARD_WIDGET_SOURCE_CLASSES = ['host', 'entity', 'bounded-data', 'specialized-runtime', 'structural'] as const
export type DashboardWidgetSourceClass = (typeof DASHBOARD_WIDGET_SOURCE_CLASSES)[number]

export const DASHBOARD_WIDGET_CONFIG_FIELD_OWNERS = ['presentation', 'composition', 'host-runtime', 'specialized-runtime'] as const
export type DashboardWidgetConfigFieldOwner = (typeof DASHBOARD_WIDGET_CONFIG_FIELD_OWNERS)[number]

export const DASHBOARD_WIDGET_SEED_POLICIES = ['shell', 'optional', 'demo', 'specialized'] as const
export type DashboardWidgetSeedPolicy = (typeof DASHBOARD_WIDGET_SEED_POLICIES)[number]

export const dashboardWidgetSourcePolicySchema = z.discriminatedUnion('authority', [
    z
        .object({
            authority: z.literal('local'),
            sourceMode: z.enum(['none', 'optional']),
            inheritBindings: z.literal(false),
            inheritComposition: z.literal(false)
        })
        .strict(),
    z
        .object({
            authority: z.literal('metahub-source'),
            sourceMode: z.enum(['none', 'optional', 'required', 'specialized']),
            inheritBindings: z.boolean(),
            inheritComposition: z.boolean()
        })
        .strict()
])
export type PlacementSourcePolicy = z.infer<typeof dashboardWidgetSourcePolicySchema>
export type DashboardWidgetSourcePolicy = PlacementSourcePolicy

export const placementLineageStateSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('unlinked') }).strict(),
    z.object({ kind: z.literal('source-linked') }).strict()
])
export type PlacementLineageState = z.infer<typeof placementLineageStateSchema>

const containerSlotSchema = z
    .object({
        slotPrefix: z.string().trim().min(1).max(32),
        slotKeyPattern: z.string().trim().min(1).max(128),
        minSlots: z.number().int().min(0).max(32),
        maxSlots: z.number().int().min(1).max(32),
        allowedChildCapabilities: z.array(z.string().trim().min(1).max(64)).min(1).max(16)
    })
    .strict()
    .superRefine((slot, context) => {
        if (slot.minSlots > slot.maxSlots) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['minSlots'],
                message: 'Minimum container slots cannot exceed maximum slots.'
            })
        }
    })

const compositionSchema = z
    .object({
        sourceOwned: z.boolean(),
        container: z
            .object({
                kind: z.enum(['columns', 'tabs']),
                slots: z.array(containerSlotSchema).min(1).max(16),
                childrenAreFirstClassPlacements: z.literal(true)
            })
            .strict()
            .optional()
    })
    .strict()

const bindingSlotFamilySchema = z
    .object({
        familyKey: z.literal('panel'),
        slotPrefix: z.literal('panel:'),
        memberKeyPattern: z.string().trim().min(1).max(128),
        selectorKinds: z.tuple([z.literal('relation-set')]),
        cardinality: z.object({ min: z.number().int().min(0).max(32), max: z.number().int().min(1).max(32) }).strict(),
        maxMembers: z.number().int().min(1).max(32),
        requirements: widgetBindingSlotDefinitionSchema.innerType().shape.requirements,
        relation: z.object({ field: z.string().trim().min(1).max(64), parentSlot: z.string().trim().min(1).max(64) }).strict()
    })
    .strict()
    .superRefine((family, context) => {
        if (family.cardinality.min > family.cardinality.max || family.cardinality.max > family.maxMembers) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['cardinality'],
                message: 'Binding family cardinality must fit its member limit.'
            })
        }
    })

export const layoutWidgetCopyPolicySchema = z
    .object({
        placement: z.enum(['none', 'copy']),
        binding: z.enum(['none', 'share-bindings', 'clone-record'])
    })
    .strict()
export type LayoutWidgetCopyPolicy = z.infer<typeof layoutWidgetCopyPolicySchema>

export const applicationPlacementOverridePolicySchema = z
    .object({
        active: z.boolean(),
        order: z.enum(['none', 'root-only', 'any']),
        zone: z.boolean(),
        parentSlot: z.boolean()
    })
    .strict()
export type ApplicationPlacementOverridePolicy = z.infer<typeof applicationPlacementOverridePolicySchema>

export const layoutWidgetPlacementPolicySchema = z.object({ parent: z.enum(['root-only', 'root-or-compatible-container-slot']) }).strict()
export type LayoutWidgetPlacementPolicy = z.infer<typeof layoutWidgetPlacementPolicySchema>

const configFieldOwnershipSchema = z
    .object({
        path: z.string().trim().min(1).max(256),
        owner: z.enum(DASHBOARD_WIDGET_CONFIG_FIELD_OWNERS)
    })
    .strict()

const dashboardWidgetVariantOverrideSchema = z
    .object({
        sourceClass: z.enum(DASHBOARD_WIDGET_SOURCE_CLASSES).optional(),
        sourcePolicy: dashboardWidgetSourcePolicySchema.optional(),
        presentationFields: z.array(layoutWidgetPresentationFieldSchema).max(32).optional(),
        configFields: z.array(configFieldOwnershipSchema).max(128).optional(),
        authoring: layoutWidgetAuthoringCapabilitiesSchema.optional(),
        copyPolicy: layoutWidgetCopyPolicySchema.optional(),
        capabilities: z.array(z.string().trim().min(1).max(64)).max(16).optional()
    })
    .strict()

export const dashboardWidgetOwnershipMetadataSchema = z
    .object({
        sourceClass: z.enum(DASHBOARD_WIDGET_SOURCE_CLASSES),
        sourcePolicy: dashboardWidgetSourcePolicySchema,
        identity: z.object({ instanceKey: z.literal('required') }).strict(),
        bindingSlots: z.array(widgetBindingSlotDefinitionSchema).max(16).optional(),
        bindingSlotFamilies: z.array(bindingSlotFamilySchema).max(8).optional(),
        bindingVariants: z.record(z.string().trim().min(1).max(64), z.array(widgetBindingSlotDefinitionSchema).max(16)).optional(),
        initialBindingVariantKey: z.string().trim().min(1).max(64).optional(),
        variantOverrides: z.record(z.string().trim().min(1).max(64), dashboardWidgetVariantOverrideSchema).optional(),
        presentationFields: z.array(layoutWidgetPresentationFieldSchema).max(32),
        configFields: z.array(configFieldOwnershipSchema).max(128),
        authoring: layoutWidgetAuthoringCapabilitiesSchema,
        copyPolicy: layoutWidgetCopyPolicySchema,
        applicationPlacementOverrides: applicationPlacementOverridePolicySchema,
        placementPolicy: layoutWidgetPlacementPolicySchema,
        composition: compositionSchema.optional(),
        capabilities: z.array(z.string().trim().min(1).max(64)).max(16),
        seedPolicies: z.array(z.enum(DASHBOARD_WIDGET_SEED_POLICIES)).min(1).max(4)
    })
    .strict()

export type DashboardWidgetOwnershipMetadata = z.infer<typeof dashboardWidgetOwnershipMetadataSchema>
export type WidgetBindingSlotFamilyDefinition = z.infer<typeof bindingSlotFamilySchema>

export interface DashboardLayoutWidgetDefinition extends DashboardWidgetOwnershipMetadata {
    readonly key: string
    readonly templateKey: 'dashboard'
    readonly supportedTemplates: readonly ('dashboard' | 'marketing-page')[]
    readonly allowedZones: readonly DashboardLayoutZone[]
    readonly allowedZonesByTemplate: Readonly<Partial<Record<'dashboard' | 'marketing-page', readonly string[]>>>
    readonly multiInstance: boolean
    readonly requiredHostCapabilities: readonly ApplicationTemplateHostCapability[]
    readonly shared: boolean
    readonly labelKey: string
    readonly defaultLabel: string
    readonly defaultPlacement?: 'start' | 'end'
    readonly mobileProjection?: 'compact-header' | 'drawer'
}

export const dashboardLayoutWidgetDefinitionSchema = z
    .object({
        key: z.string().trim().min(1).max(128),
        templateKey: z.literal('dashboard'),
        supportedTemplates: z.array(z.enum(['dashboard', 'marketing-page'])).min(1),
        allowedZones: z.array(z.enum(DASHBOARD_LAYOUT_ZONES)).min(1),
        allowedZonesByTemplate: z.record(z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)),
        multiInstance: z.boolean(),
        requiredHostCapabilities: z.array(applicationTemplateHostCapabilitySchema),
        shared: z.boolean(),
        labelKey: z.string().trim().min(1),
        defaultLabel: z.string().trim().min(1),
        defaultPlacement: z.enum(['start', 'end']).optional(),
        mobileProjection: z.enum(['compact-header', 'drawer']).optional(),
        ...dashboardWidgetOwnershipMetadataSchema.shape
    })
    .strict()
    .superRefine((definition, context) => {
        for (const template of definition.supportedTemplates) {
            if (!definition.allowedZonesByTemplate[template]) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['allowedZonesByTemplate', template],
                    message: 'Every supported template must declare allowed zones.'
                })
            }
        }
        if (definition.identity.instanceKey !== 'required') {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['identity', 'instanceKey'],
                message: 'Dashboard placements require instanceKey.'
            })
        }
        if (
            definition.initialBindingVariantKey !== undefined &&
            !Object.prototype.hasOwnProperty.call(definition.bindingVariants ?? {}, definition.initialBindingVariantKey)
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['initialBindingVariantKey'],
                message: 'Initial binding variant must name a declared widget binding variant.'
            })
        }
    })

export const dashboardLayoutWidgetRegistrySchema = z
    .array(dashboardLayoutWidgetDefinitionSchema)
    .min(1)
    .superRefine((definitions, context) => {
        const keys = new Set<string>()
        definitions.forEach(({ key }, index) => {
            if (keys.has(key)) {
                context.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'key'], message: 'Dashboard widget keys must be unique.' })
            }
            keys.add(key)
        })
    })

const placementParentWidgetIdSchema = z
    .string()
    .uuid()
    .refine((value) => value[14]?.toLowerCase() === '7', 'Parent widget IDs must be UUID v7 values.')

export const persistedLayoutWidgetParentageSchema = z
    .object({
        parentWidgetId: placementParentWidgetIdSchema.nullable(),
        slotKey: z
            .string()
            .trim()
            .min(1)
            .max(64)
            .regex(/^[A-Za-z][A-Za-z0-9._:-]*$/u)
            .nullable()
    })
    .strict()
    .superRefine((placement, context) => {
        if ((placement.parentWidgetId === null) !== (placement.slotKey === null)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['slotKey'],
                message: 'Root placements have no parent or slot; child placements require both.'
            })
        }
    })
export type PersistedLayoutWidgetParentage = z.infer<typeof persistedLayoutWidgetParentageSchema>

const semanticParentInstanceKeySchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u)

export const effectiveLayoutParentageFieldsSchema = z
    .object({
        parentInstanceKey: semanticParentInstanceKeySchema.nullable(),
        slotKey: z
            .string()
            .trim()
            .min(1)
            .max(64)
            .regex(/^[A-Za-z][A-Za-z0-9._:-]*$/u)
            .nullable()
    })
    .strict()

export const effectiveLayoutParentageSchema = effectiveLayoutParentageFieldsSchema.superRefine((placement, context) => {
    if ((placement.parentInstanceKey === null) !== (placement.slotKey === null)) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['slotKey'],
            message: 'Root placements have no parent or slot; child placements require both.'
        })
    }
})
export type EffectiveLayoutParentage = z.infer<typeof effectiveLayoutParentageSchema>
