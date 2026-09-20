import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
    APPLICATION_TEMPLATE_KEYS,
    APPLICATION_TEMPLATE_REGISTRY,
    MARKETING_PAGE_TEMPLATE_KEY,
    createRuntimeViewModelSchema,
    marketingActionSchema,
    marketingCollectionWidgetConfigSchema,
    marketingHeroWidgetSchema,
    marketingImageWidgetSchema,
    marketingImageWidgetConfigSchema,
    marketingNavigationWidgetConfigSchema,
    marketingMediaSchema,
    marketingPageConfigSchema,
    publicMarketingHeroWidgetSchema,
    publicMarketingMediaSchema,
    marketingPageDataSchema,
    marketingPersistedIdSchema,
    marketingProvenanceSchema,
    marketingThemeColorSchema,
    MARKETING_WIDGET_REGISTRY,
    normalizeMarketingNumericText,
    publicMarketingHeaderWidgetSchema,
    marketingBrandWidgetConfigSchema
} from '../common/marketingPage'
import { applicationLayoutConfigSchema, parseApplicationLayoutConfig } from '../common/applicationLayouts'

const uuidV7 = '0190a9b5-3cde-7abc-8def-0123456789ab'
const uuidV4 = '0190a9b5-3cde-4abc-8def-0123456789ab'

const text = { en: 'Marketing', ru: 'Маркетинг' }
const provenance = {
    layer: 'application' as const,
    sourceId: uuidV7,
    isSeeded: false,
    isAuthored: true
}
const logo = {
    kind: 'logo' as const,
    resource: { type: 'url' as const, url: 'https://cdn.example.test/logo.svg' },
    alt: text
}

const baseRecord = {
    id: uuidV7,
    semanticKey: 'site-settings',
    locale: 'en',
    order: 0,
    isVisible: true,
    scope: 'application' as const,
    provenance
}

const siteSettingsRecord = {
    ...baseRecord,
    kind: 'siteSettings' as const,
    brandName: text,
    brandLogo: logo,
    heroTitle: { en: 'Build better products', ru: 'Создавайте лучшие продукты' },
    heroSubtitle: { en: 'A data-driven landing page.', ru: 'Маркетинговая страница на данных.' },
    heroPrimaryAction: {
        label: { en: 'Start now', ru: 'Начать' },
        action: { kind: 'internal' as const, path: '/signup' }
    },
    copyrightLabel: text,
    copyrightAction: {
        label: { en: 'Sitemark', ru: 'Sitemark' },
        action: { kind: 'external' as const, url: 'https://mui.com/' }
    }
}

describe('marketing page contracts', () => {
    it('preserves template-owned layout config and validates it by template key', () => {
        const config = {
            themeMode: 'dark' as const,
            allowEmailActions: false,
            allowTelephoneActions: true,
            externalLinkTarget: 'same-tab' as const
        }

        expect(applicationLayoutConfigSchema.parse(config)).toMatchObject(config)
        expect(parseApplicationLayoutConfig('marketing-page', config)).toMatchObject(config)
        expect(() => parseApplicationLayoutConfig('dashboard', config)).toThrow()
    })

    it('keeps application template keys separate from metahub codenames', () => {
        expect(APPLICATION_TEMPLATE_KEYS).toEqual(['dashboard', MARKETING_PAGE_TEMPLATE_KEY])
        expect(APPLICATION_TEMPLATE_REGISTRY['marketing-page']).toMatchObject({
            key: 'marketing-page',
            supportsDashboardWidgets: false,
            seedPolicyKey: 'initial-only'
        })
        expect(APPLICATION_TEMPLATE_REGISTRY.dashboard.supportsDashboardWidgets).toBe(true)
        expect(MARKETING_WIDGET_REGISTRY['marketing.image'].seamlessAfter).toEqual(['marketing.hero'])
    })

    it('requires UUID v7 for persisted marketing identifiers', () => {
        expect(marketingPersistedIdSchema.safeParse(uuidV7).success).toBe(true)
        expect(marketingPersistedIdSchema.safeParse(uuidV4).success).toBe(false)
        expect(marketingProvenanceSchema.safeParse({ layer: 'metahub', isSeeded: true }).success).toBe(false)
        expect(marketingProvenanceSchema.safeParse({ layer: 'metahub', seedKey: 'hero', isSeeded: true, isAuthored: false }).success).toBe(
            true
        )
    })

    it('rejects unsafe or placeholder actions', () => {
        expect(marketingActionSchema.safeParse({ kind: 'internal', path: '/pricing' }).success).toBe(true)
        expect(marketingActionSchema.safeParse({ kind: 'anchor', href: '#pricing' }).success).toBe(true)
        expect(marketingActionSchema.safeParse({ kind: 'anchor', href: '#' }).success).toBe(false)
        expect(marketingActionSchema.safeParse({ kind: 'internal', path: '//attacker.test' }).success).toBe(false)
        expect(marketingActionSchema.safeParse({ kind: 'internal', path: '/\\attacker.test' }).success).toBe(false)
        expect(marketingActionSchema.safeParse({ kind: 'external', url: 'javascript:alert(1)' }).success).toBe(false)
        expect(marketingActionSchema.safeParse({ kind: 'external', url: 'https://user:pass@example.test' }).success).toBe(false)
    })

    it('requires localized alt text for non-decorative media and reuses safe resources', () => {
        expect(marketingMediaSchema.safeParse(logo).success).toBe(true)
        expect(
            marketingMediaSchema.safeParse({
                kind: 'avatar',
                resource: { type: 'url', url: 'https://cdn.example.test/avatar.png' }
            }).success
        ).toBe(false)
        expect(
            marketingMediaSchema.safeParse({
                kind: 'avatar',
                resource: { type: 'url', url: 'https://cdn.example.test/avatar.png' },
                alt: text,
                decorative: true
            }).success
        ).toBe(false)
        expect(
            marketingMediaSchema.safeParse({
                kind: 'hero',
                resource: { type: 'url', url: 'data:text/plain,unsafe' },
                alt: text
            }).success
        ).toBe(false)
    })

    it('normalizes appearance configuration defaults and rejects composition fields', () => {
        expect(marketingPageConfigSchema.parse({})).toMatchObject({
            themeMode: 'system',
            allowEmailActions: true,
            allowTelephoneActions: true,
            externalLinkTarget: 'new-tab'
        })
        expect(marketingPageConfigSchema.safeParse({ sectionOrder: ['hero', 'footer'] }).success).toBe(false)
        expect(marketingPageConfigSchema.safeParse({ sectionVisibility: { internal: true } }).success).toBe(false)
    })

    it('binds widget sources to built-in Object entities and collection variants', () => {
        expect(
            marketingNavigationWidgetConfigSchema.safeParse({
                instanceKey: 'navigation',
                source: { entityCodename: 'MarketingPageNavigation', entityKind: 'object' }
            }).success
        ).toBe(true)
        expect(
            marketingCollectionWidgetConfigSchema.safeParse({
                instanceKey: 'features',
                variant: 'features',
                source: { entityCodename: 'MarketingPageFeature', entityKind: 'object', fieldMap: { title: 'description' } },
                copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'features' }
            }).success
        ).toBe(true)
        expect(
            marketingCollectionWidgetConfigSchema.safeParse({
                instanceKey: 'features',
                variant: 'features',
                source: { entityCodename: 'MarketingPageFeature', entityKind: 'object', fieldMap: { title: 'PhysicalTitleColumn' } }
            }).success
        ).toBe(false)
        expect(
            marketingCollectionWidgetConfigSchema.safeParse({
                instanceKey: 'features',
                variant: 'features',
                source: { entityCodename: 'MarketingPageLogo', entityKind: 'object' }
            }).success
        ).toBe(false)
        expect(
            marketingNavigationWidgetConfigSchema.safeParse({
                instanceKey: 'navigation',
                source: { entityCodename: 'MarketingPageNavigation', entityKind: 'hub' }
            }).success
        ).toBe(false)
        expect(
            marketingNavigationWidgetConfigSchema.safeParse({
                instanceKey: 'navigation',
                source: { entityCodename: 'MarketingPageNavigation', entityKind: 'object' },
                copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object' }
            }).success
        ).toBe(false)
    })

    it('keeps static marketing image settings separate from entity-backed widget sources', () => {
        const media = {
            kind: 'hero' as const,
            resource: { type: 'url' as const, url: 'https://example.test/hero.webp', launchMode: 'inline' as const },
            decorative: true
        }
        expect(marketingImageWidgetConfigSchema.safeParse({ instanceKey: 'hero-image', media }).success).toBe(true)
        expect(
            marketingImageWidgetConfigSchema.safeParse({
                instanceKey: 'hero-image',
                media: { ...media, resource: { ...media.resource, url: 'http://example.test/hero.webp' } }
            }).success
        ).toBe(false)
        expect(
            marketingImageWidgetConfigSchema.safeParse({
                instanceKey: 'hero-image',
                media: { ...media, resource: { ...media.resource, url: 'http://localhost:3000/hero.webp' } }
            }).success
        ).toBe(true)
        expect(marketingImageWidgetConfigSchema.safeParse({ instanceKey: 'hero-image', media, source: {} }).success).toBe(false)
    })

    it('accepts only opaque theme colors with an accessible foreground choice', () => {
        expect(marketingThemeColorSchema.safeParse('#1976d2').success).toBe(true)
        expect(marketingThemeColorSchema.safeParse('#9c27b0').success).toBe(true)
        expect(marketingThemeColorSchema.safeParse('#1976d280').success).toBe(false)
        expect(marketingThemeColorSchema.safeParse('#808080').success).toBe(true)
        expect(marketingThemeColorSchema.safeParse('hsl(0 0% 50%)').success).toBe(false)
    })

    it('validates widget-owned record payloads and rejects duplicate widget instances', () => {
        const faqRecord = {
            ...baseRecord,
            id: '0190a9b5-3cde-7abc-8def-0123456789ac',
            kind: 'faq' as const,
            question: text,
            answer: text
        }
        const runtime = {
            layoutId: uuidV7,
            layoutVersion: 1,
            layoutHash: 'a'.repeat(64)
        }
        const heroWidget = {
            instanceKey: 'hero',
            zone: 'marketing-main' as const,
            sortOrder: 0,
            isActive: true,
            widgetKey: 'marketing.hero' as const,
            config: {
                instanceKey: 'hero',
                source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' as const }
            },
            data: { records: [siteSettingsRecord] }
        }
        const parsed = marketingPageDataSchema.safeParse({
            templateKey: 'marketing-page',
            locale: 'en',
            config: {},
            widgets: [
                heroWidget,
                {
                    instanceKey: 'faq',
                    zone: 'marketing-main' as const,
                    sortOrder: 1,
                    isActive: true,
                    widgetKey: 'marketing.collection' as const,
                    config: {
                        instanceKey: 'faq',
                        variant: 'faq' as const,
                        source: { entityCodename: 'MarketingPageFaq', entityKind: 'object' as const }
                    },
                    data: { records: [faqRecord] }
                }
            ],
            runtime
        })
        expect(parsed.success).toBe(true)

        expect(
            marketingPageDataSchema.safeParse({
                templateKey: 'marketing-page',
                locale: 'en',
                config: {},
                widgets: [heroWidget, { ...heroWidget, sortOrder: 1 }],
                runtime
            }).success
        ).toBe(false)

        expect(
            marketingPageDataSchema.safeParse({
                templateKey: 'marketing-page',
                locale: 'en',
                config: {},
                widgets: [heroWidget],
                runtime,
                unexpected: true
            }).success
        ).toBe(false)
    })

    it('creates a strict runtime envelope while leaving dashboard validation to its owner', () => {
        const runtimeSchema = createRuntimeViewModelSchema(z.object({ status: z.literal('ready') }).strict())

        expect(
            runtimeSchema.safeParse({
                templateKey: 'marketing-page',
                marketingPage: {
                    templateKey: 'marketing-page',
                    locale: 'en',
                    config: {},
                    widgets: [
                        {
                            ...{
                                instanceKey: 'hero',
                                zone: 'marketing-main',
                                sortOrder: 0,
                                isActive: true,
                                widgetKey: 'marketing.hero',
                                config: {
                                    instanceKey: 'hero',
                                    source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' }
                                },
                                data: { records: [siteSettingsRecord] }
                            }
                        }
                    ],
                    runtime: { layoutId: uuidV7, layoutVersion: 1, layoutHash: 'b'.repeat(64) }
                }
            }).success
        ).toBe(true)
        expect(runtimeSchema.safeParse({ templateKey: 'dashboard', dashboard: { status: 'ready' } }).success).toBe(true)
        expect(runtimeSchema.safeParse({ templateKey: 'dashboard', dashboard: { status: 'not-ready' } }).success).toBe(false)
        expect(runtimeSchema.safeParse({ templateKey: 'marketing-page', dashboard: {} }).success).toBe(false)
        expect(runtimeSchema.safeParse({ templateKey: 'unknown', marketingPage: {} }).success).toBe(false)
    })

    it('keeps remote plain-HTTP media out of the public DTO while allowing the loopback development exception', () => {
        const buildMedia = (url: string) => ({
            kind: 'hero' as const,
            resource: { type: 'url' as const, url, launchMode: 'inline' as const },
            decorative: false,
            alt: { en: 'Alt' }
        })

        expect(publicMarketingMediaSchema.safeParse(buildMedia('https://example.com/image.png')).success).toBe(true)
        expect(publicMarketingMediaSchema.safeParse(buildMedia('http://localhost:3000/image.png')).success).toBe(true)
        expect(publicMarketingMediaSchema.safeParse(buildMedia('http://insecure.example.com/image.png')).success).toBe(false)
        expect(publicMarketingMediaSchema.safeParse(buildMedia('HTTP://INSECURE.EXAMPLE.COM/image.png')).success).toBe(false)
    })
})

describe('marketing hero and image widget contracts', () => {
    const heroConfig = {
        instanceKey: 'hero',
        source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' }
    }

    const heroEnvelope = (zone: string, records: unknown[]) => ({
        instanceKey: 'hero',
        zone,
        widgetKey: 'marketing.hero',
        sortOrder: 0,
        isActive: true,
        config: heroConfig,
        data: { records }
    })

    it('rejects a hero widget outside the main zone with the hero-specific reason', () => {
        const result = marketingHeroWidgetSchema.safeParse(heroEnvelope('marketing-footer', [siteSettingsRecord]))

        expect(result.success).toBe(false)
        expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toContain('Hero widgets must use the main zone.')
    })

    it('rejects hero records that are not site settings', () => {
        const featureRecord = {
            ...baseRecord,
            kind: 'feature' as const,
            title: text,
            description: text,
            iconKey: 'viewQuilt'
        }
        const result = marketingHeroWidgetSchema.safeParse(heroEnvelope('marketing-main', [featureRecord]))

        expect(result.success).toBe(false)
        expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toContain(
            'Hero data must contain site settings only.'
        )
    })

    it('accepts a hero widget with site settings in the main zone and keeps image records empty-only', () => {
        expect(marketingHeroWidgetSchema.safeParse(heroEnvelope('marketing-main', [siteSettingsRecord])).success).toBe(true)

        const imageEnvelope = {
            instanceKey: 'hero-image',
            zone: 'marketing-main',
            widgetKey: 'marketing.image',
            sortOrder: 1,
            isActive: true,
            config: {
                instanceKey: 'hero-image',
                media: {
                    kind: 'hero',
                    resource: { type: 'url', url: 'https://cdn.example.test/hero.png' },
                    alt: text
                }
            },
            data: { records: [] }
        }
        expect(marketingImageWidgetSchema.safeParse(imageEnvelope).success).toBe(true)
    })

    it('keeps the public hero projection main-zone only', () => {
        const publicHero = {
            instanceKey: 'hero',
            zone: 'marketing-header',
            widgetKey: 'marketing.hero',
            sortOrder: 0,
            isActive: true,
            config: { instanceKey: 'hero', showLeadForm: true },
            data: { records: [] }
        }

        expect(publicMarketingHeroWidgetSchema.safeParse(publicHero).success).toBe(false)
        expect(publicMarketingHeroWidgetSchema.safeParse({ ...publicHero, zone: 'marketing-main' }).success).toBe(true)
    })
})

describe('normalizeMarketingNumericText', () => {
    it('strips scaled NUMERIC precision while keeping authored text intact', () => {
        expect(normalizeMarketingNumericText('1.00')).toBe('1')
        expect(normalizeMarketingNumericText('15.50')).toBe('15.5')
        expect(normalizeMarketingNumericText('150,25')).toBe('150.25')
        expect(normalizeMarketingNumericText('-0.10')).toBe('-0.1')
        expect(normalizeMarketingNumericText('0.00')).toBe('0')
        expect(normalizeMarketingNumericText('-0.00')).toBe('0')
        expect(normalizeMarketingNumericText('150–500 млн ₽')).toBe('150–500 млн ₽')
        expect(normalizeMarketingNumericText('RUB 30–90 million')).toBe('RUB 30–90 million')
        expect(normalizeMarketingNumericText('')).toBe('')
    })
})

describe('marketingBrandWidgetConfigSchema', () => {
    const base = {
        instanceKey: 'brand',
        source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' as const, recordKey: 'site-settings' }
    }

    it('accepts optional brand name and decorative logo overrides', () => {
        const parsed = marketingBrandWidgetConfigSchema.safeParse({
            ...base,
            brandName: 'Consortium',
            brandLogo: {
                kind: 'logo',
                resource: { type: 'url', url: 'https://example.test/logo.png', launchMode: 'inline' },
                decorative: true
            }
        })
        expect(parsed.success).toBe(true)
    })

    it('rejects unknown keys and non-decorative logos without alt text', () => {
        expect(marketingBrandWidgetConfigSchema.safeParse({ ...base, unexpected: true }).success).toBe(false)
        expect(
            marketingBrandWidgetConfigSchema.safeParse({
                ...base,
                brandLogo: {
                    kind: 'logo',
                    resource: { type: 'url', url: 'https://example.test/logo.png', launchMode: 'inline' },
                    decorative: false
                }
            }).success
        ).toBe(false)
    })
})

describe('publicMarketingHeaderWidgetSchema', () => {
    const base = {
        instanceKey: 'language-switcher-1',
        zone: 'marketing-header',
        sortOrder: 1,
        isActive: true
    } as const

    it('accepts a shared switcher with the matching instance key config', () => {
        expect(
            publicMarketingHeaderWidgetSchema.safeParse({
                ...base,
                widgetKey: 'languageSwitcher',
                config: { instanceKey: 'language-switcher-1' }
            }).success
        ).toBe(true)
    })

    it('requires the auth row to declare whether auth actions render', () => {
        expect(
            publicMarketingHeaderWidgetSchema.safeParse({
                ...base,
                widgetKey: 'marketing.auth',
                config: { instanceKey: 'language-switcher-1' }
            }).success
        ).toBe(false)
        expect(
            publicMarketingHeaderWidgetSchema.safeParse({
                ...base,
                widgetKey: 'marketing.auth',
                config: { instanceKey: 'language-switcher-1', showAuthActions: false }
            }).success
        ).toBe(true)
    })

    it('accepts an optional header placement and rejects unknown slots', () => {
        expect(
            publicMarketingHeaderWidgetSchema.safeParse({
                ...base,
                widgetKey: 'languageSwitcher',
                placement: 'start',
                config: { instanceKey: 'language-switcher-1' }
            }).success
        ).toBe(true)
        expect(
            publicMarketingHeaderWidgetSchema.safeParse({
                ...base,
                widgetKey: 'languageSwitcher',
                placement: 'middle',
                config: { instanceKey: 'language-switcher-1' }
            }).success
        ).toBe(false)
    })

    it('rejects unknown configuration keys and mismatched instance keys', () => {
        expect(
            publicMarketingHeaderWidgetSchema.safeParse({
                ...base,
                widgetKey: 'colorModeSwitcher',
                config: { instanceKey: 'language-switcher-1', theme: 'dark' }
            }).success
        ).toBe(false)
        expect(
            publicMarketingHeaderWidgetSchema.safeParse({
                ...base,
                widgetKey: 'colorModeSwitcher',
                config: { instanceKey: 'other-widget-2' }
            }).success
        ).toBe(false)
    })
})
