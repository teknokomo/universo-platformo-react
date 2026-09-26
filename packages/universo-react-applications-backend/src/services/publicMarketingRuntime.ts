import {
    getLayoutWidgetDefinition,
    MARKETING_COPY_SOURCE_CODENAME,
    MARKETING_HEADER_WIDGET_KEYS,
    MARKETING_MAX_RUNTIME_RECORDS,
    MARKETING_SOURCE_CODENAMES,
    MARKETING_WIDGET_REGISTRY,
    getMarketingSectionAnchorEntries,
    isLoopbackMarketingUrl,
    marketingPageConfigSchema,
    marketingPersistedIdSchema,
    marketingSemanticKeySchema,
    marketingWidgetSourceCodenames,
    marketingWidgetSourceSchema,
    publicMarketingApplicationRuntimeSchema,
    publicMarketingMediaSchema,
    publicMarketingPageRecordSchema,
    publicMarketingPageRuntimeViewModelSchema,
    type MarketingAction,
    type MarketingCollectionVariant,
    type MarketingHeaderWidgetKey,
    type MarketingPageConfig,
    type MarketingSourceCodename,
    type MarketingWidgetKey,
    type MarketingWidgetSource,
    type PublicMarketingApplicationRuntime
} from '@universo-react/types'
import { parseMarketingActionHref } from '@universo-react/utils'
import { resolveLocalizedContent } from '../shared/runtimeHelpers'
import {
    MARKETING_CHILD_RECORD_LIMIT,
    asMarketingBoolean,
    asMarketingNumber,
    asMarketingRecord,
    asMarketingString,
    selectPricingBenefitSemanticKeysForTiers,
    toMarketingLocalizedMap,
    toMarketingLocalizedNumericMap,
    toMarketingLocalizedOptionalMap,
    toMarketingSemanticKey,
    applyMarketingFieldMap
} from './marketingRuntimeSerialization'
import type { EffectiveLayoutSuccess } from './effectiveLayoutContract'
import { getApplicationLayoutWidgetSourceBindingState } from '../persistence/applicationLayoutStoreSupport'
import { projectMarketingWidgetBindingData } from './marketingHeroEntityBinding'
import {
    PublicMarketingMaterializationError,
    type PublicMarketingRuntimeRow,
    type PublicMarketingRuntimeRows
} from '../persistence/publicApplicationRuntimeStore'
import type { ApplicationPublicRouteResolution } from '@universo-react/types'

type PublicRecord = Record<string, unknown>

export const PUBLIC_MARKETING_RECORD_FIELDS = new Set([
    'semanticKey',
    'order',
    'isVisible',
    'brandName',
    'brandLogo',
    'footerDescription',
    'copyright',
    'copyrightLabel',
    'copyrightAction',
    'newsletter',
    'label',
    'action',
    'iconKey',
    'name',
    'media',
    'darkMedia',
    'title',
    'description',
    'lightMedia',
    'quote',
    'author',
    'company',
    'avatar',
    'logo',
    'darkLogo',
    'question',
    'answer',
    'price',
    'period',
    'benefitKeys',
    'benefits',
    'featured',
    'groupKey',
    'groupTitle',
    'secondaryLabel',
    'sectionKey'
])

const isRecord = (value: unknown): value is PublicRecord => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const asRecord = asMarketingRecord
const asString = asMarketingString
const asNumber = asMarketingNumber
const asBoolean = asMarketingBoolean
const localized = toMarketingLocalizedMap
const localizedNumeric = toMarketingLocalizedNumericMap
const localizedOptional = toMarketingLocalizedOptionalMap
const safeSemanticKey = toMarketingSemanticKey

const toPublicMedia = (
    value: unknown,
    kind: 'logo' | 'hero' | 'avatar' | 'feature' | 'highlight',
    alt?: Record<string, string>
): PublicRecord | undefined => {
    const valueRecord = asRecord(value)
    const resourceCandidate = isRecord(valueRecord.resource) ? valueRecord.resource : valueRecord
    if (resourceCandidate.type !== 'url' || typeof resourceCandidate.url !== 'string') return undefined

    // Defense-in-depth: the public boundary re-applies the publishable media
    // contract even though authoring/snapshot import already enforces it.
    // Remote plain-HTTP media is dropped instead of crossing the anonymous
    // boundary; the check parses the protocol instead of matching a prefix so
    // case variants cannot slip through.
    const mediaUrl = resourceCandidate.url
    try {
        const parsedMediaUrl = new URL(mediaUrl)
        if (parsedMediaUrl.protocol === 'http:' && !isLoopbackMarketingUrl(mediaUrl)) return undefined
    } catch {
        return undefined
    }

    const resolvedAlt = alt ?? (isRecord(valueRecord.alt) ? valueRecord.alt : undefined)

    const candidate = {
        kind,
        resource: {
            type: 'url' as const,
            url: resourceCandidate.url,
            launchMode: resourceCandidate.launchMode ?? 'inline'
        },
        ...(valueRecord.decorative === true ? { decorative: true } : { decorative: false, ...(resolvedAlt ? { alt: resolvedAlt } : {}) }),
        ...(typeof valueRecord.width === 'number' ? { width: valueRecord.width } : {}),
        ...(typeof valueRecord.height === 'number' ? { height: valueRecord.height } : {})
    }
    const parsed = publicMarketingMediaSchema.safeParse(candidate)
    return parsed.success ? (parsed.data as PublicRecord) : undefined
}

const toPublicConfig = (value: unknown): MarketingPageConfig => {
    const raw = asRecord(value)
    const brandLogo = raw.brandLogo ? toPublicMedia(raw.brandLogo, 'logo') : undefined
    const candidate = {
        themeMode: raw.themeMode,
        ...(typeof raw.primaryColor === 'string' ? { primaryColor: raw.primaryColor } : {}),
        ...(typeof raw.accentColor === 'string' ? { accentColor: raw.accentColor } : {}),
        ...(brandLogo ? { brandLogo } : {}),
        allowEmailActions: raw.allowEmailActions,
        allowTelephoneActions: raw.allowTelephoneActions,
        externalLinkTarget: raw.externalLinkTarget
    }
    const parsed = marketingPageConfigSchema.safeParse(candidate)
    if (!parsed.success) throw new PublicMarketingMaterializationError('Public marketing layout config is invalid')
    return parsed.data
}

const safeAction = (value: unknown, config: MarketingPageConfig): MarketingAction | undefined => {
    const action = parseMarketingActionHref(value, { externalTarget: config.externalLinkTarget })
    if (!action) return undefined
    if (action.kind === 'email' && !config.allowEmailActions) return undefined
    if (action.kind === 'tel' && !config.allowTelephoneActions) return undefined
    return action
}

const publicBaseRecord = (row: PublicMarketingRuntimeRow, fallbackKey: string, semanticKeySource?: unknown): PublicRecord => {
    if (!marketingPersistedIdSchema.safeParse(asString(row.id)).success) {
        throw new PublicMarketingMaterializationError('Public marketing row identity is invalid')
    }
    return {
        // The record's own key component (for example HighlightKey) is the
        // stable semantic identity that widget `recordKey` filters resolve
        // against; `codename` is only a legacy fallback.
        semanticKey: safeSemanticKey(semanticKeySource ?? row.codename, fallbackKey),
        order: Math.max(0, Math.min(10000, Math.trunc(asNumber(row.SortOrder, 0)))),
        isVisible: asBoolean(row.IsVisible, true)
    }
}

const parsePublicRecord = (value: PublicRecord): PublicRecord => {
    const parsed = publicMarketingPageRecordSchema.safeParse(value)
    if (!parsed.success) throw new PublicMarketingMaterializationError('Public marketing record is invalid')
    return parsed.data as PublicRecord
}

const publicWidgetInstanceKey = (widgetKey: string, index: number): string =>
    `marketing-${widgetKey.replace(/^marketing\./u, '').toLowerCase()}-${index}`

const PERSISTED_WIDGET_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const UUID_SUBSTRING_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu

/**
 * Public widget identity prefers the persisted semantic instance key so the
 * emitted navigation anchors stay resolvable to rendered section ids. Opaque
 * (UUID-shaped) or missing identities fall back to a deterministic synthetic
 * key that never leaks internal row identifiers. A persisted key colliding
 * with a synthetic identity is deterministically re-keyed instead of failing
 * the whole published runtime.
 */
const resolvePublicWidgetInstanceKey = (
    widgetKey: string,
    config: Record<string, unknown>,
    index: number,
    usedInstanceKeys: Set<string>
): string => {
    const persisted = typeof config.instanceKey === 'string' ? config.instanceKey.trim() : ''
    const persistedIsSemantic =
        Boolean(persisted) &&
        !PERSISTED_WIDGET_UUID_PATTERN.test(persisted) &&
        !UUID_SUBSTRING_PATTERN.test(persisted) &&
        marketingSemanticKeySchema.safeParse(persisted).success

    let candidate = persistedIsSemantic ? persisted : publicWidgetInstanceKey(widgetKey, index)
    if (usedInstanceKeys.has(candidate)) {
        let disambiguator = 0
        do {
            disambiguator += 1
            candidate = publicWidgetInstanceKey(widgetKey, index + disambiguator)
        } while (usedInstanceKeys.has(candidate))
    }

    usedInstanceKeys.add(candidate)
    return candidate
}

const remapPublicActionAnchors = (
    value: unknown,
    publicHrefBySourceAnchor: ReadonlyMap<string, string>,
    unavailablePublicAnchorHref: string
): unknown => {
    if (Array.isArray(value)) {
        return value.map((item) => remapPublicActionAnchors(item, publicHrefBySourceAnchor, unavailablePublicAnchorHref))
    }
    if (!isRecord(value)) return value

    if (value.kind === 'anchor' && typeof value.href === 'string' && value.href.startsWith('#')) {
        const sourceAnchor = value.href.slice(1)
        const publicHref = publicHrefBySourceAnchor.get(sourceAnchor)
        if (publicHref) return { ...value, href: publicHref }
        if (UUID_SUBSTRING_PATTERN.test(sourceAnchor)) return { ...value, href: unavailablePublicAnchorHref }
    }

    return Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [
            key,
            remapPublicActionAnchors(nested, publicHrefBySourceAnchor, unavailablePublicAnchorHref)
        ])
    )
}

const readMaxItems = (value: unknown, fallback: number, maximum: number): number => {
    const parsed = Math.trunc(asNumber(value, fallback))
    return Math.max(1, Math.min(maximum, parsed))
}

const sourceRecords = (
    rows: PublicMarketingRuntimeRows,
    recordsByObject: ReadonlyMap<MarketingSourceCodename, readonly PublicRecord[]>,
    source: MarketingWidgetSource
): PublicRecord[] | null => {
    const objectName = source.entityCodename
    if (source.entityKind !== 'object' || !MARKETING_SOURCE_CODENAMES.includes(objectName)) return null
    if (!rows.has(objectName)) return null
    const available = recordsByObject.get(objectName) ?? []
    const selected = source.recordKey ? available.filter((record) => record.semanticKey === source.recordKey) : available
    // Mirror the authenticated serializer: a configured recordKey that matches
    // nothing must fail closed instead of rendering a silently empty widget.
    if (source.recordKey && selected.length === 0) return null
    return applyMarketingFieldMap(selected, source.fieldMap, {
        isFieldAllowed: (alias, logicalField) =>
            PUBLIC_MARKETING_RECORD_FIELDS.has(alias) && PUBLIC_MARKETING_RECORD_FIELDS.has(logicalField),
        parseRecord: (record) => {
            const parsed = publicMarketingPageRecordSchema.safeParse(record)
            return parsed.success ? (parsed.data as PublicRecord) : null
        }
    })
}

const parseSource = (widgetKey: MarketingWidgetKey, config: PublicRecord): MarketingWidgetSource | undefined => {
    const parsed = marketingWidgetSourceSchema.safeParse(config.source)
    if (!parsed.success) return undefined
    const allowed = marketingWidgetSourceCodenames(
        widgetKey,
        typeof config.variant === 'string' ? (config.variant as MarketingCollectionVariant) : undefined
    )
    return allowed.includes(parsed.data.entityCodename) ? parsed.data : undefined
}

const parseCopySource = (widgetKey: MarketingWidgetKey, config: PublicRecord): MarketingWidgetSource | undefined => {
    if (config.copySource === undefined) return undefined
    if (!['marketing.collection', 'marketing.pricing', 'marketing.footer'].includes(widgetKey)) return undefined
    const parsed = marketingWidgetSourceSchema.safeParse(config.copySource)
    if (!parsed.success || parsed.data.entityCodename !== MARKETING_COPY_SOURCE_CODENAME || !parsed.data.recordKey) return undefined
    return parsed.data
}

const addRecords = (
    rows: PublicMarketingRuntimeRows,
    recordsByObject: Map<MarketingSourceCodename, PublicRecord[]>,
    objectName: MarketingSourceCodename,
    mapper: (row: PublicMarketingRuntimeRow, index: number) => PublicRecord | null
): void => {
    const sourceRows = rows.get(objectName) ?? []
    const mapped: PublicRecord[] = []
    for (let index = 0; index < sourceRows.length; index += 1) {
        const record = mapper(sourceRows[index], index)
        if (record) mapped.push(parsePublicRecord(record))
    }
    recordsByObject.set(objectName, mapped)
}

export interface SerializePublicMarketingRuntimeInput {
    route: ApplicationPublicRouteResolution
    locale: 'en' | 'ru'
    effectiveLayout: EffectiveLayoutSuccess
    rows: PublicMarketingRuntimeRows
}

/** Serialize only renderer inputs for an anonymous published marketing runtime. */
export const serializePublicMarketingRuntime = ({
    route,
    locale,
    effectiveLayout,
    rows
}: SerializePublicMarketingRuntimeInput): PublicMarketingApplicationRuntime => {
    if (effectiveLayout.layout.templateKey !== 'marketing-page') {
        throw new PublicMarketingMaterializationError('Public application template is not marketing-page')
    }

    const runtimeConfig = toPublicConfig(effectiveLayout.layout.config)
    const publicInstanceKeyByWidget = new Map<EffectiveLayoutSuccess['widgets'][number], string>()
    const usedPublicInstanceKeys = new Set<string>()
    const publicWidgetIdentities: Array<{ widget: EffectiveLayoutSuccess['widgets'][number]; instanceKey: string }> = []
    let publicWidgetIndex = 0
    for (const widget of effectiveLayout.widgets) {
        const definition = getLayoutWidgetDefinition(widget.widgetKey)
        if (definition?.shared || !widget.isActive) continue
        const instanceKey = resolvePublicWidgetInstanceKey(
            widget.widgetKey,
            asRecord(widget.config),
            publicWidgetIndex,
            usedPublicInstanceKeys
        )
        publicWidgetIndex += 1
        publicInstanceKeyByWidget.set(widget, instanceKey)
        publicWidgetIdentities.push({ widget, instanceKey })
    }

    const sourceAnchorEntries = getMarketingSectionAnchorEntries(
        publicWidgetIdentities.map(({ widget, instanceKey }) => {
            const config = asRecord(widget.config)
            const sourceInstanceKey = typeof config.instanceKey === 'string' && config.instanceKey.trim() ? config.instanceKey : instanceKey
            return {
                widgetKey: widget.widgetKey,
                isActive: true,
                // Missing or blank persisted keys still need a one-to-one
                // entry shape for the public fallback identity.
                config: { ...config, instanceKey: sourceInstanceKey }
            }
        })
    )
    const publicAnchorEntries = getMarketingSectionAnchorEntries(
        publicWidgetIdentities.map(({ widget, instanceKey }) => ({
            widgetKey: widget.widgetKey,
            isActive: true,
            config: { ...asRecord(widget.config), instanceKey }
        }))
    )
    if (sourceAnchorEntries.length !== publicAnchorEntries.length) {
        throw new PublicMarketingMaterializationError('Public marketing section anchors could not be resolved')
    }
    const publicHrefBySourceAnchor = new Map<string, string>()
    for (let index = 0; index < sourceAnchorEntries.length; index += 1) {
        const sourceEntry = sourceAnchorEntries[index]
        const publicEntry = publicAnchorEntries[index]
        if (sourceEntry && publicEntry && !publicHrefBySourceAnchor.has(sourceEntry[0])) {
            // Renderers validate the fragment against public resolver keys;
            // preserve the alias instead of emitting its DOM target value.
            publicHrefBySourceAnchor.set(sourceEntry[0], `#${publicEntry[0]}`)
        }
    }
    const publicAnchorNames = new Set(publicAnchorEntries.map(([anchor]) => anchor))
    let unavailablePublicAnchorIndex = 0
    while (publicAnchorNames.has(`unavailable-public-section-${unavailablePublicAnchorIndex}`)) {
        unavailablePublicAnchorIndex += 1
    }
    const unavailablePublicAnchorHref = `#unavailable-public-section-${unavailablePublicAnchorIndex}`

    const recordsByObject = new Map<MarketingSourceCodename, PublicRecord[]>()
    const sectionCopiesByKey = new Map<string, PublicRecord>()
    const siteSettingsRows = rows.get('MarketingPageSiteSettings') ?? []
    if (!rows.has('MarketingPageSiteSettings') || siteSettingsRows.length !== 1) {
        throw new PublicMarketingMaterializationError('Public marketing site settings must contain one published row')
    }

    const siteSettings = siteSettingsRows[0]
    const brandConfig = asRecord(effectiveLayout.widgets.find((widget) => widget.widgetKey === 'marketing.brand')?.config)
    const configuredBrandName = asString(brandConfig.brandName)
    const configuredBrandLogo = brandConfig.brandLogo ? toPublicMedia(brandConfig.brandLogo, 'logo') : undefined
    const brandName = configuredBrandName
        ? { en: configuredBrandName, ru: configuredBrandName }
        : localized(siteSettings.BrandName, locale, '')
    const copyrightAction = safeAction(siteSettings.CopyrightHref, runtimeConfig)
    const newsletterAction = safeAction(siteSettings.NewsletterActionHref, runtimeConfig)
    const siteSettingsRecord: PublicRecord = {
        ...publicBaseRecord(siteSettings, 'site-settings'),
        semanticKey: 'site-settings',
        kind: 'siteSettings',
        brandName,
        ...(configuredBrandLogo || toPublicMedia(siteSettings.BrandLogo, 'logo')
            ? { brandLogo: configuredBrandLogo ?? toPublicMedia(siteSettings.BrandLogo, 'logo') }
            : {}),
        ...(localizedOptional(siteSettings.FooterDescription, locale)
            ? { footerDescription: localizedOptional(siteSettings.FooterDescription, locale) }
            : {}),
        ...(localizedOptional(siteSettings.CopyrightText, locale)
            ? { copyright: localizedOptional(siteSettings.CopyrightText, locale) }
            : {}),
        ...(localizedOptional(siteSettings.CopyrightLabel, locale)
            ? { copyrightLabel: localizedOptional(siteSettings.CopyrightLabel, locale) }
            : {}),
        ...(copyrightAction
            ? {
                  copyrightAction: {
                      label: localized(siteSettings.CopyrightLabel, locale, ''),
                      action: copyrightAction
                  }
              }
            : {}),
        ...(siteSettings.NewsletterEnabled === true
            ? {
                  newsletter: {
                      title: localized(siteSettings.NewsletterTitle, locale, ''),
                      ...(localizedOptional(siteSettings.NewsletterDescription, locale)
                          ? { description: localizedOptional(siteSettings.NewsletterDescription, locale) }
                          : {}),
                      emailLabel: resolveLocalizedContent(siteSettings.NewsletterLabel, locale, ''),
                      emailPlaceholder: resolveLocalizedContent(siteSettings.NewsletterPlaceholder, locale, ''),
                      submitLabel: resolveLocalizedContent(siteSettings.NewsletterActionLabel, locale, ''),
                      successMessage: localized(siteSettings.NewsletterSuccessMessage, locale, ''),
                      errorMessage: localized(siteSettings.NewsletterErrorMessage, locale, ''),
                      ...(newsletterAction ? { action: newsletterAction } : {})
                  }
              }
            : {})
    }
    recordsByObject.set('MarketingPageSiteSettings', [parsePublicRecord(siteSettingsRecord)])

    for (const [index, row] of (rows.get('MarketingPageSection') ?? []).entries()) {
        const sectionKey = safeSemanticKey(row.SectionKey ?? row.codename, `section-${index + 1}`)
        const sectionCopy = parsePublicRecord({
            ...publicBaseRecord(row, sectionKey),
            kind: 'sectionCopy',
            sectionKey,
            title: localized(row.Title, locale, ''),
            ...(localizedOptional(row.Description, locale) ? { description: localizedOptional(row.Description, locale) } : {})
        })
        if (sectionCopiesByKey.has(sectionKey)) throw new PublicMarketingMaterializationError('Duplicate public marketing section copy')
        sectionCopiesByKey.set(sectionKey, sectionCopy)
    }
    recordsByObject.set('MarketingPageSection', Array.from(sectionCopiesByKey.values()))

    addRecords(rows, recordsByObject, 'MarketingPageNavigation', (row, index) => {
        const action = safeAction(row.Href, runtimeConfig)
        if (!action) return null
        return {
            ...publicBaseRecord(row, `navigation-${index + 1}`, row.NavKey),
            kind: 'navigationLink',
            label: localized(row.Label, locale, ''),
            action
        }
    })
    addRecords(rows, recordsByObject, 'MarketingPageLogo', (row, index) => {
        const alt = localized(row.AltText, locale, '')
        const media = toPublicMedia(row.ImageLight, 'logo', alt)
        const darkMedia = toPublicMedia(row.ImageDark, 'logo', alt)
        // Partner/ecosystem entries may intentionally be text-only; keep the
        // localized label available to the renderer instead of dropping them.
        return {
            ...publicBaseRecord(row, `logo-${index + 1}`, row.LogoKey),
            kind: 'logo',
            name: alt,
            ...(media ? { media } : {}),
            ...(darkMedia ? { darkMedia } : {})
        }
    })
    addRecords(rows, recordsByObject, 'MarketingPageFeature', (row, index) => ({
        ...publicBaseRecord(row, `feature-${index + 1}`, row.FeatureKey),
        kind: 'feature',
        title: localized(row.Title, locale, ''),
        // Description is optional content: an empty localized map is invalid and
        // must be omitted instead of failing the whole published page.
        ...(localizedOptional(row.Description, locale) ? { description: localizedOptional(row.Description, locale) } : {}),
        ...(safeSemanticKey(row.IconKey, '') ? { iconKey: safeSemanticKey(row.IconKey, '') } : {}),
        ...(toPublicMedia(row.ImageLight, 'feature', localized(row.Title, locale, ''))
            ? { lightMedia: toPublicMedia(row.ImageLight, 'feature', localized(row.Title, locale, '')) }
            : {}),
        ...(toPublicMedia(row.ImageDark, 'feature', localized(row.Title, locale, ''))
            ? { darkMedia: toPublicMedia(row.ImageDark, 'feature', localized(row.Title, locale, '')) }
            : {})
    }))
    addRecords(rows, recordsByObject, 'MarketingPageTestimonial', (row, index) => {
        const name = localized(row.Name, locale, '')
        const avatar = toPublicMedia(row.AvatarUrl, 'avatar', name)
        const logo = toPublicMedia(row.LogoLightUrl, 'logo', name)
        const darkLogo = toPublicMedia(row.LogoDarkUrl, 'logo', name)
        return {
            ...publicBaseRecord(row, `testimonial-${index + 1}`, row.TestimonialKey),
            kind: 'testimonial',
            quote: localized(row.Quote, locale, ''),
            author: name,
            ...(localizedOptional(row.Occupation, locale) ? { company: localizedOptional(row.Occupation, locale) } : {}),
            ...(avatar ? { avatar } : {}),
            ...(logo ? { logo } : {}),
            ...(darkLogo ? { darkLogo } : {})
        }
    })
    addRecords(rows, recordsByObject, 'MarketingPageHighlight', (row, index) => ({
        ...publicBaseRecord(row, `highlight-${index + 1}`, row.HighlightKey),
        kind: 'highlight',
        title: localized(row.Title, locale, ''),
        description: localized(row.Description, locale, ''),
        ...(safeSemanticKey(row.IconKey, '') ? { iconKey: safeSemanticKey(row.IconKey, '') } : {})
    }))

    const pricingBenefitsByTier = new Map<string, PublicRecord[]>()
    addRecords(rows, recordsByObject, 'MarketingPagePricingBenefit', (row, index) => {
        if (!asBoolean(row.IsVisible, true)) return null
        const record = {
            ...publicBaseRecord(row, `pricing-benefit-${index + 1}`, row.BenefitKey),
            kind: 'pricingBenefit',
            label: localized(row.Label, locale, '')
        }
        for (const key of [asString(row.TierRef), asString(row.TierKey)].filter(Boolean)) {
            const benefits = pricingBenefitsByTier.get(key) ?? []
            benefits.push(record)
            pricingBenefitsByTier.set(key, benefits)
        }
        return record
    })
    addRecords(rows, recordsByObject, 'MarketingPagePricing', (row, index) => {
        const action = safeAction(row.ActionHref, runtimeConfig)
        const tierKey = asString(row.TierKey)
        const linkedBenefits = [
            ...(pricingBenefitsByTier.get(asString(row.id)) ?? []),
            ...(pricingBenefitsByTier.get(tierKey) ?? [])
        ].filter(
            (benefit, benefitIndex, all) => all.findIndex((candidate) => candidate.semanticKey === benefit.semanticKey) === benefitIndex
        )
        return {
            ...publicBaseRecord(row, `pricing-${index + 1}`, row.TierKey),
            kind: 'pricingTier',
            title: localized(row.Title, locale, ''),
            ...(localizedOptional(row.Subheader, locale) ? { description: localizedOptional(row.Subheader, locale) } : {}),
            price: localizedNumeric(row.Price, locale, ''),
            ...(localizedOptional(row.Period, locale) ? { period: localizedOptional(row.Period, locale) } : {}),
            ...(action
                ? {
                      action: {
                          label: localized(row.ActionLabel, locale, ''),
                          action
                      }
                  }
                : {}),
            benefitKeys: linkedBenefits.map((benefit) => benefit.semanticKey),
            benefits: linkedBenefits.map((benefit) => benefit.label),
            featured: asBoolean(row.Featured, false)
        }
    })
    addRecords(rows, recordsByObject, 'MarketingPageFaq', (row, index) => ({
        ...publicBaseRecord(row, `faq-${index + 1}`, row.FaqKey),
        kind: 'faq',
        question: localized(row.Question, locale, ''),
        answer: localized(row.Answer, locale, '')
    }))
    addRecords(rows, recordsByObject, 'MarketingPageFooterLink', (row, index) => {
        const action = safeAction(row.Href, runtimeConfig)
        if (!action) return null
        return {
            ...publicBaseRecord(row, `footer-link-${index + 1}`, row.LinkKey),
            kind: 'footerLink',
            groupKey: safeSemanticKey(row.GroupKey, ''),
            ...(localizedOptional(row.GroupTitle, locale) ? { groupTitle: localizedOptional(row.GroupTitle, locale) } : {}),
            label: localized(row.Label, locale, ''),
            ...(localizedOptional(row.BottomLabel, locale) ? { secondaryLabel: localizedOptional(row.BottomLabel, locale) } : {}),
            action,
            ...(safeSemanticKey(row.IconKey, '') ? { iconKey: safeSemanticKey(row.IconKey, '') } : {})
        }
    })

    const publicWidgets: PublicRecord[] = []
    // Data widgets are resolved first so the header rows can reuse their exact
    // public instance keys; otherwise a layout without persisted keys would
    // project a header row that no data widget matches.
    const resolvedKeysByWidgetKey = new Map<string, string[]>()
    for (const widget of effectiveLayout.widgets) {
        const definition = getLayoutWidgetDefinition(widget.widgetKey)
        if (definition?.shared) continue
        if (!widget.isActive) continue

        const registryEntry = MARKETING_WIDGET_REGISTRY[widget.widgetKey as keyof typeof MARKETING_WIDGET_REGISTRY]
        if (!registryEntry || !registryEntry.allowedZones.includes(widget.zone as never)) {
            throw new PublicMarketingMaterializationError('Public marketing widget placement is invalid')
        }

        const config = asRecord(widget.config)
        const hasBindingSlot = Boolean(definition?.bindingSlots?.length)
        const source =
            registryEntry.dataOwnership === 'entity' && !hasBindingSlot
                ? parseSource(widget.widgetKey as MarketingWidgetKey, config)
                : undefined
        if (registryEntry.dataOwnership === 'entity' && !hasBindingSlot && !source) {
            throw new PublicMarketingMaterializationError('Public marketing widget source is invalid')
        }
        if (hasBindingSlot && (config.source !== undefined || config.copySource !== undefined)) {
            throw new PublicMarketingMaterializationError(
                'Public marketing widgets with binding slots must use their registered Entity binding'
            )
        }
        const copySource = parseCopySource(widget.widgetKey as MarketingWidgetKey, config)
        if (config.copySource !== undefined && !copySource) {
            throw new PublicMarketingMaterializationError('Public marketing widget copy source is invalid')
        }

        const contentRecords = source ? sourceRecords(rows, recordsByObject, source) : []
        if (source && !contentRecords) throw new PublicMarketingMaterializationError('Public marketing widget source is unavailable')
        const copyRecords = copySource ? sourceRecords(rows, recordsByObject, copySource) : []
        if (copySource && !copyRecords) throw new PublicMarketingMaterializationError('Public marketing widget copy source is unavailable')
        let bindingData: ReturnType<typeof projectMarketingWidgetBindingData>
        try {
            bindingData = projectMarketingWidgetBindingData({
                widgetKey: widget.widgetKey,
                bindings: getApplicationLayoutWidgetSourceBindingState(widget)?.bindings,
                loadRecords: (target) => rows.get(target.entityCodename as MarketingSourceCodename) ?? [],
                config: runtimeConfig
            })
        } catch {
            throw new PublicMarketingMaterializationError('Public marketing widget Entity binding is unavailable')
        }
        if (widget.widgetKey === 'marketing.pricing' && config.showBenefits !== false && !rows.has('MarketingPagePricingBenefit')) {
            throw new PublicMarketingMaterializationError('Public marketing pricing benefits are unavailable')
        }

        const maxItems =
            widget.widgetKey === 'marketing.collection'
                ? readMaxItems(config.maxItems, 100, 1000)
                : widget.widgetKey === 'marketing.footer'
                ? readMaxItems(config.maxItems, 100, 100)
                : widget.widgetKey === 'marketing.navigation' || widget.widgetKey === 'marketing.pricing'
                ? readMaxItems(config.maxItems, 24, 100)
                : MARKETING_MAX_RUNTIME_RECORDS
        const recordsForWidget: PublicRecord[] = []
        const append = (values: readonly PublicRecord[], limit = maxItems): void => {
            recordsForWidget.push(...values.slice(0, limit))
        }

        switch (widget.widgetKey) {
            case 'marketing.brand':
                append(contentRecords ?? [], 1)
                break
            case 'marketing.navigation':
                append(recordsByObject.get('MarketingPageSiteSettings') ?? [], 1)
                append(contentRecords ?? [])
                break
            case 'marketing.collection':
                append(copyRecords ?? [])
                append(contentRecords ?? [])
                break
            case 'marketing.pricing': {
                append(copyRecords ?? [])
                append(contentRecords ?? [])
                if (config.showBenefits !== false) {
                    // Child collections must not share the tier `maxItems` budget:
                    // benefits are bounded by the aggregate record limit and the
                    // tiers that actually reached the payload. Raw persisted rows
                    // are matched so semantic-key sanitization cannot desync them.
                    const includedTierRows = (rows.get('MarketingPagePricing') ?? []).slice(0, maxItems)
                    const includedBenefitKeys = selectPricingBenefitSemanticKeysForTiers(
                        rows.get('MarketingPagePricingBenefit') ?? [],
                        includedTierRows
                    )
                    append(
                        (recordsByObject.get('MarketingPagePricingBenefit') ?? []).filter((record) =>
                            includedBenefitKeys.has(asString(record.semanticKey))
                        ),
                        MARKETING_CHILD_RECORD_LIMIT
                    )
                }
                break
            }
            case 'marketing.footer':
                append(recordsByObject.get('MarketingPageSiteSettings') ?? [], 1)
                append(copyRecords ?? [])
                append(contentRecords ?? [])
                break
            case 'marketing.auth':
                break
            case 'marketing.image': {
                const media = toPublicMedia(config.media, 'hero')
                if (!media) throw new PublicMarketingMaterializationError('Public marketing image media is invalid')
                const instanceKey = publicInstanceKeyByWidget.get(widget)
                if (!instanceKey) throw new PublicMarketingMaterializationError('Public marketing widget identity is invalid')
                resolvedKeysByWidgetKey.set(widget.widgetKey, [...(resolvedKeysByWidgetKey.get(widget.widgetKey) ?? []), instanceKey])
                publicWidgets.push({
                    instanceKey,
                    zone: widget.zone,
                    widgetKey: widget.widgetKey,
                    sortOrder: widget.sortOrder,
                    isActive: true,
                    config: { instanceKey, media },
                    data: { records: [] }
                })
                continue
            }
        }

        const instanceKey = publicInstanceKeyByWidget.get(widget)
        if (!instanceKey) throw new PublicMarketingMaterializationError('Public marketing widget identity is invalid')
        resolvedKeysByWidgetKey.set(widget.widgetKey, [...(resolvedKeysByWidgetKey.get(widget.widgetKey) ?? []), instanceKey])
        let publicConfig: PublicRecord
        switch (widget.widgetKey) {
            case 'marketing.brand':
                publicConfig = { instanceKey }
                break
            case 'marketing.auth':
                publicConfig = { instanceKey, showAuthActions: config.showAuthActions !== false }
                break
            case 'marketing.navigation':
                publicConfig = { instanceKey, maxItems, showAuthActions: config.showAuthActions !== false }
                break
            case 'marketing.hero':
                publicConfig = { instanceKey, showLeadForm: config.showLeadForm !== false }
                break
            case 'marketing.collection':
                if (typeof config.variant !== 'string') {
                    throw new PublicMarketingMaterializationError('Public marketing collection variant is invalid')
                }
                publicConfig = {
                    instanceKey,
                    variant: config.variant,
                    maxItems,
                    showTitle: config.showTitle !== false,
                    showDescription: config.showDescription !== false,
                    showItemDescriptions: config.showItemDescriptions !== false,
                    fixedItemsHeight: config.fixedItemsHeight === true
                }
                break
            case 'marketing.pricing':
                publicConfig = {
                    instanceKey,
                    maxItems,
                    showBenefits: config.showBenefits !== false,
                    cardStyle: config.cardStyle === 'uniform' ? 'uniform' : 'featured',
                    cardWidth: config.cardWidth === 'full' ? 'full' : 'auto'
                }
                break
            case 'marketing.footer':
                publicConfig = { instanceKey, maxItems, showNewsletter: config.showNewsletter !== false }
                break
            default:
                throw new PublicMarketingMaterializationError('Public marketing widget is unsupported')
        }
        publicWidgets.push({
            instanceKey,
            zone: widget.zone,
            widgetKey: widget.widgetKey,
            sortOrder: widget.sortOrder,
            isActive: true,
            config: publicConfig,
            data: remapPublicActionAnchors(
                bindingData ?? { records: recordsForWidget },
                publicHrefBySourceAnchor,
                unavailablePublicAnchorHref
            ) as PublicRecord
        })
    }

    // Header capabilities (including the shared language/color-mode switchers)
    // are layout rows: placement and visibility stay author-controlled, so the
    // anonymous runtime receives the same isActive projection as the host shell.
    const publicHeaderWidgets: PublicRecord[] = []
    const usedHeaderInstanceKeys = new Set<string>()
    const pendingResolvedKeys = new Map(resolvedKeysByWidgetKey)
    for (const widget of effectiveLayout.widgets) {
        if (widget.zone !== 'marketing-header') continue
        if (!(MARKETING_HEADER_WIDGET_KEYS as readonly string[]).includes(widget.widgetKey)) continue
        // The effective layout already drops inactive rows; keep the guard here so
        // the published contract stays true even if that resolver changes.
        if (!widget.isActive) continue

        const config = asRecord(widget.config)
        const queuedKeys = pendingResolvedKeys.get(widget.widgetKey) ?? []
        const [nextResolvedKey, ...restResolvedKeys] = queuedKeys
        pendingResolvedKeys.set(widget.widgetKey, restResolvedKeys)
        const instanceKey =
            nextResolvedKey ?? resolvePublicWidgetInstanceKey(widget.widgetKey, config, publicHeaderWidgets.length, usedHeaderInstanceKeys)
        usedHeaderInstanceKeys.add(instanceKey)
        const placement = widget.placement === 'start' || widget.placement === 'end' ? widget.placement : undefined
        publicHeaderWidgets.push({
            widgetKey: widget.widgetKey as MarketingHeaderWidgetKey,
            instanceKey,
            zone: 'marketing-header',
            sortOrder: widget.sortOrder,
            isActive: widget.isActive,
            ...(placement ? { placement } : {}),
            config: {
                instanceKey,
                ...(widget.widgetKey === 'marketing.auth' ? { showAuthActions: config.showAuthActions !== false } : {})
            }
        })
    }

    const parsedViewModel = publicMarketingPageRuntimeViewModelSchema.safeParse({
        templateKey: 'marketing-page',
        marketingPage: {
            templateKey: 'marketing-page',
            locale,
            config: runtimeConfig,
            widgets: publicWidgets,
            ...(publicHeaderWidgets.length > 0 ? { headerWidgets: publicHeaderWidgets } : {})
        }
    })
    if (!parsedViewModel.success) throw new PublicMarketingMaterializationError('Public marketing runtime DTO is invalid')

    const { applicationId: _applicationId, ...publicRoute } = route
    const parsedRuntime = publicMarketingApplicationRuntimeSchema.safeParse({
        route: publicRoute,
        templateKey: parsedViewModel.data.templateKey,
        marketingPage: parsedViewModel.data.marketingPage
    })
    if (!parsedRuntime.success) throw new PublicMarketingMaterializationError('Public marketing runtime DTO is invalid')
    return parsedRuntime.data
}
