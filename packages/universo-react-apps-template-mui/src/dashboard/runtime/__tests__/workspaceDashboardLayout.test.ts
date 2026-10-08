import { describe, expect, it } from 'vitest'
import type { ZoneWidgetItem, ZoneWidgets } from '../../contracts'
import { withoutWorkspaceDashboardContent } from '../workspaceDashboardLayout'

const placement = (id: string, widgetKey: string, zone: ZoneWidgetItem['zone'], sortOrder = 0): ZoneWidgetItem => ({
    id,
    instanceKey: `${widgetKey}-${sortOrder}`,
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
            left: [
                placement('0190a9b5-3cde-7abc-8def-0123456789a1', 'workspaceSwitcher', 'left'),
                placement('0190a9b5-3cde-7abc-8def-0123456789a2', 'menuWidget', 'left'),
                placement('0190a9b5-3cde-7abc-8def-0123456789a3', 'infoCard', 'left')
            ],
            top: [
                placement('0190a9b5-3cde-7abc-8def-0123456789a9', 'appNavbar', 'top'),
                placement('0190a9b5-3cde-7abc-8def-0123456789a4', 'header', 'top'),
                placement('0190a9b5-3cde-7abc-8def-0123456789a5', 'languageSwitcher', 'top'),
                placement('0190a9b5-3cde-7abc-8def-0123456789aa', 'colorModeSwitcher', 'top')
            ],
            right: [placement('0190a9b5-3cde-7abc-8def-0123456789a6', 'infoCard', 'right')],
            center: [placement('0190a9b5-3cde-7abc-8def-0123456789a7', 'detailsTable', 'center')],
            bottom: [placement('0190a9b5-3cde-7abc-8def-0123456789a8', 'footer', 'bottom')]
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
