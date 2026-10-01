import {
    applicationLayoutWidgetKeySchema,
    applicationLayoutZoneSchema,
    applicationTemplateKeySchema,
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    isCompatibleWidgetBindingEntity,
    isEnabledCapabilityConfig,
    marketingCollectionVariantSchema,
    marketingCollectionWidgetConfigSchema,
    normalizeWidgetBindingDataType,
    resolveEntityRecordPolicy,
    validateWidgetBindings,
    type ApplicationTemplateKey,
    type MarketingWidgetKey,
    type WidgetBindingEntityKind,
    type WidgetBindingSelector,
    type WidgetBindingSlotDefinition,
    type WidgetEntityBindingEnvelope
} from '@universo-react/types'
import { z } from 'zod'
import { uuidV7Schema } from '@universo-react/utils'
import { MetahubNotFoundError, MetahubValidationError } from '../shared/domainErrors'
import { validateEntityRecordPolicyData } from '../shared/entityRecordPolicy'
import { MAX_WIDGET_BINDING_OFFSET, type WidgetBindingRequestContext, type WidgetBindingSelectorInput } from './widgetBindingSchemas'
import type { BindingComponentRow, BindingObjectRow, BindingSourceRequirements, BindingWidgetRow } from './widgetBindingsStore'

export const resolvePageInfo = (offset: number, pageSize: number, hasMore: boolean): { nextOffset: number | null; truncated: boolean } => {
    if (!hasMore) return { nextOffset: null, truncated: false }
    const nextOffset = offset + pageSize
    if (nextOffset > MAX_WIDGET_BINDING_OFFSET) return { nextOffset: null, truncated: true }
    return { nextOffset, truncated: false }
}

export interface ResolvedWidgetContext {
    readonly row: BindingWidgetRow
    readonly templateKey: ApplicationTemplateKey
    readonly widgetKey: string
    readonly rendererConfig: Record<string, unknown>
    readonly neutral: ReturnType<typeof decodeWidgetConfigEnvelope>['neutral']
    readonly definition: NonNullable<ReturnType<typeof getLayoutWidgetDefinition>>
}

export interface ValidatedBindingObject {
    readonly object: BindingObjectRow
    readonly components: readonly BindingComponentRow[]
    readonly policy: ReturnType<typeof resolveEntityRecordPolicy>
}

export const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const resolveLocalizedText = (value: unknown, locale: string, fallback: string): string => {
    if (typeof value === 'string' && value.trim()) return value.trim()
    const candidate = asRecord(value)
    const locales = asRecord(candidate.locales)
    const normalizedLocale = locale.replace(/_/gu, '-').toLowerCase()
    const language = normalizedLocale.split('-')[0]
    const ordered = [normalizedLocale, language, typeof candidate._primary === 'string' ? candidate._primary : undefined]
    for (const key of [...new Set([...ordered, ...Object.keys(locales)].filter((entry): entry is string => Boolean(entry)))]) {
        const content = asRecord(locales[key]).content
        if (typeof content === 'string' && content.trim()) return content.trim()
    }
    return fallback
}

const recordLabel = (slot: WidgetBindingSlotDefinition, data: Record<string, unknown>, locale: string, fallback: string): string => {
    const candidates = [
        ...slot.requirements.components.filter((component) => component.localized && !component.semanticKey),
        ...slot.requirements.components.filter((component) => !component.semanticKey && component.valueType === 'string'),
        ...slot.requirements.components.filter((component) => component.semanticKey)
    ]
    for (const component of candidates) {
        const value = data[component.componentCodename]
        if (typeof value === 'string' && value.trim()) return value.trim()
        if (component.localized) {
            const localized = resolveLocalizedText(value, locale, '')
            if (localized) return localized
        }
    }
    return fallback
}

export const normalizeLocale = (locale: string): 'en' | 'ru' => (locale.toLowerCase().startsWith('ru') ? 'ru' : 'en')

const hasRequiredValue = (value: unknown, valueType: string, localized: boolean): boolean => {
    if (value === undefined || value === null) return false
    if (localized) {
        const localizedValue = asRecord(value)
        const locales = asRecord(localizedValue.locales)
        return Object.values(locales).some((entry) => {
            const candidate = asRecord(entry)
            return candidate.isActive !== false && typeof candidate.content === 'string' && candidate.content.trim().length > 0
        })
    }
    if (valueType === 'string') return typeof value === 'string' && value.trim().length > 0
    if (valueType === 'number') return typeof value === 'number' && Number.isFinite(value)
    if (valueType === 'boolean') return typeof value === 'boolean'
    return true
}

export const validateBoundRecord = (
    slot: WidgetBindingSlotDefinition,
    policy: ReturnType<typeof resolveEntityRecordPolicy>,
    components: readonly BindingComponentRow[],
    rawData: unknown
): Record<string, unknown> => {
    const data = asRecord(rawData)
    for (const requirement of slot.requirements.components) {
        const value = data[requirement.componentCodename]
        if (requirement.required && !hasRequiredValue(value, requirement.valueType, requirement.localized)) {
            throw new MetahubValidationError('Selected Entity record is missing registered content')
        }
        if (value !== undefined && value !== null && !hasRequiredValue(value, requirement.valueType, requirement.localized)) {
            throw new MetahubValidationError('Selected Entity record contains invalid registered content')
        }
    }
    if (policy) {
        const result = validateEntityRecordPolicyData(
            policy,
            data,
            components.map((component) => ({
                codename: component.codename,
                dataType: component.data_type,
                isRequired: component.is_required,
                validationRules: asRecord(component.validation_rules)
            }))
        )
        if (!result.valid) throw new MetahubValidationError('Selected Entity record does not satisfy its record policy')
    }
    return data
}

export const validateSourceRequirements = (
    object: BindingObjectRow,
    components: readonly BindingComponentRow[],
    slot: WidgetBindingSlotDefinition
): ReturnType<typeof resolveEntityRecordPolicy> => {
    if (slot.requirements.entityKinds && !slot.requirements.entityKinds.includes(object.kind as WidgetBindingEntityKind)) {
        throw new MetahubValidationError('Source Entity kind does not match this widget binding slot')
    }
    const capabilities = asRecord(object.capabilities)
    if (
        slot.requirements.entityCapabilities.some(
            (key) => !isEnabledCapabilityConfig(capabilities[key] as Parameters<typeof isEnabledCapabilityConfig>[0])
        )
    ) {
        throw new MetahubValidationError('Source Entity does not support the required content capabilities')
    }
    let policy: ReturnType<typeof resolveEntityRecordPolicy>
    try {
        policy = resolveEntityRecordPolicy(object.config)
    } catch {
        throw new MetahubValidationError('Source Entity record policy is invalid')
    }
    if (
        !isCompatibleWidgetBindingEntity(slot, {
            kind: object.kind,
            config: object.config,
            components: components.map((component) => ({
                codename: component.codename,
                dataType: normalizeWidgetBindingDataType(component.data_type) ?? '',
                isRequired: component.is_required,
                validationRules: component.validation_rules
            }))
        })
    ) {
        throw new MetahubValidationError('Source Entity metadata does not match the registered widget binding slot')
    }
    return policy
}

export const isSourceCompatible = (
    object: BindingObjectRow,
    components: readonly BindingComponentRow[],
    slot: WidgetBindingSlotDefinition
): boolean => {
    try {
        validateSourceRequirements(object, components, slot)
        return true
    } catch {
        return false
    }
}

export const bindingRequirements = (slot: WidgetBindingSlotDefinition): BindingSourceRequirements => ({
    entityKinds: slot.requirements.entityKinds,
    entityCapabilities: slot.requirements.entityCapabilities,
    components: slot.requirements.components
})

export const resolveSourceName = (object: BindingObjectRow, locale: string): string =>
    resolveLocalizedText(
        asRecord(object.presentation).name,
        locale,
        locale.toLowerCase().startsWith('ru') ? 'Источник без названия' : 'Unnamed source'
    )

export const semanticKeyRequirement = (slot: WidgetBindingSlotDefinition) => {
    const components = slot.requirements.components.filter((component) => component.semanticKey === true)
    if (components.length !== 1) throw new MetahubValidationError('Binding slot must declare one semantic-key Component')
    return components[0]
}

export const relationReferenceRequirement = (slot: WidgetBindingSlotDefinition) => {
    const relation = slot.relation
    const component = relation
        ? slot.requirements.components.find(({ field, valueType }) => field === relation.field && valueType === 'ref')
        : undefined
    if (!relation || !component) throw new MetahubValidationError('Relation slot must declare its registry reference Component')
    return component
}

export const selectorFor = (slot: WidgetBindingSlotDefinition, input: WidgetBindingSelectorInput): WidgetBindingSelector => {
    if (!slot.selectorKinds.includes(input.kind))
        throw new MetahubValidationError('Selector kind is not allowed by this widget binding slot')
    if (input.kind === 'semantic-key') {
        const key = semanticKeyRequirement(slot)
        return { kind: 'semantic-key', field: key.field, value: input.value }
    }
    if (input.kind === 'relation-set') {
        if (!slot.relation) throw new MetahubValidationError('Binding slot does not declare a relation parent')
        return { kind: 'relation-set', parentSlot: slot.relation.parentSlot }
    }
    return { kind: 'record-set' }
}

export const parseResolvedWidget = (row: BindingWidgetRow): ResolvedWidgetContext => {
    try {
        const templateKey = applicationTemplateKeySchema.parse(row.template_key)
        const widgetKey = applicationLayoutWidgetKeySchema.parse(row.widget_key)
        const zone = applicationLayoutZoneSchema.parse(row.zone)
        const decoded = decodeWidgetConfigEnvelope(row.config, { templateKey, widgetKey, zone })
        const definition = getLayoutWidgetDefinition(widgetKey, decoded.rendererConfig)
        if (
            !definition ||
            !definition.bindingSlots?.length ||
            !definition.supportedTemplates.includes(templateKey) ||
            definition.templateKey !== templateKey
        ) {
            throw new Error('No registered binding contract')
        }
        return {
            row,
            templateKey,
            widgetKey,
            rendererConfig: decoded.rendererConfig,
            neutral: decoded.neutral,
            definition
        }
    } catch {
        throw new MetahubValidationError('Widget binding metadata is not valid for its registered template')
    }
}

export const requireSlot = (widget: ResolvedWidgetContext, slotKey: string): WidgetBindingSlotDefinition => {
    const slot = widget.definition.bindingSlots?.find(({ key }) => key === slotKey)
    if (!slot) throw new MetahubNotFoundError('Widget binding slot')
    return slot
}

export const requireDefinitionSlot = (
    definition: NonNullable<ReturnType<typeof getLayoutWidgetDefinition>>,
    slotKey: string
): WidgetBindingSlotDefinition => {
    const slot = definition.bindingSlots?.find(({ key }) => key === slotKey)
    if (!slot) throw new MetahubNotFoundError('Widget binding slot')
    return slot
}

export const discoveryDefinition = (
    widgetKey: MarketingWidgetKey,
    variant?: z.infer<typeof marketingCollectionVariantSchema>
): NonNullable<ReturnType<typeof getLayoutWidgetDefinition>> => {
    const rendererConfig = widgetKey === 'marketing.collection' ? { variant } : {}
    const definition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
    if (
        !definition ||
        !definition.bindingSlots?.length ||
        definition.templateKey !== 'marketing-page' ||
        !definition.supportedTemplates.includes('marketing-page')
    ) {
        throw new MetahubValidationError('Widget binding metadata is not valid for its registered template')
    }
    return definition
}

export const assertPlacementVariant = (widget: ResolvedWidgetContext, variant?: string): void => {
    if (variant === undefined) return
    if (widget.widgetKey !== 'marketing.collection' || widget.rendererConfig.variant !== variant) {
        throw new MetahubValidationError('Requested widget variant does not match the persisted placement')
    }
}

export const searchableRecordComponentCodenames = (slot: WidgetBindingSlotDefinition): string[] => [
    ...new Set(
        [
            ...slot.requirements.components.filter((component) => component.localized && !component.semanticKey),
            ...slot.requirements.components.filter((component) => !component.semanticKey && component.valueType === 'string'),
            ...slot.requirements.components.filter((component) => component.semanticKey)
        ].map(({ componentCodename }) => componentCodename)
    )
]

export const assertDiscoveryAllowed = (definition: NonNullable<ReturnType<typeof getLayoutWidgetDefinition>>): void => {
    if (definition.authoring?.metahub.canRebind !== true || definition.authoring.metahub.add === 'none') {
        throw new MetahubValidationError('This widget does not allow Metahub binding changes')
    }
}

export const assertRebindAllowed = (widget: ResolvedWidgetContext): void => {
    if (widget.definition.authoring?.metahub.canRebind !== true) {
        throw new MetahubValidationError('This widget does not allow Metahub binding changes')
    }
}

export const projectRecordLabel = (
    slot: WidgetBindingSlotDefinition,
    data: Record<string, unknown>,
    locale: string,
    fallback: string
): string => recordLabel(slot, data, locale, fallback)

export const parseContext = (context: WidgetBindingRequestContext): void => {
    try {
        uuidV7Schema.parse(context.metahubId)
    } catch {
        throw new MetahubValidationError('Metahub identity must be a UUID v7')
    }
    if (!context.executor || typeof context.executor.transaction !== 'function' || context.executor.isReleased()) {
        throw new MetahubValidationError('A request-scoped database executor is required')
    }
}

export const parseWidgetBindingInput = <Schema extends z.ZodTypeAny>(schema: Schema, value: unknown): z.output<Schema> => {
    const result = schema.safeParse(value)
    if (!result.success) throw new MetahubValidationError('Widget binding lookup input is invalid')
    return result.data
}

export const validateRegistryBindings = (definition: ResolvedWidgetContext['definition'], input: unknown): WidgetEntityBindingEnvelope => {
    try {
        return validateWidgetBindings(definition, input)
    } catch {
        throw new MetahubValidationError('Widget bindings do not satisfy the registered slot contract')
    }
}

export const encodeRegistryWidgetConfig = (
    widget: ResolvedWidgetContext,
    bindings: WidgetEntityBindingEnvelope
): Record<string, unknown> => {
    try {
        return encodeWidgetConfigEnvelope(
            {
                rendererConfig: widget.rendererConfig,
                neutral: { ...widget.neutral, bindings }
            },
            {
                templateKey: widget.templateKey,
                widgetKey: widget.widgetKey,
                zone: widget.row.zone,
                rendererConfig: widget.rendererConfig
            }
        )
    } catch {
        throw new MetahubValidationError('Widget bindings could not be encoded for the registered template')
    }
}

export const withValidatedRendererConfig = (widget: ResolvedWidgetContext, rawConfig: Record<string, unknown>): ResolvedWidgetContext => {
    if (widget.widgetKey !== 'marketing.collection') {
        throw new MetahubValidationError('Renderer configuration can only change the collection binding variant')
    }
    const currentResult = marketingCollectionWidgetConfigSchema.safeParse(widget.rendererConfig)
    const nextResult = marketingCollectionWidgetConfigSchema.safeParse(rawConfig)
    if (!currentResult.success || !nextResult.success) {
        throw new MetahubValidationError('Collection renderer configuration is invalid')
    }
    const withoutVariant = (config: Record<string, unknown>) =>
        JSON.stringify(
            Object.fromEntries(
                Object.entries(config)
                    .filter(([key]) => key !== 'variant')
                    .sort(([left], [right]) => left.localeCompare(right))
            )
        )
    if (withoutVariant(currentResult.data) !== withoutVariant(nextResult.data)) {
        throw new MetahubValidationError('Only the collection variant may change while replacing widget bindings')
    }
    const definition = getLayoutWidgetDefinition(widget.widgetKey, nextResult.data)
    if (!definition?.bindingSlots?.length || !definition.supportedTemplates.includes(widget.templateKey)) {
        throw new MetahubValidationError('Collection variant has no registered binding contract')
    }
    return { ...widget, rendererConfig: nextResult.data, definition }
}
