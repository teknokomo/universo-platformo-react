import { z } from 'zod'

import type { ApplicationLayoutWidgetKey, ApplicationLayoutZone } from './applicationLayouts'
import type { LayoutLogicalPlacement, LayoutWidgetMobileProjection } from './layoutWidgetPrimitives'
import {
    MARKETING_LAYOUT_ZONES,
    MARKETING_LAYOUT_ZONE_SEMANTICS,
    MARKETING_WIDGET_REGISTRY,
    applicationTemplateKeySchema
} from './marketingPage'
import type { ApplicationTemplateKey } from './marketingPage'
import { DASHBOARD_LAYOUT_WIDGETS, DASHBOARD_LAYOUT_ZONES, DASHBOARD_LAYOUT_ZONE_SEMANTICS } from './metahubs'
import {
    dashboardWidgetOwnershipMetadataSchema,
    type DashboardWidgetOwnershipMetadata,
    type LayoutWidgetCopyPolicy,
    type LayoutWidgetPlacementPolicy,
    type PlacementSourcePolicy
} from './dashboardWidgetRegistry'
import {
    applicationTemplateHostCapabilitySchema,
    layoutSemanticRegionSchema,
    type ApplicationTemplateHostCapability,
    type LayoutSemanticRegion
} from './applicationTemplates'
import { type WidgetBindingSlotDefinition } from './widgetBindings'
import { MARKETING_WIDGET_CONTRACTS } from './marketingWidgetContracts'

/** Serializable setting descriptor exposed through layout metadata responses. */
export interface LayoutZoneSettingDefinition<TKey extends string = string, TOption extends string = string> {
    readonly key: TKey
    readonly kind: 'enum'
    readonly options: readonly TOption[]
    readonly defaultValue: TOption
    readonly labelKey: string
    readonly defaultLabel: string
    readonly optionLabelKeys: Readonly<Record<TOption, string>>
    readonly defaultOptionLabels: Readonly<Record<TOption, string>>
}

export const layoutZoneSettingDefinitionSchema = z
    .object({
        key: z.string().trim().min(1).max(128),
        kind: z.literal('enum'),
        options: z.array(z.string().trim().min(1).max(64)).min(1),
        defaultValue: z.string().trim().min(1).max(64),
        labelKey: z.string().trim().min(1),
        defaultLabel: z.string().trim().min(1),
        optionLabelKeys: z.record(z.string().trim().min(1).max(64), z.string().trim().min(1)),
        defaultOptionLabels: z.record(z.string().trim().min(1).max(64), z.string().trim().min(1))
    })
    .strict()
    .superRefine((value, context) => {
        if (new Set(value.options).size !== value.options.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['options'],
                message: 'Zone setting options must be unique.'
            })
        }
        if (!value.options.includes(value.defaultValue)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['defaultValue'],
                message: 'Zone setting default must be one of its options.'
            })
        }
        const optionKeys = Object.keys(value.optionLabelKeys).sort()
        const expectedKeys = [...value.options].sort()
        if (optionKeys.length !== expectedKeys.length || optionKeys.some((key, index) => key !== expectedKeys[index])) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['optionLabelKeys'],
                message: 'Zone setting options must have matching localization keys.'
            })
        }
        const defaultOptionKeys = Object.keys(value.defaultOptionLabels).sort()
        if (defaultOptionKeys.length !== expectedKeys.length || defaultOptionKeys.some((key, index) => key !== expectedKeys[index])) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['defaultOptionLabels'],
                message: 'Zone setting options must have matching default labels.'
            })
        }
    })

export const MARKETING_HEADER_POSITION_SETTING: LayoutZoneSettingDefinition<'position', 'fixed' | 'flow'> = {
    key: 'position',
    kind: 'enum',
    options: ['fixed', 'flow'],
    defaultValue: 'fixed',
    labelKey: 'layouts.zoneSettings.headerBehavior',
    defaultLabel: 'Header behavior',
    optionLabelKeys: {
        fixed: 'layouts.zoneSettings.fixed',
        flow: 'layouts.zoneSettings.flow'
    },
    defaultOptionLabels: {
        fixed: 'Fixed on screen',
        flow: 'Scrolls with page'
    }
}

export const MARKETING_HEADER_ZONE_SETTINGS: readonly LayoutZoneSettingDefinition[] = [MARKETING_HEADER_POSITION_SETTING]

export interface LayoutZoneDefinition {
    readonly key: ApplicationLayoutZone
    readonly templateKey: ApplicationTemplateKey
    readonly semanticRegion: LayoutSemanticRegion
    readonly labelKey: string
    readonly defaultLabel: string
    readonly settings: readonly LayoutZoneSettingDefinition[]
}

export interface LayoutSemanticZoneMapping {
    readonly semanticRegion: LayoutSemanticRegion
    readonly templateKey: ApplicationTemplateKey
    readonly physicalZone: ApplicationLayoutZone
}

export interface LayoutWidgetDefinition extends DashboardWidgetOwnershipMetadata {
    readonly key: ApplicationLayoutWidgetKey
    /** Template that originally owns the widget definition. */
    readonly templateKey: ApplicationTemplateKey
    /** Templates whose adapters may render this widget. */
    readonly supportedTemplates: readonly ApplicationTemplateKey[]
    readonly allowedZones: readonly ApplicationLayoutZone[]
    /** Explicit physical placement per supported template. */
    readonly allowedZonesByTemplate: Readonly<Partial<Record<ApplicationTemplateKey, readonly ApplicationLayoutZone[]>>>
    readonly multiInstance: boolean
    readonly requiredHostCapabilities: readonly ApplicationTemplateHostCapability[]
    readonly shared: boolean
    readonly labelKey: string
    readonly defaultLabel: string
    /** Default logical placement for widgets that participate in a header group. */
    readonly defaultPlacement?: LayoutLogicalPlacement
    /** Compact/mobile projection owned by the zone shell. */
    readonly mobileProjection?: LayoutWidgetMobileProjection
    /** Slot selected by default when configuring a source-backed widget. */
    readonly initialBindingSlotKey?: string
}

const layoutWidgetKeySchema = z.string().trim().min(1).max(128)
const layoutZoneKeySchema = z.enum([...DASHBOARD_LAYOUT_ZONES, ...MARKETING_LAYOUT_ZONES] as [
    ApplicationLayoutZone,
    ...ApplicationLayoutZone[]
])

/** Runtime contract for one canonical layout zone definition. */
export const layoutZoneDefinitionSchema = z
    .object({
        key: layoutZoneKeySchema,
        templateKey: applicationTemplateKeySchema,
        semanticRegion: layoutSemanticRegionSchema,
        labelKey: z.string().trim().min(1),
        defaultLabel: z.string().trim().min(1),
        settings: z.array(layoutZoneSettingDefinitionSchema)
    })
    .strict()

/**
 * Runtime contract for widget metadata returned to authoring clients.
 * Keep this contract independent from persisted layout rows: it describes the
 * registry capabilities required by both metahub and application editors.
 */
export const layoutWidgetDefinitionSchema = z
    .object({
        key: layoutWidgetKeySchema,
        templateKey: applicationTemplateKeySchema,
        supportedTemplates: z.array(applicationTemplateKeySchema).min(1),
        allowedZones: z.array(layoutZoneKeySchema).min(1),
        allowedZonesByTemplate: z.record(z.string().trim().min(1), z.array(layoutZoneKeySchema).min(1)),
        multiInstance: z.boolean(),
        requiredHostCapabilities: z.array(applicationTemplateHostCapabilitySchema),
        shared: z.boolean(),
        labelKey: z.string().trim().min(1),
        defaultLabel: z.string().trim().min(1),
        defaultPlacement: z.enum(['start', 'end']).optional(),
        mobileProjection: z.enum(['compact-header', 'drawer']).optional(),
        initialBindingSlotKey: z.string().trim().min(1).max(128).optional(),
        ...dashboardWidgetOwnershipMetadataSchema.shape
    })
    .strict()
    .superRefine((value, context) => {
        for (const templateKey of value.supportedTemplates) {
            if (!value.allowedZonesByTemplate[templateKey]) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['allowedZonesByTemplate', templateKey],
                    message: 'Every supported template must declare allowed zones.'
                })
            }
        }
        const slotKeys = (value.bindingSlots ?? []).map(({ key }) => key)
        if (new Set(slotKeys).size !== slotKeys.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['bindingSlots'],
                message: 'Widget binding slot keys must be unique.'
            })
        }
        if (value.initialBindingSlotKey !== undefined) {
            const slotGroups = Object.entries(value.bindingVariants ?? {})
            const groups = slotGroups.length > 0 ? slotGroups : [['bindingSlots', value.bindingSlots ?? []] as const]
            for (const [groupKey, slots] of groups) {
                if (!slots.some(({ key }) => key === value.initialBindingSlotKey)) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: slotGroups.length > 0 ? ['bindingVariants', groupKey] : ['bindingSlots'],
                        message: 'Initial binding slot must exist in every supported widget slot list.'
                    })
                }
            }
        }
        if (
            value.initialBindingVariantKey !== undefined &&
            !Object.prototype.hasOwnProperty.call(value.bindingVariants ?? {}, value.initialBindingVariantKey)
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['initialBindingVariantKey'],
                message: 'Initial binding variant must name a declared widget binding variant.'
            })
        }
        const presentationKeys = (value.presentationFields ?? []).map(({ key }) => key)
        if (new Set(presentationKeys).size !== presentationKeys.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['presentationFields'],
                message: 'Widget presentation field keys must be unique.'
            })
        }
        if (value.variantOverrides) {
            const declaredVariants = new Set(Object.keys(value.bindingVariants ?? {}))
            for (const variant of Object.keys(value.variantOverrides)) {
                if (!declaredVariants.has(variant)) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['variantOverrides', variant],
                        message: 'Widget variant overrides must target a declared binding variant.'
                    })
                }
            }
        }
    })

/** Runtime contract for the template metadata envelope returned by the API. */
export const layoutWidgetTemplateMetadataSchema = z
    .object({
        key: applicationTemplateKeySchema,
        displayNameKey: z.string().trim().min(1),
        descriptionKey: z.string().trim().min(1),
        supportsDashboardWidgets: z.boolean(),
        seedPolicyKey: z.string().trim().min(1),
        hostCapabilities: z.array(applicationTemplateHostCapabilitySchema),
        semanticRegions: z.array(layoutSemanticRegionSchema).min(1),
        zones: z.array(layoutZoneDefinitionSchema),
        widgets: z.array(layoutWidgetDefinitionSchema)
    })
    .strict()

export const layoutWidgetMetadataResponseSchema = z
    .object({
        items: z.array(layoutWidgetDefinitionSchema),
        templates: z.array(layoutWidgetTemplateMetadataSchema)
    })
    .strict()

export type LayoutWidgetMetadataResponse = z.infer<typeof layoutWidgetMetadataResponseSchema>

const toDefaultLabel = (key: string): string => {
    const segment = key.split('.').at(-1) ?? key
    const spaced = segment.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ')
    return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1)

const DASHBOARD_WIDGET_DEFINITIONS: readonly LayoutWidgetDefinition[] = DASHBOARD_LAYOUT_WIDGETS.map((widget) => ({
    ...widget,
    allowedZonesByTemplate: {
        dashboard: [...widget.allowedZones],
        ...(widget.shared ? { 'marketing-page': ['marketing-header'] as const } : {})
    }
}))

const marketingSourcePolicy = (hasBindings: boolean): PlacementSourcePolicy => ({
    authority: 'metahub-source',
    sourceMode: hasBindings ? 'required' : 'none',
    inheritBindings: hasBindings,
    inheritComposition: false
})

const marketingCopyPolicy = (widgetKey: string): LayoutWidgetCopyPolicy => {
    const duplicate = MARKETING_WIDGET_CONTRACTS[widgetKey as keyof typeof MARKETING_WIDGET_CONTRACTS].authoring.metahub.duplicate
    if (duplicate === 'none') return { placement: 'none', binding: 'none' }
    return { placement: 'copy', binding: duplicate }
}

const marketingConfigFields = (contract: (typeof MARKETING_WIDGET_CONTRACTS)[keyof typeof MARKETING_WIDGET_CONTRACTS]) =>
    (contract.presentationFields ?? []).map(({ key }) => ({
        path: key,
        owner: contract.bindingVariants && key === 'variant' ? ('specialized-runtime' as const) : ('presentation' as const)
    }))

const marketingPlacementPolicy: LayoutWidgetPlacementPolicy = { parent: 'root-only' }

const MARKETING_WIDGET_DEFINITIONS: readonly LayoutWidgetDefinition[] = Object.values(MARKETING_WIDGET_REGISTRY).map((widget) => {
    const contract = MARKETING_WIDGET_CONTRACTS[widget.key]
    return {
        key: widget.key,
        allowedZones: widget.allowedZones,
        allowedZonesByTemplate: { 'marketing-page': widget.allowedZones },
        multiInstance: widget.repeatable,
        templateKey: 'marketing-page',
        supportedTemplates: ['marketing-page'],
        requiredHostCapabilities: [],
        shared: false,
        labelKey: `layouts.widgets.${widget.key}`,
        defaultLabel: toDefaultLabel(widget.key),
        sourceClass: widget.key === 'marketing.auth' ? 'host' : 'entity',
        sourcePolicy: marketingSourcePolicy(Boolean(contract.bindingSlots?.length || contract.bindingVariants)),
        identity: { instanceKey: 'required' },
        configFields: marketingConfigFields(contract),
        copyPolicy: marketingCopyPolicy(widget.key),
        applicationPlacementOverrides: { active: true, order: 'root-only', zone: false, parentSlot: false },
        placementPolicy: marketingPlacementPolicy,
        composition: { sourceOwned: false },
        capabilities: [widget.key === 'marketing.auth' ? 'marketing.host' : 'marketing.content'],
        seedPolicies: ['shell'],
        presentationFields: [...(contract.presentationFields ?? [])],
        authoring: contract.authoring,
        ...(contract.bindingSlots ? { bindingSlots: [...contract.bindingSlots] } : {}),
        ...(contract.initialBindingSlotKey ? { initialBindingSlotKey: contract.initialBindingSlotKey } : {}),
        ...(contract.bindingVariants
            ? {
                  bindingVariants: Object.fromEntries(Object.entries(contract.bindingVariants).map(([key, slots]) => [key, [...slots]]))
              }
            : {}),
        ...(widget.defaultPlacement ? { defaultPlacement: widget.defaultPlacement } : {}),
        ...(widget.mobileProjection ? { mobileProjection: widget.mobileProjection } : {})
    }
})

/**
 * Canonical labels and placement metadata shared by metahub and application
 * layout authoring. The registry contains no UI imports or persisted IDs.
 */
export const LAYOUT_WIDGET_DEFINITIONS: readonly LayoutWidgetDefinition[] = [
    ...DASHBOARD_WIDGET_DEFINITIONS,
    ...MARKETING_WIDGET_DEFINITIONS
]

const createZoneDefinitions = <T extends readonly ApplicationLayoutZone[]>(
    zones: T,
    templateKey: ApplicationTemplateKey,
    semanticRegions: Readonly<Record<T[number], LayoutSemanticRegion>>
): readonly LayoutZoneDefinition[] =>
    zones.map((key) => {
        const marketingZone = key.replace(/^marketing-/, '')
        const labelKey = templateKey === 'marketing-page' ? `layouts.zones.marketing${capitalize(marketingZone)}` : `layouts.zones.${key}`
        const defaultLabel =
            templateKey === 'marketing-page'
                ? `Marketing ${marketingZone === 'main' ? 'content' : marketingZone}`
                : capitalize(marketingZone)

        const settings = templateKey === 'marketing-page' && key === 'marketing-header' ? MARKETING_HEADER_ZONE_SETTINGS : ([] as const)

        return { key, templateKey, semanticRegion: semanticRegions[key as T[number]], labelKey, defaultLabel, settings }
    })

/** Canonical zone labels shared by metahub and application layout authoring. */
export const LAYOUT_ZONE_DEFINITIONS: readonly LayoutZoneDefinition[] = [
    ...createZoneDefinitions(DASHBOARD_LAYOUT_ZONES, 'dashboard', DASHBOARD_LAYOUT_ZONE_SEMANTICS),
    ...createZoneDefinitions(MARKETING_LAYOUT_ZONES, 'marketing-page', MARKETING_LAYOUT_ZONE_SEMANTICS)
]

/** Derived semantic-to-physical view of the canonical zone registry. */
export const LAYOUT_SEMANTIC_ZONE_MAPPINGS: readonly LayoutSemanticZoneMapping[] = LAYOUT_ZONE_DEFINITIONS.map(
    ({ semanticRegion, templateKey, key }) => ({ semanticRegion, templateKey, physicalZone: key })
)

const LAYOUT_WIDGET_DEFINITIONS_BY_KEY = new Map<ApplicationLayoutWidgetKey, LayoutWidgetDefinition>(
    LAYOUT_WIDGET_DEFINITIONS.map((definition) => [definition.key, definition])
)

const resolveRelationBuilderBindingSlots = (
    definition: LayoutWidgetDefinition,
    config: Record<string, unknown>
): readonly WidgetBindingSlotDefinition[] | undefined => {
    if (definition.key !== 'relationBuilder') return undefined

    const panels = Array.isArray(config.panels) ? config.panels : []
    const parentTitleFieldCodename =
        typeof config.parentTitleFieldCodename === 'string' && config.parentTitleFieldCodename.trim()
            ? config.parentTitleFieldCodename.trim()
            : 'Title'
    const parentSlot = definition.bindingSlots?.find(({ key }) => key === 'parent')
    const panelTemplate = definition.bindingSlots?.find(({ key }) => key === 'panel')
    if (!parentSlot || !panelTemplate) return definition.bindingSlots

    const resolvedParent: WidgetBindingSlotDefinition = {
        ...parentSlot,
        requirements: {
            ...parentSlot.requirements,
            components: parentSlot.requirements.components.map((component) =>
                component.field === 'title' ? { ...component, componentCodename: parentTitleFieldCodename } : component
            )
        }
    }

    if (panels.length === 0) return [resolvedParent, panelTemplate]

    const resolvedPanels = panels.flatMap((value): WidgetBindingSlotDefinition[] => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return []
        const panel = value as Record<string, unknown>
        const slotKey = typeof panel.slotKey === 'string' ? panel.slotKey.trim() : ''
        const parentFieldCodename = typeof panel.parentFieldCodename === 'string' ? panel.parentFieldCodename.trim() : ''
        if (!slotKey || !parentFieldCodename) return []
        const sortOrderFieldCodename =
            typeof panel.sortOrderFieldCodename === 'string' && panel.sortOrderFieldCodename.trim()
                ? panel.sortOrderFieldCodename.trim()
                : 'SortOrder'
        const displayFields = Array.isArray(panel.displayFields) ? panel.displayFields : []
        const displayRequirements = displayFields.flatMap((value, index) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return []
            const field = value as Record<string, unknown>
            const fieldCodename = typeof field.fieldCodename === 'string' ? field.fieldCodename.trim() : ''
            const valueType: 'string' | 'number' | 'boolean' | undefined =
                field.valueType === 'string' || field.valueType === 'number' || field.valueType === 'boolean' ? field.valueType : undefined
            if (!fieldCodename || !valueType || typeof field.localized !== 'boolean' || typeof field.required !== 'boolean') return []
            return [
                {
                    field: `display${index + 1}`,
                    componentCodename: fieldCodename,
                    valueType,
                    localized: field.localized,
                    required: field.required
                }
            ]
        })
        return [
            {
                ...panelTemplate,
                key: slotKey,
                requirements: {
                    ...panelTemplate.requirements,
                    components: [
                        ...panelTemplate.requirements.components.map((component) => {
                            if (component.field === 'parent') return { ...component, componentCodename: parentFieldCodename }
                            if (component.field === 'order') return { ...component, componentCodename: sortOrderFieldCodename }
                            return component
                        }),
                        ...displayRequirements
                    ]
                }
            }
        ]
    })

    return [resolvedParent, ...resolvedPanels]
}

const resolveWidgetBindingSlots = (
    definition: LayoutWidgetDefinition,
    rendererConfig?: unknown
): readonly WidgetBindingSlotDefinition[] => {
    const config = rendererConfig && typeof rendererConfig === 'object' && !Array.isArray(rendererConfig) ? rendererConfig : {}
    const relationBuilderSlots = resolveRelationBuilderBindingSlots(definition, config as Record<string, unknown>)
    if (relationBuilderSlots) return relationBuilderSlots
    if (!definition.bindingVariants) return definition.bindingSlots ?? []
    const variant = 'variant' in config && typeof config.variant === 'string' ? config.variant : undefined
    return (variant ? definition.bindingVariants[variant] : definition.bindingSlots) ?? []
}

/** Resolve one widget definition without coercing unknown keys to a fallback. */
export const getLayoutWidgetBindingSlotDefinitions = (key: string, rendererConfig?: unknown): readonly WidgetBindingSlotDefinition[] => {
    const definition = LAYOUT_WIDGET_DEFINITIONS_BY_KEY.get(key as ApplicationLayoutWidgetKey)
    if (!definition) return []
    return resolveWidgetBindingSlots(definition, rendererConfig)
}

export const getLayoutWidgetDefinition = (key: string, rendererConfig?: unknown): LayoutWidgetDefinition | undefined => {
    const definition = LAYOUT_WIDGET_DEFINITIONS_BY_KEY.get(key as ApplicationLayoutWidgetKey)
    if (!definition) return undefined
    const config = rendererConfig && typeof rendererConfig === 'object' && !Array.isArray(rendererConfig) ? rendererConfig : {}
    const variant = 'variant' in config && typeof config.variant === 'string' ? config.variant : undefined
    const variantOverride = variant ? definition.variantOverrides?.[variant] : undefined
    const bindingSlots = resolveWidgetBindingSlots(definition, rendererConfig)
    const configuredPanels = (config as Record<string, unknown>).panels
    const hasDynamicRelationBuilderSlots =
        definition.key === 'relationBuilder' && Array.isArray(configuredPanels) && configuredPanels.length > 0
    return {
        ...definition,
        ...variantOverride,
        bindingSlots: [...bindingSlots],
        ...(hasDynamicRelationBuilderSlots ? { bindingSlotFamilies: undefined } : {})
    }
}

/** Application-owned layouts may only add unbound structural widget primitives. */
export const canAddApplicationLayoutWidget = (
    definition: LayoutWidgetDefinition | undefined,
    sourceKind: 'metahub' | 'application'
): boolean => {
    if (!definition) return false
    if (sourceKind !== 'application') return false

    return (
        definition.sourceClass === 'structural' &&
        definition.sourcePolicy.sourceMode === 'none' &&
        (definition.bindingSlots?.length ?? 0) === 0 &&
        (definition.bindingSlotFamilies?.length ?? 0) === 0 &&
        definition.composition?.container === undefined
    )
}

/** Return the physical zones accepted by a widget for one concrete template. */
export const getLayoutWidgetAllowedZones = (
    key: string,
    templateKey: ApplicationTemplateKey
): readonly ApplicationLayoutZone[] | undefined => getLayoutWidgetDefinition(key)?.allowedZonesByTemplate[templateKey]

/** Resolve a physical zone definition for a concrete template. */
export const getLayoutZoneDefinition = (key: string, templateKey?: ApplicationTemplateKey): LayoutZoneDefinition | undefined =>
    LAYOUT_ZONE_DEFINITIONS.find(
        (definition) => definition.key === key && (templateKey === undefined || definition.templateKey === templateKey)
    )

/** Resolve one serializable setting descriptor for a concrete template zone. */
export const getLayoutZoneSettingDefinition = (
    templateKey: ApplicationTemplateKey,
    zone: string,
    settingKey: string
): LayoutZoneSettingDefinition | undefined =>
    getLayoutZoneDefinition(zone, templateKey)?.settings.find((setting) => setting.key === settingKey)

/** Resolve every declared setting for a concrete template zone. */
export const getLayoutZoneSettingDefinitions = (
    templateKey: ApplicationTemplateKey,
    zone: string
): readonly LayoutZoneSettingDefinition[] => getLayoutZoneDefinition(zone, templateKey)?.settings ?? []
