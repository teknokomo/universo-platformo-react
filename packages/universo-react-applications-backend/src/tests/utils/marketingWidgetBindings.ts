import {
    encodeLayoutWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    validateWidgetBindings,
    type WidgetEntityBindingEnvelope
} from '@universo-react/types'

export const createMarketingCollectionConfig = (sourceCodename = 'CustomLandingFeature'): Record<string, unknown> => {
    const widgetKey = 'marketing.collection'
    const rendererConfig = { variant: 'features' }
    const definition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
    if (!definition?.bindingSlots?.length) throw new Error('Marketing collection binding definition is missing')

    const bindings: WidgetEntityBindingEnvelope = validateWidgetBindings(definition, {
        version: 1,
        slots: definition.bindingSlots.map((slot) => {
            const selectorKind = slot.selectorKinds[0]
            const selector =
                selectorKind === 'semantic-key'
                    ? {
                          kind: selectorKind,
                          field: slot.requirements.components.find((component) => component.semanticKey)?.field ?? '',
                          value: 'features'
                      }
                    : selectorKind === 'relation-set'
                    ? { kind: selectorKind, parentSlot: slot.relation?.parentSlot ?? '' }
                    : { kind: 'record-set' as const }

            return {
                slot: slot.key,
                targets: [
                    {
                        entityKind: 'object' as const,
                        entityCodename: slot.key === 'items' ? sourceCodename : 'MarketingPageFeature',
                        selector,
                        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }
                ]
            }
        })
    })

    return encodeLayoutWidgetConfigEnvelope(
        { rendererConfig, neutral: { bindings } },
        { templateKey: 'marketing-page', widgetKey, zone: 'marketing-main', rendererConfig, requireBindings: true }
    )
}

export const createMarketingPricingConfig = (
    sources: {
        section?: string
        tiers?: string
        benefits?: string
    } = {}
): Record<string, unknown> => {
    const widgetKey = 'marketing.pricing'
    const rendererConfig = { maxItems: 24, showBenefits: true }
    const definition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
    if (!definition?.bindingSlots?.length) throw new Error('Marketing pricing binding definition is missing')

    const bindings: WidgetEntityBindingEnvelope = validateWidgetBindings(definition, {
        version: 1,
        slots: definition.bindingSlots.map((slot) => {
            const selectorKind = slot.selectorKinds[0]
            const selector =
                selectorKind === 'semantic-key'
                    ? {
                          kind: selectorKind,
                          field: slot.requirements.components.find((component) => component.semanticKey)?.field ?? '',
                          value: 'pricing'
                      }
                    : selectorKind === 'relation-set'
                    ? { kind: selectorKind, parentSlot: slot.relation?.parentSlot ?? '' }
                    : { kind: 'record-set' as const }

            return {
                slot: slot.key,
                targets: [
                    {
                        entityKind: 'object' as const,
                        entityCodename: sources[slot.key as keyof typeof sources] ?? `MarketingPricing${slot.key}`,
                        selector,
                        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }
                ]
            }
        })
    })

    return encodeLayoutWidgetConfigEnvelope(
        { rendererConfig, neutral: { bindings } },
        { templateKey: 'marketing-page', widgetKey, zone: 'marketing-main', rendererConfig, requireBindings: true }
    )
}
