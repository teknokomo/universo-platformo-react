import type { EntityDefinition } from '@universo-react/schema-ddl'
import {
    buildMergedDashboardLayoutConfig,
    normalizeSnapshotLayoutZoneWidgets,
    normalizeSnapshotLayouts,
    remapSnapshotLayoutScopeEntityIds,
    remapSnapshotMenuWidgetTargets,
    withWorkspaceRuntimeLayoutWidgets
} from '../../routes/sync/syncHelpers'
import { buildRuntimeSnapshotForApplicationSync } from '../../routes/sync/syncEngine'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'

describe('sync layout materialization helpers', () => {
    it('builds the same runtime snapshot for sync apply and preview comparisons', () => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {
                'snapshot-intro-page': {
                    id: 'snapshot-intro-page',
                    kind: 'page',
                    codename: { _primary: 'en', locales: { en: { content: 'InterpretationNetworkIntro' } } },
                    fields: []
                },
                'snapshot-structure-object': {
                    id: 'snapshot-structure-object',
                    kind: 'object',
                    codename: { _primary: 'en', locales: { en: { content: 'Structure' } } },
                    fields: []
                }
            },
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
                    id: 'menu-widget',
                    layoutId: 'global-layout-1',
                    zone: 'left',
                    widgetKey: 'menuWidget',
                    sortOrder: 1,
                    isActive: true,
                    config: {
                        showTitle: false,
                        title: { _primary: 'en', locales: { en: { content: 'Menu' } } },
                        autoShowAllSections: false,
                        startPage: 'InterpretationNetworkIntro',
                        items: [
                            {
                                id: 'intro',
                                kind: 'section',
                                title: { _primary: 'en', locales: { en: { content: 'Intro' } } },
                                sectionId: 'InterpretationNetworkIntro',
                                sortOrder: 1,
                                isActive: true
                            },
                            {
                                id: 'structures',
                                kind: 'section',
                                title: { _primary: 'en', locales: { en: { content: 'Structures' } } },
                                sectionId: 'Structure',
                                objectCollectionId: 'Structure',
                                sortOrder: 2,
                                isActive: true
                            }
                        ]
                    }
                }
            ],
            defaultLayoutId: 'global-layout-1'
        }
        const runtimeEntities = [
            {
                id: 'runtime-intro-page',
                kind: 'page',
                codename: { _primary: 'en', locales: { en: { content: 'InterpretationNetworkIntro' } } }
            },
            {
                id: 'runtime-structure-object',
                kind: 'object',
                codename: { _primary: 'en', locales: { en: { content: 'Structure' } } }
            }
        ] as EntityDefinition[]

        const runtimeSnapshot = buildRuntimeSnapshotForApplicationSync(snapshot, runtimeEntities)
        const widgets = normalizeSnapshotLayoutZoneWidgets(runtimeSnapshot)
        const menu = widgets.find((item) => item.id === 'menu-widget')

        expect(menu?.config).toMatchObject({
            startPage: 'runtime-intro-page',
            startTarget: { kind: 'section', sectionId: 'runtime-intro-page' },
            items: [
                expect.objectContaining({
                    sectionId: 'runtime-intro-page',
                    objectCollectionId: null
                }),
                expect.objectContaining({
                    sectionId: null,
                    objectCollectionId: 'runtime-structure-object'
                })
            ]
        })
    })

    it('remaps snapshot scoped layout entity ids to runtime entity ids by codename', () => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {
                'snapshot-course-items': {
                    id: 'snapshot-course-items',
                    kind: 'object',
                    codename: { _primary: 'en', locales: { en: { content: 'CourseItems' } } }
                }
            },
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
            scopedLayouts: [
                {
                    id: 'course-items-layout',
                    scopeEntityId: 'snapshot-course-items',
                    baseLayoutId: 'global-layout-1',
                    templateKey: 'dashboard',
                    name: { en: 'Course Items' },
                    description: null,
                    config: { showColumnsContainer: true },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            defaultLayoutId: 'global-layout-1'
        }
        const runtimeEntities = [
            {
                id: 'runtime-course-items',
                kind: 'object',
                codename: { _primary: 'en', locales: { en: { content: 'CourseItems' } } }
            }
        ] as EntityDefinition[]

        const remapped = remapSnapshotLayoutScopeEntityIds(snapshot, runtimeEntities)

        expect(remapped.scopedLayouts?.[0]?.scopeEntityId).toBe('runtime-course-items')
    })

    it('remaps menu widget target tokens to runtime UUID targets before widget materialization', () => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {
                'snapshot-intro-page': {
                    id: 'snapshot-intro-page',
                    kind: 'page',
                    codename: { _primary: 'en', locales: { en: { content: 'InterpretationNetworkIntro' } } },
                    fields: []
                },
                'snapshot-structure-object': {
                    id: 'snapshot-structure-object',
                    kind: 'object',
                    codename: { _primary: 'en', locales: { en: { content: 'Structure' } } },
                    fields: []
                }
            },
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
                    id: 'menu-widget',
                    layoutId: 'global-layout-1',
                    zone: 'left',
                    widgetKey: 'menuWidget',
                    sortOrder: 1,
                    isActive: true,
                    config: {
                        showTitle: false,
                        title: { _primary: 'en', locales: { en: { content: 'Menu' } } },
                        autoShowAllSections: false,
                        startPage: 'InterpretationNetworkIntro',
                        items: [
                            {
                                id: 'intro',
                                kind: 'section',
                                title: { _primary: 'en', locales: { en: { content: 'Intro' } } },
                                sectionId: 'InterpretationNetworkIntro',
                                sortOrder: 1,
                                isActive: true
                            },
                            {
                                id: 'structures',
                                kind: 'section',
                                title: { _primary: 'en', locales: { en: { content: 'Structures' } } },
                                sectionId: 'Structure',
                                objectCollectionId: 'Structure',
                                sortOrder: 2,
                                isActive: true
                            }
                        ]
                    }
                }
            ],
            defaultLayoutId: 'global-layout-1'
        }
        const runtimeEntities = [
            {
                id: 'runtime-intro-page',
                kind: 'page',
                codename: { _primary: 'en', locales: { en: { content: 'InterpretationNetworkIntro' } } }
            },
            {
                id: 'runtime-structure-object',
                kind: 'object',
                codename: { _primary: 'en', locales: { en: { content: 'Structure' } } }
            }
        ] as EntityDefinition[]

        const remapped = remapSnapshotMenuWidgetTargets(snapshot, runtimeEntities)
        const widgets = normalizeSnapshotLayoutZoneWidgets(remapped)
        const menu = widgets.find((item) => item.id === 'menu-widget')

        expect(menu?.config).toMatchObject({
            startPage: 'runtime-intro-page',
            startTarget: { kind: 'section', sectionId: 'runtime-intro-page' },
            items: [
                expect.objectContaining({
                    sectionId: 'runtime-intro-page',
                    objectCollectionId: null
                }),
                expect.objectContaining({
                    sectionId: null,
                    objectCollectionId: 'runtime-structure-object'
                })
            ]
        })
        expect(
            (snapshot.layoutZoneWidgets?.[0] as { config?: { items?: Array<{ sectionId?: string | null }> } }).config?.items?.[0]?.sectionId
        ).toBe('InterpretationNetworkIntro')
    })

    it.each(['catalog', 'document', 'custom-record-kind'])('remaps %s runtime entities as object collection menu targets', (kind) => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {
                'snapshot-records': {
                    id: 'snapshot-records',
                    kind,
                    codename: { _primary: 'en', locales: { en: { content: 'Records' } } },
                    fields: []
                }
            },
            layouts: [],
            layoutZoneWidgets: [
                {
                    id: 'menu-widget',
                    layoutId: 'global-layout',
                    zone: 'left',
                    widgetKey: 'menuWidget',
                    sortOrder: 1,
                    isActive: true,
                    config: {
                        startPage: 'Records',
                        items: [
                            {
                                id: 'records',
                                kind: 'section',
                                title: { _primary: 'en', locales: { en: { content: 'Records' } } },
                                sectionId: 'Records',
                                objectCollectionId: 'Records',
                                sortOrder: 1,
                                isActive: true
                            }
                        ]
                    }
                }
            ],
            defaultLayoutId: null
        }
        const runtimeEntities = [
            {
                id: 'runtime-records',
                kind,
                codename: { _primary: 'en', locales: { en: { content: 'Records' } } }
            }
        ] as EntityDefinition[]

        const remapped = remapSnapshotMenuWidgetTargets(snapshot, runtimeEntities)

        expect(remapped.layoutZoneWidgets?.[0]?.config).toMatchObject({
            startPage: 'runtime-records',
            startTarget: { kind: 'objectCollection', objectCollectionId: 'runtime-records' },
            items: [
                expect.objectContaining({
                    sectionId: null,
                    objectCollectionId: 'runtime-records'
                })
            ]
        })
    })

    it('keeps menu-item start pages stable while materializing their section targets', () => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {
                'snapshot-structure-object': {
                    id: 'snapshot-structure-object',
                    kind: 'object',
                    codename: { _primary: 'en', locales: { en: { content: 'Structure' } } },
                    fields: []
                }
            },
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
                    id: 'menu-widget',
                    layoutId: 'global-layout-1',
                    zone: 'left',
                    widgetKey: 'menuWidget',
                    sortOrder: 1,
                    isActive: true,
                    config: {
                        showTitle: false,
                        title: { _primary: 'en', locales: { en: { content: 'Menu' } } },
                        autoShowAllSections: false,
                        startPage: 'structures',
                        startTarget: { kind: 'objectCollection', objectCollectionId: 'Structure' },
                        items: [
                            {
                                id: 'structures',
                                kind: 'section',
                                title: { _primary: 'en', locales: { en: { content: 'Structures' } } },
                                sectionId: 'DeletedStructureAlias',
                                objectCollectionId: 'Structure',
                                sortOrder: 1,
                                isActive: true
                            }
                        ]
                    }
                }
            ],
            defaultLayoutId: 'global-layout-1'
        }
        const runtimeEntities = [
            {
                id: 'runtime-structure-object',
                kind: 'object',
                codename: { _primary: 'en', locales: { en: { content: 'Structure' } } }
            }
        ] as EntityDefinition[]

        const remapped = remapSnapshotMenuWidgetTargets(snapshot, runtimeEntities)
        const widgets = normalizeSnapshotLayoutZoneWidgets(remapped)
        const menu = widgets.find((item) => item.id === 'menu-widget')

        expect(menu?.config).toMatchObject({
            startPage: 'structures',
            startTarget: { kind: 'menuItem', menuItemId: 'structures' },
            items: [
                expect.objectContaining({
                    sectionId: null,
                    objectCollectionId: 'runtime-structure-object'
                })
            ]
        })
    })

    it('materializes tree-entity menu targets without collapsing them to hub targets', () => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {
                'snapshot-main-hub': {
                    id: 'snapshot-main-hub',
                    kind: 'tree-entity',
                    codename: { _primary: 'en', locales: { en: { content: 'MainHub' } } },
                    fields: []
                }
            },
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
                    id: 'menu-widget',
                    layoutId: 'global-layout-1',
                    zone: 'left',
                    widgetKey: 'menuWidget',
                    sortOrder: 1,
                    isActive: true,
                    config: {
                        showTitle: false,
                        autoShowAllSections: false,
                        boundTreeEntityId: 'MainHub',
                        startPage: 'MainHub',
                        startTarget: { kind: 'treeEntity', treeEntityId: 'MainHub' },
                        items: [
                            {
                                id: 'main-hub',
                                kind: 'hub',
                                title: { _primary: 'en', locales: { en: { content: 'Main hub' } } },
                                hubId: null,
                                treeEntityId: 'MainHub',
                                sortOrder: 1,
                                isActive: true
                            }
                        ]
                    }
                }
            ],
            defaultLayoutId: 'global-layout-1'
        }
        const runtimeEntities = [
            {
                id: 'runtime-main-hub',
                kind: 'tree-entity',
                codename: { _primary: 'en', locales: { en: { content: 'MainHub' } } }
            }
        ] as EntityDefinition[]

        const remapped = remapSnapshotMenuWidgetTargets(snapshot, runtimeEntities)
        const widgets = normalizeSnapshotLayoutZoneWidgets(remapped)
        const menu = widgets.find((item) => item.id === 'menu-widget')

        expect(menu?.config).toMatchObject({
            boundHubId: null,
            boundTreeEntityId: 'runtime-main-hub',
            startPage: 'runtime-main-hub',
            startTarget: { kind: 'treeEntity', treeEntityId: 'runtime-main-hub' },
            items: [
                expect.objectContaining({
                    hubId: null,
                    treeEntityId: 'runtime-main-hub'
                })
            ]
        })
    })

    it('leaves menu targets unresolved when snapshot and runtime entity kinds disagree', () => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {
                'snapshot-intro-page': {
                    id: 'snapshot-intro-page',
                    kind: 'page',
                    codename: { _primary: 'en', locales: { en: { content: 'SharedCodename' } } },
                    fields: []
                }
            },
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
                    id: 'menu-widget',
                    layoutId: 'global-layout-1',
                    zone: 'left',
                    widgetKey: 'menuWidget',
                    sortOrder: 1,
                    isActive: true,
                    config: {
                        startPage: 'snapshot-intro-page',
                        startTarget: { kind: 'section', sectionId: 'snapshot-intro-page' },
                        items: [
                            {
                                id: 'intro',
                                kind: 'section',
                                title: { _primary: 'en', locales: { en: { content: 'Intro' } } },
                                sectionId: 'snapshot-intro-page',
                                sortOrder: 1,
                                isActive: true
                            }
                        ]
                    }
                }
            ],
            defaultLayoutId: 'global-layout-1'
        }
        const runtimeEntities = [
            {
                id: 'runtime-object',
                kind: 'object',
                codename: { _primary: 'en', locales: { en: { content: 'SharedCodename' } } }
            }
        ] as EntityDefinition[]

        const remapped = remapSnapshotMenuWidgetTargets(snapshot, runtimeEntities)
        const widgets = normalizeSnapshotLayoutZoneWidgets(remapped)
        const menu = widgets.find((item) => item.id === 'menu-widget')

        expect(menu?.config).toMatchObject({
            startPage: 'snapshot-intro-page',
            startTarget: { kind: 'section', sectionId: 'snapshot-intro-page' },
            items: [
                expect.objectContaining({
                    sectionId: null,
                    objectCollectionId: null
                })
            ]
        })
    })

    it('remaps scoped menu widget override targets before scoped widget materialization', () => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {
                'snapshot-structure-object': {
                    id: 'snapshot-structure-object',
                    kind: 'object',
                    codename: { _primary: 'en', locales: { en: { content: 'Structure' } } },
                    fields: []
                }
            },
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
            scopedLayouts: [
                {
                    id: 'structure-layout',
                    scopeEntityId: 'snapshot-structure-object',
                    baseLayoutId: 'global-layout-1',
                    templateKey: 'dashboard',
                    name: { en: 'Structure layout' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    id: 'base-menu-widget',
                    layoutId: 'global-layout-1',
                    zone: 'left',
                    widgetKey: 'menuWidget',
                    sortOrder: 1,
                    isActive: true,
                    config: {
                        showTitle: false,
                        autoShowAllSections: false,
                        startPage: 'base-menu-item',
                        items: [
                            {
                                id: 'base-menu-item',
                                kind: 'section',
                                title: { _primary: 'en', locales: { en: { content: 'Base' } } },
                                sectionId: 'Structure',
                                objectCollectionId: 'Structure',
                                sortOrder: 1,
                                isActive: true
                            }
                        ]
                    }
                }
            ],
            layoutWidgetOverrides: [
                {
                    layoutId: 'structure-layout',
                    baseWidgetId: 'base-menu-widget',
                    config: {
                        showTitle: false,
                        autoShowAllSections: false,
                        startPage: 'Structure',
                        startTarget: { kind: 'objectCollection', objectCollectionId: 'Structure' },
                        items: [
                            {
                                id: 'structure-override',
                                kind: 'section',
                                title: { _primary: 'en', locales: { en: { content: 'Structure' } } },
                                sectionId: 'Structure',
                                objectCollectionId: 'Structure',
                                sortOrder: 1,
                                isActive: true
                            }
                        ]
                    }
                },
                {
                    layoutId: 'structure-layout',
                    baseWidgetId: 'non-menu-widget',
                    config: {
                        datasource: { kind: 'records.list', target: 'Structure' }
                    }
                }
            ],
            defaultLayoutId: 'global-layout-1'
        }
        const runtimeEntities = [
            {
                id: 'runtime-structure-object',
                kind: 'object',
                codename: { _primary: 'en', locales: { en: { content: 'Structure' } } }
            }
        ] as EntityDefinition[]

        const remapped = remapSnapshotMenuWidgetTargets(snapshot, runtimeEntities)
        const menuOverride = remapped.layoutWidgetOverrides?.[0] as { config?: Record<string, unknown> }
        const untouchedOverride = remapped.layoutWidgetOverrides?.[1] as { config?: Record<string, unknown> }
        const widgets = normalizeSnapshotLayoutZoneWidgets(remapped)
        const inheritedScopedMenu = widgets.find(
            (item) => item.layoutId === 'structure-layout' && item.sourceBaseWidgetId === 'base-menu-widget'
        )

        expect(menuOverride.config).toMatchObject({
            startPage: 'runtime-structure-object',
            startTarget: { kind: 'objectCollection', objectCollectionId: 'runtime-structure-object' },
            items: [
                expect.objectContaining({
                    sectionId: null,
                    objectCollectionId: 'runtime-structure-object'
                })
            ]
        })
        expect(untouchedOverride.config).toEqual({ datasource: { kind: 'records.list', target: 'Structure' } })
        expect(inheritedScopedMenu?.config).toMatchObject({
            startPage: 'runtime-structure-object',
            startTarget: { kind: 'objectCollection', objectCollectionId: 'runtime-structure-object' },
            items: [
                expect.objectContaining({
                    objectCollectionId: 'runtime-structure-object'
                })
            ]
        })
    })

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

    it('keeps explicit scoped layout visibility flags over inherited widget-derived visibility', () => {
        const snapshot: PublishedApplicationSnapshot = {
            layouts: [
                {
                    id: 'global-layout-1',
                    templateKey: 'dashboard',
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
                    id: 'global-details-table',
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
            layoutConfig: { showSideMenu: true },
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
