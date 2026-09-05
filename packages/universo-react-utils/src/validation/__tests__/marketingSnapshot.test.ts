import { describe, expect, it } from 'vitest'

import { validateMarketingSnapshotLayouts, validateSnapshotLayoutIdentities, type MarketingSnapshotLike } from '../marketingSnapshot'

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
            sortOrder: 0
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

    it('validates scoped layouts and override targets against the global composition', () => {
        const snapshot = createSnapshot()
        snapshot.scopedLayouts = [
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
