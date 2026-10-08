import { describe, expect, it } from 'vitest'
import { authenticatedMarketingPageRuntimePayloadSchema, publicMarketingPageRuntimePayloadSchema } from './runtimeDto'

const emptyScopedPage = {
    templateKey: 'marketing-page' as const,
    locale: 'en' as const,
    config: {},
    widgets: []
}

const emptyPublicScopedPage = {
    ...emptyScopedPage,
    headerPosition: 'fixed' as const,
    headerWidgets: []
}

describe('Marketing Page runtime DTOs', () => {
    it('accepts an intentionally empty scoped layout in authenticated and public runtime payloads', () => {
        expect(
            authenticatedMarketingPageRuntimePayloadSchema.safeParse({
                templateKey: 'marketing-page',
                marketingPage: {
                    ...emptyScopedPage,
                    runtime: {
                        layoutVersion: 1,
                        layoutHash: '0'.repeat(64)
                    }
                }
            }).success
        ).toBe(true)

        const parsedPublicPayload = publicMarketingPageRuntimePayloadSchema.safeParse({
            templateKey: 'marketing-page',
            marketingPage: emptyPublicScopedPage
        })
        expect(parsedPublicPayload.success).toBe(true)
        expect(
            publicMarketingPageRuntimePayloadSchema.safeParse({
                templateKey: 'marketing-page',
                marketingPage: { ...emptyPublicScopedPage, headerPosition: undefined, headerWidgets: undefined }
            }).success
        ).toBe(false)

        expect(
            publicMarketingPageRuntimePayloadSchema.safeParse({
                templateKey: 'marketing-page',
                marketingPage: { ...emptyPublicScopedPage, headerPosition: 'flow' }
            }).success
        ).toBe(true)
    })

    it('rejects physical layout and source identities from authenticated runtime payloads', () => {
        const runtime = { layoutVersion: 1, layoutHash: '0'.repeat(64) }
        const page = {
            ...emptyScopedPage,
            runtime
        }

        const parsed = authenticatedMarketingPageRuntimePayloadSchema.safeParse({
            templateKey: 'marketing-page',
            marketingPage: page
        })
        expect(parsed.success).toBe(true)
        if (parsed.success) expect(parsed.data.marketingPage.runtime).toEqual(runtime)

        expect(
            authenticatedMarketingPageRuntimePayloadSchema.safeParse({
                templateKey: 'marketing-page',
                marketingPage: {
                    ...page,
                    runtime: {
                        ...runtime,
                        layoutId: '0190a9b5-3cde-7abc-8def-0123456789ab',
                        sourceLayoutId: null,
                        sourceContentHash: 'a'.repeat(64)
                    }
                }
            }).success
        ).toBe(false)

        expect(
            authenticatedMarketingPageRuntimePayloadSchema.safeParse({
                templateKey: 'marketing-page',
                marketingPage: {
                    ...page,
                    provenance: {
                        layer: 'application',
                        sourceId: '0190a9b5-3cde-7abc-8def-0123456789ab',
                        seedKey: 'hero',
                        isSeeded: true,
                        isAuthored: false
                    }
                }
            }).success
        ).toBe(false)
    })

    it('rejects physical widget identity fields from authenticated Marketing runtime payloads', () => {
        const runtime = { layoutVersion: 1, layoutHash: '0'.repeat(64) }
        const widget = {
            instanceKey: 'auth',
            widgetKey: 'marketing.auth',
            zone: 'marketing-header',
            sortOrder: 0,
            isActive: true,
            config: {},
            data: { records: [] }
        }
        const payload = {
            templateKey: 'marketing-page',
            marketingPage: { ...emptyScopedPage, runtime, widgets: [widget] }
        }

        expect(authenticatedMarketingPageRuntimePayloadSchema.safeParse(payload).success).toBe(true)

        const physicalIdentity = '0190a9b5-3cde-7abc-8def-0123456789ab'
        const physicalIdentityFields = ['id', 'layoutId', 'sourceWidgetId', 'sourceBaseWidgetId'] as const
        for (const field of physicalIdentityFields) {
            expect(
                authenticatedMarketingPageRuntimePayloadSchema.safeParse({
                    ...payload,
                    marketingPage: {
                        ...payload.marketingPage,
                        widgets: [{ ...widget, [field]: physicalIdentity }]
                    }
                }).success
            ).toBe(false)
        }
    })

    it('rejects physical widget identities from both anonymous runtime widget projections', () => {
        const publicWidget = {
            instanceKey: 'marketing-navigation-0',
            widgetKey: 'marketing.navigation',
            zone: 'marketing-header',
            sortOrder: 0,
            isActive: true,
            config: { maxItems: 24 },
            data: {
                records: [
                    {
                        kind: 'navigationLink',
                        semanticKey: 'home',
                        order: 0,
                        isVisible: true,
                        label: { en: 'Home' },
                        action: { kind: 'internal', path: '/' }
                    }
                ]
            }
        }
        const publicHeaderWidget = {
            instanceKey: 'language-switcher',
            widgetKey: 'languageSwitcher',
            zone: 'marketing-header',
            sortOrder: 1,
            isActive: true,
            config: {}
        }
        const payload = {
            templateKey: 'marketing-page',
            marketingPage: {
                ...emptyPublicScopedPage,
                widgets: [publicWidget],
                headerWidgets: [publicHeaderWidget]
            }
        }

        expect(publicMarketingPageRuntimePayloadSchema.safeParse(payload).success).toBe(true)

        const physicalIdentity = '0190a9b5-3cde-7abc-8def-0123456789ab'
        const physicalIdentityFields = ['id', 'layoutId', 'sourceWidgetId', 'sourceBaseWidgetId'] as const
        for (const field of physicalIdentityFields) {
            expect(
                publicMarketingPageRuntimePayloadSchema.safeParse({
                    ...payload,
                    marketingPage: {
                        ...payload.marketingPage,
                        widgets: [{ ...publicWidget, [field]: physicalIdentity }]
                    }
                }).success
            ).toBe(false)
            expect(
                publicMarketingPageRuntimePayloadSchema.safeParse({
                    ...payload,
                    marketingPage: {
                        ...payload.marketingPage,
                        headerWidgets: [{ ...publicHeaderWidget, [field]: physicalIdentity }]
                    }
                }).success
            ).toBe(false)
        }

        const physicalRecordFields = {
            id: physicalIdentity,
            scope: 'metahub',
            provenance: { layer: 'metahub', sourceId: physicalIdentity }
        } as const
        for (const [field, value] of Object.entries(physicalRecordFields)) {
            expect(
                publicMarketingPageRuntimePayloadSchema.safeParse({
                    ...payload,
                    marketingPage: {
                        ...payload.marketingPage,
                        widgets: [
                            {
                                ...publicWidget,
                                data: {
                                    records: [{ ...publicWidget.data.records[0], [field]: value }]
                                }
                            }
                        ]
                    }
                }).success
            ).toBe(false)
        }

        for (const field of physicalIdentityFields) {
            expect(
                publicMarketingPageRuntimePayloadSchema.safeParse({
                    ...payload,
                    marketingPage: {
                        ...payload.marketingPage,
                        widgets: [{ ...publicWidget, config: { ...publicWidget.config, [field]: physicalIdentity } }]
                    }
                }).success
            ).toBe(false)
            expect(
                publicMarketingPageRuntimePayloadSchema.safeParse({
                    ...payload,
                    marketingPage: {
                        ...payload.marketingPage,
                        headerWidgets: [{ ...publicHeaderWidget, config: { ...publicHeaderWidget.config, [field]: physicalIdentity } }]
                    }
                }).success
            ).toBe(false)
        }
    })

    it('rejects Site Settings records in Navigation runtime projections', () => {
        const navigationWidget = {
            instanceKey: 'navigation',
            widgetKey: 'marketing.navigation',
            zone: 'marketing-header',
            sortOrder: 0,
            isActive: true,
            config: { maxItems: 24 },
            data: {
                records: [
                    {
                        kind: 'siteSettings',
                        semanticKey: 'site-settings',
                        order: 0,
                        isVisible: true,
                        brandName: { en: 'Example' }
                    }
                ]
            }
        }

        expect(
            publicMarketingPageRuntimePayloadSchema.safeParse({
                templateKey: 'marketing-page',
                marketingPage: { ...emptyPublicScopedPage, widgets: [navigationWidget] }
            }).success
        ).toBe(false)
    })
})
