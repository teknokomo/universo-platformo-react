import { normalizeSnapshotLayoutZoneWidgets, normalizeSnapshotLayouts } from '../../routes/sync/syncHelpers'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'

describe('sync layout materialization helpers', () => {
    it('materializes catalog layouts from global layouts, sparse overrides, and catalog-owned widgets', () => {
        const snapshot: PublishedApplicationSnapshot = {
            layouts: [
                {
                    id: 'global-layout-1',
                    templateKey: 'dashboard',
                    name: { en: 'Global default' },
                    description: null,
                    config: { showHeader: true, showSideMenu: true },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    id: 'global-widget-1',
                    layoutId: 'global-layout-1',
                    zone: 'left',
                    widgetKey: 'menuWidget',
                    sortOrder: 1,
                    config: { showTitle: true },
                    isActive: true
                },
                {
                    id: 'catalog-owned-widget-1',
                    layoutId: 'catalog-layout-1',
                    zone: 'right',
                    widgetKey: 'statsOverview',
                    sortOrder: 1,
                    config: { compact: true },
                    isActive: true
                }
            ],
            catalogLayouts: [
                {
                    id: 'catalog-layout-1',
                    linkedCollectionId: 'catalog-1',
                    baseLayoutId: 'global-layout-1',
                    templateKey: 'dashboard',
                    name: { en: 'Catalog override' },
                    description: null,
                    config: { showHeader: false },
                    isActive: true,
                    isDefault: false,
                    sortOrder: 0
                }
            ],
            catalogLayoutWidgetOverrides: [
                {
                    catalogLayoutId: 'catalog-layout-1',
                    baseWidgetId: 'global-widget-1',
                    zone: 'top',
                    sortOrder: 2,
                    config: { showTitle: false },
                    isActive: true,
                    isDeletedOverride: false
                }
            ],
            defaultLayoutId: 'global-layout-1'
        }

        const layouts = normalizeSnapshotLayouts(snapshot)
        const widgets = normalizeSnapshotLayoutZoneWidgets(snapshot)

        expect(layouts).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'global-layout-1',
                    linkedCollectionId: null,
                    isDefault: true,
                    config: expect.objectContaining({ showHeader: true, showSideMenu: true })
                }),
                expect.objectContaining({
                    id: 'catalog-layout-1',
                    linkedCollectionId: 'catalog-1',
                    isDefault: true,
                    config: expect.objectContaining({
                        showHeader: false,
                        showSideMenu: false,
                        showRightSideMenu: true
                    })
                })
            ])
        )

        const inheritedCatalogWidget = widgets.find((item) => item.layoutId === 'catalog-layout-1' && item.widgetKey === 'menuWidget')
        expect(inheritedCatalogWidget).toBeTruthy()
        expect(inheritedCatalogWidget).toMatchObject({
            layoutId: 'catalog-layout-1',
            zone: 'top',
            sortOrder: 2,
            config: { showTitle: true }
        })
        expect(inheritedCatalogWidget?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
        expect(inheritedCatalogWidget?.id).not.toBe('global-widget-1')

        expect(widgets).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'catalog-owned-widget-1',
                    layoutId: 'catalog-layout-1',
                    zone: 'right',
                    widgetKey: 'statsOverview',
                    config: { compact: true }
                })
            ])
        )
    })

    it('drops inherited widgets that are marked as deleted overrides', () => {
        const snapshot: PublishedApplicationSnapshot = {
            layouts: [
                {
                    id: 'global-layout-1',
                    templateKey: 'dashboard',
                    name: { en: 'Global default' },
                    description: null,
                    config: { showHeader: true },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    id: 'global-widget-1',
                    layoutId: 'global-layout-1',
                    zone: 'left',
                    widgetKey: 'menuWidget',
                    sortOrder: 1,
                    config: { showTitle: true },
                    isActive: true
                }
            ],
            catalogLayouts: [
                {
                    id: 'catalog-layout-1',
                    linkedCollectionId: 'catalog-1',
                    baseLayoutId: 'global-layout-1',
                    templateKey: 'dashboard',
                    name: { en: 'Catalog override' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            catalogLayoutWidgetOverrides: [
                {
                    catalogLayoutId: 'catalog-layout-1',
                    baseWidgetId: 'global-widget-1',
                    isDeletedOverride: true
                }
            ],
            defaultLayoutId: 'global-layout-1'
        }

        const widgets = normalizeSnapshotLayoutZoneWidgets(snapshot)

        expect(widgets.some((item) => item.layoutId === 'catalog-layout-1' && item.widgetKey === 'menuWidget')).toBe(false)
    })

    it('preserves inactive widgets and normalizes invalid zones to center', () => {
        const snapshot: PublishedApplicationSnapshot = {
            layouts: [
                {
                    id: 'global-layout-1',
                    templateKey: 'dashboard',
                    name: { en: 'Global default' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    id: 'disabled-widget-1',
                    layoutId: 'global-layout-1',
                    zone: 'legacy-zone',
                    widgetKey: 'header',
                    sortOrder: 1,
                    config: {},
                    isActive: false
                }
            ],
            catalogLayouts: [],
            catalogLayoutWidgetOverrides: [],
            defaultLayoutId: 'global-layout-1'
        }

        const widgets = normalizeSnapshotLayoutZoneWidgets(snapshot)

        expect(widgets).toEqual([
            expect.objectContaining({
                id: 'disabled-widget-1',
                zone: 'center',
                isActive: false
            })
        ])
    })
})
