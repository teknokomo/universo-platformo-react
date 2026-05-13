import { describe, expect, it } from 'vitest'

import {
    extractLinkedCollectionLayoutBehaviorConfig,
    resolveLinkedCollectionLayoutBehaviorConfig,
    resolveLinkedCollectionRuntimeDashboardLayoutConfig,
    sanitizeLinkedCollectionRuntimeViewConfig,
    setLinkedCollectionLayoutBehaviorConfig
} from '../linkedCollectionRuntimeConfig'

describe('resolveLinkedCollectionRuntimeDashboardLayoutConfig', () => {
    it('preserves layout defaults when catalog runtime config omits overrides', () => {
        const resolved = resolveLinkedCollectionRuntimeDashboardLayoutConfig({
            layoutConfig: {
                showViewToggle: false,
                defaultViewMode: 'table',
                showFilterBar: false,
                enableRowReordering: false,
                cardColumns: 4,
                rowHeight: 'auto'
            }
        })

        expect(resolved.showViewToggle).toBe(false)
        expect(resolved.defaultViewMode).toBe('table')
        expect(resolved.showFilterBar).toBe(false)
        expect(resolved.enableRowReordering).toBe(false)
        expect(resolved.cardColumns).toBe(4)
        expect(resolved.rowHeight).toBe('auto')
    })

    it('applies explicit catalog overrides without clobbering omitted fields', () => {
        const resolved = resolveLinkedCollectionRuntimeDashboardLayoutConfig({
            layoutConfig: setLinkedCollectionLayoutBehaviorConfig(
                {
                    showViewToggle: false,
                    defaultViewMode: 'table',
                    showFilterBar: false,
                    enableRowReordering: false,
                    cardColumns: 4,
                    rowHeight: 'auto'
                },
                {
                    useLayoutOverrides: true,
                    showSearch: true,
                    defaultViewMode: 'card',
                    rowHeight: 'normal'
                }
            )
        })

        expect(resolved.showViewToggle).toBe(false)
        expect(resolved.defaultViewMode).toBe('card')
        expect(resolved.showFilterBar).toBe(true)
        expect(resolved.enableRowReordering).toBe(false)
        expect(resolved.cardColumns).toBe(4)
        expect(resolved.rowHeight).toBe(52)
    })

    it('ignores layout-like catalog fields until local layout overrides are enabled', () => {
        const resolved = resolveLinkedCollectionRuntimeDashboardLayoutConfig({
            layoutConfig: setLinkedCollectionLayoutBehaviorConfig(
                {
                    showViewToggle: true,
                    defaultViewMode: 'card',
                    showFilterBar: true,
                    enableRowReordering: true,
                    cardColumns: 4,
                    rowHeight: 'auto'
                },
                {
                    useLayoutOverrides: false,
                    showSearch: false,
                    defaultViewMode: 'table',
                    enableRowReordering: false,
                    cardColumns: 2,
                    rowHeight: 'compact'
                }
            )
        })

        expect(resolved.showViewToggle).toBe(true)
        expect(resolved.defaultViewMode).toBe('card')
        expect(resolved.showFilterBar).toBe(true)
        expect(resolved.enableRowReordering).toBe(true)
        expect(resolved.cardColumns).toBe(4)
        expect(resolved.rowHeight).toBe('auto')
    })

    it('applies behavior config stored inside layout config', () => {
        const resolved = resolveLinkedCollectionRuntimeDashboardLayoutConfig({
            layoutConfig: setLinkedCollectionLayoutBehaviorConfig(
                {
                    showDetailsTable: true,
                    showViewToggle: false
                },
                {
                    useLayoutOverrides: true,
                    showViewToggle: true,
                    showSearch: true,
                    defaultViewMode: 'card'
                }
            )
        })

        expect(resolved.showDetailsTable).toBe(true)
        expect(resolved.showViewToggle).toBe(true)
        expect(resolved.showFilterBar).toBe(true)
        expect(resolved.defaultViewMode).toBe('card')
    })
})

describe('sanitizeLinkedCollectionRuntimeViewConfig', () => {
    it('keeps sparse runtime config for new catalogs without local layout overrides', () => {
        expect(
            sanitizeLinkedCollectionRuntimeViewConfig({
                showCreateButton: true,
                showViewToggle: false,
                defaultViewMode: 'table'
            })
        ).toBeUndefined()
    })

    it('preserves legacy layout overrides as explicit overrides during migration', () => {
        expect(
            sanitizeLinkedCollectionRuntimeViewConfig({
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

describe('catalog runtime behavior helpers', () => {
    it('uses defaults when layout behavior is absent', () => {
        expect(
            resolveLinkedCollectionLayoutBehaviorConfig({
                layoutConfig: {}
            })
        ).toMatchObject({
            showCreateButton: true,
            editSurface: 'dialog'
        })
    })

    it('stores and extracts sparse behavior config inside layout config', () => {
        const layoutConfig = setLinkedCollectionLayoutBehaviorConfig(
            { showHeader: false },
            { showCreateButton: false, createSurface: 'page' }
        )

        expect(layoutConfig).toMatchObject({ showHeader: false })
        expect(extractLinkedCollectionLayoutBehaviorConfig(layoutConfig)).toEqual({
            showCreateButton: false,
            createSurface: 'page'
        })
    })
})
