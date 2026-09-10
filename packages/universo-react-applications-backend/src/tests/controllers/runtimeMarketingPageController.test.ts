import type { Request, Response } from 'express'

const mockResolveRuntimeSchema = jest.fn()
const mockResolveEffectiveLayout = jest.fn()

jest.mock('../../shared/runtimeHelpers', () => ({
    __esModule: true,
    ...jest.requireActual('../../shared/runtimeHelpers'),
    resolveRuntimeSchema: (...args: unknown[]) => mockResolveRuntimeSchema(...args)
}))

jest.mock('../../services/effectiveLayoutResolver', () => ({
    __esModule: true,
    resolveEffectiveLayoutForRequest: (...args: unknown[]) => mockResolveEffectiveLayout(...args)
}))

import {
    createRuntimeMarketingPageController,
    normalizeRuntimeRow,
    safeAction,
    safeMedia,
    toConfig
} from '../../controllers/runtimeMarketingPageController'

const applicationId = '018f8a78-7b8f-7c1d-a111-222233334444'
const uuidV7 = '0190a9b5-3cde-7abc-8def-0123456789ab'
const marketingLayoutId = '0190a9b5-3cde-7abc-8def-0123456789ae'
const scopedMarketingLayoutId = '0190a9b5-3cde-7abc-8def-0123456789ac'
const scopedEntityTypeId = '0190a9b5-3cde-7abc-8def-0123456789ad'
const siteSettingsObjectId = '0190a9b5-3cde-7abc-8def-0123456789a1'
const siteSettingsRecordId = '0190a9b5-3cde-7abc-8def-0123456789a2'

const siteSettingsObject = {
    id: siteSettingsObjectId,
    codename: 'MarketingPageSiteSettings',
    table_name: 'marketing_site_settings',
    config: {}
}

const siteSettingsRow = {
    id: siteSettingsRecordId,
    codename: 'site-settings',
    _seed_source_key: 'site-settings',
    _seed_source_owned: true,
    BrandName: { en: 'Acme', ru: 'Акме' },
    HeroTitle: { en: 'Our latest', ru: 'Наши новые' },
    HeroAccent: { en: 'products', ru: 'продукты' },
    HeroSubtitle: { en: 'Description', ru: 'Описание' },
    HeroEmailLabel: { en: 'Email', ru: 'Почта' },
    HeroEmailPlaceholder: { en: 'Your email', ru: 'Ваш email' },
    HeroPrimaryActionLabel: { en: 'Start now', ru: 'Начать' },
    HeroPrimaryActionHref: '/sign-up',
    HeroTermsText: { en: 'Terms', ru: 'Условия' },
    HeroTermsLinkLabel: { en: 'Terms & Conditions', ru: 'Условиями использования' },
    HeroTermsHref: '/terms',
    CopyrightText: { en: 'Copyright', ru: 'Авторские права' },
    CopyrightLabel: { en: 'Sitemark', ru: 'Sitemark' },
    CopyrightHref: 'https://mui.com/',
    NewsletterEnabled: false
}

const marketingObjectRows = () => [
    siteSettingsObject,
    { id: '0190a9b5-3cde-7abc-8def-0123456789b0', codename: 'MarketingPageSection', table_name: 'marketing_section', config: {} },
    { id: '0190a9b5-3cde-7abc-8def-0123456789b3', codename: 'MarketingPageLogo', table_name: 'marketing_logo', config: {} },
    { id: '0190a9b5-3cde-7abc-8def-0123456789b4', codename: 'MarketingPageFeature', table_name: 'marketing_feature', config: {} },
    { id: '0190a9b5-3cde-7abc-8def-0123456789b5', codename: 'MarketingPageTestimonial', table_name: 'marketing_testimonial', config: {} },
    { id: '0190a9b5-3cde-7abc-8def-0123456789b6', codename: 'MarketingPageHighlight', table_name: 'marketing_highlight', config: {} },
    { id: '0190a9b5-3cde-7abc-8def-0123456789b7', codename: 'MarketingPagePricing', table_name: 'marketing_pricing', config: {} },
    {
        id: '0190a9b5-3cde-7abc-8def-0123456789b8',
        codename: 'MarketingPagePricingBenefit',
        table_name: 'marketing_pricing_benefit',
        config: {}
    },
    { id: '0190a9b5-3cde-7abc-8def-0123456789b9', codename: 'MarketingPageFaq', table_name: 'marketing_faq', config: {} },
    { id: '0190a9b5-3cde-7abc-8def-0123456789ba', codename: 'MarketingPageNavigation', table_name: 'marketing_navigation', config: {} },
    { id: '0190a9b5-3cde-7abc-8def-0123456789bb', codename: 'MarketingPageFooterLink', table_name: 'marketing_footer_link', config: {} }
]

const marketingSectionRows = () => [
    {
        id: '0190a9b5-3cde-7abc-8def-0123456789b1',
        codename: 'features',
        SectionKey: 'features',
        Title: { en: 'Features' },
        Description: { en: 'Features description' }
    },
    {
        id: '0190a9b5-3cde-7abc-8def-0123456789bd',
        codename: 'pricing',
        SectionKey: 'pricing',
        Title: { en: 'Pricing' },
        Description: { en: 'Pricing description' }
    },
    {
        id: '0190a9b5-3cde-7abc-8def-0123456789bc',
        codename: 'footer',
        SectionKey: 'footer',
        Title: { en: 'Footer' },
        Description: { en: 'Footer description' }
    }
]

const defaultMarketingWidgetRows = () => [
    {
        id: '0190a9b5-3cde-7abc-8def-0123456789c0',
        layout_id: marketingLayoutId,
        zone: 'marketing-header',
        widget_key: 'languageSwitcher',
        sort_order: 0,
        config: { instanceKey: 'language-switcher' },
        is_active: true,
        version: 1
    },
    {
        id: '0190a9b5-3cde-7abc-8def-0123456789c1',
        layout_id: marketingLayoutId,
        zone: 'marketing-header',
        widget_key: 'marketing.navigation',
        sort_order: 0,
        config: {
            instanceKey: 'navigation',
            source: { entityCodename: 'MarketingPageNavigation', entityKind: 'object' },
            maxItems: 24,
            showAuthActions: true
        },
        is_active: true,
        version: 1
    },
    {
        id: '0190a9b5-3cde-7abc-8def-0123456789c2',
        layout_id: marketingLayoutId,
        zone: 'marketing-main',
        widget_key: 'marketing.hero',
        sort_order: 0,
        config: {
            instanceKey: 'hero',
            source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' },
            showLeadForm: true
        },
        is_active: true,
        version: 1
    },
    {
        id: '0190a9b5-3cde-7abc-8def-0123456789c3',
        layout_id: marketingLayoutId,
        zone: 'marketing-main',
        widget_key: 'marketing.collection',
        sort_order: 1,
        config: {
            instanceKey: 'features',
            variant: 'features',
            source: { entityCodename: 'MarketingPageFeature', entityKind: 'object', fieldMap: { title: 'description' } },
            copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'features' },
            maxItems: 100,
            showTitle: true,
            showDescription: true
        },
        is_active: true,
        version: 1
    },
    {
        id: '0190a9b5-3cde-7abc-8def-0123456789c4',
        layout_id: marketingLayoutId,
        zone: 'marketing-main',
        widget_key: 'marketing.pricing',
        sort_order: 2,
        config: {
            instanceKey: 'pricing',
            source: { entityCodename: 'MarketingPagePricing', entityKind: 'object' },
            copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'pricing' },
            maxItems: 24,
            showBenefits: true
        },
        is_active: true,
        version: 1
    },
    {
        id: '0190a9b5-3cde-7abc-8def-0123456789c5',
        layout_id: marketingLayoutId,
        zone: 'marketing-footer',
        widget_key: 'marketing.footer',
        sort_order: 0,
        config: {
            instanceKey: 'footer',
            source: { entityCodename: 'MarketingPageFooterLink', entityKind: 'object' },
            copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'footer' },
            maxItems: 100,
            showNewsletter: true
        },
        is_active: true,
        version: 1
    }
]

const createResponse = () => {
    const json = jest.fn()
    const status = jest.fn().mockReturnValue({ json })
    return { json, status } as unknown as Response & { json: jest.Mock; status: jest.Mock }
}

type MockLayoutRow = Record<string, unknown>
type MockEffectiveTarget = { entityTypeId?: string | null }

const asMockRecord = (value: unknown): MockLayoutRow => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})

describe('runtime marketing page controller', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveEffectiveLayout.mockImplementation(
            async (executor: { query: jest.Mock }, _auth: unknown, target: MockEffectiveTarget) => {
                const entityTypeId = typeof target.entityTypeId === 'string' ? target.entityTypeId : null
                const layoutRows = (await executor.query('FROM _app_layouts', [entityTypeId])) as MockLayoutRow[]
                const globalLayout = layoutRows.find((row) => row.scope_entity_id === null && row.is_default === true)
                const scopedLayout = entityTypeId
                    ? layoutRows.find((row) => row.scope_entity_id === entityTypeId && row.is_default === true)
                    : undefined
                const selectedLayout = scopedLayout ?? globalLayout
                if (!selectedLayout) throw new Error('missing layout')
                const selectedTemplateKey = selectedLayout.template_key
                const widgetRows =
                    selectedTemplateKey === 'marketing-page'
                        ? ((await executor.query('SELECT * FROM "app_schema"._app_widgets', [selectedLayout.id])) as MockLayoutRow[])
                        : []
                const selectedScopeEntityId = typeof selectedLayout.scope_entity_id === 'string' ? selectedLayout.scope_entity_id : null
                const semanticRegion = (zone: string) =>
                    zone === 'marketing-header' ? 'header' : zone === 'marketing-footer' ? 'footer' : 'main'
                return {
                    status: 'ok',
                    target,
                    resolvedEntityTypeId: entityTypeId,
                    scope: selectedScopeEntityId ? 'entity' : 'global',
                    layout: {
                        id: selectedLayout.id,
                        scopeKind: selectedScopeEntityId ? 'entity' : 'global',
                        scopeEntityId: selectedScopeEntityId,
                        templateKey: selectedTemplateKey,
                        sourceKind: selectedLayout.source_kind ?? 'application',
                        sourceLayoutId: selectedLayout.source_layout_id ?? null,
                        sourceSnapshotHash: selectedLayout.source_snapshot_hash ?? null,
                        sourceContentHash: selectedLayout.source_content_hash ?? null,
                        localContentHash: selectedLayout.local_content_hash ?? null,
                        syncState: selectedLayout.sync_state ?? 'clean',
                        compositionMode: selectedLayout.compositionMode ?? 'independent',
                        baseLayoutId: selectedLayout.baseLayoutId ?? null,
                        name: selectedLayout.name ?? {},
                        description: selectedLayout.description ?? null,
                        config: selectedLayout.config ?? {},
                        isActive: true,
                        isDefault: true,
                        sortOrder: selectedLayout.sort_order ?? 0,
                        version: selectedLayout.version ?? 1
                    },
                    widgets: widgetRows.map((row) => {
                        const config = asMockRecord(row.config)
                        return {
                            id: row.id,
                            layoutId: row.layout_id,
                            zone: row.zone,
                            semanticRegion: semanticRegion(String(row.zone)),
                            widgetKey: row.widget_key,
                            instanceKey: config.instanceKey,
                            sortOrder: row.sort_order,
                            config: row.config ?? {},
                            sourceConfig: row.source_config ?? null,
                            sourceWidgetId: row.source_widget_id ?? null,
                            sourceBaseWidgetId: row.source_base_widget_id ?? null,
                            isActive: row.is_active,
                            version: row.version ?? 1
                        }
                    }),
                    precedence: [selectedScopeEntityId ? 'application-entity' : 'application-global'],
                    publicationIdentity: null,
                    materializationHash: 'a'.repeat(64),
                    effectiveHash: 'b'.repeat(64)
                }
            }
        )
    })

    it('filters unsafe actions and media before they reach the runtime payload', () => {
        expect(safeAction('/sign-up')).toMatchObject({ kind: 'internal', path: '/sign-up' })
        expect(safeAction('#')).toBeNull()
        expect(safeAction('javascript:alert(1)')).toBeNull()
        expect(safeAction('https://user:pass@example.test')).toBeNull()
        expect(safeAction('mailto:sales@example.test?subject=Hello%20world')).toEqual({
            kind: 'email',
            address: 'sales@example.test',
            subject: 'Hello world'
        })
        expect(safeAction('mailto:sales@example.test?body=unsafe')).toBeNull()
        expect(safeAction('mailto:sales@example.test?subject=unsafe%0Aheader')).toBeNull()
        expect(safeMedia('https://cdn.example.test/hero.png', 'hero', { en: 'Hero' })).toMatchObject({
            kind: 'hero',
            resource: { url: 'https://cdn.example.test/hero.png' }
        })
        expect(
            safeMedia({ type: 'file', storageKey: 'marketing/hero.webp', mimeType: 'image/webp' }, 'hero', { en: 'Hero' })
        ).toMatchObject({
            kind: 'hero',
            resource: { type: 'file', storageKey: 'marketing/hero.webp' }
        })
        expect(safeMedia({ type: 'url', url: 'javascript:alert(1)' }, 'hero', { en: 'Hero' })).toBeUndefined()
        expect(safeMedia('data:text/plain,unsafe', 'hero', { en: 'Hero' })).toBeUndefined()
    })

    it('maps physical component columns to semantic codenames without exposing metadata names', () => {
        expect(
            normalizeRuntimeRow({ id: uuidV7, title_column: 'Hello' }, [
                { codename: { _primary: 'en', locales: { en: { content: 'Title' } } }, column_name: 'title_column' }
            ])
        ).toMatchObject({ title_column: 'Hello', Title: 'Hello' })
    })

    it('normalizes configuration defaults and rejects malformed marketing settings', () => {
        expect(toConfig({})).toMatchObject({ themeMode: 'system', allowEmailActions: true, externalLinkTarget: 'new-tab' })
        expect(() => toConfig({ themeMode: 'sepia' })).toThrow('configuration is invalid')
    })

    it('rejects repeated runtime query parameters instead of silently dropping values', async () => {
        const manager = { query: jest.fn() }
        mockResolveRuntimeSchema.mockResolvedValue({ schemaName: 'app_schema', schemaIdent: '"app_schema"', manager })
        const controller = createRuntimeMarketingPageController(() => manager as never)
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: { locale: ['en', 'ru'] } } as unknown as Request, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            code: 'MARKETING_RUNTIME_QUERY_INVALID',
            error: 'Marketing runtime query parameters are invalid.'
        })
        expect(manager.query).not.toHaveBeenCalled()
    })

    it('rejects repeated entity target parameters before querying application metadata', async () => {
        const manager = { query: jest.fn() }
        mockResolveRuntimeSchema.mockResolvedValue({ schemaName: 'app_schema', schemaIdent: '"app_schema"', manager })
        const controller = createRuntimeMarketingPageController(() => manager as never)
        const res = createResponse()

        await controller.getMarketingPage(
            {
                params: { applicationId },
                query: { locale: 'en', entityTypeId: [siteSettingsObjectId, siteSettingsObjectId] }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            code: 'MARKETING_RUNTIME_QUERY_INVALID',
            error: 'Marketing runtime query parameters are invalid.'
        })
        expect(manager.query).not.toHaveBeenCalled()
    })

    it('fails closed when the selected application layout is not marketing-page', async () => {
        const manager = { query: jest.fn() }
        mockResolveRuntimeSchema.mockResolvedValue({ schemaName: 'app_schema', schemaIdent: '"app_schema"', manager })
        manager.query.mockResolvedValueOnce([
            { id: marketingLayoutId, scope_entity_id: null, template_key: 'dashboard', config: {}, is_active: true, is_default: true }
        ])
        const controller = createRuntimeMarketingPageController(() => manager as never)
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: { locale: 'en' } } as unknown as Request, res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Application does not use marketing-page template'
        })
        expect(manager.query).toHaveBeenCalledTimes(1)
    })

    it('rejects a marketing layout without any active widget composition', async () => {
        const manager = { query: jest.fn() }
        mockResolveRuntimeSchema.mockResolvedValue({ schemaName: 'app_schema', schemaIdent: '"app_schema"', manager })
        manager.query.mockImplementation(async (sql: string) => {
            if (sql.includes('_app_layouts'))
                return [
                    {
                        id: marketingLayoutId,
                        scope_entity_id: null,
                        template_key: 'marketing-page',
                        config: {},
                        is_active: true,
                        is_default: true
                    }
                ]
            if (sql.includes('_app_widgets')) return defaultMarketingWidgetRows().map((row) => ({ ...row, is_active: false }))
            throw new Error(`Unexpected runtime query: ${sql}`)
        })
        const controller = createRuntimeMarketingPageController(() => manager as never)
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: { locale: 'en' } } as unknown as Request, res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            code: 'MARKETING_LAYOUT_INCOMPLETE',
            error: 'Marketing page has no active widget composition.'
        })
        expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('_app_objects'))).toBe(false)
    })

    it('rejects a widget whose source does not match its collection variant', async () => {
        const manager = { query: jest.fn() }
        mockResolveRuntimeSchema.mockResolvedValue({ schemaName: 'app_schema', schemaIdent: '"app_schema"', manager })
        manager.query.mockImplementation(async (sql: string) => {
            if (sql.includes('_app_layouts'))
                return [
                    {
                        id: marketingLayoutId,
                        scope_entity_id: null,
                        template_key: 'marketing-page',
                        config: {},
                        is_active: true,
                        is_default: true
                    }
                ]
            if (sql.includes('_app_widgets')) {
                return defaultMarketingWidgetRows().map((row, index) =>
                    index === 3
                        ? {
                              ...row,
                              config: {
                                  ...row.config,
                                  source: { entityCodename: 'MarketingPageLogo', entityKind: 'object' }
                              }
                          }
                        : row
                )
            }
            throw new Error(`Unexpected runtime query: ${sql}`)
        })
        const controller = createRuntimeMarketingPageController(() => manager as never)
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: { locale: 'en' } } as unknown as Request, res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            code: 'MARKETING_LAYOUT_INVALID',
            error: 'Marketing widget configuration is invalid.'
        })
        expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('_app_objects'))).toBe(false)
    })

    it('returns a typed source-unavailable error instead of silently omitting an active widget source', async () => {
        const manager = { query: jest.fn() }
        mockResolveRuntimeSchema.mockResolvedValue({ schemaName: 'app_schema', schemaIdent: '"app_schema"', manager })
        manager.query.mockImplementation(async (sql: string) => {
            if (sql.includes('_app_layouts'))
                return [
                    {
                        id: marketingLayoutId,
                        scope_entity_id: null,
                        template_key: 'marketing-page',
                        config: {},
                        is_active: true,
                        is_default: true
                    }
                ]
            if (sql.includes('_app_widgets')) return defaultMarketingWidgetRows()
            if (sql.includes('_app_objects')) return [siteSettingsObject]
            if (sql.includes('_app_components')) return []
            if (sql.includes('marketing_site_settings')) return [siteSettingsRow]
            throw new Error(`Unexpected runtime query: ${sql}`)
        })
        const controller = createRuntimeMarketingPageController(() => manager as never)
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: { locale: 'en' } } as unknown as Request, res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            code: 'MARKETING_SOURCE_UNAVAILABLE',
            error: 'Marketing widget data source is unavailable.'
        })
    })

    it('rejects duplicate widget instance identity before reading object metadata', async () => {
        const manager = { query: jest.fn() }
        mockResolveRuntimeSchema.mockResolvedValue({ schemaName: 'app_schema', schemaIdent: '"app_schema"', manager })
        manager.query.mockImplementation(async (sql: string) => {
            if (sql.includes('_app_layouts'))
                return [
                    {
                        id: marketingLayoutId,
                        scope_entity_id: null,
                        template_key: 'marketing-page',
                        config: {},
                        is_active: true,
                        is_default: true
                    }
                ]
            if (sql.includes('_app_widgets'))
                return defaultMarketingWidgetRows().map((row, index) =>
                    index === 4 ? { ...row, config: { ...row.config, instanceKey: 'features' } } : row
                )
            throw new Error(`Unexpected runtime query: ${sql}`)
        })
        const controller = createRuntimeMarketingPageController(() => manager as never)
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: { locale: 'en' } } as unknown as Request, res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            code: 'MARKETING_LAYOUT_INVALID',
            error: 'Marketing widget instance keys must be unique within a layout.'
        })
        expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('_app_objects'))).toBe(false)
    })

    it('assembles a validated marketing payload from bounded metadata-backed rows', async () => {
        const manager = { query: jest.fn() }
        mockResolveRuntimeSchema.mockResolvedValue({ schemaName: 'app_schema', schemaIdent: '"app_schema"', manager })
        manager.query.mockImplementation(async (sql: string) => {
            if (sql.includes('_app_layouts'))
                return [
                    {
                        id: marketingLayoutId,
                        scope_entity_id: null,
                        template_key: 'marketing-page',
                        config: {},
                        is_active: true,
                        is_default: true
                    }
                ]
            if (sql.includes('_app_widgets')) return defaultMarketingWidgetRows()
            if (sql.includes('_app_objects')) {
                return marketingObjectRows()
            }
            if (sql.includes('_app_components')) return []
            if (sql.includes('marketing_site_settings')) return [siteSettingsRow]
            if (sql.includes('marketing_section')) {
                return [
                    {
                        id: '0190a9b5-3cde-7abc-8def-0123456789b1',
                        codename: 'features',
                        SectionKey: 'features',
                        Title: { en: 'Features' },
                        Description: { en: 'Features description' },
                        SortOrder: 1,
                        IsVisible: true
                    },
                    {
                        id: '0190a9b5-3cde-7abc-8def-0123456789b2',
                        codename: 'hero',
                        SectionKey: 'hero',
                        Title: { en: 'Hero' },
                        Description: { en: 'Hero description' },
                        SortOrder: 2,
                        IsVisible: false
                    },
                    ...marketingSectionRows().filter((row) => row.SectionKey === 'pricing' || row.SectionKey === 'footer')
                ]
            }
            if (sql.includes('marketing_feature')) {
                return [
                    {
                        id: '0190a9b5-3cde-7abc-8def-0123456789b4',
                        codename: 'dashboard',
                        FeatureKey: 'dashboard',
                        IconKey: 'ViewQuiltRounded',
                        Title: { en: 'Dashboard' },
                        Description: { en: 'Dashboard description' },
                        SortOrder: 1,
                        IsVisible: true
                    }
                ]
            }
            if (sql.includes('LIMIT 1000')) return []
            throw new Error(`Unexpected runtime query: ${sql}`)
        })
        const controller = createRuntimeMarketingPageController(() => manager as never)
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: { locale: 'en' } } as unknown as Request, res)

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                templateKey: 'marketing-page',
                marketingPage: expect.objectContaining({
                    templateKey: 'marketing-page',
                    widgets: expect.arrayContaining([
                        expect.objectContaining({ widgetKey: 'marketing.hero' }),
                        expect.objectContaining({ widgetKey: 'marketing.collection' })
                    ])
                })
            })
        )
        const effectiveTarget = mockResolveEffectiveLayout.mock.calls.at(-1)?.[2] as Record<string, unknown>
        expect(effectiveTarget).toEqual(expect.objectContaining({ applicationId, targetKind: null, locale: 'en' }))
        expect(effectiveTarget).not.toHaveProperty('recordKey')
        const responsePayload = res.json.mock.calls[0]?.[0] as {
            marketingPage?: {
                widgets?: Array<{ widgetKey?: string; data?: { records?: Array<{ kind?: string; provenance?: Record<string, unknown> }> } }>
            }
        }
        const heroRecords =
            responsePayload.marketingPage?.widgets?.find((widget) => widget.widgetKey === 'marketing.hero')?.data?.records ?? []
        expect(heroRecords.find((record) => record.kind === 'siteSettings')?.provenance).toEqual(
            expect.objectContaining({ isSeeded: true, isAuthored: false, seedKey: 'site-settings' })
        )
        expect(heroRecords).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: 'siteSettings',
                    copyrightLabel: { en: 'Sitemark', ru: 'Sitemark' },
                    copyrightAction: {
                        label: { en: 'Sitemark', ru: 'Sitemark' },
                        action: { kind: 'external', url: 'https://mui.com/', target: 'new-tab' }
                    }
                })
            ])
        )
        expect(manager.query.mock.calls.filter(([sql]) => String(sql).includes('LIMIT 1000')).length).toBe(marketingObjectRows().length)
        const featureWidget = responsePayload.marketingPage?.widgets?.find((widget) => widget.widgetKey === 'marketing.collection')
        expect(responsePayload.marketingPage?.widgets?.some((widget) => widget.widgetKey === 'languageSwitcher')).toBe(false)
        expect(featureWidget?.data?.records).toEqual(
            expect.arrayContaining([expect.objectContaining({ kind: 'sectionCopy', sectionKey: 'features' })])
        )
        expect(featureWidget?.data?.records).toEqual(
            expect.arrayContaining([expect.objectContaining({ kind: 'feature', title: { en: 'Dashboard description' } })])
        )
    })

    it('fails closed when the effective layout hash changed between host and content requests', async () => {
        const manager = { query: jest.fn() }
        mockResolveRuntimeSchema.mockResolvedValue({ schemaName: 'app_schema', schemaIdent: '"app_schema"', manager })
        mockResolveEffectiveLayout.mockResolvedValueOnce({ status: 'ok', effectiveHash: 'b'.repeat(64) })
        const controller = createRuntimeMarketingPageController(() => manager as never)
        const res = createResponse()

        await controller.getMarketingPage(
            {
                params: { applicationId },
                query: { locale: 'en', expectedLayoutHash: 'a'.repeat(64) }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            code: 'MARKETING_RUNTIME_LAYOUT_STALE',
            error: 'The marketing layout changed while its content was loading. Reload and try again.'
        })
        expect(manager.query).not.toHaveBeenCalled()
    })

    it('prefers an active scoped marketing layout for the requested entity type', async () => {
        const manager = { query: jest.fn() }
        mockResolveRuntimeSchema.mockResolvedValue({ schemaName: 'app_schema', schemaIdent: '"app_schema"', manager })
        const scopedWidgets = defaultMarketingWidgetRows().map((row) => ({ ...row, layout_id: scopedMarketingLayoutId }))
        manager.query.mockImplementation(async (sql: string) => {
            if (sql.includes('_app_objects') && sql.includes('LIMIT 2')) {
                return [{ id: scopedEntityTypeId, kind: 'catalog' }]
            }
            if (sql.includes('_app_layouts'))
                return [
                    {
                        id: marketingLayoutId,
                        scope_entity_id: null,
                        template_key: 'marketing-page',
                        config: {},
                        is_active: true,
                        is_default: true,
                        version: 3
                    },
                    {
                        id: scopedMarketingLayoutId,
                        scope_entity_id: scopedEntityTypeId,
                        template_key: 'marketing-page',
                        config: {},
                        is_active: true,
                        is_default: true,
                        version: 7
                    }
                ]
            if (sql.includes('_app_widgets')) return scopedWidgets
            if (sql.includes('_app_objects')) return marketingObjectRows()
            if (sql.includes('_app_components')) return []
            if (sql.includes('marketing_site_settings')) return [siteSettingsRow]
            if (sql.includes('marketing_section')) return marketingSectionRows()
            if (sql.includes('LIMIT 1000')) return []
            throw new Error(`Unexpected runtime query: ${sql}`)
        })

        const controller = createRuntimeMarketingPageController(() => manager as never)
        const res = createResponse()

        await controller.getMarketingPage(
            {
                params: { applicationId },
                query: { locale: 'en', targetKind: 'object', entityTypeId: scopedEntityTypeId }
            } as unknown as Request,
            res
        )

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                marketingPage: expect.objectContaining({
                    runtime: expect.objectContaining({
                        layoutId: scopedMarketingLayoutId,
                        layoutVersion: 7
                    })
                })
            })
        )
        expect(mockResolveEffectiveLayout.mock.calls.at(-1)?.[2]).toEqual(
            expect.objectContaining({ applicationId, targetKind: 'object', entityTypeId: scopedEntityTypeId, locale: 'en' })
        )
        expect(manager.query.mock.calls).toContainEqual([
            expect.stringContaining('FROM "app_schema"._app_widgets'),
            [scopedMarketingLayoutId]
        ])
        expect(manager.query.mock.calls).toContainEqual([
            expect.stringContaining("COALESCE(o.kind, '') NOT IN ('hub', 'set', 'enumeration', 'page', 'ledger')"),
            ['object', scopedEntityTypeId]
        ])
    })

    it('binds workspace rows and reports workspace provenance when a runtime workspace is selected', async () => {
        const manager = { query: jest.fn() }
        const workspaceId = '0190a9b5-3cde-7abc-8def-0123456789af'
        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName: 'app_schema',
            schemaIdent: '"app_schema"',
            currentWorkspaceId: workspaceId,
            manager
        })
        manager.query.mockImplementation(async (sql: string) => {
            if (sql.includes('_app_layouts'))
                return [
                    {
                        id: marketingLayoutId,
                        scope_entity_id: null,
                        template_key: 'marketing-page',
                        config: {},
                        is_active: true,
                        is_default: true
                    }
                ]
            if (sql.includes('_app_widgets')) return defaultMarketingWidgetRows()
            if (sql.includes('_app_objects')) {
                return marketingObjectRows()
            }
            if (sql.includes('_app_components')) return []
            if (sql.includes('marketing_site_settings')) return [siteSettingsRow]
            if (sql.includes('marketing_section')) return marketingSectionRows()
            if (sql.includes('LIMIT 1000')) return []
            throw new Error(`Unexpected runtime query: ${sql}`)
        })

        const controller = createRuntimeMarketingPageController(() => manager as never)
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: { locale: 'en' } } as unknown as Request, res)

        const payload = res.json.mock.calls[0]?.[0] as {
            marketingPage?: { widgets?: Array<{ data?: { records?: Array<Record<string, unknown>> } }> }
        }
        const records = payload.marketingPage?.widgets?.flatMap((widget) => widget.data?.records ?? []) ?? []
        expect(records.find((record) => record.kind === 'siteSettings')).toEqual(
            expect.objectContaining({ scope: 'workspace', provenance: expect.objectContaining({ layer: 'workspace' }) })
        )
        expect(
            manager.query.mock.calls
                .filter(([sql]) => String(sql).includes('LIMIT 1000'))
                .every(([, params]) => params?.[0] === workspaceId)
        ).toBe(true)
    })

    it('derives pricing benefits from linked object rows instead of a JSON column', async () => {
        const manager = { query: jest.fn() }
        const pricingId = '0190a9b5-3cde-7abc-8def-0123456789af'
        mockResolveRuntimeSchema.mockResolvedValue({ schemaName: 'app_schema', schemaIdent: '"app_schema"', manager })
        manager.query.mockImplementation(async (sql: string) => {
            if (sql.includes('_app_layouts'))
                return [
                    {
                        id: marketingLayoutId,
                        scope_entity_id: null,
                        template_key: 'marketing-page',
                        config: {},
                        is_active: true,
                        is_default: true
                    }
                ]
            if (sql.includes('_app_widgets')) return defaultMarketingWidgetRows()
            if (sql.includes('_app_objects')) {
                return marketingObjectRows().map((object) =>
                    object.codename === 'MarketingPagePricing' ? { ...object, id: pricingId } : object
                )
            }
            if (sql.includes('_app_components')) return []
            if (sql.includes('marketing_site_settings')) return [siteSettingsRow]
            if (sql.includes('marketing_section')) return marketingSectionRows()
            if (sql.includes('marketing_pricing_benefit')) {
                return [
                    {
                        id: '0190a9b5-3cde-7abc-8def-0123456789b1',
                        codename: 'professional-benefit-1',
                        TierRef: pricingId,
                        Label: { en: 'Priority support' },
                        SortOrder: 1,
                        IsVisible: true
                    }
                ]
            }
            if (sql.includes('marketing_pricing')) {
                return [
                    {
                        id: pricingId,
                        codename: 'professional',
                        TierKey: 'professional',
                        Title: { en: 'Professional' },
                        Price: 15,
                        Period: { en: 'per month' },
                        ActionLabel: { en: 'Start now' },
                        ActionHref: '/sign-up',
                        Featured: true,
                        SortOrder: 1,
                        IsVisible: true
                    }
                ]
            }
            if (sql.includes('LIMIT 1000')) return []
            throw new Error(`Unexpected runtime query: ${sql}`)
        })
        const controller = createRuntimeMarketingPageController(() => manager as never)
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: { locale: 'en' } } as unknown as Request, res)

        const payload = res.json.mock.calls[0]?.[0] as {
            marketingPage?: { widgets?: Array<{ data?: { records?: Array<Record<string, unknown>> } }> }
        }
        const records = payload.marketingPage?.widgets?.flatMap((widget) => widget.data?.records ?? []) ?? []
        expect(records).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ kind: 'pricingBenefit', semanticKey: 'professional-benefit-1' }),
                expect.objectContaining({ kind: 'pricingTier', price: { en: '15' }, benefits: [{ en: 'Priority support' }] })
            ])
        )
    })

    it.each([
        ['missing site settings', []],
        ['duplicate site settings', [{ ...siteSettingsRow }, { ...siteSettingsRow, id: '0190a9b5-3cde-7abc-8def-0123456789a3' }]]
    ])('returns a controlled conflict for %s singleton data', async (_caseName, siteSettingsRows) => {
        const manager = { query: jest.fn() }
        mockResolveRuntimeSchema.mockResolvedValue({ schemaName: 'app_schema', schemaIdent: '"app_schema"', manager })
        manager.query.mockImplementation(async (sql: string) => {
            if (sql.includes('_app_layouts'))
                return [
                    {
                        id: marketingLayoutId,
                        scope_entity_id: null,
                        template_key: 'marketing-page',
                        config: {},
                        is_active: true,
                        is_default: true
                    }
                ]
            if (sql.includes('_app_widgets')) return defaultMarketingWidgetRows()
            if (sql.includes('_app_objects')) {
                return [siteSettingsObject]
            }
            if (sql.includes('_app_components')) return []
            if (sql.includes('marketing_site_settings')) return siteSettingsRows
            throw new Error(`Unexpected runtime query: ${sql}`)
        })
        const controller = createRuntimeMarketingPageController(() => manager as never)
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: { locale: 'en' } } as unknown as Request, res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            code: 'MARKETING_SINGLETON_INVALID',
            error: 'Marketing page requires exactly one site settings record.'
        })
    })

    it('returns a controlled conflict when a non-singleton row has a non-v7 identifier', async () => {
        const manager = { query: jest.fn() }
        mockResolveRuntimeSchema.mockResolvedValue({ schemaName: 'app_schema', schemaIdent: '"app_schema"', manager })
        manager.query.mockImplementation(async (sql: string) => {
            if (sql.includes('_app_layouts'))
                return [
                    {
                        id: marketingLayoutId,
                        scope_entity_id: null,
                        template_key: 'marketing-page',
                        config: {},
                        is_active: true,
                        is_default: true
                    }
                ]
            if (sql.includes('_app_widgets')) return defaultMarketingWidgetRows()
            if (sql.includes('_app_objects')) {
                return [
                    siteSettingsObject,
                    {
                        id: '0190a9b5-3cde-7abc-8def-0123456789ad',
                        codename: 'MarketingPageLogo',
                        table_name: 'marketing_logo',
                        config: {}
                    }
                ]
            }
            if (sql.includes('_app_components')) return []
            if (sql.includes('marketing_site_settings')) return [siteSettingsRow]
            if (sql.includes('marketing_logo')) return [{ id: 'not-a-uuid-v7', codename: 'logo' }]
            throw new Error(`Unexpected runtime query: ${sql}`)
        })
        const controller = createRuntimeMarketingPageController(() => manager as never)
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: { locale: 'en' } } as unknown as Request, res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            code: 'MARKETING_RECORD_INVALID',
            error: 'Marketing page contains an invalid record.'
        })
    })

    it('fails closed instead of injecting stock copy when required site content is missing', async () => {
        const manager = { query: jest.fn() }
        mockResolveRuntimeSchema.mockResolvedValue({ schemaName: 'app_schema', schemaIdent: '"app_schema"', manager })
        manager.query.mockImplementation(async (sql: string) => {
            if (sql.includes('_app_layouts'))
                return [
                    {
                        id: marketingLayoutId,
                        scope_entity_id: null,
                        template_key: 'marketing-page',
                        config: {},
                        is_active: true,
                        is_default: true
                    }
                ]
            if (sql.includes('_app_widgets')) return defaultMarketingWidgetRows()
            if (sql.includes('_app_objects')) return [siteSettingsObject]
            if (sql.includes('_app_components')) return []
            if (sql.includes('marketing_site_settings')) return [{ ...siteSettingsRow, HeroTitle: undefined }]
            throw new Error(`Unexpected runtime query: ${sql}`)
        })
        const controller = createRuntimeMarketingPageController(() => manager as never)
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: { locale: 'en' } } as unknown as Request, res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            code: 'MARKETING_RUNTIME_DATA_INVALID',
            error: 'Marketing page data is invalid.'
        })
    })

    it('rejects duplicate section copy instead of silently overwriting the first row', async () => {
        const manager = { query: jest.fn() }
        mockResolveRuntimeSchema.mockResolvedValue({ schemaName: 'app_schema', schemaIdent: '"app_schema"', manager })
        manager.query.mockImplementation(async (sql: string) => {
            if (sql.includes('_app_layouts'))
                return [
                    {
                        id: marketingLayoutId,
                        scope_entity_id: null,
                        template_key: 'marketing-page',
                        config: {},
                        is_active: true,
                        is_default: true
                    }
                ]
            if (sql.includes('_app_widgets')) return defaultMarketingWidgetRows()
            if (sql.includes('_app_objects')) {
                return [
                    siteSettingsObject,
                    {
                        id: '0190a9b5-3cde-7abc-8def-0123456789b0',
                        codename: 'MarketingPageSection',
                        table_name: 'marketing_section',
                        config: {}
                    }
                ]
            }
            if (sql.includes('_app_components')) return []
            if (sql.includes('marketing_site_settings')) return [siteSettingsRow]
            if (sql.includes('marketing_section')) {
                return [
                    {
                        id: '0190a9b5-3cde-7abc-8def-0123456789b1',
                        codename: 'features-one',
                        SectionKey: 'features',
                        Title: { en: 'Features' },
                        SortOrder: 1,
                        IsVisible: true
                    },
                    {
                        id: '0190a9b5-3cde-7abc-8def-0123456789b2',
                        codename: 'features-two',
                        SectionKey: 'features',
                        Title: { en: 'Features duplicate' },
                        SortOrder: 2,
                        IsVisible: true
                    }
                ]
            }
            throw new Error(`Unexpected runtime query: ${sql}`)
        })
        const controller = createRuntimeMarketingPageController(() => manager as never)
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: { locale: 'en' } } as unknown as Request, res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            code: 'MARKETING_SECTION_DUPLICATE',
            error: 'Marketing page contains duplicate section copy.'
        })
    })
})
