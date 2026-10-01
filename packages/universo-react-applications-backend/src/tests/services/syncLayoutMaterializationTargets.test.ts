import {
    normalizeSnapshotLayoutZoneWidgets,
    remapSnapshotLayoutScopeEntityIds,
    remapSnapshotMenuWidgetTargets,
    createGlobalDashboardLayout
} from './syncLayoutMaterializationHarness'
import type { EntityDefinition, PublishedApplicationSnapshot } from './syncLayoutMaterializationHarness'

describe('sync layout entity and menu target remapping', () => {
    it('remaps snapshot scoped layout entity ids to runtime entity ids by codename', () => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {
                'snapshot-course-items': {
                    id: 'snapshot-course-items',
                    kind: 'object',
                    codename: { _primary: 'en', locales: { en: { content: 'CourseItems' } } }
                }
            },
            layouts: [createGlobalDashboardLayout()],
            scopedLayouts: [
                {
                    id: 'course-items-layout',
                    scopeEntityId: 'snapshot-course-items',
                    baseLayoutId: 'global-layout-1',
                    compositionMode: 'overlay',
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
            layouts: [createGlobalDashboardLayout()],
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
            layouts: [createGlobalDashboardLayout()],
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
            layouts: [createGlobalDashboardLayout()],
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
            layouts: [createGlobalDashboardLayout()],
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
            layouts: [createGlobalDashboardLayout()],
            scopedLayouts: [
                {
                    id: 'structure-layout',
                    scopeEntityId: 'snapshot-structure-object',
                    baseLayoutId: 'global-layout-1',
                    compositionMode: 'overlay',
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
                    id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
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
                },
                {
                    id: 'non-menu-widget',
                    layoutId: 'global-layout-1',
                    zone: 'top',
                    widgetKey: 'header',
                    sortOrder: 2,
                    isActive: true,
                    config: {}
                }
            ],
            layoutWidgetOverrides: [
                {
                    layoutId: 'structure-layout',
                    baseWidgetId: '018f8a78-7b8f-7c1d-a111-2222333344a1',
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
            (item) => item.layoutId === 'structure-layout' && item.sourceBaseWidgetId === '018f8a78-7b8f-7c1d-a111-2222333344a1'
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
})
