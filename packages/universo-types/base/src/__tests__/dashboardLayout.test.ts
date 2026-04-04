import { describe, expect, it } from 'vitest'

import { dashboardLayoutConfigSchema, defaultDashboardLayoutConfig } from '../common/dashboardLayout'

describe('dashboard layout shared contract', () => {
    it('accepts the runtime-enhanced layout fields', () => {
        const parsed = dashboardLayoutConfigSchema.safeParse({
            showLanguageSwitcher: false,
            showRightSideMenu: false,
            showViewToggle: true,
            defaultViewMode: 'card',
            showFilterBar: true,
            enableRowReordering: true,
            cardColumns: 4,
            rowHeight: 'auto'
        })

        expect(parsed.success).toBe(true)
    })

    it('keeps the shared defaults aligned with runtime expectations', () => {
        expect(defaultDashboardLayoutConfig.showLanguageSwitcher).toBe(true)
        expect(defaultDashboardLayoutConfig.showRightSideMenu).toBe(true)
        expect(defaultDashboardLayoutConfig.showViewToggle).toBe(false)
        expect(defaultDashboardLayoutConfig.defaultViewMode).toBe('table')
        expect(defaultDashboardLayoutConfig.cardColumns).toBe(3)
    })
})