import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
    APPLICATION_TEMPLATE_KEYS,
    APPLICATION_TEMPLATE_REGISTRY,
    MARKETING_PAGE_TEMPLATE_KEY,
    createRuntimeViewModelSchema,
    marketingActionSchema,
    marketingCollectionWidgetConfigSchema,
    marketingNavigationWidgetConfigSchema,
    marketingMediaSchema,
    marketingPageConfigSchema,
    marketingPageDataSchema,
    marketingPersistedIdSchema,
    marketingProvenanceSchema,
    marketingThemeColorSchema
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
})
