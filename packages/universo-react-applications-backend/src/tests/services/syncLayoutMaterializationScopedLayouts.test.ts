import {
    buildMergedDashboardLayoutConfig,
    normalizeSnapshotLayoutZoneWidgets,
    normalizeSnapshotLayouts,
    materializeSnapshotLayoutsAndWidgets,
    withWorkspaceRuntimeLayoutWidgets,
    stableLineageUuidV7,
    createGlobalDashboardLayout
} from './syncLayoutMaterializationHarness'
import type { PublishedApplicationSnapshot } from './syncLayoutMaterializationHarness'

describe('sync layout workspace and scoped materialization', () => {
    it('injects workspace switcher widgets into global layouts when runtime workspaces are enabled', () => {
        const snapshot: PublishedApplicationSnapshot = {
            layouts: [
                {
                    id: 'global-layout-1',
                    templateKey: 'dashboard',
                    compositionMode: 'independent',
                    baseLayoutId: null,
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
                    config: { items: [] },
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

    it('allocates fresh UUID-v7 placeholders for inherited projection rows', () => {
        const snapshot: PublishedApplicationSnapshot = {
            layouts: [createGlobalDashboardLayout()],
            scopedLayouts: [
                {
                    id: 'scoped-layout-1',
                    scopeEntityId: 'scope-entity-1',
                    baseLayoutId: 'global-layout-1',
                    compositionMode: 'overlay',
                    templateKey: 'dashboard',
                    name: { en: 'Scoped' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    id: '018f8a78-7b8f-7c1d-a111-2222333344a2',
                    layoutId: 'global-layout-1',
                    zone: 'center',
                    widgetKey: 'detailsTable',
                    sortOrder: 0,
                    config: { datasource: { kind: 'records.list', sectionCodename: 'Object' } },
                    isActive: true
                }
            ],
            defaultLayoutId: 'global-layout-1'
        }

        const first = materializeSnapshotLayoutsAndWidgets(snapshot).widgets.find(
            (widget) => widget.sourceBaseWidgetId === '018f8a78-7b8f-7c1d-a111-2222333344a2'
        )
        const second = materializeSnapshotLayoutsAndWidgets(snapshot).widgets.find(
            (widget) => widget.sourceBaseWidgetId === '018f8a78-7b8f-7c1d-a111-2222333344a2'
        )

        expect(first?.id).toEqual(expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/))
        expect(second?.id).toEqual(expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/))
        expect(first?.id).not.toBe(second?.id)
    })

    it('keeps generated workspace widget lineage stable across scoped materializations', () => {
        const globalLayoutId = '018f8a78-7b8f-7c1d-a111-2222333344a2'
        const scopedLayoutId = '018f8a78-7b8f-7c1d-a111-2222333344a3'
        const scopeEntityId = '018f8a78-7b8f-7c1d-a111-2222333344a4'
        const snapshot: PublishedApplicationSnapshot = {
            layouts: [
                {
                    id: globalLayoutId,
                    templateKey: 'dashboard',
                    compositionMode: 'independent',
                    baseLayoutId: null,
                    name: { en: 'Global default' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            scopedLayouts: [
                {
                    id: scopedLayoutId,
                    scopeEntityId,
                    baseLayoutId: globalLayoutId,
                    compositionMode: 'overlay',
                    templateKey: 'dashboard',
                    name: { en: 'Scoped' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [],
            defaultLayoutId: globalLayoutId
        }

        const first = materializeSnapshotLayoutsAndWidgets(withWorkspaceRuntimeLayoutWidgets(snapshot, true)).widgets
        const second = materializeSnapshotLayoutsAndWidgets(withWorkspaceRuntimeLayoutWidgets(snapshot, true)).widgets
        const firstWorkspaceWidget = first.find((widget) => widget.layoutId === scopedLayoutId && widget.widgetKey === 'workspaceSwitcher')
        const secondWorkspaceWidget = second.find(
            (widget) => widget.layoutId === scopedLayoutId && widget.widgetKey === 'workspaceSwitcher'
        )

        expect(firstWorkspaceWidget?.sourceBaseWidgetId).toBe(
            stableLineageUuidV7(globalLayoutId, `workspace:${globalLayoutId}:workspaceSwitcher`)
        )
        expect(secondWorkspaceWidget?.sourceBaseWidgetId).toBe(firstWorkspaceWidget?.sourceBaseWidgetId)
        expect(firstWorkspaceWidget?.id).not.toBe(secondWorkspaceWidget?.id)
    })

    it('materializes scoped layouts from global layouts, sparse overrides, and entity-owned widgets', () => {
        const snapshot: PublishedApplicationSnapshot = {
            layouts: [
                {
                    id: 'global-layout-1',
                    templateKey: 'dashboard',
                    compositionMode: 'independent',
                    baseLayoutId: null,
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
                    id: '018f8a78-7b8f-7c1d-a111-2222333344a3',
                    layoutId: 'global-layout-1',
                    zone: 'left',
                    widgetKey: 'menuWidget',
                    sortOrder: 1,
                    config: { showTitle: true, items: [] },
                    isActive: true
                },
                {
                    id: 'entity-owned-widget-1',
                    layoutId: 'object-layout-1',
                    zone: 'right',
                    widgetKey: 'productTree',
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
                    compositionMode: 'overlay',
                    templateKey: 'dashboard',
                    name: { en: 'Object override' },
                    description: null,
                    config: { showHeader: false },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutWidgetOverrides: [
                {
                    layoutId: 'object-layout-1',
                    baseWidgetId: '018f8a78-7b8f-7c1d-a111-2222333344a3',
                    zone: 'left',
                    sortOrder: 2,
                    config: { showTitle: false, items: [] },
                    isActive: false,
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
            zone: 'left',
            sortOrder: 2,
            config: { showTitle: false, items: [] },
            sourceBaseWidgetId: '018f8a78-7b8f-7c1d-a111-2222333344a3',
            isActive: false
        })
        expect(inheritedCatalogWidget?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
        expect(inheritedCatalogWidget?.id).not.toBe('018f8a78-7b8f-7c1d-a111-2222333344a3')

        expect(widgets).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'entity-owned-widget-1',
                    layoutId: 'object-layout-1',
                    zone: 'right',
                    widgetKey: 'productTree',
                    config: { compact: true }
                })
            ])
        )
    })

    it('keeps explicit scoped layout visibility flags over inherited widget-derived visibility', () => {
        const snapshot: PublishedApplicationSnapshot = {
            layouts: [
                {
                    id: 'global-layout-1',
                    templateKey: 'dashboard',
                    compositionMode: 'independent',
                    baseLayoutId: null,
                    name: { en: 'Global default' },
                    description: null,
                    config: { showDetailsTable: true },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    id: '018f8a78-7b8f-7c1d-a111-2222333344a5',
                    layoutId: 'global-layout-1',
                    zone: 'center',
                    widgetKey: 'detailsTable',
                    sortOrder: 0,
                    config: {},
                    isActive: true
                }
            ],
            scopedLayouts: [
                {
                    id: 'object-layout-1',
                    scopeEntityId: 'object-1',
                    baseLayoutId: 'global-layout-1',
                    compositionMode: 'overlay',
                    templateKey: 'dashboard',
                    name: { en: 'Object override' },
                    description: null,
                    config: { showDetailsTable: false, showColumnsContainer: true },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            defaultLayoutId: 'global-layout-1'
        }

        const layouts = normalizeSnapshotLayouts(snapshot)
        const scopedLayout = layouts.find((item) => item.id === 'object-layout-1')

        expect(scopedLayout?.config).toEqual(
            expect.objectContaining({
                showDetailsTable: false,
                showColumnsContainer: true
            })
        )
    })

    it('keeps menu widget side-menu settings out of the runtime layout config', () => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {},
            layoutConfig: {
                showSideMenu: true,
                __layout: { zoneSettings: { top: {} } }
            },
            layouts: [createGlobalDashboardLayout()],
            layoutZoneWidgets: [
                {
                    id: 'menu-widget-1',
                    layoutId: 'global-layout-1',
                    zone: 'left',
                    widgetKey: 'menuWidget',
                    sortOrder: 0,
                    config: {
                        sideMenu: {
                            availableModes: ['compact', 'overlay'],
                            primaryMode: 'compact',
                            rememberUserChoice: false
                        }
                    },
                    isActive: true
                }
            ],
            defaultLayoutId: 'global-layout-1'
        }

        expect(buildMergedDashboardLayoutConfig(snapshot)).toEqual(
            expect.objectContaining({
                showSideMenu: true,
                sideMenu: {
                    availableModes: ['wide', 'compact', 'overlay'],
                    primaryMode: 'wide',
                    rememberUserChoice: true
                }
            })
        )

        expect(() => buildMergedDashboardLayoutConfig({ ...snapshot, layoutConfig: { showHeader: 'false' } })).toThrow()
        expect(() => buildMergedDashboardLayoutConfig({ ...snapshot, layoutConfig: 'false' as never })).toThrow(
            /layoutConfig must be an object/
        )
    })

    it('drops inherited widgets that are marked as deleted overrides', () => {
        const snapshot: PublishedApplicationSnapshot = {
            layouts: [
                {
                    id: 'global-layout-1',
                    templateKey: 'dashboard',
                    compositionMode: 'independent',
                    baseLayoutId: null,
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
                    id: '018f8a78-7b8f-7c1d-a111-2222333344a4',
                    layoutId: 'global-layout-1',
                    zone: 'left',
                    widgetKey: 'menuWidget',
                    sortOrder: 1,
                    config: { showTitle: true, items: [] },
                    isActive: true
                }
            ],
            scopedLayouts: [
                {
                    id: 'object-layout-1',
                    scopeEntityId: 'object-1',
                    baseLayoutId: 'global-layout-1',
                    compositionMode: 'overlay',
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
                    baseWidgetId: '018f8a78-7b8f-7c1d-a111-2222333344a4',
                    isDeletedOverride: true
                }
            ],
            defaultLayoutId: 'global-layout-1'
        }

        const widgets = normalizeSnapshotLayoutZoneWidgets(snapshot)

        expect(widgets.some((item) => item.layoutId === 'object-layout-1' && item.widgetKey === 'menuWidget')).toBe(false)
    })

    it('rejects inactive widgets with invalid zones instead of silently reinterpreting them', () => {
        const snapshot: PublishedApplicationSnapshot = {
            layouts: [createGlobalDashboardLayout()],
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

        expect(() => normalizeSnapshotLayoutZoneWidgets(snapshot)).toThrow(/Invalid dashboard layout widget zone/)
    })

    it('rejects a dashboard override whose base widget belongs to another global layout', () => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {},
            layouts: [
                {
                    id: 'global-layout-1',
                    templateKey: 'dashboard',
                    compositionMode: 'independent',
                    baseLayoutId: null,
                    name: { en: 'Global default' },
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                },
                {
                    id: 'global-layout-2',
                    templateKey: 'dashboard',
                    compositionMode: 'independent',
                    baseLayoutId: null,
                    name: { en: 'Other dashboard' },
                    config: {},
                    isActive: true,
                    isDefault: false,
                    sortOrder: 1
                }
            ],
            layoutZoneWidgets: [
                {
                    id: 'base-widget-1',
                    layoutId: 'global-layout-1',
                    zone: 'top',
                    widgetKey: 'header',
                    sortOrder: 1,
                    config: {},
                    isActive: true
                },
                {
                    id: 'foreign-widget-1',
                    layoutId: 'global-layout-2',
                    zone: 'top',
                    widgetKey: 'header',
                    sortOrder: 1,
                    config: {},
                    isActive: true
                }
            ],
            scopedLayouts: [
                {
                    id: 'scoped-layout-1',
                    scopeEntityId: 'object-1',
                    baseLayoutId: 'global-layout-1',
                    compositionMode: 'overlay',
                    templateKey: 'dashboard',
                    name: { en: 'Scoped dashboard' },
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutWidgetOverrides: [
                {
                    layoutId: 'scoped-layout-1',
                    baseWidgetId: 'foreign-widget-1',
                    isDeletedOverride: false
                }
            ],
            defaultLayoutId: 'global-layout-1'
        }

        expect(() => normalizeSnapshotLayoutZoneWidgets(snapshot)).toThrow(/outside base layout/)
    })

    it('fails closed for malformed dashboard snapshot field types instead of coercing them', () => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {},
            layouts: [
                {
                    id: 'global-layout-1',
                    templateKey: 'dashboard',
                    compositionMode: 'independent',
                    baseLayoutId: null,
                    name: { en: 'Global default' },
                    config: 'false',
                    isActive: 'false',
                    isDefault: true,
                    sortOrder: '1'
                } as never
            ],
            layoutZoneWidgets: [
                {
                    id: 'base-widget-1',
                    layoutId: 'global-layout-1',
                    zone: 'top',
                    widgetKey: 'header',
                    sortOrder: 1,
                    config: {},
                    isActive: 'false'
                } as never
            ],
            defaultLayoutId: 'global-layout-1'
        }

        expect(() => normalizeSnapshotLayouts(snapshot)).toThrow(/config must be an object/)

        snapshot.layouts![0]!.config = { showHeader: 'false' }
        expect(() => normalizeSnapshotLayouts(snapshot)).toThrow(/invalid dashboard configuration/)

        snapshot.layouts![0]!.config = []
        expect(() => normalizeSnapshotLayouts(snapshot)).toThrow(/config must be an object/)

        snapshot.layouts![0]!.config = {}
        expect(() => normalizeSnapshotLayouts(snapshot)).toThrow(/isActive must be a boolean/)

        snapshot.layouts![0]!.isActive = true
        snapshot.layouts![0]!.sortOrder = 1
        expect(() => normalizeSnapshotLayoutZoneWidgets(snapshot)).toThrow(/isActive must be a boolean/)

        snapshot.layoutZoneWidgets![0]!.isActive = true
        snapshot.layoutZoneWidgets![0]!.sourceLineageKey = 42
        expect(() => normalizeSnapshotLayoutZoneWidgets(snapshot)).toThrow(/sourceLineageKey/)

        snapshot.layoutZoneWidgets![0]!.sourceLineageKey = undefined
        snapshot.defaultLayoutId = 42
        expect(() => normalizeSnapshotLayouts(snapshot)).toThrow(/defaultLayoutId/)
    })

    it('fails closed for malformed scoped dashboard layout configuration', () => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {},
            layouts: [
                {
                    id: 'global-layout-1',
                    templateKey: 'dashboard',
                    compositionMode: 'independent',
                    baseLayoutId: null,
                    name: { en: 'Global default' },
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            scopedLayouts: [
                {
                    id: 'scoped-layout-1',
                    scopeEntityId: 'object-1',
                    baseLayoutId: 'global-layout-1',
                    compositionMode: 'overlay',
                    templateKey: 'dashboard',
                    name: { en: 'Scoped dashboard' },
                    config: { showHeader: 'false' },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [],
            layoutWidgetOverrides: [],
            defaultLayoutId: 'global-layout-1'
        }

        expect(() => normalizeSnapshotLayouts(snapshot)).toThrow(/invalid dashboard configuration/)
    })
})
