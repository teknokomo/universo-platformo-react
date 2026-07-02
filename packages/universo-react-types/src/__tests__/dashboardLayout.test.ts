import { describe, expect, it } from 'vitest'

import { dashboardLayoutConfigSchema, defaultDashboardLayoutConfig } from '../common/dashboardLayout'

describe('dashboard layout shared contract', () => {
    it('accepts the runtime-enhanced layout fields', () => {
        const parsed = dashboardLayoutConfigSchema.safeParse({
            showLanguageSwitcher: false,
            showRightSideMenu: false,
            showViewToggle: true,
            defaultViewMode: 'card',
            sideMenu: {
                availableModes: ['wide', 'compact', 'overlay'],
                primaryMode: 'compact',
                rememberUserChoice: false
            },
            showFilterBar: true,
            enableRowReordering: true,
            cardColumns: 4,
            rowHeight: 'auto'
        })

        expect(parsed.success).toBe(true)
    })

    it('keeps the shared defaults aligned with runtime expectations', () => {
        expect(defaultDashboardLayoutConfig.showLanguageSwitcher).toBe(true)
        expect(defaultDashboardLayoutConfig.showRightSideMenu).toBe(false)
        expect(defaultDashboardLayoutConfig.showViewToggle).toBe(false)
        expect(defaultDashboardLayoutConfig.defaultViewMode).toBe('table')
        expect(defaultDashboardLayoutConfig.sideMenu).toEqual({
            availableModes: ['wide', 'compact', 'overlay'],
            primaryMode: 'wide',
            rememberUserChoice: true
        })
        expect(defaultDashboardLayoutConfig.cardColumns).toBe(3)
    })

    it('normalizes partial side menu config before runtime schema output', () => {
        const parsed = dashboardLayoutConfigSchema.parse({
            sideMenu: {
                primaryMode: 'compact'
            }
        })

        expect(parsed?.sideMenu).toEqual({
            availableModes: ['wide', 'compact', 'overlay'],
            primaryMode: 'compact',
            rememberUserChoice: true
        })
    })

    it('rejects invalid side menu config', () => {
        expect(
            dashboardLayoutConfigSchema.safeParse({
                sideMenu: {
                    availableModes: [],
                    primaryMode: 'wide'
                }
            }).success
        ).toBe(false)
        expect(
            dashboardLayoutConfigSchema.safeParse({
                sideMenu: {
                    availableModes: ['compact'],
                    primaryMode: 'wide'
                }
            }).success
        ).toBe(false)
    })
})
