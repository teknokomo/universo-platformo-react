import {
    applicationLayoutWidgetKeySchema,
    getLayoutWidgetAllowedZones,
    LAYOUT_WIDGET_DEFINITIONS,
    MARKETING_WIDGET_REGISTRY,
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    parseApplicationLayoutWidgetConfig,
    type ApplicationLayoutWidgetKey,
    type ApplicationLayoutZone,
    type ApplicationTemplateKey
} from '@universo-react/types'
import { generateUuidV7 } from '@universo-react/utils'
import { MetahubDomainError } from '../../shared/domainErrors'
import { findDuplicateActiveSingleInstanceWidgetKey } from '../widgetInvariants'

export const prepareCopiedWidgetConfig = (
    templateKey: ApplicationTemplateKey,
    widgetKey: unknown,
    zone: unknown,
    config: unknown
): Record<string, unknown> => {
    const definition = LAYOUT_WIDGET_DEFINITIONS.find((item) => item.key === widgetKey)
    const allowedZones = definition ? getLayoutWidgetAllowedZones(definition.key, templateKey) : undefined
    if (!definition || !definition.supportedTemplates.includes(templateKey) || !allowedZones?.includes(zone as ApplicationLayoutZone)) {
        throw new MetahubDomainError({
            message: 'Layout widget configuration is invalid',
            statusCode: 409,
            code: 'VALIDATION_ERROR'
        })
    }

    try {
        const decoded = decodeWidgetConfigEnvelope(config ?? {}, {
            templateKey,
            widgetKey: String(widgetKey),
            zone: String(zone),
            requireBindings: true
        })
        const rawConfig = decoded.rendererConfig
        const isMarketingWidget =
            typeof widgetKey === 'string' && Object.prototype.hasOwnProperty.call(MARKETING_WIDGET_REGISTRY, widgetKey)
        const parsed =
            templateKey === 'dashboard'
                ? rawConfig
                : parseApplicationLayoutWidgetConfig(
                      widgetKey as ApplicationLayoutWidgetKey,
                      isMarketingWidget && rawConfig.instanceKey === undefined ? { ...rawConfig, instanceKey: generateUuidV7() } : rawConfig
                  )
        return encodeWidgetConfigEnvelope(
            { rendererConfig: parsed, neutral: decoded.neutral },
            { templateKey, widgetKey: String(widgetKey), zone: String(zone), requireBindings: true }
        )
    } catch {
        throw new MetahubDomainError({
            message: 'Layout widget configuration is invalid',
            statusCode: 409,
            code: 'VALIDATION_ERROR'
        })
    }
}

export const prepareCopiedOverrideConfig = (
    templateKey: ApplicationTemplateKey,
    widgetKey: unknown,
    zone: unknown,
    config: unknown
): Record<string, unknown> | null => {
    if (config === null || config === undefined) return null
    const parsedWidgetKey = applicationLayoutWidgetKeySchema.parse(widgetKey)
    const parsedZone = String(zone)
    const isMarketingOverlay = templateKey === 'marketing-page'
    const decoded = decodeWidgetConfigEnvelope(config, {
        templateKey,
        widgetKey: parsedWidgetKey,
        zone: parsedZone,
        requireBindings: !isMarketingOverlay
    })
    if (isMarketingOverlay && decoded.neutral.bindings !== undefined) {
        throw new MetahubDomainError({
            message: 'Marketing overlay widget overrides cannot contain Entity bindings',
            statusCode: 409,
            code: 'VALIDATION_ERROR'
        })
    }
    const rendererConfig =
        templateKey === 'dashboard' ? decoded.rendererConfig : parseApplicationLayoutWidgetConfig(parsedWidgetKey, decoded.rendererConfig)
    return encodeWidgetConfigEnvelope(
        { rendererConfig, neutral: decoded.neutral },
        { templateKey, widgetKey: parsedWidgetKey, zone: parsedZone, requireBindings: !isMarketingOverlay }
    )
}

export const assertNoDuplicateActiveSingleInstanceWidgets = (
    rows: readonly { widgetKey?: unknown; widget_key?: unknown; isActive?: unknown; is_active?: unknown }[]
): void => {
    if (findDuplicateActiveSingleInstanceWidgetKey(rows) !== null) {
        throw new MetahubDomainError({
            message: 'Active single-instance layout widgets must be unique within a layout',
            statusCode: 409,
            code: 'VALIDATION_ERROR',
            details: { operation: 'copy-layout' }
        })
    }
}
