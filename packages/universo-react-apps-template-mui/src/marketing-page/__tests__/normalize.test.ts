import { describe, expect, it } from 'vitest'

import type { MarketingPageRuntimeViewModel } from '@universo-react/types'
import { normalizeMarketingPageRuntime } from '../normalize'

const uuid = (suffix: string): string => `0190a9b5-3cde-7abc-8def-0123456789${suffix}`
const localized = (en: string, ru = en) => ({ en, ru })
const provenance = { layer: 'application' as const, isSeeded: true, isAuthored: false, seedKey: 'marketing-seed' }

describe('normalizeMarketingPageRuntime', () => {
    it('uses locale-owned fallbacks when malformed records omit user-facing copy', () => {
        const viewModel = {
            templateKey: 'marketing-page',
            marketingPage: {
                templateKey: 'marketing-page',
                locale: 'ru',
                config: {},
                records: [
                    {
                        id: uuid('00'),
                        semanticKey: 'site-settings',
                        locale: 'ru',
                        order: 0,
                        isVisible: true,
                        scope: 'application',
                        provenance,
                        kind: 'siteSettings',
                        brandName: null,
                        heroTitle: null,
                        heroSubtitle: null
                    }
                ],
                sectionCopies: {}
            }
        } as unknown as MarketingPageRuntimeViewModel

        const normalized = normalizeMarketingPageRuntime(viewModel, 'ru')

        expect(normalized.hero.title).toBe('Наши новые')
        expect(normalized.footer.brandName).toBe('Material UI')
        expect(normalized.sections.features.title).toBe('Возможности продукта')
        expect(normalized.auth?.signIn?.label).toBe('Войти')
        expect(normalized.auth?.signUp?.label).toBe('Зарегистрироваться')
        expect(normalized.hero.title).not.toContain('marketingPage.fallbacks')
    })

    it('uses linked pricing-benefit records for the rendered tier benefits', () => {
        const viewModel: MarketingPageRuntimeViewModel = {
            templateKey: 'marketing-page',
            marketingPage: {
                templateKey: 'marketing-page',
                locale: 'en',
                config: {},
                records: [
                    {
                        id: uuid('01'),
                        semanticKey: 'site-settings',
                        locale: 'en',
                        order: 0,
                        isVisible: true,
                        scope: 'application',
                        provenance,
                        kind: 'siteSettings',
                        brandName: localized('Acme'),
                        heroTitle: localized('Our latest'),
                        heroSubtitle: localized('A typed marketing page.')
                    },
                    {
                        id: uuid('02'),
                        semanticKey: 'professional-benefit-1',
                        locale: 'en',
                        order: 1,
                        isVisible: true,
                        scope: 'application',
                        provenance,
                        kind: 'pricingBenefit',
                        label: localized('Priority support')
                    },
                    {
                        id: uuid('03'),
                        semanticKey: 'professional',
                        locale: 'en',
                        order: 1,
                        isVisible: true,
                        scope: 'application',
                        provenance,
                        kind: 'pricingTier',
                        title: localized('Professional'),
                        price: localized('15'),
                        period: localized('per month'),
                        benefitKeys: ['professional-benefit-1'],
                        benefits: [],
                        featured: true
                    }
                ],
                sectionCopies: {}
            }
        }

        const normalized = normalizeMarketingPageRuntime(viewModel, 'en')

        expect(normalized.pricing).toHaveLength(1)
        expect(normalized.pricing[0]?.benefits).toEqual(['Priority support'])
    })

    it('retains storage-backed media descriptors when no public URL is available', () => {
        const viewModel = {
            templateKey: 'marketing-page',
            marketingPage: {
                templateKey: 'marketing-page',
                locale: 'en',
                config: {},
                records: [
                    {
                        id: uuid('20'),
                        semanticKey: 'site-settings',
                        locale: 'en',
                        order: 0,
                        isVisible: true,
                        scope: 'application',
                        provenance,
                        kind: 'siteSettings',
                        brandName: localized('Acme'),
                        heroTitle: localized('Our latest'),
                        heroSubtitle: localized('A typed marketing page.'),
                        heroLightPreview: {
                            kind: 'hero',
                            resource: { type: 'file', storageKey: 'marketing/hero.webp', mimeType: 'image/webp' },
                            alt: localized('Hero preview')
                        }
                    }
                ],
                sectionCopies: {}
            }
        } as unknown as MarketingPageRuntimeViewModel

        const normalized = normalizeMarketingPageRuntime(viewModel, 'en')

        expect(normalized.hero.media).toMatchObject({
            resource: { type: 'file', storageKey: 'marketing/hero.webp' },
            src: ''
        })
    })

    it('uses the site-settings brand logo when the application layout has no override', () => {
        const viewModel = {
            templateKey: 'marketing-page',
            marketingPage: {
                templateKey: 'marketing-page',
                locale: 'en',
                config: {},
                records: [
                    {
                        id: uuid('21'),
                        semanticKey: 'site-settings',
                        locale: 'en',
                        order: 0,
                        isVisible: true,
                        scope: 'application',
                        provenance,
                        kind: 'siteSettings',
                        brandName: localized('Acme'),
                        brandLogo: {
                            kind: 'logo',
                            resource: { type: 'url', url: 'https://cdn.example.test/acme.svg' },
                            alt: localized('Acme logo')
                        },
                        heroTitle: localized('Our latest'),
                        heroSubtitle: localized('A typed marketing page.')
                    }
                ],
                sectionCopies: {}
            }
        } as unknown as MarketingPageRuntimeViewModel

        const normalized = normalizeMarketingPageRuntime(viewModel, 'en')

        expect(normalized.brand.logo).toMatchObject({ src: 'https://cdn.example.test/acme.svg', alt: 'Acme logo' })
    })

    it('filters hidden dependent records and resolves canonical icon aliases', () => {
        const viewModel: MarketingPageRuntimeViewModel = {
            templateKey: 'marketing-page',
            marketingPage: {
                templateKey: 'marketing-page',
                locale: 'en',
                config: {},
                records: [
                    {
                        id: uuid('11'),
                        semanticKey: 'site-settings',
                        locale: 'en',
                        order: 0,
                        isVisible: true,
                        scope: 'application',
                        provenance,
                        kind: 'siteSettings',
                        brandName: localized('Acme'),
                        heroTitle: localized('Our latest'),
                        heroSubtitle: localized('A typed marketing page.')
                    },
                    {
                        id: uuid('12'),
                        semanticKey: 'hidden-benefit',
                        locale: 'en',
                        order: 1,
                        isVisible: false,
                        scope: 'application',
                        provenance,
                        kind: 'pricingBenefit',
                        label: localized('Hidden support')
                    },
                    {
                        id: uuid('13'),
                        semanticKey: 'visible-benefit',
                        locale: 'en',
                        order: 2,
                        isVisible: true,
                        scope: 'application',
                        provenance,
                        kind: 'pricingBenefit',
                        label: localized('Priority support')
                    },
                    {
                        id: uuid('14'),
                        semanticKey: 'professional',
                        locale: 'en',
                        order: 1,
                        isVisible: true,
                        scope: 'application',
                        provenance,
                        kind: 'pricingTier',
                        title: localized('Professional'),
                        price: localized('15'),
                        period: localized('per month'),
                        benefitKeys: ['hidden-benefit', 'visible-benefit'],
                        benefits: [],
                        featured: true
                    },
                    {
                        id: uuid('15'),
                        semanticKey: 'dashboard',
                        locale: 'en',
                        order: 1,
                        isVisible: true,
                        scope: 'application',
                        provenance,
                        kind: 'feature',
                        title: localized('Dashboard'),
                        description: localized('A useful dashboard.'),
                        iconKey: 'autofixhighrounded'
                    },
                    {
                        id: uuid('16'),
                        semanticKey: 'hidden-footer-link',
                        locale: 'en',
                        order: 1,
                        isVisible: false,
                        scope: 'application',
                        provenance,
                        kind: 'footerLink',
                        groupKey: 'product',
                        groupTitle: localized('Product'),
                        label: localized('Hidden'),
                        action: { kind: 'internal', path: '/hidden' }
                    },
                    {
                        id: uuid('17'),
                        semanticKey: 'visible-footer-link',
                        locale: 'en',
                        order: 2,
                        isVisible: true,
                        scope: 'application',
                        provenance,
                        kind: 'footerLink',
                        groupKey: 'product',
                        groupTitle: localized('Product'),
                        label: localized('Visible'),
                        action: { kind: 'internal', path: '/visible' }
                    }
                ],
                sectionCopies: {}
            }
        }

        const normalized = normalizeMarketingPageRuntime(viewModel, 'en')

        expect(normalized.pricing[0]?.benefits).toEqual(['Priority support'])
        expect(normalized.features[0]?.icon).toBe('autoFixHigh')
        expect(normalized.footer.groups).toEqual([
            expect.objectContaining({
                semanticKey: 'product',
                links: [expect.objectContaining({ label: 'Visible', href: '/visible' })]
            })
        ])
    })

    it('preserves persisted order for legal footer links', () => {
        const viewModel = {
            templateKey: 'marketing-page',
            marketingPage: {
                templateKey: 'marketing-page',
                locale: 'en',
                config: {},
                records: [
                    {
                        id: uuid('30'),
                        semanticKey: 'site-settings',
                        locale: 'en',
                        order: 0,
                        isVisible: true,
                        scope: 'application',
                        provenance,
                        kind: 'siteSettings',
                        brandName: localized('Acme'),
                        heroTitle: localized('Our latest'),
                        heroSubtitle: localized('A typed marketing page.')
                    },
                    {
                        id: uuid('31'),
                        semanticKey: 'legal-terms',
                        locale: 'en',
                        order: 1,
                        isVisible: true,
                        scope: 'application',
                        provenance,
                        kind: 'footerLink',
                        groupKey: 'legal',
                        groupTitle: localized('Legal'),
                        label: localized('Terms'),
                        secondaryLabel: localized('Terms'),
                        action: { kind: 'internal', path: '/terms' }
                    },
                    {
                        id: uuid('32'),
                        semanticKey: 'legal-privacy',
                        locale: 'en',
                        order: 2,
                        isVisible: true,
                        scope: 'application',
                        provenance,
                        kind: 'footerLink',
                        groupKey: 'legal',
                        groupTitle: localized('Legal'),
                        label: localized('Privacy'),
                        secondaryLabel: localized('Privacy'),
                        action: { kind: 'internal', path: '/privacy' }
                    }
                ],
                sectionCopies: {}
            }
        } as unknown as MarketingPageRuntimeViewModel

        const normalized = normalizeMarketingPageRuntime(viewModel, 'en')

        expect(normalized.footer.legalLinks?.map((link) => link.semanticKey)).toEqual(['legal-terms', 'legal-privacy'])
    })
})
