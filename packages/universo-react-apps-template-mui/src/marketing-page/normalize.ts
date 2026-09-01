import type {
    MarketingAction as SharedMarketingAction,
    MarketingMedia as SharedMarketingMedia,
    MarketingPageRecord,
    MarketingPageRuntimeViewModel
} from '@universo-react/types'
import { resolveMarketingLocalizedText, toMarketingActionHref, toMarketingActionLinkAttributes } from '@universo-react/utils'
import type {
    MarketingAction,
    MarketingFeature,
    MarketingFooterData,
    MarketingHeroData,
    MarketingIconKey,
    MarketingLinkGroup,
    MarketingLogo,
    MarketingMedia,
    MarketingPageData,
    MarketingPricingTier,
    MarketingSectionCopy,
    MarketingTestimonial
} from './types'
import i18n from '@universo-react/i18n'
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

const text = (value: unknown, locale: string, fallbackKey?: MarketingFallbackKey) =>
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
    const actionKind = value.kind === 'email' ? 'mailto' : value.kind === 'tel' ? 'tel' : value.kind === 'anchor' ? 'internal' : value.kind
    return {
        semanticKey,
        label,
        actionKind,
        href,
        target: attrs.target === '_blank' ? '_blank' : '_self'
    }
}

const recordByKind = <T extends MarketingPageRecord['kind']>(records: MarketingPageRecord[], kind: T) =>
    records.filter((record): record is Extract<MarketingPageRecord, { kind: T }> => record.kind === kind)

const byOrder = <T extends { order: number; visible: boolean }>(items: T[]) =>
    items.filter((item) => item.visible).sort((left, right) => left.order - right.order)

const sectionCopy = (
    source: MarketingPageRuntimeViewModel['marketingPage']['sectionCopies'],
    key: keyof MarketingPageData['sections'],
    locale: string,
    fallbackKey: MarketingFallbackKey
): MarketingSectionCopy => {
    const sourceKey = key === 'logoCollection' ? 'logos' : key
    const copy = source[sourceKey]
    return {
        title: text(copy?.title, locale, fallbackKey),
        description: copy?.description ? text(copy.description, locale) : undefined
    }
}

export function normalizeMarketingPageRuntime(viewModel: MarketingPageRuntimeViewModel, locale: string): MarketingPageData {
    const page = viewModel.marketingPage
    const settings = recordByKind(page.records, 'siteSettings')[0]
    if (!settings) throw new Error('Marketing page site settings are missing')

    const navigation = byOrder(
        recordByKind(page.records, 'navigationLink').map((record) => {
            const actionKind: MarketingAction['actionKind'] =
                record.action.kind === 'email'
                    ? 'mailto'
                    : record.action.kind === 'tel'
                    ? 'tel'
                    : record.action.kind === 'anchor'
                    ? 'internal'
                    : record.action.kind
            return {
                semanticKey: record.semanticKey,
                label: text(record.label, locale, 'navigationLabel'),
                actionKind,
                href: toMarketingActionHref(record.action),
                target: toMarketingActionLinkAttributes(record.action).target === '_blank' ? ('_blank' as const) : ('_self' as const),
                order: record.order,
                visible: record.isVisible
            }
        })
    )

    const logos: MarketingLogo[] = byOrder(
        recordByKind(page.records, 'logo').map((record) => {
            const light = media(record.media, locale)
            const dark = media(record.darkMedia, locale)
            return {
                semanticKey: record.semanticKey,
                name: text(record.name, locale, 'logoName'),
                media: light
                    ? { ...light, darkResource: dark?.resource, darkSrc: dark?.src, darkAlt: dark?.alt }
                    : dark ?? { src: '', alt: '' },
                order: record.order,
                visible: record.isVisible
            }
        })
    )

    const features: MarketingFeature[] = byOrder(
        recordByKind(page.records, 'feature').map((record) => ({
            semanticKey: record.semanticKey,
            title: text(record.title, locale, 'featureTitle'),
            description: text(record.description, locale),
            icon: iconMap[record.iconKey ?? ''] ?? 'viewQuilt',
            media: (() => {
                const light = media(record.lightMedia, locale)
                const dark = media(record.darkMedia, locale)
                if (!light && !dark) return undefined
                return {
                    src: light?.src ?? dark?.src ?? '',
                    alt: light?.alt ?? dark?.alt ?? '',
                    resource: light?.resource ?? dark?.resource,
                    darkResource: dark?.resource,
                    darkSrc: dark?.src,
                    darkAlt: dark?.alt,
                    decorative: light?.decorative ?? dark?.decorative
                }
            })(),
            order: record.order,
            visible: record.isVisible
        }))
    )

    const testimonials: MarketingTestimonial[] = byOrder(
        recordByKind(page.records, 'testimonial').map((record) => ({
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

    const highlights = byOrder(
        recordByKind(page.records, 'highlight').map((record) => ({
            semanticKey: record.semanticKey,
            title: text(record.title, locale, 'highlightTitle'),
            description: text(record.description, locale),
            icon: iconMap[record.iconKey ?? ''] ?? 'autoAwesome',
            order: record.order,
            visible: record.isVisible
        }))
    )

    const pricingBenefitsByKey = new Map(
        recordByKind(page.records, 'pricingBenefit')
            .filter((record) => record.isVisible)
            .map((record) => [record.semanticKey, text(record.label, locale, 'pricingBenefit')])
    )

    const pricing: MarketingPricingTier[] = byOrder(
        recordByKind(page.records, 'pricingTier').map((record) => {
            const linkedBenefits = record.benefitKeys
                .map((benefitKey) => pricingBenefitsByKey.get(benefitKey))
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
                badge: record.description ? text(record.description, locale) : undefined,
                featured: record.featured,
                action: record.action ? action(record.action.action, text(record.action.label, locale), record.semanticKey) : undefined,
                order: record.order,
                visible: record.isVisible
            }
        })
    )

    const faq = byOrder(
        recordByKind(page.records, 'faq').map((record) => ({
            semanticKey: record.semanticKey,
            question: text(record.question, locale, 'faqQuestion'),
            answer: text(record.answer, locale),
            order: record.order,
            visible: record.isVisible
        }))
    )

    const footerLinkRecords = recordByKind(page.records, 'footerLink').filter((record) => record.isVisible)
    const footerGroups = Array.from(
        footerLinkRecords
            .filter((record) => record.groupKey !== 'social')
            .reduce((groups, record) => {
                const group = groups.get(record.groupKey) ?? {
                    semanticKey: record.groupKey,
                    title: text(record.groupTitle, locale, 'footerGroupTitle'),
                    links: [] as MarketingAction[]
                }
                const link = action(record.action, text(record.label, locale, 'footerLink'), record.semanticKey)
                if (link) group.links.push(link)
                groups.set(record.groupKey, group)
                return groups
            }, new Map<string, MarketingLinkGroup>())
            .values()
    )
    const legalLinks = footerLinkRecords
        .filter((record) => record.groupKey === 'legal' && (record.semanticKey === 'legal-privacy' || record.semanticKey === 'legal-terms'))
        .sort((left, right) => left.order - right.order)
        .map((record) => action(record.action, text(record.secondaryLabel ?? record.label, locale, 'footerLink'), record.semanticKey))
        .filter((link): link is MarketingAction => Boolean(link))
    const socialLinks = footerLinkRecords
        .filter((record) => record.groupKey === 'social')
        .map((record) => {
            const link = action(record.action, text(record.label, locale, 'socialLink'), record.semanticKey)
            return link ? { ...link, icon: iconMap[record.iconKey ?? ''] } : undefined
        })
        .filter((link): link is NonNullable<typeof link> => Boolean(link))

    const hero: MarketingHeroData = {
        title: text(settings.heroTitle, locale, 'heroTitle'),
        accent: settings.heroAccent ? text(settings.heroAccent, locale, 'heroAccent') : undefined,
        description: text(settings.heroSubtitle, locale),
        media: (() => {
            const light = media(settings.heroLightPreview, locale)
            const dark = media(settings.heroDarkPreview, locale)
            if (!light && !dark) return undefined
            return {
                src: light?.src ?? dark?.src ?? '',
                alt: light?.alt ?? dark?.alt ?? '',
                resource: light?.resource ?? dark?.resource,
                darkResource: dark?.resource,
                darkSrc: dark?.src,
                darkAlt: dark?.alt,
                decorative: light?.decorative ?? dark?.decorative
            }
        })(),
        lead:
            settings.heroEmailLabel && settings.heroEmailPlaceholder
                ? {
                      label: settings.heroEmailLabel,
                      placeholder: settings.heroEmailPlaceholder,
                      submitLabel: text(settings.heroPrimaryAction?.label, locale, 'heroSubmit'),
                      action: settings.heroPrimaryAction
                          ? action(
                                settings.heroPrimaryAction.action,
                                text(settings.heroPrimaryAction.label, locale, 'heroSubmit'),
                                'hero-primary'
                            )
                          : undefined,
                      termsText: settings.heroTermsText ? text(settings.heroTermsText, locale) : undefined,
                      termsAction: settings.heroSecondaryAction
                          ? action(
                                settings.heroSecondaryAction.action,
                                text(settings.heroSecondaryAction.label, locale, 'heroTerms'),
                                'hero-secondary'
                            )
                          : undefined
                  }
                : undefined
    }

    const footer: MarketingFooterData = {
        brandName: text(settings.brandName, locale, 'brandName'),
        logo: media(settings.brandLogo, locale),
        description: settings.footerDescription ? text(settings.footerDescription, locale) : undefined,
        newsletter: settings.newsletter
            ? {
                  title: text(settings.newsletter.title, locale, 'newsletterTitle'),
                  description: settings.newsletter.description ? text(settings.newsletter.description, locale) : '',
                  label: text(settings.newsletter.emailLabel, locale, 'emailLabel'),
                  placeholder: text(settings.newsletter.emailPlaceholder, locale, 'emailPlaceholder'),
                  submitLabel: text(settings.newsletter.submitLabel, locale, 'newsletterSubmit'),
                  successMessage: text(settings.newsletter.successMessage, locale, 'newsletterSuccess'),
                  errorMessage: text(settings.newsletter.errorMessage, locale, 'newsletterError'),
                  action: settings.newsletter.action
                      ? action(settings.newsletter.action, text(settings.newsletter.submitLabel, locale, 'newsletterSubmit'), 'newsletter')
                      : undefined
              }
            : undefined,
        groups: footerGroups,
        legalLinks,
        socialLinks,
        copyrightText: text(settings.copyright, locale, 'copyrightText'),
        copyrightAction: settings.copyrightAction
            ? action(settings.copyrightAction.action, text(settings.copyrightAction.label, locale, 'copyrightLabel'), 'copyright')
            : undefined
    }

    return {
        templateKey: 'marketing-page',
        config: {
            themeMode: page.config.themeMode,
            sectionVisibility: page.config.sectionVisibility as NonNullable<MarketingPageData['config']>['sectionVisibility'],
            sectionOrder: page.config.sectionOrder,
            primaryColor: page.config.primaryColor,
            accentColor: page.config.accentColor,
            allowEmailActions: page.config.allowEmailActions,
            allowTelephoneActions: page.config.allowTelephoneActions,
            externalLinkTarget: page.config.externalLinkTarget
        },
        // An application-level appearance override wins; otherwise keep the
        // brand media authored in the singleton site-settings record. This
        // prevents a valid site-settings logo from disappearing in the
        // published header when the layout config has no override.
        brand: { name: footer.brandName, logo: media(page.config.brandLogo, locale) ?? footer.logo },
        navigation,
        auth: {
            signIn: {
                semanticKey: 'sign-in',
                label: translatedFallback(locale, 'authSignIn'),
                actionKind: 'internal',
                href: '/sign-in',
                target: '_self'
            },
            signUp: {
                semanticKey: 'sign-up',
                label: translatedFallback(locale, 'authSignUp'),
                actionKind: 'internal',
                href: '/sign-up',
                target: '_self'
            }
        },
        hero,
        sections: {
            logoCollection: sectionCopy(page.sectionCopies, 'logoCollection', locale, 'logoCollectionTitle'),
            features: sectionCopy(page.sectionCopies, 'features', locale, 'featuresTitle'),
            testimonials: sectionCopy(page.sectionCopies, 'testimonials', locale, 'testimonialsTitle'),
            highlights: sectionCopy(page.sectionCopies, 'highlights', locale, 'highlightsTitle'),
            pricing: sectionCopy(page.sectionCopies, 'pricing', locale, 'pricingSectionTitle'),
            faq: sectionCopy(page.sectionCopies, 'faq', locale, 'faqSectionTitle')
        },
        logos,
        features,
        testimonials,
        highlights,
        pricing,
        faq,
        footer
    }
}
