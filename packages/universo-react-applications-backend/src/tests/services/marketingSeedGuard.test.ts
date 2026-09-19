import { PUBLIC_MARKETING_ROW_LIMIT } from '../../persistence/publicApplicationRuntimeStore'
import { assertMarketingSeedRows, isMarketingSeedObject } from '../../services/marketingSeedGuard'

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

    it('recognizes marketing source codenames only', () => {
        expect(isMarketingSeedObject('MarketingPagePricing')).toBe(true)
        expect(isMarketingSeedObject('Orders')).toBe(false)
    })
})
