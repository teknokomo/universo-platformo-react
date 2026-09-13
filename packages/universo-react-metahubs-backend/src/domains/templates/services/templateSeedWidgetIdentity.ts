import { getLayoutWidgetDefinition } from '@universo-react/types'

export type MarketingSeedWidgetLookup = { kind: 'instanceKey'; value: string } | { kind: 'widgetKey'; value: string }

/**
 * Resolve the stable identity used when an incremental seed checks whether a
 * marketing widget already exists. Shared single-instance widgets intentionally
 * do not need renderer-owned instance keys.
 */
export const resolveMarketingSeedWidgetLookup = (widgetKey: string, rendererConfig: Record<string, unknown>): MarketingSeedWidgetLookup => {
    const instanceKey = rendererConfig.instanceKey
    if (typeof instanceKey === 'string' && instanceKey.trim().length > 0) {
        return { kind: 'instanceKey', value: instanceKey }
    }

    const definition = getLayoutWidgetDefinition(widgetKey)
    if (definition?.shared === true && definition.multiInstance === false) {
        return { kind: 'widgetKey', value: widgetKey }
    }

    throw new Error(`Marketing widget ${widgetKey} must define a non-empty instanceKey.`)
}
