import { describe, expect, it } from 'vitest'

import { normalizeMenuWidgetConfigTargets } from '../menuWidgetTargets'
import type { MenuWidgetConfig } from '@universo-react/types'

const createConfig = (overrides: Partial<MenuWidgetConfig> = {}): MenuWidgetConfig => ({
    showTitle: false,
    title: { _primary: 'en', locales: { en: { content: 'Menu' } } },
    autoShowAllSections: false,
    items: [
        {
            id: 'intro-item',
            kind: 'section',
            title: { _primary: 'en', locales: { en: { content: 'Intro' } } },
            sectionId: 'Intro',
            sortOrder: 1,
            isActive: true
        },
        {
            id: 'structures-item',
            kind: 'section',
            title: { _primary: 'en', locales: { en: { content: 'Structures' } } },
            sectionId: 'Structure',
            objectCollectionId: 'Structure',
            sortOrder: 2,
            isActive: true
        }
    ],
    ...overrides
})

describe('normalizeMenuWidgetConfigTargets', () => {
    it('resolves section and object collection tokens to UUID-backed semantic targets', () => {
        const config = normalizeMenuWidgetConfigTargets(createConfig(), {
            sectionByToken: new Map([
                ['Intro', { id: 'page-uuid', kind: 'section' }],
                ['Structure', { id: 'structure-uuid', kind: 'objectCollection' }]
            ])
        })

        expect(config.items[0]).toMatchObject({
            sectionId: 'page-uuid',
            objectCollectionId: null,
            hubId: null,
            treeEntityId: null
        })
        expect(config.items[1]).toMatchObject({
            sectionId: null,
            objectCollectionId: 'structure-uuid',
            hubId: null,
            treeEntityId: null
        })
    })

    it('resolves startPage through menu item ids before section and hub targets', () => {
        const config = normalizeMenuWidgetConfigTargets(createConfig({ startPage: 'structures-item' }), {
            sectionByToken: new Map([['Structure', { id: 'structure-uuid', kind: 'objectCollection' }]])
        })

        expect(config.startPage).toBe('structures-item')
        expect(config.startTarget).toEqual({ kind: 'menuItem', menuItemId: 'structures-item' })
    })

    it('keeps a menu item startPage stable even when an existing startTarget points to a materialized object collection', () => {
        const config = normalizeMenuWidgetConfigTargets(
            createConfig({
                startPage: 'structures-item',
                startTarget: { kind: 'objectCollection', objectCollectionId: 'structure-uuid' }
            }),
            {
                sectionByToken: new Map([['Structure', { id: 'structure-uuid', kind: 'objectCollection' }]])
            }
        )

        expect(config.startPage).toBe('structures-item')
        expect(config.startTarget).toEqual({ kind: 'menuItem', menuItemId: 'structures-item' })
    })

    it('resolves the current startPage before preserving an existing startTarget', () => {
        const config = normalizeMenuWidgetConfigTargets(
            createConfig({
                startPage: 'Intro',
                startTarget: { kind: 'objectCollection', objectCollectionId: 'stale-structure-uuid' }
            }),
            {
                sectionByToken: new Map([
                    ['Intro', { id: 'intro-page-uuid', kind: 'section' }],
                    ['Structure', { id: 'structure-uuid', kind: 'objectCollection' }]
                ])
            }
        )

        expect(config.startPage).toBe('intro-page-uuid')
        expect(config.startTarget).toEqual({ kind: 'section', sectionId: 'intro-page-uuid' })
    })

    it('keeps UUID-backed existing start targets idempotent when target maps are not provided', () => {
        const objectCollectionConfig = normalizeMenuWidgetConfigTargets(
            createConfig({
                startPage: 'structure-uuid',
                startTarget: { kind: 'objectCollection', objectCollectionId: 'structure-uuid' }
            })
        )
        const treeEntityConfig = normalizeMenuWidgetConfigTargets(
            createConfig({
                startPage: 'hub-uuid',
                startTarget: { kind: 'treeEntity', treeEntityId: 'hub-uuid' }
            })
        )

        expect(objectCollectionConfig.startPage).toBe('structure-uuid')
        expect(objectCollectionConfig.startTarget).toEqual({ kind: 'objectCollection', objectCollectionId: 'structure-uuid' })
        expect(treeEntityConfig.startPage).toBe('hub-uuid')
        expect(treeEntityConfig.startTarget).toEqual({ kind: 'treeEntity', treeEntityId: 'hub-uuid' })
    })

    it('keeps already materialized UUID targets idempotent during repeated syncs with authoritative maps', () => {
        const config = normalizeMenuWidgetConfigTargets(
            createConfig({
                startPage: '019f15a0-0000-7000-8000-000000000001',
                startTarget: { kind: 'objectCollection', objectCollectionId: '019f15a0-0000-7000-8000-000000000001' },
                items: [
                    {
                        id: 'structures-item',
                        kind: 'section',
                        title: { _primary: 'en', locales: { en: { content: 'Structures' } } },
                        sectionId: null,
                        objectCollectionId: '019f15a0-0000-7000-8000-000000000001',
                        sortOrder: 1,
                        isActive: true
                    },
                    {
                        id: 'hub-item',
                        kind: 'hub',
                        title: { _primary: 'en', locales: { en: { content: 'Hub' } } },
                        hubId: null,
                        treeEntityId: '019f15a0-0000-7000-8000-000000000002',
                        sortOrder: 2,
                        isActive: true
                    }
                ]
            }),
            {
                sectionByToken: new Map([['Structure', { id: '019f15a0-0000-7000-8000-000000000001', kind: 'objectCollection' }]]),
                hubByToken: new Map([['MainHub', { id: '019f15a0-0000-7000-8000-000000000002', kind: 'treeEntity' }]])
            }
        )

        expect(config.startPage).toBe('019f15a0-0000-7000-8000-000000000001')
        expect(config.startTarget).toEqual({
            kind: 'objectCollection',
            objectCollectionId: '019f15a0-0000-7000-8000-000000000001'
        })
        expect(config.items[0]).toMatchObject({
            sectionId: null,
            objectCollectionId: '019f15a0-0000-7000-8000-000000000001'
        })
        expect(config.items[1]).toMatchObject({
            hubId: null,
            treeEntityId: '019f15a0-0000-7000-8000-000000000002'
        })
    })

    it('prefers UUID section targets over duplicate menu item ids', () => {
        const config = normalizeMenuWidgetConfigTargets(
            createConfig({
                startPage: '019f15a0-0000-7000-8000-000000000001',
                items: [
                    {
                        id: '019f15a0-0000-7000-8000-000000000001',
                        kind: 'section',
                        title: { _primary: 'en', locales: { en: { content: 'Duplicate item id' } } },
                        sectionId: 'Structure',
                        sortOrder: 1,
                        isActive: true
                    }
                ]
            }),
            {
                sectionByToken: new Map([['019f15a0-0000-7000-8000-000000000001', { id: 'section-uuid', kind: 'section' }]])
            }
        )

        expect(config.startPage).toBe('section-uuid')
        expect(config.startTarget).toEqual({ kind: 'section', sectionId: 'section-uuid' })
    })

    it('falls back to a valid object collection token when sectionId is stale', () => {
        const config = normalizeMenuWidgetConfigTargets(
            createConfig({
                items: [
                    {
                        id: 'structures-item',
                        kind: 'section',
                        title: { _primary: 'en', locales: { en: { content: 'Structures' } } },
                        sectionId: 'DeletedStructureAlias',
                        objectCollectionId: 'Structure',
                        sortOrder: 1,
                        isActive: true
                    }
                ]
            }),
            {
                sectionByToken: new Map([['Structure', { id: 'structure-uuid', kind: 'objectCollection' }]])
            }
        )

        expect(config.items[0]).toMatchObject({
            sectionId: null,
            objectCollectionId: 'structure-uuid'
        })
    })

    it('drops unresolved mapped targets so stale codenames do not render as inert runtime links', () => {
        const config = normalizeMenuWidgetConfigTargets(
            createConfig({
                startPage: 'DeletedStructureAlias',
                items: [
                    {
                        id: 'stale-item',
                        kind: 'section',
                        title: { _primary: 'en', locales: { en: { content: 'Deleted structure' } } },
                        sectionId: 'DeletedStructureAlias',
                        sortOrder: 1,
                        isActive: true
                    },
                    {
                        id: 'stale-hub',
                        kind: 'hub',
                        title: { _primary: 'en', locales: { en: { content: 'Deleted hub' } } },
                        hubId: 'DeletedHubAlias',
                        sortOrder: 2,
                        isActive: true
                    }
                ]
            }),
            {
                sectionByToken: new Map([['Structure', { id: 'structure-uuid', kind: 'objectCollection' }]]),
                hubByToken: new Map([['MainHub', { id: 'hub-uuid', kind: 'treeEntity' }]])
            }
        )

        expect(config.startTarget).toBeNull()
        expect(config.items[0]).toMatchObject({
            sectionId: null,
            objectCollectionId: null,
            hubId: null,
            treeEntityId: null
        })
        expect(config.items[1]).toMatchObject({
            sectionId: null,
            objectCollectionId: null,
            hubId: null,
            treeEntityId: null
        })
    })

    it('materializes bindToHub targets through the hub token map', () => {
        const config = normalizeMenuWidgetConfigTargets(
            createConfig({
                bindToHub: true,
                boundHubId: 'MainHub',
                boundTreeEntityId: 'StructureHub'
            }),
            {
                hubByToken: new Map([
                    ['MainHub', { id: 'main-hub-uuid', kind: 'hub' }],
                    ['StructureHub', { id: 'structure-hub-uuid', kind: 'treeEntity' }]
                ])
            }
        )

        expect(config.boundHubId).toBe('main-hub-uuid')
        expect(config.boundTreeEntityId).toBeNull()
    })

    it('keeps unresolved section tokens stable without mirroring them into unrelated target fields', () => {
        const config = normalizeMenuWidgetConfigTargets(createConfig({ startPage: 'Missing' }))

        expect(config.startPage).toBe('Missing')
        expect(config.startTarget).toEqual({ kind: 'section', sectionId: 'Missing' })
        expect(config.items[0]).toMatchObject({
            sectionId: 'Intro',
            objectCollectionId: null,
            hubId: null,
            treeEntityId: null
        })
    })
})
