import {
    normalizeSnapshotLayoutZoneWidgets,
    normalizeSnapshotLayouts,
    withWorkspaceRuntimeLayoutWidgets
} from '../../routes/sync/syncHelpers'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'

describe('sync layout materialization helpers', () => {
    it('injects workspace switcher widgets into global layouts when runtime workspaces are enabled', () => {
        const snapshot: PublishedApplicationSnapshot = {
            layouts: [
                {
                    id: 'global-layout-1',
                    templateKey: 'dashboard',
                    name: { en: 'Global default' },
                    description: null,
                    config: { showSideMenu: true },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    id: 'global-menu-widget',
                    layoutId: 'global-layout-1',
                    zone: 'left',
                    widgetKey: 'menuWidget',
                    sortOrder: 0,
                    config: {},
                    isActive: true
                }
            ],
            defaultLayoutId: 'global-layout-1'
        }

        const workspaceSnapshot = withWorkspaceRuntimeLayoutWidgets(snapshot, true)
        const widgets = normalizeSnapshotLayoutZoneWidgets(workspaceSnapshot)
        const workspaceSwitcher = widgets.find((item) => item.layoutId === 'global-layout-1' && item.widgetKey === 'workspaceSwitcher')
        const divider = widgets.find((item) => item.layoutId === 'global-layout-1' && item.widgetKey === 'divider')
        const menu = widgets.find((item) => item.id === 'global-menu-widget')

        expect(workspaceSwitcher).toEqual(
            expect.objectContaining({
                zone: 'left',
                sortOrder: -200,
                isActive: true
            })
        )
        expect(divider).toEqual(
            expect.objectContaining({
                zone: 'left',
                sortOrder: -199,
                isActive: true
            })
        )
        expect(menu).toEqual(expect.objectContaining({ sortOrder: 0 }))
    })

    it('materializes scoped layouts from global layouts, sparse overrides, and entity-owned widgets', () => {
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
                    id: 'entity-owned-widget-1',
                    layoutId: 'object-layout-1',
                    zone: 'right',
                    widgetKey: 'statsOverview',
                    sortOrder: 1,
                    config: { compact: true },
                    isActive: true
                }
            ],
            scopedLayouts: [
                {
                    id: 'object-layout-1',
                    scopeEntityId: 'object-1',
                    baseLayoutId: 'global-layout-1',
                    templateKey: 'dashboard',
                    name: { en: 'Object override' },
                    description: null,
                    config: { showHeader: false },
                    isActive: true,
                    isDefault: false,
                    sortOrder: 0
                }
            ],
            layoutWidgetOverrides: [
                {
                    layoutId: 'object-layout-1',
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
                    scopeEntityId: null,
                    isDefault: true,
                    config: expect.objectContaining({ showHeader: true, showSideMenu: true })
                }),
                expect.objectContaining({
                    id: 'object-layout-1',
                    scopeEntityId: 'object-1',
                    isDefault: true,
                    config: expect.objectContaining({
                        showHeader: false,
                        showSideMenu: false,
                        showRightSideMenu: true
                    })
                })
            ])
        )

        const inheritedCatalogWidget = widgets.find((item) => item.layoutId === 'object-layout-1' && item.widgetKey === 'menuWidget')
        expect(inheritedCatalogWidget).toBeTruthy()
        expect(inheritedCatalogWidget).toMatchObject({
            layoutId: 'object-layout-1',
            zone: 'top',
            sortOrder: 2,
            config: { showTitle: false },
            sourceBaseWidgetId: 'global-widget-1'
        })
        expect(inheritedCatalogWidget?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
        expect(inheritedCatalogWidget?.id).not.toBe('global-widget-1')

        expect(widgets).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'entity-owned-widget-1',
                    layoutId: 'object-layout-1',
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
            scopedLayouts: [
                {
                    id: 'object-layout-1',
                    scopeEntityId: 'object-1',
                    baseLayoutId: 'global-layout-1',
                    templateKey: 'dashboard',
                    name: { en: 'Object override' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutWidgetOverrides: [
                {
                    layoutId: 'object-layout-1',
                    baseWidgetId: 'global-widget-1',
                    isDeletedOverride: true
                }
            ],
            defaultLayoutId: 'global-layout-1'
        }

        const widgets = normalizeSnapshotLayoutZoneWidgets(snapshot)

        expect(widgets.some((item) => item.layoutId === 'object-layout-1' && item.widgetKey === 'menuWidget')).toBe(false)
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
            scopedLayouts: [],
            layoutWidgetOverrides: [],
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
