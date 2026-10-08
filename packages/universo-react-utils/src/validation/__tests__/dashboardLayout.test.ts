import { describe, expect, it } from 'vitest'

import { normalizeDashboardLayoutConfig } from '../dashboardLayout'

describe('dashboard layout normalization', () => {
    it('fills the strict shared shell defaults for omitted fields', () => {
        const config = normalizeDashboardLayoutConfig(undefined)

        expect(config).toEqual({
            sideMenu: {
                availableModes: ['wide', 'compact', 'overlay'],
                primaryMode: 'wide',
                rememberUserChoice: true
            }
        })
    })

    it('rejects retired composition and renderer keys instead of normalizing them', () => {
        expect(() => normalizeDashboardLayoutConfig({ showOverviewCards: false })).toThrow()
        expect(() => normalizeDashboardLayoutConfig({ showHeader: false })).toThrow()
        expect(() => normalizeDashboardLayoutConfig({ rowHeight: 48 })).toThrow()
    })

    it('deduplicates valid side-menu modes and rejects invalid mode values', () => {
        const config = normalizeDashboardLayoutConfig({
            sideMenu: {
                availableModes: ['overlay', 'compact', 'overlay'],
                primaryMode: 'compact',
                rememberUserChoice: false
            }
        })

        expect(config.sideMenu).toEqual({
            availableModes: ['overlay', 'compact'],
            primaryMode: 'compact',
            rememberUserChoice: false
        })
        expect(() => normalizeDashboardLayoutConfig({ sideMenu: { availableModes: ['invalid'] } })).toThrow()
    })

    it('uses the only allowed side-menu mode when no primary mode is selected', () => {
        const config = normalizeDashboardLayoutConfig({
            sideMenu: {
                availableModes: ['overlay']
            }
        })

        expect(config.sideMenu).toEqual({
            availableModes: ['overlay'],
            primaryMode: 'overlay',
            rememberUserChoice: true
        })
    })
})
