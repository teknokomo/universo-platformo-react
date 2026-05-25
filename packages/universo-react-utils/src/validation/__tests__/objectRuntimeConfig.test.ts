import { describe, expect, it } from 'vitest'

import {
    extractObjectCollectionLayoutBehaviorConfig,
    resolveObjectCollectionLayoutBehaviorConfig,
    resolveObjectCollectionRuntimeDashboardLayoutConfig,
    sanitizeObjectCollectionRuntimeViewConfig,
    setObjectCollectionLayoutBehaviorConfig
} from '../objectRuntimeConfig'

describe('resolveObjectRuntimeDashboardLayoutConfig', () => {
    it('preserves layout defaults when object runtime config omits overrides', () => {
        const resolved = resolveObjectCollectionRuntimeDashboardLayoutConfig({
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

    it('applies explicit object overrides without clobbering omitted fields', () => {
        const resolved = resolveObjectCollectionRuntimeDashboardLayoutConfig({
            layoutConfig: setObjectCollectionLayoutBehaviorConfig(
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

    it('ignores layout-like object fields until local layout overrides are enabled', () => {
        const resolved = resolveObjectCollectionRuntimeDashboardLayoutConfig({
            layoutConfig: setObjectCollectionLayoutBehaviorConfig(
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
        const resolved = resolveObjectCollectionRuntimeDashboardLayoutConfig({
            layoutConfig: setObjectCollectionLayoutBehaviorConfig(
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

describe('sanitizeObjectRuntimeViewConfig', () => {
    it('keeps sparse runtime config for new objects without local layout overrides', () => {
        expect(
            sanitizeObjectCollectionRuntimeViewConfig({
                showCreateButton: true,
                showViewToggle: false,
                defaultViewMode: 'table'
            })
        ).toBeUndefined()
    })

    it('preserves legacy layout overrides as explicit overrides during migration', () => {
        expect(
            sanitizeObjectCollectionRuntimeViewConfig({
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

describe('object runtime behavior helpers', () => {
    it('uses defaults when layout behavior is absent', () => {
        expect(
            resolveObjectCollectionLayoutBehaviorConfig({
                layoutConfig: {}
            })
        ).toMatchObject({
            showCreateButton: true,
            editSurface: 'dialog'
        })
    })

    it('stores and extracts sparse behavior config inside layout config', () => {
        const layoutConfig = setObjectCollectionLayoutBehaviorConfig(
            { showHeader: false },
            { showCreateButton: false, createSurface: 'page' }
        )

        expect(layoutConfig).toMatchObject({ showHeader: false })
        expect(extractObjectCollectionLayoutBehaviorConfig(layoutConfig)).toEqual({
            showCreateButton: false,
            createSurface: 'page'
        })
    })
})
