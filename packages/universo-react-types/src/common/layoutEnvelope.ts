import { z } from 'zod'

import { getLayoutWidgetDefinition, getLayoutZoneDefinition, LAYOUT_ZONE_DEFINITIONS } from './layoutWidgetDefinitions'
import { applicationTemplateKeySchema, type ApplicationTemplateKey } from './marketingPage'
import type { ApplicationLayoutZone } from './applicationLayouts'
import { validateWidgetBindings, widgetEntityBindingEnvelopeSchema } from './widgetBindings'

/** The one system-owned namespace inside persisted layout/widget config objects. */
export const RESERVED_LAYOUT_METADATA_KEY = '__layout' as const

export const LAYOUT_POSITIONS = ['fixed', 'flow'] as const
export type LayoutPosition = (typeof LAYOUT_POSITIONS)[number]
export type LayoutZoneSettingValue = string
export const layoutPositionSchema = z.enum(LAYOUT_POSITIONS)

export const LAYOUT_LOGICAL_PLACEMENTS = ['start', 'end'] as const
export type LayoutLogicalPlacement = (typeof LAYOUT_LOGICAL_PLACEMENTS)[number]
export const layoutLogicalPlacementSchema = z.enum(LAYOUT_LOGICAL_PLACEMENTS)
/** Alias used by callers that treat placement as a widget-specific contract. */
export const layoutWidgetPlacementSchema = layoutLogicalPlacementSchema

export const LAYOUT_WIDGET_MOBILE_PROJECTIONS = ['compact-header', 'drawer'] as const
export type LayoutWidgetMobileProjection = (typeof LAYOUT_WIDGET_MOBILE_PROJECTIONS)[number]
export const layoutWidgetMobileProjectionSchema = z.enum(LAYOUT_WIDGET_MOBILE_PROJECTIONS)

const layoutBaseLayoutIdSchema = z
    .string()
    .uuid()
    .refine((value) => value[14]?.toLowerCase() === '7', 'Layout base identifiers must be UUID v7.')

/** Composition metadata stored in the neutral layout namespace. */
export const layoutNeutralCompositionSchema = z.discriminatedUnion('mode', [
    z
        .object({
            mode: z.literal('overlay'),
            baseLayoutId: layoutBaseLayoutIdSchema
        })
        .strict(),
    z
        .object({
            mode: z.literal('independent'),
            baseLayoutId: z.null()
        })
        .strict()
])
export type LayoutNeutralComposition = z.infer<typeof layoutNeutralCompositionSchema>

/** Sparse string values keyed by the descriptors declared for one zone. */
export type LayoutZoneSettingValues = Partial<Record<string, LayoutZoneSettingValue>> & {
    position?: LayoutPosition
}

const layoutZoneSettingKeySchema = z.string().trim().min(1).max(128)
const layoutZoneSettingValueSchema = z.string().trim().min(1).max(128)
export const layoutZoneSettingValuesSchema: z.ZodType<LayoutZoneSettingValues> = z.record(
    layoutZoneSettingKeySchema,
    layoutZoneSettingValueSchema
)

/** Sparse setting values keyed by the physical zone name. */
export type LayoutZoneSettings = Partial<Record<ApplicationLayoutZone, LayoutZoneSettingValues>>

const layoutZoneSettingsRecordSchema = z.record(z.string().trim().min(1).max(128), layoutZoneSettingValuesSchema)

export const layoutZoneSettingsSchema: z.ZodType<LayoutZoneSettings> = layoutZoneSettingsRecordSchema.superRefine((settings, context) => {
    for (const zone of Object.keys(settings)) {
        if (!getLayoutZoneDefinition(zone)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [zone],
                message: 'Layout zone settings must use a registered layout zone.'
            })
        }
    }
})

/** Neutral metadata persisted in a layout config object. */
export const persistedLayoutNeutralMetadataSchema = z
    .object({
        composition: layoutNeutralCompositionSchema.optional(),
        zoneSettings: layoutZoneSettingsSchema.optional(),
        sourceZoneSettings: layoutZoneSettingsSchema.optional()
    })
    .strict()
export type PersistedLayoutNeutralMetadata = z.infer<typeof persistedLayoutNeutralMetadataSchema>
export type LayoutNeutralMetadata = PersistedLayoutNeutralMetadata
export const layoutNeutralMetadataSchema = persistedLayoutNeutralMetadataSchema

/** Neutral metadata persisted in a widget config object. */
export const persistedWidgetNeutralMetadataSchema = z
    .object({
        placement: layoutLogicalPlacementSchema.optional(),
        bindings: widgetEntityBindingEnvelopeSchema.optional()
    })
    .strict()
export type PersistedWidgetNeutralMetadata = z.infer<typeof persistedWidgetNeutralMetadataSchema>
export type WidgetNeutralMetadata = PersistedWidgetNeutralMetadata
export const widgetNeutralMetadataSchema = persistedWidgetNeutralMetadataSchema

const configRecordSchema = z.record(z.string(), z.unknown())

export interface LayoutEnvelopeContext {
    readonly templateKey: ApplicationTemplateKey | string
    /** Application-only baselines are rejected when this is explicitly false. */
    readonly allowSourceZoneSettings?: boolean
}

export interface LayoutWidgetEnvelopeContext {
    readonly templateKey?: ApplicationTemplateKey | string
    readonly widgetKey?: string
    readonly zone?: string
    /** Require all declared slots when validating a complete source-owned widget envelope. */
    readonly requireBindings?: boolean
}

export class MissingRequiredWidgetBindingsError extends Error {
    readonly code = 'LAYOUT_WIDGET_BINDING_REQUIRED'

    constructor(widgetKey: string) {
        super(`Widget is missing required Entity bindings: ${widgetKey}`)
        this.name = 'MissingRequiredWidgetBindingsError'
    }
}

export interface DecodedLayoutConfigEnvelope {
    readonly rendererConfig: Record<string, unknown>
    readonly neutral: PersistedLayoutNeutralMetadata
}

export interface DecodedWidgetConfigEnvelope {
    readonly rendererConfig: Record<string, unknown>
    readonly neutral: PersistedWidgetNeutralMetadata
}

export interface EncodeLayoutConfigEnvelopeInput {
    readonly rendererConfig?: unknown
    readonly neutral?: unknown
}

export interface LayoutEnvelopeEncodingOptions extends Partial<LayoutEnvelopeContext> {
    /** Omit application-only source baselines before publication/snapshot export. */
    readonly omitSourceZoneSettings?: boolean
    /** Omit neutral composition when snapshot-level fields carry it. */
    readonly omitComposition?: boolean
    /** Explicit include-style counterpart of omitComposition. */
    readonly includeComposition?: boolean
    /** Explicit include-style counterpart of omitSourceZoneSettings. */
    readonly includeSourceZoneSettings?: boolean
}

const hasOwn = (value: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key)

const parseTemplateKey = (templateKey: ApplicationTemplateKey | string): ApplicationTemplateKey =>
    applicationTemplateKeySchema.parse(templateKey)

const assertSupportedZoneSettings = (
    settings: LayoutZoneSettings | undefined,
    templateKey: ApplicationTemplateKey,
    metadataKey: 'zoneSettings' | 'sourceZoneSettings'
): void => {
    if (!settings) return

    for (const [zone, values] of Object.entries(settings)) {
        const zoneDefinition = getLayoutZoneDefinition(zone, templateKey)
        if (!zoneDefinition) {
            throw new Error(`Unsupported ${metadataKey} zone for template: ${zone}`)
        }

        for (const [settingKey, settingValue] of Object.entries(values)) {
            const settingDefinition = zoneDefinition.settings.find((setting) => setting.key === settingKey)
            if (!settingDefinition) {
                throw new Error(`Unsupported ${metadataKey} setting for ${templateKey}/${zone}: ${settingKey}`)
            }
            if (settingDefinition.kind !== 'enum' || typeof settingValue !== 'string') {
                throw new Error(`Invalid ${metadataKey} value for ${templateKey}/${zone}/${settingKey}`)
            }
            if (!settingDefinition.options.includes(settingValue)) {
                throw new Error(`Unsupported ${metadataKey} value for ${templateKey}/${zone}/${settingKey}`)
            }
        }
    }
}

const assertSupportedLayoutMetadata = (neutral: PersistedLayoutNeutralMetadata, context?: LayoutEnvelopeContext): void => {
    if (!context) return
    const templateKey = parseTemplateKey(context.templateKey)
    if (context.allowSourceZoneSettings === false && neutral.sourceZoneSettings !== undefined) {
        throw new Error('Application-only sourceZoneSettings cannot be read from this envelope boundary.')
    }
    assertSupportedZoneSettings(neutral.zoneSettings, templateKey, 'zoneSettings')
    assertSupportedZoneSettings(neutral.sourceZoneSettings, templateKey, 'sourceZoneSettings')
}

const assertRendererConfig = (rendererConfig: unknown): Record<string, unknown> => {
    const parsed = configRecordSchema.parse(rendererConfig ?? {})
    if (hasOwn(parsed, RESERVED_LAYOUT_METADATA_KEY) || hasOwn(parsed, 'compositionMode') || hasOwn(parsed, 'baseLayoutId')) {
        throw new Error('Renderer configuration cannot contain reserved layout metadata.')
    }
    return parsed
}

const encodeNeutralMetadata = (
    neutral: PersistedLayoutNeutralMetadata,
    options: LayoutEnvelopeEncodingOptions
): PersistedLayoutNeutralMetadata => {
    const omitSourceZoneSettings = options.omitSourceZoneSettings || options.includeSourceZoneSettings === false
    const omitComposition = options.omitComposition || options.includeComposition === false
    const projected = {
        ...(omitComposition || neutral.composition === undefined ? {} : { composition: neutral.composition }),
        ...(neutral.zoneSettings === undefined ? {} : { zoneSettings: neutral.zoneSettings }),
        ...(omitSourceZoneSettings || neutral.sourceZoneSettings === undefined ? {} : { sourceZoneSettings: neutral.sourceZoneSettings })
    }

    const parsed = persistedLayoutNeutralMetadataSchema.parse(projected)
    if (options.templateKey !== undefined) {
        assertSupportedLayoutMetadata(parsed, {
            templateKey: options.templateKey,
            allowSourceZoneSettings: options.allowSourceZoneSettings ?? options.includeSourceZoneSettings
        })
    }
    return parsed
}

const normalizeZoneSettings = (settings: LayoutZoneSettings | undefined): LayoutZoneSettings | undefined => {
    if (!settings) return undefined
    const zoneOrder = new Map(LAYOUT_ZONE_DEFINITIONS.map((definition, index) => [definition.key, index]))
    const normalized: Record<string, LayoutZoneSettingValues> = {}
    for (const [zone, values] of Object.entries(settings).sort(
        ([left], [right]) =>
            (zoneOrder.get(left as ApplicationLayoutZone) ?? Number.MAX_SAFE_INTEGER) -
            (zoneOrder.get(right as ApplicationLayoutZone) ?? Number.MAX_SAFE_INTEGER)
    )) {
        const settingOrder = new Map((getLayoutZoneDefinition(zone)?.settings ?? []).map((setting, index) => [setting.key, index]))
        normalized[zone] = Object.fromEntries(
            Object.entries(values).sort(
                ([left], [right]) =>
                    (settingOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (settingOrder.get(right) ?? Number.MAX_SAFE_INTEGER)
            )
        ) as LayoutZoneSettingValues
    }
    return normalized
}

const normalizeNeutralMetadata = (neutral: PersistedLayoutNeutralMetadata): PersistedLayoutNeutralMetadata => ({
    ...(neutral.composition === undefined ? {} : { composition: neutral.composition }),
    ...(neutral.zoneSettings === undefined ? {} : { zoneSettings: normalizeZoneSettings(neutral.zoneSettings) }),
    ...(neutral.sourceZoneSettings === undefined ? {} : { sourceZoneSettings: normalizeZoneSettings(neutral.sourceZoneSettings) })
})

/**
 * Decode a persisted layout config into renderer-only config and strict neutral
 * metadata. The renderer never receives the reserved `__layout` object.
 */
export const decodeLayoutConfigEnvelope = (rawConfig: unknown, context: LayoutEnvelopeContext): DecodedLayoutConfigEnvelope => {
    const parsed = configRecordSchema.parse(rawConfig)
    const rendererConfig = { ...parsed }
    const hasNeutralMetadata = hasOwn(rendererConfig, RESERVED_LAYOUT_METADATA_KEY)
    const rawNeutral = rendererConfig[RESERVED_LAYOUT_METADATA_KEY]
    delete rendererConfig[RESERVED_LAYOUT_METADATA_KEY]

    assertRendererConfig(rendererConfig)
    const neutral = persistedLayoutNeutralMetadataSchema.parse(hasNeutralMetadata ? rawNeutral : {})
    assertSupportedLayoutMetadata(neutral, context)

    return { rendererConfig, neutral }
}

/**
 * Encode renderer config and neutral metadata into the existing config carrier.
 * Empty neutral metadata is omitted so the canonical representation remains the
 * same as the pre-envelope renderer config.
 */
export const encodeLayoutConfigEnvelope = (
    input: EncodeLayoutConfigEnvelopeInput,
    options: LayoutEnvelopeEncodingOptions = {}
): Record<string, unknown> => {
    const rendererConfig = assertRendererConfig(input.rendererConfig)
    const neutral = normalizeNeutralMetadata(
        encodeNeutralMetadata(persistedLayoutNeutralMetadataSchema.parse(input.neutral ?? {}), options)
    )

    if (Object.keys(neutral).length === 0) return rendererConfig
    return {
        ...rendererConfig,
        [RESERVED_LAYOUT_METADATA_KEY]: neutral
    }
}

/** Encode a publication/snapshot config while preserving snapshot-level composition fields. */
export const encodeSnapshotLayoutConfigEnvelope = (
    input: EncodeLayoutConfigEnvelopeInput,
    options: Omit<
        LayoutEnvelopeEncodingOptions,
        'omitComposition' | 'omitSourceZoneSettings' | 'includeComposition' | 'includeSourceZoneSettings'
    > = {}
): Record<string, unknown> =>
    encodeLayoutConfigEnvelope(input, {
        ...options,
        omitComposition: true,
        omitSourceZoneSettings: true
    })

/** Alias for serializers that use publication terminology. */
export const encodePublicationLayoutConfigEnvelope = encodeSnapshotLayoutConfigEnvelope

/** Replace only renderer-owned layout config while preserving neutral metadata. */
export const replaceLayoutRendererConfig = (
    rawConfig: unknown,
    rendererConfig: unknown,
    context: LayoutEnvelopeContext,
    options: Omit<LayoutEnvelopeEncodingOptions, 'templateKey'> = {}
): Record<string, unknown> =>
    encodeLayoutConfigEnvelope(
        {
            rendererConfig,
            neutral: decodeLayoutConfigEnvelope(rawConfig, context).neutral
        },
        { ...options, templateKey: context.templateKey }
    )

type CompleteLayoutWidgetEnvelopeContext = {
    readonly templateKey: ApplicationTemplateKey | string
    readonly widgetKey: string
    readonly zone: string
} & Pick<LayoutWidgetEnvelopeContext, 'requireBindings'>

const assertWidgetContext = (
    context: CompleteLayoutWidgetEnvelopeContext
): { templateKey: ApplicationTemplateKey; defaultPlacement?: LayoutLogicalPlacement } => {
    const templateKey = parseTemplateKey(context.templateKey)
    const definition = getLayoutWidgetDefinition(context.widgetKey)
    if (!definition || !definition.supportedTemplates.includes(templateKey)) {
        throw new Error(`Unsupported widget for template: ${templateKey}/${context.widgetKey}`)
    }
    if (!definition.allowedZonesByTemplate[templateKey]?.some((zone) => zone === context.zone)) {
        throw new Error(`Unsupported widget zone for template: ${templateKey}/${context.widgetKey}/${context.zone}`)
    }
    return { templateKey, defaultPlacement: definition.defaultPlacement }
}

const assertSupportedWidgetMetadata = (
    neutral: PersistedWidgetNeutralMetadata,
    context: LayoutWidgetEnvelopeContext | undefined
): PersistedWidgetNeutralMetadata => {
    if (context === undefined) {
        if (neutral.bindings !== undefined) throw new Error('Binding validation context is required.')
        return neutral
    }
    const hasAnyContext = context.templateKey !== undefined || context.widgetKey !== undefined || context.zone !== undefined
    if (!hasAnyContext) {
        if (context.requireBindings === true) throw new Error('Widget placement validation context is incomplete.')
        if (neutral.bindings !== undefined) throw new Error('Binding validation context is required.')
        return neutral
    }
    if (context.templateKey === undefined || context.widgetKey === undefined || context.zone === undefined) {
        throw new Error('Widget placement validation context is incomplete.')
    }
    const { defaultPlacement } = assertWidgetContext(context as CompleteLayoutWidgetEnvelopeContext)
    if (neutral.placement !== undefined && defaultPlacement === undefined) {
        throw new Error(`Widget does not support logical placement: ${context.widgetKey}`)
    }
    const definition = getLayoutWidgetDefinition(context.widgetKey)
    const bindingSlots = definition?.bindingSlots ?? []
    if (neutral.bindings === undefined) {
        if (context.requireBindings === true && bindingSlots.some(({ cardinality }) => cardinality.min > 0)) {
            throw new MissingRequiredWidgetBindingsError(context.widgetKey)
        }
        return neutral
    }
    if (bindingSlots.length === 0) {
        throw new Error(`Widget does not declare Entity binding slots: ${context.widgetKey}`)
    }
    return { ...neutral, bindings: validateWidgetBindings(definition, neutral.bindings) }
}

/** Decode a widget config and validate logical placement against the registry. */
export const decodeWidgetConfigEnvelope = (rawConfig: unknown, context: LayoutWidgetEnvelopeContext = {}): DecodedWidgetConfigEnvelope => {
    const parsed = configRecordSchema.parse(rawConfig)
    const rendererConfig = { ...parsed }
    const hasNeutralMetadata = hasOwn(rendererConfig, RESERVED_LAYOUT_METADATA_KEY)
    const rawNeutral = rendererConfig[RESERVED_LAYOUT_METADATA_KEY]
    delete rendererConfig[RESERVED_LAYOUT_METADATA_KEY]

    assertRendererConfig(rendererConfig)
    const parsedNeutral = persistedWidgetNeutralMetadataSchema.parse(hasNeutralMetadata ? rawNeutral : {})
    const neutral = assertSupportedWidgetMetadata(parsedNeutral, context)

    return { rendererConfig, neutral }
}

/** Alias that makes the layout/widget boundary explicit at call sites. */
export const decodeLayoutWidgetConfigEnvelope = decodeWidgetConfigEnvelope

/** Encode a widget renderer config and its neutral placement metadata. */
export const encodeWidgetConfigEnvelope = (
    input: EncodeLayoutConfigEnvelopeInput,
    context?: LayoutWidgetEnvelopeContext
): Record<string, unknown> => {
    const rendererConfig = assertRendererConfig(input.rendererConfig)
    const parsedNeutral = persistedWidgetNeutralMetadataSchema.parse(input.neutral ?? {})
    const neutral = assertSupportedWidgetMetadata(parsedNeutral, context)

    if (Object.keys(neutral).length === 0) return rendererConfig
    return {
        ...rendererConfig,
        [RESERVED_LAYOUT_METADATA_KEY]: neutral
    }
}

/** Alias that makes the layout/widget boundary explicit at call sites. */
export const encodeLayoutWidgetConfigEnvelope = encodeWidgetConfigEnvelope

/** Replace only renderer-owned widget config while preserving neutral placement. */
export const replaceWidgetRendererConfig = (
    rawConfig: unknown,
    rendererConfig: unknown,
    context: LayoutWidgetEnvelopeContext
): Record<string, unknown> =>
    encodeWidgetConfigEnvelope(
        {
            rendererConfig,
            neutral: decodeWidgetConfigEnvelope(rawConfig, context).neutral
        },
        context
    )

/** Resolve a registered widget's default logical placement for a concrete zone. */
export const getLayoutWidgetDefaultPlacement = (context: CompleteLayoutWidgetEnvelopeContext): LayoutLogicalPlacement | undefined =>
    assertWidgetContext(context).defaultPlacement

/** Return the registry default for a supported setting without exposing a validator. */
export const getLayoutZoneSettingDefault = (
    templateKey: ApplicationTemplateKey | string,
    zone: string,
    settingKey: string
): string | undefined => {
    const definition = getLayoutZoneDefinition(zone, parseTemplateKey(templateKey))
    return definition?.settings.find((setting) => setting.key === settingKey)?.defaultValue
}

/** Resolve a sparse setting override through the registry default. */
export const resolveLayoutZoneSettingValue = (
    templateKey: ApplicationTemplateKey | string,
    zone: string,
    settingKey: string,
    settings?: LayoutZoneSettings
): string | undefined => {
    const definition = getLayoutZoneDefinition(zone, parseTemplateKey(templateKey))?.settings.find((setting) => setting.key === settingKey)
    if (!definition) return undefined
    const overrideValue = settings?.[zone as ApplicationLayoutZone]?.[settingKey]
    if (overrideValue === undefined) return definition.defaultValue
    return definition.options.includes(overrideValue) ? overrideValue : undefined
}

/** Resolve an explicit or registry-default logical placement. */
export const resolveLayoutWidgetPlacement = (
    context: CompleteLayoutWidgetEnvelopeContext,
    placement?: LayoutLogicalPlacement
): LayoutLogicalPlacement => {
    const { defaultPlacement } = assertWidgetContext(context)
    if (defaultPlacement === undefined && placement === undefined) {
        throw new Error(`Widget does not support logical placement: ${context.widgetKey}`)
    }
    return placement ?? defaultPlacement!
}
