import { describe, expect, it } from 'vitest'
import type { ZoneWidgetItem, ZoneWidgets } from '../../contracts'
import { withoutWorkspaceDashboardContent } from '../workspaceDashboardLayout'

const placement = (widgetKey: string, zone: ZoneWidgetItem['zone'], sortOrder = 0): ZoneWidgetItem => ({
    instanceKey: `${widgetKey}-${zone}-${sortOrder}`,
    widgetKey,
    zone,
    sortOrder,
    config: {},
    isActive: true,
    parentInstanceKey: null,
    slotKey: null
})

describe('withoutWorkspaceDashboardContent', () => {
    it('preserves host shell placements and removes content and footer widgets from every zone', () => {
        const zoneWidgets: ZoneWidgets = {
            left: [placement('workspaceSwitcher', 'left'), placement('menuWidget', 'left'), placement('infoCard', 'left')],
            top: [
                placement('appNavbar', 'top'),
                placement('header', 'top'),
                placement('languageSwitcher', 'top'),
                placement('colorModeSwitcher', 'top')
            ],
            right: [placement('infoCard', 'right')],
            center: [placement('detailsTable', 'center')],
            bottom: [placement('footer', 'bottom')]
        }

        expect(withoutWorkspaceDashboardContent(zoneWidgets)).toEqual({
            left: zoneWidgets.left.slice(0, 2),
            top: zoneWidgets.top,
            right: [],
            center: [],
            bottom: []
        })
    })

    it('returns undefined when the Dashboard has no placements', () => {
        expect(withoutWorkspaceDashboardContent(undefined)).toBeUndefined()
    })
})
