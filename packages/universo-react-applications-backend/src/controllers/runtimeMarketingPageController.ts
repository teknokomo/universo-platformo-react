import type { Request, Response } from 'express'
import {
    applicationTemplateKeySchema,
    MARKETING_MAX_RUNTIME_RECORDS,
    marketingActionSchema,
    marketingPageConfigSchema,
    marketingPageDataSchema,
    marketingPersistedIdSchema,
    marketingSiteSettingsRecordSchema,
    resourceSourceSchema,
    type MarketingAction,
    type MarketingScope,
    type MarketingPageConfig,
    type MarketingPageRecord,
    type ResourceSource
} from '@universo-react/types'
import { normalizeMarketingMedia, parseMarketingActionHref } from '@universo-react/utils'
import type { DbExecutor } from '@universo-react/utils'
import {
    createQueryHelper,
    IDENTIFIER_REGEX,
    normalizeLocale,
    quoteIdentifier,
    resolveLocalizedContent,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema,
    runtimeCodenameTextSql,
    UUID_REGEX
} from '../shared/runtimeHelpers'

type RawRecord = Record<string, unknown>

const MARKETING_OBJECTS = [
    'MarketingPageSection',
    'MarketingPageSiteSettings',
    'MarketingPageLogo',
    'MarketingPageFeature',
    'MarketingPageTestimonial',
    'MarketingPageHighlight',
    'MarketingPagePricing',
    'MarketingPagePricingBenefit',
    'MarketingPageFaq',
    'MarketingPageNavigation',
    'MarketingPageFooterLink'
] as const

const MARKETING_COLLECTION_ROW_LIMIT = 1000

type MarketingObjectName = (typeof MARKETING_OBJECTS)[number]

const MARKETING_SECTION_KEYS = ['hero', 'logos', 'features', 'testimonials', 'highlights', 'pricing', 'faq', 'footer'] as const

const asRecord = (value: unknown): RawRecord => (value && typeof value === 'object' && !Array.isArray(value) ? (value as RawRecord) : {})

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const asNumber = (value: unknown, fallback: number): number => {
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

const asBoolean = (value: unknown, fallback = true): boolean => (typeof value === 'boolean' ? value : fallback)

const readLocalizedMap = (value: unknown, fallback: string): Record<string, string> => {
    const record = asRecord(value)
    const locales =
        record.locales && typeof record.locales === 'object' && !Array.isArray(record.locales) ? (record.locales as RawRecord) : record
    const result: Record<string, string> = {}
    for (const [locale, entry] of Object.entries(locales)) {
        if (locale.startsWith('_')) continue
        const content = typeof entry === 'string' ? entry.trim() : asString(asRecord(entry).content)
        if (content) result[locale.toLowerCase().replace(/_/g, '-')] = content
    }
    if (Object.keys(result).length > 0) return result
    const direct = typeof value === 'number' && Number.isFinite(value) ? String(value) : asString(value)
    return { en: direct || fallback }
}

const localized = (value: unknown, locale: string, fallback: string): Record<string, string> => {
    const map = readLocalizedMap(value, fallback)
    const selected = resolveLocalizedContent(value, locale, fallback)
    const normalizedLocale = normalizeLocale(locale)
    if (!map[normalizedLocale]) map[normalizedLocale] = selected
    return map
}

const hasLocalizedContent = (value: unknown): boolean =>
    Object.values(readLocalizedMap(value, '')).some((content) => content.trim().length > 0)

const localizedOptional = (value: unknown, locale: string): Record<string, string> | undefined =>
    hasLocalizedContent(value) ? localized(value, locale, '') : undefined

const localizedLabelOptional = (value: unknown, locale: string): string | undefined =>
    hasLocalizedContent(value) ? resolveLocalizedContent(value, locale, '') : undefined

const safeSemanticKey = (value: unknown, fallback: string): string => {
    const raw = resolveRuntimeCodenameText(value).trim().toLowerCase()
    const normalized = raw.replace(/[^a-z0-9._-]+/g, '-').replace(/^[^a-z]+/, '')
    return normalized || fallback
}

export const safeAction = (value: unknown): MarketingAction | null => {
    return parseMarketingActionHref(value)
}

export const safeMedia = (value: unknown, kind: 'logo' | 'hero' | 'avatar' | 'feature' | 'highlight', alt: Record<string, string>) => {
    const resource: ResourceSource | undefined =
        typeof value === 'string'
            ? asString(value)
                ? { type: 'url', url: asString(value), launchMode: 'inline' }
                : undefined
            : resourceSourceSchema.safeParse(value).success
            ? resourceSourceSchema.parse(value)
            : undefined
    if (!resource) return undefined
    try {
        return normalizeMarketingMedia({
            kind,
            resource,
            alt,
            decorative: false
        })
    } catch {
        return undefined
    }
}

const baseRecord = (
    row: RawRecord,
    locale: string,
    fallbackKey: string,
    semanticKeyValue: unknown = row.codename,
    scope: MarketingScope = 'application'
): Pick<MarketingPageRecord, 'id' | 'semanticKey' | 'locale' | 'order' | 'isVisible' | 'scope' | 'provenance'> => {
    const id = marketingPersistedIdSchema.parse(asString(row.id))
    const semanticKey = safeSemanticKey(semanticKeyValue, fallbackKey)
    const hasSeedSource = Boolean(asString(row._seed_source_key ?? row.seedSourceKey))
    const isAuthored = row._seed_source_owned === false || row.seedSourceOwned === false || !hasSeedSource
    const isSeeded = hasSeedSource && !isAuthored
    return {
        id,
        semanticKey,
        locale,
        order: Math.max(0, Math.min(10000, Math.trunc(asNumber(row.SortOrder ?? row.sort_order, 0)))),
        isVisible: asBoolean(row.IsVisible, true),
        scope,
        provenance: {
            layer: scope,
            ...(isSeeded ? { seedKey: semanticKey } : {}),
            isSeeded,
            isAuthored
        }
    }
}

const objectQuery = (schemaIdent: string) => `
    SELECT id, kind, codename, table_name, config
    FROM ${schemaIdent}._app_objects
    WHERE kind = 'object'
      AND ${runtimeCodenameTextSql('codename')} = ANY($1::text[])
      AND _upl_deleted = false
      AND _app_deleted = false
    ORDER BY id ASC
`

const componentQuery = (schemaIdent: string) => `
    SELECT id, object_id, codename, column_name, data_type
    FROM ${schemaIdent}._app_components
    WHERE object_id = ANY($1::uuid[])
      AND parent_component_id IS NULL
      AND _upl_deleted = false
      AND _app_deleted = false
    ORDER BY object_id ASC, sort_order ASC, _upl_created_at ASC
`

export const normalizeRuntimeRow = (row: RawRecord, components: RawRecord[]): RawRecord => {
    const normalized = { ...row }
    for (const component of components) {
        const codename = resolveRuntimeCodenameText(component.codename).trim()
        const columnName = asString(component.column_name)
        if (!codename || !IDENTIFIER_REGEX.test(columnName)) continue
        if (normalized[codename] === undefined && normalized[columnName] !== undefined) {
            normalized[codename] = normalized[columnName]
        }
    }
    return normalized
}

const loadObjectRows = async (
    manager: DbExecutor,
    schemaIdent: string,
    object: RawRecord,
    components: RawRecord[],
    workspaceId?: string | null
) => {
    const tableName = asString(object.table_name)
    if (!IDENTIFIER_REGEX.test(tableName)) throw new Error('Marketing runtime metadata contains an unsafe table name')
    const sortComponent = components.find((component) => resolveRuntimeCodenameText(component.codename).toLowerCase() === 'sortorder')
    const sortColumn =
        sortComponent && IDENTIFIER_REGEX.test(asString(sortComponent.column_name)) ? asString(sortComponent.column_name) : 'id'
    const table = `${schemaIdent}.${quoteIdentifier(tableName)}`
    const workspaceClause = workspaceId ? ` AND ${quoteIdentifier('workspace_id')} = $1` : ''
    const rows = await manager.query<RawRecord>(
        `SELECT * FROM ${table}
         WHERE _upl_deleted = false AND _app_deleted = false${workspaceClause}
         ORDER BY ${quoteIdentifier(sortColumn)} ASC NULLS LAST, id ASC
         LIMIT ${MARKETING_COLLECTION_ROW_LIMIT}`,
        workspaceId ? [workspaceId] : []
    )
    return rows.map((row) => normalizeRuntimeRow(row, components))
}

const firstRow = (rows: RawRecord[]): RawRecord => rows[0] ?? {}

export const toConfig = (value: unknown): MarketingPageConfig => {
    const parsed = marketingPageConfigSchema.safeParse(value ?? {})
    if (!parsed.success) throw new Error('Marketing runtime configuration is invalid')
    return parsed.data
}

export function createRuntimeMarketingPageController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)

    const getTemplate = async (req: Request, res: Response) => {
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, req.params.applicationId)
        if (!ctx) return
        const layoutsExist = await ctx.manager.query<{ exists: boolean }>(
            `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = '_app_layouts') AS exists`,
            [ctx.schemaName]
        )
        if (!layoutsExist[0]?.exists) return res.status(409).json({ error: 'Application layout is missing' })
        const rows = await ctx.manager.query<{ template_key: unknown; config: unknown }>(
            `SELECT template_key, config
             FROM ${ctx.schemaIdent}._app_layouts
             WHERE scope_entity_id IS NULL AND is_active = true AND _upl_deleted = false AND _app_deleted = false
             ORDER BY is_default DESC, sort_order ASC, _upl_created_at ASC
             LIMIT 1`
        )
        const parsed = applicationTemplateKeySchema.safeParse(rows[0]?.template_key)
        if (!parsed.success) return res.status(409).json({ error: 'Application template is invalid' })
        return res.json({ templateKey: parsed.data, config: rows[0]?.config ?? {} })
    }

    const getMarketingPage = async (req: Request, res: Response) => {
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, req.params.applicationId)
        if (!ctx) return
        const requestedLocale = normalizeLocale(typeof req.query.locale === 'string' ? req.query.locale : 'en')
        const layoutRows = await ctx.manager.query<{ template_key: unknown; config: unknown }>(
            `SELECT template_key, config
             FROM ${ctx.schemaIdent}._app_layouts
             WHERE scope_entity_id IS NULL AND is_active = true AND _upl_deleted = false AND _app_deleted = false
             ORDER BY is_default DESC, sort_order ASC, _upl_created_at ASC
             LIMIT 1`
        )
        const parsedTemplateKey = applicationTemplateKeySchema.safeParse(layoutRows[0]?.template_key)
        if (!parsedTemplateKey.success) return res.status(409).json({ error: 'Application template is invalid' })
        const templateKey = parsedTemplateKey.data
        if (templateKey !== 'marketing-page') return res.status(409).json({ error: 'Application does not use marketing-page template' })
        let runtimeConfig: MarketingPageConfig
        try {
            runtimeConfig = toConfig(layoutRows[0]?.config)
        } catch {
            return res.status(409).json({ code: 'MARKETING_CONFIG_INVALID', error: 'Marketing page configuration is invalid.' })
        }
        const safeRuntimeAction = (value: unknown): MarketingAction | null => {
            const action = safeAction(value)
            if (!action) return null
            if (action.kind === 'email' && !runtimeConfig.allowEmailActions) return null
            if (action.kind === 'tel' && !runtimeConfig.allowTelephoneActions) return null
            if (action.kind === 'external') return marketingActionSchema.parse({ ...action, target: runtimeConfig.externalLinkTarget })
            return action
        }

        const objectRows = await ctx.manager.query<RawRecord>(objectQuery(ctx.schemaIdent), [MARKETING_OBJECTS])
        const objectsByName = new Map(objectRows.map((row) => [resolveRuntimeCodenameText(row.codename), row]))
        const objectIds = objectRows.map((row) => asString(row.id)).filter((id) => UUID_REGEX.test(id))
        const componentRows = objectIds.length > 0 ? await ctx.manager.query<RawRecord>(componentQuery(ctx.schemaIdent), [objectIds]) : []
        const componentsByObject = new Map<string, RawRecord[]>()
        for (const component of componentRows) {
            const list = componentsByObject.get(asString(component.object_id)) ?? []
            list.push(component)
            componentsByObject.set(asString(component.object_id), list)
        }

        const loadedEntries = await Promise.all(
            MARKETING_OBJECTS.map(async (objectName) => {
                const object = objectsByName.get(objectName)
                if (!object) return null
                const rows = await loadObjectRows(
                    ctx.manager,
                    ctx.schemaIdent,
                    object,
                    componentsByObject.get(asString(object.id)) ?? [],
                    ctx.currentWorkspaceId
                )
                return [objectName, rows] as const
            })
        )
        const loaded = new Map<string, RawRecord[]>(loadedEntries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)))

        const loadedRecordCount = Array.from(loaded.values()).reduce((total, rows) => total + rows.length, 0)
        if (loadedRecordCount > MARKETING_MAX_RUNTIME_RECORDS) {
            return res.status(413).json({
                code: 'MARKETING_RUNTIME_DATA_TOO_LARGE',
                error: 'Marketing page data exceeds the runtime record limit.'
            })
        }

        const siteSettingsRows = loaded.get('MarketingPageSiteSettings') ?? []
        if (siteSettingsRows.length !== 1) {
            return res.status(409).json({
                code: 'MARKETING_SINGLETON_INVALID',
                error: 'Marketing page requires exactly one site settings record.'
            })
        }
        const malformedRow = Array.from(loaded.values())
            .flat()
            .find((row) => !marketingPersistedIdSchema.safeParse(asString(row.id)).success)
        if (malformedRow) {
            return res.status(409).json({ code: 'MARKETING_RECORD_INVALID', error: 'Marketing page contains an invalid record.' })
        }
        const siteSettings = firstRow(siteSettingsRows)
        const runtimeScope: MarketingScope = ctx.currentWorkspaceId ? 'workspace' : 'application'
        const runtimeBaseRecord = (row: RawRecord, locale: string, fallbackKey: string, semanticKeyValue: unknown = row.codename) =>
            baseRecord(row, locale, fallbackKey, semanticKeyValue, runtimeScope)
        const records: MarketingPageRecord[] = []
        const brandName = localized(siteSettings.BrandName, requestedLocale, '')
        const heroTitle = localized(siteSettings.HeroTitle, requestedLocale, '')
        const siteSettingsRecord = {
            ...runtimeBaseRecord(siteSettings, requestedLocale, 'site-settings', 'site-settings'),
            semanticKey: 'site-settings',
            kind: 'siteSettings' as const,
            brandName,
            brandLogo: safeMedia(siteSettings.BrandLogo, 'logo', brandName),
            heroTitle,
            heroSubtitle: localized(siteSettings.HeroSubtitle, requestedLocale, ''),
            heroAccent: localizedOptional(siteSettings.HeroAccent, requestedLocale),
            heroEmailLabel: localizedLabelOptional(siteSettings.HeroEmailLabel, requestedLocale),
            heroEmailPlaceholder: localizedLabelOptional(siteSettings.HeroEmailPlaceholder, requestedLocale),
            heroTermsText: localizedOptional(siteSettings.HeroTermsText, requestedLocale),
            heroPrimaryAction: safeRuntimeAction(siteSettings.HeroPrimaryActionHref)
                ? {
                      label: localized(siteSettings.HeroPrimaryActionLabel, requestedLocale, ''),
                      action: safeRuntimeAction(siteSettings.HeroPrimaryActionHref)!
                  }
                : undefined,
            heroSecondaryAction: safeRuntimeAction(siteSettings.HeroTermsHref)
                ? {
                      label: localized(siteSettings.HeroTermsLinkLabel, requestedLocale, ''),
                      action: safeRuntimeAction(siteSettings.HeroTermsHref)!
                  }
                : undefined,
            heroLightPreview: safeMedia(siteSettings.HeroLightPreview, 'hero', heroTitle),
            heroDarkPreview: safeMedia(siteSettings.HeroDarkPreview, 'hero', heroTitle),
            footerDescription: localizedOptional(siteSettings.FooterDescription, requestedLocale),
            copyright: localizedOptional(siteSettings.CopyrightText, requestedLocale),
            copyrightLabel: localizedOptional(siteSettings.CopyrightLabel, requestedLocale),
            copyrightAction: safeRuntimeAction(siteSettings.CopyrightHref)
                ? {
                      label: localized(siteSettings.CopyrightLabel, requestedLocale, ''),
                      action: safeRuntimeAction(siteSettings.CopyrightHref)!
                  }
                : undefined,
            newsletter:
                siteSettings.NewsletterEnabled === true
                    ? {
                          title: localized(siteSettings.NewsletterTitle, requestedLocale, ''),
                          description: localizedOptional(siteSettings.NewsletterDescription, requestedLocale),
                          emailLabel: resolveLocalizedContent(siteSettings.NewsletterLabel, requestedLocale, ''),
                          emailPlaceholder: resolveLocalizedContent(siteSettings.NewsletterPlaceholder, requestedLocale, ''),
                          submitLabel: resolveLocalizedContent(siteSettings.NewsletterActionLabel, requestedLocale, ''),
                          successMessage: localized(siteSettings.NewsletterSuccessMessage, requestedLocale, ''),
                          errorMessage: localized(siteSettings.NewsletterErrorMessage, requestedLocale, ''),
                          action: safeRuntimeAction(siteSettings.NewsletterActionHref) ?? undefined
                      }
                    : undefined
        }
        const parsedSiteSettings = marketingSiteSettingsRecordSchema.safeParse(siteSettingsRecord)
        if (!parsedSiteSettings.success) {
            return res.status(409).json({ code: 'MARKETING_RUNTIME_DATA_INVALID', error: 'Marketing page data is invalid.' })
        }
        records.push(parsedSiteSettings.data)

        const addRecords = async (
            objectName: MarketingObjectName,
            mapper: (row: RawRecord, index: number) => MarketingPageRecord | null
        ) => {
            const rows = loaded.get(objectName) ?? []
            for (let index = 0; index < rows.length; index += 1) {
                const mapped = mapper(rows[index], index)
                if (mapped) records.push(mapped)
            }
        }

        await addRecords('MarketingPageNavigation', (row, index) => {
            const label = localized(row.Label, requestedLocale, '')
            const action = safeRuntimeAction(row.Href)
            return action
                ? ({
                      ...runtimeBaseRecord(row, requestedLocale, `navigation-${index + 1}`, row.NavKey),
                      kind: 'navigationLink',
                      label,
                      action
                  } as MarketingPageRecord)
                : null
        })
        await addRecords('MarketingPageLogo', (row, index) => {
            const alt = localized(row.AltText, requestedLocale, '')
            const media = safeMedia(row.ImageLight, 'logo', alt)
            const darkMedia = safeMedia(row.ImageDark, 'logo', alt)
            const primaryMedia = media ?? darkMedia
            return primaryMedia
                ? ({
                      ...runtimeBaseRecord(row, requestedLocale, `logo-${index + 1}`, row.LogoKey),
                      kind: 'logo',
                      name: alt,
                      media: primaryMedia,
                      darkMedia: darkMedia && darkMedia !== primaryMedia ? darkMedia : undefined
                  } as MarketingPageRecord)
                : null
        })
        await addRecords(
            'MarketingPageFeature',
            (row, index) =>
                ({
                    ...runtimeBaseRecord(row, requestedLocale, `feature-${index + 1}`, row.FeatureKey),
                    kind: 'feature',
                    title: localized(row.Title, requestedLocale, ''),
                    description: localized(row.Description, requestedLocale, ''),
                    ...(safeSemanticKey(row.IconKey, '') ? { iconKey: safeSemanticKey(row.IconKey, '') } : {}),
                    lightMedia: safeMedia(row.ImageLight, 'feature', localized(row.Title, requestedLocale, '')),
                    darkMedia: safeMedia(row.ImageDark, 'feature', localized(row.Title, requestedLocale, ''))
                } as MarketingPageRecord)
        )
        await addRecords('MarketingPageTestimonial', (row, index) => {
            const name = localized(row.Name, requestedLocale, '')
            const lightLogo = safeMedia(row.LogoLightUrl, 'logo', name)
            const darkLogo = safeMedia(row.LogoDarkUrl, 'logo', name)
            return {
                ...runtimeBaseRecord(row, requestedLocale, `testimonial-${index + 1}`, row.TestimonialKey),
                kind: 'testimonial',
                quote: localized(row.Quote, requestedLocale, ''),
                author: name,
                company: localizedOptional(row.Occupation, requestedLocale),
                avatar: safeMedia(row.AvatarUrl, 'avatar', name),
                ...(lightLogo ? { logo: lightLogo } : {}),
                ...(darkLogo ? { darkLogo } : {})
            } as MarketingPageRecord
        })
        await addRecords(
            'MarketingPageHighlight',
            (row, index) =>
                ({
                    ...runtimeBaseRecord(row, requestedLocale, `highlight-${index + 1}`, row.HighlightKey),
                    kind: 'highlight',
                    title: localized(row.Title, requestedLocale, ''),
                    description: localized(row.Description, requestedLocale, ''),
                    ...(safeSemanticKey(row.IconKey, '') ? { iconKey: safeSemanticKey(row.IconKey, '') } : {})
                } as MarketingPageRecord)
        )

        const pricingBenefitsByTier = new Map<string, Array<Extract<MarketingPageRecord, { kind: 'pricingBenefit' }>>>()
        await addRecords('MarketingPagePricingBenefit', (row, index) => {
            const label = localized(row.Label, requestedLocale, '')
            if (!asBoolean(row.IsVisible, true)) return null

            const record = {
                ...runtimeBaseRecord(row, requestedLocale, `pricing-benefit-${index + 1}`, row.BenefitKey),
                kind: 'pricingBenefit' as const,
                label
            }
            const tierReference = asString(row.TierRef)
            const tierKey = asString(row.TierKey)
            for (const key of [tierReference, tierKey].filter(Boolean)) {
                const recordsForTier = pricingBenefitsByTier.get(key) ?? []
                recordsForTier.push(record)
                pricingBenefitsByTier.set(key, recordsForTier)
            }
            return record
        })

        await addRecords('MarketingPagePricing', (row, index) => {
            const label = localized(row.ActionLabel, requestedLocale, '')
            const action = safeRuntimeAction(row.ActionHref)
            const tierKey = asString(row.TierKey)
            const description = localizedOptional(row.Subheader, requestedLocale)
            const linkedBenefits = [
                ...(pricingBenefitsByTier.get(asString(row.id)) ?? []),
                ...(pricingBenefitsByTier.get(tierKey) ?? [])
            ].filter((benefit, benefitIndex, all) => all.findIndex((candidate) => candidate.id === benefit.id) === benefitIndex)
            return {
                ...runtimeBaseRecord(row, requestedLocale, `pricing-${index + 1}`, row.TierKey),
                kind: 'pricingTier' as const,
                title: localized(row.Title, requestedLocale, ''),
                ...(description ? { description } : {}),
                price: localized(row.Price, requestedLocale, ''),
                ...(localizedOptional(row.Period, requestedLocale) ? { period: localizedOptional(row.Period, requestedLocale) } : {}),
                action: action ? { label, action } : undefined,
                benefitKeys: linkedBenefits.map((benefit) => benefit.semanticKey),
                benefits: linkedBenefits.map((benefit) => benefit.label),
                featured: asBoolean(row.Featured, false)
            } as MarketingPageRecord
        })
        await addRecords(
            'MarketingPageFaq',
            (row, index) =>
                ({
                    ...runtimeBaseRecord(row, requestedLocale, `faq-${index + 1}`, row.FaqKey),
                    kind: 'faq',
                    question: localized(row.Question, requestedLocale, ''),
                    answer: localized(row.Answer, requestedLocale, '')
                } as MarketingPageRecord)
        )

        await addRecords('MarketingPageFooterLink', (row, index) => {
            const action = safeRuntimeAction(row.Href)
            if (!action) return null
            return {
                ...runtimeBaseRecord(row, requestedLocale, `footer-link-${index + 1}`, row.LinkKey),
                kind: 'footerLink' as const,
                groupKey: safeSemanticKey(row.GroupKey, ''),
                ...(localizedOptional(row.GroupTitle, requestedLocale)
                    ? { groupTitle: localizedOptional(row.GroupTitle, requestedLocale) }
                    : {}),
                label: localized(row.Label, requestedLocale, ''),
                ...(localizedOptional(row.BottomLabel, requestedLocale)
                    ? { secondaryLabel: localizedOptional(row.BottomLabel, requestedLocale) }
                    : {}),
                action,
                ...(safeSemanticKey(row.IconKey, '') ? { iconKey: safeSemanticKey(row.IconKey, '') } : {})
            } as MarketingPageRecord
        })

        const sectionCopies: Record<string, { title: Record<string, string>; description?: Record<string, string> }> = {}
        const sectionRows = (loaded.get('MarketingPageSection') ?? [])
            .map((row, index) => {
                const key = safeSemanticKey(row.SectionKey ?? row.codename, '')
                if (!MARKETING_SECTION_KEYS.includes(key as (typeof MARKETING_SECTION_KEYS)[number])) return null
                return {
                    key: key as (typeof MARKETING_SECTION_KEYS)[number],
                    order: Math.max(0, Math.min(10000, Math.trunc(asNumber(row.SortOrder ?? row.sort_order, index)))),
                    isVisible: asBoolean(row.IsVisible, true),
                    row
                }
            })
            .filter((section): section is NonNullable<typeof section> => Boolean(section))

        const sectionKeys = new Set<string>()
        for (const section of sectionRows) {
            if (sectionKeys.has(section.key)) {
                return res.status(409).json({
                    code: 'MARKETING_SECTION_DUPLICATE',
                    error: 'Marketing page contains duplicate section metadata.'
                })
            }
            sectionKeys.add(section.key)
        }

        for (const section of sectionRows) {
            sectionCopies[section.key] = {
                title: localized(section.row.Title, requestedLocale, ''),
                ...(localizedOptional(section.row.Description, requestedLocale)
                    ? { description: localizedOptional(section.row.Description, requestedLocale) }
                    : {})
            }
        }

        const rawLayoutConfig = asRecord(layoutRows[0]?.config)
        const hasConfiguredSectionOrder = Array.isArray(rawLayoutConfig.sectionOrder)
        const hasConfiguredSectionVisibility = Boolean(
            rawLayoutConfig.sectionVisibility &&
                typeof rawLayoutConfig.sectionVisibility === 'object' &&
                !Array.isArray(rawLayoutConfig.sectionVisibility)
        )
        const seededSectionOrder = [
            ...sectionRows
                .slice()
                .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key))
                .map((section) => section.key),
            ...MARKETING_SECTION_KEYS
        ].filter((key, index, all) => all.indexOf(key) === index)
        const seededSectionVisibility = Object.fromEntries(sectionRows.map((section) => [section.key, section.isVisible]))
        const effectiveConfig = {
            ...runtimeConfig,
            sectionOrder: hasConfiguredSectionOrder ? runtimeConfig.sectionOrder : seededSectionOrder,
            sectionVisibility: {
                ...seededSectionVisibility,
                ...(hasConfiguredSectionVisibility ? runtimeConfig.sectionVisibility : {})
            }
        }

        const parsedPage = marketingPageDataSchema.safeParse({
            templateKey: 'marketing-page',
            locale: requestedLocale,
            config: effectiveConfig,
            records,
            sectionCopies
        })
        if (!parsedPage.success) {
            return res.status(409).json({ code: 'MARKETING_RUNTIME_DATA_INVALID', error: 'Marketing page data is invalid.' })
        }
        return res.json({ templateKey: 'marketing-page', marketingPage: parsedPage.data })
    }

    return { getTemplate, getMarketingPage }
}
