import { expect } from '@playwright/test'
import { decodeWidgetConfigEnvelope, type MetahubSnapshotTransportEnvelope } from '@universo-react/types'
import {
    MERIDIAN_73_ACTIVITIES,
    MERIDIAN_73_EXPERT_VISION,
    MERIDIAN_73_FAQ,
    MERIDIAN_73_FOOTER_LINKS,
    MERIDIAN_73_HERO,
    MERIDIAN_73_IMAGE_URL,
    MERIDIAN_73_METAHUB,
    MERIDIAN_73_NAVIGATION,
    MERIDIAN_73_PARTNER_CATEGORIES,
    MERIDIAN_73_PRICING_TIERS,
    MERIDIAN_73_REASONS,
    MERIDIAN_73_SECTIONS,
    MERIDIAN_73_SITE_SETTINGS
} from '../specs/generators/meridian73MarketingContent.ts'

export const MERIDIAN_73_FIXTURE_FILENAME = 'metahubs-73rd-meridian-app-snapshot.json'

type SnapshotEntity = Record<string, unknown> & { id?: string }
type SnapshotRow = { id?: string; data?: Record<string, unknown>; sortOrder?: number }

const fail = (message: string): never => {
    throw new Error(`73rd Meridian fixture contract failed: ${message}`)
}

const readLocalized = (value: unknown, locale: 'en' | 'ru' = 'en'): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return ''
    const localized = value as { _primary?: string; locales?: Record<string, { content?: unknown }> }
    const locales = localized.locales ?? {}
    const primary = localized._primary
    const resolved = locales[locale]?.content ?? (primary ? locales[primary]?.content : undefined) ?? Object.values(locales)[0]?.content
    return typeof resolved === 'string' ? resolved : ''
}

const snapshotRecord = (fixture: MetahubSnapshotTransportEnvelope): Record<string, unknown> =>
    fixture.snapshot as unknown as Record<string, unknown>

const entities = (fixture: MetahubSnapshotTransportEnvelope): SnapshotEntity[] =>
    Object.values((snapshotRecord(fixture).entities as Record<string, SnapshotEntity> | undefined) ?? {})

const findEntity = (fixture: MetahubSnapshotTransportEnvelope, codename: string): SnapshotEntity => {
    const entity = entities(fixture).find((candidate) => readLocalized(candidate.codename) === codename)
    if (!entity) fail(`missing Object entity ${codename}`)
    return entity
}

const rowsFor = (fixture: MetahubSnapshotTransportEnvelope, codename: string): SnapshotRow[] => {
    const entity = findEntity(fixture, codename)
    const entityId = typeof entity.id === 'string' ? entity.id : ''
    const elements = (snapshotRecord(fixture).elements as Record<string, SnapshotRow[]> | undefined) ?? {}
    return entityId ? elements[entityId] ?? [] : []
}

const recordKeyValues = (rows: SnapshotRow[], field: string): string[] =>
    rows
        .map((row) => row.data?.[field])
        .filter((value): value is string => typeof value === 'string')
        .sort((left, right) => left.localeCompare(right))

const assertSameStrings = (actual: string[], expected: readonly string[], label: string): void => {
    const sortedExpected = [...expected].sort((left, right) => left.localeCompare(right))
    if (actual.length !== sortedExpected.length || actual.some((value, index) => value !== sortedExpected[index])) {
        fail(`${label} mismatch: expected ${JSON.stringify(sortedExpected)}, received ${JSON.stringify(actual)}`)
    }
}

const widgets = (fixture: MetahubSnapshotTransportEnvelope): Array<Record<string, unknown>> => {
    const value = snapshotRecord(fixture).layoutZoneWidgets
    return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
}

const widgetConfig = (widget: Record<string, unknown>): Record<string, unknown> =>
    widget.config && typeof widget.config === 'object' ? (widget.config as Record<string, unknown>) : {}

const findWidgetByInstanceKey = (fixture: MetahubSnapshotTransportEnvelope, instanceKey: string): Record<string, unknown> => {
    const widget = widgets(fixture).find((candidate) => widgetConfig(candidate).instanceKey === instanceKey)
    if (!widget) fail(`missing layout widget instance ${instanceKey}`)
    return widget
}

const findWidgetByKey = (fixture: MetahubSnapshotTransportEnvelope, widgetKey: string): Record<string, unknown> => {
    const widget = widgets(fixture).find((candidate) => candidate.widgetKey === widgetKey)
    if (!widget) fail(`missing layout widget ${widgetKey}`)
    return widget
}

type LocalizedPair = { en: string; ru: string }

const readExactLocalized = (value: unknown, locale: 'en' | 'ru'): string => {
    if (typeof value === 'string') return locale === 'en' ? value : ''
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ''

    const localized = value as { locales?: Record<string, { content?: unknown }> }
    const content = localized.locales?.[locale]?.content
    return typeof content === 'string' ? content : ''
}

const assertScalarEquals = (actual: unknown, expected: unknown, label: string): void => {
    if (actual !== expected) {
        fail(label + ' mismatch: expected ' + JSON.stringify(expected) + ', received ' + JSON.stringify(actual))
    }
}

const findRowByKey = (rows: SnapshotRow[], keyField: string, key: string, label: string): SnapshotRow => {
    const row = rows.find((candidate) => candidate.data?.[keyField] === key)
    if (!row) fail('missing ' + label + ' record ' + key)
    return row
}

const assertRecordOrderAndVisibility = (
    row: SnapshotRow,
    index: number,
    label: string,
    requireDataSortOrder = true,
    requireVisibility = true
): void => {
    assertScalarEquals(row.sortOrder, index + 1, label + ' snapshot order')
    if (requireDataSortOrder) assertScalarEquals(row.data?.SortOrder, index + 1, label + ' SortOrder')
    if (requireVisibility) assertScalarEquals(row.data?.IsVisible, true, label + ' IsVisible')
}

const assertLocalizedRecordSet = <T extends { key: string }>(
    rows: SnapshotRow[],
    keyField: string,
    records: readonly T[],
    localizedFields: readonly (readonly [string, (record: T) => LocalizedPair])[],
    label: string,
    iconField?: (record: T) => string | undefined,
    requireDataSortOrder = true,
    requireVisibility = true
): void => {
    for (const [index, record] of records.entries()) {
        const row = findRowByKey(rows, keyField, record.key, label)
        assertRecordOrderAndVisibility(row, index, label + ' ' + record.key, requireDataSortOrder, requireVisibility)
        if (iconField) assertScalarEquals(row.data?.IconKey, iconField(record), label + ' ' + record.key + ' IconKey')
        for (const [field, expected] of localizedFields) {
            assertLocalizedEquals(row.data?.[field], expected(record), label + ' ' + record.key + ' ' + field)
        }
    }
}

const assertLocalizedEquals = (value: unknown, expected: { en: string; ru: string }, label: string): void => {
    if (readExactLocalized(value, 'en') !== expected.en || readExactLocalized(value, 'ru') !== expected.ru) {
        fail(`${label} does not preserve the approved EN/RU content`)
    }
}

export const assertMeridian73FixtureEnvelopeContract = (fixture: MetahubSnapshotTransportEnvelope): void => {
    assertLocalizedEquals(fixture.metahub.name, MERIDIAN_73_METAHUB.name, 'metahub name')
    assertLocalizedEquals(fixture.metahub.description, MERIDIAN_73_METAHUB.description, 'metahub description')
    if (readLocalized(fixture.metahub.codename) !== MERIDIAN_73_METAHUB.codename) fail('canonical metahub codename is incorrect')

    const siteSettings = rowsFor(fixture, 'MarketingPageSiteSettings')
    if (siteSettings.length !== 1) fail(`expected one site-settings row, received ${siteSettings.length}`)
    assertLocalizedEquals(siteSettings[0]?.data?.BrandName, MERIDIAN_73_SITE_SETTINGS.brandName, 'brand name')
    if (Object.keys(siteSettings[0]?.data ?? {}).some((key) => key.startsWith('Hero'))) {
        fail('Hero content must not be duplicated in MarketingPageSiteSettings')
    }
    assertLocalizedEquals(siteSettings[0]?.data?.FooterDescription, MERIDIAN_73_SITE_SETTINGS.footerDescription, 'footer description')
    assertLocalizedEquals(siteSettings[0]?.data?.CopyrightText, MERIDIAN_73_SITE_SETTINGS.copyright, 'copyright')
    assertScalarEquals(siteSettings[0]?.data?.IsVisible, true, 'site settings IsVisible')
    if (siteSettings[0]?.data?.NewsletterEnabled !== false) fail('newsletter must be disabled until a real destination exists')

    const heroRows = rowsFor(fixture, 'MarketingPageHero')
    assertSameStrings(recordKeyValues(heroRows, 'HeroKey'), ['default'], 'Hero semantic keys')
    assertLocalizedEquals(heroRows[0]?.data?.Title, MERIDIAN_73_HERO.title, 'Hero title')
    assertLocalizedEquals(heroRows[0]?.data?.Accent, MERIDIAN_73_HERO.accent, 'Hero accent')
    assertLocalizedEquals(heroRows[0]?.data?.Description, MERIDIAN_73_HERO.description, 'Hero description')
    const heroWidget = findWidgetByKey(fixture, 'marketing.hero')
    const heroConfig = decodeWidgetConfigEnvelope(widgetConfig(heroWidget), {
        templateKey: 'marketing-page',
        widgetKey: 'marketing.hero',
        zone: 'marketing-main'
    })
    if (heroConfig.rendererConfig.source !== undefined || heroConfig.rendererConfig.copySource !== undefined) {
        fail('Hero renderer configuration must not own an Entity source or copy source')
    }
    const heroBinding = heroConfig.neutral.bindings?.slots[0]?.targets[0]
    if (
        heroConfig.neutral.bindings?.slots.length !== 1 ||
        heroConfig.neutral.bindings.slots[0]?.slot !== 'content' ||
        heroBinding?.entityKind !== 'object' ||
        heroBinding.entityCodename !== 'MarketingPageHero' ||
        heroBinding.selector.kind !== 'semantic-key' ||
        heroBinding.selector.field !== 'key' ||
        heroBinding.selector.value !== 'default'
    ) {
        fail('Hero placement must carry exactly one semantic binding to MarketingPageHero/default')
    }

    assertLocalizedRecordSet(
        rowsFor(fixture, 'MarketingPageSection'),
        'SectionKey',
        MERIDIAN_73_SECTIONS,
        [
            ['Title', (record) => record.title],
            ['Description', (record) => record.description]
        ],
        'section',
        undefined,
        false,
        false
    )
    assertSameStrings(
        recordKeyValues(rowsFor(fixture, 'MarketingPageSection'), 'SectionKey'),
        MERIDIAN_73_SECTIONS.map((item) => item.key),
        'section keys'
    )

    assertSameStrings(
        recordKeyValues(rowsFor(fixture, 'MarketingPageLogo'), 'LogoKey'),
        MERIDIAN_73_PARTNER_CATEGORIES.map((item) => item.key),
        'partner category keys'
    )
    assertSameStrings(
        recordKeyValues(rowsFor(fixture, 'MarketingPageFeature'), 'FeatureKey'),
        MERIDIAN_73_ACTIVITIES.map((item) => item.key),
        'activity keys'
    )
    assertSameStrings(
        recordKeyValues(rowsFor(fixture, 'MarketingPageTestimonial'), 'TestimonialKey'),
        MERIDIAN_73_EXPERT_VISION.map((item) => item.key),
        'expert-vision keys'
    )
    assertSameStrings(
        recordKeyValues(rowsFor(fixture, 'MarketingPageHighlight'), 'HighlightKey'),
        MERIDIAN_73_REASONS.map((item) => item.key),
        'reason keys'
    )
    assertSameStrings(
        recordKeyValues(rowsFor(fixture, 'MarketingPageFaq'), 'FaqKey'),
        MERIDIAN_73_FAQ.map((item) => item.key),
        'FAQ keys'
    )
    assertSameStrings(
        recordKeyValues(rowsFor(fixture, 'MarketingPageNavigation'), 'NavKey'),
        MERIDIAN_73_NAVIGATION.map((item) => item.key),
        'navigation keys'
    )

    assertLocalizedRecordSet(
        rowsFor(fixture, 'MarketingPageLogo'),
        'LogoKey',
        MERIDIAN_73_PARTNER_CATEGORIES,
        [['AltText', (record) => record.label]],
        'partner'
    )
    for (const [index, partner] of MERIDIAN_73_PARTNER_CATEGORIES.entries()) {
        const row = findRowByKey(rowsFor(fixture, 'MarketingPageLogo'), 'LogoKey', partner.key, 'partner')
        assertScalarEquals(row.data?.ImageLight, null, 'partner ' + partner.key + ' ImageLight')
        assertScalarEquals(row.data?.ImageDark, null, 'partner ' + partner.key + ' ImageDark')
        assertRecordOrderAndVisibility(row, index, 'partner ' + partner.key)
    }

    assertLocalizedRecordSet(
        rowsFor(fixture, 'MarketingPageFeature'),
        'FeatureKey',
        MERIDIAN_73_ACTIVITIES,
        [
            ['Title', (record) => record.title],
            ['Description', (record) => record.description]
        ],
        'activity',
        (record) => record.iconKey
    )
    for (const activity of MERIDIAN_73_ACTIVITIES) {
        const row = findRowByKey(rowsFor(fixture, 'MarketingPageFeature'), 'FeatureKey', activity.key, 'activity')
        assertScalarEquals(row.data?.ImageLight, null, 'activity ' + activity.key + ' ImageLight')
        assertScalarEquals(row.data?.ImageDark, null, 'activity ' + activity.key + ' ImageDark')
    }

    assertLocalizedRecordSet(
        rowsFor(fixture, 'MarketingPageTestimonial'),
        'TestimonialKey',
        MERIDIAN_73_EXPERT_VISION,
        [
            ['Name', (record) => record.title],
            ['Quote', (record) => record.description]
        ],
        'expert-vision'
    )
    for (const testimonial of MERIDIAN_73_EXPERT_VISION) {
        const row = findRowByKey(rowsFor(fixture, 'MarketingPageTestimonial'), 'TestimonialKey', testimonial.key, 'expert-vision')
        assertScalarEquals(row.data?.AvatarUrl, null, 'expert-vision ' + testimonial.key + ' AvatarUrl')
        assertScalarEquals(row.data?.LogoLightUrl, null, 'expert-vision ' + testimonial.key + ' LogoLightUrl')
        assertScalarEquals(row.data?.LogoDarkUrl, null, 'expert-vision ' + testimonial.key + ' LogoDarkUrl')
    }

    assertLocalizedRecordSet(
        rowsFor(fixture, 'MarketingPageHighlight'),
        'HighlightKey',
        MERIDIAN_73_REASONS,
        [
            ['Title', (record) => record.title],
            ['Description', (record) => record.description]
        ],
        'highlight',
        (record) => record.iconKey
    )

    assertLocalizedRecordSet(
        rowsFor(fixture, 'MarketingPageFaq'),
        'FaqKey',
        MERIDIAN_73_FAQ,
        [
            ['Question', (record) => record.question],
            ['Answer', (record) => record.answer]
        ],
        'FAQ'
    )

    assertLocalizedRecordSet(
        rowsFor(fixture, 'MarketingPageNavigation'),
        'NavKey',
        MERIDIAN_73_NAVIGATION,
        [['Label', (record) => record.label]],
        'navigation'
    )
    for (const navigation of MERIDIAN_73_NAVIGATION) {
        const row = findRowByKey(rowsFor(fixture, 'MarketingPageNavigation'), 'NavKey', navigation.key, 'navigation')
        assertScalarEquals(row.data?.Href, navigation.href, 'navigation ' + navigation.key + ' Href')
        assertScalarEquals(row.data?.SectionKey, navigation.sectionKey, 'navigation ' + navigation.key + ' SectionKey')
    }

    const pricingRows = rowsFor(fixture, 'MarketingPagePricing')
    assertSameStrings(
        recordKeyValues(pricingRows, 'TierKey'),
        MERIDIAN_73_PRICING_TIERS.map((tier) => tier.key),
        'pricing tier keys'
    )
    for (const [index, tier] of MERIDIAN_73_PRICING_TIERS.entries()) {
        const row = findRowByKey(pricingRows, 'TierKey', tier.key, 'pricing tier')
        assertLocalizedEquals(row.data?.Title, tier.title, `pricing tier ${tier.key} title`)
        assertLocalizedEquals(row.data?.Subheader, tier.description, `pricing tier ${tier.key} description`)
        assertLocalizedEquals(row.data?.Period, tier.period, `pricing tier ${tier.key} period`)
        assertScalarEquals(row.data?.Price, tier.price, `pricing tier ${tier.key} price`)
        assertScalarEquals(row.data?.Featured, false, `pricing tier ${tier.key} featured flag`)
        assertRecordOrderAndVisibility(row, index, `pricing tier ${tier.key}`)
    }

    const benefitRows = rowsFor(fixture, 'MarketingPagePricingBenefit')
    const tierIds = new Map(
        MERIDIAN_73_PRICING_TIERS.map((tier) => [tier.key, findRowByKey(pricingRows, 'TierKey', tier.key, 'pricing tier').id])
    )
    const expectedBenefits = MERIDIAN_73_PRICING_TIERS.flatMap((tier) =>
        tier.benefits.map((label, index) => ({ key: `${tier.key}-benefit-${index + 1}`, label, tierKey: tier.key, order: index + 1 }))
    )
    assertSameStrings(
        recordKeyValues(benefitRows, 'BenefitKey'),
        expectedBenefits.map((benefit) => benefit.key),
        'pricing benefit keys'
    )
    for (const benefit of expectedBenefits) {
        const row = findRowByKey(benefitRows, 'BenefitKey', benefit.key, 'pricing benefit')
        assertLocalizedEquals(row.data?.Label, benefit.label, `pricing benefit ${benefit.key} label`)
        // Benefits are relation-linked to their tier by the persisted tier id,
        // and a broken link would silently detach the financing breakdown.
        assertScalarEquals(row.data?.TierRef, tierIds.get(benefit.tierKey), `pricing benefit ${benefit.key} tier reference`)
        assertScalarEquals(row.data?.SortOrder, benefit.order, `pricing benefit ${benefit.key} order`)
    }

    const footerLinkRows = rowsFor(fixture, 'MarketingPageFooterLink')
    assertSameStrings(
        footerLinkRows.map((row) => String(row.data?.LinkKey ?? '')),
        MERIDIAN_73_FOOTER_LINKS.map((link) => link.key),
        'footer link keys'
    )
    for (const [index, link] of MERIDIAN_73_FOOTER_LINKS.entries()) {
        const row = findRowByKey(footerLinkRows, 'LinkKey', link.key, 'footer link')
        assertLocalizedEquals(row.data?.GroupTitle, link.groupTitle, `footer link ${link.key} group title`)
        assertLocalizedEquals(row.data?.Label, link.label, `footer link ${link.key} label`)
        assertScalarEquals(row.data?.GroupKey, link.groupKey, `footer link ${link.key} group key`)
        assertScalarEquals(row.data?.Href, link.href, `footer link ${link.key} href`)
        assertRecordOrderAndVisibility(row, index, `footer link ${link.key}`)
    }
    // Removed demo destinations must never come back with the approved set.
    const serializedFixture = JSON.stringify(fixture)
    for (const forbidden of ['vk.com/', 'max.ru/', '2gis.ru/', 't.me/meridian73"', '00-00-00']) {
        expect(serializedFixture).not.toContain(forbidden)
    }

    for (const testimonial of rowsFor(fixture, 'MarketingPageTestimonial')) {
        if (testimonial.data?.AvatarUrl || testimonial.data?.LogoLightUrl || testimonial.data?.LogoDarkUrl) {
            fail('expert-vision cards must not fabricate avatars or organization logos')
        }
    }

    const hero = findWidgetByInstanceKey(fixture, 'hero')
    if (widgetConfig(hero).showLeadForm !== false) fail('Hero lead form must be disabled without approved CTA destinations')
    const auth = findWidgetByInstanceKey(fixture, 'auth')
    if (widgetConfig(auth).showAuthActions !== false) fail('marketing auth actions must be disabled for the product landing fixture')
    if (auth.isActive !== false) fail('authentication widget must stay in the layout but be disabled')
    const colorModeSwitcher = findWidgetByKey(fixture, 'colorModeSwitcher')
    if (colorModeSwitcher.isActive !== true) fail('color mode switcher must stay enabled for the RU/EN audience')
    const languageSwitcher = findWidgetByKey(fixture, 'languageSwitcher')
    if (languageSwitcher.isActive !== true) fail('language switcher must stay enabled for the RU/EN audience')
    const footer = findWidgetByInstanceKey(fixture, 'footer')
    if (widgetConfig(footer).showNewsletter !== false) fail('footer newsletter must be disabled')

    const imageWidgets = widgets(fixture).filter((widget) => widget.widgetKey === 'marketing.image')
    if (imageWidgets.length !== 1) fail('fixture must contain exactly one marketing.image widget')
    const image = findWidgetByInstanceKey(fixture, 'hero-image')
    const imageMedia = widgetConfig(image).media as Record<string, unknown> | undefined
    const imageResource = imageMedia?.resource as Record<string, unknown> | undefined
    if (imageResource?.url !== MERIDIAN_73_IMAGE_URL) fail('standalone marketing.image must keep the requested temporary MUI dashboard URL')

    const pricingWidgets = widgets(fixture).filter((widget) => widget.widgetKey === 'marketing.pricing')
    if (pricingWidgets.length !== 1)
        fail(`Consortium layout must contain exactly one marketing.pricing widget, received ${pricingWidgets.length}`)
    const pricingWidget = pricingWidgets[0]
    const pricingConfig = widgetConfig(pricingWidget)
    const pricingSource = pricingConfig.source as Record<string, unknown> | undefined
    const pricingCopySource = pricingConfig.copySource as Record<string, unknown> | undefined
    if (pricingConfig.instanceKey !== 'pricing') fail('Investment stages widget must keep the canonical pricing instance key')
    if (pricingConfig.cardStyle !== 'uniform') fail('Investment stages must render uniform pricing cards')
    if (pricingConfig.cardWidth !== 'auto') fail('Investment stages must use the base layout width by default')
    if (pricingConfig.showBenefits !== true) fail('Investment stages must keep the financing breakdown visible')
    if (pricingConfig.maxItems !== MERIDIAN_73_PRICING_TIERS.length) fail('Investment stages widget must show every funding stage')
    if (pricingSource?.entityCodename !== 'MarketingPagePricing') fail('Investment stages must read the pricing source entity')
    if (pricingCopySource?.recordKey !== 'pricing') fail('Investment stages must reuse the pricing section copy')

    const featuresWidget = findWidgetByInstanceKey(fixture, 'features')
    const featuresConfig = widgetConfig(featuresWidget)
    if (featuresConfig.fixedItemsHeight !== true) {
        fail('Areas of activity must scroll inside a fixed-height cards area')
    }
    if (featuresConfig.showItemDescriptions !== true) {
        fail('Areas of activity must keep the item descriptions visible')
    }

    const expectedMainOrder = ['hero', 'hero-image', 'logos', 'features', 'testimonials', 'highlights', 'pricing', 'faq']
    const activeMainOrder = widgets(fixture)
        .filter((widget) => widget.zone === 'marketing-main' && widget.isActive !== false)
        .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
        .map((widget) => String(widgetConfig(widget).instanceKey ?? ''))
    assertSameStrings([...activeMainOrder].sort(), [...expectedMainOrder].sort(), 'active marketing-main instance set')
    if (activeMainOrder.some((value, index) => value !== expectedMainOrder[index])) {
        fail(`marketing-main order mismatch: expected ${JSON.stringify(expectedMainOrder)}, received ${JSON.stringify(activeMainOrder)}`)
    }

    const navigationRows = rowsFor(fixture, 'MarketingPageNavigation')
    const actualHrefs = navigationRows.map((row) => String(row.data?.Href ?? '')).sort()
    const expectedHrefs = MERIDIAN_73_NAVIGATION.map((item) => item.href).sort()
    assertSameStrings(actualHrefs, expectedHrefs, 'navigation anchors')
    if (navigationRows.some((row) => /team|команда/i.test(readLocalized(row.data?.Label, 'en') + readLocalized(row.data?.Label, 'ru')))) {
        fail('navigation must not invent an unpopulated Team section')
    }

    const serialized = JSON.stringify(fixture)
    const dashboardImageOccurrences = serialized.match(/dashboard\.jpg/g)?.length ?? 0
    if (dashboardImageOccurrences !== 1) {
        fail('base dashboard.jpg must occur exactly once in the marketing.image hero media')
    }
    const dashboardImageWidgetUrls = imageWidgets
        .map((widget) => (widgetConfig(widget).media as Record<string, unknown> | undefined)?.resource)
        .filter((resource): resource is Record<string, unknown> => Boolean(resource && typeof resource === 'object'))
        .map((resource) => resource.url)
        .filter((url): url is string => typeof url === 'string' && url.includes('dashboard.jpg'))
    if (dashboardImageWidgetUrls.length !== 1 || dashboardImageWidgetUrls[0] !== MERIDIAN_73_IMAGE_URL) {
        fail('the only dashboard.jpg occurrence must be the hero marketing.image resource')
    }
    for (const forbidden of [
        'support@email.com',
        'assets-global.website-files.com',
        'Sydney customer logo',
        'Professional',
        'Sign up for free',
        'Our latest',
        'info@...',
        'Telegram: ...',
        'VK: ...'
    ]) {
        if (serialized.includes(forbidden)) fail(`forbidden demo/placeholder content remains: ${forbidden}`)
    }
}
