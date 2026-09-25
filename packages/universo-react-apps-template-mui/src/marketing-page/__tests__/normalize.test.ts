import { describe, expect, it } from 'vitest'

import type { MarketingHeroEntityContent, MarketingPageRuntimeViewModel } from '@universo-react/types'

import { normalizeMarketingPageRuntime } from '../normalize'

const uuid = (suffix: string): string => `0190a9b5-3cde-7abc-8def-0123456789${suffix}`
const localized = (en: string, ru = en) => ({ en, ru })
const provenance = { layer: 'application' as const, isSeeded: true, isAuthored: false, seedKey: 'marketing-seed' }
const heroContent = (overrides: Partial<MarketingHeroEntityContent> = {}): MarketingHeroEntityContent => ({
    title: localized('A focused launch', 'Короткий запуск'),
    accent: localized('Made for teams', 'Для команд'),
    description: localized('A typed description.', 'Типизированное описание.'),
    emailLabel: localized('Email', 'Эл. почта'),
    emailPlaceholder: localized('Your email', 'Ваша почта'),
    primaryActionLabel: localized('Get started', 'Начать'),
    primaryAction: { kind: 'internal', path: '/get-started' },
    ...overrides
})
const heroWidgetData = (content: MarketingHeroEntityContent) => ({
    records: [{ kind: 'heroContent' as const, semanticKey: 'content' as const, order: 0 as const, isVisible: true as const, content }]
})
const sourceForWidget = (widgetKey: string, variant?: string) => {
    const entityCodenameByWidget: Record<string, string> = {
        'marketing.navigation': 'MarketingPageNavigation',
        'marketing.brand': 'MarketingPageSiteSettings',
        'marketing.collection': 'MarketingPageFeature',
        'marketing.pricing': 'MarketingPagePricing',
        'marketing.footer': 'MarketingPageFooterLink'
    }
    const collectionSourceByVariant: Record<string, string> = {
        logos: 'MarketingPageLogo',
        features: 'MarketingPageFeature',
        testimonials: 'MarketingPageTestimonial',
        highlights: 'MarketingPageHighlight',
        faq: 'MarketingPageFaq'
    }
    return {
        entityCodename:
            widgetKey === 'marketing.collection'
                ? collectionSourceByVariant[variant ?? '']
                : entityCodenameByWidget[widgetKey] ?? 'MarketingPageSiteSettings',
        entityKind: 'object' as const
    }
}

const record = (id: string, semanticKey: string, kind: string, extra: Record<string, unknown> = {}) => ({
    id: uuid(id),
    semanticKey,
    locale: 'en',
    order: 1,
    isVisible: true,
    scope: 'application',
    provenance,
    kind,
    ...extra
})

const widget = ({
    instanceKey,
    widgetKey,
    zone,
    sortOrder,
    config = {},
    items = [],
    data: runtimeData,
    isActive = true
}: {
    instanceKey: string
    widgetKey: string
    zone: string
    sortOrder: number
    config?: Record<string, unknown>
    items?: unknown[]
    data?: unknown
    isActive?: boolean
}) => ({
    instanceKey,
    widgetKey,
    zone,
    sortOrder,
    isActive,
    config: {
        instanceKey,
        ...(widgetKey === 'marketing.image' || widgetKey === 'marketing.hero'
            ? {}
            : { source: sourceForWidget(widgetKey, typeof config.variant === 'string' ? config.variant : undefined) }),
        ...config
    },
    data: runtimeData === undefined ? { records: items } : runtimeData
})

const atomicWidget = ({
    instanceKey,
    widgetKey,
    sortOrder,
    items = [],
    config = {}
}: {
    instanceKey: string
    widgetKey: 'marketing.brand' | 'marketing.auth'
    sortOrder: number
    items?: unknown[]
    config?: Record<string, unknown>
}) => ({
    instanceKey,
    widgetKey,
    zone: 'marketing-header',
    sortOrder,
    isActive: true,
    config: {
        instanceKey,
        ...(widgetKey === 'marketing.brand' ? { source: sourceForWidget(widgetKey) } : {}),
        ...config
    },
    data: { records: items }
})

const envelope = (widgets: unknown[]): MarketingPageRuntimeViewModel =>
    ({
        templateKey: 'marketing-page',
        marketingPage: {
            templateKey: 'marketing-page',
            locale: 'en',
            config: {},
            widgets,
            runtime: {
                layoutId: uuid('90'),
                layoutVersion: 1,
                layoutHash: 'a'.repeat(64)
            },
            provenance
        }
    } as unknown as MarketingPageRuntimeViewModel)

describe('normalizeMarketingPageRuntime', () => {
    it('normalizes every valid widget, including repeated variants, inactive widgets, and empty content', () => {
        const viewModel = envelope([
            widget({ instanceKey: 'navigation', widgetKey: 'marketing.navigation', zone: 'marketing-header', sortOrder: 0 }),
            widget({
                instanceKey: 'features-one',
                widgetKey: 'marketing.collection',
                zone: 'marketing-main',
                sortOrder: 1,
                config: { variant: 'features' },
                items: [
                    record('01', 'dashboard', 'feature', {
                        title: localized('Dashboard'),
                        description: localized('A useful dashboard.'),
                        iconKey: 'viewquiltrounded'
                    })
                ]
            }),
            widget({
                instanceKey: 'features-two',
                widgetKey: 'marketing.collection',
                zone: 'marketing-main',
                sortOrder: 2,
                config: { variant: 'features' },
                items: []
            }),
            widget({
                instanceKey: 'logos-empty',
                widgetKey: 'marketing.collection',
                zone: 'marketing-main',
                sortOrder: 3,
                config: { variant: 'logos' },
                items: []
            }),
            widget({
                instanceKey: 'faq-disabled',
                widgetKey: 'marketing.collection',
                zone: 'marketing-main',
                sortOrder: 4,
                config: { variant: 'faq' },
                items: [],
                isActive: false
            }),
            widget({ instanceKey: 'footer', widgetKey: 'marketing.footer', zone: 'marketing-footer', sortOrder: 0 })
        ])

        const normalized = normalizeMarketingPageRuntime(viewModel, 'en')

        expect(normalized.widgets).toHaveLength(6)
        expect(normalized.widgets.map((item) => item.instanceKey)).toEqual([
            'navigation',
            'features-one',
            'features-two',
            'logos-empty',
            'faq-disabled',
            'footer'
        ])
        expect(normalized.widgets.find((item) => item.instanceKey === 'faq-disabled')?.isActive).toBe(false)
        expect(normalized.widgets.find((item) => item.instanceKey === 'features-two')).toMatchObject({
            content: { variant: 'features', items: [] }
        })
        expect(normalized).not.toHaveProperty('sectionOrder')
        expect(normalized).not.toHaveProperty('sectionVisibility')
        expect(normalized).not.toHaveProperty('records')
        expect(normalized).not.toHaveProperty('sectionCopies')
    })

    it('uses localized content and linked pricing benefits from the widget payload', () => {
        const viewModel = envelope([
            widget({
                instanceKey: 'hero',
                widgetKey: 'marketing.hero',
                zone: 'marketing-main',
                sortOrder: 0,
                data: heroWidgetData(
                    heroContent({
                        title: localized('Our latest', 'Наши новые'),
                        description: localized('A typed marketing page.', 'Типизированная страница.')
                    })
                )
            }),
            widget({
                instanceKey: 'pricing',
                widgetKey: 'marketing.pricing',
                zone: 'marketing-main',
                sortOrder: 1,
                items: [
                    record('11', 'priority-support', 'pricingBenefit', { label: localized('Priority support', 'Приоритетная поддержка') }),
                    record('12', 'professional', 'pricingTier', {
                        title: localized('Professional', 'Профессиональный'),
                        price: localized('15'),
                        period: localized('per month'),
                        benefitKeys: ['priority-support'],
                        benefits: [],
                        featured: true
                    })
                ]
            })
        ])

        const normalized = normalizeMarketingPageRuntime(viewModel, 'ru')
        const hero = normalized.widgets.find((item) => item.widgetKey === 'marketing.hero')
        const pricing = normalized.widgets.find((item) => item.widgetKey === 'marketing.pricing')

        expect(hero).toMatchObject({ content: { title: 'Наши новые', accent: 'Для команд', description: 'Типизированная страница.' } })
        expect(pricing).toMatchObject({ content: { tiers: [{ title: 'Профессиональный', benefits: ['Приоритетная поддержка'] }] } })
        expect(normalized.config).toMatchObject({ themeMode: 'system', allowEmailActions: true, allowTelephoneActions: true })
    })

    it('normalizes repeated Hero placements from their own typed Entity projections', () => {
        const viewModel = envelope([
            widget({
                instanceKey: 'hero-first',
                widgetKey: 'marketing.hero',
                zone: 'marketing-main',
                sortOrder: 0,
                data: heroWidgetData(
                    heroContent({
                        title: localized('First Hero', 'Первый Hero'),
                        accent: localized('First accent', 'Первый акцент'),
                        description: localized('First description', 'Первое описание'),
                        emailLabel: localized('First email', 'Первая почта'),
                        emailPlaceholder: localized('First address', 'Первый адрес'),
                        primaryActionLabel: localized('Start first', 'Начать первое'),
                        primaryAction: { kind: 'internal', path: '/first' },
                        termsText: localized('First terms text', 'Первый текст условий'),
                        termsLinkLabel: localized('First terms', 'Первые условия'),
                        termsAction: { kind: 'internal', path: '/first-terms' }
                    })
                )
            }),
            widget({
                instanceKey: 'hero-second',
                widgetKey: 'marketing.hero',
                zone: 'marketing-main',
                sortOrder: 1,
                data: heroWidgetData(
                    heroContent({
                        title: localized('Second Hero', 'Второй Hero'),
                        accent: localized('Second accent', 'Второй акцент'),
                        description: localized('Second description', 'Второе описание'),
                        emailLabel: localized('Second email', 'Вторая почта'),
                        emailPlaceholder: localized('Second address', 'Второй адрес'),
                        primaryActionLabel: localized('Start second', 'Начать второе'),
                        primaryAction: { kind: 'internal', path: '/second' }
                    })
                )
            })
        ])

        const normalized = normalizeMarketingPageRuntime(viewModel, 'ru')
        const firstHero = normalized.widgets.find((item) => item.instanceKey === 'hero-first')
        const secondHero = normalized.widgets.find((item) => item.instanceKey === 'hero-second')

        expect(firstHero).toMatchObject({
            content: {
                title: 'Первый Hero',
                accent: 'Первый акцент',
                description: 'Первое описание',
                lead: {
                    label: 'Первая почта',
                    placeholder: 'Первый адрес',
                    submitLabel: 'Начать первое',
                    action: { semanticKey: 'hero-primary', href: '/first', label: 'Начать первое' },
                    termsText: 'Первый текст условий',
                    termsAction: { semanticKey: 'hero-secondary', href: '/first-terms', label: 'Первые условия' }
                }
            }
        })
        expect(secondHero).toMatchObject({
            content: {
                title: 'Второй Hero',
                accent: 'Второй акцент',
                description: 'Второе описание',
                lead: {
                    label: 'Вторая почта',
                    placeholder: 'Второй адрес',
                    submitLabel: 'Начать второе',
                    action: { semanticKey: 'hero-primary', href: '/second', label: 'Начать второе' },
                    termsText: undefined,
                    termsAction: undefined
                }
            }
        })
    })

    it('formats scaled numeric prices per locale and keeps authored text prices', () => {
        const viewModel = envelope([
            widget({
                instanceKey: 'pricing',
                widgetKey: 'marketing.pricing',
                zone: 'marketing-main',
                sortOrder: 1,
                items: [
                    record('12', 'pre-seed', 'pricingTier', {
                        title: localized('Pre-seed', 'Предпосевная'),
                        price: localized('1.00'),
                        period: localized('stage', 'этап'),
                        benefitKeys: [],
                        benefits: []
                    }),
                    record('13', 'seed', 'pricingTier', {
                        title: localized('Seed', 'Посевная'),
                        price: localized('15.50'),
                        period: localized('stage', 'этап'),
                        benefitKeys: [],
                        benefits: []
                    }),
                    record('14', 'growth', 'pricingTier', {
                        title: localized('Growth', 'Масштабирование'),
                        price: localized('RUB 150–500 million', '150–500 млн ₽'),
                        period: localized('stage', 'этап'),
                        benefitKeys: [],
                        benefits: []
                    })
                ]
            })
        ])

        const normalized = normalizeMarketingPageRuntime(viewModel, 'ru')
        const pricing = normalized.widgets.find((item) => item.widgetKey === 'marketing.pricing')
        const tiers = (pricing?.content as { tiers: Array<{ price: string; title: string }> }).tiers

        expect(tiers.map((tier) => [tier.title, tier.price])).toEqual([
            ['Предпосевная', '1'],
            ['Посевная', '15,5'],
            ['Масштабирование', '150–500 млн ₽']
        ])
    })

    it('forwards the pricing card width setting into the render model', () => {
        const viewModel = envelope([
            widget({
                instanceKey: 'pricing',
                widgetKey: 'marketing.pricing',
                zone: 'marketing-main',
                sortOrder: 1,
                config: { cardWidth: 'full' },
                items: [
                    record('12', 'pre-seed', 'pricingTier', {
                        title: localized('Pre-seed', 'Предпосевная'),
                        price: localized('1.00'),
                        period: localized('stage', 'этап'),
                        benefitKeys: [],
                        benefits: []
                    })
                ]
            })
        ])

        const normalized = normalizeMarketingPageRuntime(viewModel, 'en')
        const pricing = normalized.widgets.find((item) => item.widgetKey === 'marketing.pricing')

        expect(pricing).toMatchObject({ content: { config: { cardWidth: 'full' } } })
    })

    it('defaults the pricing card width to the standard container when the config omits it', () => {
        const viewModel = envelope([
            widget({
                instanceKey: 'pricing',
                widgetKey: 'marketing.pricing',
                zone: 'marketing-main',
                sortOrder: 1,
                config: {},
                items: [
                    record('12', 'pre-seed', 'pricingTier', {
                        title: localized('Pre-seed', 'Предпосевная'),
                        price: localized('1.00'),
                        period: localized('stage', 'этап'),
                        benefitKeys: [],
                        benefits: []
                    })
                ]
            })
        ])

        const normalized = normalizeMarketingPageRuntime(viewModel, 'en')
        const pricing = normalized.widgets.find((item) => item.widgetKey === 'marketing.pricing')

        expect(pricing).toMatchObject({ content: { config: { cardWidth: 'auto', cardStyle: 'featured' } } })
    })

    it('keeps Hero copy when showLeadForm hides only the lead presentation', () => {
        const viewModel = envelope([
            widget({
                instanceKey: 'navigation',
                widgetKey: 'marketing.navigation',
                zone: 'marketing-header',
                sortOrder: 0,
                config: { showAuthActions: false }
            }),
            widget({
                instanceKey: 'hero',
                widgetKey: 'marketing.hero',
                zone: 'marketing-main',
                sortOrder: 1,
                config: { showLeadForm: false },
                data: heroWidgetData(
                    heroContent({
                        title: localized('Our latest'),
                        description: localized('A typed marketing page.')
                    })
                )
            }),
            widget({
                instanceKey: 'features',
                widgetKey: 'marketing.collection',
                zone: 'marketing-main',
                sortOrder: 2,
                config: { variant: 'features', showTitle: false, showDescription: false },
                items: [
                    record('31', 'features', 'sectionCopy', {
                        sectionKey: 'features',
                        title: localized('Features'),
                        description: localized('Feature description')
                    })
                ]
            })
        ])

        const normalized = normalizeMarketingPageRuntime(viewModel, 'en')

        const navigation = normalized.widgets.find((item) => item.widgetKey === 'marketing.navigation')
        expect(navigation?.content).not.toHaveProperty('auth')
        expect(normalized.widgets.find((item) => item.widgetKey === 'marketing.hero')).toMatchObject({
            content: { title: 'Our latest', accent: 'Made for teams', description: 'A typed marketing page.', lead: undefined }
        })
        expect(normalized.widgets.find((item) => item.widgetKey === 'marketing.collection')).toMatchObject({
            content: { section: { title: 'Features', description: 'Feature description', showTitle: false, showDescription: false } }
        })
    })

    it('normalizes atomic brand and auth widgets through the strict runtime schema', () => {
        const viewModel = envelope([
            widget({ instanceKey: 'navigation', widgetKey: 'marketing.navigation', zone: 'marketing-header', sortOrder: 0 }),
            widget({
                instanceKey: 'hero',
                widgetKey: 'marketing.hero',
                zone: 'marketing-main',
                sortOrder: 0,
                data: heroWidgetData(heroContent({ title: localized('Hero'), description: localized('Description') }))
            }),
            widget({ instanceKey: 'footer', widgetKey: 'marketing.footer', zone: 'marketing-footer', sortOrder: 0 }),
            atomicWidget({
                instanceKey: 'brand',
                widgetKey: 'marketing.brand',
                sortOrder: 1,
                items: [
                    record('40', 'site-settings', 'siteSettings', {
                        brandName: localized('Inherited brand'),
                        brandLogo: {
                            kind: 'logo',
                            resource: { type: 'url', url: 'https://cdn.example.test/inherited.svg' },
                            alt: localized('Inherited')
                        }
                    })
                ]
            }),
            atomicWidget({ instanceKey: 'auth', widgetKey: 'marketing.auth', sortOrder: 2 })
        ])
        viewModel.marketingPage.config = {
            brandLogo: {
                kind: 'logo',
                resource: { type: 'url', url: 'https://cdn.example.test/application.svg' },
                alt: localized('Application brand')
            }
        }

        const normalized = normalizeMarketingPageRuntime(viewModel, 'en')

        expect(normalized.widgets.find((item) => item.widgetKey === 'marketing.brand')).toMatchObject({
            content: { name: 'Inherited brand', logo: { resource: { url: 'https://cdn.example.test/inherited.svg' } } }
        })
        expect(normalized.widgets.find((item) => item.widgetKey === 'marketing.navigation')).toMatchObject({ content: { navigation: [] } })
        expect(normalized.widgets.find((item) => item.widgetKey === 'marketing.auth')).toMatchObject({
            content: { signIn: { href: '/sign-in' }, signUp: { href: '/sign-up' } }
        })
        expect(normalized.widgets.find((item) => item.widgetKey === 'marketing.footer')).toMatchObject({
            content: { logo: { resource: { url: 'https://cdn.example.test/application.svg' } } }
        })
    })

    it('rejects malformed atomic configuration and duplicate atomic instance keys', () => {
        expect(() =>
            normalizeMarketingPageRuntime(
                envelope([
                    widget({ instanceKey: 'navigation', widgetKey: 'marketing.navigation', zone: 'marketing-header', sortOrder: 0 }),
                    atomicWidget({
                        instanceKey: 'auth',
                        widgetKey: 'marketing.auth',
                        sortOrder: 1,
                        config: { showAuthActions: 'yes' }
                    })
                ]),
                'en'
            )
        ).toThrow()

        expect(() =>
            normalizeMarketingPageRuntime(
                envelope([
                    widget({ instanceKey: 'navigation', widgetKey: 'marketing.navigation', zone: 'marketing-header', sortOrder: 0 }),
                    atomicWidget({ instanceKey: 'navigation', widgetKey: 'marketing.brand', sortOrder: 1 })
                ]),
                'en'
            )
        ).toThrow()
    })

    it('normalizes the static marketing image widget independently from hero content', () => {
        const viewModel = envelope([
            widget({
                instanceKey: 'hero',
                widgetKey: 'marketing.hero',
                zone: 'marketing-main',
                sortOrder: 0,
                data: heroWidgetData(heroContent({ title: localized('Our latest'), description: localized('A typed marketing page.') }))
            }),
            widget({
                instanceKey: 'hero-image',
                widgetKey: 'marketing.image',
                zone: 'marketing-main',
                sortOrder: 1,
                config: {
                    media: {
                        kind: 'hero',
                        resource: { type: 'url', url: 'https://cdn.example.test/hero.webp', launchMode: 'inline' },
                        alt: localized('Hero preview')
                    }
                },
                items: []
            })
        ])

        const normalized = normalizeMarketingPageRuntime(viewModel, 'en')
        const hero = normalized.widgets.find((item) => item.widgetKey === 'marketing.hero')
        const image = normalized.widgets.find((item) => item.widgetKey === 'marketing.image')

        expect(hero?.content).not.toHaveProperty('media')
        expect(image).toMatchObject({ content: { media: { resource: { url: 'https://cdn.example.test/hero.webp' } } } })
    })

    it('fails closed for the legacy page-level record envelope', () => {
        expect(() =>
            normalizeMarketingPageRuntime(
                {
                    templateKey: 'marketing-page',
                    marketingPage: {
                        templateKey: 'marketing-page',
                        locale: 'en',
                        config: {},
                        records: [],
                        sectionCopies: {}
                    }
                },
                'en'
            )
        ).toThrow()
    })
})
