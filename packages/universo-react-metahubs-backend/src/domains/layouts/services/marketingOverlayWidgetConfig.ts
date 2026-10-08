import {
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    parseApplicationLayoutWidgetConfig,
    type ApplicationLayoutWidgetKey,
    type ApplicationLayoutZone,
    type ApplicationTemplateKey
} from '@universo-react/types'
import { MetahubValidationError } from '../../shared/domainErrors'
import { requireLayoutWidgetOwnership } from '../widgetOwnership'

type WidgetConfigParser = (
    templateKey: ApplicationTemplateKey,
    widgetKey: ApplicationLayoutWidgetKey,
    config: unknown
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
    templateKey: ApplicationTemplateKey,
    widgetKey: ApplicationLayoutWidgetKey,
    zone: ApplicationLayoutZone,
    baseConfig: Record<string, unknown>,
    overrideConfig: Record<string, unknown>,
    dependencies: MarketingOverlayWidgetConfigDependencies
): Record<string, unknown> => {
    const ownership = requireLayoutWidgetOwnership(templateKey, widgetKey, baseConfig)
    const inheritsSourceBindings = ownership.sourcePolicy.inheritBindings
    const baseZone = dependencies.resolveWidgetZone(templateKey, widgetKey, baseConfig)
    const baseEnvelope = decodeWidgetConfigEnvelope(baseConfig, {
        templateKey,
        widgetKey,
        zone: baseZone,
        requireBindings: ownership.sourcePolicy.sourceMode === 'required'
    })

    let overrideEnvelope: ReturnType<typeof decodeWidgetConfigEnvelope>
    try {
        overrideEnvelope = decodeWidgetConfigEnvelope(overrideConfig, {
            templateKey,
            widgetKey,
            zone,
            requireBindings: !inheritsSourceBindings && ownership.sourcePolicy.sourceMode === 'required'
        })
    } catch (error) {
        throw new MetahubValidationError('Layout widget override configuration is invalid', {
            widgetKey,
            reason: error instanceof Error ? error.message : 'Invalid reserved metadata'
        })
    }
    if (inheritsSourceBindings && overrideEnvelope.neutral.bindings !== undefined) {
        throw new MetahubValidationError('Source-managed widget overrides cannot contain Entity bindings', { widgetKey })
    }

    const rendererConfig = parseApplicationLayoutWidgetConfig(widgetKey, overrideEnvelope.rendererConfig)
    const neutral = { ...overrideEnvelope.neutral }
    if (inheritsSourceBindings) {
        if (baseEnvelope.neutral.bindings === undefined) delete neutral.bindings
        else neutral.bindings = baseEnvelope.neutral.bindings
    }

    return dependencies.parseWidgetConfig(
        templateKey,
        widgetKey,
        encodeWidgetConfigEnvelope(
            { rendererConfig, neutral },
            {
                templateKey,
                widgetKey,
                zone,
                requireBindings: !inheritsSourceBindings && ownership.sourcePolicy.sourceMode === 'required'
            }
        )
    )
}

export const encodeMarketingOverlayWidgetOverrideConfig = (
    templateKey: ApplicationTemplateKey,
    widgetKey: ApplicationLayoutWidgetKey,
    zone: ApplicationLayoutZone,
    baseConfig: Record<string, unknown>,
    overrideConfig: Record<string, unknown>,
    dependencies: MarketingOverlayWidgetConfigDependencies
): Record<string, unknown> => {
    const ownership = requireLayoutWidgetOwnership(templateKey, widgetKey, baseConfig)
    const resolvedConfig = resolveMarketingOverlayWidgetConfig(templateKey, widgetKey, zone, baseConfig, overrideConfig, dependencies)
    const decoded = decodeWidgetConfigEnvelope(resolvedConfig, {
        templateKey,
        widgetKey,
        zone,
        requireBindings: ownership.sourcePolicy.sourceMode === 'required'
    })
    const neutral = { ...decoded.neutral }
    if (ownership.sourcePolicy.inheritBindings) delete neutral.bindings
    return encodeWidgetConfigEnvelope(
        { rendererConfig: decoded.rendererConfig, neutral },
        {
            templateKey,
            widgetKey,
            zone,
            requireBindings: !ownership.sourcePolicy.inheritBindings && ownership.sourcePolicy.sourceMode === 'required'
        }
    )
}
