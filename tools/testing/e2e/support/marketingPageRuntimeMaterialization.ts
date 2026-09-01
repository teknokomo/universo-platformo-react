import assert from 'node:assert/strict'

type SeedElement = {
    codename?: unknown
    sortOrder?: unknown
    data?: unknown
}

type SeedManifest = {
    seed?: {
        elements?: Record<string, SeedElement[]>
    }
}

type RuntimeRecord = Record<string, unknown> & {
    kind?: unknown
    semanticKey?: unknown
    order?: unknown
}

type RuntimePayload = {
    templateKey?: unknown
    marketingPage?: {
        templateKey?: unknown
        records?: RuntimeRecord[]
        sectionCopies?: Record<string, { title?: unknown; description?: unknown }>
    }
}

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const readData = (element: SeedElement): Record<string, unknown> => asRecord(element.data)

const readLocalized = (value: unknown): Record<string, string> => {
    const record = asRecord(value)
    const locales = asRecord(record.locales)
    const source = Object.keys(locales).length > 0 ? locales : record
    return Object.fromEntries(
        Object.entries(source).flatMap(([locale, entry]) => {
            const candidate = typeof entry === 'string' ? entry : asRecord(entry).content
            return typeof candidate === 'string' ? [[locale.toLowerCase().replace(/_/g, '-'), candidate]] : []
        })
    )
}

const readString = (value: unknown): string => (typeof value === 'string' ? value : String(value ?? ''))

const canonicalNumericString = (value: string): string => {
    const match = value.trim().match(/^(-?)(\d+)(?:\.(\d+))?$/)
    if (!match) return value
    const integer = match[2].replace(/^0+(?=\d)/, '')
    const fraction = (match[3] ?? '').replace(/0+$/, '')
    return `${match[1]}${integer}${fraction ? `.${fraction}` : ''}`
}

const canonicalLocalizedNumber = (value: unknown): Record<string, string> =>
    Object.fromEntries(Object.entries(readLocalized(value)).map(([locale, text]) => [locale, canonicalNumericString(text)]))

const seedElements = (manifest: SeedManifest, codename: string): SeedElement[] =>
    (manifest.seed?.elements?.[codename] ?? []).slice().sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))

const seedElement = (manifest: SeedManifest, codename: string, index = 0): SeedElement => {
    const element = seedElements(manifest, codename)[index]
    assert.ok(element, `Seed element ${codename}[${index}] is required for runtime materialization`)
    return element
}

const iconAlias: Record<string, string> = {
    AutoFixHighRounded: 'autoFixHigh',
    AutoAwesomeRounded: 'autoAwesome',
    ConstructionRounded: 'construction',
    DevicesRounded: 'devices',
    EdgesensorHighRounded: 'edgesensor',
    QueryStatsRounded: 'queryStats',
    SettingsSuggestRounded: 'settingsSuggest',
    SupportAgentRounded: 'supportAgent',
    ThumbUpAltRounded: 'thumbUp',
    ViewQuiltRounded: 'viewQuilt'
}

const seedIcon = (value: unknown): string => {
    const key = readString(value)
    return iconAlias[key] ?? key.replace(/Rounded$/i, '').replace(/^./, (letter) => letter.toLowerCase())
}

const runtimeIcon = (value: unknown): string => {
    const key = readString(value)
    const lowerKey = key.toLowerCase()
    const aliases: Record<string, string> = {
        autofixhighrounded: 'autoFixHigh',
        autoawesomerounded: 'autoAwesome',
        constructionrounded: 'construction',
        devicesrounded: 'devices',
        edgesensorhighrounded: 'edgesensor',
        querystatsrounded: 'queryStats',
        settingssuggestrounded: 'settingsSuggest',
        supportagentrounded: 'supportAgent',
        thumbupaltrounded: 'thumbUp',
        viewquiltrounded: 'viewQuilt'
    }
    return aliases[lowerKey] ?? key
}

const recordsByKind = (records: RuntimeRecord[], kind: string): RuntimeRecord[] =>
    records
        .filter((record) => record.kind === kind)
        .slice()
        .sort((left, right) => Number(left.order ?? 0) - Number(right.order ?? 0))

const recordByKind = (records: RuntimeRecord[], kind: string): RuntimeRecord => {
    const record = recordsByKind(records, kind)[0]
    assert.ok(record, `Runtime record kind ${kind} is required`)
    return record
}

const actionSignatureFromHref = (value: unknown): Record<string, string> => {
    const href = readString(value)
    if (href.startsWith('#')) return { kind: 'anchor', href }
    if (href.startsWith('/')) return { kind: 'internal', path: href, target: 'same-tab' }
    return { kind: 'external', url: href, target: 'new-tab' }
}

const actionSignature = (value: unknown): Record<string, string> => {
    const action = asRecord(value)
    switch (action.kind) {
        case 'anchor':
            return { kind: 'anchor', href: readString(action.href) }
        case 'internal':
            return { kind: 'internal', path: readString(action.path), target: readString(action.target || 'same-tab') }
        case 'external':
            return { kind: 'external', url: readString(action.url), target: readString(action.target || 'new-tab') }
        case 'email':
            return { kind: 'email', address: readString(action.address) }
        case 'tel':
            return { kind: 'tel', number: readString(action.number) }
        default:
            return { kind: '' }
    }
}

const mediaSignature = (value: unknown): Record<string, unknown> | undefined => {
    const media = asRecord(value)
    const resource = asRecord(media.resource)
    const url = readString(resource.url)
    if (!url) return undefined
    return {
        kind: readString(media.kind),
        url,
        alt: readLocalized(media.alt),
        decorative: Boolean(media.decorative)
    }
}

const seedMediaSignature = (url: unknown, kind: string, alt: unknown): Record<string, unknown> | undefined => {
    const source = typeof url === 'string' ? url : readString(asRecord(url).url)
    if (!source) return undefined
    return { kind, url: source, alt: readLocalized(alt), decorative: false }
}

const localizedLabel = (value: unknown): string => {
    if (typeof value === 'string') return value
    const localized = readLocalized(value)
    return localized.en ?? Object.values(localized)[0] ?? ''
}

const canonicalRecord = (record: RuntimeRecord, fields: Record<string, (value: unknown) => unknown>) =>
    Object.fromEntries(Object.entries(fields).map(([key, project]) => [key, project(record[key])]))

/**
 * Compare the materialized application read model with the built-in seed.
 * IDs, timestamps, and provenance are intentionally excluded because they are
 * generated by publication/sync; every user-visible semantic value is checked.
 */
export function assertMarketingPageRuntimeMaterialization(payload: RuntimePayload, manifest: SeedManifest): void {
    assert.equal(payload.templateKey, 'marketing-page')
    const page = payload.marketingPage
    assert.ok(page, 'Marketing runtime payload is required')
    assert.equal(page.templateKey, 'marketing-page')
    const records = page.records ?? []

    assert.deepEqual(
        Object.fromEntries(
            [
                'siteSettings',
                'navigationLink',
                'logo',
                'feature',
                'testimonial',
                'highlight',
                'pricingBenefit',
                'pricingTier',
                'faq',
                'footerLink'
            ].map((kind) => [kind, recordsByKind(records, kind).length])
        ),
        {
            siteSettings: 1,
            navigationLink: 6,
            logo: 6,
            feature: 3,
            testimonial: 6,
            highlight: 6,
            pricingBenefit: 14,
            pricingTier: 3,
            faq: 4,
            footerLink: 14
        },
        'Materialized marketing record counts changed'
    )

    const sectionCopies = Object.fromEntries(
        seedElements(manifest, 'MarketingPageSection').map((element) => {
            const data = readData(element)
            return [
                readString(data.SectionKey),
                {
                    title: readLocalized(data.Title),
                    description: readLocalized(data.Description)
                }
            ]
        })
    )
    assert.deepEqual(
        Object.fromEntries(
            Object.entries(page.sectionCopies ?? {}).map(([key, copy]) => [
                key,
                { title: readLocalized(copy.title), description: readLocalized(copy.description) }
            ])
        ),
        sectionCopies,
        'Materialized marketing section copy differs from the metahub seed'
    )

    const siteSettingsSeed = readData(seedElement(manifest, 'MarketingPageSiteSettings'))
    const settings = recordByKind(records, 'siteSettings')
    assert.deepEqual(
        canonicalRecord(settings, {
            brandName: (value) => readLocalized(value),
            heroTitle: (value) => readLocalized(value),
            heroAccent: (value) => readLocalized(value),
            heroSubtitle: (value) => readLocalized(value),
            heroEmailLabel: localizedLabel,
            heroEmailPlaceholder: localizedLabel,
            heroPrimaryAction: (value) => {
                const action = asRecord(value)
                return { label: readLocalized(action.label), action: actionSignature(action.action) }
            },
            heroSecondaryAction: (value) => {
                const action = asRecord(value)
                return { label: readLocalized(action.label), action: actionSignature(action.action) }
            },
            heroTermsText: (value) => readLocalized(value),
            heroLightPreview: mediaSignature,
            heroDarkPreview: mediaSignature,
            copyright: (value) => readLocalized(value),
            copyrightLabel: (value) => readLocalized(value),
            copyrightAction: (value) => {
                const action = asRecord(value)
                return { label: readLocalized(action.label), action: actionSignature(action.action) }
            },
            newsletter: (value) => {
                const newsletter = asRecord(value)
                return {
                    title: readLocalized(newsletter.title),
                    description: readLocalized(newsletter.description),
                    emailLabel: localizedLabel(newsletter.emailLabel),
                    emailPlaceholder: localizedLabel(newsletter.emailPlaceholder),
                    submitLabel: localizedLabel(newsletter.submitLabel),
                    successMessage: readLocalized(newsletter.successMessage),
                    errorMessage: readLocalized(newsletter.errorMessage),
                    action: actionSignature(newsletter.action)
                }
            }
        }),
        {
            brandName: readLocalized(siteSettingsSeed.BrandName),
            heroTitle: readLocalized(siteSettingsSeed.HeroTitle),
            heroAccent: readLocalized(siteSettingsSeed.HeroAccent),
            heroSubtitle: readLocalized(siteSettingsSeed.HeroSubtitle),
            heroEmailLabel: localizedLabel(siteSettingsSeed.HeroEmailLabel),
            heroEmailPlaceholder: localizedLabel(siteSettingsSeed.HeroEmailPlaceholder),
            heroPrimaryAction: {
                label: readLocalized(siteSettingsSeed.HeroPrimaryActionLabel),
                action: actionSignatureFromHref(siteSettingsSeed.HeroPrimaryActionHref)
            },
            heroSecondaryAction: {
                label: readLocalized(siteSettingsSeed.HeroTermsLinkLabel),
                action: actionSignatureFromHref(siteSettingsSeed.HeroTermsHref)
            },
            heroTermsText: readLocalized(siteSettingsSeed.HeroTermsText),
            heroLightPreview: seedMediaSignature(siteSettingsSeed.HeroLightPreview, 'hero', siteSettingsSeed.HeroTitle),
            heroDarkPreview: seedMediaSignature(siteSettingsSeed.HeroDarkPreview, 'hero', siteSettingsSeed.HeroTitle),
            copyright: readLocalized(siteSettingsSeed.CopyrightText),
            copyrightLabel: readLocalized(siteSettingsSeed.CopyrightLabel),
            copyrightAction: {
                label: readLocalized(siteSettingsSeed.CopyrightLabel),
                action: actionSignatureFromHref(siteSettingsSeed.CopyrightHref)
            },
            newsletter: {
                title: readLocalized(siteSettingsSeed.NewsletterTitle),
                description: readLocalized(siteSettingsSeed.NewsletterDescription),
                emailLabel: localizedLabel(siteSettingsSeed.NewsletterLabel),
                emailPlaceholder: localizedLabel(siteSettingsSeed.NewsletterPlaceholder),
                submitLabel: localizedLabel(siteSettingsSeed.NewsletterActionLabel),
                successMessage: readLocalized(siteSettingsSeed.NewsletterSuccessMessage),
                errorMessage: readLocalized(siteSettingsSeed.NewsletterErrorMessage),
                action: actionSignatureFromHref(siteSettingsSeed.NewsletterActionHref)
            }
        },
        'Materialized marketing site settings differ from the metahub seed'
    )

    const navigationExpected = seedElements(manifest, 'MarketingPageNavigation').map((element) => {
        const data = readData(element)
        return { key: readString(data.NavKey), label: readLocalized(data.Label), action: actionSignatureFromHref(data.Href) }
    })
    const navigationActual = recordsByKind(records, 'navigationLink').map((record) => ({
        key: readString(record.semanticKey),
        label: readLocalized(record.label),
        action: actionSignature(record.action)
    }))
    assert.deepEqual(navigationActual, navigationExpected, 'Materialized navigation differs from the metahub seed')

    const logoExpected = seedElements(manifest, 'MarketingPageLogo').map((element) => {
        const data = readData(element)
        return {
            key: readString(data.LogoKey),
            name: readLocalized(data.AltText),
            media: seedMediaSignature(data.ImageLight, 'logo', data.AltText),
            darkMedia: seedMediaSignature(data.ImageDark, 'logo', data.AltText)
        }
    })
    const logoActual = recordsByKind(records, 'logo').map((record) => ({
        key: readString(record.semanticKey),
        name: readLocalized(record.name),
        media: mediaSignature(record.media),
        darkMedia: mediaSignature(record.darkMedia)
    }))
    assert.deepEqual(logoActual, logoExpected, 'Materialized logos differ from the metahub seed')

    const featureExpected = seedElements(manifest, 'MarketingPageFeature').map((element) => {
        const data = readData(element)
        return {
            key: readString(data.FeatureKey),
            icon: seedIcon(data.IconKey),
            title: readLocalized(data.Title),
            description: readLocalized(data.Description),
            lightMedia: seedMediaSignature(data.ImageLight, 'feature', data.Title),
            darkMedia: seedMediaSignature(data.ImageDark, 'feature', data.Title)
        }
    })
    const featureActual = recordsByKind(records, 'feature').map((record) => ({
        key: readString(record.semanticKey),
        icon: runtimeIcon(record.iconKey),
        title: readLocalized(record.title),
        description: readLocalized(record.description),
        lightMedia: mediaSignature(record.lightMedia),
        darkMedia: mediaSignature(record.darkMedia)
    }))
    assert.deepEqual(featureActual, featureExpected, 'Materialized features differ from the metahub seed')

    const testimonialExpected = seedElements(manifest, 'MarketingPageTestimonial').map((element) => {
        const data = readData(element)
        return {
            key: readString(data.TestimonialKey),
            author: readLocalized(data.Name),
            company: readLocalized(data.Occupation),
            quote: readLocalized(data.Quote),
            avatar: seedMediaSignature(data.AvatarUrl, 'avatar', data.Name),
            logo: seedMediaSignature(data.LogoLightUrl, 'logo', data.Name),
            darkLogo: seedMediaSignature(data.LogoDarkUrl, 'logo', data.Name)
        }
    })
    const testimonialActual = recordsByKind(records, 'testimonial').map((record) => ({
        key: readString(record.semanticKey),
        author: readLocalized(record.author),
        company: readLocalized(record.company),
        quote: readLocalized(record.quote),
        avatar: mediaSignature(record.avatar),
        logo: mediaSignature(record.logo),
        darkLogo: mediaSignature(record.darkLogo)
    }))
    assert.deepEqual(testimonialActual, testimonialExpected, 'Materialized testimonials differ from the metahub seed')

    const highlightExpected = seedElements(manifest, 'MarketingPageHighlight').map((element) => {
        const data = readData(element)
        return {
            key: readString(data.HighlightKey),
            icon: seedIcon(data.IconKey),
            title: readLocalized(data.Title),
            description: readLocalized(data.Description)
        }
    })
    const highlightActual = recordsByKind(records, 'highlight').map((record) => ({
        key: readString(record.semanticKey),
        icon: runtimeIcon(record.iconKey),
        title: readLocalized(record.title),
        description: readLocalized(record.description)
    }))
    assert.deepEqual(highlightActual, highlightExpected, 'Materialized highlights differ from the metahub seed')

    const pricingBenefitsExpected = seedElements(manifest, 'MarketingPagePricingBenefit')
        .map((element) => {
            const data = readData(element)
            return {
                key: readString(data.BenefitKey),
                label: readLocalized(data.Label),
                tier: readString(data.TierRef)
            }
        })
        .sort((left, right) => left.key.localeCompare(right.key))
    const pricingBenefitsActual = recordsByKind(records, 'pricingBenefit')
        .map((record) => ({
            key: readString(record.semanticKey),
            label: readLocalized(record.label),
            tier: readString(record.semanticKey).split('-benefit-')[0]
        }))
        .sort((left, right) => left.key.localeCompare(right.key))
    assert.deepEqual(pricingBenefitsActual, pricingBenefitsExpected, 'Materialized pricing benefits differ from the metahub seed')

    const pricingExpected = seedElements(manifest, 'MarketingPagePricing').map((element) => {
        const data = readData(element)
        return {
            key: readString(data.TierKey),
            title: readLocalized(data.Title),
            description: readLocalized(data.Subheader),
            price: { en: canonicalNumericString(readString(data.Price)) },
            period: readLocalized(data.Period),
            action: { label: readLocalized(data.ActionLabel), action: actionSignatureFromHref(data.ActionHref) },
            benefitKeys: pricingBenefitsExpected.filter((benefit) => benefit.tier === data.TierKey).map((benefit) => benefit.key),
            benefits: pricingBenefitsExpected.filter((benefit) => benefit.tier === data.TierKey).map((benefit) => benefit.label),
            featured: Boolean(data.Featured)
        }
    })
    const pricingActual = recordsByKind(records, 'pricingTier').map((record) => {
        const benefitKeys = Array.isArray(record.benefitKeys) ? record.benefitKeys.map(readString) : []
        const benefits = Array.isArray(record.benefits) ? record.benefits.map(readLocalized) : []
        const benefitPairs = benefitKeys
            .map((key, index) => ({ key, label: benefits[index] }))
            .sort((left, right) => left.key.localeCompare(right.key))
        return {
            key: readString(record.semanticKey),
            title: readLocalized(record.title),
            description: readLocalized(record.description),
            price: canonicalLocalizedNumber(record.price),
            period: readLocalized(record.period),
            action: {
                label: readLocalized(asRecord(record.action).label),
                action: actionSignature(asRecord(record.action).action)
            },
            benefitKeys: benefitPairs.map((benefit) => benefit.key),
            benefits: benefitPairs.map((benefit) => benefit.label),
            featured: Boolean(record.featured)
        }
    })
    assert.deepEqual(pricingActual, pricingExpected, 'Materialized pricing tiers differ from the metahub seed')

    const faqExpected = seedElements(manifest, 'MarketingPageFaq').map((element) => {
        const data = readData(element)
        return { key: readString(data.FaqKey), question: readLocalized(data.Question), answer: readLocalized(data.Answer) }
    })
    const faqActual = recordsByKind(records, 'faq').map((record) => ({
        key: readString(record.semanticKey),
        question: readLocalized(record.question),
        answer: readLocalized(record.answer)
    }))
    assert.deepEqual(faqActual, faqExpected, 'Materialized FAQ differs from the metahub seed')

    const footerLinkExpected = seedElements(manifest, 'MarketingPageFooterLink').map((element) => {
        const data = readData(element)
        return {
            key: readString(data.LinkKey),
            groupKey: readString(data.GroupKey),
            groupTitle: readLocalized(data.GroupTitle),
            label: readLocalized(data.Label),
            secondaryLabel: data.BottomLabel ? readLocalized(data.BottomLabel) : undefined,
            action: actionSignatureFromHref(data.Href),
            iconKey: data.IconKey ? readString(data.IconKey) : undefined
        }
    })
    const footerLinkActual = recordsByKind(records, 'footerLink').map((record) => ({
        key: readString(record.semanticKey),
        groupKey: readString(record.groupKey),
        groupTitle: readLocalized(record.groupTitle),
        label: readLocalized(record.label),
        secondaryLabel: record.secondaryLabel ? readLocalized(record.secondaryLabel) : undefined,
        action: actionSignature(record.action),
        iconKey: record.iconKey ? readString(record.iconKey) : undefined
    }))
    assert.deepEqual(footerLinkActual, footerLinkExpected, 'Materialized footer links differ from the metahub seed')
}
