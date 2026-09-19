import { describe, expect, it } from 'vitest'

import {
    validateMarketingSnapshotLayouts,
    validateMarketingSnapshotTransportLayouts,
    validateSnapshotLayoutIdentities,
    validateSnapshotLayoutNeutralMetadata,
    type MarketingSnapshotLike
} from '../marketingSnapshot'

const ids = {
    layout: '0190a9b5-3cde-7abc-8def-0123456789a1',
    secondLayout: '0190a9b5-3cde-7abc-8def-0123456789a2',
    widget: '0190a9b5-3cde-7abc-8def-0123456789a3',
    secondWidget: '0190a9b5-3cde-7abc-8def-0123456789a4',
    scopedLayout: '0190a9b5-3cde-7abc-8def-0123456789a5',
    override: '0190a9b5-3cde-7abc-8def-0123456789a6',
    scopeEntity: '0190a9b5-3cde-7abc-8def-0123456789a7'
} as const

const entities = {
    [ids.scopeEntity]: { kind: 'object', codename: 'MarketingPageSiteSettings' },
    logos: { kind: 'object', codename: 'MarketingPageLogo' },
    features: { kind: 'object', codename: 'MarketingPageFeature' },
    pricing: { kind: 'object', codename: 'MarketingPagePricing' },
    benefits: { kind: 'object', codename: 'MarketingPagePricingBenefit' }
}

const collectionWidget = (id: string, instanceKey: string, sourceCodename = 'MarketingPageLogo') => ({
    id,
    layoutId: ids.layout,
    zone: 'marketing-main',
    widgetKey: 'marketing.collection',
    sortOrder: 0,
    config: {
        instanceKey,
        source: { entityCodename: sourceCodename, entityKind: 'object' },
        variant: sourceCodename === 'MarketingPageFeature' ? 'features' : 'logos'
    },
    isActive: true
})

const createSnapshot = (widgets: unknown[] = [collectionWidget(ids.widget, 'logos')]): MarketingSnapshotLike => ({
    entities: { ...entities },
    layouts: [
        {
            id: ids.layout,
            templateKey: 'marketing-page',
            name: { en: 'Marketing page' },
            config: {},
            isDefault: true,
            isActive: true,
            sortOrder: 0,
            compositionMode: 'independent',
            baseLayoutId: null
        }
    ],
    defaultLayoutId: ids.layout,
    layoutConfig: {},
    layoutZoneWidgets: widgets
})

describe('validateMarketingSnapshotLayouts', () => {
    it('accepts valid repeatable collection widgets', () => {
        expect(() =>
            validateMarketingSnapshotLayouts(
                createSnapshot([
                    collectionWidget(ids.widget, 'logos'),
                    collectionWidget(ids.secondWidget, 'features', 'MarketingPageFeature')
                ])
            )
        ).not.toThrow()
    })

    it('accepts static image widgets without an entity source', () => {
        const image = {
            id: ids.secondWidget,
            layoutId: ids.layout,
            zone: 'marketing-main',
            widgetKey: 'marketing.image',
            sortOrder: 1,
            config: {
                instanceKey: 'hero-image',
                media: {
                    kind: 'hero',
                    resource: { type: 'url', url: 'https://example.test/hero.webp', launchMode: 'inline' },
                    decorative: true
                }
            },
            isActive: true
        }

        expect(() => validateMarketingSnapshotLayouts(createSnapshot([collectionWidget(ids.widget, 'logos'), image]))).not.toThrow()
    })

    it('rejects an empty or inactive marketing composition', () => {
        expect(() => validateMarketingSnapshotLayouts(createSnapshot([]))).toThrow('at least one active widget')

        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets![0]!.isActive = false
        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('at least one active widget')
    })

    it('requires the referenced global layout to be explicitly default and active', () => {
        const snapshot = createSnapshot()
        snapshot.layouts![0]!.isDefault = false
        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('active and marked as default')
    })

    it('accepts repeated widget keys and rejects duplicate instance keys', () => {
        const hero = (id: string, instanceKey = 'hero') => ({
            id,
            layoutId: ids.layout,
            zone: 'marketing-main',
            widgetKey: 'marketing.hero',
            sortOrder: 0,
            config: {
                instanceKey,
                source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' }
            },
            isActive: true
        })

        expect(() =>
            validateMarketingSnapshotLayouts(createSnapshot([hero(ids.widget), hero(ids.secondWidget, 'hero-second')]))
        ).not.toThrow()
        expect(() =>
            validateMarketingSnapshotLayouts(
                createSnapshot([collectionWidget(ids.widget, 'same'), collectionWidget(ids.secondWidget, 'same')])
            )
        ).toThrow('duplicate widget instance keys')
    })

    it('rejects missing source entities, invalid zones, and non-v7 identifiers', () => {
        const missingSource = createSnapshot()
        delete missingSource.entities?.logos
        expect(() => validateMarketingSnapshotLayouts(missingSource)).toThrow('source entity is missing')

        const invalidZone = createSnapshot()
        invalidZone.layoutZoneWidgets![0]!.zone = 'marketing-footer'
        expect(() => validateMarketingSnapshotLayouts(invalidZone)).toThrow('placement is invalid')

        const invalidId = createSnapshot()
        invalidId.layouts![0]!.id = '0190a9b5-3cde-4abc-8def-0123456789a1'
        invalidId.defaultLayoutId = invalidId.layouts![0]!.id
        invalidId.layoutZoneWidgets![0]!.layoutId = invalidId.layouts![0]!.id
        expect(() => validateMarketingSnapshotLayouts(invalidId)).toThrow('UUID v7')
    })

    it('rejects a non-UUID-v7 source lineage reference before sync', () => {
        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets![0]!.sourceBaseWidgetId = 'source-widget'

        expect(() => validateSnapshotLayoutIdentities(snapshot)).toThrow('widget source base id')
    })

    it('rejects a UUID-v7 source lineage reference that is not a valid scoped overlay relation', () => {
        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets![0]!.sourceBaseWidgetId = ids.secondWidget

        expect(() => validateSnapshotLayoutIdentities(snapshot)).toThrow('source base reference is invalid')
    })

    it('validates scoped layouts and override targets against the global composition', () => {
        const missingComposition = createSnapshot()
        missingComposition.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: ids.layout,
                templateKey: 'marketing-page',
                name: { en: 'Scoped marketing page' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        expect(() => validateMarketingSnapshotLayouts(missingComposition)).toThrow('composition mode')

        const snapshot = createSnapshot()
        snapshot.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: ids.layout,
                compositionMode: 'overlay',
                templateKey: 'marketing-page',
                name: { en: 'Scoped marketing page' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        snapshot.layoutWidgetOverrides = [
            {
                id: ids.override,
                layoutId: ids.scopedLayout,
                baseWidgetId: ids.widget,
                isDeletedOverride: false
            }
        ]
        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()

        snapshot.layoutWidgetOverrides![0]!.baseWidgetId = ids.secondWidget
        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('missing global widget')
    })

    it('accepts independent marketing composition without a base layout', () => {
        const snapshot = createSnapshot()
        snapshot.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: null,
                compositionMode: 'independent',
                templateKey: 'marketing-page',
                name: { en: 'Independent marketing page' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        snapshot.layoutZoneWidgets![0]!.layoutId = ids.scopedLayout

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()

        snapshot.scopedLayouts[0]!.baseLayoutId = ids.layout
        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('null base layout id')
    })

    it('accepts dashboard and marketing layouts in one snapshot', () => {
        const snapshot = createSnapshot()
        snapshot.layouts!.unshift({
            id: ids.secondLayout,
            templateKey: 'dashboard',
            name: { en: 'Dashboard' },
            config: {},
            isDefault: false,
            isActive: true,
            sortOrder: 0,
            compositionMode: 'independent',
            baseLayoutId: null
        })
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.secondLayout,
            zone: 'center',
            widgetKey: 'overviewTitle',
            sortOrder: 0,
            config: {},
            isActive: true
        })

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()
        expect(() => validateSnapshotLayoutIdentities(snapshot)).not.toThrow()
    })

    it('accepts shared template widgets inside a marketing layout', () => {
        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.layout,
            zone: 'marketing-header',
            widgetKey: 'languageSwitcher',
            sortOrder: 1,
            config: {},
            isActive: true
        })

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()
    })

    it('accepts the authentication header widget without a content source', () => {
        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.layout,
            zone: 'marketing-header',
            widgetKey: 'marketing.auth',
            sortOrder: 1,
            config: { instanceKey: 'auth', showAuthActions: true },
            isActive: true
        })

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()
    })

    it('rejects a scoped override whose base widget belongs to another global layout', () => {
        const snapshot = createSnapshot()
        snapshot.layouts!.unshift({
            id: ids.secondLayout,
            templateKey: 'dashboard',
            name: { en: 'Dashboard' },
            config: {},
            isDefault: false,
            isActive: true,
            sortOrder: 0,
            compositionMode: 'independent',
            baseLayoutId: null
        })
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.secondLayout,
            zone: 'center',
            widgetKey: 'overviewTitle',
            sortOrder: 0,
            config: {},
            isActive: true
        })
        snapshot.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: ids.layout,
                compositionMode: 'overlay',
                templateKey: 'marketing-page',
                name: { en: 'Scoped marketing page' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        snapshot.layoutWidgetOverrides = [
            {
                id: ids.override,
                layoutId: ids.scopedLayout,
                baseWidgetId: ids.secondWidget,
                isDeletedOverride: false
            }
        ]

        expect(() => validateSnapshotLayoutIdentities(snapshot)).toThrow('wrong layout')
    })

    it('rejects a dashboard scoped override with a foreign base widget in mixed templates', () => {
        const snapshot = createSnapshot()
        snapshot.layouts!.unshift({
            id: ids.secondLayout,
            templateKey: 'dashboard',
            name: { en: 'Dashboard' },
            config: {},
            isDefault: false,
            isActive: true,
            sortOrder: 0,
            compositionMode: 'independent',
            baseLayoutId: null
        })
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.secondLayout,
            zone: 'center',
            widgetKey: 'overviewTitle',
            sortOrder: 0,
            config: {},
            isActive: true
        })
        snapshot.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: ids.secondLayout,
                compositionMode: 'overlay',
                templateKey: 'dashboard',
                name: { en: 'Scoped dashboard' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        snapshot.layoutWidgetOverrides = [
            {
                id: ids.override,
                layoutId: ids.scopedLayout,
                baseWidgetId: ids.widget,
                isDeletedOverride: false
            }
        ]

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow(
            'Dashboard widget override base widget belongs to the wrong layout'
        )
    })

    it('requires pricing benefits when pricing widget benefits are enabled', () => {
        const pricing = createSnapshot([
            {
                id: ids.widget,
                layoutId: ids.layout,
                zone: 'marketing-main',
                widgetKey: 'marketing.pricing',
                sortOrder: 0,
                config: {
                    instanceKey: 'pricing',
                    source: { entityCodename: 'MarketingPagePricing', entityKind: 'object' },
                    showBenefits: true
                },
                isActive: true
            }
        ])
        delete pricing.entities?.benefits
        expect(() => validateMarketingSnapshotLayouts(pricing)).toThrow('source entity is missing')
    })
})

describe('validateMarketingSnapshotTransportLayouts', () => {
    it('rejects plain widgets with an unsupported template zone before render validation', () => {
        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets![0]!.zone = 'marketing-footer'

        expect(() => validateSnapshotLayoutNeutralMetadata(snapshot)).toThrow('Snapshot widget configuration is invalid')
    })

    it('validates neutral layout metadata and strips it before renderer validation', () => {
        const snapshot = createSnapshot()
        const neutralLayoutConfig = {
            __layout: {
                zoneSettings: {
                    'marketing-header': { position: 'flow' }
                }
            }
        }
        snapshot.layouts![0]!.config = neutralLayoutConfig
        snapshot.layoutConfig = neutralLayoutConfig
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.layout,
            zone: 'marketing-header',
            widgetKey: 'languageSwitcher',
            sortOrder: 1,
            config: { __layout: { placement: 'end' } },
            isActive: true
        })

        expect(() => validateMarketingSnapshotTransportLayouts(snapshot)).not.toThrow()
    })

    it('fails closed on application-only or duplicated transport metadata', () => {
        const sourceSettings = createSnapshot()
        sourceSettings.layouts![0]!.config = {
            __layout: {
                sourceZoneSettings: {
                    'marketing-header': { position: 'fixed' }
                }
            }
        }
        expect(() => validateMarketingSnapshotTransportLayouts(sourceSettings)).toThrow('application-only source zone settings')

        const duplicatedComposition = createSnapshot()
        duplicatedComposition.layouts![0]!.config = {
            __layout: {
                composition: {
                    mode: 'independent',
                    baseLayoutId: null
                }
            }
        }
        expect(() => validateMarketingSnapshotTransportLayouts(duplicatedComposition)).toThrow(
            'must not duplicate top-level composition metadata'
        )
    })

    it('fails closed on null layout and widget config envelopes', () => {
        const nullLayoutConfig = createSnapshot()
        nullLayoutConfig.layouts![0]!.config = null as never
        expect(() => validateMarketingSnapshotTransportLayouts(nullLayoutConfig)).toThrow('neutral metadata is invalid')

        const nullWidgetConfig = createSnapshot()
        nullWidgetConfig.layoutZoneWidgets![0]!.config = null as never
        expect(() => validateMarketingSnapshotTransportLayouts(nullWidgetConfig)).toThrow('widget configuration is invalid')
    })
})
