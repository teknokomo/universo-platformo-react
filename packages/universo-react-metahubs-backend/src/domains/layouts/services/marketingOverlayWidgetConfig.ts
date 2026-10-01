import {
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    parseApplicationLayoutWidgetConfig,
    type ApplicationLayoutWidgetKey,
    type ApplicationLayoutZone,
    type ApplicationTemplateKey
} from '@universo-react/types'
import { MetahubValidationError } from '../../shared/domainErrors'

type WidgetConfigParser = (
    templateKey: ApplicationTemplateKey,
    widgetKey: ApplicationLayoutWidgetKey,
    config: unknown,
    options?: { expectedInstanceKey?: string }
) => Record<string, unknown>

type WidgetZoneResolver = (
    templateKey: ApplicationTemplateKey,
    widgetKey: ApplicationLayoutWidgetKey,
    config: unknown
) => ApplicationLayoutZone

export interface MarketingOverlayWidgetConfigDependencies {
    parseWidgetConfig: WidgetConfigParser
    resolveWidgetZone: WidgetZoneResolver
}

export const resolveMarketingOverlayWidgetConfig = (
    widgetKey: ApplicationLayoutWidgetKey,
    zone: ApplicationLayoutZone,
    baseConfig: Record<string, unknown>,
    overrideConfig: Record<string, unknown>,
    expectedInstanceKey: string | undefined,
    dependencies: MarketingOverlayWidgetConfigDependencies
): Record<string, unknown> => {
    const templateKey = 'marketing-page'
    const baseZone = dependencies.resolveWidgetZone(templateKey, widgetKey, baseConfig)
    const baseEnvelope = decodeWidgetConfigEnvelope(baseConfig, {
        templateKey,
        widgetKey,
        zone: baseZone,
        requireBindings: true
    })

    let overrideEnvelope: ReturnType<typeof decodeWidgetConfigEnvelope>
    try {
        overrideEnvelope = decodeWidgetConfigEnvelope(overrideConfig, {
            templateKey,
            widgetKey,
            zone,
            requireBindings: false
        })
    } catch (error) {
        throw new MetahubValidationError('Marketing widget override configuration is invalid', {
            widgetKey,
            reason: error instanceof Error ? error.message : 'Invalid reserved metadata'
        })
    }

    const rendererConfig = parseApplicationLayoutWidgetConfig(widgetKey, overrideEnvelope.rendererConfig)
    const neutral = { ...overrideEnvelope.neutral }
    if (baseEnvelope.neutral.bindings === undefined) delete neutral.bindings
    else neutral.bindings = baseEnvelope.neutral.bindings

    return dependencies.parseWidgetConfig(
        templateKey,
        widgetKey,
        encodeWidgetConfigEnvelope({ rendererConfig, neutral }, { templateKey, widgetKey, zone, requireBindings: true }),
        { expectedInstanceKey }
    )
}

export const encodeMarketingOverlayWidgetOverrideConfig = (
    widgetKey: ApplicationLayoutWidgetKey,
    zone: ApplicationLayoutZone,
    baseConfig: Record<string, unknown>,
    overrideConfig: Record<string, unknown>,
    expectedInstanceKey: string | undefined,
    dependencies: MarketingOverlayWidgetConfigDependencies
): Record<string, unknown> => {
    const resolvedConfig = resolveMarketingOverlayWidgetConfig(
        widgetKey,
        zone,
        baseConfig,
        overrideConfig,
        expectedInstanceKey,
        dependencies
    )
    const decoded = decodeWidgetConfigEnvelope(resolvedConfig, {
        templateKey: 'marketing-page',
        widgetKey,
        zone,
        requireBindings: true
    })
    const neutral = { ...decoded.neutral }
    delete neutral.bindings
    return encodeWidgetConfigEnvelope(
        { rendererConfig: decoded.rendererConfig, neutral },
        { templateKey: 'marketing-page', widgetKey, zone, requireBindings: false }
    )
}

export const assertMarketingOverlayBindingOwnership = (
    scope: { scope_entity_id?: unknown; base_layout_id?: unknown } | null | undefined,
    templateKey: ApplicationTemplateKey,
    hasBindingSlots: boolean
): void => {
    const isScopedEntityLayout = typeof scope?.scope_entity_id === 'string' && typeof scope.base_layout_id === 'string'
    if (templateKey === 'marketing-page' && isScopedEntityLayout && hasBindingSlots) {
        throw new MetahubValidationError('Marketing overlay layouts must inherit Entity bindings from their base placements')
    }
}
