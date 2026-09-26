import type { MarketingHeroBindingTarget } from '../../domains/layouts/marketingHeroBindingsStore'
import { resolveMarketingHeroSourceName, validateMarketingHeroActionTargets } from '../../domains/layouts/marketingHeroBindingService'

const heroContent = (href: string): MarketingHeroBindingTarget['data'] =>
    ({
        title: { en: 'Welcome', ru: 'Добро пожаловать' },
        description: { en: 'Description', ru: 'Описание' },
        emailLabel: { en: 'Email', ru: 'Электронная почта' },
        emailPlaceholder: { en: 'you@example.com', ru: 'you@example.com' },
        primaryActionLabel: { en: 'Explore', ru: 'Подробнее' },
        primaryAction: { kind: 'anchor', href },
        termsText: undefined,
        termsLinkLabel: undefined,
        termsAction: undefined
    } as MarketingHeroBindingTarget['data'])

describe('Marketing Hero binding target validation', () => {
    it('accepts a section instance resolved from active current-layout widgets', () => {
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

describe('Marketing Hero source display names', () => {
    const presentation = {
        name: {
            _schema: '1',
            _primary: 'en',
            locales: {
                en: { content: 'Marketing hero' },
                ru: { content: 'Первый экран' }
            }
        }
    }

    it('uses the selected locale and language fallback for regional locales', () => {
        expect(resolveMarketingHeroSourceName(presentation, 'ru')).toBe('Первый экран')
        expect(resolveMarketingHeroSourceName(presentation, 'ru-RU')).toBe('Первый экран')
    })

    it('falls back to a localized value instead of returning a locale key or a blank option', () => {
        expect(resolveMarketingHeroSourceName({ name: '' }, 'en')).toBe('Unnamed Object')
        expect(resolveMarketingHeroSourceName({ name: { _primary: 'ru', locales: { ru: { content: 'Объект' } } } }, 'en')).toBe('Объект')
        expect(resolveMarketingHeroSourceName({ name: { _primary: 'ru', locales: {} } }, 'ru')).toBe('Объект без названия')
    })
})
