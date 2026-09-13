import { z } from 'zod'

import type { ApplicationLayoutWidgetKey, ApplicationLayoutZone } from './applicationLayouts'
import type { LayoutLogicalPlacement, LayoutWidgetMobileProjection } from './layoutEnvelope'
import {
    MARKETING_LAYOUT_ZONES,
    MARKETING_LAYOUT_ZONE_SEMANTICS,
    MARKETING_WIDGET_REGISTRY,
    APPLICATION_TEMPLATE_KEYS,
    applicationTemplateKeySchema
} from './marketingPage'
import type { ApplicationTemplateKey } from './marketingPage'
import { DASHBOARD_LAYOUT_WIDGETS, DASHBOARD_LAYOUT_ZONES, DASHBOARD_LAYOUT_ZONE_SEMANTICS } from './metahubs'
import {
    applicationTemplateHostCapabilitySchema,
    layoutSemanticRegionSchema,
    type ApplicationTemplateHostCapability,
    type LayoutSemanticRegion
} from './applicationTemplates'

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

export interface LayoutWidgetDefinition {
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
}

const layoutWidgetKeySchema = z.string().trim().min(1).max(128)
const layoutZoneKeySchema = z.enum([...DASHBOARD_LAYOUT_ZONES, ...MARKETING_LAYOUT_ZONES] as [string, ...string[]])

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
        mobileProjection: z.enum(['compact-header', 'drawer']).optional()
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

const DASHBOARD_WIDGET_DEFINITIONS: readonly LayoutWidgetDefinition[] = DASHBOARD_LAYOUT_WIDGETS.map((widget) => {
    const isShared = widget.key === 'languageSwitcher' || widget.key === 'colorModeSwitcher'
    const supportedTemplates: readonly ApplicationTemplateKey[] = isShared ? [...APPLICATION_TEMPLATE_KEYS] : ['dashboard']
    const requiredHostCapabilities: readonly ApplicationTemplateHostCapability[] =
        'requiredHostCapabilities' in widget ? widget.requiredHostCapabilities : []

    return {
        key: widget.key,
        allowedZones: widget.allowedZones,
        allowedZonesByTemplate: isShared
            ? { dashboard: widget.allowedZones, 'marketing-page': ['marketing-header'] }
            : { dashboard: widget.allowedZones },
        multiInstance: widget.multiInstance,
        templateKey: 'dashboard',
        supportedTemplates,
        requiredHostCapabilities,
        shared: isShared,
        labelKey: `layouts.widgets.${widget.key}`,
        defaultLabel: toDefaultLabel(widget.key),
        ...(isShared ? { defaultPlacement: 'end' as const, mobileProjection: 'compact-header' as const } : {})
    }
})

const MARKETING_WIDGET_DEFINITIONS: readonly LayoutWidgetDefinition[] = Object.values(MARKETING_WIDGET_REGISTRY).map((widget) => ({
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
    ...(widget.defaultPlacement ? { defaultPlacement: widget.defaultPlacement } : {}),
    ...(widget.mobileProjection ? { mobileProjection: widget.mobileProjection } : {})
}))

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

/** Resolve one widget definition without coercing unknown keys to a fallback. */
export const getLayoutWidgetDefinition = (key: string): LayoutWidgetDefinition | undefined =>
    LAYOUT_WIDGET_DEFINITIONS_BY_KEY.get(key as ApplicationLayoutWidgetKey)

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
