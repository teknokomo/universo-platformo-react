import { describe, expect, it } from 'vitest'

import { dashboardLayoutConfigSchema, defaultDashboardLayoutConfig } from '../common/dashboardLayout'

describe('dashboard layout shared contract', () => {
    it('accepts only host-level side-menu presentation fields', () => {
        const parsed = dashboardLayoutConfigSchema.safeParse({
            sideMenu: {
                availableModes: ['wide', 'compact', 'overlay'],
                primaryMode: 'compact',
                rememberUserChoice: false
            }
        })

        expect(parsed.success).toBe(true)
        expect(
            dashboardLayoutConfigSchema.safeParse({
                objectBehavior: {
                    showCreateButton: false,
                    createSurface: 'page'
                }
            }).success
        ).toBe(true)
        expect(dashboardLayoutConfigSchema.safeParse({ objectBehavior: { showViewToggle: true } }).success).toBe(false)
        expect(dashboardLayoutConfigSchema.safeParse({ objectBehavior: { searchMode: 'server' } }).success).toBe(false)
        for (const field of [
            'showLanguageSwitcher',
            'showRightSideMenu',
            'showViewToggle',
            'defaultViewMode',
            'showFilterBar',
            'enableRowReordering',
            'cardColumns',
            'rowHeight'
        ]) {
            expect(dashboardLayoutConfigSchema.safeParse({ [field]: field === 'defaultViewMode' ? 'table' : false }).success).toBe(false)
        }
    })

    it('keeps the shared defaults aligned with runtime expectations', () => {
        expect(defaultDashboardLayoutConfig.sideMenu).toEqual({
            availableModes: ['wide', 'compact', 'overlay'],
            primaryMode: 'wide',
            rememberUserChoice: true
        })
        expect(Object.keys(defaultDashboardLayoutConfig)).toEqual(['sideMenu'])
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
