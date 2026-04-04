import { describe, expect, it } from 'vitest'

import { resolveCatalogRuntimeDashboardLayoutConfig, sanitizeCatalogRuntimeViewConfig } from '../catalogRuntimeConfig'

describe('resolveCatalogRuntimeDashboardLayoutConfig', () => {
    it('preserves layout defaults when catalog runtime config omits overrides', () => {
        const resolved = resolveCatalogRuntimeDashboardLayoutConfig({
            layoutConfig: {
                showViewToggle: false,
                defaultViewMode: 'table',
                showFilterBar: false,
                enableRowReordering: false,
                cardColumns: 4,
                rowHeight: 'auto'
            },
            catalogRuntimeConfig: {}
        })

        expect(resolved.showViewToggle).toBe(false)
        expect(resolved.defaultViewMode).toBe('table')
        expect(resolved.showFilterBar).toBe(false)
        expect(resolved.enableRowReordering).toBe(false)
        expect(resolved.cardColumns).toBe(4)
        expect(resolved.rowHeight).toBe('auto')
    })

    it('applies explicit catalog overrides without clobbering omitted fields', () => {
        const resolved = resolveCatalogRuntimeDashboardLayoutConfig({
            layoutConfig: {
                showViewToggle: false,
                defaultViewMode: 'table',
                showFilterBar: false,
                enableRowReordering: false,
                cardColumns: 4,
                rowHeight: 'auto'
            },
            catalogRuntimeConfig: {
                useLayoutOverrides: true,
                showSearch: true,
                defaultViewMode: 'card',
                rowHeight: 'normal'
            }
        })

        expect(resolved.showViewToggle).toBe(false)
        expect(resolved.defaultViewMode).toBe('card')
        expect(resolved.showFilterBar).toBe(true)
        expect(resolved.enableRowReordering).toBe(false)
        expect(resolved.cardColumns).toBe(4)
        expect(resolved.rowHeight).toBe(52)
    })

    it('ignores layout-like catalog fields until local layout overrides are enabled', () => {
        const resolved = resolveCatalogRuntimeDashboardLayoutConfig({
            layoutConfig: {
                showViewToggle: true,
                defaultViewMode: 'card',
                showFilterBar: true,
                enableRowReordering: true,
                cardColumns: 4,
                rowHeight: 'auto'
            },
            catalogRuntimeConfig: {
                useLayoutOverrides: false,
                showSearch: false,
                defaultViewMode: 'table',
                enableRowReordering: false,
                cardColumns: 2,
                rowHeight: 'compact'
            }
        })

        expect(resolved.showViewToggle).toBe(true)
        expect(resolved.defaultViewMode).toBe('card')
        expect(resolved.showFilterBar).toBe(true)
        expect(resolved.enableRowReordering).toBe(true)
        expect(resolved.cardColumns).toBe(4)
        expect(resolved.rowHeight).toBe('auto')
    })
})

describe('sanitizeCatalogRuntimeViewConfig', () => {
    it('keeps sparse runtime config for new catalogs without local layout overrides', () => {
        expect(
            sanitizeCatalogRuntimeViewConfig({
                showCreateButton: true,
                showViewToggle: false,
                defaultViewMode: 'table'
            })
        ).toBeUndefined()
    })

    it('preserves legacy layout overrides as explicit overrides during migration', () => {
        expect(
            sanitizeCatalogRuntimeViewConfig({
                showViewToggle: false,
                defaultViewMode: 'card'
            })
        ).toEqual({
            useLayoutOverrides: true,
            showViewToggle: false,
            defaultViewMode: 'card'
        })
    })
})
