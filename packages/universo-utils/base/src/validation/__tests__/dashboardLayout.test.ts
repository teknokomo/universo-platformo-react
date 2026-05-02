import { describe, expect, it } from 'vitest'

import { normalizeDashboardLayoutConfig } from '../dashboardLayout'

describe('dashboard layout normalization', () => {
    it('fills the shared defaults for omitted fields', () => {
        const config = normalizeDashboardLayoutConfig(undefined)

        expect(config.showLanguageSwitcher).toBe(true)
        expect(config.showRightSideMenu).toBe(false)
        expect(config.showViewToggle).toBe(false)
        expect(config.defaultViewMode).toBe('table')
        expect(config.cardColumns).toBe(3)
    })

    it('preserves valid values while dropping invalid enhanced settings', () => {
        const config = normalizeDashboardLayoutConfig({
            showHeader: false,
            showLanguageSwitcher: false,
            showViewToggle: true,
            defaultViewMode: 'card',
            showFilterBar: true,
            enableRowReordering: true,
            cardColumns: 99,
            rowHeight: 12
        })

        expect(config.showHeader).toBe(false)
        expect(config.showLanguageSwitcher).toBe(false)
        expect(config.showViewToggle).toBe(true)
        expect(config.defaultViewMode).toBe('card')
        expect(config.showFilterBar).toBe(true)
        expect(config.enableRowReordering).toBe(true)
        expect(config.cardColumns).toBe(3)
        expect(config.rowHeight).toBeUndefined()
    })
})
