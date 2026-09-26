import { describe, expect, it } from 'vitest'

import {
    APPLICATION_HOST_ROUTE_PATHS,
    getMarketingActionSectionTargets,
    getMarketingSectionAnchorEntries,
    getMarketingWidgetAnchorId,
    MARKETING_ACTION_INTERNAL_ROUTES
} from '../common/marketingActionCatalog'

describe('marketing action catalog', () => {
    it('keeps action routes aligned with the registered public host paths', () => {
        expect(MARKETING_ACTION_INTERNAL_ROUTES.map(({ path }) => path)).toEqual([
            APPLICATION_HOST_ROUTE_PATHS.home,
            APPLICATION_HOST_ROUTE_PATHS.auth,
            APPLICATION_HOST_ROUTE_PATHS.terms,
            APPLICATION_HOST_ROUTE_PATHS.privacy
        ])
        expect(MARKETING_ACTION_INTERNAL_ROUTES.map(({ path }) => path)).not.toContain('/sign-up')
    })

    it('returns only active sections and distinguishes repeated section placements', () => {
        const widgets = [
            { widgetKey: 'marketing.hero', instanceKey: 'hero', isActive: true },
            { widgetKey: 'marketing.collection', instanceKey: 'pricing', config: { variant: 'features' }, isActive: true },
            { widgetKey: 'marketing.pricing', instanceKey: 'pricing-enterprise', isActive: true },
            { widgetKey: 'marketing.pricing', instanceKey: 'pricing-campus', isActive: true },
            { widgetKey: 'marketing.footer', instanceKey: 'footer', isActive: false }
        ]

        expect(getMarketingActionSectionTargets(widgets)).toEqual([
            {
                href: '#hero',
                sectionId: 'hero',
                labelKey: 'layouts.marketing.heroAuthoring.sections.hero',
                defaultLabel: 'Hero',
                instanceNumber: 1
            },
            {
                href: '#features-pricing',
                sectionId: 'features-pricing',
                labelKey: 'layouts.marketing.heroAuthoring.sections.features',
                defaultLabel: 'Features',
                instanceNumber: 1
            },
            {
                href: '#pricing-pricing-enterprise',
                sectionId: 'pricing-pricing-enterprise',
                labelKey: 'layouts.marketing.heroAuthoring.sections.pricing',
                defaultLabel: 'Pricing',
                instanceNumber: 1
            },
            {
                href: '#pricing-pricing-campus',
                sectionId: 'pricing-pricing-campus',
                labelKey: 'layouts.marketing.heroAuthoring.sections.pricing',
                defaultLabel: 'Pricing',
                instanceNumber: 2
            }
        ])

        const entries = getMarketingSectionAnchorEntries(widgets)
        expect(entries).toContainEqual(['pricing-pricing-enterprise', 'pricing-pricing-enterprise'])
        expect(entries).toContainEqual(['pricing', 'pricing-pricing-enterprise'])
        expect(entries).not.toContainEqual(['footer', 'footer'])
    })

    it('keeps punctuation-distinct widget and section anchors unique and aligned', () => {
        const widgets = [
            { widgetKey: 'marketing.hero', instanceKey: 'promo.one', isActive: true },
            { widgetKey: 'marketing.hero', instanceKey: 'promo-one', isActive: true }
        ]
        const [first, second] = getMarketingActionSectionTargets(widgets)
        const anchors = new Map(getMarketingSectionAnchorEntries(widgets))

        expect(first?.href).not.toBe(second?.href)
        expect(anchors.get('promo.one')).toBe(getMarketingWidgetAnchorId('promo.one'))
        expect(anchors.get('promo-one')).toBe(getMarketingWidgetAnchorId('promo-one'))
        expect(anchors.get('promo.one')).not.toBe(anchors.get('promo-one'))
    })

    it('keeps canonical section aliases ahead of colliding widget instance keys', () => {
        const widgets = [
            { widgetKey: 'marketing.hero', instanceKey: 'pricing', isActive: true },
            { widgetKey: 'marketing.pricing', instanceKey: 'pricing-enterprise', isActive: true }
        ]
        const pricingAnchor = getMarketingSectionAnchorEntries(widgets).find(([alias]) => alias === 'pricing')

        expect(pricingAnchor?.[1]).toBe('pricing-pricing-enterprise')
    })
})
