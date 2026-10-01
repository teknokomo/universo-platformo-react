import {
    buildSingleTargetWidgetBinding,
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    normalizeSnapshotLayoutZoneWidgets,
    normalizeSnapshotLayouts,
    materializeSnapshotLayoutsAndWidgets,
    buildRuntimeSnapshotForApplicationSync
} from './syncLayoutMaterializationHarness'
import type { EntityDefinition, PublishedApplicationSnapshot } from './syncLayoutMaterializationHarness'

describe('sync layout snapshot normalization and marketing overlays', () => {
    it('fails closed when a global snapshot layout omits explicit composition metadata', () => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {},
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
            layoutZoneWidgets: [],
            defaultLayoutId: 'global-layout-1'
        }

        expect(() => normalizeSnapshotLayouts(snapshot)).toThrow('missing an explicit composition mode')
    })

    it('preserves marketing layouts and never injects dashboard widgets', () => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {},
            layouts: [
                {
                    id: 'marketing-layout',
                    templateKey: 'marketing-page',
                    compositionMode: 'independent',
                    baseLayoutId: null,
                    name: { en: 'Marketing' },
                    description: null,
                    config: { themeMode: 'light' },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [],
            defaultLayoutId: 'marketing-layout'
        }

        const runtimeSnapshot = buildRuntimeSnapshotForApplicationSync(snapshot, [])

        expect(runtimeSnapshot.layouts?.[0]).toMatchObject({ templateKey: 'marketing-page', config: snapshot.layouts?.[0]?.config })
        expect(normalizeSnapshotLayoutZoneWidgets(runtimeSnapshot)).toEqual([])
    })

    it('persists validated marketing layout and widget defaults during materialization', () => {
        const heroDefinition = getLayoutWidgetDefinition('marketing.hero')
        if (!heroDefinition) throw new Error('Expected marketing.hero to be registered')
        const heroBindings = buildSingleTargetWidgetBinding(heroDefinition, 'content', {
            entityKind: 'object',
            entityCodename: 'MarketingPageHero',
            semanticKey: 'default'
        })
        const heroConfigContext = { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
        const snapshot: PublishedApplicationSnapshot = {
            entities: {},
            layouts: [
                {
                    id: 'marketing-layout',
                    templateKey: 'marketing-page',
                    compositionMode: 'independent',
                    baseLayoutId: null,
                    name: { en: 'Marketing' },
                    description: null,
                    config: { themeMode: 'light' },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    id: 'marketing-hero',
                    layoutId: 'marketing-layout',
                    zone: 'marketing-main',
                    widgetKey: 'marketing.hero',
                    sortOrder: 0,
                    config: encodeWidgetConfigEnvelope(
                        {
                            rendererConfig: { instanceKey: 'hero', showLeadForm: true },
                            neutral: { bindings: heroBindings }
                        },
                        heroConfigContext
                    ),
                    isActive: true
                }
            ],
            defaultLayoutId: 'marketing-layout'
        }

        const layouts = normalizeSnapshotLayouts(snapshot)
        const widgets = normalizeSnapshotLayoutZoneWidgets(snapshot)

        expect(layouts[0]?.config).toMatchObject({
            themeMode: 'light',
            allowEmailActions: true,
            allowTelephoneActions: true,
            externalLinkTarget: 'new-tab'
        })
        const normalizedWidgetConfig = decodeWidgetConfigEnvelope(widgets[0]?.config, {
            ...heroConfigContext
        })
        expect(normalizedWidgetConfig.rendererConfig).toMatchObject({ instanceKey: 'hero', showLeadForm: true })
        expect(normalizedWidgetConfig.neutral.bindings).toEqual(heroBindings)
    })

    it('materializes marketing overlay config deltas without copying base bindings', () => {
        const baseLayoutId = '0190a9b5-3cde-7abc-8def-0123456789a1'
        const scopedLayoutId = '0190a9b5-3cde-7abc-8def-0123456789a2'
        const baseWidgetId = '0190a9b5-3cde-7abc-8def-0123456789a3'
        const heroDefinition = getLayoutWidgetDefinition('marketing.hero')
        if (!heroDefinition) throw new Error('Expected marketing.hero to be registered')
        const bindings = buildSingleTargetWidgetBinding(heroDefinition, 'content', {
            entityKind: 'object',
            entityCodename: 'MarketingPageHero',
            semanticKey: 'base-hero'
        })
        const context = { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
        const baseConfig = encodeWidgetConfigEnvelope(
            { rendererConfig: { instanceKey: 'hero-placement', showLeadForm: true }, neutral: { bindings } },
            context
        )
        const authContext = { templateKey: 'marketing-page', widgetKey: 'marketing.auth', zone: 'marketing-header' }
        const baseAuthConfig = encodeWidgetConfigEnvelope(
            { rendererConfig: { instanceKey: 'auth', showAuthActions: true }, neutral: { placement: 'end' } },
            authContext
        )
        const baseOverride = {
            layoutId: scopedLayoutId,
            baseWidgetId,
            zone: 'marketing-main',
            config: {
                instanceKey: 'hero-placement',
                showLeadForm: false
            },
            isDeletedOverride: false
        }
        const authOverride = {
            layoutId: scopedLayoutId,
            baseWidgetId: 'marketing-auth',
            zone: 'marketing-header',
            config: encodeWidgetConfigEnvelope(
                { rendererConfig: { instanceKey: 'auth', showAuthActions: false }, neutral: { placement: 'start' } },
                authContext
            ),
            isDeletedOverride: false
        }
        const snapshot: PublishedApplicationSnapshot = {
            entities: {},
            layouts: [
                {
                    id: baseLayoutId,
                    templateKey: 'marketing-page',
                    compositionMode: 'independent',
                    baseLayoutId: null,
                    name: { en: 'Marketing base' },
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
                    scopeEntityId: '0190a9b5-3cde-7abc-8def-0123456789a4',
                    baseLayoutId,
                    compositionMode: 'overlay',
                    templateKey: 'marketing-page',
                    name: { en: 'Scoped marketing' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    id: baseWidgetId,
                    layoutId: baseLayoutId,
                    zone: 'marketing-main',
                    widgetKey: 'marketing.hero',
                    sortOrder: 0,
                    config: baseConfig,
                    isActive: true
                },
                {
                    id: 'marketing-auth',
                    layoutId: baseLayoutId,
                    zone: 'marketing-header',
                    widgetKey: 'marketing.auth',
                    sortOrder: 1,
                    config: baseAuthConfig,
                    isActive: true
                }
            ],
            layoutWidgetOverrides: [baseOverride, authOverride],
            defaultLayoutId: baseLayoutId
        }

        const materialized = materializeSnapshotLayoutsAndWidgets(snapshot)
        const scopedWidget = materialized.widgets.find(
            (widget) => widget.layoutId === scopedLayoutId && widget.widgetKey === 'marketing.hero'
        )
        const scopedConfig = decodeWidgetConfigEnvelope(scopedWidget?.config, context)
        expect(scopedConfig.rendererConfig).toMatchObject({ instanceKey: 'hero-placement', showLeadForm: false })
        expect(scopedConfig.neutral.placement).toBeUndefined()
        expect(scopedConfig.neutral.bindings).toBeUndefined()
        expect(decodeWidgetConfigEnvelope(baseConfig, context).neutral.bindings).toEqual(bindings)
        const scopedAuth = materialized.widgets.find(
            (widget) => widget.layoutId === scopedLayoutId && widget.widgetKey === 'marketing.auth'
        )
        const scopedAuthConfig = decodeWidgetConfigEnvelope(scopedAuth?.config, authContext)
        expect(scopedAuthConfig.rendererConfig).toEqual({ instanceKey: 'auth', showAuthActions: false })
        expect(scopedAuthConfig.neutral.placement).toBe('start')
        expect(scopedAuthConfig.neutral.bindings).toBeUndefined()

        const differentBindings = buildSingleTargetWidgetBinding(heroDefinition, 'content', {
            entityKind: 'object',
            entityCodename: 'MarketingPageHero',
            semanticKey: 'different-hero'
        })
        const snapshotWithOverlayBinding: PublishedApplicationSnapshot = {
            ...snapshot,
            layoutWidgetOverrides: [
                {
                    ...baseOverride,
                    config: encodeWidgetConfigEnvelope(
                        {
                            rendererConfig: { instanceKey: 'hero-placement', showLeadForm: false },
                            neutral: { bindings: differentBindings }
                        },
                        context
                    )
                }
            ]
        }
        expect(() => materializeSnapshotLayoutsAndWidgets(snapshotWithOverlayBinding)).toThrow('cannot contain entity bindings')

        const snapshotWithOverlayOwnedBinding: PublishedApplicationSnapshot = {
            ...snapshot,
            layoutZoneWidgets: [
                ...(snapshot.layoutZoneWidgets ?? []),
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789a7',
                    layoutId: scopedLayoutId,
                    zone: 'marketing-main',
                    widgetKey: 'marketing.hero',
                    sortOrder: 2,
                    config: encodeWidgetConfigEnvelope(
                        { rendererConfig: { instanceKey: 'overlay-owned-hero' }, neutral: { bindings } },
                        context
                    ),
                    isActive: true
                }
            ]
        }
        expect(() => materializeSnapshotLayoutsAndWidgets(snapshotWithOverlayOwnedBinding)).toThrow(
            `Marketing overlay layout ${scopedLayoutId} cannot own Entity bindings`
        )
    })

    it('rejects dashboard widgets attached to a marketing layout instead of silently rendering them', () => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {},
            layouts: [
                {
                    id: 'marketing-layout',
                    templateKey: 'marketing-page',
                    compositionMode: 'independent',
                    baseLayoutId: null,
                    name: { en: 'Marketing' },
                    description: null,
                    config: { themeMode: 'light' },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    id: 'invalid-widget',
                    layoutId: 'marketing-layout',
                    zone: 'marketing-main',
                    widgetKey: 'detailsTable',
                    sortOrder: 1,
                    config: {},
                    isActive: true
                }
            ]
        }

        expect(() => normalizeSnapshotLayoutZoneWidgets(snapshot)).toThrow(/not allowed/)
    })

    it('rejects duplicate Dashboard singleton definitions during materialization', () => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {},
            layouts: [
                {
                    id: 'dashboard-layout',
                    templateKey: 'dashboard',
                    compositionMode: 'independent',
                    baseLayoutId: null,
                    name: { en: 'Dashboard' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    id: 'navbar-one',
                    layoutId: 'dashboard-layout',
                    zone: 'top',
                    widgetKey: 'appNavbar',
                    sortOrder: 0,
                    config: {},
                    isActive: true
                },
                {
                    id: 'navbar-two',
                    layoutId: 'dashboard-layout',
                    zone: 'top',
                    widgetKey: 'appNavbar',
                    sortOrder: 1,
                    config: {},
                    isActive: true
                }
            ],
            defaultLayoutId: 'dashboard-layout'
        }

        expect(() => materializeSnapshotLayoutsAndWidgets(snapshot)).toThrow('duplicate singleton widget appNavbar')
    })

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
                },
                {
                    id: 'non-menu-widget',
                    layoutId: 'global-layout-1',
                    zone: 'top',
                    widgetKey: 'header',
                    sortOrder: 2,
                    config: {},
                    isActive: true
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
})
