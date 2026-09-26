import { MARKETING_DEFAULT_IMAGE_URL, encodeWidgetConfigEnvelope } from '@universo-react/types'
import type { TemplateSeedZoneWidget } from '@universo-react/types'
import { defaultMarketingHeroBinding } from './marketing-page.hero'
import { resourceSource } from './marketing-page.seed-helpers'

/**
 * The marketing page is composed exclusively from persisted widget instances.
 * Section rows are bound to the widget that consumes their localized copy;
 * they do not control top-level order or visibility.
 */
export const marketingLayoutZoneWidgets: Record<string, TemplateSeedZoneWidget[]> = {
    'marketing-main': [
        {
            zone: 'marketing-header',
            widgetKey: 'marketing.brand',
            sortOrder: 0,
            config: {
                instanceKey: 'brand',
                source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object', recordKey: 'site-settings' }
            },
            isActive: true
        },
        {
            zone: 'marketing-header',
            widgetKey: 'marketing.navigation',
            sortOrder: 1,
            config: {
                instanceKey: 'navigation',
                source: { entityCodename: 'MarketingPageNavigation', entityKind: 'object' },
                maxItems: 24,
                showAuthActions: false
            },
            isActive: true
        },
        {
            zone: 'marketing-header',
            widgetKey: 'marketing.auth',
            sortOrder: 2,
            config: {
                instanceKey: 'auth',
                showAuthActions: true
            },
            isActive: true
        },
        {
            zone: 'marketing-header',
            widgetKey: 'languageSwitcher',
            sortOrder: 3,
            config: {
                __layout: { placement: 'end' }
            },
            isActive: true
        },
        {
            zone: 'marketing-header',
            widgetKey: 'colorModeSwitcher',
            sortOrder: 4,
            config: {
                __layout: { placement: 'end' }
            },
            isActive: true
        },
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.hero',
            sortOrder: 0,
            config: encodeWidgetConfigEnvelope(
                {
                    rendererConfig: { instanceKey: 'hero', showLeadForm: true },
                    neutral: {
                        bindings: defaultMarketingHeroBinding
                    }
                },
                { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
            ),
            isActive: true
        },
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.image',
            sortOrder: 1,
            config: {
                instanceKey: 'hero-image',
                media: {
                    kind: 'hero',
                    resource: resourceSource(MARKETING_DEFAULT_IMAGE_URL),
                    alt: {
                        en: 'Material UI dashboard preview',
                        ru: 'Предпросмотр панели управления Material UI'
                    },
                    decorative: false
                }
            },
            isActive: true
        },
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.collection',
            sortOrder: 2,
            config: {
                instanceKey: 'logos',
                variant: 'logos',
                source: { entityCodename: 'MarketingPageLogo', entityKind: 'object' },
                copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'logos' },
                maxItems: 100,
                showTitle: true,
                showDescription: true
            },
            isActive: true
        },
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.collection',
            sortOrder: 3,
            config: {
                instanceKey: 'features',
                variant: 'features',
                source: { entityCodename: 'MarketingPageFeature', entityKind: 'object' },
                copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'features' },
                maxItems: 100,
                showTitle: true,
                showDescription: true
            },
            isActive: true
        },
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.collection',
            sortOrder: 4,
            config: {
                instanceKey: 'testimonials',
                variant: 'testimonials',
                source: { entityCodename: 'MarketingPageTestimonial', entityKind: 'object' },
                copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'testimonials' },
                maxItems: 100,
                showTitle: true,
                showDescription: true
            },
            isActive: true
        },
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.collection',
            sortOrder: 5,
            config: {
                instanceKey: 'highlights',
                variant: 'highlights',
                source: { entityCodename: 'MarketingPageHighlight', entityKind: 'object' },
                copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'highlights' },
                maxItems: 100,
                showTitle: true,
                showDescription: true
            },
            isActive: true
        },
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.pricing',
            sortOrder: 6,
            config: {
                instanceKey: 'pricing',
                source: { entityCodename: 'MarketingPagePricing', entityKind: 'object' },
                copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'pricing' },
                maxItems: 24,
                showBenefits: true
            },
            isActive: true
        },
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.collection',
            sortOrder: 7,
            config: {
                instanceKey: 'faq',
                variant: 'faq',
                source: { entityCodename: 'MarketingPageFaq', entityKind: 'object' },
                copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'faq' },
                maxItems: 100,
                showTitle: true,
                showDescription: true
            },
            isActive: true
        },
        {
            zone: 'marketing-footer',
            widgetKey: 'marketing.footer',
            sortOrder: 0,
            config: {
                instanceKey: 'footer',
                source: { entityCodename: 'MarketingPageFooterLink', entityKind: 'object' },
                copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'footer' },
                maxItems: 100,
                showNewsletter: true
            },
            isActive: true
        }
    ]
}
