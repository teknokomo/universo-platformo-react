import { describe, expect, it } from 'vitest'

import {
    extractObjectCollectionLayoutBehaviorConfig,
    resolveObjectCollectionLayoutBehaviorConfig,
    sanitizeObjectCollectionRuntimeViewConfig,
    setObjectCollectionLayoutBehaviorConfig
} from '../objectCollectionRuntimeConfig'
import { objectCollectionRuntimeViewConfigSchema } from '@universo-react/types'

describe('sanitizeObjectCollectionRuntimeViewConfig', () => {
    it('stores only explicit Object CRUD and search behavior', () => {
        expect(sanitizeObjectCollectionRuntimeViewConfig({ showCreateButton: true })).toBeUndefined()
        expect(
            sanitizeObjectCollectionRuntimeViewConfig({
                showCreateButton: false,
                createSurface: 'page'
            })
        ).toEqual({ showCreateButton: false, createSurface: 'page' })
    })

    it('rejects fields owned by details-table placement presentation', () => {
        expect(objectCollectionRuntimeViewConfigSchema.safeParse({ showViewToggle: true }).success).toBe(false)
        expect(objectCollectionRuntimeViewConfigSchema.safeParse({ searchMode: 'server' }).success).toBe(false)
        expect(sanitizeObjectCollectionRuntimeViewConfig({ enableRowReordering: true })).toBeUndefined()
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
            { sideMenu: { availableModes: ['wide'], primaryMode: 'wide' } },
            { showCreateButton: false, createSurface: 'page' }
        )

        expect(layoutConfig).toMatchObject({ sideMenu: { primaryMode: 'wide' } })
        expect(extractObjectCollectionLayoutBehaviorConfig(layoutConfig)).toEqual({
            showCreateButton: false,
            createSurface: 'page'
        })
    })
})
