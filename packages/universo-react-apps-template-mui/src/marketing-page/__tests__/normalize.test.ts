import { describe, expect, it } from 'vitest'

import type { MarketingPageRuntimeViewModel } from '@universo-react/types'

import { normalizeMarketingPageRuntime } from '../normalize'

const uuid = (suffix: string): string => `0190a9b5-3cde-7abc-8def-0123456789${suffix}`
const localized = (en: string, ru = en) => ({ en, ru })
const provenance = { layer: 'application' as const, isSeeded: true, isAuthored: false, seedKey: 'marketing-seed' }
const sourceForWidget = (widgetKey: string, variant?: string) => {
    const entityCodenameByWidget: Record<string, string> = {
        'marketing.navigation': 'MarketingPageNavigation',
        'marketing.hero': 'MarketingPageSiteSettings',
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
    isActive = true
}: {
    instanceKey: string
    widgetKey: string
    zone: string
    sortOrder: number
    config?: Record<string, unknown>
    items?: unknown[]
    isActive?: boolean
}) => ({
    instanceKey,
    widgetKey,
    zone,
    sortOrder,
    isActive,
    config: { instanceKey, source: sourceForWidget(widgetKey, typeof config.variant === 'string' ? config.variant : undefined), ...config },
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
                items: [
                    record('10', 'site-settings', 'siteSettings', {
                        brandName: localized('Acme', 'Акме'),
                        heroTitle: localized('Our latest', 'Наши новые'),
                        heroSubtitle: localized('A typed marketing page.', 'Типизированная страница.')
                    })
                ]
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

        expect(hero).toMatchObject({ content: { title: 'Наши новые', description: 'Типизированная страница.' } })
        expect(pricing).toMatchObject({ content: { tiers: [{ title: 'Профессиональный', benefits: ['Приоритетная поддержка'] }] } })
        expect(normalized.config).toMatchObject({ themeMode: 'system', allowEmailActions: true, allowTelephoneActions: true })
    })

    it('honors widget presentation flags during normalization', () => {
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
                items: [
                    record('30', 'site-settings', 'siteSettings', {
                        brandName: localized('Acme'),
                        heroTitle: localized('Our latest'),
                        heroSubtitle: localized('A typed marketing page.'),
                        heroEmailLabel: 'Email',
                        heroEmailPlaceholder: 'Your email'
                    })
                ]
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
            content: { lead: undefined }
        })
        expect(normalized.widgets.find((item) => item.widgetKey === 'marketing.collection')).toMatchObject({
            content: { section: { title: 'Features', description: 'Feature description', showTitle: false, showDescription: false } }
        })
    })

    it('applies the application brand asset override to navigation and footer widgets', () => {
        const viewModel = envelope([
            widget({ instanceKey: 'navigation', widgetKey: 'marketing.navigation', zone: 'marketing-header', sortOrder: 0 }),
            widget({
                instanceKey: 'hero',
                widgetKey: 'marketing.hero',
                zone: 'marketing-main',
                sortOrder: 0,
                items: [
                    record('40', 'site-settings', 'siteSettings', {
                        brandName: localized('Inherited brand'),
                        brandLogo: {
                            kind: 'logo',
                            resource: { type: 'url', url: 'https://cdn.example.test/inherited.svg' },
                            alt: localized('Inherited')
                        },
                        heroTitle: localized('Hero'),
                        heroSubtitle: localized('Description')
                    })
                ]
            }),
            widget({ instanceKey: 'footer', widgetKey: 'marketing.footer', zone: 'marketing-footer', sortOrder: 0 })
        ])
        viewModel.marketingPage.config = {
            brandLogo: {
                kind: 'logo',
                resource: { type: 'url', url: 'https://cdn.example.test/application.svg' },
                alt: localized('Application brand')
            }
        }

        const normalized = normalizeMarketingPageRuntime(viewModel, 'en')

        expect(normalized.widgets.find((item) => item.widgetKey === 'marketing.navigation')).toMatchObject({
            content: { brand: { logo: { resource: { url: 'https://cdn.example.test/application.svg' } } } }
        })
        expect(normalized.widgets.find((item) => item.widgetKey === 'marketing.footer')).toMatchObject({
            content: { logo: { resource: { url: 'https://cdn.example.test/application.svg' } } }
        })
    })

    it('keeps safe storage-backed media descriptors without exposing their locator as text', () => {
        const viewModel = envelope([
            widget({
                instanceKey: 'hero',
                widgetKey: 'marketing.hero',
                zone: 'marketing-main',
                sortOrder: 0,
                items: [
                    record('20', 'site-settings', 'siteSettings', {
                        brandName: localized('Acme'),
                        heroTitle: localized('Our latest'),
                        heroSubtitle: localized('A typed marketing page.'),
                        heroLightPreview: {
                            kind: 'hero',
                            resource: { type: 'file', storageKey: 'marketing/hero.webp' },
                            alt: localized('Hero preview')
                        }
                    })
                ]
            })
        ])

        const normalized = normalizeMarketingPageRuntime(viewModel, 'en')
        const hero = normalized.widgets.find((item) => item.widgetKey === 'marketing.hero')

        expect(hero).toMatchObject({
            content: { media: { resource: { type: 'file', storageKey: 'marketing/hero.webp' }, src: '' } }
        })
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
