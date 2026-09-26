// 73rd Meridian Consortium marketing product fixture generator.
//
// Product content is authored through the same Metahub record/layout APIs used by
// the application. The exported snapshot is only canonicalized for transient
// metahub metadata before being validated and written to the committed fixture.

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createRecord,
    disposeApiContext,
    listEntityInstances,
    listLayouts,
    listLayoutZoneWidgets,
    listRecords,
    sendWithCsrf,
    toggleLayoutZoneWidgetActive
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { assertMeridian73FixtureEnvelopeContract, MERIDIAN_73_FIXTURE_FILENAME } from '../../support/meridian73FixtureContract'
import { buildSnapshotEnvelope, buildVLC, createLocalizedContent, validateSnapshotEnvelope } from '@universo-react/utils'
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
    MERIDIAN_73_SITE_SETTINGS,
    MERIDIAN_73_SOURCE,
    type Meridian73LocalizedText
} from './meridian73MarketingContent'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>
type ObjectEntity = { id: string; codename?: unknown }
type RecordSeed = Readonly<{ data: Record<string, unknown>; sortOrder: number }>

const FIXTURES_DIR = path.resolve(repoRoot, 'tools', 'fixtures')
const explicitFixtureOutputPath = process.env.MERIDIAN_73_FIXTURE_OUTPUT_PATH
const resolveFixtureOutputPath = () =>
    explicitFixtureOutputPath ? path.resolve(repoRoot, explicitFixtureOutputPath) : path.join(FIXTURES_DIR, MERIDIAN_73_FIXTURE_FILENAME)

const localized = (value: Meridian73LocalizedText) => buildVLC(value.en, value.ru)

const readLocalizedText = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return ''
    const localizedValue = value as { _primary?: string; locales?: Record<string, { content?: unknown }> }
    const primary = localizedValue._primary
    const locales = localizedValue.locales ?? {}
    const content = locales.en?.content ?? (primary ? locales[primary]?.content : undefined) ?? Object.values(locales)[0]?.content
    return typeof content === 'string' ? content : ''
}

const verifySourceRevision = (): void => {
    const sourcePath = path.resolve(repoRoot, MERIDIAN_73_SOURCE.path)
    const source = fs.readFileSync(sourcePath)
    const actualHash = createHash('sha256').update(source).digest('hex')
    expect(actualHash).toBe(MERIDIAN_73_SOURCE.sha256)
}

const loadObjectEntities = async (api: ApiContext, metahubId: string): Promise<Map<string, ObjectEntity>> => {
    const payload = await listEntityInstances(api, metahubId, { kind: 'object', limit: 200, offset: 0 })
    const items = Array.isArray(payload?.items) ? (payload.items as ObjectEntity[]) : []
    return new Map(items.map((item) => [readLocalizedText(item.codename), item]))
}

const deleteRecords = async (
    api: ApiContext,
    metahubId: string,
    objectsByCodename: Map<string, ObjectEntity>,
    objectCodename: string
): Promise<string> => {
    const object = objectsByCodename.get(objectCodename)
    if (!object?.id) throw new Error(`73rd Meridian generator could not find Object ${objectCodename}`)

    const existingPayload = await listRecords(api, metahubId, object.id, { limit: 1000, offset: 0 })
    const existing = Array.isArray(existingPayload?.items) ? existingPayload.items : []
    for (const record of existing) {
        if (typeof record?.id !== 'string') throw new Error(`73rd Meridian generator found an invalid ${objectCodename} record id`)
        const response = await sendWithCsrf(
            api,
            'DELETE',
            `/api/v1/metahub/${metahubId}/entities/object/instance/${object.id}/record/${record.id}`,
            undefined
        )
        expect(response.status).toBe(204)
    }
    return object.id
}

const replaceRecords = async (
    api: ApiContext,
    metahubId: string,
    objectsByCodename: Map<string, ObjectEntity>,
    objectCodename: string,
    seeds: readonly RecordSeed[]
): Promise<void> => {
    const objectId = await deleteRecords(api, metahubId, objectsByCodename, objectCodename)
    for (const seed of seeds) {
        await createRecord(api, metahubId, objectId, seed)
    }
}

/**
 * Pricing tiers and their benefits are relation-linked, so benefits must be
 * created against the real persisted tier id after the tiers exist.
 */
const authorPricingRecords = async (api: ApiContext, metahubId: string, objectsByCodename: Map<string, ObjectEntity>): Promise<void> => {
    const benefitObjectId = await deleteRecords(api, metahubId, objectsByCodename, 'MarketingPagePricingBenefit')
    const tierObjectId = await deleteRecords(api, metahubId, objectsByCodename, 'MarketingPagePricing')

    let benefitSortOrder = 0
    for (const [index, tier] of MERIDIAN_73_PRICING_TIERS.entries()) {
        const createdTier = await createRecord(api, metahubId, tierObjectId, {
            sortOrder: index + 1,
            data: {
                TierKey: tier.key,
                Title: localized(tier.title),
                Subheader: localized(tier.description),
                Price: tier.price,
                Period: localized(tier.period),
                Featured: false,
                SortOrder: index + 1,
                IsVisible: true
            }
        })
        const tierId = typeof createdTier?.id === 'string' ? createdTier.id : undefined
        if (!tierId) throw new Error(`73rd Meridian generator did not receive an id for pricing tier ${tier.key}`)

        for (const [benefitIndex, benefit] of tier.benefits.entries()) {
            benefitSortOrder += 1
            await createRecord(api, metahubId, benefitObjectId, {
                sortOrder: benefitSortOrder,
                data: {
                    BenefitKey: `${tier.key}-benefit-${benefitIndex + 1}`,
                    TierRef: tierId,
                    Label: localized(benefit),
                    SortOrder: benefitIndex + 1,
                    IsVisible: true
                }
            })
        }
    }
}

const buildSectionSeeds = (): RecordSeed[] =>
    MERIDIAN_73_SECTIONS.map((section, index) => ({
        sortOrder: index + 1,
        data: {
            SectionKey: section.key,
            Title: localized(section.title),
            Description: localized(section.description)
        }
    }))

const buildSiteSettingsSeeds = (): RecordSeed[] => [
    {
        sortOrder: 1,
        data: {
            BrandName: localized(MERIDIAN_73_SITE_SETTINGS.brandName),
            FooterDescription: localized(MERIDIAN_73_SITE_SETTINGS.footerDescription),
            CopyrightText: localized(MERIDIAN_73_SITE_SETTINGS.copyright),
            NewsletterEnabled: false,
            IsVisible: true
        }
    }
]

const authorHeroRecord = async (api: ApiContext, metahubId: string, objectsByCodename: Map<string, ObjectEntity>): Promise<void> => {
    const heroObject = objectsByCodename.get('MarketingPageHero')
    if (!heroObject?.id) throw new Error('73rd Meridian generator could not find Object MarketingPageHero')

    const payload = await listRecords(api, metahubId, heroObject.id, { limit: 100, offset: 0 })
    const records = Array.isArray(payload?.items)
        ? (payload.items as Array<{ id?: unknown; version?: unknown; data?: Record<string, unknown> }>)
        : []
    const defaultRecord = records.find((record) => record.data?.HeroKey === 'default')
    if (typeof defaultRecord?.id !== 'string') {
        throw new Error('73rd Meridian generator requires the protected default MarketingPageHero record seeded by the template')
    }
    const expectedVersion = Number(defaultRecord.version)
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
        throw new Error('73rd Meridian generator requires a versioned default MarketingPageHero record')
    }

    const response = await sendWithCsrf(
        api,
        'PATCH',
        `/api/v1/metahub/${metahubId}/entities/object/instance/${heroObject.id}/record/${defaultRecord.id}`,
        {
            expectedVersion,
            data: {
                Title: localized(MERIDIAN_73_HERO.title),
                Accent: localized(MERIDIAN_73_HERO.accent),
                Description: localized(MERIDIAN_73_HERO.description)
            }
        }
    )
    expect(response.ok).toBe(true)
}

const buildPartnerSeeds = (): RecordSeed[] =>
    MERIDIAN_73_PARTNER_CATEGORIES.map((partner, index) => ({
        sortOrder: index + 1,
        data: {
            LogoKey: partner.key,
            ImageLight: null,
            ImageDark: null,
            AltText: localized(partner.label),
            SortOrder: index + 1,
            IsVisible: true
        }
    }))

const buildActivitySeeds = (): RecordSeed[] =>
    MERIDIAN_73_ACTIVITIES.map((activity, index) => ({
        sortOrder: index + 1,
        data: {
            FeatureKey: activity.key,
            IconKey: activity.iconKey,
            Title: localized(activity.title),
            Description: localized(activity.description),
            ImageLight: null,
            ImageDark: null,
            SortOrder: index + 1,
            IsVisible: true
        }
    }))

const buildExpertVisionSeeds = (): RecordSeed[] =>
    MERIDIAN_73_EXPERT_VISION.map((item, index) => ({
        sortOrder: index + 1,
        data: {
            TestimonialKey: item.key,
            Name: localized(item.title),
            Quote: localized(item.description),
            AvatarUrl: null,
            LogoLightUrl: null,
            LogoDarkUrl: null,
            SortOrder: index + 1,
            IsVisible: true
        }
    }))

const buildHighlightSeeds = (): RecordSeed[] =>
    MERIDIAN_73_REASONS.map((item, index) => ({
        sortOrder: index + 1,
        data: {
            HighlightKey: item.key,
            IconKey: item.iconKey,
            Title: localized(item.title),
            Description: localized(item.description),
            SortOrder: index + 1,
            IsVisible: true
        }
    }))

const buildFooterLinkSeeds = (): RecordSeed[] =>
    MERIDIAN_73_FOOTER_LINKS.map((link, index) => ({
        sortOrder: index + 1,
        data: {
            LinkKey: link.key,
            GroupKey: link.groupKey,
            GroupTitle: localized(link.groupTitle),
            Label: localized(link.label),
            Href: link.href,
            SortOrder: index + 1,
            IsVisible: true
        }
    }))

const buildFaqSeeds = (): RecordSeed[] =>
    MERIDIAN_73_FAQ.map((item, index) => ({
        sortOrder: index + 1,
        data: {
            FaqKey: item.key,
            Question: localized(item.question),
            Answer: localized(item.answer),
            SortOrder: index + 1,
            IsVisible: true
        }
    }))

const buildNavigationSeeds = (): RecordSeed[] =>
    MERIDIAN_73_NAVIGATION.map((item, index) => ({
        sortOrder: index + 1,
        data: {
            NavKey: item.key,
            Label: localized(item.label),
            Href: item.href,
            SectionKey: item.sectionKey,
            SortOrder: index + 1,
            IsVisible: true
        }
    }))

const authorProductRecords = async (api: ApiContext, metahubId: string): Promise<void> => {
    const objects = await loadObjectEntities(api, metahubId)

    // Replace relation-linked pricing content first, then remove every MUI demo
    // record and rebuild only the approved Consortium product content.
    await authorPricingRecords(api, metahubId, objects)
    await replaceRecords(api, metahubId, objects, 'MarketingPageSection', buildSectionSeeds())
    await replaceRecords(api, metahubId, objects, 'MarketingPageSiteSettings', buildSiteSettingsSeeds())
    await authorHeroRecord(api, metahubId, objects)
    await replaceRecords(api, metahubId, objects, 'MarketingPageLogo', buildPartnerSeeds())
    await replaceRecords(api, metahubId, objects, 'MarketingPageFeature', buildActivitySeeds())
    await replaceRecords(api, metahubId, objects, 'MarketingPageTestimonial', buildExpertVisionSeeds())
    await replaceRecords(api, metahubId, objects, 'MarketingPageHighlight', buildHighlightSeeds())
    await replaceRecords(api, metahubId, objects, 'MarketingPageFaq', buildFaqSeeds())
    await replaceRecords(api, metahubId, objects, 'MarketingPageNavigation', buildNavigationSeeds())
    await replaceRecords(api, metahubId, objects, 'MarketingPageFooterLink', buildFooterLinkSeeds())
}

const updateWidgetConfig = async (
    api: ApiContext,
    metahubId: string,
    layoutId: string,
    widget: Record<string, unknown>,
    patch: Record<string, unknown>
): Promise<void> => {
    if (typeof widget.id !== 'string' || typeof widget.version !== 'number') throw new Error('Marketing widget is not versioned')
    const currentConfig = widget.config && typeof widget.config === 'object' ? (widget.config as Record<string, unknown>) : {}
    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widget.id}/config`, {
        config: { ...currentConfig, ...patch },
        expectedVersion: widget.version
    })
    expect(response.ok).toBe(true)
}

const configureProductLayout = async (api: ApiContext, metahubId: string): Promise<void> => {
    const layoutsPayload = await listLayouts(api, metahubId, { limit: 100, offset: 0 })
    const layouts = Array.isArray(layoutsPayload?.items) ? layoutsPayload.items : []
    const layout = layouts.find((candidate) => candidate?.templateKey === 'marketing-page')
    if (!layout?.id) throw new Error('73rd Meridian generator did not find the marketing-page layout')

    let widgetsPayload = await listLayoutZoneWidgets(api, metahubId, layout.id)
    let widgets = Array.isArray(widgetsPayload?.items) ? widgetsPayload.items : []
    const byInstanceKey = (instanceKey: string) =>
        widgets.find(
            (candidate) => candidate?.config && typeof candidate.config === 'object' && candidate.config.instanceKey === instanceKey
        )

    const imageWidget = byInstanceKey('hero-image')
    const imageResource = imageWidget?.config?.media?.resource
    expect(imageResource?.url).toBe(MERIDIAN_73_IMAGE_URL)

    const configPatches: Array<[string, Record<string, unknown>]> = [
        ['auth', { showAuthActions: false }],
        ['navigation', { maxItems: MERIDIAN_73_NAVIGATION.length }],
        ['hero', { showLeadForm: false }],
        ['logos', { maxItems: MERIDIAN_73_PARTNER_CATEGORIES.length }],
        ['features', { maxItems: MERIDIAN_73_ACTIVITIES.length, showItemDescriptions: true, fixedItemsHeight: true }],
        ['testimonials', { maxItems: MERIDIAN_73_EXPERT_VISION.length }],
        ['highlights', { maxItems: MERIDIAN_73_REASONS.length }],
        ['pricing', { maxItems: MERIDIAN_73_PRICING_TIERS.length, showBenefits: true, cardStyle: 'uniform', cardWidth: 'auto' }],
        ['faq', { maxItems: MERIDIAN_73_FAQ.length }],
        ['footer', { showNewsletter: false }]
    ]

    for (const [instanceKey, patch] of configPatches) {
        const widget = byInstanceKey(instanceKey)
        if (!widget) throw new Error(`73rd Meridian generator did not find marketing widget ${instanceKey}`)
        await updateWidgetConfig(api, metahubId, layout.id, widget, patch)
    }

    // Header capabilities stay layout-driven in the published runtime: the
    // language and theme switchers remain available for the RU/EN audience,
    // while authentication stays in the layout but is explicitly disabled
    // instead of being filtered out by the runtime.
    const headerTogglePlan: Array<{ widgetKey: string; instanceKey?: string; isActive: boolean }> = [
        { widgetKey: 'marketing.auth', instanceKey: 'auth', isActive: false },
        { widgetKey: 'colorModeSwitcher', isActive: true },
        { widgetKey: 'languageSwitcher', isActive: true }
    ]

    for (const plan of headerTogglePlan) {
        widgetsPayload = await listLayoutZoneWidgets(api, metahubId, layout.id)
        widgets = Array.isArray(widgetsPayload?.items) ? widgetsPayload.items : []
        const widget = plan.instanceKey
            ? byInstanceKey(plan.instanceKey)
            : widgets.find((candidate) => candidate?.widgetKey === plan.widgetKey)
        if (!widget?.id || typeof widget.version !== 'number') {
            throw new Error(`73rd Meridian generator did not find header widget ${plan.widgetKey}`)
        }
        const currentIsActive = (widget.isActive ?? widget.is_active) === true
        if (currentIsActive !== plan.isActive) {
            await toggleLayoutZoneWidgetActive(api, metahubId, layout.id, widget.id, plan.isActive, widget.version)
        }
    }
}

test.describe('73rd Meridian Consortium marketing fixture generator', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) await disposeApiContext(api)
    })

    test('@generator create canonical 73rd Meridian marketing metahub through authoring APIs and export snapshot fixture', async ({
        runManifest
    }) => {
        test.setTimeout(600_000)
        verifySourceRevision()

        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        const liveName = `E2E ${runManifest.runId} 73rd Meridian Consortium`
        const liveCodename = `${runManifest.runId.toLowerCase().replace(/[^a-z0-9]+/g, '')}-73rd-meridian`.slice(0, 60)
        const metahub = await createMetahub(api, {
            name: { en: liveName, ru: `${liveName} / Консорциум` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', liveCodename),
            description: MERIDIAN_73_METAHUB.description,
            descriptionPrimaryLocale: 'en',
            templateCodename: 'marketing-page'
        })
        if (!metahub?.id) throw new Error('73rd Meridian fixture generator did not receive a metahub id')

        await recordCreatedMetahub({ id: metahub.id, name: liveName, codename: liveCodename })
        await authorProductRecords(api, metahub.id)
        await configureProductLayout(api, metahub.id)

        const cookieHeader = Array.from((api.cookies as Map<string, string>).entries())
            .map(([name, value]) => `${name}=${value}`)
            .join('; ')
        const exportResponse = await fetch(new URL(`/api/v1/metahub/${metahub.id}/export`, api.baseURL as string).toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                ...(cookieHeader ? { Cookie: cookieHeader } : {})
            }
        })
        expect(exportResponse.ok).toBe(true)

        const exported = validateSnapshotEnvelope((await exportResponse.json()) as Record<string, unknown>)
        const envelope = buildSnapshotEnvelope({
            metahub: {
                ...exported.metahub,
                name: localized(MERIDIAN_73_METAHUB.name),
                codename: createLocalizedContent('en', MERIDIAN_73_METAHUB.codename),
                description: localized(MERIDIAN_73_METAHUB.description)
            },
            publication: exported.publication,
            sourceInstance: exported.sourceInstance,
            snapshot: exported.snapshot
        })
        validateSnapshotEnvelope(envelope)
        assertMeridian73FixtureEnvelopeContract(envelope)

        const fixturePath = resolveFixtureOutputPath()
        fs.mkdirSync(path.dirname(fixturePath), { recursive: true })
        fs.writeFileSync(fixturePath, `${JSON.stringify(envelope, null, 4)}\n`, 'utf8')
        expect(fs.existsSync(fixturePath)).toBe(true)
    })
})
