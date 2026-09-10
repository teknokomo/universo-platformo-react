import { LAYOUT_WIDGET_DEFINITIONS } from '@universo-react/types'

type LayoutWidgetInvariantRow = {
    widgetKey?: unknown
    widget_key?: unknown
    isActive?: unknown
    is_active?: unknown
}

const getWidgetKey = (row: LayoutWidgetInvariantRow): string | null => {
    const value = row.widgetKey ?? row.widget_key
    return typeof value === 'string' && value.length > 0 ? value : null
}

const isActive = (row: LayoutWidgetInvariantRow): boolean => {
    const value = row.isActive ?? row.is_active
    return value !== false
}

/**
 * Return the first active single-instance widget key that occurs more than
 * once. Repeatable widgets, including menu and marketing widgets, are not
 * rejected here.
 */
export const findDuplicateActiveSingleInstanceWidgetKey = (rows: readonly LayoutWidgetInvariantRow[]): string | null => {
    const seen = new Set<string>()

    for (const row of rows) {
        if (!isActive(row)) continue
        const widgetKey = getWidgetKey(row)
        if (!widgetKey) continue

        const definition = LAYOUT_WIDGET_DEFINITIONS.find((item) => item.key === widgetKey)
        if (!definition?.multiInstance) {
            if (seen.has(widgetKey)) return widgetKey
            seen.add(widgetKey)
        }
    }

    return null
}
