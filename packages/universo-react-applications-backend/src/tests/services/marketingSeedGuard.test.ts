import { PUBLIC_MARKETING_ROW_LIMIT } from '../../shared/marketingRuntimeLimits'
import {
    assertMarketingSeedRows,
    collectMarketingWidgetBindingSources,
    collectMarketingWidgetBindingSourcesFromConfigs
} from '../../services/marketingSeedGuard'
import { createMarketingCollectionConfig, createMarketingPricingConfig } from '../utils/marketingWidgetBindings'

describe('marketingSeedGuard', () => {
    it('accepts rows within the public runtime row limit', () => {
        expect(() =>
            assertMarketingSeedRows({
                objectCodename: 'MarketingPageFeature',
                rows: [{ data: { FeatureKey: 'first' } }, { data: { FeatureKey: 'second' } }],
                uniqueFieldCodenames: ['FeatureKey']
            })
        ).not.toThrow()
    })

    it('rejects collections above the public runtime row limit', () => {
        const rows = Array.from({ length: PUBLIC_MARKETING_ROW_LIMIT + 1 }, (_, index) => ({ data: { FeatureKey: `key-${index}` } }))
        expect(() =>
            assertMarketingSeedRows({
                objectCodename: 'MarketingPageFeature',
                rows,
                uniqueFieldCodenames: ['FeatureKey']
            })
        ).toThrow(/exceeds the public runtime row limit/)
    })

    it('rejects case-insensitive and trimmed duplicate unique keys', () => {
        expect(() =>
            assertMarketingSeedRows({
                objectCodename: 'MarketingPagePricing',
                rows: [{ data: { PricingKey: 'Starter' } }, { data: { PricingKey: ' starter ' } }],
                uniqueFieldCodenames: ['PricingKey']
            })
        ).toThrow(/duplicate unique key/)
    })

    it('treats the same value in different unique fields as distinct', () => {
        expect(() =>
            assertMarketingSeedRows({
                objectCodename: 'MarketingPagePricing',
                rows: [{ data: { PricingKey: 'starter', TierKey: 'starter' } }],
                uniqueFieldCodenames: ['PricingKey', 'TierKey']
            })
        ).not.toThrow()
    })

    it('ignores empty and non-string unique values', () => {
        expect(() =>
            assertMarketingSeedRows({
                objectCodename: 'MarketingPagePricing',
                rows: [{ data: { PricingKey: '   ' } }, { data: { PricingKey: 42 } }, { data: {} }, null],
                uniqueFieldCodenames: ['PricingKey']
            })
        ).not.toThrow()
    })

    it('skips duplicate detection when no unique fields are declared', () => {
        expect(() =>
            assertMarketingSeedRows({
                objectCodename: 'MarketingPageFeature',
                rows: [{ data: { FeatureKey: 'same' } }, { data: { FeatureKey: 'same' } }],
                uniqueFieldCodenames: []
            })
        ).not.toThrow()
    })

    it('collects semantic-key, record-set, and relation-set sources from Marketing widget bindings', () => {
        const pricingConfig = createMarketingPricingConfig({
            section: 'CustomPricingSection',
            tiers: 'CustomPricingTier',
            benefits: 'CustomPricingBenefit'
        })
        const sources = collectMarketingWidgetBindingSources({
            layouts: [
                { id: 'marketing-layout', templateKey: 'marketing-page' },
                { id: 'dashboard-layout', templateKey: 'dashboard' }
            ],
            layoutZoneWidgets: [
                { layoutId: 'marketing-layout', widgetKey: 'marketing.pricing', zone: 'marketing-main', config: pricingConfig },
                {
                    layoutId: 'dashboard-layout',
                    widgetKey: 'marketing.pricing',
                    zone: 'marketing-main',
                    config: pricingConfig
                }
            ]
        })

        expect(sources).toEqual(new Set(['CustomPricingSection', 'CustomPricingTier', 'CustomPricingBenefit']))
    })

    it('collects any trusted baseline sources from a retained Marketing placement', () => {
        const sources = collectMarketingWidgetBindingSourcesFromConfigs([
            {
                widgetKey: 'marketing.collection',
                zone: 'marketing-main',
                config: { variant: 'features' },
                sourceConfig: createMarketingCollectionConfig('CustomLandingFeature')
            }
        ])

        expect(sources).toEqual(new Set(['MarketingPageFeature', 'CustomLandingFeature']))
    })

    it('allows binding-free Marketing overlays but rejects a local binding override', () => {
        const overlay = {
            widgetKey: 'marketing.pricing',
            zone: 'marketing-main',
            config: { maxItems: 24, showBenefits: true },
            sourceConfig: { maxItems: 24, showBenefits: true },
            sourceBaseWidgetId: '019ccefc-2f7b-7b36-82f4-85cdb1312269'
        }
        expect(collectMarketingWidgetBindingSourcesFromConfigs([overlay])).toEqual(new Set())
        expect(() => collectMarketingWidgetBindingSourcesFromConfigs([{ ...overlay, config: createMarketingPricingConfig() }])).toThrow(
            /cannot override inherited Entity bindings/
        )
    })

    it('fails closed for invalid Marketing binding metadata and dangling layout references', () => {
        expect(() =>
            collectMarketingWidgetBindingSources({
                layouts: [{ id: 'marketing-layout', templateKey: 'marketing-page' }],
                layoutZoneWidgets: [{ layoutId: 'marketing-layout', widgetKey: 'marketing.pricing', zone: 'marketing-main', config: {} }]
            })
        ).toThrow()
        expect(() =>
            collectMarketingWidgetBindingSources({
                layouts: [{ id: 'marketing-layout', templateKey: 'marketing-page' }],
                layoutZoneWidgets: [{ layoutId: 'missing-layout', widgetKey: 'marketing.pricing', zone: 'marketing-main', config: {} }]
            })
        ).toThrow(/unknown layout/)
    })
})
