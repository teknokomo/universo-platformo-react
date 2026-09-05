import {
    marketingPageRuntimeViewModelSchema,
    type MarketingAction as SharedMarketingAction,
    type MarketingCollectionVariant,
    type MarketingMedia as SharedMarketingMedia,
    type MarketingPageRecord,
    type MarketingRuntimeWidget,
    type MarketingSiteSettingsRecord
} from '@universo-react/types'
import { resolveMarketingLocalizedText, toMarketingActionHref, toMarketingActionLinkAttributes } from '@universo-react/utils'
import i18n from '@universo-react/i18n'

import type {
    MarketingAction,
    MarketingCollectionWidget,
    MarketingCollectionWidgetContent,
    MarketingFeature,
    MarketingFooterData,
    MarketingFooterWidget,
    MarketingHeroData,
    MarketingIconKey,
    MarketingLinkGroup,
    MarketingLogo,
    MarketingMedia,
    MarketingNavigationItem,
    MarketingNavigationWidget,
    MarketingPageData,
    MarketingPageWidget,
    MarketingPricingTier,
    MarketingPricingWidget,
    MarketingSectionCopy,
    MarketingTestimonial
} from './types'
import '../i18n'

const iconMap: Record<string, MarketingIconKey> = {
    AutoFixHighRounded: 'autoFixHigh',
    AutoFixHigh: 'autoFixHigh',
    autofixhighrounded: 'autoFixHigh',
    autofixhigh: 'autoFixHigh',
    AutoAwesomeRounded: 'autoAwesome',
    autoawesomerounded: 'autoAwesome',
    ConstructionRounded: 'construction',
    constructionrounded: 'construction',
    DevicesRounded: 'devices',
    devicesrounded: 'devices',
    EdgesensorHighRounded: 'edgesensor',
    edgesensorhighrounded: 'edgesensor',
    QueryStatsRounded: 'queryStats',
    querystatsrounded: 'queryStats',
    SettingsSuggestRounded: 'settingsSuggest',
    settingssuggestrounded: 'settingsSuggest',
    SupportAgentRounded: 'supportAgent',
    supportagentrounded: 'supportAgent',
    ThumbUpAltRounded: 'thumbUp',
    thumbupaltrounded: 'thumbUp',
    ViewQuiltRounded: 'viewQuilt',
    viewquiltrounded: 'viewQuilt',
    github: 'github',
    x: 'x',
    linkedin: 'linkedin'
}

type MarketingFallbackKey =
    | 'navigationLabel'
    | 'logoName'
    | 'featureTitle'
    | 'testimonialAuthor'
    | 'highlightTitle'
    | 'pricingBenefit'
    | 'pricingTitle'
    | 'pricingPeriod'
    | 'faqQuestion'
    | 'footerGroupTitle'
    | 'footerLink'
    | 'socialLink'
    | 'heroTitle'
    | 'heroAccent'
    | 'heroSubmit'
    | 'heroTerms'
    | 'brandName'
    | 'newsletterTitle'
    | 'emailLabel'
    | 'emailPlaceholder'
    | 'newsletterSubmit'
    | 'newsletterSuccess'
    | 'newsletterError'
    | 'copyrightText'
    | 'copyrightLabel'
    | 'logoCollectionTitle'
    | 'featuresTitle'
    | 'testimonialsTitle'
    | 'highlightsTitle'
    | 'pricingSectionTitle'
    | 'faqSectionTitle'
    | 'authSignIn'
    | 'authSignUp'

const normalizeLanguage = (locale: string): string => locale.trim().slice(0, 2).toLowerCase() || 'en'

const translatedFallback = (locale: string, key: MarketingFallbackKey): string => {
    const resourceKey = `marketingPage.fallbacks.${key}`
    const value = i18n.t(resourceKey, { ns: 'apps', lng: normalizeLanguage(locale), defaultValue: '' })
    return typeof value === 'string' && value !== resourceKey ? value : ''
}

const text = (value: unknown, locale: string, fallbackKey?: MarketingFallbackKey): string =>
    resolveMarketingLocalizedText(value, locale, ['en', 'ru']) ?? (fallbackKey ? translatedFallback(locale, fallbackKey) : '')

const media = (value: SharedMarketingMedia | undefined, locale: string): MarketingMedia | undefined => {
    if (!value) return undefined
    return {
        resource: value.resource,
        src: value.resource.url ?? '',
        alt: value.decorative ? '' : text(value.alt, locale),
        decorative: value.decorative
    }
}

const mergeMedia = (light: MarketingMedia | undefined, dark: MarketingMedia | undefined): MarketingMedia | undefined => {
    if (!light && !dark) return undefined
    return {
        ...(light ?? dark!),
        ...(light && dark ? { darkResource: dark.resource, darkSrc: dark.src, darkAlt: dark.alt } : {})
    }
}

const action = (value: SharedMarketingAction | undefined, label: string, semanticKey = 'marketing-action'): MarketingAction | undefined => {
    if (!value) return undefined
    const href = toMarketingActionHref(value)
    const attrs = toMarketingActionLinkAttributes(value)
    const actionKind: MarketingAction['actionKind'] =
        value.kind === 'email' ? 'mailto' : value.kind === 'tel' ? 'tel' : value.kind === 'anchor' ? 'internal' : value.kind
    return {
        semanticKey,
        label,
        actionKind,
        href,
        target: attrs.target === '_blank' ? '_blank' : '_self'
    }
}

const internalAction = (semanticKey: string, label: string, href: string): MarketingAction => ({
    semanticKey,
    label,
    actionKind: 'internal',
    href,
    target: '_self'
})

type RecordOfKind<T extends MarketingPageRecord['kind']> = Extract<MarketingPageRecord, { kind: T }>

const recordsOfKind = <T extends MarketingPageRecord['kind']>(items: readonly MarketingPageRecord[], kind: T): RecordOfKind<T>[] =>
    items.filter((item): item is RecordOfKind<T> => item.kind === kind)

const visibleInContent = <T extends { visible?: boolean; order?: number }>(items: T[]): T[] =>
    items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.visible !== false)
        .sort(
            ({ item: left, index: leftIndex }, { item: right, index: rightIndex }) =>
                (left.order ?? leftIndex) - (right.order ?? rightIndex) || leftIndex - rightIndex
        )
        .map(({ item }) => item)

const widgetItems = (widget: MarketingRuntimeWidget): MarketingPageRecord[] => widget.data.records

const firstSettings = (
    items: readonly MarketingPageRecord[],
    fallback?: MarketingSiteSettingsRecord
): MarketingSiteSettingsRecord | undefined => recordsOfKind(items, 'siteSettings')[0] ?? fallback

const sectionCopy = (
    items: readonly MarketingPageRecord[],
    variant: MarketingCollectionVariant | 'pricing',
    locale: string,
    fallbackKey: MarketingFallbackKey,
    options: { showTitle?: boolean; showDescription?: boolean } = {}
): MarketingSectionCopy => {
    const copy = recordsOfKind(items, 'sectionCopy').find(
        (item) => item.sectionKey === variant || (variant === 'logos' && item.sectionKey === 'logoCollection')
    )
    return {
        title: text(copy?.title, locale, fallbackKey),
        description: copy?.description ? text(copy.description, locale) : undefined,
        showTitle: options.showTitle !== false,
        showDescription: options.showDescription !== false
    }
}

const normalizeNavigation = (
    items: readonly MarketingPageRecord[],
    settings: MarketingSiteSettingsRecord | undefined,
    locale: string,
    showAuthActions = true
): MarketingNavigationWidget['content'] => {
    const navigation = visibleInContent(
        recordsOfKind(items, 'navigationLink').map(
            (record): MarketingNavigationItem => ({
                semanticKey: record.semanticKey,
                label: text(record.label, locale, 'navigationLabel'),
                actionKind:
                    record.action.kind === 'email'
                        ? 'mailto'
                        : record.action.kind === 'tel'
                        ? 'tel'
                        : record.action.kind === 'anchor'
                        ? 'internal'
                        : record.action.kind,
                href: toMarketingActionHref(record.action),
                target: toMarketingActionLinkAttributes(record.action).target === '_blank' ? '_blank' : '_self',
                order: record.order,
                visible: record.isVisible
            })
        )
    )

    return {
        brand: {
            name: text(settings?.brandName, locale, 'brandName'),
            logo: media(settings?.brandLogo, locale)
        },
        navigation,
        ...(showAuthActions
            ? {
                  auth: {
                      signIn: internalAction('sign-in', translatedFallback(locale, 'authSignIn'), '/sign-in'),
                      signUp: internalAction('sign-up', translatedFallback(locale, 'authSignUp'), '/sign-up')
                  }
              }
            : {})
    }
}

const normalizeHero = (settings: MarketingSiteSettingsRecord | undefined, locale: string, showLeadForm = true): MarketingHeroData => {
    const light = media(settings?.heroLightPreview, locale)
    const dark = media(settings?.heroDarkPreview, locale)
    const primaryAction = settings?.heroPrimaryAction
    const secondaryAction = settings?.heroSecondaryAction
    return {
        title: text(settings?.heroTitle, locale, 'heroTitle'),
        accent: settings?.heroAccent ? text(settings.heroAccent, locale, 'heroAccent') : undefined,
        description: text(settings?.heroSubtitle, locale),
        media: mergeMedia(light, dark),
        lead:
            showLeadForm && settings?.heroEmailLabel && settings.heroEmailPlaceholder
                ? {
                      label: text(settings.heroEmailLabel, locale, 'emailLabel'),
                      placeholder: text(settings.heroEmailPlaceholder, locale, 'emailPlaceholder'),
                      submitLabel: text(primaryAction?.label, locale, 'heroSubmit'),
                      action: action(primaryAction?.action, text(primaryAction?.label, locale, 'heroSubmit'), 'hero-primary'),
                      termsText: settings.heroTermsText ? text(settings.heroTermsText, locale) : undefined,
                      termsAction: action(secondaryAction?.action, text(secondaryAction?.label, locale, 'heroTerms'), 'hero-secondary')
                  }
                : undefined
    }
}

const normalizeLogos = (items: readonly MarketingPageRecord[], locale: string): MarketingLogo[] =>
    visibleInContent(
        recordsOfKind(items, 'logo').map((record) => {
            const light = media(record.media, locale)
            const dark = media(record.darkMedia, locale)
            return {
                semanticKey: record.semanticKey,
                name: text(record.name, locale, 'logoName'),
                media: mergeMedia(light, dark) ?? { src: '', alt: '' },
                order: record.order,
                visible: record.isVisible
            }
        })
    )

const normalizeFeatures = (items: readonly MarketingPageRecord[], locale: string): MarketingFeature[] =>
    visibleInContent(
        recordsOfKind(items, 'feature').map((record) => ({
            semanticKey: record.semanticKey,
            title: text(record.title, locale, 'featureTitle'),
            description: text(record.description, locale),
            icon: iconMap[record.iconKey ?? ''] ?? 'viewQuilt',
            media: mergeMedia(media(record.lightMedia, locale), media(record.darkMedia, locale)),
            order: record.order,
            visible: record.isVisible
        }))
    )

const normalizeTestimonials = (items: readonly MarketingPageRecord[], locale: string): MarketingTestimonial[] =>
    visibleInContent(
        recordsOfKind(items, 'testimonial').map((record) => ({
            semanticKey: record.semanticKey,
            quote: text(record.quote, locale),
            name: text(record.author, locale, 'testimonialAuthor'),
            role: record.company ? text(record.company, locale) : undefined,
            avatar: media(record.avatar, locale),
            logo: mergeMedia(media(record.logo, locale), media(record.darkLogo, locale)),
            order: record.order,
            visible: record.isVisible
        }))
    )

const normalizeHighlights = (items: readonly MarketingPageRecord[], locale: string) =>
    visibleInContent(
        recordsOfKind(items, 'highlight').map((record) => ({
            semanticKey: record.semanticKey,
            title: text(record.title, locale, 'highlightTitle'),
            description: text(record.description, locale),
            icon: iconMap[record.iconKey ?? ''] ?? 'autoAwesome',
            order: record.order,
            visible: record.isVisible
        }))
    )

const normalizePricing = (items: readonly MarketingPageRecord[], locale: string): MarketingPricingTier[] => {
    const benefits = new Map(
        recordsOfKind(items, 'pricingBenefit')
            .filter((record) => record.isVisible)
            .map((record) => [record.semanticKey, text(record.label, locale, 'pricingBenefit')] as const)
    )

    return visibleInContent(
        recordsOfKind(items, 'pricingTier').map((record) => {
            const linkedBenefits = record.benefitKeys
                .map((benefitKey) => benefits.get(benefitKey))
                .filter((benefit): benefit is string => Boolean(benefit))
            return {
                semanticKey: record.semanticKey,
                title: text(record.title, locale, 'pricingTitle'),
                price: text(record.price, locale),
                period: text(record.period, locale, 'pricingPeriod'),
                benefits:
                    linkedBenefits.length > 0
                        ? linkedBenefits
                        : record.benefits.map((benefit) => text(benefit, locale)).filter((benefit): benefit is string => Boolean(benefit)),
                description: record.description ? text(record.description, locale) : undefined,
                featured: record.featured,
                action: record.action ? action(record.action.action, text(record.action.label, locale), record.semanticKey) : undefined,
                order: record.order,
                visible: record.isVisible
            }
        })
    )
}

const normalizeFaq = (items: readonly MarketingPageRecord[], locale: string) =>
    visibleInContent(
        recordsOfKind(items, 'faq').map((record) => ({
            semanticKey: record.semanticKey,
            question: text(record.question, locale, 'faqQuestion'),
            answer: text(record.answer, locale),
            order: record.order,
            visible: record.isVisible
        }))
    )

const normalizeFooter = (
    items: readonly MarketingPageRecord[],
    settings: MarketingSiteSettingsRecord | undefined,
    locale: string,
    showNewsletter = true
): MarketingFooterData => {
    const footerLinkItems = recordsOfKind(items, 'footerLink').filter((record) => record.isVisible)
    const groups = Array.from(
        footerLinkItems
            .filter((record) => record.groupKey !== 'social')
            .reduce((result, record) => {
                const group = result.get(record.groupKey) ?? {
                    semanticKey: record.groupKey,
                    title: text(record.groupTitle, locale, 'footerGroupTitle'),
                    links: [] as MarketingAction[],
                    order: record.order,
                    visible: true
                }
                const link = action(record.action, text(record.label, locale, 'footerLink'), record.semanticKey)
                if (link) group.links.push(link)
                result.set(record.groupKey, group)
                return result
            }, new Map<string, MarketingLinkGroup>())
            .values()
    ).sort((left, right) => (left.order ?? 0) - (right.order ?? 0))

    const legalLinks = footerLinkItems
        .filter((record) => record.groupKey === 'legal' && (record.semanticKey === 'legal-privacy' || record.semanticKey === 'legal-terms'))
        .sort((left, right) => left.order - right.order)
        .map((record) => action(record.action, text(record.secondaryLabel ?? record.label, locale, 'footerLink'), record.semanticKey))
        .filter((link): link is MarketingAction => Boolean(link))

    const socialLinks = footerLinkItems
        .filter((record) => record.groupKey === 'social')
        .map((record) => {
            const link = action(record.action, text(record.label, locale, 'socialLink'), record.semanticKey)
            return link ? { ...link, icon: iconMap[record.iconKey ?? ''] } : undefined
        })
        .filter((link): link is NonNullable<typeof link> => Boolean(link))

    const newsletter = settings?.newsletter
    return {
        brandName: text(settings?.brandName, locale, 'brandName'),
        logo: media(settings?.brandLogo, locale),
        description: settings?.footerDescription ? text(settings.footerDescription, locale) : undefined,
        newsletter:
            showNewsletter && newsletter
                ? {
                      title: text(newsletter.title, locale, 'newsletterTitle'),
                      description: newsletter.description ? text(newsletter.description, locale) : '',
                      label: text(newsletter.emailLabel, locale, 'emailLabel'),
                      placeholder: text(newsletter.emailPlaceholder, locale, 'emailPlaceholder'),
                      submitLabel: text(newsletter.submitLabel, locale, 'newsletterSubmit'),
                      successMessage: text(newsletter.successMessage, locale, 'newsletterSuccess'),
                      errorMessage: text(newsletter.errorMessage, locale, 'newsletterError'),
                      action: newsletter.action
                          ? action(newsletter.action, text(newsletter.submitLabel, locale, 'newsletterSubmit'), 'newsletter')
                          : undefined
                  }
                : undefined,
        groups,
        legalLinks,
        socialLinks,
        copyrightText: text(settings?.copyright, locale, 'copyrightText'),
        copyrightAction: settings?.copyrightAction
            ? action(settings.copyrightAction.action, text(settings.copyrightAction.label, locale, 'copyrightLabel'), 'copyright')
            : undefined
    }
}

const frame = (widget: MarketingRuntimeWidget) => ({
    instanceKey: widget.instanceKey,
    zone: widget.zone,
    sortOrder: widget.sortOrder,
    isActive: widget.isActive
})

const normalizeCollection = (
    widget: Extract<MarketingRuntimeWidget, { widgetKey: 'marketing.collection' }>,
    locale: string
): MarketingCollectionWidget => {
    const items = widgetItems(widget)
    const variant = widget.config.variant
    let content: MarketingCollectionWidgetContent
    switch (variant) {
        case 'logos':
            content = {
                variant,
                section: sectionCopy(items, variant, locale, 'logoCollectionTitle', widget.config),
                items: normalizeLogos(items, locale)
            }
            break
        case 'features':
            content = {
                variant,
                section: sectionCopy(items, variant, locale, 'featuresTitle', widget.config),
                items: normalizeFeatures(items, locale)
            }
            break
        case 'testimonials':
            content = {
                variant,
                section: sectionCopy(items, variant, locale, 'testimonialsTitle', widget.config),
                items: normalizeTestimonials(items, locale)
            }
            break
        case 'highlights':
            content = {
                variant,
                section: sectionCopy(items, variant, locale, 'highlightsTitle', widget.config),
                items: normalizeHighlights(items, locale)
            }
            break
        case 'faq':
            content = {
                variant,
                section: sectionCopy(items, variant, locale, 'faqSectionTitle', widget.config),
                items: normalizeFaq(items, locale)
            }
            break
    }
    return { ...frame(widget), widgetKey: 'marketing.collection', content }
}

const normalizeWidget = (
    widget: MarketingRuntimeWidget,
    locale: string,
    globalSettings: MarketingSiteSettingsRecord | undefined
): MarketingPageWidget => {
    const items = widgetItems(widget)
    switch (widget.widgetKey) {
        case 'marketing.navigation':
            return {
                ...frame(widget),
                widgetKey: widget.widgetKey,
                content: normalizeNavigation(items, firstSettings(items, globalSettings), locale, widget.config.showAuthActions)
            }
        case 'marketing.hero':
            return {
                ...frame(widget),
                widgetKey: widget.widgetKey,
                content: normalizeHero(firstSettings(items, globalSettings), locale, widget.config.showLeadForm)
            }
        case 'marketing.collection':
            return normalizeCollection(widget, locale)
        case 'marketing.pricing':
            return {
                ...frame(widget),
                widgetKey: widget.widgetKey,
                content: {
                    section: sectionCopy(items, 'pricing', locale, 'pricingSectionTitle'),
                    tiers: normalizePricing(items, locale)
                }
            } satisfies MarketingPricingWidget
        case 'marketing.footer':
            return {
                ...frame(widget),
                widgetKey: widget.widgetKey,
                content: normalizeFooter(items, firstSettings(items, globalSettings), locale, widget.config.showNewsletter)
            } satisfies MarketingFooterWidget
    }
}

/**
 * Validate the complete server envelope before reducing it to the local
 * render model. Every schema-valid widget is retained, including inactive and
 * empty-content instances, so composition remains server-owned and fail-closed
 * validation is not confused with an empty collection state.
 */
export function normalizeMarketingPageRuntime(viewModel: unknown, locale: string): MarketingPageData {
    const parsed = marketingPageRuntimeViewModelSchema.parse(viewModel)
    const page = parsed.marketingPage
    const requestedLocale = normalizeLanguage(locale)
    const allItems = page.widgets.flatMap((widget) => widgetItems(widget))
    const inheritedSettings = firstSettings(allItems)
    const globalSettings =
        page.config.brandLogo && inheritedSettings ? { ...inheritedSettings, brandLogo: page.config.brandLogo } : inheritedSettings

    return {
        templateKey: 'marketing-page',
        locale: page.locale,
        config: page.config,
        widgets: page.widgets.map((widget) => normalizeWidget(widget, requestedLocale, globalSettings)),
        runtime: page.runtime,
        provenance: page.provenance,
        richContent: page.richContent
    }
}
