import {
    applicationLayoutWidgetKeySchema,
    getLayoutWidgetAllowedZones,
    LAYOUT_WIDGET_DEFINITIONS,
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    parseApplicationLayoutWidgetConfig,
    type ApplicationLayoutWidgetKey,
    type ApplicationLayoutZone,
    type ApplicationTemplateKey
} from '@universo-react/types'
import { MetahubDomainError } from '../../shared/domainErrors'
import { findDuplicateActiveSingleInstanceWidgetKey } from '../widgetInvariants'
import { assertNoWidgetSharedBehaviorConfig, requireLayoutWidgetOwnership } from '../widgetOwnership'

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
        if (Object.prototype.hasOwnProperty.call(decoded.rendererConfig, 'instanceKey')) {
            throw new Error('Widget placement identity must not be stored in renderer config')
        }
        assertNoWidgetSharedBehaviorConfig(decoded.rendererConfig)
        const parsed = parseApplicationLayoutWidgetConfig(widgetKey as ApplicationLayoutWidgetKey, decoded.rendererConfig)
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
    const definition = requireLayoutWidgetOwnership(templateKey, parsedWidgetKey)
    const inheritsSourceBindings = definition.sourcePolicy.inheritBindings
    const decoded = decodeWidgetConfigEnvelope(config, {
        templateKey,
        widgetKey: parsedWidgetKey,
        zone: parsedZone,
        requireBindings: !inheritsSourceBindings
    })
    if (inheritsSourceBindings && decoded.neutral.bindings !== undefined) {
        throw new MetahubDomainError({
            message: 'Source-managed widget overrides cannot contain Entity bindings',
            statusCode: 409,
            code: 'VALIDATION_ERROR'
        })
    }
    if (Object.prototype.hasOwnProperty.call(decoded.rendererConfig, 'instanceKey')) {
        throw new MetahubDomainError({
            message: 'Widget placement identity must not be stored in renderer config',
            statusCode: 409,
            code: 'VALIDATION_ERROR'
        })
    }
    assertNoWidgetSharedBehaviorConfig(decoded.rendererConfig)
    const rendererConfig = parseApplicationLayoutWidgetConfig(parsedWidgetKey, decoded.rendererConfig)
    return encodeWidgetConfigEnvelope(
        { rendererConfig, neutral: decoded.neutral },
        { templateKey, widgetKey: parsedWidgetKey, zone: parsedZone, requireBindings: !inheritsSourceBindings }
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
