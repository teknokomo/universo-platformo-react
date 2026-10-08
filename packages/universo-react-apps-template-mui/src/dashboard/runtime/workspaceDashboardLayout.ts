import { getDashboardWidgetDefinition } from '@universo-react/types'
import type { ZoneWidgetItem, ZoneWidgets } from '../contracts'

const isDashboardHostPlacement = (placement: ZoneWidgetItem): boolean =>
    getDashboardWidgetDefinition(placement.widgetKey)?.capabilities.includes('dashboard.host') === true

const filterHostPlacements = (placements: ZoneWidgetItem[] | undefined): ZoneWidgetItem[] | undefined =>
    placements?.filter(isDashboardHostPlacement)

/** Keep the Dashboard shell on Workspace routes while hiding data and footer content. */
export const withoutWorkspaceDashboardContent = (zoneWidgets: ZoneWidgets | undefined): ZoneWidgets | undefined => {
    if (!zoneWidgets) return undefined

    return {
        left: filterHostPlacements(zoneWidgets.left) ?? [],
        ...(zoneWidgets.top === undefined ? {} : { top: filterHostPlacements(zoneWidgets.top) ?? [] }),
        ...(zoneWidgets.right === undefined ? {} : { right: filterHostPlacements(zoneWidgets.right) ?? [] }),
        center: [],
        bottom: []
    }
}
