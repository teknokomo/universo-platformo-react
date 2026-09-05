import type { ApplicationLayoutWidgetKey, ApplicationLayoutZone } from './applicationLayouts'
import { MARKETING_LAYOUT_ZONES, MARKETING_WIDGET_REGISTRY } from './marketingPage'
import type { ApplicationTemplateKey } from './marketingPage'
import { DASHBOARD_LAYOUT_WIDGETS, DASHBOARD_LAYOUT_ZONES } from './metahubs'

export interface LayoutZoneDefinition {
    readonly key: ApplicationLayoutZone
    readonly templateKey: ApplicationTemplateKey
    readonly labelKey: string
    readonly defaultLabel: string
}

export interface LayoutWidgetDefinition {
    readonly key: ApplicationLayoutWidgetKey
    readonly allowedZones: readonly ApplicationLayoutZone[]
    readonly multiInstance: boolean
    readonly templateKey: ApplicationTemplateKey
    readonly labelKey: string
    readonly defaultLabel: string
}

const toDefaultLabel = (key: string): string => {
    const segment = key.split('.').at(-1) ?? key
    const spaced = segment.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ')
    return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1)

const DASHBOARD_WIDGET_DEFINITIONS: readonly LayoutWidgetDefinition[] = DASHBOARD_LAYOUT_WIDGETS.map((widget) => ({
    key: widget.key,
    allowedZones: widget.allowedZones,
    multiInstance: widget.multiInstance,
    templateKey: 'dashboard',
    labelKey: `layouts.widgets.${widget.key}`,
    defaultLabel: toDefaultLabel(widget.key)
}))

const MARKETING_WIDGET_DEFINITIONS: readonly LayoutWidgetDefinition[] = Object.values(MARKETING_WIDGET_REGISTRY).map((widget) => ({
    key: widget.key,
    allowedZones: widget.allowedZones,
    multiInstance: widget.repeatable,
    templateKey: 'marketing-page',
    labelKey: `layouts.widgets.${widget.key}`,
    defaultLabel: toDefaultLabel(widget.key)
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
    templateKey: ApplicationTemplateKey
): readonly LayoutZoneDefinition[] =>
    zones.map((key) => {
        const marketingZone = key.replace(/^marketing-/, '')
        const labelKey = templateKey === 'marketing-page' ? `layouts.zones.marketing${capitalize(marketingZone)}` : `layouts.zones.${key}`
        const defaultLabel =
            templateKey === 'marketing-page'
                ? `Marketing ${marketingZone === 'main' ? 'content' : marketingZone}`
                : capitalize(marketingZone)

        return { key, templateKey, labelKey, defaultLabel }
    })

/** Canonical zone labels shared by metahub and application layout authoring. */
export const LAYOUT_ZONE_DEFINITIONS: readonly LayoutZoneDefinition[] = [
    ...createZoneDefinitions(DASHBOARD_LAYOUT_ZONES, 'dashboard'),
    ...createZoneDefinitions(MARKETING_LAYOUT_ZONES, 'marketing-page')
]
