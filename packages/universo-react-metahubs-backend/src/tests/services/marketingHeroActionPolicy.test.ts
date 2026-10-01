import type { MarketingHeroEntityContent } from '@universo-react/types'
import { validateMarketingHeroActionTargets } from '../../domains/layouts/marketingHeroActionPolicy'

const heroContent = (href: string): MarketingHeroEntityContent => ({
    title: { en: 'Welcome', ru: 'Добро пожаловать' },
    description: { en: 'Description', ru: 'Описание' },
    emailLabel: { en: 'Email', ru: 'Электронная почта' },
    emailPlaceholder: { en: 'you@example.com', ru: 'you@example.com' },
    primaryActionLabel: { en: 'Explore', ru: 'Подробнее' },
    primaryAction: { kind: 'anchor', href }
})

describe('Marketing Hero action target integrity', () => {
    it('accepts an anchor for an active section instance in the current layout', () => {
        expect(() =>
            validateMarketingHeroActionTargets(heroContent('#pricing-pricing-enterprise'), [
                { widgetKey: 'marketing.pricing', instanceKey: 'pricing-enterprise', isActive: true }
            ])
        ).not.toThrow()
    })

    it('rejects inactive sections and section aliases when the layout has no matching widget', () => {
        expect(() =>
            validateMarketingHeroActionTargets(heroContent('#pricing'), [
                { widgetKey: 'marketing.pricing', instanceKey: 'pricing-enterprise', isActive: false }
            ])
        ).toThrow('Hero action targets an inactive section in this layout')
    })

    it('allows an active semantic alias to resolve to the first repeated section', () => {
        expect(() =>
            validateMarketingHeroActionTargets(heroContent('#pricing'), [
                { widgetKey: 'marketing.pricing', instanceKey: 'pricing-enterprise', isActive: true },
                { widgetKey: 'marketing.pricing', instanceKey: 'pricing-campus', isActive: true }
            ])
        ).not.toThrow()
    })
})
