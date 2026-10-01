import {
    buildSingleTargetWidgetBinding,
    encodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    LAYOUT_WIDGET_DEFINITIONS,
    validateWidgetBindings
} from '@universo-react/types'
import type { SqlQueryable } from '@universo-react/utils/database'
import {
    assertMarketingHeroLayoutMutationPreservesActions,
    assertMarketingHeroRecordActionsRemainValid
} from '../../domains/layouts/marketingHeroActionIntegrityStore'
import { projectMarketingHeroContentData } from '../../domains/layouts/marketingHeroContentProjection'

const sourceLayoutId = '0190a9b5-3cde-7abc-8def-0123456789a1'
const scopedLayoutId = '0190a9b5-3cde-7abc-8def-0123456789a2'
const heroWidgetId = '0190a9b5-3cde-7abc-8def-0123456789a3'
const pricingWidgetId = '0190a9b5-3cde-7abc-8def-0123456789a4'
const enterprisePricingWidgetId = '0190a9b5-3cde-7abc-8def-0123456789a7'
const featureWidgetId = '0190a9b5-3cde-7abc-8def-0123456789a8'
const heroObjectId = '0190a9b5-3cde-7abc-8def-0123456789a5'

const localized = (en: string, ru: string) => ({
    _schema: 'v1',
    _primary: 'en',
    locales: {
        en: { content: en, isActive: true },
        ru: { content: ru, isActive: true }
    }
})

const heroRecordData = (primaryHref: string) => ({
    HeroKey: 'hero-default',
    Title: localized('Welcome', 'Добро пожаловать'),
    Description: localized('A product overview', 'Описание продукта'),
    EmailLabel: localized('Email', 'Электронная почта'),
    EmailPlaceholder: localized('you@example.com', 'you@example.com'),
    PrimaryActionLabel: localized('Get started', 'Начать'),
    PrimaryAction: { kind: 'anchor', href: primaryHref }
})

const binding = (() => {
    const definition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
    if (!definition) throw new Error('Marketing Hero widget is not registered')
    return buildSingleTargetWidgetBinding(definition, 'content', {
        entityKind: 'object',
        entityCodename: 'MarketingPageHero',
        semanticKey: 'hero-default'
    })
})()

const heroConfig = encodeWidgetConfigEnvelope(
    { rendererConfig: { instanceKey: 'hero-default' }, neutral: { bindings: binding } },
    { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
)

const heroOverlayDeltaConfig = encodeWidgetConfigEnvelope(
    { rendererConfig: { instanceKey: 'hero-default', showLeadForm: false } },
    { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
)

const widgetConfig = (
    widgetKey: 'marketing.pricing' | 'marketing.collection',
    rendererConfig: Record<string, unknown>,
    semanticKeys: Record<string, string>
) => {
    const definition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
    if (!definition) throw new Error(`${widgetKey} widget is not registered`)
    const collectionEntities: Record<string, string> = {
        logos: 'MarketingPageLogo',
        features: 'MarketingPageFeature',
        testimonials: 'MarketingPageTestimonial',
        highlights: 'MarketingPageHighlight',
        faq: 'MarketingPageFaq'
    }
    const entityCodenames: Record<string, string> = {
        section: 'MarketingPageSection',
        tiers: 'MarketingPagePricing',
        benefits: 'MarketingPagePricingBenefit',
        items: collectionEntities[String(rendererConfig.variant ?? 'features')] ?? 'MarketingPageFeature'
    }
    const bindings = validateWidgetBindings(definition, {
        version: 1,
        slots: (definition.bindingSlots ?? []).map((slot) => {
            const semanticComponent = slot.requirements.components.find(({ semanticKey }) => semanticKey === true)
            const selectorKind = slot.selectorKinds[0]
            const selector =
                selectorKind === 'semantic-key'
                    ? {
                          kind: selectorKind,
                          field: semanticComponent?.field ?? 'key',
                          value: semanticKeys[slot.key] ?? 'default'
                      }
                    : selectorKind === 'relation-set'
                    ? { kind: selectorKind, parentSlot: slot.relation?.parentSlot ?? 'tiers' }
                    : { kind: selectorKind }
            return {
                slot: slot.key,
                targets: [
                    {
                        entityKind: 'object',
                        entityCodename: entityCodenames[slot.key] ?? `MarketingPage${slot.key}`,
                        selector,
                        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }
                ]
            }
        })
    })
    return encodeWidgetConfigEnvelope(
        { rendererConfig, neutral: { bindings } },
        { templateKey: 'marketing-page', widgetKey, zone: 'marketing-main' }
    )
}

const createDb = (
    primaryHref = '#pricing',
    scopedPricingActive = true,
    scopedHeroActive = true,
    includeEnterprisePricing = false,
    includeFeatureCollection = false,
    scopedHeroConfig?: unknown
) => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('FROM') && sql.includes('"_mhb_layouts"')) {
            return [
                { id: sourceLayoutId, scope_entity_id: null, base_layout_id: null },
                { id: scopedLayoutId, scope_entity_id: heroObjectId, base_layout_id: sourceLayoutId }
            ]
        }
        if (sql.includes('FROM') && sql.includes('"_mhb_widgets"')) {
            return [
                {
                    id: heroWidgetId,
                    layout_id: sourceLayoutId,
                    widget_key: 'marketing.hero',
                    zone: 'marketing-main',
                    config: heroConfig,
                    is_active: true
                },
                {
                    id: pricingWidgetId,
                    layout_id: sourceLayoutId,
                    widget_key: 'marketing.pricing',
                    zone: 'marketing-main',
                    config: widgetConfig('marketing.pricing', { instanceKey: 'pricing', maxItems: 24, showBenefits: true }, {}),
                    is_active: true
                },
                ...(includeEnterprisePricing
                    ? [
                          {
                              id: enterprisePricingWidgetId,
                              layout_id: sourceLayoutId,
                              widget_key: 'marketing.pricing',
                              zone: 'marketing-main',
                              config: widgetConfig(
                                  'marketing.pricing',
                                  { instanceKey: 'pricing-enterprise', maxItems: 24, showBenefits: true },
                                  {}
                              ),
                              sort_order: 3,
                              is_active: true
                          }
                      ]
                    : []),
                ...(includeFeatureCollection
                    ? [
                          {
                              id: featureWidgetId,
                              layout_id: sourceLayoutId,
                              widget_key: 'marketing.collection',
                              zone: 'marketing-main',
                              config: widgetConfig(
                                  'marketing.collection',
                                  { instanceKey: 'features-secondary', variant: 'features', maxItems: 100 },
                                  { section: 'features' }
                              ),
                              sort_order: 4,
                              is_active: true
                          }
                      ]
                    : [])
            ]
        }
        if (sql.includes('FROM') && sql.includes('"_mhb_layout_widget_overrides"')) {
            return [
                {
                    layout_id: scopedLayoutId,
                    base_widget_id: pricingWidgetId,
                    config: null,
                    is_active: scopedPricingActive,
                    is_deleted_override: false
                },
                ...(scopedHeroConfig !== undefined
                    ? [
                          {
                              layout_id: scopedLayoutId,
                              base_widget_id: heroWidgetId,
                              config: scopedHeroConfig,
                              is_active: scopedHeroActive,
                              is_deleted_override: false
                          }
                      ]
                    : scopedHeroActive
                    ? []
                    : [
                          {
                              layout_id: scopedLayoutId,
                              base_widget_id: heroWidgetId,
                              config: null,
                              is_active: false,
                              is_deleted_override: false
                          }
                      ])
            ]
        }
        if (sql.includes('FROM') && sql.includes('"_mhb_objects"')) {
            return [
                {
                    id: heroObjectId,
                    config: {
                        recordPolicy: {
                            version: 1,
                            semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
                            denyDeleteWhenBound: true,
                            immutableSemanticKeyWhenBound: true,
                            runtimeMutation: 'deny',
                            requiredLocales: ['en', 'ru'],
                            coRequiredGroups: [['TermsText', 'TermsLinkLabel', 'TermsAction']]
                        }
                    }
                }
            ]
        }
        if (sql.includes('FROM') && sql.includes('"_mhb_components"')) {
            const definition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
            return (definition?.bindingSlots?.[0]?.requirements.components ?? []).map((component) => ({
                codename: component.componentCodename,
                data_type: component.valueType.toUpperCase(),
                is_required: component.required,
                validation_rules: {
                    ...(component.localized ? { localized: true } : {}),
                    ...(component.maxLength !== undefined ? { maxLength: component.maxLength } : {}),
                    ...(component.semanticKey ? { unique: true } : {}),
                    ...(component.pattern === undefined ? {} : { pattern: component.pattern }),
                    ...(component.format ? { format: component.format } : {})
                }
            }))
        }
        if (sql.includes('FROM') && sql.includes('"_mhb_elements"')) {
            return [{ id: '0190a9b5-3cde-7abc-8def-0123456789a6', data: heroRecordData(primaryHref) }]
        }
        return []
    })
    return { db: { query } as unknown as SqlQueryable, query }
}

describe('Marketing Hero anchor integrity store', () => {
    it('treats null optional Entity components as absent while keeping required actions strict', () => {
        const content = projectMarketingHeroContentData({
            ...heroRecordData('#pricing'),
            Accent: null,
            TermsText: null,
            TermsLinkLabel: null,
            TermsAction: null
        })

        expect(content).not.toHaveProperty('accent')
        expect(content).not.toHaveProperty('termsText')
        expect(content).not.toHaveProperty('termsLinkLabel')
        expect(content).not.toHaveProperty('termsAction')
        expect(() => projectMarketingHeroContentData({ ...heroRecordData('#pricing'), PrimaryAction: null })).toThrow()
    })

    it('accepts record changes only when each bound effective layout contains the target section', async () => {
        const { db } = createDb('#pricing', true)
        const validContent = projectMarketingHeroContentData(heroRecordData('#pricing'))
        const invalidContent = projectMarketingHeroContentData(heroRecordData('#missing'))

        await expect(
            assertMarketingHeroRecordActionsRemainValid(
                db,
                'mhb_0123456789abcdef0123456789abcdef_b1',
                'HeroKey',
                'hero-default',
                validContent
            )
        ).resolves.toBeUndefined()
        await expect(
            assertMarketingHeroRecordActionsRemainValid(
                db,
                'mhb_0123456789abcdef0123456789abcdef_b1',
                'HeroKey',
                'hero-default',
                invalidContent
            )
        ).rejects.toThrow('Hero action targets an inactive section in this layout')
    })

    it('rejects a record action that is valid in the source but unavailable in a scoped layout', async () => {
        const { db } = createDb('#pricing', false)
        const content = projectMarketingHeroContentData(heroRecordData('#pricing'))

        await expect(
            assertMarketingHeroRecordActionsRemainValid(db, 'mhb_0123456789abcdef0123456789abcdef_b1', 'HeroKey', 'hero-default', content)
        ).rejects.toThrow('Hero action targets an inactive section in this layout')
    })

    it('validates scoped Hero actions with the base binding when the overlay stores only a renderer delta', async () => {
        const { db } = createDb('#pricing', false, true, false, false, heroOverlayDeltaConfig)
        const content = projectMarketingHeroContentData(heroRecordData('#pricing'))

        await expect(
            assertMarketingHeroRecordActionsRemainValid(db, 'mhb_0123456789abcdef0123456789abcdef_b1', 'HeroKey', 'hero-default', content)
        ).rejects.toThrow('Hero action targets an inactive section in this layout')
    })

    it('respects scoped inactive overrides before allowing a section change', async () => {
        const { db } = createDb('#pricing', true)

        await expect(
            assertMarketingHeroLayoutMutationPreservesActions(db, 'mhb_0123456789abcdef0123456789abcdef_b1', scopedLayoutId, {
                widgetId: pricingWidgetId,
                widgetKey: 'marketing.pricing',
                kind: 'set-active',
                isActive: false
            })
        ).rejects.toThrow('Hero action targets an inactive section in this layout')
    })

    it('checks scoped layouts affected by a source-layout section removal', async () => {
        const { db } = createDb('#pricing', false, true, true)

        await expect(
            assertMarketingHeroLayoutMutationPreservesActions(db, 'mhb_0123456789abcdef0123456789abcdef_b1', sourceLayoutId, {
                widgetId: enterprisePricingWidgetId,
                widgetKey: 'marketing.pricing',
                kind: 'remove'
            })
        ).rejects.toThrow('Hero action targets an inactive section in this layout')
    })

    it('validates section anchors when a collection configuration changes its section variant', async () => {
        const { db } = createDb('#features-features-secondary', true, true, false, true)

        await expect(
            assertMarketingHeroLayoutMutationPreservesActions(db, 'mhb_0123456789abcdef0123456789abcdef_b1', sourceLayoutId, {
                widgetId: featureWidgetId,
                widgetKey: 'marketing.collection',
                kind: 'set-config',
                config: widgetConfig(
                    'marketing.collection',
                    { instanceKey: 'features-secondary', variant: 'testimonials', maxItems: 100 },
                    { section: 'testimonials' }
                )
            })
        ).rejects.toThrow('Hero action targets an inactive section in this layout')
    })

    it('allows removing the target section while its scoped Hero is inactive, then blocks Hero reactivation or reset', async () => {
        const { db } = createDb('#pricing', false, false)

        await expect(
            assertMarketingHeroLayoutMutationPreservesActions(db, 'mhb_0123456789abcdef0123456789abcdef_b1', scopedLayoutId, {
                widgetId: pricingWidgetId,
                widgetKey: 'marketing.pricing',
                kind: 'remove'
            })
        ).resolves.toBeUndefined()

        await expect(
            assertMarketingHeroLayoutMutationPreservesActions(db, 'mhb_0123456789abcdef0123456789abcdef_b1', scopedLayoutId, {
                widgetId: heroWidgetId,
                widgetKey: 'marketing.hero',
                kind: 'set-active',
                isActive: true
            })
        ).rejects.toThrow('Hero action targets an inactive section in this layout')

        await expect(
            assertMarketingHeroLayoutMutationPreservesActions(db, 'mhb_0123456789abcdef0123456789abcdef_b1', scopedLayoutId, {
                widgetId: heroWidgetId,
                widgetKey: 'marketing.hero',
                config: heroConfig,
                kind: 'reset-override'
            })
        ).rejects.toThrow('Hero action targets an inactive section in this layout')
    })

    it('allows removing a section when bound Hero actions do not target it', async () => {
        const { db } = createDb('#pricing')
        const heroWithExternalAction = encodeWidgetConfigEnvelope(
            { rendererConfig: { instanceKey: 'hero-default' }, neutral: { bindings: binding } },
            { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
        )
        const heroWidgetQuery = db.query as jest.Mock
        heroWidgetQuery.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM') && sql.includes('"_mhb_layouts"')) {
                return [{ id: sourceLayoutId, scope_entity_id: null, base_layout_id: null }]
            }
            if (sql.includes('FROM') && sql.includes('"_mhb_widgets"')) {
                return [
                    {
                        id: heroWidgetId,
                        layout_id: sourceLayoutId,
                        widget_key: 'marketing.hero',
                        zone: 'marketing-main',
                        config: heroWithExternalAction,
                        is_active: true
                    },
                    {
                        id: pricingWidgetId,
                        layout_id: sourceLayoutId,
                        widget_key: 'marketing.pricing',
                        zone: 'marketing-main',
                        config: widgetConfig('marketing.pricing', { instanceKey: 'pricing', maxItems: 24, showBenefits: true }, {}),
                        is_active: true
                    }
                ]
            }
            if (sql.includes('FROM') && sql.includes('"_mhb_objects"')) {
                return [
                    {
                        id: heroObjectId,
                        config: {
                            recordPolicy: {
                                version: 1,
                                semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
                                denyDeleteWhenBound: true,
                                immutableSemanticKeyWhenBound: true,
                                runtimeMutation: 'deny',
                                requiredLocales: ['en', 'ru'],
                                coRequiredGroups: [['TermsText', 'TermsLinkLabel', 'TermsAction']]
                            }
                        }
                    }
                ]
            }
            if (sql.includes('FROM') && sql.includes('"_mhb_components"')) {
                const definition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
                return (definition?.bindingSlots?.[0]?.requirements.components ?? []).map((component) => ({
                    codename: component.componentCodename,
                    data_type: component.valueType.toUpperCase(),
                    is_required: component.required,
                    validation_rules: {
                        ...(component.localized ? { localized: true } : {}),
                        ...(component.maxLength !== undefined ? { maxLength: component.maxLength } : {}),
                        ...(component.semanticKey ? { unique: true } : {}),
                        ...(component.pattern === undefined ? {} : { pattern: component.pattern }),
                        ...(component.format ? { format: component.format } : {})
                    }
                }))
            }
            if (sql.includes('FROM') && sql.includes('"_mhb_elements"')) {
                return [
                    {
                        id: '0190a9b5-3cde-7abc-8def-0123456789a6',
                        data: {
                            ...heroRecordData('#pricing'),
                            PrimaryAction: { kind: 'external', url: 'https://example.test' }
                        }
                    }
                ]
            }
            return []
        })

        await expect(
            assertMarketingHeroLayoutMutationPreservesActions(db, 'mhb_0123456789abcdef0123456789abcdef_b1', sourceLayoutId, {
                widgetId: pricingWidgetId,
                widgetKey: 'marketing.pricing',
                kind: 'remove'
            })
        ).resolves.toBeUndefined()
    })
})
